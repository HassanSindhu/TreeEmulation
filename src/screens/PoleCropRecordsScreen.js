// /screens/PoleCropRecordsScreen.js
// ✅ Professional UI Update

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import {useFocusEffect} from '@react-navigation/native';
import {launchImageLibrary} from 'react-native-image-picker';

import FormRow from '../components/FormRow';
import {MultiSelectRow} from '../components/SelectRows';

const {width, height} = Dimensions.get('window');

// Theme Colors
const COLORS = {
  primary: '#059669',
  primaryLight: '#10b981',
  primaryDark: '#047857',
  secondary: '#0ea5e9',
  success: '#16a34a',
  warning: '#f97316',
  danger: '#dc2626',
  info: '#7c3aed',
  background: '#f8fafc',
  card: '#ffffff',
  text: '#1f2937',
  textLight: '#6b7280',
  border: '#e5e7eb',
  overlay: 'rgba(15, 23, 42, 0.7)',
};

// ✅ LATEST BASE
const API_BASE = 'http://be.lte.gisforestry.com';
const AWS_Base = 'https://app.eco.gisforestry.com';
// Species
const SPECIES_URL = `${API_BASE}/enum/species`;

// Pole Crop APIs
const POLE_CROP_LIST_URL = `${API_BASE}/enum/pole-crop/user-site-wise-pole-crop`;
const POLE_CROP_CREATE_URL = `${API_BASE}/enum/pole-crop`;

// ✅ Bucket Upload API (Polecrop)
const BUCKET_UPLOAD_URL = `${AWS_Base}/aws-bucket/tree-enum`;
const BUCKET_UPLOAD_PATH = 'Polecrop';
const BUCKET_IS_MULTI = 'true';
const BUCKET_FILE_NAME = 'chan';

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

// RN form-data file helper
const toFormFile = asset => {
  const uri = asset?.uri;
  if (!uri) return null;

  const name =
    asset?.fileName ||
    `polecrop_${Date.now()}${asset?.type?.includes('png') ? '.png' : '.jpg'}`;

  const type = asset?.type || 'image/jpeg';

  return {uri, name, type};
};

