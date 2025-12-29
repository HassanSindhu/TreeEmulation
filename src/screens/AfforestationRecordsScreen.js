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
import Slider from '@react-native-community/slider';
import {launchImageLibrary} from 'react-native-image-picker';
import {useFocusEffect} from '@react-navigation/native';

import colors from '../theme/colors';
import FormRow from '../components/FormRow';
import {DropdownRow} from '../components/SelectRows';

const STORAGE_KEY = 'AFFORESTATION_RECORDS';

/**
 * Updates requested:
 * 1) GPS:
 *    - Auto fetch ONE coordinate (autoGps) when opening Add (and on Edit if missing)
 *    - Allow MULTIPLE manual coordinates (gpsList[])
 *    - A button to "Add Auto GPS to list" (adds autoGps into gpsList)
 *    - A button to "Fill last with auto GPS" (same behavior as your previous fetchGpsFillLast)
 *
 * 2) Status:
 *    - Status displayed in table (Pending/Approved/Returned)
 *    - NOT editable here
 *    - Default "pending" when creating record
 *    - Officer will approve from upper level later
 *    - Filter includes status
 */

export default function AfforestationRecordsScreen({navigation, route}) {
  const enumeration = route?.params?.enumeration;

  const [records, setRecords] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // ✅ Search + Filters
  const [search, setSearch] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',

    year: '',
    schemeType: '',
    mainSpecies: '',
    status: '',

    successFrom: '',
    successTo: '',
    plantsFrom: '',
    plantsTo: '',
    avgFrom: '',
    avgTo: '',
  });

  // form states
  const [registerNo, setRegisterNo] = useState('');
  const [pageNo, setPageNo] = useState('');
  const [avgMilesKm, setAvgMilesKm] = useState('');
  const [success, setSuccess] = useState(0);
  const [mainSpecies, setMainSpecies] = useState('');
  const [year, setYear] = useState('');
  const [schemeType, setSchemeType] = useState('');
  const [projectName, setProjectName] = useState('');
  const [nonDevScheme, setNonDevScheme] = useState('');
  const [plants, setPlants] = useState('');

  // ✅ GPS: one auto + multiple manual list
  const [autoGps, setAutoGps] = useState(''); // single auto fetched point
  const [gpsList, setGpsList] = useState(['']); // multiple manual points
  const [gpsLoading, setGpsLoading] = useState(false);
  const lastGpsRequestAtRef = useRef(0);

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
    setAvgMilesKm('');
    setSuccess(0);
    setMainSpecies('');
    setYear('');
    setSchemeType('');
    setProjectName('');
    setNonDevScheme('');
    setPlants('');

    // GPS
    setAutoGps('');
    setGpsList(['']);

    setRemarks('');
    setPictureUri(null);
  };

  const fetchAutoGps = (silent = false) => {
    const now = Date.now();
    if (now - lastGpsRequestAtRef.current < 1200) return;
    lastGpsRequestAtRef.current = now;

    setGpsLoading(true);
    Geolocation.getCurrentPosition(
      pos => {
        const {latitude, longitude} = pos.coords;
        const value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setAutoGps(value);
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
    // ✅ auto fetch one coordinate
    setTimeout(() => fetchAutoGps(true), 300);
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

    // GPS
    setAutoGps(record.autoGpsLatLong || '');
    setGpsList(
      Array.isArray(record.gpsBoundingBox) && record.gpsBoundingBox.length
        ? record.gpsBoundingBox
        : ['']
    );

    setRemarks(record.remarks || '');
    setPictureUri(record.pictureUri || null);

    setModalVisible(true);

    // ✅ auto fetch if missing
    if (!record.autoGpsLatLong) {
      setTimeout(() => fetchAutoGps(true), 300);
    }
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

  // ✅ Add / remove coordinate inputs (manual list)
  const addCoordinateField = () => setGpsList(prev => [...prev, '']);

  const removeCoordinateField = index => {
    setGpsList(prev => {
      const list = [...prev];
      if (list.length === 1) return [''];
      list.splice(index, 1);
      return list;
    });
  };

  // ✅ Fill last field with autoGps (if present). Otherwise fetch first then fill.
  const fillLastWithAuto = () => {
    const apply = (value) => {
      setGpsList(prev => {
        const list = Array.isArray(prev) && prev.length ? [...prev] : [''];
        list[list.length - 1] = value;
        return list;
      });
    };

    if (autoGps?.trim()) {
      apply(autoGps.trim());
      return;
    }

    // fetch then fill
    setGpsLoading(true);
    Geolocation.getCurrentPosition(
      pos => {
        const {latitude, longitude} = pos.coords;
        const value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setAutoGps(value);
        apply(value);
        setGpsLoading(false);
      },
      err => {
        setGpsLoading(false);
        Alert.alert('Location Error', err.message);
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  // ✅ Add autoGps into list as a NEW coordinate (append)
  const addAutoToList = () => {
    const v = (autoGps || '').trim();
    if (!v) {
      Alert.alert('GPS', 'Auto GPS is empty. Tap "Re-Fetch Auto GPS" first.');
      return;
    }
    setGpsList(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      // If list has one empty field, fill it, else append
      if (list.length === 1 && !String(list[0] || '').trim()) {
        list[0] = v;
        return list;
      }
      return [...list, v];
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
            avgMilesKm,
            successPercent: success,
            mainSpecies,
            year,
            schemeType,
            projectName: schemeType === 'Development' ? projectName : '',
            nonDevScheme: schemeType === 'Non Development' ? nonDevScheme : '',
            noOfPlants: plants,

            // ✅ GPS save
            autoGpsLatLong: (autoGps || '').trim(),
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

          // ✅ GPS save
          autoGpsLatLong: (autoGps || '').trim(),
          gpsBoundingBox: cleanGps,

          remarks,
          pictureUri,

          // ✅ default status
          status: 'pending',

          createdAt: new Date().toISOString(),
        };
        const updated = [record, ...arr];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        Alert.alert('Saved', 'Afforestation saved successfully.');
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

  const activeFilterCount = useMemo(() => {
    const adv = Object.values(filters).filter(v => String(v || '').trim() !== '').length;
    const s = search.trim() ? 1 : 0;
    return adv + s;
  }, [filters, search]);

  const clearAll = () => {
    setSearch('');
    setFilters({
      dateFrom: '',
      dateTo: '',
      year: '',
      schemeType: '',
      mainSpecies: '',
      status: '',
      successFrom: '',
      successTo: '',
      plantsFrom: '',
      plantsTo: '',
      avgFrom: '',
      avgTo: '',
    });
  };

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();

    const df = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00') : null;
    const dt = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59') : null;

    const sF = filters.successFrom !== '' ? Number(filters.successFrom) : null;
    const sT = filters.successTo !== '' ? Number(filters.successTo) : null;

    const pF = filters.plantsFrom !== '' ? Number(filters.plantsFrom) : null;
    const pT = filters.plantsTo !== '' ? Number(filters.plantsTo) : null;

    const aF = filters.avgFrom !== '' ? Number(filters.avgFrom) : null;
    const aT = filters.avgTo !== '' ? Number(filters.avgTo) : null;

    return records.filter(r => {
      if (filters.status && (r.status || 'pending') !== filters.status) return false;
      if (filters.year && r.year !== filters.year) return false;
      if (filters.schemeType && r.schemeType !== filters.schemeType) return false;
      if (filters.mainSpecies && r.mainSpecies !== filters.mainSpecies) return false;

      if ((df || dt) && r.createdAt) {
        const d = new Date(r.createdAt);
        if (df && d < df) return false;
        if (dt && d > dt) return false;
      } else if ((df || dt) && !r.createdAt) {
        return false;
      }

      if (sF !== null || sT !== null) {
        const val = typeof r.successPercent === 'number' ? r.successPercent : null;
        if (val === null) return false;
        if (sF !== null && val < sF) return false;
        if (sT !== null && val > sT) return false;
      }

      if (pF !== null || pT !== null) {
        const n = toNumber(r.noOfPlants);
        if (n === null) return false;
        if (pF !== null && n < pF) return false;
        if (pT !== null && n > pT) return false;
      }

      if (aF !== null || aT !== null) {
        const n = toNumber(r.avgMilesKm);
        if (n === null) return false;
        if (aF !== null && n < aF) return false;
        if (aT !== null && n > aT) return false;
      }

      if (!q) return true;
      const gpsText =
        Array.isArray(r.gpsBoundingBox) && r.gpsBoundingBox.length
          ? r.gpsBoundingBox.join(' | ')
          : '';

      const blob = [
        r.year,
        r.schemeType,
        r.mainSpecies,
        r.projectName,
        r.nonDevScheme,
        r.avgMilesKm,
        String(r.successPercent ?? ''),
        String(r.noOfPlants ?? ''),
        r.autoGpsLatLong,
        gpsText,
        r.remarks,
        r.registerNo,
        r.pageNo,
        r.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [records, search, filters]);

  function toNumber(v) {
    if (v === null || v === undefined) return null;
    const m = String(v).match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }

  const statusBadge = (st) => {
    const key = (st || 'pending');
    if (key === 'approved') return {label: 'Approved', color: '#16a34a', icon: 'checkmark-done'};
    if (key === 'returned') return {label: 'Returned', color: '#ef4444', icon: 'arrow-undo'};
    return {label: 'Pending', color: '#f97316', icon: 'time'};
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
                    <Text style={[styles.th, {width: 110}]}>Year</Text>
                    <Text style={[styles.th, {width: 100}]}>Success %</Text>
                    <Text style={[styles.th, {width: 140}]}>Avg</Text>
                    <Text style={[styles.th, {width: 140}]}>Main Species</Text>
                    <Text style={[styles.th, {width: 150}]}>Scheme</Text>
                    <Text style={[styles.th, {width: 200}]}>Project / Non-Dev</Text>
                    <Text style={[styles.th, {width: 120}]}>Plants</Text>
                    <Text style={[styles.th, {width: 200}]}>Auto GPS</Text>
                    <Text style={[styles.th, {width: 280}]}>GPS List</Text>
                    <Text style={[styles.th, {width: 160}]}>Status</Text>
                    <Text style={[styles.th, {width: 120}]}>Actions</Text>
                  </View>

                  {filteredRecords.map((r, idx) => {
                    const gpsText =
                      Array.isArray(r.gpsBoundingBox) && r.gpsBoundingBox.length
                        ? r.gpsBoundingBox.join(' | ')
                        : '—';

                    const proj =
                      r.schemeType === 'Development'
                        ? (r.projectName || '—')
                        : r.schemeType === 'Non Development'
                          ? (r.nonDevScheme || '—')
                          : '—';

                    const sb = statusBadge(r.status);

                    return (
                      <View key={r.id} style={[styles.tr, idx % 2 === 0 ? styles.trEven : styles.trOdd]}>
                        <Text style={[styles.td, {width: 110}]} numberOfLines={1}>{r.year || '—'}</Text>
                        <Text style={[styles.td, {width: 100}]} numberOfLines={1}>
                          {typeof r.successPercent === 'number' ? `${r.successPercent}%` : '—'}
                        </Text>
                        <Text style={[styles.td, {width: 140}]} numberOfLines={1}>{r.avgMilesKm || '—'}</Text>
                        <Text style={[styles.td, {width: 140}]} numberOfLines={1}>{r.mainSpecies || '—'}</Text>
                        <Text style={[styles.td, {width: 150}]} numberOfLines={1}>{r.schemeType || '—'}</Text>
                        <Text style={[styles.td, {width: 200}]} numberOfLines={1}>{proj}</Text>
                        <Text style={[styles.td, {width: 120}]} numberOfLines={1}>{r.noOfPlants || '—'}</Text>
                        <Text style={[styles.td, {width: 200}]} numberOfLines={1}>{r.autoGpsLatLong || '—'}</Text>
                        <Text style={[styles.td, {width: 280}]} numberOfLines={1}>{gpsText}</Text>

                        <View style={[styles.statusCell, {width: 160}]}>
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
                <DropdownRow
                  label="Year"
                  value={filters.year}
                  onChange={v => setFilters(prev => ({...prev, year: v}))}
                  options={['', ...yearOptions]}
                />
              </View>
              <View style={{flex: 1}}>
                <DropdownRow
                  label="Scheme Type"
                  value={filters.schemeType}
                  onChange={v => setFilters(prev => ({...prev, schemeType: v}))}
                  options={['', ...schemeOptions]}
                />
              </View>
            </View>

            <DropdownRow
              label="Main Species"
              value={filters.mainSpecies}
              onChange={v => setFilters(prev => ({...prev, mainSpecies: v}))}
              options={['', ...speciesOptions]}
            />

            <View style={{flexDirection: 'row', gap: 10}}>
              <View style={{flex: 1}}>
                <FormRow
                  label="Success % From (>=)"
                  value={filters.successFrom}
                  onChangeText={v => setFilters(prev => ({...prev, successFrom: v}))}
                  placeholder="e.g. 10"
                  keyboardType="numeric"
                />
              </View>
              <View style={{flex: 1}}>
                <FormRow
                  label="Success % To (<=)"
                  value={filters.successTo}
                  onChangeText={v => setFilters(prev => ({...prev, successTo: v}))}
                  placeholder="e.g. 90"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={{flexDirection: 'row', gap: 10}}>
              <View style={{flex: 1}}>
                <FormRow
                  label="Plants From (>=)"
                  value={filters.plantsFrom}
                  onChangeText={v => setFilters(prev => ({...prev, plantsFrom: v}))}
                  placeholder="e.g. 1000"
                  keyboardType="numeric"
                />
              </View>
              <View style={{flex: 1}}>
                <FormRow
                  label="Plants To (<=)"
                  value={filters.plantsTo}
                  onChangeText={v => setFilters(prev => ({...prev, plantsTo: v}))}
                  placeholder="e.g. 5000"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={{flexDirection: 'row', gap: 10}}>
              <View style={{flex: 1}}>
                <FormRow
                  label="Avg Miles/KM From (>=)"
                  value={filters.avgFrom}
                  onChangeText={v => setFilters(prev => ({...prev, avgFrom: v}))}
                  placeholder="e.g. 1"
                  keyboardType="numeric"
                />
              </View>
              <View style={{flex: 1}}>
                <FormRow
                  label="Avg Miles/KM To (<=)"
                  value={filters.avgTo}
                  onChangeText={v => setFilters(prev => ({...prev, avgTo: v}))}
                  placeholder="e.g. 10"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
              <TouchableOpacity style={styles.filterApply} onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.filterApplyText}>Apply</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterClear}
                onPress={() =>
                  setFilters({
                    dateFrom: '',
                    dateTo: '',
                    year: '',
                    schemeType: '',
                    mainSpecies: '',
                    status: '',
                    successFrom: '',
                    successTo: '',
                    plantsFrom: '',
                    plantsTo: '',
                    avgFrom: '',
                    avgTo: '',
                  })
                }>
                <Text style={styles.filterClearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Add/Edit Modal */}
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

                {/* ✅ Auto GPS + Multiple List */}
                <View style={{marginTop: 10}}>
                  <Text style={styles.gpsTitle}>Location</Text>

                  <View style={styles.autoGpsBox}>
                    <View style={{flex: 1}}>
                      <Text style={styles.autoGpsLabel}>Auto GPS (Single)</Text>
                      <Text style={styles.autoGpsValue}>{autoGps || '—'}</Text>
                    </View>

                    <TouchableOpacity style={styles.autoGpsBtn} onPress={() => fetchAutoGps(false)}>
                      <Ionicons name="locate" size={18} color="#fff" />
                      <Text style={styles.autoGpsBtnText}>Re-Fetch</Text>
                    </TouchableOpacity>
                  </View>

                  {gpsLoading && (
                    <View style={styles.gpsLoadingRow}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.gpsLoadingText}>Getting location…</Text>
                    </View>
                  )}

                  <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                    <TouchableOpacity style={styles.addCoordBtn} onPress={addCoordinateField}>
                      <Ionicons name="add-circle-outline" size={18} color="#fff" />
                      <Text style={styles.addCoordText}>Add Field</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.gpsBtn} onPress={fillLastWithAuto}>
                      <Ionicons name="download-outline" size={18} color="#fff" />
                      <Text style={styles.gpsBtnText}>Fill last</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.addAutoBtn} onPress={addAutoToList}>
                      <Ionicons name="add" size={18} color="#fff" />
                      <Text style={styles.addAutoText}>Add auto</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.gpsNote}>
                    You can add multiple coordinates (boundary). Auto GPS is one point and can be added to list.
                  </Text>

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

                      <TouchableOpacity style={styles.removeCoordBtn} onPress={() => removeCoordinateField(index)}>
                        <Ionicons name="remove-circle-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
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
  sectionHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10},
  sectionTitle: {fontSize: 18, fontWeight: '700', color: '#111827'},
  sectionMeta: {fontSize: 12, fontWeight: '800', color: '#6b7280'},
  emptyText: {fontSize: 13, color: '#6b7280'},

  // Search + Filter
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

  // Table
  tableWrap: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  tr: {flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', minHeight: 44},
  thRow: {backgroundColor: 'rgba(14, 165, 233, 0.15)', borderBottomWidth: 1, borderBottomColor: '#cbd5e1'},
  th: {paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, fontWeight: '800', color: '#0f172a'},
  td: {paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, fontWeight: '600', color: '#111827'},
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

  // Filter modal
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
  filterHint: {fontSize: 12, color: '#374151', fontWeight: '900', marginBottom: 6},
  pillsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8},
  pill: {paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1},
  pillInactive: {backgroundColor: '#fff', borderColor: '#e5e7eb'},
  pillActive: {backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.35)'},
  pillTextInactive: {fontSize: 12, fontWeight: '800', color: '#374151'},
  pillTextActive: {fontSize: 12, fontWeight: '900', color: '#065f46'},
  filterApply: {flex: 1, backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center'},
  filterApplyText: {color: '#fff', fontWeight: '900'},
  filterClear: {flex: 1, backgroundColor: '#f3f4f6', paddingVertical: 12, borderRadius: 12, alignItems: 'center'},
  filterClearText: {color: '#111827', fontWeight: '900'},

  fab: {position: 'absolute', right: 20, bottom: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 9},

  modalRoot: {flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', paddingHorizontal: 16},
  modalCard: {backgroundColor: '#fff', borderRadius: 20, padding: 16, maxHeight: '88%'},
  modalHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  modalTitle: {flex: 1, fontSize: 18, fontWeight: '700', color: '#111827'},
  modalCloseBtn: {padding: 4, borderRadius: 999},

  sliderBlock: {marginTop: 8, marginBottom: 12},
  sliderLabel: {fontSize: 14, color: '#374151', fontWeight: '600', marginBottom: 4},
  sliderValue: {fontSize: 13, color: '#111827', fontWeight: '700', textAlign: 'right', marginTop: -4},

  // GPS styles
  gpsTitle: {fontSize: 14, color: '#374151', fontWeight: '700', marginBottom: 6},
  autoGpsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  autoGpsLabel: {fontSize: 12, color: '#374151', fontWeight: '800'},
  autoGpsValue: {fontSize: 12, color: '#111827', fontWeight: '900', marginTop: 2},
  autoGpsBtn: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primary},
  autoGpsBtnText: {fontSize: 12, color: '#fff', fontWeight: '900'},
  gpsLoadingRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8},
  gpsLoadingText: {fontSize: 12, color: '#374151', fontWeight: '800'},
  gpsNote: {fontSize: 12, color: '#6b7280', marginTop: 8, fontWeight: '700'},

  coordRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  removeCoordBtn: {marginTop: 22, padding: 6},

  addCoordBtn: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#0ea5e9'},
  addCoordText: {fontSize: 12, color: '#fff', marginLeft: 6, fontWeight: '900'},

  gpsBtn: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primary},
  gpsBtnText: {fontSize: 12, color: '#fff', marginLeft: 6, fontWeight: '900'},

  addAutoBtn: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#16a34a'},
  addAutoText: {fontSize: 12, color: '#fff', marginLeft: 6, fontWeight: '900'},

  pickLabel: {fontSize: 14, color: '#374151', fontWeight: '600', marginBottom: 4},
  imageBtn: {flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primary},
  imageBtnText: {fontSize: 13, color: '#fff', marginLeft: 8, fontWeight: '700'},
  imageOk: {fontSize: 12, color: '#16a34a', marginTop: 6},
  imageMuted: {fontSize: 12, color: '#9ca3af', marginTop: 6},

  saveBtn: {marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary},
  saveText: {fontSize: 15, fontWeight: '700', color: '#fff', marginLeft: 8},
});
