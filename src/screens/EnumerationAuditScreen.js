// /screens/EnumerationAuditScreen.js
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  StatusBar,
  Dimensions,
  Switch,
  TextInput,
  PermissionsAndroid,
  Linking,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';

import FormRow from '../components/FormRow';
import {DropdownRow} from '../components/SelectRows';

const {height} = Dimensions.get('window');

const API_BASE = 'http://be.lte.gisforestry.com';

// ---- CONDITIONS (adjust if your project has a different endpoint) ----
const CONDITIONS_URL = `${API_BASE}/forest-tree-conditions`;

// ---- AUDIT ENDPOINTS (from your cURL) ----
const AUDIT_CREATE_URL = `${API_BASE}/enum/enumeration-audit`; // POST
const AUDIT_GET_ONE_URL = id => `${API_BASE}/enum/enumeration-audit/${id}`; // GET single (you shared)
const AUDIT_PATCH_URL = id => `${API_BASE}/enum/enumeration-audit/${id}`; // PATCH single (you shared)

// ---- OPTIONAL HISTORY ENDPOINTS (if present in backend) ----
// If your backend supports history, one of these usually exists.
// We try them and fallback to single record.
const AUDIT_HISTORY_BY_ENUM_URL = enumerationId =>
  `${API_BASE}/enum/enumeration-audit/by-enumeration/${enumerationId}`;
const AUDIT_HISTORY_QUERY_URL = enumerationId =>
  `${API_BASE}/enum/enumeration-audit?enumerationId=${encodeURIComponent(enumerationId)}`;

// ---- UPLOAD (same infra you used previously) ----
const BUCKET_UPLOAD_URL = 'https://app.eco.gisforestry.com/aws-bucket/tree-enum';
const BUCKET_UPLOAD_PATH = 'enumaration';
const BUCKET_IS_MULTI = 'true';

const MAX_IMAGES = 4;
const MIN_IMAGES = 1;

const COLORS = {
  primary: '#059669',
  primaryDark: '#047857',
  background: '#f8fafc',
  card: '#ffffff',
  text: '#111827',
  textLight: '#6b7280',
  border: '#e5e7eb',
  danger: '#dc2626',
  info: '#7c3aed',
  overlay: 'rgba(15, 23, 42, 0.7)',
};

const safeJson = async res => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const normalizeList = json => {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (typeof json === 'object' && Array.isArray(json.data)) return json.data;
  return [];
};

const fmtDateTime = iso => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '-';
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
};

const uniq = arr => Array.from(new Set((arr || []).filter(Boolean)));

const extractUploadUrls = json => {
  if (!json) return [];
  const urls = [];

  const push = v => {
    if (!v) return;
    if (typeof v === 'string') urls.push(v);
    if (Array.isArray(v)) v.forEach(x => typeof x === 'string' && urls.push(x));
  };

  if (Array.isArray(json?.data)) {
    json.data.forEach(x => {
      push(x?.availableSizes?.image);
      push(x?.availableSizes?.thumbnail);
      push(x?.url);
      push(x?.Location);
    });
  }

  push(json?.data?.availableSizes?.image);
  push(json?.data?.url);
  push(json?.url);

  return uniq(urls);
};

const showSettingsAlert = (title, msg) =>
  Alert.alert(title, msg, [
    {text: 'Cancel', style: 'cancel'},
    {text: 'Open Settings', onPress: () => Linking.openSettings?.()},
  ]);

const ensureCameraOnlyPermission = async () => {
  if (Platform.OS !== 'android') return true;

  const p = PermissionsAndroid.PERMISSIONS.CAMERA;
  const has = await PermissionsAndroid.check(p);
  if (has) return true;

  const res = await PermissionsAndroid.request(p, {
    title: 'Camera permission',
    message: 'We need access to your camera to take a picture.',
    buttonNegative: 'Cancel',
    buttonPositive: 'OK',
  });

  if (res === PermissionsAndroid.RESULTS.GRANTED) return true;

  if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    showSettingsAlert(
      'Permission required',
      'Please enable Camera permission in Settings to take a picture.',
    );
    return false;
  }
  return false;
};

