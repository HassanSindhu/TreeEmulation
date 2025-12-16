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
import {useFocusEffect} from '@react-navigation/native';

import colors from '../theme/colors';
import FormRow from '../components/FormRow';
import {MultiSelectRow} from '../components/SelectRows';

const STORAGE_KEY = 'POLE_CROP_RECORDS';

export default function PoleCropRecordsScreen({navigation, route}) {
  const enumeration = route?.params?.enumeration;

  const [records, setRecords] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // form
  const [registerNo, setRegisterNo] = useState('');
  const [pageNo, setPageNo] = useState('');
  const [systemTreeId, setSystemTreeId] = useState('');

  // ✅ RD/KM split into two manual fields
  const [rdFrom, setRdFrom] = useState('');
  const [rdTo, setRdTo] = useState('');

  const [species, setSpecies] = useState([]); // multi
  const [speciesCounts, setSpeciesCounts] = useState({}); // {Shisham:"10", Kikar:"5"}
  const [gps, setGps] = useState('');
  const [remarks, setRemarks] = useState('');

  const speciesOptions = useMemo(
    () => ['Shisham', 'Kikar', 'Sufaida', 'Siris', 'Neem', 'Other'],
    [],
  );

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

  const resetFormForAdd = () => {
    setIsEdit(false);
    setEditingId(null);

    setRegisterNo(enumeration?.registerNo || '');
    setPageNo(enumeration?.pageNo || '');
    setSystemTreeId(`${enumeration?.id || 'ENUM'}-${Date.now()}`);

    // ✅ IMPORTANT: do NOT auto fill
    setRdFrom('');
    setRdTo('');

    setSpecies([]);
    setSpeciesCounts({});
    setGps('');
    setRemarks('');
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

    // ✅ new fields
    setRdFrom(record.rdFrom || '');
    setRdTo(record.rdTo || '');

    const recSpecies = Array.isArray(record.species) ? record.species : [];
    setSpecies(recSpecies);

    // Backward compatibility: if old record has rdKm like "10-12" try to split
    if ((!record.rdFrom && !record.rdTo) && record.rdKm) {
      const raw = String(record.rdKm);
      const parts = raw.split('-').map(s => s.trim());
      if (parts.length >= 2) {
        setRdFrom(parts[0]);
        setRdTo(parts[1]);
      }
    }

    // Backward compatibility for counts
    if (record.speciesCounts && typeof record.speciesCounts === 'object') {
      setSpeciesCounts(record.speciesCounts);
    } else if (record.count && recSpecies.length === 1) {
      setSpeciesCounts({[recSpecies[0]]: String(record.count)});
    } else {
      setSpeciesCounts({});
    }

    setGps(record.gpsLatLong || '');
    setRemarks(record.remarks || '');

    setModalVisible(true);
  };

  const onSpeciesChange = newSpecies => {
    setSpecies(newSpecies);

    // keep counts for selected species only (preserve existing values)
    setSpeciesCounts(prev => {
      const next = {};
      (newSpecies || []).forEach(sp => {
        next[sp] = prev?.[sp] ?? '';
      });
      return next;
    });
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
    if (!enumeration?.id) {
      Alert.alert('Error', 'Parent enumeration missing.');
      return;
    }

    // ✅ validate rdFrom/rdTo
    if (!rdFrom?.trim() || !rdTo?.trim()) {
      Alert.alert('Missing', 'RD/KM From and RD/KM To are required.');
      return;
    }

    if (!species?.length) {
      Alert.alert('Missing', 'Please select at least one species.');
      return;
    }

    const missing = species.filter(sp => !String(speciesCounts?.[sp] ?? '').trim());
    if (missing.length) {
      Alert.alert('Missing', `Please enter count for: ${missing.join(', ')}`);
      return;
    }

    const nonNumeric = species.filter(sp => isNaN(parseInt(speciesCounts?.[sp], 10)));
    if (nonNumeric.length) {
      Alert.alert('Invalid', `Count must be numeric for: ${nonNumeric.join(', ')}`);
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
            // ✅ new fields
            rdFrom,
            rdTo,
            // keep rdKm for backward compatibility display (optional)
            rdKm: `${rdFrom} - ${rdTo}`,
            species,
            speciesCounts,
            gpsLatLong: gps,
            remarks,
            updatedAt: new Date().toISOString(),
          };
        });
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        Alert.alert('Updated', 'Pole Crop record updated.');
      } else {
        const record = {
          id: Date.now().toString(),
          enumerationId: enumeration.id,
          registerNo,
          pageNo,
          systemTreeId,
          // ✅ new fields
          rdFrom,
          rdTo,
          // keep rdKm for backward compatibility display (optional)
          rdKm: `${rdFrom} - ${rdTo}`,
          species,
          speciesCounts,
          gpsLatLong: gps,
          remarks,
          createdAt: new Date().toISOString(),
        };
        const updated = [record, ...arr];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        Alert.alert('Saved', 'Pole Crop saved successfully.');
      }

      setModalVisible(false);
      await loadRecords();
    } catch (e) {
      console.warn('Failed to save record', e);
      Alert.alert('Error', 'Failed to save. Please try again.');
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
            Alert.alert('Error', 'Failed to delete. Please try again.');
          }
        },
      },
    ]);
  };

  const getTotalPoles = r => {
    if (r?.speciesCounts && typeof r.speciesCounts === 'object') {
      return Object.values(r.speciesCounts).reduce((sum, v) => {
        const n = parseInt(v || '0', 10);
        return sum + (isNaN(n) ? 0 : n);
      }, 0);
    }
    const old = parseInt(r?.count || '0', 10);
    return isNaN(old) ? 0 : old;
  };

  const getCountsText = r => {
    if (r?.speciesCounts && typeof r.speciesCounts === 'object') {
      const entries = Object.entries(r.speciesCounts);
      if (!entries.length) return '—';
      return entries.map(([k, v]) => `${k}:${v}`).join(' | ');
    }
    if (r?.count) return String(r.count);
    return '—';
  };

  // ✅ build 2-per-row pairs for count inputs
  const countPairs = useMemo(() => {
    const list = Array.isArray(species) ? species : [];
    const pairs = [];
    for (let i = 0; i < list.length; i += 2) {
      pairs.push([list[i], list[i + 1]].filter(Boolean));
    }
    return pairs;
  }, [species]);

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={require('../assets/images/bg.jpg')}
        style={styles.background}
        resizeMode="cover">
        <View style={styles.overlay} />

        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Pole Crop</Text>
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
                      <Text style={styles.cardTitle}>Poles: {getTotalPoles(r) || '—'}</Text>
                      <Text style={styles.cardMeta}>ID: {r.systemTreeId}</Text>

                      <Text style={styles.cardMeta}>
                        RD/KM: {(r.rdFrom || '—')} → {(r.rdTo || '—')}
                      </Text>

                      <Text style={styles.cardMeta}>
                        Species:{' '}
                        {Array.isArray(r.species) && r.species.length ? r.species.join(', ') : '—'}
                      </Text>
                      <Text style={styles.cardMeta}>Counts: {getCountsText(r)}</Text>
                      <Text style={styles.cardMeta}>GPS: {r.gpsLatLong || '—'}</Text>
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

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEdit ? 'Edit Pole Crop' : 'Add Pole Crop'}</Text>
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

                {/* ✅ RD/KM From + To in one row */}
                <View style={styles.row}>
                  <View style={styles.half}>
                    <FormRow
                      label="RD/KM From"
                      value={rdFrom}
                      onChangeText={setRdFrom}
                      placeholder="From"
                      keyboardType="numeric"
                      required
                    />
                  </View>
                  <View style={styles.half}>
                    <FormRow
                      label="RD/KM To"
                      value={rdTo}
                      onChangeText={setRdTo}
                      placeholder="To"
                      keyboardType="numeric"
                      required
                    />
                  </View>
                </View>

                <MultiSelectRow
                  label="Species (Multiple)"
                  values={species}
                  onChange={onSpeciesChange}
                  options={speciesOptions}
                />

                {/* ✅ Counts: two in one row */}
                {species?.length ? (
                  <View style={{marginTop: 8}}>
                    {countPairs.map((pair, idx) => (
                      <View key={idx} style={styles.row}>
                        {pair.map(sp => (
                          <View key={sp} style={styles.half}>
                            <FormRow
                              label={`Count for ${sp}`}
                              value={speciesCounts?.[sp] ?? ''}
                              onChangeText={val =>
                                setSpeciesCounts(prev => ({...prev, [sp]: val}))
                              }
                              keyboardType="numeric"
                              required
                            />
                          </View>
                        ))}
                        {pair.length === 1 ? <View style={styles.half} /> : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{fontSize: 12, color: '#6b7280', marginTop: 6}}>
                    Please select species to enter counts.
                  </Text>
                )}

                <FormRow
                  label="GPS Coordinates"
                  value={gps}
                  onChangeText={setGps}
                  placeholder="31.5204, 74.3587"
                />
                <TouchableOpacity style={styles.gpsBtn} onPress={fetchGps}>
                  <Ionicons name="locate" size={18} color="#fff" />
                  <Text style={styles.gpsBtnText}>Fetch GPS</Text>
                </TouchableOpacity>

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

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginRight: 12,
  },
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

  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
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

  saveBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  saveText: {fontSize: 15, fontWeight: '700', color: '#fff', marginLeft: 8},

  // ✅ two columns layout
  row: {flexDirection: 'row', gap: 10},
  half: {flex: 1},
});
