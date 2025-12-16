import React, {useCallback, useState} from 'react';
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
import Slider from '@react-native-community/slider';
import {launchImageLibrary} from 'react-native-image-picker';
import {useFocusEffect} from '@react-navigation/native';

import colors from '../theme/colors';
import FormRow from '../components/FormRow';
import {DropdownRow} from '../components/SelectRows';

const STORAGE_KEY = 'AFFORESTATION_RECORDS';

export default function AfforestationRecordsScreen({navigation, route}) {
  const enumeration = route?.params?.enumeration;

  const [records, setRecords] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // form states
  const [registerNo, setRegisterNo] = useState('');
  const [pageNo, setPageNo] = useState('');
  const [avgMilesKm, setAvgMilesKm] = useState('');
  const [success, setSuccess] = useState(0); // slider 0-100
  const [mainSpecies, setMainSpecies] = useState('');
  const [year, setYear] = useState('');
  const [schemeType, setSchemeType] = useState(''); // Development | Non Development
  const [projectName, setProjectName] = useState('');
  const [nonDevScheme, setNonDevScheme] = useState('');
  const [plants, setPlants] = useState('');
  const [gpsList, setGpsList] = useState(['']); // multiple
  const [remarks, setRemarks] = useState('');
  const [pictureUri, setPictureUri] = useState(null);

  const speciesOptions = ['Shisham', 'Kikar', 'Sufaida', 'Siris', 'Neem', 'Other'];

  const yearOptions = [
    '2021-22','2022-23','2023-24','2024-25','2025-26',
    '2026-27','2027-28','2028-29','2029-30',
  ];

  const schemeOptions = ['Development', 'Non Development'];

  const nonDevOptions = ['1% Plantation', 'Replenishment', 'Gap Filling', 'Other'];

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

  const resetFormForAdd = () => {
    setIsEdit(false);
    setEditingId(null);

    setRegisterNo(enumeration?.registerNo || '');
    setPageNo(enumeration?.pageNo || '');
    setAvgMilesKm('');
    setSuccess(0);
    setMainSpecies('');
    setYear('');
    setSchemeType('');
    setProjectName('');
    setNonDevScheme('');
    setPlants('');
    setGpsList(['']);
    setRemarks('');
    setPictureUri(null);
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
    setAvgMilesKm(record.avgMilesKm || '');
    setSuccess(typeof record.successPercent === 'number' ? record.successPercent : 0);
    setMainSpecies(record.mainSpecies || '');
    setYear(record.year || '');
    setSchemeType(record.schemeType || '');
    setProjectName(record.projectName || '');
    setNonDevScheme(record.nonDevScheme || '');
    setPlants(record.noOfPlants || '');
    setGpsList(Array.isArray(record.gpsBoundingBox) && record.gpsBoundingBox.length ? record.gpsBoundingBox : ['']);
    setRemarks(record.remarks || '');
    setPictureUri(record.pictureUri || null);

    setModalVisible(true);
  };

  const pickImage = () => {
    launchImageLibrary({mediaType: 'photo', quality: 0.7}, res => {
      if (res.didCancel) return;
      if (res.errorCode) {
        Alert.alert('Image Error', res.errorMessage || 'Could not pick image');
        return;
      }
      const asset = res.assets?.[0];
      if (asset?.uri) setPictureUri(asset.uri);
    });
  };

  const fetchGpsFillLast = () => {
    Geolocation.getCurrentPosition(
      pos => {
        const {latitude, longitude} = pos.coords;
        const value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setGpsList(prev => {
          const list = Array.isArray(prev) && prev.length ? [...prev] : [''];
          list[list.length - 1] = value;
          return list;
        });
      },
      err => Alert.alert('Location Error', err.message),
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const addCoordinateField = () => setGpsList(prev => [...prev, '']);

  const removeCoordinateField = index => {
    setGpsList(prev => {
      const list = [...prev];
      if (list.length === 1) return [''];
      list.splice(index, 1);
      return list;
    });
  };

  const upsertRecord = async () => {
    if (!avgMilesKm || !year) {
      Alert.alert('Missing', 'Avg. Miles/KM and Year are required.');
      return;
    }
    if (!enumeration?.id) {
      Alert.alert('Error', 'Parent enumeration missing.');
      return;
    }

    const cleanGps = gpsList.map(x => (x || '').trim()).filter(x => x.length > 0);

    const json = await AsyncStorage.getItem(STORAGE_KEY);
    const arr = json ? JSON.parse(json) : [];

    if (isEdit && editingId) {
      const updated = arr.map(r => {
        if (r.id !== editingId) return r;
        return {
          ...r,
          registerNo,
          pageNo,
          avgMilesKm,
          successPercent: success,
          mainSpecies,
          year,
          schemeType,
          projectName: schemeType === 'Development' ? projectName : '',
          nonDevScheme: schemeType === 'Non Development' ? nonDevScheme : '',
          noOfPlants: plants,
          gpsBoundingBox: cleanGps,
          remarks,
          pictureUri,
          updatedAt: new Date().toISOString(),
        };
      });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      Alert.alert('Updated', 'Afforestation record updated.');
    } else {
      const record = {
        id: Date.now().toString(),
        enumerationId: enumeration.id,
        registerNo,
        pageNo,
        avgMilesKm,
        successPercent: success,
        mainSpecies,
        year,
        schemeType,
        projectName: schemeType === 'Development' ? projectName : '',
        nonDevScheme: schemeType === 'Non Development' ? nonDevScheme : '',
        noOfPlants: plants,
        gpsBoundingBox: cleanGps,
        remarks,
        pictureUri,
        createdAt: new Date().toISOString(),
      };
      const updated = [record, ...arr];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      Alert.alert('Saved', 'Afforestation saved successfully.');
    }

    setModalVisible(false);
    await loadRecords();
  };

  const deleteRecord = recordId => {
    Alert.alert('Delete', 'Are you sure you want to delete this record?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const json = await AsyncStorage.getItem(STORAGE_KEY);
          const arr = json ? JSON.parse(json) : [];
          const updated = arr.filter(r => r.id !== recordId);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          await loadRecords();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ImageBackground source={require('../assets/images/bg.jpg')} style={styles.background} resizeMode="cover">
        <View style={styles.overlay} />

        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Afforestation</Text>
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
              records.map(r => (
                <View key={r.id} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <View style={{flex: 1}}>
                      <Text style={styles.cardTitle}>
                        Year: {r.year || '—'} • Success: {typeof r.successPercent === 'number' ? `${r.successPercent}%` : '—'}
                      </Text>
                      <Text style={styles.cardMeta}>Avg Miles/KM: {r.avgMilesKm || '—'}</Text>
                      <Text style={styles.cardMeta}>Main Species: {r.mainSpecies || '—'}</Text>
                      <Text style={styles.cardMeta}>Scheme: {r.schemeType || '—'}</Text>
                      {r.schemeType === 'Development' && r.projectName ? (
                        <Text style={styles.cardMeta}>Project: {r.projectName}</Text>
                      ) : null}
                      {r.schemeType === 'Non Development' && r.nonDevScheme ? (
                        <Text style={styles.cardMeta}>Non-Dev: {r.nonDevScheme}</Text>
                      ) : null}
                      <Text style={styles.cardMeta}>Plants: {r.noOfPlants || '—'}</Text>
                      <Text style={styles.cardMeta}>
                        GPS: {(Array.isArray(r.gpsBoundingBox) && r.gpsBoundingBox.length) ? r.gpsBoundingBox.join(' | ') : '—'}
                      </Text>
                      {r.remarks ? <Text style={styles.cardMeta}>Remarks: {r.remarks}</Text> : null}
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
              ))
            )}
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={openAddForm}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </ImageBackground>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEdit ? 'Edit Afforestation' : 'Add Afforestation'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <FormRow label="Register No" value={registerNo} onChangeText={setRegisterNo} />
                <FormRow label="Page No" value={pageNo} onChangeText={setPageNo} />

                <FormRow label="Av. Miles/ KM" value={avgMilesKm} onChangeText={setAvgMilesKm} keyboardType="numeric" required />

                <View style={styles.sliderBlock}>
                  <Text style={styles.sliderLabel}>Success Ratio (0 – 100)</Text>
                  <Slider
                    style={{width: '100%', height: 40}}
                    minimumValue={0}
                    maximumValue={100}
                    step={1}
                    value={success}
                    onValueChange={setSuccess}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor="#e5e7eb"
                    thumbTintColor={colors.primary}
                  />
                  <Text style={styles.sliderValue}>{success}%</Text>
                </View>

                <DropdownRow label="Main Species" value={mainSpecies} onChange={setMainSpecies} options={speciesOptions} />
                <DropdownRow label="Year" value={year} onChange={setYear} options={yearOptions} required />

                <DropdownRow
                  label="Scheme Type"
                  value={schemeType}
                  onChange={val => {
                    setSchemeType(val);
                    setProjectName('');
                    setNonDevScheme('');
                  }}
                  options={schemeOptions}
                  required
                />

                {schemeType === 'Development' ? (
                  <FormRow label="Project Name (Development)" value={projectName} onChangeText={setProjectName} />
                ) : null}

                {schemeType === 'Non Development' ? (
                  <DropdownRow
                    label="Non Development Scheme"
                    value={nonDevScheme}
                    onChange={setNonDevScheme}
                    options={nonDevOptions}
                  />
                ) : null}

                <FormRow label="No. of Plants" value={plants} onChangeText={setPlants} keyboardType="numeric" />

                {/* GPS multiple */}
                <View style={{marginTop: 8}}>
                  <Text style={styles.gpsTitle}>GPS Coordinates (Single یا Multiple)</Text>

                  {gpsList.map((coord, index) => (
                    <View key={index} style={styles.coordRow}>
                      <View style={{flex: 1}}>
                        <FormRow
                          label={`Coordinate ${index + 1}`}
                          value={coord}
                          onChangeText={text => {
                            const copy = [...gpsList];
                            copy[index] = text;
                            setGpsList(copy);
                          }}
                          placeholder="31.5204, 74.3587"
                        />
                      </View>

                      <TouchableOpacity
                        style={styles.removeCoordBtn}
                        onPress={() => removeCoordinateField(index)}>
                        <Ionicons name="remove-circle-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <View style={{flexDirection: 'row', gap: 10, marginTop: 6}}>
                    <TouchableOpacity style={styles.addCoordBtn} onPress={addCoordinateField}>
                      <Ionicons name="add-circle-outline" size={18} color="#fff" />
                      <Text style={styles.addCoordText}>Add Coordinate</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.gpsBtn} onPress={fetchGpsFillLast}>
                      <Ionicons name="locate" size={18} color="#fff" />
                      <Text style={styles.gpsBtnText}>Fill last with GPS</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{marginTop: 12}}>
                  <Text style={styles.pickLabel}>Picture</Text>
                  <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                    <Ionicons name="image" size={18} color="#fff" />
                    <Text style={styles.imageBtnText}>Upload from device</Text>
                  </TouchableOpacity>
                  <Text style={pictureUri ? styles.imageOk : styles.imageMuted}>
                    {pictureUri ? 'Image selected' : 'No image selected'}
                  </Text>
                </View>

                <FormRow label="Remarks" value={remarks} onChangeText={setRemarks} multiline />

                <TouchableOpacity style={styles.saveBtn} onPress={upsertRecord}>
                  <Ionicons name="save" size={20} color="#fff" />
                  <Text style={styles.saveText}>{isEdit ? 'Update' : 'Save'}</Text>
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

  header: {flexDirection: 'row', alignItems: 'flex-start', padding: 20, paddingTop: 50, backgroundColor: 'rgba(16, 185, 129, 0.8)'},
  backButton: {padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', marginRight: 12},
  headerContent: {flex: 1},
  headerTitle: {fontSize: 22, fontWeight: '800', color: '#fff'},
  headerSubtitle: {fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2},

  section: {marginHorizontal: 16, marginTop: 12},
  sectionTitle: {fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8},
  emptyText: {fontSize: 13, color: '#6b7280'},

  card: {backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb', elevation: 3},
  cardTopRow: {flexDirection: 'row', alignItems: 'flex-start'},
  cardTitle: {fontSize: 15, fontWeight: '700', color: '#111827'},
  cardMeta: {fontSize: 12, color: '#6b7280', marginTop: 2},

  cardActions: {marginLeft: 10, gap: 10},
  iconBtn: {padding: 8, borderRadius: 10, backgroundColor: '#f3f4f6'},

  fab: {position: 'absolute', right: 20, bottom: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 9},

  modalRoot: {flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', paddingHorizontal: 16},
  modalCard: {backgroundColor: '#fff', borderRadius: 20, padding: 16, maxHeight: '85%'},
  modalHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  modalTitle: {flex: 1, fontSize: 18, fontWeight: '700', color: '#111827'},
  modalCloseBtn: {padding: 4, borderRadius: 999},

  sliderBlock: {marginTop: 8, marginBottom: 12},
  sliderLabel: {fontSize: 14, color: '#374151', fontWeight: '600', marginBottom: 4},
  sliderValue: {fontSize: 13, color: '#111827', fontWeight: '700', textAlign: 'right', marginTop: -4},

  gpsTitle: {fontSize: 14, color: '#374151', fontWeight: '600', marginBottom: 6},
  coordRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  removeCoordBtn: {marginTop: 22, padding: 6},

  addCoordBtn: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#0ea5e9'},
  addCoordText: {fontSize: 12, color: '#fff', marginLeft: 6, fontWeight: '700'},

  gpsBtn: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primary},
  gpsBtnText: {fontSize: 12, color: '#fff', marginLeft: 6, fontWeight: '700'},

  pickLabel: {fontSize: 14, color: '#374151', fontWeight: '600', marginBottom: 4},
  imageBtn: {flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primary},
  imageBtnText: {fontSize: 13, color: '#fff', marginLeft: 8, fontWeight: '700'},
  imageOk: {fontSize: 12, color: '#16a34a', marginTop: 6},
  imageMuted: {fontSize: 12, color: '#9ca3af', marginTop: 6},

  saveBtn: {marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary},
  saveText: {fontSize: 15, fontWeight: '700', color: '#fff', marginLeft: 8},
});
