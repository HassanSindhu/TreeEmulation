// /screens/RegistersScreen.js
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  Alert,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Geolocation from '@react-native-community/geolocation';
import {launchImageLibrary} from 'react-native-image-picker';

import FormRow from '../components/FormRow';
import {DropdownRow} from '../components/SelectRows';

const {height} = Dimensions.get('window');

/**
 * IMPORTANT
 * - For production you are using: http://be.lte.gisforestry.com
 * - For local testing like your curl: http://localhost:5000
 */
const API_BASE = 'http://be.lte.gisforestry.com';

// ---------- ENUM ENDPOINTS ----------
const SPECIES_URL = `${API_BASE}/enum/species`;
const CONDITIONS_URL = `${API_BASE}/forest-tree-conditions`;

// Enumeration
const ENUM_LIST_URL = `${API_BASE}/enum/enumeration`;
const ENUM_CREATE_URL = `${API_BASE}/enum/enumeration`;
const ENUM_UPDATE_URL = id => `${API_BASE}/enum/enumeration/${id}`;

// Pole Crop
const POLE_LIST_URL = `${API_BASE}/enum/pole-crop`;
const POLE_CREATE_URL = `${API_BASE}/enum/pole-crop`;
const POLE_UPDATE_URL = id => `${API_BASE}/enum/pole-crop/${id}`; // if your backend differs, change here

// Afforestation
const AFF_LIST_URL = `${API_BASE}/enum/afforestation`;
const AFF_CREATE_URL = `${API_BASE}/enum/afforestation`;
const AFF_UPDATE_URL = id => `${API_BASE}/enum/afforestation/${id}`;

// ---------- Upload (kept same pattern as your MatureTree screen) ----------
const UPLOAD_URL = 'https://app.eco.gisforestry.com/aws-bucket/tree-enum';
const UPLOAD_IS_MULTI = 'true';
const UPLOAD_FILE_NAME = 'chan';
const UPLOAD_PATHS = {
  enumeration: 'enumaration',
  pole: 'pole-crop',
  aff: 'afforestation',
};

// ---------- THEME ----------
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

const TABS = [
  {key: 'aff', label: 'Afforestation', icon: 'leaf'},
  {key: 'pole', label: 'Pole Crop', icon: 'grid'},
  {key: 'enumeration', label: 'Enumeration', icon: 'list'},
];

// ---------------------- STATUS FILTER ----------------------
const STATUS_FILTERS = {
  ALL: 'all',
  PENDING: 'pending',
  VERIFIED: 'verified',
  DISAPPROVED: 'disapproved',
  DISPOSED: 'disposed',
  SUPERDARI: 'superdari',
};

