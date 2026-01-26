
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  ScrollView,
  TouchableWithoutFeedback,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/ApiService';

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

const { width } = Dimensions.get('window');

const STORAGE_TOKEN = 'AUTH_TOKEN';
const API_BASE = 'http://be.lte.gisforestry.com';

// LIST APIs
const ENUM_LIST_URL = `${API_BASE}/enum/enumeration`;
const AFF_LIST_URL = `${API_BASE}/enum/afforestation`;
const POLECROP_LIST_URL = `${API_BASE}/enum/pole-crop`; // ✅ added

// VERIFY API (same endpoint, different table_name)
const VERIFY_URL = `${API_BASE}/enum/verification`;

// Modules (same)
const MODULES = [
  { key: 'enumeration', label: 'Enumeration' },
  { key: 'polecrop', label: 'PoleCrop' },
  { key: 'afforestation', label: 'Afforestation' },
];

// Roles allowed
const OFFICER_ROLES = ['block_officer', 'sdfo', 'dfo', 'surveyor'];

// Status filters (same options)
const STATUS_FILTERS = ['All', 'Pending', 'Rejected', 'Verified'];

const normalize = v => String(v ?? '').trim();
const normalizeLower = v => normalize(v).toLowerCase();

function getLatestAction(item) {
  return item?.latestStatus?.action ?? null;
}

function isFinalStatus(item) {
  const action = getLatestAction(item);
  return action === 'Verified' || action === 'Rejected';
}

function getSiteName(item) {
  return (
    item?.nameOfSite?.site_name ||
    item?.nameOfSite?.name ||
    item?.site?.site_name ||
    item?.site_name ||
    item?.name_of_site ||
    '-'
  );
}

function getPictures(item) {
  const pics = item?.pictures || item?.images || item?.photos;
  return Array.isArray(pics) ? pics.filter(Boolean) : [];
}

function getDisplayId(item) {
  return item?.id ?? item?.table_id ?? item?.enumerationId ?? '';
}

function matchesSearch(item, q) {
  if (!q) return true;
  const query = normalizeLower(q);

  const idStr = normalizeLower(getDisplayId(item));
  const site = normalizeLower(getSiteName(item));
  const rd = normalizeLower(item?.rd_km);

  return idStr.includes(query) || site.includes(query) || rd.includes(query);
}

function matchesStatus(item, statusFilter) {
  if (!statusFilter || statusFilter === 'All') return true;

  const action = getLatestAction(item); // null | "Rejected" | "Verified" | etc

  if (statusFilter === 'Pending') {
    // Pending: no latest action OR latest action not Verified and not Rejected
    return action === null || (action !== 'Verified' && action !== 'Rejected');
  }
  if (statusFilter === 'Rejected') return action === 'Rejected';
  if (statusFilter === 'Verified') return action === 'Verified';

  return true;
}

function tableNameForModule(moduleKey) {
  if (moduleKey === 'enumeration') return 'enum_enumeration';
  if (moduleKey === 'afforestation') return 'enum_afforestation';
  if (moduleKey === 'polecrop') return 'enum_pole_crop';
  return '';
}

