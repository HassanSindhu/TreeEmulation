// /screens/PoleCropDisposeScreen.js
// ✅ NEW SCREEN: Pole Crop Disposal
// ✅ Uses CURL: POST http://be.lte.gisforestry.com/pole-crop/disposal
// ✅ Authorization: Bearer from AsyncStorage('AUTH_TOKEN')
// ✅ Supports pictures upload to AWS bucket (same service as your other screens)
// ✅ Conditional fields for Auction (only when auction=true)

import React, {useCallback, useMemo, useRef, useState} from 'react';
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
import {launchImageLibrary, launchCamera} from 'react-native-image-picker';

const {height} = Dimensions.get('window');

const COLORS = {
  primary: '#059669',
  primaryDark: '#047857',
  secondary: '#0ea5e9',
  danger: '#dc2626',
  text: '#1f2937',
  textLight: '#6b7280',
  border: '#e5e7eb',
  bg: '#f8fafc',
  card: '#ffffff',
};

const API_BASE = 'http://be.lte.gisforestry.com';
const AWS_Base = 'https://app.eco.gisforestry.com';

// Disposal API
const DISPOSAL_URL = `${API_BASE}/pole-crop/disposal`;

// Bucket Upload API (same as other screens)
const BUCKET_UPLOAD_URL = `${AWS_Base}/aws-bucket/tree-enum`;
const BUCKET_UPLOAD_PATH = 'PolecropDisposal';
const BUCKET_IS_MULTI = 'true';
const BUCKET_FILE_NAME = 'chan';

const getToken = async () => (await AsyncStorage.getItem('AUTH_TOKEN')) || '';

const toFormFile = asset => {
  const uri = asset?.uri;
  if (!uri) return null;
  const name =
    asset?.fileName ||
    `polecrop_disposal_${Date.now()}${asset?.type?.includes('png') ? '.png' : '.jpg'}`;
  const type = asset?.type || 'image/jpeg';
  return {uri, name, type};
};

const isISODate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim());

