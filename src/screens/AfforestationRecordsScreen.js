// PoleCropRecordsScreen.js
// ✅ UPDATED (Full File):
// 1) Species-wise plant amounts already supported via species_counts[] + UI inputs
// 2) ✅ Added “Add Pictures” chooser (Camera / Gallery) on one click
// 3) ✅ Added “Species Totals (Filtered)” summary card (Total plants of Shisham, Kiker, etc.)

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
  Image,
  Linking,
  PermissionsAndroid,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import {useFocusEffect} from '@react-navigation/native';
import {launchImageLibrary, launchCamera} from 'react-native-image-picker';

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
const POLE_CROP_UPSERT_URL = `${API_BASE}/enum/pole-crop`; // create + edit

// ✅ Bucket Upload API (Polecrop)
const BUCKET_UPLOAD_URL = `${AWS_Base}/aws-bucket/tree-enum`;
const BUCKET_UPLOAD_PATH = 'Polecrop';
const BUCKET_IS_MULTI = 'true';
const BUCKET_FILE_NAME = 'chan';

const getToken = async () => (await AsyncStorage.getItem('AUTH_TOKEN')) || '';

/** normalizeList: handles server responses like:
 * - array
 * - { data: [] }
 * - { data: { data: [] } }
 */
const normalizeList = json => {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (typeof json === 'object') {
    if (Array.isArray(json.data)) return json.data;
    if (json.data && Array.isArray(json.data.data)) return json.data.data;
  }
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

/* ===================== STATUS (FIXED for latestStatus / verification) ===================== */
const truthy = v => v === true || v === 'true' || v === 1 || v === '1';

const pickFirst = (obj, keys = []) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
};

// ✅ NEW: Extracts the best status object from API response
const getLatestStatusObj = rec => {
  if (!rec || typeof rec !== 'object') return null;

  // 1) Prefer latestStatus
  if (rec?.latestStatus && typeof rec.latestStatus === 'object') {
    const a = rec.latestStatus?.action;
    if (a !== undefined && a !== null && String(a).trim() !== '') return rec.latestStatus;
  }

  // 2) Fallback to last verification entry
  if (Array.isArray(rec?.verification) && rec.verification.length) {
    const last = rec.verification[rec.verification.length - 1];
    if (last && typeof last === 'object') {
      const a = last?.action;
      if (a !== undefined && a !== null && String(a).trim() !== '') return last;
    }
  }

  return null;
};

// ✅ NEW: Normalizes into: approved | disapproved | pending
const normalizeVerificationStatus = rec => {
  const latest = getLatestStatusObj(rec);
  const latestAction = latest?.action ? String(latest.action).trim().toLowerCase() : '';

  if (latestAction === 'verified' || latestAction === 'approved' || latestAction === 'accepted')
    return 'approved';

  if (
    latestAction === 'rejected' ||
    latestAction === 'disapproved' ||
    latestAction.includes('reject')
  )
    return 'disapproved';

  const raw =
    pickFirst(rec, [
      'verification_status',
      'verificationStatus',
      'status',
      'current_status',
      'currentStatus',
      'approval_status',
      'approvalStatus',
      'action',
    ]) || '';

  const rawStr = String(raw).toLowerCase();

  const isVerified = truthy(pickFirst(rec, ['is_verified', 'isVerified', 'verified']));
  const isRejected = truthy(pickFirst(rec, ['is_rejected', 'isRejected', 'rejected']));

  if (isVerified) return 'approved';
  if (isRejected) return 'disapproved';

  if (
    rawStr.includes('approve') ||
    rawStr === 'verified' ||
    rawStr === 'accepted' ||
    rawStr === 'approved'
  )
    return 'approved';

  if (rawStr.includes('reject') || rawStr.includes('return') || rawStr === 'disapproved')
    return 'disapproved';

  return 'pending';
};

const getStatusInfo = recOrStatus => {
  const key =
    typeof recOrStatus === 'object'
      ? normalizeVerificationStatus(recOrStatus)
      : normalizeVerificationStatus({status: recOrStatus});

  if (key === 'approved')
    return {label: 'Approved', color: COLORS.success, icon: 'checkmark-done'};

  if (key === 'disapproved')
    return {label: 'Disapproved', color: COLORS.danger, icon: 'close-circle'};

  return {label: 'Pending', color: COLORS.warning, icon: 'time'};
};

// ✅ NEW: builds a readable message (designation/role/remarks/date) to show on tap
const buildStatusDetailsText = rec => {
  const key = normalizeVerificationStatus(rec);
  const latest = getLatestStatusObj(rec);

  if (!latest) {
    return key === 'pending'
      ? 'Status: Pending\n\nNo verification action found yet.'
      : `Status: ${key}\n\nNo verification details found.`;
  }

  const action = latest?.action ? String(latest.action) : '—';
  const designation = latest?.designation ? String(latest.designation) : '—';
  const role = latest?.user_role ? String(latest.user_role) : '—';
  const remarksRaw = latest?.remarks;
  const remarks = String(remarksRaw ?? '').trim() ? String(remarksRaw).trim() : '—';
  const createdAtRaw = latest?.createdAt || latest?.created_at || latest?.createdAtUtc || null;
  const createdAt = createdAtRaw ? new Date(createdAtRaw) : null;
  const createdAtText =
    createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString() : '—';

  return `Status: ${
    key === 'approved' ? 'Approved' : key === 'disapproved' ? 'Disapproved' : 'Pending'
  }\n\nAction: ${action}\nRole: ${role}\nDesignation: ${designation}\nRemarks: ${remarks}\nAction Time: ${createdAtText}`;
};

/* ===================== FIELD HELPERS ===================== */
const getRdsFrom = row => row?.rds_from ?? row?.rd_from ?? row?.rdFrom ?? '';
const getRdsTo = row => row?.rds_to ?? row?.rd_km ?? row?.rd_to ?? row?.rdTo ?? '';
const getPictures = row => (Array.isArray(row?.pictures) ? row.pictures.filter(Boolean) : []);

