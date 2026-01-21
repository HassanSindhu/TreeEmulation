// PoleCropRecordsScreen.js
// ✅ COMPLETE UPDATED FILE
// ✅ FIXED: Edit now uses PATCH /enum/pole-crop/{id} (as per your curl)
// ✅ FIXED: Species dropdown fetch uses Authorization header + reads json.data
// ✅ ADDED: "Other" species flow -> shows input + POST /lpe3/species to add into DB, then refresh + auto-select
// ✅ Updated for latest GET /enum/pole-crop response: poleCropSpecies: [{ id, name, count, audit_no }]
// ✅ Total count derived from poleCropSpecies when present; legacy species_counts supported too

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

// API
const API_BASE = 'http://be.lte.gisforestry.com';
const AWS_Base = 'https://app.eco.gisforestry.com';

// ✅ Species endpoints (require Authorization)
const SPECIES_URL = `${API_BASE}/lpe3/species`;

// Pole Crop APIs
const POLE_CROP_LIST_URL_POST = `${API_BASE}/enum/pole-crop/user-site-wise-pole-crop`; // older POST (site-wise)
const POLE_CROP_LIST_URL_GET = `${API_BASE}/enum/pole-crop`; // latest GET
const POLE_CROP_CREATE_URL = `${API_BASE}/enum/pole-crop`;
const POLE_CROP_EDIT_URL = id => `${API_BASE}/enum/pole-crop/${id}`;

// Bucket Upload API (Polecrop)
const BUCKET_UPLOAD_URL = `${AWS_Base}/aws-bucket/tree-enum`;
const BUCKET_UPLOAD_PATH = 'Polecrop';
const BUCKET_IS_MULTI = 'true';
const BUCKET_FILE_NAME = 'chan';

const OTHER_SPECIES_LABEL = 'Other';

const getToken = async () => (await AsyncStorage.getItem('AUTH_TOKEN')) || '';

/** normalizeList: handles responses like:
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

/* ===================== STATUS (latestStatus / verification) ===================== */
const truthy = v => v === true || v === 'true' || v === 1 || v === '1';

const pickFirst = (obj, keys = []) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
};

const getLatestStatusObj = rec => {
  if (!rec || typeof rec !== 'object') return null;

  if (rec?.latestStatus && typeof rec.latestStatus === 'object') {
    const a = rec.latestStatus?.action;
    if (a !== undefined && a !== null && String(a).trim() !== '') return rec.latestStatus;
  }

  if (Array.isArray(rec?.verification) && rec.verification.length) {
    const last = rec.verification[rec.verification.length - 1];
    if (last && typeof last === 'object') {
      const a = last?.action;
      if (a !== undefined && a !== null && String(a).trim() !== '') return last;
    }
  }

  return null;
};

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
  const createdAtRaw = latest?.createdAt || latest?.created_at || null;
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

/* ===================== NEW API: poleCropSpecies HELPERS ===================== */
// New API: poleCropSpecies: [{ id, name, count, audit_no }]
const getPoleCropSpeciesList = row =>
  Array.isArray(row?.poleCropSpecies) ? row.poleCropSpecies.filter(Boolean) : [];

const sumPoleCropSpeciesCounts = row => {
  const list = getPoleCropSpeciesList(row);
  if (!list.length) return 0;
  return list.reduce((acc, x) => acc + (Number(x?.count) || 0), 0);
};

