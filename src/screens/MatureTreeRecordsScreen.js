// /screens/MatureTreeRecordsScreen.js
import React, {useCallback, useMemo, useState, useEffect} from 'react';
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
  RefreshControl,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  PermissionsAndroid,
  Linking,
  Switch,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import NetInfo from '@react-native-community/netinfo';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {useFocusEffect} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';

import FormRow from '../components/FormRow';
import {DropdownRow} from '../components/SelectRows';

const {height} = Dimensions.get('window');

/**
 * IMPORTANT
 * - For production you are using: http://be.lte.gisforestry.com
 * - For local testing like your curl: http://localhost:5000
 */
const API_BASE = 'http://be.lte.gisforestry.com';

// Lists / enums
const SPECIES_URL = `${API_BASE}/enum/species`;
const CONDITIONS_URL = `${API_BASE}/forest-tree-conditions`;

// Enumeration CRUD
const ENUMERATION_SUBMIT_URL = `${API_BASE}/enum/enumeration`; // POST create
const ENUMERATION_LIST_URL = `${API_BASE}/enum/enumeration`; // GET list
const ENUMERATION_UPDATE_URL = id => `${API_BASE}/enum/enumeration/${id}`; // PATCH edit/resubmit

// Upload
const TREE_ENUM_UPLOAD_URL = 'https://app.eco.gisforestry.com/aws-bucket/tree-enum';
const TREE_ENUM_UPLOAD_PATH = 'enumaration';
const TREE_ENUM_IS_MULTI = 'true';
const TREE_ENUM_FILE_NAME = 'chan';

// Navigator names
const SUPERDARI_ROUTE = 'Superdari';
const DISPOSAL_ROUTE = 'Disposal';

// Image rules you requested
const MIN_IMAGES = 1;
const MAX_IMAGES = 4;

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

