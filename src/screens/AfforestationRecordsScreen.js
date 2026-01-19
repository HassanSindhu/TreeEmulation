// AfforestationRecordsScreen.js
import React, {useCallback, useMemo, useRef, useState, useEffect} from 'react';
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
  Dimensions,
  StatusBar,
  RefreshControl,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {useFocusEffect} from '@react-navigation/native';

import FormRow from '../components/FormRow';
import {DropdownRow} from '../components/SelectRows';

const {height} = Dimensions.get('window');

// IMPORTANT:
// If testing locally, set API_HOST = 'http://localhost:5000'
const API_HOST = 'http://be.lte.gisforestry.com';

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

// ✅ FIXED: valid JS template strings
const API_5000 = API_HOST;
const SPECIES_URL = `${API_5000}/lpe3/species`;
const AFFORESTATION_SUBMIT_URL = `${API_5000}/enum/afforestation`;
const AFFORESTATION_EDIT_URL = id => `${API_5000}/enum/afforestation/${id}`;

const API_3000 = API_HOST;
const AFFORESTATION_LIST_URL = `${API_3000}/enum/afforestation/user-site-wise-afforestion`;

const AWS_UPLOAD_URL = 'https://app.eco.gisforestry.com/aws-bucket/tree-enum';
const AWS_UPLOAD_PATH = 'Afforestation';

