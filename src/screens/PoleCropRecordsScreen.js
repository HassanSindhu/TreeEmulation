import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useFocusEffect } from '@react-navigation/native';

import { apiService } from '../services/ApiService';
import { offlineService } from '../services/OfflineService';

import FormRow from '../components/FormRow';
import FullScreenLoader from '../components/FullScreenLoader'; // Added loader
import { DropdownRow } from '../components/SelectRows';

const { height } = Dimensions.get('window');

// IMPORTANT:
// If testing locally, set API_HOST = 'http://localhost:5000'
const API_HOST = 'https://be.punjabtreeenumeration.com';

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

const API_BASE = API_HOST;

// Species
const SPECIES_URL = `${API_BASE}/lpe3/species`;
const ADD_SPECIES_URL = `${API_BASE}/lpe3/species`;

// Pole Crop
const POLECROP_LIST_URL = `${API_BASE}/enum/pole-crop`;
const POLECROP_SUBMIT_URL = `${API_BASE}/enum/pole-crop`;
const POLECROP_EDIT_URL = id => `${API_BASE}/enum/pole-crop/${id}`;

// AWS (same service you used)
const AWS_UPLOAD_URL = 'https://app.eco.gisforestry.com/aws-bucket/tree-enum';
const AWS_UPLOAD_PATH = 'PoleCrop';

// Navigator routes (MUST match your RootNavigator Stack.Screen names)
const POLECROP_SUPERDARI_SCREEN = 'PoleCropSuperdariScreen';
const POLECROP_DISPOSAL_SCREEN = 'PoleCropDisposeScreen';
const POLECROP_AUDIT_SCREEN = 'PoleCropAuditScreen';

