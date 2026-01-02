// /screens/MatureTreeRecordsScreen.js
// ✅ Server-only version (offline removed)
//
// Uses APIs:
// - GET  /species
// - GET  /forest-tree-conditions
// - POST /enum/enumeration
// - POST /enum/enumeration/get-user-site-wise-enumeration   { name_of_site_id }
//
// Notes:
// - Bearer token is read from AsyncStorage key: AUTH_TOKEN
// - Site id is taken from route params: enumeration.name_of_site_id (fallback enumeration.id)
// - Actions (Dispose/Superdari) are enabled for server rows
// - Edit/Delete icons are shown but will alert (no API provided yet)

import React, {useCallback, useMemo, useState, useEffect} from 'react';
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
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import NetInfo from '@react-native-community/netinfo';
import {launchImageLibrary} from 'react-native-image-picker';
import {useFocusEffect} from '@react-navigation/native';

import colors from '../theme/colors';
import FormRow from '../components/FormRow';
import {DropdownRow} from '../components/SelectRows'; // IMPORTANT: expects string value + string[] options

const API_BASE = 'http://be.lte.gisforestry.com';

const SPECIES_URL = `${API_BASE}/enum/species`;
const CONDITIONS_URL = `${API_BASE}/forest-tree-conditions`;

const ENUMERATION_SUBMIT_URL = `${API_BASE}/enum/enumeration`;
const ENUMERATION_SITE_WISE_URL = `${API_BASE}/enum/enumeration/get-user-site-wise-enumeration`;

const SUPERDARI_ROUTE = 'SuperdariScreen';
const DISPOSAL_ROUTE = 'Disposal';