export default function EnumerationAuditScreen({navigation, route}) {
  const enumerationId = route?.params?.enumerationId ?? route?.params?.treeId ?? null;
  const enumeration = route?.params?.enumeration ?? null;

  // Read-only Takki on top (disabled)
  const takkiNumber = useMemo(() => {
    const t =
      enumeration?.takki_number ??
      enumeration?.takkiNumber ??
      enumeration?.takki_no ??
      enumeration?.takki ??
      '';
    return t != null ? String(t) : '';
  }, [enumeration]);

  // Defaults from Tree record (when no audit selected)
  const defaultConditionIdFromTree = useMemo(() => {
    return (
      enumeration?.condition_id ??
      enumeration?.conditionId ??
      enumeration?.condition?.id ??
      null
    );
  }, [enumeration]);

  const defaultIsDisputedFromTree = useMemo(() => {
    return !!(enumeration?.is_disputed ?? enumeration?.isDisputed);
  }, [enumeration]);

  // FY dropdown list
  const yearOptions = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const opts = [];
    for (let i = y - 4; i <= y + 2; i += 1) opts.push(`${i}-${i + 1}`);
    const currentFy = `${y}-${y + 1}`;
    return [currentFy, ...opts.filter(x => x !== currentFy)];
  }, []);

  // Auth token
  const getAuthToken = async () => (await AsyncStorage.getItem('AUTH_TOKEN')) || '';

  // State
  const [loading, setLoading] = useState(false);
  const [conditionsLoading, setConditionsLoading] = useState(false);

  const [conditionRows, setConditionRows] = useState([]); // [{id,name}]
  const [conditionOptions, setConditionOptions] = useState([]); // [name]

  // History
  const [auditHistory, setAuditHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form state
  const [editingAuditId, setEditingAuditId] = useState(null); // if set => PATCH, else => POST
  const [year, setYear] = useState(yearOptions[0] || '');
  const [actualGirth, setActualGirth] = useState('');
  const [conditionId, setConditionId] = useState(null);
  const [conditionName, setConditionName] = useState('');
  const [additionalRemarks, setAdditionalRemarks] = useState('');
  const [isDisputed, setIsDisputed] = useState(false);
  const [dateOfAudit, setDateOfAudit] = useState(new Date().toISOString());

  // Images
  const [localAssets, setLocalAssets] = useState([]);
  const [uploadedUrls, setUploadedUrls] = useState([]);
  const [uploading, setUploading] = useState(false);

  // UI
  const [detailsModal, setDetailsModal] = useState(false);
  const [selectedAuditForView, setSelectedAuditForView] = useState(null);

  const isEditing = !!editingAuditId;

  const resetToNew = useCallback(() => {
    setEditingAuditId(null);
    setYear(yearOptions[0] || '');
    setActualGirth('');
    setAdditionalRemarks('');
    setUploadedUrls([]);
    setLocalAssets([]);
    setDateOfAudit(new Date().toISOString());

    // auto from tree
    setIsDisputed(defaultIsDisputedFromTree);
    if (defaultConditionIdFromTree != null) setConditionId(defaultConditionIdFromTree);
  }, [defaultConditionIdFromTree, defaultIsDisputedFromTree, yearOptions]);

  // Load conditions
  const fetchConditions = useCallback(async () => {
    setConditionsLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(CONDITIONS_URL, {
        headers: token ? {Authorization: `Bearer ${token}`} : undefined,
      });
      const json = await safeJson(res);
      const rows = normalizeList(json)
        .map(x => ({
          id: x?.id ?? x?.condition_id ?? null,
          name: x?.name ?? x?.condition_name ?? '',
        }))
        .filter(x => x.name);

      setConditionRows(rows);
      setConditionOptions(rows.map(x => x.name));
    } catch {
      setConditionRows([]);
      setConditionOptions([]);
    } finally {
      setConditionsLoading(false);
    }
  }, []);

  // Keep conditionName synced with conditionId
  useEffect(() => {
    if (!conditionRows.length) return;
    if (!conditionId) return;
    const row = conditionRows.find(x => String(x.id) === String(conditionId));
    if (row?.name) setConditionName(row.name);
  }, [conditionId, conditionRows]);

  const onConditionChange = name => {
    setConditionName(name);
    const row = conditionRows.find(x => x.name === name);
    setConditionId(row?.id ?? null);
  };

  // Upload
  const uploadImages = useCallback(async assets => {
    if (!assets?.length) return [];

    const net = await NetInfo.fetch();
    const online = !!net.isConnected && (net.isInternetReachable ?? true);
    if (!online) throw new Error('No internet connection. Please connect and try again.');

    const fd = new FormData();
    const fileName = `audit_${enumerationId}_${Date.now()}`;

    assets.slice(0, MAX_IMAGES).forEach((a, idx) => {
      if (!a?.uri) return;
      fd.append('files', {
        uri: a.uri,
        type: a.type || 'image/jpeg',
        name: a.fileName || `${fileName}_${idx}.jpg`,
      });
    });

    fd.append('uploadPath', BUCKET_UPLOAD_PATH);
    fd.append('isMulti', BUCKET_IS_MULTI);
    fd.append('fileName', fileName);

    const token = await getAuthToken();
    const res = await fetch(BUCKET_UPLOAD_URL, {
      method: 'POST',
      headers: token ? {Authorization: `Bearer ${token}`} : undefined,
      body: fd,
    });

    const json = await safeJson(res);
    if (!res.ok) {
      throw new Error(json?.message || json?.error || `Upload failed (${res.status})`);
    }

    const urls = extractUploadUrls(json);
    return urls.slice(0, MAX_IMAGES);
  }, [enumerationId]);

  // History fetch (tries list endpoints first, fallback to single)
  const fetchAuditHistory = useCallback(async () => {
    if (!enumerationId) return;

    setHistoryLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Missing AUTH_TOKEN');

      const headers = {Authorization: `Bearer ${token}`};

      // Try list endpoints (if backend supports)
      const tryUrls = [
        AUDIT_HISTORY_BY_ENUM_URL(enumerationId),
        AUDIT_HISTORY_QUERY_URL(enumerationId),
      ];

      let list = null;
      for (const u of tryUrls) {
        try {
          const res = await fetch(u, {method: 'GET', headers});
          if (!res.ok) continue;
          const json = await safeJson(res);
          const arr = normalizeList(json);
          if (Array.isArray(arr) && arr.length) {
            list = arr;
            break;
          }
          // If backend returns empty array, we still accept it
          if (Array.isArray(arr)) {
            list = arr;
            break;
          }
        } catch {
          // ignore and continue
        }
      }

      // Fallback: treat enumerationId as the audit id (single record)
      if (list === null) {
        const res = await fetch(AUDIT_GET_ONE_URL(enumerationId), {method: 'GET', headers});

        if (res.status === 404) {
          setAuditHistory([]);
          return;
        }
        const json = await safeJson(res);
        if (!res.ok) {
          throw new Error(json?.message || `Audit load failed (${res.status})`);
        }
        const one = json?.data ?? json;
        list = one ? [one] : [];
      }

      // Normalize minimal fields
      const normalized = (list || []).map(a => ({
        id: a?.id ?? a?._id ?? null,
        enumerationId: a?.enumerationId ?? a?.enumeration_id ?? null,
        year: a?.year ?? '',
        actual_girth: a?.actual_girth ?? a?.actualGirth ?? '',
        condition_id: a?.condition_id ?? a?.conditionId ?? a?.condition?.id ?? null,
        pictures: Array.isArray(a?.pictures) ? a.pictures : [],
        additionalRemarks: a?.additionalRemarks ?? a?.additional_remarks ?? '',
        isDisputed: !!(a?.isDisputed ?? a?.is_disputed),
        dateOfAudit: a?.dateOfAudit ?? a?.date_of_audit ?? a?.updated_at ?? a?.created_at ?? null,
        raw: a,
      }));

      normalized.sort((x, y) => new Date(y.dateOfAudit || 0) - new Date(x.dateOfAudit || 0));
      setAuditHistory(normalized);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to load audit history.');
      setAuditHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [enumerationId]);

  const loadAuditIntoForm = useCallback(audit => {
    if (!audit) return;

    setEditingAuditId(audit.id || null);
    setYear(String(audit.year || yearOptions[0] || ''));
    setActualGirth(String(audit.actual_girth || ''));
    setAdditionalRemarks(String(audit.additionalRemarks || ''));
    setIsDisputed(!!audit.isDisputed);
    setDateOfAudit(String(audit.dateOfAudit || new Date().toISOString()));

    if (audit.condition_id != null) setConditionId(audit.condition_id);

    // images: treat as already uploaded URLs
    const pics = (audit.pictures || []).slice(0, MAX_IMAGES);
    setUploadedUrls(pics);
    setLocalAssets([]);
  }, [yearOptions]);

  // Image pickers
  const totalSelected = useMemo(() => {
    const localCount = localAssets?.length || 0;
    const urlCount = uploadedUrls?.length || 0;
    return localCount > 0 ? localCount : urlCount;
  }, [localAssets, uploadedUrls]);

  const removeLocalAt = idx => {
    setLocalAssets(prev => {
      const p = Array.isArray(prev) ? [...prev] : [];
      p.splice(idx, 1);
      return p;
    });
  };

  const addFromCamera = async () => {
    const remaining = MAX_IMAGES - totalSelected;
    if (remaining <= 0) return Alert.alert('Limit', `Max ${MAX_IMAGES} images.`);

    const ok = await ensureCameraOnlyPermission();
    if (!ok) return;

    const res = await launchCamera({
      mediaType: 'photo',
      quality: 0.8,
      saveToPhotos: false,
      cameraType: 'back',
    });

    if (res?.didCancel) return;
    if (res?.errorCode) {
      if (String(res.errorCode).includes('permission')) {
        showSettingsAlert('Permission required', 'Please enable Camera permission in Settings.');
        return;
      }
      return Alert.alert('Camera Error', res.errorMessage || res.errorCode);
    }

    const asset = res?.assets?.[0];
    if (!asset?.uri) return Alert.alert('Camera Error', 'No image captured.');

    // picking new images means replace old urls on save
    setUploadedUrls([]);
    setLocalAssets(prev => [...(prev || []), asset].slice(0, MAX_IMAGES));
  };

  const addFromGallery = async () => {
    const remaining = MAX_IMAGES - totalSelected;
    if (remaining <= 0) return Alert.alert('Limit', `Max ${MAX_IMAGES} images.`);

    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: Math.min(remaining, MAX_IMAGES),
      quality: 0.8,
    });

    if (res?.didCancel) return;
    if (res?.errorCode) return Alert.alert('Gallery Error', res.errorMessage || res.errorCode);

    const assets = Array.isArray(res?.assets) ? res.assets : [];
    if (!assets.length) return;

    setUploadedUrls([]);
    setLocalAssets(prev => [...(prev || []), ...assets].slice(0, MAX_IMAGES));
  };

  const showImageMenu = () => {
    Alert.alert('Add Images', 'Choose source', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Camera', onPress: addFromCamera},
      {text: 'Gallery', onPress: addFromGallery},
    ]);
  };

  // Save
  const validateAndBuildPayload = useCallback(async () => {
    if (!enumerationId) throw new Error('Missing enumerationId.');
    if (!year) throw new Error('Please select Year.');
    if (!conditionId) throw new Error('Please select Tree Condition.');

    const chosenCount =
      (localAssets?.length || 0) > 0 ? localAssets.length : (uploadedUrls?.length || 0);

    if (chosenCount < MIN_IMAGES) throw new Error(`Please add at least ${MIN_IMAGES} image.`);
    if (chosenCount > MAX_IMAGES) throw new Error(`You can add maximum ${MAX_IMAGES} images.`);

    let pictures = [];

    if (localAssets?.length) {
      setUploading(true);
      const urls = await uploadImages(localAssets);
      pictures = urls.slice(0, MAX_IMAGES);
      if (!pictures.length) throw new Error('Upload succeeded but no image URL returned.');
      setUploadedUrls(pictures);
      setLocalAssets([]);
    } else {
      pictures = (uploadedUrls || []).slice(0, MAX_IMAGES);
    }

    return {
      enumerationId: Number(enumerationId),
      year: String(year),
      actual_girth: String(actualGirth || '').trim(),
      condition_id: Number(conditionId),
      pictures,
      additionalRemarks: String(additionalRemarks || '').trim(),
      isDisputed: !!isDisputed,
      dateOfAudit: String(dateOfAudit || new Date().toISOString()),
    };
  }, [
    enumerationId,
    year,
    conditionId,
    actualGirth,
    additionalRemarks,
    isDisputed,
    dateOfAudit,
    localAssets,
    uploadedUrls,
    uploadImages,
  ]);

  const postAudit = async payload => {
    const token = await getAuthToken();
    if (!token) throw new Error('Missing AUTH_TOKEN');

    const res = await fetch(AUDIT_CREATE_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify(payload),
    });

    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || `Create failed (${res.status})`);
    return json?.data ?? json;
  };

  const patchAudit = async (id, payload) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Missing AUTH_TOKEN');
    if (!id) throw new Error('Missing audit id for update.');

    // PATCH should accept partial, but we send full for consistency
    const res = await fetch(AUDIT_PATCH_URL(id), {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify(payload),
    });

    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || `Update failed (${res.status})`);
    return json?.data ?? json;
  };

  const onSave = async () => {
    try {
      setLoading(true);

      const payload = await validateAndBuildPayload();

      if (isEditing) {
        await patchAudit(editingAuditId, payload);
        Alert.alert('Success', 'Audit updated successfully.');
      } else {
        await postAudit(payload);
        Alert.alert('Success', 'Audit created successfully.');
      }

      // Refresh list
      await fetchAuditHistory();

      // Reset to New mode (optional UX). If you want to keep editing record, remove this line.
      resetToNew();
    } catch (e) {
      Alert.alert('Save Failed', e?.message || 'Failed to save audit.');
    } finally {
      setUploading(false);
      setLoading(false);
    }
  };

  // Init
  useEffect(() => {
    fetchConditions();
  }, [fetchConditions]);

  useEffect(() => {
    // initial defaults for new audit
    resetToNew();
  }, [resetToNew]);

  useEffect(() => {
    fetchAuditHistory();
  }, [fetchAuditHistory]);

  // UI Handlers
  const openAuditView = audit => {
    setSelectedAuditForView(audit);
    setDetailsModal(true);
  };

  const onEditAudit = audit => {
    loadAuditIntoForm(audit);
    Alert.alert('Edit Mode', 'Audit loaded into form. Update fields and press Save.');
  };

  const headerTitle = isEditing ? 'Update Audit' : 'Add Audit';

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.headerGrad}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{flex: 1}}>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Text style={styles.headerSub}>Enumeration ID: {String(enumerationId ?? '—')}</Text>
          </View>

          <TouchableOpacity
            style={[styles.headerBtn, {backgroundColor: 'rgba(255,255,255,0.18)'}]}
            onPress={resetToNew}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{padding: 16, paddingBottom: 30}}>
        {/* TAKKI (read-only) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tree (Read Only)</Text>
          <View style={{position: 'relative'}}>
            <FormRow label="Takki Number" value={takkiNumber || '—'} editable={false} />
            <Ionicons
              name="lock-closed"
              size={16}
              color="#9ca3af"
              style={{position: 'absolute', right: 12, top: 42}}
            />
          </View>
        </View>

        {/* HISTORY LIST (like follow-ups) */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Audit History</Text>
            {historyLoading ? (
              <ActivityIndicator size="small" />
            ) : (
              <TouchableOpacity onPress={fetchAuditHistory} style={styles.smallBtn}>
                <Ionicons name="refresh" size={16} color={COLORS.text} />
                <Text style={styles.smallBtnText}>Refresh</Text>
              </TouchableOpacity>
            )}
          </View>

          {!historyLoading && auditHistory.length === 0 ? (
            <Text style={{color: COLORS.textLight}}>No audits found yet.</Text>
          ) : (
            auditHistory.map((a, idx) => {
              const when = fmtDateTime(a.dateOfAudit);
              const disputed = a.isDisputed ? 'Disputed' : 'Normal';

              return (
                <View key={`${a.id || idx}`} style={styles.historyCard}>
                  <View style={styles.rowBetween}>
                    <View style={{flex: 1}}>
                      <Text style={styles.hTitle}>
                        {a.year || '—'} • {disputed}
                      </Text>
                      <Text style={styles.hSub}>
                        {when} • Girth: {a.actual_girth || '—'}
                      </Text>
                    </View>

                    <View style={{flexDirection: 'row', gap: 10}}>
                      <TouchableOpacity
                        style={[styles.pill, {backgroundColor: COLORS.info}]}
                        onPress={() => openAuditView(a)}>
                        <Ionicons name="eye" size={14} color="#fff" />
                        <Text style={styles.pillText}>View</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.pill, {backgroundColor: COLORS.primary}]}
                        onPress={() => onEditAudit(a)}>
                        <Ionicons name="create" size={14} color="#fff" />
                        <Text style={styles.pillText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {!!a.pictures?.length && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 10}}>
                      {a.pictures.slice(0, 4).map((uri, i) => (
                        <Image
                          key={`${uri}_${i}`}
                          source={{uri}}
                          style={styles.thumb}
                        />
                      ))}
                    </ScrollView>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* FORM */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Audit Form</Text>

          <View style={styles.modeBar}>
            <Ionicons name={isEditing ? 'pencil' : 'add-circle'} size={16} color={COLORS.text} />
            <Text style={styles.modeText}>
              {isEditing ? `Editing audit #${editingAuditId}` : 'Creating a new audit'}
            </Text>
          </View>

          <DropdownRow
            label="Year"
            value={year}
            onChange={setYear}
            options={yearOptions}
            required
            searchable={false}
          />

          <FormRow
            label="Actual Girth"
            value={actualGirth}
            onChangeText={setActualGirth}
            placeholder='e.g. "24..."'
          />

          <DropdownRow
            label={conditionsLoading ? 'Condition (Loading...)' : 'Condition'}
            value={conditionName}
            onChange={onConditionChange}
            options={conditionOptions}
            disabled={conditionsLoading}
            required
            searchable
            searchPlaceholder="Search condition..."
          />

          <View style={styles.switchRow}>
            <View style={{flex: 1}}>
              <Text style={styles.switchLabel}>Is Disputed</Text>
              <Text style={styles.switchHint}>Auto-filled from previous audit/tree record.</Text>
            </View>
            <Switch value={isDisputed} onValueChange={setIsDisputed} />
          </View>

          <Text style={styles.label}>Additional Remarks</Text>
          <TextInput
            value={additionalRemarks}
            onChangeText={setAdditionalRemarks}
            placeholder="Verified on site"
            placeholderTextColor="#9ca3af"
            style={styles.textArea}
            multiline
            numberOfLines={4}
          />

          <FormRow
            label="Date Of Audit (ISO)"
            value={dateOfAudit}
            onChangeText={setDateOfAudit}
            placeholder="2026-01-10T10:00:00Z"
          />

          {/* IMAGES */}
          <View style={{marginTop: 14}}>
            <TouchableOpacity style={styles.imgBtn} onPress={showImageMenu} disabled={loading || uploading}>
              <Ionicons name="camera-outline" size={22} color={COLORS.primary} />
              <View style={{flex: 1}}>
                <Text style={styles.imgBtnTitle}>Add / Change Images</Text>
                <Text style={styles.imgBtnSub}>
                  Min {MIN_IMAGES}, Max {MAX_IMAGES}. Selected: {totalSelected}
                </Text>
              </View>
              {(loading || uploading) && <ActivityIndicator size="small" />}
            </TouchableOpacity>

            {!!localAssets?.length && (
              <>
                <Text style={styles.note}>Selected (Local): {localAssets.length}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 8}}>
                  {localAssets.map((a, idx) => (
                    <View key={`${a?.uri}_${idx}`} style={styles.localWrap}>
                      <View style={styles.localBox}>
                        <Text style={{fontWeight: '800'}}>Img {idx + 1}</Text>
                      </View>
                      <TouchableOpacity style={styles.removeX} onPress={() => removeLocalAt(idx)}>
                        <Ionicons name="close-circle" size={18} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            {!!uploadedUrls?.length && !localAssets?.length && (
              <Text style={styles.note}>Existing (Server): {uploadedUrls.length}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (loading || uploading) && {opacity: 0.75}]}
            disabled={loading || uploading}
            onPress={onSave}>
            <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.saveGrad}>
              {loading ? (
                <>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.saveText}>{isEditing ? 'Updating...' : 'Saving...'}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.saveText}>{isEditing ? 'Update Audit' : 'Save Audit'}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* VIEW MODAL (like details modal) */}
      <Modal
        visible={detailsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setDetailsModal(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalWrap}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Audit Details</Text>
                <TouchableOpacity onPress={() => setDetailsModal(false)} style={styles.modalClose}>
                  <Ionicons name="close" size={22} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{padding: 16}} showsVerticalScrollIndicator={false}>
                <Text style={styles.mRow}>Year: {selectedAuditForView?.year || '—'}</Text>
                <Text style={styles.mRow}>Actual Girth: {selectedAuditForView?.actual_girth || '—'}</Text>
                <Text style={styles.mRow}>Is Disputed: {selectedAuditForView?.isDisputed ? 'Yes' : 'No'}</Text>
                <Text style={styles.mRow}>Date: {fmtDateTime(selectedAuditForView?.dateOfAudit)}</Text>
                <Text style={styles.mRow}>
                  Remarks: {selectedAuditForView?.additionalRemarks ? selectedAuditForView.additionalRemarks : '—'}
                </Text>

                {!!selectedAuditForView?.pictures?.length && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 12}}>
                    {selectedAuditForView.pictures.slice(0, 6).map((uri, i) => (
                      <Image key={`${uri}_${i}`} source={{uri}} style={styles.thumbBig} />
                    ))}
                  </ScrollView>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: COLORS.background},

  headerGrad: {
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 0) + 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  headerRow: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10},
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900'},
  headerSub: {color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700', marginTop: 2},

  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {fontSize: 14, fontWeight: '900', color: COLORS.text, marginBottom: 10},

  rowBetween: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  smallBtnText: {fontWeight: '800', color: COLORS.text},

  historyCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  hTitle: {fontWeight: '900', color: COLORS.text},
  hSub: {marginTop: 2, color: COLORS.textLight, fontWeight: '700', fontSize: 12},

  pill: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: {color: '#fff', fontWeight: '900', fontSize: 12},

  thumb: {width: 72, height: 56, borderRadius: 10, marginRight: 8, backgroundColor: '#eee'},
  thumbBig: {width: 120, height: 90, borderRadius: 12, marginRight: 10, backgroundColor: '#eee'},

  modeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  modeText: {fontWeight: '800', color: COLORS.text},

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
    marginTop: 10,
  },
  switchLabel: {fontSize: 14, fontWeight: '900', color: COLORS.text},
  switchHint: {fontSize: 12, fontWeight: '700', color: COLORS.textLight, marginTop: 2},

  label: {marginTop: 12, marginBottom: 6, fontWeight: '900', color: COLORS.text},
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    color: COLORS.text,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },

  imgBtn: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  imgBtnTitle: {fontWeight: '900', color: COLORS.text},
  imgBtnSub: {marginTop: 2, fontWeight: '700', color: COLORS.textLight, fontSize: 12},

  note: {marginTop: 8, color: COLORS.textLight, fontWeight: '700'},

  localWrap: {width: 76, height: 76, marginRight: 10, borderRadius: 14, overflow: 'hidden'},
  localBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: 'rgba(5,150,105,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeX: {position: 'absolute', top: 2, right: 2, backgroundColor: '#fff', borderRadius: 12},

  saveBtn: {marginTop: 16, borderRadius: 16, overflow: 'hidden'},
  saveGrad: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, paddingVertical: 14},
  saveText: {color: '#fff', fontWeight: '900', fontSize: 15},

  // modal
  modalOverlay: {flex: 1, backgroundColor: COLORS.overlay},
  modalBackdrop: {...StyleSheet.absoluteFillObject},
  modalWrap: {flex: 1, justifyContent: 'center', padding: 18},
  modalCard: {
    maxHeight: height * 0.75,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {fontWeight: '900', fontSize: 16, color: COLORS.text},
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(17,24,39,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mRow: {color: COLORS.text, fontWeight: '800', marginBottom: 10, lineHeight: 20},
});
