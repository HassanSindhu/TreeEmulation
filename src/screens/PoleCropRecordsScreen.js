import React, {useCallback, useMemo, useRef, useState} from 'react';
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
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import {useFocusEffect} from '@react-navigation/native';

import colors from '../theme/colors';
import FormRow from '../components/FormRow';
import {MultiSelectRow} from '../components/SelectRows';

const STORAGE_KEY = 'POLE_CROP_RECORDS';

/**
 * Workflow:
 * - Status is NOT editable here.
 * - New record default status: "pending"
 * - Upper level officer will approve/return later (backend / role-based).
 *
 * GPS:
 * - Auto fetch on Add (and on Edit if missing)
 * - Show auto GPS in a readonly field
 * - Provide a separate manual input field for user-entered coordinates
 * - Final stored gpsLatLong = manualGps if provided, else autoGps
 */

export default function PoleCropRecordsScreen({navigation, route}) {
  const enumeration = route?.params?.enumeration;

  const [records, setRecords] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // ✅ Search + Filters
  const [search, setSearch] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    speciesOne: '',
    dateFrom: '',
    dateTo: '',
    rdFrom: '',
    rdTo: '',
    totalFrom: '',
    totalTo: '',
    status: '', // optional filter (pending/approved/returned) - records can show whatever backend sets later
  });

  // form
  const [registerNo, setRegisterNo] = useState('');
  const [pageNo, setPageNo] = useState('');
  const [systemTreeId, setSystemTreeId] = useState('');

  const [rdFrom, setRdFrom] = useState('');
  const [rdTo, setRdTo] = useState('');

  const [species, setSpecies] = useState([]); // multi
  const [speciesCounts, setSpeciesCounts] = useState({}); // {Shisham:"10", Kikar:"5"}

  // ✅ GPS split: auto + manual
  const [autoGps, setAutoGps] = useState('');     // readonly (auto fetched)
  const [manualGps, setManualGps] = useState(''); // user input (optional)
  const [gpsLoading, setGpsLoading] = useState(false);

  const [remarks, setRemarks] = useState('');

  const lastGpsRequestAtRef = useRef(0);

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

    setRdFrom('');
    setRdTo('');

    setSpecies([]);
    setSpeciesCounts({});

    // GPS
    setAutoGps('');
    setManualGps('');

    setRemarks('');
  };

  const onSpeciesChange = newSpecies => {
    setSpecies(newSpecies);
    setSpeciesCounts(prev => {
      const next = {};
      (newSpecies || []).forEach(sp => {
        next[sp] = prev?.[sp] ?? '';
      });
      return next;
    });
  };

  const fetchGps = (silent = false) => {
    const now = Date.now();
    if (now - lastGpsRequestAtRef.current < 1200) return;
    lastGpsRequestAtRef.current = now;

    setGpsLoading(true);
    Geolocation.getCurrentPosition(
      pos => {
        const {latitude, longitude} = pos.coords;
        setAutoGps(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setGpsLoading(false);
      },
      err => {
        setGpsLoading(false);
        if (!silent) Alert.alert('Location Error', err.message);
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const openAddForm = () => {
    resetFormForAdd();
    setModalVisible(true);

    // ✅ auto fetch on open
    setTimeout(() => fetchGps(true), 300);
  };

  const openEditForm = record => {
    setIsEdit(true);
    setEditingId(record.id);

    setRegisterNo(record.registerNo || '');
    setPageNo(record.pageNo || '');
    setSystemTreeId(record.systemTreeId || '');

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

    // ✅ GPS: use stored gpsLatLong as manual (editable), autoGps blank then we fetch
    setManualGps(record.gpsLatLong || '');
    setAutoGps(record.autoGpsLatLong || ''); // if you saved it earlier
    setRemarks(record.remarks || '');

    setModalVisible(true);

    // ✅ auto fetch if autoGps missing
    if (!record.autoGpsLatLong) {
      setTimeout(() => fetchGps(true), 300);
    }
  };

  const normalizeGps = (val) => (val || '').trim();

  const resolveFinalGps = () => {
    const m = normalizeGps(manualGps);
    const a = normalizeGps(autoGps);
    return m ? m : a;
  };

  const validate = () => {
    if (!enumeration?.id) {
      Alert.alert('Error', 'Parent enumeration missing.');
      return false;
    }
    if (!rdFrom?.trim() || !rdTo?.trim()) {
      Alert.alert('Missing', 'RD/KM From and RD/KM To are required.');
      return false;
    }
    if (!species?.length) {
      Alert.alert('Missing', 'Please select at least one species.');
      return false;
    }

    const missing = species.filter(sp => !String(speciesCounts?.[sp] ?? '').trim());
    if (missing.length) {
      Alert.alert('Missing', `Please enter count for: ${missing.join(', ')}`);
      return false;
    }

    const nonNumeric = species.filter(sp => isNaN(parseInt(speciesCounts?.[sp], 10)));
    if (nonNumeric.length) {
      Alert.alert('Invalid', `Count must be numeric for: ${nonNumeric.join(', ')}`);
      return false;
    }

    // GPS not mandatory, but if both empty, warn (still allow)
    if (!resolveFinalGps()) {
      Alert.alert('GPS', 'GPS is empty. You can save, but please add coordinates if required.');
    }

    return true;
  };

  const upsertRecord = async () => {
    if (!validate()) return;

    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const arr = json ? JSON.parse(json) : [];

      const finalGps = resolveFinalGps();

      if (isEdit && editingId) {
        const updated = arr.map(r => {
          if (r.id !== editingId) return r;

          return {
            ...r,
            registerNo,
            pageNo,
            rdFrom,
            rdTo,
            rdKm: `${rdFrom} - ${rdTo}`,
            species,
            speciesCounts,

            // ✅ store BOTH (helpful later for audit)
            autoGpsLatLong: normalizeGps(autoGps),
            gpsLatLong: finalGps,

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
          rdFrom,
          rdTo,
          rdKm: `${rdFrom} - ${rdTo}`,
          species,
          speciesCounts,

          autoGpsLatLong: normalizeGps(autoGps),
          gpsLatLong: finalGps,

          remarks,

          // ✅ default status (NOT editable here)
          status: 'pending',

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

  const activeFilterCount = useMemo(() => {
    const adv = Object.values(filters).filter(v => String(v || '').trim() !== '').length;
    const s = search.trim() ? 1 : 0;
    return adv + s;
  }, [filters, search]);

  const clearAll = () => {
    setSearch('');
    setFilters({
      speciesOne: '',
      dateFrom: '',
      dateTo: '',
      rdFrom: '',
      rdTo: '',
      totalFrom: '',
      totalTo: '',
      status: '',
    });
  };

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();

    const df = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00') : null;
    const dt = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59') : null;

    const rdF = filters.rdFrom !== '' ? Number(filters.rdFrom) : null;
    const rdT = filters.rdTo !== '' ? Number(filters.rdTo) : null;

    const totF = filters.totalFrom !== '' ? Number(filters.totalFrom) : null;
    const totT = filters.totalTo !== '' ? Number(filters.totalTo) : null;

    return records.filter(r => {
      if (filters.status && r.status !== filters.status) return false;

      if (filters.speciesOne) {
        const list = Array.isArray(r.species) ? r.species : [];
        if (!list.includes(filters.speciesOne)) return false;
      }

      if ((df || dt) && r.createdAt) {
        const d = new Date(r.createdAt);
        if (df && d < df) return false;
        if (dt && d > dt) return false;
      } else if ((df || dt) && !r.createdAt) {
        return false;
      }

      if (rdF !== null || rdT !== null) {
        const n = firstNumber(r.rdFrom ?? r.rdKm ?? '');
        if (n === null) return false;
        if (rdF !== null && n < rdF) return false;
        if (rdT !== null && n > rdT) return false;
      }

      if (totF !== null || totT !== null) {
        const total = getTotalPoles(r);
        if (totF !== null && total < totF) return false;
        if (totT !== null && total > totT) return false;
      }

      if (!q) return true;
      const blob = [
        r.systemTreeId,
        r.registerNo,
        r.pageNo,
        r.rdFrom,
        r.rdTo,
        r.rdKm,
        (Array.isArray(r.species) ? r.species.join(',') : ''),
        getCountsText(r),
        r.gpsLatLong,
        r.autoGpsLatLong,
        r.remarks,
        r.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [records, search, filters]);

  function firstNumber(val) {
    if (!val) return null;
    const m = String(val).match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  }

  const countPairs = useMemo(() => {
    const list = Array.isArray(species) ? species : [];
    const pairs = [];
    for (let i = 0; i < list.length; i += 2) {
      pairs.push([list[i], list[i + 1]].filter(Boolean));
    }
    return pairs;
  }, [species]);

  const statusBadge = (st) => {
    const key = st || 'pending';
    if (key === 'approved') return {label: 'Approved', color: '#16a34a', icon: 'checkmark-done'};
    if (key === 'returned') return {label: 'Returned', color: '#ef4444', icon: 'arrow-undo'};
    return {label: 'Pending', color: '#f97316', icon: 'time'};
  };

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={require('../assets/images/bg.jpg')}
        style={styles.background}
        resizeMode="cover">
        <View style={styles.overlay} />

        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Pole Crop</Text>
            <Text style={styles.headerSubtitle}>
              {enumeration?.division} • {enumeration?.block} • {enumeration?.year}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{paddingBottom: 110}}>
          <View style={styles.section}>

            <View style={styles.searchFilterRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#6b7280" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search here..."
                  placeholderTextColor="#9ca3af"
                  style={styles.searchInput}
                />
                {!!search && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterModalVisible(true)}>
                <Ionicons name="options-outline" size={20} color="#111827" />
                {activeFilterCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Saved Records</Text>
              <Text style={styles.sectionMeta}>
                {filteredRecords.length} / {records.length}
              </Text>
            </View>

            {records.length === 0 ? (
              <Text style={styles.emptyText}>No records yet. Tap + to add.</Text>
            ) : filteredRecords.length === 0 ? (
              <Text style={styles.emptyText}>No record matches your search/filters.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tableWrap}>
                  <View style={[styles.tr, styles.thRow]}>
                    <Text style={[styles.th, {width: 90}]}>Total</Text>
                    <Text style={[styles.th, {width: 150}]}>System ID</Text>
                    <Text style={[styles.th, {width: 120}]}>RD From</Text>
                    <Text style={[styles.th, {width: 120}]}>RD To</Text>
                    <Text style={[styles.th, {width: 170}]}>Species</Text>
                    <Text style={[styles.th, {width: 260}]}>Counts</Text>
                    <Text style={[styles.th, {width: 180}]}>GPS</Text>
                    <Text style={[styles.th, {width: 170}]}>Status</Text>
                    <Text style={[styles.th, {width: 120}]}>Actions</Text>
                  </View>

                  {filteredRecords.map((r, idx) => {
                    const sb = statusBadge(r.status);
                    return (
                      <View key={r.id} style={[styles.tr, idx % 2 === 0 ? styles.trEven : styles.trOdd]}>
                        <Text style={[styles.td, {width: 90}]} numberOfLines={1}>
                          {getTotalPoles(r)}
                        </Text>
                        <Text style={[styles.td, {width: 150}]} numberOfLines={1}>
                          {r.systemTreeId || '—'}
                        </Text>
                        <Text style={[styles.td, {width: 120}]} numberOfLines={1}>
                          {r.rdFrom || '—'}
                        </Text>
                        <Text style={[styles.td, {width: 120}]} numberOfLines={1}>
                          {r.rdTo || '—'}
                        </Text>
                        <Text style={[styles.td, {width: 170}]} numberOfLines={1}>
                          {Array.isArray(r.species) && r.species.length ? r.species.join(', ') : '—'}
                        </Text>
                        <Text style={[styles.td, {width: 260}]} numberOfLines={1}>
                          {getCountsText(r)}
                        </Text>
                        <Text style={[styles.td, {width: 180}]} numberOfLines={1}>
                          {r.gpsLatLong || r.autoGpsLatLong || '—'}
                        </Text>

                        <View style={[styles.statusCell, {width: 170}]}>
                          <View style={[styles.statusPill, {backgroundColor: `${sb.color}15`, borderColor: `${sb.color}40`}]}>
                            <Ionicons name={sb.icon} size={14} color={sb.color} />
                            <Text style={[styles.statusText, {color: sb.color}]}>{sb.label}</Text>
                          </View>
                        </View>

                        <View style={[styles.actionsCell, {width: 120}]}>
                          <TouchableOpacity style={styles.iconBtn} onPress={() => openEditForm(r)}>
                            <Ionicons name="create-outline" size={18} color="#0ea5e9" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.iconBtn} onPress={() => deleteRecord(r.id)}>
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {activeFilterCount > 0 && (
              <TouchableOpacity style={styles.clearAllBtn} onPress={clearAll}>
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={styles.clearAllText}>Clear Search & Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={openAddForm}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </ImageBackground>

      {/* Filters Modal */}
      <Modal
        transparent
        visible={filterModalVisible}
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
          <View style={styles.actionOverlay} />
        </TouchableWithoutFeedback>

        <View style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Filters</Text>
            <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Status filter (only filtering, not editing) */}
            <Text style={styles.filterHint}>Status</Text>
            <View style={styles.pillsRow}>
              <TouchableOpacity
                style={[styles.pill, !filters.status ? styles.pillActive : styles.pillInactive]}
                onPress={() => setFilters(prev => ({...prev, status: ''}))}>
                <Text style={!filters.status ? styles.pillTextActive : styles.pillTextInactive}>All</Text>
              </TouchableOpacity>

              {['pending', 'approved', 'returned'].map(st => (
                <TouchableOpacity
                  key={st}
                  style={[styles.pill, filters.status === st ? styles.pillActive : styles.pillInactive]}
                  onPress={() => setFilters(prev => ({...prev, status: st}))}>
                  <Text style={filters.status === st ? styles.pillTextActive : styles.pillTextInactive}>
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Species contains */}
            <Text style={styles.filterHint}>Species (contains)</Text>
            <View style={styles.pillsRow}>
              <TouchableOpacity
                style={[styles.pill, !filters.speciesOne ? styles.pillActive : styles.pillInactive]}
                onPress={() => setFilters(prev => ({...prev, speciesOne: ''}))}>
                <Text style={!filters.speciesOne ? styles.pillTextActive : styles.pillTextInactive}>All</Text>
              </TouchableOpacity>

              {speciesOptions.map(sp => (
                <TouchableOpacity
                  key={sp}
                  style={[styles.pill, filters.speciesOne === sp ? styles.pillActive : styles.pillInactive]}
                  onPress={() => setFilters(prev => ({...prev, speciesOne: sp}))}>
                  <Text style={filters.speciesOne === sp ? styles.pillTextActive : styles.pillTextInactive}>
                    {sp}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{flexDirection: 'row', gap: 10}}>
              <View style={{flex: 1}}>
                <FormRow
                  label="Saved Date From (YYYY-MM-DD)"
                  value={filters.dateFrom}
                  onChangeText={v => setFilters(prev => ({...prev, dateFrom: v}))}
                  placeholder="2025-12-01"
                />
              </View>
              <View style={{flex: 1}}>
                <FormRow
                  label="Saved Date To (YYYY-MM-DD)"
                  value={filters.dateTo}
                  onChangeText={v => setFilters(prev => ({...prev, dateTo: v}))}
                  placeholder="2025-12-31"
                />
              </View>
            </View>

            <View style={{flexDirection: 'row', gap: 10}}>
              <View style={{flex: 1}}>
                <FormRow
                  label="RD From (>=)"
                  value={filters.rdFrom}
                  onChangeText={v => setFilters(prev => ({...prev, rdFrom: v}))}
                  placeholder="e.g. 10"
                  keyboardType="numeric"
                />
              </View>
              <View style={{flex: 1}}>
                <FormRow
                  label="RD To (<=)"
                  value={filters.rdTo}
                  onChangeText={v => setFilters(prev => ({...prev, rdTo: v}))}
                  placeholder="e.g. 50"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={{flexDirection: 'row', gap: 10}}>
              <View style={{flex: 1}}>
                <FormRow
                  label="Total Poles From (>=)"
                  value={filters.totalFrom}
                  onChangeText={v => setFilters(prev => ({...prev, totalFrom: v}))}
                  placeholder="e.g. 100"
                  keyboardType="numeric"
                />
              </View>
              <View style={{flex: 1}}>
                <FormRow
                  label="Total Poles To (<=)"
                  value={filters.totalTo}
                  onChangeText={v => setFilters(prev => ({...prev, totalTo: v}))}
                  placeholder="e.g. 500"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
              <TouchableOpacity
                style={styles.filterApply}
                onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.filterApplyText}>Apply</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterClear}
                onPress={() =>
                  setFilters({
                    speciesOne: '',
                    dateFrom: '',
                    dateTo: '',
                    rdFrom: '',
                    rdTo: '',
                    totalFrom: '',
                    totalTo: '',
                    status: '',
                  })
                }>
                <Text style={styles.filterClearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Add/Edit Modal */}
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
                <View style={styles.groupCard}>
                  <Text style={styles.groupTitle}>Basic Info</Text>
                  <FormRow label="Register No" value={registerNo} onChangeText={setRegisterNo} />
                  <FormRow label="Page No" value={pageNo} onChangeText={setPageNo} />
                  <View style={styles.readonlyRow}>
                    <Text style={styles.readonlyLabel}>System Generated Tree ID</Text>
                    <Text style={styles.readonlyValue}>{systemTreeId}</Text>
                  </View>
                </View>

                <View style={styles.groupCard}>
                  <Text style={styles.groupTitle}>RD / KM</Text>
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
                </View>

                <View style={styles.groupCard}>
                  <Text style={styles.groupTitle}>Species & Counts</Text>
                  <MultiSelectRow
                    label="Species (Multiple)"
                    values={species}
                    onChange={onSpeciesChange}
                    options={speciesOptions}
                  />

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
                </View>

                <View style={styles.groupCard}>
                  <Text style={styles.groupTitle}>Location (Auto + Manual)</Text>

                  {/* ✅ Auto GPS read-only */}
                  <View style={styles.readonlyRow}>
                    <Text style={styles.readonlyLabel}>Auto GPS (Fetched)</Text>
                    <Text style={styles.readonlyValue}>{autoGps || '—'}</Text>
                  </View>

                  {/* ✅ Manual GPS empty field (optional) */}
                  <FormRow
                    label="Manual Coordinates (Optional)"
                    value={manualGps}
                    onChangeText={setManualGps}
                    placeholder="Enter manually e.g. 31.5204, 74.3587"
                  />

                  <View style={styles.gpsRow}>
                    <TouchableOpacity style={styles.gpsBtn} onPress={() => fetchGps(false)}>
                      <Ionicons name="locate" size={18} color="#fff" />
                      <Text style={styles.gpsBtnText}>Re-Fetch Auto GPS</Text>
                    </TouchableOpacity>

                    {gpsLoading && (
                      <View style={styles.gpsLoading}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.gpsLoadingText}>Getting location…</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.gpsNote}>
                    Saved GPS will be: Manual (if provided) otherwise Auto GPS.
                  </Text>
                </View>

                <View style={styles.groupCard}>
                  <Text style={styles.groupTitle}>Remarks</Text>
                  <FormRow label="Remarks" value={remarks} onChangeText={setRemarks} multiline />
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
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginRight: 12,
  },
  headerContent: {flex: 1},
  headerTitle: {fontSize: 22, fontWeight: '800', color: '#fff'},
  headerSubtitle: {fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2},

  section: {marginHorizontal: 16, marginTop: 12},
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  sectionTitle: {fontSize: 18, fontWeight: '800', color: '#111827'},
  sectionMeta: {fontSize: 12, fontWeight: '900', color: '#6b7280'},
  emptyText: {fontSize: 13, color: '#6b7280'},

  searchFilterRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12},
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {flex: 1, fontSize: 14, color: '#111827'},
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {color: '#fff', fontSize: 11, fontWeight: '900'},

  clearAllBtn: {
    marginTop: 10,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  clearAllText: {color: '#fff', fontWeight: '900'},

  tableWrap: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 44,
  },
  thRow: {backgroundColor: 'rgba(14, 165, 233, 0.15)', borderBottomColor: '#cbd5e1'},
  th: {paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, fontWeight: '900', color: '#0f172a'},
  td: {paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, fontWeight: '700', color: '#111827'},
  trEven: {backgroundColor: '#ffffff'},
  trOdd: {backgroundColor: 'rgba(2, 132, 199, 0.04)'},
  actionsCell: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10},
  iconBtn: {padding: 8, borderRadius: 10, backgroundColor: '#f3f4f6'},

  statusCell: {paddingHorizontal: 10, paddingVertical: 10},
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusText: {fontSize: 12, fontWeight: '900'},

  actionOverlay: {flex: 1, backgroundColor: 'rgba(15,23,42,0.35)'},
  filterCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '14%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 12,
    maxHeight: '78%',
  },
  filterHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6},
  filterTitle: {fontSize: 16, fontWeight: '900', color: '#111827'},
  filterApply: {flex: 1, backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center'},
  filterApplyText: {color: '#fff', fontWeight: '900'},
  filterClear: {flex: 1, backgroundColor: '#f3f4f6', paddingVertical: 12, borderRadius: 12, alignItems: 'center'},
  filterClearText: {color: '#111827', fontWeight: '900'},
  filterHint: {fontSize: 12, color: '#374151', fontWeight: '900', marginBottom: 6},
  pillsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8},
  pill: {paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1},
  pillInactive: {backgroundColor: '#fff', borderColor: '#e5e7eb'},
  pillActive: {backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.35)'},
  pillTextInactive: {fontSize: 12, fontWeight: '800', color: '#374151'},
  pillTextActive: {fontSize: 12, fontWeight: '900', color: '#065f46'},

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
  modalCard: {backgroundColor: '#fff', borderRadius: 20, padding: 16, maxHeight: '88%'},
  modalHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  modalTitle: {flex: 1, fontSize: 18, fontWeight: '900', color: '#111827'},
  modalCloseBtn: {padding: 4, borderRadius: 999},

  groupCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  groupTitle: {fontSize: 13, fontWeight: '900', color: '#111827', marginBottom: 8},

  readonlyRow: {marginHorizontal: 4, marginBottom: 8},
  readonlyLabel: {fontSize: 12, color: '#374151', fontWeight: '800', marginBottom: 2},
  readonlyValue: {fontSize: 12, color: '#4b5563', fontWeight: '800'},

  gpsRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6},
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  gpsBtnText: {fontSize: 12, color: '#fff', marginLeft: 6, fontWeight: '900'},
  gpsLoading: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10},
  gpsLoadingText: {fontSize: 12, color: '#374151', fontWeight: '800'},
  gpsNote: {fontSize: 12, color: '#6b7280', fontWeight: '700', marginTop: 8},

  saveBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  saveText: {fontSize: 15, fontWeight: '900', color: '#fff', marginLeft: 8},

  row: {flexDirection: 'row', gap: 10},
  half: {flex: 1},
});
