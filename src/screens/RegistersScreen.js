// /screens/RegistersScreen.js
import { offlineService } from '../services/OfflineService';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Geolocation from '@react-native-community/geolocation';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { apiService } from '../services/ApiService';

import FormRow from '../components/FormRow';
import FullScreenLoader from '../components/FullScreenLoader'; // Added loader
import { DropdownRow } from '../components/SelectRows';

const { height } = Dimensions.get('window');

/**
 * IMPORTANT
 * - For production you are using: https://be.punjabtreeenumeration.com
 * - For local testing like your curl: http://localhost:5000
 */
const API_BASE = 'https://be.punjabtreeenumeration.com';

// ---------- ENUM ENDPOINTS ----------
const SPECIES_URL = `${API_BASE}/lpe3/species`;
const SPECIES_CREATE_URL = `${API_BASE}/lpe3/species`;
const CONDITIONS_URL = `${API_BASE}/forest-tree-conditions`;

// Enumeration
const ENUM_LIST_URL = `${API_BASE}/enum/enumeration`;
const ENUM_CREATE_URL = `${API_BASE}/enum/enumeration`;
const ENUM_UPDATE_URL = id => `${API_BASE}/enum/enumeration/${id}`;

// Pole Crop
const POLE_LIST_URL = `${API_BASE}/enum/pole-crop`;
const POLE_CREATE_URL = `${API_BASE}/enum/pole-crop`;
const POLE_UPDATE_URL = id => `${API_BASE}/enum/pole-crop/${id}`;

// Afforestation
const AFF_LIST_URL = `${API_BASE}/enum/afforestation`;
const AFF_CREATE_URL = `${API_BASE}/enum/afforestation`;
const AFF_UPDATE_URL = id => `${API_BASE}/enum/afforestation/${id}`;

// ---------- Upload ----------
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
  { key: 'aff', label: 'Afforestation', icon: 'leaf' },
  { key: 'pole', label: 'Pole Crop', icon: 'grid' },
  { key: 'enumeration', label: 'Enumeration', icon: 'list' },
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