export default function VerificationScreen({ navigation }) {
  const { user } = useAuth();
  const role = useMemo(() => normalizeLower(user?.role), [user]);
  const canUse = OFFICER_ROLES.includes(role);

  const [activeModule, setActiveModule] = useState('enumeration');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Raw data by module
  const [dataByModule, setDataByModule] = useState({
    enumeration: [],
    polecrop: [],
    afforestation: [],
  });

  // Filters (same behaviour)
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Pending'); // default Pending

  // Filter modal (UI like Registers)
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [pendingFilters, setPendingFilters] = useState({
    module: '', // '' means keep current module
    status: '', // '' means keep current status
  });

  // Details modal (view before action)
  const [detailsModal, setDetailsModal] = useState({
    visible: false,
    module: 'enumeration',
    item: null,
    rejectMode: false,
    remarks: '',
    submitting: false,
  });

  const getToken = async () => (await AsyncStorage.getItem(STORAGE_TOKEN)) || '';

  const safeJson = async res => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  const apiGet = async url => {
    const token = await getToken();
    if (!token) throw new Error('Token missing, please login again.');

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.message || `Fetch failed (HTTP ${res.status})`);

    return Array.isArray(json?.data) ? json.data : [];
  };

  /* ------------------------------
     FETCH LISTS
  ------------------------------*/
  const fetchEnumeration = useCallback(async () => {
    const json = await apiService.get(ENUM_LIST_URL);
    return Array.isArray(json?.data) ? json.data : [];
  }, []);
  const fetchAfforestation = useCallback(async () => {
    const json = await apiService.get(AFF_LIST_URL);
    return Array.isArray(json?.data) ? json.data : [];
  }, []);
  const fetchPoleCrop = useCallback(async () => {
    const json = await apiService.get(POLECROP_LIST_URL);
    return Array.isArray(json?.data) ? json.data : [];
  }, []);

  const fetchForModule = useCallback(
    async moduleKey => {
      if (!canUse) return;

      setLoading(true);
      try {
        let list = [];
        if (moduleKey === 'enumeration') list = await fetchEnumeration();
        else if (moduleKey === 'afforestation') list = await fetchAfforestation();
        else if (moduleKey === 'polecrop') list = await fetchPoleCrop();

        setDataByModule(prev => ({ ...prev, [moduleKey]: Array.isArray(list) ? list : [] }));
      } catch (e) {
        Alert.alert('Error', e?.message || 'Unable to load list');
        setDataByModule(prev => ({ ...prev, [moduleKey]: [] }));
      } finally {
        setLoading(false);
      }
    },
    [canUse, fetchEnumeration, fetchAfforestation, fetchPoleCrop],
  );

  useEffect(() => {
    fetchForModule(activeModule);
  }, [activeModule, fetchForModule]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchForModule(activeModule);
    } finally {
      setRefreshing(false);
    }
  }, [activeModule, fetchForModule]);

  /* ------------------------------
     VERIFY ACTION
  ------------------------------*/
  const postVerification = useCallback(async ({ module, tableId, action, remarks }) => {
    const table_name = tableNameForModule(module);
    if (!table_name) throw new Error('This module verification is not configured yet.');

    const json = await apiService.post(VERIFY_URL, {
      table_name,
      table_id: Number(tableId),
      action, // "Verified" | "Rejected"
      remarks: remarks || '',
    });
    return json;
  }, []);

  const openDetails = useCallback((moduleKey, item) => {
    setDetailsModal({
      visible: true,
      module: moduleKey,
      item,
      rejectMode: false,
      remarks: '',
      submitting: false,
    });
  }, []);

  const closeDetails = useCallback(() => {
    setDetailsModal({
      visible: false,
      module: 'enumeration',
      item: null,
      rejectMode: false,
      remarks: '',
      submitting: false,
    });
  }, []);

  const approveFromDetails = useCallback(async () => {
    const item = detailsModal.item;
    if (!item) return;

    // ✅ do not change anything if already Approved/Rejected
    if (isFinalStatus(item)) {
      Alert.alert('Info', 'This record is already Approved/Rejected.');
      return;
    }

    try {
      setDetailsModal(s => ({ ...s, submitting: true }));
      await postVerification({
        module: detailsModal.module,
        tableId: item.id,
        action: 'Verified',
        remarks: '',
      });
      Alert.alert('Success', 'Approved successfully');
      closeDetails();
      fetchForModule(activeModule);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Approve failed');
      setDetailsModal(s => ({ ...s, submitting: false }));
    }
  }, [detailsModal, postVerification, closeDetails, fetchForModule, activeModule]);

  const rejectFromDetails = useCallback(async () => {
    const item = detailsModal.item;
    if (!item) return;

    // ✅ do not change anything if already Approved/Rejected
    if (isFinalStatus(item)) {
      Alert.alert('Info', 'This record is already Approved/Rejected.');
      return;
    }

    const r = normalize(detailsModal.remarks);
    if (!r) {
      Alert.alert('Remarks required', 'Reject کرنے کے لیے remarks لازمی ہیں۔');
      return;
    }

    try {
      setDetailsModal(s => ({ ...s, submitting: true }));
      await postVerification({
        module: detailsModal.module,
        tableId: item.id,
        action: 'Rejected',
        remarks: r,
      });
      Alert.alert('Done', 'Rejected successfully');
      closeDetails();
      fetchForModule(activeModule);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Reject failed');
      setDetailsModal(s => ({ ...s, submitting: false }));
    }
  }, [detailsModal, postVerification, closeDetails, fetchForModule, activeModule]);

  /* ------------------------------
     FILTERED LIST + COUNTS (for pills)
  ------------------------------*/
  const rawList = dataByModule[activeModule] || [];

  const filteredList = useMemo(() => {
    return rawList
      .filter(item => matchesSearch(item, search))
      .filter(item => matchesStatus(item, statusFilter));
  }, [rawList, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const all = rawList.length;
    let pending = 0;
    let verified = 0;
    let rejected = 0;

    for (const it of rawList) {
      const a = getLatestAction(it);
      if (a === 'Verified') verified += 1;
      else if (a === 'Rejected') rejected += 1;
      else pending += 1;
    }

    return { all, pending, verified, rejected };
  }, [rawList]);

  const activeFilterCount = useMemo(() => {
    const s = search.trim() ? 1 : 0;
    const st = statusFilter !== 'All' ? 1 : 0;
    // module is always set via tabs; no extra count for that
    return s + st;
  }, [search, statusFilter]);

  /* ------------------------------
     UI HELPERS
  ------------------------------*/
  const titleForRole = useMemo(() => {
    const map = {
      'block-officer': 'Block Officer Verification',
      sdfo: 'SDFO Verification',
      dfo: 'DFO Verification',
      surveyor: 'Surveyor Verification',
    };
    return map[role] || 'Verification';
  }, [role]);

  const statusColor = useCallback(actionOrPending => {
    if (actionOrPending === 'Verified') return COLORS.success;
    if (actionOrPending === 'Rejected') return COLORS.danger;
    return COLORS.warning; // Pending
  }, []);

  const statusIcon = useCallback(actionOrPending => {
    if (actionOrPending === 'Verified') return 'checkmark-done';
    if (actionOrPending === 'Rejected') return 'close-circle';
    return 'time';
  }, []);

  const TabPill = ({ title, icon, isActive, onPress }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.tabPill, isActive ? styles.tabPillActive : styles.tabPillIdle]}>
      <Ionicons
        name={icon}
        size={14}
        color={isActive ? '#fff' : COLORS.primaryDark}
        style={{ marginRight: 6 }}
      />
      <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>{title}</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    const id = getDisplayId(item);
    const site = getSiteName(item);
    const action = getLatestAction(item); // null/Rejected/Verified...
    const rd = item?.rd_km ?? '-';
    const condition = item?.condition?.name || item?.condition_name || '-';

    const badgeText = action ? action : 'Pending';
    const badgeC = statusColor(action || 'Pending');
    const badgeI = statusIcon(action || 'Pending');

    const final = isFinalStatus(item);

    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => openDetails(activeModule, item)}>
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>#{id} • {site}</Text>
              <Text style={styles.cardSub}>RD (km): {String(rd)}</Text>
              <Text style={styles.cardSub}>Condition: {condition}</Text>
            </View>

            <View
              style={[
                styles.statusPillMini,
                { borderColor: `${badgeC}55`, backgroundColor: `${badgeC}15` },
              ]}>
              <Ionicons name={badgeI} size={14} color={badgeC} />
              <Text style={[styles.statusPillMiniText, { color: badgeC }]}>
                {String(badgeText).toUpperCase()}
              </Text>
            </View>
          </View>

          {!!item?.latestStatus?.remarks && (
            <Text style={styles.remarkLine} numberOfLines={2}>
              Remarks: {String(item.latestStatus.remarks)}
            </Text>
          )}

          <Text style={styles.tapHint}>
            {final ? 'Already decided (read-only)' : 'Tap to view details'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (!canUse) {
    return (
      <View style={styles.screen}>
        <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingCard}>
            <Ionicons name="lock-closed" size={28} color={COLORS.textLight} />
            <Text style={[styles.loadingText, { marginTop: 10 }]}>Not allowed</Text>
            <Text style={{ marginTop: 6, color: COLORS.textLight, textAlign: 'center', fontWeight: '700' }}>
              یہ screen صرف officers کے لیے ہے۔
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const detailsItem = detailsModal.item;
  const detailsPics = detailsItem ? getPictures(detailsItem) : [];
  const detailsAction = detailsItem ? getLatestAction(detailsItem) : null;
  const detailsFinal = detailsItem ? isFinalStatus(detailsItem) : false;

  // Filter modal handlers (UI like Registers)
  const openFilterModal = () => {
    setPendingFilters({
      module: activeModule,
      status: statusFilter,
    });
    setFilterModalVisible(true);
  };

  const applyFilters = () => {
    // module + status apply
    if (pendingFilters.module && pendingFilters.module !== activeModule) {
      setActiveModule(pendingFilters.module);
    }
    if (pendingFilters.status) {
      setStatusFilter(pendingFilters.status);
    }
    setFilterModalVisible(false);
  };

  const resetFilters = () => {
    setPendingFilters({ module: activeModule, status: 'All' });
  };

  const clearAll = () => {
    setSearch('');
    setStatusFilter('All');
  };

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header (Registers-like) */}
      <View style={styles.header}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => (navigation?.goBack ? navigation.goBack() : null)}
            activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{titleForRole}</Text>
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
            <Text style={styles.siteId}>Total Records: {rawList.length}</Text>
          </View>

          <TouchableOpacity style={styles.headerIconBtn} onPress={openFilterModal} activeOpacity={0.75}>
            <Ionicons name="options-outline" size={22} color="#ffffff" />
            {activeFilterCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Search (Registers-like card) */}
        <View style={styles.searchContainer}>
          <View style={styles.searchCard}>
            <View style={styles.searchInner}>
              <Ionicons name="search" size={18} color={COLORS.primary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search: ID / Site / RD"
                placeholderTextColor={COLORS.textLight}
                value={search}
                onChangeText={setSearch}
              />
              {(search || '').length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearchBtn}>
                  <Ionicons name="close-circle" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Module Tabs (Registers-like pills) */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
            {MODULES.map(m => (
              <TabPill
                key={m.key}
                title={m.label}
                icon={m.key === 'enumeration' ? 'leaf' : m.key === 'polecrop' ? 'analytics' : 'flower'}
                isActive={activeModule === m.key}
                onPress={() => setActiveModule(m.key)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Status Tabs (Registers-like pills with counts) */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
            <TabPill
              title={`All (${statusCounts.all})`}
              icon="apps"
              isActive={statusFilter === 'All'}
              onPress={() => setStatusFilter('All')}
            />
            <TabPill
              title={`Pending (${statusCounts.pending})`}
              icon="time"
              isActive={statusFilter === 'Pending'}
              onPress={() => setStatusFilter('Pending')}
            />
            <TabPill
              title={`Verified (${statusCounts.verified})`}
              icon="checkmark-done"
              isActive={statusFilter === 'Verified'}
              onPress={() => setStatusFilter('Verified')}
            />
            <TabPill
              title={`Rejected (${statusCounts.rejected})`}
              icon="close-circle"
              isActive={statusFilter === 'Rejected'}
              onPress={() => setStatusFilter('Rejected')}
            />
          </ScrollView>
        </View>

        {/* Results header (Registers-like) */}
        <View style={styles.resultsHeader}>
          <View style={styles.resultsLeft}>
            <Ionicons name="list" size={16} color={COLORS.primary} />
            <Text style={styles.resultsText}>
              {filteredList.length} item{filteredList.length !== 1 ? 's' : ''} found
            </Text>
          </View>

          {(search.trim() || statusFilter !== 'All') && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearAll} activeOpacity={0.85}>
              <Ionicons name="trash-outline" size={14} color="#fff" />
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.loadingContainerInline}>
            <View style={styles.loadingCardInline}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingTextInline}>Loading…</Text>
            </View>
          </View>
        ) : (
          <View style={styles.listContainer}>
            <FlatList
              data={filteredList}
              keyExtractor={(item, idx) => String(item?.id ?? idx)}
              renderItem={renderItem}
              contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
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
                  <TouchableOpacity style={styles.emptyActionBtn} onPress={clearAll} activeOpacity={0.85}>
                    <Text style={styles.emptyActionText}>Reset Filters</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </View>
        )}
      </View>

      {/* Filters Modal (Registers-like) */}
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
                <Text style={styles.modalTitle}>Filters</Text>
              </View>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.filterSection}>
                <Text style={styles.modalLabel}>Module</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptions}>
                  {MODULES.map(m => {
                    const active = pendingFilters.module === m.key;
                    return (
                      <TouchableOpacity
                        key={m.key}
                        style={[styles.optPill, active && styles.optPillActive]}
                        onPress={() => setPendingFilters(prev => ({ ...prev, module: m.key }))}
                        activeOpacity={0.85}>
                        <Text style={[styles.optPillText, active && styles.optPillTextActive]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.modalLabel}>Status</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptions}>
                  {STATUS_FILTERS.map(s => {
                    const active = pendingFilters.status === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.optPill, active && styles.optPillActive]}
                        onPress={() => setPendingFilters(prev => ({ ...prev, status: s }))}
                        activeOpacity={0.85}>
                        <Text style={[styles.optPillText, active && styles.optPillTextActive]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity style={styles.modalResetBtn} onPress={resetFilters} activeOpacity={0.85}>
                  <Ionicons name="refresh" size={16} color={COLORS.primary} />
                  <Text style={styles.modalResetText}>Reset</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalApplyBtn} onPress={applyFilters} activeOpacity={0.85}>
                  <Ionicons name="checkmark" size={18} color="#ffffff" />
                  <Text style={styles.modalApplyText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DETAILS MODAL (kept same logic, UI slightly refined) */}
      <Modal transparent visible={detailsModal.visible} animationType="fade">
        <View style={styles.detailsOverlay}>
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>
                Details • {detailsModal.module === 'enumeration'
                  ? 'Enumeration'
                  : detailsModal.module === 'afforestation'
                    ? 'Afforestation'
                    : 'PoleCrop'}
              </Text>
              <TouchableOpacity onPress={closeDetails} disabled={detailsModal.submitting} activeOpacity={0.75}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {!detailsItem ? (
              <View style={{ padding: 16 }}>
                <Text style={{ color: COLORS.textLight }}>No details</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingBottom: 10 }}>
                {/* Basic Fields */}
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>ID</Text>
                  <Text style={styles.kvVal}>{String(detailsItem.id)}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Site</Text>
                  <Text style={styles.kvVal}>{getSiteName(detailsItem)}</Text>
                </View>

                {'rd_km' in detailsItem && (
                  <View style={styles.kvRow}>
                    <Text style={styles.kvKey}>RD (km)</Text>
                    <Text style={styles.kvVal}>{String(detailsItem.rd_km ?? '-')}</Text>
                  </View>
                )}

                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Condition</Text>
                  <Text style={styles.kvVal}>{detailsItem?.condition?.name || '-'}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Latest Status</Text>
                  <Text style={styles.kvVal}>{detailsAction ? String(detailsAction) : 'Pending'}</Text>
                </View>

                {!!detailsItem?.latestStatus?.remarks && (
                  <View style={styles.kvBlock}>
                    <Text style={styles.kvKey}>Latest Remarks</Text>
                    <Text style={[styles.kvVal, { textAlign: 'left', maxWidth: '100%' }]}>
                      {String(detailsItem.latestStatus.remarks)}
                    </Text>
                  </View>
                )}

                {/* Images */}
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.sectionTitle}>Pictures</Text>

                  {detailsPics.length === 0 ? (
                    <Text style={styles.emptyTextSmall}>No pictures</Text>
                  ) : (
                    <FlatList
                      data={detailsPics}
                      keyExtractor={(u, idx) => `${idx}-${u}`}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 10, paddingVertical: 8 }}
                      renderItem={({ item: url }) => (
                        <View style={styles.imageWrap}>
                          <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
                        </View>
                      )}
                    />
                  )}
                </View>

                {/* Verification History */}
                {Array.isArray(detailsItem?.verification) && detailsItem.verification.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.sectionTitle}>Verification History</Text>
                    {detailsItem.verification.slice(0, 5).map((v, idx) => (
                      <View key={idx} style={styles.historyRow}>
                        <Text style={styles.historyLine}>
                          {v.action} • {v.user_role} • {v.designation}
                        </Text>
                        {!!v.remarks && <Text style={styles.historyRemark}>Remarks: {v.remarks}</Text>}
                      </View>
                    ))}
                  </View>
                )}

                {/* Reject Mode input */}
                {detailsModal.rejectMode && !detailsFinal && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.sectionTitle}>Rejection Remarks (Required)</Text>
                    <TextInput
                      value={detailsModal.remarks}
                      onChangeText={t => setDetailsModal(s => ({ ...s, remarks: t }))}
                      placeholder="Enter remarks…"
                      placeholderTextColor={COLORS.textLight}
                      style={styles.remarksInput}
                      multiline
                    />
                  </View>
                )}

                {/* Final status info */}
                {detailsFinal && (
                  <View style={styles.finalInfo}>
                    <Ionicons name="information-circle" size={18} color={COLORS.textLight} />
                    <Text style={styles.finalInfoText}>
                      This record is already {detailsAction}. No changes allowed.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* Actions */}
            <View style={styles.detailsActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn, detailsFinal && { opacity: 0.45 }]}
                onPress={approveFromDetails}
                disabled={detailsModal.submitting || !detailsItem || detailsFinal}
                activeOpacity={0.85}>
                {detailsModal.submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </>
                )}
              </TouchableOpacity>

              {!detailsModal.rejectMode ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn, detailsFinal && { opacity: 0.45 }]}
                  onPress={() => setDetailsModal(s => ({ ...s, rejectMode: true }))}
                  disabled={detailsModal.submitting || !detailsItem || detailsFinal}
                  activeOpacity={0.85}>
                  <Ionicons name="close-circle" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn, detailsFinal && { opacity: 0.45 }]}
                  onPress={rejectFromDetails}
                  disabled={detailsModal.submitting || !detailsItem || detailsFinal}
                  activeOpacity={0.85}>
                  {detailsModal.submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="close-circle" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Confirm Reject</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {detailsModal.rejectMode && !detailsFinal && (
              <TouchableOpacity
                onPress={() => setDetailsModal(s => ({ ...s, rejectMode: false, remarks: '' }))}
                style={styles.rejectCancelLink}
                disabled={detailsModal.submitting}
                activeOpacity={0.85}>
                <Text style={styles.rejectCancelText}>Cancel Rejection</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ===================== STYLES (Registers-like) ===================== */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },

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
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8, letterSpacing: 0.2 },
  headerInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  infoChipText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  siteId: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3 },
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
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },

  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },

  searchContainer: { marginBottom: 16 },
  searchCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
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
  searchInput: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  clearSearchBtn: { padding: 4 },

  tabsContainer: {
    marginBottom: 12,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tabBarContent: { alignItems: 'center', paddingRight: 4 },
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
  tabPillIdle: { backgroundColor: COLORS.card, borderColor: COLORS.border },
  tabPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabPillText: { fontSize: 13, fontWeight: '700', color: COLORS.primaryDark },
  tabPillTextActive: { color: '#ffffff' },

  resultsHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  resultsLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultsText: { fontSize: 14, color: COLORS.primaryDark, fontWeight: '700' },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  clearBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  listContainer: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  cardSub: { marginTop: 2, fontSize: 12, color: COLORS.textLight },
  remarkLine: { marginTop: 8, fontSize: 12, color: '#374151', fontWeight: '700' },
  tapHint: { marginTop: 8, fontSize: 11, color: '#9ca3af', fontWeight: '800' },

  statusPillMini: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    height: 36,
  },
  statusPillMiniText: { fontSize: 11, fontWeight: '900' },

  // Loading / empty
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  loadingCard: {
    backgroundColor: COLORS.card,
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  loadingText: { marginTop: 16, color: COLORS.primaryDark, fontSize: 16, fontWeight: '700' },

  loadingContainerInline: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30 },
  loadingCardInline: {
    backgroundColor: COLORS.card,
    padding: 24,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingTextInline: { marginTop: 12, color: COLORS.primaryDark, fontSize: 14, fontWeight: '700' },

  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 60, width: width - 40 },
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
  emptyText: { fontSize: 18, fontWeight: '800', color: COLORS.primaryDark, marginBottom: 8 },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    fontWeight: '600',
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
  emptyActionText: { color: COLORS.primaryDark, fontWeight: '800', fontSize: 14 },

  // Filter modal (Registers-like)
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.overlay },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollContent: { paddingHorizontal: 20, paddingVertical: 16 },
  filterSection: { marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 12, textTransform: 'uppercase' },
  filterOptions: { paddingBottom: 8 },
  optPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    marginRight: 10,
  },
  optPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optPillText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  optPillTextActive: { color: '#fff' },
  modalActionsRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 8 },
  modalResetBtn: {
    flex: 1,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalResetText: { color: COLORS.primary, fontWeight: '800', fontSize: 15 },
  modalApplyBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  modalApplyText: { color: '#fff', fontWeight: '900', fontSize: 15 },

  // Details modal
  detailsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  detailsCard: {
    width: '100%',
    maxWidth: 650,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailsTitle: { fontSize: 16, fontWeight: '900', color: COLORS.text },

  kvRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 8,
  },
  kvBlock: {
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 8,
  },
  kvKey: { fontSize: 12, fontWeight: '900', color: COLORS.textLight },
  kvVal: { fontSize: 12, fontWeight: '800', color: COLORS.text, maxWidth: '70%', textAlign: 'right' },

  sectionTitle: { marginTop: 8, fontSize: 13, fontWeight: '900', color: COLORS.text },
  emptyTextSmall: { marginTop: 6, fontSize: 12, color: COLORS.textLight, fontWeight: '700' },

  imageWrap: {
    width: 160,
    height: 110,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#f3f4f6',
  },
  image: { width: '100%', height: '100%' },
  historyRow: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyLine: { fontSize: 12, fontWeight: '800', color: COLORS.text },
  historyRemark: { marginTop: 4, fontSize: 12, color: '#374151', fontWeight: '700' },

  remarksInput: {
    marginTop: 8,
    minHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    color: COLORS.text,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },

  finalInfo: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  finalInfoText: { fontSize: 12, color: COLORS.textLight, fontWeight: '800', flex: 1 },

  detailsActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  approveBtn: { backgroundColor: COLORS.primary },
  rejectBtn: { backgroundColor: COLORS.danger },
  actionBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },

  rejectCancelLink: { marginTop: 10, alignItems: 'center', paddingVertical: 6 },
  rejectCancelText: { fontSize: 12, fontWeight: '900', color: COLORS.text },
});














