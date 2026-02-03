// /screens/AfforestationAuditScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Dimensions,
  StatusBar,
  RefreshControl,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { apiService } from '../services/ApiService';

const { height } = Dimensions.get('window');

const API_HOST = 'https://be.punjabtreeenumeration.com';

// Endpoints
const AFF_AUDIT_CREATE_URL = `${API_HOST}/enum/afforestation-audit`;
const AFF_AUDIT_LIST_URL = afforestationId =>
  `${API_HOST}/enum/afforestation-audit/get-all-audits-of-afforestation/${afforestationId}`;

// AWS Upload
const AWS_UPLOAD_URL = 'https://app.eco.gisforestry.com/aws-bucket/tree-enum';
const AWS_UPLOAD_PATH = 'AfforestationAudit';

// Theme
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

// ✅ robust list normalize
const normalizeList = json => {
  if (!json) return [];
  if (Array.isArray(json)) return json;

  if (typeof json === 'object') {
    if (Array.isArray(json.data)) return json.data;
    if (json.data && Array.isArray(json.data.data)) return json.data.data;
  }

  return [];
};

const getAuthToken = async () => {
  const t = await AsyncStorage.getItem('AUTH_TOKEN');
  return t || '';
};

const safeNumber = v => {
  const n = Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const isoNow = () => new Date().toISOString();

// ✅ remove empty keys (omit fields like Postman)
const cleanPayload = obj =>
  Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => {
      if (v === undefined) return false;
      if (v === '') return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    }),
  );

// ✅ if backend expects file names (like curl: ["audit_pic1.jpg"])
const toBasename = u => {
  const s = String(u || '');
  const noQuery = s.split('?')[0];
  const lastSlash = noQuery.lastIndexOf('/');
  return lastSlash >= 0 ? noQuery.substring(lastSlash + 1) : noQuery;
};

// ✅ better error visibility (text + json)
const fetchJsonOrText = async res => {
  const text = await res.text().catch(() => '');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }
  return { text, json };
};