const buildPoleCropSpeciesLabel = row => {
  const list = getPoleCropSpeciesList(row);

  if (list.length) {
    const parts = list
      .map(x => {
        const name = String(x?.name || '').trim() || `#${x?.id ?? '—'}`;
        const c = Number(x?.count) || 0;
        return `${name}(${c})`;
      })
      .filter(Boolean);

    if (!parts.length) return '—';
    return parts.length > 2
      ? `${parts.slice(0, 2).join(', ')} +${parts.length - 2} more`
      : parts.join(', ');
  }

  return '—';
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

  // Other species flow
  const [otherSpeciesName, setOtherSpeciesName] = useState('');
  const [addingSpecies, setAddingSpecies] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingServerId, setEditingServerId] = useState(null);

  const [rdFrom, setRdFrom] = useState('');
  const [rdTo, setRdTo] = useState('');

  // MultiSelectRow stores names
  const [selectedSpeciesNames, setSelectedSpeciesNames] = useState([]);

  // per-species counts keyed by species_id (string)
  const [speciesCountMap, setSpeciesCountMap] = useState({});

  const [autoGps, setAutoGps] = useState('');
  const [manualGps, setManualGps] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

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

  /* ===================== IMAGES ===================== */
  const addAssets = useCallback(newAssets => {
    const incoming = Array.isArray(newAssets) ? newAssets : [];
    if (!incoming.length) return;

    setPickedAssets(prev => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const map = new Map();

      prevArr.forEach(a => {
        if (a?.uri) map.set(a.uri, a);
      });

      incoming.forEach(a => {
        if (a?.uri) map.set(a.uri, a);
      });

      return Array.from(map.values());
    });
  }, []);

  const pickImages = () => {
    launchImageLibrary(
      {mediaType: 'photo', quality: 0.8, selectionLimit: 0},
      res => {
        if (res?.didCancel) return;
        if (res?.errorCode) {
          Alert.alert('Image Error', res.errorMessage || res.errorCode);
          return;
        }
        addAssets(res?.assets || []);
      },
    );
  };

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
      {mediaType: 'photo', quality: 0.8, saveToPhotos: false, cameraType: 'back'},
      res => {
        if (res?.didCancel) return;
        if (res?.errorCode) {
          Alert.alert('Camera Error', res.errorMessage || res.errorCode);
          return;
        }
        addAssets(res?.assets || []);
      },
    );
  }, [addAssets, ensureCameraPermission]);

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

    const res = await fetch(BUCKET_UPLOAD_URL, {method: 'POST', body: form});
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

  /* ===================== SPECIES FETCH (GET) ===================== */
  const fetchSpecies = useCallback(async () => {
    try {
      setSpeciesLoading(true);

      const token = await getToken();
      if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

      const res = await fetch(SPECIES_URL, {
        method: 'GET',
        headers: {Authorization: `Bearer ${token}`},
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.message || json?.error || `Species API Error (${res.status})`;
        throw new Error(msg);
      }

      // Your shape: { statusCode, message, data: [...] }
      const rows = Array.isArray(json?.data) ? json.data : [];

      const normalized = rows
        .map(x => ({
          id: x?.id ?? null,
          name: String(x?.name ?? '').trim(),
        }))
        .filter(x => x.id != null && x.name);

      setSpeciesRows(normalized);

      // ✅ Ensure "Other" exists as an option
      const names = normalized.map(x => x.name);
      const finalOptions = [...names, OTHER_SPECIES_LABEL];

      setSpeciesOptions(finalOptions);
    } catch (e) {
      setSpeciesRows([]);
      setSpeciesOptions([OTHER_SPECIES_LABEL]);
      Alert.alert('Species Error', e?.message || 'Failed to load species');
    } finally {
      setSpeciesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpecies();
  }, [fetchSpecies]);

  /* ===================== SPECIES CREATE (POST /lpe3/species) ===================== */
  const createSpecies = useCallback(
    async name => {
      const token = await getToken();
      if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

      const res = await fetch(SPECIES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({name}),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.message || json?.error || `Create Species Error (${res.status})`;
        throw new Error(msg);
      }

      // Some backends return {data:{...}} others return {...}
      const created = json?.data || json;
      const createdName = String(created?.name || name).trim();
      return {name: createdName};
    },
    [],
  );

  const onAddOtherSpecies = useCallback(async () => {
    const raw = String(otherSpeciesName || '').trim();
    if (!raw) {
      Alert.alert('Missing', 'Please enter species name.');
      return;
    }

    // Prevent duplicates (case-insensitive)
    const exists = speciesRows.some(s => String(s.name).trim().toLowerCase() === raw.toLowerCase());
    if (exists) {
      // Auto-select existing
      setSelectedSpeciesNames(prev => {
        const p = Array.isArray(prev) ? prev : [];
        const withoutOther = p.filter(x => x !== OTHER_SPECIES_LABEL);
        if (withoutOther.includes(raw)) return withoutOther;
        return [...withoutOther, raw];
      });
      setOtherSpeciesName('');
      Alert.alert('Already Exists', 'This species already exists and has been selected.');
      return;
    }

    try {
      setAddingSpecies(true);

      const created = await createSpecies(raw);

      // Refresh species list from server
      await fetchSpecies();

      // Replace "Other" with the newly created species in selection
      setSelectedSpeciesNames(prev => {
        const p = Array.isArray(prev) ? prev : [];
        const withoutOther = p.filter(x => x !== OTHER_SPECIES_LABEL);
        const nameToUse = created?.name || raw;
        if (withoutOther.includes(nameToUse)) return withoutOther;
        return [...withoutOther, nameToUse];
      });

      setOtherSpeciesName('');
      Alert.alert('Success', 'Species added successfully.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to add species');
    } finally {
      setAddingSpecies(false);
    }
  }, [otherSpeciesName, speciesRows, createSpecies, fetchSpecies]);

  /* ===================== RECORDS FETCH ===================== */
  const fetchPoleCropRecords = useCallback(
    async ({refresh = false} = {}) => {
      try {
        refresh ? setRefreshing(true) : setLoading(true);
        setServerError('');

        const token = await getToken();
        if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

        let json = null;
        let ok = false;
        let status = 0;

        // Try POST site-wise endpoint first
        if (nameOfSiteId) {
          try {
            const resPost = await fetch(POLE_CROP_LIST_URL_POST, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({nameOfSiteId: Number(nameOfSiteId)}),
            });
            status = resPost.status;
            json = await resPost.json().catch(() => null);
            ok = resPost.ok;
          } catch (e) {
            // ignore -> fallback
          }
        }

        // Fallback: GET /enum/pole-crop
        if (!ok) {
          const resGet = await fetch(POLE_CROP_LIST_URL_GET, {
            method: 'GET',
            headers: {Authorization: `Bearer ${token}`},
          });
          status = resGet.status;
          json = await resGet.json().catch(() => null);
          ok = resGet.ok;
        }

        if (!ok) {
          const msg = json?.message || json?.error || `API Error (${status})`;
          throw new Error(msg);
        }

        let rows = normalizeList(json);
        rows = Array.isArray(rows) ? rows : [];

        // If we have route site id, filter client-side too
        if (nameOfSiteId != null) {
          const sid = Number(nameOfSiteId);
          rows = rows.filter(r => {
            const a = Number(r?.nameOfSiteId);
            const b = Number(r?.nameOfSite?.id);
            return (Number.isFinite(a) && a === sid) || (Number.isFinite(b) && b === sid);
          });
        }

        setRecords(rows);
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
    if (Platform.OS === 'ios') {
      try {
        Geolocation.requestAuthorization?.('whenInUse');
        return {ok: true, blocked: false};
      } catch (e) {
        return {ok: false, blocked: false};
      }
    }

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
    async silent => {
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
    // ignore "Other" in mapping
    const actualNames = (Array.isArray(selectedSpeciesNames) ? selectedSpeciesNames : []).filter(
      n => String(n) !== OTHER_SPECIES_LABEL,
    );

    const ids = actualNames
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

  /* ===================== FORM ===================== */
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
    setOtherSpeciesName('');
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

    // ✅ NEW API: poleCropSpecies is flat: {id, name, count}
    const pcs = getPoleCropSpeciesList(row);
    const selectedNames = pcs.map(x => x?.name).filter(Boolean);
    setSelectedSpeciesNames(selectedNames);

    const nextCountMap = {};
    pcs.forEach(x => {
      const sid = x?.id;
      if (sid !== null && sid !== undefined) nextCountMap[String(sid)] = String(x?.count ?? '');
    });
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
    setOtherSpeciesName('');

    // ✅ Ensure selected names are present in options (for old/custom names)
    setSpeciesOptions(prev => {
      const p = Array.isArray(prev) ? prev : [OTHER_SPECIES_LABEL];
      const union = uniq([...p, ...selectedNames, OTHER_SPECIES_LABEL]);
      return union;
    });

    setModalVisible(true);
    if (!auto) setTimeout(() => fetchGps(true), 250);
  };

  /* ===================== VALIDATION ===================== */
  const validate = () => {
    if (!nameOfSiteId && !isEdit) {
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

    // If user selected "Other", they must add it before saving
    if (selectedSpeciesNames.includes(OTHER_SPECIES_LABEL)) {
      Alert.alert('Species', 'Please add the "Other" species name before saving.');
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

  /* ===================== SUBMIT (POST create, PATCH edit) ===================== */
  const submitToApi = async ({isEditMode, id, payload}) => {
    const token = await getToken();
    if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

    const url = isEditMode ? POLE_CROP_EDIT_URL(id) : POLE_CROP_CREATE_URL;
    const method = isEditMode ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
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

      // If user did not pick new images, keep existing server images in edit
      const finalPictures =
        uploadedUrls.length > 0 ? uploadedUrls : isEdit ? getPictures(existingRow) : [];

      const basePayload = {
        rds_from: rdFromNum,
        rds_to: rdToNum,
        auto_lat: autoLat,
        auto_long: autoLng,
        manual_lat: manualLat,
        manual_long: manualLng,
        pictures: finalPictures,
        species_counts,
      };

      // ✅ Create requires site id; Edit curl does NOT include it
      const payload = isEdit
        ? basePayload
        : {
            ...basePayload,
            nameOfSiteId: String(nameOfSiteId),
          };

      await submitToApi({
        isEditMode: isEdit,
        id: Number(editingServerId),
        payload,
      });

      setModalVisible(false);
      fetchPoleCropRecords({refresh: true});
      Alert.alert('Success', isEdit ? 'Record updated successfully.' : 'Record saved successfully.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to save');
    }
  };

  /* ===================== UI HELPERS (UPDATED) ===================== */
  const getSpeciesLabel = r => {
    // legacy: species_counts
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

    // new: poleCropSpecies
    return buildPoleCropSpeciesLabel(r);
  };

  const getTotalCountForRow = r => {
    const sc = Array.isArray(r?.species_counts) ? r.species_counts : [];
    if (sc.length) return sumSpeciesCounts(sc);

    const poleSum = sumPoleCropSpeciesCounts(r);
    if (poleSum > 0) return poleSum;

    return Number(r?.count ?? 0) || 0;
  };

  const getGpsLabel = r => {
    const m =
      r?.manual_lat != null && r?.manual_long != null ? `${r.manual_lat}, ${r.manual_long}` : '';
    const a = r?.auto_lat != null && r?.auto_long != null ? `${r.auto_lat}, ${r.auto_long}` : '';
    return m || a || '—';
  };

  const openPicturesViewer = (pics, title = 'Pictures') => {
    const list = Array.isArray(pics) ? pics.filter(Boolean) : [];
    if (!list.length) {
      Alert.alert('Pictures', 'No pictures available for this record.');
      return;
    }
    setViewerImages(list);
    setViewerTitle(title);
    setViewerVisible(true);
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
        r?.nameOfSite?.site_name,
        r?.nameOfSiteId,
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
  }, [records, search, filters, speciesRows]);

  const showOtherInput = useMemo(
    () => Array.isArray(selectedSpeciesNames) && selectedSpeciesNames.includes(OTHER_SPECIES_LABEL),
    [selectedSpeciesNames],
  );

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

                {filteredRecords.map((r, idx) => {
                  const statusInfo = getStatusInfo(r);
                  const pics = getPictures(r);
                  const canEdit = normalizeVerificationStatus(r) === 'disapproved';
                  const hasStatusDetails = !!getLatestStatusObj(r);

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
                          {String(getRdsTo(r) ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 120}]}>
                        <View style={styles.countBadge}>
                          <Text style={styles.countText}>{String(getTotalCountForRow(r) ?? '—')}</Text>
                        </View>
                      </View>

                      <View style={[styles.tdCell, {width: 150}]}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => Alert.alert('Status Details', buildStatusDetailsText(r))}
                          style={[styles.statusBadge, {borderColor: statusInfo.color}]}>
                          <Ionicons name={statusInfo.icon} size={14} color={statusInfo.color} />
                          <Text style={[styles.statusText, {color: statusInfo.color}]} numberOfLines={1}>
                            {statusInfo.label}
                          </Text>
                          <Ionicons
                            name={hasStatusDetails ? 'information-circle-outline' : 'help-circle-outline'}
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

      <TouchableOpacity style={styles.fab} onPress={openAddForm} activeOpacity={0.8}>
        <View style={styles.fabContent}>
          <Ionicons name="add" size={28} color="#fff" />
        </View>
      </TouchableOpacity>

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

                  {/* ✅ OTHER SPECIES INPUT + POST to DB */}
                  {showOtherInput && (
                    <View style={styles.otherBox}>
                      <Text style={styles.otherTitle}>Add New Species</Text>
                      <TextInput
                        value={otherSpeciesName}
                        onChangeText={setOtherSpeciesName}
                        placeholder="Type species name (e.g. Guava)"
                        placeholderTextColor={COLORS.textLight}
                        style={styles.otherInput}
                      />
                      <TouchableOpacity
                        onPress={onAddOtherSpecies}
                        disabled={addingSpecies}
                        style={[styles.otherAddBtn, addingSpecies ? styles.otherAddBtnDisabled : null]}>
                        {addingSpecies ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="add-circle-outline" size={18} color="#fff" />
                            <Text style={styles.otherAddBtnText}>Add Species</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.otherRemoveBtn}
                        onPress={() => {
                          setSelectedSpeciesNames(prev =>
                            (Array.isArray(prev) ? prev : []).filter(x => x !== OTHER_SPECIES_LABEL),
                          );
                          setOtherSpeciesName('');
                        }}>
                        <Ionicons name="close-circle-outline" size={18} color={COLORS.danger} />
                        <Text style={styles.otherRemoveBtnText}>Remove “Other”</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {selectedSpeciesNames.length > 0 && (
                    <View style={styles.selectedSpeciesBadge}>
                      <Text style={styles.selectedSpeciesText}>
                        {selectedSpeciesNames.filter(n => n !== OTHER_SPECIES_LABEL).length} species selected
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

                      <TouchableOpacity
                        style={styles.imageCameraButton}
                        onPress={captureImage}
                        activeOpacity={0.7}>
                        <View style={styles.imageUploadButtonContent}>
                          <Ionicons name="camera-outline" size={20} color="#fff" />
                          <Text style={styles.imageUploadButtonText}>Camera</Text>
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

      {/* Pictures Viewer */}
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
                  <Image source={{uri: u}} style={styles.viewerImage} resizeMode="contain" />
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

      {/* Location Permission Modal */}
      <Modal visible={locPermVisible} transparent animationType="fade">
        <View style={styles.permOverlay}>
          <View style={styles.permCard}>
            <Text style={styles.permTitle}>Location Permission</Text>
            <Text style={styles.permText}>{locPermMsg}</Text>

            <View style={styles.permActions}>
              <TouchableOpacity
                style={styles.permBtnSecondary}
                onPress={() => setLocPermVisible(false)}>
                <Text style={styles.permBtnSecondaryText}>Close</Text>
              </TouchableOpacity>

              {locPermBlocked ? (
                <TouchableOpacity style={styles.permBtnPrimary} onPress={openSettingsSafe}>
                  <Text style={styles.permBtnPrimaryText}>Open Settings</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.permBtnPrimary}
                  onPress={() => {
                    setLocPermVisible(false);
                    fetchGps(false);
                  }}>
                  <Text style={styles.permBtnPrimaryText}>Try Again</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ===================== STYLES ===================== */
const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: COLORS.background},
  container: {flex: 1},
  contentContainer: {paddingBottom: 100},

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
  headerTitle: {fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8},
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
  siteId: {fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)'},
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  errorMessage: {fontSize: 14, color: COLORS.text, marginBottom: 12},
  errorButton: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  errorButtonText: {color: '#fff', fontSize: 14, fontWeight: '700'},

  section: {marginHorizontal: 20, marginBottom: 20},
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {fontSize: 20, fontWeight: '700', color: COLORS.text},
  sectionSubtitle: {fontSize: 14, fontWeight: '600', color: COLORS.textLight},

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
  emptyText: {fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginBottom: 20},
  emptyAction: {backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12},
  emptyActionText: {color: '#fff', fontSize: 14, fontWeight: '700'},

  tableContainer: {borderRadius: 16, overflow: 'hidden'},
  table: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: 56,
  },
  thCell: {paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.border},
  thText: {fontSize: 12, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase'},
  tableRow: {flexDirection: 'row', minHeight: 60, borderBottomWidth: 1, borderBottomColor: COLORS.border},
  rowEven: {backgroundColor: '#fff'},
  rowOdd: {backgroundColor: 'rgba(5, 150, 105, 0.02)'},
  tdCell: {paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.border},
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

  fab: {position: 'absolute', right: 20, bottom: 30, elevation: 8},
  fabContent: {width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center'},

  editModalOverlay: {flex: 1, backgroundColor: COLORS.overlay},
  editModalContainer: {flex: 1, justifyContent: 'flex-end'},
  editModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.92,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  editModalTitle: {fontSize: 18, fontWeight: '900', color: COLORS.text},
  editModalSubtitle: {marginTop: 6, fontSize: 12, fontWeight: '700', color: COLORS.textLight},
  editModalClose: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalBody: {padding: 20},

  formSection: {marginBottom: 18},
  formSectionTitle: {fontSize: 14, fontWeight: '900', color: COLORS.text, marginBottom: 12},
  formRow: {flexDirection: 'row', gap: 12},
  formColumn: {flex: 1},

  selectedSpeciesBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(5,150,105,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  selectedSpeciesText: {fontSize: 12, fontWeight: '800', color: COLORS.primary},

  speciesCountsCard: {
    marginTop: 14,
    backgroundColor: 'rgba(14, 165, 233, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.14)',
    borderRadius: 16,
    padding: 14,
  },
  speciesCountsHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10},
  speciesCountsTitle: {flex: 1, fontSize: 14, fontWeight: '900', color: COLORS.text},
  totalChip: {
    backgroundColor: 'rgba(5,150,105,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  totalChipText: {fontSize: 12, fontWeight: '900', color: COLORS.primary},

  speciesCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(14, 165, 233, 0.12)',
  },
  speciesCountLeft: {flex: 1},
  speciesCountName: {fontSize: 13, fontWeight: '900', color: COLORS.text},
  speciesCountHint: {marginTop: 3, fontSize: 11, fontWeight: '700', color: COLORS.textLight},
  speciesCountInput: {
    width: 90,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    backgroundColor: '#fff',
    textAlign: 'center',
  },

  otherBox: {
    marginTop: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.16)',
    borderRadius: 16,
    padding: 12,
  },
  otherTitle: {fontSize: 13, fontWeight: '900', color: COLORS.text, marginBottom: 8},
  otherInput: {
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    backgroundColor: '#fff',
  },
  otherAddBtn: {
    marginTop: 10,
    backgroundColor: COLORS.info,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  otherAddBtnDisabled: {opacity: 0.6},
  otherAddBtnText: {color: '#fff', fontSize: 13, fontWeight: '900'},
  otherRemoveBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  otherRemoveBtnText: {fontSize: 12, fontWeight: '800', color: COLORS.danger},

  gpsCard: {backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, overflow: 'hidden', marginBottom: 12},
  gpsCardHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(5,150,105,0.06)', borderBottomWidth: 1, borderBottomColor: COLORS.border},
  gpsCardTitle: {fontSize: 13, fontWeight: '900', color: COLORS.text},
  gpsFetchButton: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12},
  gpsFetchButtonText: {color: '#fff', fontSize: 12, fontWeight: '900'},
  gpsCardBody: {paddingHorizontal: 14, paddingVertical: 14},
  gpsValue: {fontSize: 12, fontWeight: '800', color: COLORS.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'},
  gpsLoading: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10},
  gpsLoadingText: {fontSize: 12, fontWeight: '800', color: COLORS.textLight},

  imageUploadSection: {marginTop: 6},
  imageUploadButtons: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center'},
  imageUploadButton: {backgroundColor: COLORS.secondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12},
  imageCameraButton: {backgroundColor: COLORS.info, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12},
  imageClearButton: {backgroundColor: 'rgba(220,38,38,0.06)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.20)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8},
  imageUploadButtonContent: {flexDirection: 'row', alignItems: 'center', gap: 8},
  imageUploadButtonText: {color: '#fff', fontSize: 12, fontWeight: '900'},
  imageClearButtonText: {color: COLORS.danger, fontSize: 12, fontWeight: '900'},
  imagePreview: {marginTop: 12, backgroundColor: 'rgba(22,163,74,0.06)', borderWidth: 1, borderColor: 'rgba(22,163,74,0.16)', borderRadius: 14, padding: 12},
  imagePreviewHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6},
  imagePreviewTitle: {fontSize: 12, fontWeight: '900', color: COLORS.text},
  imagePreviewText: {fontSize: 12, fontWeight: '700', color: COLORS.textLight},

  editModalFooter: {flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: '#fff'},
  footerButtonSecondary: {flex: 1, backgroundColor: 'rgba(31, 41, 55, 0.06)', borderRadius: 14, paddingVertical: 14, alignItems: 'center'},
  footerButtonSecondaryText: {fontSize: 14, fontWeight: '900', color: COLORS.text},
  footerButtonPrimary: {flex: 2, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center'},
  footerButtonContent: {flexDirection: 'row', alignItems: 'center', gap: 8},
  footerButtonPrimaryText: {fontSize: 14, fontWeight: '900', color: '#fff'},

  viewerOverlay: {flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: 14},
  viewerBackdrop: {...StyleSheet.absoluteFillObject},
  viewerCard: {width: '100%', height: height * 0.75, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden'},
  viewerHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: 'rgba(31,41,55,0.03)'},
  viewerTitle: {flex: 1, fontSize: 14, fontWeight: '900', color: COLORS.text},
  viewerClose: {width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(31, 41, 55, 0.06)', alignItems: 'center', justifyContent: 'center', marginLeft: 10},
  viewerScroll: {flex: 1},
  viewerSlide: {width: width - 28, alignItems: 'center', justifyContent: 'center', padding: 14},
  viewerImage: {width: '100%', height: '100%'},
  viewerLinkBtn: {position: 'absolute', bottom: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12},
  viewerLinkText: {color: '#fff', fontSize: 12, fontWeight: '900'},
  viewerFooter: {paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: 'rgba(31,41,55,0.02)'},
  viewerFooterText: {fontSize: 12, fontWeight: '800', color: COLORS.textLight},

  permOverlay: {flex: 1, backgroundColor: COLORS.overlay, alignItems: 'center', justifyContent: 'center', padding: 20},
  permCard: {width: '100%', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 16},
  permTitle: {fontSize: 16, fontWeight: '900', color: COLORS.text, marginBottom: 8},
  permText: {fontSize: 13, fontWeight: '700', color: COLORS.textLight, marginBottom: 14},
  permActions: {flexDirection: 'row', gap: 10, justifyContent: 'flex-end'},
  permBtnSecondary: {paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(31,41,55,0.06)'},
  permBtnSecondaryText: {fontSize: 13, fontWeight: '900', color: COLORS.text},
  permBtnPrimary: {paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.primary},
  permBtnPrimaryText: {fontSize: 13, fontWeight: '900', color: '#fff'},
});
