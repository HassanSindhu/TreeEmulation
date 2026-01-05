// RegistersScreen.js
import React, {useEffect, useMemo, useState} from 'react';
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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Uses SAME token key + API base as your AuthContext
const API_BASE = 'http://be.lte.gisforestry.com';
const STORAGE_TOKEN = 'AUTH_TOKEN';

const { width } = Dimensions.get('window');

export default function RegistersScreen({navigation}) {
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tabs: all | pending | verified | disapproved | disposed | superdari
  const [statusTab, setStatusTab] = useState('all');

  // Search + Advanced filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    division: 'all',
    type: 'all',
    dateFrom: '',
    dateTo: '',
    pageFrom: '',
    pageTo: '',
    registerPrefix: '',
  });

  const divisionOptions = useMemo(
    () => ['all', 'Lahore', 'Sheikhupura', 'Faisalabad'],
    [],
  );
  const typeOptions = useMemo(
    () => [
      'all',
      'Mature Tree',
      'Disposal',
      'Superdari',
      'Pole Crop',
      'Afforestation',
      'Other',
    ],
    [],
  );

  /* ===================== HELPERS ===================== */
  async function safeJson(res) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  const getToken = async () => {
    const t = await AsyncStorage.getItem(STORAGE_TOKEN);
    return (t || '').trim();
  };

  const normalizeDateToISO = val => {
    if (!val) return '';
    const s = String(val);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  const pickFirst = (obj, keys = []) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
  };

  const truthy = v => v === true || v === 'true' || v === 1 || v === '1';

  /* ===================== API (DISPOSALS) ===================== */
  const DISPOSAL_LIST_URL = `${API_BASE}/enum/disposal/user-and-enumeration-wise-disposals`;

  const fetchDisposals = async () => {
    const token = await getToken();
    if (!token) throw new Error('Auth token not found. Please login again.');

    const res = await fetch(DISPOSAL_LIST_URL, {
      method: 'POST', // ✅ curl uses --data => POST
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}), // ✅ empty body like curl
    });

    const json = await safeJson(res);

    if (!res.ok) {
      throw new Error(json?.message || `Disposal API failed (HTTP ${res.status})`);
    }

    // your response shape: {statusCode, message, data:[...]}
    const list = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
      ? json
      : Array.isArray(json?.result)
      ? json.result
      : [];

    return list;
  };

  /**
   * ✅ Disposed rows:
   * - user asked to REMOVE register/page/division from disposed
   * - show "more details" from API response
   */
  const mapDisposalToRegisterRow = (d, idx) => {
    const serverId =
      pickFirst(d, ['id', 'disposalId', 'disposal_id', '_id']) ||
      `disp_${idx}_${Date.now()}`;

    const drDate =
      normalizeDateToISO(pickFirst(d, ['dr_date', 'drDate'])) || '';
    const created =
      normalizeDateToISO(pickFirst(d, ['created_at', 'createdAt'])) || '';
    const updated =
      normalizeDateToISO(pickFirst(d, ['updated_at', 'updatedAt'])) || '';

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

      // ✅ removed fields (not displayed for disposed)
      registerNo: '—',
      pageNo: '—',
      division: '—',

      // ✅ extra details to show
      enumerationId: String(pickFirst(d, ['enumerationId', 'enumeration_id']) ?? '—'),
      drNo: String(pickFirst(d, ['dr_no', 'drNo']) ?? '—'),
      drDate: drDate || '—',
      fcNo: String(pickFirst(d, ['fc_no', 'fcNo']) ?? '—'),
      dpcNo: String(pickFirst(d, ['dpc_no', 'dpcNo']) ?? '—'),
      dpcDate: normalizeDateToISO(pickFirst(d, ['dpc_date', 'dpcDate'])) || '—',
      firNo: String(pickFirst(d, ['fir_no', 'firNo']) ?? '—'),
      firDate: normalizeDateToISO(pickFirst(d, ['fir_date', 'firDate'])) || '—',
      remarks: String(pickFirst(d, ['remarks']) ?? '—'),
      peedaAct: peeda ? 'YES' : 'NO',
      officer: String(pickFirst(d, ['officer_name']) ?? '—'),
      designation: String(pickFirst(d, ['officer_designation']) ?? '—'),
      actDate: normalizeDateToISO(pickFirst(d, ['act_date'])) || '—',
      auction: auction ? 'YES' : 'NO',
      pictureCount: String(picCount),
      createdAt: created || '—',
      updatedAt: updated || '—',

      _rawDisposal: d,
      _serverId: String(serverId),
    };
  };

  /* ===================== API (SUPERDARI LIST) ===================== */
  const SUPERDARI_LIST_URL = `${API_BASE}/enum/superdari/user-enumeration-wise-superdari`;

  const fetchSuperdariList = async () => {
    const token = await getToken();
    if (!token) throw new Error('Auth token not found. Please login again.');

    const res = await fetch(SUPERDARI_LIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    const json = await safeJson(res);

    if (!res.ok) {
      throw new Error(json?.message || `Superdari list API failed (HTTP ${res.status})`);
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

  const mapSuperdariToRegisterRow = (s, idx) => {
    const serverId =
      pickFirst(s, ['id', 'superdariId', 'superdari_id', '_id']) ||
      `sup_${idx}_${Date.now()}`;

    const created =
      normalizeDateToISO(pickFirst(s, ['created_at', 'createdAt'])) || '';
    const updated =
      normalizeDateToISO(pickFirst(s, ['updated_at', 'updatedAt'])) || '';

    const date = created || updated || '—';

    const autoLat = pickFirst(s, ['auto_lat', 'autoLat']);
    const autoLong = pickFirst(s, ['auto_long', 'autoLong']);
    const manLat = pickFirst(s, ['manual_lat', 'manualLat']);
    const manLong = pickFirst(s, ['manual_long', 'manualLong']);

    const gps =
      manLat != null && manLong != null
        ? `${manLat}, ${manLong}`
        : autoLat != null && autoLong != null
        ? `${autoLat}, ${autoLong}`
        : '—';

    const pics = pickFirst(s, ['pictures']) || [];
    const picCount = Array.isArray(pics) ? pics.length : 0;

    return {
      id: `superdari_${String(serverId)}`,
      status: 'superdari',
      type: 'Superdari',
      date: date || '—',

      // keep placeholders for common filters/UI (not important for superdari table)
      registerNo: '—',
      pageNo: '—',
      division: '—',

      // extra details to show
      disposalId: String(pickFirst(s, ['disposalId', 'disposal_id']) ?? '—'),
      enumerationId: String(pickFirst(s, ['enumerationId', 'enumeration_id']) ?? '—'),
      superdarName: String(pickFirst(s, ['superdar_name', 'superdarName']) ?? '—'),
      contactNo: String(pickFirst(s, ['contact_no', 'contactNo']) ?? '—'),
      cnicNo: String(pickFirst(s, ['cnic_no', 'cnicNo']) ?? '—'),
      treeConditionId: String(pickFirst(s, ['treeConditionId', 'tree_condition_id']) ?? '—'),
      gps: String(gps),
      pictureCount: String(picCount),
      createdAt: created || '—',
      updatedAt: updated || '—',

      _rawSuperdari: s,
      _serverId: String(serverId),
    };
  };

  /* ===================== DATA LOAD ===================== */
  useEffect(() => {
    fetchRegisters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRegisters = async () => {
    try {
      setLoading(true);

      // Keep your existing local/mock dataset for pending/verified/disapproved etc
      const mockData = [
        {
          id: 'reg_1',
          registerNo: 'REG-23-045',
          pageNo: '12',
          status: 'pending',
          date: '2024-01-15',
          division: 'Lahore',
          type: 'Mature Tree',
        },
        {
          id: 'reg_2',
          registerNo: 'REG-23-046',
          pageNo: '15',
          status: 'verified',
          date: '2024-01-14',
          division: 'Sheikhupura',
          type: 'Mature Tree',
        },
        {
          id: 'reg_3',
          registerNo: 'REG-23-047',
          pageNo: '18',
          status: 'disapproved',
          date: '2024-01-13',
          division: 'Faisalabad',
          type: 'Pole Crop',
        },
        {
          id: 'reg_5',
          registerNo: 'REG-23-049',
          pageNo: '25',
          status: 'verified',
          date: '2024-01-11',
          division: 'Sheikhupura',
          type: 'Afforestation',
        },
      ];

      // ✅ Pull disposals + superdari from APIs
      let apiDisposals = [];
      let apiSuperdari = [];

      try {
        apiDisposals = await fetchDisposals();
      } catch (e) {
        Alert.alert('Warning', e?.message || 'Failed to load disposals');
      }

      try {
        apiSuperdari = await fetchSuperdariList();
      } catch (e) {
        Alert.alert('Warning', e?.message || 'Failed to load superdari');
      }

      const disposalRows = (apiDisposals || []).map(mapDisposalToRegisterRow);
      const superdariRows = (apiSuperdari || []).map(mapSuperdariToRegisterRow);

      // Avoid duplicates if mock already has same status/type rows
      const nonFinalMock = mockData.filter(
        x => x.status !== 'disposed' && x.status !== 'superdari',
      );

      // ✅ Combine: final statuses first
      setRegisters([...disposalRows, ...superdariRows, ...nonFinalMock]);
    } catch (error) {
      console.error('Error fetching registers:', error);
      Alert.alert('Error', error?.message || 'Failed to load registers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRegisters();
  };

  /* ===================== UI HELPERS ===================== */
  const getStatusColor = status => {
    switch (status) {
      case 'pending':
        return '#f97316'; // Orange
      case 'verified':
        return '#16a34a'; // Green
      case 'disapproved':
        return '#dc2626'; // Red
      case 'disposed':
        return '#0ea5e9'; // Blue
      case 'superdari':
        return '#7c3aed'; // Purple
      default:
        return '#6b7280'; // Gray
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

  const isValidISODate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim());
  const parseISODate = s => {
    const txt = String(s || '').trim();
    if (!isValidISODate(txt)) return null;
    const d = new Date(txt + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  };
  const extractNumber = v => {
    const m = String(v ?? '').match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  };

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
    const pageFrom = filters.pageFrom !== '' ? Number(filters.pageFrom) : null;
    const pageTo = filters.pageTo !== '' ? Number(filters.pageTo) : null;

    return registers.filter(item => {
      if (statusTab === 'pending' && item.status !== 'pending') return false;
      if (statusTab === 'verified' && item.status !== 'verified') return false;
      if (statusTab === 'disapproved' && item.status !== 'disapproved') return false;
      if (statusTab === 'disposed' && item.status !== 'disposed') return false;
      if (statusTab === 'superdari' && item.status !== 'superdari') return false;

      if (filters.division !== 'all' && item.division !== filters.division) return false;
      if (filters.type !== 'all' && item.type !== filters.type) return false;

      if (filters.registerPrefix.trim()) {
        const pref = filters.registerPrefix.trim().toLowerCase();
        if (!String(item.registerNo || '').toLowerCase().startsWith(pref)) return false;
      }

      if (df || dt) {
        const itemDate = parseISODate(item.date);
        if (!itemDate) return false;
        if (df && itemDate < df) return false;
        if (dt && itemDate > dt) return false;
      }

      if (pageFrom !== null || pageTo !== null) {
        const p = extractNumber(item.pageNo);
        if (p === null) return false;
        if (pageFrom !== null && p < pageFrom) return false;
        if (pageTo !== null && p > pageTo) return false;
      }

      if (!q) return true;

      // ✅ include extra fields in search blob
      const blob = [
        item.registerNo,
        item.pageNo,
        item.division,
        item.type,
        item.status,
        item.date,

        // disposal extras
        item.enumerationId,
        item.drNo,
        item.fcNo,
        item.dpcNo,
        item.firNo,
        item.remarks,
        item.peedaAct,
        item.auction,

        // superdari extras
        item.disposalId,
        item.superdarName,
        item.contactNo,
        item.cnicNo,
        item.treeConditionId,
        item.gps,
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
      division: 'all',
      type: 'all',
      dateFrom: '',
      dateTo: '',
      pageFrom: '',
      pageTo: '',
      registerPrefix: '',
    });
  };

  /* ===================== UI COMPONENTS ===================== */
  const TabPill = ({title, icon, isActive, onPress}) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.tabPill,
        isActive ? styles.tabPillActive : styles.tabPillIdle,
      ]}>
      <Ionicons
        name={icon}
        size={14}
        color={isActive ? '#fff' : '#065f46'}
        style={{marginRight: 6}}
      />
      <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  // ✅ Dynamic table columns by active tab
  const columns = useMemo(() => {
    if (statusTab === 'disposed') {
      return [
        {key: 'enumerationId', label: 'Enum ID', width: 90},
        {key: 'drNo', label: 'DR No', width: 110},
        {key: 'drDate', label: 'DR Date', width: 110},
        {key: 'fcNo', label: 'FC No', width: 110},
        {key: 'dpcNo', label: 'DPC No', width: 110},
        {key: 'firNo', label: 'FIR No', width: 110},
        {key: 'peedaAct', label: 'PEEDA', width: 90},
        {key: 'auction', label: 'Auction', width: 90},
        {key: 'pictureCount', label: 'Pics', width: 70},
        {key: 'createdAt', label: 'Created', width: 110},
        {key: 'status', label: 'Status', width: 130, isStatus: true},
      ];
    }

    if (statusTab === 'superdari') {
      return [
        {key: 'disposalId', label: 'Disposal ID', width: 100},
        {key: 'enumerationId', label: 'Enum ID', width: 90},
        {key: 'superdarName', label: 'Superdar', width: 160},
        {key: 'contactNo', label: 'Contact', width: 120},
        {key: 'cnicNo', label: 'CNIC', width: 150},
        {key: 'treeConditionId', label: 'Cond ID', width: 90},
        {key: 'gps', label: 'GPS', width: 160},
        {key: 'pictureCount', label: 'Pics', width: 70},
        {key: 'createdAt', label: 'Created', width: 110},
        {key: 'status', label: 'Status', width: 130, isStatus: true},
      ];
    }

    // default (all/pending/verified/disapproved)
    return [
      {key: 'registerNo', label: 'Register', width: 120},
      {key: 'pageNo', label: 'Page', width: 80, format: v => (v ? `P-${v}` : '—')},
      {key: 'division', label: 'Division', width: 130},
      {key: 'type', label: 'Type', width: 140},
      {key: 'date', label: 'Date', width: 110},
      {key: 'status', label: 'Status', width: 130, isStatus: true},
    ];
  }, [statusTab]);

  // Calculate total table width
  const tableWidth = useMemo(() => {
    return columns.reduce((total, col) => total + col.width, 0);
  }, [columns]);

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
                  {
                    width: col.width,
                    borderColor: `${statusColor}55`,
                    backgroundColor: `${statusColor}15`,
                  },
                ]}>
                <Ionicons name={getStatusIcon(item.status)} size={14} color={statusColor} />
                <Text style={[styles.statusPillText, {color: statusColor}]}>
                  {String(item.status || '').toUpperCase()}
                </Text>
              </View>
            );
          }

          const raw = item?.[col.key];
          const value = col.format ? col.format(raw) : raw ?? '—';

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
        <View style={styles.loadingContainer}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>Loading registers...</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header with gradient effect */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Registers</Text>
            <Text style={styles.headerSubtitle}>
              Pending / Verified / Disapproved / Disposed / Superdari
            </Text>
          </View>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setFilterModalVisible(true)}>
            <Ionicons name="options-outline" size={22} color="#ffffff" />
            {activeFilterCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Search Bar with glass effect */}
        <View style={styles.searchContainer}>
          <View style={styles.searchCard}>
            <View style={styles.searchInner}>
              <Ionicons name="search" size={18} color="#059669" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search registers by any field..."
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {(searchQuery || '').length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearSearchBtn}>
                  <Ionicons name="close-circle" size={18} color="#dc2626" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Tabs Container */}
        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBarContent}>
            <TabPill
              title={`All (${tabCounts.all})`}
              icon="apps"
              isActive={statusTab === 'all'}
              onPress={() => setStatusTab('all')}
            />
            <TabPill
              title={`Pending (${tabCounts.pending})`}
              icon="time"
              isActive={statusTab === 'pending'}
              onPress={() => setStatusTab('pending')}
            />
            <TabPill
              title={`Verified (${tabCounts.verified})`}
              icon="checkmark-done"
              isActive={statusTab === 'verified'}
              onPress={() => setStatusTab('verified')}
            />
            <TabPill
              title={`Disapproved (${tabCounts.disapproved})`}
              icon="close-circle"
              isActive={statusTab === 'disapproved'}
              onPress={() => setStatusTab('disapproved')}
            />
            <TabPill
              title={`Disposed (${tabCounts.disposed})`}
              icon="trash"
              isActive={statusTab === 'disposed'}
              onPress={() => setStatusTab('disposed')}
            />
            <TabPill
              title={`Superdari (${tabCounts.superdari})`}
              icon="receipt-outline"
              isActive={statusTab === 'superdari'}
              onPress={() => setStatusTab('superdari')}
            />
          </ScrollView>
        </View>

        {/* Results Header */}
        <View style={styles.resultsHeader}>
          <View style={styles.resultsLeft}>
            <Ionicons name="list" size={16} color="#059669" />
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

        {/* Table Container - FIXED: Header and body scroll together in single ScrollView */}
        <View style={styles.tableContainer}>
          {/* Main horizontal ScrollView wrapping both header and body */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={styles.tableScrollContent}>

            {/* Table content wrapper with calculated width */}
            <View style={[styles.tableContentWrapper, { width: tableWidth }]}>

              {/* Table Header */}
              <View style={styles.tableHeader}>
                {columns.map(col => (
                  <View key={col.key} style={[styles.thContainer, {width: col.width}]}>
                    <Text style={styles.th}>{col.label}</Text>
                    {col.key !== 'status' && <View style={styles.thDivider} />}
                  </View>
                ))}
              </View>

              {/* Table Body */}
              <FlatList
                data={filteredRegisters}
                keyExtractor={item => item.id}
                renderItem={renderRow}
                contentContainerStyle={styles.tableBodyContent}
                showsVerticalScrollIndicator={true}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={['#059669']}
                    tintColor="#059669"
                  />
                }
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIconContainer}>
                      <Ionicons name="document" size={52} color="#d1fae5" />
                    </View>
                    <Text style={styles.emptyText}>No records found</Text>
                    <Text style={styles.emptySubtext}>
                      Try changing filters or search keywords.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyActionBtn}
                      onPress={() => {
                        setSearchQuery('');
                        setStatusTab('all');
                        setFilters({
                          division: 'all',
                          type: 'all',
                          dateFrom: '',
                          dateTo: '',
                          pageFrom: '',
                          pageTo: '',
                          registerPrefix: '',
                        });
                      }}>
                      <Text style={styles.emptyActionText}>Reset Filters</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Advanced Filters Modal with glass effect */}
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
                <Ionicons name="filter" size={20} color="#059669" />
                <Text style={styles.modalTitle}>Advanced Filters</Text>
              </View>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}>

              <View style={styles.filterSection}>
                <Text style={styles.modalLabel}>Division</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterOptions}>
                  {divisionOptions.map(opt => {
                    const active = filters.division === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.optPill, active && styles.optPillActive]}
                        onPress={() => setFilters(prev => ({...prev, division: opt}))}>
                        <Text style={[styles.optPillText, active && styles.optPillTextActive]}>
                          {opt === 'all' ? 'All' : opt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.modalLabel}>Type</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterOptions}>
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
                <Text style={styles.modalLabel}>Register Prefix</Text>
                <View style={styles.inputWithLabel}>
                  <Ionicons name="document" size={16} color="#059669" style={styles.inputIcon} />
                  <TextInput
                    value={filters.registerPrefix}
                    onChangeText={t => setFilters(prev => ({...prev, registerPrefix: t}))}
                    placeholder="e.g. REG-23"
                    placeholderTextColor="#9ca3af"
                    style={styles.modalInput}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.modalLabel}>Date Range</Text>
                <View style={styles.twoCol}>
                  <View style={styles.inputWithLabel}>
                    <Ionicons name="calendar" size={16} color="#059669" style={styles.inputIcon} />
                    <TextInput
                      value={filters.dateFrom}
                      onChangeText={t => setFilters(prev => ({...prev, dateFrom: t}))}
                      placeholder="From: 2024-01-01"
                      placeholderTextColor="#9ca3af"
                      style={[styles.modalInput, styles.modalInputWithIcon]}
                    />
                  </View>
                  <View style={styles.inputWithLabel}>
                    <Ionicons name="calendar" size={16} color="#059669" style={styles.inputIcon} />
                    <TextInput
                      value={filters.dateTo}
                      onChangeText={t => setFilters(prev => ({...prev, dateTo: t}))}
                      placeholder="To: 2024-12-31"
                      placeholderTextColor="#9ca3af"
                      style={[styles.modalInput, styles.modalInputWithIcon]}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.modalLabel}>Page Range</Text>
                <View style={styles.twoCol}>
                  <View style={styles.inputWithLabel}>
                    <Ionicons name="document-text" size={16} color="#059669" style={styles.inputIcon} />
                    <TextInput
                      value={filters.pageFrom}
                      onChangeText={t => setFilters(prev => ({...prev, pageFrom: t}))}
                      placeholder="From: 1"
                      placeholderTextColor="#9ca3af"
                      style={[styles.modalInput, styles.modalInputWithIcon]}
                      keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                    />
                  </View>
                  <View style={styles.inputWithLabel}>
                    <Ionicons name="document-text" size={16} color="#059669" style={styles.inputIcon} />
                    <TextInput
                      value={filters.pageTo}
                      onChangeText={t => setFilters(prev => ({...prev, pageTo: t}))}
                      placeholder="To: 200"
                      placeholderTextColor="#9ca3af"
                      style={[styles.modalInput, styles.modalInputWithIcon]}
                      keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.modalResetBtn}
                  onPress={() =>
                    setFilters({
                      division: 'all',
                      type: 'all',
                      dateFrom: '',
                      dateTo: '',
                      pageFrom: '',
                      pageTo: '',
                      registerPrefix: '',
                    })
                  }>
                  <Ionicons name="refresh" size={16} color="#059669" />
                  <Text style={styles.modalResetText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalApplyBtn}
                  onPress={() => setFilterModalVisible(false)}>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },

  // Header with gradient effect
  header: {
    backgroundColor: '#059669',
    paddingTop: 50,
    paddingHorizontal: 0,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  headerIconBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#059669',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },

  // Main Content
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // Search with glass effect
  searchContainer: {
    marginBottom: 20,
  },
  searchCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  clearSearchBtn: {
    padding: 4,
  },

  // Tabs
  tabsContainer: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tabBarContent: {
    alignItems: 'center',
    paddingRight: 4,
  },
  tabPill: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  tabPillIdle: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  tabPillActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065f46',
    letterSpacing: 0.3,
  },
  tabPillTextActive: {
    color: '#ffffff',
  },

  // Results Header
  resultsHeader: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  resultsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultsText: {
    fontSize: 14,
    color: '#065f46',
    fontWeight: '700',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  clearBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  // Table Container
  tableContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },

  // Table Scroll Content
  tableScrollContent: {
    flexGrow: 1,
  },

  // Table Content Wrapper
  tableContentWrapper: {
    minHeight: 400, // Minimum height for empty state
  },

  // Table Header
  tableHeader: {
    flexDirection: 'row',
    minHeight: 48,
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5, 150, 105, 0.1)',
  },
  thContainer: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    position: 'relative',
  },
  th: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065f46',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thDivider: {
    position: 'absolute',
    right: 0,
    top: 8,
    bottom: 8,
    width: 1,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
  },

  // Table Body
  tableBodyContent: {
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5, 150, 105, 0.05)',
    minHeight: 56,
    paddingVertical: 0,
  },
  rowEven: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  rowOdd: {
    backgroundColor: 'rgba(5, 150, 105, 0.03)',
  },
  cell: {
    paddingHorizontal: 14,
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    borderRightWidth: 1,
    borderRightColor: 'rgba(5, 150, 105, 0.05)',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
  },
  loadingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  loadingText: {
    marginTop: 16,
    color: '#065f46',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    width: width - 32,
  },
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
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyActionBtn: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  emptyActionText: {
    color: '#065f46',
    fontWeight: '700',
    fontSize: 14,
  },

  // Modal
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  modalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5, 150, 105, 0.1)',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: 0.3,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  filterOptions: {
    paddingBottom: 8,
  },
  optPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  optPillActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  optPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  optPillTextActive: {
    color: '#fff',
  },
  inputWithLabel: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    top: '50%',
    transform: [{ translateY: -8 }],
    zIndex: 1,
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  modalInputWithIcon: {
    paddingLeft: 44,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 16,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
    marginBottom: 8,
  },
  modalResetBtn: {
    flex: 1,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  modalResetText: {
    color: '#065f46',
    fontWeight: '700',
    fontSize: 15,
  },
  modalApplyBtn: {
    flex: 2,
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalApplyText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.3,
  },
});