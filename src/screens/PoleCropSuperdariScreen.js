// /screens/PoleCropSuperdariScreen.js
// ✅ NEW SCREEN: Pole Crop Superdari
// ✅ Uses CURL: POST http://be.lte.gisforestry.com/pole-crop/superdari
// ✅ Authorization: Bearer from AsyncStorage('AUTH_TOKEN')
// ✅ Supports location (auto + manual) + pictures upload to AWS bucket
// ✅ disposalId is optional (null allowed) as per curl

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
  Image,
  Switch,
  Dimensions,
  Linking,
  PermissionsAndroid,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { apiService } from '../services/ApiService';

const { height } = Dimensions.get('window');

const COLORS = {
  primary: '#059669',
  primaryDark: '#047857',
  secondary: '#0ea5e9',
  info: '#7c3aed',
  danger: '#dc2626',
  text: '#1f2937',
  textLight: '#6b7280',
  border: '#e5e7eb',
  bg: '#f8fafc',
  card: '#ffffff',
  overlay: 'rgba(15, 23, 42, 0.7)',
};

const API_BASE = 'http://be.lte.gisforestry.com';
const AWS_Base = 'https://app.eco.gisforestry.com';

// Superdari API
const SUPERDARI_URL = `${API_BASE}/pole-crop/superdari`;

// Bucket Upload API (same infra as your other screens)
const BUCKET_UPLOAD_URL = `${AWS_Base}/aws-bucket/tree-enum`;
const BUCKET_UPLOAD_PATH = 'PolecropSuperdari';
const BUCKET_IS_MULTI = 'true';
const BUCKET_FILE_NAME = 'chan';

const getToken = async () => (await AsyncStorage.getItem('AUTH_TOKEN')) || '';

