// /screens/AfforestationDisposalScreen.js
import React, { useEffect, useMemo, useState } from 'react';
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
  Switch,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Calendar } from 'react-native-calendars';

import FormRow from '../components/FormRow';
import { apiService } from '../services/ApiService';

// ✅ IMPORTANT: Your cURL uses localhost:3000. In production, switch to be.lte.gisforestry.com.
const API_HOST = 'http://be.lte.gisforestry.com';
// const API_HOST = 'http://localhost:3000';

const DISPOSAL_URL = `${API_HOST}/afforestation/disposal`;

// ✅ AWS upload (same approach as your other screens)
const AWS_UPLOAD_URL = 'https://app.eco.gisforestry.com/aws-bucket/tree-enum';
const AWS_UPLOAD_PATH = 'Afforestation/Disposal';

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

const cleanStr = v => String(v ?? '').trim();
const isValidYmd = v => /^\d{4}-\d{2}-\d{2}$/.test(cleanStr(v));
const getTodayYmd = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const formatDateDisplay = ymd => {
  if (!ymd) return '';
  const [y, m, d] = String(ymd).split('-');
  if (!y || !m || !d) return String(ymd);
  return `${d}-${m}-${y}`;
};

// Simple reusable date input row
const DateRow = ({ label, value, onPress, required }) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={styles.dateLabel}>
      {label}
      {required ? <Text style={{ color: COLORS.danger }}> *</Text> : null}
    </Text>
    <TouchableOpacity style={styles.dateInput} onPress={onPress} activeOpacity={0.8}>
      <Text style={value ? styles.dateText : styles.datePlaceholder}>
        {value ? formatDateDisplay(value) : 'Select date'}
      </Text>
      <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
    </TouchableOpacity>
  </View>
);