export default function MatureTreeRecordsScreen({navigation, route}) {
  const enumeration = route?.params?.enumeration;

  // ---------- SERVER RECORDS ----------
  const [serverRecords, setServerRecords] = useState([]);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverRefreshing, setServerRefreshing] = useState(false);
  const [serverError, setServerError] = useState('');

  // ---------- MODAL ----------
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false); // UI only (real edit API not provided)
  const [editingServerId, setEditingServerId] = useState(null);

  // ---------- SEARCH + FILTERS ----------
  const [search, setSearch] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    species: '',
    condition: '',
    dateFrom: '',
    dateTo: '',
    kmFrom: '',
    kmTo: '',
  });

  // ---------- DROPDOWNS ----------
  const [speciesRows, setSpeciesRows] = useState([]); // [{id,name}]
  const [conditionRows, setConditionRows] = useState([]); // [{id,name}]
  const [speciesOptions, setSpeciesOptions] = useState([]); // string[]
  const [conditionOptions, setConditionOptions] = useState([]); // string[]
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [conditionLoading, setConditionLoading] = useState(false);

  // ---------- FORM FIELDS ----------
  const [rdKm, setRdKm] = useState('');
  const [species, setSpecies] = useState(''); // ✅ ALWAYS keep string name here
  const [speciesId, setSpeciesId] = useState(null);
  const [girth, setGirth] = useState('');
  const [condition, setCondition] = useState(''); // ✅ ALWAYS keep string name here
  const [conditionId, setConditionId] = useState(null);

  // ---------- GPS ----------
  const [gpsAuto, setGpsAuto] = useState('');
  const [gpsManual, setGpsManual] = useState('');
  const [gpsSource, setGpsSource] = useState('');
  const [gpsFetching, setGpsFetching] = useState(false);

  // ---------- IMAGE (UI only; API uses placeholder test.com) ----------
  const [pictureUri, setPictureUri] = useState(null);

  const rdRangeText =
    enumeration?.rdFrom && enumeration?.rdTo
      ? `${enumeration.rdFrom} - ${enumeration.rdTo}`
      : enumeration?.rdFrom || enumeration?.rdTo || '';

  // ---------- HELPERS ----------
  const normalizeList = json => {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    if (typeof json === 'object' && Array.isArray(json.data)) return json.data;
    return [];
  };

  const getAuthToken = async () => {
    const t = await AsyncStorage.getItem('AUTH_TOKEN');
    return t || '';
  };

  const getNameOfSiteId = () => enumeration?.name_of_site_id ?? enumeration?.id ?? null;

  const formatLatLng = (latitude, longitude) =>
    `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;

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

  // ---------- SERVER FETCH ----------
  const fetchServerEnumerations = useCallback(
    async ({refresh = false} = {}) => {
      const siteId = getNameOfSiteId();
      if (!siteId) {
        setServerError('Missing name_of_site_id for server fetch.');
        setServerRecords([]);
        return;
      }

      try {
        refresh ? setServerRefreshing(true) : setServerLoading(true);
        setServerError('');

        const token = await getAuthToken();
        if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

        const res = await fetch(ENUMERATION_SITE_WISE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({name_of_site_id: Number(siteId)}),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = json?.message || json?.error || `API Error (${res.status})`;
          throw new Error(msg);
        }

        const rows = Array.isArray(json?.data) ? json.data : normalizeList(json);
        setServerRecords(Array.isArray(rows) ? rows : []);
      } catch (e) {
        setServerRecords([]);
        setServerError(e?.message || 'Failed to fetch server records');
      } finally {
        refresh ? setServerRefreshing(false) : setServerLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enumeration],
  );

  useEffect(() => {
    fetchServerEnumerations();
  }, [fetchServerEnumerations]);

  useFocusEffect(
    useCallback(() => {
      fetchServerEnumerations({refresh: true});
    }, [fetchServerEnumerations]),
  );

  // ---------- DROPDOWNS ----------
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
      setSpeciesOptions(normalized.map(x => x.name));
    } catch (e) {
      setSpeciesRows([]);
      setSpeciesOptions([]);
    } finally {
      setSpeciesLoading(false);
    }
  }, []);

  const fetchConditions = useCallback(async () => {
    try {
      setConditionLoading(true);

      // token may or may not be required
      const token = await getAuthToken();
      const headers = token ? {Authorization: `Bearer ${token}`} : undefined;

      const res = await fetch(CONDITIONS_URL, {headers});
      const json = await res.json().catch(() => null);
      const rows = normalizeList(json);

      const normalized = rows
        .map(x => {
          if (typeof x === 'string') return {id: null, name: x};
          return {
            id: x?.id ?? x?.condition_id ?? null,
            name: x?.name ?? x?.condition_name ?? '',
          };
        })
        .filter(x => x.name);

      setConditionRows(normalized);
      setConditionOptions(normalized.map(x => x.name));
    } catch (e) {
      setConditionRows([]);
      setConditionOptions([]);
    } finally {
      setConditionLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpecies();
    fetchConditions();
  }, [fetchSpecies, fetchConditions]);

  // ✅ When editing, you have IDs from server. Once lists load, map ID -> name to show selected in dropdown.
  useEffect(() => {
    if (speciesId && !species && speciesRows.length) {
      const row = speciesRows.find(x => String(x.id) === String(speciesId));
      if (row?.name) setSpecies(row.name);
    }
  }, [speciesId, species, speciesRows]);

  useEffect(() => {
    if (conditionId && !condition && conditionRows.length) {
      const row = conditionRows.find(x => String(x.id) === String(conditionId));
      if (row?.name) setCondition(row.name);
    }
  }, [conditionId, condition, conditionRows]);

  // ---------- GPS ----------
  const fetchLocationSmart = useCallback(async ({silent = false} = {}) => {
    try {
      setGpsFetching(true);

      const net = await NetInfo.fetch();
      const online = !!net.isConnected && (net.isInternetReachable ?? true);

      const options = online
        ? {enableHighAccuracy: false, timeout: 12000, maximumAge: 30000}
        : {enableHighAccuracy: true, timeout: 18000, maximumAge: 5000};

      Geolocation.getCurrentPosition(
        pos => {
          const {latitude, longitude} = pos.coords;
          const val = formatLatLng(latitude, longitude);

          setGpsAuto(val);
          setGpsManual(prev => (String(prev || '').trim() ? prev : val));
          setGpsSource(online ? 'NETWORK' : 'GPS');
          setGpsFetching(false);
        },
        err => {
          setGpsFetching(false);
          if (!silent) Alert.alert('Location Error', err.message);
        },
        options,
      );
    } catch (e) {
      setGpsFetching(false);
      if (!silent) Alert.alert('Location Error', e?.message || 'Failed to fetch location');
    }
  }, []);

  // ---------- IMAGE ----------
  const pickImage = () => {
    launchImageLibrary({mediaType: 'photo', quality: 0.7}, res => {
      if (res.assets?.[0]?.uri) setPictureUri(res.assets[0].uri);
    });
  };

  // ---------- ADD / EDIT (UI) ----------
  const resetForm = () => {
    setIsEdit(false);
    setEditingServerId(null);

    setRdKm(rdRangeText || '');
    setSpecies('');
    setSpeciesId(null);
    setGirth('');
    setCondition('');
    setConditionId(null);

    setGpsAuto('');
    setGpsManual('');
    setGpsSource('');
    setPictureUri(null);
  };

  const openAddForm = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditFormServer = row => {
    setIsEdit(true);
    setEditingServerId(row?.id ?? null);

    setRdKm(String(row?.rd_km ?? ''));

    // ✅ set ID first; name will be auto-filled by useEffect after lists exist
    setSpecies('');
    setSpeciesId(row?.species_id ?? null);

    setGirth(String(row?.girth ?? ''));

    setCondition('');
    setConditionId(row?.condition_id ?? null);

    const auto =
      row?.auto_lat != null && row?.auto_long != null ? `${row.auto_lat}, ${row.auto_long}` : '';
    const manual =
      row?.manual_lat != null && row?.manual_long != null
        ? `${row.manual_lat}, ${row.manual_long}`
        : '';

    setGpsAuto(auto);
    setGpsManual(manual || auto);
    setGpsSource(manual ? 'MANUAL' : auto ? 'GPS' : '');

    setPictureUri(null);
    setModalVisible(true);
  };

  useEffect(() => {
    if (!modalVisible) return;
    if (isEdit) return;
    fetchLocationSmart({silent: true});
  }, [modalVisible, isEdit, fetchLocationSmart]);

  // ---------- SUBMIT ----------
  const submitToApi = async body => {
    const token = await getAuthToken();
    if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

    const res = await fetch(ENUMERATION_SUBMIT_URL, {
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

  const saveRecord = async () => {
    const siteId = getNameOfSiteId();
    if (!siteId) return Alert.alert('Missing', 'name_of_site_id not found.');

    // ✅ Ensure IDs (from selection or map)
    const chosenSpeciesId =
      speciesId ?? (speciesRows.find(x => x.name === species)?.id ?? null);

    const chosenConditionId =
      conditionId ?? (conditionRows.find(x => x.name === condition)?.id ?? null);

    if (!chosenSpeciesId) return Alert.alert('Missing', 'Species is required');
    if (!chosenConditionId) return Alert.alert('Missing', 'Condition is required');

    const {lat: autoLat, lng: autoLng} = parseLatLng(gpsAuto);
    const {lat: manualLat, lng: manualLng} = parseLatLng(gpsManual);

    const rdNum = Number(String(rdKm || '').replace(/[^\d.]+/g, ''));
    const rdKmNumber = Number.isFinite(rdNum) ? rdNum : 0;

    const apiBody = {
      name_of_site_id: Number(siteId),
      rd_km: rdKmNumber,
      species_id: Number(chosenSpeciesId),
      girth: girth ? String(girth) : '',
      condition_id: Number(chosenConditionId),
      auto_lat: autoLat,
      auto_long: autoLng,
      manual_lat: manualLat,
      manual_long: manualLng,
      pictures: ['http://test.com/tree1.jpg'],
    };

    if (isEdit) {
      Alert.alert(
        'Edit not supported yet',
        'Server update API is not provided. Currently Save will create a new record on server.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Create New',
            onPress: async () => {
              try {
                await submitToApi(apiBody);
                setModalVisible(false);
                fetchServerEnumerations({refresh: true});
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
      await submitToApi(apiBody);
      setModalVisible(false);
      fetchServerEnumerations({refresh: true});
      Alert.alert('Success', 'Saved to server.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to save');
    }
  };

  // ---------- STATUS + ACTIONS (SERVER ROWS) ----------
  const getStatusText = r => {
    const isDisposed = !!r?.disposal;
    const isSuperdari = !!r?.superdari;

    if (isDisposed && isSuperdari) return 'Disposed + Superdari';
    if (isDisposed) return 'Disposed';
    if (isSuperdari) return 'Superdari';
    return 'Pending';
  };

  const shouldHidePills = r => !!r?.disposal || !!r?.superdari;

  const serverRowsDecorated = useMemo(() => {
    return serverRecords.map(r => ({
      ...r,
      _speciesLabel: r?.species_name ?? (r?.species_id != null ? `#${r.species_id}` : '—'),
      _conditionLabel:
        r?.condition_name ?? (r?.condition_id != null ? `#${r.condition_id}` : '—'),
      _autoGps:
        r?.auto_lat != null && r?.auto_long != null ? `${r.auto_lat}, ${r.auto_long}` : '—',
      _manualGps:
        r?.manual_lat != null && r?.manual_long != null
          ? `${r.manual_lat}, ${r.manual_long}`
          : '—',
    }));
  }, [serverRecords]);

  // ---------- FILTERING (SERVER ONLY) ----------
  const activeFilterCount = useMemo(() => {
    const adv = Object.values(filters).filter(v => String(v || '').trim() !== '').length;
    const s = search.trim() ? 1 : 0;
    return adv + s;
  }, [filters, search]);

  const clearAll = () => {
    setSearch('');
    setFilters({species: '', condition: '', dateFrom: '', dateTo: '', kmFrom: '', kmTo: ''});
  };

  const filteredServer = useMemo(() => {
    const q = search.trim().toLowerCase();

    const df = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00') : null;
    const dt = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59') : null;

    const kmF = filters.kmFrom !== '' ? Number(filters.kmFrom) : null;
    const kmT = filters.kmTo !== '' ? Number(filters.kmTo) : null;

    return serverRowsDecorated.filter(r => {
      if (filters.species) {
        const label = String(r?._speciesLabel || '').toLowerCase();
        if (!label.includes(String(filters.species).toLowerCase())) return false;
      }

      if (filters.condition) {
        const label = String(r?._conditionLabel || '').toLowerCase();
        if (!label.includes(String(filters.condition).toLowerCase())) return false;
      }

      if (df || dt) {
        const d = r?.created_at ? new Date(r.created_at) : null;
        if (!d || Number.isNaN(d.getTime())) return false;
        if (df && d < df) return false;
        if (dt && d > dt) return false;
      }

      if (kmF !== null || kmT !== null) {
        const num = Number(r?.rd_km);
        if (!Number.isFinite(num)) return false;
        if (kmF !== null && num < kmF) return false;
        if (kmT !== null && num > kmT) return false;
      }

      if (!q) return true;

      const blob = [
        r?.id,
        r?.rd_km,
        r?._speciesLabel,
        r?._conditionLabel,
        r?._autoGps,
        r?._manualGps,
        r?.girth,
        r?.created_at,
      ]
        .filter(v => v !== null && v !== undefined)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [serverRowsDecorated, search, filters]);

  // ---------- UI ----------
  return (
    <View style={styles.screen}>
      <ImageBackground source={require('../assets/images/bg.jpg')} style={styles.background}>
        <View style={styles.overlay} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={{flex: 1}}>
            <Text style={styles.headerTitle}>Mature Tree</Text>
            <Text style={styles.headerSubtitle}>
              {enumeration?.division} • {enumeration?.block} • {enumeration?.year}
            </Text>
            <Text style={styles.headerSubtitle2}>Site ID: {String(getNameOfSiteId() ?? '—')}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{paddingBottom: 110}}
          refreshControl={
            <RefreshControl
              refreshing={serverRefreshing}
              onRefresh={() => fetchServerEnumerations({refresh: true})}
            />
          }>

          <View style={styles.section}>
            {/* Search + Filter row */}
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

            {/* Server Records */}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Server Records</Text>
              <Text style={styles.sectionMeta}>
                {serverLoading ? 'Loading...' : `${filteredServer.length} / ${serverRecords.length}`}
              </Text>
            </View>

            {!!serverError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>Server fetch error: {serverError}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => fetchServerEnumerations({refresh: true})}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {!serverError && serverRecords.length === 0 ? (
              <Text style={styles.emptyText}>No server records for this site.</Text>
            ) : filteredServer.length === 0 ? (
              <Text style={styles.emptyText}>No record matches your search/filters.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tableWrap}>
                  {/* Header Row */}
                  <View style={[styles.tr, styles.thRow]}>
                    <Text style={[styles.th, {width: 70}]}>ID</Text>
                    <Text style={[styles.th, {width: 90}]}>RD/KM</Text>
                    <Text style={[styles.th, {width: 120}]}>Species</Text>
                    <Text style={[styles.th, {width: 120}]}>Condition</Text>
                    <Text style={[styles.th, {width: 110}]}>Girth</Text>
                    <Text style={[styles.th, {width: 170}]}>Auto GPS</Text>
                    <Text style={[styles.th, {width: 170}]}>Manual GPS</Text>
                    <Text style={[styles.th, {width: 260}]}>Actions</Text>
                    <Text style={[styles.th, {width: 140}]}>Status</Text>
                  </View>

                  {/* Rows */}
                  {filteredServer.map((r, idx) => {
                    const statusText = getStatusText(r);
                    const hidePills = shouldHidePills(r);

                    return (
                      <View
                        key={String(r.id ?? idx)}
                        style={[styles.tr, idx % 2 === 0 ? styles.trEven : styles.trOdd]}>

                        <Text style={[styles.td, {width: 70}]} numberOfLines={1}>
                          {String(r.id ?? '—')}
                        </Text>

                        <Text style={[styles.td, {width: 90}]} numberOfLines={1}>
                          {String(r.rd_km ?? '—')}
                        </Text>

                        <Text style={[styles.td, {width: 120}]} numberOfLines={1}>
                          {String(r._speciesLabel ?? '—')}
                        </Text>

                        <Text style={[styles.td, {width: 120}]} numberOfLines={1}>
                          {String(r._conditionLabel ?? '—')}
                        </Text>

                        <Text style={[styles.td, {width: 110}]} numberOfLines={1}>
                          {String(r.girth ?? '—')}
                        </Text>

                        <Text style={[styles.td, {width: 170}]} numberOfLines={1}>
                          {String(r._autoGps ?? '—')}
                        </Text>

                        <Text style={[styles.td, {width: 170}]} numberOfLines={1}>
                          {String(r._manualGps ?? '—')}
                        </Text>

                        <View style={[styles.actionsCell, {width: 260}]}>
                          {/* Edit (UI only) */}
                          <TouchableOpacity onPress={() => openEditFormServer(r)} style={styles.iconBtn}>
                            <Ionicons name="create-outline" size={18} color="#0ea5e9" />
                          </TouchableOpacity>

                          {/* Delete (no API yet) */}
                          <TouchableOpacity
                            onPress={() =>
                              Alert.alert('Not available', 'Delete API is not provided yet.')
                            }
                            style={styles.iconBtn}>
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>

                          {!hidePills && (
                            <>
                              <TouchableOpacity
                                onPress={() =>
                                  navigation.navigate(DISPOSAL_ROUTE, {treeId: r.id, enumeration})
                                }
                                style={[styles.smallPill, {backgroundColor: '#0f766e'}]}>
                                <Text style={styles.smallPillText}>Dispose</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() =>
                                  navigation.navigate(SUPERDARI_ROUTE, {treeId: r.id, enumeration})
                                }
                                style={[styles.smallPill, {backgroundColor: '#7c3aed'}]}>
                                <Text style={styles.smallPillText}>Superdari</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>

                        <Text style={[styles.td, {width: 140}]} numberOfLines={1}>
                          {statusText}
                        </Text>
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

        {/* FAB */}
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
            <DropdownRow
              label={speciesLoading ? 'Species (Loading...)' : 'Species'}
              value={filters.species}
              onChange={v => setFilters(prev => ({...prev, species: v}))}
              options={speciesOptions}
              disabled={speciesLoading}
            />

            <DropdownRow
              label={conditionLoading ? 'Condition (Loading...)' : 'Condition'}
              value={filters.condition}
              onChange={v => setFilters(prev => ({...prev, condition: v}))}
              options={conditionOptions}
              disabled={conditionLoading}
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
                  label="RD/KM From"
                  value={filters.kmFrom}
                  onChangeText={v => setFilters(prev => ({...prev, kmFrom: v}))}
                  placeholder="e.g. 10"
                  keyboardType="numeric"
                />
              </View>
              <View style={{flex: 1}}>
                <FormRow
                  label="RD/KM To"
                  value={filters.kmTo}
                  onChangeText={v => setFilters(prev => ({...prev, kmTo: v}))}
                  placeholder="e.g. 50"
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
                    species: '',
                    condition: '',
                    dateFrom: '',
                    dateTo: '',
                    kmFrom: '',
                    kmTo: '',
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
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEdit ? `Edit (Server ID: ${editingServerId ?? '—'})` : 'Add Mature Tree'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>

              <KeyboardAvoidingView
                style={{flex: 1}}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
                <ScrollView
                  style={{flex: 1}}
                  contentContainerStyle={{paddingBottom: 16}}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}>

                  <FormRow label="RD/KM" value={rdKm} onChangeText={setRdKm} />

                  {/* ✅ DropdownRow uses STRING value + STRING[] options */}
                  <DropdownRow
                    label={speciesLoading ? 'Species (Loading...)' : 'Species'}
                    value={species}
                    onChange={name => {
                      setSpecies(name);
                      const row = speciesRows.find(x => x.name === name);
                      setSpeciesId(row?.id ?? null);
                    }}
                    options={speciesOptions}
                    disabled={speciesLoading}
                    required
                  />

                  <FormRow
                    label="Girth"
                    value={girth}
                    onChangeText={setGirth}
                    placeholder='e.g. "24 inches"'
                  />

                  <DropdownRow
                    label={conditionLoading ? 'Condition (Loading...)' : 'Condition'}
                    value={condition}
                    onChange={name => {
                      setCondition(name);
                      const row = conditionRows.find(x => x.name === name);
                      setConditionId(row?.id ?? null);
                    }}
                    options={conditionOptions}
                    disabled={conditionLoading}
                    required
                  />

                  {/* Auto GPS */}
                  <View style={styles.gpsBox}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                      <Text style={styles.gpsLabel}>Auto Coordinates</Text>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                        {!!gpsSource && (
                          <View style={styles.gpsChip}>
                            <Text style={styles.gpsChipText}>{gpsSource}</Text>
                          </View>
                        )}
                        {gpsFetching && <Text style={styles.gpsSmall}>Fetching…</Text>}
                      </View>
                    </View>

                    <Text style={styles.gpsValue}>{gpsAuto ? gpsAuto : '—'}</Text>

                    <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                      <TouchableOpacity
                        style={[styles.gpsBtn, {opacity: gpsFetching ? 0.6 : 1}]}
                        disabled={gpsFetching}
                        onPress={() => fetchLocationSmart()}>
                        <Text style={styles.gpsBtnText}>Auto Fetch</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.gpsBtnAlt}
                        onPress={() => {
                          setGpsFetching(true);
                          Geolocation.getCurrentPosition(
                            pos => {
                              const {latitude, longitude} = pos.coords;
                              const val = formatLatLng(latitude, longitude);
                              setGpsAuto(val);
                              setGpsManual(prev => (String(prev || '').trim() ? prev : val));
                              setGpsSource('GPS');
                              setGpsFetching(false);
                            },
                            err => {
                              setGpsFetching(false);
                              Alert.alert('Location Error', err.message);
                            },
                            {enableHighAccuracy: true, timeout: 18000, maximumAge: 5000},
                          );
                        }}>
                        <Text style={styles.gpsBtnAltText}>Use GPS</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <FormRow
                    label="Coordinates (Manual) lat, long"
                    value={gpsManual}
                    onChangeText={t => {
                      setGpsManual(t);
                      setGpsSource(String(t || '').trim() ? 'MANUAL' : gpsSource);
                    }}
                    placeholder="e.g. 31.520370, 74.358749"
                  />

                  <View style={styles.finalGpsRow}>
                    <Text style={styles.finalGpsLabel}>Will Save:</Text>
                    <Text style={styles.finalGpsValue}>
                      {(gpsManual || '').trim() || (gpsAuto || '').trim() || '—'}
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                    <Text style={styles.imageBtnText}>
                      Pick Image (local) — API sends http://test.com/tree1.jpg
                    </Text>
                  </TouchableOpacity>

                  {!!pictureUri && (
                    <Text style={{marginTop: 8, fontSize: 12, color: '#6b7280'}}>
                      Selected (local): {pictureUri}
                    </Text>
                  )}
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.saveBtn} onPress={saveRecord}>
                    <Text style={styles.saveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  background: {flex: 1},
  overlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,185,129,0.1)'},

  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'rgba(16,185,129,0.85)',
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginTop: 2,
  },
  headerTitle: {fontSize: 22, fontWeight: '800', color: '#fff'},
  headerSubtitle: {fontSize: 13, color: '#e5e7eb', marginTop: 2},
  headerSubtitle2: {fontSize: 12, color: '#d1fae5', marginTop: 2, fontWeight: '700'},

  section: {margin: 16},
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  sectionTitle: {fontSize: 18, fontWeight: '700', color: '#ffffff'},
  sectionMeta: {fontSize: 12, fontWeight: '800', color: '#ffffff'},
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
  thRow: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  th: {paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, fontWeight: '800', color: '#0f172a'},
  td: {paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, fontWeight: '600', color: '#111827'},
  trEven: {backgroundColor: '#ffffff'},
  trOdd: {backgroundColor: 'rgba(2, 132, 199, 0.04)'},

  actionsCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  iconBtn: {padding: 6, borderRadius: 10, backgroundColor: 'rgba(15,23,42,0.04)'},
  smallPill: {paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999},
  smallPillText: {color: '#fff', fontWeight: '800', fontSize: 11},

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
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  filterTitle: {fontSize: 16, fontWeight: '900', color: '#111827'},
  filterApply: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterApplyText: {color: '#fff', fontWeight: '900'},
  filterClear: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterClearText: {color: '#111827', fontWeight: '900'},

  modalRoot: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingVertical: 18},
  modalCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    height: '90%',
  },
  modalTitle: {fontSize: 16, fontWeight: '800'},
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10},
  modalFooter: {borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, flexDirection: 'row', gap: 10},
  cancelBtn: {flex: 1, backgroundColor: '#f3f4f6', paddingVertical: 14, borderRadius: 14, alignItems: 'center'},
  cancelText: {color: '#111827', fontWeight: '900'},
  saveBtn: {flex: 1, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center'},
  saveText: {color: '#fff', fontWeight: '800'},

  gpsBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  gpsLabel: {fontSize: 12, fontWeight: '900', color: '#111827'},
  gpsValue: {marginTop: 6, fontSize: 14, fontWeight: '700', color: '#111827'},
  gpsSmall: {fontSize: 12, color: '#6b7280', fontWeight: '700'},
  gpsChip: {backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4},
  gpsChipText: {fontSize: 11, fontWeight: '900', color: '#065f46'},
  gpsBtn: {flex: 1, backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 12, alignItems: 'center'},
  gpsBtnText: {color: '#fff', fontWeight: '900'},
  gpsBtnAlt: {flex: 1, backgroundColor: '#111827', paddingVertical: 10, borderRadius: 12, alignItems: 'center'},
  gpsBtnAltText: {color: '#fff', fontWeight: '900'},

  finalGpsRow: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  finalGpsLabel: {fontSize: 12, fontWeight: '900', color: '#111827'},
  finalGpsValue: {fontSize: 12, fontWeight: '800', color: '#111827'},

  imageBtn: {
    marginTop: 10,
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  imageBtnText: {color: '#fff', fontWeight: '700'},
});
