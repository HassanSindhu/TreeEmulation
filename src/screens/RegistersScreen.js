// src/screens/RegistersScreen.js
// UPDATE ONLY (as you requested):
// 1) Remove "View" button logic from Action.
// 2) In Action column, show ONE button based on row:
//    - If row.status === 'disapproved'  => show "Edit" (for enum tables only)
//    - If row.status === 'disposed'     => show "Dispose" (open disposal detail)
//    - If row.status === 'superdari'    => show "Superdari" (open superdari detail)
//    - Else (pending/verified)          => show "-" (no button)
//
// Your existing code is kept as-is; only Action rendering + route mapping tweak added.

import React, {useEffect, useMemo, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from '../context/AuthContext';

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

const {width} = Dimensions.get('window');

const STORAGE_TOKEN = 'AUTH_TOKEN';
const API_BASE = 'http://be.lte.gisforestry.com';

const ENUMERATION_LIST_URL = `${API_BASE}/enum/enumeration`;
const POLE_CROP_LIST_URL = `${API_BASE}/enum/pole-crop`;
const AFFORESTATION_LIST_URL = `${API_BASE}/enum/afforestation`;

const DISPOSAL_LIST_URL = `${API_BASE}/enum/disposal/user-and-enumeration-wise-disposals`;
const SUPERDARI_LIST_URL = `${API_BASE}/enum/superdari/user-enumeration-wise-superdari`;

export default function RegistersScreen({navigation}) {
  const auth = useAuth();
  const tokenFromCtx = auth?.token;

  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tabs: all | pending | verified | disapproved | disposed | superdari
  const [statusTab, setStatusTab] = useState('all');

  // Search + filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    type: 'all',
    dateFrom: '',
    dateTo: '',
  });

  /* ===================== HELPERS ===================== */
  async function safeJson(res) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  const getToken = async () => {
    const t = tokenFromCtx || (await AsyncStorage.getItem(STORAGE_TOKEN));
    return (t || '').trim();
  };

  const pickFirst = (obj, keys = []) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
  };

  const normalizeDateToISO = val => {
    if (!val) return '';
    const s = String(val);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  const truthy = v => v === true || v === 'true' || v === 1 || v === '1';

  const isValidISODate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim());
  const parseISODate = s => {
    const txt = String(s || '').trim();
    if (!isValidISODate(txt)) return null;
    const d = new Date(txt + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  };

  const apiFetch = async (url, {method = 'GET', body} = {}) => {
    const token = await getToken();
    if (!token) throw new Error('Auth token not found. Please login again.');

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const json = await safeJson(res);

    if (!res.ok) {
      throw new Error(json?.message || `API failed (HTTP ${res.status})`);
    }

    const list = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
      ? json
      : Array.isArray(json?.result)
      ? json.result
      : [];

    return list;
  };

  /* ===================== STATUS NORMALIZATION ===================== */
  const normalizeVerificationStatus = rec => {
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

    if (isVerified) return 'verified';
    if (isRejected) return 'disapproved';

    if (rawStr.includes('approve') || rawStr === 'verified' || rawStr === 'accepted') return 'verified';
    if (rawStr.includes('reject') || rawStr === 'disapproved') return 'disapproved';

    return 'pending';
  };

  /* ===================== MAP LIST ROWS ===================== */
  const mapEnumToRegisterRow = (rec, idx, {typeLabel, tableKey}) => {
    const serverId =
      pickFirst(rec, ['id', '_id', 'enumeration_id', 'enumerationId']) || `${tableKey}_${idx}`;

    const created = normalizeDateToISO(pickFirst(rec, ['created_at', 'createdAt']));
    const updated = normalizeDateToISO(pickFirst(rec, ['updated_at', 'updatedAt']));
    const submitted = normalizeDateToISO(pickFirst(rec, ['date', 'submitted_date', 'submittedDate']));
    const date = submitted || created || updated || '—';

    const status = normalizeVerificationStatus(rec);

    return {
      id: `${tableKey}_${String(serverId)}`,
      status, // pending | verified | disapproved
      type: typeLabel,
      date,

      _raw: rec,
      _table: tableKey,
      _serverId: String(serverId),
    };
  };

  const mapDisposalToRegisterRow = (d, idx) => {
    const serverId = pickFirst(d, ['id', 'disposalId', 'disposal_id', '_id']) || `disp_${idx}`;
    const drDate = normalizeDateToISO(pickFirst(d, ['dr_date', 'drDate'])) || '';
    const created = normalizeDateToISO(pickFirst(d, ['created_at', 'createdAt'])) || '';
    const updated = normalizeDateToISO(pickFirst(d, ['updated_at', 'updatedAt'])) || '';
    const date = drDate || created || updated || '—';

    const peeda = truthy(pickFirst(d, ['peeda_act', 'peedaAct']));
    const auction = truthy(pickFirst(d, ['auction']));
    const pics = pickFirst(d, ['pictures']) || [];
    const picCount = Array.isArray(pics) ? pics.length : 0;

    return {
      id: `disposed_${String(serverId)}`,
      status: 'disposed',
      type: 'Disposal',
      date: date || '—',

      enumerationId: String(pickFirst(d, ['enumerationId', 'enumeration_id']) ?? '—'),
      drNo: String(pickFirst(d, ['dr_no', 'drNo']) ?? '—'),
      drDate: drDate || '—',
      fcNo: String(pickFirst(d, ['fc_no', 'fcNo']) ?? '—'),
      dpcNo: String(pickFirst(d, ['dpc_no', 'dpcNo']) ?? '—'),
      firNo: String(pickFirst(d, ['fir_no', 'firNo']) ?? '—'),
      remarks: String(pickFirst(d, ['remarks']) ?? '—'),
      peedaAct: peeda ? 'YES' : 'NO',
      auction: auction ? 'YES' : 'NO',
      pictureCount: String(picCount),

      _rawDisposal: d,
      _serverId: String(serverId),
      _table: 'enum_disposal',
    };
  };

  const mapSuperdariToRegisterRow = (s, idx) => {
    const serverId = pickFirst(s, ['id', 'superdariId', 'superdari_id', '_id']) || `sup_${idx}`;
    const created = normalizeDateToISO(pickFirst(s, ['created_at', 'createdAt'])) || '';
    const updated = normalizeDateToISO(pickFirst(s, ['updated_at', 'updatedAt'])) || '';
    const date = created || updated || '—';

    const pics = pickFirst(s, ['pictures']) || [];
    const picCount = Array.isArray(pics) ? pics.length : 0;

    return {
      id: `superdari_${String(serverId)}`,
      status: 'superdari',
      type: 'Superdari',
      date: date || '—',

      disposalId: String(pickFirst(s, ['disposalId', 'disposal_id']) ?? '—'),
      enumerationId: String(pickFirst(s, ['enumerationId', 'enumeration_id']) ?? '—'),
      superdarName: String(pickFirst(s, ['superdar_name', 'superdarName']) ?? '—'),
      contactNo: String(pickFirst(s, ['contact_no', 'contactNo']) ?? '—'),
      cnicNo: String(pickFirst(s, ['cnic_no', 'cnicNo']) ?? '—'),
      pictureCount: String(picCount),

      _rawSuperdari: s,
      _serverId: String(serverId),
      _table: 'enum_superdari',
    };
  };

  /* ===================== NAVIGATION: ACTIONS ===================== */
  // Keep your routes, just ensure disposal/superdari have correct "view" target.
  const routeByTable = {
    enum_enumeration: {
      edit: 'MatureTreeRecordScreen',
    },
    enum_pole_crop: {
      edit: 'PoleCropRecordScreen',
    },
    enum_afforestation: {
      edit: 'AfforestationRecordScreen',
    },
    enum_disposal: {
      view: 'DisposalDetailScreen',
    },
    enum_superdari: {
      view: 'SuperdariDetailScreen',
    },
  };

  const goToRow = (row, mode) => {
    const table = row?._table || row?.status;
    const serverId = row?._serverId || row?.id;
    const routes = routeByTable[table];

    if (!routes?.[mode]) {
      Alert.alert(
        'Route Missing',
        `No route configured for ${table} (${mode}). Please update routeByTable in RegistersScreen.`,
      );
      return;
    }

    navigation.navigate(routes[mode], {
      id: serverId,
      table_name: table,
      record: row?._raw || row?._rawDisposal || row?._rawSuperdari || null,
    });
  };

  /* ===================== DATA LOAD ===================== */
  const fetchRegisters = useCallback(async () => {
    try {
      setLoading(true);

      let mature = [];
      let pole = [];
      let aff = [];
      let disposals = [];
      let superdari = [];

      // Mature / Pole / Afforestation
      try {
        mature = await apiFetch(ENUMERATION_LIST_URL, {method: 'GET'});
      } catch {
        mature = await apiFetch(ENUMERATION_LIST_URL, {method: 'POST', body: {}});
      }

      try {
        pole = await apiFetch(POLE_CROP_LIST_URL, {method: 'GET'});
      } catch {
        pole = await apiFetch(POLE_CROP_LIST_URL, {method: 'POST', body: {}});
      }

      try {
        aff = await apiFetch(AFFORESTATION_LIST_URL, {method: 'GET'});
      } catch {
        aff = await apiFetch(AFFORESTATION_LIST_URL, {method: 'POST', body: {}});
      }

      // Disposal + Superdari
      try {
        disposals = await apiFetch(DISPOSAL_LIST_URL, {method: 'POST', body: {}});
      } catch (e) {
        Alert.alert('Warning', e?.message || 'Failed to load disposals');
        disposals = [];
      }

      try {
        superdari = await apiFetch(SUPERDARI_LIST_URL, {method: 'POST', body: {}});
      } catch (e) {
        Alert.alert('Warning', e?.message || 'Failed to load superdari');
        superdari = [];
      }

      const matureRows = (mature || []).map((r, idx) =>
        mapEnumToRegisterRow(r, idx, {typeLabel: 'Mature Tree', tableKey: 'enum_enumeration'}),
      );

      const poleRows = (pole || []).map((r, idx) =>
        mapEnumToRegisterRow(r, idx, {typeLabel: 'Pole Crop', tableKey: 'enum_pole_crop'}),
      );

      const affRows = (aff || []).map((r, idx) =>
        mapEnumToRegisterRow(r, idx, {typeLabel: 'Afforestation', tableKey: 'enum_afforestation'}),
      );

      const disposalRows = (disposals || []).map(mapDisposalToRegisterRow);
      const superdariRows = (superdari || []).map(mapSuperdariToRegisterRow);

      const combined = [...matureRows, ...poleRows, ...affRows, ...disposalRows, ...superdariRows];

      const sortKey = row => {
        const d = parseISODate(row.date);
        return d ? d.getTime() : 0;
      };
      combined.sort((a, b) => sortKey(b) - sortKey(a));

      setRegisters(combined);
    } catch (error) {
      console.error('Error fetching registers:', error);
      Alert.alert('Error', error?.message || 'Failed to load registers');
      setRegisters([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tokenFromCtx]);

  useEffect(() => {
    fetchRegisters();
  }, [fetchRegisters]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRegisters();
  };

  /* ===================== UI HELPERS ===================== */
  const getStatusColor = status => {
    switch (status) {
      case 'pending':
        return COLORS.warning;
      case 'verified':
        return COLORS.success;
      case 'disapproved':
        return COLORS.danger;
      case 'disposed':
        return COLORS.secondary;
      case 'superdari':
        return COLORS.info;
      default:
        return COLORS.textLight;
    }
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'pending':
        return 'time';
      case 'verified':
        return 'checkmark-done';
      case 'disapproved':
        return 'close-circle';
      case 'disposed':
        return 'trash';
      case 'superdari':
        return 'receipt-outline';
      default:
        return 'document';
    }
  };

  /* ===================== FILTER OPTIONS ===================== */
  const typeOptions = useMemo(() => {
    const set = new Set();
    for (const r of registers) {
      if (r?.type && r.type !== '—') set.add(String(r.type));
    }
    return ['all', ...Array.from(set).sort()];
  }, [registers]);

  /* ===================== FILTERING ===================== */
  const tabCounts = useMemo(() => {
    const all = registers.length;
    const pending = registers.filter(x => x.status === 'pending').length;
    const verified = registers.filter(x => x.status === 'verified').length;
    const disapproved = registers.filter(x => x.status === 'disapproved').length;
    const disposed = registers.filter(x => x.status === 'disposed').length;
    const superdari = registers.filter(x => x.status === 'superdari').length;
    return {all, pending, verified, disapproved, disposed, superdari};
  }, [registers]);

  const filteredRegisters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const df = parseISODate(filters.dateFrom);
    const dt = parseISODate(filters.dateTo);

    return registers.filter(item => {
      if (statusTab === 'pending' && item.status !== 'pending') return false;
      if (statusTab === 'verified' && item.status !== 'verified') return false;
      if (statusTab === 'disapproved' && item.status !== 'disapproved') return false;
      if (statusTab === 'disposed' && item.status !== 'disposed') return false;
      if (statusTab === 'superdari' && item.status !== 'superdari') return false;

      if (filters.type !== 'all' && item.type !== filters.type) return false;

      if (df || dt) {
        const itemDate = parseISODate(item.date);
        if (!itemDate) return false;
        if (df && itemDate < df) return false;
        if (dt && itemDate > dt) return false;
      }

      if (!q) return true;

      const blob = [
        item.type,
        item.status,
        item.date,
        item.enumerationId,
        item.drNo,
        item.fcNo,
        item.dpcNo,
        item.firNo,
        item.remarks,
        item.peedaAct,
        item.auction,
        item.disposalId,
        item.superdarName,
        item.contactNo,
        item.cnicNo,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [registers, searchQuery, statusTab, filters]);

  const activeFilterCount = useMemo(() => {
    const adv = Object.values(filters).filter(v => String(v || '').trim() !== '' && v !== 'all').length;
    const s = searchQuery.trim() ? 1 : 0;
    const t = statusTab !== 'all' ? 1 : 0;
    return adv + s + t;
  }, [filters, searchQuery, statusTab]);

  const clearAll = () => {
    setSearchQuery('');
    setStatusTab('all');
    setFilters({
      type: 'all',
      dateFrom: '',
      dateTo: '',
    });
  };

  /* ===================== TABLE COLUMNS ===================== */
  const columns = useMemo(() => {
    if (statusTab === 'disposed') {
      return [
        {key: 'enumerationId', label: 'Enum ID', width: 110},
        {key: 'drNo', label: 'DR No', width: 120},
        {key: 'drDate', label: 'DR Date', width: 110},
        {key: 'fcNo', label: 'FC No', width: 110},
        {key: 'dpcNo', label: 'DPC No', width: 110},
        {key: 'firNo', label: 'FIR No', width: 110},
        {key: 'peedaAct', label: 'PEEDA', width: 90},
        {key: 'auction', label: 'Auction', width: 90},
        {key: 'pictureCount', label: 'Pics', width: 70},
        {key: 'status', label: 'Status', width: 130, isStatus: true},
        {key: 'action', label: 'Action', width: 140, isAction: true},
      ];
    }

    if (statusTab === 'superdari') {
      return [
        {key: 'disposalId', label: 'Disposal ID', width: 120},
        {key: 'enumerationId', label: 'Enum ID', width: 110},
        {key: 'superdarName', label: 'Superdar', width: 160},
        {key: 'contactNo', label: 'Contact', width: 120},
        {key: 'cnicNo', label: 'CNIC', width: 150},
        {key: 'pictureCount', label: 'Pics', width: 70},
        {key: 'status', label: 'Status', width: 130, isStatus: true},
        {key: 'action', label: 'Action', width: 140, isAction: true},
      ];
    }

    return [
      {key: 'type', label: 'Type', width: 170},
      {key: 'date', label: 'Date', width: 120},
      {key: 'status', label: 'Status', width: 140, isStatus: true},
      {key: 'action', label: 'Action', width: 140, isAction: true},
    ];
  }, [statusTab]);

  const tableWidth = useMemo(() => columns.reduce((t, c) => t + c.width, 0), [columns]);

  const TabPill = ({title, icon, isActive, onPress}) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.tabPill, isActive ? styles.tabPillActive : styles.tabPillIdle]}>
      <Ionicons
        name={icon}
        size={14}
        color={isActive ? '#fff' : COLORS.primaryDark}
        style={{marginRight: 6}}
      />
      <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>{title}</Text>
    </TouchableOpacity>
  );

  const renderRow = ({item, index}) => {
    const statusColor = getStatusColor(item.status);

    return (
      <View style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
        {columns.map(col => {
          if (col.isStatus) {
            return (
              <View
                key={col.key}
                style={[
                  styles.statusPill,
                  {width: col.width, borderColor: `${statusColor}55`, backgroundColor: `${statusColor}15`},
                ]}>
                <Ionicons name={getStatusIcon(item.status)} size={14} color={statusColor} />
                <Text style={[styles.statusPillText, {color: statusColor}]}>
                  {String(item.status || '').toUpperCase()}
                </Text>
              </View>
            );
          }

          if (col.isAction) {
            // ✅ NEW LOGIC (no "View" button)
            // Disapproved -> Edit (for enum records only)
            // Disposed -> Dispose
            // Superdari -> Superdari
            // Otherwise -> no action
            const isDisapproved = item.status === 'disapproved';
            const isDisposed = item.status === 'disposed';
            const isSuperdari = item.status === 'superdari';

            const isEnumRow =
              item?._table === 'enum_enumeration' ||
              item?._table === 'enum_pole_crop' ||
              item?._table === 'enum_afforestation';

            let btnLabel = '';
            let btnIcon = '';
            let btnStyle = styles.actionBtnNeutral;
            let onPress = null;

            if (isDisposed) {
              btnLabel = 'Dispose';
              btnIcon = 'trash-outline';
              btnStyle = styles.actionBtnNeutral;
              onPress = () => goToRow(item, 'view'); // opens DisposalDetailScreen
            } else if (isSuperdari) {
              btnLabel = 'Superdari';
              btnIcon = 'receipt-outline';
              btnStyle = styles.actionBtnNeutral;
              onPress = () => goToRow(item, 'view'); // opens SuperdariDetailScreen
            } else if (isDisapproved && isEnumRow) {
              btnLabel = 'Edit';
              btnIcon = 'create-outline';
              btnStyle = styles.actionBtnDanger;
              onPress = () => goToRow(item, 'edit'); // opens edit screen for that table
            }

            if (!onPress) {
              return (
                <View key={col.key} style={[styles.actionCell, {width: col.width}]}>
                  <Text style={{color: COLORS.textLight, fontWeight: '800'}}>—</Text>
                </View>
              );
            }

            return (
              <View key={col.key} style={[styles.actionCell, {width: col.width}]}>
                <TouchableOpacity
                  style={[styles.actionBtn, btnStyle]}
                  onPress={onPress}
                  activeOpacity={0.85}>
                  <Ionicons name={btnIcon} size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>{btnLabel}</Text>
                </TouchableOpacity>
              </View>
            );
          }

          const value = item?.[col.key] ?? '—';
          return (
            <Text key={col.key} style={[styles.cell, {width: col.width}]} numberOfLines={1}>
              {String(value || '—')}
            </Text>
          );
        })}
      </View>
    );
  };

  /* ===================== RENDER ===================== */
  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading registers...</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Registers</Text>
            <View style={styles.headerInfo}>
              <View style={styles.infoChip}>
                <Ionicons name="sync" size={12} color="#fff" />
                <Text style={styles.infoChipText}>Real-time</Text>
              </View>
              <View style={styles.infoChip}>
                <Ionicons name="shield-checkmark" size={12} color="#fff" />
                <Text style={styles.infoChipText}>Verification</Text>
              </View>
            </View>
            <Text style={styles.siteId}>Total Records: {registers.length}</Text>
          </View>

          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setFilterModalVisible(true)}>
            <Ionicons name="options-outline" size={22} color="#ffffff" />
            {activeFilterCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <View style={styles.searchCard}>
            <View style={styles.searchInner}>
              <Ionicons name="search" size={18} color={COLORS.primary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search registers..."
                placeholderTextColor={COLORS.textLight}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {(searchQuery || '').length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                  <Ionicons name="close-circle" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
            <TabPill title={`All (${tabCounts.all})`} icon="apps" isActive={statusTab === 'all'} onPress={() => setStatusTab('all')} />
            <TabPill title={`Pending (${tabCounts.pending})`} icon="time" isActive={statusTab === 'pending'} onPress={() => setStatusTab('pending')} />
            <TabPill title={`Verified (${tabCounts.verified})`} icon="checkmark-done" isActive={statusTab === 'verified'} onPress={() => setStatusTab('verified')} />
            <TabPill title={`Disapproved (${tabCounts.disapproved})`} icon="close-circle" isActive={statusTab === 'disapproved'} onPress={() => setStatusTab('disapproved')} />
            <TabPill title={`Disposed (${tabCounts.disposed})`} icon="trash" isActive={statusTab === 'disposed'} onPress={() => setStatusTab('disposed')} />
            <TabPill title={`Superdari (${tabCounts.superdari})`} icon="receipt-outline" isActive={statusTab === 'superdari'} onPress={() => setStatusTab('superdari')} />
          </ScrollView>
        </View>

        <View style={styles.resultsHeader}>
          <View style={styles.resultsLeft}>
            <Ionicons name="list" size={16} color={COLORS.primary} />
            <Text style={styles.resultsText}>
              {filteredRegisters.length} item{filteredRegisters.length !== 1 ? 's' : ''} found
            </Text>
          </View>

          {activeFilterCount > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
              <Ionicons name="trash-outline" size={14} color="#fff" />
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tableContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScrollContent}>
            <View style={[styles.tableContentWrapper, {width: tableWidth}]}>
              <View style={styles.tableHeader}>
                {columns.map(col => (
                  <View key={col.key} style={[styles.thContainer, {width: col.width}]}>
                    <Text style={styles.th}>{col.label}</Text>
                    {col.key !== 'status' && col.key !== 'action' && <View style={styles.thDivider} />}
                  </View>
                ))}
              </View>

              <FlatList
                data={filteredRegisters}
                keyExtractor={item => item.id}
                renderItem={renderRow}
                contentContainerStyle={styles.tableBodyContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[COLORS.primary]}
                    tintColor={COLORS.primary}
                  />
                }
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIconContainer}>
                      <Ionicons name="document" size={52} color={COLORS.primaryLight} />
                    </View>
                    <Text style={styles.emptyText}>No records found</Text>
                    <Text style={styles.emptySubtext}>Try changing filters or search keywords.</Text>
                    <TouchableOpacity style={styles.emptyActionBtn} onPress={clearAll}>
                      <Text style={styles.emptyActionText}>Reset Filters</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Filters Modal */}
      <Modal
        transparent
        visible={filterModalVisible}
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalContainer}>
          <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>

          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Ionicons name="filter" size={20} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Advanced Filters</Text>
              </View>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.filterSection}>
                <Text style={styles.modalLabel}>Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptions}>
                  {typeOptions.map(opt => {
                    const active = filters.type === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.optPill, active && styles.optPillActive]}
                        onPress={() => setFilters(prev => ({...prev, type: opt}))}>
                        <Text style={[styles.optPillText, active && styles.optPillTextActive]}>
                          {opt === 'all' ? 'All' : opt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.modalLabel}>Date Range</Text>
                <View style={styles.twoCol}>
                  <View style={styles.inputWithLabel}>
                    <Ionicons name="calendar" size={16} color={COLORS.primary} style={styles.inputIcon} />
                    <TextInput
                      value={filters.dateFrom}
                      onChangeText={t => setFilters(prev => ({...prev, dateFrom: t}))}
                      placeholder="From: 2024-01-01"
                      placeholderTextColor={COLORS.textLight}
                      style={[styles.modalInput, styles.modalInputWithIcon]}
                    />
                  </View>
                  <View style={styles.inputWithLabel}>
                    <Ionicons name="calendar" size={16} color={COLORS.primary} style={styles.inputIcon} />
                    <TextInput
                      value={filters.dateTo}
                      onChangeText={t => setFilters(prev => ({...prev, dateTo: t}))}
                      placeholder="To: 2024-12-31"
                      placeholderTextColor={COLORS.textLight}
                      style={[styles.modalInput, styles.modalInputWithIcon]}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.modalResetBtn}
                  onPress={() =>
                    setFilters({
                      type: 'all',
                      dateFrom: '',
                      dateTo: '',
                    })
                  }>
                  <Ionicons name="refresh" size={16} color={COLORS.primary} />
                  <Text style={styles.modalResetText}>Reset</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalApplyBtn} onPress={() => setFilterModalVisible(false)}>
                  <Ionicons name="checkmark" size={18} color="#ffffff" />
                  <Text style={styles.modalApplyText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ===================== STYLES ===================== */
const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: COLORS.background},

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
  headerIconBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  badgeText: {color: '#fff', fontSize: 11, fontWeight: '900'},

  content: {flex: 1, paddingHorizontal: 20, paddingTop: 20},

  searchContainer: {marginBottom: 20},
  searchCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchInput: {flex: 1, marginLeft: 12, marginRight: 8, fontSize: 15, color: COLORS.text, fontWeight: '500'},
  clearSearchBtn: {padding: 4},

  tabsContainer: {
    marginBottom: 16,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tabBarContent: {alignItems: 'center', paddingRight: 4},
  tabPill: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  tabPillIdle: {backgroundColor: COLORS.card, borderColor: COLORS.border},
  tabPillActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  tabPillText: {fontSize: 13, fontWeight: '700', color: COLORS.primaryDark},
  tabPillTextActive: {color: '#ffffff'},

  resultsHeader: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  resultsLeft: {flexDirection: 'row', alignItems: 'center', gap: 8},
  resultsText: {fontSize: 14, color: COLORS.primaryDark, fontWeight: '700'},
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  clearBtnText: {color: '#fff', fontWeight: '700', fontSize: 13},

  tableContainer: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tableScrollContent: {flexGrow: 1},
  tableContentWrapper: {minHeight: 400},

  tableHeader: {
    flexDirection: 'row',
    minHeight: 48,
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  thContainer: {paddingHorizontal: 14, justifyContent: 'center', position: 'relative'},
  th: {fontSize: 12, fontWeight: '800', color: COLORS.primaryDark, textTransform: 'uppercase'},
  thDivider: {position: 'absolute', right: 0, top: 8, bottom: 8, width: 1, backgroundColor: COLORS.border},

  tableBodyContent: {paddingBottom: 16},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: 56,
  },
  rowEven: {backgroundColor: COLORS.card},
  rowOdd: {backgroundColor: 'rgba(5, 150, 105, 0.03)'},
  cell: {
    paddingHorizontal: 14,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    lineHeight: 56,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    height: 36,
  },
  statusPillText: {fontSize: 11, fontWeight: '800'},

  actionCell: {paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center'},
  actionBtn: {
    height: 34,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnNeutral: {backgroundColor: COLORS.primary},
  actionBtnDanger: {backgroundColor: COLORS.danger},
  actionBtnText: {color: '#fff', fontWeight: '800', fontSize: 12},

  loadingContainer: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background},
  loadingCard: {
    backgroundColor: COLORS.card,
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  loadingText: {marginTop: 16, color: COLORS.primaryDark, fontSize: 16, fontWeight: '600'},

  emptyState: {alignItems: 'center', justifyContent: 'center', padding: 60, width: width - 40},
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  emptyText: {fontSize: 18, fontWeight: '700', color: COLORS.primaryDark, marginBottom: 8},
  emptySubtext: {fontSize: 14, color: COLORS.textLight, textAlign: 'center', fontWeight: '500', marginBottom: 24, lineHeight: 20},
  emptyActionBtn: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  emptyActionText: {color: COLORS.primaryDark, fontWeight: '700', fontSize: 14},

  modalContainer: {flex: 1, justifyContent: 'flex-end'},
  modalOverlay: {...StyleSheet.absoluteFillObject, backgroundColor: COLORS.overlay},
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitleContainer: {flexDirection: 'row', alignItems: 'center', gap: 10},
  modalTitle: {fontSize: 18, fontWeight: '700', color: COLORS.text},
  modalCloseBtn: {width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(5, 150, 105, 0.1)', alignItems: 'center', justifyContent: 'center'},
  modalScrollContent: {paddingHorizontal: 20, paddingVertical: 16},
  filterSection: {marginBottom: 20},
  modalLabel: {fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 12, textTransform: 'uppercase'},
  filterOptions: {paddingBottom: 8},
  optPill: {paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, marginRight: 10},
  optPillActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  optPillText: {fontSize: 13, fontWeight: '600', color: COLORS.text},
  optPillTextActive: {color: '#fff'},
  inputWithLabel: {position: 'relative'},
  inputIcon: {position: 'absolute', left: 16, top: '50%', transform: [{translateY: -8}], zIndex: 1},
  modalInput: {backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.text, fontWeight: '500'},
  modalInputWithIcon: {paddingLeft: 44},
  twoCol: {flexDirection: 'row', gap: 12},
  modalActionsRow: {flexDirection: 'row', gap: 12, marginTop: 32, marginBottom: 8},
  modalResetBtn: {flex: 1, backgroundColor: 'rgba(5, 150, 105, 0.1)', paddingVertical: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border},
  modalResetText: {color: COLORS.primary, fontWeight: '700', fontSize: 15},
  modalApplyBtn: {flex: 2, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10},
  modalApplyText: {color: '#fff', fontWeight: '800', fontSize: 15},
});