// /src/screens/VerificationScreen.js
// Stage-based visibility:
// - SDFO sees only records that reached SDFO stage (Block Officer Verified) OR acted by SDFO OR beyond SDFO.
// - DFO sees only records that reached DFO stage (SDFO Verified) OR acted by DFO OR beyond DFO.
// - Pending tab = "Pending for MY action" (inbox style)
// - Rejected tab = "Rejected by ME"
// - Verified tab = "Verified by ME" (optionally includes Final Verified if you want; currently by ME only)

//import React, {useCallback, useEffect, useMemo, useState} from 'react';
//import {
//  View,
//  Text,
//  StyleSheet,
//  FlatList,
//  TouchableOpacity,
//  Modal,
//  TextInput,
//  Alert,
//  ActivityIndicator,
//  RefreshControl,
//  Image,
//  ScrollView,
//  TouchableWithoutFeedback,
//  Platform,
//  StatusBar,
//  Dimensions,
//} from 'react-native';
//import Ionicons from 'react-native-vector-icons/Ionicons';
//import AsyncStorage from '@react-native-async-storage/async-storage';
//import {useAuth} from '../context/AuthContext';
//
//const COLORS = {
//  primary: '#059669',
//  primaryLight: '#10b981',
//  primaryDark: '#047857',
//  secondary: '#0ea5e9',
//  success: '#16a34a',
//  warning: '#f97316',
//  danger: '#dc2626',
//  info: '#7c3aed',
//  background: '#f8fafc',
//  card: '#ffffff',
//  text: '#1f2937',
//  textLight: '#6b7280',
//  border: '#e5e7eb',
//  overlay: 'rgba(15, 23, 42, 0.7)',
//};
//
//const {width} = Dimensions.get('window');
//
//const STORAGE_TOKEN = 'AUTH_TOKEN';
//const API_BASE = 'http://be.lte.gisforestry.com';
//
//// LIST APIs
//const ENUM_LIST_URL = `${API_BASE}/enum/enumeration`;
//const AFF_LIST_URL = `${API_BASE}/enum/afforestation`;
//const POLECROP_LIST_URL = `${API_BASE}/enum/pole-crop`;
//
//// VERIFY API
//const VERIFY_URL = `${API_BASE}/enum/verification`;
//
//// Modules
//const MODULES = [
//  {key: 'enumeration', label: 'Enumeration'},
//  {key: 'polecrop', label: 'PoleCrop'},
//  {key: 'afforestation', label: 'Afforestation'},
//];
//
//// Roles allowed
//const OFFICER_ROLES = ['block-officer', 'sdfo', 'dfo', 'surveyor'];
//
//// Tabs in UI
//const STATUS_FILTERS = ['All', 'Pending', 'Rejected', 'Verified'];
//
///* ===================== HELPERS ===================== */
//const normalize = v => String(v ?? '').trim();
//const normalizeLower = v => normalize(v).toLowerCase();
//
//function getLatestAction(item) {
//  return item?.latestStatus?.action ?? null;
//}
//function isFinalStatus(item) {
//  const action = getLatestAction(item);
//  return action === 'Verified' || action === 'Rejected';
//}
//
//function getSiteName(item) {
//  return (
//    item?.nameOfSite?.site_name ||
//    item?.nameOfSite?.name ||
//    item?.site?.site_name ||
//    item?.site_name ||
//    item?.name_of_site ||
//    '-'
//  );
//}
//
//function getPictures(item) {
//  const pics = item?.pictures || item?.images || item?.photos;
//  return Array.isArray(pics) ? pics.filter(Boolean) : [];
//}
//
//function getDisplayId(item) {
//  return item?.id ?? item?.table_id ?? item?.enumerationId ?? '';
//}
//
//function matchesSearch(item, q) {
//  if (!q) return true;
//  const query = normalizeLower(q);
//
//  const idStr = normalizeLower(getDisplayId(item));
//  const site = normalizeLower(getSiteName(item));
//  const rd = normalizeLower(item?.rd_km);
//
//  return idStr.includes(query) || site.includes(query) || rd.includes(query);
//}
//
//function tableNameForModule(moduleKey) {
//  if (moduleKey === 'enumeration') return 'enum_enumeration';
//  if (moduleKey === 'afforestation') return 'enum_afforestation';
//  if (moduleKey === 'polecrop') return 'enum_pole_crop';
//  return '';
//}
//
///**
// * Convert user_role text from API into slug used in login roles.
// * Examples from API:
// * - "Block Officer" -> "block-officer"
// * - "Beat Officer"  -> "beat-officer"
// * - "SDFO" -> "sdfo"
// * - "DFO" -> "dfo"
// * - "Surveyor" -> "surveyor"
// */
//function roleTextToSlug(roleText) {
//  const t = normalizeLower(roleText);
//  if (!t) return '';
//
//  // direct known values
//  if (t === 'sdfo') return 'sdfo';
//  if (t === 'dfo') return 'dfo';
//  if (t === 'surveyor') return 'surveyor';
//  if (t === 'admin') return 'admin';
//  if (t === 'viewer') return 'viewer';
//
//  if (t.includes('block') && t.includes('officer')) return 'block-officer';
//  if (t.includes('beat') && t.includes('officer')) return 'beat-officer';
//
//  // fallback: collapse spaces to hyphens
//  return t.replace(/\s+/g, '-');
//}
//
///**
// * Approval chain:
// * beat-officer -> block-officer -> sdfo -> dfo -> surveyor
// */
//const ROLE_RANK = {
//  'beat-officer': 1,
//  'block-officer': 2,
//  sdfo: 3,
//  dfo: 4,
//  surveyor: 5,
//};
//
//const NEXT_ROLE = {
//  'beat-officer': 'block-officer',
//  'block-officer': 'sdfo',
//  sdfo: 'dfo',
//  dfo: 'surveyor',
//  surveyor: null,
//};
//
///**
// * Who should act next on this record?
// * - No latestStatus => first approver is Block Officer
// * - Rejected => goes back to Beat Officer (for edit/resubmit)
// * - Verified by X => next is NEXT_ROLE[X]
// */
//function getNextApproverSlug(item) {
//  const ls = item?.latestStatus;
//  if (!ls) return 'block-officer';
//
//  const action = normalize(ls.action);
//  const whoSlug = roleTextToSlug(ls.user_role);
//
//  if (action === 'Rejected') return 'beat-officer';
//  if (action === 'Verified') return NEXT_ROLE[whoSlug] ?? null;
//
//  // unknown action => treat as pending for next in chain if possible
//  return NEXT_ROLE[whoSlug] ?? 'block-officer';
//}
//
///**
// * Inbox for current role:
// * record is pending for me iff next approver equals my role.
// */
//function shouldBeInMyInbox(item, myRoleSlug) {
//  const next = getNextApproverSlug(item);
//  return next === myRoleSlug;
//}
//
///**
// * Stage visibility:
// * - Officer sees record only if it reached their stage (meaning the "next approver" is them or after them),
// *   OR officer already acted on it,
// *   OR record has progressed beyond them.
// *
// * Additionally:
// * - For Rejected items: only Beat Officer + the rejecting officer should see (because next approver becomes beat-officer).
// *   The rule below already enforces that, because for upper roles nextRank < myRank, so not reached.
// */
//function hasReachedRoleStage(item, myRoleSlug) {
//  const myRank = ROLE_RANK[myRoleSlug] || 0;
//  if (!myRank) return false;
//
//  const next = getNextApproverSlug(item);
//  const nextRank = next ? (ROLE_RANK[next] || 0) : 99; // completed => very high
//  const reachedByNext = nextRank >= myRank;
//
//  const latestRoleSlug = roleTextToSlug(item?.latestStatus?.user_role);
//  const latestIsMe = latestRoleSlug === myRoleSlug;
//
//  const beyondMe = (ROLE_RANK[latestRoleSlug] || 0) >= myRank;
//
//  return reachedByNext || latestIsMe || beyondMe;
//}
//
///**
// * Status tab behavior (role aware):
// * - All: all visible-by-stage items
// * - Pending: only items pending for MY action (inbox)
// * - Rejected: only items rejected BY ME
// * - Verified: only items verified BY ME
// */
//function matchesStatus(item, statusFilter, myRoleSlug) {
//  if (!statusFilter || statusFilter === 'All') return true;
//
//  if (statusFilter === 'Pending') {
//    return shouldBeInMyInbox(item, myRoleSlug);
//  }
//
//  const ls = item?.latestStatus;
//  const action = ls?.action ?? null;
//  const latestBy = roleTextToSlug(ls?.user_role);
//
//  if (statusFilter === 'Rejected') return action === 'Rejected' && latestBy === myRoleSlug;
//  if (statusFilter === 'Verified') return action === 'Verified' && latestBy === myRoleSlug;
//
//  return true;
//}
//
//export default function VerificationScreen({navigation}) {
//  const {user} = useAuth();
//
//  // NOTE: In your AuthContext you normalize role as string (from array etc.)
//  // Here we normalize to lowercase slug.
//  const role = useMemo(() => normalizeLower(user?.role), [user]);
//  const canUse = OFFICER_ROLES.includes(role);
//
//  const [activeModule, setActiveModule] = useState('enumeration');
//  const [loading, setLoading] = useState(false);
//  const [refreshing, setRefreshing] = useState(false);
//
//  const [dataByModule, setDataByModule] = useState({
//    enumeration: [],
//    polecrop: [],
//    afforestation: [],
//  });
//
//  const [search, setSearch] = useState('');
//  const [statusFilter, setStatusFilter] = useState('Pending'); // default inbox
//
//  const [filterModalVisible, setFilterModalVisible] = useState(false);
//  const [pendingFilters, setPendingFilters] = useState({
//    module: '',
//    status: '',
//  });
//
//  const [detailsModal, setDetailsModal] = useState({
//    visible: false,
//    module: 'enumeration',
//    item: null,
//    rejectMode: false,
//    remarks: '',
//    submitting: false,
//  });
//
//  const getToken = async () => (await AsyncStorage.getItem(STORAGE_TOKEN)) || '';
//
//  const safeJson = async res => {
//    try {
//      return await res.json();
//    } catch {
//      return null;
//    }
//  };
//
//  const apiGet = async url => {
//    const token = await getToken();
//    if (!token) throw new Error('Token missing, please login again.');
//
//    const res = await fetch(url, {headers: {Authorization: `Bearer ${token}`}});
//    const json = await safeJson(res);
//
//    if (!res.ok) throw new Error(json?.message || `Fetch failed (HTTP ${res.status})`);
//    return Array.isArray(json?.data) ? json.data : [];
//  };
//
//  /* ------------------------------
//     FETCH LISTS
//  ------------------------------*/
//  const fetchEnumeration = useCallback(async () => apiGet(ENUM_LIST_URL), []);
//  const fetchAfforestation = useCallback(async () => apiGet(AFF_LIST_URL), []);
//  const fetchPoleCrop = useCallback(async () => apiGet(POLECROP_LIST_URL), []);
//
//  const fetchForModule = useCallback(
//    async moduleKey => {
//      if (!canUse) return;
//
//      setLoading(true);
//      try {
//        let list = [];
//        if (moduleKey === 'enumeration') list = await fetchEnumeration();
//        else if (moduleKey === 'afforestation') list = await fetchAfforestation();
//        else if (moduleKey === 'polecrop') list = await fetchPoleCrop();
//
//        setDataByModule(prev => ({...prev, [moduleKey]: Array.isArray(list) ? list : []}));
//      } catch (e) {
//        Alert.alert('Error', e?.message || 'Unable to load list');
//        setDataByModule(prev => ({...prev, [moduleKey]: []}));
//      } finally {
//        setLoading(false);
//      }
//    },
//    [canUse, fetchEnumeration, fetchAfforestation, fetchPoleCrop],
//  );
//
//  useEffect(() => {
//    fetchForModule(activeModule);
//  }, [activeModule, fetchForModule]);
//
//  const onRefresh = useCallback(async () => {
//    setRefreshing(true);
//    try {
//      await fetchForModule(activeModule);
//    } finally {
//      setRefreshing(false);
//    }
//  }, [activeModule, fetchForModule]);
//
//  /* ------------------------------
//     VERIFY ACTION
//  ------------------------------*/
//  const postVerification = useCallback(async ({module, tableId, action, remarks}) => {
//    const token = await getToken();
//    if (!token) throw new Error('Token missing, please login again.');
//
//    const table_name = tableNameForModule(module);
//    if (!table_name) throw new Error('This module verification is not configured yet.');
//
//    const res = await fetch(VERIFY_URL, {
//      method: 'POST',
//      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
//      body: JSON.stringify({
//        table_name,
//        table_id: Number(tableId),
//        action, // "Verified" | "Rejected"
//        remarks: remarks || '',
//      }),
//    });
//
//    const json = await safeJson(res);
//    if (!res.ok) throw new Error(json?.message || `Verification failed (HTTP ${res.status})`);
//    return json;
//  }, []);
//
//  const openDetails = useCallback((moduleKey, item) => {
//    setDetailsModal({
//      visible: true,
//      module: moduleKey,
//      item,
//      rejectMode: false,
//      remarks: '',
//      submitting: false,
//    });
//  }, []);
//
//  const closeDetails = useCallback(() => {
//    setDetailsModal({
//      visible: false,
//      module: 'enumeration',
//      item: null,
//      rejectMode: false,
//      remarks: '',
//      submitting: false,
//    });
//  }, []);
//
//  const approveFromDetails = useCallback(async () => {
//    const item = detailsModal.item;
//    if (!item) return;
//
//    // Do not allow action if record is final OR not in my inbox
//    if (isFinalStatus(item)) {
//      Alert.alert('Info', 'This record is already Approved/Rejected.');
//      return;
//    }
//    if (!shouldBeInMyInbox(item, role)) {
//      Alert.alert('Info', 'This record is not pending for your action.');
//      return;
//    }
//
//    try {
//      setDetailsModal(s => ({...s, submitting: true}));
//      await postVerification({
//        module: detailsModal.module,
//        tableId: item.id,
//        action: 'Verified',
//        remarks: '',
//      });
//      Alert.alert('Success', 'Approved successfully');
//      closeDetails();
//      fetchForModule(activeModule);
//    } catch (e) {
//      Alert.alert('Error', e?.message || 'Approve failed');
//      setDetailsModal(s => ({...s, submitting: false}));
//    }
//  }, [detailsModal, postVerification, closeDetails, fetchForModule, activeModule, role]);
//
//  const rejectFromDetails = useCallback(async () => {
//    const item = detailsModal.item;
//    if (!item) return;
//
//    if (isFinalStatus(item)) {
//      Alert.alert('Info', 'This record is already Approved/Rejected.');
//      return;
//    }
//    if (!shouldBeInMyInbox(item, role)) {
//      Alert.alert('Info', 'This record is not pending for your action.');
//      return;
//    }
//
//    const r = normalize(detailsModal.remarks);
//    if (!r) {
//      Alert.alert('Remarks required', 'Reject کرنے کے لیے remarks لازمی ہیں۔');
//      return;
//    }
//
//    try {
//      setDetailsModal(s => ({...s, submitting: true}));
//      await postVerification({
//        module: detailsModal.module,
//        tableId: item.id,
//        action: 'Rejected',
//        remarks: r,
//      });
//      Alert.alert('Done', 'Rejected successfully');
//      closeDetails();
//      fetchForModule(activeModule);
//    } catch (e) {
//      Alert.alert('Error', e?.message || 'Reject failed');
//      setDetailsModal(s => ({...s, submitting: false}));
//    }
//  }, [detailsModal, postVerification, closeDetails, fetchForModule, activeModule, role]);
//
//  /* ------------------------------
//     FILTERED LIST + COUNTS (stage-based)
//  ------------------------------*/
//  const rawList = dataByModule[activeModule] || [];
//
//  const stageVisibleList = useMemo(() => {
//    // Only officers use this screen; still keep defensive filter
//    return rawList.filter(item => hasReachedRoleStage(item, role));
//  }, [rawList, role]);
//
//  const filteredList = useMemo(() => {
//    return stageVisibleList
//      .filter(item => matchesSearch(item, search))
//      .filter(item => matchesStatus(item, statusFilter, role));
//  }, [stageVisibleList, search, statusFilter, role]);
//
//  const statusCounts = useMemo(() => {
//    const all = stageVisibleList.length;
//    let pendingForMe = 0;
//    let verifiedByMe = 0;
//    let rejectedByMe = 0;
//
//    for (const it of stageVisibleList) {
//      if (shouldBeInMyInbox(it, role)) pendingForMe += 1;
//
//      const ls = it?.latestStatus;
//      const action = ls?.action ?? null;
//      const by = roleTextToSlug(ls?.user_role);
//
//      if (action === 'Verified' && by === role) verifiedByMe += 1;
//      if (action === 'Rejected' && by === role) rejectedByMe += 1;
//    }
//
//    return {all, pendingForMe, verifiedByMe, rejectedByMe};
//  }, [stageVisibleList, role]);
//
//  const activeFilterCount = useMemo(() => {
//    const s = search.trim() ? 1 : 0;
//    const st = statusFilter !== 'All' ? 1 : 0;
//    return s + st;
//  }, [search, statusFilter]);
//
//  /* ------------------------------
//     UI HELPERS
//  ------------------------------*/
//  const titleForRole = useMemo(() => {
//    const map = {
//      'block-officer': 'Block Officer Verification',
//      sdfo: 'SDFO Verification',
//      dfo: 'DFO Verification',
//      surveyor: 'Surveyor Verification',
//    };
//    return map[role] || 'Verification';
//  }, [role]);
//
//  const statusColor = useCallback(actionOrPending => {
//    if (actionOrPending === 'Verified') return COLORS.success;
//    if (actionOrPending === 'Rejected') return COLORS.danger;
//    return COLORS.warning;
//  }, []);
//
//  const statusIcon = useCallback(actionOrPending => {
//    if (actionOrPending === 'Verified') return 'checkmark-done';
//    if (actionOrPending === 'Rejected') return 'close-circle';
//    return 'time';
//  }, []);
//
//  const TabPill = ({title, icon, isActive, onPress}) => (
//    <TouchableOpacity
//      activeOpacity={0.85}
//      onPress={onPress}
//      style={[styles.tabPill, isActive ? styles.tabPillActive : styles.tabPillIdle]}>
//      <Ionicons name={icon} size={14} color={isActive ? '#fff' : COLORS.primaryDark} style={{marginRight: 6}} />
//      <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>{title}</Text>
//    </TouchableOpacity>
//  );
//
//  const renderItem = ({item}) => {
//    const id = getDisplayId(item);
//    const site = getSiteName(item);
//    const action = getLatestAction(item);
//    const rd = item?.rd_km ?? '-';
//    const condition = item?.condition?.name || item?.condition_name || '-';
//
//    // For visual badge: show current "inbox pending" if pending for me, else show latest action/pending
//    const pendingForMe = shouldBeInMyInbox(item, role);
//    const badgeText = action ? action : pendingForMe ? 'Pending (For You)' : 'Pending';
//    const badgeKey = action ? action : 'Pending';
//    const badgeC = statusColor(badgeKey);
//    const badgeI = statusIcon(badgeKey);
//
//    const final = isFinalStatus(item);
//
//    return (
//      <TouchableOpacity activeOpacity={0.85} onPress={() => openDetails(activeModule, item)}>
//        <View style={styles.card}>
//          <View style={styles.cardTop}>
//            <View style={{flex: 1}}>
//              <Text style={styles.cardTitle}>
//                #{id} • {site}
//              </Text>
//              <Text style={styles.cardSub}>RD (km): {String(rd)}</Text>
//              <Text style={styles.cardSub}>Condition: {condition}</Text>
//            </View>
//
//            <View style={[styles.statusPillMini, {borderColor: `${badgeC}55`, backgroundColor: `${badgeC}15`}]}>
//              <Ionicons name={badgeI} size={14} color={badgeC} />
//              <Text style={[styles.statusPillMiniText, {color: badgeC}]}>{String(badgeText).toUpperCase()}</Text>
//            </View>
//          </View>
//
//          {!!item?.latestStatus?.remarks && (
//            <Text style={styles.remarkLine} numberOfLines={2}>
//              Remarks: {String(item.latestStatus.remarks)}
//            </Text>
//          )}
//
//          <Text style={styles.tapHint}>{final ? 'Already decided (read-only)' : 'Tap to view details'}</Text>
//        </View>
//      </TouchableOpacity>
//    );
//  };
//
//  if (!canUse) {
//    return (
//      <View style={styles.screen}>
//        <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
//        <View style={styles.loadingContainer}>
//          <View style={styles.loadingCard}>
//            <Ionicons name="lock-closed" size={28} color={COLORS.textLight} />
//            <Text style={[styles.loadingText, {marginTop: 10}]}>Not allowed</Text>
//            <Text style={{marginTop: 6, color: COLORS.textLight, textAlign: 'center', fontWeight: '700'}}>
//              یہ screen صرف officers کے لیے ہے۔
//            </Text>
//          </View>
//        </View>
//      </View>
//    );
//  }
//
//  const detailsItem = detailsModal.item;
//  const detailsPics = detailsItem ? getPictures(detailsItem) : [];
//  const detailsAction = detailsItem ? getLatestAction(detailsItem) : null;
//  const detailsFinal = detailsItem ? isFinalStatus(detailsItem) : false;
//  const detailsPendingForMe = detailsItem ? shouldBeInMyInbox(detailsItem, role) : false;
//
//  // Filter modal handlers
//  const openFilterModal = () => {
//    setPendingFilters({module: activeModule, status: statusFilter});
//    setFilterModalVisible(true);
//  };
//
//  const applyFilters = () => {
//    if (pendingFilters.module && pendingFilters.module !== activeModule) {
//      setActiveModule(pendingFilters.module);
//    }
//    if (pendingFilters.status) setStatusFilter(pendingFilters.status);
//    setFilterModalVisible(false);
//  };
//
//  const resetFilters = () => {
//    setPendingFilters({module: activeModule, status: 'All'});
//  };
//
//  const clearAll = () => {
//    setSearch('');
//    setStatusFilter('All');
//  };
//
//  return (
//    <View style={styles.screen}>
//      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
//
//      {/* Header */}
//      <View style={styles.header}>
//        <View style={styles.headerContainer}>
//          <TouchableOpacity
//            style={styles.backButton}
//            onPress={() => (navigation?.goBack ? navigation.goBack() : null)}
//            activeOpacity={0.7}>
//            <Ionicons name="arrow-back" size={24} color="#fff" />
//          </TouchableOpacity>
//
//          <View style={styles.headerContent}>
//            <Text style={styles.headerTitle}>{titleForRole}</Text>
//            <View style={styles.headerInfo}>
//              <View style={styles.infoChip}>
//                <Ionicons name="sync" size={12} color="#fff" />
//                <Text style={styles.infoChipText}>Real-time</Text>
//              </View>
//              <View style={styles.infoChip}>
//                <Ionicons name="shield-checkmark" size={12} color="#fff" />
//                <Text style={styles.infoChipText}>Stage-based</Text>
//              </View>
//            </View>
//            <Text style={styles.siteId}>Visible Records: {stageVisibleList.length}</Text>
//          </View>
//
//          <TouchableOpacity style={styles.headerIconBtn} onPress={openFilterModal} activeOpacity={0.75}>
//            <Ionicons name="options-outline" size={22} color="#ffffff" />
//            {activeFilterCount > 0 && (
//              <View style={styles.badge}>
//                <Text style={styles.badgeText}>{activeFilterCount}</Text>
//              </View>
//            )}
//          </TouchableOpacity>
//        </View>
//      </View>
//
//      {/* Content */}
//      <View style={styles.content}>
//        {/* Search */}
//        <View style={styles.searchContainer}>
//          <View style={styles.searchCard}>
//            <View style={styles.searchInner}>
//              <Ionicons name="search" size={18} color={COLORS.primary} />
//              <TextInput
//                style={styles.searchInput}
//                placeholder="Search: ID / Site / RD"
//                placeholderTextColor={COLORS.textLight}
//                value={search}
//                onChangeText={setSearch}
//              />
//              {(search || '').length > 0 && (
//                <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearchBtn}>
//                  <Ionicons name="close-circle" size={18} color={COLORS.danger} />
//                </TouchableOpacity>
//              )}
//            </View>
//          </View>
//        </View>
//
//        {/* Module Tabs */}
//        <View style={styles.tabsContainer}>
//          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
//            {MODULES.map(m => (
//              <TabPill
//                key={m.key}
//                title={m.label}
//                icon={m.key === 'enumeration' ? 'leaf' : m.key === 'polecrop' ? 'analytics' : 'flower'}
//                isActive={activeModule === m.key}
//                onPress={() => setActiveModule(m.key)}
//              />
//            ))}
//          </ScrollView>
//        </View>
//
//        {/* Status Tabs (role-aware counts) */}
//        <View style={styles.tabsContainer}>
//          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
//            <TabPill
//              title={`All (${statusCounts.all})`}
//              icon="apps"
//              isActive={statusFilter === 'All'}
//              onPress={() => setStatusFilter('All')}
//            />
//            <TabPill
//              title={`Pending (${statusCounts.pendingForMe})`}
//              icon="time"
//              isActive={statusFilter === 'Pending'}
//              onPress={() => setStatusFilter('Pending')}
//            />
//            <TabPill
//              title={`Verified (${statusCounts.verifiedByMe})`}
//              icon="checkmark-done"
//              isActive={statusFilter === 'Verified'}
//              onPress={() => setStatusFilter('Verified')}
//            />
//            <TabPill
//              title={`Rejected (${statusCounts.rejectedByMe})`}
//              icon="close-circle"
//              isActive={statusFilter === 'Rejected'}
//              onPress={() => setStatusFilter('Rejected')}
//            />
//          </ScrollView>
//        </View>
//
//        {/* Results header */}
//        <View style={styles.resultsHeader}>
//          <View style={styles.resultsLeft}>
//            <Ionicons name="list" size={16} color={COLORS.primary} />
//            <Text style={styles.resultsText}>
//              {filteredList.length} item{filteredList.length !== 1 ? 's' : ''} found
//            </Text>
//          </View>
//
//          {(search.trim() || statusFilter !== 'All') && (
//            <TouchableOpacity style={styles.clearBtn} onPress={clearAll} activeOpacity={0.85}>
//              <Ionicons name="trash-outline" size={14} color="#fff" />
//              <Text style={styles.clearBtnText}>Clear</Text>
//            </TouchableOpacity>
//          )}
//        </View>
//
//        {/* List */}
//        {loading ? (
//          <View style={styles.loadingContainerInline}>
//            <View style={styles.loadingCardInline}>
//              <ActivityIndicator size="large" color={COLORS.primary} />
//              <Text style={styles.loadingTextInline}>Loading…</Text>
//            </View>
//          </View>
//        ) : (
//          <View style={styles.listContainer}>
//            <FlatList
//              data={filteredList}
//              keyExtractor={(item, idx) => String(item?.id ?? idx)}
//              renderItem={renderItem}
//              contentContainerStyle={{padding: 12, paddingBottom: 24}}
//              refreshControl={
//                <RefreshControl
//                  refreshing={refreshing}
//                  onRefresh={onRefresh}
//                  colors={[COLORS.primary]}
//                  tintColor={COLORS.primary}
//                />
//              }
//              ListEmptyComponent={
//                <View style={styles.emptyState}>
//                  <View style={styles.emptyIconContainer}>
//                    <Ionicons name="document" size={52} color={COLORS.primaryLight} />
//                  </View>
//                  <Text style={styles.emptyText}>No records found</Text>
//                  <Text style={styles.emptySubtext}>Try changing filters or search keywords.</Text>
//                  <TouchableOpacity style={styles.emptyActionBtn} onPress={clearAll} activeOpacity={0.85}>
//                    <Text style={styles.emptyActionText}>Reset Filters</Text>
//                  </TouchableOpacity>
//                </View>
//              }
//            />
//          </View>
//        )}
//      </View>
//
//      {/* Filters Modal */}
//      <Modal
//        transparent
//        visible={filterModalVisible}
//        animationType="slide"
//        onRequestClose={() => setFilterModalVisible(false)}>
//        <View style={styles.modalContainer}>
//          <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
//            <View style={styles.modalOverlay} />
//          </TouchableWithoutFeedback>
//
//          <View style={styles.modalCard}>
//            <View style={styles.modalHeader}>
//              <View style={styles.modalTitleContainer}>
//                <Ionicons name="filter" size={20} color={COLORS.primary} />
//                <Text style={styles.modalTitle}>Filters</Text>
//              </View>
//              <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={styles.modalCloseBtn}>
//                <Ionicons name="close" size={22} color={COLORS.text} />
//              </TouchableOpacity>
//            </View>
//
//            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
//              <View style={styles.filterSection}>
//                <Text style={styles.modalLabel}>Module</Text>
//                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptions}>
//                  {MODULES.map(m => {
//                    const active = pendingFilters.module === m.key;
//                    return (
//                      <TouchableOpacity
//                        key={m.key}
//                        style={[styles.optPill, active && styles.optPillActive]}
//                        onPress={() => setPendingFilters(prev => ({...prev, module: m.key}))}
//                        activeOpacity={0.85}>
//                        <Text style={[styles.optPillText, active && styles.optPillTextActive]}>{m.label}</Text>
//                      </TouchableOpacity>
//                    );
//                  })}
//                </ScrollView>
//              </View>
//
//              <View style={styles.filterSection}>
//                <Text style={styles.modalLabel}>Status</Text>
//                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptions}>
//                  {STATUS_FILTERS.map(s => {
//                    const active = pendingFilters.status === s;
//                    return (
//                      <TouchableOpacity
//                        key={s}
//                        style={[styles.optPill, active && styles.optPillActive]}
//                        onPress={() => setPendingFilters(prev => ({...prev, status: s}))}
//                        activeOpacity={0.85}>
//                        <Text style={[styles.optPillText, active && styles.optPillTextActive]}>{s}</Text>
//                      </TouchableOpacity>
//                    );
//                  })}
//                </ScrollView>
//              </View>
//
//              <View style={styles.modalActionsRow}>
//                <TouchableOpacity style={styles.modalResetBtn} onPress={resetFilters} activeOpacity={0.85}>
//                  <Ionicons name="refresh" size={16} color={COLORS.primary} />
//                  <Text style={styles.modalResetText}>Reset</Text>
//                </TouchableOpacity>
//
//                <TouchableOpacity style={styles.modalApplyBtn} onPress={applyFilters} activeOpacity={0.85}>
//                  <Ionicons name="checkmark" size={18} color="#ffffff" />
//                  <Text style={styles.modalApplyText}>Apply Filters</Text>
//                </TouchableOpacity>
//              </View>
//            </ScrollView>
//          </View>
//        </View>
//      </Modal>
//
//      {/* DETAILS MODAL */}
//      <Modal transparent visible={detailsModal.visible} animationType="fade">
//        <View style={styles.detailsOverlay}>
//          <View style={styles.detailsCard}>
//            <View style={styles.detailsHeader}>
//              <Text style={styles.detailsTitle}>
//                Details •{' '}
//                {detailsModal.module === 'enumeration'
//                  ? 'Enumeration'
//                  : detailsModal.module === 'afforestation'
//                  ? 'Afforestation'
//                  : 'PoleCrop'}
//              </Text>
//              <TouchableOpacity onPress={closeDetails} disabled={detailsModal.submitting} activeOpacity={0.75}>
//                <Ionicons name="close" size={22} color={COLORS.text} />
//              </TouchableOpacity>
//            </View>
//
//            {!detailsItem ? (
//              <View style={{padding: 16}}>
//                <Text style={{color: COLORS.textLight}}>No details</Text>
//              </View>
//            ) : (
//              <ScrollView style={{maxHeight: 520}} contentContainerStyle={{paddingBottom: 10}}>
//                <View style={styles.kvRow}>
//                  <Text style={styles.kvKey}>ID</Text>
//                  <Text style={styles.kvVal}>{String(detailsItem.id)}</Text>
//                </View>
//
//                <View style={styles.kvRow}>
//                  <Text style={styles.kvKey}>Site</Text>
//                  <Text style={styles.kvVal}>{getSiteName(detailsItem)}</Text>
//                </View>
//
//                {'rd_km' in detailsItem && (
//                  <View style={styles.kvRow}>
//                    <Text style={styles.kvKey}>RD (km)</Text>
//                    <Text style={styles.kvVal}>{String(detailsItem.rd_km ?? '-')}</Text>
//                  </View>
//                )}
//
//                <View style={styles.kvRow}>
//                  <Text style={styles.kvKey}>Condition</Text>
//                  <Text style={styles.kvVal}>{detailsItem?.condition?.name || '-'}</Text>
//                </View>
//
//                <View style={styles.kvRow}>
//                  <Text style={styles.kvKey}>Latest Status</Text>
//                  <Text style={styles.kvVal}>{detailsAction ? String(detailsAction) : 'Pending'}</Text>
//                </View>
//
//                <View style={styles.kvRow}>
//                  <Text style={styles.kvKey}>Pending For</Text>
//                  <Text style={styles.kvVal}>{getNextApproverSlug(detailsItem) || 'Completed'}</Text>
//                </View>
//
//                <View style={styles.kvRow}>
//                  <Text style={styles.kvKey}>Is Pending For You</Text>
//                  <Text style={styles.kvVal}>{detailsPendingForMe ? 'YES' : 'NO'}</Text>
//                </View>
//
//                {!!detailsItem?.latestStatus?.remarks && (
//                  <View style={styles.kvBlock}>
//                    <Text style={styles.kvKey}>Latest Remarks</Text>
//                    <Text style={[styles.kvVal, {textAlign: 'left', maxWidth: '100%'}]}>
//                      {String(detailsItem.latestStatus.remarks)}
//                    </Text>
//                  </View>
//                )}
//
//                {/* Images */}
//                <View style={{marginTop: 10}}>
//                  <Text style={styles.sectionTitle}>Pictures</Text>
//
//                  {detailsPics.length === 0 ? (
//                    <Text style={styles.emptyTextSmall}>No pictures</Text>
//                  ) : (
//                    <FlatList
//                      data={detailsPics}
//                      keyExtractor={(u, idx) => `${idx}-${u}`}
//                      horizontal
//                      showsHorizontalScrollIndicator={false}
//                      contentContainerStyle={{gap: 10, paddingVertical: 8}}
//                      renderItem={({item: url}) => (
//                        <View style={styles.imageWrap}>
//                          <Image source={{uri: url}} style={styles.image} resizeMode="cover" />
//                        </View>
//                      )}
//                    />
//                  )}
//                </View>
//
//                {/* Verification History */}
//                {Array.isArray(detailsItem?.verification) && detailsItem.verification.length > 0 && (
//                  <View style={{marginTop: 10}}>
//                    <Text style={styles.sectionTitle}>Verification History</Text>
//                    {detailsItem.verification.slice(0, 6).map((v, idx) => (
//                      <View key={idx} style={styles.historyRow}>
//                        <Text style={styles.historyLine}>
//                          {v.action} • {v.user_role} • {v.designation}
//                        </Text>
//                        {!!v.remarks && <Text style={styles.historyRemark}>Remarks: {v.remarks}</Text>}
//                      </View>
//                    ))}
//                  </View>
//                )}
//
//                {/* Reject Mode input */}
//                {detailsModal.rejectMode && !detailsFinal && (
//                  <View style={{marginTop: 12}}>
//                    <Text style={styles.sectionTitle}>Rejection Remarks (Required)</Text>
//                    <TextInput
//                      value={detailsModal.remarks}
//                      onChangeText={t => setDetailsModal(s => ({...s, remarks: t}))}
//                      placeholder="Enter remarks…"
//                      placeholderTextColor={COLORS.textLight}
//                      style={styles.remarksInput}
//                      multiline
//                    />
//                  </View>
//                )}
//
//                {/* Final status info */}
//                {detailsFinal && (
//                  <View style={styles.finalInfo}>
//                    <Ionicons name="information-circle" size={18} color={COLORS.textLight} />
//                    <Text style={styles.finalInfoText}>
//                      This record is already {detailsAction}. No changes allowed.
//                    </Text>
//                  </View>
//                )}
//              </ScrollView>
//            )}
//
//            {/* Actions: only enabled if pending for my action */}
//            <View style={styles.detailsActions}>
//              <TouchableOpacity
//                style={[
//                  styles.actionBtn,
//                  styles.approveBtn,
//                  (!detailsPendingForMe || detailsFinal) && {opacity: 0.45},
//                ]}
//                onPress={approveFromDetails}
//                disabled={detailsModal.submitting || !detailsItem || detailsFinal || !detailsPendingForMe}
//                activeOpacity={0.85}>
//                {detailsModal.submitting ? (
//                  <ActivityIndicator color="#fff" />
//                ) : (
//                  <>
//                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
//                    <Text style={styles.actionBtnText}>Approve</Text>
//                  </>
//                )}
//              </TouchableOpacity>
//
//              {!detailsModal.rejectMode ? (
//                <TouchableOpacity
//                  style={[
//                    styles.actionBtn,
//                    styles.rejectBtn,
//                    (!detailsPendingForMe || detailsFinal) && {opacity: 0.45},
//                  ]}
//                  onPress={() => setDetailsModal(s => ({...s, rejectMode: true}))}
//                  disabled={detailsModal.submitting || !detailsItem || detailsFinal || !detailsPendingForMe}
//                  activeOpacity={0.85}>
//                  <Ionicons name="close-circle" size={18} color="#fff" />
//                  <Text style={styles.actionBtnText}>Reject</Text>
//                </TouchableOpacity>
//              ) : (
//                <TouchableOpacity
//                  style={[
//                    styles.actionBtn,
//                    styles.rejectBtn,
//                    (!detailsPendingForMe || detailsFinal) && {opacity: 0.45},
//                  ]}
//                  onPress={rejectFromDetails}
//                  disabled={detailsModal.submitting || !detailsItem || detailsFinal || !detailsPendingForMe}
//                  activeOpacity={0.85}>
//                  {detailsModal.submitting ? (
//                    <ActivityIndicator color="#fff" />
//                  ) : (
//                    <>
//                      <Ionicons name="close-circle" size={18} color="#fff" />
//                      <Text style={styles.actionBtnText}>Confirm Reject</Text>
//                    </>
//                  )}
//                </TouchableOpacity>
//              )}
//            </View>
//
//            {detailsModal.rejectMode && !detailsFinal && (
//              <TouchableOpacity
//                onPress={() => setDetailsModal(s => ({...s, rejectMode: false, remarks: ''}))}
//                style={styles.rejectCancelLink}
//                disabled={detailsModal.submitting}
//                activeOpacity={0.85}>
//                <Text style={styles.rejectCancelText}>Cancel Rejection</Text>
//              </TouchableOpacity>
//            )}
//          </View>
//        </View>
//      </Modal>
//    </View>
//  );
//}
//
///* ===================== STYLES ===================== */
//const styles = StyleSheet.create({
//  screen: {flex: 1, backgroundColor: COLORS.background},
//
//  header: {
//    backgroundColor: COLORS.primary,
//    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 20,
//    paddingBottom: 20,
//    borderBottomLeftRadius: 24,
//    borderBottomRightRadius: 24,
//    elevation: 8,
//    shadowColor: COLORS.primary,
//    shadowOffset: {width: 0, height: 4},
//    shadowOpacity: 0.3,
//    shadowRadius: 12,
//  },
//  headerContainer: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20},
//  backButton: {
//    width: 44,
//    height: 44,
//    borderRadius: 12,
//    backgroundColor: 'rgba(255,255,255,0.2)',
//    alignItems: 'center',
//    justifyContent: 'center',
//    marginRight: 12,
//  },
//  headerContent: {flex: 1},
//  headerTitle: {fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8, letterSpacing: 0.2},
//  headerInfo: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8},
//  infoChip: {
//    flexDirection: 'row',
//    alignItems: 'center',
//    backgroundColor: 'rgba(255,255,255,0.2)',
//    paddingHorizontal: 10,
//    paddingVertical: 4,
//    borderRadius: 20,
//    gap: 4,
//  },
//  infoChipText: {fontSize: 12, fontWeight: '600', color: '#fff'},
//  siteId: {fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3},
//  headerIconBtn: {
//    width: 46,
//    height: 46,
//    borderRadius: 14,
//    backgroundColor: 'rgba(255,255,255,0.2)',
//    alignItems: 'center',
//    justifyContent: 'center',
//    borderWidth: 1,
//    borderColor: 'rgba(255,255,255,0.3)',
//  },
//  badge: {
//    position: 'absolute',
//    top: -6,
//    right: -6,
//    minWidth: 22,
//    height: 22,
//    borderRadius: 11,
//    backgroundColor: COLORS.danger,
//    alignItems: 'center',
//    justifyContent: 'center',
//    paddingHorizontal: 6,
//    borderWidth: 2,
//    borderColor: COLORS.primary,
//  },
//  badgeText: {color: '#fff', fontSize: 11, fontWeight: '900'},
//
//  content: {flex: 1, paddingHorizontal: 20, paddingTop: 20},
//
//  searchContainer: {marginBottom: 16},
//  searchCard: {
//    backgroundColor: COLORS.card,
//    borderRadius: 16,
//    padding: 4,
//    borderWidth: 1,
//    borderColor: COLORS.border,
//    shadowColor: '#000',
//    shadowOffset: {width: 0, height: 2},
//    shadowOpacity: 0.05,
//    shadowRadius: 8,
//    elevation: 2,
//  },
//  searchInner: {
//    flexDirection: 'row',
//    alignItems: 'center',
//    backgroundColor: COLORS.background,
//    borderRadius: 12,
//    paddingHorizontal: 16,
//    paddingVertical: 14,
//  },
//  searchInput: {
//    flex: 1,
//    marginLeft: 12,
//    marginRight: 8,
//    fontSize: 15,
//    color: COLORS.text,
//    fontWeight: '500',
//  },
//  clearSearchBtn: {padding: 4},
//
//  tabsContainer: {
//    marginBottom: 12,
//    backgroundColor: COLORS.card,
//    borderRadius: 16,
//    padding: 8,
//    borderWidth: 1,
//    borderColor: COLORS.border,
//    shadowColor: '#000',
//    shadowOffset: {width: 0, height: 2},
//    shadowOpacity: 0.05,
//    shadowRadius: 8,
//    elevation: 2,
//  },
//  tabBarContent: {alignItems: 'center', paddingRight: 4},
//  tabPill: {
//    height: 40,
//    paddingHorizontal: 18,
//    borderRadius: 20,
//    borderWidth: 1,
//    marginRight: 10,
//    flexDirection: 'row',
//    alignItems: 'center',
//    justifyContent: 'center',
//    backgroundColor: COLORS.card,
//  },
//  tabPillIdle: {backgroundColor: COLORS.card, borderColor: COLORS.border},
//  tabPillActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
//  tabPillText: {fontSize: 13, fontWeight: '700', color: COLORS.primaryDark},
//  tabPillTextActive: {color: '#ffffff'},
//
//  resultsHeader: {
//    marginBottom: 12,
//    flexDirection: 'row',
//    alignItems: 'center',
//    justifyContent: 'space-between',
//    paddingHorizontal: 4,
//  },
//  resultsLeft: {flexDirection: 'row', alignItems: 'center', gap: 8},
//  resultsText: {fontSize: 14, color: COLORS.primaryDark, fontWeight: '700'},
//  clearBtn: {
//    flexDirection: 'row',
//    alignItems: 'center',
//    gap: 8,
//    backgroundColor: COLORS.danger,
//    paddingHorizontal: 14,
//    paddingVertical: 10,
//    borderRadius: 12,
//  },
//  clearBtnText: {color: '#fff', fontWeight: '700', fontSize: 13},
//
//  listContainer: {
//    flex: 1,
//    backgroundColor: COLORS.card,
//    borderRadius: 16,
//    borderWidth: 1,
//    borderColor: COLORS.border,
//    overflow: 'hidden',
//    shadowColor: '#000',
//    shadowOffset: {width: 0, height: 2},
//    shadowOpacity: 0.05,
//    shadowRadius: 8,
//    elevation: 2,
//  },
//
//  card: {
//    backgroundColor: '#fff',
//    borderRadius: 14,
//    padding: 12,
//    marginBottom: 10,
//    borderWidth: 1,
//    borderColor: COLORS.border,
//  },
//  cardTop: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
//  cardTitle: {fontSize: 14, fontWeight: '800', color: COLORS.text},
//  cardSub: {marginTop: 2, fontSize: 12, color: COLORS.textLight},
//  remarkLine: {marginTop: 8, fontSize: 12, color: '#374151', fontWeight: '700'},
//  tapHint: {marginTop: 8, fontSize: 11, color: '#9ca3af', fontWeight: '800'},
//
//  statusPillMini: {
//    flexDirection: 'row',
//    alignItems: 'center',
//    justifyContent: 'center',
//    gap: 6,
//    paddingVertical: 8,
//    paddingHorizontal: 12,
//    borderRadius: 20,
//    borderWidth: 1,
//    height: 36,
//  },
//  statusPillMiniText: {fontSize: 11, fontWeight: '900'},
//
//  loadingContainer: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background},
//  loadingCard: {
//    backgroundColor: COLORS.card,
//    padding: 40,
//    borderRadius: 20,
//    alignItems: 'center',
//    justifyContent: 'center',
//    borderWidth: 1,
//    borderColor: COLORS.border,
//    shadowColor: '#000',
//    shadowOffset: {width: 0, height: 4},
//    shadowOpacity: 0.1,
//    shadowRadius: 12,
//    elevation: 5,
//  },
//  loadingText: {marginTop: 16, color: COLORS.primaryDark, fontSize: 16, fontWeight: '700'},
//
//  loadingContainerInline: {alignItems: 'center', justifyContent: 'center', paddingVertical: 30},
//  loadingCardInline: {
//    backgroundColor: COLORS.card,
//    padding: 24,
//    borderRadius: 18,
//    alignItems: 'center',
//    justifyContent: 'center',
//    borderWidth: 1,
//    borderColor: COLORS.border,
//  },
//  loadingTextInline: {marginTop: 12, color: COLORS.primaryDark, fontSize: 14, fontWeight: '700'},
//
//  emptyState: {alignItems: 'center', justifyContent: 'center', padding: 60, width: width - 40},
//  emptyIconContainer: {
//    width: 100,
//    height: 100,
//    borderRadius: 50,
//    backgroundColor: 'rgba(5, 150, 105, 0.1)',
//    alignItems: 'center',
//    justifyContent: 'center',
//    marginBottom: 24,
//    borderWidth: 2,
//    borderColor: 'rgba(5, 150, 105, 0.2)',
//  },
//  emptyText: {fontSize: 18, fontWeight: '800', color: COLORS.primaryDark, marginBottom: 8},
//  emptySubtext: {
//    fontSize: 14,
//    color: COLORS.textLight,
//    textAlign: 'center',
//    fontWeight: '600',
//    marginBottom: 24,
//    lineHeight: 20,
//  },
//  emptyActionBtn: {
//    backgroundColor: 'rgba(5, 150, 105, 0.1)',
//    paddingHorizontal: 24,
//    paddingVertical: 12,
//    borderRadius: 12,
//    borderWidth: 1,
//    borderColor: 'rgba(5, 150, 105, 0.2)',
//  },
//  emptyActionText: {color: COLORS.primaryDark, fontWeight: '800', fontSize: 14},
//
//  modalContainer: {flex: 1, justifyContent: 'flex-end'},
//  modalOverlay: {...StyleSheet.absoluteFillObject, backgroundColor: COLORS.overlay},
//  modalCard: {
//    backgroundColor: COLORS.card,
//    borderTopLeftRadius: 20,
//    borderTopRightRadius: 20,
//    borderWidth: 1,
//    borderColor: COLORS.border,
//    maxHeight: '85%',
//    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
//    shadowColor: '#000',
//    shadowOffset: {width: 0, height: -4},
//    shadowOpacity: 0.15,
//    shadowRadius: 20,
//    elevation: 20,
//  },
//  modalHeader: {
//    flexDirection: 'row',
//    justifyContent: 'space-between',
//    alignItems: 'center',
//    paddingHorizontal: 20,
//    paddingVertical: 16,
//    borderBottomWidth: 1,
//    borderBottomColor: COLORS.border,
//  },
//  modalTitleContainer: {flexDirection: 'row', alignItems: 'center', gap: 10},
//  modalTitle: {fontSize: 18, fontWeight: '800', color: COLORS.text},
//  modalCloseBtn: {
//    width: 40,
//    height: 40,
//    borderRadius: 20,
//    backgroundColor: 'rgba(5, 150, 105, 0.1)',
//    alignItems: 'center',
//    justifyContent: 'center',
//  },
//  modalScrollContent: {paddingHorizontal: 20, paddingVertical: 16},
//  filterSection: {marginBottom: 20},
//  modalLabel: {fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 12, textTransform: 'uppercase'},
//  filterOptions: {paddingBottom: 8},
//  optPill: {
//    paddingHorizontal: 18,
//    paddingVertical: 10,
//    borderRadius: 20,
//    borderWidth: 1,
//    borderColor: COLORS.border,
//    backgroundColor: COLORS.card,
//    marginRight: 10,
//  },
//  optPillActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
//  optPillText: {fontSize: 13, fontWeight: '700', color: COLORS.text},
//  optPillTextActive: {color: '#fff'},
//  modalActionsRow: {flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 8},
//  modalResetBtn: {
//    flex: 1,
//    backgroundColor: 'rgba(5, 150, 105, 0.1)',
//    paddingVertical: 16,
//    borderRadius: 12,
//    alignItems: 'center',
//    flexDirection: 'row',
//    justifyContent: 'center',
//    gap: 8,
//    borderWidth: 1,
//    borderColor: COLORS.border,
//  },
//  modalResetText: {color: COLORS.primary, fontWeight: '800', fontSize: 15},
//  modalApplyBtn: {
//    flex: 2,
//    backgroundColor: COLORS.primary,
//    paddingVertical: 16,
//    borderRadius: 12,
//    alignItems: 'center',
//    flexDirection: 'row',
//    justifyContent: 'center',
//    gap: 10,
//  },
//  modalApplyText: {color: '#fff', fontWeight: '900', fontSize: 15},
//
//  detailsOverlay: {
//    flex: 1,
//    backgroundColor: 'rgba(15, 23, 42, 0.7)',
//    alignItems: 'center',
//    justifyContent: 'center',
//    padding: 16,
//  },
//  detailsCard: {
//    width: '100%',
//    maxWidth: 650,
//    backgroundColor: '#fff',
//    borderRadius: 16,
//    padding: 14,
//    borderWidth: 1,
//    borderColor: COLORS.border,
//  },
//  detailsHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
//  detailsTitle: {fontSize: 16, fontWeight: '900', color: COLORS.text},
//
//  kvRow: {
//    marginTop: 10,
//    flexDirection: 'row',
//    justifyContent: 'space-between',
//    gap: 10,
//    borderBottomWidth: 1,
//    borderBottomColor: '#f3f4f6',
//    paddingBottom: 8,
//  },
//  kvBlock: {
//    marginTop: 10,
//    borderBottomWidth: 1,
//    borderBottomColor: '#f3f4f6',
//    paddingBottom: 8,
//  },
//  kvKey: {fontSize: 12, fontWeight: '900', color: COLORS.textLight},
//  kvVal: {fontSize: 12, fontWeight: '800', color: COLORS.text, maxWidth: '70%', textAlign: 'right'},
//
//  sectionTitle: {marginTop: 8, fontSize: 13, fontWeight: '900', color: COLORS.text},
//  emptyTextSmall: {marginTop: 6, fontSize: 12, color: COLORS.textLight, fontWeight: '700'},
//
//  imageWrap: {
//    width: 160,
//    height: 110,
//    borderRadius: 12,
//    overflow: 'hidden',
//    borderWidth: 1,
//    borderColor: COLORS.border,
//    backgroundColor: '#f3f4f6',
//  },
//  image: {width: '100%', height: '100%'},
//  historyRow: {
//    marginTop: 8,
//    padding: 10,
//    borderRadius: 12,
//    backgroundColor: '#f9fafb',
//    borderWidth: 1,
//    borderColor: COLORS.border,
//  },
//  historyLine: {fontSize: 12, fontWeight: '800', color: COLORS.text},
//  historyRemark: {marginTop: 4, fontSize: 12, color: '#374151', fontWeight: '700'},
//
//  remarksInput: {
//    marginTop: 8,
//    minHeight: 90,
//    borderRadius: 12,
//    borderWidth: 1,
//    borderColor: COLORS.border,
//    padding: 10,
//    color: COLORS.text,
//    textAlignVertical: 'top',
//    backgroundColor: '#fff',
//  },
//
//  finalInfo: {
//    marginTop: 14,
//    flexDirection: 'row',
//    gap: 8,
//    alignItems: 'center',
//    padding: 10,
//    borderRadius: 12,
//    backgroundColor: '#f3f4f6',
//    borderWidth: 1,
//    borderColor: COLORS.border,
//  },
//  finalInfoText: {fontSize: 12, color: COLORS.textLight, fontWeight: '800', flex: 1},
//
//  detailsActions: {flexDirection: 'row', gap: 10, marginTop: 12},
//  actionBtn: {
//    flex: 1,
//    paddingVertical: 12,
//    borderRadius: 12,
//    flexDirection: 'row',
//    alignItems: 'center',
//    justifyContent: 'center',
//    gap: 8,
//  },
//  approveBtn: {backgroundColor: COLORS.primary},
//  rejectBtn: {backgroundColor: COLORS.danger},
//  actionBtnText: {color: '#fff', fontWeight: '900', fontSize: 13},
//
//  rejectCancelLink: {marginTop: 10, alignItems: 'center', paddingVertical: 6},
//  rejectCancelText: {fontSize: 12, fontWeight: '900', color: COLORS.text},
//});
