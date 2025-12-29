// DisposalScreen.js
import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ImageBackground,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {launchImageLibrary} from 'react-native-image-picker';

import colors from '../theme/colors';
import FormRow from '../components/FormRow';
import {DropdownRow} from '../components/SelectRows';

const STORAGE_KEY = 'MATURE_TREE_RECORDS';

export default function DisposalScreen({navigation, route}) {
  const {treeId, enumeration} = route.params || {};

  const [record, setRecord] = useState(null);

  // Basic / Linking
  const [registerNo, setRegisterNo] = useState('');
  const [pageNo, setPageNo] = useState('');

  // Damage Report
  const [drNo, setDrNo] = useState('');
  const [drDate, setDrDate] = useState(''); // YYYY-MM-DD

  // Case / Prosecution
  const [fcNo, setFcNo] = useState(''); // Forest Case No
  const [dpcNo, setDpcNo] = useState(''); // Divisional Prosecution No
  const [dpcDate, setDpcDate] = useState(''); // YYYY-MM-DD

  // FIR (if DPC not implemented)
  const [firChecked, setFirChecked] = useState(false);
  const [firNo, setFirNo] = useState('');
  const [firDate, setFirDate] = useState('');

  // General remarks
  const [remarks, setRemarks] = useState('');

  // PEEDA Act (if no legal action)
  const [peedaChecked, setPeedaChecked] = useState(false);
  const [peedaAct, setPeedaAct] = useState(''); // text
  const [authorityOO, setAuthorityOO] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [officerDesignation, setOfficerDesignation] = useState('');
  const [actDate, setActDate] = useState('');
  const [peedaRemarks, setPeedaRemarks] = useState('');

  // Auction
  const [auctionChecked, setAuctionChecked] = useState(false);
  const [auctionDetails, setAuctionDetails] = useState('');
  const [auctionDate, setAuctionDate] = useState('');
  const [auctionAuthorityName, setAuctionAuthorityName] = useState('');
  const [auctionAuthorityDesignation, setAuctionAuthorityDesignation] = useState('');
  const [auctionRemarks, setAuctionRemarks] = useState('');

  // Pictures (kept per section, backward-compatible)
  const [drImages, setDrImages] = useState([]);
  const [firImages, setFirImages] = useState([]);
  const [peedaImages, setPeedaImages] = useState([]);
  const [auctionImages, setAuctionImages] = useState([]);

  const officerDesignationOptions = ['CCF', 'CF', 'DFO', 'Other'];

  useEffect(() => {
    loadRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRecord = async () => {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    const arr = json ? JSON.parse(json) : [];
    const r = arr.find(x => x.id === treeId);

    if (!r) return;

    setRecord(r);

    // Pre-fill register/page from record if present
    setRegisterNo(r.registerNo || enumeration?.registerNo || '');
    setPageNo(r.pageNo || enumeration?.pageNo || '');

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
    setPeedaRemarks(d.peedaRemarks || '');

    setAuctionChecked(!!d.auctionChecked);
    setAuctionDetails(d.auctionDetails || '');
    setAuctionDate(d.auctionDate || '');
    setAuctionAuthorityName(d.auctionAuthorityName || '');
    setAuctionAuthorityDesignation(d.auctionAuthorityDesignation || '');
    setAuctionRemarks(d.auctionRemarks || '');

    // Pictures (backward compatible)
    setDrImages(Array.isArray(d.drImages) ? d.drImages : []);
    setFirImages(Array.isArray(d.firImages) ? d.firImages : []);
    setPeedaImages(Array.isArray(d.peedaImages) ? d.peedaImages : []);
    setAuctionImages(Array.isArray(d.auctionImages) ? d.auctionImages : []);
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

  const saveDisposal = async () => {
    if (!record?.id) {
      Alert.alert('Error', 'Record not found.');
      return;
    }

    // Keep your existing FIR/PEEDA logic intact (conditional fields stay optional)
    if (firChecked && !firNo.trim()) {
      Alert.alert('Missing', 'FIR No is required (because FIR is selected).');
      return;
    }

    const json = await AsyncStorage.getItem(STORAGE_KEY);
    const arr = json ? JSON.parse(json) : [];

    const updated = arr.map(r => {
      if (r.id !== treeId) return r;
      return {
        ...r,
        registerNo, // keep updated at record-level too
        pageNo,
        disposal: {
          // basic
          registerNo,
          pageNo,

          // DR
          drNo,
          drDate,

          // case/prosecution
          fcNo,
          dpcNo,
          dpcDate,

          // FIR (if DPC not implemented)
          firChecked,
          firNo: firChecked ? firNo : '',
          firDate: firChecked ? firDate : '',

          // general
          remarks,

          // PEEDA
          peedaChecked,
          peedaAct: peedaChecked ? peedaAct : '',
          authorityOO: peedaChecked ? authorityOO : '',
          officerName: peedaChecked ? officerName : '',
          officerDesignation: peedaChecked ? officerDesignation : '',
          actDate: peedaChecked ? actDate : '',
          peedaRemarks: peedaChecked ? peedaRemarks : '',

          // Auction
          auctionChecked,
          auctionDetails: auctionChecked ? auctionDetails : '',
          auctionDate: auctionChecked ? auctionDate : '',
          auctionAuthorityName: auctionChecked ? auctionAuthorityName : '',
          auctionAuthorityDesignation: auctionChecked ? auctionAuthorityDesignation : '',
          auctionRemarks: auctionChecked ? auctionRemarks : '',

          // Pictures
          drImages,
          firImages,
          peedaImages,
          auctionImages,

          savedAt: new Date().toISOString(),
        },
      };
    });

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    Alert.alert('Saved', 'Disposal saved successfully.');
    navigation.goBack();
  };

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
              Enumeration ID: <Text style={styles.metaValue}>{record?.enumerationId || '—'}</Text>
            </Text>
            <Text style={styles.metaLine}>
              Disposal ID (Tree ID): <Text style={styles.metaValue}>{treeId || '—'}</Text>
            </Text>
            <Text style={styles.metaLine}>
              System Tree ID: <Text style={styles.metaValue}>{record?.systemTreeId || '—'}</Text>
            </Text>
          </View>

          {/* Basic Info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Basic</Text>
            <FormRow label="Register No" value={registerNo} onChangeText={setRegisterNo} />
            <FormRow label="Page No" value={pageNo} onChangeText={setPageNo} />
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

            {/* FIR toggle - same logic as your old screen */}
            <TouchableOpacity style={styles.checkRow} onPress={() => setFirChecked(!firChecked)}>
              <Ionicons
                name={firChecked ? 'checkbox' : 'square-outline'}
                size={20}
                color="#111827"
              />
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
                <Ionicons
                  name={peedaChecked ? 'checkbox' : 'square-outline'}
                  size={20}
                  color="#111827"
                />
                <Text style={styles.cardTitle}>PEEDA Act (Incase if no legal action)</Text>
              </View>
              <Ionicons name={peedaChecked ? 'chevron-up' : 'chevron-down'} size={20} color="#6b7280" />
            </TouchableOpacity>

            {peedaChecked && (
              <>
                <FormRow label="PEEDA Act" value={peedaAct} onChangeText={setPeedaAct} placeholder="Enter act / reference" />
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
                <FormRow label="Remarks" value={peedaRemarks} onChangeText={setPeedaRemarks} multiline />

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
                <Ionicons
                  name={auctionChecked ? 'checkbox' : 'square-outline'}
                  size={20}
                  color="#111827"
                />
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
                <FormRow label="Name of Authority" value={auctionAuthorityName} onChangeText={setAuctionAuthorityName} />
                <FormRow
                  label="Designation of Authority"
                  value={auctionAuthorityDesignation}
                  onChangeText={setAuctionAuthorityDesignation}
                />
                <FormRow label="Remarks" value={auctionRemarks} onChangeText={setAuctionRemarks} multiline />

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
          <TouchableOpacity style={styles.saveBtn} onPress={saveDisposal}>
            <Ionicons name="save" size={18} color="#fff" />
            <Text style={styles.saveText}>Save Disposal</Text>
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

  sectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

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