export default function PoleCropRecordsScreen({ navigation, route }) {
  const enumeration = route?.params?.enumeration;

  // ---------- STATE ----------
  const [records, setRecords] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [serverRefreshing, setServerRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Keep server pictures when editing (do not overwrite with [])
  const [existingPictures, setExistingPictures] = useState([]);

  // Search + filters (light)
  const [search, setSearch] = useState('');

  // Form fields
  const [rdsFrom, setRdsFrom] = useState('');
  const [rdsTo, setRdsTo] = useState('');
  const [pageNo, setPageNo] = useState('');
  const [registerNo, setRegisterNo] = useState('');

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

  // Species master + selection (multi) + counts
  const [speciesRows, setSpeciesRows] = useState([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [speciesModalVisible, setSpeciesModalVisible] = useState(false);

  // Selected species ids
  const [speciesIds, setSpeciesIds] = useState([]);
  // counts map: { "12": "30", "14": "20" }
  const [speciesCounts, setSpeciesCounts] = useState({});

  // "Other species" flow
  const [otherSpeciesModal, setOtherSpeciesModal] = useState(false);
  const [otherSpeciesName, setOtherSpeciesName] = useState('');
  const [addingOtherSpecies, setAddingOtherSpecies] = useState(false);

  // GPS
  const [autoGps, setAutoGps] = useState('');
  const [gpsList, setGpsList] = useState(['']);
  const [gpsLoading, setGpsLoading] = useState(false);
  const lastGpsRequestAtRef = useRef(0);

  // Images (local URIs)
  const [pictureUris, setPictureUris] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [imagePickerModal, setImagePickerModal] = useState(false);

  // Keep last record opened for edit (for late species master resolution)
  const editRecordRef = useRef(null);

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

  // ✅ IMPROVED POLECROP ID RESOLVER
  const resolvePoleCropId = useCallback((record, fallbackParams = {}) => {
    console.log('🔍 RESOLVING POLE CROP ID FROM:', { record, fallbackParams });

    // First check direct record properties
    const directCandidates = [
      record?.id,
      record?.serverId,
      record?._id,
    ];

    for (const c of directCandidates) {
      const n = asValidId(c);
      if (n) {
        console.log('✅ Found direct ID:', n, 'from:', c);
        return n;
      }
    }

    // Check serverRaw (from API response)
    if (record?.serverRaw) {
      const serverCandidates = [
        record.serverRaw.id,
        record.serverRaw._id,
        record.serverRaw.serverId,
      ];

      for (const c of serverCandidates) {
        const n = asValidId(c);
        if (n) {
          console.log('✅ Found serverRaw ID:', n, 'from:', c);
          return n;
        }
      }
    }

    // Check fallback params
    const paramCandidates = [
      fallbackParams?.poleCropId,
      fallbackParams?.polecropId,
      fallbackParams?.id,
      fallbackParams?.record?.id,
      fallbackParams?.record?.serverId,
    ];

    for (const c of paramCandidates) {
      const n = asValidId(c);
      if (n) {
        console.log('✅ Found param ID:', n, 'from:', c);
        return n;
      }
    }

    console.log('❌ No valid Pole Crop ID found');
    return null;
  }, []);

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
      e.nameOfSite?.id,
      e.name_of_site?.id,
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

  // ---------- SAFE NAVIGATION ----------
  const canNavigateTo = useCallback(
    screenName => {
      const st = navigation?.getState?.();
      const names = Array.isArray(st?.routeNames) ? st.routeNames : [];
      return names.includes(screenName);
    },
    [navigation],
  );

  const safeNavigate = useCallback(
    (screenName, params) => {
      if (!screenName) return;
      if (!canNavigateTo(screenName)) {
        Alert.alert(
          'Screen Not Registered',
          `Navigator does not have "${screenName}". Please register this screen in your navigator first.`,
        );
        return;
      }
      console.log('🚀 NAVIGATING TO:', screenName, 'WITH PARAMS:', params);
      navigation.navigate(screenName, params);
    },
    [navigation, canNavigateTo],
  );

  // ---------- STATUS OVERRIDE (Disposed > Superdari > Workflow) ----------
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

  const deriveRowUi = r => {
    const latestStatus = r?.latestStatus || null;

    // OVERRIDE
    if (r?.isDisposed) {
      return {
        statusText: 'Disposed',
        statusColor: COLORS.warning,
        showEdit: false,
        rowAccent: null,
        isRejected: false,
        isFinalApproved: false,
        _remarks: '',
      };
    }
    if (r?.hasSuperdari) {
      return {
        statusText: 'Superdari',
        statusColor: COLORS.secondary,
        showEdit: false,
        rowAccent: null,
        isRejected: false,
        isFinalApproved: false,
        _remarks: '',
      };
    }

    const actionRaw = String(latestStatus?.action || '').trim();
    const action = actionRaw.toLowerCase();
    const byRole = normalizeRole(latestStatus?.user_role || '');
    const byDesignation = String(latestStatus?.designation || '').trim();
    const remarks = String(latestStatus?.remarks || '').trim();

    if (!latestStatus || !actionRaw) {
      return {
        statusText: 'Pending (Block Officer)',
        statusColor: COLORS.textLight,
        showEdit: false,
        rowAccent: null,
        isRejected: false,
        isFinalApproved: false,
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
        isFinalApproved: false,
        _remarks: remarks,
        _rejectedBy: rejectBy,
      };
    }

    if (action === 'verified') {
      const approver = byRole || 'Block Officer';
      const nxt = nextRole(approver);
      if (!nxt) {
        return {
          statusText: 'Final Approved',
          statusColor: COLORS.success,
          showEdit: false,
          rowAccent: null,
          isRejected: false,
          isFinalApproved: true,
          _remarks: remarks,
        };
      }
      return {
        statusText: `Verified • Pending (${nxt})`,
        statusColor: COLORS.warning,
        showEdit: false,
        rowAccent: null,
        isRejected: false,
        isFinalApproved: false,
        _remarks: remarks,
      };
    }

    return {
      statusText: actionRaw || 'Pending',
      statusColor: COLORS.textLight,
      showEdit: false,
      rowAccent: null,
      isRejected: false,
      isFinalApproved: false,
      _remarks: remarks,
    };
  };

  const isRejectedStatus = record => deriveRowUi(record).isRejected;

  // ---------- SUPERDARI / DISPOSAL FLAGS ----------
  const pickLatestByCreatedAt = arr => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const withTime = arr
      .map(x => {
        const t = Date.parse(x?.created_at || x?.createdAt || '');
        return { x, t: Number.isFinite(t) ? t : -1 };
      })
      .sort((a, b) => b.t - a.t);
    return withTime[0]?.x || arr[arr.length - 1] || null;
  };

  const extractSuperdariInfo = raw => {
    const r = raw || {};
    const list = Array.isArray(r?.superdari) ? r.superdari : [];
    const latest = pickLatestByCreatedAt(list);
    const sid = latest?.id ?? latest?.superdariId ?? latest?.superdari_id ?? null;
    const superdarName = latest?.superdar_name ?? latest?.superdarName ?? latest?.superdar ?? '';
    const has = Boolean(
      list.length > 0 || (typeof sid === 'number' && sid > 0) || String(superdarName || '').trim(),
    );
    return {
      hasSuperdari: has,
      superdariId: sid ?? null,
      superdarName: String(superdarName || '').trim(),
    };
  };

  const extractDisposalInfo = raw => {
    const r = raw || {};
    const list = Array.isArray(r?.disposal) ? r.disposal : [];
    const latest = pickLatestByCreatedAt(list);

    const did = latest?.id ?? latest?.disposalId ?? latest?.disposal_id ?? null;
    const disposedAt =
      latest?.dr_date ??
      latest?.disposed_at ??
      latest?.disposedAt ??
      latest?.created_at ??
      latest?.createdAt ??
      null;

    const isDisposed = Boolean(list.length > 0 || (typeof did === 'number' && did > 0));
    return {
      isDisposed,
      disposalId: did ?? null,
      disposedAt: disposedAt ?? null,
    };
  };

  // ---------- POLECROP SPECIES SNAPSHOT HELPERS ----------
  const normalizeAuditNo = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const pickLatestPoleCropSpeciesPerId = arr => {
    if (!Array.isArray(arr)) return [];

    const byId = new Map();
    for (const row of arr) {
      const sid = Number(row?.id ?? row?.species_id ?? row?.speciesId);
      if (!Number.isFinite(sid) || sid <= 0) continue;

      const audit = normalizeAuditNo(row?.audit_no ?? row?.auditNo);
      const prev = byId.get(sid);
      if (!prev || audit > prev._audit) {
        byId.set(sid, {
          species_id: sid,
          name: String(row?.name || row?.species_name || row?.speciesName || '').trim(),
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

  const normalizeSpeciesArrayPayload = arr => {
    if (!Array.isArray(arr)) return { ids: [], counts: {}, namesMap: {} };

    const counts = {};
    const namesMap = {};
    const idsSet = new Set();

    for (const it of arr) {
      const sid = Number(it?.species_id ?? it?.speciesId ?? it?.id);
      if (!Number.isFinite(sid) || sid <= 0) continue;

      idsSet.add(sid);

      const cNum = Number(String(it?.count ?? '').replace(/[^\d]/g, ''));
      counts[String(sid)] = Number.isFinite(cNum) ? String(cNum) : '';

      const nm = String(it?.name || it?.species_name || it?.speciesName || '').trim();
      if (nm) namesMap[String(sid)] = nm;
    }

    const ids = Array.from(idsSet);
    return { ids, counts, namesMap };
  };

  // ---------- SPECIES MASTER ----------
  const fetchSpecies = useCallback(async () => {
    try {
      setSpeciesLoading(true);
      // Use ApiService.get for caching
      const json = await apiService.get(SPECIES_URL);
      const rows = normalizeList(json);

      const normalized = rows
        .map(x => {
          if (typeof x === 'string') return { id: null, name: x };
          return {
            id: x?.id ?? x?.species_id ?? null,
            name: x?.name ?? x?.species_name ?? '',
          };
        })
        .filter(x => String(x.name || '').trim());

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

    const idsNum = speciesIds.map(Number).filter(n => Number.isFinite(n));
    const namesFromMaster = speciesRows
      .filter(x => idsNum.includes(Number(x.id)))
      .map(x => x.name)
      .filter(Boolean);

    if (namesFromMaster.length) {
      return namesFromMaster.length > 2
        ? `${namesFromMaster.slice(0, 2).join(', ')} +${namesFromMaster.length - 2} more`
        : namesFromMaster.join(', ');
    }
    return `${speciesIds.length} selected`;
  }, [speciesIds, speciesRows]);

  const toggleSpeciesId = id => {
    if (id === '__other__') {
      setSpeciesModalVisible(false);
      setTimeout(() => setOtherSpeciesModal(true), 150);
      return;
    }

    const num = Number(id);
    if (!Number.isFinite(num) || num <= 0) return;

    setSpeciesIds(prev => {
      const set = new Set((prev || []).map(Number).filter(n => Number.isFinite(n)));
      const next = new Set(set);

      if (next.has(num)) next.delete(num);
      else next.add(num);

      setSpeciesCounts(prevCounts => {
        const copy = { ...(prevCounts || {}) };
        if (next.has(num) && (copy[String(num)] === undefined || copy[String(num)] === null)) {
          copy[String(num)] = '';
        }
        if (!next.has(num)) delete copy[String(num)];
        return copy;
      });

      return Array.from(next);
    });
  };

  // ---------- OTHER SPECIES ADD ----------
  const addOtherSpecies = async () => {
    const name = String(otherSpeciesName || '').trim();
    if (!name) {
      Alert.alert('Missing', 'Please type species name.');
      return;
    }

    try {
      setAddingOtherSpecies(true);
      const token = await getAuthToken();
      if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

      const res = await fetch(ADD_SPECIES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.message || json?.error || `API Error (${res.status})`;
        throw new Error(msg);
      }

      await fetchSpecies();

      setTimeout(() => {
        setSpeciesRows(prev => {
          const found = (prev || []).find(
            x => String(x?.name || '').trim().toLowerCase() === name.toLowerCase(),
          );
          if (found?.id) {
            const sid = Number(found.id);
            setSpeciesIds(p => {
              const set = new Set((p || []).map(Number).filter(Number.isFinite));
              set.add(sid);
              return Array.from(set);
            });
            setSpeciesCounts(pc => ({ ...(pc || {}), [String(sid)]: pc?.[String(sid)] ?? '' }));
          }
          return prev;
        });
      }, 200);

      setOtherSpeciesModal(false);
      setOtherSpeciesName('');
      Alert.alert('Success', 'Species added successfully.');
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Could not add species.');
    } finally {
      setAddingOtherSpecies(false);
    }
  };

  // ---------- GPS ----------
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

  const openAppSettings = () => {
    Alert.alert(
      'Permission Required',
      'Please allow camera permission from Settings to take photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings().catch(() => { });
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

  const fetchAutoGps = (silent = false) => {
    const now = Date.now();
    if (now - lastGpsRequestAtRef.current < 1200) return;
    lastGpsRequestAtRef.current = now;

    setGpsLoading(true);
    Geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        const value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setAutoGps(value);
        fillAutoIntoManual(value);
        setGpsLoading(false);
      },
      err => {
        setGpsLoading(false);
        if (!silent) Alert.alert('Location Error', err.message + '\nEnsure GPS is ON and you are outdoors.');
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 },
    );
  };

  // ---------- IMAGE PICKER ----------
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
    if (uris.length) setPictureUris(uris); // replace behavior
  };

  const pickFromGallery = () => {
    setImagePickerModal(false);
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.7, selectionLimit: 0 },
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
      { mediaType: 'photo', quality: 0.7, saveToPhotos: true, cameraType: 'back' },
      onImagePickerResult,
    );
  };

  const pickImage = () => setImagePickerModal(true);

  // Manual AWS Upload Removed - handled by ApiService


  // ---------- NORMALIZE RECORD + SPECIES AUTO-SELECT ----------
  const normalizeApiRecord = raw => {
    const serverId = raw?.id ?? raw?._id ?? null;

    const autoLat = raw?.auto_lat ?? raw?.autoLat ?? null;
    const autoLng = raw?.auto_long ?? raw?.autoLong ?? null;
    const manualLat = raw?.manual_lat ?? raw?.manualLat ?? null;
    const manualLng = raw?.manual_long ?? raw?.manualLong ?? null;

    const autoGpsLatLong =
      Number.isFinite(Number(autoLat)) && Number.isFinite(Number(autoLng))
        ? `${Number(autoLat).toFixed(6)}, ${Number(autoLng).toFixed(6)}`
        : '';

    const gpsBoundingBox =
      Number.isFinite(Number(manualLat)) && Number.isFinite(Number(manualLng))
        ? [`${Number(manualLat).toFixed(6)}, ${Number(manualLng).toFixed(6)}`]
        : [''];

    const pictures = Array.isArray(raw?.pictures) ? raw.pictures : [];

    // 1) poleCropSpecies snapshot array (latest by audit_no)
    const pcsArr = Array.isArray(raw?.poleCropSpecies) ? raw.poleCropSpecies : [];
    const latestSpeciesFromPCS = pickLatestPoleCropSpeciesPerId(pcsArr);

    const derivedSpeciesIdsPCS = latestSpeciesFromPCS
      .map(x => Number(x?.species_id))
      .filter(n => Number.isFinite(n) && n > 0);

    const derivedCountsPCS = {};
    const derivedNamesMapPCS = {};
    latestSpeciesFromPCS.forEach(x => {
      const sid = Number(x?.species_id);
      if (!Number.isFinite(sid) || sid <= 0) return;
      derivedCountsPCS[String(sid)] = String(x?.count ?? '');
      const nm = String(x?.name || '').trim();
      if (nm) derivedNamesMapPCS[String(sid)] = nm;
    });

    // 2) species array payload (common)
    const speciesArray = Array.isArray(raw?.species) ? raw.species : null;
    const fromSpeciesArray = normalizeSpeciesArrayPayload(speciesArray);

    // 3) legacy single species field (string/number/object)
    const legacySpeciesValue = raw?.species ?? raw?.species_id ?? raw?.speciesId ?? null;
    const legacySpeciesId = asValidId(
      typeof legacySpeciesValue === 'object' ? legacySpeciesValue?.id : legacySpeciesValue,
    );
    const legacySpeciesName =
      typeof legacySpeciesValue === 'string'
        ? legacySpeciesValue
        : typeof legacySpeciesValue === 'object'
          ? legacySpeciesValue?.name
          : raw?.species_name ?? '';

    // Choose best available species source
    let species_ids = derivedSpeciesIdsPCS;
    let species_counts = derivedCountsPCS;
    let species_names_map = derivedNamesMapPCS;

    if (!species_ids.length && fromSpeciesArray.ids.length) {
      species_ids = fromSpeciesArray.ids;
      species_counts = fromSpeciesArray.counts;
      species_names_map = fromSpeciesArray.namesMap;
    }

    if (!species_ids.length) {
      if (legacySpeciesId) {
        species_ids = [Number(legacySpeciesId)];
        species_counts = { [String(legacySpeciesId)]: String(raw?.count ?? '') };
      } else if (String(legacySpeciesName || '').trim()) {
        species_ids = [];
        species_counts = {};
        species_names_map = { '__legacy_name__': String(legacySpeciesName || '').trim() };
      }
    }

    // Total count: prefer PCS, then species array, then raw.count
    const totalCount =
      latestSpeciesFromPCS.length > 0
        ? latestSpeciesFromPCS.reduce((sum, x) => {
          const n = Number(String(x?.count ?? '').replace(/[^\d]/g, ''));
          return sum + (Number.isFinite(n) ? n : 0);
        }, 0)
        : fromSpeciesArray.ids.length > 0
          ? fromSpeciesArray.ids.reduce((sum, sid) => {
            const n = Number(String(fromSpeciesArray.counts[String(sid)] ?? '').replace(/[^\d]/g, ''));
            return sum + (Number.isFinite(n) ? n : 0);
          }, 0)
          : Number(String(raw?.count ?? '').replace(/[^\d]/g, '') || 0);

    const superdari = extractSuperdariInfo(raw);
    const disposal = extractDisposalInfo(raw);

    const numericServerId = Number(serverId);
    const stableId = Number.isFinite(numericServerId) && numericServerId > 0 ? numericServerId : serverId;

    return {
      id: stableId,
      serverId: stableId,

      nameOfSiteId: raw?.nameOfSiteId ?? raw?.name_of_site_id ?? raw?.nameOfSite?.id ?? null,

      rds_from: raw?.rds_from ?? raw?.rdsFrom ?? '',
      rds_to: raw?.rds_to ?? raw?.rdsTo ?? '',

      count: totalCount,

      autoGpsLatLong,
      gpsBoundingBox,

      pictures,
      picturePreview: pictures?.[0] || null,
      pictureUris: [],

      species_ids,
      species_counts,
      species_names_map,

      verification: Array.isArray(raw?.verification) ? raw.verification : [],
      latestStatus: raw?.latestStatus || null,

      createdAt: raw?.created_at || raw?.createdAt || new Date().toISOString(),
      serverRaw: raw,

      hasSuperdari: superdari.hasSuperdari,
      superdariId: superdari.superdariId,
      superdarName: superdari.superdarName,

      isDisposed: disposal.isDisposed,
      disposalId: disposal.disposalId,
      disposedAt: disposal.disposedAt,
    };
  };

  // ---------- FETCH LIST ----------
  const fetchPoleCropList = useCallback(
    async ({ refresh = false } = {}) => {
      try {
        refresh ? setServerRefreshing(true) : setListLoading(true);

        const json = await apiService.get(POLECROP_LIST_URL);

        const rows = normalizeList(json);
        const normalized = rows.map(normalizeApiRecord);

        // Filter server list
        const filteredServer = nameOfSiteId
          ? normalized.filter(x => Number(x?.nameOfSiteId) === Number(nameOfSiteId))
          : normalized;

        // ------------------------------------------------------------------
        // Merge Pending Offline Items (POST to POLECROP_SUBMIT_URL)
        // ------------------------------------------------------------------
        const pendingItems = offlineService.getPendingItems(item => {
          if (item.method !== 'POST') return false;
          if (!item.url.includes('/enum/pole-crop')) return false;

          const b = item.body || {};
          if (nameOfSiteId != null && String(b.nameOfSiteId) !== String(nameOfSiteId)) return false;
          return true;
        });

        const mappedPending = pendingItems.map(item => {
          const b = item.body || {};

          // Map body keys
          // Body: nameOfSiteId, rds_from, rds_to, auto_lat, manual_lat, species_counts (array)

          // Reconstruct species counts map from body.species_counts array
          const species_ids = [];
          const species_counts = {};
          if (Array.isArray(b.species_counts)) {
            b.species_counts.forEach(s => {
              const sid = Number(s.species_id);
              if (sid) {
                species_ids.push(sid);
                species_counts[String(sid)] = String(s.count);
              }
            });
          }

          // Calc total count
          const totalCount = Object.values(species_counts).reduce((acc, val) => acc + (Number(val) || 0), 0);

          return {
            id: `offline_${item.id}`,
            serverId: null,
            isOffline: true,

            nameOfSiteId: b.nameOfSiteId,
            rds_from: b.rds_from,
            rds_to: b.rds_to,
            count: totalCount,

            autoGpsLatLong: (b.auto_lat && b.auto_long) ? `${b.auto_lat}, ${b.auto_long}` : '',
            gpsBoundingBox: (b.manual_lat && b.manual_long) ? [`${b.manual_lat}, ${b.manual_long}`] : [],

            pictures: [],
            picturePreview: null,
            pictureUris: [],

            species_ids,
            species_counts,
            species_names_map: {},

            verification: [],
            latestStatus: { action: 'Pending Sync', user_role: 'You', remarks: 'Saved offline' },

            createdAt: new Date(item.createdAt).toISOString(),
            serverRaw: b,

            hasSuperdari: false,
            superdariId: null,
            superdarName: '',
            isDisposed: false,
            disposalId: null,
            disposedAt: null
          };
        });

        setRecords([...mappedPending, ...filteredServer]);

        console.log('📥 Loaded records:', normalized.length, 'Filtered:', filteredServer.length, 'Pending:', mappedPending.length);
      } catch (e) {
        setRecords([]);
        Alert.alert('Load Failed', e?.message || 'Failed to load records from server.');
      } finally {
        refresh ? setServerRefreshing(false) : setListLoading(false);
      }
    },
    [nameOfSiteId],
  );

  // Subscribe to update
  useEffect(() => {
    const unsub = offlineService.subscribe(() => {
      fetchPoleCropList({ refresh: false });
    });
    return unsub;
  }, [fetchPoleCropList]);

  useFocusEffect(
    useCallback(() => {
      fetchPoleCropList({ refresh: true });
    }, [fetchPoleCropList]),
  );

  // ---------- FORM RESET ----------
  const resetFormForAdd = () => {
    setIsEdit(false);
    setEditingId(null);
    setExistingPictures([]);
    editRecordRef.current = null;

    setRdsFrom('');
    setRdsFrom('');
    setRdsTo('');
    setPageNo('');
    setRegisterNo('');

    setSpeciesIds([]);
    setSpeciesCounts({});

    setAutoGps('');
    setGpsList(['']);
    setPictureUris([]);
  };

  const openAddForm = () => {
    resetFormForAdd();
    setModalVisible(true);
    setTimeout(() => fetchAutoGps(true), 300);
  };

  // resolve species selection reliably when editing
  const resolveSpeciesSelectionForEdit = useCallback(
    record => {
      const ids = Array.isArray(record?.species_ids) ? record.species_ids.map(Number) : [];
      const counts = record?.species_counts || {};
      const namesMap = record?.species_names_map || {};

      if (ids.length) {
        const cleanIds = ids.filter(n => Number.isFinite(n) && n > 0);
        const normCounts = { ...counts };
        cleanIds.forEach(sid => {
          const k = String(sid);
          if (normCounts[k] === undefined || normCounts[k] === null) normCounts[k] = '';
          normCounts[k] = String(normCounts[k]);
        });
        return { ids: cleanIds, counts: normCounts };
      }

      const legacyName = String(namesMap?.['__legacy_name__'] || '').trim();
      if (legacyName) {
        const found = (speciesRows || []).find(
          s => String(s?.name || '').trim().toLowerCase() === legacyName.toLowerCase(),
        );
        if (found?.id) {
          const sid = Number(found.id);
          const c = String(record?.count ?? '');
          return { ids: [sid], counts: { [String(sid)]: c } };
        }
      }

      return { ids: [], counts: {} };
    },
    [speciesRows],
  );

  useEffect(() => {
    if (!modalVisible || !isEdit) return;
    const rec = editRecordRef.current;
    if (!rec) return;

    const namesMap = rec?.species_names_map || {};
    const hasLegacyName = Boolean(String(namesMap?.['__legacy_name__'] || '').trim());

    if (speciesRows?.length > 0 && (speciesIds.length === 0 || hasLegacyName)) {
      const resolved = resolveSpeciesSelectionForEdit(rec);
      if (resolved?.ids?.length) {
        setSpeciesIds(resolved.ids);
        setSpeciesCounts(resolved.counts || {});
      }
    }
  }, [speciesRows, modalVisible, isEdit]);

  const openEditForm = record => {
    if (!isRejectedStatus(record)) {
      Alert.alert('Not Allowed', 'You can edit only when status is Rejected.');
      return;
    }

    editRecordRef.current = record;

    setIsEdit(true);

    const editPoleId = resolvePoleCropId(record, route?.params);
    setEditingId(editPoleId ? String(editPoleId) : null);
    console.log('📝 Editing Pole Crop ID:', editPoleId);

    setRdsFrom(
      record?.rds_from !== null && record?.rds_from !== undefined ? String(record.rds_from) : '',
    );
    setRdsTo(record?.rds_to !== null && record?.rds_to !== undefined ? String(record.rds_to) : '');
    setPageNo(record?.page_no || record?.pageNo || '');
    setRegisterNo(record?.register_no || record?.registerNo || '');

    const serverPics = Array.isArray(record?.pictures) ? record.pictures : [];
    setExistingPictures(serverPics);

    const resolved = resolveSpeciesSelectionForEdit(record);
    setSpeciesIds(resolved.ids);
    setSpeciesCounts(resolved.counts);

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

  // ---------- ACTION NAV ----------
  const openSuperdariForRecord = record => {
    const poleCropId = resolvePoleCropId(record, route?.params);
    console.log('🔵 OPEN SUPERDARI:', {
      recordId: poleCropId,
      screenName: POLECROP_SUPERDARI_SCREEN,
      recordData: record,
      fromParams: route?.params
    });

    if (!poleCropId) {
      Alert.alert('Error', 'PoleCrop ID is missing/invalid.');
      return;
    }

    safeNavigate(POLECROP_SUPERDARI_SCREEN, {
      poleCropId,
      polecropId: poleCropId,
      id: poleCropId,
      nameOfSiteId: Number(nameOfSiteId || record?.nameOfSiteId || 0),
      enumeration,
      record,
      poleCrop: record, // ✅ Fix: Pass as poleCrop for receiving screen
      superdariId: record?.superdariId ?? null,
    });
  };

  const openDisposalForRecord = record => {
    const poleCropId = resolvePoleCropId(record, route?.params);
    console.log('🔵 OPEN DISPOSAL:', {
      recordId: poleCropId,
      screenName: POLECROP_DISPOSAL_SCREEN,
      recordData: record,
      fromParams: route?.params
    });

    if (!poleCropId) {
      Alert.alert('Error', 'PoleCrop ID is missing/invalid.');
      return;
    }

    safeNavigate(POLECROP_DISPOSAL_SCREEN, {
      poleCropId,
      polecropId: poleCropId,
      id: poleCropId,
      nameOfSiteId: Number(nameOfSiteId || record?.nameOfSiteId || 0),
      enumeration,
      record,
      poleCrop: record, // ✅ Fix: Pass as poleCrop for receiving screen
      disposalId: record?.disposalId ?? null,
    });
  };

  const openAuditForRecord = record => {
    const poleCropId = resolvePoleCropId(record, route?.params);
    console.log('🔵 OPEN AUDIT:', {
      recordId: poleCropId,
      screenName: POLECROP_AUDIT_SCREEN,
      recordData: record,
      fromParams: route?.params
    });

    if (!poleCropId) {
      Alert.alert('Error', 'PoleCrop ID is missing/invalid.');
      return;
    }

    safeNavigate(POLECROP_AUDIT_SCREEN, {
      poleCropId,
      polecropId: poleCropId,
      id: poleCropId,
      nameOfSiteId: Number(nameOfSiteId || record?.nameOfSiteId || 0),
      enumeration,
      record,
      poleCrop: record, // ✅ Fix: Pass as poleCrop for receiving screen
    });
  };

  // ---------- SUBMIT / EDIT ----------
  const submitPoleCropToApi = async (body, { isEditMode = false, editId = null } = {}) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Missing Bearer token (AUTH_TOKEN).');

    const url = isEditMode ? POLECROP_EDIT_URL(editId) : POLECROP_SUBMIT_URL;
    const method = isEditMode ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    if (!rdsFrom || !rdsTo) {
      Alert.alert('Missing', 'RDS From and RDS To are required.');
      return;
    }

    if (!nameOfSiteId && !route?.params?.nameOfSiteId && !enumeration) {
      Alert.alert('Error', 'nameOfSiteId missing. Ensure previous screen passes it.');
      return;
    }

    if (!speciesIds.length) {
      Alert.alert('Missing', 'Please select at least 1 species.');
      return;
    }

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
    const { lat: autoLat, lng: autoLng } = parseLatLng(autoGps);

    const lastManual = cleanGps.length ? cleanGps[cleanGps.length - 1] : autoGps;
    const { lat: manualLat, lng: manualLng } = parseLatLng(lastManual || autoGps);

    // Prepare attachments
    const safeFileName = `pole_${Number(nameOfSiteId || 0)}_${Date.now()}`;
    const attachments = pictureUris.map((uri, idx) => ({
      uri,
      type: 'image/jpeg', // Simple assumption, can process ext if needed
      name: `${safeFileName}_${idx}.jpg`,
      uploadUrl: AWS_UPLOAD_URL,
      uploadPath: AWS_UPLOAD_PATH,
      targetFieldInBody: 'pictures'
    }));

    // If Editing and no new pics, keep existing. If new pics, ApiService appends them.
    // However, existingPictures are strings (URLs). apiService attachments result in strings.
    // We need to pass existing URLs in the body too if we want to keep them?
    // Logic: 
    // If we have new pictureUris, user intends to ADD/REPLACE? 
    // The UI says: "Select new images only if you want to replace them" (line 2069 of original)
    // Actually lines 1252-1257 logic says: 
    // const finalPictures = isEdit && (!pictureUris || pictureUris.length === 0) ? existingPictures : uploadedUrls;
    // So if new pics selected, we REPLACE completely.

    // In ApiService, it appends uploaded URLs to `body[field]`.
    // So we should initialize `pictures` in body as empty array if we are replacing.
    // If not replacing (isEdit && empty new), we put existingPictures.

    let initialPictures = [];
    if (isEdit && (!pictureUris || pictureUris.length === 0)) {
      initialPictures = Array.isArray(existingPictures) ? existingPictures : [];
    }
    // If we have new pictureUris, initialPictures is [], and apiService appends new ones.
    // If we do NOT have new pictureUris, attachments is [], initialPictures has existing.

    const speciesPayload = speciesIds.map(sid => ({
      species_id: Number(sid),
      count: Number(String(speciesCounts[String(sid)] || '').replace(/[^\d]/g, '')),
    }));

    const body = {
      nameOfSiteId: Number(nameOfSiteId || route?.params?.nameOfSiteId || 0),

      rds_from: Number(String(rdsFrom).replace(/[^\d.]+/g, '')) || 0,
      rds_to: Number(String(rdsTo).replace(/[^\d.]+/g, '')) || 0,
      page_no: String(pageNo || '').trim(),
      register_no: String(registerNo || '').trim(),

      auto_lat: autoLat,
      auto_long: autoLng,
      manual_lat: manualLat,
      manual_long: manualLng,

      pictures: initialPictures,

      species_counts: speciesPayload,
    };

    try {
      setUploading(true);
      let res;
      if (isEdit) {
        if (!editingId) throw new Error('Edit ID missing.');
        // Use PATCH or PUT
        res = await apiService.patch(POLECROP_EDIT_URL(editingId), body, { attachments });
      } else {
        res = await apiService.post(POLECROP_SUBMIT_URL, body, { attachments });
      }

      setModalVisible(false);
      resetFormForAdd(); // Clear form
      fetchPoleCropList({ refresh: true });

      Alert.alert(
        res.offline ? 'Saved Offline' : 'Success',
        res.message || 'Record saved successfully.'
      );
    } catch (e) {
      Alert.alert('Submit Failed', e?.message || 'Server submit failed.');
    } finally {
      setUploading(false);
    }
  };

  // ---------- FILTER / SEARCH ----------
  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;

    return records.filter(r => {
      const ui = deriveRowUi(r);

      const ids = Array.isArray(r.species_ids) ? r.species_ids : [];
      const counts = r?.species_counts || {};
      const apiNames = r?.species_names_map || {};
      const speciesCountsText = ids
        .map(sid => {
          const master = speciesRows.find(x => Number(x.id) === Number(sid));
          const name = master?.name || apiNames[String(sid)] || `Species ${sid}`;
          const c = counts[String(sid)] ?? '';
          return `${name}:${c}`;
        })
        .join(' ');

      const blob = [
        r.serverId,
        r.rds_from,
        r.rds_to,
        r.count,
        r.autoGpsLatLong,
        Array.isArray(r.gpsBoundingBox) ? r.gpsBoundingBox.join(' | ') : '',
        ui.statusText,
        speciesCountsText,
        r?.hasSuperdari ? `superdari ${r?.superdarName || ''}` : 'no superdari',
        r?.isDisposed ? 'disposed' : 'not disposed',
        'audit',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [records, search, speciesRows]);

  // ---------- RENDER ----------
  const tableColumns = useMemo(
    () => [
      { label: 'ID', width: 80 },
      { label: 'RDS From', width: 110 },
      { label: 'RDS To', width: 110 },
      { label: 'Total Count', width: 120 },
      { label: 'Species Counts', width: 260 },
      { label: 'Auto GPS', width: 200 },
      { label: 'Manual GPS', width: 250 },
      { label: 'Status', width: 220 },
      { label: 'Superdari', width: 150 },
      { label: 'Disposal', width: 150 },
      { label: 'Audit', width: 140 },
      { label: 'Actions', width: 110 },
    ],
    [],
  );

  const speciesRowsWithOther = useMemo(() => {
    return [...(speciesRows || []), { id: '__other__', name: 'Other (Add new species)' }];
  }, [speciesRows]);

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
            <Text style={styles.headerTitle}>Pole Crop</Text>
            {nameOfSiteId ? <Text style={styles.siteId}>Site ID: {nameOfSiteId}</Text> : null}
          </View>

          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => fetchPoleCropList({ refresh: true })}
            activeOpacity={0.7}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- Offline Sync Bar --- */}
      {offlineStatus.count > 0 && (
        <View style={{ backgroundColor: COLORS.background, paddingHorizontal: 20, paddingTop: 10 }}>
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

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={serverRefreshing}
            onRefresh={() => fetchPoleCropList({ refresh: true })}
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
              placeholder="Search by ID, species, status..."
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

        {/* Table */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pole Crop Records</Text>
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
              <Text style={styles.emptyText}>Start by adding pole crop records for this site</Text>
            </View>
          ) : filteredRecords.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={64} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No Results Found</Text>
              <Text style={styles.emptyText}>No records match your search criteria</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableContainer}>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  {tableColumns.map((col, idx) => (
                    <View key={idx} style={[styles.thCell, { width: col.width }]}>
                      <Text style={styles.thText}>{col.label}</Text>
                    </View>
                  ))}
                </View>

                {filteredRecords.map((r, idx) => {
                  const ui = deriveRowUi(r);

                  const gpsText =
                    Array.isArray(r.gpsBoundingBox) && r.gpsBoundingBox.length
                      ? r.gpsBoundingBox.join(' | ')
                      : '';

                  const speciesCountsText = (() => {
                    const ids = Array.isArray(r.species_ids) ? r.species_ids : [];
                    const counts = r?.species_counts || {};
                    const apiNames = r?.species_names_map || {};
                    if (!ids.length) return '—';

                    return ids
                      .map(sid => {
                        const master = speciesRows.find(x => Number(x.id) === Number(sid));
                        const name = master?.name || apiNames[String(sid)] || `Species ${sid}`;
                        const c = counts[String(sid)] ?? '0';
                        return `${name}: ${c}`;
                      })
                      .join('\n');
                  })();

                  const rowStyle = [
                    styles.tableRow,
                    idx % 2 === 0 ? styles.rowEven : styles.rowOdd,
                    ui.rowAccent === 'rejected' ? styles.rowRejected : null,
                  ];

                  return (
                    <View key={String(r.serverId || r.id || idx)} style={rowStyle}>
                      <View style={[styles.tdCell, { width: 80 }]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r.serverId || r.id || '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, { width: 110 }]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r.rds_from ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, { width: 110 }]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r.rds_to ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, { width: 120 }]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {String(r.count ?? '—')}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, { width: 260 }]}>
                        <Text style={styles.multiLineCell} numberOfLines={5}>
                          {speciesCountsText}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, { width: 200 }]}>
                        <Text style={styles.gpsText} numberOfLines={1}>
                          {r.autoGpsLatLong || '—'}
                        </Text>
                      </View>

                      <View style={[styles.tdCell, { width: 250 }]}>
                        <Text style={styles.tdText} numberOfLines={2}>
                          {gpsText || '—'}
                        </Text>
                      </View>

                      {/* Status */}
                      <View style={[styles.tdCell, { width: 220 }]}>
                        <View style={[styles.statusBadge, { backgroundColor: `${ui.statusColor}15` }]}>
                          <View style={[styles.statusDot, { backgroundColor: ui.statusColor }]} />
                          <Text style={[styles.statusText, { color: ui.statusColor }]} numberOfLines={2}>
                            {ui.statusText}
                          </Text>
                        </View>
                      </View>

                      {/* Superdari */}
                      <View style={[styles.tdCell, styles.actionsCell, { width: 150 }]}>
                        {r?.hasSuperdari ? (
                          <Text style={styles.tdText}>—</Text>
                        ) : (
                          <TouchableOpacity
                            style={[
                              styles.actionButton,
                              { backgroundColor: 'rgba(14, 165, 233, 0.10)' },
                            ]}
                            onPress={() => {
                              console.log('📱 Clicked Superdari for record:', r);
                              openSuperdariForRecord(r);
                            }}
                            activeOpacity={0.7}>
                            <Ionicons name="person-circle-outline" size={16} color={COLORS.secondary} />
                            <Text style={[styles.actionButtonText, { color: COLORS.secondary }]}>
                              Add Superdari
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Disposal */}
                      <View style={[styles.tdCell, styles.actionsCell, { width: 150 }]}>
                        {r?.isDisposed ? (
                          <Text style={styles.tdText}>—</Text>
                        ) : (
                          <TouchableOpacity
                            style={[
                              styles.actionButton,
                              { backgroundColor: 'rgba(249, 115, 22, 0.10)' },
                            ]}
                            onPress={() => {
                              console.log('📱 Clicked Disposal for record:', r);
                              openDisposalForRecord(r);
                            }}
                            activeOpacity={0.7}>
                            <Ionicons name="trash-outline" size={16} color={COLORS.warning} />
                            <Text style={[styles.actionButtonText, { color: COLORS.warning }]}>
                              Dispose
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Audit / Update - Only if Final Approved */}
                      <View style={[styles.tdCell, styles.actionsCell, { width: 140 }]}>
                        {ui.isFinalApproved ? (
                          <TouchableOpacity
                            style={[
                              styles.actionButton,
                              { backgroundColor: 'rgba(124, 58, 237, 0.10)' },
                            ]}
                            onPress={() => {
                              console.log('📱 Clicked Update for record:', r);
                              openAuditForRecord(r);
                            }}
                            activeOpacity={0.7}>
                            <Ionicons name="clipboard-outline" size={16} color={COLORS.info} />
                            <Text style={[styles.actionButtonText, { color: COLORS.info }]}>Update</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.tdText}>—</Text>
                        )}
                      </View>

                      {/* Actions (Edit only when rejected) */}
                      <View style={[styles.tdCell, styles.actionsCell, { width: 110 }]}>
                        {ui.showEdit ? (
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                              console.log('📱 Clicked Edit for record:', r);
                              openEditForm(r);
                            }}
                            activeOpacity={0.7}>
                            <Ionicons name="create-outline" size={16} color={COLORS.secondary} />
                            <Text style={styles.actionButtonText}>Edit</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.tdText}>—</Text>
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
        <View style={styles.fabContent}>
          <Ionicons name="add" size={28} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Image Picker Modal */}
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
            <View style={[styles.modalContent, { maxHeight: height * 0.35 }]}>
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

              <View style={{ padding: 20, gap: 12 }}>
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
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Take Photo</Text>
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
                  <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 15 }}>
                    Choose from Gallery
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ paddingVertical: 12, borderRadius: 14, alignItems: 'center' }}
                  onPress={() => setImagePickerModal(false)}
                  activeOpacity={0.8}>
                  <Text style={{ color: COLORS.textLight, fontWeight: '800' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Other Species Modal */}
      <Modal
        transparent
        visible={otherSpeciesModal}
        animationType="fade"
        onRequestClose={() => setOtherSpeciesModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setOtherSpeciesModal(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { maxHeight: height * 0.45 }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons name="leaf" size={24} color={COLORS.primary} />
                  <Text style={styles.modalTitle}>Add New Species</Text>
                </View>
                <TouchableOpacity style={styles.modalClose} onPress={() => setOtherSpeciesModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={{ padding: 20 }}>
                <FormRow
                  label="Species Name"
                  value={otherSpeciesName}
                  onChangeText={setOtherSpeciesName}
                  placeholder="e.g., Poplar"
                  required
                />

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.modalButtonSecondary, { flex: 1 }]}
                    onPress={() => setOtherSpeciesModal(false)}
                    activeOpacity={0.7}>
                    <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalButtonPrimary,
                      { flex: 2, opacity: addingOtherSpecies ? 0.7 : 1 },
                    ]}
                    onPress={addOtherSpecies}
                    disabled={addingOtherSpecies}
                    activeOpacity={0.7}>
                    {addingOtherSpecies ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalButtonPrimaryText}>Add Species</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
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
                    {speciesRowsWithOther.map(row => {
                      const isOther = row.id === '__other__';
                      const checked =
                        !isOther && (speciesIds || []).map(Number).includes(Number(row.id));
                      return (
                        <TouchableOpacity
                          key={String(row.id ?? row.name)}
                          style={styles.speciesItem}
                          onPress={() => toggleSpeciesId(row.id)}
                          activeOpacity={0.7}>
                          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                            {checked && <Ionicons name="checkmark" size={16} color="#fff" />}
                            {isOther && <Ionicons name="add" size={16} color={COLORS.primary} />}
                          </View>
                          <View style={styles.speciesInfo}>
                            <Text style={styles.speciesName}>{row.name}</Text>
                            {!isOther && row.id && <Text style={styles.speciesId}>ID: {row.id}</Text>}
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
                    {isEdit ? 'Edit Pole Crop Record' : 'Add Pole Crop Record'}
                  </Text>
                  {isEdit && editingId && (
                    <Text style={styles.editModalSubtitle}>Record ID: {editingId}</Text>
                  )}
                  {isEdit && Array.isArray(existingPictures) && existingPictures.length > 0 && (
                    <Text style={[styles.editModalSubtitle, { marginTop: 4 }]}>
                      Existing Images: {existingPictures.length}
                      {pictureUris?.length ? ` • New Selected: ${pictureUris.length}` : ''}
                    </Text>
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
                    label="RDS From"
                    value={rdsFrom}
                    onChangeText={setRdsFrom}
                    keyboardType="numeric"
                    required
                    placeholder="e.g. 12.5"
                  />

                  <FormRow
                    label="RDS To"
                    value={rdsTo}
                    onChangeText={setRdsTo}
                    keyboardType="numeric"
                    required
                    placeholder="e.g. 15"
                  />

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <FormRow
                        label="Page No (Optional)"
                        value={pageNo}
                        onChangeText={setPageNo}
                        placeholder="PG-123"
                        icon="document-text"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FormRow
                        label="Register No (Optional)"
                        value={registerNo}
                        onChangeText={setRegisterNo}
                        placeholder="REG-456"
                        icon="book"
                      />
                    </View>
                  </View>

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

                  {/* Per-species counts */}
                  {speciesIds.length > 0 && (
                    <View style={{ marginTop: 6 }}>
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
                        const label = row?.name ? `${row.name} Count` : `Species ${sid} Count`;
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
                            placeholder="e.g. 30"
                            required
                          />
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

                  <Text style={styles.gpsNote}>
                    Auto GPS fetch will also fill the last manual coordinate automatically.
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
                        <Text style={styles.imageUploadSubtitle}>Camera or Gallery</Text>
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

                  {isEdit && pictureUris.length === 0 && existingPictures.length > 0 && (
                    <View
                      style={[
                        styles.imagePreview,
                        {
                          marginTop: 10,
                          backgroundColor: 'rgba(14,165,233,0.08)',
                          borderColor: 'rgba(14,165,233,0.20)',
                        },
                      ]}>
                      <View style={styles.imagePreviewHeader}>
                        <Ionicons name="images-outline" size={16} color={COLORS.secondary} />
                        <Text style={[styles.imagePreviewTitle, { color: COLORS.secondary }]}>
                          Keeping existing images ({existingPictures.length})
                        </Text>
                      </View>
                      <Text style={styles.imagePreviewText} numberOfLines={1}>
                        Select new images only if you want to replace them
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

      <FullScreenLoader visible={offlineStatus.syncing} />
    </View>
  );
}

// Styles (kept aligned to your Afforestation style to avoid UI regressions)
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  contentContainer: { paddingBottom: 100 },

  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  headerContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
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
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 6 },
  siteId: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchSection: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
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

  section: { marginHorizontal: 20, marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  sectionSubtitle: { fontSize: 14, fontWeight: '600', color: COLORS.textLight },

  loadingState: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingText: { fontSize: 14, color: COLORS.textLight, marginTop: 12, fontWeight: '600' },

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
  emptyText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },

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
  tableRow: { flexDirection: 'row', minHeight: 60, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowEven: { backgroundColor: '#fff' },
  rowOdd: { backgroundColor: 'rgba(5, 150, 105, 0.02)' },
  rowRejected: { backgroundColor: 'rgba(239, 68, 68, 0.06)' },
  tdCell: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  tdText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  multiLineCell: { fontSize: 12, fontWeight: '700', color: COLORS.text, lineHeight: 18 },
  gpsText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

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
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flexShrink: 1,
  },

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

  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalContainer: { flex: 1, justifyContent: 'center', padding: 20 },
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
  modalButtonSecondary: {
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonSecondaryText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  modalButtonPrimary: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonPrimaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  speciesList: { maxHeight: 400 },
  speciesItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  speciesInfo: { flex: 1 },
  speciesName: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  speciesId: { fontSize: 12, color: COLORS.textLight, fontWeight: '500' },
  selectedIndicator: { marginLeft: 8 },
  speciesFooter: { padding: 20, borderTopWidth: 1, borderTopColor: COLORS.border },
  speciesCountBadge: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  speciesCountText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  speciesActions: { flexDirection: 'row', gap: 12 },
  speciesActionButton: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  speciesActionButtonText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  speciesActionButtonPrimary: { backgroundColor: COLORS.primary },
  speciesActionButtonPrimaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  editModalOverlay: { flex: 1, backgroundColor: COLORS.overlay },
  editModalContainer: { flex: 1, marginTop: Platform.OS === 'ios' ? 40 : 20 },
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

  formSection: { marginBottom: 24 },
  formSectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  fieldWithButton: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  multiSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 12,
  },
  multiSelectButtonText: { flex: 1, fontSize: 16, fontWeight: '700', color: '#fff' },
  speciesHint: { fontSize: 12, color: COLORS.textLight, marginTop: 4, fontStyle: 'italic' },

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
  gpsCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  gpsFetchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  gpsFetchButtonText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  gpsCardBody: { padding: 16 },
  gpsValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
  },
  gpsLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gpsLoadingText: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },
  gpsNote: { fontSize: 12, color: COLORS.textLight, marginBottom: 16, fontStyle: 'italic' },
  coordinateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  coordinateInputContainer: { flex: 1 },

  imageUploadButton: {
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  imageUploadContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  imageUploadText: { flex: 1 },
  imageUploadTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  imageUploadSubtitle: { fontSize: 12, color: COLORS.textLight },
  imagePreview: {
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.2)',
    borderRadius: 12,
    padding: 12,
  },
  imagePreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  imagePreviewTitle: { fontSize: 14, fontWeight: '700', color: COLORS.success },
  imagePreviewText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  footerButtonSecondary: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 55, 0.05)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  footerButtonSecondaryText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  footerButtonPrimary: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  footerButtonPrimaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});