const formatLatLng = (lat, lng) => `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;

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
  if (Number.isNaN(lat) || Number.isNaN(lng)) return { lat: null, lng: null };
  return { lat, lng };
};

const toFormFile = asset => {
  const uri = asset?.uri;
  if (!uri) return null;
  const name =
    asset?.fileName ||
    `polecrop_superdari_${Date.now()}${asset?.type?.includes('png') ? '.png' : '.jpg'}`;
  const type = asset?.type || 'image/jpeg';
  return { uri, name, type };
};

export default function PoleCropSuperdariScreen({ navigation, route }) {
  const poleCrop = route?.params?.poleCrop;
  const poleCropId = useMemo(() => poleCrop?.id ?? null, [poleCrop]);

  // If you pass disposal from previous screen later:
  // navigation.navigate('PoleCropSuperdariScreen', { poleCrop: r, disposal: disposalObj })
  const disposalFromRoute = route?.params?.disposal || null;

  const [saving, setSaving] = useState(false);

  // ====== FORM STATE (matches curl body) ======
  const [useDisposalId, setUseDisposalId] = useState(false);
  const [disposalId, setDisposalId] = useState(
    disposalFromRoute?.id != null ? String(disposalFromRoute.id) : '',
  );

  const [superdarName, setSuperdarName] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [cnicNo, setCnicNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // GPS
  const [autoGps, setAutoGps] = useState('');
  const [manualGps, setManualGps] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  // Permission modal-like behavior (simple)
  const [locBlocked, setLocBlocked] = useState(false);

  // Pictures
  const [pickedAssets, setPickedAssets] = useState([]);
  const [uploading, setUploading] = useState(false);

  const lastGpsRequestAtRef = useRef(0);
  const prevAutoGpsRef = useRef('');
  const lastPickAtRef = useRef(0);

  // Prefill disposalId if route has it
  useEffect(() => {
    if (disposalFromRoute?.id != null) {
      setDisposalId(String(disposalFromRoute.id));
      setUseDisposalId(true);
    }
  }, [disposalFromRoute]);

  /* ===================== IMAGES ===================== */
  const addAssets = useCallback(newAssets => {
    const incoming = Array.isArray(newAssets) ? newAssets : [];
    if (!incoming.length) return;

    setPickedAssets(prev => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const map = new Map();
      prevArr.forEach(a => a?.uri && map.set(a.uri, a));
      incoming.forEach(a => a?.uri && map.set(a.uri, a));
      return Array.from(map.values());
    });
  }, []);

  const pickImages = () => {
    const now = Date.now();
    if (now - lastPickAtRef.current < 800) return;
    lastPickAtRef.current = now;

    launchImageLibrary(
      { mediaType: 'photo', quality: 0.85, selectionLimit: 0 },
      res => {
        if (res?.didCancel) return;
        if (res?.errorCode) {
          Alert.alert('Image Error', res.errorMessage || res.errorCode);
          return;
        }
        addAssets(res?.assets || []);
      },
    );
  };

  const ensureCameraPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title: 'Camera Permission',
        message: 'This app needs camera access to capture superdari pictures.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      });
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      return false;
    }
  }, []);

  const captureImage = useCallback(async () => {
    const ok = await ensureCameraPermission();
    if (!ok) {
      Alert.alert('Permission Required', 'Camera permission is required to take a photo.');
      return;
    }

    launchCamera(
      { mediaType: 'photo', quality: 0.85, saveToPhotos: false, cameraType: 'back' },
      res => {
        if (res?.didCancel) return;
        if (res?.errorCode) {
          Alert.alert('Camera Error', res.errorMessage || res.errorCode);
          return;
        }
        addAssets(res?.assets || []);
      },
    );
  }, [addAssets, ensureCameraPermission]);

  const clearImages = () => setPickedAssets([]);

  // Manual upload removed - handled by ApiService

  /* ===================== LOCATION PERMISSION + GPS ===================== */
  const openSettingsSafe = useCallback(() => {
    Linking.openSettings().catch(() => {
      Alert.alert('Settings', 'Unable to open Settings on this device.');
    });
  }, []);

  const ensureLocationPermission = useCallback(async () => {
    if (Platform.OS === 'ios') {
      try {
        Geolocation.requestAuthorization?.('whenInUse');
        return { ok: true, blocked: false };
      } catch (e) {
        return { ok: false, blocked: false };
      }
    }

    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      const fine = result?.[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const coarse = result?.[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];

      const ok =
        fine === PermissionsAndroid.RESULTS.GRANTED ||
        coarse === PermissionsAndroid.RESULTS.GRANTED;

      const blocked =
        fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
        coarse === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

      return { ok, blocked };
    } catch (e) {
      return { ok: false, blocked: false };
    }
  }, []);

  const fetchGps = useCallback(async () => {
    const now = Date.now();
    if (now - lastGpsRequestAtRef.current < 1200) return;
    lastGpsRequestAtRef.current = now;

    const perm = await ensureLocationPermission();
    if (!perm.ok) {
      setLocBlocked(!!perm.blocked);
      Alert.alert(
        'Location Permission',
        perm.blocked
          ? 'Location permission is blocked. Please enable it from Settings.'
          : 'Location permission is required to fetch GPS coordinates.',
        perm.blocked
          ? [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openSettingsSafe },
          ]
          : [{ text: 'OK' }],
      );
      return;
    }

    setGpsLoading(true);

    Geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        const nextAuto = formatLatLng(latitude, longitude);
        setAutoGps(nextAuto);

        setManualGps(prev => {
          const prevAuto = prevAutoGpsRef.current;
          const prevTrim = String(prev || '').trim();
          if (!prevTrim) return nextAuto;
          if (prevTrim === String(prevAuto || '').trim()) return nextAuto;
          return prevTrim;
        });

        prevAutoGpsRef.current = nextAuto;
        setGpsLoading(false);
      },
      err => {
        setGpsLoading(false);
        Alert.alert('Location Error', err?.message || 'Unable to fetch location.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  }, [ensureLocationPermission, openSettingsSafe]);

  useEffect(() => {
    const a = String(autoGps || '').trim();
    if (!a) return;
    setManualGps(prev => (String(prev || '').trim() ? prev : a));
  }, [autoGps]);

  const resolveFinalGps = () => {
    const m = String(manualGps || '').trim();
    return m || String(autoGps || '').trim();
  };

  /* ===================== VALIDATION ===================== */
  const validate = () => {
    if (!poleCropId) {
      Alert.alert('Error', 'PoleCropId missing. Please open superdari from a record row.');
      return false;
    }

    if (!String(superdarName || '').trim()) {
      Alert.alert('Missing', 'Superdar Name is required.');
      return false;
    }

    if (!String(contactNo || '').trim()) {
      Alert.alert('Missing', 'Contact No is required.');
      return false;
    }

    if (!String(cnicNo || '').trim()) {
      Alert.alert('Missing', 'CNIC No is required.');
      return false;
    }

    if (useDisposalId) {
      const v = String(disposalId || '').trim();
      if (!v) {
        Alert.alert('Missing', 'Disposal ID is enabled but empty.');
        return false;
      }
      if (!Number.isFinite(Number(v))) {
        Alert.alert('Invalid', 'Disposal ID must be numeric.');
        return false;
      }
    }

    // GPS: optional but recommended; if provided must parse
    const finalGps = resolveFinalGps();
    if (String(finalGps).trim()) {
      const { lat, lng } = parseLatLng(finalGps);
      if (lat == null || lng == null) {
        Alert.alert('Invalid', 'Manual GPS must be like "31.3333, 74.4444".');
        return false;
      }
    }

    return true;
  };

  // ====== SUBMIT ======
  const submit = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      // Prepare attachments
      const attachments = pickedAssets.map(a => ({
        uri: a.uri,
        type: a.type || 'image/jpeg',
        name: a.fileName,
        uploadUrl: BUCKET_UPLOAD_URL,
        uploadPath: BUCKET_UPLOAD_PATH,
        targetFieldInBody: 'pictures'
      }));

      const { lat: autoLat, lng: autoLng } = parseLatLng(autoGps);
      const finalGps = resolveFinalGps();
      const { lat: manualLat, lng: manualLng } = parseLatLng(finalGps);

      const body = {
        poleCropId: Number(poleCropId),
        disposalId: useDisposalId ? Number(disposalId) : null,

        superdar_name: String(superdarName || '').trim(),
        contact_no: String(contactNo || '').trim(),
        cnic_no: String(cnicNo || '').trim(),

        remarks: String(remarks || '').trim() || null,

        auto_lat: autoLat,
        auto_long: autoLng,
        manual_lat: manualLat,
        manual_long: manualLng,

        pictures: [], // ApiService will fill this
      };

      const res = await apiService.post(SUPERDARI_URL, body, { attachments });

      Alert.alert(
        res.offline ? 'Saved Offline' : 'Success',
        res.message || 'Pole crop superdari submitted successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to submit superdari');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Pole Crop Superdari</Text>
          <Text style={styles.headerSub}>
            PoleCrop ID: {String(poleCropId ?? '—')} | RDS: {String(poleCrop?.rds_from ?? '—')} -{' '}
            {String(poleCrop?.rds_to ?? '—')}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Superdar */}
          <Card title="Superdar Information">
            <Row>
              <Field
                label="Superdar Name"
                value={superdarName}
                onChangeText={setSuperdarName}
                placeholder="Pole Crop Superdar"
              />
              <Field
                label="Contact No"
                value={contactNo}
                onChangeText={setContactNo}
                placeholder="03217654321"
                keyboardType="phone-pad"
              />
            </Row>

            <Row>
              <Field
                label="CNIC No"
                value={cnicNo}
                onChangeText={setCnicNo}
                placeholder="35201-9876543-2"
              />
              <View style={{ flex: 1 }} />
            </Row>

            <Field
              label="Remarks"
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Remarks about pole crop superdari"
              multiline
            />
          </Card>

          {/* Optional Disposal Link */}
          <Card title="Link Disposal (Optional)">
            <SwitchRow
              label="Use Disposal ID"
              value={useDisposalId}
              onValueChange={v => setUseDisposalId(!!v)}
            />

            {useDisposalId ? (
              <Field
                label="Disposal ID"
                value={disposalId}
                onChangeText={setDisposalId}
                placeholder="e.g. 123"
                keyboardType="numeric"
              />
            ) : (
              <Text style={styles.muted}>disposalId will be sent as null.</Text>
            )}
          </Card>

          {/* GPS */}
          <Card title="Location (Auto + Manual GPS)">
            <View style={styles.gpsHead}>
              <Text style={styles.gpsTitle}>Auto GPS Coordinates</Text>
              <TouchableOpacity style={styles.gpsBtn} onPress={fetchGps} activeOpacity={0.85}>
                <Ionicons name="locate" size={16} color="#fff" />
                <Text style={styles.gpsBtnText}>Fetch GPS</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.gpsBox}>
              <Text style={styles.gpsValue}>{autoGps || 'No coordinates fetched'}</Text>
              {gpsLoading && (
                <View style={styles.gpsLoading}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.gpsLoadingText}>Fetching location...</Text>
                </View>
              )}
            </View>

            <Field
              label="Manual GPS (editable)"
              value={manualGps}
              onChangeText={setManualGps}
              placeholder={autoGps || '31.3333, 74.4444'}
            />

            {locBlocked && (
              <TouchableOpacity
                style={styles.settingsBtn}
                onPress={openSettingsSafe}
                activeOpacity={0.85}>
                <Ionicons name="settings-outline" size={16} color={COLORS.primary} />
                <Text style={styles.settingsBtnText}>Open Settings for Location</Text>
              </TouchableOpacity>
            )}
          </Card>

          {/* Pictures */}
          <Card title="Pictures">
            <View style={styles.picActions}>
              <TouchableOpacity style={styles.picBtn} onPress={pickImages} activeOpacity={0.85}>
                <Ionicons name="images-outline" size={18} color="#fff" />
                <Text style={styles.picBtnText}>Select</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.picBtn2} onPress={captureImage} activeOpacity={0.85}>
                <Ionicons name="camera-outline" size={18} color="#fff" />
                <Text style={styles.picBtnText}>Camera</Text>
              </TouchableOpacity>

              {pickedAssets.length > 0 && (
                <TouchableOpacity style={styles.picClear} onPress={clearImages} activeOpacity={0.85}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  <Text style={styles.picClearText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {pickedAssets.length > 0 ? (
              <>
                <Text style={styles.picHint}>
                  {pickedAssets.length} image(s) selected. Upload Path: {BUCKET_UPLOAD_PATH}
                </Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                  {pickedAssets.map((a, i) => (
                    <View key={a?.uri || i} style={styles.thumbWrap}>
                      <Image source={{ uri: a?.uri }} style={styles.thumb} />
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : (
              <Text style={styles.muted}>
                No images selected. You can submit with an empty pictures array.
              </Text>
            )}
          </Card>

          {/* Submit */}
          <View style={{ height: 14 }} />

          <TouchableOpacity
            style={[styles.submitBtn, (saving || uploading) && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={saving || uploading}
            activeOpacity={0.85}>
            {saving || uploading ? (
              <View style={styles.submitRow}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.submitText}>
                  {uploading ? 'Uploading pictures...' : 'Submitting...'}
                </Text>
              </View>
            ) : (
              <View style={styles.submitRow}>
                <Ionicons name="send-outline" size={18} color="#fff" />
                <Text style={styles.submitText}>Submit Superdari</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={{ height: 26 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ===================== SMALL UI COMPONENTS ===================== */

function Card({ title, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function Row({ children }) {
  return <View style={styles.row}>{children}</View>;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={String(value ?? '')}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textLight}
        style={[styles.input, multiline && styles.inputMulti]}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function SwitchRow({ label, value, onValueChange }) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch value={!!value} onValueChange={onValueChange} />
    </View>
  );
}

/* ===================== STYLES ===================== */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 18,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    elevation: 8,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  headerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700', marginTop: 4 },

  body: { padding: 16, paddingBottom: 28 },

  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
  },
  cardHead: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: 'rgba(5,150,105,0.06)',
  },
  cardTitle: { fontSize: 13, fontWeight: '900', color: COLORS.text },
  cardBody: { padding: 14 },

  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    backgroundColor: '#fff',
  },
  inputMulti: { height: 88, paddingTop: 12, textAlignVertical: 'top' },

  muted: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, marginTop: 6 },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 10,
  },
  switchLabel: { fontSize: 13, fontWeight: '900', color: COLORS.text },

  gpsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  gpsTitle: { fontSize: 13, fontWeight: '900', color: COLORS.text },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  gpsBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  gpsBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  gpsValue: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  gpsLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  gpsLoadingText: { fontSize: 12, fontWeight: '800', color: COLORS.textLight },

  settingsBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.20)',
    backgroundColor: 'rgba(5,150,105,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  settingsBtnText: { fontSize: 12, fontWeight: '900', color: COLORS.primary },

  picActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  picBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  picBtn2: {
    backgroundColor: COLORS.info,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  picBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  picClear: {
    backgroundColor: 'rgba(220,38,38,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.20)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  picClearText: { color: COLORS.danger, fontSize: 12, fontWeight: '900' },
  picHint: { marginTop: 10, fontSize: 12, fontWeight: '800', color: COLORS.textLight },

  thumbWrap: {
    width: 92,
    height: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginRight: 10,
    backgroundColor: '#fff',
  },
  thumb: { width: '100%', height: '100%' },

  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
