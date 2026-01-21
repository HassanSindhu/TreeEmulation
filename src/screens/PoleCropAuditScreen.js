// PoleCropAuditScreen.js
// ✅ COMPLETE AUDIT SCREEN FOR POLE CROP
// ✅ Uses:
//    - GET  /enum/pole-crop-audit/by-pole-crop/:poleCropId
//    - POST /enum/pole-crop-audit
// ✅ Auto-fills planted/expected counts from the Pole Crop record you clicked
// ✅ Live success % = (successCount / plantedCount) * 100
// ✅ Fixes "Encountered two children with the same key X" by de-duplicating + stable unique keys
// ✅ Optional image upload to bucket (same pattern as your pole crop screen)

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  StatusBar,
  Image,
  Linking,
  PermissionsAndroid,
  Switch,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useFocusEffect} from '@react-navigation/native';
import {launchImageLibrary, launchCamera} from 'react-native-image-picker';

import FormRow from '../components/FormRow';

const {width, height} = Dimensions.get('window');

// Theme Colors (matching your style)
const COLORS = {
  primary: '#059669',
  primaryLight: '#10b981',
  primaryDark: '#047857',
  secondary: '#0ea5e9',
  success: '#16a34a',
  warning: '#f97316',
  danger: '#dc2626',
  info: '#7c3aed',
  background: '#f8fafc',
  card: '#ffffff',
  text: '#1f2937',
  textLight: '#6b7280',
  border: '#e5e7eb',
  overlay: 'rgba(15, 23, 42, 0.7)',
};

// API
const API_BASE = 'http://be.lte.gisforestry.com';
const AWS_Base = 'https://app.eco.gisforestry.com';

const POLE_CROP_AUDIT_CREATE_URL = `${API_BASE}/enum/pole-crop-audit`;
const POLE_CROP_AUDIT_LIST_URL = poleCropId =>
  `${API_BASE}/enum/pole-crop-audit/by-pole-crop/${poleCropId}`;

// Bucket Upload API
const BUCKET_UPLOAD_URL = `${AWS_Base}/aws-bucket/tree-enum`;

// You can keep same bucket foldering convention
const BUCKET_UPLOAD_PATH_AUDIT_PICS = 'PolecropAudit/Pictures';
const BUCKET_UPLOAD_PATH_DR_EVIDENCE = 'PolecropAudit/DR-Evidence';
const BUCKET_UPLOAD_PATH_FIR_EVIDENCE = 'PolecropAudit/FIR-Evidence';

// You used these before
const BUCKET_IS_MULTI = 'true';
const BUCKET_FILE_NAME = 'audit';

const getToken = async () => (await AsyncStorage.getItem('AUTH_TOKEN')) || '';

/** normalizeList: handles
 * - array
 * - { data: [] }
 * - { data: { data: [] } }
 */
const normalizeList = json => {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (typeof json === 'object') {
    if (Array.isArray(json.data)) return json.data;
    if (json.data && Array.isArray(json.data.data)) return json.data.data;
  }
  return [];
};

const safeDate = raw => {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const toISOIfValid = raw => {
  const d = safeDate(raw);
  return d ? d.toISOString() : null;
};

const truthy = v => v === true || v === 'true' || v === 1 || v === '1';

// percentage helpers
const calcPercent = (success, expected) => {
  const s = Number(success);
  const e = Number(expected);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= 0) return null;
  const pct = (s / e) * 100;
  return Math.max(0, Math.min(100, pct));
};
const formatPercent = pct => {
  if (pct === null || pct === undefined) return '—';
  return `${pct.toFixed(1)}%`;
};

// RN form-data file helper
const toFormFile = asset => {
  const uri = asset?.uri;
  if (!uri) return null;

  const name =
    asset?.fileName ||
    `audit_${Date.now()}${asset?.type?.includes('png') ? '.png' : '.jpg'}`;

  const type = asset?.type || 'image/jpeg';
  return {uri, name, type};
};

// Extract planted species counts from the pole crop record you clicked
// Supports new API shape: poleCropSpecies: [{ id, name, count, audit_no }]
// Supports legacy shape: species_counts: [{ species_id, count }]
const getPoleCropSpeciesForAudit = (poleCropRow, speciesRows = []) => {
  const row = poleCropRow || {};

  // new
  const pcs = Array.isArray(row?.poleCropSpecies) ? row.poleCropSpecies : [];
  if (pcs.length) {
    return pcs
      .map(x => ({
        species_id: x?.id ?? null,
        name: String(x?.name ?? '').trim() || `#${x?.id ?? '—'}`,
        expectedCount: Number(x?.count ?? 0) || 0, // planted/expected from record
        audit_no: x?.audit_no ?? null,
      }))
      .filter(x => x.species_id != null);
  }

  // legacy
  const sc = Array.isArray(row?.species_counts) ? row.species_counts : [];
  if (sc.length) {
    return sc
      .map(x => {
        const sid = x?.species_id;
        const name =
          speciesRows.find(s => String(s.id) === String(sid))?.name || `#${sid ?? '—'}`;
        return {
          species_id: sid ?? null,
          name,
          expectedCount: Number(x?.count ?? 0) || 0,
          audit_no: null,
        };
      })
      .filter(x => x.species_id != null);
  }

  return [];
};