export default function AfforestationDisposalScreen({ navigation, route }) {
  const afforestationId = Number(route?.params?.afforestationId);
  const nameOfSiteId = route?.params?.nameOfSiteId;
  const disposalId = route?.params?.disposalId ?? null;

  // ---------------- FORM STATE ----------------
  const [drNo, setDrNo] = useState('');
  const [drDate, setDrDate] = useState('');

  const [fcNo, setFcNo] = useState('');
  const [dpcNo, setDpcNo] = useState('');
  const [dpcDate, setDpcDate] = useState('');

  // FIR (toggle -> open/close block like your example screen)
  const [firEnabled, setFirEnabled] = useState(false);
  const [firNo, setFirNo] = useState('');
  const [firDate, setFirDate] = useState('');

  const [remarks, setRemarks] = useState('');

  // PEEDA (toggle -> open/close block)
  const [peedaAct, setPeedaAct] = useState(false);
  const [authorityOo, setAuthorityOo] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [officerDesignation, setOfficerDesignation] = useState('');
  const [actDate, setActDate] = useState('');
  const [actRemarks, setActRemarks] = useState('');

  // Auction (toggle -> open/close block)
  const [auction, setAuction] = useState(false);
  const [auctionDetails, setAuctionDetails] = useState('');
  const [auctionDate, setAuctionDate] = useState('');
  const [auctionAuthorityName, setAuctionAuthorityName] = useState('');
  const [auctionAuthorityDesignation, setAuctionAuthorityDesignation] = useState('');
  const [auctionRemarks, setAuctionRemarks] = useState('');

  // Images
  const [imagePickerModal, setImagePickerModal] = useState(false);
  const [pictureUris, setPictureUris] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Date picker modal state (calendar)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateField, setDateField] = useState(null); // 'drDate' | 'dpcDate' | 'firDate' | 'actDate' | 'auctionDate'
  const [tempDate, setTempDate] = useState(getTodayYmd());

  const title = useMemo(
    () => (disposalId ? 'Disposal (Existing)' : 'Disposal (Afforestation)'),
    [disposalId],
  );

  const getAuthToken = async () => (await AsyncStorage.getItem('AUTH_TOKEN')) || '';

  useEffect(() => {
    if (!Number.isFinite(afforestationId) || afforestationId <= 0) {
      Alert.alert('Error', 'Afforestation ID is missing/invalid.');
    }
  }, [afforestationId]);

  // ---------------- DATE PICKER ----------------
  const openDatePicker = (field, currentValue) => {
    setDateField(field);
    setTempDate(isValidYmd(currentValue) ? currentValue : getTodayYmd());
    setShowDatePicker(true);
  };

  const applySelectedDate = selectedYmd => {
    switch (dateField) {
      case 'drDate':
        setDrDate(selectedYmd);
        break;
      case 'dpcDate':
        setDpcDate(selectedYmd);
        break;
      case 'firDate':
        setFirDate(selectedYmd);
        break;
      case 'actDate':
        setActDate(selectedYmd);
        break;
      case 'auctionDate':
        setAuctionDate(selectedYmd);
        break;
      default:
        break;
    }
    setShowDatePicker(false);
  };

  // ---------------- IMAGE PICKER ----------------
  const openAppSettings = () => {
    Alert.alert(
      'Permission Required',
      'Please allow camera permission from Settings to take photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => { }) },
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
    if (uris.length) setPictureUris(uris); // replace behavior
  };

  const pickFromGallery = () => {
    setImagePickerModal(false);
    launchImageLibrary({ mediaType: 'photo', quality: 0.75, selectionLimit: 0 }, onImagePickerResult);
  };

  const takePhotoFromCamera = async () => {
    setImagePickerModal(false);
    const ok = await requestAndroidCameraPermission();
    if (!ok) {
      openAppSettings();
      return;
    }
    launchCamera(
      { mediaType: 'photo', quality: 0.75, saveToPhotos: true, cameraType: 'back' },
      onImagePickerResult,
    );
  };

  // ---------------- AWS UPLOAD ----------------
  // Manual AWS Upload Removed - handled by ApiService


  // ---------------- VALIDATION ----------------
  const validate = () => {
    if (!Number.isFinite(afforestationId) || afforestationId <= 0) {
      Alert.alert('Missing', 'Afforestation ID is required.');
      return false;
    }
    if (!cleanStr(drNo)) {
      Alert.alert('Missing', 'DR No is required.');
      return false;
    }
    if (!cleanStr(drDate)) {
      Alert.alert('Missing', 'DR Date is required.');
      return false;
    }
    if (!isValidYmd(drDate)) {
      Alert.alert('Invalid Date', 'DR Date must be in YYYY-MM-DD format.');
      return false;
    }

    const dateFields = [
      { label: 'DPC Date', value: dpcDate },
      { label: 'FIR Date', value: firDate },
      { label: 'Act Date', value: actDate },
      { label: 'Auction Date', value: auctionDate },
    ];
    for (const f of dateFields) {
      if (cleanStr(f.value) && !isValidYmd(f.value)) {
        Alert.alert('Invalid Date', `${f.label} must be in YYYY-MM-DD format.`);
        return false;
      }
    }

    if (firEnabled) {
      if (!cleanStr(firNo) && !cleanStr(firDate)) {
        Alert.alert('Missing', 'Please provide FIR No or FIR Date.');
        return false;
      }
    }

    if (auction) {
      if (!cleanStr(auctionDetails) && !cleanStr(auctionAuthorityName) && !cleanStr(auctionDate)) {
        Alert.alert('Missing', 'Please provide Auction Details or Auction Authority Name or Auction Date.');
        return false;
      }
    }

    return true;
  };

  // ---------------- SUBMIT ----------------
  const submitDisposal = async () => {
    if (!validate()) return;

    // Prepare attachments
    const safeFileName = `aff_disp_${afforestationId}_${Date.now()}`;
    const attachments = (pictureUris || []).map((uri, idx) => ({
      uri, type: 'image/jpeg', name: `${safeFileName}_${idx}.jpg`,
      uploadUrl: AWS_UPLOAD_URL,
      uploadPath: AWS_UPLOAD_PATH,
      targetFieldInBody: 'pictures',
      storeBasename: false // Afforestation logic seemed to store URLs, but let's stick to consistent pattern.
      // Wait, original code `uploadedUrls` stored full URLs. 
      // If we want full URLs, ApiService will put them in `pictures` if storeBasename is false/default.
    }));

    // ✅ Same API payload keys (unchanged)
    const body = {
      afforestationId: afforestationId,

      dr_no: cleanStr(drNo),
      dr_date: cleanStr(drDate),

      fc_no: cleanStr(fcNo),
      dpc_no: cleanStr(dpcNo),
      dpc_date: cleanStr(dpcDate),

      // FIR block is optional via toggle
      fir_no: firEnabled ? cleanStr(firNo) : '',
      fir_date: firEnabled ? cleanStr(firDate) : '',

      remarks: cleanStr(remarks),

      peeda_act: !!peedaAct,
      authority_oo: peedaAct ? cleanStr(authorityOo) : '',
      officer_name: peedaAct ? cleanStr(officerName) : '',
      officer_designation: peedaAct ? cleanStr(officerDesignation) : '',
      act_date: peedaAct ? cleanStr(actDate) : '',
      act_remarks: peedaAct ? cleanStr(actRemarks) : '',

      auction: !!auction,
      auction_details: auction ? cleanStr(auctionDetails) : '',
      auction_date: auction ? cleanStr(auctionDate) : '',
      auction_authority_name: auction ? cleanStr(auctionAuthorityName) : '',
      auction_authority_designation: auction ? cleanStr(auctionAuthorityDesignation) : '',
      auction_remarks: auction ? cleanStr(auctionRemarks) : '',

      pictures: [], // Filled by ApiService
    };

    try {
      setSubmitting(true);

      const json = await apiService.post(DISPOSAL_URL, body, { attachments });

      Alert.alert(json.offline ? 'Saved Offline' : 'Success', json.message || 'Disposal saved successfully.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Submit Failed', e?.message || 'Failed to submit Disposal.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------- UI ----------------
  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

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

          {/* Disposal core */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Disposal Reference</Text>

            <FormRow label="DR No" value={drNo} onChangeText={setDrNo} required placeholder="AFF-DR-001" />

            <DateRow
              label="DR Date"
              value={drDate}
              required
              onPress={() => openDatePicker('drDate', drDate)}
            />

            <FormRow label="FC No" value={fcNo} onChangeText={setFcNo} placeholder="FC-123" />
            <FormRow label="DPC No" value={dpcNo} onChangeText={setDpcNo} placeholder="DPC-456" />

            <DateRow
              label="DPC Date"
              value={dpcDate}
              onPress={() => openDatePicker('dpcDate', dpcDate)}
            />
          </View>

          {/* FIR (toggle like your example: click -> open details) */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.sectionToggle}
              onPress={() => setFirEnabled(v => !v)}
              activeOpacity={0.8}>
              <View style={styles.toggleLeft}>
                <Ionicons
                  name={firEnabled ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={COLORS.text}
                />
                <Text style={styles.cardTitle}>FIR (If DPC not implemented)</Text>
              </View>
              <Ionicons
                name={firEnabled ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={COLORS.textLight}
              />
            </TouchableOpacity>

            {firEnabled ? (
              <>
                <FormRow label="FIR No" value={firNo} onChangeText={setFirNo} placeholder="FIR-789" />
                <DateRow
                  label="FIR Date"
                  value={firDate}
                  onPress={() => openDatePicker('firDate', firDate)}
                />
              </>
            ) : (
              <Text style={styles.note}>Turn FIR ON to add FIR details and date.</Text>
            )}

            <FormRow label="Remarks" value={remarks} onChangeText={setRemarks} placeholder="General remarks" />
          </View>

          {/* PEEDA / Act */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Act / Proceedings</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>PEEDA Act</Text>
                <Switch
                  value={peedaAct}
                  onValueChange={setPeedaAct}
                  trackColor={{ false: 'rgba(31,41,55,0.15)', true: 'rgba(5,150,105,0.35)' }}
                  thumbColor={peedaAct ? COLORS.primary : '#f4f4f5'}
                />
              </View>
            </View>

            {peedaAct ? (
              <>
                <FormRow label="Authority OO" value={authorityOo} onChangeText={setAuthorityOo} placeholder="Authority Office Order 1" />
                <FormRow label="Officer Name" value={officerName} onChangeText={setOfficerName} placeholder="Officer A" />
                <FormRow label="Officer Designation" value={officerDesignation} onChangeText={setOfficerDesignation} placeholder="Inspector" />
                <DateRow
                  label="Act Date"
                  value={actDate}
                  onPress={() => openDatePicker('actDate', actDate)}
                />
                <FormRow label="Act Remarks" value={actRemarks} onChangeText={setActRemarks} placeholder="Action taken remarks" />
              </>
            ) : (
              <Text style={styles.note}>Turn PEEDA Act ON to add Act / Proceedings details.</Text>
            )}
          </View>

          {/* Auction */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Auction</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Auction</Text>
                <Switch
                  value={auction}
                  onValueChange={setAuction}
                  trackColor={{ false: 'rgba(31,41,55,0.15)', true: 'rgba(5,150,105,0.35)' }}
                  thumbColor={auction ? COLORS.primary : '#f4f4f5'}
                />
              </View>
            </View>

            {auction ? (
              <>
                <FormRow label="Auction Details" value={auctionDetails} onChangeText={setAuctionDetails} placeholder="Details of the auction" />
                <DateRow
                  label="Auction Date"
                  value={auctionDate}
                  onPress={() => openDatePicker('auctionDate', auctionDate)}
                />
                <FormRow label="Auction Authority Name" value={auctionAuthorityName} onChangeText={setAuctionAuthorityName} placeholder="Authority Name" />
                <FormRow label="Auction Authority Designation" value={auctionAuthorityDesignation} onChangeText={setAuctionAuthorityDesignation} placeholder="Auctioneer" />
                <FormRow label="Auction Remarks" value={auctionRemarks} onChangeText={setAuctionRemarks} placeholder="Remarks regarding auction" />
              </>
            ) : (
              <Text style={styles.note}>Turn Auction ON only when disposal includes auction. Fields will appear automatically.</Text>
            )}
          </View>

          {/* Pictures */}
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
            onPress={submitDisposal}
            disabled={submitting || uploading}
            activeOpacity={0.85}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Save Disposal</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footerHint}>
            Note: This screen uses POST {DISPOSAL_URL}. If you want “Edit existing Disposal”, share the GET and PATCH/PUT cURLs.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal (Calendar) */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.dateModalOverlay}>
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.dateCloseBtn}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Calendar
              current={tempDate}
              onDayPress={d => {
                const ymd = d?.dateString;
                setTempDate(ymd);
                applySelectedDate(ymd);
              }}
              markedDates={{
                [tempDate]: { selected: true, selectedColor: COLORS.primary },
              }}
              theme={{
                backgroundColor: '#ffffff',
                calendarBackground: '#ffffff',
                textSectionTitleColor: COLORS.text,
                selectedDayBackgroundColor: COLORS.primary,
                selectedDayTextColor: '#ffffff',
                todayTextColor: COLORS.primary,
                dayTextColor: COLORS.text,
                textDisabledColor: COLORS.textLight,
                dotColor: COLORS.primary,
                selectedDotColor: '#ffffff',
                arrowColor: COLORS.primary,
                monthTextColor: COLORS.text,
                textDayFontWeight: '500',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '600',
              }}
            />

            <View style={styles.selectedDateContainer}>
              <Text style={styles.selectedDateLabel}>Selected:</Text>
              <Text style={styles.selectedDateValue}>
                {tempDate ? formatDateDisplay(tempDate) : 'No date selected'}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

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
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 10 },

  sectionToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchLabel: { fontSize: 12, fontWeight: '800', color: COLORS.textLight },

  note: { marginTop: 2, color: COLORS.textLight, fontSize: 12, fontWeight: '600', lineHeight: 18 },

  // Date input
  dateLabel: { fontSize: 12, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.03)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateText: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  datePlaceholder: { color: COLORS.textLight, fontSize: 13, fontWeight: '700' },

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

  // Date modal
  dateModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  datePickerContainer: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  datePickerHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerTitle: { fontSize: 16, fontWeight: '900', color: COLORS.text },
  dateCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(31,41,55,0.06)', alignItems: 'center', justifyContent: 'center' },
  selectedDateContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  selectedDateLabel: { fontSize: 13, fontWeight: '800', color: COLORS.textLight, marginRight: 8 },
  selectedDateValue: { fontSize: 14, fontWeight: '900', color: COLORS.primary },

  // Image modal
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
