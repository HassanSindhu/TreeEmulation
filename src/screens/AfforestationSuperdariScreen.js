// /screens/AfforestationSuperdariScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Modal,
  ActivityIndicator,
  PermissionsAndroid,
  Linking,
  TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

import FormRow from '../components/FormRow';
import { apiService } from '../services/ApiService';

const API_HOST = 'http://be.lte.gisforestry.com';

// ✅ CURL endpoint you shared
const SUPERDARI_URL = `${API_HOST}/afforestation/superdari`;

// ✅ AWS upload (same infrastructure you used in other screens)
const AWS_UPLOAD_URL = 'https://app.eco.gisforestry.com/aws-bucket/tree-enum';
const AWS_UPLOAD_PATH = 'Afforestation/Superdari';

// Theme Colors (match your current app feel)
const COLORS = {
  primary: '#059669',
  primaryDark: '#047857',
  secondary: '#0ea5e9',
  success: '#16a34a',
  warning: '#f97316',
  danger: '#dc2626',
  background: '#f8fafc',
  card: '#ffffff',
  text: '#1f2937',
  textLight: '#6b7280',
  border: '#e5e7eb',
  overlay: 'rgba(15, 23, 42, 0.7)',
};

const toNumberOrNull = v => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const parseLatLng = str => {
  const s = String(str || '').trim();
  if (!s) return { lat: null, lng: null };
  const parts = s
    .split(/,|\s+/)
    .map(p => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return { lat: null, lng: null };
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { lat: null, lng: null };
  return { lat, lng };
};

export default function AfforestationSuperdariScreen({ navigation, route }) {
  const afforestationId = Number(route?.params?.afforestationId);
  const nameOfSiteId = route?.params?.nameOfSiteId;
  const record = route?.params?.record;

  // If later you provide GET/PATCH cURLs, we will wire true edit mode.
  const superdariId = route?.params?.superdariId ?? null;

  const [superdarName, setSuperdarName] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [cnicNo, setCnicNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // ✅ disposalId is optional (your earlier requirement), so keep nullable
  const [disposalId, setDisposalId] = useState('');

  // GPS
  const [autoGps, setAutoGps] = useState('');
  const [manualGps, setManualGps] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const lastGpsRequestAtRef = useRef(0);

  // images
  const [imagePickerModal, setImagePickerModal] = useState(false);
  const [pictureUris, setPictureUris] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const title = useMemo(() => {
    if (superdariId) return 'Superdari (Existing)';
    return 'Superdari (Afforestation)';
  }, [superdariId]);

  const getAuthToken = async () => (await AsyncStorage.getItem('AUTH_TOKEN')) || '';

  // Pre-fill from record if available (helps operators)
  useEffect(() => {
    if (record?.superdarName) setSuperdarName(String(record.superdarName));
  }, [record?.superdarName]);

  useEffect(() => {
    if (!Number.isFinite(afforestationId) || afforestationId <= 0) {
      Alert.alert('Error', 'Afforestation ID is missing/invalid.');
    }
  }, [afforestationId]);

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
    if (uris.length) setPictureUris(uris);
  };

  const pickFromGallery = () => {
    setImagePickerModal(false);
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.75,
        selectionLimit: 0,
      },
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
        quality: 0.75,
        saveToPhotos: true,
        cameraType: 'back',
      },
      onImagePickerResult,
    );
  };

  const fetchAutoGps = useCallback((alsoFillManual = true) => {
    const now = Date.now();
    if (now - lastGpsRequestAtRef.current < 1200) return;
    lastGpsRequestAtRef.current = now;

    setGpsLoading(true);
    Geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        const value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setAutoGps(value);
        if (alsoFillManual) setManualGps(value);
        setGpsLoading(false);
      },
      err => {
        setGpsLoading(false);
        Alert.alert('Location Error', err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  }, []);

  useEffect(() => {
    // best effort fetch for operator convenience
    setTimeout(() => fetchAutoGps(true), 350);
  }, [fetchAutoGps]);

  // Manual AWS Upload Removed - handled by ApiService


  const validate = () => {
    if (!Number.isFinite(afforestationId) || afforestationId <= 0) {
      Alert.alert('Missing', 'Afforestation ID is required.');
      return false;
    }
    if (!superdarName.trim()) {
      Alert.alert('Missing', 'Superdar Name is required.');
      return false;
    }
    if (!contactNo.trim()) {
      Alert.alert('Missing', 'Contact No is required.');
      return false;
    }
    if (!cnicNo.trim()) {
      Alert.alert('Missing', 'CNIC No is required.');
      return false;
    }
    return true;
  };

  const submitSuperdari = async () => {
    if (!validate()) return;

    // GPS
    const { lat: autoLat, lng: autoLng } = parseLatLng(autoGps);
    const { lat: manualLat, lng: manualLng } = parseLatLng(manualGps || autoGps);

    // images upload via attachments
    const safeFileName = `aff_super_${afforestationId}_${Date.now()}`;
    const attachments = (pictureUris || []).map((uri, idx) => ({
      uri, type: 'image/jpeg', name: `${safeFileName}_${idx}.jpg`,
      uploadUrl: AWS_UPLOAD_URL,
      uploadPath: AWS_UPLOAD_PATH,
      targetFieldInBody: 'pictures',
      storeBasename: false
    }));

    // disposalId optional
    const disposalIdNum = toNumberOrNull(disposalId);

    const body = {
      afforestationId: afforestationId,
      // ✅ only include disposalId if provided (keeps it optional)
      ...(disposalIdNum ? { disposalId: disposalIdNum } : {}),
      superdar_name: superdarName.trim(),
      contact_no: contactNo.trim(),
      cnic_no: cnicNo.trim(),
      remarks: remarks.trim(),
      auto_lat: autoLat,
      auto_long: autoLng,
      manual_lat: manualLat,
      manual_long: manualLng,
      pictures: [], // Filled by ApiService
    };

    try {
      setSubmitting(true);

      const json = await apiService.post(SUPERDARI_URL, body, { attachments });

      Alert.alert(json.offline ? 'Saved Offline' : 'Success', json.message || 'Superdari saved successfully.');

      // Go back to records; they will refetch and show Superdari label
      navigation.goBack();
    } catch (e) {
      Alert.alert('Submit Failed', e?.message || 'Failed to submit Superdari.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSub}>
            Afforestation ID: {Number.isFinite(afforestationId) ? afforestationId : '—'}
            {nameOfSiteId ? ` • Site: ${nameOfSiteId}` : ''}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Card: Superdar Info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Superdar Details</Text>

            <FormRow label="Superdar Name" value={superdarName} onChangeText={setSuperdarName} required />
            <FormRow
              label="Contact No"
              value={contactNo}
              onChangeText={setContactNo}
              keyboardType="phone-pad"
              required
              placeholder="03001234567"
            />
            <FormRow
              label="CNIC No"
              value={cnicNo}
              onChangeText={setCnicNo}
              required
              placeholder="35202-1234567-1"
            />
            <FormRow
              label="Remarks"
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Superdari remarks"
            />

            <FormRow
              label="Disposal ID (Optional)"
              value={disposalId}
              onChangeText={setDisposalId}
              keyboardType="numeric"
              placeholder="Leave empty if not disposed"
            />
          </View>

          {/* Card: GPS */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>GPS Coordinates</Text>

              <TouchableOpacity style={styles.fetchBtn} onPress={() => fetchAutoGps(true)} activeOpacity={0.8}>
                <Ionicons name="locate-outline" size={16} color="#fff" />
                <Text style={styles.fetchBtnText}>Fetch</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.smallLabel}>Auto GPS</Text>
            <View style={styles.gpsBox}>
              <Text style={styles.gpsText}>{autoGps || '—'}</Text>
              {gpsLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>

            <Text style={styles.smallLabel}>Manual GPS</Text>
            <TextInput
              style={styles.input}
              value={manualGps}
              onChangeText={setManualGps}
              placeholder="31.5205, 74.3588"
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.note}>
              Manual GPS defaults to Auto GPS. Update it only if you need a corrected point.
            </Text>
          </View>

          {/* Card: Images */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pictures</Text>

            <TouchableOpacity style={styles.imageBtn} onPress={() => setImagePickerModal(true)} activeOpacity={0.8}>
              <Ionicons name="image-outline" size={20} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.imageBtnTitle}>Add Pictures</Text>
                <Text style={styles.imageBtnSub}>Camera or Gallery • Uploads to AWS</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
            </TouchableOpacity>

            {!!pictureUris.length && (
              <View style={styles.selectedBox}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                <Text style={styles.selectedText}>
                  {pictureUris.length} image{pictureUris.length !== 1 ? 's' : ''} selected
                </Text>
              </View>
            )}

            {uploading && (
              <View style={styles.progressRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.progressText}>Uploading images...</Text>
              </View>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, (submitting || uploading) && { opacity: 0.7 }]}
            onPress={submitSuperdari}
            disabled={submitting || uploading}
            activeOpacity={0.85}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Save Superdari</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Helper */}
          <Text style={styles.footerHint}>
            Note: This screen uses POST {SUPERDARI_URL}. If you want “Edit existing Superdari” support,
            please share the GET and PATCH/PUT cURLs for Superdari.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

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
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Image</Text>
                <TouchableOpacity onPress={() => setImagePickerModal(false)} style={styles.modalClose}>
                  <Ionicons name="close" size={22} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 18, gap: 12 }}>
                <TouchableOpacity style={styles.modalBtnPrimary} onPress={takePhotoFromCamera} activeOpacity={0.85}>
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                  <Text style={styles.modalBtnPrimaryText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalBtnSecondary} onPress={pickFromGallery} activeOpacity={0.85}>
                  <Ionicons name="images-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.modalBtnSecondaryText}>Choose from Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setImagePickerModal(false)} style={styles.modalCancel} activeOpacity={0.85}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 0) + 18,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 2 },

  container: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 10 },

  fetchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  fetchBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  smallLabel: { fontSize: 12, fontWeight: '800', color: COLORS.textLight, marginTop: 8, marginBottom: 6 },
  gpsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: 'rgba(5,150,105,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.18)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  gpsText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    color: COLORS.text,
    fontWeight: '600',
  },

  note: { marginTop: 10, color: COLORS.textLight, fontSize: 12, fontWeight: '600', lineHeight: 18 },

  imageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(5,150,105,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.18)',
    borderRadius: 14,
    padding: 14,
  },
  imageBtnTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  imageBtnSub: { fontSize: 12, fontWeight: '600', color: COLORS.textLight, marginTop: 2 },

  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    backgroundColor: 'rgba(22,163,74,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.18)',
    borderRadius: 12,
    padding: 12,
  },
  selectedText: { fontSize: 13, fontWeight: '800', color: COLORS.success },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  progressText: { color: COLORS.textLight, fontSize: 12, fontWeight: '700' },

  submitBtn: {
    marginTop: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },

  footerHint: {
    marginTop: 12,
    marginBottom: 18,
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalContainer: { flex: 1, justifyContent: 'center', padding: 18 },
  modalContent: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 16, fontWeight: '900', color: COLORS.text },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(31,41,55,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  modalBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  modalBtnSecondary: {
    backgroundColor: 'rgba(5,150,105,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.18)',
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  modalBtnSecondaryText: { color: COLORS.primary, fontSize: 14, fontWeight: '900' },
  modalCancel: { alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { color: COLORS.textLight, fontSize: 13, fontWeight: '800' },
});
