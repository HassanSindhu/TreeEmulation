import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import {launchImageLibrary} from 'react-native-image-picker';
import {useFocusEffect} from '@react-navigation/native';

import colors from '../theme/colors';
import FormRow from '../components/FormRow';
import {DropdownRow} from '../components/SelectRows';

const STORAGE_KEY = 'MATURE_TREE_RECORDS';

export default function MatureTreeRecordsScreen({navigation, route}) {
  const enumeration = route?.params?.enumeration;

  const [records, setRecords] = useState([]);

  // main add/edit modal
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // mature form states
  const [registerNo, setRegisterNo] = useState('');
  const [pageNo, setPageNo] = useState('');
  const [systemTreeId, setSystemTreeId] = useState('');
  const [rdKm, setRdKm] = useState('');
  const [treeNo, setTreeNo] = useState('');
  const [species, setSpecies] = useState('');
  const [girthInches, setGirthInches] = useState('');
  const [condition, setCondition] = useState('');
  const [gps, setGps] = useState('');
  const [remarks, setRemarks] = useState('');
  const [pictureUri, setPictureUri] = useState(null);

  // NEW: Auction dropdown in Mature Tree form
  const [auctionYN, setAuctionYN] = useState('No'); // Yes | No

  // disposal modal
  const [disposalVisible, setDisposalVisible] = useState(false);
  const [disposalForId, setDisposalForId] = useState(null);

  // disposal states
  const [dRegisterNo, setDRegisterNo] = useState('');
  const [dPageNo, setDPageNo] = useState('');
  const [drNo, setDrNo] = useState('');
  const [drDate, setDrDate] = useState('');
  const [fcNo, setFcNo] = useState('');
  const [dpcNo, setDpcNo] = useState('');
  const [dpcDate, setDpcDate] = useState('');
  const [firChecked, setFirChecked] = useState(false);
  const [firNo, setFirNo] = useState('');
  const [firDate, setFirDate] = useState('');
  const [remarks1, setRemarks1] = useState('');

  const [peedaChecked, setPeedaChecked] = useState(false);
  const [authorityOO, setAuthorityOO] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [officerDesignation, setOfficerDesignation] = useState('');
  const [actDate, setActDate] = useState('');
  const [remarks2, setRemarks2] = useState('');

  const [auction, setAuction] = useState('');
  const [auctionDetails, setAuctionDetails] = useState('');
  const [auctionDate, setAuctionDate] = useState('');
  const [auctionAuthorityName, setAuctionAuthorityName] = useState('');
  const [auctionAuthorityDesignation, setAuctionAuthorityDesignation] = useState('');
  const [remarks3, setRemarks3] = useState('');

  // images (disposal)
  const [drImages, setDrImages] = useState([]);
  const [firImages, setFirImages] = useState([]);
  const [peedaImages, setPeedaImages] = useState([]);

  // =========================
  // NEW: Superdari Modal + Form
  // =========================
  const [superdariVisible, setSuperdariVisible] = useState(false);
  const [superdariForId, setSuperdariForId] = useState(null);

  const [sRegisterNo, setSRegisterNo] = useState('');
  const [sPageNo, setSPageNo] = useState('');
  const [superdarName, setSuperdarName] = useState('');
  const [superdarContact, setSuperdarContact] = useState('');
  const [superdarCnic, setSuperdarCnic] = useState('');
  const [superdarTreeCondition, setSuperdarTreeCondition] = useState('');
  const [superdarGps, setSuperdarGps] = useState('');
  const [superdarRemarks, setSuperdarRemarks] = useState('');
  const [superdarPictures, setSuperdarPictures] = useState([]);

  const speciesOptions = ['Shisham', 'Kikar', 'Sufaida', 'Siris', 'Neem', 'Other'];
  const conditionOptions = [
    'Green Standing',
    'Green Fallen',
    'Dry',
    'Leaning',
    'Dead',
    'Fallen',
    'Rotten',
    'Fire Burnt',
  ];

  const superdariConditionOptions = [
    'Green Standing',
    'Green Fallen',
    'Dry',
    'Leaning',
    'Dead',
    'Hollow',
    'Fallen',
    'Rotten',
    'Fire Burnt',
    'Forked',
    '1/4',
    '1/2',
  ];

  const auctionOptions = ['No', 'Yes'];

  const disposalEligibleSet = useMemo(
    () =>
      new Set([
        'Green Fallen',
        'Dry',
        'Leaning',
        'Dead',
        'Fallen',
        'Rotten',
        'Fire Burnt',
      ]),
    [],
  );

  const rdRangeText =
    enumeration?.rdFrom && enumeration?.rdTo
      ? `${enumeration.rdFrom} - ${enumeration.rdTo}`
      : enumeration?.rdFrom || enumeration?.rdTo || '';

  const loadRecords = async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const all = json ? JSON.parse(json) : [];
      setRecords(all.filter(r => r.enumerationId === enumeration?.id));
    } catch (e) {
      console.warn('Failed to load records', e);
      setRecords([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [enumeration?.id]),
  );

  // ---------- image helpers ----------
  const pickSingleImage = setter => {
    launchImageLibrary({mediaType: 'photo', quality: 0.7}, res => {
      if (res.didCancel) return;
      if (res.errorCode) {
        Alert.alert('Image Error', res.errorMessage || 'Could not pick image');
        return;
      }
      const asset = res.assets?.[0];
      if (asset?.uri) setter(asset.uri);
    });
  };

  const pickImages = setter => {
    launchImageLibrary(
      {mediaType: 'photo', quality: 0.7, selectionLimit: 0},
      res => {
        if (res.didCancel) return;
        if (res.errorCode) {
          Alert.alert('Image Error', res.errorMessage || 'Image pick failed');
          return;
        }
        const uris = (res.assets || []).map(a => a.uri).filter(Boolean);
        if (!uris.length) return;
        setter(prev => [...prev, ...uris]);
      },
    );
  };

  const removeImage = (uri, setter) => {
    setter(prev => prev.filter(x => x !== uri));
  };

  // ---------- mature form ----------
  const resetFormForAdd = () => {
    setIsEdit(false);
    setEditingId(null);

    setRegisterNo(enumeration?.registerNo || '');
    setPageNo(enumeration?.pageNo || '');
    setSystemTreeId(`${enumeration?.id || 'ENUM'}-${Date.now()}`);
    setRdKm(rdRangeText);
    setTreeNo('');
    setSpecies('');
    setGirthInches('');
    setCondition('');
    setGps('');
    setRemarks('');
    setPictureUri(null);

    // NEW default
    setAuctionYN('No');
  };

  const openAddForm = () => {
    resetFormForAdd();
    setModalVisible(true);
  };

  const openEditForm = record => {
    setIsEdit(true);
    setEditingId(record.id);

    setRegisterNo(record.registerNo || '');
    setPageNo(record.pageNo || '');
    setSystemTreeId(record.systemTreeId || '');
    setRdKm(record.rdKm || '');
    setTreeNo(record.treeNo || '');
    setSpecies(record.species || '');
    setGirthInches(record.girthInches || '');
    setCondition(record.condition || '');
    setGps(record.gpsLatLong || '');
    setRemarks(record.remarks || '');
    setPictureUri(record.pictureUri || null);

    // NEW
    setAuctionYN(record.auctionYN || 'No');

    setModalVisible(true);
  };

  const fetchGps = () => {
    Geolocation.getCurrentPosition(
      pos => {
        const {latitude, longitude} = pos.coords;
        setGps(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      },
      err => Alert.alert('Location Error', err.message),
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const upsertRecord = async () => {
    if (!treeNo) {
      Alert.alert('Missing', 'Tree No is required.');
      return;
    }
    if (!enumeration?.id) {
      Alert.alert('Error', 'Parent enumeration missing.');
      return;
    }

    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const arr = json ? JSON.parse(json) : [];

      if (isEdit && editingId) {
        const updated = arr.map(r => {
          if (r.id !== editingId) return r;
          return {
            ...r,
            registerNo,
            pageNo,
            rdKm,
            treeNo,
            species,
            girthInches,
            condition,
            gpsLatLong: gps,
            remarks,
            pictureUri,
            auctionYN, // NEW
            updatedAt: new Date().toISOString(),
          };
        });
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        Alert.alert('Updated', 'Mature Tree record updated.');
      } else {
        const record = {
          id: Date.now().toString(),
          enumerationId: enumeration.id,
          registerNo,
          pageNo,
          systemTreeId,
          rdKm,
          treeNo,
          species,
          girthInches,
          condition,
          gpsLatLong: gps,
          remarks,
          pictureUri,
          auctionYN, // NEW
          disposal: null,
          superdari: null, // NEW
          createdAt: new Date().toISOString(),
        };
        const updated = [record, ...arr];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        Alert.alert('Saved', 'Mature Tree saved successfully.');
      }

      setModalVisible(false);
      await loadRecords();
    } catch (e) {
      console.warn('Failed to save mature record', e);
      Alert.alert('Error', 'Failed to save record.');
    }
  };

  const deleteRecord = recordId => {
    Alert.alert('Delete', 'Are you sure you want to delete this record?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const json = await AsyncStorage.getItem(STORAGE_KEY);
            const arr = json ? JSON.parse(json) : [];
            const updated = arr.filter(r => r.id !== recordId);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            await loadRecords();
          } catch (e) {
            console.warn('Failed to delete record', e);
            Alert.alert('Error', 'Failed to delete.');
          }
        },
      },
    ]);
  };

  // ---------- disposal ----------
  const resetDisposalForm = parentRecord => {
    const d = parentRecord?.disposal || null;

    setDisposalForId(parentRecord?.id || null);
    setDRegisterNo(d?.registerNo ?? parentRecord?.registerNo ?? '');
    setDPageNo(d?.pageNo ?? parentRecord?.pageNo ?? '');

    setDrNo(d?.drNo ?? '');
    setDrDate(d?.drDate ?? '');
    setFcNo(d?.fcNo ?? '');
    setDpcNo(d?.dpcNo ?? '');
    setDpcDate(d?.dpcDate ?? '');

    setFirChecked(!!d?.firChecked);
    setFirNo(d?.firNo ?? '');
    setFirDate(d?.firDate ?? '');

    setRemarks1(d?.remarks1 ?? '');

    setPeedaChecked(!!d?.peedaChecked);
    setAuthorityOO(d?.authorityOO ?? '');
    setOfficerName(d?.officerName ?? '');
    setOfficerDesignation(d?.officerDesignation ?? '');
    setActDate(d?.actDate ?? '');
    setRemarks2(d?.remarks2 ?? '');

    setAuction(d?.auction ?? '');
    setAuctionDetails(d?.auctionDetails ?? '');
    setAuctionDate(d?.auctionDate ?? '');
    setAuctionAuthorityName(d?.auctionAuthorityName ?? '');
    setAuctionAuthorityDesignation(d?.auctionAuthorityDesignation ?? '');
    setRemarks3(d?.remarks3 ?? '');

    setDrImages(Array.isArray(d?.drImages) ? d.drImages : []);
    setFirImages(Array.isArray(d?.firImages) ? d.firImages : []);
    setPeedaImages(Array.isArray(d?.peedaImages) ? d.peedaImages : []);
  };

  const openDisposalForm = record => {
    resetDisposalForm(record);
    setDisposalVisible(true);
  };

  const saveDisposalToRecord = async () => {
    if (!disposalForId) {
      Alert.alert('Error', 'Record not found.');
      return;
    }

    if (!drNo?.trim() && !fcNo?.trim() && !dpcNo?.trim()) {
      Alert.alert('Missing', 'Please fill at least DR No or FC No or DPC No.');
      return;
    }

    if (firChecked) {
      if (!firNo?.trim() || !firDate?.trim()) {
        Alert.alert('Missing', 'Please fill FIR No and FIR Date.');
        return;
      }
    }

    if (peedaChecked) {
      if (!authorityOO?.trim() || !officerName?.trim()) {
        Alert.alert('Missing', 'Please fill Authority O/O and Officer Name for PEEDA Act.');
        return;
      }
    }

    const disposalPayload = {
      registerNo: dRegisterNo,
      pageNo: dPageNo,

      drNo,
      drDate,
      drImages,

      fcNo,
      dpcNo,
      dpcDate,

      firChecked,
      firNo: firChecked ? firNo : '',
      firDate: firChecked ? firDate : '',
      firImages: firChecked ? firImages : [],

      remarks1,

      peedaChecked,
      authorityOO: peedaChecked ? authorityOO : '',
      officerName: peedaChecked ? officerName : '',
      officerDesignation: peedaChecked ? officerDesignation : '',
      actDate: peedaChecked ? actDate : '',
      remarks2: peedaChecked ? remarks2 : '',
      peedaImages: peedaChecked ? peedaImages : [],

      auction,
      auctionDetails,
      auctionDate,
      auctionAuthorityName,
      auctionAuthorityDesignation,
      remarks3,

      savedAt: new Date().toISOString(),
    };

    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const arr = json ? JSON.parse(json) : [];

      const updated = arr.map(r => {
        if (r.id !== disposalForId) return r;
        return {
          ...r,
          disposal: disposalPayload,
          disposalUpdatedAt: new Date().toISOString(),
        };
      });

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setDisposalVisible(false);
      await loadRecords();
      Alert.alert('Saved', 'Disposal details saved.');
    } catch (e) {
      console.warn('Failed to save disposal', e);
      Alert.alert('Error', 'Failed to save disposal.');
    }
  };

  // ---------- superdari ----------
  const resetSuperdariForm = parentRecord => {
    const s = parentRecord?.superdari || null;

    setSuperdariForId(parentRecord?.id || null);

    setSRegisterNo(s?.registerNo ?? parentRecord?.registerNo ?? '');
    setSPageNo(s?.pageNo ?? parentRecord?.pageNo ?? '');
    setSuperdarName(s?.superdarName ?? '');
    setSuperdarContact(s?.superdarContact ?? '');
    setSuperdarCnic(s?.superdarCnic ?? '');
    setSuperdarTreeCondition(s?.treeCondition ?? parentRecord?.condition ?? '');
    setSuperdarGps(s?.gps ?? parentRecord?.gpsLatLong ?? '');
    setSuperdarRemarks(s?.remarks ?? '');
    setSuperdarPictures(Array.isArray(s?.pictures) ? s.pictures : []);
  };

  const openSuperdariForm = record => {
    resetSuperdariForm(record);
    setSuperdariVisible(true);
  };

  const saveSuperdariToRecord = async () => {
    if (!superdariForId) {
      Alert.alert('Error', 'Record not found.');
      return;
    }

    if (!superdarName?.trim()) {
      Alert.alert('Missing', 'Name of Superdar is required.');
      return;
    }
    if (!superdarContact?.trim()) {
      Alert.alert('Missing', 'Contact No is required.');
      return;
    }
    if (!superdarCnic?.trim()) {
      Alert.alert('Missing', 'CNIC No is required.');
      return;
    }

    const payload = {
      registerNo: sRegisterNo,
      pageNo: sPageNo,
      superdarName,
      superdarContact,
      superdarCnic,
      treeCondition: superdarTreeCondition,
      gps: superdarGps,
      remarks: superdarRemarks,
      pictures: superdarPictures,
      savedAt: new Date().toISOString(),
    };

    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const arr = json ? JSON.parse(json) : [];

      const updated = arr.map(r => {
        if (r.id !== superdariForId) return r;
        return {
          ...r,
          superdari: payload,
          superdariUpdatedAt: new Date().toISOString(),
        };
      });

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSuperdariVisible(false);
      await loadRecords();
      Alert.alert('Saved', 'Superdari saved.');
    } catch (e) {
      console.warn('Failed to save superdari', e);
      Alert.alert('Error', 'Failed to save superdari.');
    }
  };

  const renderDisposalSummary = d => {
    if (!d) return null;
    return (
      <View style={styles.disposalSummary}>
        <Text style={styles.disposalTitle}>Disposal</Text>
        {!!d.drNo && <Text style={styles.cardMeta}>DR No: {d.drNo}</Text>}
        {!!d.drDate && <Text style={styles.cardMeta}>DR Date: {d.drDate}</Text>}
        <Text style={styles.cardMeta}>DR Images: {d.drImages?.length || 0}</Text>

        {!!d.fcNo && <Text style={styles.cardMeta}>FC No: {d.fcNo}</Text>}
        {!!d.dpcNo && <Text style={styles.cardMeta}>DPC No: {d.dpcNo}</Text>}
        {!!d.dpcDate && <Text style={styles.cardMeta}>DPC Date: {d.dpcDate}</Text>}

        {d.firChecked ? (
          <>
            <Text style={styles.cardMeta}>FIR No: {d.firNo || '—'}</Text>
            <Text style={styles.cardMeta}>FIR Date: {d.firDate || '—'}</Text>
            <Text style={styles.cardMeta}>FIR Images: {d.firImages?.length || 0}</Text>
          </>
        ) : null}

        {d.peedaChecked ? (
          <>
            <Text style={styles.cardMeta}>PEEDA Act: Yes</Text>
            <Text style={styles.cardMeta}>Authority O/O: {d.authorityOO || '—'}</Text>
            <Text style={styles.cardMeta}>Officer: {d.officerName || '—'}</Text>
            <Text style={styles.cardMeta}>PEEDA Images: {d.peedaImages?.length || 0}</Text>
          </>
        ) : (
          <Text style={styles.cardMeta}>PEEDA Act: No</Text>
        )}
      </View>
    );
  };

  const renderSuperdariSummary = s => {
    if (!s) return null;
    return (
      <View style={styles.disposalSummary}>
        <Text style={styles.disposalTitle}>Superdari</Text>
        <Text style={styles.cardMeta}>Superdar: {s.superdarName || '—'}</Text>
        <Text style={styles.cardMeta}>Contact: {s.superdarContact || '—'}</Text>
        <Text style={styles.cardMeta}>CNIC: {s.superdarCnic || '—'}</Text>
        <Text style={styles.cardMeta}>Tree Condition: {s.treeCondition || '—'}</Text>
        <Text style={styles.cardMeta}>GPS: {s.gps || '—'}</Text>
        <Text style={styles.cardMeta}>Pictures: {s.pictures?.length || 0}</Text>
        {s.remarks ? <Text style={styles.cardMeta}>Remarks: {s.remarks}</Text> : null}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ImageBackground source={require('../assets/images/bg.jpg')} style={styles.background} resizeMode="cover">
        <View style={styles.overlay} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Mature Tree</Text>
            <Text style={styles.headerSubtitle}>
              {enumeration?.division} • {enumeration?.block} • {enumeration?.year}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{paddingBottom: 80}}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Saved Records</Text>

            {records.length === 0 ? (
              <Text style={styles.emptyText}>No records yet. Tap + to add.</Text>
            ) : (
              records.map(r => {
                const isEligibleDisposal = disposalEligibleSet.has(r.condition);
                const auctionYes = (r.auctionYN || 'No') === 'Yes';

                return (
                  <View key={r.id} style={styles.card}>
                    <View style={styles.cardTopRow}>
                      <View style={{flex: 1}}>
                        <Text style={styles.cardTitle}>
                          Tree #{r.treeNo} {r.species ? `• ${r.species}` : ''}
                        </Text>
                        <Text style={styles.cardMeta}>ID: {r.systemTreeId}</Text>
                        <Text style={styles.cardMeta}>RD/KM: {r.rdKm || '—'}</Text>
                        <Text style={styles.cardMeta}>
                          Girth: {r.girthInches || '—'} in • Condition: {r.condition || '—'}
                        </Text>
                        <Text style={styles.cardMeta}>GPS: {r.gpsLatLong || '—'}</Text>
                        <Text style={styles.cardMeta}>Auction: {r.auctionYN || 'No'}</Text>
                        {r.remarks ? <Text style={styles.cardMeta}>Remarks: {r.remarks}</Text> : null}

                        {/* Disposal */}
                        {isEligibleDisposal ? (
                          <View style={{marginTop: 10}}>
                            <TouchableOpacity
                              style={styles.disposedBtn}
                              onPress={() => openDisposalForm(r)}>
                              <Ionicons name="archive-outline" size={16} color="#fff" />
                              <Text style={styles.disposedBtnText}>
                                {r.disposal ? 'Edit Disposal' : 'Disposed'}
                              </Text>
                            </TouchableOpacity>
                            {r.disposal ? renderDisposalSummary(r.disposal) : null}
                          </View>
                        ) : null}

                        {/* Superdari (only if Auction Yes) */}
                        {auctionYes ? (
                          <View style={{marginTop: 10}}>
                            <TouchableOpacity
                              style={styles.superdariBtn}
                              onPress={() => openSuperdariForm(r)}>
                              <Ionicons name="document-text-outline" size={16} color="#fff" />
                              <Text style={styles.disposedBtnText}>
                                {r.superdari ? 'Edit Superdari' : 'Superdari'}
                              </Text>
                            </TouchableOpacity>

                            {r.superdari ? renderSuperdariSummary(r.superdari) : null}
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.cardActions}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => openEditForm(r)}>
                          <Ionicons name="create-outline" size={18} color="#0ea5e9" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => deleteRecord(r.id)}>
                          <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity style={styles.fab} onPress={openAddForm}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </ImageBackground>

      {/* Mature Form Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEdit ? 'Edit Mature Tree' : 'Add Mature Tree'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <FormRow label="Register No" value={registerNo} onChangeText={setRegisterNo} />
                <FormRow label="Page No" value={pageNo} onChangeText={setPageNo} />

                <View style={styles.readonlyRow}>
                  <Text style={styles.readonlyLabel}>System Generated Tree ID</Text>
                  <Text style={styles.readonlyValue}>{systemTreeId}</Text>
                </View>

                <FormRow label="RD/KM" value={rdKm} onChangeText={setRdKm} />
                <FormRow label="Tree No (RD/Km wise)" value={treeNo} onChangeText={setTreeNo} required />

                <DropdownRow label="Species" value={species} onChange={setSpecies} options={speciesOptions} />
                <FormRow
                  label="Girth in inches"
                  value={girthInches}
                  onChangeText={setGirthInches}
                  keyboardType="numeric"
                />
                <DropdownRow label="Condition" value={condition} onChange={setCondition} options={conditionOptions} />

                {/* NEW: Auction dropdown */}
                <DropdownRow label="Auction" value={auctionYN} onChange={setAuctionYN} options={auctionOptions} />

                <FormRow
                  label="GPS Coordinates LAT/Long"
                  value={gps}
                  onChangeText={setGps}
                  placeholder="31.5204, 74.3587"
                />
                <TouchableOpacity style={styles.gpsBtn} onPress={fetchGps}>
                  <Ionicons name="locate" size={18} color="#fff" />
                  <Text style={styles.gpsBtnText}>Fetch GPS</Text>
                </TouchableOpacity>

                <FormRow label="Remarks" value={remarks} onChangeText={setRemarks} multiline />

                <View style={{marginTop: 8}}>
                  <Text style={styles.pickLabel}>Picture</Text>
                  <TouchableOpacity style={styles.imageBtn} onPress={() => pickSingleImage(setPictureUri)}>
                    <Ionicons name="image" size={18} color="#fff" />
                    <Text style={styles.imageBtnText}>Upload from device</Text>
                  </TouchableOpacity>
                  <Text style={pictureUri ? styles.imageOk : styles.imageMuted}>
                    {pictureUri ? 'Image selected' : 'No image selected'}
                  </Text>
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={upsertRecord}>
                  <Ionicons name="save" size={20} color="#fff" />
                  <Text style={styles.saveText}>{isEdit ? 'Update' : 'Save'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      {/* ===================== Superdari Modal ===================== */}
      <Modal
        visible={superdariVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSuperdariVisible(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Superdari</Text>
              <TouchableOpacity onPress={() => setSuperdariVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Superdari</Text>

                  <FormRow label="Register No" value={sRegisterNo} onChangeText={setSRegisterNo} />
                  <FormRow label="Page No" value={sPageNo} onChangeText={setSPageNo} />
                  <FormRow label="Name of Superdar" value={superdarName} onChangeText={setSuperdarName} required />
                  <FormRow
                    label="Contact No"
                    value={superdarContact}
                    onChangeText={setSuperdarContact}
                    keyboardType="phone-pad"
                    required
                  />
                  <FormRow label="CNIC No" value={superdarCnic} onChangeText={setSuperdarCnic} required />

                  <DropdownRow
                    label="Tree Condition"
                    value={superdarTreeCondition}
                    onChange={setSuperdarTreeCondition}
                    options={superdariConditionOptions}
                  />

                  <FormRow label="GPS Coordinates" value={superdarGps} onChangeText={setSuperdarGps} placeholder="31.5204, 74.3587" />
                  <FormRow label="Remarks" value={superdarRemarks} onChangeText={setSuperdarRemarks} multiline />

                  <Text style={styles.pickLabel}>Pictures</Text>
                  <TouchableOpacity style={styles.imageBtn} onPress={() => pickImages(setSuperdarPictures)}>
                    <Ionicons name="image" size={18} color="#fff" />
                    <Text style={styles.imageBtnText}>Upload Pictures</Text>
                  </TouchableOpacity>

                  {superdarPictures.map(uri => (
                    <View key={uri} style={styles.picRow}>
                      <Text style={styles.picText} numberOfLines={1}>{uri}</Text>
                      <TouchableOpacity onPress={() => removeImage(uri, setSuperdarPictures)}>
                        <Ionicons name="close" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={saveSuperdariToRecord}>
                  <Ionicons name="save" size={20} color="#fff" />
                  <Text style={styles.saveText}>Save Superdari</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      {/* ===================== Disposal Modal (existing) ===================== */}
      <Modal
        visible={disposalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDisposalVisible(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Disposal</Text>
              <TouchableOpacity onPress={() => setDisposalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* SECTION 1 */}
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Disposal</Text>

                  <FormRow label="Register No" value={dRegisterNo} onChangeText={setDRegisterNo} />
                  <FormRow label="Page No" value={dPageNo} onChangeText={setDPageNo} />

                  <FormRow label="DR No (Damage Report)" value={drNo} onChangeText={setDrNo} />
                  <FormRow label="DR Date" value={drDate} onChangeText={setDrDate} placeholder="YYYY-MM-DD" />

                  <Text style={styles.pickLabel}>DR Images</Text>
                  <TouchableOpacity style={styles.imageBtn} onPress={() => pickImages(setDrImages)}>
                    <Ionicons name="image" size={18} color="#fff" />
                    <Text style={styles.imageBtnText}>Upload DR Images</Text>
                  </TouchableOpacity>
                  {drImages.map(uri => (
                    <View key={uri} style={styles.picRow}>
                      <Text style={styles.picText} numberOfLines={1}>{uri}</Text>
                      <TouchableOpacity onPress={() => removeImage(uri, setDrImages)}>
                        <Ionicons name="close" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <FormRow label="FC No (Forest Case No)" value={fcNo} onChangeText={setFcNo} />

                  <FormRow label="DPC No. (Divisional Prosecution No)" value={dpcNo} onChangeText={setDpcNo} />
                  <FormRow label="DPC Date" value={dpcDate} onChangeText={setDpcDate} placeholder="YYYY-MM-DD" />

                  <TouchableOpacity style={styles.checkboxRow} onPress={() => setFirChecked(v => !v)}>
                    <Ionicons
                      name={firChecked ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={firChecked ? colors.primary : '#6b7280'}
                    />
                    <Text style={styles.checkboxText}>FIR (in case if DPC not implemented)</Text>
                  </TouchableOpacity>

                  {firChecked ? (
                    <View style={{marginTop: 8}}>
                      <FormRow label="FIR No" value={firNo} onChangeText={setFirNo} />
                      <FormRow label="FIR Date" value={firDate} onChangeText={setFirDate} placeholder="YYYY-MM-DD" />

                      <Text style={styles.pickLabel}>FIR Images</Text>
                      <TouchableOpacity style={styles.imageBtn} onPress={() => pickImages(setFirImages)}>
                        <Ionicons name="image" size={18} color="#fff" />
                        <Text style={styles.imageBtnText}>Upload FIR Images</Text>
                      </TouchableOpacity>

                      {firImages.map(uri => (
                        <View key={uri} style={styles.picRow}>
                          <Text style={styles.picText} numberOfLines={1}>{uri}</Text>
                          <TouchableOpacity onPress={() => removeImage(uri, setFirImages)}>
                            <Ionicons name="close" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <FormRow label="Remarks" value={remarks1} onChangeText={setRemarks1} multiline />

                  <TouchableOpacity style={styles.checkboxRow} onPress={() => setPeedaChecked(v => !v)}>
                    <Ionicons
                      name={peedaChecked ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={peedaChecked ? colors.primary : '#6b7280'}
                    />
                    <Text style={styles.checkboxText}>PEEDA Act (in case if no legal action)</Text>
                  </TouchableOpacity>
                </View>

                {/* SECTION 2 (PEEDA) */}
                {peedaChecked ? (
                  <View style={styles.formSection}>
                    <Text style={styles.formSectionTitle}>PEEDA Act</Text>

                    <FormRow label="Authority O/O (if PEEDA Act enforced)" value={authorityOO} onChangeText={setAuthorityOO} />
                    <FormRow label="Officer Name" value={officerName} onChangeText={setOfficerName} />
                    <FormRow label="Officer Designation (CCF, CF or DFO)" value={officerDesignation} onChangeText={setOfficerDesignation} />
                    <FormRow label="Act Date" value={actDate} onChangeText={setActDate} placeholder="YYYY-MM-DD" />
                    <FormRow label="Remarks" value={remarks2} onChangeText={setRemarks2} multiline />

                    <Text style={styles.pickLabel}>PEEDA Act Images</Text>
                    <TouchableOpacity style={styles.imageBtn} onPress={() => pickImages(setPeedaImages)}>
                      <Ionicons name="image" size={18} color="#fff" />
                      <Text style={styles.imageBtnText}>Upload PEEDA Images</Text>
                    </TouchableOpacity>

                    {peedaImages.map(uri => (
                      <View key={uri} style={styles.picRow}>
                        <Text style={styles.picText} numberOfLines={1}>{uri}</Text>
                        <TouchableOpacity onPress={() => removeImage(uri, setPeedaImages)}>
                          <Ionicons name="close" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* SECTION 3 (Auction) */}
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Auction</Text>

                  <FormRow label="Auction" value={auction} onChangeText={setAuction} placeholder="Yes/No" />
                  <FormRow label="Auction details" value={auctionDetails} onChangeText={setAuctionDetails} multiline />
                  <FormRow label="Auction Date" value={auctionDate} onChangeText={setAuctionDate} placeholder="YYYY-MM-DD" />
                  <FormRow label="Name of Authority" value={auctionAuthorityName} onChangeText={setAuctionAuthorityName} />
                  <FormRow label="Designation of Authority" value={auctionAuthorityDesignation} onChangeText={setAuctionAuthorityDesignation} />
                  <FormRow label="Remarks" value={remarks3} onChangeText={setRemarks3} multiline />
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={saveDisposalToRecord}>
                  <Ionicons name="save" size={20} color="#fff" />
                  <Text style={styles.saveText}>Save Disposal</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#fff'},
  background: {flex: 1, width: '100%'},
  overlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16, 185, 129, 0.1)'},

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
  },
  backButton: {padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', marginRight: 12},
  headerContent: {flex: 1},
  headerTitle: {fontSize: 22, fontWeight: '800', color: '#fff'},
  headerSubtitle: {fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2},

  section: {marginHorizontal: 16, marginTop: 12},
  sectionTitle: {fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8},
  emptyText: {fontSize: 13, color: '#6b7280'},

  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 3,
  },
  cardTopRow: {flexDirection: 'row', alignItems: 'flex-start'},
  cardTitle: {fontSize: 15, fontWeight: '700', color: '#111827'},
  cardMeta: {fontSize: 12, color: '#6b7280', marginTop: 2},

  cardActions: {marginLeft: 10, gap: 10},
  iconBtn: {padding: 8, borderRadius: 10, backgroundColor: '#f3f4f6'},

  disposedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#0f766e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  superdariBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  disposedBtnText: {color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 13},

  disposalSummary: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  disposalTitle: {fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 6},

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 9,
  },

  modalRoot: {flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', paddingHorizontal: 16},
  modalCard: {backgroundColor: '#fff', borderRadius: 20, padding: 16, maxHeight: '85%'},
  modalHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  modalTitle: {flex: 1, fontSize: 18, fontWeight: '700', color: '#111827'},
  modalCloseBtn: {padding: 4, borderRadius: 999},

  readonlyRow: {marginHorizontal: 4, marginBottom: 8},
  readonlyLabel: {fontSize: 14, color: '#374151', fontWeight: '600', marginBottom: 2},
  readonlyValue: {fontSize: 13, color: '#4b5563'},

  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  gpsBtnText: {fontSize: 12, color: '#fff', marginLeft: 6, fontWeight: '600'},

  pickLabel: {fontSize: 14, color: '#374151', fontWeight: '600', marginBottom: 6, marginTop: 10},
  imageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  imageBtnText: {fontSize: 13, color: '#fff', marginLeft: 8, fontWeight: '600'},
  imageOk: {fontSize: 12, color: '#16a34a', marginTop: 6},
  imageMuted: {fontSize: 12, color: '#9ca3af', marginTop: 6},

  saveBtn: {
    marginTop: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  saveText: {fontSize: 15, fontWeight: '700', color: '#fff', marginLeft: 8},

  checkboxRow: {flexDirection: 'row', alignItems: 'center', marginTop: 10},
  checkboxText: {marginLeft: 8, fontSize: 13, color: '#111827', fontWeight: '600'},

  formSection: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    backgroundColor: '#ffffff',
  },
  formSectionTitle: {fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 10},

  picRow: {
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  picText: {flex: 1, marginRight: 10, fontSize: 12, color: '#374151'},
});