// ---------- Helpers: latest audit snapshot per species ----------
const normalizeAuditNo = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pickLatestAfforestationSpeciesPerId = arr => {
  if (!Array.isArray(arr)) return [];
  const byId = new Map();

  for (const row of arr) {
    const sid = Number(row?.id ?? row?.species_id);
    if (!Number.isFinite(sid)) continue;

    const audit = normalizeAuditNo(row?.audit_no);
    const prev = byId.get(sid);

    if (!prev || audit > prev._audit) {
      byId.set(sid, {
        species_id: sid,
        name: String(row?.name || '').trim(),
        count: row?.count ?? 0,
        _audit: audit,
      });
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => {
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return a.species_id - b.species_id;
    })
    .map(x => ({
      species_id: x.species_id,
      name: x.name,
      count: x.count,
    }));
};

const pickLatestPoleCropSpeciesPerId = arr => {
  if (!Array.isArray(arr)) return [];
  const byId = new Map();

  for (const row of arr) {
    const sid = Number(row?.id ?? row?.species_id);
    if (!Number.isFinite(sid)) continue;

    const audit = normalizeAuditNo(row?.audit_no);
    const prev = byId.get(sid);

    if (!prev || audit > prev._audit) {
      byId.set(sid, {
        species_id: sid,
        name: String(row?.name || '').trim(),
        count: row?.count ?? 0,
        _audit: audit,
      });
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => {
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return a.species_id - b.species_id;
    })
    .map(x => ({
      species_id: x.species_id,
      name: x.name,
      count: x.count,
    }));
};

export default function RegistersScreen({ navigation }) {
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

  const [offlineStatus, setOfflineStatus] = useState({ count: 0, syncing: false });

  useEffect(() => {
    const update = () => {
      setOfflineStatus({
        count: offlineService.queue.length,
        syncing: offlineService.isSyncing
      });
    };
    const unsub = offlineService.subscribe(update);
    update();
    return unsub;
  }, []);

  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // ---------- COMMON DROPDOWNS ----------
  const [speciesRows, setSpeciesRows] = useState([]);
  const [speciesOptions, setSpeciesOptions] = useState([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);

  const [conditionRows, setConditionRows] = useState([]);
  const [conditionOptions, setConditionOptions] = useState([]);
  const [conditionLoading, setConditionLoading] = useState(false);

  // ---------- NEW SPECIES (Other) ----------
  const [showNewSpeciesBox, setShowNewSpeciesBox] = useState(false);
  const [newSpeciesName, setNewSpeciesName] = useState('');
  const [newSpeciesTarget, setNewSpeciesTarget] = useState({ type: null, index: null }); // {type:'pole'|'aff', index:number}
  const [creatingSpecies, setCreatingSpecies] = useState(false);

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
  const [poleSpeciesCounts, setPoleSpeciesCounts] = useState([{ species_id: null, count: '' }]);

  // Afforestation fields
  const [avMilesKm, setAvMilesKm] = useState('');
  const [noOfPlants, setNoOfPlants] = useState('');
  const [affSpeciesCounts, setAffSpeciesCounts] = useState([{ species_id: null, count: '' }]);

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
    if (!s) return { lat: null, lng: null };
    const parts = s
      .split(/,|\s+/)
      .map(p => p.trim())
      .filter(Boolean);
    if (parts.length < 2) return { lat: null, lng: null };
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return { lat: null, lng: null };
    return { lat, lng };
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

  const ROLE_ORDER = ['Guard', 'Block Officer', 'SDFO', 'DFO'];
  const nextRole = currentRole => {
    const idx = ROLE_ORDER.indexOf(currentRole);
    return idx >= 0 ? ROLE_ORDER[idx + 1] || null : null;
  };

  const deriveRowUi = row => {
    const disposalExists = hasAny(row?.disposal);
    const superdariExists = hasAny(row?.superdari);

    if (disposalExists && superdariExists) {
      return { statusText: 'Disposed + Superdari', statusColor: COLORS.warning, showEdit: false, isRejected: false, isFinalApproved: false };
    }
    if (disposalExists) {
      return { statusText: 'Disposed', statusColor: COLORS.secondary, showEdit: false, isRejected: false, isFinalApproved: false };
    }
    if (superdariExists) {
      return { statusText: 'Superdari', statusColor: COLORS.info, showEdit: false, isRejected: false, isFinalApproved: false };
    }

    const latest = row?.latestStatus || null;
    const actionRaw = String(latest?.action || '').trim();
    const action = actionRaw.toLowerCase();
    const byRole = normalizeRole(latest?.user_role || '');
    const byDesignation = String(latest?.designation || '').trim();
    const remarks = String(latest?.remarks || '').trim();

    if (!latest || !actionRaw) {
      return { statusText: 'Pending (Block Officer)', statusColor: COLORS.textLight, showEdit: false, isRejected: false, isFinalApproved: false };
    }

    if (action === 'rejected' || action === 'disapproved') {
      const rejectBy = byDesignation || byRole || 'Officer';
      return {
        statusText: `Rejected by ${rejectBy}`,
        statusColor: COLORS.danger,
        showEdit: true,
        isRejected: true,
        isFinalApproved: false,
        _remarks: remarks,
        _rejectedBy: rejectBy,
      };
    }

    if (action === 'approved' || action === 'verified') {
      const approver = byRole || 'Block Officer';
      const nxt = nextRole(approver);

      if (!nxt) {
        return { statusText: 'Final Approved', statusColor: COLORS.success, showEdit: false, isRejected: false, isFinalApproved: true };
      }

      return { statusText: `Approved • Pending (${nxt})`, statusColor: COLORS.warning, showEdit: false, isRejected: false, isFinalApproved: false };
    }

    return { statusText: 'Pending', statusColor: COLORS.textLight, showEdit: false, isRejected: false, isFinalApproved: false };
  };

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

  const closeRejectionPopup = () => setRejectionModal({ visible: false, rejectedBy: '', remarks: '' });

  // ---------- Upload helpers ----------
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

  // Manual upload removed - handled by ApiService

  const pickImage = () => {
    Alert.alert('Select Image', 'Choose an option', [
      {
        text: 'Take Photo',
        onPress: () => {
          launchCamera({ mediaType: 'photo', quality: 0.7, selectionLimit: 10 }, res => {
            if (res?.didCancel) return;
            if (res?.errorCode) {
              Alert.alert('Camera Error', res?.errorMessage || res.errorCode);
              return;
            }
            const assets = Array.isArray(res?.assets) ? res.assets : [];
            if (!assets.length) return;
            setPictureAssets(prev => [...prev, ...assets]);
            setUploadedImageUrls(prev => []); // Or keep? User might want to replace. Usually we replace or append. 
            // In the previous logic it replaced. If user wants to append, we should append.
            // But to be consistent with previous 'setPictureAssets(assets)', let's see. 
            // The previous code did 'setPictureAssets(assets)' which REPLACES current selection.
            // If the user wants to add more, they might expect append. 
            // Let's Stick to replacement for now to be safe, or check if 'selectionLimit: 10' implies multi-pick at once.
            // If we use camera, we only get 1 photo usually unless we loop.
            // Gallery allows multi selection.
            // Let's append for camera to avoid losing gallery picks if mixed? 
            // Actually, the previous code was: setPictureAssets(assets); setUploadedImageUrls([]);
            // This suggests a "reset and pick new" flow.
            // However, for better UX with camera (taking multiple shots), we might want to append.
            // But let's stick to the requested "also take live image" - usually implies adding sources.
            // I'll implement Append logic for both to be friendlier, OR just stick to replacement if that's the intended simplified flow.
            // Re-reading user request: "user can also take live image from camera".
            // I will implement a Choice Alert.

            // NOTE: The previous code CLEARED uploadedImageUrls when picking new images.
            // I will maintain that behavior for consistency unless I see reasons not to.
            // But wait, if I take a photo, I don't want to lose my previously picked photos if I'm building a collection.
            // The previous code: `setPictureAssets(assets)` replaced everything.
            // I will change it to APPEND new assets to `pictureAssets`, but still clear `uploadedImageUrls` if that was the intent (maybe editing replaces old ones?).
            // For now, I will stick to the existing behavior: REPLACING the current selection session.
            // If the user picked 5 images from gallery, they act as the "new set".
            // If they take a photo, it becomes the "new set".
            // If they want mixed, they can't do it easily with `setPictureAssets(assets)`.
            // But I should probably just follow the instruction "add also camera".

            setPictureAssets(assets);
            setUploadedImageUrls([]); // Clear old uploaded ones if we are setting new ones (standard edit behavior often implies replacement of the specific field)
          });
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: () => {
          launchImageLibrary({ mediaType: 'photo', quality: 0.7, selectionLimit: 10 }, res => {
            if (res?.didCancel) return;
            if (res?.errorCode) {
              Alert.alert('Image Error', res?.errorMessage || res.errorCode);
              return;
            }
            const assets = Array.isArray(res?.assets) ? res.assets : [];
            if (!assets.length) return;
            setPictureAssets(assets);
            setUploadedImageUrls([]);
          });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ---------- Location ----------
  const fetchLocationSmart = useCallback(async ({ silent = false } = {}) => {
    try {
      setGpsFetching(true);

      const net = await NetInfo.fetch();
      const online = !!net.isConnected && (net.isInternetReachable !== false);

      // ALWAYS use High Accuracy for "exact coordinates" as requested.
      // works offline via GPS. Increased timeout for cold locks.
      const options = { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 };

      Geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          const val = formatLatLng(latitude, longitude);

          setGpsAuto(val);
          setGpsManual(prev => (String(prev || '').trim() ? prev : val));
          // Since we use high accuracy, it's effectively GPS/HighPrecision
          setGpsSource('GPS');
          setGpsFetching(false);
        },
        err => {
          console.warn('GPS Error', err);
          // If offline and high accuracy failed, usually means no GPS signal.

          if (online && err.code === 3) {
            // Timeout? Try low accuracy as backup if online? 
            // But user wants exact. Let's just fail with clear message.
          }

          setGpsFetching(false);
          if (!silent) {
            Alert.alert('Location Error', err.message + '\nEnsure GPS is ON and you are outdoors.');
          }
        },
        options,
      );
    } catch (e) {
      setGpsFetching(false);
      if (!silent) Alert.alert('Location Error', e?.message || 'Failed to fetch location');
    }
  }, []);

  // ---------- API Calls ----------
  const getActiveUrls = () => {
    if (activeType === 'enumeration') return { list: ENUM_LIST_URL, create: ENUM_CREATE_URL, update: ENUM_UPDATE_URL };
    if (activeType === 'pole') return { list: POLE_LIST_URL, create: POLE_CREATE_URL, update: POLE_UPDATE_URL };
    return { list: AFF_LIST_URL, create: AFF_CREATE_URL, update: AFF_UPDATE_URL };
  };

  const fetchServer = useCallback(
    async ({ refresh = false } = {}) => {
      const { list } = getActiveUrls();
      try {
        refresh ? setRefreshing(true) : setLoading(true);
        setServerError('');

        const json = await apiService.get(list);

        const rows = normalizeList(json);
        setServerRows(Array.isArray(rows) ? rows : []);
      } catch (e) {
        setServerRows([]);
        setServerError(e?.message || 'Failed to fetch records');
      } finally {
        refresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [activeType],
  );

  const fetchSpecies = useCallback(async () => {
    try {
      setSpeciesLoading(true);
      const token = await getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const res = await fetch(SPECIES_URL, { headers });
      const json = await safeJson(res);
      const rows = normalizeList(json);

      const normalized = (Array.isArray(rows) ? rows : [])
        .map(x => ({ id: x?.id ?? x?.species_id ?? null, name: String(x?.name ?? x?.species_name ?? '').trim() }))
        .filter(x => x?.name);

      setSpeciesRows(normalized);

      const opts = normalized.map(x => x.name);
      opts.push('Other (Add New)');
      setSpeciesOptions(opts);
    } catch {
      setSpeciesRows([]);
      setSpeciesOptions(['Other (Add New)']);
    } finally {
      setSpeciesLoading(false);
    }
  }, []);

  const fetchConditions = useCallback(async () => {
    try {
      setConditionLoading(true);
      const token = await getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const res = await fetch(CONDITIONS_URL, { headers });
      const json = await safeJson(res);
      const rows = normalizeList(json);

      const normalized = rows
        .map(x => {
          if (typeof x === 'string') return { id: null, name: x };
          return { id: x?.id ?? x?.condition_id ?? null, name: x?.name ?? x?.condition_name ?? '' };
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
    fetchLocationSmart({ silent: true });
  }, [modalVisible, isEdit, fetchLocationSmart]);

  // ---------- Maps ----------
  const speciesById = useMemo(() => {
    const map = new Map();
    speciesRows.forEach(s => map.set(String(s.id), s.name));
    return map;
  }, [speciesRows]);

  const speciesIdByNameLower = useMemo(() => {
    const map = new Map();
    speciesRows.forEach(s => {
      if (!s?.name) return;
      map.set(String(s.name).trim().toLowerCase(), s.id);
    });
    return map;
  }, [speciesRows]);

  const conditionById = useMemo(() => {
    const map = new Map();
    conditionRows.forEach(c => map.set(String(c.id), c.name));
    return map;
  }, [conditionRows]);

  // ✅ Keep dropdown values correct in EDIT (Enumeration)
  useEffect(() => {
    if (!modalVisible || !isEdit) return;
    if (activeType !== 'enumeration') return;

    if (speciesSingleId != null && !speciesSingle) {
      const nm = speciesById.get(String(speciesSingleId));
      if (nm) setSpeciesSingle(nm);
    }
    if (conditionId != null && !condition) {
      const nm = conditionById.get(String(conditionId));
      if (nm) setCondition(nm);
    }
  }, [modalVisible, isEdit, activeType, speciesSingleId, conditionId, speciesSingle, condition, speciesById, conditionById]);

  // ---------- Takki + Disputed ----------
  const getTakkiValue = row => {
    const v =
      row?.takki_number ??
      row?.takki_no ??
      row?.takkiNo ??
      row?.takkiNumber ??
      row?.takki ??
      row?.taki_number ??
      row?.taki_no ??
      null;
    const s = String(v ?? '').trim();
    return s ? s : '—';
  };

  const getDisputedBool = row => {
    const raw = row?.is_disputed ?? row?.isDisputed ?? row?.disputed ?? row?.isDispute ?? row?.is_dispute ?? null;
    if (typeof raw === 'boolean') return raw;
    if (raw == null) return false;
    const s = String(raw).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y';
  };

  // ---------- Multi Species Summaries ----------
  const buildSpeciesSummaryFromSpeciesCounts = species_counts => {
    const arr = Array.isArray(species_counts) ? species_counts : [];
    if (!arr.length) return '—';
    return arr
      .map(sc => {
        const sid = Number(sc?.species_id ?? sc?.id);
        if (!Number.isFinite(sid)) return null;
        const nm = speciesById.get(String(sid)) || `#${sid}`;
        const cnt = sc?.count ?? '';
        return `${nm}: ${cnt}`;
      })
      .filter(Boolean)
      .join(', ');
  };

  const buildSpeciesSummaryForPole = row => {
    const latest = pickLatestPoleCropSpeciesPerId(row?.poleCropSpecies || []);
    if (!latest.length) return '—';

    return latest
      .map(x => {
        const sid = Number(x?.species_id);
        const nm = speciesById.get(String(sid)) || x?.name || `#${sid}`;
        return `${nm}: ${x?.count ?? ''}`;
      })
      .filter(Boolean)
      .join(', ');
  };

  const buildSpeciesSummaryForAff = row => {
    const latest = pickLatestAfforestationSpeciesPerId(row?.afforestationSpecies || []);
    if (!latest.length) return '—';
    return latest
      .map(x => {
        const sid = Number(x?.species_id);
        const nm = speciesById.get(String(sid)) || x?.name || `#${sid}`;
        return `${nm}: ${x?.count ?? ''}`;
      })
      .filter(Boolean)
      .join(', ');
  };

  // ---------- DECORATE ----------
  const decoratedRows = useMemo(() => {
    return serverRows.map(r => {
      const autoGps = r?.auto_lat != null && r?.auto_long != null ? `${r.auto_lat}, ${r.auto_long}` : '—';
      const manualGps = r?.manual_lat != null && r?.manual_long != null ? `${r.manual_lat}, ${r.manual_long}` : '—';

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

      let spMulti = '—';

      if (Array.isArray(r?.poleCropSpecies) && r.poleCropSpecies.length) {
        spMulti = buildSpeciesSummaryForPole(r);
      } else if (Array.isArray(r?.species_counts) && r.species_counts.length) {
        spMulti = buildSpeciesSummaryFromSpeciesCounts(r.species_counts);
      } else if (Array.isArray(r?.species_ids) && r.species_ids.length) {
        spMulti = r.species_ids
          .map(id => speciesById.get(String(id)) || `#${id}`)
          .filter(Boolean)
          .join(', ');
      } else if (Array.isArray(r?.afforestationSpecies) && r.afforestationSpecies.length) {
        spMulti = buildSpeciesSummaryForAff(r);
      }

      const takki = getTakkiValue(r);
      const disputed = getDisputedBool(r);

      return {
        ...r,
        _autoGps: autoGps,
        _manualGps: manualGps,
        _speciesSingleLabel: spSingle,
        _conditionSingleLabel: condSingle,
        _speciesMultiLabel: spMulti,
        _takki: takki,
        _isDisputed: disputed,
        _disputedLabel: disputed ? 'YES' : 'NO',
      };
    });
  }, [serverRows, speciesById, conditionById]);

  // ---------- FILTERED ----------
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return decoratedRows.filter(r => {
      if (statusFilter !== STATUS_FILTERS.ALL) {
        const tags = getStatusTags(r);
        if (!tags.includes(statusFilter)) return false;
      }

      if (!q) return true;

      const ui = deriveRowUi(r);
      const blob = [
        r?.id,
        r?.nameOfSiteId,
        r?.name_of_site_id,
        r?.rd_km,
        r?.rds_from,
        r?.rds_to,
        r?.av_miles_km,
        r?.no_of_plants,
        r?._speciesSingleLabel,
        r?._conditionSingleLabel,
        r?._speciesMultiLabel,
        r?._takki,
        r?._disputedLabel,
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

  // ---------- Multi Species UI Helpers ----------
  const addSpeciesCountRow = type => {
    if (type === 'pole') {
      setPoleSpeciesCounts(prev => [...prev, { species_id: null, count: '' }]);
      return;
    }
    setAffSpeciesCounts(prev => [...prev, { species_id: null, count: '' }]);
  };

  const removeSpeciesCountRow = (type, index) => {
    const remover = prev => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      arr.splice(index, 1);
      return arr.length ? arr : [{ species_id: null, count: '' }];
    };
    if (type === 'pole') setPoleSpeciesCounts(remover);
    else setAffSpeciesCounts(remover);
  };

  const updateSpeciesCountRow = (type, index, patch) => {
    const updater = prev => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      if (!arr[index]) arr[index] = { species_id: null, count: '' };
      arr[index] = { ...arr[index], ...patch };
      return arr;
    };
    if (type === 'pole') setPoleSpeciesCounts(updater);
    else setAffSpeciesCounts(updater);
  };

  const cleanSpeciesCountsPayload = list => {
    const arr = Array.isArray(list) ? list : [];
    const cleaned = arr
      .map(x => ({
        species_id: Number(x?.species_id),
        count: Number(String(x?.count ?? '').replace(/[^\d.]+/g, '')),
      }))
      .filter(x => Number.isFinite(x.species_id) && Number.isFinite(x.count));

    const map = new Map();
    cleaned.forEach(x => map.set(x.species_id, x));
    return Array.from(map.values());
  };

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
    setPoleSpeciesCounts([{ species_id: null, count: '' }]);

    setAvMilesKm('');
    setNoOfPlants('');
    setAffSpeciesCounts([{ species_id: null, count: '' }]);

    setGpsAuto('');
    setGpsManual('');
    setGpsSource('');

    setPictureAssets([]);
    setUploadedImageUrls([]);
    setUploadingImages(false);

    setShowNewSpeciesBox(false);
    setNewSpeciesName('');
    setNewSpeciesTarget({ type: null, index: null });
  };

  const openAddForm = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditForm = row => {
    setIsEdit(true);
    setEditingId(row?.id ?? null);

    setNameOfSiteId(String(row?.name_of_site_id ?? row?.nameOfSiteId ?? row?.nameOfSiteId?.id ?? ''));

    const auto = row?.auto_lat != null && row?.auto_long != null ? `${row.auto_lat}, ${row.auto_long}` : '';
    const manual = row?.manual_lat != null && row?.manual_long != null ? `${row.manual_lat}, ${row.manual_long}` : '';

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

      const poleLatest = pickLatestPoleCropSpeciesPerId(row?.poleCropSpecies || []);
      if (poleLatest.length) {
        setPoleSpeciesCounts(
          poleLatest.map(x => ({ species_id: x?.species_id ?? null, count: String(x?.count ?? '') })),
        );
      } else if (Array.isArray(row?.species_counts) && row.species_counts.length) {
        setPoleSpeciesCounts(
          row.species_counts.map(x => ({ species_id: x?.species_id ?? x?.id ?? null, count: String(x?.count ?? '') })),
        );
      } else if (Array.isArray(row?.species_ids) && row?.species_ids?.length) {
        setPoleSpeciesCounts(
          row.species_ids.map((sid, i) => ({ species_id: sid, count: i === 0 ? String(row?.count ?? '') : '' })),
        );
      } else {
        setPoleSpeciesCounts([{ species_id: null, count: '' }]);
      }
    }

    if (activeType === 'aff') {
      setAvMilesKm(String(row?.av_miles_km ?? ''));
      setNoOfPlants(String(row?.no_of_plants ?? ''));

      const latest = pickLatestAfforestationSpeciesPerId(row?.afforestationSpecies || []);
      if (latest.length) {
        setAffSpeciesCounts(latest.map(x => ({ species_id: x?.species_id ?? null, count: String(x?.count ?? '') })));
      } else if (Array.isArray(row?.species_counts) && row.species_counts.length) {
        setAffSpeciesCounts(
          row.species_counts.map(x => ({ species_id: x?.species_id ?? x?.id ?? null, count: String(x?.count ?? '') })),
        );
      } else {
        setAffSpeciesCounts([{ species_id: null, count: '' }]);
      }
    }

    setModalVisible(true);
  };

  // ---------- SAVE HELPERS ----------
  const buildPictures = async () => {
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
    const { create } = getActiveUrls();
    const token = await getAuthToken();
    if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

    const res = await fetch(create, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || json?.error || `API Error (${res.status})`);
    return json;
  };

  const submitPatch = async (id, body) => {
    const { update } = getActiveUrls();
    const token = await getAuthToken();
    if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');
    if (!id) throw new Error('Missing record id for update.');

    const res = await fetch(update(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || json?.error || `API Error (${res.status})`);
    return json;
  };

  // ---------- CREATE NEW SPECIES (Other) ----------
  const createSpeciesAndAssign = useCallback(async () => {
    const nm = String(newSpeciesName || '').trim();
    if (!nm) return Alert.alert('Missing', 'Please enter new species name.');

    try {
      setCreatingSpecies(true);
      const token = await getAuthToken();
      if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

      const res = await fetch(SPECIES_CREATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: nm }),
      });

      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.message || json?.error || `API Error (${res.status})`);

      await fetchSpecies();

      const createdId = speciesIdByNameLower.get(nm.toLowerCase());
      const { type, index } = newSpeciesTarget || {};

      if (createdId != null && type && index != null) updateSpeciesCountRow(type, index, { species_id: createdId });

      setShowNewSpeciesBox(false);
      setNewSpeciesName('');
      setNewSpeciesTarget({ type: null, index: null });

      Alert.alert('Success', 'Species added successfully.');
    } catch (e) {
      Alert.alert('Create Species Failed', e?.message || 'Failed to create species');
    } finally {
      setCreatingSpecies(false);
    }
  }, [newSpeciesName, newSpeciesTarget, fetchSpecies, speciesIdByNameLower]);

  const saveRecord = async () => {
    const { lat: autoLat, lng: autoLng } = parseLatLng(gpsAuto);
    const { lat: manualLat, lng: manualLng } = parseLatLng(gpsManual);

    // Prepare attachment metadata for ApiService
    const uploadPath = UPLOAD_PATHS[activeType] || UPLOAD_PATHS.enumeration;
    const attachments = (pictureAssets || []).map((a, idx) => ({
      uri: a.uri,
      type: a.type || 'image/jpeg',
      name: a.fileName || `img_${Date.now()}_${idx}.jpg`,
      uploadUrl: UPLOAD_URL,
      uploadPath: uploadPath,
      targetFieldInBody: 'pictures',
    }));

    // If Editing, we need to handle existing vs new pictures.
    // ApiService logic: appends new uploads to 'pictures'.
    // So if replacing (new pics present), 'pictures' in body should be [].
    // If appending (keeping old + adding new), 'pictures' should contain old URLs.
    // RegistersScreen UI: "setPictureAssets([])" on load, implies if user picks new images, they replace?
    // Actually the UI handles `uploadedImageUrls` (existing) separately.
    // Line 953 logic was: if pictureAssets.length, upload and replace. Else keep existing.

    let initialPictures = [];
    if (!pictureAssets || pictureAssets.length === 0) {
      initialPictures = Array.isArray(uploadedImageUrls) ? uploadedImageUrls : [];
    }

    let body = null;

    if (activeType === 'enumeration') {
      const chosenSpeciesId = speciesSingleId ?? (speciesRows.find(x => x.name === speciesSingle)?.id ?? null);
      const chosenConditionId = conditionId ?? (conditionRows.find(x => x.name === condition)?.id ?? null);

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
        pictures: initialPictures, // ApiService will append new ones
      };
    }

    if (activeType === 'pole') {
      if (!String(nameOfSiteId || '').trim()) return Alert.alert('Missing', 'nameOfSiteId is required');

      const rf = Number(String(rdsFrom || '').replace(/[^\d.]+/g, ''));
      const rt = Number(String(rdsTo || '').replace(/[^\d.]+/g, ''));

      const species_counts = cleanSpeciesCountsPayload(poleSpeciesCounts);
      if (!species_counts.length) return Alert.alert('Missing', 'species_counts is required (add species + count).');

      body = {
        nameOfSiteId: Number(nameOfSiteId),
        rds_from: Number.isFinite(rf) ? rf : 0,
        rds_to: Number.isFinite(rt) ? rt : 0,
        auto_lat: autoLat,
        auto_long: autoLng,
        manual_lat: manualLat,
        manual_long: manualLng,
        pictures: initialPictures,
        species_counts,
      };
    }

    if (activeType === 'aff') {
      if (!String(nameOfSiteId || '').trim()) return Alert.alert('Missing', 'nameOfSiteId is required');

      const av = Number(String(avMilesKm || '').replace(/[^\d.]+/g, ''));

      const species_counts = cleanSpeciesCountsPayload(affSpeciesCounts);
      if (!species_counts.length) return Alert.alert('Missing', 'species_counts is required (add species + count).');

      const plants = Number(String(noOfPlants || '').replace(/[^\d.]+/g, ''));
      const sumPlants = species_counts.reduce((acc, x) => acc + (Number(x.count) || 0), 0);
      const finalPlants = Number.isFinite(plants) && plants > 0 ? plants : sumPlants;

      body = {
        nameOfSiteId: Number(nameOfSiteId),
        av_miles_km: Number.isFinite(av) ? av : 0,
        no_of_plants: Number.isFinite(finalPlants) ? finalPlants : 0,
        auto_lat: autoLat,
        auto_long: autoLng,
        manual_lat: manualLat,
        manual_long: manualLng,
        pictures: initialPictures,
        species_counts,
      };
    }

    if (!body) return Alert.alert('Error', 'Unknown record type.');

    try {
      setUploadingImages(true);
      const urls = getActiveUrls();

      let res;
      if (isEdit) {
        if (!editingId) throw new Error('Edit ID missing.');
        res = await apiService.patch(urls.update(editingId), body, { attachments });
      } else {
        res = await apiService.post(urls.create, body, { attachments });
      }

      setModalVisible(false);
      fetchServer({ refresh: true });
      Alert.alert(res.offline ? 'Saved Offline' : 'Success', res.message || 'Saved successfully.');
    } catch (e) {
      Alert.alert(isEdit ? 'Update Failed' : 'Create Failed', e?.message || 'Request failed');
    } finally {
      setUploadingImages(false);
    }
  };

  // ---------- ✅ AUDIT NAVIGATION (FIXED PARAMS + FIXED STACK NAV) ----------
  const getStackNav = nav => nav?.getParent?.() || nav;

  const goToAudit = (type, r) => {
    const stackNav = getStackNav(navigation);

    // RootNavigator route names:
    // EnumerationAudit, PoleCropAuditScreen, AfforestationAuditListScreen
    if (type === 'pole') {
      // ✅ match your working pattern
      stackNav.navigate('PoleCropAuditScreen', { poleCrop: r });
      return;
    }

    if (type === 'aff') {
      const afforestationId = r?.id;
      const speciesSnapshot = pickLatestAfforestationSpeciesPerId(r?.afforestationSpecies || []);
      // ✅ match your working pattern
      stackNav.navigate('AfforestationAuditListScreen', {
        afforestationId,
        record: r,
        speciesSnapshot,
      });
      return;
    }

    // enumeration
    const enumerationId = r?.id;
    stackNav.navigate('EnumerationAudit', {
      enumerationId,
      enumeration: r,
    });
  };

  // ---------- UI LABELS ----------
  const headerTitle = useMemo(() => {
    const t = TABS.find(x => x.key === activeType);
    return t?.label || 'Registers';
  }, [activeType]);

  // ---------- TABLE COLUMNS ----------
  const tableColumns = useMemo(() => {
    if (activeType === 'enumeration') {
      return [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'site', label: 'Site', width: 90 },
        { key: 'rd', label: 'RD/KM', width: 110 },
        { key: 'species', label: 'Species', width: 200 },
        { key: 'condition', label: 'Condition', width: 160 },
        { key: 'takki', label: 'MDR No. (Takki No.)', width: 120 },
        { key: 'disputed', label: 'Disputed', width: 110 },
        { key: 'auto', label: 'Auto GPS', width: 180 },
        { key: 'manual', label: 'Manual GPS', width: 180 },
        { key: 'status', label: 'Status', width: 220 },
        { key: 'actions', label: 'Actions', width: 220 }, // ✅ widened for Edit + Audit
      ];
    }

    if (activeType === 'pole') {
      return [
        { key: 'id', label: 'ID', width: 80 },
        { key: 'site', label: 'Site', width: 90 },
        { key: 'rds_from', label: 'RDS From', width: 110 },
        { key: 'rds_to', label: 'RDS To', width: 110 },
        { key: 'species_multi', label: 'Species : Count', width: 260 },
        { key: 'takki', label: 'MDR No. (Takki No.)', width: 120 },
        { key: 'disputed', label: 'Disputed', width: 110 },
        { key: 'auto', label: 'Auto GPS', width: 180 },
        { key: 'manual', label: 'Manual GPS', width: 180 },
        { key: 'status', label: 'Status', width: 220 },
        { key: 'actions', label: 'Actions', width: 220 }, // ✅ widened for Edit + Audit
      ];
    }

    return [
      { key: 'id', label: 'ID', width: 80 },
      { key: 'site', label: 'Site', width: 90 },
      { key: 'avg', label: 'Avg KM', width: 110 },
      { key: 'plants', label: 'Plants', width: 110 },
      { key: 'species_multi', label: 'Species : Count', width: 260 },
      { key: 'takki', label: 'MDR No. (Takki No.)', width: 120 },
      { key: 'disputed', label: 'Disputed', width: 110 },
      { key: 'auto', label: 'Auto GPS', width: 180 },
      { key: 'manual', label: 'Manual GPS', width: 180 },
      { key: 'status', label: 'Status', width: 220 },
      { key: 'actions', label: 'Actions', width: 220 }, // ✅ widened for Edit + Audit
    ];
  }, [activeType]);

  // ---------- RENDER ----------
  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.headerGradient}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Text style={styles.headerSubtitle}>Real-time server records</Text>
          </View>
        </View>

        {/* Top Tabs */}
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
            onRefresh={() => fetchServer({ refresh: true })}
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
              placeholder="Search by ID, site, species, takki, status..."
              placeholderTextColor={COLORS.textLight}
              style={styles.searchInput}
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear}>
                <Ionicons name="close-circle" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            )}
          </View>

          {/* Status Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterBarContent}>
            {[
              { key: STATUS_FILTERS.ALL, label: 'All' },
              { key: STATUS_FILTERS.PENDING, label: 'Pending' },
              { key: STATUS_FILTERS.VERIFIED, label: 'Verified' },
              { key: STATUS_FILTERS.DISAPPROVED, label: 'Disapproved' },
              { key: STATUS_FILTERS.DISPOSED, label: 'Disposed' },
              { key: STATUS_FILTERS.SUPERDARI, label: 'Superdari' },
            ].map(item => {
              const active = statusFilter === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.85}
                  onPress={() => setStatusFilter(item.key)}
                  style={[styles.filterChip, active ? styles.filterChipActive : styles.filterChipInactive]}>
                  <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : styles.filterChipTextInactive]}>
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
            <Ionicons name={loading ? 'refresh' : 'checkmark-circle'} size={24} color={loading ? COLORS.warning : COLORS.success} />
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
            <TouchableOpacity style={styles.errorButton} onPress={() => fetchServer({ refresh: true })}>
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
                  {tableColumns.map((col, idx) => (
                    <View key={String(col.key) + idx} style={[styles.thCell, { width: col.width }]}>
                      <Text style={styles.thText}>{col.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Rows */}
                {filteredRows.map((r, idx) => {
                  const ui = deriveRowUi(r);

                  const disputedColor = r?._isDisputed ? COLORS.danger : COLORS.success;
                  const disputedBg = r?._isDisputed ? 'rgba(239,68,68,0.10)' : 'rgba(22,163,74,0.10)';

                  const getCellValue = key => {
                    switch (key) {
                      case 'id':
                        return String(r?.id ?? '—');
                      case 'site':
                        return String(r?.name_of_site_id ?? r?.nameOfSiteId ?? '—');
                      case 'rd':
                        return String(r?.rd_km ?? '—');
                      case 'rds_from':
                        return String(r?.rds_from ?? '—');
                      case 'rds_to':
                        return String(r?.rds_to ?? '—');
                      case 'avg':
                        return String(r?.av_miles_km ?? '—');
                      case 'plants':
                        return String(r?.no_of_plants ?? '—');
                      case 'species':
                        return String(r?._speciesSingleLabel ?? '—');
                      case 'species_multi':
                        return String(r?._speciesMultiLabel ?? '—');
                      case 'condition':
                        return String(r?._conditionSingleLabel ?? '—');
                      case 'takki':
                        return String(r?._takki ?? '—');
                      case 'auto':
                        return String(r?._autoGps ?? '—');
                      case 'manual':
                        return String(r?._manualGps ?? '—');
                      default:
                        return '—';
                    }
                  };

                  return (
                    <View
                      key={String(r?.id ?? idx)}
                      style={[
                        styles.tableRow,
                        idx % 2 === 0 ? styles.rowEven : styles.rowOdd,
                        ui.isRejected ? styles.rowRejected : null,
                      ]}>
                      {tableColumns.map(col => {
                        if (col.key === 'status') {
                          return (
                            <View key="status" style={[styles.tdCell, { width: col.width }]}>
                              {ui.isRejected ? (
                                <TouchableOpacity activeOpacity={0.85} onPress={() => openRejectionPopup(r)}>
                                  <View style={[styles.statusBadge, { backgroundColor: `${ui.statusColor}15` }]}>
                                    <View style={[styles.statusDot, { backgroundColor: ui.statusColor }]} />
                                    <Text style={[styles.statusText, { color: ui.statusColor }]} numberOfLines={2}>
                                      {ui.statusText}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              ) : (
                                <View style={[styles.statusBadge, { backgroundColor: `${ui.statusColor}15` }]}>
                                  <View style={[styles.statusDot, { backgroundColor: ui.statusColor }]} />
                                  <Text style={[styles.statusText, { color: ui.statusColor }]} numberOfLines={2}>
                                    {ui.statusText}
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        }

                        if (col.key === 'actions') {
                          return (
                            <View key="actions" style={[styles.tdCell, styles.actionsCell, { width: col.width }]}>
                              {/* Edit (only if rejected/disapproved as you already do) */}
                              {ui.showEdit ? (
                                <TouchableOpacity style={styles.actionButton} onPress={() => openEditForm(r)}>
                                  <Ionicons name="create-outline" size={16} color={COLORS.secondary} />
                                  <Text style={styles.actionButtonText}>Edit</Text>
                                </TouchableOpacity>
                              ) : (
                                <View style={{ width: 0, height: 0 }} />
                              )}

                              {/* Update (only if Final Approved) */}
                              {ui.isFinalApproved && (
                                <TouchableOpacity
                                  style={[styles.actionButton, styles.auditButton]}
                                  onPress={() => goToAudit(activeType, r)}
                                  activeOpacity={0.7}>
                                  <Ionicons name="clipboard-outline" size={16} color={COLORS.primary} />
                                  <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>Update</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        }

                        if (col.key === 'disputed') {
                          return (
                            <View key="disputed" style={[styles.tdCell, { width: col.width }]}>
                              <View style={[styles.disputedPill, { backgroundColor: disputedBg, borderColor: `${disputedColor}35` }]}>
                                <View style={[styles.disputedDot, { backgroundColor: disputedColor }]} />
                                <Text style={[styles.disputedText, { color: disputedColor }]}>{r?._disputedLabel ?? 'NO'}</Text>
                              </View>
                            </View>
                          );
                        }

                        return (
                          <View key={col.key} style={[styles.tdCell, { width: col.width }]}>
                            <Text style={styles.tdText} numberOfLines={2}>
                              {getCellValue(col.key)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </ScrollView>



      {/* Rejection Modal */}
      <Modal transparent visible={rejectionModal.visible} animationType="fade" onRequestClose={closeRejectionPopup}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={closeRejectionPopup}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { maxHeight: height * 0.5 }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons name="alert-circle" size={24} color={COLORS.danger} />
                  <Text style={styles.modalTitle}>Rejection Reason</Text>
                </View>
                <TouchableOpacity style={styles.modalClose} onPress={closeRejectionPopup}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.textLight }}>Rejected By</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 14 }}>
                  {rejectionModal.rejectedBy || 'Officer'}
                </Text>

                <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.textLight }}>Remarks</Text>
                <View
                  style={{
                    marginTop: 8,
                    backgroundColor: 'rgba(239,68,68,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(239,68,68,0.20)',
                    borderRadius: 14,
                    padding: 14,
                  }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, lineHeight: 20 }}>
                    {rejectionModal.remarks}
                  </Text>
                </View>

                {/* --- Offline Sync Bar --- */}
                {offlineStatus.count > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <TouchableOpacity
                      style={{
                        backgroundColor: COLORS.warning,
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                      }}
                      onPress={() => offlineService.processQueue()}
                      disabled={offlineStatus.syncing}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {offlineStatus.syncing ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons name="cloud-offline" size={20} color="#fff" />
                        )}
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                          {offlineStatus.syncing
                            ? 'Syncing records...'
                            : `${offlineStatus.count} Offline Records Pending`}
                        </Text>
                      </View>
                      {!offlineStatus.syncing && (
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>SYNC NOW</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={{ marginTop: 16, backgroundColor: COLORS.danger, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                  onPress={closeRejectionPopup}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Modal (UNCHANGED from your version) */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.editModalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.editModalContainer}>
            <LinearGradient colors={['#fff', '#f8fafc']} style={styles.editModalContent}>
              <View style={styles.editModalHeader}>
                <View>
                  <Text style={styles.editModalTitle}>{isEdit ? 'Edit Record' : 'Add New Record'}</Text>
                  {isEdit && editingId && <Text style={styles.editModalSubtitle}>ID: {editingId}</Text>}
                </View>
                <TouchableOpacity style={styles.editModalClose} onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* NOTE: Your entire modal body remains as you provided (forms, gps, images, save) */}
              {/* To keep this response strictly “complete and working”, I am keeping the modal body exactly as in your paste.
                  If you need the modal section pasted again, tell me and I will provide the full file including modal body verbatim. */}
              <ScrollView style={styles.editModalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                        if (name === 'Other (Add New)') {
                          Alert.alert(
                            'Not Available Here',
                            'Other species creation is available in Pole/Afforestation multi-species rows.',
                          );
                          return;
                        }
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
                    <FormRow label="rds_from" value={rdsFrom} onChangeText={setRdsFrom} placeholder="e.g. 5.0" keyboardType="numeric" />
                    <FormRow label="rds_to" value={rdsTo} onChangeText={setRdsTo} placeholder="e.g. 10.0" keyboardType="numeric" />

                    <Text style={styles.sectionLabel}>Species Counts</Text>

                    {poleSpeciesCounts.map((row, idx) => {
                      const selectedName = row?.species_id != null ? speciesById.get(String(row.species_id)) || '' : '';
                      return (
                        <View
                          key={`pole_sc_${idx}`}
                          style={{
                            borderWidth: 1,
                            borderColor: COLORS.border,
                            borderRadius: 14,
                            padding: 12,
                            marginBottom: 12,
                            backgroundColor: '#fff',
                          }}>
                          <DropdownRow
                            label={speciesLoading ? 'Species (Loading...)' : 'Species'}
                            value={selectedName}
                            onChange={name => {
                              if (name === 'Other (Add New)') {
                                setShowNewSpeciesBox(true);
                                setNewSpeciesTarget({ type: 'pole', index: idx });
                                return;
                              }
                              const id = speciesRows.find(x => x.name === name)?.id ?? null;
                              updateSpeciesCountRow('pole', idx, { species_id: id });
                            }}
                            options={speciesOptions}
                            disabled={speciesLoading}
                            required
                          />

                          <FormRow
                            label="Count"
                            value={String(row?.count ?? '')}
                            onChangeText={t => updateSpeciesCountRow('pole', idx, { count: t })}
                            placeholder="e.g. 100"
                            keyboardType="numeric"
                          />

                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                backgroundColor: 'rgba(31, 41, 55, 0.05)',
                                paddingVertical: 12,
                                borderRadius: 12,
                                alignItems: 'center',
                              }}
                              onPress={() => addSpeciesCountRow('pole')}>
                              <Text style={{ fontWeight: '800', color: COLORS.text }}>+ Add Row</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                flex: 1,
                                backgroundColor: 'rgba(239,68,68,0.10)',
                                paddingVertical: 12,
                                borderRadius: 12,
                                alignItems: 'center',
                              }}
                              onPress={() => removeSpeciesCountRow('pole', idx)}>
                              <Text style={{ fontWeight: '800', color: COLORS.danger }}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}

                {activeType === 'aff' && (
                  <>
                    <FormRow label="av_miles_km" value={avMilesKm} onChangeText={setAvMilesKm} placeholder="e.g. 10.5" keyboardType="numeric" />
                    <FormRow
                      label="no_of_plants (optional, auto-sum if empty)"
                      value={noOfPlants}
                      onChangeText={setNoOfPlants}
                      placeholder="e.g. 1000"
                      keyboardType="numeric"
                    />

                    <Text style={styles.sectionLabel}>Species Counts</Text>

                    {affSpeciesCounts.map((row, idx) => {
                      const selectedName = row?.species_id != null ? speciesById.get(String(row.species_id)) || '' : '';
                      return (
                        <View
                          key={`aff_sc_${idx}`}
                          style={{
                            borderWidth: 1,
                            borderColor: COLORS.border,
                            borderRadius: 14,
                            padding: 12,
                            marginBottom: 12,
                            backgroundColor: '#fff',
                          }}>
                          <DropdownRow
                            label={speciesLoading ? 'Species (Loading...)' : 'Species'}
                            value={selectedName}
                            onChange={name => {
                              if (name === 'Other (Add New)') {
                                setShowNewSpeciesBox(true);
                                setNewSpeciesTarget({ type: 'aff', index: idx });
                                return;
                              }
                              const id = speciesRows.find(x => x.name === name)?.id ?? null;
                              updateSpeciesCountRow('aff', idx, { species_id: id });
                            }}
                            options={speciesOptions}
                            disabled={speciesLoading}
                            required
                          />

                          <FormRow
                            label="Count"
                            value={String(row?.count ?? '')}
                            onChangeText={t => updateSpeciesCountRow('aff', idx, { count: t })}
                            placeholder="e.g. 500"
                            keyboardType="numeric"
                          />

                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                backgroundColor: 'rgba(31, 41, 55, 0.05)',
                                paddingVertical: 12,
                                borderRadius: 12,
                                alignItems: 'center',
                              }}
                              onPress={() => addSpeciesCountRow('aff')}>
                              <Text style={{ fontWeight: '800', color: COLORS.text }}>+ Add Row</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={{
                                flex: 1,
                                backgroundColor: 'rgba(239,68,68,0.10)',
                                paddingVertical: 12,
                                borderRadius: 12,
                                alignItems: 'center',
                              }}
                              onPress={() => removeSpeciesCountRow('aff', idx)}>
                              <Text style={{ fontWeight: '800', color: COLORS.danger }}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}

                {/* Create new species box (Other) */}
                {showNewSpeciesBox && (
                  <View style={{ marginTop: 10, marginBottom: 10 }}>
                    <Text style={styles.sectionLabel}>Add New Species</Text>
                    <View
                      style={{
                        backgroundColor: 'rgba(124, 58, 237, 0.06)',
                        borderWidth: 1,
                        borderColor: 'rgba(124, 58, 237, 0.18)',
                        borderRadius: 14,
                        padding: 14,
                      }}>
                      <FormRow label="Species name" value={newSpeciesName} onChangeText={setNewSpeciesName} placeholder="e.g. Guavaaa" />
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            backgroundColor: COLORS.info,
                            paddingVertical: 14,
                            borderRadius: 12,
                            alignItems: 'center',
                            opacity: creatingSpecies ? 0.7 : 1,
                          }}
                          disabled={creatingSpecies}
                          onPress={createSpeciesAndAssign}>
                          {creatingSpecies ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>Add & Select</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flex: 1, backgroundColor: 'rgba(31, 41, 55, 0.05)', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
                          onPress={() => {
                            setShowNewSpeciesBox(false);
                            setNewSpeciesName('');
                            setNewSpeciesTarget({ type: null, index: null });
                          }}>
                          <Text style={{ fontWeight: '900', color: COLORS.text }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

                {/* GPS + Images blocks restored */}
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.sectionLabel}>GPS Coordinates</Text>

                  <View style={styles.gpsRow}>
                    <View style={styles.gpsBox}>
                      <Text style={styles.gpsLabel}>Auto</Text>
                      <Text style={styles.gpsValue} numberOfLines={1}>
                        {gpsAuto || 'Not fetched'}
                      </Text>
                    </View>
                    <View style={styles.gpsBox}>
                      <Text style={styles.gpsLabel}>Manual</Text>
                      <TextInput
                        style={styles.gpsInput}
                        value={gpsManual}
                        onChangeText={setGpsManual}
                        placeholder="lat, lng"
                        placeholderTextColor={COLORS.textLight}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.gpsBtn}
                    onPress={() => fetchLocationSmart()}
                    disabled={gpsFetching}>
                    {gpsFetching ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="location" size={18} color="#fff" />
                        <Text style={styles.gpsBtnText}>Fetch Current Location</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {!!gpsSource && <Text style={styles.gpsSourceText}>Source: {gpsSource}</Text>}
                </View>

                {/* Images Section */}
                <View style={{ marginTop: 20, marginBottom: 20 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                    <Text style={styles.sectionLabel}>Pictures</Text>
                    <Text style={{ fontSize: 12, color: COLORS.textLight }}>
                      {pictureAssets.length + uploadedImageUrls.length} selected
                    </Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.imgScroll}>
                    {/* Uploaded Urls (Edit Mode) */}
                    {uploadedImageUrls.map((url, i) => (
                      <View key={`exist_${i}`} style={styles.imgThumb}>
                        <Image source={{ uri: url }} style={styles.imgThumbImg} />
                        <View style={styles.imgBadge}>
                          <Text style={styles.imgBadgeText}>Saved</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.imgRemove}
                          onPress={() => {
                            setUploadedImageUrls(prev => prev.filter((_, idx) => idx !== i));
                          }}>
                          <Ionicons name="close" size={12} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}

                    {/* New Assets */}
                    {pictureAssets.map((asset, i) => (
                      <View key={`new_${i}`} style={styles.imgThumb}>
                        <Image source={{ uri: asset.uri }} style={styles.imgThumbImg} />
                        <TouchableOpacity
                          style={styles.imgRemove}
                          onPress={() => {
                            setPictureAssets(prev => prev.filter((_, idx) => idx !== i));
                          }}>
                          <Ionicons name="close" size={12} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>

                  <TouchableOpacity style={styles.addImgBtn} onPress={pickImage}>
                    <Ionicons name="camera" size={20} color={COLORS.primary} />
                    <Text style={styles.addImgText}>Add / Pick Images</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <View style={styles.editModalFooter}>
                <TouchableOpacity style={styles.footerButtonSecondary} onPress={() => setModalVisible(false)}>
                  <Text style={styles.footerButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.footerButtonPrimary, uploadingImages && { opacity: 0.7 }]} disabled={uploadingImages} onPress={saveRecord}>
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

      <FullScreenLoader visible={offlineStatus.syncing} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  // (This tool call is strictly for OfflineService.js update)

  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2 },
  headerSubtitle: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },

  tabsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 14 },
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
  tabPillActive: { backgroundColor: 'rgba(255,255,255,0.20)', borderColor: 'rgba(255,255,255,0.30)' },
  tabPillInactive: { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.18)' },
  tabText: { fontSize: 12, fontWeight: '900' },
  tabTextActive: { color: '#fff' },
  tabTextInactive: { color: 'rgba(255,255,255,0.85)' },

  searchSection: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '500', color: COLORS.text },
  searchClear: { padding: 4 },

  filterBar: { marginTop: 10 },
  filterBarContent: { paddingHorizontal: 0, paddingBottom: 6, gap: 10 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  filterChipActive: { backgroundColor: 'rgba(5, 150, 105, 0.12)', borderColor: 'rgba(5, 150, 105, 0.30)' },
  filterChipInactive: { backgroundColor: '#fff', borderColor: COLORS.border },
  filterChipText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  filterChipTextActive: { color: COLORS.primaryDark },
  filterChipTextInactive: { color: COLORS.textLight },

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
    marginTop: 10,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  statLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textLight },
  statDivider: { width: 1, height: 40, backgroundColor: COLORS.border },

  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
  },
  errorHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: COLORS.danger },
  errorMessage: { fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: 12 },
  errorButton: { backgroundColor: COLORS.danger, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  errorButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  section: { marginHorizontal: 20, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  sectionSubtitle: { fontSize: 14, fontWeight: '600', color: COLORS.textLight },

  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 20 },

  tableContainer: { borderRadius: 16, overflow: 'hidden' },
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
  thCell: { paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.border },
  thText: { fontSize: 12, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', minHeight: 60, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowEven: { backgroundColor: '#fff' },
  rowOdd: { backgroundColor: 'rgba(5, 150, 105, 0.02)' },
  rowRejected: { backgroundColor: 'rgba(239, 68, 68, 0.06)' },
  tdCell: { paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.border },
  tdText: { fontSize: 13, fontWeight: '600', color: COLORS.text },

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
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, flexShrink: 1 },

  actionsCell: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },

  // ✅ Audit button styling
  auditButton: { backgroundColor: 'rgba(5,150,105,0.10)' },

  disputedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  disputedDot: { width: 8, height: 8, borderRadius: 4 },
  disputedText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },

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
  fabGradient: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },

  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalContainer: { flex: 1, justifyContent: 'center', padding: 20 },
  modalContent: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
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
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editModalOverlay: { flex: 1, backgroundColor: COLORS.overlay },
  editModalContainer: { flex: 1, marginTop: Platform.OS === 'ios' ? 40 : 20 },
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
  editModalTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  editModalSubtitle: { fontSize: 14, fontWeight: '600', color: COLORS.textLight },
  editModalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalBody: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 },
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
  footerButtonSecondaryText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  footerButtonPrimary: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  footerButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  footerButtonPrimaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // GPS Styling
  gpsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  gpsBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gpsLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginBottom: 4, textTransform: 'uppercase' },
  gpsValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  gpsInput: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    padding: 0,
    margin: 0,
    height: 20,
  },
  gpsBtn: {
    backgroundColor: COLORS.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  gpsBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  gpsSourceText: { textAlign: 'center', marginTop: 8, fontSize: 12, color: COLORS.success, fontWeight: '700' },

  // Images Style
  imgScroll: { flexDirection: 'row', marginVertical: 12 },
  imgThumb: { width: 100, height: 100, borderRadius: 12, marginRight: 10, overflow: 'hidden', position: 'relative' },
  imgThumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  imgBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 4, alignItems: 'center' },
  imgBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  imgRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(239,68,68,0.9)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    backgroundColor: 'rgba(5, 150, 105, 0.04)',
  },
  addImgText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
});
