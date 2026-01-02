// RegistersScreen.js
import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ImageBackground,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Uses SAME token key + API base as your AuthContext
const API_BASE = 'http://be.lte.gisforestry.com';
const STORAGE_TOKEN = 'AUTH_TOKEN';

export default function RegistersScreen({navigation}) {
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tabs: all | pending | verified | disposed | superdari
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
   * - show “more details” from API response
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

      // Keep your existing local/mock dataset for pending/verified etc (until you add those APIs)
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
        return '#f97316';
      case 'verified':
        return '#16a34a';
      case 'disposed':
        return '#0ea5e9';
      case 'superdari':
        return '#7c3aed';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'pending':
        return 'time';
      case 'verified':
        return 'checkmark-done';
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
    const disposed = registers.filter(x => x.status === 'disposed').length;
    const superdari = registers.filter(x => x.status === 'superdari').length;
    return {all, pending, verified, disposed, superdari};
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
        color={isActive ? '#fff' : '#6b7280'}
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

    // default (all/pending/verified)
    return [
      {key: 'registerNo', label: 'Register', width: 120},
      {key: 'pageNo', label: 'Page', width: 80, format: v => (v ? `P-${v}` : '—')},
      {key: 'division', label: 'Division', width: 130},
      {key: 'type', label: 'Type', width: 140},
      {key: 'date', label: 'Date', width: 110},
      {key: 'status', label: 'Status', width: 130, isStatus: true},
    ];
  }, [statusTab]);

  const renderRow = ({item, index}) => {
    const statusColor = getStatusColor(item.status);

    return (
      <TouchableOpacity
        style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}
        onPress={() => {
          // Optional: if you have detail screens later, use item._rawDisposal / item._rawSuperdari
          // if (item.status === 'disposed') navigation.navigate('DisposalDetails', {disposal: item._rawDisposal});
          // if (item.status === 'superdari') navigation.navigate('SuperdariDetails', {superdari: item._rawSuperdari});
        }}
        activeOpacity={0.8}>
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
      </TouchableOpacity>
    );
  };

  /* ===================== RENDER ===================== */
  if (loading) {
    return (
      <View style={styles.screen}>
        <ImageBackground
          source={require('../assets/images/bg.jpg')}
          style={styles.background}
          resizeMode="cover">
          <View style={styles.overlay} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Loading registers...</Text>
          </View>
        </ImageBackground>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={require('../assets/images/bg.jpg')}
        style={styles.background}
        resizeMode="cover">
        <View style={styles.overlay} />

        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Registers</Text>
              <Text style={styles.headerSubtitle}>
                Pending / Verified / Disposed / Superdari (Disposed + Superdari are final)
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

        <View style={styles.content}>
          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#6b7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {(searchQuery || '').length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>

          {/* Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabBar}
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

          {/* Results + Clear */}
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsText}>
              {filteredRegisters.length} item{filteredRegisters.length !== 1 ? 's' : ''} found
            </Text>

            {activeFilterCount > 0 && (
              <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
                <Ionicons name="trash-outline" size={14} color="#fff" />
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Table */}
          <View style={styles.tableCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.tableHeader}>
                  {columns.map(col => (
                    <Text key={col.key} style={[styles.th, {width: col.width}]}>
                      {col.label}
                    </Text>
                  ))}
                </View>

                <FlatList
                  data={filteredRegisters}
                  keyExtractor={item => item.id}
                  renderItem={renderRow}
                  contentContainerStyle={{paddingBottom: 12}}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={['#10b981']}
                      tintColor="#10b981"
                    />
                  }
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <Ionicons name="document" size={44} color="#9ca3af" />
                      <Text style={styles.emptyText}>No records found</Text>
                      <Text style={styles.emptySubtext}>
                        Try changing filters or search keywords.
                      </Text>
                    </View>
                  }
                />
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Advanced Filters Modal */}
        <Modal
          transparent
          visible={filterModalVisible}
          animationType="fade"
          onRequestClose={() => setFilterModalVisible(false)}>
          <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>

          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Advanced Filters</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Division</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{paddingBottom: 6}}>
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

              <Text style={styles.modalLabel}>Type</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{paddingBottom: 6}}>
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

              <Text style={styles.modalLabel}>Register Prefix (optional)</Text>
              <TextInput
                value={filters.registerPrefix}
                onChangeText={t => setFilters(prev => ({...prev, registerPrefix: t}))}
                placeholder="e.g. REG-23"
                placeholderTextColor="#9ca3af"
                style={styles.modalInput}
                autoCapitalize="characters"
              />

              <Text style={styles.modalLabel}>Date Range (YYYY-MM-DD)</Text>
              <View style={styles.twoCol}>
                <TextInput
                  value={filters.dateFrom}
                  onChangeText={t => setFilters(prev => ({...prev, dateFrom: t}))}
                  placeholder="From: 2024-01-01"
                  placeholderTextColor="#9ca3af"
                  style={[styles.modalInput, {flex: 1}]}
                />
                <TextInput
                  value={filters.dateTo}
                  onChangeText={t => setFilters(prev => ({...prev, dateTo: t}))}
                  placeholder="To: 2024-12-31"
                  placeholderTextColor="#9ca3af"
                  style={[styles.modalInput, {flex: 1}]}
                />
              </View>

              <Text style={styles.modalLabel}>Page Range</Text>
              <View style={styles.twoCol}>
                <TextInput
                  value={filters.pageFrom}
                  onChangeText={t => setFilters(prev => ({...prev, pageFrom: t}))}
                  placeholder="From: 1"
                  placeholderTextColor="#9ca3af"
                  style={[styles.modalInput, {flex: 1}]}
                  keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                />
                <TextInput
                  value={filters.pageTo}
                  onChangeText={t => setFilters(prev => ({...prev, pageTo: t}))}
                  placeholder="To: 200"
                  placeholderTextColor="#9ca3af"
                  style={[styles.modalInput, {flex: 1}]}
                  keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                />
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.modalApplyBtn}
                  onPress={() => setFilterModalVisible(false)}>
                  <Text style={styles.modalApplyText}>Apply</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalClearBtn}
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
                  <Text style={styles.modalClearText}>Reset Filters</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#ffffff'},
  background: {flex: 1, width: '100%'},
  overlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16, 185, 129, 0.1)'},

  header: {padding: 20, paddingTop: 50, backgroundColor: 'rgba(16, 185, 129, 0.8)'},
  headerRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  headerTitle: {fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 2},
  headerSubtitle: {fontSize: 12, color: 'rgba(255,255,255,0.92)', fontWeight: '600'},

  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {color: '#fff', fontSize: 11, fontWeight: '900'},

  content: {flex: 1, padding: 16},

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {flex: 1, marginLeft: 10, marginRight: 8, fontSize: 14, color: '#111827'},

  tabBar: {height: 48, maxHeight: 48, marginBottom: 8},
  tabBarContent: {alignItems: 'center', paddingRight: 8, paddingVertical: 6},
  tabPill: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillIdle: {backgroundColor: 'rgba(255,255,255,0.92)', borderColor: '#e5e7eb'},
  tabPillActive: {backgroundColor: '#10b981', borderColor: '#10b981'},
  tabPillText: {fontSize: 13, fontWeight: '800', color: '#6b7280'},
  tabPillTextActive: {color: '#ffffff'},

  resultsHeader: {
    marginBottom: 10,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  clearBtnText: {color: '#fff', fontWeight: '900', fontSize: 12},

  tableCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  th: {paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, fontWeight: '900', color: '#0f172a'},

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 44,
    paddingVertical: 4,
  },
  rowEven: {backgroundColor: '#ffffff'},
  rowOdd: {backgroundColor: 'rgba(2, 132, 199, 0.03)'},
  cell: {paddingHorizontal: 10, fontSize: 12, fontWeight: '700', color: '#111827'},

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {fontSize: 11, fontWeight: '900'},

  loadingContainer: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  loadingText: {
    marginTop: 12,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    marginTop: 20,
  },
  emptyText: {fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 14, marginBottom: 6},
  emptySubtext: {fontSize: 13, color: '#6b7280', textAlign: 'center', fontWeight: '600'},

  modalOverlay: {flex: 1, backgroundColor: 'rgba(15,23,42,0.35)'},
  modalCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '14%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 12,
    maxHeight: '78%',
  },
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6},
  modalTitle: {fontSize: 16, fontWeight: '900', color: '#111827'},
  modalLabel: {fontSize: 12, fontWeight: '900', color: '#111827', marginTop: 12, marginBottom: 6},

  optPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    marginRight: 8,
  },
  optPillActive: {backgroundColor: '#10b981', borderColor: '#10b981'},
  optPillText: {fontSize: 12, fontWeight: '800', color: '#111827'},
  optPillTextActive: {color: '#fff'},

  modalInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  twoCol: {flexDirection: 'row', gap: 10},

  modalActionsRow: {flexDirection: 'row', gap: 10, marginTop: 14},
  modalApplyBtn: {flex: 1, backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 12, alignItems: 'center'},
  modalApplyText: {color: '#fff', fontWeight: '900'},
  modalClearBtn: {flex: 1, backgroundColor: '#f3f4f6', paddingVertical: 12, borderRadius: 12, alignItems: 'center'},
  modalClearText: {color: '#111827', fontWeight: '900'},
});