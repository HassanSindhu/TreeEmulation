
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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {launchImageLibrary} from 'react-native-image-picker';

import colors from '../theme/colors';
import FormRow from '../components/FormRow';
import {DropdownRow} from '../components/SelectRows';

const STORAGE_KEY = 'MATURE_TREE_RECORDS';

const API_BASE = 'http://be.lte.gisforestry.com';
const DISPOSAL_POST_URL = `${API_BASE}/enum/disposal`;

export default function DisposalScreen({navigation, route}) {
  const {treeId, enumeration} = route.params || {};

  const [record, setRecord] = useState(null);
  const [saving, setSaving] = useState(false);

  // Damage Report
  const [drNo, setDrNo] = useState('');
  const [drDate, setDrDate] = useState(''); // YYYY-MM-DD or ISO

  // Case / Prosecution
  const [fcNo, setFcNo] = useState('');
  const [dpcNo, setDpcNo] = useState('');
  const [dpcDate, setDpcDate] = useState(''); // YYYY-MM-DD or ISO

  // FIR
  const [firChecked, setFirChecked] = useState(false);
  const [firNo, setFirNo] = useState('');
  const [firDate, setFirDate] = useState('');

  // General remarks
  const [remarks, setRemarks] = useState('');

  // PEEDA Act
  const [peedaChecked, setPeedaChecked] = useState(false);
  const [peedaAct, setPeedaAct] = useState(''); // text / reference
  const [authorityOO, setAuthorityOO] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [officerDesignation, setOfficerDesignation] = useState('');
  const [actDate, setActDate] = useState('');
  const [actRemarks, setActRemarks] = useState(''); // action taken remarks

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

  const officerDesignationOptions = ['CCF', 'CF', 'DFO', 'Other'];

  useEffect(() => {
    loadRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Backend expects: pictures: ["https://example.com/pic1.jpg", ...]
  // You asked: allow multi images in UI, but for now send example links.
  const buildPicturesPayload = () => {
    const count =
      (drImages?.length || 0) +
      (firImages?.length || 0) +
      (peedaImages?.length || 0) +
      (auctionImages?.length || 0);

    const n = Math.max(1, Math.min(count || 2, 10)); // at least 1; cap 10 for safety
    return Array.from({length: n}).map((_, i) => `https://example.com/pic${i + 1}.jpg`);
  };

  const enumerationIdResolved = useMemo(() => {
    // IMPORTANT: your API requires enumerationId (number)
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

    // Optional: Keep local AsyncStorage save for UI state
    // and also POST to API.
    try {
      setSaving(true);

      // 1) POST to API
      await submitToApi(apiBody);

      // 2) Save locally for your UI status (optional but keeps your existing workflow)
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
            auctionRemarks: auctionChecked ? auctionAuctionRemarksOrEmpty(auctionChecked, auctionRemarks) : '',

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

  function auctionAuctionRemarksOrEmpty(checked, val) {
    return checked ? (val || '') : '';
  }

  const subtitle =
    enumeration?.division || enumeration?.block || enumeration?.year
      ? `${enumeration?.division || '—'} • ${enumeration?.block || '—'} • ${enumeration?.year || '—'}`
      : record?.enumerationId
      ? `Enumeration: ${record.enumerationId}`
      : '';

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={require('../assets/images/bg.jpg')}
        style={styles.background}
        resizeMode="cover">
        <View style={styles.overlay} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{flex: 1}}>
            <Text style={styles.headerTitle}>Disposal</Text>
            {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
          </View>
        </View>

        <ScrollView contentContainerStyle={{paddingBottom: 30}}>
          {/* Linking Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Linking</Text>
            <Text style={styles.metaLine}>
              Enumeration ID:{' '}
              <Text style={styles.metaValue}>{String(enumerationIdResolved ?? '—')}</Text>
            </Text>
            <Text style={styles.metaLine}>
              Disposal (Tree) ID:{' '}
              <Text style={styles.metaValue}>{String(treeId ?? '—')}</Text>
            </Text>
          </View>

          {/* Damage Report */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Damage Report</Text>
            <FormRow label="DR No (Damage Report)" value={drNo} onChangeText={setDrNo} />
            <FormRow
              label="DR Date (YYYY-MM-DD)"
              value={drDate}
              onChangeText={setDrDate}
              placeholder="2025-12-31"
            />

            <View style={styles.picRow}>
              <TouchableOpacity style={styles.picBtn} onPress={() => pickImages(setDrImages)}>
                <Ionicons name="image" size={18} color="#fff" />
                <Text style={styles.picBtnText}>Add DR Pictures</Text>
              </TouchableOpacity>
            </View>

            {drImages.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 10}}>
                {drImages.map(uri => (
                  <View key={uri} style={styles.thumbWrap}>
                    <Image source={{uri}} style={styles.thumb} />
                    <TouchableOpacity
                      style={styles.thumbClose}
                      onPress={() => removeImage(setDrImages, uri)}>
                      <Ionicons name="close-circle" size={18} color="#ef4444" />
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
            <FormRow
              label="DPC Date (YYYY-MM-DD)"
              value={dpcDate}
              onChangeText={setDpcDate}
              placeholder="2025-12-31"
            />

            <TouchableOpacity style={styles.checkRow} onPress={() => setFirChecked(!firChecked)}>
              <Ionicons name={firChecked ? 'checkbox' : 'square-outline'} size={20} color="#111827" />
              <Text style={styles.checkText}>FIR (Incase if DPC not implemented)</Text>
            </TouchableOpacity>

            {firChecked && (
              <>
                <FormRow label="FIR No" value={firNo} onChangeText={setFirNo} />
                <FormRow
                  label="FIR Date (YYYY-MM-DD)"
                  value={firDate}
                  onChangeText={setFirDate}
                  placeholder="2025-12-31"
                />

                <View style={styles.picRow}>
                  <TouchableOpacity style={styles.picBtn} onPress={() => pickImages(setFirImages)}>
                    <Ionicons name="image" size={18} color="#fff" />
                    <Text style={styles.picBtnText}>Add FIR Pictures</Text>
                  </TouchableOpacity>
                </View>

                {firImages.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 10}}>
                    {firImages.map(uri => (
                      <View key={uri} style={styles.thumbWrap}>
                        <Image source={{uri}} style={styles.thumb} />
                        <TouchableOpacity
                          style={styles.thumbClose}
                          onPress={() => removeImage(setFirImages, uri)}>
                          <Ionicons name="close-circle" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            <FormRow label="Remarks" value={remarks} onChangeText={setRemarks} multiline />
          </View>

          {/* PEEDA */}
          <View style={styles.card}>
            <TouchableOpacity style={styles.sectionToggle} onPress={() => setPeedaChecked(!peedaChecked)}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <Ionicons name={peedaChecked ? 'checkbox' : 'square-outline'} size={20} color="#111827" />
                <Text style={styles.cardTitle}>PEEDA Act (Incase if no legal action)</Text>
              </View>
              <Ionicons name={peedaChecked ? 'chevron-up' : 'chevron-down'} size={20} color="#6b7280" />
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
                <FormRow
                  label="Act Date (YYYY-MM-DD)"
                  value={actDate}
                  onChangeText={setActDate}
                  placeholder="2025-12-31"
                />
                <FormRow
                  label="Act Remarks"
                  value={actRemarks}
                  onChangeText={setActRemarks}
                  multiline
                />

                <View style={styles.picRow}>
                  <TouchableOpacity style={styles.picBtn} onPress={() => pickImages(setPeedaImages)}>
                    <Ionicons name="image" size={18} color="#fff" />
                    <Text style={styles.picBtnText}>Add PEEDA Pictures</Text>
                  </TouchableOpacity>
                </View>

                {peedaImages.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 10}}>
                    {peedaImages.map(uri => (
                      <View key={uri} style={styles.thumbWrap}>
                        <Image source={{uri}} style={styles.thumb} />
                        <TouchableOpacity
                          style={styles.thumbClose}
                          onPress={() => removeImage(setPeedaImages, uri)}>
                          <Ionicons name="close-circle" size={18} color="#ef4444" />
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
            <TouchableOpacity style={styles.sectionToggle} onPress={() => setAuctionChecked(!auctionChecked)}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <Ionicons name={auctionChecked ? 'checkbox' : 'square-outline'} size={20} color="#111827" />
                <Text style={styles.cardTitle}>Auction</Text>
              </View>
              <Ionicons name={auctionChecked ? 'chevron-up' : 'chevron-down'} size={20} color="#6b7280" />
            </TouchableOpacity>

            {auctionChecked && (
              <>
                <FormRow label="Auction Details" value={auctionDetails} onChangeText={setAuctionDetails} multiline />
                <FormRow
                  label="Auction Date (YYYY-MM-DD)"
                  value={auctionDate}
                  onChangeText={setAuctionDate}
                  placeholder="2025-12-31"
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
                />

                <View style={styles.picRow}>
                  <TouchableOpacity style={styles.picBtn} onPress={() => pickImages(setAuctionImages)}>
                    <Ionicons name="image" size={18} color="#fff" />
                    <Text style={styles.picBtnText}>Add Auction Pictures</Text>
                  </TouchableOpacity>
                </View>

                {auctionImages.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 10}}>
                    {auctionImages.map(uri => (
                      <View key={uri} style={styles.thumbWrap}>
                        <Image source={{uri}} style={styles.thumb} />
                        <TouchableOpacity
                          style={styles.thumbClose}
                          onPress={() => removeImage(setAuctionImages, uri)}>
                          <Ionicons name="close-circle" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            )}
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, {opacity: saving ? 0.7 : 1}]}
            disabled={saving}
            onPress={saveDisposal}>
            {saving ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.saveText}>Saving…</Text>
              </>
            ) : (
              <>
                <Ionicons name="save" size={18} color="#fff" />
                <Text style={styles.saveText}>Save Disposal</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  background: {flex: 1},
  overlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16, 185, 129, 0.10)'},

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    gap: 12,
  },
  backButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginTop: 2,
  },
  headerTitle: {fontSize: 22, fontWeight: '800', color: '#fff'},
  headerSubtitle: {fontSize: 13, color: 'rgba(255,255,255,0.92)', marginTop: 2},

  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 3,
  },
  cardTitle: {fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 8},

  metaLine: {fontSize: 12, color: '#6b7280', marginTop: 2, fontWeight: '700'},
  metaValue: {color: '#111827', fontWeight: '900'},

  checkRow: {flexDirection: 'row', alignItems: 'center', marginTop: 10},
  checkText: {marginLeft: 8, fontWeight: '800', color: '#111827'},

  sectionToggle: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},

  saveBtn: {
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  saveText: {color: '#fff', fontWeight: '900'},

  picRow: {marginTop: 10},
  picBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.primary,
    gap: 8,
  },
  picBtnText: {color: '#fff', fontWeight: '800', fontSize: 12},

  thumbWrap: {
    width: 74,
    height: 74,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  thumb: {width: '100%', height: '100%'},
  thumbClose: {position: 'absolute', top: 2, right: 2},
});
