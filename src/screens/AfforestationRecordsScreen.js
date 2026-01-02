import React, {useCallback, useMemo, useRef, useState, useEffect} from 'react';
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

/**
 * ✅ AFFORESTATION SCREEN (FIXED nameOfSiteId)
 * - Submit API (5000): POST /enum/afforestation   (expects: nameOfSiteId)
 * - List API (3000): POST /enum/afforestation/user-site-wise-afforestion (expects: name_of_site_id)
 * - Multi Species (IDs): species_ids:[...]
 * - GPS behavior kept (autoGps single + gpsList multiple)
 * - Uses API list as primary source; AsyncStorage is fallback cache
 */

const CACHE_KEY = 'AFFORESTATION_CACHE_BY_SITE';

const API_HOST = 'http://be.lte.gisforestry.com';

// Submit server
const API_5000 = `${API_HOST}`;
const SPECIES_URL = `${API_5000}/enum/species`;
const AFFORESTATION_SUBMIT_URL = `${API_5000}/enum/afforestation`;

// List server
const API_3000 = `${API_HOST}`;
const AFFORESTATION_LIST_URL = `${API_3000}/enum/afforestation/user-site-wise-afforestion`;

export default function AfforestationRecordsScreen({navigation, route}) {
  const enumeration = route?.params?.enumeration;

  const [records, setRecords] = useState([]);
  const [listLoading, setListLoading] = useState(false);

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
    status: '',
    successFrom: '',
    successTo: '',
    plantsFrom: '',
    plantsTo: '',
    avgFrom: '',
    avgTo: '',
  });

  // form states
  const [avgMilesKm, setAvgMilesKm] = useState('');
  const [success, setSuccess] = useState(0);
  const [year, setYear] = useState('');
  const [schemeType, setSchemeType] = useState('');
  const [projectName, setProjectName] = useState('');
  const [nonDevScheme, setNonDevScheme] = useState('');
  const [plants, setPlants] = useState('');

  // ✅ Species from API + multi-select ids
  const [speciesRows, setSpeciesRows] = useState([]); // [{id,name}]
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [speciesModalVisible, setSpeciesModalVisible] = useState(false);
  const [speciesIds, setSpeciesIds] = useState([]); // [2,8,...]

  // ✅ GPS
  const [autoGps, setAutoGps] = useState('');
  const [gpsList, setGpsList] = useState(['']);
  const [gpsLoading, setGpsLoading] = useState(false);
  const lastGpsRequestAtRef = useRef(0);

  const [pictureUri, setPictureUri] = useState(null);

  const yearOptions = [
    '2021-22',
    '2022-23',
    '2023-24',
    '2024-25',
    '2025-26',
    '2026-27',
    '2027-28',
    '2028-29',
    '2029-30',
  ];

  const schemeOptions = ['Development', 'Non Development'];
  const nonDevOptions = ['1% Plantation', 'Replenishment', 'Gap Filling', 'Other'];

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

  // ✅ Helper: safely coerce numeric ids
  const asValidId = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return null;
      const n = Number(s);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  };

  /**
   * ✅ FIX: resolve site id from many possible places
   * (because your enumeration object might not contain name_of_site_id or id)
   */
  const resolveNameOfSiteId = useCallback(() => {
    const p = route?.params || {};
    const e = enumeration || {};

    // try route params first (best)
    const candidates = [
      p.nameOfSiteId,
      p.name_of_site_id,
      p.siteId,
      p.site_id,

      // common enumeration shapes
      e.nameOfSiteId,
      e.name_of_site_id,
      e.siteId,
      e.site_id,

      // nested patterns (very common in APIs)
      e.site?.id,
      e.site?.site_id,
      e.name_of_site?.id,
      e.name_of_site?.site_id,

      // last resort (sometimes the screen is passed a site object directly)
      e.id,
      e._id,
    ];

    for (const c of candidates) {
      const n = asValidId(c);
      if (n) return n;
    }

    return null;
  }, [route?.params, enumeration]);

  const nameOfSiteId = useMemo(() => resolveNameOfSiteId(), [resolveNameOfSiteId]);

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

  const toNumber = v => {
    if (v === null || v === undefined) return null;
    const m = String(v).match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  };

  // ---------------------------
  // Species API
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
    } catch (e) {
      setSpeciesRows([]);
    } finally {
      setSpeciesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpecies();
  }, [fetchSpecies]);

  const speciesLabel = useMemo(() => {
    if (!speciesIds.length) return 'Select species';
    const names = speciesRows
      .filter(x => speciesIds.includes(Number(x.id)))
      .map(x => x.name);
    if (!names.length) return `${speciesIds.length} selected`;
    return names.join(', ');
  }, [speciesIds, speciesRows]);

  const toggleSpeciesId = id => {
    const num = Number(id);
    if (!Number.isFinite(num)) return;
    setSpeciesIds(prev => {
      const set = new Set(prev.map(Number));
      if (set.has(num)) set.delete(num);
      else set.add(num);
      return Array.from(set);
    });
  };

  // ---------------------------
  // LIST API (3000): site-wise afforestation
  // ---------------------------
  const normalizeApiRecord = raw => {
    const scheme = raw?.scheme_type ?? raw?.schemeType ?? '';
    const project = raw?.project_name ?? raw?.projectName ?? '';
    const yearVal = raw?.year ?? '';

    const succRaw =
      raw?.success_percentage ?? raw?.successPercent ?? raw?.success_percent ?? '';
    const succNum =
      typeof succRaw === 'number'
        ? succRaw
        : toNumber(String(succRaw).replace('%', ''));

    const avRaw = raw?.av_miles_km ?? raw?.avgMilesKm ?? raw?.avg_miles_km ?? '';
    const plantsRaw = raw?.no_of_plants ?? raw?.noOfPlants ?? raw?.no_of_plants ?? '';

    const autoLat = raw?.auto_lat ?? raw?.autoLat ?? null;
    const autoLng = raw?.auto_long ?? raw?.autoLong ?? null;

    const manualLat = raw?.manual_lat ?? raw?.manualLat ?? null;
    const manualLng = raw?.manual_long ?? raw?.manualLong ?? null;

    const spIds =
      raw?.species_ids ??
      raw?.speciesIds ??
      raw?.species_id ??
      raw?.species ??
      [];

    const species_ids = Array.isArray(spIds)
      ? spIds.map(n => Number(n)).filter(n => Number.isFinite(n))
      : [];

    const autoGpsLatLong =
      Number.isFinite(Number(autoLat)) && Number.isFinite(Number(autoLng))
        ? `${Number(autoLat).toFixed(6)}, ${Number(autoLng).toFixed(6)}`
        : (raw?.autoGpsLatLong || '');

    const gpsBoundingBox =
      Number.isFinite(Number(manualLat)) && Number.isFinite(Number(manualLng))
        ? [`${Number(manualLat).toFixed(6)}, ${Number(manualLng).toFixed(6)}`]
        : (Array.isArray(raw?.gpsBoundingBox) ? raw.gpsBoundingBox : []);

    return {
      id: String(raw?.id ?? raw?._id ?? Date.now()),
      avgMilesKm: avRaw !== null && avRaw !== undefined ? String(avRaw) : '',
      successPercent: Number.isFinite(Number(succNum)) ? Number(succNum) : 0,
      year: String(yearVal || ''),
      schemeType: String(scheme || ''),
      projectName: scheme === 'Development' ? String(project || '') : '',
      nonDevScheme: scheme === 'Non Development' ? String(project || '') : '',
      noOfPlants: plantsRaw !== null && plantsRaw !== undefined ? String(plantsRaw) : '',
      autoGpsLatLong,
      gpsBoundingBox,
      pictureUri: raw?.pictureUri ?? null,
      species_ids,
      status: raw?.status || 'pending',
      createdAt: raw?.createdAt || raw?.created_at || new Date().toISOString(),
      lastSubmitStatus: raw?.lastSubmitStatus || 'SERVER',
      serverRaw: raw,
    };
  };

  const cacheKeyForSite = siteId => `${CACHE_KEY}:${siteId}`;

  const fetchAfforestationList = useCallback(async () => {
    if (!nameOfSiteId) {
      setRecords([]);
      return;
    }

    try {
      setListLoading(true);

      const token = await getAuthToken();
      if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

      const res = await fetch(AFFORESTATION_LIST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({name_of_site_id: Number(nameOfSiteId)}),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.message || json?.error || `API Error (${res.status})`;
        throw new Error(msg);
      }

      const rows = normalizeList(json);
      const normalized = rows.map(normalizeApiRecord);

      setRecords(normalized);

      await AsyncStorage.setItem(cacheKeyForSite(nameOfSiteId), JSON.stringify(normalized));
    } catch (e) {
      try {
        const cached = await AsyncStorage.getItem(cacheKeyForSite(nameOfSiteId));
        const arr = cached ? JSON.parse(cached) : [];
        setRecords(Array.isArray(arr) ? arr : []);
      } catch (ignored) {
        setRecords([]);
      }
      Alert.alert('Load Failed', e?.message || 'Failed to load records from server.');
    } finally {
      setListLoading(false);
    }
  }, [nameOfSiteId]);

  useFocusEffect(
    useCallback(() => {
      fetchAfforestationList();
    }, [fetchAfforestationList]),
  );

  // ---------------------------
  // FORM / GPS helpers
  // ---------------------------
  const resetFormForAdd = () => {
    setIsEdit(false);
    setEditingId(null);

    setAvgMilesKm('');
    setSuccess(0);
    setYear('');
    setSchemeType('');
    setProjectName('');
    setNonDevScheme('');
    setPlants('');

    setSpeciesIds([]);

    setAutoGps('');
    setGpsList(['']);

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
    setTimeout(() => fetchAutoGps(true), 300);
  };

  const openEditForm = record => {
    setIsEdit(true);
    setEditingId(record.id);

    setAvgMilesKm(record.avgMilesKm || '');
    setSuccess(typeof record.successPercent === 'number' ? record.successPercent : 0);
    setYear(record.year || '');
    setSchemeType(record.schemeType || '');
    setProjectName(record.projectName || '');
    setNonDevScheme(record.nonDevScheme || '');
    setPlants(record.noOfPlants || '');

    setSpeciesIds(Array.isArray(record.species_ids) ? record.species_ids : []);

    setAutoGps(record.autoGpsLatLong || '');
    setGpsList(
      Array.isArray(record.gpsBoundingBox) && record.gpsBoundingBox.length ? record.gpsBoundingBox : [''],
    );

    setPictureUri(record.pictureUri || null);

    setModalVisible(true);

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

  const addCoordinateField = () => setGpsList(prev => [...prev, '']);

  const removeCoordinateField = index => {
    setGpsList(prev => {
      const list = [...prev];
      if (list.length === 1) return [''];
      list.splice(index, 1);
      return list;
    });
  };

  const fillLastWithAuto = () => {
    const apply = value => {
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

  const addAutoToList = () => {
    const v = (autoGps || '').trim();
    if (!v) {
      Alert.alert('GPS', 'Auto GPS is empty. Tap "Re-Fetch" first.');
      return;
    }
    setGpsList(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      if (list.length === 1 && !String(list[0] || '').trim()) {
        list[0] = v;
        return list;
      }
      return [...list, v];
    });
  };

  // ---------------------------
  // SUBMIT API (5000)
  // ---------------------------
  const submitAfforestationToApi = async body => {
    const token = await getAuthToken();
    if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

    const res = await fetch(AFFORESTATION_SUBMIT_URL, {
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
    if (!avgMilesKm || !year || !schemeType) {
      Alert.alert('Missing', 'Avg. Miles/KM, Year and Scheme Type are required.');
      return;
    }

    // ✅ FIXED: use resolved site id
    if (!nameOfSiteId) {
      const keys = enumeration ? Object.keys(enumeration).join(', ') : '(enumeration is null)';
      Alert.alert(
        'Error',
        `nameOfSiteId missing. Ensure previous screen passes it.\n\nAvailable enumeration keys:\n${keys}`,
      );
      return;
    }

    if (!speciesIds.length) {
      Alert.alert('Missing', 'Please select at least 1 species.');
      return;
    }

    const cleanGps = gpsList.map(x => (x || '').trim()).filter(x => x.length > 0);

    const {lat: autoLat, lng: autoLng} = parseLatLng(autoGps);
    const lastManual = cleanGps.length ? cleanGps[cleanGps.length - 1] : '';
    const {lat: manualLat, lng: manualLng} = parseLatLng(lastManual || autoGps);

    const av = Number(String(avgMilesKm).replace(/[^\d.]+/g, ''));
    const avMilesKmNum = Number.isFinite(av) ? av : 0;

    const p = Number(String(plants).replace(/[^\d.]+/g, ''));
    const plantsNum = Number.isFinite(p) ? p : 0;

    const apiBody = {
      // ✅ required by submit API
      nameOfSiteId: Number(nameOfSiteId),
      av_miles_km: avMilesKmNum,
      success_percentage: `${Number(success)}%`,
      year: String(year),
      scheme_type: String(schemeType),
      project_name:
        schemeType === 'Development'
          ? String(projectName || '')
          : String(nonDevScheme || ''),
      no_of_plants: plantsNum,
      auto_lat: autoLat,
      auto_long: autoLng,
      manual_lat: manualLat,
      manual_long: manualLng,
      species_ids: speciesIds.map(n => Number(n)).filter(n => Number.isFinite(n)),
    };

    try {
      await submitAfforestationToApi(apiBody);

      Alert.alert(
        'Success',
        isEdit ? 'Updated on server successfully.' : 'Saved to server successfully.',
      );
      setModalVisible(false);
      fetchAfforestationList();
    } catch (e) {
      Alert.alert('Submit Failed', e?.message || 'Server submit failed.');
    }
  };

  const deleteRecord = recordId => {
    Alert.alert(
      'Delete',
      'This will remove the record from app cache only (no server delete API provided). Continue?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = records.filter(r => r.id !== recordId);
              setRecords(updated);
              if (nameOfSiteId) {
                await AsyncStorage.setItem(cacheKeyForSite(nameOfSiteId), JSON.stringify(updated));
              }
            } catch (e) {
              Alert.alert('Error', 'Failed to remove. Please try again.');
            }
          },
        },
      ],
    );
  };

  // ---------------------------
  // FILTERS
  // ---------------------------
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
        r.projectName,
        r.nonDevScheme,
        r.avgMilesKm,
        String(r.successPercent ?? ''),
        String(r.noOfPlants ?? ''),
        r.autoGpsLatLong,
        gpsText,
        Array.isArray(r.species_ids) ? r.species_ids.join(',') : '',
        r.status,
        r.lastSubmitStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [records, search, filters]);

  const statusBadge = st => {
    const key = st || 'pending';
    if (key === 'approved') return {label: 'Approved', color: '#16a34a', icon: 'checkmark-done'};
    if (key === 'returned') return {label: 'Returned', color: '#ef4444', icon: 'arrow-undo'};
    return {label: 'Pending', color: '#f97316', icon: 'time'};
  };

  // ---------------------------
  // UI
  // ---------------------------
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
              {nameOfSiteId ? ` • Site# ${nameOfSiteId}` : ''}
            </Text>
          </View>

          <TouchableOpacity style={styles.refreshBtn} onPress={fetchAfforestationList}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
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
              <Text style={styles.sectionTitle}>Records</Text>
              <Text style={styles.sectionMeta}>
                {filteredRecords.length} / {records.length}
              </Text>
            </View>

            {listLoading ? (
              <View style={{paddingVertical: 14}}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{marginTop: 8, color: '#6b7280', fontWeight: '700'}}>
                  Loading from server…
                </Text>
              </View>
            ) : records.length === 0 ? (
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
                    <Text style={[styles.th, {width: 180}]}>Species IDs</Text>
                    <Text style={[styles.th, {width: 150}]}>Scheme</Text>
                    <Text style={[styles.th, {width: 220}]}>Project / Non-Dev</Text>
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
                        ? r.projectName || '—'
                        : r.schemeType === 'Non Development'
                        ? r.nonDevScheme || '—'
                        : '—';

                    const sb = statusBadge(r.status);
                    const sp = Array.isArray(r.species_ids) ? r.species_ids.join(', ') : '—';

                    return (
                      <View key={r.id} style={[styles.tr, idx % 2 === 0 ? styles.trEven : styles.trOdd]}>
                        <Text style={[styles.td, {width: 110}]} numberOfLines={1}>{r.year || '—'}</Text>
                        <Text style={[styles.td, {width: 100}]} numberOfLines={1}>
                          {typeof r.successPercent === 'number' ? `${r.successPercent}%` : '—'}
                        </Text>
                        <Text style={[styles.td, {width: 140}]} numberOfLines={1}>{r.avgMilesKm || '—'}</Text>
                        <Text style={[styles.td, {width: 180}]} numberOfLines={1}>{sp}</Text>
                        <Text style={[styles.td, {width: 150}]} numberOfLines={1}>{r.schemeType || '—'}</Text>
                        <Text style={[styles.td, {width: 220}]} numberOfLines={1}>{proj}</Text>
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
      <Modal transparent visible={filterModalVisible} animationType="fade" onRequestClose={() => setFilterModalVisible(false)}>
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
                <DropdownRow label="Year" value={filters.year} onChange={v => setFilters(prev => ({...prev, year: v}))} options={['', ...yearOptions]} />
              </View>
              <View style={{flex: 1}}>
                <DropdownRow label="Scheme Type" value={filters.schemeType} onChange={v => setFilters(prev => ({...prev, schemeType: v}))} options={['', ...schemeOptions]} />
              </View>
            </View>

            <View style={{flexDirection: 'row', gap: 10}}>
              <View style={{flex: 1}}>
                <FormRow label="Success % From (>=)" value={filters.successFrom} onChangeText={v => setFilters(prev => ({...prev, successFrom: v}))} placeholder="e.g. 10" keyboardType="numeric" />
              </View>
              <View style={{flex: 1}}>
                <FormRow label="Success % To (<=)" value={filters.successTo} onChangeText={v => setFilters(prev => ({...prev, successTo: v}))} placeholder="e.g. 90" keyboardType="numeric" />
              </View>
            </View>

            <View style={{flexDirection: 'row', gap: 10}}>
              <View style={{flex: 1}}>
                <FormRow label="Plants From (>=)" value={filters.plantsFrom} onChangeText={v => setFilters(prev => ({...prev, plantsFrom: v}))} placeholder="e.g. 1000" keyboardType="numeric" />
              </View>
              <View style={{flex: 1}}>
                <FormRow label="Plants To (<=)" value={filters.plantsTo} onChangeText={v => setFilters(prev => ({...prev, plantsTo: v}))} placeholder="e.g. 5000" keyboardType="numeric" />
              </View>
            </View>

            <View style={{flexDirection: 'row', gap: 10}}>
              <View style={{flex: 1}}>
                <FormRow label="Avg Miles/KM From (>=)" value={filters.avgFrom} onChangeText={v => setFilters(prev => ({...prev, avgFrom: v}))} placeholder="e.g. 1" keyboardType="numeric" />
              </View>
              <View style={{flex: 1}}>
                <FormRow label="Avg Miles/KM To (<=)" value={filters.avgTo} onChangeText={v => setFilters(prev => ({...prev, avgTo: v}))} placeholder="e.g. 10" keyboardType="numeric" />
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

      {/* Species Multi-Select Modal */}
      <Modal visible={speciesModalVisible} transparent animationType="fade" onRequestClose={() => setSpeciesModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setSpeciesModalVisible(false)}>
          <View style={styles.actionOverlay} />
        </TouchableWithoutFeedback>

        <View style={styles.speciesCard}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Select Species</Text>
            <TouchableOpacity onPress={() => setSpeciesModalVisible(false)}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          {speciesLoading ? (
            <View style={{padding: 12}}>
              <ActivityIndicator />
              <Text style={{marginTop: 8, color: '#6b7280'}}>Loading species…</Text>
            </View>
          ) : (
            <ScrollView style={{maxHeight: 420}}>
              {speciesRows.map(row => {
                const checked = speciesIds.includes(Number(row.id));
                return (
                  <TouchableOpacity key={String(row.id)} style={styles.speciesRow} onPress={() => toggleSpeciesId(row.id)}>
                    <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                      {checked ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                    </View>
                    <Text style={styles.speciesText}>{row.name}</Text>
                    <Text style={styles.speciesIdText}>#{row.id}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={{flexDirection: 'row', gap: 10, marginTop: 12}}>
            <TouchableOpacity style={[styles.filterClear, {flex: 1}]} onPress={() => setSpeciesIds([])}>
              <Text style={styles.filterClearText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.filterApply, {flex: 1}]} onPress={() => setSpeciesModalVisible(false)}>
              <Text style={styles.filterApplyText}>Done</Text>
            </TouchableOpacity>
          </View>
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

                <Text style={styles.pickLabel}>Species (Multi)</Text>
                <TouchableOpacity style={[styles.multiSelectBtn, {opacity: speciesLoading ? 0.7 : 1}]} disabled={speciesLoading} onPress={() => setSpeciesModalVisible(true)}>
                  <Ionicons name="leaf-outline" size={18} color="#fff" />
                  <Text style={styles.multiSelectText}>{speciesLabel}</Text>
                </TouchableOpacity>

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
                  <DropdownRow label="Non Development Scheme" value={nonDevScheme} onChange={setNonDevScheme} options={nonDevOptions} />
                ) : null}

                <FormRow label="No. of Plants" value={plants} onChangeText={setPlants} keyboardType="numeric" />

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
                    You can add multiple coordinates (boundary). API uses the last manual coordinate as manual_lat/long.
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
  refreshBtn: {padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', marginLeft: 10},

  section: {marginHorizontal: 16, marginTop: 12},
  sectionHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10},
  sectionTitle: {fontSize: 18, fontWeight: '700', color: '#111827'},
  sectionMeta: {fontSize: 12, fontWeight: '800', color: '#6b7280'},
  emptyText: {fontSize: 13, color: '#6b7280'},

  searchFilterRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12},
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14, paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  searchInput: {flex: 1, fontSize: 14, color: '#111827'},
  filterBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  filterBadge: {position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4},
  filterBadgeText: {color: '#fff', fontSize: 11, fontWeight: '900'},

  clearAllBtn: {marginTop: 10, backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8},
  clearAllText: {color: '#fff', fontWeight: '900'},

  tableWrap: {borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff'},
  tr: {flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', minHeight: 44},
  thRow: {backgroundColor: 'rgba(14, 165, 233, 0.15)', borderBottomWidth: 1, borderBottomColor: '#cbd5e1'},
  th: {paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, fontWeight: '800', color: '#0f172a'},
  td: {paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, fontWeight: '600', color: '#111827'},
  trEven: {backgroundColor: '#ffffff'},
  trOdd: {backgroundColor: 'rgba(2, 132, 199, 0.04)'},

  actionsCell: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10},
  iconBtn: {padding: 8, borderRadius: 10, backgroundColor: '#f3f4f6'},

  statusCell: {paddingHorizontal: 10, paddingVertical: 10},
  statusPill: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start'},
  statusText: {fontSize: 12, fontWeight: '900'},

  actionOverlay: {flex: 1, backgroundColor: 'rgba(15,23,42,0.35)'},
  filterCard: {position: 'absolute', left: 16, right: 16, top: '14%', backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e5e7eb', elevation: 12, maxHeight: '78%'},
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

  gpsTitle: {fontSize: 14, color: '#374151', fontWeight: '700', marginBottom: 6},
  autoGpsBox: {flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 10, backgroundColor: 'rgba(255,255,255,0.95)'},
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

  pickLabel: {fontSize: 14, color: '#374151', fontWeight: '600', marginBottom: 6},
  imageBtn: {flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primary},
  imageBtnText: {fontSize: 13, color: '#fff', marginLeft: 8, fontWeight: '700'},
  imageOk: {fontSize: 12, color: '#16a34a', marginTop: 6},
  imageMuted: {fontSize: 12, color: '#9ca3af', marginTop: 6},

  saveBtn: {marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary},
  saveText: {fontSize: 15, fontWeight: '700', color: '#fff', marginLeft: 8},

  multiSelectBtn: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#111827', marginBottom: 10},
  multiSelectText: {color: '#fff', fontWeight: '800', flex: 1},

  speciesCard: {position: 'absolute', left: 16, right: 16, top: '18%', backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#e5e7eb', elevation: 12, maxHeight: '70%'},
  speciesRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6'},
  checkbox: {width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff'},
  checkboxOn: {backgroundColor: '#16a34a', borderColor: '#16a34a'},
  speciesText: {flex: 1, color: '#111827', fontWeight: '800'},
  speciesIdText: {color: '#6b7280', fontWeight: '800'},
});