const YEAR_OPTIONS = [
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

const SCHEME_OPTIONS = ['Development', 'Non Development'];
const NON_DEV_OPTIONS = ['1% Plantation', 'Replenishment', 'Gap Filling', 'Other'];

export default function AfforestationRecordsScreen({navigation, route}) {
  const enumeration = route?.params?.enumeration;

  // ---------- STATE ----------
  const [records, setRecords] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [serverRefreshing, setServerRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  // ✅ editingId stores SERVER ID for PATCH
  const [editingId, setEditingId] = useState(null);

  // ✅ Rejection popup state
  const [rejectionModal, setRejectionModal] = useState({
    visible: false,
    rejectedBy: '',
    remarks: '',
  });

  const [search, setSearch] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    year: '',
    schemeType: '',
    status: '', // New status filter
    avgFrom: '',
    avgTo: '',
  });

  // form fields
  const [avgMilesKm, setAvgMilesKm] = useState('');
  const [year, setYear] = useState('');
  const [schemeType, setSchemeType] = useState('');
  const [projectName, setProjectName] = useState('');
  const [nonDevScheme, setNonDevScheme] = useState('');

  // NEW: additional API field from curl
  const [replenishmentDetails, setReplenishmentDetails] = useState('');

  // species master + selection + per-species counts
  const [speciesRows, setSpeciesRows] = useState([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [speciesModalVisible, setSpeciesModalVisible] = useState(false);
  const [speciesIds, setSpeciesIds] = useState([]);

  // ✅ speciesCounts: { "1": "500", "4": "300" }
  const [speciesCounts, setSpeciesCounts] = useState({});

  // GPS
  const [autoGps, setAutoGps] = useState('');
  const [gpsList, setGpsList] = useState(['']);
  const [gpsLoading, setGpsLoading] = useState(false);

  // images
  const [pictureUris, setPictureUris] = useState([]);
  const [uploading, setUploading] = useState(false);

  // ✅ NEW: Image picker (camera/gallery) modal
  const [imagePickerModal, setImagePickerModal] = useState(false);

  const lastGpsRequestAtRef = useRef(0);

  // ---------- STATUS / UI RULES ----------
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

  /**
   * Flow for Afforestation:
   * Guard -> Block Officer -> SDFO -> DFO -> Surveyor -> Final Approved
   * Reject => goes back to Guard with remarks; Edit shows, user can resubmit.
   */
  const deriveRowUi = r => {
    const latestStatus = r?.latestStatus || null;

    const actionRaw = String(latestStatus?.action || '').trim();
    const action = actionRaw.toLowerCase(); // rejected / verified
    const byRole = normalizeRole(latestStatus?.user_role || '');
    const byDesignation = String(latestStatus?.designation || '').trim();
    const remarks = String(latestStatus?.remarks || '').trim();

    // No status yet
    if (!latestStatus || !actionRaw) {
      return {
        statusText: 'Pending (Block Officer)',
        statusColor: COLORS.textLight,
        showEdit: false,
        rowAccent: null,
        isRejected: false,
        _remarks: remarks,
      };
    }

    if (action === 'rejected') {
      const rejectBy = byDesignation || byRole || 'Officer';
      return {
        statusText: `Rejected by ${rejectBy}`,
        statusColor: COLORS.danger,
        showEdit: true,
        rowAccent: 'rejected',
        isRejected: true,
        _remarks: remarks,
        _rejectedBy: rejectBy,
      };
    }

    if (action === 'verified') {
      const approver = byRole || 'Block Officer';
      const nxt = nextRole(approver);

      // Surveyor approved => final
      if (!nxt) {
        return {
          statusText: 'Final Approved',
          statusColor: COLORS.success,
          showEdit: false,
          rowAccent: null,
          isRejected: false,
          _remarks: remarks,
        };
      }

      return {
        statusText: `Verified • Pending (${nxt})`,
        statusColor: COLORS.warning,
        showEdit: false,
        rowAccent: null,
        isRejected: false,
        _remarks: remarks,
      };
    }

    return {
      statusText: actionRaw || 'Pending',
      statusColor: COLORS.textLight,
      showEdit: false,
      rowAccent: null,
      isRejected: false,
      _remarks: remarks,
    };
  };

  // ✅ Rejection popup open/close
  const openRejectionPopup = row => {
    const ui = deriveRowUi(row);
    if (!ui.isRejected) return;

    setRejectionModal({
      visible: true,
      rejectedBy: ui._rejectedBy || 'Officer',
      remarks: ui._remarks || 'No remarks provided.',
    });
  };

  const closeRejectionPopup = () => {
    setRejectionModal({visible: false, rejectedBy: '', remarks: ''});
  };

  // ✅ Only show Edit if status is rejected
  const isRejectedStatus = record => {
    const ui = deriveRowUi(record);
    return ui.isRejected;
  };

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

  const asValidId = v => {
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

  const resolveNameOfSiteId = useCallback(() => {
    const p = route?.params || {};
    const e = enumeration || {};

    const candidates = [
      p.nameOfSiteId,
      p.name_of_site_id,
      p.siteId,
      p.site_id,
      e.nameOfSiteId,
      e.name_of_site_id,
      e.siteId,
      e.site_id,
      e.site?.id,
      e.site?.site_id,
      e.name_of_site?.id,
      e.name_of_site?.site_id,
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

  // ✅ Helper: fill auto GPS into the last manual coordinate
  const fillAutoIntoManual = useCallback(autoValue => {
    const v = String(autoValue || '').trim();
    if (!v) return;

    setGpsList(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      if (list.length === 0) return [v];
      if (list.length === 1 && !String(list[0] || '').trim()) return [v];

      list[list.length - 1] = v;
      return list;
    });
  }, []);

  // ---------- SPECIES ----------
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

    const namesFromMaster = speciesRows
      .filter(x => speciesIds.includes(Number(x.id)))
      .map(x => x.name)
      .filter(Boolean);

    if (namesFromMaster.length) {
      return namesFromMaster.length > 2
        ? `${namesFromMaster.slice(0, 2).join(', ')} +${namesFromMaster.length - 2} more`
        : namesFromMaster.join(', ');
    }

    return `${speciesIds.length} selected`;
  }, [speciesIds, speciesRows]);

  // ✅ Updated: also keeps speciesCounts keys in sync
  const toggleSpeciesId = id => {
    const num = Number(id);
    if (!Number.isFinite(num)) return;

    setSpeciesIds(prev => {
      const set = new Set(prev.map(Number));
      const next = new Set(set);

      if (next.has(num)) next.delete(num);
      else next.add(num);

      // keep counts aligned
      setSpeciesCounts(prevCounts => {
        const copy = {...(prevCounts || {})};

        // add default when selected
        if (next.has(num) && (copy[String(num)] === undefined || copy[String(num)] === null)) {
          copy[String(num)] = '';
        }

        // remove when unselected
        if (!next.has(num)) delete copy[String(num)];

        return copy;
      });

      return Array.from(next);
    });
  };

  // ---------- RECORDS FETCH ----------
  const normalizeApiRecord = raw => {
    const scheme = raw?.scheme_type ?? raw?.schemeType ?? '';
    const project = raw?.project_name ?? raw?.projectName ?? '';
    const yearVal = raw?.year ?? '';

    const avRaw = raw?.av_miles_km ?? raw?.avgMilesKm ?? raw?.avg_miles_km ?? '';

    const autoLat = raw?.auto_lat ?? raw?.autoLat ?? null;
    const autoLng = raw?.auto_long ?? raw?.autoLong ?? null;
    const manualLat = raw?.manual_lat ?? raw?.manualLat ?? null;
    const manualLng = raw?.manual_long ?? raw?.manualLong ?? null;

    // ✅ NEW API: raw.species = [{ species_id, count }]
    // ✅ fallback: raw.afforestationSpecies (old)
    const speciesArr = Array.isArray(raw?.species)
      ? raw.species
      : Array.isArray(raw?.afforestationSpecies)
      ? raw.afforestationSpecies.map(x => ({
          species_id: x?.species_id ?? x?.species?.id,
          count: x?.count ?? x?.plants ?? x?.no_of_plants,
          name: x?.species?.name,
          species: x?.species,
        }))
      : [];

    const species_ids = speciesArr
      .map(x => Number(x?.species_id ?? x?.species?.id))
      .filter(n => Number.isFinite(n));

    const species_counts = {};
    speciesArr.forEach(x => {
      const sid = Number(x?.species_id ?? x?.species?.id);
      if (!Number.isFinite(sid)) return;
      const c = x?.count;
      if (c !== null && c !== undefined) species_counts[String(sid)] = String(c);
    });

    const species_names = speciesArr
      .map(x => String(x?.name || x?.species?.name || '').trim())
      .filter(Boolean);

    const autoGpsLatLong =
      Number.isFinite(Number(autoLat)) && Number.isFinite(Number(autoLng))
        ? `${Number(autoLat).toFixed(6)}, ${Number(autoLng).toFixed(6)}`
        : raw?.autoGpsLatLong || '';

    const gpsBoundingBox =
      Number.isFinite(Number(manualLat)) && Number.isFinite(Number(manualLng))
        ? [`${Number(manualLat).toFixed(6)}, ${Number(manualLng).toFixed(6)}`]
        : Array.isArray(raw?.gpsBoundingBox)
        ? raw.gpsBoundingBox
        : [''];

    const pictures = Array.isArray(raw?.pictures) ? raw.pictures : [];
    const serverId = raw?.id ?? raw?._id ?? null;

    return {
      id: String(serverId ?? Date.now()),
      serverId,

      avgMilesKm: avRaw !== null && avRaw !== undefined ? String(avRaw) : '',

      year: String(yearVal || ''),
      schemeType: String(scheme || ''),

      projectName: scheme === 'Development' ? String(project || '') : '',
      nonDevScheme: scheme === 'Non Development' ? String(project || '') : '',

      // NEW fields
      replenishment_details: raw?.replenishment_details ?? raw?.replenishmentDetails ?? '',
      main_species: raw?.main_species ?? raw?.mainSpecies ?? '',

      autoGpsLatLong,
      gpsBoundingBox,

      species_ids,
      species_names,
      species_counts,

      verification: Array.isArray(raw?.verification) ? raw.verification : [],
      latestStatus: raw?.latestStatus || null,

      createdAt: raw?.created_at || raw?.createdAt || new Date().toISOString(),
      serverRaw: raw,

      pictures,
      picturePreview: pictures?.[0] || null,
      pictureUris: [],
    };
  };

  // ✅ REALTIME ONLY: always fetch server
  const fetchAfforestationList = useCallback(
    async ({refresh = false} = {}) => {
      if (!nameOfSiteId) {
        setRecords([]);
        return;
      }

      try {
        refresh ? setServerRefreshing(true) : setListLoading(true);

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
      } catch (e) {
        setRecords([]);
        Alert.alert('Load Failed', e?.message || 'Failed to load records from server.');
      } finally {
        refresh ? setServerRefreshing(false) : setListLoading(false);
      }
    },
    [nameOfSiteId],
  );

  useFocusEffect(
    useCallback(() => {
      fetchAfforestationList({refresh: true});
    }, [fetchAfforestationList]),
  );

  // ---------- FORM HANDLERS ----------
  const resetFormForAdd = () => {
    setIsEdit(false);
    setEditingId(null);

    setAvgMilesKm('');
    setYear('');
    setSchemeType('');
    setProjectName('');
    setNonDevScheme('');
    setReplenishmentDetails('');

    setSpeciesIds([]);
    setSpeciesCounts({});

    setAutoGps('');
    setGpsList(['']);
    setPictureUris([]);
  };

  // ✅ GPS fetch now also fills manual automatically
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

        fillAutoIntoManual(value);

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
    // ✅ Guard: only allow edit when rejected
    if (!isRejectedStatus(record)) {
      Alert.alert('Not Allowed', 'You can edit only when status is Rejected.');
      return;
    }

    setIsEdit(true);

    const sid =
      record?.serverId ??
      record?.serverRaw?.id ??
      record?.serverRaw?._id ??
      record?.id ??
      null;

    setEditingId(sid ? String(sid) : null);

    setAvgMilesKm(record.avgMilesKm || '');
    setYear(record.year || '');
    setSchemeType(record.schemeType || '');
    setProjectName(record.projectName || '');
    setNonDevScheme(record.nonDevScheme || '');
    setReplenishmentDetails(record?.replenishment_details || '');

    setSpeciesIds(Array.isArray(record.species_ids) ? record.species_ids : []);
    setSpeciesCounts(record?.species_counts || {});

    setAutoGps(record.autoGpsLatLong || '');

    const manual =
      Array.isArray(record.gpsBoundingBox) && record.gpsBoundingBox.length
        ? record.gpsBoundingBox
        : [''];
    setGpsList(manual);

    setPictureUris([]);
    setModalVisible(true);

    if (record.autoGpsLatLong) {
      setTimeout(() => fillAutoIntoManual(record.autoGpsLatLong), 0);
    } else {
      setTimeout(() => fetchAutoGps(true), 300);
    }
  };

  // ---------- IMAGE PICKER (Gallery + Camera + Permission Handling) ----------
  const openAppSettings = () => {
    Alert.alert(
      'Permission Required',
      'Please allow camera permission from Settings to take photos.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings().catch(() => {});
          },
        },
      ],
    );
  };

  const requestAndroidCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'We need camera access so you can take a photo.',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      return false;
    }
  };

  const onImagePickerResult = res => {
    if (!res) return;
    if (res.didCancel) return;

    if (res.errorCode) {
      if (res.errorCode === 'permission' || res.errorCode === 'camera_unavailable') {
        openAppSettings();
        return;
      }
      Alert.alert('Image Error', res.errorMessage || 'Could not get image');
      return;
    }

    const assets = res.assets || [];
    const uris = assets.map(a => a?.uri).filter(Boolean);

    // Replace behavior (same as your previous implementation)
    // If you want append behavior, use: setPictureUris(prev => [...(prev||[]), ...uris]);
    if (uris.length) setPictureUris(uris);
  };

  const pickFromGallery = () => {
    setImagePickerModal(false);
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.7,
        selectionLimit: 0, // 0 = multiple
      },
      onImagePickerResult,
    );
  };

  const takePhotoFromCamera = async () => {
    setImagePickerModal(false);

    const ok = await requestAndroidCameraPermission();
    if (!ok) {
      openAppSettings();
      return;
    }

    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.7,
        saveToPhotos: true,
        cameraType: 'back',
      },
      onImagePickerResult,
    );
  };

  // Entry point from UI button
  const pickImage = () => {
    setImagePickerModal(true);
  };

  // ---------- GPS List Controls ----------
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
    if (autoGps?.trim()) {
      fillAutoIntoManual(autoGps.trim());
      return;
    }
    fetchAutoGps(false);
  };

  const addAutoToList = () => {
    const v = (autoGps || '').trim();
    if (!v) {
      Alert.alert('GPS', 'Auto GPS is empty. Tap "Fetch GPS" first.');
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

  // ---------- AWS UPLOAD ----------
  const uploadImagesToS3 = async (
    localUris,
    {uploadPath = AWS_UPLOAD_PATH, fileName = 'chan'} = {},
  ) => {
    if (!Array.isArray(localUris) || localUris.length === 0) return [];

    const form = new FormData();
    form.append('uploadPath', uploadPath);
    form.append('isMulti', 'true');
    form.append('fileName', fileName);

    localUris.forEach((uri, idx) => {
      const cleanUri = Platform.OS === 'ios' ? uri.replace('file://', '') : uri;
      const extGuess = (uri || '').split('.').pop();
      const ext = extGuess && extGuess.length <= 5 ? extGuess.toLowerCase() : 'jpg';
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';

      form.append('files', {
        uri: cleanUri,
        type: mime,
        name: `${fileName}_${idx}.${ext}`,
      });
    });

    const res = await fetch(AWS_UPLOAD_URL, {
      method: 'POST',
      body: form,
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.status) {
      const msg = json?.message || `Upload failed (HTTP ${res.status})`;
      throw new Error(msg);
    }

    const items = Array.isArray(json?.data) ? json.data : [];
    const finalUrls = [];

    items.forEach(it => {
      const img = it?.availableSizes?.image;
      if (img) {
        finalUrls.push(img);
        return;
      }
      if (Array.isArray(it?.url) && it.url.length) {
        finalUrls.push(it.url[it.url.length - 1]);
        return;
      }
    });

    return finalUrls.filter(Boolean);
  };

  // ---------- SUBMIT / EDIT ----------
  const submitAfforestationToApi = async (body, {isEditMode = false, editId = null} = {}) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

    const url = isEditMode ? AFFORESTATION_EDIT_URL(editId) : AFFORESTATION_SUBMIT_URL;
    const method = isEditMode ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
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
    if (!nameOfSiteId) {
      const keys = enumeration ? Object.keys(enumeration).join(', ') : '(enumeration is null)';
      Alert.alert(
        'Error',
        `nameOfSiteId missing. Ensure previous screen passes it.\n\nKeys:\n${keys}`,
      );
      return;
    }
    if (!speciesIds.length) {
      Alert.alert('Missing', 'Please select at least 1 species.');
      return;
    }

    // ✅ Validate per-species counts
    for (const sid of speciesIds) {
      const v = speciesCounts[String(sid)];
      const n = Number(String(v || '').replace(/[^\d]/g, ''));
      if (!Number.isFinite(n) || n <= 0) {
        const row = speciesRows.find(x => Number(x.id) === Number(sid));
        Alert.alert('Missing', `Please enter valid count for ${row?.name || `species ${sid}`}.`);
        return;
      }
    }

    const cleanGps = gpsList.map(x => (x || '').trim()).filter(x => x.length > 0);
    const {lat: autoLat, lng: autoLng} = parseLatLng(autoGps);

    const lastManual = cleanGps.length ? cleanGps[cleanGps.length - 1] : autoGps;
    const {lat: manualLat, lng: manualLng} = parseLatLng(lastManual || autoGps);

    const av = Number(String(avgMilesKm).replace(/[^\d.]+/g, ''));
    const avMilesKmNum = Number.isFinite(av) ? av : 0;

    let uploadedUrls = [];
    try {
      if (pictureUris?.length) {
        setUploading(true);
        const safeFileName = `aff_${Number(nameOfSiteId)}_${Date.now()}`;
        uploadedUrls = await uploadImagesToS3(pictureUris, {
          uploadPath: AWS_UPLOAD_PATH,
          fileName: safeFileName,
        });
      }
    } catch (e) {
      setUploading(false);
      Alert.alert('Upload Failed', e?.message || 'Image upload failed.');
      return;
    } finally {
      setUploading(false);
    }

    // ✅ species payload exactly like curl
    const speciesPayload = speciesIds.map(sid => ({
      species_id: Number(sid),
      count: Number(String(speciesCounts[String(sid)] || '').replace(/[^\d]/g, '')),
    }));

    // ✅ main_species: using first selected species name (you can also add a dedicated input if your backend requires)
    const firstSpecies = speciesRows.find(x => Number(x.id) === Number(speciesIds[0]));
    const mainSpeciesName = firstSpecies?.name ? String(firstSpecies.name) : '';

    const apiBody = {
      nameOfSiteId: Number(nameOfSiteId),
      av_miles_km: avMilesKmNum,

      main_species: mainSpeciesName,
      year: String(year),
      scheme_type: String(schemeType),
      project_name:
        schemeType === 'Development' ? String(projectName || '') : String(nonDevScheme || ''),
      replenishment_details: String(replenishmentDetails || ''),

      auto_lat: autoLat,
      auto_long: autoLng,
      manual_lat: manualLat,
      manual_long: manualLng,

      pictures: uploadedUrls,
      species: speciesPayload,
    };

    try {
      if (isEdit) {
        if (!editingId) throw new Error('Edit ID missing. Cannot PATCH without record id.');
        await submitAfforestationToApi(apiBody, {isEditMode: true, editId: editingId});
        Alert.alert('Success', 'Record updated and resubmitted successfully.');
      } else {
        await submitAfforestationToApi(apiBody, {isEditMode: false});
        Alert.alert('Success', 'Saved to server.');
      }

      setModalVisible(false);
      fetchAfforestationList({refresh: true});
    } catch (e) {
      Alert.alert('Submit Failed', e?.message || 'Server submit failed.');
    }
  };

  // ---------- FILTERS ----------
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
      avgFrom: '',
      avgTo: '',
    });
  };

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const df = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00') : null;
    const dt = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59') : null;
    const aF = filters.avgFrom !== '' ? Number(filters.avgFrom) : null;
    const aT = filters.avgTo !== '' ? Number(filters.avgTo) : null;

    return records.filter(r => {
      // Status filter
      if (filters.status) {
        const ui = deriveRowUi(r);
        const statusMatch = ui.statusText.toLowerCase().includes(filters.status.toLowerCase());
        if (!statusMatch) return false;
      }

      if (filters.year && r.year !== filters.year) return false;
      if (filters.schemeType && r.schemeType !== filters.schemeType) return false;

      if ((df || dt) && r.createdAt) {
        const d = new Date(r.createdAt);
        if (df && d < df) return false;
        if (dt && d > dt) return false;
      } else if ((df || dt) && !r.createdAt) return false;

      if (aF !== null || aT !== null) {
        const n = toNumber(r.avgMilesKm);
        if (n === null) return false;
        if (aF !== null && n < aF) return false;
        if (aT !== null && n > aT) return false;
      }

      if (!q) return true;

      const gpsText =
        Array.isArray(r.gpsBoundingBox) && r.gpsBoundingBox.length ? r.gpsBoundingBox.join(' | ') : '';
      const picsText = Array.isArray(r.pictures) ? r.pictures.join(' ') : '';

      const ui = deriveRowUi(r);

      const speciesCountsText = (() => {
        const ids = Array.isArray(r.species_ids) ? r.species_ids : [];
        const counts = r?.species_counts || {};
        return ids
          .map(sid => {
            const row = speciesRows.find(x => Number(x.id) === Number(sid));
            const name = row?.name || `Species ${sid}`;
            const c = counts[String(sid)] ?? '';
            return `${name}:${c}`;
          })
          .join(' ');
      })();

      const blob = [
        r.serverId,
        r.year,
        r.schemeType,
        r.projectName,
        r.nonDevScheme,
        r.avgMilesKm,
        r.autoGpsLatLong,
        gpsText,
        speciesCountsText,
        ui.statusText,
        picsText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [records, search, filters, speciesRows]);

  // ✅ Show Actions column ONLY if at least one rejected record in filtered list
  const showActionsColumn = useMemo(() => {
    const hasRejected = filteredRecords.some(r => deriveRowUi(r).isRejected);
    return hasRejected;
  }, [filteredRecords]);

  const tableColumns = useMemo(() => {
    const base = [
      {label: 'ID', width: 80},
      {label: 'Year', width: 100},
      {label: 'Avg KM', width: 100},
      {label: 'Scheme', width: 130},
      {label: 'Project', width: 180},
      {label: 'Species Counts', width: 260},
      {label: 'Auto GPS', width: 200},
      {label: 'GPS List', width: 250},
      {label: 'Status', width: 220},
    ];
    if (showActionsColumn) base.push({label: 'Actions', width: 100});
    return base;
  }, [showActionsColumn]);

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
            <Text style={styles.headerTitle}>Afforestation</Text>
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
            {nameOfSiteId && <Text style={styles.siteId}>Site ID: {nameOfSiteId}</Text>}
          </View>

          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.7}>
            <Ionicons name="filter" size={22} color="#fff" />
            {activeFilterCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={serverRefreshing}
            onRefresh={() => fetchAfforestationList({refresh: true})}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        {/* Search Section */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color={COLORS.textLight}
              style={styles.searchIcon}
            />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by ID, year, scheme, status..."
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
              name={listLoading ? 'refresh' : 'server'}
              size={24}
              color={listLoading ? COLORS.warning : COLORS.success}
            />
            <Text style={styles.statLabel}>{listLoading ? 'Loading...' : 'Online'}</Text>
          </View>
        </View>

        {/* Records Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Afforestation Records</Text>
            <Text style={styles.sectionSubtitle}>
              Showing {filteredRecords.length} of {records.length} records
            </Text>
          </View>

          {listLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading records from server...</Text>
            </View>
          ) : records.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={64} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No Records Yet</Text>
              <Text style={styles.emptyText}>
                Start by adding afforestation records for this site
              </Text>
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
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableContainer}>
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  {tableColumns.map((col, idx) => (
                    <View key={idx} style={[styles.thCell, {width: col.width}]}>
                      <Text style={styles.thText}>{col.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Table Rows */}
                {filteredRecords.map((r, idx) => {
                  const ui = deriveRowUi(r);
                  const gpsText =
                    Array.isArray(r.gpsBoundingBox) && r.gpsBoundingBox.length
                      ? r.gpsBoundingBox.join(' | ')
                      : '';
                  const proj =
                    r.schemeType === 'Development'
                      ? r.projectName || '—'
                      : r.schemeType === 'Non Development'
                      ? r.nonDevScheme || '—'
                      : '—';

                  const allowActions = ui.showEdit;

                  const rowStyle = [
                    styles.tableRow,
                    idx % 2 === 0 ? styles.rowEven : styles.rowOdd,
                    ui.rowAccent === 'rejected' ? styles.rowRejected : null,
                  ];

                  const speciesCountsText = (() => {
                    const ids = Array.isArray(r.species_ids) ? r.species_ids : [];
                    const counts = r?.species_counts || {};
                    if (!ids.length) return '—';

                    return ids
                      .map(sid => {
                        const row = speciesRows.find(x => Number(x.id) === Number(sid));
                        const name = row?.name || `Species ${sid}`;
                        const c = counts[String(sid)] ?? '0';
                        return `${name}: ${c}`;
                      })
                      .join('\n');
                  })();

                  return (
                    <View key={r.id} style={rowStyle}>
                      <View style={[styles.tdCell, {width: 80}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r.serverId || '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 100}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {r.year || '—'}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 100}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {r.avgMilesKm || '—'}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 130}]}>
                        <View
                          style={[
                            styles.schemeBadge,
                            {
                              backgroundColor:
                                r.schemeType === 'Development'
                                  ? `${COLORS.secondary}15`
                                  : `${COLORS.info}15`,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.schemeText,
                              {color: r.schemeType === 'Development' ? COLORS.secondary : COLORS.info},
                            ]}>
                            {r.schemeType || '—'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.tdCell, {width: 180}]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {proj}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 260}]}>
                        <Text style={styles.multiLineCell} numberOfLines={5}>
                          {speciesCountsText}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 200}]}>
                        <Text style={styles.gpsText} numberOfLines={1}>
                          {r.autoGpsLatLong || '—'}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, {width: 250}]}>
                        <Text style={styles.tdText} numberOfLines={2}>
                          {gpsText || '—'}
                        </Text>
                      </View>

                      {/* ✅ Status Cell with clickable rejection */}
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

                      {/* ✅ Actions Column */}
                      {showActionsColumn && (
                        <View style={[styles.tdCell, styles.actionsCell, {width: 100}]}>
                          {allowActions ? (
                            <TouchableOpacity
                              style={styles.actionButton}
                              onPress={() => openEditForm(r)}
                              activeOpacity={0.7}>
                              <Ionicons name="create-outline" size={16} color={COLORS.secondary} />
                              <Text style={styles.actionButtonText}>Edit</Text>
                            </TouchableOpacity>
                          ) : (
                            <Text style={styles.tdText}>—</Text>
                          )}
                        </View>
                      )}
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

      {/* ✅ Image Picker Modal (Camera / Gallery) */}
      <Modal
        transparent
        visible={imagePickerModal}
        animationType="fade"
        onRequestClose={() => setImagePickerModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setImagePickerModal(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, {maxHeight: height * 0.35}]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons name="image-outline" size={24} color={COLORS.primary} />
                  <Text style={styles.modalTitle}>Add Image</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setImagePickerModal(false)}
                  activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={{padding: 20, gap: 12}}>
                <TouchableOpacity
                  style={{
                    backgroundColor: COLORS.primary,
                    paddingVertical: 14,
                    borderRadius: 14,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                  onPress={takePhotoFromCamera}
                  activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={20} color="#fff" />
                  <Text style={{color: '#fff', fontWeight: '800', fontSize: 15}}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    backgroundColor: 'rgba(5,150,105,0.10)',
                    borderWidth: 1,
                    borderColor: 'rgba(5,150,105,0.25)',
                    paddingVertical: 14,
                    borderRadius: 14,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                  onPress={pickFromGallery}
                  activeOpacity={0.8}>
                  <Ionicons name="images-outline" size={20} color={COLORS.primary} />
                  <Text style={{color: COLORS.primary, fontWeight: '800', fontSize: 15}}>
                    Choose from Gallery
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: 'center',
                  }}
                  onPress={() => setImagePickerModal(false)}
                  activeOpacity={0.8}>
                  <Text style={{color: COLORS.textLight, fontWeight: '800'}}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ Rejection Reason Modal */}
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
                <FormRow
                  label="Status"
                  value={filters.status}
                  onChangeText={v => setFilters(prev => ({...prev, status: v}))}
                  placeholder="e.g., Pending, Rejected, Verified"
                />

                <DropdownRow
                  label="Year"
                  value={filters.year}
                  onChange={v => setFilters(prev => ({...prev, year: v}))}
                  options={YEAR_OPTIONS}
                />

                <DropdownRow
                  label="Scheme Type"
                  value={filters.schemeType}
                  onChange={v => setFilters(prev => ({...prev, schemeType: v}))}
                  options={SCHEME_OPTIONS}
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
                      label="Avg KM From"
                      value={filters.avgFrom}
                      onChangeText={v => setFilters(prev => ({...prev, avgFrom: v}))}
                      placeholder="e.g. 10"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.filterColumn}>
                    <FormRow
                      label="Avg KM To"
                      value={filters.avgTo}
                      onChangeText={v => setFilters(prev => ({...prev, avgTo: v}))}
                      placeholder="e.g. 50"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalButtonSecondary}
                    onPress={clearAll}
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

      {/* Species Selection Modal */}
      <Modal
        visible={speciesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSpeciesModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setSpeciesModalVisible(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons name="leaf" size={24} color={COLORS.primary} />
                  <Text style={styles.modalTitle}>Select Species</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setSpeciesModalVisible(false)}
                  activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {speciesLoading ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Loading species...</Text>
                </View>
              ) : (
                <>
                  <ScrollView style={styles.speciesList} showsVerticalScrollIndicator={false}>
                    {speciesRows.map(row => {
                      const checked = speciesIds.includes(Number(row.id));
                      return (
                        <TouchableOpacity
                          key={String(row.id)}
                          style={styles.speciesItem}
                          onPress={() => toggleSpeciesId(row.id)}
                          activeOpacity={0.7}>
                          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                            {checked && <Ionicons name="checkmark" size={16} color="#fff" />}
                          </View>
                          <View style={styles.speciesInfo}>
                            <Text style={styles.speciesName}>{row.name}</Text>
                            {row.id && <Text style={styles.speciesId}>ID: {row.id}</Text>}
                          </View>
                          {checked && (
                            <View style={styles.selectedIndicator}>
                              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.speciesFooter}>
                    <View style={styles.speciesCountBadge}>
                      <Text style={styles.speciesCountText}>{speciesIds.length} species selected</Text>
                    </View>

                    <View style={styles.speciesActions}>
                      <TouchableOpacity
                        style={styles.speciesActionButton}
                        onPress={() => {
                          setSpeciesIds([]);
                          setSpeciesCounts({});
                        }}
                        activeOpacity={0.7}>
                        <Text style={styles.speciesActionButtonText}>Clear All</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.speciesActionButton, styles.speciesActionButtonPrimary]}
                        onPress={() => setSpeciesModalVisible(false)}
                        activeOpacity={0.7}>
                        <Text style={styles.speciesActionButtonPrimaryText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
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
                    {isEdit ? 'Edit Afforestation Record' : 'Add Afforestation Record'}
                  </Text>
                  {isEdit && editingId && (
                    <Text style={styles.editModalSubtitle}>Record ID: {editingId}</Text>
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
                  <Text style={styles.formSectionTitle}>Basic Information</Text>

                  <FormRow
                    label="Average Miles/KM"
                    value={avgMilesKm}
                    onChangeText={setAvgMilesKm}
                    keyboardType="numeric"
                    required
                    placeholder="Enter average miles or kilometers"
                  />

                  <View style={styles.fieldWithButton}>
                    <Text style={styles.fieldLabel}>Species Selection</Text>
                    <TouchableOpacity
                      style={styles.multiSelectButton}
                      onPress={() => setSpeciesModalVisible(true)}
                      activeOpacity={0.7}>
                      <Ionicons name="leaf-outline" size={18} color="#fff" />
                      <Text style={styles.multiSelectButtonText} numberOfLines={1}>
                        {speciesLabel}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color="#fff" />
                    </TouchableOpacity>
                    {speciesIds.length > 0 && (
                      <Text style={styles.speciesHint}>{speciesIds.length} species selected</Text>
                    )}
                  </View>

                  {/* ✅ Per-species counts */}
                  {speciesIds.length > 0 && (
                    <View style={{marginTop: 6}}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '800',
                          color: COLORS.textLight,
                          marginBottom: 10,
                        }}>
                        Species Counts
                      </Text>

                      {speciesIds.map(sid => {
                        const row = speciesRows.find(x => Number(x.id) === Number(sid));
                        const label = row?.name ? `${row.name} Plants Count` : `Species ${sid} Plants Count`;
                        return (
                          <FormRow
                            key={String(sid)}
                            label={label}
                            value={speciesCounts[String(sid)] ?? ''}
                            onChangeText={v =>
                              setSpeciesCounts(prev => ({
                                ...(prev || {}),
                                [String(sid)]: String(v || '').replace(/[^\d]/g, ''),
                              }))
                            }
                            keyboardType="numeric"
                            placeholder="e.g. 500"
                            required
                          />
                        );
                      })}
                    </View>
                  )}

                  <DropdownRow
                    label="Year"
                    value={year}
                    onChange={setYear}
                    options={YEAR_OPTIONS}
                    required
                  />

                  <DropdownRow
                    label="Scheme Type"
                    value={schemeType}
                    onChange={val => {
                      setSchemeType(val);
                      setProjectName('');
                      setNonDevScheme('');
                    }}
                    options={SCHEME_OPTIONS}
                    required
                  />

                  {schemeType === 'Development' && (
                    <FormRow
                      label="Project Name"
                      value={projectName}
                      onChangeText={setProjectName}
                      placeholder="Enter project name"
                    />
                  )}

                  {schemeType === 'Non Development' && (
                    <DropdownRow
                      label="Non Development Scheme"
                      value={nonDevScheme}
                      onChange={setNonDevScheme}
                      options={NON_DEV_OPTIONS}
                    />
                  )}

                  <FormRow
                    label="Replenishment Details"
                    value={replenishmentDetails}
                    onChangeText={setReplenishmentDetails}
                    placeholder="e.g. Initial plantation completed"
                  />
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Location Coordinates</Text>

                  <View style={styles.gpsCard}>
                    <View style={styles.gpsCardHeader}>
                      <Text style={styles.gpsCardTitle}>Auto GPS Coordinates</Text>
                      <TouchableOpacity
                        style={styles.gpsFetchButton}
                        onPress={() => fetchAutoGps(false)}
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

                  <View style={styles.gpsActions}>
                    <TouchableOpacity
                      style={styles.gpsActionButton}
                      onPress={addCoordinateField}
                      activeOpacity={0.7}>
                      <Ionicons name="add-circle-outline" size={18} color="#fff" />
                      <Text style={styles.gpsActionButtonText}>Add Coordinate</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.gpsActionButton, styles.gpsActionButtonSecondary]}
                      onPress={fillLastWithAuto}
                      activeOpacity={0.7}>
                      <Ionicons name="download-outline" size={18} color="#fff" />
                      <Text style={styles.gpsActionButtonText}>Fill Last</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.gpsActionButton, styles.gpsActionButtonTertiary]}
                      onPress={addAutoToList}
                      activeOpacity={0.7}>
                      <Ionicons name="add" size={18} color="#fff" />
                      <Text style={styles.gpsActionButtonText}>Add Auto</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.gpsNote}>
                    Auto GPS fetch will also fill the last manual coordinate automatically. Add more points if you
                    want.
                  </Text>

                  {gpsList.map((coord, index) => (
                    <View key={index} style={styles.coordinateRow}>
                      <View style={styles.coordinateInputContainer}>
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
                      {gpsList.length > 1 && (
                        <TouchableOpacity
                          style={styles.removeCoordinateButton}
                          onPress={() => removeCoordinateField(index)}
                          activeOpacity={0.7}>
                          <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Images</Text>

                  <TouchableOpacity
                    style={styles.imageUploadButton}
                    onPress={pickImage}
                    activeOpacity={0.7}>
                    <View style={styles.imageUploadContent}>
                      <Ionicons name="cloud-upload-outline" size={24} color={COLORS.primary} />
                      <View style={styles.imageUploadText}>
                        <Text style={styles.imageUploadTitle}>Upload Images</Text>
                        <Text style={styles.imageUploadSubtitle}>Camera or Gallery • Upload to AWS S3</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {pictureUris.length > 0 && (
                    <View style={styles.imagePreview}>
                      <View style={styles.imagePreviewHeader}>
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                        <Text style={styles.imagePreviewTitle}>
                          {pictureUris.length} image{pictureUris.length !== 1 ? 's' : ''} selected
                        </Text>
                      </View>
                      <Text style={styles.imagePreviewText} numberOfLines={1}>
                        Ready for upload
                      </Text>
                    </View>
                  )}
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
                  disabled={uploading}
                  activeOpacity={0.7}>
                  {uploading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons
                        name={isEdit ? 'save-outline' : 'add-circle-outline'}
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.footerButtonPrimaryText}>
                        {isEdit ? 'Update Record' : 'Save Record'}
                      </Text>
                    </>
                  )}
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
  screen: {flex: 1, backgroundColor: COLORS.background},
  container: {flex: 1},
  contentContainer: {paddingBottom: 100},

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 20,
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
  headerTitle: {fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8, letterSpacing: 0.5},
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
  siteId: {fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3},
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

  // Section
  section: {marginHorizontal: 20, marginBottom: 20},
  sectionHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16},
  sectionTitle: {fontSize: 20, fontWeight: '700', color: COLORS.text},
  sectionSubtitle: {fontSize: 14, fontWeight: '600', color: COLORS.textLight},

  // Loading State
  loadingState: {backgroundColor: '#fff', borderRadius: 16, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border},
  loadingText: {fontSize: 14, color: COLORS.textLight, marginTop: 12, fontWeight: '600'},

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
  emptyText: {fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginBottom: 20, lineHeight: 20},
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
  tableHeader: {flexDirection: 'row', backgroundColor: 'rgba(5, 150, 105, 0.05)', borderBottomWidth: 1, borderBottomColor: COLORS.border, minHeight: 56},
  thCell: {paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.border},
  thText: {fontSize: 12, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5},
  tableRow: {flexDirection: 'row', minHeight: 60, borderBottomWidth: 1, borderBottomColor: COLORS.border},
  rowEven: {backgroundColor: '#fff'},
  rowOdd: {backgroundColor: 'rgba(5, 150, 105, 0.02)'},
  rowRejected: {backgroundColor: 'rgba(239, 68, 68, 0.06)'},
  tdCell: {paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.border},
  tdText: {fontSize: 13, fontWeight: '600', color: COLORS.text},
  multiLineCell: {fontSize: 12, fontWeight: '700', color: COLORS.text, lineHeight: 18},
  gpsText: {fontSize: 11, fontWeight: '600', color: COLORS.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'},
  schemeBadge: {paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start'},
  schemeText: {fontSize: 12, fontWeight: '800'},

  // Status Badge
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
  fabContent: {width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center'},

  // Modal
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
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border},
  modalTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  modalTitle: {fontSize: 20, fontWeight: '800', color: COLORS.text},
  modalClose: {width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(31, 41, 55, 0.05)', alignItems: 'center', justifyContent: 'center'},
  modalBody: {padding: 20},
  filterRow: {flexDirection: 'row', gap: 12, marginBottom: 16},
  filterColumn: {flex: 1},
  modalActions: {flexDirection: 'row', gap: 12, marginTop: 8},
  modalButtonSecondary: {flex: 1, backgroundColor: 'rgba(31, 41, 55, 0.05)', paddingVertical: 16, borderRadius: 14, alignItems: 'center'},
  modalButtonSecondaryText: {fontSize: 16, fontWeight: '700', color: COLORS.text},
  modalButtonPrimary: {flex: 2, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center'},
  modalButtonPrimaryText: {fontSize: 16, fontWeight: '800', color: '#fff'},

  // Species Modal
  speciesList: {maxHeight: 400},
  speciesItem: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border},
  checkbox: {width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginRight: 12},
  checkboxChecked: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  speciesInfo: {flex: 1},
  speciesName: {fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 2},
  speciesId: {fontSize: 12, color: COLORS.textLight, fontWeight: '500'},
  selectedIndicator: {marginLeft: 8},
  speciesFooter: {padding: 20, borderTopWidth: 1, borderTopColor: COLORS.border},
  speciesCountBadge: {backgroundColor: 'rgba(5, 150, 105, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, alignItems: 'center', marginBottom: 12},
  speciesCountText: {fontSize: 14, fontWeight: '700', color: COLORS.primary},
  speciesActions: {flexDirection: 'row', gap: 12},
  speciesActionButton: {flex: 1, backgroundColor: 'rgba(31, 41, 55, 0.05)', paddingVertical: 14, borderRadius: 12, alignItems: 'center'},
  speciesActionButtonText: {fontSize: 16, fontWeight: '700', color: COLORS.text},
  speciesActionButtonPrimary: {backgroundColor: COLORS.primary},
  speciesActionButtonPrimaryText: {fontSize: 16, fontWeight: '800', color: '#fff'},

  // Edit Modal
  editModalOverlay: {flex: 1, backgroundColor: COLORS.overlay},
  editModalContainer: {flex: 1, marginTop: Platform.OS === 'ios' ? 40 : 20},
  editModalContent: {flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border},
  editModalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border},
  editModalTitle: {fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 4},
  editModalSubtitle: {fontSize: 14, fontWeight: '600', color: COLORS.textLight},
  editModalClose: {width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(31, 41, 55, 0.05)', alignItems: 'center', justifyContent: 'center'},
  editModalBody: {paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20},
  editModalFooter: {flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingVertical: 20, borderTopWidth: 1, borderTopColor: COLORS.border},

  // Form Section
  formSection: {marginBottom: 24},
  formSectionTitle: {fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16, letterSpacing: 0.5},
  fieldWithButton: {marginBottom: 16},
  fieldLabel: {fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8},
  multiSelectButton: {flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, gap: 12},
  multiSelectButtonText: {flex: 1, fontSize: 16, fontWeight: '700', color: '#fff'},
  speciesHint: {fontSize: 12, color: COLORS.textLight, marginTop: 4, fontStyle: 'italic'},

  // GPS
  gpsCard: {backgroundColor: 'rgba(5, 150, 105, 0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(5, 150, 105, 0.1)', marginBottom: 16, overflow: 'hidden'},
  gpsCardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: 'rgba(5, 150, 105, 0.05)', borderBottomWidth: 1, borderBottomColor: 'rgba(5, 150, 105, 0.1)'},
  gpsCardTitle: {fontSize: 14, fontWeight: '700', color: COLORS.text},
  gpsFetchButton: {flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6},
  gpsFetchButtonText: {fontSize: 12, fontWeight: '700', color: '#fff'},
  gpsCardBody: {padding: 16},
  gpsValue: {fontSize: 14, fontWeight: '700', color: COLORS.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 8},
  gpsLoading: {flexDirection: 'row', alignItems: 'center', gap: 8},
  gpsLoadingText: {fontSize: 12, color: COLORS.textLight, fontWeight: '600'},
  gpsActions: {flexDirection: 'row', gap: 8, marginBottom: 12},
  gpsActionButton: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.secondary, paddingVertical: 12, borderRadius: 12, gap: 8},
  gpsActionButtonSecondary: {backgroundColor: COLORS.primary},
  gpsActionButtonTertiary: {backgroundColor: COLORS.success},
  gpsActionButtonText: {fontSize: 14, fontWeight: '700', color: '#fff'},
  gpsNote: {fontSize: 12, color: COLORS.textLight, marginBottom: 16, fontStyle: 'italic'},
  coordinateRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12},
  coordinateInputContainer: {flex: 1},
  removeCoordinateButton: {padding: 8, marginTop: 24},

  // Images
  imageUploadButton: {backgroundColor: 'rgba(5, 150, 105, 0.05)', borderWidth: 1, borderColor: 'rgba(5, 150, 105, 0.2)', borderRadius: 16, padding: 16, marginBottom: 12},
  imageUploadContent: {flexDirection: 'row', alignItems: 'center', gap: 12},
  imageUploadText: {flex: 1},
  imageUploadTitle: {fontSize: 16, fontWeight: '700', color: COLORS.primary, marginBottom: 4},
  imageUploadSubtitle: {fontSize: 12, color: COLORS.textLight},
  imagePreview: {backgroundColor: 'rgba(22, 163, 74, 0.1)', borderWidth: 1, borderColor: 'rgba(22, 163, 74, 0.2)', borderRadius: 12, padding: 12},
  imagePreviewHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4},
  imagePreviewTitle: {fontSize: 14, fontWeight: '700', color: COLORS.success},
  imagePreviewText: {fontSize: 12, color: COLORS.textLight, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'},

  // Footer Buttons
  footerButtonSecondary: {flex: 1, backgroundColor: 'rgba(31, 41, 55, 0.05)', paddingVertical: 16, borderRadius: 14, alignItems: 'center'},
  footerButtonSecondaryText: {fontSize: 16, fontWeight: '700', color: COLORS.text},
  footerButtonPrimary: {flex: 2, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8},
  footerButtonPrimaryText: {fontSize: 16, fontWeight: '800', color: '#fff'},
});