export default function PoleCropDisposeScreen({navigation, route}) {
  const poleCrop = route?.params?.poleCrop;

  const poleCropId = useMemo(() => poleCrop?.id ?? null, [poleCrop]);
  const [saving, setSaving] = useState(false);

  // ====== FORM STATE (matches curl body) ======
  const [drNo, setDrNo] = useState('');
  const [drDate, setDrDate] = useState(''); // YYYY-MM-DD

  const [fcNo, setFcNo] = useState('');
  const [dpcNo, setDpcNo] = useState('');
  const [dpcDate, setDpcDate] = useState(''); // YYYY-MM-DD
  const [firNo, setFirNo] = useState('');
  const [firDate, setFirDate] = useState(''); // YYYY-MM-DD

  const [remarks, setRemarks] = useState('');
  const [peedaAct, setPeedaAct] = useState(false);

  const [authorityOo, setAuthorityOo] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [officerDesignation, setOfficerDesignation] = useState('');

  const [actDate, setActDate] = useState(''); // YYYY-MM-DD
  const [actRemarks, setActRemarks] = useState('');

  const [auction, setAuction] = useState(false);
  const [auctionDetails, setAuctionDetails] = useState('');
  const [auctionDate, setAuctionDate] = useState(''); // YYYY-MM-DD
  const [auctionAuthorityName, setAuctionAuthorityName] = useState('');
  const [auctionAuthorityDesignation, setAuctionAuthorityDesignation] = useState('');
  const [auctionRemarks, setAuctionRemarks] = useState('');

  // Pictures
  const [pickedAssets, setPickedAssets] = useState([]);
  const [uploading, setUploading] = useState(false);

  const lastPickAtRef = useRef(0);

  // ====== IMAGE PICK/CAPTURE ======
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
      {mediaType: 'photo', quality: 0.85, selectionLimit: 0},
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
        message: 'This app needs camera access to capture disposal pictures.',
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
      {mediaType: 'photo', quality: 0.85, saveToPhotos: false, cameraType: 'back'},
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

  const uploadImagesIfAny = async () => {
    if (!pickedAssets.length) return [];

    setUploading(true);
    try {
      const form = new FormData();
      pickedAssets.forEach(a => {
        const f = toFormFile(a);
        if (f) form.append('files', f);
      });

      form.append('uploadPath', BUCKET_UPLOAD_PATH);
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
    } finally {
      setUploading(false);
    }
  };

  // ====== VALIDATION ======
  const validate = () => {
    if (!poleCropId) {
      Alert.alert('Error', 'PoleCropId missing. Please open disposal from a record row.');
      return false;
    }

    // If provided, enforce ISO format (avoid backend rejects)
    const datePairs = [
      {label: 'DR Date', value: drDate},
      {label: 'DPC Date', value: dpcDate},
      {label: 'FIR Date', value: firDate},
      {label: 'Act Date', value: actDate},
      {label: 'Auction Date', value: auctionDate},
    ];

    for (const d of datePairs) {
      const v = String(d.value || '').trim();
      if (!v) continue;
      if (!isISODate(v)) {
        Alert.alert('Invalid Date', `${d.label} must be in YYYY-MM-DD format.`);
        return false;
      }
    }

    if (auction) {
      // In your curl, auction_details is a string; allow empty but better to ask
      if (!String(auctionDetails || '').trim()) {
        Alert.alert('Missing', 'Auction Details is required when Auction is enabled.');
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
      const token = await getToken();
      if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

      const pictureUrls = await uploadImagesIfAny();

      const body = {
        poleCropId: Number(poleCropId),
        dr_no: String(drNo || '').trim() || null,
        dr_date: String(drDate || '').trim() || null,

        fc_no: String(fcNo || '').trim() || null,
        dpc_no: String(dpcNo || '').trim() || null,
        dpc_date: String(dpcDate || '').trim() || null,
        fir_no: String(firNo || '').trim() || null,
        fir_date: String(firDate || '').trim() || null,

        remarks: String(remarks || '').trim() || null,
        peeda_act: !!peedaAct,

        authority_oo: String(authorityOo || '').trim() || null,
        officer_name: String(officerName || '').trim() || null,
        officer_designation: String(officerDesignation || '').trim() || null,

        act_date: String(actDate || '').trim() || null,
        act_remarks: String(actRemarks || '').trim() || null,

        auction: !!auction,
        auction_details: auction ? (String(auctionDetails || '').trim() || null) : null,
        auction_date: auction ? (String(auctionDate || '').trim() || null) : null,
        auction_authority_name: auction ? (String(auctionAuthorityName || '').trim() || null) : null,
        auction_authority_designation: auction
          ? (String(auctionAuthorityDesignation || '').trim() || null)
          : null,
        auction_remarks: auction ? (String(auctionRemarks || '').trim() || null) : null,

        pictures: pictureUrls, // per curl: pictures: []
      };

      const res = await fetch(DISPOSAL_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.message || json?.error || `API Error (${res.status})`;
        throw new Error(msg);
      }

      Alert.alert('Success', 'Pole crop disposal submitted successfully.', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to submit disposal');
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
        <View style={{flex: 1}}>
          <Text style={styles.headerTitle}>Pole Crop Disposal</Text>
          <Text style={styles.headerSub}>
            PoleCrop ID: {String(poleCropId ?? '—')} | RDS: {String(poleCrop?.rds_from ?? '—')} -{' '}
            {String(poleCrop?.rds_to ?? '—')}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Document Numbers */}
          <Card title="Disposal References">
            <Row>
              <Field label="DR No" value={drNo} onChangeText={setDrNo} placeholder="PC-DR-999" />
              <Field
                label="DR Date (YYYY-MM-DD)"
                value={drDate}
                onChangeText={setDrDate}
                placeholder="2024-02-01"
              />
            </Row>

            <Row>
              <Field label="FC No" value={fcNo} onChangeText={setFcNo} placeholder="PC-FC-888" />
              <Field label="DPC No" value={dpcNo} onChangeText={setDpcNo} placeholder="PC-DPC-777" />
            </Row>

            <Row>
              <Field
                label="DPC Date (YYYY-MM-DD)"
                value={dpcDate}
                onChangeText={setDpcDate}
                placeholder="2024-01-31"
              />
              <Field label="FIR No" value={firNo} onChangeText={setFirNo} placeholder="PC-FIR-666" />
            </Row>

            <Row>
              <Field
                label="FIR Date (YYYY-MM-DD)"
                value={firDate}
                onChangeText={setFirDate}
                placeholder="2024-01-30"
              />
              <View style={{flex: 1}} />
            </Row>

            <Field
              label="Remarks"
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Pole crop specific disposal remarks"
              multiline
            />
          </Card>

          {/* Act / Authority */}
          <Card title="Act / Authority Details">
            <SwitchRow label="Peeda Act" value={peedaAct} onValueChange={setPeedaAct} />
            <Field
              label="Authority OO"
              value={authorityOo}
              onChangeText={setAuthorityOo}
              placeholder="Authority OO Text"
            />

            <Row>
              <Field
                label="Officer Name"
                value={officerName}
                onChangeText={setOfficerName}
                placeholder="Officer B"
              />
              <Field
                label="Officer Designation"
                value={officerDesignation}
                onChangeText={setOfficerDesignation}
                placeholder="Sub-Inspector"
              />
            </Row>

            <Row>
              <Field
                label="Act Date (YYYY-MM-DD)"
                value={actDate}
                onChangeText={setActDate}
                placeholder="2024-01-29"
              />
              <View style={{flex: 1}} />
            </Row>

            <Field
              label="Act Remarks"
              value={actRemarks}
              onChangeText={setActRemarks}
              placeholder="No action required"
              multiline
            />
          </Card>

          {/* Auction */}
          <Card title="Auction">
            <SwitchRow label="Auction" value={auction} onValueChange={setAuction} />

            {auction ? (
              <>
                <Field
                  label="Auction Details"
                  value={auctionDetails}
                  onChangeText={setAuctionDetails}
                  placeholder="Auction details"
                  multiline
                />
                <Row>
                  <Field
                    label="Auction Date (YYYY-MM-DD)"
                    value={auctionDate}
                    onChangeText={setAuctionDate}
                    placeholder="2024-02-10"
                  />
                  <View style={{flex: 1}} />
                </Row>

                <Row>
                  <Field
                    label="Auction Authority Name"
                    value={auctionAuthorityName}
                    onChangeText={setAuctionAuthorityName}
                    placeholder="Authority Name"
                  />
                  <Field
                    label="Auction Authority Designation"
                    value={auctionAuthorityDesignation}
                    onChangeText={setAuctionAuthorityDesignation}
                    placeholder="Designation"
                  />
                </Row>

                <Field
                  label="Auction Remarks"
                  value={auctionRemarks}
                  onChangeText={setAuctionRemarks}
                  placeholder="Auction remarks"
                  multiline
                />
              </>
            ) : (
              <Text style={styles.muted}>
                Auction fields are disabled because Auction is set to false.
              </Text>
            )}
          </Card>

          {/* Pictures */}
          <Card title="Pictures">
            <View style={styles.picActions}>
              <TouchableOpacity style={styles.picBtn} onPress={pickImages} activeOpacity={0.8}>
                <Ionicons name="images-outline" size={18} color="#fff" />
                <Text style={styles.picBtnText}>Select</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.picBtn2} onPress={captureImage} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={18} color="#fff" />
                <Text style={styles.picBtnText}>Camera</Text>
              </TouchableOpacity>

              {pickedAssets.length > 0 && (
                <TouchableOpacity style={styles.picClear} onPress={clearImages} activeOpacity={0.8}>
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

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 12}}>
                  {pickedAssets.map((a, i) => (
                    <View key={a?.uri || i} style={styles.thumbWrap}>
                      <Image source={{uri: a?.uri}} style={styles.thumb} />
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : (
              <Text style={styles.muted}>No images selected. Pictures will be an empty array.</Text>
            )}
          </Card>

          {/* Submit */}
          <View style={{height: 14}} />

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
                <Text style={styles.submitText}>Submit Disposal</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={{height: 26}} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ===================== SMALL UI COMPONENTS ===================== */

function Card({title, children}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function Row({children}) {
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

function SwitchRow({label, value, onValueChange}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch value={!!value} onValueChange={onValueChange} />
    </View>
  );
}

/* ===================== STYLES ===================== */

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: COLORS.bg},

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
    shadowOffset: {width: 0, height: 4},
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
  headerTitle: {color: '#fff', fontSize: 20, fontWeight: '900'},
  headerSub: {color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700', marginTop: 4},

  body: {padding: 16, paddingBottom: 28},

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
  cardTitle: {fontSize: 13, fontWeight: '900', color: COLORS.text},
  cardBody: {padding: 14},

  row: {flexDirection: 'row', gap: 12},
  field: {flex: 1, marginBottom: 12},
  label: {fontSize: 12, fontWeight: '800', color: COLORS.text, marginBottom: 6},
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
  inputMulti: {height: 88, paddingTop: 12, textAlignVertical: 'top'},

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 10,
  },
  switchLabel: {fontSize: 13, fontWeight: '900', color: COLORS.text},

  muted: {fontSize: 12, fontWeight: '700', color: COLORS.textLight, marginTop: 6},

  picActions: {flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap'},
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
    backgroundColor: COLORS.primaryDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  picBtnText: {color: '#fff', fontSize: 12, fontWeight: '900'},
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
  picClearText: {color: COLORS.danger, fontSize: 12, fontWeight: '900'},
  picHint: {marginTop: 10, fontSize: 12, fontWeight: '800', color: COLORS.textLight},

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
  thumb: {width: '100%', height: '100%'},

  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {opacity: 0.7},
  submitRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  submitText: {color: '#fff', fontSize: 14, fontWeight: '900'},
});