// De-duplicate by species_id (prevents duplicate-key issues)
const dedupeBySpeciesId = list => {
  const raw = Array.isArray(list) ? list : [];
  const seen = new Map();

  raw.forEach(item => {
    const sid = String(item?.species_id);
    if (!sid || sid === 'undefined' || sid === 'null') return;

    if (!seen.has(sid)) {
      seen.set(sid, item);
    } else {
      const old = seen.get(sid);
      const oldExp = Number(old?.expectedCount ?? 0);
      const newExp = Number(item?.expectedCount ?? 0);
      if (newExp > oldExp) seen.set(sid, item);
    }
  });

  return Array.from(seen.values());
};

export default function PoleCropAuditScreen({navigation, route}) {
  // ✅ IMPORTANT: pass the clicked record from PoleCropRecordsScreen:
  // navigation.navigate('PoleCropAuditScreen', { poleCrop: r, enumeration })
  const poleCrop = route?.params?.poleCrop || null;
  const enumeration = route?.params?.enumeration || null;

  const poleCropId = useMemo(() => poleCrop?.id ?? null, [poleCrop]);

  // ---------- STATE ----------
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [serverError, setServerError] = useState('');

  // Add modal
  const [modalVisible, setModalVisible] = useState(false);

  // Form fields
  const [dateOfAudit, setDateOfAudit] = useState(''); // user input
  const [notSuccessReason, setNotSuccessReason] = useState('');
  const [additionalRemarks, setAdditionalRemarks] = useState('');
  const [drNo, setDrNo] = useState('');
  const [drDate, setDrDate] = useState('');

  const [fineImposed, setFineImposed] = useState(false);
  const [fineAmount, setFineAmount] = useState('');

  const [firRegistered, setFirRegistered] = useState(false);
  const [firNumber, setFirNumber] = useState('');

  // Success counts keyed by species_id
  const [successCountMap, setSuccessCountMap] = useState({});

  // Images
  const [auditPicsAssets, setAuditPicsAssets] = useState([]);
  const [drEvidenceAssets, setDrEvidenceAssets] = useState([]);
  const [firEvidenceAssets, setFirEvidenceAssets] = useState([]);

  const [uploading, setUploading] = useState(false);

  // Viewer
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState([]);
  const [viewerTitle, setViewerTitle] = useState('');

  // --- Derived: species list from clicked poleCrop record ---
  const speciesList = useMemo(() => {
    const raw = getPoleCropSpeciesForAudit(poleCrop, []);
    return dedupeBySpeciesId(raw);
  }, [poleCrop]);

  // Prefill successCountMap when opening modal
  const prefillSuccessCounts = useCallback(() => {
    const next = {};
    speciesList.forEach(s => {
      const sid = String(s.species_id);
      // default to blank (user must fill) OR prefill 0
      next[sid] = '';
    });
    setSuccessCountMap(next);
  }, [speciesList]);

  const setSuccessCount = (speciesId, value) => {
    const clean = String(value ?? '').replace(/[^\d.]/g, '');
    setSuccessCountMap(prev => ({...(prev || {}), [String(speciesId)]: clean}));
  };

  const totalExpected = useMemo(() => {
    return speciesList.reduce((acc, s) => acc + (Number(s?.expectedCount) || 0), 0);
  }, [speciesList]);

  const totalSuccess = useMemo(() => {
    const keys = Object.keys(successCountMap || {});
    return keys.reduce((acc, sid) => acc + (Number(successCountMap?.[sid]) || 0), 0);
  }, [successCountMap]);

  const totalPercent = useMemo(() => calcPercent(totalSuccess, totalExpected), [totalSuccess, totalExpected]);

  // ---------- Images helpers ----------
  const addAssetsUnique = useCallback((setter, newAssets) => {
    const incoming = Array.isArray(newAssets) ? newAssets : [];
    if (!incoming.length) return;

    setter(prev => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const map = new Map();

      prevArr.forEach(a => {
        if (a?.uri) map.set(a.uri, a);
      });
      incoming.forEach(a => {
        if (a?.uri) map.set(a.uri, a);
      });

      return Array.from(map.values());
    });
  }, []);

  const pickImages = (setter) => {
    launchImageLibrary(
      {mediaType: 'photo', quality: 0.8, selectionLimit: 0},
      res => {
        if (res?.didCancel) return;
        if (res?.errorCode) {
          Alert.alert('Image Error', res.errorMessage || res.errorCode);
          return;
        }
        addAssetsUnique(setter, res?.assets || []);
      },
    );
  };

  const ensureCameraPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title: 'Camera Permission',
        message: 'This app needs camera access to capture audit images.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      });
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      return false;
    }
  }, []);

  const captureImage = useCallback(
    async (setter) => {
      const ok = await ensureCameraPermission();
      if (!ok) {
        Alert.alert('Permission Required', 'Camera permission is required to take a photo.');
        return;
      }

      launchCamera(
        {mediaType: 'photo', quality: 0.8, saveToPhotos: false, cameraType: 'back'},
        res => {
          if (res?.didCancel) return;
          if (res?.errorCode) {
            Alert.alert('Camera Error', res.errorMessage || res.errorCode);
            return;
          }
          addAssetsUnique(setter, res?.assets || []);
        },
      );
    },
    [addAssetsUnique, ensureCameraPermission],
  );

  const clearAssets = setter => setter([]);

  const uploadAssetsToBucket = async (assets, uploadPath) => {
    const list = Array.isArray(assets) ? assets : [];
    if (!list.length) return [];

    const form = new FormData();

    list.forEach(a => {
      const f = toFormFile(a);
      if (f) form.append('files', f);
    });

    form.append('uploadPath', uploadPath);
    form.append('isMulti', BUCKET_IS_MULTI);
    form.append('fileName', BUCKET_FILE_NAME);

    const res = await fetch(BUCKET_UPLOAD_URL, {method: 'POST', body: form});
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.status) {
      const msg = json?.message || json?.error || `upload failed (${res.status})`;
      throw new Error(msg);
    }

    const data = Array.isArray(json?.data) ? json.data : [];
    const urls = [];

    data.forEach(item => {
      const img = item?.availableSizes?.image;
      if (img) urls.push(img);

      const arr = Array.isArray(item?.url) ? item.url : [];
      arr.forEach(u => {
        if (u && !urls.includes(u)) urls.push(u);
      });
    });

    return urls;
  };

  const openPicturesViewer = (pics, title = 'Pictures') => {
    const list = Array.isArray(pics) ? pics.filter(Boolean) : [];
    if (!list.length) {
      Alert.alert('Pictures', 'No pictures available.');
      return;
    }
    setViewerImages(list);
    setViewerTitle(title);
    setViewerVisible(true);
  };

  // ---------- FETCH AUDITS ----------
  const fetchPoleCropAudits = useCallback(
    async ({refresh = false} = {}) => {
      if (!poleCropId) {
        setAudits([]);
        setServerError('PoleCropId missing. Please open audit from Pole Crop records screen.');
        return;
      }

      try {
        refresh ? setRefreshing(true) : setLoading(true);
        setServerError('');

        const token = await getToken();
        if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

        const res = await fetch(POLE_CROP_AUDIT_LIST_URL(poleCropId), {
          method: 'GET',
          headers: {Authorization: `Bearer ${token}`},
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = json?.message || json?.error || `API Error (${res.status})`;
          throw new Error(msg);
        }

        let rows = normalizeList(json);
        rows = Array.isArray(rows) ? rows : [];
        setAudits(rows);
      } catch (e) {
        setAudits([]);
        setServerError(e?.message || 'Failed to fetch audits');
      } finally {
        refresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [poleCropId],
  );

  useEffect(() => {
    fetchPoleCropAudits();
  }, [fetchPoleCropAudits]);

  useFocusEffect(
    useCallback(() => {
      fetchPoleCropAudits({refresh: true});
    }, [fetchPoleCropAudits]),
  );

  // ---------- MODAL OPEN/CLOSE ----------
  const resetForm = useCallback(() => {
    setDateOfAudit('');
    setNotSuccessReason('');
    setAdditionalRemarks('');
    setDrNo('');
    setDrDate('');
    setFineImposed(false);
    setFineAmount('');
    setFirRegistered(false);
    setFirNumber('');

    setAuditPicsAssets([]);
    setDrEvidenceAssets([]);
    setFirEvidenceAssets([]);

    prefillSuccessCounts();
  }, [prefillSuccessCounts]);

  const openAddAudit = () => {
    if (!poleCropId) {
      Alert.alert('Error', 'PoleCropId missing.');
      return;
    }
    if (!speciesList.length) {
      Alert.alert('Species Missing', 'No species found in this Pole Crop record.');
      return;
    }
    resetForm();
    setModalVisible(true);
  };

  // ---------- VALIDATION ----------
  const validate = () => {
    if (!poleCropId) {
      Alert.alert('Error', 'PoleCropId missing.');
      return false;
    }

    // Date of audit required
    if (!String(dateOfAudit || '').trim()) {
      Alert.alert('Missing', 'Date of Audit is required. Use ISO or YYYY-MM-DD.');
      return false;
    }
    const dAudit = safeDate(dateOfAudit);
    if (!dAudit) {
      Alert.alert('Invalid', 'Date of Audit is invalid. Example: 2025-01-13T10:00:00Z');
      return false;
    }

    // Success counts required per species
    for (let i = 0; i < speciesList.length; i++) {
      const s = speciesList[i];
      const sid = String(s.species_id);
      const val = successCountMap?.[sid];

      if (!String(val ?? '').trim()) {
        Alert.alert('Missing', `Success Count is required for ${s.name}.`);
        return false;
      }

      const n = Number(val);
      if (!Number.isFinite(n) || n < 0) {
        Alert.alert('Invalid', `Success Count must be a non-negative number for ${s.name}.`);
        return false;
      }

      // Optional constraint: success cannot exceed planted
      const planted = Number(s?.expectedCount ?? 0);
      if (Number.isFinite(planted) && planted > 0 && n > planted) {
        Alert.alert('Invalid', `Success Count cannot exceed Planted (${planted}) for ${s.name}.`);
        return false;
      }
    }

    // Fine amount validation
    if (fineImposed) {
      const fa = Number(fineAmount);
      if (!String(fineAmount || '').trim()) {
        Alert.alert('Missing', 'Fine Amount is required when Fine Imposed is ON.');
        return false;
      }
      if (!Number.isFinite(fa) || fa <= 0) {
        Alert.alert('Invalid', 'Fine Amount must be a positive number.');
        return false;
      }
    }

    // FIR validation
    if (firRegistered) {
      if (!String(firNumber || '').trim()) {
        Alert.alert('Missing', 'FIR Number is required when FIR Registered is ON.');
        return false;
      }
    }

    // DR date optional, but if provided must be valid
    if (String(drDate || '').trim() && !safeDate(drDate)) {
      Alert.alert('Invalid', 'DR Date is invalid. Example: 2025-01-11T00:00:00Z');
      return false;
    }

    return true;
  };

  // ---------- SUBMIT AUDIT ----------
  const submitAudit = async () => {
    if (!validate()) return;

    try {
      setUploading(true);

      const token = await getToken();
      if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

      // Upload images if user selected them
      const [picsUrls, drUrls, firUrls] = await Promise.all([
        uploadAssetsToBucket(auditPicsAssets, BUCKET_UPLOAD_PATH_AUDIT_PICS),
        uploadAssetsToBucket(drEvidenceAssets, BUCKET_UPLOAD_PATH_DR_EVIDENCE),
        uploadAssetsToBucket(firEvidenceAssets, BUCKET_UPLOAD_PATH_FIR_EVIDENCE),
      ]);

      const speciesSuccessCounts = speciesList.map(s => {
        const sid = Number(s.species_id);
        return {
          species_id: sid,
          successCount: Number(successCountMap?.[String(s.species_id)]) || 0,
        };
      });

      const payload = {
        poleCropId: Number(poleCropId),
        dateOfAudit: new Date(dateOfAudit).toISOString(),
        speciesSuccessCounts,
        notSuccessReason: String(notSuccessReason || '').trim() || null,
        additionalRemarks: String(additionalRemarks || '').trim() || null,
        drNo: String(drNo || '').trim() || null,
        drDate: String(drDate || '').trim() ? new Date(drDate).toISOString() : null,
        drEvidence: Array.isArray(drUrls) ? drUrls : [],
        fineImposed: !!fineImposed,
        fineAmount: fineImposed ? Number(fineAmount) : 0,
        firRegistered: !!firRegistered,
        firNumber: firRegistered ? String(firNumber || '').trim() : null,
        firEvidence: Array.isArray(firUrls) ? firUrls : [],
        pictures: Array.isArray(picsUrls) ? picsUrls : [],
      };

      const res = await fetch(POLE_CROP_AUDIT_CREATE_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.message || json?.error || `API Error (${res.status})`;
        throw new Error(msg);
      }

      setModalVisible(false);
      fetchPoleCropAudits({refresh: true});
      Alert.alert('Success', 'Audit saved successfully.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to save audit');
    } finally {
      setUploading(false);
    }
  };

  // ---------- UI HELPERS ----------
  const summarizeSuccessCounts = (speciesSuccessCounts, expectedSpeciesList) => {
    const ssc = Array.isArray(speciesSuccessCounts) ? speciesSuccessCounts : [];
    const m = new Map(
      ssc.map(x => [String(x?.species_id ?? x?.speciesId), Number(x?.successCount ?? 0)])
    );

    const parts = expectedSpeciesList.map(s => {
      const sid = String(s.species_id);
      const planted = Number(s?.expectedCount ?? 0);
      const success = Number(m.get(sid) ?? 0);
      const pct = calcPercent(success, planted);
      if (!planted && !success) return null;
      return `${s.name}: ${success}/${planted || '—'} (${formatPercent(pct)})`;
    }).filter(Boolean);

    if (!parts.length) return '—';
    return parts.length > 2 ? `${parts.slice(0, 2).join(', ')} +${parts.length - 2} more` : parts.join(', ');
  };

  const getAuditDateLabel = a => {
    const d = safeDate(a?.dateOfAudit || a?.date_of_audit || a?.created_at);
    return d ? d.toLocaleString() : '—';
  };

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Pole Crop Audit</Text>

            <View style={styles.headerInfo}>
              <View style={styles.infoChip}>
                <Ionicons name="id-card" size={12} color="#fff" />
                <Text style={styles.infoChipText}>PoleCrop ID: {String(poleCropId ?? '—')}</Text>
              </View>
              {!!enumeration?.division && (
                <View style={styles.infoChip}>
                  <Ionicons name="business" size={12} color="#fff" />
                  <Text style={styles.infoChipText}>{enumeration?.division}</Text>
                </View>
              )}
            </View>

            <Text style={styles.siteId}>
              Site ID: {String(poleCrop?.nameOfSiteId ?? poleCrop?.nameOfSite?.id ?? '—')}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => fetchPoleCropAudits({refresh: true})}
            activeOpacity={0.7}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPoleCropAudits({refresh: true})}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}>
        {/* Expected Species Summary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Expected (Planted) Species</Text>
            <Text style={styles.sectionSubtitle}>
              {speciesList.length} species • Total planted: {totalExpected}
            </Text>
          </View>

          {speciesList.length ? (
            <View style={styles.summaryCard}>
              {speciesList.map((s, i) => (
                <Text key={`${String(s.species_id)}-sum-${i}`} style={styles.summaryLine}>
                  {s.name}: <Text style={styles.summaryStrong}>{String(s.expectedCount ?? 0)}</Text>
                </Text>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="alert-circle-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No Species Found</Text>
              <Text style={styles.emptyText}>
                Open audit screen from Pole Crop records screen (clicked record) so species can be auto-filled.
              </Text>
            </View>
          )}
        </View>

        {!!serverError && (
          <View style={styles.errorCard}>
            <View style={styles.errorHeader}>
              <Ionicons name="warning" size={20} color={COLORS.danger} />
              <Text style={styles.errorTitle}>Server Error</Text>
            </View>
            <Text style={styles.errorMessage}>{serverError}</Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => fetchPoleCropAudits({refresh: true})}
              activeOpacity={0.7}>
              <Text style={styles.errorButtonText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Audits List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Audit Records</Text>
            <Text style={styles.sectionSubtitle}>{audits.length} audits</Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading audits...</Text>
            </View>
          ) : audits.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="clipboard-outline" size={64} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No Audits Yet</Text>
              <Text style={styles.emptyText}>Create your first audit for this Pole Crop record.</Text>
            </View>
          ) : (
            <View style={{gap: 12}}>
              {audits.map((a, idx) => {
                const auditId = a?.id ?? a?._id ?? idx;
                const successSummary = summarizeSuccessCounts(a?.speciesSuccessCounts, speciesList);

                const pics = Array.isArray(a?.pictures) ? a.pictures.filter(Boolean) : [];
                const drPics = Array.isArray(a?.drEvidence) ? a.drEvidence.filter(Boolean) : [];
                const firPics = Array.isArray(a?.firEvidence) ? a.firEvidence.filter(Boolean) : [];

                const fineOn = truthy(a?.fineImposed);
                const firOn = truthy(a?.firRegistered);

                return (
                  <View key={`audit-${String(auditId)}-${idx}`} style={styles.auditCard}>
                    <View style={styles.auditTop}>
                      <View style={{flex: 1}}>
                        <Text style={styles.auditTitle}>Audit #{String(auditId)}</Text>
                        <Text style={styles.auditSub}>{getAuditDateLabel(a)}</Text>
                      </View>

                      <View style={styles.auditBadge}>
                        <Ionicons name="analytics-outline" size={14} color={COLORS.primary} />
                        <Text style={styles.auditBadgeText}>{successSummary}</Text>
                      </View>
                    </View>

                    <View style={styles.auditRow}>
                      <Text style={styles.auditKey}>Not Success Reason:</Text>
                      <Text style={styles.auditVal} numberOfLines={2}>
                        {String(a?.notSuccessReason ?? '—')}
                      </Text>
                    </View>

                    <View style={styles.auditRow}>
                      <Text style={styles.auditKey}>Remarks:</Text>
                      <Text style={styles.auditVal} numberOfLines={2}>
                        {String(a?.additionalRemarks ?? '—')}
                      </Text>
                    </View>

                    <View style={styles.auditRow}>
                      <Text style={styles.auditKey}>DR No / Date:</Text>
                      <Text style={styles.auditVal} numberOfLines={2}>
                        {String(a?.drNo ?? '—')} •{' '}
                        {safeDate(a?.drDate) ? new Date(a.drDate).toLocaleDateString() : '—'}
                      </Text>
                    </View>

                    <View style={styles.auditRow}>
                      <Text style={styles.auditKey}>Fine:</Text>
                      <Text style={styles.auditVal}>
                        {fineOn ? `Yes (Amount: ${String(a?.fineAmount ?? '—')})` : 'No'}
                      </Text>
                    </View>

                    <View style={styles.auditRow}>
                      <Text style={styles.auditKey}>FIR:</Text>
                      <Text style={styles.auditVal}>
                        {firOn ? `Yes (No: ${String(a?.firNumber ?? '—')})` : 'No'}
                      </Text>
                    </View>

                    {/* View Pictures Buttons */}
                    <View style={styles.auditActions}>
                      <TouchableOpacity
                        style={styles.viewBtn}
                        onPress={() => openPicturesViewer(pics, `Audit #${auditId} Pictures`)}
                        activeOpacity={0.7}>
                        <Ionicons name="images-outline" size={16} color={COLORS.secondary} />
                        <Text style={styles.viewBtnText}>Pictures ({pics.length})</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.viewBtn}
                        onPress={() => openPicturesViewer(drPics, `Audit #${auditId} DR Evidence`)}
                        activeOpacity={0.7}>
                        <Ionicons name="document-attach-outline" size={16} color={COLORS.info} />
                        <Text style={styles.viewBtnText}>DR ({drPics.length})</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.viewBtn}
                        onPress={() => openPicturesViewer(firPics, `Audit #${auditId} FIR Evidence`)}
                        activeOpacity={0.7}>
                        <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.danger} />
                        <Text style={styles.viewBtnText}>FIR ({firPics.length})</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAddAudit} activeOpacity={0.85}>
        <View style={styles.fabContent}>
          <Ionicons name="add" size={28} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Add Audit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.editModalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.editModalContainer}>
            <View style={styles.editModalContent}>
              <View style={styles.editModalHeader}>
                <View style={{flex: 1}}>
                  <Text style={styles.editModalTitle}>Create Pole Crop Audit</Text>
                  <Text style={styles.editModalSubtitle}>
                    PoleCrop ID: {String(poleCropId ?? '—')} • Total planted: {totalExpected}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.editModalClose}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.editModalBody}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                {/* Audit Date */}
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Audit Information</Text>

                  <FormRow
                    label="Date Of Audit (ISO)"
                    value={dateOfAudit}
                    onChangeText={setDateOfAudit}
                    placeholder="e.g. 2025-01-13T10:00:00Z"
                    required
                  />

                  <FormRow
                    label="Not Success Reason"
                    value={notSuccessReason}
                    onChangeText={setNotSuccessReason}
                    placeholder="e.g. Failure"
                  />

                  <FormRow
                    label="Additional Remarks"
                    value={additionalRemarks}
                    onChangeText={setAdditionalRemarks}
                    placeholder="e.g. Some damage due to grazing observed."
                  />
                </View>

                {/* Species Success Counts */}
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Species-wise Success Counts</Text>

                  <View style={styles.totalRow}>
                    <View style={styles.totalChip}>
                      <Text style={styles.totalChipText}>Total Success: {totalSuccess}</Text>
                    </View>
                    <View style={styles.totalChip}>
                      <Text style={styles.totalChipText}>Success %: {formatPercent(totalPercent)}</Text>
                    </View>
                  </View>

                  {speciesList?.length ? (
                    <View style={styles.countCard}>
                      {speciesList.map((s, i) => {
                        const sid = String(s.species_id);
                        const planted = s?.expectedCount;
                        const successVal = String(successCountMap?.[sid] ?? '');
                        const pct = calcPercent(successVal, planted);

                        return (
                          <View key={`${sid}-${i}`} style={styles.countRow}>
                            <View style={{flex: 1}}>
                              <Text style={styles.countName} numberOfLines={1}>
                                {s.name}
                              </Text>

                              <Text style={styles.countHint}>
                                Planted/Expected: {String(planted ?? '—')}
                              </Text>

                              <Text style={[styles.countHint, {marginTop: 3}]}>
                                Success %: {formatPercent(pct)}
                              </Text>
                            </View>

                            <View style={{alignItems: 'flex-end'}}>
                              <TextInput
                                value={successVal}
                                onChangeText={v => setSuccessCount(sid, v)}
                                placeholder="0"
                                keyboardType="numeric"
                                placeholderTextColor={COLORS.textLight}
                                style={styles.countInput}
                              />

                              {Number(planted) > 0 && Number(successVal || 0) > Number(planted) ? (
                                <Text style={styles.warnText}>Success &gt; Planted</Text>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.mutedText}>No species found in selected record.</Text>
                  )}
                </View>

                {/* DR */}
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>DR Information</Text>
                  <FormRow
                    label="DR No"
                    value={drNo}
                    onChangeText={setDrNo}
                    placeholder="e.g. DR-POLE-001"
                  />
                  <FormRow
                    label="DR Date (ISO)"
                    value={drDate}
                    onChangeText={setDrDate}
                    placeholder="e.g. 2025-01-11T00:00:00Z"
                  />

                  <View style={styles.uploadBlock}>
                    <Text style={styles.uploadTitle}>DR Evidence</Text>
                    <View style={styles.uploadBtns}>
                      <TouchableOpacity
                        style={styles.uploadBtn}
                        onPress={() => pickImages(setDrEvidenceAssets)}
                        activeOpacity={0.7}>
                        <Ionicons name="image-outline" size={18} color="#fff" />
                        <Text style={styles.uploadBtnText}>Select</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.uploadBtnAlt}
                        onPress={() => captureImage(setDrEvidenceAssets)}
                        activeOpacity={0.7}>
                        <Ionicons name="camera-outline" size={18} color="#fff" />
                        <Text style={styles.uploadBtnText}>Camera</Text>
                      </TouchableOpacity>
                      {!!drEvidenceAssets.length && (
                        <TouchableOpacity
                          style={styles.clearBtn}
                          onPress={() => clearAssets(setDrEvidenceAssets)}
                          activeOpacity={0.7}>
                          <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                          <Text style={styles.clearBtnText}>Clear ({drEvidenceAssets.length})</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>

                {/* Fine */}
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Fine</Text>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Fine Imposed</Text>
                    <Switch value={fineImposed} onValueChange={setFineImposed} />
                  </View>
                  {fineImposed && (
                    <FormRow
                      label="Fine Amount"
                      value={fineAmount}
                      onChangeText={setFineAmount}
                      placeholder="e.g. 2000"
                      keyboardType="numeric"
                      required
                    />
                  )}
                </View>

                {/* FIR */}
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>FIR</Text>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>FIR Registered</Text>
                    <Switch value={firRegistered} onValueChange={setFirRegistered} />
                  </View>
                  {firRegistered && (
                    <>
                      <FormRow
                        label="FIR Number"
                        value={firNumber}
                        onChangeText={setFirNumber}
                        placeholder="e.g. FIR-123"
                        required
                      />

                      <View style={styles.uploadBlock}>
                        <Text style={styles.uploadTitle}>FIR Evidence</Text>
                        <View style={styles.uploadBtns}>
                          <TouchableOpacity
                            style={styles.uploadBtn}
                            onPress={() => pickImages(setFirEvidenceAssets)}
                            activeOpacity={0.7}>
                            <Ionicons name="image-outline" size={18} color="#fff" />
                            <Text style={styles.uploadBtnText}>Select</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.uploadBtnAlt}
                            onPress={() => captureImage(setFirEvidenceAssets)}
                            activeOpacity={0.7}>
                            <Ionicons name="camera-outline" size={18} color="#fff" />
                            <Text style={styles.uploadBtnText}>Camera</Text>
                          </TouchableOpacity>
                          {!!firEvidenceAssets.length && (
                            <TouchableOpacity
                              style={styles.clearBtn}
                              onPress={() => clearAssets(setFirEvidenceAssets)}
                              activeOpacity={0.7}>
                              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                              <Text style={styles.clearBtnText}>Clear ({firEvidenceAssets.length})</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </>
                  )}
                </View>

                {/* Audit Pictures */}
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Audit Pictures</Text>
                  <View style={styles.uploadBlock}>
                    <Text style={styles.uploadTitle}>Pictures</Text>
                    <View style={styles.uploadBtns}>
                      <TouchableOpacity
                        style={styles.uploadBtn}
                        onPress={() => pickImages(setAuditPicsAssets)}
                        activeOpacity={0.7}>
                        <Ionicons name="image-outline" size={18} color="#fff" />
                        <Text style={styles.uploadBtnText}>Select</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.uploadBtnAlt}
                        onPress={() => captureImage(setAuditPicsAssets)}
                        activeOpacity={0.7}>
                        <Ionicons name="camera-outline" size={18} color="#fff" />
                        <Text style={styles.uploadBtnText}>Camera</Text>
                      </TouchableOpacity>
                      {!!auditPicsAssets.length && (
                        <TouchableOpacity
                          style={styles.clearBtn}
                          onPress={() => clearAssets(setAuditPicsAssets)}
                          activeOpacity={0.7}>
                          <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                          <Text style={styles.clearBtnText}>Clear ({auditPicsAssets.length})</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {!!auditPicsAssets.length && (
                      <View style={styles.pickInfo}>
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                        <Text style={styles.pickInfoText}>
                          {auditPicsAssets.length} image{auditPicsAssets.length !== 1 ? 's' : ''} selected
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </ScrollView>

              <View style={styles.editModalFooter}>
                <TouchableOpacity
                  style={styles.footerButtonSecondary}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.7}
                  disabled={uploading}>
                  <Text style={styles.footerButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.footerButtonPrimary, uploading ? {opacity: 0.7} : null]}
                  onPress={submitAudit}
                  activeOpacity={0.7}
                  disabled={uploading}>
                  <View style={styles.footerButtonContent}>
                    {uploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="save-outline" size={20} color="#fff" />
                    )}
                    <Text style={styles.footerButtonPrimaryText}>
                      {uploading ? 'Saving...' : 'Save Audit'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Pictures Viewer */}
      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.viewerOverlay}>
          <TouchableWithoutFeedback onPress={() => setViewerVisible(false)}>
            <View style={styles.viewerBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.viewerCard}>
            <View style={styles.viewerHeader}>
              <Text style={styles.viewerTitle} numberOfLines={1}>
                {viewerTitle || 'Pictures'}
              </Text>
              <TouchableOpacity
                style={styles.viewerClose}
                onPress={() => setViewerVisible(false)}
                activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.viewerScroll}>
              {viewerImages.map((u, i) => (
                <View key={`${String(u)}-${i}`} style={styles.viewerSlide}>
                  <Image source={{uri: u}} style={styles.viewerImage} resizeMode="contain" />
                  <TouchableOpacity
                    style={styles.viewerLinkBtn}
                    onPress={() =>
                      Linking.openURL(u).catch(() => Alert.alert('Error', 'Cannot open link'))
                    }>
                    <Ionicons name="open-outline" size={16} color="#fff" />
                    <Text style={styles.viewerLinkText}>Open URL</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={styles.viewerFooter}>
              <Text style={styles.viewerFooterText}>
                {viewerImages.length} image{viewerImages.length !== 1 ? 's' : ''} found
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ===================== STYLES ===================== */
const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: COLORS.background},
  container: {flex: 1},
  contentContainer: {paddingBottom: 120},

  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  headerContainer: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20},
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: {flex: 1},
  headerTitle: {fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 8},
  headerInfo: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8},
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  infoChipText: {fontSize: 12, fontWeight: '700', color: '#fff'},
  siteId: {fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)'},
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: {marginHorizontal: 20, marginBottom: 18},
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sectionTitle: {fontSize: 18, fontWeight: '900', color: COLORS.text},
  sectionSubtitle: {fontSize: 13, fontWeight: '700', color: COLORS.textLight},

  summaryCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  summaryLine: {fontSize: 13, fontWeight: '700', color: COLORS.text},
  summaryStrong: {fontWeight: '900', color: COLORS.primary},

  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
  },
  errorHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8},
  errorTitle: {fontSize: 16, fontWeight: '800', color: COLORS.danger},
  errorMessage: {fontSize: 14, color: COLORS.text, marginBottom: 12},
  errorButton: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  errorButtonText: {color: '#fff', fontSize: 14, fontWeight: '800'},

  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyTitle: {fontSize: 16, fontWeight: '900', color: COLORS.text, marginTop: 12, marginBottom: 8},
  emptyText: {fontSize: 13, fontWeight: '700', color: COLORS.textLight, textAlign: 'center'},

  loadingBox: {padding: 20, alignItems: 'center', gap: 10},
  loadingText: {fontSize: 13, fontWeight: '800', color: COLORS.textLight},

  auditCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
  },
  auditTop: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10},
  auditTitle: {fontSize: 16, fontWeight: '900', color: COLORS.text},
  auditSub: {marginTop: 4, fontSize: 12, fontWeight: '800', color: COLORS.textLight},
  auditBadge: {
    maxWidth: 190,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.18)',
    backgroundColor: 'rgba(5,150,105,0.06)',
  },
  auditBadgeText: {flex: 1, fontSize: 11, fontWeight: '900', color: COLORS.primary},
  auditRow: {flexDirection: 'row', gap: 10, marginTop: 8},
  auditKey: {width: 130, fontSize: 12, fontWeight: '900', color: COLORS.textLight},
  auditVal: {flex: 1, fontSize: 12, fontWeight: '800', color: COLORS.text},

  auditActions: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12},
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  viewBtnText: {fontSize: 12, fontWeight: '900', color: COLORS.text},

  fab: {position: 'absolute', right: 20, bottom: 30, elevation: 8},
  fabContent: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editModalOverlay: {flex: 1, backgroundColor: COLORS.overlay},
  editModalContainer: {flex: 1, justifyContent: 'flex-end'},
  editModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.92,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  editModalTitle: {fontSize: 18, fontWeight: '900', color: COLORS.text},
  editModalSubtitle: {marginTop: 6, fontSize: 12, fontWeight: '800', color: COLORS.textLight},
  editModalClose: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalBody: {padding: 20},

  formSection: {marginBottom: 18},
  formSectionTitle: {fontSize: 14, fontWeight: '900', color: COLORS.text, marginBottom: 12},

  totalRow: {flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 10},
  totalChip: {
    backgroundColor: 'rgba(5,150,105,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  totalChipText: {fontSize: 12, fontWeight: '900', color: COLORS.primary},

  countCard: {
    backgroundColor: 'rgba(14, 165, 233, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.14)',
    borderRadius: 16,
    padding: 14,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(14, 165, 233, 0.12)',
  },
  countName: {fontSize: 13, fontWeight: '900', color: COLORS.text},
  countHint: {marginTop: 3, fontSize: 11, fontWeight: '900', color: COLORS.textLight},
  countInput: {
    width: 92,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    backgroundColor: '#fff',
    textAlign: 'center',
  },
  warnText: {marginTop: 6, fontSize: 11, fontWeight: '900', color: COLORS.danger},

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  toggleLabel: {fontSize: 13, fontWeight: '900', color: COLORS.text},

  uploadBlock: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#fff',
  },
  uploadTitle: {fontSize: 12, fontWeight: '900', color: COLORS.text, marginBottom: 10},
  uploadBtns: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center'},
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  uploadBtnAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.info,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  uploadBtnText: {color: '#fff', fontSize: 12, fontWeight: '900'},
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.22)',
    backgroundColor: 'rgba(220,38,38,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  clearBtnText: {fontSize: 12, fontWeight: '900', color: COLORS.danger},

  pickInfo: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10},
  pickInfoText: {fontSize: 12, fontWeight: '900', color: COLORS.text},

  editModalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: '#fff',
  },
  footerButtonSecondary: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 55, 0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  footerButtonSecondaryText: {fontSize: 14, fontWeight: '900', color: COLORS.text},
  footerButtonPrimary: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonContent: {flexDirection: 'row', alignItems: 'center', gap: 8},
  footerButtonPrimaryText: {fontSize: 14, fontWeight: '900', color: '#fff'},

  viewerOverlay: {flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: 14},
  viewerBackdrop: {...StyleSheet.absoluteFillObject},
  viewerCard: {width: '100%', height: height * 0.75, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden'},
  viewerHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: 'rgba(31,41,55,0.03)'},
  viewerTitle: {flex: 1, fontSize: 14, fontWeight: '900', color: COLORS.text},
  viewerClose: {width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(31, 41, 55, 0.06)', alignItems: 'center', justifyContent: 'center', marginLeft: 10},
  viewerScroll: {flex: 1},
  viewerSlide: {width: width - 28, alignItems: 'center', justifyContent: 'center', padding: 14},
  viewerImage: {width: '100%', height: '100%'},
  viewerLinkBtn: {position: 'absolute', bottom: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12},
  viewerLinkText: {color: '#fff', fontSize: 12, fontWeight: '900'},
  viewerFooter: {paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: 'rgba(31,41,55,0.02)'},
  viewerFooterText: {fontSize: 12, fontWeight: '800', color: COLORS.textLight},
});
