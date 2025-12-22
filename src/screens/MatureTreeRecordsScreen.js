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

  /* Add/Edit Modal */
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);

  /* Form fields */
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
  const [auctionYN, setAuctionYN] = useState('No');

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

  /* Load records */
  const loadRecords = async () => {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    const all = json ? JSON.parse(json) : [];
    setRecords(all.filter(r => r.enumerationId === enumeration?.id));
  };

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [enumeration?.id]),
  );

  /* Helpers */
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

  const pickImage = () => {
    launchImageLibrary({mediaType: 'photo', quality: 0.7}, res => {
      if (res.assets?.[0]?.uri) setPictureUri(res.assets[0].uri);
    });
  };

  /* Add / Edit */
  const resetForm = () => {
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
    setAuctionYN('No');
  };

  const openAddForm = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditForm = r => {
    setIsEdit(true);
    setEditingId(r.id);
    setRegisterNo(r.registerNo || '');
    setPageNo(r.pageNo || '');
    setSystemTreeId(r.systemTreeId);
    setRdKm(r.rdKm || '');
    setTreeNo(r.treeNo || '');
    setSpecies(r.species || '');
    setGirthInches(r.girthInches || '');
    setCondition(r.condition || '');
    setGps(r.gpsLatLong || '');
    setRemarks(r.remarks || '');
    setPictureUri(r.pictureUri || null);
    setAuctionYN(r.auctionYN || 'No');
    setModalVisible(true);
  };

  const saveRecord = async () => {
    if (!treeNo) {
      Alert.alert('Missing', 'Tree No is required');
      return;
    }

    const json = await AsyncStorage.getItem(STORAGE_KEY);
    const arr = json ? JSON.parse(json) : [];

    if (isEdit && editingId) {
      const updated = arr.map(r =>
        r.id === editingId
          ? {
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
              auctionYN,
              updatedAt: new Date().toISOString(),
            }
          : r,
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
        auctionYN,
        disposal: null,
        superdari: null,
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...arr]));
    }

    setModalVisible(false);
    loadRecords();
  };

  const deleteRecord = id => {
    Alert.alert('Delete', 'Are you sure?', [
      {text: 'Cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const json = await AsyncStorage.getItem(STORAGE_KEY);
          const arr = json ? JSON.parse(json) : [];
          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(arr.filter(r => r.id !== id)),
          );
          loadRecords();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ImageBackground source={require('../assets/images/bg.jpg')} style={styles.background}>
        <View style={styles.overlay} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Mature Tree</Text>
            <Text style={styles.headerSubtitle}>
              {enumeration?.division} • {enumeration?.block} • {enumeration?.year}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{paddingBottom: 90}}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Saved Records</Text>

            {records.map(r => {
              const disposalAllowed = disposalEligibleSet.has(r.condition);
              return (
                <View key={r.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    Tree #{r.treeNo} {r.species ? `• ${r.species}` : ''}
                  </Text>
                  <Text style={styles.cardMeta}>RD/KM: {r.rdKm}</Text>
                  <Text style={styles.cardMeta}>Condition: {r.condition}</Text>
                  <Text style={styles.cardMeta}>Auction: {r.auctionYN}</Text>

                  {disposalAllowed && (
                    <TouchableOpacity
                      style={styles.disposedBtn}
                      onPress={() =>
                        navigation.navigate('Disposal', {treeId: r.id, enumeration})
                      }>
                      <Ionicons name="archive-outline" size={16} color="#fff" />
                      <Text style={styles.disposedBtnText}>
                        {r.disposal ? 'Edit Disposal' : 'Disposed'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {r.auctionYN === 'Yes' && (
                    <TouchableOpacity
                      style={styles.superdariBtn}
                      onPress={() =>
                        navigation.navigate('Superdari', {treeId: r.id, enumeration})
                      }>
                      <Ionicons name="document-text-outline" size={16} color="#fff" />
                      <Text style={styles.disposedBtnText}>
                        {r.superdari ? 'Edit Superdari' : 'Superdari'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => openEditForm(r)}>
                      <Ionicons name="create-outline" size={20} color="#0ea5e9" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteRecord(r.id)}>
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={openAddForm}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </ImageBackground>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{isEdit ? 'Edit Mature Tree' : 'Add Mature Tree'}</Text>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView>
                <FormRow label="Register No" value={registerNo} onChangeText={setRegisterNo} />
                <FormRow label="Page No" value={pageNo} onChangeText={setPageNo} />
                <FormRow label="RD/KM" value={rdKm} onChangeText={setRdKm} />
                <FormRow label="Tree No" value={treeNo} onChangeText={setTreeNo} required />
                <DropdownRow label="Species" value={species} onChange={setSpecies} options={speciesOptions} />
                <FormRow label="Girth (inches)" value={girthInches} onChangeText={setGirthInches} />
                <DropdownRow label="Condition" value={condition} onChange={setCondition} options={conditionOptions} />
                <DropdownRow label="Auction" value={auctionYN} onChange={setAuctionYN} options={auctionOptions} />

                <FormRow label="GPS" value={gps} onChangeText={setGps} />
                <TouchableOpacity style={styles.gpsBtn} onPress={fetchGps}>
                  <Text style={styles.gpsBtnText}>Fetch GPS</Text>
                </TouchableOpacity>

                <FormRow label="Remarks" value={remarks} onChangeText={setRemarks} multiline />

                <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                  <Text style={styles.imageBtnText}>Upload Image</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={saveRecord}>
                  <Text style={styles.saveText}>Save</Text>
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
  screen: {flex: 1},
  background: {flex: 1},
  overlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,185,129,0.1)'},

  header: {padding: 20, paddingTop: 50, backgroundColor: 'rgba(16,185,129,0.85)'},
  backButton: {marginBottom: 6},
  headerTitle: {fontSize: 22, fontWeight: '800', color: '#fff'},
  headerSubtitle: {fontSize: 13, color: '#e5e7eb'},

  section: {margin: 16},
  sectionTitle: {fontSize: 18, fontWeight: '700', marginBottom: 8},

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    elevation: 3,
  },
  cardTitle: {fontWeight: '800'},
  cardMeta: {fontSize: 12, color: '#6b7280'},

  disposedBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f766e',
    padding: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  superdariBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    padding: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  disposedBtnText: {color: '#fff', marginLeft: 6, fontWeight: '700', fontSize: 13},

  cardActions: {flexDirection: 'row', marginTop: 8, gap: 14},

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalRoot: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center'},
  modalCard: {backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 16, maxHeight: '90%'},
  modalTitle: {fontSize: 18, fontWeight: '800', marginBottom: 10},

  gpsBtn: {
    marginTop: 6,
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  gpsBtnText: {color: '#fff', fontWeight: '700'},

  imageBtn: {
    marginTop: 10,
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  imageBtnText: {color: '#fff', fontWeight: '700'},

  saveBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveText: {color: '#fff', fontWeight: '800'},
});
