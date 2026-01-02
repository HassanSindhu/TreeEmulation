// /screens/PoleCropRecordsScreen.js
// ✅ Server-only Pole Crop (offline AsyncStorage removed)
// ✅ Integrated APIs (GET list + POST create)
// ✅ Removed: Register No, Page No, System Generated ID, Remarks
// ✅ Uses Species API to show human-readable names + send species_ids[]
// ✅ Fixes React error "Objects are not valid as a React child" by keeping dropdown/multiselect values as STRINGS only

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import {useFocusEffect} from '@react-navigation/native';

import colors from '../theme/colors';
import FormRow from '../components/FormRow';
import {MultiSelectRow} from '../components/SelectRows';

const API_BASE = 'http://be.lte.gisforestry.com';

// Species (same as your other screens)
const SPECIES_URL = `${API_BASE}/enum/species`;

// Pole Crop APIs you provided
const POLE_CROP_LIST_URL = `${API_BASE}/enum/pole-crop/user-site-wise-pole-crop`;
const POLE_CROP_CREATE_URL = `${API_BASE}/enum/pole-crop`;

const getToken = async () => (await AsyncStorage.getItem('AUTH_TOKEN')) || '';

const normalizeList = json => {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (typeof json === 'object' && Array.isArray(json.data)) return json.data;
  return [];
};