export default function PoleCropRecordsScreen({navigation, route}) {
  const enumeration = route?.params?.enumeration;

  // ---------- STATE ----------
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [serverError, setServerError] = useState('');
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
  const [speciesRows, setSpeciesRows] = useState([]);
  const [speciesOptions, setSpeciesOptions] = useState([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingServerId, setEditingServerId] = useState(null);
  const [rdFrom, setRdFrom] = useState('');
  const [rdTo, setRdTo] = useState('');
  const [count, setCount] = useState('');
  const [selectedSpeciesNames, setSelectedSpeciesNames] = useState([]);
  const [autoGps, setAutoGps] = useState('');
  const [manualGps, setManualGps] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [pickedAssets, setPickedAssets] = useState([]);

  const lastGpsRequestAtRef = useRef(0);

  const nameOfSiteId = useMemo(() => {
    return enumeration?.name_of_site_id ?? enumeration?.id ?? null;
  }, [enumeration]);

  // ---------- IMAGE HANDLERS ----------
  const pickImages = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 0,
      },
      res => {
        if (res?.didCancel) return;
        if (res?.errorCode) {
          Alert.alert('Image Error', res.errorMessage || res.errorCode);
          return;
        }
        const assets = Array.isArray(res?.assets) ? res.assets : [];
        if (!assets.length) return;
        setPickedAssets(assets);
      },
    );
  };

  const clearImages = () => setPickedAssets([]);

  // ---------- UPLOAD IMAGES ----------
  const uploadPoleCropImages = async () => {
    if (!pickedAssets.length) return [];

    const form = new FormData();
    pickedAssets.forEach(a => {
      const f = toFormFile(a);
      if (f) form.append('files', f);
    });

    form.append('uploadPath', BUCKET_UPLOAD_PATH);
    form.append('isMulti', BUCKET_IS_MULTI);
    form.append('fileName', BUCKET_FILE_NAME);

    const res = await fetch(BUCKET_UPLOAD_URL, {
      method: 'POST',
      body: form,
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.status) {
      const msg = json?.message || json?.error || `Bucket upload failed (${res.status})`;
      throw new Error(msg);
    }

    const data = Array.isArray(json?.data) ? json.data : [];
    const urls = [];

    data.forEach(item => {
      const img = item?.availableSizes?.image;
      if (img) urls.push(img);

      const arr = Array.isArray(item?.url) ? item.url : [];
      arr.forEach(u => {
        if (u && !urls.includes(u)) urls.push(u);
      });
    });

    return urls;
  };

  // ---------- SPECIES FETCH ----------
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

  useEffect(() => {
    fetchSpecies();
  }, [fetchSpecies]);

  // ---------- RECORDS FETCH ----------
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

  // ---------- GPS ----------
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
    return m || String(autoGps || '').trim();
  };

  // ---------- FORM HANDLERS ----------
  const resetFormForAdd = () => {
    setIsEdit(false);
    setEditingServerId(null);
    setRdFrom('');
    setRdTo('');
    setCount('');
    setSelectedSpeciesNames([]);
    setAutoGps('');
    setManualGps('');
    setPickedAssets([]);
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

    const ids = Array.isArray(row?.species_ids) ? row.species_ids : [];
    const names = ids
      .map(id => speciesRows.find(s => String(s.id) === String(id))?.name)
      .filter(Boolean);

    setSelectedSpeciesNames(names);

    const auto =
      row?.auto_lat != null && row?.auto_long != null ? `${row.auto_lat}, ${row.auto_long}` : '';
    const manual =
      row?.manual_lat != null && row?.manual_long != null
        ? `${row.manual_lat}, ${row.manual_long}`
        : '';

    setAutoGps(auto);
    const availableGps = manual || auto || '';
    setManualGps(availableGps);
    setPickedAssets([]);
    setModalVisible(true);

    if (!auto) setTimeout(() => fetchGps(true), 250);
  };

  // ---------- VALIDATION ----------
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
    return true;
  };

  // ---------- SUBMIT ----------
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

    try {
      const uploadedUrls = await uploadPoleCropImages();

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
        pictures: uploadedUrls,
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

      await submitToApi(payload);
      setModalVisible(false);
      fetchPoleCropRecords({refresh: true});
      Alert.alert('Success', 'Saved to server.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to save');
    }
  };

  // ---------- UI HELPERS ----------
  const getSpeciesLabel = r => {
    const ids = Array.isArray(r?.species_ids) ? r.species_ids : [];
    if (!ids.length) return '—';
    const names = ids
      .map(id => speciesRows.find(s => String(s.id) === String(id))?.name || `#${id}`)
      .filter(Boolean);
    return names.length > 2 
      ? `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
      : names.join(', ');
  };

  const getGpsLabel = r => {
    const m =
      r?.manual_lat != null && r?.manual_long != null ? `${r.manual_lat}, ${r.manual_long}` : '';
    const a = r?.auto_lat != null && r?.auto_long != null ? `${r.auto_lat}, ${r.auto_long}` : '';
    return m || a || '—';
  };

  const getStatusInfo = st => {
    const key = String(st || 'pending').toLowerCase();
    if (key === 'approved') return {label: 'Approved', color: COLORS.success, icon: 'checkmark-done'};
    if (key === 'returned') return {label: 'Returned', color: COLORS.danger, icon: 'arrow-undo'};
    return {label: 'Pending', color: COLORS.warning, icon: 'time'};
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

  // ---------- RENDER ----------
  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Pole Crop Records</Text>
            <View style={styles.headerInfo}>
              <View style={styles.infoChip}>
                <Ionicons name="business" size={12} color="#fff" />
                <Text style={styles.infoChipText}>{enumeration?.division || '—'}</Text>
              </View>
              <View style={styles.infoChip}>
                <Ionicons name="cube" size={12} color="#fff" />
                <Text style={styles.infoChipText}>{enumeration?.block || '—'}</Text>
              </View>
              <View style={styles.infoChip}>
                <Ionicons name="calendar" size={12} color="#fff" />
                <Text style={styles.infoChipText}>{enumeration?.year || '—'}</Text>
              </View>
            </View>
            <Text style={styles.siteId}>Site ID: {String(nameOfSiteId ?? '—')}</Text>
          </View>

          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={() => fetchPoleCropRecords({refresh: true})}
            activeOpacity={0.7}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPoleCropRecords({refresh: true})}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}>
        
        {/* Search Section */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.textLight} style={styles.searchIcon} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by ID, RDS range, species, GPS..."
              placeholderTextColor={COLORS.textLight}
              style={styles.searchInput}
            />
            {!!search && (
              <TouchableOpacity 
                onPress={() => setSearch('')}
                style={styles.searchClear}>
                <Ionicons name="close-circle" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.7}>
            <Ionicons name="filter" size={22} color="#fff" />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{filteredRecords.length}</Text>
            <Text style={styles.statLabel}>Filtered</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{records.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons 
              name={loading ? "refresh" : "checkmark-circle"} 
              size={24} 
              color={loading ? COLORS.warning : COLORS.success} 
            />
            <Text style={styles.statLabel}>
              {loading ? 'Loading...' : 'Ready'}
            </Text>
          </View>
        </View>

        {/* Error Banner */}
        {!!serverError && (
          <View style={styles.errorCard}>
            <View style={styles.errorHeader}>
              <Ionicons name="warning" size={20} color={COLORS.danger} />
              <Text style={styles.errorTitle}>Server Error</Text>
            </View>
            <Text style={styles.errorMessage}>{serverError}</Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => fetchPoleCropRecords({refresh: true})}
              activeOpacity={0.7}>
              <Text style={styles.errorButtonText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Records Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pole Crop Records</Text>
            <Text style={styles.sectionSubtitle}>
              {filteredRecords.length} of {records.length} records
            </Text>
          </View>

          {records.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cut-outline" size={64} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No Records Yet</Text>
              <Text style={styles.emptyText}>
                Start by adding pole crop records for this site
              </Text>
            </View>
          ) : filteredRecords.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={64} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No Results Found</Text>
              <Text style={styles.emptyText}>
                No records match your search criteria
              </Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity style={styles.emptyAction} onPress={clearAll}>
                  <Text style={styles.emptyActionText}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={true}
              style={styles.tableContainer}>
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  {[
                    {label: 'ID', width: 80},
                    {label: 'RDS From', width: 110},
                    {label: 'RDS To', width: 110},
                    {label: 'Count', width: 100},
                    {label: 'Species', width: 220},
                    {label: 'GPS', width: 200},
                    {label: 'Status', width: 140},
                    {label: 'Actions', width: 140},
                  ].map((col, idx) => (
                    <View key={idx} style={[styles.thCell, {width: col.width}]}>
                      <Text style={styles.thText}>{col.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Table Rows */}
                {filteredRecords.map((r, idx) => {
                  const statusInfo = getStatusInfo(r?.status);
                  
                  return (
                    <View 
                      key={String(r?.id ?? idx)} 
                      style={[
                        styles.tableRow,
                        idx % 2 === 0 ? styles.rowEven : styles.rowOdd
                      ]}>
                      
                      <View style={[styles.tdCell, {width: 80}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r?.id ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 110}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r?.rds_from ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 110}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r?.rds_to ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 100}]}>
                        <View style={styles.countBadge}>
                          <Text style={styles.countText}>
                            {String(r?.count ?? '—')}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tdCell, {width: 220}]}>
                        <Text style={styles.tdText} numberOfLines={2}>
                          {getSpeciesLabel(r)}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 200}]}>
                        <Text style={styles.gpsText} numberOfLines={1}>
                          {getGpsLabel(r)}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 140}]}>
                        <View style={[
                          styles.statusBadge,
                          {backgroundColor: `${statusInfo.color}15`}
                        ]}>
                          <Ionicons name={statusInfo.icon} size={12} color={statusInfo.color} />
                          <Text style={[styles.statusText, {color: statusInfo.color}]}>
                            {statusInfo.label}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tdCell, styles.actionsCell, {width: 140}]}>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => openEditFormServer(r)}
                          activeOpacity={0.7}>
                          <Ionicons name="create-outline" size={16} color={COLORS.secondary} />
                          <Text style={styles.actionButtonText}>Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={[styles.actionButton, {backgroundColor: `${COLORS.danger}15`}]}
                          onPress={() => Alert.alert('Not available', 'Delete API is not provided yet.')}
                          activeOpacity={0.7}>
                          <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                          <Text style={[styles.actionButtonText, {color: COLORS.danger}]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={openAddForm}
        activeOpacity={0.8}>
        <View style={styles.fabContent}>
          <Ionicons name="add" size={28} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Filters Modal */}
      <Modal
        transparent
        visible={filterModalVisible}
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons name="filter" size={24} color={COLORS.primary} />
                  <Text style={styles.modalTitle}>Advanced Filters</Text>
                </View>
                <TouchableOpacity 
                  style={styles.modalClose}
                  onPress={() => setFilterModalVisible(false)}
                  activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}>
                
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Status</Text>
                  <View style={styles.filterPills}>
                    <TouchableOpacity
                      style={[
                        styles.filterPill,
                        !filters.status ? styles.filterPillActive : styles.filterPillInactive
                      ]}
                      onPress={() => setFilters(prev => ({...prev, status: ''}))}>
                      <Text style={!filters.status ? styles.filterPillTextActive : styles.filterPillTextInactive}>
                        All
                      </Text>
                    </TouchableOpacity>

                    {['pending', 'approved', 'returned'].map(st => (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.filterPill,
                          filters.status === st ? styles.filterPillActive : styles.filterPillInactive
                        ]}
                        onPress={() => setFilters(prev => ({...prev, status: st}))}>
                        <Text style={filters.status === st ? styles.filterPillTextActive : styles.filterPillTextInactive}>
                          {st.charAt(0).toUpperCase() + st.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Species Filter</Text>
                  <FormRow
                    label="Species contains"
                    value={filters.speciesOne}
                    onChangeText={v => setFilters(prev => ({...prev, speciesOne: v}))}
                    placeholder="Type e.g. Shisham"
                  />
                </View>

                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Date Range</Text>
                  <View style={styles.filterRow}>
                    <View style={styles.filterColumn}>
                      <FormRow
                        label="From (YYYY-MM-DD)"
                        value={filters.dateFrom}
                        onChangeText={v => setFilters(prev => ({...prev, dateFrom: v}))}
                        placeholder="2025-12-01"
                      />
                    </View>
                    <View style={styles.filterColumn}>
                      <FormRow
                        label="To (YYYY-MM-DD)"
                        value={filters.dateTo}
                        onChangeText={v => setFilters(prev => ({...prev, dateTo: v}))}
                        placeholder="2025-12-31"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>RDS Range</Text>
                  <View style={styles.filterRow}>
                    <View style={styles.filterColumn}>
                      <FormRow
                        label="RDS From (>=)"
                        value={filters.rdFrom}
                        onChangeText={v => setFilters(prev => ({...prev, rdFrom: v}))}
                        placeholder="e.g. 10"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.filterColumn}>
                      <FormRow
                        label="RDS To (<=)"
                        value={filters.rdTo}
                        onChangeText={v => setFilters(prev => ({...prev, rdTo: v}))}
                        placeholder="e.g. 50"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Count Range</Text>
                  <View style={styles.filterRow}>
                    <View style={styles.filterColumn}>
                      <FormRow
                        label="Count From (>=)"
                        value={filters.totalFrom}
                        onChangeText={v => setFilters(prev => ({...prev, totalFrom: v}))}
                        placeholder="e.g. 100"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.filterColumn}>
                      <FormRow
                        label="Count To (<=)"
                        value={filters.totalTo}
                        onChangeText={v => setFilters(prev => ({...prev, totalTo: v}))}
                        placeholder="e.g. 500"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.modalButtonSecondary}
                    onPress={() => setFilters({
                      speciesOne: '',
                      dateFrom: '',
                      dateTo: '',
                      rdFrom: '',
                      rdTo: '',
                      totalFrom: '',
                      totalTo: '',
                      status: '',
                    })}
                    activeOpacity={0.7}>
                    <Text style={styles.modalButtonSecondaryText}>Reset All</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.modalButtonPrimary}
                    onPress={() => setFilterModalVisible(false)}
                    activeOpacity={0.7}>
                    <Text style={styles.modalButtonPrimaryText}>Apply Filters</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.editModalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.editModalContainer}>
            
            <View style={styles.editModalContent}>
              <View style={styles.editModalHeader}>
                <View>
                  <Text style={styles.editModalTitle}>
                    {isEdit ? 'Edit Pole Crop Record' : 'Add Pole Crop Record'}
                  </Text>
                  {isEdit && editingServerId && (
                    <Text style={styles.editModalSubtitle}>Record ID: {editingServerId}</Text>
                  )}
                </View>
                <TouchableOpacity 
                  style={styles.editModalClose}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.editModalBody}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                
                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>RDS / KM Information</Text>
                  <View style={styles.formRow}>
                    <View style={styles.formColumn}>
                      <FormRow
                        label="RDS From"
                        value={rdFrom}
                        onChangeText={setRdFrom}
                        placeholder="e.g. 12.5"
                        keyboardType="numeric"
                        required
                      />
                    </View>
                    <View style={styles.formColumn}>
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

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Species Selection</Text>
                  <MultiSelectRow
                    label={speciesLoading ? 'Species (Loading...)' : 'Select Species (Multiple)'}
                    values={selectedSpeciesNames}
                    onChange={vals => setSelectedSpeciesNames(Array.isArray(vals) ? vals : [])}
                    options={speciesOptions}
                    disabled={speciesLoading}
                  />
                  {selectedSpeciesNames.length > 0 && (
                    <View style={styles.selectedSpeciesBadge}>
                      <Text style={styles.selectedSpeciesText}>
                        {selectedSpeciesNames.length} species selected
                      </Text>
                    </View>
                  )}
                  <Text style={styles.helperText}>
                    Selected species will be sent as species_ids[] to the API
                  </Text>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Location Coordinates</Text>
                  
                  <View style={styles.gpsCard}>
                    <View style={styles.gpsCardHeader}>
                      <Text style={styles.gpsCardTitle}>Auto GPS Coordinates</Text>
                      <TouchableOpacity
                        style={styles.gpsFetchButton}
                        onPress={() => fetchGps(false)}
                        activeOpacity={0.7}>
                        <Ionicons name="locate" size={16} color="#fff" />
                        <Text style={styles.gpsFetchButtonText}>Fetch GPS</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.gpsCardBody}>
                      <Text style={styles.gpsValue}>{autoGps || 'No coordinates fetched'}</Text>
                      {gpsLoading && (
                        <View style={styles.gpsLoading}>
                          <ActivityIndicator size="small" color={COLORS.primary} />
                          <Text style={styles.gpsLoadingText}>Fetching location...</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <FormRow
                    label="Coordinates (Auto-fetched, editable)"
                    value={manualGps || autoGps}
                    onChangeText={setManualGps}
                    placeholder={autoGps || "e.g. 31.560000, 74.360000"}
                  />

                  <Text style={styles.gpsNote}>
                    Auto-fetched coordinates are pre-filled. Edit if needed.
                  </Text>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Images</Text>
                  <View style={styles.imageUploadSection}>
                    <View style={styles.imageUploadButtons}>
                      <TouchableOpacity
                        style={styles.imageUploadButton}
                        onPress={pickImages}
                        activeOpacity={0.7}>
                        <View style={styles.imageUploadButtonContent}>
                          <Ionicons name="image-outline" size={20} color="#fff" />
                          <Text style={styles.imageUploadButtonText}>Select Images</Text>
                        </View>
                      </TouchableOpacity>

                      {pickedAssets.length > 0 && (
                        <TouchableOpacity
                          style={styles.imageClearButton}
                          onPress={clearImages}
                          activeOpacity={0.7}>
                          <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                          <Text style={styles.imageClearButtonText}>Clear</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    
                    {pickedAssets.length > 0 && (
                      <View style={styles.imagePreview}>
                        <View style={styles.imagePreviewHeader}>
                          <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                          <Text style={styles.imagePreviewTitle}>
                            {pickedAssets.length} image{pickedAssets.length !== 1 ? 's' : ''} selected
                          </Text>
                        </View>
                        <Text style={styles.imagePreviewText}>
                          Upload Path: "{BUCKET_UPLOAD_PATH}"
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </ScrollView>

              <View style={styles.editModalFooter}>
                <TouchableOpacity 
                  style={styles.footerButtonSecondary}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.7}>
                  <Text style={styles.footerButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.footerButtonPrimary}
                  onPress={upsertRecord}
                  activeOpacity={0.7}>
                  <View style={styles.footerButtonContent}>
                    <Ionicons name={isEdit ? "save-outline" : "add-circle-outline"} size={20} color="#fff" />
                    <Text style={styles.footerButtonPrimaryText}>
                      {isEdit ? 'Create New' : 'Save Record'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Base
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  headerInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  infoChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  siteId: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  searchClear: {
    padding: 4,
  },
  filterButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 4,
  },

  // Stats Card
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },

  // Error Card
  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.danger,
  },
  errorMessage: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  errorButton: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Section
  section: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },

  // Empty State
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyAction: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Table
  tableContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  table: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: 56,
  },
  thCell: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  thText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowEven: {
    backgroundColor: '#fff',
  },
  rowOdd: {
    backgroundColor: 'rgba(5, 150, 105, 0.02)',
  },
  tdCell: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  tdText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  gpsText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  countBadge: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  countText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionsCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabContent: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: height * 0.8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 20,
  },

  // Filter Sections
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillInactive: {
    backgroundColor: '#fff',
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterPillTextInactive: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  filterPillTextActive: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filterColumn: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalButtonPrimary: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },

  // Edit Modal
  editModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
  },
  editModalContainer: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 40 : 20,
  },
  editModalContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  editModalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  editModalSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  editModalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalBody: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  editModalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  // Form Sections
  formSection: {
    marginBottom: 24,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  formColumn: {
    flex: 1,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 8,
    fontStyle: 'italic',
  },
  selectedSpeciesBadge: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  selectedSpeciesText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // GPS Card
  gpsCard: {
    backgroundColor: 'rgba(5, 150, 105, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  gpsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5, 150, 105, 0.1)',
  },
  gpsCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  gpsFetchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  gpsFetchButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  gpsCardBody: {
    padding: 16,
  },
  gpsValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
  },
  gpsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gpsLoadingText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  gpsNote: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Image Upload
  imageUploadSection: {
    marginBottom: 8,
  },
  imageUploadButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  imageUploadButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageUploadButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  imageUploadButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  imageClearButton: {
    flex: 1,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  imageClearButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
  imagePreview: {
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.2)',
    borderRadius: 12,
    padding: 12,
  },
  imagePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  imagePreviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
  imagePreviewText: {
    fontSize: 12,
    color: COLORS.textLight,
  },

  // Footer Buttons
  footerButtonSecondary: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  footerButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  footerButtonPrimary: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  footerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});