export default function AfforestationAuditScreen({ navigation, route }) {
  /**
   * This screen MUST be opened from previous screen using:
   * navigation.navigate('AfforestationAudit', { afforestationId, record, speciesSnapshot })
   *
   * speciesSnapshot format:
   * [{ species_id: 1, name: "Acacia", plantedCount: 480 }, ...]
   */
  const afforestationId = route?.params?.afforestationId;
  const record = route?.params?.record || null;

  const speciesSnapshot = useMemo(() => {
    const raw = route?.params?.speciesSnapshot;
    if (Array.isArray(raw) && raw.length) {
      return raw
        .map(x => ({
          species_id: Number(x?.species_id ?? x?.id),
          name: x?.name || `Species ${x?.species_id ?? x?.id}`,
          plantedCount: safeNumber(x?.plantedCount ?? x?.count ?? x?.planted ?? 0),
        }))
        .filter(x => Number.isFinite(x.species_id) && x.plantedCount > 0);
    }
    return [];
  }, [route?.params?.speciesSnapshot]);

  // ---------- LIST STATE ----------
  const [audits, setAudits] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ---------- FORM STATE ----------
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [dateOfAudit, setDateOfAudit] = useState(() => isoNow());
  const [notSuccessReason, setNotSuccessReason] = useState(''); // OPTIONAL
  const [additionalRemarks, setAdditionalRemarks] = useState('');
  const [drNo, setDrNo] = useState('');
  const [drDate, setDrDate] = useState('');
  const [fineImposed, setFineImposed] = useState(false);
  const [fineAmount, setFineAmount] = useState('');
  const [firRegistered, setFirRegistered] = useState(false);
  const [firNumber, setFirNumber] = useState('');

  // Per-species success counts: { "1": "20" }
  const [successCounts, setSuccessCounts] = useState({});

  // images (local uris)
  const [picturesUris, setPicturesUris] = useState([]);
  const [drEvidenceUris, setDrEvidenceUris] = useState([]);
  const [firEvidenceUris, setFirEvidenceUris] = useState([]);

  // Image picker modal
  const [imagePickerModal, setImagePickerModal] = useState(false);
  const [imageTarget, setImageTarget] = useState('pictures'); // pictures | drEvidence | firEvidence

  const openAppSettings = () => {
    Alert.alert(
      'Permission Required',
      'Please allow camera permission from Settings to take photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings().catch(() => { });
          },
        },
      ],
    );
  };

  const requestAndroidCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'We need camera access so you can take a photo.',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      return false;
    }
  };

  const onImagePickerResult = res => {
    if (!res) return;
    if (res.didCancel) return;

    if (res.errorCode) {
      if (res.errorCode === 'permission' || res.errorCode === 'camera_unavailable') {
        openAppSettings();
        return;
      }
      Alert.alert('Image Error', res.errorMessage || 'Could not get image');
      return;
    }

    const assets = res.assets || [];
    const uris = assets.map(a => a?.uri).filter(Boolean);
    if (!uris.length) return;

    // NOTE: overwrite
    if (imageTarget === 'pictures') setPicturesUris(uris);
    if (imageTarget === 'drEvidence') setDrEvidenceUris(uris);
    if (imageTarget === 'firEvidence') setFirEvidenceUris(uris);
  };

  const pickFromGallery = () => {
    setImagePickerModal(false);
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.7, selectionLimit: 0 },
      onImagePickerResult,
    );
  };

  const takePhotoFromCamera = async () => {
    setImagePickerModal(false);
    const ok = await requestAndroidCameraPermission();
    if (!ok) {
      openAppSettings();
      return;
    }

    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.7,
        saveToPhotos: true,
        cameraType: 'back',
      },
      onImagePickerResult,
    );
  };

  const openImagePicker = target => {
    setImageTarget(target);
    setImagePickerModal(true);
  };

  // ---------- METRICS ----------
  const perSpeciesMetrics = useMemo(() => {
    return speciesSnapshot.map(s => {
      const sid = String(s.species_id);
      const planted = safeNumber(s.plantedCount);
      const success = safeNumber(successCounts[sid]);
      const pct = planted > 0 ? (success / planted) * 100 : 0;
      return {
        species_id: s.species_id,
        name: s.name,
        plantedCount: planted,
        successCount: success,
        pct,
      };
    });
  }, [speciesSnapshot, successCounts]);

  const totals = useMemo(() => {
    const plantedTotal = perSpeciesMetrics.reduce((a, x) => a + safeNumber(x.plantedCount), 0);
    const successTotal = perSpeciesMetrics.reduce((a, x) => a + safeNumber(x.successCount), 0);
    const pctTotal = plantedTotal > 0 ? (successTotal / plantedTotal) * 100 : 0;
    return { plantedTotal, successTotal, pctTotal };
  }, [perSpeciesMetrics]);

  // Manual AWS Upload Removed - handled by ApiService


  // ---------- API ----------
  const fetchAudits = useCallback(
    async ({ refresh = false } = {}) => {
      if (!afforestationId) {
        setAudits([]);
        return;
      }
      try {
        refresh ? setRefreshing(true) : setLoadingList(true);

        const rowsRaw = await apiService.get(AFF_AUDIT_LIST_URL(afforestationId));
        const rows = normalizeList(rowsRaw);

        const normalized = rows
          .map(a => ({
            ...a,
            _date: a?.dateOfAudit ? new Date(a.dateOfAudit).getTime() : 0,
          }))
          .sort((a, b) => (b._date || 0) - (a._date || 0));

        setAudits(normalized);
      } catch (e) {
        setAudits([]);
        Alert.alert('Load Failed', e?.message || 'Failed to load audits.');
      } finally {
        refresh ? setRefreshing(false) : setLoadingList(false);
      }
    },
    [afforestationId],
  );

  useEffect(() => {
    fetchAudits({ refresh: true });
  }, [fetchAudits]);

  const resetForm = () => {
    setDateOfAudit(isoNow());
    setNotSuccessReason('');
    setAdditionalRemarks('');
    setDrNo('');
    setDrDate('');
    setFineImposed(false);
    setFineAmount('');
    setFirRegistered(false);
    setFirNumber('');
    setPicturesUris([]);
    setDrEvidenceUris([]);
    setFirEvidenceUris([]);

    const init = {};
    speciesSnapshot.forEach(s => {
      init[String(s.species_id)] = '';
    });
    setSuccessCounts(init);
  };

  const openAddAudit = () => {
    if (!speciesSnapshot.length) {
      Alert.alert(
        'Species list not found',
        'Please open Audit from the Afforestation Records screen where speciesSnapshot is passed.',
      );
      return;
    }
    resetForm();
    setModalVisible(true);
  };

  const submitAudit = async () => {
    if (!afforestationId) {
      Alert.alert('Error', 'afforestationId missing from navigation params.');
      return;
    }
    if (!speciesSnapshot.length) {
      Alert.alert('Error', 'Species list not available. Open Audit from previous screen properly.');
      return;
    }

    // validate success counts
    for (const s of speciesSnapshot) {
      const sid = String(s.species_id);
      const planted = safeNumber(s.plantedCount);
      const sc = safeNumber(successCounts[sid]);

      if (planted <= 0) {
        Alert.alert('Invalid', `Planted count is missing/zero for ${s.name || `species ${sid}`}.`);
        return;
      }
      if (sc < 0) {
        Alert.alert('Invalid', `Success count cannot be negative for ${s.name || `species ${sid}`}.`);
        return;
      }
      if (sc > planted) {
        Alert.alert(
          'Invalid',
          `Success count (${sc}) cannot exceed planted (${planted}) for ${s.name || `species ${sid}`}.`,
        );
        return;
      }
    }

    // Keep these checks (your UX choice), but payload will still be consistent.
    if (fineImposed && safeNumber(fineAmount) <= 0) {
      Alert.alert('Missing', 'Fine Amount is required because Fine Imposed is true.');
      return;
    }
    if (firRegistered && !String(firNumber || '').trim()) {
      Alert.alert('Missing', 'FIR Number is required because FIR Registered is true.');
      return;
    }

    try {
      setSubmitting(true);

      // Prepare attachments for all 3 categories
      const attachments = [];
      const baseName = `aff_audit_${afforestationId}_${Date.now()}`;

      // 1. Audit Pics
      picturesUris.forEach((uri, idx) => {
        attachments.push({
          uri, type: 'image/jpeg', name: `${baseName}_pics_${idx}.jpg`,
          uploadUrl: AWS_UPLOAD_URL,
          uploadPath: AWS_UPLOAD_PATH,
          targetFieldInBody: 'pictures',
          storeBasename: true
        });
      });

      // 2. DR Evidence
      drEvidenceUris.forEach((uri, idx) => {
        attachments.push({
          uri, type: 'image/jpeg', name: `${baseName}_dr_${idx}.jpg`,
          uploadUrl: AWS_UPLOAD_URL,
          uploadPath: AWS_UPLOAD_PATH,
          targetFieldInBody: 'drEvidence',
          storeBasename: true
        });
      });

      // 3. FIR Evidence
      firEvidenceUris.forEach((uri, idx) => {
        attachments.push({
          uri, type: 'image/jpeg', name: `${baseName}_fir_${idx}.jpg`,
          uploadUrl: AWS_UPLOAD_URL,
          uploadPath: AWS_UPLOAD_PATH,
          targetFieldInBody: 'firEvidence',
          storeBasename: true
        });
      });

      // ✅ Payload: omit empty optional fields
      const payload = cleanPayload({
        afforestationId: Number(afforestationId),
        dateOfAudit: String(dateOfAudit || isoNow()),
        speciesSuccessCounts: speciesSnapshot.map(s => ({
          species_id: Number(s.species_id),
          successCount: safeNumber(successCounts[String(s.species_id)]),
        })),

        // Optional strings: omit if empty
        notSuccessReason: notSuccessReason?.trim() ? notSuccessReason.trim() : undefined,
        additionalRemarks: additionalRemarks?.trim() ? additionalRemarks.trim() : undefined,
        drNo: drNo?.trim() ? drNo.trim() : undefined,

        // Dates
        drDate: drDate?.trim() ? drDate.trim() : undefined,

        // Evidence arrays: ApiService will fill if attachments
        drEvidence: [],
        firEvidence: [],
        pictures: [],

        // Booleans can remain (safe)
        fineImposed: !!fineImposed,
        firRegistered: !!firRegistered,

        // Conditional: ONLY include when true (avoid sending 0 / null noise)
        fineAmount: fineImposed ? safeNumber(fineAmount) : undefined,
        firNumber: firRegistered ? (firNumber?.trim() ? firNumber.trim() : undefined) : undefined,
      });

      const res = await apiService.post(AFF_AUDIT_CREATE_URL, payload, { attachments });

      Alert.alert(res.offline ? 'Saved Offline' : 'Success', res.message || 'Audit saved successfully.');
      setModalVisible(false);
      fetchAudits({ refresh: true });
    } catch (e) {
      Alert.alert('Submit Failed', e?.message || 'Failed to submit audit.');
    } finally {
      setSubmitting(false);
    }
  };

  const headerTitle = useMemo(() => {
    if (!afforestationId) return 'Afforestation Audit';
    return `Afforestation Audit • ID ${afforestationId}`;
  }, [afforestationId]);

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {headerTitle}
            </Text>
            {record?.year ? (
              <Text style={styles.headerSub}>
                {record?.division || '—'} • {record?.block || '—'} • {record?.year || '—'}
              </Text>
            ) : (
              <Text style={styles.headerSub}>Audit & success percentage by species</Text>
            )}
          </View>

          <TouchableOpacity style={styles.headerAction} onPress={openAddAudit} activeOpacity={0.7}>
            <Ionicons name="add-circle" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAudits({ refresh: true })}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        {!speciesSnapshot.length ? (
          <View style={styles.emptyBox}>
            <Ionicons name="alert-circle-outline" size={56} color={COLORS.warning} />
            <Text style={styles.emptyTitle}>Species Snapshot Missing</Text>
            <Text style={styles.emptyText}>
              Open this screen from Afforestation Records screen using Audit button (pass speciesSnapshot).
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Plantation Snapshot (Auto Filled)</Text>

            {perSpeciesMetrics.map(row => (
              <View key={`snap-${row.species_id}`} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {row.name || `Species ${row.species_id}`}
                  </Text>
                  <Text style={styles.rowSub}>
                    Planted: {row.plantedCount} • Success: {row.successCount} • {row.pct.toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{row.pct.toFixed(1)}%</Text>
                </View>
              </View>
            ))}

            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Overall</Text>
              <Text style={styles.totalValue}>
                {totals.successTotal}/{totals.plantedTotal} • {totals.pctTotal.toFixed(1)}%
              </Text>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Saved Audits</Text>
          <Text style={styles.sectionSub}>{audits.length} audit(s)</Text>
        </View>

        {loadingList ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading audits...</Text>
          </View>
        ) : audits.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="clipboard-outline" size={56} color={COLORS.border} />
            <Text style={styles.emptyTitle}>No Audits Yet</Text>
            <Text style={styles.emptyText}>Tap + to create first audit for this record.</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {audits.map((a, idx) => {
              const k = String(a?.id ?? `${a?.dateOfAudit || 'na'}_${a?.drNo || 'dr'}_${idx}`);
              const dateLabel = a?.dateOfAudit ? new Date(a.dateOfAudit).toLocaleString() : '—';

              const speciesSuccess = Array.isArray(a?.speciesSuccessCounts)
                ? a.speciesSuccessCounts
                : [];

              const totalSuccess = speciesSuccess.reduce(
                (sum, x) => sum + safeNumber(x?.successCount),
                0,
              );

              return (
                <View key={k} style={styles.auditCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.auditTitle} numberOfLines={1}>
                        {a?.drNo ? `DR: ${a.drNo}` : `Audit #${idx + 1}`}
                      </Text>
                      <Text style={styles.auditSub} numberOfLines={2}>
                        {dateLabel}
                      </Text>
                    </View>

                    <View style={[styles.pill, { backgroundColor: 'rgba(5,150,105,0.12)' }]}>
                      <Text style={[styles.pillText, { color: COLORS.primary }]}>
                        Success: {totalSuccess}
                      </Text>
                    </View>
                  </View>

                  {!!a?.notSuccessReason && (
                    <Text style={styles.auditNote} numberOfLines={2}>
                      Reason: {String(a.notSuccessReason)}
                    </Text>
                  )}
                  {!!a?.additionalRemarks && (
                    <Text style={styles.auditNote} numberOfLines={3}>
                      Remarks: {String(a.additionalRemarks)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Image Picker Modal */}
      <Modal
        transparent
        visible={imagePickerModal}
        animationType="fade"
        onRequestClose={() => setImagePickerModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setImagePickerModal(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { maxHeight: height * 0.35 }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons name="image-outline" size={24} color={COLORS.primary} />
                  <Text style={styles.modalTitle}>Add Image</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setImagePickerModal(false)}
                  activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 20, gap: 12 }}>
                <TouchableOpacity style={styles.primaryBtn} onPress={takePhotoFromCamera} activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={pickFromGallery} activeOpacity={0.8}>
                  <Ionicons name="images-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.secondaryBtnText}>Choose from Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ paddingVertical: 10, borderRadius: 14, alignItems: 'center' }}
                  onPress={() => setImagePickerModal(false)}
                  activeOpacity={0.8}>
                  <Text style={{ color: COLORS.textLight, fontWeight: '800' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

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
                <View style={{ flex: 1 }}>
                  <Text style={styles.editModalTitle}>Create Afforestation Audit</Text>
                  <Text style={styles.editModalSubtitle} numberOfLines={2}>
                    Planted counts auto-filled. Enter success counts to calculate %.
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
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Audit Details</Text>

                  <FormRowLite
                    label="Date Of Audit (ISO)"
                    value={dateOfAudit}
                    onChangeText={setDateOfAudit}
                    placeholder="2025-01-13T10:00:00Z"
                  />

                  <FormRowLite
                    label="Not Success Reason (Optional)"
                    value={notSuccessReason}
                    onChangeText={setNotSuccessReason}
                    placeholder="Failure (optional)"
                  />

                  <FormRowLite
                    label="Additional Remarks"
                    value={additionalRemarks}
                    onChangeText={setAdditionalRemarks}
                    placeholder="Plants are recovering well after rains."
                    multiline
                  />
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Species Success Counts</Text>

                  {perSpeciesMetrics.map(row => (
                    <View key={`succ-${row.species_id}`} style={styles.speciesBox}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.speciesName} numberOfLines={1}>
                          {row.name || `Species ${row.species_id}`}
                        </Text>
                        <Text style={styles.speciesMeta}>
                          Planted: {row.plantedCount} • Success: {row.successCount} • {row.pct.toFixed(1)}%
                        </Text>
                      </View>

                      <TextInput
                        value={String(successCounts[String(row.species_id)] ?? '')}
                        onChangeText={v =>
                          setSuccessCounts(prev => ({
                            ...(prev || {}),
                            [String(row.species_id)]: String(v || '').replace(/[^\d]/g, ''),
                          }))
                        }
                        keyboardType="numeric"
                        placeholder="Success"
                        placeholderTextColor={COLORS.textLight}
                        style={styles.successInput}
                      />
                    </View>
                  ))}

                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>Overall</Text>
                    <Text style={styles.totalValue}>
                      {totals.successTotal}/{totals.plantedTotal} • {totals.pctTotal.toFixed(1)}%
                    </Text>
                  </View>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>DR / Fine / FIR</Text>

                  <FormRowLite label="DR No" value={drNo} onChangeText={setDrNo} placeholder="DR-2025-001" />
                  <FormRowLite label="DR Date (ISO)" value={drDate} onChangeText={setDrDate} placeholder="2025-01-10T00:00:00Z" />

                  <ToggleLite label="Fine Imposed" value={fineImposed} onChange={setFineImposed} />
                  {fineImposed && (
                    <FormRowLite
                      label="Fine Amount"
                      value={fineAmount}
                      onChangeText={setFineAmount}
                      keyboardType="numeric"
                      placeholder="5000"
                    />
                  )}

                  <ToggleLite label="FIR Registered" value={firRegistered} onChange={setFirRegistered} />
                  {firRegistered && (
                    <FormRowLite
                      label="FIR Number"
                      value={firNumber}
                      onChangeText={setFirNumber}
                      placeholder="FIR-123"
                    />
                  )}
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Evidence & Pictures</Text>

                  <UploadBox
                    title="Audit Pictures"
                    subtitle="Upload pictures[]"
                    count={picturesUris.length}
                    onPress={() => openImagePicker('pictures')}
                  />

                  <UploadBox
                    title="DR Evidence"
                    subtitle="Upload drEvidence[]"
                    count={drEvidenceUris.length}
                    onPress={() => openImagePicker('drEvidence')}
                  />

                  <UploadBox
                    title="FIR Evidence"
                    subtitle="Upload firEvidence[]"
                    count={firEvidenceUris.length}
                    onPress={() => openImagePicker('firEvidence')}
                  />
                </View>
              </ScrollView>

              <View style={styles.editModalFooter}>
                <TouchableOpacity
                  style={styles.footerButtonSecondary}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.7}>
                  <Text style={styles.footerButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.footerButtonPrimary}
                  onPress={submitAudit}
                  disabled={submitting}
                  activeOpacity={0.7}>
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={20} color="#fff" />
                      <Text style={styles.footerButtonPrimaryText}>Save Audit</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

/** ---------- UI Helpers ---------- */

function FormRowLite({ label, value, onChangeText, placeholder, keyboardType, multiline }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.textLight, marginBottom: 8 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textLight}
        keyboardType={keyboardType}
        multiline={!!multiline}
        style={{
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: COLORS.border,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 10,
          minHeight: multiline ? 88 : 48,
          fontSize: 14,
          fontWeight: '700',
          color: COLORS.text,
        }}
      />
    </View>
  );
}

function ToggleLite({ label, value, onChange }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onChange(!value)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(5,150,105,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(5,150,105,0.15)',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 14,
        marginBottom: 12,
      }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.text }}>{label}</Text>
      <View
        style={{
          width: 56,
          height: 30,
          borderRadius: 15,
          backgroundColor: value ? COLORS.primary : 'rgba(31,41,55,0.18)',
          padding: 4,
          alignItems: value ? 'flex-end' : 'flex-start',
        }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' }} />
      </View>
    </TouchableOpacity>
  );
}

function UploadBox({ title, subtitle, count, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        backgroundColor: 'rgba(5,150,105,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(5,150,105,0.20)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
      <Ionicons name="cloud-upload-outline" size={24} color={COLORS.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '900', color: COLORS.primary }}>{title}</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textLight }}>{subtitle}</Text>
      </View>
      <View
        style={{
          backgroundColor: 'rgba(5,150,105,0.12)',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
        }}>
        <Text style={{ fontWeight: '900', color: COLORS.primary }}>{count || 0}</Text>
      </View>
    </TouchableOpacity>
  );
}

/** ---------- Styles ---------- */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },

  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 18,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
  },
  headerContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  headerSub: { marginTop: 6, fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: '900', color: COLORS.text, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowTitle: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  rowSub: { marginTop: 3, fontSize: 12, fontWeight: '700', color: COLORS.textLight },
  pill: {
    backgroundColor: 'rgba(31,41,55,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: { fontSize: 12, fontWeight: '900', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  totalLabel: { fontSize: 13, fontWeight: '900', color: COLORS.text },
  totalValue: { fontSize: 13, fontWeight: '900', color: COLORS.primary },

  sectionHeader: {
    marginTop: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: COLORS.text },
  sectionSub: { fontSize: 12, fontWeight: '800', color: COLORS.textLight },

  loadingBox: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 30,
    alignItems: 'center',
  },
  loadingText: { marginTop: 10, fontSize: 13, fontWeight: '800', color: COLORS.textLight },

  emptyBox: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    padding: 30,
    alignItems: 'center',
  },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: '900', color: COLORS.text },
  emptyText: { marginTop: 6, fontSize: 12, fontWeight: '700', color: COLORS.textLight, textAlign: 'center' },

  auditCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginTop: 12,
  },
  auditTitle: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  auditSub: { marginTop: 4, fontSize: 12, fontWeight: '700', color: COLORS.textLight },
  auditNote: { marginTop: 8, fontSize: 12, fontWeight: '700', color: COLORS.text },

  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalContainer: { flex: 1, justifyContent: 'center', padding: 20 },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(31,41,55,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  secondaryBtn: {
    backgroundColor: 'rgba(5,150,105,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.25)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: '900', fontSize: 15 },

  editModalOverlay: { flex: 1, backgroundColor: COLORS.overlay },
  editModalContainer: { flex: 1, marginTop: Platform.OS === 'ios' ? 40 : 20 },
  editModalContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  editModalTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text },
  editModalSubtitle: { marginTop: 6, fontSize: 12, fontWeight: '700', color: COLORS.textLight },
  editModalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(31,41,55,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  editModalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  formSection: { marginBottom: 18 },
  formSectionTitle: { fontSize: 14, fontWeight: '900', color: COLORS.text, marginBottom: 12 },

  speciesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: 'rgba(5,150,105,0.03)',
  },
  speciesName: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  speciesMeta: { marginTop: 4, fontSize: 12, fontWeight: '700', color: COLORS.textLight },
  successInput: {
    width: 90,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    backgroundColor: '#fff',
    textAlign: 'center',
  },

  totalBox: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.18)',
    backgroundColor: 'rgba(5,150,105,0.06)',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  footerButtonSecondary: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  footerButtonSecondaryText: { fontSize: 15, fontWeight: '900', color: COLORS.text },
  footerButtonPrimary: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  footerButtonPrimaryText: { fontSize: 15, fontWeight: '900', color: '#fff' },
});