const formatLatLng = (lat, lng) => `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;

const parseLatLng = str => {
  const s = String(str || '').trim();
  if (!s) return {lat: null, lng: null};
  const parts = s
    .split(/,|\s+/)
    .map(p => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return {lat: null, lng: null};
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return {lat: null, lng: null};
  return {lat, lng};
};

export default function PoleCropRecordsScreen({navigation, route}) {
  const enumeration = route?.params?.enumeration;

  // ---------------------------
  // SERVER RECORDS
  // ---------------------------
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [serverError, setServerError] = useState('');

  // ---------------------------
  // SEARCH + FILTERS (server-side filtering in UI)
  // ---------------------------
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
    status: '',
  });

  // ---------------------------
  // SPECIES (server)
  // Keep UI values as STRING NAMES only (to avoid React child object error)
  // ---------------------------
  const [speciesRows, setSpeciesRows] = useState([]); // [{id,name}]
  const [speciesOptions, setSpeciesOptions] = useState([]); // string[]
  const [speciesLoading, setSpeciesLoading] = useState(false);

  // ---------------------------
  // MODAL + FORM
  // ---------------------------
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingServerId, setEditingServerId] = useState(null);

  const [rdFrom, setRdFrom] = useState('');
  const [rdTo, setRdTo] = useState('');
  const [count, setCount] = useState('');

  // Multi-select species names (strings)
  const [selectedSpeciesNames, setSelectedSpeciesNames] = useState([]);

  // GPS (auto + manual)
  const [autoGps, setAutoGps] = useState('');
  const [manualGps, setManualGps] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const lastGpsRequestAtRef = useRef(0);

  const nameOfSiteId = useMemo(() => {
    // use same logic as your other screens
    return enumeration?.name_of_site_id ?? enumeration?.id ?? null;
  }, [enumeration]);

  // ---------------------------
  // FETCH: Species
  // ---------------------------
  const fetchSpecies = useCallback(async () => {
    try {
      setSpeciesLoading(true);
      const res = await fetch(SPECIES_URL);
      const json = await res.json().catch(() => null);
      const rows = normalizeList(json);

      const normalized = rows
        .map(x => {
          if (typeof x === 'string') return {id: null, name: x};
          return {
            id: x?.id ?? x?.species_id ?? null,
            name: x?.name ?? x?.species_name ?? '',
          };
        })
        .filter(x => x.name);

      setSpeciesRows(normalized);
      setSpeciesOptions(normalized.map(x => x.name)); // ✅ string[] only
    } catch (e) {
      setSpeciesRows([]);
      setSpeciesOptions([]);
    } finally {
      setSpeciesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpecies();
  }, [fetchSpecies]);

  // ---------------------------
  // FETCH: Pole Crop records (server)
  // ---------------------------
  const fetchPoleCropRecords = useCallback(
    async ({refresh = false} = {}) => {
      if (!nameOfSiteId) {
        setServerError('Missing nameOfSiteId / site id in route params.');
        setRecords([]);
        return;
      }

      try {
        refresh ? setRefreshing(true) : setLoading(true);
        setServerError('');

        const token = await getToken();
        if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

        const res = await fetch(POLE_CROP_LIST_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({nameOfSiteId: Number(nameOfSiteId)}),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = json?.message || json?.error || `API Error (${res.status})`;
          throw new Error(msg);
        }

        const rows = Array.isArray(json?.data) ? json.data : normalizeList(json);
        setRecords(Array.isArray(rows) ? rows : []);
      } catch (e) {
        setRecords([]);
        setServerError(e?.message || 'Failed to fetch records');
      } finally {
        refresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [nameOfSiteId],
  );

  useEffect(() => {
    fetchPoleCropRecords();
  }, [fetchPoleCropRecords]);

  useFocusEffect(
    useCallback(() => {
      fetchPoleCropRecords({refresh: true});
    }, [fetchPoleCropRecords]),
  );

  // ---------------------------
  // GPS helpers
  // ---------------------------
  const fetchGps = useCallback((silent = false) => {
    const now = Date.now();
    if (now - lastGpsRequestAtRef.current < 1200) return;
    lastGpsRequestAtRef.current = now;

    setGpsLoading(true);
    Geolocation.getCurrentPosition(
      pos => {
        const {latitude, longitude} = pos.coords;
        setAutoGps(formatLatLng(latitude, longitude));
        setGpsLoading(false);
      },
      err => {
        setGpsLoading(false);
        if (!silent) Alert.alert('Location Error', err.message);
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  }, []);

  const resolveFinalGps = () => {
    const m = String(manualGps || '').trim();
    const a = String(autoGps || '').trim();
    return m ? m : a;
  };

  // ---------------------------
  // FORM: open / reset / edit
  // ---------------------------
  const resetFormForAdd = () => {
    setIsEdit(false);
    setEditingServerId(null);

    setRdFrom('');
    setRdTo('');
    setCount('');

    setSelectedSpeciesNames([]);

    setAutoGps('');
    setManualGps('');
  };

  const openAddForm = () => {
    resetFormForAdd();
    setModalVisible(true);
    setTimeout(() => fetchGps(true), 250);
  };

  const openEditFormServer = row => {
    setIsEdit(true);
    setEditingServerId(row?.id ?? null);

    setRdFrom(String(row?.rds_from ?? row?.rd_from ?? row?.rdFrom ?? ''));
    setRdTo(String(row?.rds_to ?? row?.rd_to ?? row?.rdTo ?? ''));
    setCount(String(row?.count ?? ''));

    // species_ids -> map to names for MultiSelectRow
    const ids = Array.isArray(row?.species_ids) ? row.species_ids : [];
    const names = ids
      .map(id => speciesRows.find(s => String(s.id) === String(id))?.name)
      .filter(Boolean);

    setSelectedSpeciesNames(names);

    // GPS
    const auto =
      row?.auto_lat != null && row?.auto_long != null ? `${row.auto_lat}, ${row.auto_long}` : '';
    const manual =
      row?.manual_lat != null && row?.manual_long != null
        ? `${row.manual_lat}, ${row.manual_long}`
        : '';

    setAutoGps(auto);
    setManualGps(manual || '');

    setModalVisible(true);

    if (!auto) setTimeout(() => fetchGps(true), 250);
  };

  // If species list arrives after opening edit modal, re-map IDs -> names
  useEffect(() => {
    if (!modalVisible || !isEdit) return;
    if (!editingServerId) return;

    const row = records.find(r => String(r.id) === String(editingServerId));
    if (!row) return;

    const ids = Array.isArray(row?.species_ids) ? row.species_ids : [];
    if (!ids.length) return;

    const names = ids
      .map(id => speciesRows.find(s => String(s.id) === String(id))?.name)
      .filter(Boolean);

    if (names.length && !selectedSpeciesNames.length) {
      setSelectedSpeciesNames(names);
    }
  }, [speciesRows, modalVisible, isEdit, editingServerId, records, selectedSpeciesNames.length]);

  // ---------------------------
  // VALIDATION + POST
  // ---------------------------
  const validate = () => {
    if (!nameOfSiteId) {
      Alert.alert('Error', 'Parent site id missing.');
      return false;
    }
    if (!String(rdFrom || '').trim() || !String(rdTo || '').trim()) {
      Alert.alert('Missing', 'RDS From and RDS To are required.');
      return false;
    }
    if (!String(count || '').trim()) {
      Alert.alert('Missing', 'Count is required.');
      return false;
    }
    const countNum = Number(count);
    if (!Number.isFinite(countNum) || countNum <= 0) {
      Alert.alert('Invalid', 'Count must be a positive number.');
      return false;
    }
    if (!selectedSpeciesNames?.length) {
      Alert.alert('Missing', 'Please select at least one species.');
      return false;
    }

    // GPS not mandatory (as per your previous behavior) but warn
    if (!resolveFinalGps()) {
      Alert.alert('GPS', 'GPS is empty. You can save, but please add coordinates if required.');
    }
    return true;
  };

  const submitToApi = async body => {
    const token = await getToken();
    if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

    const res = await fetch(POLE_CROP_CREATE_URL, {
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

  const upsertRecord = async () => {
    if (!validate()) return;

    // species names -> ids
    const speciesIds = selectedSpeciesNames
      .map(n => speciesRows.find(s => s.name === n)?.id)
      .filter(id => id !== null && id !== undefined);

    if (!speciesIds.length) {
      Alert.alert('Species', 'Species mapping failed (missing ids). Please re-open species list.');
      return;
    }

    const rdFromNum = Number(rdFrom);
    const rdToNum = Number(rdTo);
    if (!Number.isFinite(rdFromNum) || !Number.isFinite(rdToNum)) {
      Alert.alert('Invalid', 'RDS From / To must be numeric.');
      return;
    }

    const {lat: autoLat, lng: autoLng} = parseLatLng(autoGps);
    const finalGps = resolveFinalGps();
    const {lat: manualLat, lng: manualLng} = parseLatLng(finalGps);

    const payload = {
      nameOfSiteId: String(nameOfSiteId),
      rds_from: rdFromNum,
      rds_to: rdToNum,
      count: Number(count),
      auto_lat: autoLat,
      auto_long: autoLng,
      manual_lat: manualLat,
      manual_long: manualLng,
      species_ids: speciesIds.map(Number),
    };

    if (isEdit) {
      Alert.alert(
        'Edit not supported',
        'Update API is not provided. Saving will create a NEW pole-crop record on server.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Create New',
            onPress: async () => {
              try {
                await submitToApi(payload);
                setModalVisible(false);
                fetchPoleCropRecords({refresh: true});
                Alert.alert('Success', 'Saved to server.');
              } catch (e) {
                Alert.alert('Error', e?.message || 'Failed to save');
              }
            },
          },
        ],
      );
      return;
    }

    try {
      await submitToApi(payload);
      setModalVisible(false);
      fetchPoleCropRecords({refresh: true});
      Alert.alert('Success', 'Saved to server.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to save');
    }
  };

  // ---------------------------
  // UI computed: decorate rows
  // ---------------------------
  const getSpeciesLabel = r => {
    const ids = Array.isArray(r?.species_ids) ? r.species_ids : [];
    if (!ids.length) return '—';
    const names = ids
      .map(id => speciesRows.find(s => String(s.id) === String(id))?.name || `#${id}`)
      .filter(Boolean);
    return names.length ? names.join(', ') : '—';
  };

  const getGpsLabel = r => {
    const m = r?.manual_lat != null && r?.manual_long != null ? `${r.manual_lat}, ${r.manual_long}` : '';
    const a = r?.auto_lat != null && r?.auto_long != null ? `${r.auto_lat}, ${r.auto_long}` : '';
    return m || a || '—';
  };

  const statusBadge = st => {
    const key = String(st || 'pending').toLowerCase();
    if (key === 'approved') return {label: 'Approved', color: '#16a34a', icon: 'checkmark-done'};
    if (key === 'returned') return {label: 'Returned', color: '#ef4444', icon: 'arrow-undo'};
    return {label: 'Pending', color: '#f97316', icon: 'time'};
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
      const st = String(r?.status || 'pending').toLowerCase();
      if (filters.status && st !== String(filters.status).toLowerCase()) return false;

      if (filters.speciesOne) {
        const label = getSpeciesLabel(r);
        if (!label.toLowerCase().includes(String(filters.speciesOne).toLowerCase())) return false;
      }

      if (df || dt) {
        const dRaw = r?.created_at || r?.createdAt || r?.updated_at;
        if (!dRaw) return false;
        const d = new Date(dRaw);
        if (Number.isNaN(d.getTime())) return false;
        if (df && d < df) return false;
        if (dt && d > dt) return false;
      }

      if (rdF !== null || rdT !== null) {
        const v = Number(r?.rds_from ?? r?.rd_from ?? r?.rdFrom ?? NaN);
        if (!Number.isFinite(v)) return false;
        if (rdF !== null && v < rdF) return false;
        if (rdT !== null && v > rdT) return false;
      }

      if (totF !== null || totT !== null) {
        const total = Number(r?.count ?? NaN);
        if (!Number.isFinite(total)) return false;
        if (totF !== null && total < totF) return false;
        if (totT !== null && total > totT) return false;
      }

      if (!q) return true;

      const blob = [
        r?.id,
        r?.rds_from,
        r?.rds_to,
        r?.count,
        getSpeciesLabel(r),
        getGpsLabel(r),
        r?.status,
        r?.created_at,
      ]
        .filter(v => v !== null && v !== undefined)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [records, search, filters, speciesRows]);

  // ---------------------------
  // RENDER
  // ---------------------------
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
            <Text style={styles.headerSubtitle2}>Site ID: {String(nameOfSiteId ?? '—')}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{paddingBottom: 110}}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPoleCropRecords({refresh: true})}
            />
          }>
          <View style={styles.section}>
            {/* Search + Filter */}
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

            {/* Title */}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Server Records</Text>
              <Text style={styles.sectionMeta}>
                {loading ? 'Loading...' : `${filteredRecords.length} / ${records.length}`}
              </Text>
            </View>

            {!!serverError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>Server fetch error: {serverError}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => fetchPoleCropRecords({refresh: true})}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {!serverError && records.length === 0 ? (
              <Text style={styles.emptyText}>No records yet. Tap + to add.</Text>
            ) : filteredRecords.length === 0 ? (
              <Text style={styles.emptyText}>No record matches your search/filters.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tableWrap}>
                  <View style={[styles.tr, styles.thRow]}>
                    <Text style={[styles.th, {width: 70}]}>ID</Text>
                    <Text style={[styles.th, {width: 110}]}>RDS From</Text>
                    <Text style={[styles.th, {width: 110}]}>RDS To</Text>
                    <Text style={[styles.th, {width: 90}]}>Count</Text>
                    <Text style={[styles.th, {width: 200}]}>Species</Text>
                    <Text style={[styles.th, {width: 180}]}>GPS</Text>
                    <Text style={[styles.th, {width: 170}]}>Status</Text>
                    <Text style={[styles.th, {width: 120}]}>Actions</Text>
                  </View>

                  {filteredRecords.map((r, idx) => {
                    const sb = statusBadge(r?.status);
                    return (
                      <View
                        key={String(r?.id ?? idx)}
                        style={[styles.tr, idx % 2 === 0 ? styles.trEven : styles.trOdd]}>
                        <Text style={[styles.td, {width: 70}]} numberOfLines={1}>
                          {String(r?.id ?? '—')}
                        </Text>
                        <Text style={[styles.td, {width: 110}]} numberOfLines={1}>
                          {String(r?.rds_from ?? '—')}
                        </Text>
                        <Text style={[styles.td, {width: 110}]} numberOfLines={1}>
                          {String(r?.rds_to ?? '—')}
                        </Text>
                        <Text style={[styles.td, {width: 90}]} numberOfLines={1}>
                          {String(r?.count ?? '—')}
                        </Text>
                        <Text style={[styles.td, {width: 200}]} numberOfLines={1}>
                          {getSpeciesLabel(r)}
                        </Text>
                        <Text style={[styles.td, {width: 180}]} numberOfLines={1}>
                          {getGpsLabel(r)}
                        </Text>

                        <View style={[styles.statusCell, {width: 170}]}>
                          <View
                            style={[
                              styles.statusPill,
                              {backgroundColor: `${sb.color}15`, borderColor: `${sb.color}40`},
                            ]}>
                            <Ionicons name={sb.icon} size={14} color={sb.color} />
                            <Text style={[styles.statusText, {color: sb.color}]}>{sb.label}</Text>
                          </View>
                        </View>

                        <View style={[styles.actionsCell, {width: 120}]}>
                          <TouchableOpacity style={styles.iconBtn} onPress={() => openEditFormServer(r)}>
                            <Ionicons name="create-outline" size={18} color="#0ea5e9" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.iconBtn}
                            onPress={() =>
                              Alert.alert('Not available', 'Delete API is not provided yet.')
                            }>
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
                <Text style={!filters.status ? styles.pillTextActive : styles.pillTextInactive}>
                  All
                </Text>
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

            <FormRow
              label="Species contains"
              value={filters.speciesOne}
              onChangeText={v => setFilters(prev => ({...prev, speciesOne: v}))}
              placeholder="Type e.g. Shisham"
            />

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
                  label="RDS From (>=)"
                  value={filters.rdFrom}
                  onChangeText={v => setFilters(prev => ({...prev, rdFrom: v}))}
                  placeholder="e.g. 10"
                  keyboardType="numeric"
                />
              </View>
              <View style={{flex: 1}}>
                <FormRow
                  label="RDS To (<=)"
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
                  label="Count From (>=)"
                  value={filters.totalFrom}
                  onChangeText={v => setFilters(prev => ({...prev, totalFrom: v}))}
                  placeholder="e.g. 100"
                  keyboardType="numeric"
                />
              </View>
              <View style={{flex: 1}}>
                <FormRow
                  label="Count To (<=)"
                  value={filters.totalTo}
                  onChangeText={v => setFilters(prev => ({...prev, totalTo: v}))}
                  placeholder="e.g. 500"
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
              <Text style={styles.modalTitle}>
                {isEdit ? `Edit (Server ID: ${editingServerId ?? '—'})` : 'Add Pole Crop'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.groupCard}>
                  <Text style={styles.groupTitle}>RD / KM</Text>
                  <View style={styles.row}>
                    <View style={styles.half}>
                      <FormRow
                        label="RDS From"
                        value={rdFrom}
                        onChangeText={setRdFrom}
                        placeholder="e.g. 12.5"
                        keyboardType="numeric"
                        required
                      />
                    </View>
                    <View style={styles.half}>
                      <FormRow
                        label="RDS To"
                        value={rdTo}
                        onChangeText={setRdTo}
                        placeholder="e.g. 15.0"
                        keyboardType="numeric"
                        required
                      />
                    </View>
                  </View>

                  <FormRow
                    label="Count"
                    value={count}
                    onChangeText={setCount}
                    placeholder="e.g. 50"
                    keyboardType="numeric"
                    required
                  />
                </View>

                <View style={styles.groupCard}>
                  <Text style={styles.groupTitle}>Species</Text>
                  <MultiSelectRow
                    label={speciesLoading ? 'Species (Loading...)' : 'Species (Multiple)'}
                    values={selectedSpeciesNames} // ✅ strings only
                    onChange={vals => setSelectedSpeciesNames(Array.isArray(vals) ? vals : [])}
                    options={speciesOptions} // ✅ strings only
                    disabled={speciesLoading}
                  />
                  <Text style={styles.helperText}>
                    Selected species will be sent as species_ids[] to the API.
                  </Text>
                </View>

                <View style={styles.groupCard}>
                  <Text style={styles.groupTitle}>Location (Auto + Manual)</Text>

                  <View style={styles.readonlyRow}>
                    <Text style={styles.readonlyLabel}>Auto GPS (Fetched)</Text>
                    <Text style={styles.readonlyValue}>{autoGps || '—'}</Text>
                  </View>

                  <FormRow
                    label="Manual Coordinates (Optional)"
                    value={manualGps}
                    onChangeText={setManualGps}
                    placeholder="e.g. 31.560000, 74.360000"
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

                <TouchableOpacity style={styles.saveBtn} onPress={upsertRecord}>
                  <Ionicons name="save" size={20} color="#fff" />
                  <Text style={styles.saveText}>{isEdit ? 'Save as New' : 'Save'}</Text>
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
  headerSubtitle2: {fontSize: 12, color: '#d1fae5', marginTop: 2, fontWeight: '800'},

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

  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  errorText: {color: '#7f1d1d', fontWeight: '800'},
  retryBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#ef4444',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {color: '#fff', fontWeight: '900'},

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

  modalRoot: {flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', paddingHorizontal: 16},
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
  helperText: {fontSize: 12, color: '#6b7280', fontWeight: '700', marginTop: 6},

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
