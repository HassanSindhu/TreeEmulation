import React, {useEffect, useState, useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ImageBackground,
  Image,
  ActivityIndicator,
  StatusBar,
  Platform,
  Modal,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {launchImageLibrary} from 'react-native-image-picker';
import {Calendar} from 'react-native-calendars';

import FormRow from '../components/FormRow';
import {DropdownRow} from '../components/SelectRows';

// Theme Colors
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

const STORAGE_KEY = 'MATURE_TREE_RECORDS';

const API_BASE = 'http://be.lte.gisforestry.com';
const DISPOSAL_POST_URL = `${API_BASE}/enum/disposal`;

export default function DisposalScreen({navigation, route}) {
  const {treeId, enumeration} = route.params || {};

  const [record, setRecord] = useState(null);
  const [saving, setSaving] = useState(false);

  // Damage Report
  const [drNo, setDrNo] = useState('');
  const [drDate, setDrDate] = useState('');

  // Case / Prosecution
  const [fcNo, setFcNo] = useState('');
  const [dpcNo, setDpcNo] = useState('');
  const [dpcDate, setDpcDate] = useState('');

  // FIR
  const [firChecked, setFirChecked] = useState(false);
  const [firNo, setFirNo] = useState('');
  const [firDate, setFirDate] = useState('');

  // General remarks
  const [remarks, setRemarks] = useState('');

  // PEEDA Act
  const [peedaChecked, setPeedaChecked] = useState(false);
  const [peedaAct, setPeedaAct] = useState('');
  const [authorityOO, setAuthorityOO] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [officerDesignation, setOfficerDesignation] = useState('');
  const [actDate, setActDate] = useState('');
  const [actRemarks, setActRemarks] = useState('');

  // Auction
  const [auctionChecked, setAuctionChecked] = useState(false);
  const [auctionDetails, setAuctionDetails] = useState('');
  const [auctionDate, setAuctionDate] = useState('');
  const [auctionAuthorityName, setAuctionAuthorityName] = useState('');
  const [auctionAuthorityDesignation, setAuctionAuthorityDesignation] = useState('');
  const [auctionRemarks, setAuctionRemarks] = useState('');

  // Pictures (kept per section)
  const [drImages, setDrImages] = useState([]);
  const [firImages, setFirImages] = useState([]);
  const [peedaImages, setPeedaImages] = useState([]);
  const [auctionImages, setAuctionImages] = useState([]);

  // Date Picker State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentDateField, setCurrentDateField] = useState('');
  const [tempDate, setTempDate] = useState('');

  const officerDesignationOptions = ['CCF', 'CF', 'DFO', 'Other'];

  useEffect(() => {
    loadRecord();
  }, []);

  const getAuthToken = async () => {
    const t = await AsyncStorage.getItem('AUTH_TOKEN');
    return t || '';
  };

  const loadRecord = async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const arr = json ? JSON.parse(json) : [];
      const r = arr.find(x => String(x.id) === String(treeId));
      if (!r) return;

      setRecord(r);

      const d = r.disposal || {};

      setDrNo(d.drNo || '');
      setDrDate(d.drDate || '');

      setFcNo(d.fcNo || '');
      setDpcNo(d.dpcNo || '');
      setDpcDate(d.dpcDate || '');

      setFirChecked(!!d.firChecked);
      setFirNo(d.firNo || '');
      setFirDate(d.firDate || '');

      setRemarks(d.remarks || '');

      setPeedaChecked(!!d.peedaChecked);
      setPeedaAct(d.peedaAct || '');
      setAuthorityOO(d.authorityOO || '');
      setOfficerName(d.officerName || '');
      setOfficerDesignation(d.officerDesignation || '');
      setActDate(d.actDate || '');
      setActRemarks(d.actRemarks || '');

      setAuctionChecked(!!d.auctionChecked);
      setAuctionDetails(d.auctionDetails || '');
      setAuctionDate(d.auctionDate || '');
      setAuctionAuthorityName(d.auctionAuthorityName || '');
      setAuctionAuthorityDesignation(d.auctionAuthorityDesignation || '');
      setAuctionRemarks(d.auctionRemarks || '');

      setDrImages(Array.isArray(d.drImages) ? d.drImages : []);
      setFirImages(Array.isArray(d.firImages) ? d.firImages : []);
      setPeedaImages(Array.isArray(d.peedaImages) ? d.peedaImages : []);
      setAuctionImages(Array.isArray(d.auctionImages) ? d.auctionImages : []);
    } catch (e) {
      // ignore
    }
  };

  const pickImages = setter => {
    launchImageLibrary({mediaType: 'photo', selectionLimit: 0, quality: 0.7}, res => {
      if (!res.assets?.length) return;
      const uris = res.assets.map(a => a.uri).filter(Boolean);
      if (!uris.length) return;
      setter(prev => [...prev, ...uris]);
    });
  };

  const removeImage = (setter, uri) => {
    setter(prev => (Array.isArray(prev) ? prev.filter(x => x !== uri) : []));
  };

  // Date Picker Functions
  const openDatePicker = (field, currentValue) => {
    setCurrentDateField(field);
    setTempDate(currentValue || getTodayDate());
    setShowDatePicker(true);
  };

  const handleDateSelect = (date) => {
    const selectedDate = date.dateString;
    setTempDate(selectedDate);

    // Update the corresponding state
    switch (currentDateField) {
      case 'drDate':
        setDrDate(selectedDate);
        break;
      case 'dpcDate':
        setDpcDate(selectedDate);
        break;
      case 'firDate':
        setFirDate(selectedDate);
        break;
      case 'actDate':
        setActDate(selectedDate);
        break;
      case 'auctionDate':
        setAuctionDate(selectedDate);
        break;
    }

    setShowDatePicker(false);
  };

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  };

  // ---- Date helpers ----
  const toIsoDateOrNull = (val) => {
    const s = String(val || '').trim();
    if (!s) return null;

    // If already ISO-ish, keep as Date parsing
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString();

    // If user types YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d2 = new Date(`${s}T00:00:00.000Z`);
      if (!Number.isNaN(d2.getTime())) return d2.toISOString();
    }
    return null;
  };

  // ---- pictures mapping (TEST placeholders) ----
  const buildPicturesPayload = () => {
    const count =
      (drImages?.length || 0) +
      (firImages?.length || 0) +
      (peedaImages?.length || 0) +
      (auctionImages?.length || 0);

    const n = Math.max(1, Math.min(count || 2, 10));
    return Array.from({length: n}).map((_, i) => `https://example.com/pic${i + 1}.jpg`);
  };

  const enumerationIdResolved = useMemo(() => {
    return (
      (enumeration?.id != null ? Number(enumeration.id) : null) ??
      (record?.enumerationId != null ? Number(record.enumerationId) : null)
    );
  }, [enumeration?.id, record?.enumerationId]);

  const submitToApi = async (body) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

    const res = await fetch(DISPOSAL_POST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.message || json?.error || `API Error (${res.status})`;
      throw new Error(msg);
    }
    return json;
  };

  const saveDisposal = async () => {
    if (!treeId) return Alert.alert('Error', 'treeId missing.');
    if (!enumerationIdResolved) return Alert.alert('Error', 'enumerationId missing.');

    // Validate FIR requirement
    if (firChecked && !firNo.trim()) {
      return Alert.alert('Missing', 'FIR No is required (because FIR is selected).');
    }

    // Build payload exactly per your curl
    const apiBody = {
      enumerationId: Number(enumerationIdResolved),

      dr_no: drNo?.trim() || '',
      dr_date: toIsoDateOrNull(drDate),

      fc_no: fcNo?.trim() || '',
      dpc_no: dpcNo?.trim() || '',
      dpc_date: toIsoDateOrNull(dpcDate),

      fir_no: firChecked ? (firNo?.trim() || '') : '',
      fir_date: firChecked ? toIsoDateOrNull(firDate) : null,

      remarks: remarks?.trim() || '',

      peeda_act: !!peedaChecked,
      authority_oo: peedaChecked ? (authorityOO?.trim() || '') : '',
      officer_name: peedaChecked ? (officerName?.trim() || '') : '',
      officer_designation: peedaChecked ? (officerDesignation?.trim() || '') : '',
      act_date: peedaChecked ? toIsoDateOrNull(actDate) : null,
      act_remarks: peedaChecked ? (actRemarks?.trim() || '') : '',

      auction: !!auctionChecked,
      auction_details: auctionChecked ? (auctionDetails?.trim() || '') : '',
      auction_date: auctionChecked ? toIsoDateOrNull(auctionDate) : null,
      auction_authority_name: auctionChecked ? (auctionAuthorityName?.trim() || '') : null,
      auction_authority_designation: auctionChecked ? (auctionAuthorityDesignation?.trim() || '') : null,
      auction_remarks: auctionChecked ? (auctionRemarks?.trim() || '') : null,

      pictures: buildPicturesPayload(),
    };

    try {
      setSaving(true);

      // 1) POST to API
      await submitToApi(apiBody);

      // 2) Save locally for your UI status
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const arr = json ? JSON.parse(json) : [];

      const updated = arr.map(r => {
        if (String(r.id) !== String(treeId)) return r;
        return {
          ...r,
          disposal: {
            // UI fields (keep yours)
            drNo,
            drDate,
            fcNo,
            dpcNo,
            dpcDate,
            firChecked,
            firNo: firChecked ? firNo : '',
            firDate: firChecked ? firDate : '',
            remarks,

            peedaChecked,
            peedaAct: peedaChecked ? peedaAct : '',
            authorityOO: peedaChecked ? authorityOO : '',
            officerName: peedaChecked ? officerName : '',
            officerDesignation: peedaChecked ? officerDesignation : '',
            actDate: peedaChecked ? actDate : '',
            actRemarks: peedaChecked ? actRemarks : '',

            auctionChecked,
            auctionDetails: auctionChecked ? auctionDetails : '',
            auctionDate: auctionChecked ? auctionDate : '',
            auctionAuthorityName: auctionChecked ? auctionAuthorityName : '',
            auctionAuthorityDesignation: auctionChecked ? auctionAuthorityDesignation : '',
            auctionRemarks: auctionChecked ? auctionRemarks : '',

            drImages,
            firImages,
            peedaImages,
            auctionImages,

            savedAt: new Date().toISOString(),
          },
        };
      });

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      Alert.alert('Success', 'Disposal saved to server.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to save disposal.');
    } finally {
      setSaving(false);
    }
  };

  // Date Input Component
  const DateInput = ({ label, value, onPress, placeholder = "Select date" }) => (
    <View style={styles.dateInputContainer}>
      <Text style={styles.dateLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dateInput}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={value ? styles.dateInputText : styles.dateInputPlaceholder}>
          {value ? formatDateDisplay(value) : placeholder}
        </Text>
        <Ionicons name="calendar" size={20} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );

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
            <Text style={styles.headerTitle}>Disposal Record</Text>
            <View style={styles.headerInfo}>
              <View style={styles.infoChip}>
                <Ionicons name="business" size={12} color="#fff" />
                <Text style={styles.infoChipText}>{enumeration?.division || '—'}</Text>
              </View>
              <View style={styles.infoChip}>
                <Ionicons name="cube" size={12} color="#fff" />
                <Text style={styles.infoChipText}>{enumeration?.block || '—'}</Text>
              </View>
              <View style={styles.infoChip}>
                <Ionicons name="calendar" size={12} color="#fff" />
                <Text style={styles.infoChipText}>{enumeration?.year || '—'}</Text>
              </View>
            </View>
            <Text style={styles.siteId}>Tree ID: {String(treeId ?? '—')}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>

        {/* Linking Card */}
        <View style={styles.linkingCard}>
          <View style={styles.linkingCardHeader}>
            <Ionicons name="link" size={20} color={COLORS.primary} />
            <Text style={styles.linkingCardTitle}>Record Information</Text>
          </View>
          <View style={styles.linkingInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Enumeration ID:</Text>
              <Text style={styles.infoValue}>{String(enumerationIdResolved ?? '—')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tree ID:</Text>
              <Text style={styles.infoValue}>{String(treeId ?? '—')}</Text>
            </View>
            {enumeration?.name_of_site_id && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Site ID:</Text>
                <Text style={styles.infoValue}>{enumeration.name_of_site_id}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Damage Report */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Damage Report</Text>
          <FormRow label="DR No (Damage Report)" value={drNo} onChangeText={setDrNo} />

          <DateInput
            label="DR Date"
            value={drDate}
            onPress={() => openDatePicker('drDate', drDate)}
            placeholder="Select DR Date"
          />

          <View style={styles.picRow}>
            <TouchableOpacity
              style={styles.picBtn}
              onPress={() => pickImages(setDrImages)}
              activeOpacity={0.7}>
              <Ionicons name="image" size={18} color="#fff" />
              <Text style={styles.picBtnText}>Add DR Pictures</Text>
            </TouchableOpacity>
          </View>

          {drImages.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesContainer}>
              {drImages.map(uri => (
                <View key={uri} style={styles.thumbWrap}>
                  <Image source={{uri}} style={styles.thumb} />
                  <TouchableOpacity
                    style={styles.thumbClose}
                    onPress={() => removeImage(setDrImages, uri)}
                    activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Case / Prosecution */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Case / Prosecution</Text>
          <FormRow label="FC No (Forest Case No)" value={fcNo} onChangeText={setFcNo} />
          <FormRow label="DPC No (Divisional Prosecution No)" value={dpcNo} onChangeText={setDpcNo} />

          <DateInput
            label="DPC Date"
            value={dpcDate}
            onPress={() => openDatePicker('dpcDate', dpcDate)}
            placeholder="Select DPC Date"
          />

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setFirChecked(!firChecked)}
            activeOpacity={0.7}>
            <Ionicons name={firChecked ? 'checkbox' : 'square-outline'} size={20} color={COLORS.text} />
            <Text style={styles.checkText}>FIR (Incase if DPC not implemented)</Text>
          </TouchableOpacity>

          {firChecked && (
            <>
              <FormRow label="FIR No" value={firNo} onChangeText={setFirNo} required={firChecked} />

              <DateInput
                label="FIR Date"
                value={firDate}
                onPress={() => openDatePicker('firDate', firDate)}
                placeholder="Select FIR Date"
              />

              <View style={styles.picRow}>
                <TouchableOpacity
                  style={styles.picBtn}
                  onPress={() => pickImages(setFirImages)}
                  activeOpacity={0.7}>
                  <Ionicons name="image" size={18} color="#fff" />
                  <Text style={styles.picBtnText}>Add FIR Pictures</Text>
                </TouchableOpacity>
              </View>

              {firImages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesContainer}>
                  {firImages.map(uri => (
                    <View key={uri} style={styles.thumbWrap}>
                      <Image source={{uri}} style={styles.thumb} />
                      <TouchableOpacity
                        style={styles.thumbClose}
                        onPress={() => removeImage(setFirImages, uri)}
                        activeOpacity={0.7}>
                        <Ionicons name="close-circle" size={18} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </>
          )}

          <FormRow
            label="Remarks"
            value={remarks}
            onChangeText={setRemarks}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* PEEDA */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.sectionToggle}
            onPress={() => setPeedaChecked(!peedaChecked)}
            activeOpacity={0.7}>
            <View style={styles.toggleContent}>
              <Ionicons name={peedaChecked ? 'checkbox' : 'square-outline'} size={20} color={COLORS.text} />
              <Text style={styles.cardTitle}>PEEDA Act (Incase if no legal action)</Text>
            </View>
            <Ionicons
              name={peedaChecked ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={COLORS.textLight}
            />
          </TouchableOpacity>

          {peedaChecked && (
            <>
              <FormRow
                label="PEEDA Act"
                value={peedaAct}
                onChangeText={setPeedaAct}
                placeholder="Enter act / reference"
              />
              <FormRow
                label="Authority O/O (if PEEDA Act enforced)"
                value={authorityOO}
                onChangeText={setAuthorityOO}
              />
              <FormRow label="Officer Name" value={officerName} onChangeText={setOfficerName} />
              <DropdownRow
                label="Officer Designation (CCF, CF or DFO)"
                value={officerDesignation}
                onChange={setOfficerDesignation}
                options={officerDesignationOptions}
              />

              <DateInput
                label="Act Date"
                value={actDate}
                onPress={() => openDatePicker('actDate', actDate)}
                placeholder="Select Act Date"
              />

              <FormRow
                label="Act Remarks"
                value={actRemarks}
                onChangeText={setActRemarks}
                multiline
                numberOfLines={3}
              />

              <View style={styles.picRow}>
                <TouchableOpacity
                  style={styles.picBtn}
                  onPress={() => pickImages(setPeedaImages)}
                  activeOpacity={0.7}>
                  <Ionicons name="image" size={18} color="#fff" />
                  <Text style={styles.picBtnText}>Add PEEDA Pictures</Text>
                </TouchableOpacity>
              </View>

              {peedaImages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesContainer}>
                  {peedaImages.map(uri => (
                    <View key={uri} style={styles.thumbWrap}>
                      <Image source={{uri}} style={styles.thumb} />
                      <TouchableOpacity
                        style={styles.thumbClose}
                        onPress={() => removeImage(setPeedaImages, uri)}
                        activeOpacity={0.7}>
                        <Ionicons name="close-circle" size={18} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </>
          )}
        </View>

        {/* Auction */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.sectionToggle}
            onPress={() => setAuctionChecked(!auctionChecked)}
            activeOpacity={0.7}>
            <View style={styles.toggleContent}>
              <Ionicons name={auctionChecked ? 'checkbox' : 'square-outline'} size={20} color={COLORS.text} />
              <Text style={styles.cardTitle}>Auction</Text>
            </View>
            <Ionicons
              name={auctionChecked ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={COLORS.textLight}
            />
          </TouchableOpacity>

          {auctionChecked && (
            <>
              <FormRow
                label="Auction Details"
                value={auctionDetails}
                onChangeText={setAuctionDetails}
                multiline
                numberOfLines={3}
              />

              <DateInput
                label="Auction Date"
                value={auctionDate}
                onPress={() => openDatePicker('auctionDate', auctionDate)}
                placeholder="Select Auction Date"
              />

              <FormRow
                label="Name of Authority"
                value={auctionAuthorityName}
                onChangeText={setAuctionAuthorityName}
              />
              <FormRow
                label="Designation of Authority"
                value={auctionAuthorityDesignation}
                onChangeText={setAuctionAuthorityDesignation}
              />
              <FormRow
                label="Auction Remarks"
                value={auctionRemarks}
                onChangeText={setAuctionRemarks}
                multiline
                numberOfLines={3}
              />

              <View style={styles.picRow}>
                <TouchableOpacity
                  style={styles.picBtn}
                  onPress={() => pickImages(setAuctionImages)}
                  activeOpacity={0.7}>
                  <Ionicons name="image" size={18} color="#fff" />
                  <Text style={styles.picBtnText}>Add Auction Pictures</Text>
                </TouchableOpacity>
              </View>

              {auctionImages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesContainer}>
                  {auctionImages.map(uri => (
                    <View key={uri} style={styles.thumbWrap}>
                      <Image source={{uri}} style={styles.thumb} />
                      <TouchableOpacity
                        style={styles.thumbClose}
                        onPress={() => removeImage(setAuctionImages, uri)}
                        activeOpacity={0.7}>
                        <Ionicons name="close-circle" size={18} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, {opacity: saving ? 0.7 : 1}]}
          disabled={saving}
          onPress={saveDisposal}
          activeOpacity={0.7}>
          {saving ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.saveText}>Saving…</Text>
            </>
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.saveText}>Save Disposal Record</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerContainer}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>Select Date</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Calendar
              current={tempDate}
              onDayPress={handleDateSelect}
              markedDates={{
                [tempDate]: {
                  selected: true,
                  selectedColor: COLORS.primary,
                }
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
              <Text style={styles.selectedDateValue}>{tempDate ? formatDateDisplay(tempDate) : 'No date selected'}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Base
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  headerInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  infoChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  siteId: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
  },

  // Linking Card
  linkingCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  linkingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
  },
  linkingCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  linkingInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(31, 41, 55, 0.05)',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Cards
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    letterSpacing: 0.5,
  },

  // Date Input
  dateInputContainer: {
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateInputText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  dateInputPlaceholder: {
    fontSize: 14,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },

  // Checkbox Rows
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(31, 41, 55, 0.03)',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  checkText: {
    marginLeft: 10,
    fontWeight: '700',
    color: COLORS.text,
    fontSize: 14,
  },

  // Section Toggles
  sectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  // Image Upload
  picRow: {
    marginTop: 12,
    marginBottom: 8,
  },
  picBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  picBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  imagesContainer: {
    marginTop: 12,
    paddingBottom: 4,
  },
  thumbWrap: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 2,
  },

  // Save Button
  saveBtn: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  // Date Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  selectedDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 8,
  },
  selectedDateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: 8,
  },
  selectedDateValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
});