export default function MatureTreeRecordsScreen({navigation, route}) {
  const enumeration = route?.params?.enumeration;

  // ---------- STATE ----------
  const [serverRecords, setServerRecords] = useState([]);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverRefreshing, setServerRefreshing] = useState(false);
  const [serverError, setServerError] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingServerId, setEditingServerId] = useState(null);

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

  const [speciesRows, setSpeciesRows] = useState([]);
  const [conditionRows, setConditionRows] = useState([]);
  const [speciesOptions, setSpeciesOptions] = useState([]);
  const [conditionOptions, setConditionOptions] = useState([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [conditionLoading, setConditionLoading] = useState(false);

  const [rdKm, setRdKm] = useState('');
  const [species, setSpecies] = useState('');
  const [speciesId, setSpeciesId] = useState(null);
  const [girth, setGirth] = useState('');
  const [condition, setCondition] = useState('');
  const [conditionId, setConditionId] = useState(null);

  // ✅ NEW FIELDS (your curl)
  const [takkiNumber, setTakkiNumber] = useState('');
  const [additionalRemarks, setAdditionalRemarks] = useState('');
  const [isDisputed, setIsDisputed] = useState(false);
  const [side, setSide] = useState(''); // "Left" | "Right"

  const [gpsAuto, setGpsAuto] = useState('');
  const [gpsManual, setGpsManual] = useState('');
  const [gpsSource, setGpsSource] = useState('');
  const [gpsFetching, setGpsFetching] = useState(false);

  // Multi Image + upload state
  const [pictureAssets, setPictureAssets] = useState([]); // local selected assets (not uploaded yet)
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadedImageUrls, setUploadedImageUrls] = useState([]); // existing/after-upload URLs

  // ✅ Rejection popup state
  const [rejectionModal, setRejectionModal] = useState({
    visible: false,
    rejectedBy: '',
    remarks: '',
  });

  // ---------- RD/KM DROPDOWN OPTIONS ----------
  const rdKmOptions = useMemo(() => {
    const startRaw = enumeration?.rdFrom ?? enumeration?.rd_from ?? 1;
    const endRaw = enumeration?.rdTo ?? enumeration?.rd_to ?? startRaw;

    const start = Number(startRaw);
    const end = Number(endRaw);

    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];

    const s = Math.min(start, end);
    const e = Math.max(start, end);

    const opts = [];
    for (let i = s; i <= e; i += 1) opts.push(String(i));
    return opts;
  }, [enumeration?.rdFrom, enumeration?.rdTo, enumeration?.rd_from, enumeration?.rd_to]);

  // ---------- SIDE RULE (show dropdown only if BOTH) ----------
  const siteSideRaw = useMemo(() => {
    return (
      enumeration?.side ||
      enumeration?.site_side ||
      enumeration?.siteSide ||
      enumeration?.nameOfSite?.side ||
      enumeration?.nameOfSite?.site_side ||
      ''
    );
  }, [enumeration]);

  const sideMode = useMemo(() => String(siteSideRaw || '').trim().toLowerCase(), [siteSideRaw]);
  const showSideDropdown = useMemo(() => sideMode === 'both', [sideMode]);
  const sideOptions = useMemo(() => ['Left', 'Right'], []);

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

  const safeJson = async res => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  // ✅ SAFER NAVIGATION
  const navigateSafe = useCallback(
    (screenName, params) => {
      if (!screenName) return;

      try {
        navigation.navigate(screenName, params);
        return;
      } catch (e) {}

      const parentNav = navigation.getParent?.();
      if (parentNav) {
        try {
          parentNav.navigate(screenName, params);
          return;
        } catch (e) {}
      }

      Alert.alert(
        'Navigation Error',
        `Screen "${screenName}" is not registered in the current navigator.\n\nFix:\n• Ensure you added "${screenName}" in your Stack/Drawer navigator.\n• Or update SUPERDARI_ROUTE/DISPOSAL_ROUTE constants to match your navigator screen name.`,
      );
    },
    [navigation],
  );

  // Upload response helper
  const extractUploadUrls = json => {
    if (!json) return [];

    const urls = [];
    const push = v => {
      if (!v) return;
      if (typeof v === 'string') urls.push(v);
      if (Array.isArray(v)) v.forEach(x => typeof x === 'string' && urls.push(x));
    };

    if (Array.isArray(json?.data)) {
      json.data.forEach(x => {
        push(x?.url);
        push(x?.availableSizes?.thumbnail);
        push(x?.availableSizes?.image);
      });
    }

    push(json?.url);
    push(json?.data?.url);

    return Array.from(new Set(urls.filter(Boolean)));
  };

  // ---------- STATUS / UI RULES ----------
  const hasAny = v => Array.isArray(v) && v.length > 0;

  const normalizeRole = role => {
    const r = String(role || '').trim().toLowerCase();
    if (!r) return '';
    if (r.includes('block')) return 'Block Officer';
    if (r.includes('sdfo')) return 'SDFO';
    if (r.includes('dfo')) return 'DFO';
    if (r.includes('survey')) return 'Surveyor';
    if (r.includes('guard') || r.includes('beat')) return 'Guard';
    return String(role || '').trim();
  };

  const ROLE_ORDER = ['Guard', 'Block Officer', 'SDFO', 'DFO', 'Surveyor'];

  const nextRole = currentRole => {
    const idx = ROLE_ORDER.indexOf(currentRole);
    return idx >= 0 ? ROLE_ORDER[idx + 1] || null : null;
  };

  const deriveRowUi = r => {
    const disposalExists = hasAny(r?.disposal);
    const superdariExists = hasAny(r?.superdari);

    if (disposalExists && superdariExists) {
      return {
        statusText: 'Disposed + Superdari',
        statusColor: COLORS.warning,
        showEdit: false,
        showPills: false,
        rowAccent: null,
        isRejected: false,
      };
    }
    if (disposalExists) {
      return {
        statusText: 'Disposed',
        statusColor: COLORS.secondary,
        showEdit: false,
        showPills: false,
        rowAccent: null,
        isRejected: false,
      };
    }
    if (superdariExists) {
      return {
        statusText: 'Superdari',
        statusColor: COLORS.info,
        showEdit: false,
        showPills: false,
        rowAccent: null,
        isRejected: false,
      };
    }

    const latest = r?.latestStatus || null;
    const actionRaw = String(latest?.action || '').trim();
    const action = actionRaw.toLowerCase();
    const byRole = normalizeRole(latest?.user_role || '');
    const byDesignation = String(latest?.designation || '').trim();
    const remarks = String(latest?.remarks || '').trim();

    if (!latest || !actionRaw) {
      return {
        statusText: 'Pending (Block Officer)',
        statusColor: COLORS.textLight,
        showEdit: false,
        showPills: true,
        rowAccent: null,
        isRejected: false,
      };
    }

    if (action === 'rejected') {
      const rejectBy = byDesignation || byRole || 'Officer';
      return {
        statusText: `Rejected by ${rejectBy}`,
        statusColor: COLORS.danger,
        showEdit: true,
        showPills: true,
        rowAccent: 'rejected',
        isRejected: true,
        _remarks: remarks,
        _rejectedBy: rejectBy,
      };
    }

    if (action === 'approved' || action === 'verified') {
      const approver = byRole || 'Block Officer';
      const nxt = nextRole(approver);

      if (!nxt) {
        return {
          statusText: 'Final Approved',
          statusColor: COLORS.success,
          showEdit: false,
          showPills: true,
          rowAccent: null,
          isRejected: false,
        };
      }

      return {
        statusText: `Approved • Pending (${nxt})`,
        statusColor: COLORS.warning,
        showEdit: false,
        showPills: true,
        rowAccent: null,
        isRejected: false,
      };
    }

    return {
      statusText: 'Pending',
      statusColor: COLORS.textLight,
      showEdit: false,
      showPills: true,
      rowAccent: null,
      isRejected: false,
    };
  };

  const openRejectionPopup = row => {
    const latest = row?.latestStatus || null;
    const action = String(latest?.action || '').trim().toLowerCase();
    if (action !== 'rejected') return;

    const byRole = normalizeRole(latest?.user_role || '');
    const byDesignation = String(latest?.designation || '').trim();
    const remarks = String(latest?.remarks || '').trim();

    setRejectionModal({
      visible: true,
      rejectedBy: byDesignation || byRole || 'Officer',
      remarks: remarks || 'No remarks provided.',
    });
  };

  const closeRejectionPopup = () => {
    setRejectionModal({visible: false, rejectedBy: '', remarks: ''});
  };

  // ---------- CAMERA PERMISSION + PICKER MENU ----------
  const openAppSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert('Settings', 'Please open app settings and allow Camera permission.');
    }
  };

  const ensureCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title: 'Camera Permission',
        message: 'This app needs camera access to take photos.',
        buttonPositive: 'Allow',
        buttonNegative: 'Cancel',
      });

      if (granted === PermissionsAndroid.RESULTS.GRANTED) return true;

      Alert.alert(
        'Camera Permission Required',
        'Camera permission is not allowed. Please enable it from Settings to take a photo.',
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Open Settings', onPress: openAppSettings},
        ],
      );
      return false;
    } catch {
      Alert.alert('Permission Error', 'Unable to request camera permission.');
      return false;
    }
  };

  const totalSelectedCount = useMemo(() => {
    const localCount = pictureAssets?.length || 0;
    const urlCount = uploadedImageUrls?.length || 0;
    return localCount > 0 ? localCount : urlCount;
  }, [pictureAssets, uploadedImageUrls]);

  const showImageSourceMenu = () => {
    const remaining = MAX_IMAGES - totalSelectedCount;
    if (remaining <= 0) {
      return Alert.alert('Limit Reached', `You can add maximum ${MAX_IMAGES} images.`);
    }

    Alert.alert('Add Images', `Choose source (Remaining: ${remaining})`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Take Photo',
        onPress: async () => {
          const ok = await ensureCameraPermission();
          if (!ok) return;

          launchCamera(
            {
              mediaType: 'photo',
              quality: 0.7,
              cameraType: 'back',
              saveToPhotos: false,
            },
            res => {
              if (res?.didCancel) return;

              if (res?.errorCode) {
                const code = String(res.errorCode || '');
                if (code.includes('permission')) {
                  Alert.alert(
                    'Camera Permission Required',
                    'Camera permission is not allowed. Please enable it from Settings.',
                    [
                      {text: 'Cancel', style: 'cancel'},
                      {text: 'Open Settings', onPress: openAppSettings},
                    ],
                  );
                  return;
                }
                Alert.alert('Camera Error', res?.errorMessage || res.errorCode);
                return;
              }

              const assets = Array.isArray(res?.assets) ? res.assets : [];
              if (!assets.length) return;

              setUploadedImageUrls([]);
              setPictureAssets(prev => {
                const next = [...(Array.isArray(prev) ? prev : []), ...assets].slice(0, MAX_IMAGES);
                return next;
              });
            },
          );
        },
      },
      {
        text: 'Choose From Gallery',
        onPress: () => {
          launchImageLibrary(
            {
              mediaType: 'photo',
              quality: 0.7,
              selectionLimit: Math.min(remaining, MAX_IMAGES),
            },
            res => {
              if (res?.didCancel) return;

              if (res?.errorCode) {
                Alert.alert('Image Error', res?.errorMessage || res.errorCode);
                return;
              }

              const assets = Array.isArray(res?.assets) ? res.assets : [];
              if (!assets.length) return;

              setUploadedImageUrls([]);
              setPictureAssets(prev => {
                const base = Array.isArray(prev) ? prev : [];
                const next = [...base, ...assets].slice(0, MAX_IMAGES);
                return next;
              });
            },
          );
        },
      },
    ]);
  };

  const removeLocalImageAt = idx => {
    setPictureAssets(prev => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      arr.splice(idx, 1);
      return arr;
    });
  };

  // ---------- API CALLS ----------
  const fetchServerEnumerations = useCallback(
    async ({refresh = false} = {}) => {
      const siteId = getNameOfSiteId();
      try {
        refresh ? setServerRefreshing(true) : setServerLoading(true);
        setServerError('');

        const token = await getAuthToken();
        if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

        const res = await fetch(ENUMERATION_LIST_URL, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await safeJson(res);

        if (!res.ok) {
          const msg = json?.message || json?.error || `API Error (${res.status})`;
          throw new Error(msg);
        }

        const rows = Array.isArray(json?.data) ? json.data : normalizeList(json);
        const list = Array.isArray(rows) ? rows : [];

        const filtered =
          siteId != null ? list.filter(x => String(x?.name_of_site_id) === String(siteId)) : list;

        setServerRecords(filtered);
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

  const fetchSpecies = useCallback(async () => {
    try {
      setSpeciesLoading(true);
      const res = await fetch(SPECIES_URL);
      const json = await safeJson(res);
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
      const token = await getAuthToken();
      const headers = token ? {Authorization: `Bearer ${token}`} : undefined;

      const res = await fetch(CONDITIONS_URL, {headers});
      const json = await safeJson(res);
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

  // Image upload
  const uploadTreeEnumImages = useCallback(async (assets = []) => {
    if (!assets?.length) return [];

    const net = await NetInfo.fetch();
    const online = !!net.isConnected && (net.isInternetReachable ?? true);
    if (!online)
      throw new Error('No internet connection. Please connect to internet to upload images.');

    const fd = new FormData();

    assets.forEach((a, idx) => {
      const uri = a?.uri;
      if (!uri) return;

      const name =
        a?.fileName ||
        a?.name ||
        `tree_${Date.now()}_${idx}.${String(a?.type || 'image/jpeg').includes('png') ? 'png' : 'jpg'}`;

      const type = a?.type || 'image/jpeg';

      fd.append('files', {uri, type, name});
    });

    fd.append('uploadPath', TREE_ENUM_UPLOAD_PATH);
    fd.append('isMulti', TREE_ENUM_IS_MULTI);
    fd.append('fileName', TREE_ENUM_FILE_NAME);

    const res = await fetch(TREE_ENUM_UPLOAD_URL, {
      method: 'POST',
      body: fd,
    });

    const json = await safeJson(res);

    if (!res.ok) {
      const msg = json?.message || json?.error || `Upload API Error (${res.status})`;
      throw new Error(msg);
    }

    return extractUploadUrls(json);
  }, []);

  // ---------- EFFECTS ----------
  useEffect(() => {
    fetchServerEnumerations();
    fetchSpecies();
    fetchConditions();
  }, [fetchServerEnumerations, fetchSpecies, fetchConditions]);

  useFocusEffect(
    useCallback(() => {
      fetchServerEnumerations({refresh: true});
    }, [fetchServerEnumerations]),
  );

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

  useEffect(() => {
    if (!modalVisible) return;
    if (isEdit) return;
    fetchLocationSmart({silent: true});
  }, [modalVisible, isEdit, fetchLocationSmart]);

  // ---------- FORM HANDLERS ----------
  const resetForm = () => {
    setIsEdit(false);
    setEditingServerId(null);

    setRdKm(rdKmOptions?.[0] ?? '');

    setSpecies('');
    setSpeciesId(null);
    setGirth('');
    setCondition('');
    setConditionId(null);

    setTakkiNumber('');
    setAdditionalRemarks('');
    setIsDisputed(false);

    // ✅ side default from site setting if not BOTH
    if (sideMode === 'left') setSide('Left');
    else if (sideMode === 'right') setSide('Right');
    else setSide('');

    setGpsAuto('');
    setGpsManual('');
    setGpsSource('');
    setPictureAssets([]);
    setUploadingImages(false);
    setUploadedImageUrls([]);
  };

  const openAddForm = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditFormServer = row => {
    setIsEdit(true);
    setEditingServerId(row?.id ?? null);

    setRdKm(row?.rd_km != null ? String(row.rd_km) : rdKmOptions?.[0] ?? '');

    setSpecies('');
    setSpeciesId(row?.species_id ?? null);
    setGirth(String(row?.girth ?? ''));
    setCondition('');
    setConditionId(row?.condition_id ?? null);

    // ✅ new fields from server
    setTakkiNumber(row?.takkiNumber != null ? String(row.takkiNumber) : '');
    setAdditionalRemarks(String(row?.additionalRemarks ?? row?.additional_remarks ?? ''));
    setIsDisputed(!!row?.isDisputed);

    const rowSide = String(row?.side || '').trim();
    if (rowSide) setSide(rowSide);
    else if (sideMode === 'left') setSide('Left');
    else if (sideMode === 'right') setSide('Right');
    else setSide('');

    const auto =
      row?.auto_lat != null && row?.auto_long != null ? `${row.auto_lat}, ${row.auto_long}` : '';
    const manual =
      row?.manual_lat != null && row?.manual_long != null
        ? `${row.manual_lat}, ${row.manual_long}`
        : '';

    setGpsAuto(auto);
    setGpsManual(manual || auto);
    setGpsSource(manual ? 'MANUAL' : auto ? 'GPS' : '');

    setPictureAssets([]);
    setUploadedImageUrls(Array.isArray(row?.pictures) ? row.pictures.slice(0, MAX_IMAGES) : []);

    setModalVisible(true);
  };

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

    const json = await safeJson(res);

    if (!res.ok) {
      const msg = json?.message || json?.error || `API Error (${res.status})`;
      throw new Error(msg);
    }

    return json;
  };

  const patchToApi = async (id, body) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');
    if (!id) throw new Error('Missing record id for update.');

    const res = await fetch(ENUMERATION_UPDATE_URL(id), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const json = await safeJson(res);

    if (!res.ok) {
      const msg = json?.message || json?.error || `API Error (${res.status})`;
      throw new Error(msg);
    }

    return json;
  };

  const saveRecord = async () => {
    const siteId = getNameOfSiteId();
    if (!siteId) return Alert.alert('Missing', 'name_of_site_id not found.');

    const chosenSpeciesId = speciesId ?? (speciesRows.find(x => x.name === species)?.id ?? null);
    const chosenConditionId =
      conditionId ?? (conditionRows.find(x => x.name === condition)?.id ?? null);

    if (!chosenSpeciesId) return Alert.alert('Missing', 'Species is required');
    if (!chosenConditionId) return Alert.alert('Missing', 'Condition is required');

    const rdKmNumber = Number(rdKm);
    if (!Number.isFinite(rdKmNumber) || rdKmNumber <= 0) {
      return Alert.alert('Missing', 'Please select RD/KM from dropdown');
    }

    // ✅ side validation (only if BOTH)
    let finalSide = side;
    if (showSideDropdown) {
      if (!finalSide || (finalSide !== 'Left' && finalSide !== 'Right')) {
        return Alert.alert('Missing', 'Please select Side (Left/Right)');
      }
    } else {
      // auto-fill from site if possible
      if (sideMode === 'left') finalSide = 'Left';
      else if (sideMode === 'right') finalSide = 'Right';
      // if unknown and not BOTH, do not block; send only if non-empty
    }

    // ✅ takkiNumber (optional but you wanted on top; validate numeric if filled)
    const tn = String(takkiNumber || '').trim();
    const takkiNumberValue = tn ? Number(tn) : null;
    if (tn && !Number.isFinite(takkiNumberValue)) {
      return Alert.alert('Invalid', 'Takki Number must be numeric');
    }

    const {lat: autoLat, lng: autoLng} = parseLatLng(gpsAuto);
    const {lat: manualLat, lng: manualLng} = parseLatLng(gpsManual);

    const chosenCount =
      (pictureAssets?.length || 0) > 0
        ? pictureAssets?.length || 0
        : uploadedImageUrls?.length || 0;

    if (chosenCount < MIN_IMAGES) {
      return Alert.alert('Images Required', `Please add at least ${MIN_IMAGES} image.`);
    }
    if (chosenCount > MAX_IMAGES) {
      return Alert.alert('Too Many Images', `You can add maximum ${MAX_IMAGES} images.`);
    }

    // 1) Upload images (if newly selected)
    let pictures = [];
    try {
      if (pictureAssets?.length) {
        const assetsToUpload = pictureAssets.slice(0, MAX_IMAGES);

        setUploadingImages(true);
        const urls = await uploadTreeEnumImages(assetsToUpload);

        const safeUrls = Array.isArray(urls) ? urls.slice(0, MAX_IMAGES) : [];
        setUploadedImageUrls(safeUrls);

        if (!safeUrls?.length) {
          Alert.alert(
            'Upload Response',
            'Images uploaded, but server did not return readable URLs. Saving without picture URLs.',
          );
        } else {
          pictures = safeUrls;
        }
      } else {
        if (Array.isArray(uploadedImageUrls) && uploadedImageUrls.length) {
          pictures = uploadedImageUrls.slice(0, MAX_IMAGES);
        }
      }
    } catch (e) {
      setUploadingImages(false);
      return Alert.alert('Upload Failed', e?.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
    }

    if (!pictures?.length) {
      return Alert.alert('Images Required', 'Image upload did not return URLs. Please try again.');
    }

    // ✅ build body per your curl
    const apiBody = {
      name_of_site_id: Number(siteId),
      species_id: Number(chosenSpeciesId),
      girth: girth ? String(girth) : '',
      condition_id: Number(chosenConditionId),
      rd_km: rdKmNumber,

      // ✅ new fields
      isDisputed: !!isDisputed,
      additionalRemarks: String(additionalRemarks || '').trim(),
      ...(takkiNumberValue != null ? {takkiNumber: takkiNumberValue} : {}),
      ...(finalSide ? {side: finalSide} : {}),

      pictures,
      auto_lat: autoLat,
      auto_long: autoLng,
      manual_lat: manualLat,
      manual_long: manualLng,
    };

    if (isEdit) {
      try {
        await patchToApi(editingServerId, apiBody);
        setModalVisible(false);
        fetchServerEnumerations({refresh: true});
        Alert.alert('Success', 'Record updated and resubmitted successfully.');
      } catch (e) {
        Alert.alert('Update Failed', e?.message || 'Failed to update');
      }
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

  // ---------- DECORATION ----------
  const speciesById = useMemo(() => {
    const map = new Map();
    speciesRows.forEach(s => map.set(String(s.id), s.name));
    return map;
  }, [speciesRows]);

  const conditionById = useMemo(() => {
    const map = new Map();
    conditionRows.forEach(c => map.set(String(c.id), c.name));
    return map;
  }, [conditionRows]);

  const serverRowsDecorated = useMemo(() => {
    return serverRecords.map(r => {
      const sp =
        r?.species_name ||
        r?.species?.name ||
        (r?.species_id != null ? speciesById.get(String(r.species_id)) : null) ||
        (r?.species_id != null ? `#${r.species_id}` : '—');

      const cond =
        r?.condition_name ||
        r?.condition?.name ||
        (r?.condition_id != null ? conditionById.get(String(r.condition_id)) : null) ||
        (r?.condition_id != null ? `#${r.condition_id}` : '—');

      return {
        ...r,
        _speciesLabel: sp,
        _conditionLabel: cond,
        _autoGps:
          r?.auto_lat != null && r?.auto_long != null ? `${r.auto_lat}, ${r.auto_long}` : '—',
        _manualGps:
          r?.manual_lat != null && r?.manual_long != null
            ? `${r.manual_lat}, ${r.manual_long}`
            : '—',
      };
    });
  }, [serverRecords, speciesById, conditionById]);

  // ---------- FILTERING ----------
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

      const ui = deriveRowUi(r);
      const blob = [
        r?.id,
        r?.rd_km,
        r?._speciesLabel,
        r?._conditionLabel,
        r?._autoGps,
        r?._manualGps,
        r?.girth,
        r?.created_at,
        ui?.statusText,
        r?.nameOfSite?.site_name,
        r?.takkiNumber,
        r?.additionalRemarks,
        r?.side,
        String(r?.isDisputed),
      ]
        .filter(v => v !== null && v !== undefined)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [serverRowsDecorated, search, filters]);

  // ---------- RENDER ----------
  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.headerGradient}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Enumeration Records</Text>
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
            <Text style={styles.siteId}>Site ID: {String(getNameOfSiteId() ?? '—')}</Text>
          </View>

          <TouchableOpacity style={styles.headerAction} onPress={() => setFilterModalVisible(true)}>
            <Ionicons name="filter" size={22} color="#fff" />
            {activeFilterCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Main */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={serverRefreshing}
            onRefresh={() => fetchServerEnumerations({refresh: true})}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.textLight} style={styles.searchIcon} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by ID, species, condition, GPS, status..."
              placeholderTextColor={COLORS.textLight}
              style={styles.searchInput}
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear}>
                <Ionicons name="close-circle" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{filteredServer.length}</Text>
            <Text style={styles.statLabel}>Filtered</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{serverRecords.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons
              name={serverLoading ? 'refresh' : 'checkmark-circle'}
              size={24}
              color={serverLoading ? COLORS.warning : COLORS.success}
            />
            <Text style={styles.statLabel}>{serverLoading ? 'Loading...' : 'Ready'}</Text>
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
              onPress={() => fetchServerEnumerations({refresh: true})}>
              <Text style={styles.errorButtonText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Records Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tree Records</Text>
            <Text style={styles.sectionSubtitle}>
              {filteredServer.length} of {serverRecords.length} records
            </Text>
          </View>

          {filteredServer.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={64} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No Records Found</Text>
              <Text style={styles.emptyText}>
                {serverRecords.length === 0
                  ? 'No tree records for this site yet.'
                  : 'No records match your search criteria.'}
              </Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity style={styles.emptyAction} onPress={clearAll}>
                  <Text style={styles.emptyActionText}>Clear Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableContainer}>
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  {[
                    {label: 'ID', width: 80},
                    {label: 'RD/KM', width: 90},
                    {label: 'Species', width: 140},
                    {label: 'Condition', width: 140},
                    {label: 'Girth', width: 100},
                    {label: 'Auto GPS', width: 180},
                    {label: 'Manual GPS', width: 180},
                    {label: 'Status', width: 220},
                    {label: 'Actions', width: 320},
                  ].map((col, idx) => (
                    <View key={idx} style={[styles.thCell, {width: col.width}]}>
                      <Text style={styles.thText}>{col.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Table Rows */}
                {filteredServer.map((r, idx) => {
                  const ui = deriveRowUi(r);

                  const rowStyle = [
                    styles.tableRow,
                    idx % 2 === 0 ? styles.rowEven : styles.rowOdd,
                    ui.rowAccent === 'rejected' ? styles.rowRejected : null,
                  ];

                  return (
                    <View key={String(r.id ?? idx)} style={rowStyle}>
                      <View style={[styles.tdCell, {width: 80}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r.id ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 90}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r.rd_km ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 140}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r._speciesLabel ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 140}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r._conditionLabel ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 100}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r.girth ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 180}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r._autoGps ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 180}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r._manualGps ?? '—')}
                        </Text>
                      </View>

                      {/* Clickable status only if rejected */}
                      <View style={[styles.tdCell, {width: 220}]}>
                        {ui.isRejected ? (
                          <TouchableOpacity activeOpacity={0.85} onPress={() => openRejectionPopup(r)}>
                            <View style={[styles.statusBadge, {backgroundColor: `${ui.statusColor}15`}]}>
                              <View style={[styles.statusDot, {backgroundColor: ui.statusColor}]} />
                              <Text style={[styles.statusText, {color: ui.statusColor}]} numberOfLines={2}>
                                {ui.statusText}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.statusBadge, {backgroundColor: `${ui.statusColor}15`}]}>
                            <View style={[styles.statusDot, {backgroundColor: ui.statusColor}]} />
                            <Text style={[styles.statusText, {color: ui.statusColor}]} numberOfLines={2}>
                              {ui.statusText}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={[styles.tdCell, styles.actionsCell, {width: 320}]}>
                        {ui.showEdit && (
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => openEditFormServer(r)}>
                            <Ionicons name="create-outline" size={16} color={COLORS.secondary} />
                            <Text style={styles.actionButtonText}>Edit</Text>
                          </TouchableOpacity>
                        )}

                        {ui.showPills && (
                          <>
                            <TouchableOpacity
                              style={[styles.actionPill, {backgroundColor: COLORS.primaryDark}]}
                              onPress={() =>
                                navigateSafe(DISPOSAL_ROUTE, {treeId: r.id, enumeration})
                              }>
                              <Text style={styles.actionPillText}>Dispose</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.actionPill, {backgroundColor: COLORS.info}]}
                              onPress={() =>
                                navigateSafe(SUPERDARI_ROUTE, {treeId: r.id, enumeration})
                              }>
                              <Text style={styles.actionPillText}>Superdari</Text>
                            </TouchableOpacity>
                          </>
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
        <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.fabGradient}>
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
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
            <LinearGradient colors={['#fff', '#f8fafc']} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons name="filter" size={24} color={COLORS.primary} />
                  <Text style={styles.modalTitle}>Advanced Filters</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setFilterModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
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

                <View style={styles.filterRow}>
                  <View style={styles.filterColumn}>
                    <FormRow
                      label="Date From (YYYY-MM-DD)"
                      value={filters.dateFrom}
                      onChangeText={v => setFilters(prev => ({...prev, dateFrom: v}))}
                      placeholder="2025-12-01"
                    />
                  </View>
                  <View style={styles.filterColumn}>
                    <FormRow
                      label="Date To (YYYY-MM-DD)"
                      value={filters.dateTo}
                      onChangeText={v => setFilters(prev => ({...prev, dateTo: v}))}
                      placeholder="2025-12-31"
                    />
                  </View>
                </View>

                <View style={styles.filterRow}>
                  <View style={styles.filterColumn}>
                    <FormRow
                      label="RD/KM From"
                      value={filters.kmFrom}
                      onChangeText={v => setFilters(prev => ({...prev, kmFrom: v}))}
                      placeholder="e.g. 10"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.filterColumn}>
                    <FormRow
                      label="RD/KM To"
                      value={filters.kmTo}
                      onChangeText={v => setFilters(prev => ({...prev, kmTo: v}))}
                      placeholder="e.g. 50"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalButtonSecondary}
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
                    <Text style={styles.modalButtonSecondaryText}>Reset All</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalButtonPrimary}
                    onPress={() => setFilterModalVisible(false)}>
                    <Text style={styles.modalButtonPrimaryText}>Apply Filters</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Rejection Reason Modal */}
      <Modal
        transparent
        visible={rejectionModal.visible}
        animationType="fade"
        onRequestClose={closeRejectionPopup}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={closeRejectionPopup}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, {maxHeight: height * 0.5}]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons name="alert-circle" size={24} color={COLORS.danger} />
                  <Text style={styles.modalTitle}>Rejection Reason</Text>
                </View>
                <TouchableOpacity style={styles.modalClose} onPress={closeRejectionPopup}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={{padding: 20}}>
                <Text style={{fontSize: 13, fontWeight: '800', color: COLORS.textLight}}>
                  Rejected By
                </Text>
                <Text style={{fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 14}}>
                  {rejectionModal.rejectedBy || 'Officer'}
                </Text>

                <Text style={{fontSize: 13, fontWeight: '800', color: COLORS.textLight}}>
                  Remarks
                </Text>
                <View
                  style={{
                    marginTop: 8,
                    backgroundColor: 'rgba(239,68,68,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(239,68,68,0.20)',
                    borderRadius: 14,
                    padding: 14,
                  }}>
                  <Text style={{fontSize: 14, fontWeight: '600', color: COLORS.text, lineHeight: 20}}>
                    {rejectionModal.remarks}
                  </Text>
                </View>

                <TouchableOpacity
                  style={{
                    marginTop: 16,
                    backgroundColor: COLORS.danger,
                    paddingVertical: 14,
                    borderRadius: 14,
                    alignItems: 'center',
                  }}
                  onPress={closeRejectionPopup}>
                  <Text style={{color: '#fff', fontWeight: '800'}}>Close</Text>
                </TouchableOpacity>
              </View>
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
            <LinearGradient colors={['#fff', '#f8fafc']} style={styles.editModalContent}>
              <View style={styles.editModalHeader}>
                <View>
                  <Text style={styles.editModalTitle}>
                    {isEdit ? 'Edit Tree Record' : 'Add New Tree'}
                  </Text>
                  {isEdit && editingServerId && (
                    <Text style={styles.editModalSubtitle}>ID: {editingServerId}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.editModalClose}
                  onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.editModalBody}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">

                {/* ✅ Takki Number on TOP */}
                <FormRow
                  label="Takki Number"
                  value={takkiNumber}
                  onChangeText={setTakkiNumber}
                  placeholder="e.g. 123"
                  keyboardType="numeric"
                />

                {/* ✅ Side dropdown only if BOTH */}
                {showSideDropdown && (
                  <DropdownRow
                    label="Side"
                    value={side}
                    onChange={v => setSide(v)}
                    options={sideOptions}
                    required
                  />
                )}

                {/* RD/KM */}
                <DropdownRow
                  label="RD/KM"
                  value={rdKm}
                  onChange={v => setRdKm(v)}
                  options={rdKmOptions}
                  disabled={!rdKmOptions?.length}
                  required
                />

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

                <FormRow label="Girth" value={girth} onChangeText={setGirth} placeholder='e.g. "24 inches"' />

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

                {/* ✅ Additional Remarks */}
                <FormRow
                  label="Additional Remarks"
                  value={additionalRemarks}
                  onChangeText={setAdditionalRemarks}
                  placeholder="e.g. Located near the river bank"
                />

                {/* ✅ Is Disputed BELOW Additional Remarks */}
                <View style={styles.switchRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.switchLabel}>Is Disputed</Text>
                    <Text style={styles.switchHint}>Turn on if the tree is disputed.</Text>
                  </View>
                  <Switch value={isDisputed} onValueChange={setIsDisputed} />
                </View>

                {/* GPS Section */}
                <View style={styles.gpsSection}>
                  <Text style={styles.sectionLabel}>Location Coordinates</Text>

                  <View style={styles.gpsAutoCard}>
                    <View style={styles.gpsHeader}>
                      <Text style={styles.gpsLabel}>Auto Coordinates</Text>
                      <View style={styles.gpsStatus}>
                        {!!gpsSource && (
                          <View style={styles.gpsSource}>
                            <Text style={styles.gpsSourceText}>{gpsSource}</Text>
                          </View>
                        )}
                        {gpsFetching && (
                          <View style={styles.gpsLoading}>
                            <Ionicons name="refresh" size={14} color={COLORS.warning} />
                            <Text style={styles.gpsLoadingText}>Fetching...</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <Text style={styles.gpsValue}>{gpsAuto || '—'}</Text>

                    <View style={styles.gpsButtons}>
                      <TouchableOpacity
                        style={[styles.gpsButton, gpsFetching && styles.gpsButtonDisabled]}
                        disabled={gpsFetching}
                        onPress={() => fetchLocationSmart()}>
                        <Ionicons name="locate" size={16} color="#fff" />
                        <Text style={styles.gpsButtonText}>Auto Fetch</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.gpsButton, styles.gpsButtonAlt]}
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
                        <Ionicons name="navigate" size={16} color="#fff" />
                        <Text style={styles.gpsButtonText}>High Accuracy</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <FormRow
                    label="Manual Coordinates (lat, long)"
                    value={gpsManual}
                    onChangeText={t => {
                      setGpsManual(t);
                      setGpsSource(String(t || '').trim() ? 'MANUAL' : gpsSource);
                    }}
                    placeholder="e.g. 31.520370, 74.358749"
                  />

                  <View style={styles.finalGpsPreview}>
                    <Text style={styles.finalGpsLabel}>Will Save:</Text>
                    <Text style={styles.finalGpsValue}>
                      {(gpsManual || '').trim() || (gpsAuto || '').trim() || 'No coordinates'}
                    </Text>
                  </View>
                </View>

                {/* Image Section */}
                <View style={styles.imageSection}>
                  <TouchableOpacity
                    style={styles.imageButton}
                    onPress={showImageSourceMenu}
                    disabled={uploadingImages}>
                    <Ionicons name="camera-outline" size={24} color={COLORS.primary} />
                    <View style={styles.imageButtonContent}>
                      <Text style={styles.imageButtonTitle}>
                        {totalSelectedCount ? 'Add / Change Images' : 'Add Images'}
                      </Text>
                      <Text style={styles.imageButtonSubtitle}>
                        Minimum {MIN_IMAGES}, Maximum {MAX_IMAGES} images. Selected: {totalSelectedCount}
                      </Text>
                    </View>

                    {uploadingImages && (
                      <View style={styles.inlineLoader}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      </View>
                    )}
                  </TouchableOpacity>

                  {!!pictureAssets?.length && (
                    <>
                      <View style={styles.imagePreview}>
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                        <Text style={styles.imagePreviewText} numberOfLines={1}>
                          Selected (Local): {pictureAssets.length} image(s)
                        </Text>
                      </View>

                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 10}}>
                        {pictureAssets.map((a, idx) => (
                          <View key={`${a?.uri || 'img'}_${idx}`} style={styles.thumbWrap}>
                            <View style={styles.thumbInner}>
                              <Text style={{fontSize: 11, fontWeight: '800', color: COLORS.text}}>
                                Img {idx + 1}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.thumbClose}
                              onPress={() => removeLocalImageAt(idx)}
                              activeOpacity={0.8}>
                              <Ionicons name="close-circle" size={18} color={COLORS.danger} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    </>
                  )}

                  {!!uploadedImageUrls?.length && !pictureAssets?.length && (
                    <View style={styles.uploadedPreview}>
                      <Ionicons name="cloud-done-outline" size={16} color={COLORS.info} />
                      <Text style={styles.uploadedPreviewText} numberOfLines={2}>
                        Existing (Server): {uploadedImageUrls.length} file(s)
                      </Text>
                    </View>
                  )}

                  {!!pictureAssets?.length && !uploadedImageUrls?.length && (
                    <View style={styles.imageHint}>
                      <Ionicons name="information-circle-outline" size={16} color={COLORS.textLight} />
                      <Text style={styles.imageHintText}>
                        Images will upload automatically when you press “Save Record”.
                      </Text>
                    </View>
                  )}

                  <View style={styles.imageHint}>
                    <Ionicons name="lock-closed-outline" size={16} color={COLORS.textLight} />
                    <Text style={styles.imageHintText}>
                      If Camera permission is blocked, use “Open Settings” when prompted.
                    </Text>
                  </View>

                  <View style={styles.imageHint}>
                    <Ionicons name="folder-outline" size={16} color={COLORS.textLight} />
                    <Text style={styles.imageHintText}>
                      UploadPath: {TREE_ENUM_UPLOAD_PATH}, isMulti: {TREE_ENUM_IS_MULTI}, fileName: {TREE_ENUM_FILE_NAME}
                    </Text>
                  </View>
                </View>
              </ScrollView>

              <View style={styles.editModalFooter}>
                <TouchableOpacity
                  style={styles.footerButtonSecondary}
                  onPress={() => setModalVisible(false)}>
                  <Text style={styles.footerButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.footerButtonPrimary, uploadingImages && {opacity: 0.7}]}
                  disabled={uploadingImages}
                  onPress={saveRecord}>
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.primaryDark]}
                    style={styles.footerButtonGradient}>
                    {uploadingImages ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.footerButtonPrimaryText}>Uploading...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="save-outline" size={20} color="#fff" />
                        <Text style={styles.footerButtonPrimaryText}>
                          {isEdit ? 'Update' : 'Save Record'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Base
  screen: {flex: 1, backgroundColor: COLORS.background},
  container: {flex: 1},
  contentContainer: {paddingBottom: 100},

  // Header
  headerGradient: {
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
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20},
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
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerBadge: {
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
  headerBadgeText: {color: '#fff', fontSize: 10, fontWeight: '900', paddingHorizontal: 4},

  // Search
  searchSection: {paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16},
  searchContainer: {
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
  rowRejected: {backgroundColor: 'rgba(239, 68, 68, 0.06)'},
  tdCell: {paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.border},
  tdText: {fontSize: 13, fontWeight: '600', color: COLORS.text},
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    maxWidth: 210,
  },
  statusDot: {width: 8, height: 8, borderRadius: 4},
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
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
  actionPill: {paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20},
  actionPillText: {fontSize: 12, fontWeight: '700', color: '#fff'},

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
  fabGradient: {width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center'},

  // Shared modal styles
  modalOverlay: {flex: 1, backgroundColor: COLORS.overlay},
  modalBackdrop: {...StyleSheet.absoluteFillObject},
  modalContainer: {flex: 1, justifyContent: 'center', padding: 20},
  modalContent: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    backgroundColor: '#fff',
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
  filterRow: {flexDirection: 'row', lobbying: 0, gap: 12, marginBottom: 16}, // NOTE: kept as-is if you had it; remove "lobbying" if lint complains
  filterColumn: {flex: 1},
  modalActions: {flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 20},
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {fontSize: 16, fontWeight: '700', color: COLORS.text},
  modalButtonPrimary: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {fontSize: 16, fontWeight: '800', color: '#fff'},

  // Edit Modal
  editModalOverlay: {flex: 1, backgroundColor: COLORS.overlay},
  editModalContainer: {flex: 1, marginTop: Platform.OS === 'ios' ? 40 : 20},
  editModalContent: {
    flex: 1,
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
  footerButtonSecondary: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  footerButtonSecondaryText: {fontSize: 16, fontWeight: '700', color: COLORS.text},
  footerButtonPrimary: {flex: 2, borderRadius: 14, overflow: 'hidden'},
  footerButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerButtonPrimaryText: {fontSize: 16, fontWeight: '800', color: '#fff'},

  // Switch row
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  switchLabel: {fontSize: 14, fontWeight: '800', color: COLORS.text},
  switchHint: {fontSize: 12, color: COLORS.textLight, marginTop: 2},

  // GPS Section
  gpsSection: {marginTop: 20},
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gpsAutoCard: {
    backgroundColor: 'rgba(5, 150, 105, 0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    marginBottom: 16,
  },
  gpsHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
  gpsLabel: {fontSize: 14, fontWeight: '700', color: COLORS.text},
  gpsStatus: {flexDirection: 'row', alignItems: 'center', gap: 8},
  gpsSource: {backgroundColor: 'rgba(5, 150, 105, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12},
  gpsSourceText: {fontSize: 12, fontWeight: '800', color: COLORS.primary},
  gpsLoading: {flexDirection: 'row', alignItems: 'center', gap: 4},
  gpsLoadingText: {fontSize: 12, fontWeight: '600', color: COLORS.warning},
  gpsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 12,
  },
  gpsButtons: {flexDirection: 'row', gap: 12},
  gpsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  gpsButtonDisabled: {opacity: 0.6},
  gpsButtonText: {fontSize: 14, fontWeight: '700', color: '#fff'},
  gpsButtonAlt: {backgroundColor: COLORS.text},
  finalGpsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  finalGpsLabel: {fontSize: 14, fontWeight: '700', color: COLORS.text, marginRight: 8},
  finalGpsValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Image Section
  imageSection: {marginTop: 20},
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  imageButtonContent: {flex: 1},
  imageButtonTitle: {fontSize: 16, fontWeight: '700', color: COLORS.primary, marginBottom: 4},
  imageButtonSubtitle: {fontSize: 12, color: COLORS.textLight},
  inlineLoader: {paddingLeft: 8},
  imagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  imagePreviewText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.success,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  uploadedPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.18)',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  uploadedPreviewText: {flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.info},
  imageHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  imageHintText: {flex: 1, fontSize: 12, color: COLORS.textLight, lineHeight: 16},

  // Thumb placeholders
  thumbWrap: {
    width: 70,
    height: 70,
    borderRadius: 14,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbInner: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
  },
  thumbClose: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 1,
  },
});