export default function RegistersScreen({navigation}) {
  // ---------- TOP TAB ----------
  const [activeType, setActiveType] = useState('aff');

  // ---------- DATA ----------
  const [serverRows, setServerRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [serverError, setServerError] = useState('');

  // ---------- SEARCH + FILTER ----------
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.ALL);

  // ---------- REJECTION REASON MODAL ----------
  const [rejectionModal, setRejectionModal] = useState({
    visible: false,
    rejectedBy: '',
    remarks: '',
  });

  // ---------- ADD/EDIT MODAL ----------
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // ---------- COMMON DROPDOWNS ----------
  const [speciesRows, setSpeciesRows] = useState([]);
  const [speciesOptions, setSpeciesOptions] = useState([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);

  const [conditionRows, setConditionRows] = useState([]);
  const [conditionOptions, setConditionOptions] = useState([]);
  const [conditionLoading, setConditionLoading] = useState(false);

  // ---------- GPS ----------
  const [gpsAuto, setGpsAuto] = useState('');
  const [gpsManual, setGpsManual] = useState('');
  const [gpsSource, setGpsSource] = useState('');
  const [gpsFetching, setGpsFetching] = useState(false);

  // ---------- IMAGES ----------
  const [pictureAssets, setPictureAssets] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadedImageUrls, setUploadedImageUrls] = useState([]);

  // ---------- FORM FIELDS (per type) ----------
  // Enumeration fields
  const [nameOfSiteId, setNameOfSiteId] = useState('');
  const [rdKm, setRdKm] = useState('');
  const [speciesSingle, setSpeciesSingle] = useState('');
  const [speciesSingleId, setSpeciesSingleId] = useState(null);
  const [girth, setGirth] = useState('');
  const [condition, setCondition] = useState('');
  const [conditionId, setConditionId] = useState(null);

  // Pole Crop fields
  const [rdsFrom, setRdsFrom] = useState('');
  const [rdsTo, setRdsTo] = useState('');
  const [count, setCount] = useState('');
  const [speciesMulti, setSpeciesMulti] = useState([]); // array of ids (numbers)
  const [speciesMultiText, setSpeciesMultiText] = useState(''); // comma separated UI input

  // Afforestation fields
  const [avMilesKm, setAvMilesKm] = useState('');
  const [successPercentage, setSuccessPercentage] = useState('');
  const [year, setYear] = useState('');
  const [schemeType, setSchemeType] = useState('');
  const [projectName, setProjectName] = useState('');
  const [noOfPlants, setNoOfPlants] = useState('');

  // ---------- HELPERS ----------
  const safeJson = async res => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

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

  const formatLatLng = (latitude, longitude) =>
    `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;

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

  // Same workflow logic you already use
  const deriveRowUi = row => {
    const disposalExists = hasAny(row?.disposal);
    const superdariExists = hasAny(row?.superdari);

    if (disposalExists && superdariExists) {
      return {
        statusText: 'Disposed + Superdari',
        statusColor: COLORS.warning,
        showEdit: false,
        isRejected: false,
      };
    }
    if (disposalExists) {
      return {
        statusText: 'Disposed',
        statusColor: COLORS.secondary,
        showEdit: false,
        isRejected: false,
      };
    }
    if (superdariExists) {
      return {
        statusText: 'Superdari',
        statusColor: COLORS.info,
        showEdit: false,
        isRejected: false,
      };
    }

    const latest = row?.latestStatus || null;
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
        isRejected: false,
      };
    }

    if (action === 'rejected' || action === 'disapproved') {
      const rejectBy = byDesignation || byRole || 'Officer';
      return {
        statusText: `Rejected by ${rejectBy}`,
        statusColor: COLORS.danger,
        showEdit: true,
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
          isRejected: false,
        };
      }

      return {
        statusText: `Approved • Pending (${nxt})`,
        statusColor: COLORS.warning,
        showEdit: false,
        isRejected: false,
      };
    }

    return {
      statusText: 'Pending',
      statusColor: COLORS.textLight,
      showEdit: false,
      isRejected: false,
    };
  };

  // ✅ Filter classifier
  const getStatusTags = row => {
    const disposalExists = hasAny(row?.disposal);
    const superdariExists = hasAny(row?.superdari);

    if (disposalExists && superdariExists) return [STATUS_FILTERS.DISPOSED, STATUS_FILTERS.SUPERDARI];
    if (disposalExists) return [STATUS_FILTERS.DISPOSED];
    if (superdariExists) return [STATUS_FILTERS.SUPERDARI];

    const latest = row?.latestStatus || null;
    const action = String(latest?.action || '').trim().toLowerCase();

    if (!latest || !action) return [STATUS_FILTERS.PENDING];
    if (action === 'rejected' || action === 'disapproved') return [STATUS_FILTERS.DISAPPROVED];
    if (action === 'approved' || action === 'verified') return [STATUS_FILTERS.VERIFIED];

    return [STATUS_FILTERS.PENDING];
  };

  const openRejectionPopup = row => {
    const latest = row?.latestStatus || null;
    const action = String(latest?.action || '').trim().toLowerCase();
    if (action !== 'rejected' && action !== 'disapproved') return;

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

  // ---------- UPLOAD HELPERS ----------
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

  const uploadImages = useCallback(async (assets, uploadPath) => {
    if (!assets?.length) return [];

    const net = await NetInfo.fetch();
    const online = !!net.isConnected && (net.isInternetReachable ?? true);
    if (!online) throw new Error('No internet connection. Please connect to internet to upload images.');

    const fd = new FormData();
    assets.forEach((a, idx) => {
      const uri = a?.uri;
      if (!uri) return;

      const name =
        a?.fileName ||
        a?.name ||
        `img_${Date.now()}_${idx}.${String(a?.type || 'image/jpeg').includes('png') ? 'png' : 'jpg'}`;

      const type = a?.type || 'image/jpeg';
      fd.append('files', {uri, type, name});
    });

    fd.append('uploadPath', uploadPath);
    fd.append('isMulti', UPLOAD_IS_MULTI);
    fd.append('fileName', UPLOAD_FILE_NAME);

    const res = await fetch(UPLOAD_URL, {method: 'POST', body: fd});
    const json = await safeJson(res);

    if (!res.ok) {
      const msg = json?.message || json?.error || `Upload API Error (${res.status})`;
      throw new Error(msg);
    }
    return extractUploadUrls(json);
  }, []);

  const pickImage = () => {
    launchImageLibrary(
      {mediaType: 'photo', quality: 0.7, selectionLimit: 10},
      res => {
        if (res?.didCancel) return;
        if (res?.errorCode) {
          Alert.alert('Image Error', res?.errorMessage || res.errorCode);
          return;
        }
        const assets = Array.isArray(res?.assets) ? res.assets : [];
        if (!assets.length) return;
        setPictureAssets(assets);
        setUploadedImageUrls([]);
      },
    );
  };

  // ---------- LOCATION ----------
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

  // ---------- API CALLS ----------
  const getActiveUrls = () => {
    if (activeType === 'enumeration') {
      return {
        list: ENUM_LIST_URL,
        create: ENUM_CREATE_URL,
        update: ENUM_UPDATE_URL,
      };
    }
    if (activeType === 'pole') {
      return {
        list: POLE_LIST_URL,
        create: POLE_CREATE_URL,
        update: POLE_UPDATE_URL,
      };
    }
    return {
      list: AFF_LIST_URL,
      create: AFF_CREATE_URL,
      update: AFF_UPDATE_URL,
    };
  };

  const fetchServer = useCallback(
    async ({refresh = false} = {}) => {
      const {list} = getActiveUrls();
      try {
        refresh ? setRefreshing(true) : setLoading(true);
        setServerError('');

        const token = await getAuthToken();
        if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

        const res = await fetch(list, {
          method: 'GET',
          headers: {Authorization: `Bearer ${token}`},
        });

        const json = await safeJson(res);

        if (!res.ok) {
          const msg = json?.message || json?.error || `API Error (${res.status})`;
          throw new Error(msg);
        }

        const rows = normalizeList(json);
        setServerRows(Array.isArray(rows) ? rows : []);
      } catch (e) {
        setServerRows([]);
        setServerError(e?.message || 'Failed to fetch records');
      } finally {
        refresh ? setRefreshing(false) : setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeType],
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
          return {id: x?.id ?? x?.species_id ?? null, name: x?.name ?? x?.species_name ?? ''};
        })
        .filter(x => x.name);

      setSpeciesRows(normalized);
      setSpeciesOptions(normalized.map(x => x.name));
    } catch {
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
          return {id: x?.id ?? x?.condition_id ?? null, name: x?.name ?? x?.condition_name ?? ''};
        })
        .filter(x => x.name);

      setConditionRows(normalized);
      setConditionOptions(normalized.map(x => x.name));
    } catch {
      setConditionRows([]);
      setConditionOptions([]);
    } finally {
      setConditionLoading(false);
    }
  }, []);

  // ---------- EFFECTS ----------
  useEffect(() => {
    fetchSpecies();
    fetchConditions();
  }, [fetchSpecies, fetchConditions]);

  useEffect(() => {
    fetchServer();
  }, [fetchServer]);

  useEffect(() => {
    if (!modalVisible) return;
    if (isEdit) return;
    fetchLocationSmart({silent: true});
  }, [modalVisible, isEdit, fetchLocationSmart]);

  // ---------- DECORATE ----------
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

  const decoratedRows = useMemo(() => {
    return serverRows.map(r => {
      const autoGps =
        r?.auto_lat != null && r?.auto_long != null ? `${r.auto_lat}, ${r.auto_long}` : '—';
      const manualGps =
        r?.manual_lat != null && r?.manual_long != null ? `${r.manual_lat}, ${r.manual_long}` : '—';

      // Enumeration: single species + condition
      const spSingle =
        r?.species_name ||
        r?.species?.name ||
        (r?.species_id != null ? speciesById.get(String(r.species_id)) : null) ||
        (r?.species_id != null ? `#${r.species_id}` : '—');

      const condSingle =
        r?.condition_name ||
        r?.condition?.name ||
        (r?.condition_id != null ? conditionById.get(String(r.condition_id)) : null) ||
        (r?.condition_id != null ? `#${r.condition_id}` : '—');

      // Pole/Afforestation: multi species ids
      const ids = Array.isArray(r?.species_ids) ? r.species_ids : [];
      const spMulti =
        ids.length > 0
          ? ids
              .map(id => speciesById.get(String(id)) || `#${id}`)
              .filter(Boolean)
              .join(', ')
          : '—';

      return {
        ...r,
        _autoGps: autoGps,
        _manualGps: manualGps,
        _speciesSingleLabel: spSingle,
        _conditionSingleLabel: condSingle,
        _speciesMultiLabel: spMulti,
      };
    });
  }, [serverRows, speciesById, conditionById]);

  // ---------- FILTERED ----------
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return decoratedRows.filter(r => {
      // 1) status filter
      if (statusFilter !== STATUS_FILTERS.ALL) {
        const tags = getStatusTags(r);
        if (!tags.includes(statusFilter)) return false;
      }

      // 2) search
      if (!q) return true;

      const ui = deriveRowUi(r);
      const blob = [
        r?.id,
        r?.nameOfSiteId,
        r?.name_of_site_id,
        r?.nameOfSiteId,
        r?.rd_km,
        r?.rds_from,
        r?.rds_to,
        r?.count,
        r?.av_miles_km,
        r?.success_percentage,
        r?.year,
        r?.scheme_type,
        r?.project_name,
        r?.no_of_plants,
        r?._speciesSingleLabel,
        r?._conditionSingleLabel,
        r?._speciesMultiLabel,
        r?._autoGps,
        r?._manualGps,
        ui?.statusText,
      ]
        .filter(v => v !== null && v !== undefined)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [decoratedRows, search, statusFilter]);

  // ---------- FORM HELPERS ----------
  const resetForm = () => {
    setIsEdit(false);
    setEditingId(null);

    setNameOfSiteId('');
    setRdKm('');
    setSpeciesSingle('');
    setSpeciesSingleId(null);
    setGirth('');
    setCondition('');
    setConditionId(null);

    setRdsFrom('');
    setRdsTo('');
    setCount('');
    setSpeciesMulti([]);
    setSpeciesMultiText('');

    setAvMilesKm('');
    setSuccessPercentage('');
    setYear('');
    setSchemeType('');
    setProjectName('');
    setNoOfPlants('');

    setGpsAuto('');
    setGpsManual('');
    setGpsSource('');

    setPictureAssets([]);
    setUploadedImageUrls([]);
    setUploadingImages(false);
  };

  const openAddForm = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditForm = row => {
    setIsEdit(true);
    setEditingId(row?.id ?? null);

    // common
    setNameOfSiteId(String(row?.name_of_site_id ?? row?.nameOfSiteId ?? row?.nameOfSiteId?.id ?? ''));
    const auto =
      row?.auto_lat != null && row?.auto_long != null ? `${row.auto_lat}, ${row.auto_long}` : '';
    const manual =
      row?.manual_lat != null && row?.manual_long != null ? `${row.manual_lat}, ${row.manual_long}` : '';

    setGpsAuto(auto);
    setGpsManual(manual || auto);
    setGpsSource(manual ? 'MANUAL' : auto ? 'GPS' : '');

    setPictureAssets([]);
    setUploadedImageUrls(Array.isArray(row?.pictures) ? row.pictures : []);

    if (activeType === 'enumeration') {
      setRdKm(String(row?.rd_km ?? ''));
      setSpeciesSingle('');
      setSpeciesSingleId(row?.species_id ?? null);
      setGirth(String(row?.girth ?? ''));
      setCondition('');
      setConditionId(row?.condition_id ?? null);
    }

    if (activeType === 'pole') {
      setRdsFrom(String(row?.rds_from ?? ''));
      setRdsTo(String(row?.rds_to ?? ''));
      setCount(String(row?.count ?? ''));
      const ids = Array.isArray(row?.species_ids) ? row.species_ids : [];
      setSpeciesMulti(ids.map(x => Number(x)).filter(n => Number.isFinite(n)));
      setSpeciesMultiText(ids.join(', '));
    }

    if (activeType === 'aff') {
      setAvMilesKm(String(row?.av_miles_km ?? ''));
      setSuccessPercentage(String(row?.success_percentage ?? ''));
      setYear(String(row?.year ?? ''));
      setSchemeType(String(row?.scheme_type ?? ''));
      setProjectName(String(row?.project_name ?? ''));
      setNoOfPlants(String(row?.no_of_plants ?? ''));
      const ids = Array.isArray(row?.species_ids) ? row.species_ids : [];
      setSpeciesMulti(ids.map(x => Number(x)).filter(n => Number.isFinite(n)));
      setSpeciesMultiText(ids.join(', '));
    }

    setModalVisible(true);
  };

  // ---------- SAVE (POST / PATCH using your curls) ----------
  const buildPictures = async () => {
    // if user selected new images, upload; else keep existing
    let pictures = [];
    try {
      if (pictureAssets?.length) {
        setUploadingImages(true);
        const uploadPath = UPLOAD_PATHS[activeType] || UPLOAD_PATHS.enumeration;
        const urls = await uploadImages(pictureAssets, uploadPath);
        setUploadedImageUrls(urls);
        pictures = urls?.length ? urls : [];
      } else {
        pictures = Array.isArray(uploadedImageUrls) ? uploadedImageUrls : [];
      }
    } finally {
      setUploadingImages(false);
    }
    return pictures;
  };

  const submitCreate = async body => {
    const {create} = getActiveUrls();
    const token = await getAuthToken();
    if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

    const res = await fetch(create, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify(body),
    });

    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || json?.error || `API Error (${res.status})`);
    return json;
  };

  const submitPatch = async (id, body) => {
    const {update} = getActiveUrls();
    const token = await getAuthToken();
    if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');
    if (!id) throw new Error('Missing record id for update.');

    const res = await fetch(update(id), {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify(body),
    });

    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || json?.error || `API Error (${res.status})`);
    return json;
  };

  const saveRecord = async () => {
    // GPS
    const {lat: autoLat, lng: autoLng} = parseLatLng(gpsAuto);
    const {lat: manualLat, lng: manualLng} = parseLatLng(gpsManual);

    // pictures
    let pictures = [];
    try {
      pictures = await buildPictures();
    } catch (e) {
      return Alert.alert('Upload Failed', e?.message || 'Failed to upload images');
    }

    // body by type (matching your provided curls)
    let body = null;

    if (activeType === 'enumeration') {
      const chosenSpeciesId =
        speciesSingleId ?? (speciesRows.find(x => x.name === speciesSingle)?.id ?? null);
      const chosenConditionId =
        conditionId ?? (conditionRows.find(x => x.name === condition)?.id ?? null);

      if (!String(nameOfSiteId || '').trim()) return Alert.alert('Missing', 'name_of_site_id is required');
      if (!chosenSpeciesId) return Alert.alert('Missing', 'species_id is required');
      if (!chosenConditionId) return Alert.alert('Missing', 'condition_id is required');

      const rdNum = Number(String(rdKm || '').replace(/[^\d.]+/g, ''));
      const rdKmNumber = Number.isFinite(rdNum) ? rdNum : 0;

      body = {
        name_of_site_id: Number(nameOfSiteId),
        rd_km: rdKmNumber,
        species_id: Number(chosenSpeciesId),
        girth: girth ? String(girth) : '',
        condition_id: Number(chosenConditionId),
        auto_lat: autoLat,
        auto_long: autoLng,
        manual_lat: manualLat,
        manual_long: manualLng,
        pictures,
      };
    }

    if (activeType === 'pole') {
      if (!String(nameOfSiteId || '').trim()) return Alert.alert('Missing', 'nameOfSiteId is required');

      const rf = Number(String(rdsFrom || '').replace(/[^\d.]+/g, ''));
      const rt = Number(String(rdsTo || '').replace(/[^\d.]+/g, ''));
      const cnt = Number(String(count || '').replace(/[^\d.]+/g, ''));

      // species_ids can be typed as "1,4,5"
      const idsFromText = String(speciesMultiText || '')
        .split(',')
        .map(s => Number(String(s).trim()))
        .filter(n => Number.isFinite(n));

      const finalIds = (idsFromText.length ? idsFromText : speciesMulti).map(n => Number(n));

      if (!finalIds.length) return Alert.alert('Missing', 'species_ids is required');

      body = {
        nameOfSiteId: Number(nameOfSiteId),
        rds_from: Number.isFinite(rf) ? rf : 0,
        rds_to: Number.isFinite(rt) ? rt : 0,
        count: Number.isFinite(cnt) ? cnt : 0,
        auto_lat: autoLat,
        auto_long: autoLng,
        manual_lat: manualLat,
        manual_long: manualLng,
        species_ids: finalIds,
        pictures,
      };
    }

    if (activeType === 'aff') {
      if (!String(nameOfSiteId || '').trim()) return Alert.alert('Missing', 'nameOfSiteId is required');

      const av = Number(String(avMilesKm || '').replace(/[^\d.]+/g, ''));
      const plants = Number(String(noOfPlants || '').replace(/[^\d.]+/g, ''));

      const idsFromText = String(speciesMultiText || '')
        .split(',')
        .map(s => Number(String(s).trim()))
        .filter(n => Number.isFinite(n));

      const finalIds = (idsFromText.length ? idsFromText : speciesMulti).map(n => Number(n));

      if (!finalIds.length) return Alert.alert('Missing', 'species_ids is required');

      body = {
        nameOfSiteId: Number(nameOfSiteId),
        av_miles_km: Number.isFinite(av) ? av : 0,
        success_percentage: successPercentage ? String(successPercentage) : '',
        year: year ? String(year) : '',
        scheme_type: schemeType ? String(schemeType) : '',
        project_name: projectName ? String(projectName) : '',
        no_of_plants: Number.isFinite(plants) ? plants : 0,
        auto_lat: autoLat,
        auto_long: autoLng,
        manual_lat: manualLat,
        manual_long: manualLng,
        species_ids: finalIds,
        pictures,
      };
    }

    if (!body) return Alert.alert('Error', 'Unknown record type.');

    try {
      if (isEdit) {
        await submitPatch(editingId, body);
        setModalVisible(false);
        fetchServer({refresh: true});
        Alert.alert('Success', 'Record updated successfully.');
        return;
      }

      await submitCreate(body);
      setModalVisible(false);
      fetchServer({refresh: true});
      Alert.alert('Success', 'Saved to server.');
    } catch (e) {
      Alert.alert(isEdit ? 'Update Failed' : 'Create Failed', e?.message || 'Request failed');
    }
  };

  // ---------- UI LABELS ----------
  const headerTitle = useMemo(() => {
    const t = TABS.find(x => x.key === activeType);
    return t?.label || 'Registers';
  }, [activeType]);

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
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Text style={styles.headerSubtitle}>Real-time server records</Text>
          </View>
        </View>

        {/* Top Tabs (same UI idea; no redirect on edit) */}
        <View style={styles.tabsRow}>
          {TABS.map(t => {
            const active = t.key === activeType;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.85}
                onPress={() => {
                  setActiveType(t.key);
                  setSearch('');
                  setStatusFilter(STATUS_FILTERS.ALL);
                  setModalVisible(false);
                }}
                style={[styles.tabPill, active ? styles.tabPillActive : styles.tabPillInactive]}>
                <Ionicons name={t.icon} size={16} color={active ? '#fff' : 'rgba(255,255,255,0.85)'} />
                <Text style={[styles.tabText, active ? styles.tabTextActive : styles.tabTextInactive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {/* Main */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchServer({refresh: true})}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        {/* Search */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.textLight} style={styles.searchIcon} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by ID, site, species, status..."
              placeholderTextColor={COLORS.textLight}
              style={styles.searchInput}
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear}>
                <Ionicons name="close-circle" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            )}
          </View>

          {/* ✅ Status Filters after search bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterBar}
            contentContainerStyle={styles.filterBarContent}>
            {[
              {key: STATUS_FILTERS.ALL, label: 'All'},
              {key: STATUS_FILTERS.PENDING, label: 'Pending'},
              {key: STATUS_FILTERS.VERIFIED, label: 'Verified'},
              {key: STATUS_FILTERS.DISAPPROVED, label: 'Disapproved'},
              {key: STATUS_FILTERS.DISPOSED, label: 'Disposed'},
              {key: STATUS_FILTERS.SUPERDARI, label: 'Superdari'},
            ].map(item => {
              const active = statusFilter === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.85}
                  onPress={() => setStatusFilter(item.key)}
                  style={[styles.filterChip, active ? styles.filterChipActive : styles.filterChipInactive]}>
                  <Text
                    style={[
                      styles.filterChipText,
                      active ? styles.filterChipTextActive : styles.filterChipTextInactive,
                    ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{filteredRows.length}</Text>
            <Text style={styles.statLabel}>Filtered</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{serverRows.length}</Text>
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

        {/* Error */}
        {!!serverError && (
          <View style={styles.errorCard}>
            <View style={styles.errorHeader}>
              <Ionicons name="warning" size={20} color={COLORS.danger} />
              <Text style={styles.errorTitle}>Server Error</Text>
            </View>
            <Text style={styles.errorMessage}>{serverError}</Text>
            <TouchableOpacity style={styles.errorButton} onPress={() => fetchServer({refresh: true})}>
              <Text style={styles.errorButtonText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Table */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Records</Text>
            <Text style={styles.sectionSubtitle}>
              {filteredRows.length} of {serverRows.length}
            </Text>
          </View>

          {filteredRows.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={64} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No Records Found</Text>
              <Text style={styles.emptyText}>No records match your search/filter.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableContainer}>
              <View style={styles.table}>
                {/* Header */}
                <View style={styles.tableHeader}>
                  {[
                    {label: 'ID', width: 80},
                    {label: 'Site', width: 90},
                    {label: activeType === 'enumeration' ? 'RD/KM' : activeType === 'pole' ? 'RDS From' : 'Avg KM', width: 110},
                    {label: activeType === 'pole' ? 'RDS To' : activeType === 'aff' ? 'Success %' : 'Species', width: 140},
                    {label: activeType === 'pole' ? 'Count' : activeType === 'aff' ? 'Year' : 'Condition', width: 120},
                    {label: 'Auto GPS', width: 180},
                    {label: 'Manual GPS', width: 180},
                    {label: 'Status', width: 220},
                    {label: 'Actions', width: 140},
                  ].map((col, idx) => (
                    <View key={idx} style={[styles.thCell, {width: col.width}]}>
                      <Text style={styles.thText}>{col.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Rows */}
                {filteredRows.map((r, idx) => {
                  const ui = deriveRowUi(r);
                  return (
                    <View
                      key={String(r?.id ?? idx)}
                      style={[
                        styles.tableRow,
                        idx % 2 === 0 ? styles.rowEven : styles.rowOdd,
                        ui.isRejected ? styles.rowRejected : null,
                      ]}>
                      <View style={[styles.tdCell, {width: 80}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r?.id ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 90}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r?.name_of_site_id ?? r?.nameOfSiteId ?? '—')}
                        </Text>
                      </View>

                      {/* Col 3 */}
                      <View style={[styles.tdCell, {width: 110}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {activeType === 'enumeration'
                            ? String(r?.rd_km ?? '—')
                            : activeType === 'pole'
                            ? String(r?.rds_from ?? '—')
                            : String(r?.av_miles_km ?? '—')}
                        </Text>
                      </View>

                      {/* Col 4 */}
                      <View style={[styles.tdCell, {width: 140}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {activeType === 'pole'
                            ? String(r?.rds_to ?? '—')
                            : activeType === 'aff'
                            ? String(r?.success_percentage ?? '—')
                            : String(r?._speciesSingleLabel ?? '—')}
                        </Text>
                      </View>

                      {/* Col 5 */}
                      <View style={[styles.tdCell, {width: 120}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {activeType === 'pole'
                            ? String(r?.count ?? '—')
                            : activeType === 'aff'
                            ? String(r?.year ?? '—')
                            : String(r?._conditionSingleLabel ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 180}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r?._autoGps ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 180}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r?._manualGps ?? '—')}
                        </Text>
                      </View>

                      {/* Status (click if rejected -> show reason) */}
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

                      {/* Actions: Edit only when rejected (no redirect; open same modal) */}
                      <View style={[styles.tdCell, styles.actionsCell, {width: 140}]}>
                        {ui.showEdit ? (
                          <TouchableOpacity style={styles.actionButton} onPress={() => openEditForm(r)}>
                            <Ionicons name="create-outline" size={16} color={COLORS.secondary} />
                            <Text style={styles.actionButtonText}>Edit</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={[styles.tdText, {color: COLORS.textLight}]}>—</Text>
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

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAddForm} activeOpacity={0.8}>
        <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.fabGradient}>
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Rejection Modal */}
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
                <Text style={{fontSize: 13, fontWeight: '800', color: COLORS.textLight}}>Rejected By</Text>
                <Text style={{fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 14}}>
                  {rejectionModal.rejectedBy || 'Officer'}
                </Text>

                <Text style={{fontSize: 13, fontWeight: '800', color: COLORS.textLight}}>Remarks</Text>
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

      {/* Add/Edit Modal (same UI approach, no redirect) */}
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
                    {isEdit ? 'Edit Record' : 'Add New Record'}
                  </Text>
                  {isEdit && editingId && <Text style={styles.editModalSubtitle}>ID: {editingId}</Text>}
                </View>
                <TouchableOpacity style={styles.editModalClose} onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.editModalBody}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                {/* COMMON */}
                <FormRow
                  label={activeType === 'enumeration' ? 'name_of_site_id' : 'nameOfSiteId'}
                  value={nameOfSiteId}
                  onChangeText={setNameOfSiteId}
                  placeholder="e.g. 3"
                  keyboardType="numeric"
                />

                {/* TYPE SPECIFIC */}
                {activeType === 'enumeration' && (
                  <>
                    <FormRow label="RD/KM" value={rdKm} onChangeText={setRdKm} placeholder="e.g. 5.5" />
                    <DropdownRow
                      label={speciesLoading ? 'Species (Loading...)' : 'Species'}
                      value={speciesSingle}
                      onChange={name => {
                        setSpeciesSingle(name);
                        const row = speciesRows.find(x => x.name === name);
                        setSpeciesSingleId(row?.id ?? null);
                      }}
                      options={speciesOptions}
                      disabled={speciesLoading}
                      required
                    />
                    <FormRow label="Girth" value={girth} onChangeText={setGirth} placeholder='e.g. "24"' />
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
                  </>
                )}

                {activeType === 'pole' && (
                  <>
                    <FormRow
                      label="rds_from"
                      value={rdsFrom}
                      onChangeText={setRdsFrom}
                      placeholder="e.g. 12.5"
                      keyboardType="numeric"
                    />
                    <FormRow
                      label="rds_to"
                      value={rdsTo}
                      onChangeText={setRdsTo}
                      placeholder="e.g. 15.0"
                      keyboardType="numeric"
                    />
                    <FormRow
                      label="count"
                      value={count}
                      onChangeText={setCount}
                      placeholder="e.g. 50"
                      keyboardType="numeric"
                    />
                    <FormRow
                      label="species_ids (comma separated)"
                      value={speciesMultiText}
                      onChangeText={setSpeciesMultiText}
                      placeholder="e.g. 1,4"
                    />
                    <Text style={styles.helperText}>
                      Tip: enter species IDs like "1,4". (Labels load automatically in table.)
                    </Text>
                  </>
                )}

                {activeType === 'aff' && (
                  <>
                    <FormRow
                      label="av_miles_km"
                      value={avMilesKm}
                      onChangeText={setAvMilesKm}
                      placeholder="e.g. 10.5"
                      keyboardType="numeric"
                    />
                    <FormRow
                      label="success_percentage"
                      value={successPercentage}
                      onChangeText={setSuccessPercentage}
                      placeholder='e.g. "80%"'
                    />
                    <FormRow
                      label="year"
                      value={year}
                      onChangeText={setYear}
                      placeholder="e.g. 2024"
                      keyboardType="numeric"
                    />
                    <FormRow
                      label="scheme_type"
                      value={schemeType}
                      onChangeText={setSchemeType}
                      placeholder="e.g. Development"
                    />
                    <FormRow
                      label="project_name"
                      value={projectName}
                      onChangeText={setProjectName}
                      placeholder="e.g. Multi-Species Project"
                    />
                    <FormRow
                      label="no_of_plants"
                      value={noOfPlants}
                      onChangeText={setNoOfPlants}
                      placeholder="e.g. 1000"
                      keyboardType="numeric"
                    />
                    <FormRow
                      label="species_ids (comma separated)"
                      value={speciesMultiText}
                      onChangeText={setSpeciesMultiText}
                      placeholder="e.g. 3,4"
                    />
                  </>
                )}

                {/* GPS */}
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

                {/* IMAGES */}
                <View style={styles.imageSection}>
                  <TouchableOpacity style={styles.imageButton} onPress={pickImage} disabled={uploadingImages}>
                    <Ionicons name="image-outline" size={24} color={COLORS.primary} />
                    <View style={styles.imageButtonContent}>
                      <Text style={styles.imageButtonTitle}>
                        {pictureAssets.length ? 'Change Images' : 'Select Images'}
                      </Text>
                      <Text style={styles.imageButtonSubtitle}>
                        uploadPath: {UPLOAD_PATHS[activeType] || UPLOAD_PATHS.enumeration}
                      </Text>
                    </View>

                    {uploadingImages && (
                      <View style={styles.inlineLoader}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      </View>
                    )}
                  </TouchableOpacity>

                  {!!pictureAssets?.length && (
                    <View style={styles.imagePreview}>
                      <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                      <Text style={styles.imagePreviewText} numberOfLines={1}>
                        Selected: {pictureAssets.length} image(s)
                      </Text>
                    </View>
                  )}

                  {!!uploadedImageUrls?.length && (
                    <View style={styles.uploadedPreview}>
                      <Ionicons name="cloud-done-outline" size={16} color={COLORS.info} />
                      <Text style={styles.uploadedPreviewText} numberOfLines={2}>
                        Uploaded/Existing: {uploadedImageUrls.length} file(s)
                      </Text>
                    </View>
                  )}

                  {!!pictureAssets?.length && !uploadedImageUrls?.length && (
                    <View style={styles.imageHint}>
                      <Ionicons name="information-circle-outline" size={16} color={COLORS.textLight} />
                      <Text style={styles.imageHintText}>
                        Images will upload automatically when you press “Save”.
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              <View style={styles.editModalFooter}>
                <TouchableOpacity style={styles.footerButtonSecondary} onPress={() => setModalVisible(false)}>
                  <Text style={styles.footerButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.footerButtonPrimary, uploadingImages && {opacity: 0.7}]}
                  disabled={uploadingImages}
                  onPress={saveRecord}>
                  <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.footerButtonGradient}>
                    {uploadingImages ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.footerButtonPrimaryText}>Uploading...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="save-outline" size={20} color="#fff" />
                        <Text style={styles.footerButtonPrimaryText}>{isEdit ? 'Update' : 'Save'}</Text>
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
    paddingBottom: 16,
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
  headerTitle: {fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2},
  headerSubtitle: {fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)'},

  tabsRow: {flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 14},
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabPillActive: {backgroundColor: 'rgba(255,255,255,0.20)', borderColor: 'rgba(255,255,255,0.30)'},
  tabPillInactive: {backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.18)'},
  tabText: {fontSize: 12, fontWeight: '900'},
  tabTextActive: {color: '#fff'},
  tabTextInactive: {color: 'rgba(255,255,255,0.85)'},

  // Search
  searchSection: {paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6},
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

  // ✅ Filter Bar
  filterBar: {marginTop: 10},
  filterBarContent: {paddingHorizontal: 0, paddingBottom: 6, gap: 10},
  filterChip: {paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1},
  filterChipActive: {backgroundColor: 'rgba(5, 150, 105, 0.12)', borderColor: 'rgba(5, 150, 105, 0.30)'},
  filterChipInactive: {backgroundColor: '#fff', borderColor: COLORS.border},
  filterChipText: {fontSize: 12, fontWeight: '800', letterSpacing: 0.2},
  filterChipTextActive: {color: COLORS.primaryDark},
  filterChipTextInactive: {color: COLORS.textLight},

  // Stats
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
    marginTop: 10,
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
  errorButton: {backgroundColor: COLORS.danger, borderRadius: 12, paddingVertical: 12, alignItems: 'center'},
  errorButtonText: {color: '#fff', fontSize: 14, fontWeight: '700'},

  // Section
  section: {marginHorizontal: 20, marginBottom: 20},
  sectionHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16},
  sectionTitle: {fontSize: 20, fontWeight: '700', color: COLORS.text},
  sectionSubtitle: {fontSize: 14, fontWeight: '600', color: COLORS.textLight},

  // Empty
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
  emptyText: {fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 20},

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
  thCell: {paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.border},
  thText: {fontSize: 12, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5},
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
  statusText: {fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, flexShrink: 1},

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

  // Shared modal
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
  footerButtonGradient: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8},
  footerButtonPrimaryText: {fontSize: 16, fontWeight: '800', color: '#fff'},

  helperText: {marginTop: 8, fontSize: 12, color: COLORS.textLight, fontWeight: '600'},

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
});