const safeDate = raw => {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

/* ===================== SPECIES COUNTS HELPERS ===================== */
const sumSpeciesCounts = arr => {
  const list = Array.isArray(arr) ? arr : [];
  return list.reduce((acc, x) => acc + (Number(x?.count) || 0), 0);
};

const uniq = arr => Array.from(new Set((Array.isArray(arr) ? arr : []).filter(Boolean)));

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

  const [selectedSpeciesNames, setSelectedSpeciesNames] = useState([]);

  // ✅ per-species counts keyed by species_id (string)
  const [speciesCountMap, setSpeciesCountMap] = useState({});

  const [autoGps, setAutoGps] = useState('');
  const [manualGps, setManualGps] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  // ✅ Location permission modal
  const [locPermVisible, setLocPermVisible] = useState(false);
  const [locPermBlocked, setLocPermBlocked] = useState(false);
  const [locPermMsg, setLocPermMsg] = useState(
    'This app needs location access to fetch GPS coordinates.',
  );

  const [pickedAssets, setPickedAssets] = useState([]);

  // Image Viewer
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState([]);
  const [viewerTitle, setViewerTitle] = useState('');

  const lastGpsRequestAtRef = useRef(0);
  const prevAutoGpsRef = useRef('');

  const nameOfSiteId = useMemo(() => {
    return enumeration?.name_of_site_id ?? enumeration?.id ?? null;
  }, [enumeration]);

  /* ===================== IMAGE HANDLERS ===================== */
  const addAssets = useCallback(newAssets => {
    const incoming = Array.isArray(newAssets) ? newAssets : [];
    if (!incoming.length) return;

    setPickedAssets(prev => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const map = new Map();

      // preserve old first
      prevArr.forEach(a => {
        if (a?.uri) map.set(a.uri, a);
      });

      // add/overwrite by uri
      incoming.forEach(a => {
        if (a?.uri) map.set(a.uri, a);
      });

      return Array.from(map.values());
    });
  }, []);

  const pickImages = useCallback(() => {
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
        addAssets(assets);
      },
    );
  }, [addAssets]);

  const ensureCameraPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title: 'Camera Permission',
        message: 'This app needs camera access to capture pole crop images.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      });

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      return false;
    }
  }, []);

  const captureImage = useCallback(async () => {
    const ok = await ensureCameraPermission();
    if (!ok) {
      Alert.alert('Permission Required', 'Camera permission is required to take a photo.');
      return;
    }

    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: false,
        cameraType: 'back',
      },
      res => {
        if (res?.didCancel) return;
        if (res?.errorCode) {
          Alert.alert('Camera Error', res.errorMessage || res.errorCode);
          return;
        }
        const assets = Array.isArray(res?.assets) ? res.assets : [];
        addAssets(assets);
      },
    );
  }, [addAssets, ensureCameraPermission]);

  // ✅ NEW: single chooser (Camera / Gallery)
  const openImageChooser = useCallback(() => {
    Alert.alert(
      'Add Pictures',
      'Choose an option',
      [
        {text: 'Camera', onPress: captureImage},
        {text: 'Gallery', onPress: pickImages},
        {text: 'Cancel', style: 'cancel'},
      ],
      {cancelable: true},
    );
  }, [captureImage, pickImages]);

  const clearImages = () => setPickedAssets([]);

  /* ===================== UPLOAD IMAGES ===================== */
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
      const msg = json?.message || json?.error || `upload failed (${res.status})`;
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

  /* ===================== SPECIES FETCH ===================== */
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

  /* ===================== RECORDS FETCH (REALTIME ONLY) ===================== */
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

  /* ===================== LOCATION PERMISSION + GPS ===================== */
  const openSettingsSafe = useCallback(() => {
    Linking.openSettings().catch(() => {
      Alert.alert('Settings', 'Unable to open Settings on this device.');
    });
  }, []);

  const ensureLocationPermission = useCallback(async () => {
    // iOS
    if (Platform.OS === 'ios') {
      try {
        Geolocation.requestAuthorization?.('whenInUse');
        return {ok: true, blocked: false};
      } catch (e) {
        return {ok: false, blocked: false};
      }
    }

    // Android
    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      const fine = result?.[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const coarse = result?.[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];

      const ok =
        fine === PermissionsAndroid.RESULTS.GRANTED ||
        coarse === PermissionsAndroid.RESULTS.GRANTED;

      const blocked =
        fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
        coarse === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

      return {ok, blocked};
    } catch (e) {
      return {ok: false, blocked: false};
    }
  }, []);

  const showLocationPermissionModal = useCallback(({blocked = false, message} = {}) => {
    setLocPermBlocked(!!blocked);
    setLocPermMsg(
      message ||
        (blocked
          ? 'Location permission is blocked. Please enable it from Settings to fetch GPS coordinates.'
          : 'This app needs location access to fetch GPS coordinates.'),
    );
    setLocPermVisible(true);
  }, []);

  const fetchGps = useCallback(
    async (silent = false) => {
      const now = Date.now();
      if (now - lastGpsRequestAtRef.current < 1200) return;
      lastGpsRequestAtRef.current = now;

      const perm = await ensureLocationPermission();
      if (!perm.ok) {
        if (!silent) {
          showLocationPermissionModal({
            blocked: perm.blocked,
            message: perm.blocked
              ? 'Location permission is blocked. Please enable it from Settings.'
              : 'Location permission is required to fetch GPS coordinates.',
          });
        }
        return;
      }

      setGpsLoading(true);

      Geolocation.getCurrentPosition(
        pos => {
          const {latitude, longitude} = pos.coords;
          const nextAuto = formatLatLng(latitude, longitude);
          setAutoGps(nextAuto);

          setManualGps(prev => {
            const prevAuto = prevAutoGpsRef.current;
            const prevTrim = String(prev || '').trim();
            if (!prevTrim) return nextAuto;
            if (prevTrim === String(prevAuto || '').trim()) return nextAuto;
            return prevTrim;
          });

          prevAutoGpsRef.current = nextAuto;
          setGpsLoading(false);
        },
        err => {
          setGpsLoading(false);
          const msg = err?.message || 'Unable to fetch location.';
          if (!silent) {
            if (String(msg).toLowerCase().includes('permission')) {
              showLocationPermissionModal({
                blocked: false,
                message: 'Location permission was denied. Please allow it to fetch GPS coordinates.',
              });
            } else {
              Alert.alert('Location Error', msg);
            }
          }
        },
        {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
      );
    },
    [ensureLocationPermission, showLocationPermissionModal],
  );

  useEffect(() => {
    const a = String(autoGps || '').trim();
    if (!a) return;
    setManualGps(prev => (String(prev || '').trim() ? prev : a));
  }, [autoGps]);

  const resolveFinalGps = () => {
    const m = String(manualGps || '').trim();
    return m || String(autoGps || '').trim();
  };

  /* ===================== SPECIES COUNT MAP SYNC ===================== */
  const selectedSpeciesIds = useMemo(() => {
    const ids = selectedSpeciesNames
      .map(n => speciesRows.find(s => String(s.name) === String(n))?.id)
      .filter(id => id !== null && id !== undefined)
      .map(id => String(id));
    return uniq(ids);
  }, [selectedSpeciesNames, speciesRows]);

  useEffect(() => {
    setSpeciesCountMap(prev => {
      const next = {};
      selectedSpeciesIds.forEach(id => {
        next[id] = prev?.[id] ?? '';
      });
      return next;
    });
  }, [selectedSpeciesIds]);

  const setSpeciesCount = (speciesId, value) => {
    const clean = String(value ?? '').replace(/[^\d.]/g, '');
    setSpeciesCountMap(prev => ({...(prev || {}), [String(speciesId)]: clean}));
  };

  const totalCount = useMemo(() => {
    const items = selectedSpeciesIds.map(id => ({species_id: id, count: speciesCountMap?.[id]}));
    return items.reduce((acc, x) => acc + (Number(x.count) || 0), 0);
  }, [selectedSpeciesIds, speciesCountMap]);

  /* ===================== FORM HANDLERS ===================== */
  const resetFormForAdd = () => {
    setIsEdit(false);
    setEditingServerId(null);
    setRdFrom('');
    setRdTo('');
    setSelectedSpeciesNames([]);
    setSpeciesCountMap({});
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
    if (normalizeVerificationStatus(row) !== 'disapproved') {
      Alert.alert('Not Allowed', 'This record can only be edited when it is Disapproved (Rejected).');
      return;
    }

    setIsEdit(true);
    setEditingServerId(row?.id ?? null);
    setRdFrom(String(getRdsFrom(row) ?? ''));
    setRdTo(String(getRdsTo(row) ?? ''));

    const apiSpeciesCounts = Array.isArray(row?.species_counts) ? row.species_counts : [];

    const fromNested = Array.isArray(row?.poleCropSpecies)
      ? row.poleCropSpecies.map(x => x?.species?.name).filter(Boolean)
      : [];

    const namesFromSpeciesCounts = apiSpeciesCounts
      .map(sc => {
        const id = sc?.species_id;
        return speciesRows.find(s => String(s.id) === String(id))?.name;
      })
      .filter(Boolean);

    const selectedNames = namesFromSpeciesCounts.length > 0 ? namesFromSpeciesCounts : fromNested;

    setSelectedSpeciesNames(selectedNames);

    const nextCountMap = {};
    if (apiSpeciesCounts.length > 0) {
      apiSpeciesCounts.forEach(sc => {
        const sid = sc?.species_id;
        if (sid !== null && sid !== undefined) nextCountMap[String(sid)] = String(sc?.count ?? '');
      });
    } else if (Array.isArray(row?.poleCropSpecies) && row.poleCropSpecies.length) {
      row.poleCropSpecies.forEach(x => {
        const sid = x?.species?.id;
        if (sid !== null && sid !== undefined) nextCountMap[String(sid)] = String(x?.count ?? '');
      });
    } else {
      const firstName = selectedNames?.[0];
      const sid = speciesRows.find(s => String(s.name) === String(firstName))?.id;
      if (sid !== null && sid !== undefined) nextCountMap[String(sid)] = String(row?.count ?? '');
    }
    setSpeciesCountMap(nextCountMap);

    const auto =
      row?.auto_lat != null && row?.auto_long != null ? `${row.auto_lat}, ${row.auto_long}` : '';
    const manual =
      row?.manual_lat != null && row?.manual_long != null
        ? `${row.manual_lat}, ${row.manual_long}`
        : '';

    setAutoGps(auto);
    const availableGps = manual || auto || '';
    setManualGps(availableGps);
    prevAutoGpsRef.current = auto || '';
    setPickedAssets([]);

    setModalVisible(true);

    if (!auto) setTimeout(() => fetchGps(true), 250);
  };

  /* ===================== VALIDATION ===================== */
  const validate = () => {
    if (!nameOfSiteId) {
      Alert.alert('Error', 'Parent site id missing.');
      return false;
    }
    if (!String(rdFrom || '').trim()) {
      Alert.alert('Missing', 'RDS From is required.');
      return false;
    }
    if (!String(rdTo || '').trim()) {
      Alert.alert('Missing', 'RDS To is required.');
      return false;
    }
    if (!selectedSpeciesNames?.length) {
      Alert.alert('Missing', 'Please select at least one species.');
      return false;
    }

    if (!selectedSpeciesIds.length) {
      Alert.alert('Species', 'Species mapping failed (missing ids). Please refresh species list.');
      return false;
    }

    for (const sid of selectedSpeciesIds) {
      const v = speciesCountMap?.[sid];
      if (!String(v ?? '').trim()) {
        const name = speciesRows.find(s => String(s.id) === String(sid))?.name || `#${sid}`;
        Alert.alert('Missing', `Count is required for ${name}.`);
        return false;
      }
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) {
        const name = speciesRows.find(s => String(s.id) === String(sid))?.name || `#${sid}`;
        Alert.alert('Invalid', `Count must be a positive number for ${name}.`);
        return false;
      }
    }

    return true;
  };

  /* ===================== SUBMIT ===================== */
  const submitToApi = async ({payload}) => {
    const token = await getToken();
    if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

    const res = await fetch(POLE_CROP_UPSERT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
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

    const rdFromNum = Number(rdFrom);
    const rdToNum = Number(rdTo);
    if (!Number.isFinite(rdFromNum) || !Number.isFinite(rdToNum)) {
      Alert.alert('Invalid', 'RDS From / To must be numeric.');
      return;
    }

    const {lat: autoLat, lng: autoLng} = parseLatLng(autoGps);
    const finalGps = resolveFinalGps();
    const {lat: manualLat, lng: manualLng} = parseLatLng(finalGps);

    const species_counts = selectedSpeciesIds.map(sid => ({
      species_id: Number(sid),
      count: Number(speciesCountMap?.[sid]),
    }));

    try {
      const uploadedUrls = await uploadPoleCropImages();

      const existingRow = isEdit
        ? records.find(x => String(x?.id) === String(editingServerId))
        : null;

      const finalPictures =
        uploadedUrls.length > 0 ? uploadedUrls : isEdit ? getPictures(existingRow) : [];

      const payload = {
        ...(isEdit && editingServerId ? {id: Number(editingServerId)} : {}),
        nameOfSiteId: String(nameOfSiteId),

        rds_from: rdFromNum,
        rds_to: rdToNum,

        auto_lat: autoLat,
        auto_long: autoLng,
        manual_lat: manualLat,
        manual_long: manualLng,

        species_counts,

        ...(finalPictures.length ? {pictures: finalPictures} : {}),

        ...(isEdit ? {} : {status: 'pending'}),
      };

      await submitToApi({payload});

      setModalVisible(false);
      fetchPoleCropRecords({refresh: true});
      Alert.alert('Success', isEdit ? 'Record updated successfully.' : 'Record saved successfully.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to save');
    }
  };

  /* ===================== UI HELPERS ===================== */
  const getSpeciesLabel = useCallback(
    r => {
      const sc = Array.isArray(r?.species_counts) ? r.species_counts : [];
      if (sc.length) {
        const parts = sc
          .map(x => {
            const name =
              speciesRows.find(s => String(s.id) === String(x?.species_id))?.name ||
              `#${x?.species_id}`;
            const c = Number(x?.count) || 0;
            return `${name}(${c})`;
          })
          .filter(Boolean);
        if (!parts.length) return '—';
        return parts.length > 2
          ? `${parts.slice(0, 2).join(', ')} +${parts.length - 2} more`
          : parts.join(', ');
      }

      if (Array.isArray(r?.poleCropSpecies) && r.poleCropSpecies.length) {
        const names = r.poleCropSpecies.map(x => x?.species?.name).filter(Boolean);
        const u = uniq(names);
        if (!u.length) return '—';
        return u.length > 2 ? `${u.slice(0, 2).join(', ')} +${u.length - 2} more` : u.join(', ');
      }

      const ids = Array.isArray(r?.species_ids) ? r.species_ids : [];
      if (!ids.length) return '—';
      const names = ids
        .map(id => speciesRows.find(s => String(s.id) === String(id))?.name || `#${id}`)
        .filter(Boolean);
      return names.length > 2
        ? `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
        : names.join(', ');
    },
    [speciesRows],
  );

  const getTotalCountForRow = useCallback(r => {
    const sc = Array.isArray(r?.species_counts) ? r.species_counts : [];
    if (sc.length) return sumSpeciesCounts(sc);
    return Number(r?.count ?? 0) || 0;
  }, []);

  const getGpsLabel = useCallback(r => {
    const m =
      r?.manual_lat != null && r?.manual_long != null ? `${r.manual_lat}, ${r.manual_long}` : '';
    const a = r?.auto_lat != null && r?.auto_long != null ? `${r.auto_lat}, ${r.auto_long}` : '';
    return m || a || '—';
  }, []);

  const openPicturesViewer = useCallback((pics, title = 'Pictures') => {
    const list = Array.isArray(pics) ? pics.filter(Boolean) : [];
    if (!list.length) {
      Alert.alert('Pictures', 'No pictures available for this record.');
      return;
    }
    setViewerImages(list);
    setViewerTitle(title);
    setViewerVisible(true);
  }, []);

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
      const st = normalizeVerificationStatus(r);
      if (filters.status && st !== String(filters.status).toLowerCase()) return false;

      if (filters.speciesOne) {
        const label = getSpeciesLabel(r);
        if (!label.toLowerCase().includes(String(filters.speciesOne).toLowerCase())) return false;
      }

      if (df || dt) {
        const dRaw = r?.created_at || r?.createdAt || r?.updated_at || r?.updatedAt;
        const d = safeDate(dRaw);
        if (!d) return false;
        if (df && d < df) return false;
        if (dt && d > dt) return false;
      }

      if (rdF !== null || rdT !== null) {
        const v = Number(getRdsFrom(r) ?? NaN);
        if (!Number.isFinite(v)) return false;
        if (rdF !== null && v < rdF) return false;
        if (rdT !== null && v > rdT) return false;
      }

      if (totF !== null || totT !== null) {
        const total = getTotalCountForRow(r);
        if (!Number.isFinite(total)) return false;
        if (totF !== null && total < totF) return false;
        if (totT !== null && total > totT) return false;
      }

      if (!q) return true;

      const latest = getLatestStatusObj(r);
      const blob = [
        r?.id,
        getRdsFrom(r),
        getRdsTo(r),
        getTotalCountForRow(r),
        getSpeciesLabel(r),
        getGpsLabel(r),
        normalizeVerificationStatus(r),
        latest?.action,
        latest?.remarks,
        latest?.designation,
        (getPictures(r) || []).join(' '),
        r?.created_at,
      ]
        .filter(v => v !== null && v !== undefined)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [records, search, filters, getSpeciesLabel, getTotalCountForRow, getGpsLabel]);

  // ✅ NEW: Species totals summary for the filtered list (Total plants per species)
  const totalsBySpecies = useMemo(() => {
    const map = {}; // { [speciesName]: totalCount }

    filteredRecords.forEach(r => {
      const sc = Array.isArray(r?.species_counts) ? r.species_counts : [];
      if (sc.length) {
        sc.forEach(x => {
          const sid = x?.species_id;
          const name = speciesRows.find(s => String(s.id) === String(sid))?.name || `#${sid}`;
          map[name] = (map[name] || 0) + (Number(x?.count) || 0);
        });
        return;
      }

      const total = Number(r?.count ?? 0) || 0;
      if (total > 0) map['(Unspecified Species)'] = (map['(Unspecified Species)'] || 0) + total;
    });

    return Object.entries(map)
      .map(([name, total]) => ({name, total}))
      .sort((a, b) => b.total - a.total);
  }, [filteredRecords, speciesRows]);

  /* ===================== RENDER ===================== */
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
              placeholder="Search by ID, RDS range, species, GPS, remarks..."
              placeholderTextColor={COLORS.textLight}
              style={styles.searchInput}
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear}>
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
              name={loading ? 'refresh' : 'checkmark-circle'}
              size={24}
              color={loading ? COLORS.warning : COLORS.success}
            />
            <Text style={styles.statLabel}>{loading ? 'Loading...' : 'Ready'}</Text>
          </View>
        </View>

        {/* ✅ NEW: Species Totals Summary (Filtered) */}
        {totalsBySpecies.length > 0 && (
          <View style={styles.speciesSummaryCard}>
            <View style={styles.speciesSummaryHeader}>
              <Ionicons name="leaf-outline" size={18} color={COLORS.primary} />
              <Text style={styles.speciesSummaryTitle}>Species Totals (Filtered)</Text>
            </View>

            <View style={styles.speciesSummaryBody}>
              {totalsBySpecies.slice(0, 8).map(item => (
                <View key={item.name} style={styles.speciesSummaryRow}>
                  <Text style={styles.speciesSummaryName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.speciesSummaryChip}>
                    <Text style={styles.speciesSummaryChipText}>{item.total}</Text>
                  </View>
                </View>
              ))}

              {totalsBySpecies.length > 8 && (
                <Text style={styles.speciesSummaryMore}>
                  +{totalsBySpecies.length - 8} more species
                </Text>
              )}
            </View>
          </View>
        )}

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
              <Text style={styles.emptyText}>Start by adding pole crop records for this site</Text>
            </View>
          ) : filteredRecords.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={64} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No Results Found</Text>
              <Text style={styles.emptyText}>No records match your search criteria</Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity style={styles.emptyAction} onPress={clearAll}>
                  <Text style={styles.emptyActionText}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableContainer}>
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  {[
                    {label: 'ID', width: 80},
                    {label: 'RDS From', width: 110},
                    {label: 'RDS To', width: 110},
                    {label: 'Total Count', width: 120},
                    {label: 'Status', width: 150},
                    {label: 'Species (Count)', width: 320},
                    {label: 'Pictures', width: 170},
                    {label: 'GPS', width: 200},
                    {label: 'Actions', width: 160},
                  ].map((col, idx) => (
                    <View key={idx} style={[styles.thCell, {width: col.width}]}>
                      <Text style={styles.thText}>{col.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Table Rows */}
                {filteredRecords.map((r, idx) => {
                  const statusInfo = getStatusInfo(r);
                  const pics = getPictures(r);
                  const rdsToValue = getRdsTo(r);
                  const canEdit = normalizeVerificationStatus(r) === 'disapproved';
                  const latest = getLatestStatusObj(r);
                  const hasStatusDetails = !!latest;

                  return (
                    <View
                      key={String(r?.id ?? idx)}
                      style={[styles.tableRow, idx % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
                      <View style={[styles.tdCell, {width: 80}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r?.id ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 110}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(getRdsFrom(r) ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 110}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(rdsToValue ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 120}]}>
                        <View style={styles.countBadge}>
                          <Text style={styles.countText}>
                            {String(getTotalCountForRow(r) ?? '—')}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tdCell, {width: 150}]}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => Alert.alert('Status Details', buildStatusDetailsText(r))}
                          style={[styles.statusBadge, {borderColor: statusInfo.color}]}>
                          <Ionicons name={statusInfo.icon} size={14} color={statusInfo.color} />
                          <Text
                            style={[styles.statusText, {color: statusInfo.color}]}
                            numberOfLines={1}>
                            {statusInfo.label}
                          </Text>
                          <Ionicons
                            name={
                              hasStatusDetails ? 'information-circle-outline' : 'help-circle-outline'
                            }
                            size={16}
                            color={COLORS.textLight}
                          />
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.tdCell, {width: 320}]}>
                        <Text style={styles.tdText} numberOfLines={2}>
                          {getSpeciesLabel(r)}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 170}]}>
                        {pics.length ? (
                          <TouchableOpacity
                            style={styles.picButton}
                            onPress={() => openPicturesViewer(pics, `Record #${r?.id} Pictures`)}>
                            <Ionicons name="images-outline" size={16} color={COLORS.secondary} />
                            <Text style={styles.picButtonText}>View ({pics.length})</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.mutedText}>—</Text>
                        )}
                      </View>

                      <View style={[styles.tdCell, {width: 200}]}>
                        <Text style={styles.gpsText} numberOfLines={1}>
                          {getGpsLabel(r)}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, styles.actionsCell, {width: 160}]}>
                        {canEdit ? (
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => openEditFormServer(r)}
                            activeOpacity={0.7}>
                            <Ionicons name="create-outline" size={16} color={COLORS.secondary} />
                            <Text style={styles.actionButtonText}>Edit</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.mutedText}>—</Text>
                        )}

                        {normalizeVerificationStatus(r) === 'disapproved' && (
                          <TouchableOpacity
                            style={styles.reasonButton}
                            onPress={() => Alert.alert('Rejection Reason', buildStatusDetailsText(r))}
                            activeOpacity={0.7}>
                            <Ionicons
                              name="chatbox-ellipses-outline"
                              size={16}
                              color={COLORS.danger}
                            />
                            <Text style={styles.reasonButtonText}>Reason</Text>
                          </TouchableOpacity>
                        )}
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
      <TouchableOpacity style={styles.fab} onPress={openAddForm} activeOpacity={0.8}>
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

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Status</Text>
                  <View style={styles.filterPills}>
                    <TouchableOpacity
                      style={[
                        styles.filterPill,
                        !filters.status ? styles.filterPillActive : styles.filterPillInactive,
                      ]}
                      onPress={() => setFilters(prev => ({...prev, status: ''}))}>
                      <Text
                        style={
                          !filters.status ? styles.filterPillTextActive : styles.filterPillTextInactive
                        }>
                        All
                      </Text>
                    </TouchableOpacity>

                    {['pending', 'approved', 'disapproved'].map(st => (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.filterPill,
                          filters.status === st ? styles.filterPillActive : styles.filterPillInactive,
                        ]}
                        onPress={() => setFilters(prev => ({...prev, status: st}))}>
                        <Text
                          style={
                            filters.status === st
                              ? styles.filterPillTextActive
                              : styles.filterPillTextInactive
                          }>
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
                        placeholder="2026-01-01"
                      />
                    </View>
                    <View style={styles.filterColumn}>
                      <FormRow
                        label="To (YYYY-MM-DD)"
                        value={filters.dateTo}
                        onChangeText={v => setFilters(prev => ({...prev, dateTo: v}))}
                        placeholder="2026-01-31"
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
                    }
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

                  {selectedSpeciesIds.length > 0 && (
                    <View style={styles.speciesCountsCard}>
                      <View style={styles.speciesCountsHeader}>
                        <Ionicons name="list" size={18} color={COLORS.primary} />
                        <Text style={styles.speciesCountsTitle}>Species-wise Counts</Text>
                        <View style={styles.totalChip}>
                          <Text style={styles.totalChipText}>Total: {totalCount}</Text>
                        </View>
                      </View>

                      {selectedSpeciesIds.map(sid => {
                        const name =
                          speciesRows.find(s => String(s.id) === String(sid))?.name || `#${sid}`;
                        return (
                          <View key={sid} style={styles.speciesCountRow}>
                            <View style={styles.speciesCountLeft}>
                              <Text style={styles.speciesCountName} numberOfLines={1}>
                                {name}
                              </Text>
                              <Text style={styles.speciesCountHint}>Enter plants count</Text>
                            </View>

                            <TextInput
                              value={String(speciesCountMap?.[sid] ?? '')}
                              onChangeText={v => setSpeciesCount(sid, v)}
                              placeholder="0"
                              keyboardType="numeric"
                              placeholderTextColor={COLORS.textLight}
                              style={styles.speciesCountInput}
                            />
                          </View>
                        );
                      })}
                    </View>
                  )}

                  <Text style={styles.helperText}>
                    Selected species will be sent as <Text style={{fontWeight: '800'}}>species_counts[]</Text>
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
                    label="Coordinates (Auto-filled, editable)"
                    value={manualGps}
                    onChangeText={setManualGps}
                    placeholder={autoGps || 'e.g. 31.560000, 74.360000'}
                  />

                  <Text style={styles.gpsNote}>Auto GPS also fills manual coordinates. Edit if needed.</Text>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Images</Text>
                  <View style={styles.imageUploadSection}>
                    <View style={styles.imageUploadButtons}>
                      {/* ✅ single button: Camera/Gallery chooser */}
                      <TouchableOpacity
                        style={styles.imageChooserButton}
                        onPress={openImageChooser}
                        activeOpacity={0.7}>
                        <View style={styles.imageUploadButtonContent}>
                          <Ionicons name="add-circle-outline" size={20} color="#fff" />
                          <Text style={styles.imageUploadButtonText}>Add Pictures</Text>
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
                        <Text style={styles.imagePreviewText}>Upload Path: "{BUCKET_UPLOAD_PATH}"</Text>
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
                    <Ionicons
                      name={isEdit ? 'save-outline' : 'add-circle-outline'}
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.footerButtonPrimaryText}>
                      {isEdit ? 'Update Record' : 'Save Record'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ✅ Location Permission Modal */}
      <Modal
        transparent
        visible={locPermVisible}
        animationType="fade"
        onRequestClose={() => setLocPermVisible(false)}>
        <View style={styles.permOverlay}>
          <TouchableWithoutFeedback onPress={() => setLocPermVisible(false)}>
            <View style={styles.permBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.permCard}>
            <View style={styles.permHeader}>
              <Ionicons name="location-outline" size={22} color={COLORS.primary} />
              <Text style={styles.permTitle}>Location Permission</Text>
            </View>

            <Text style={styles.permText}>{locPermMsg}</Text>

            <View style={styles.permActions}>
              <TouchableOpacity
                style={styles.permBtnSecondary}
                onPress={() => setLocPermVisible(false)}
                activeOpacity={0.8}>
                <Text style={styles.permBtnSecondaryText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.permBtnPrimary}
                onPress={async () => {
                  setLocPermVisible(false);
                  if (locPermBlocked) {
                    openSettingsSafe();
                    return;
                  }
                  await fetchGps(false);
                }}
                activeOpacity={0.85}>
                <Text style={styles.permBtnPrimaryText}>
                  {locPermBlocked ? 'Open Settings' : 'Try Again'}
                </Text>
              </TouchableOpacity>

              {locPermBlocked && (
                <TouchableOpacity
                  style={styles.permBtnDanger}
                  onPress={openSettingsSafe}
                  activeOpacity={0.85}>
                  <Text style={styles.permBtnDangerText}>Settings</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Pictures Viewer Modal */}
      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.viewerOverlay}>
          <TouchableWithoutFeedback onPress={() => setViewerVisible(false)}>
            <View style={styles.viewerBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.viewerCard}>
            <View style={styles.viewerHeader}>
              <Text style={styles.viewerTitle} numberOfLines={1}>
                {viewerTitle || 'Pictures'}
              </Text>
              <TouchableOpacity
                style={styles.viewerClose}
                onPress={() => setViewerVisible(false)}
                activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.viewerScroll}>
              {viewerImages.map((u, i) => (
                <View key={String(u) + i} style={styles.viewerSlide}>
                  <Image
                    source={{uri: u}}
                    style={styles.viewerImage}
                    resizeMode="contain"
                    onError={() => {}}
                  />
                  <TouchableOpacity
                    style={styles.viewerLinkBtn}
                    onPress={() =>
                      Linking.openURL(u).catch(() => Alert.alert('Error', 'Cannot open link'))
                    }>
                    <Ionicons name="open-outline" size={16} color="#fff" />
                    <Text style={styles.viewerLinkText}>Open URL</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={styles.viewerFooter}>
              <Text style={styles.viewerFooterText}>
                {viewerImages.length} image{viewerImages.length !== 1 ? 's' : ''} found
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ===================== STYLES ===================== */
const styles = StyleSheet.create({
  // Base
  screen: {flex: 1, backgroundColor: COLORS.background},
  container: {flex: 1},
  contentContainer: {paddingBottom: 100},

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  headerContainer: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20},
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: {flex: 1},
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  headerInfo: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8},
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  infoChipText: {fontSize: 12, fontWeight: '600', color: '#fff'},
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
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {marginRight: 12},
  searchInput: {flex: 1, fontSize: 16, fontWeight: '500', color: COLORS.text},
  searchClear: {padding: 4},
  filterButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 4},
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
  filterBadgeText: {color: '#fff', fontSize: 10, fontWeight: '900', paddingHorizontal: 4},

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
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {flex: 1, alignItems: 'center'},
  statValue: {fontSize: 24, fontWeight: '800', color: COLORS.primary, marginBottom: 4},
  statLabel: {fontSize: 12, fontWeight: '600', color: COLORS.textLight},
  statDivider: {width: 1, height: 40, backgroundColor: COLORS.border},

  // ✅ Species Totals Summary
  speciesSummaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  speciesSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  speciesSummaryTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
  },
  speciesSummaryBody: {padding: 12},
  speciesSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 231, 235, 0.7)',
  },
  speciesSummaryName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    paddingRight: 12,
  },
  speciesSummaryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  speciesSummaryChipText: {fontSize: 12, fontWeight: '900', color: COLORS.secondary},
  speciesSummaryMore: {marginTop: 10, fontSize: 12, fontWeight: '800', color: COLORS.textLight},

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
  errorHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8},
  errorTitle: {fontSize: 16, fontWeight: '700', color: COLORS.danger},
  errorMessage: {fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: 12},
  errorButton: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  errorButtonText: {color: '#fff', fontSize: 14, fontWeight: '700'},

  // Section
  section: {marginHorizontal: 20, marginBottom: 20},
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {fontSize: 20, fontWeight: '700', color: COLORS.text},
  sectionSubtitle: {fontSize: 14, fontWeight: '600', color: COLORS.textLight},

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
  emptyTitle: {fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 8},
  emptyText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyAction: {backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12},
  emptyActionText: {color: '#fff', fontSize: 14, fontWeight: '700'},

  // Table
  tableContainer: {borderRadius: 16, overflow: 'hidden'},
  table: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
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
  tableRow: {flexDirection: 'row', minHeight: 60, borderBottomWidth: 1, borderBottomColor: COLORS.border},
  rowEven: {backgroundColor: '#fff'},
  rowOdd: {backgroundColor: 'rgba(5, 150, 105, 0.02)'},
  tdCell: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  tdText: {fontSize: 13, fontWeight: '600', color: COLORS.text},
  mutedText: {fontSize: 13, fontWeight: '600', color: COLORS.textLight},
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
  countText: {fontSize: 13, fontWeight: '800', color: COLORS.secondary},

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  statusText: {fontSize: 12, fontWeight: '800'},

  // Pictures button
  picButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14, 165, 233, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  picButtonText: {fontSize: 12, fontWeight: '800', color: COLORS.secondary},

  actionsCell: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8},
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {fontSize: 12, fontWeight: '700', color: COLORS.secondary},

  // Reason button
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.15)',
  },
  reasonButtonText: {fontSize: 12, fontWeight: '800', color: COLORS.danger},

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 4},
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
  modalOverlay: {flex: 1, backgroundColor: COLORS.overlay},
  modalBackdrop: {...StyleSheet.absoluteFillObject},
  modalContainer: {flex: 1, justifyContent: 'center', padding: 20},
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: height * 0.8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
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
  modalTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  modalTitle: {fontSize: 20, fontWeight: '800', color: COLORS.text},
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {padding: 20},

  // Filter Sections
  filterSection: {marginBottom: 20},
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterPills: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  filterPill: {paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border},
  filterPillInactive: {backgroundColor: '#fff'},
  filterPillActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  filterPillTextInactive: {fontSize: 14, fontWeight: '700', color: COLORS.text},
  filterPillTextActive: {fontSize: 14, fontWeight: '800', color: '#fff'},
  filterRow: {flexDirection: 'row', gap: 12},
  filterColumn: {flex: 1},
  modalActions: {flexDirection: 'row', gap: 12, marginTop: 8},
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {fontSize: 16, fontWeight: '700', color: COLORS.text},
  modalButtonPrimary: {flex: 2, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center'},
  modalButtonPrimaryText: {fontSize: 16, fontWeight: '800', color: '#fff'},

  // Edit Modal
  editModalOverlay: {flex: 1, backgroundColor: COLORS.overlay},
  editModalContainer: {flex: 1, marginTop: Platform.OS === 'ios' ? 40 : 20},
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
  editModalTitle: {fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 4},
  editModalSubtitle: {fontSize: 14, fontWeight: '600', color: COLORS.textLight},
  editModalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalBody: {paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20},
  editModalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  // Form Sections
  formSection: {marginBottom: 24},
  formSectionTitle: {fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16, letterSpacing: 0.5},
  formRow: {flexDirection: 'row', gap: 12, marginBottom: 16},
  formColumn: {flex: 1},
  helperText: {fontSize: 12, color: COLORS.textLight, marginTop: 8, fontStyle: 'italic'},
  selectedSpeciesBadge: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  selectedSpeciesText: {fontSize: 12, fontWeight: '700', color: COLORS.primary},

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
  gpsCardTitle: {fontSize: 14, fontWeight: '700', color: COLORS.text},
  gpsFetchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  gpsFetchButtonText: {fontSize: 12, fontWeight: '700', color: '#fff'},
  gpsCardBody: {padding: 16},
  gpsValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
  },
  gpsLoading: {flexDirection: 'row', alignItems: 'center', gap: 8},
  gpsLoadingText: {fontSize: 12, color: COLORS.textLight, fontWeight: '600'},
  gpsNote: {fontSize: 12, color: COLORS.textLight, marginTop: 8, fontStyle: 'italic'},

  // Image Upload
  imageUploadSection: {marginBottom: 8},
  imageUploadButtons: {flexDirection: 'row', gap: 12, marginBottom: 12},
  imageChooserButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageUploadButtonContent: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8},
  imageUploadButtonText: {fontSize: 16, fontWeight: '700', color: '#fff'},
  imageClearButton: {
    flex: 1,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  imageClearButtonText: {fontSize: 14, fontWeight: '700', color: COLORS.danger},
  imagePreview: {
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.2)',
    borderRadius: 12,
    padding: 12,
  },
  imagePreviewHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4},
  imagePreviewTitle: {fontSize: 14, fontWeight: '700', color: COLORS.success},
  imagePreviewText: {fontSize: 12, color: COLORS.textLight},

  // Footer Buttons
  footerButtonSecondary: {flex: 1, backgroundColor: 'rgba(31, 41, 55, 0.05)', paddingVertical: 16, borderRadius: 14, alignItems: 'center'},
  footerButtonSecondaryText: {fontSize: 16, fontWeight: '700', color: COLORS.text},
  footerButtonPrimary: {flex: 2, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 14},
  footerButtonContent: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8},
  footerButtonPrimaryText: {fontSize: 16, fontWeight: '800', color: '#fff'},

  // Viewer
  viewerOverlay: {flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', padding: 16},
  viewerBackdrop: {...StyleSheet.absoluteFillObject},
  viewerCard: {backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, maxHeight: height * 0.75},
  viewerHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border},
  viewerTitle: {fontSize: 16, fontWeight: '800', color: COLORS.text, flex: 1, marginRight: 10},
  viewerClose: {width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(31,41,55,0.06)', alignItems: 'center', justifyContent: 'center'},
  viewerScroll: {backgroundColor: '#fff'},
  viewerSlide: {width: width - 32, height: Math.min(height * 0.55, 420), alignItems: 'center', justifyContent: 'center', padding: 10},
  viewerImage: {width: '100%', height: '100%', borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.04)'},
  viewerLinkBtn: {position: 'absolute', bottom: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12},
  viewerLinkText: {color: '#fff', fontWeight: '800', fontSize: 12},
  viewerFooter: {padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center'},
  viewerFooterText: {color: COLORS.textLight, fontWeight: '700', fontSize: 12},

  /* ===================== SPECIES COUNTS ===================== */
  speciesCountsCard: {
    marginTop: 14,
    backgroundColor: 'rgba(5, 150, 105, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.12)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  speciesCountsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5, 150, 105, 0.12)',
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
  },
  speciesCountsTitle: {flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.text},
  totalChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  totalChipText: {fontSize: 12, fontWeight: '900', color: COLORS.primary},
  speciesCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5, 150, 105, 0.10)',
  },
  speciesCountLeft: {flex: 1, paddingRight: 12},
  speciesCountName: {fontSize: 14, fontWeight: '800', color: COLORS.text},
  speciesCountHint: {fontSize: 12, fontWeight: '600', color: COLORS.textLight, marginTop: 2},
  speciesCountInput: {
    width: 110,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },

  /* ===================== LOCATION PERMISSION MODAL ===================== */
  permOverlay: {flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', padding: 20},
  permBackdrop: {...StyleSheet.absoluteFillObject},
  permCard: {backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: COLORS.border},
  permHeader: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10},
  permTitle: {fontSize: 16, fontWeight: '900', color: COLORS.text},
  permText: {fontSize: 13, color: COLORS.text, lineHeight: 18, marginBottom: 14},
  permActions: {flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end'},
  permBtnSecondary: {paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(31,41,55,0.06)'},
  permBtnSecondaryText: {fontSize: 13, fontWeight: '800', color: COLORS.text},
  permBtnPrimary: {paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.primary},
  permBtnPrimaryText: {fontSize: 13, fontWeight: '900', color: '#fff'},
  permBtnDanger: {paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.danger},
  permBtnDangerText: {fontSize: 13, fontWeight: '900', color: '#fff'},
});
