// /screens/AddTreeScreen.js
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  View,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import FormRow from '../components/FormRow';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/ApiService';

/* ===================== API ===================== */
const API_BASE = 'http://be.lte.gisforestry.com';
const ENUM_CREATE_URL = `${API_BASE}/lpe3/name-of-site`;
const ENUM_MY_SITES_URL = `${API_BASE}/lpe3/name-of-site/my/sites`;

/* ---------- safe json ---------- */
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/* ---------- SINGLE-SELECT DROPDOWN (Object Options: {id,name}) ---------- */
const DropdownRow = ({
  label,
  value,
  options,
  onChange,
  required,
  disabled,
  loading,
  lockedText,
}) => {
  const [open, setOpen] = useState(false);

  const displayText = lockedText ?? (value?.name ? value.name : '');
  const isDisabled = !!disabled || !!loading || !!lockedText;

  return (
    <View style={styles.dropdownContainer}>
      <Text style={styles.dropdownLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>

      <TouchableOpacity
        style={[styles.dropdownSelected, isDisabled && { opacity: 0.65 }]}
        onPress={() => !isDisabled && setOpen(true)}
        activeOpacity={0.8}>
        <Text
          style={
            displayText ? styles.dropdownSelectedText : styles.dropdownPlaceholder
          }>
          {loading ? 'Loading...' : displayText || 'Select...'}
        </Text>
        <Ionicons
          name={isDisabled ? 'lock-closed' : 'chevron-down'}
          size={18}
          color="#6b7280"
        />
      </TouchableOpacity>

      {!lockedText && (
        <Modal
          transparent
          visible={open}
          animationType="fade"
          onRequestClose={() => setOpen(false)}>
          <TouchableWithoutFeedback onPress={() => setOpen(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>

          <View style={styles.dropdownModal}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color="#065f46" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              {options?.length ? (
                options.map(opt => (
                  <TouchableOpacity
                    key={String(opt.id)}
                    style={styles.dropdownItem}
                    onPress={() => {
                      onChange(opt);
                      setOpen(false);
                    }}>
                    <Text style={styles.dropdownItemText}>{opt.name}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.dropdownEmpty}>
                  <Ionicons name="list" size={24} color="#d1d5db" />
                  <Text style={styles.dropdownEmptyText}>
                    {loading ? 'Loading...' : 'No options available.'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 cards with padding

export default function AddTreeScreen({ navigation }) {
  const { user, token } = useAuth();

  const [enumModalVisible, setEnumModalVisible] = useState(false);

  // API-backed list of saved sites (instead of offline)
  const [enumerations, setEnumerations] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Row actions modal
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedEnum, setSelectedEnum] = useState(null);

  // Search (body)
  const [search, setSearch] = useState('');

  // Filters
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    linearType: '',
    circle: '',
    block: '',
    dateFrom: '',
    dateTo: '',
    kmFrom: '',
    kmTo: '',
  });

  /* ===================== FIELDS (LOCKED FROM LOGIN) ===================== */
  const [zoneId, setZoneId] = useState(null);
  const [circleId, setCircleId] = useState(null);
  const [divisionId, setDivisionId] = useState(null);
  const [subDivisionId, setSubDivisionId] = useState(null);
  const [blockId, setBlockId] = useState(null);
  const [beatId, setBeatId] = useState(null);

  const [zone, setZone] = useState('');
  const [circle, setCircle] = useState('');
  const [division, setDivision] = useState('');
  const [subDivision, setSubDivision] = useState('');
  const [block, setBlock] = useState('');
  const [beat, setBeat] = useState('');

  /* ===================== FORM (EDITABLE) ===================== */
  const [linearType, setLinearType] = useState('');
  const [canalName, setCanalName] = useState(''); // will be sent as site_name
  const [compartment, setCompartment] = useState('');
  const [year, setYear] = useState('');
  const [side, setSide] = useState('');
  const [rdFrom, setRdFrom] = useState('');
  const [rdTo, setRdTo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [pageNo, setPageNo] = useState('');
  const [registerNo, setRegisterNo] = useState('');

  const linearTypeOptions = ['Road Side', 'Rail Side', 'Canal Side'].map((name, idx) => ({
    id: String(idx + 1),
    name,
  }));

  const yearOptions = [
    '2021-22',
    '2022-23',
    '2023-24',
    '2024-25',
    '2025-26',
    '2026-27',
    '2027-28',
    '2028-29',
    '2029-30',
  ].map((name, idx) => ({ id: String(idx + 1), name }));

  const getSideOptions = type => {
    if (type === 'Road Side') return ['Left', 'Right', 'Both', 'Median'];
    if (type === 'Rail Side') return ['Left', 'Right', 'Both'];
    if (type === 'Canal Side') return ['Left', 'Right', 'Both'];
    return [];
  };

  const rdKmLabelFrom = () =>
    linearType === 'Canal' ? 'RDs for Canal' : 'KMs for Road/Rail Side';
  const rdKmLabelTo = () => 'RDs/KMs To';

  const sideLabel =
    linearType === 'Road Side'
      ? 'Side (Left / Right / Both / Median)'
      : 'Side (Left / Right / Both)';

  const toNum = v => {
    const s = String(v ?? '').trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const toDateStart = yyyyMmDd => {
    const s = String(yyyyMmDd ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  };

  const toDateEnd = yyyyMmDd => {
    const s = String(yyyyMmDd ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T23:59:59`);
    return isNaN(d.getTime()) ? null : d;
  };

  /* ===================== NORMALIZE API -> UI ITEM ===================== */
  const normalizeItemFromApi = useCallback(
    apiItem => {
      const pt = apiItem?.plantation_type || '';
      let lt = '';
      if (pt.toLowerCase().includes('canal')) lt = 'Canal';
      else if (pt.toLowerCase().includes('road')) lt = 'Road';
      else if (pt.toLowerCase().includes('rail')) lt = 'Rail';
      else lt = pt;

      const resolvedId =
        apiItem?.name_of_site_id ??
        apiItem?.site_id ??
        apiItem?.nameOfSiteId ??
        apiItem?.id;

      return {
        id:
          resolvedId != null
            ? String(resolvedId)
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name_of_site_id: resolvedId != null ? Number(resolvedId) : null,

        // IDs (from API)
        zoneId: apiItem?.zoneId != null ? String(apiItem.zoneId) : zoneId,
        circleId: apiItem?.circleId != null ? String(apiItem.circleId) : circleId,
        divisionId: apiItem?.divisionId != null ? String(apiItem.divisionId) : divisionId,
        subDivisionId:
          apiItem?.subDivisionId != null
            ? String(apiItem.subDivisionId)
            : subDivisionId,
        blockId: apiItem?.blockId != null ? String(apiItem.blockId) : blockId,
        beatId: apiItem?.beatId != null ? String(apiItem.beatId) : beatId,

        // names (we show from login, since API doesn't return names)
        zone,
        circle,
        division,
        subDivision,
        block,
        beat,

        // form fields
        linearType: lt,
        plantation_type: apiItem?.plantation_type || '',
        canalName: apiItem?.site_name || '',
        compartment: apiItem?.compartment || '',
        year: apiItem?.year || '',
        side: apiItem?.side || '',
        rdFrom: apiItem?.rds_from != null ? String(apiItem.rds_from) : '',
        rdTo: apiItem?.rds_to != null ? String(apiItem.rds_to) : '',
        remarks: apiItem?.remarks || '',

        createdAt: apiItem?.created_at || apiItem?.createdAt || new Date().toISOString(),
      };
    },
    [zoneId, circleId, divisionId, subDivisionId, blockId, beatId, zone, circle, division, subDivision, block, beat],
  );

  /* ===================== AUTO-FILL LOCKED LOCATION FROM LOGIN USER ===================== */
  useEffect(() => {
    const z = user?.zone;
    const c = user?.circle;
    const d = user?.division;
    const sd = user?.subDivision;
    const b = user?.block;
    const bt = user?.beat;

    setZoneId(z?.id ? String(z.id) : null);
    setZone(z?.name || '');

    setCircleId(c?.id ? String(c.id) : null);
    setCircle(c?.name || '');

    setDivisionId(d?.id ? String(d.id) : null);
    setDivision(d?.name || '');

    setSubDivisionId(sd?.id ? String(sd.id) : null);
    setSubDivision(sd?.name || '');

    setBlockId(b?.id ? String(b.id) : null);
    setBlock(b?.name || '');

    setBeatId(bt?.id ? String(bt.id) : null);
    setBeat(bt?.name || '');
  }, [user]);

  /* ===================== FETCH MY SITES ===================== */
  const fetchMySites = useCallback(
    async ({ silent = false } = {}) => {
      // Just check token existence for UX, though apiService handles it.
      if (!token) {
        if (!silent) Alert.alert('Session', 'Token missing. Please login again.');
        return;
      }

      try {
        if (!silent) setLoadingList(true);

        const json = await apiService.get(ENUM_MY_SITES_URL);

        const data = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        const mapped = data.map(normalizeItemFromApi);

        // newest first
        mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setEnumerations(mapped);
      } catch (e) {
        console.error('fetchMySites error:', e);
        if (!silent) Alert.alert('Error', e?.message || 'Failed to load your sites.');
      } finally {
        if (!silent) setLoadingList(false);
      }
    },
    [token, normalizeItemFromApi],
  );

  // On focus, reset search/filters + fetch list
  useFocusEffect(
    useCallback(() => {
      setSearch('');
      setFilters({
        linearType: '',
        circle: '',
        block: '',
        dateFrom: '',
        dateTo: '',
        kmFrom: '',
        kmTo: '',
      });
      fetchMySites({ silent: true });
    }, [fetchMySites]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMySites({ silent: true });
    setRefreshing(false);
  }, [fetchMySites]);

  /* ===================== FILTERS ===================== */
  const clearAllFilters = useCallback(() => {
    setSearch('');
    setFilters({
      linearType: '',
      circle: '',
      block: '',
      dateFrom: '',
      dateTo: '',
      kmFrom: '',
      kmTo: '',
    });
  }, []);

  const activeFilterCount = useMemo(() => {
    const adv = Object.values(filters).filter(v => String(v || '').trim() !== '').length;
    const s = search.trim() ? 1 : 0;
    return adv + s;
  }, [filters, search]);

  const filteredEnumerations = useMemo(() => {
    const q = search.trim().toLowerCase();
    const hasAnyFilter = q !== '' || Object.values(filters).some(v => String(v ?? '').trim() !== '');
    if (!hasAnyFilter) return enumerations;

    const df = toDateStart(filters.dateFrom);
    const dt = toDateEnd(filters.dateTo);
    const kmF = toNum(filters.kmFrom);
    const kmT = toNum(filters.kmTo);

    return enumerations.filter(item => {
      if (filters.linearType && item.linearType !== filters.linearType) return false;

      // these are text filters in your UI (exact match)
      if (filters.circle && (item.circle || '') !== filters.circle) return false;
      if (filters.block && (item.block || '') !== filters.block) return false;

      if ((df || dt) && item.createdAt) {
        const itemDate = new Date(item.createdAt);
        if (df && itemDate < df) return false;
        if (dt && itemDate > dt) return false;
      } else if ((df || dt) && !item.createdAt) {
        return false;
      }

      if (kmF !== null || kmT !== null) {
        const a = toNum(item.rdFrom);
        const b = toNum(item.rdTo);
        if (a === null && b === null) return false;

        const itemFrom = a !== null ? a : b;
        const itemTo = b !== null ? b : a;

        const minV = Math.min(itemFrom, itemTo);
        const maxV = Math.max(itemFrom, itemTo);

        if (kmF !== null && maxV < kmF) return false;
        if (kmT !== null && minV > kmT) return false;
      }

      if (!q) return true;

      const blob = [
        item.zone,
        item.circle,
        item.division,
        item.subDivision,
        item.block,
        item.beat,
        item.year,
        item.linearType,
        item.side,
        item.canalName,
        item.compartment,
        item.remarks,
        item.rdFrom,
        item.rdTo,
        item.plantation_type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [enumerations, search, filters]);

  /* ===================== CREATE SITE (SAVE TO DB) ===================== */
  const saveEnumerationForm = async () => {
    if (!zoneId || !circleId || !divisionId || !subDivisionId || !blockId || !beatId) {
      Alert.alert(
        'Location missing',
        'Your login profile does not contain complete Zone/Circle/Division/SubDivision/Block/Beat. Please contact admin.',
      );
      return;
    }

    if (!token) {
      Alert.alert('Session error', 'Token not found. Please logout and login again.');
      return;
    }

    // Required fields for your API
    if (!linearType || !year || !side || !canalName) {
      Alert.alert('Missing data', 'Please fill all required fields (Type, Site Name, Year, Side).');
      return;
    }

    // backend expects "Canal Side" / "Road Side" / "Rail Side"
    const plantationTypeMap = {
      Canal: 'Canal Side',
      Road: 'Road Side',
      Rail: 'Rail Side',
    };
    const plantation_type = plantationTypeMap[linearType] || linearType;

    // backend expects numbers (not null/NaN)
    const rFromRaw = String(rdFrom ?? '').trim();
    const rToRaw = String(rdTo ?? '').trim();
    const rds_from = rFromRaw === '' ? 0 : Number(rFromRaw);
    const rds_to = rToRaw === '' ? 0 : Number(rToRaw);

    if (!Number.isFinite(rds_from) || !Number.isFinite(rds_to)) {
      Alert.alert('Invalid value', 'Please enter valid numeric values for From/To.');
      return;
    }

    try {
      const payload = {
        site_name: canalName,
        plantation_type,
        year,
        zoneId: Number(zoneId),
        circleId: Number(circleId),
        divisionId: Number(divisionId),
        subDivisionId: Number(subDivisionId),
        blockId: Number(blockId),
        beatId: Number(beatId),
        compartment: String(compartment || '').trim() || null,
        side: side,
        rds_from,
        rds_to,
        page_no: String(pageNo || '').trim(),
        register_no: String(registerNo || '').trim(),
      };

      const json = await apiService.post(ENUM_CREATE_URL, payload);

      // add to list immediately
      const saved = json?.data || {};
      const savedItem = normalizeItemFromApi(saved);

      setEnumerations(prev => [savedItem, ...prev]);

      // reset editable fields
      setLinearType('');
      setCanalName('');
      setCompartment('');
      setYear('');
      setSide('');
      setRdFrom('');
      setRdTo('');
      setRdTo('');
      setRemarks('');
      setPageNo('');
      setRegisterNo('');

      setEnumModalVisible(false);
      Alert.alert(json.offline ? 'Saved Offline' : 'Success', json.message || 'Enumeration saved successfully.', [{ text: 'OK' }]);
    } catch (e) {
      console.error('Save enumeration error:', e);
      Alert.alert('Error', e?.message || 'Unable to save enumeration.');
    }
  };

  /* ===================== NAVIGATION ===================== */
  // IMPORTANT FIX:
  // - Do NOT use navigation.getParent() here.
  // - Your RootNavigator registers these names:
  //   MatureTreeRecords, PoleCropRecords, AfforestationRecords, Disposal, Superdari
  const navTo = (screen, params) => {
    navigation.navigate(screen, params);
  };

  const handleCategoryPress = (type, item) => {
    if (!item) return;

    const resolvedSiteId =
      item?.name_of_site_id ??
      item?.name_of_site?.id ??
      item?.site_id ??
      item?.siteId ??
      item?.id;

    if (type === 'Mature Tree') {
      return navTo('MatureTreeRecords', {
        enumeration: {
          ...item,
          name_of_site_id: resolvedSiteId,
        },
      });
    }

    if (type === 'Pole Crop') {
      return navTo('PoleCropRecords', {
        enumeration: {
          ...item,
          name_of_site_id: resolvedSiteId,
        },
      });
    }

    if (type === 'Afforestation') {
      return navTo('AfforestationRecords', {
        enumeration: {
          ...item,
          name_of_site_id: resolvedSiteId,
        },
        nameOfSiteId: resolvedSiteId,
        siteId: resolvedSiteId,
        site: item,
      });
    }

    // ✅ NEW OPTIONS (must match RootNavigator route names EXACTLY)
    if (type === 'Disposal') {
      return navTo('Disposal', {
        enumeration: {
          ...item,
          name_of_site_id: resolvedSiteId,
        },
        nameOfSiteId: resolvedSiteId,
        siteId: resolvedSiteId,
        site: item,
      });
    }

    if (type === 'Superdari') {
      return navTo('Superdari', {
        enumeration: {
          ...item,
          name_of_site_id: resolvedSiteId,
        },
        nameOfSiteId: resolvedSiteId,
        siteId: resolvedSiteId,
        site: item,
      });
    }
  };

  const openRowActions = item => {
    setSelectedEnum(item);
    setActionModalVisible(true);
  };

  const iconForType = t => {
    if (t === 'Road Side') return 'car-sport-outline';
    if (t === 'Rail Side') return 'train-outline';
    if (t === 'Canal Side') return 'water-outline';
    return 'leaf-outline';
  };

  const colorForType = t => {
    if (t === 'Road Side') return '#f97316';
    if (t === 'Rail Side') return '#0ea5e9';
    if (t === 'Canal Side') return '#059669';
    return '#8b5cf6';
  };

  /* ===================== RENDER ===================== */
  return (
    <View style={styles.screen}>
      {/* Header with gradient effect */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Guard Site Information</Text>
          <Text style={styles.headerSubtitle}>Manage your plantation sites</Text>
        </View>

        <TouchableOpacity
          style={[styles.backButton, { paddingHorizontal: 10 }]}
          onPress={() => fetchMySites()}
          activeOpacity={0.85}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {/* Search & Filter Section */}
          <View style={styles.searchSection}>
            <View style={styles.searchCard}>
              <View style={styles.searchInner}>
                <Ionicons name="search" size={18} color="#059669" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search sites by any field..."
                  placeholderTextColor="#9ca3af"
                  style={styles.searchInput}
                />
                {!!search && (
                  <TouchableOpacity
                    onPress={() => setSearch('')}
                    style={styles.clearSearchBtn}>
                    <Ionicons name="close-circle" size={18} color="#dc2626" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => setFilterModalVisible(true)}
              activeOpacity={0.8}>
              <Ionicons name="options-outline" size={20} color="#fff" />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Stats Section */}
          <View style={styles.statsSection}>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name="leaf" size={20} color="#059669" />
              </View>
              <Text style={styles.statNumber}>{enumerations.length}</Text>
              <Text style={styles.statLabel}>Total Sites</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name="filter" size={20} color="#059669" />
              </View>
              <Text style={styles.statNumber}>{filteredEnumerations.length}</Text>
              <Text style={styles.statLabel}>Filtered</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name="time" size={20} color="#059669" />
              </View>
              <Text style={styles.statNumber}>
                {enumerations.length > 0
                  ? new Date(enumerations[0].createdAt).toLocaleDateString()
                  : '--/--/--'}
              </Text>
              <Text style={styles.statLabel}>Latest</Text>
            </View>
          </View>

          {/* Sites Grid - 2 columns */}
          <View style={styles.sitesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Sites</Text>
              <Text style={styles.sectionSubtitle}>
                Tap any site to add tree records
              </Text>
            </View>

            {loadingList ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#059669" />
                <Text style={styles.loadingText}>Loading sites...</Text>
              </View>
            ) : enumerations.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="leaf-outline" size={48} color="#d1fae5" />
                </View>
                <Text style={styles.emptyTitle}>No sites found yet</Text>
                <Text style={styles.emptySubtitle}>
                  Tap the + button below to create your first plantation site
                </Text>
              </View>
            ) : filteredEnumerations.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="search-outline" size={48} color="#d1fae5" />
                </View>
                <Text style={styles.emptyTitle}>No matches found</Text>
                <Text style={styles.emptySubtitle}>
                  Try changing your search or filters
                </Text>
                {activeFilterCount > 0 && (
                  <TouchableOpacity style={styles.resetFiltersBtn} onPress={clearAllFilters}>
                    <Text style={styles.resetFiltersText}>Reset Filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.gridContainer}>
                {filteredEnumerations.map(item => {
                  const typeColor = colorForType(item.linearType);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.9}
                      onPress={() => openRowActions(item)}
                      style={styles.siteCard}>
                      {/* Card Header */}
                      <View style={styles.cardHeader}>
                        <View style={[styles.cardType, { backgroundColor: `${typeColor}20` }]}>
                          <Ionicons
                            name={iconForType(item.linearType)}
                            size={16}
                            color={typeColor}
                          />
                          <Text style={[styles.cardTypeText, { color: typeColor }]}>
                            {item.linearType}
                          </Text>
                        </View>
                        <View style={styles.cardYear}>
                          <Text style={styles.cardYearText}>{item.year}</Text>
                        </View>
                      </View>

                      {/* Site Info */}
                      <Text style={styles.cardSiteName} numberOfLines={1}>
                        {item.canalName || 'Unnamed Site'}
                      </Text>

                      <Text style={styles.cardLocation} numberOfLines={2}>
                        {item.division} • {item.subDivision}
                      </Text>

                      {/* Details Row */}
                      <View style={styles.cardDetails}>
                        <View style={styles.detailItem}>
                          <Ionicons name="location" size={12} color="#6b7280" />
                          <Text style={styles.detailText}>{item.side}</Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Ionicons name="cube" size={12} color="#6b7280" />
                          <Text style={styles.detailText}>
                            {item.block} • {item.beat}
                          </Text>
                        </View>
                      </View>

                      {/* Range Info */}
                      {(item.rdFrom || item.rdTo) && (
                        <View style={styles.rangeContainer}>
                          <Ionicons name="map" size={12} color="#059669" />
                          <Text style={styles.rangeText}>
                            {item.linearType === 'Canal' ? 'RDs' : 'KMs'}:
                            {item.rdFrom || '--'} → {item.rdTo || '--'}
                          </Text>
                        </View>
                      )}

                      {/* Footer with Action */}
                      <View style={styles.cardFooter}>
                        <Text style={styles.cardDate}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '--/--/--'}
                        </Text>
                        <View style={styles.actionIndicator}>
                          <Ionicons name="chevron-forward" size={14} color="#059669" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {activeFilterCount > 0 && (
              <TouchableOpacity style={styles.clearAllBtn} onPress={clearAllFilters}>
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={styles.clearAllText}>Clear All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Add Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setEnumModalVisible(true)}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      {/* ✅ Filters Modal */}
      <Modal
        transparent
        visible={filterModalVisible}
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalContainer}>
          <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>

          <View style={styles.filterCard}>
            <View style={styles.filterHeader}>
              <View style={styles.filterTitleContainer}>
                <Ionicons name="filter" size={20} color="#065f46" />
                <Text style={styles.filterTitle}>Advanced Filters</Text>
              </View>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                style={styles.filterCloseBtn}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.filterScroll}>
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Type (Road/Rail/Canal Side)</Text>
                <View style={styles.filterOptionsRow}>
                  {linearTypeOptions.map(opt => {
                    const active = filters.linearType === opt.name;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.filterOption, active && styles.filterOptionActive]}
                        onPress={() => setFilters(prev => ({ ...prev, linearType: active ? '' : opt.name }))}>
                        <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>
                          {opt.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Circle (exact match)</Text>
                <View style={styles.filterInputWrapper}>
                  <Ionicons name="business" size={16} color="#059669" style={styles.filterInputIcon} />
                  <TextInput
                    value={filters.circle}
                    onChangeText={v => setFilters(prev => ({ ...prev, circle: v }))}
                    placeholder="Type circle name"
                    placeholderTextColor="#9ca3af"
                    style={styles.filterInput}
                  />
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Block (exact match)</Text>
                <View style={styles.filterInputWrapper}>
                  <Ionicons name="grid" size={16} color="#059669" style={styles.filterInputIcon} />
                  <TextInput
                    value={filters.block}
                    onChangeText={v => setFilters(prev => ({ ...prev, block: v }))}
                    placeholder="Type block name"
                    placeholderTextColor="#9ca3af"
                    style={styles.filterInput}
                  />
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Date Range (YYYY-MM-DD)</Text>
                <View style={styles.twoCol}>
                  <View style={styles.filterInputWrapper}>
                    <Ionicons name="calendar" size={16} color="#059669" style={styles.filterInputIcon} />
                    <TextInput
                      value={filters.dateFrom}
                      onChangeText={v => setFilters(prev => ({ ...prev, dateFrom: v }))}
                      placeholder="From: 2025-12-01"
                      placeholderTextColor="#9ca3af"
                      style={styles.filterInput}
                    />
                  </View>
                  <View style={styles.filterInputWrapper}>
                    <Ionicons name="calendar" size={16} color="#059669" style={styles.filterInputIcon} />
                    <TextInput
                      value={filters.dateTo}
                      onChangeText={v => setFilters(prev => ({ ...prev, dateTo: v }))}
                      placeholder="To: 2025-12-31"
                      placeholderTextColor="#9ca3af"
                      style={styles.filterInput}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>KM/RD Range</Text>
                <View style={styles.twoCol}>
                  <View style={styles.filterInputWrapper}>
                    <Ionicons name="map" size={16} color="#059669" style={styles.filterInputIcon} />
                    <TextInput
                      value={filters.kmFrom}
                      onChangeText={v => setFilters(prev => ({ ...prev, kmFrom: v }))}
                      placeholder="From: 10"
                      placeholderTextColor="#9ca3af"
                      style={styles.filterInput}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.filterInputWrapper}>
                    <Ionicons name="map" size={16} color="#059669" style={styles.filterInputIcon} />
                    <TextInput
                      value={filters.kmTo}
                      onChangeText={v => setFilters(prev => ({ ...prev, kmTo: v }))}
                      placeholder="To: 50"
                      placeholderTextColor="#9ca3af"
                      style={styles.filterInput}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.filterActions}>
                <TouchableOpacity
                  style={styles.filterResetBtn}
                  onPress={() => {
                    setFilters({
                      linearType: '',
                      circle: '',
                      block: '',
                      dateFrom: '',
                      dateTo: '',
                      kmFrom: '',
                      kmTo: '',
                    });
                  }}>
                  <Ionicons name="refresh" size={16} color="#065f46" />
                  <Text style={styles.filterResetText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.filterApplyBtn}
                  onPress={() => setFilterModalVisible(false)}>
                  <Ionicons name="checkmark" size={18} color="#ffffff" />
                  <Text style={styles.filterApplyText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ✅ Row Actions Modal */}
      <Modal
        transparent
        visible={actionModalVisible}
        animationType="fade"
        onRequestClose={() => setActionModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setActionModalVisible(false)}>
          <View style={styles.actionOverlay} />
        </TouchableWithoutFeedback>

        <View style={styles.actionCard}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionTitle}>Add Tree Records</Text>
            <Text style={styles.actionSub}>
              {selectedEnum
                ? `${selectedEnum.division} • ${selectedEnum.linearType} • ${selectedEnum.year}`
                : ''}
            </Text>
          </View>

          {/* Enumeration */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setActionModalVisible(false);
              handleCategoryPress('Mature Tree', selectedEnum);
            }}>
            <View style={styles.actionBtnIcon}>
              <Ionicons name="tree" size={20} color="#059669" />
            </View>
            <View style={styles.actionBtnContent}>
              <Text style={styles.actionBtnTitle}>Enumeration</Text>
              <Text style={styles.actionBtnSubtitle}>Add Enumeration records</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          {/* Pole Crop */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setActionModalVisible(false);
              handleCategoryPress('Pole Crop', selectedEnum);
            }}>
            <View style={styles.actionBtnIcon}>
              <Ionicons name="leaf" size={20} color="#f59e0b" />
            </View>
            <View style={styles.actionBtnContent}>
              <Text style={styles.actionBtnTitle}>Pole Crop</Text>
              <Text style={styles.actionBtnSubtitle}>Add pole crop records</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          {/* Afforestation */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setActionModalVisible(false);
              handleCategoryPress('Afforestation', selectedEnum);
            }}>
            <View style={styles.actionBtnIcon}>
              <Ionicons name="flower" size={20} color="#7c3aed" />
            </View>
            <View style={styles.actionBtnContent}>
              <Text style={styles.actionBtnTitle}>Afforestation</Text>
              <Text style={styles.actionBtnSubtitle}>Add afforestation records</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          {/* ✅ NEW: Disposal */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setActionModalVisible(false);
              handleCategoryPress('Disposal', selectedEnum);
            }}>
            <View style={styles.actionBtnIcon}>
              <Ionicons name="trash" size={20} color="#dc2626" />
            </View>
            <View style={styles.actionBtnContent}>
              <Text style={styles.actionBtnTitle}>Disposal</Text>
              <Text style={styles.actionBtnSubtitle}>Add disposal records</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          {/* ✅ NEW: SuperDari */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setActionModalVisible(false);
              handleCategoryPress('Superdari', selectedEnum);
            }}>
            <View style={styles.actionBtnIcon}>
              <Ionicons name="document-text" size={20} color="#2563eb" />
            </View>
            <View style={styles.actionBtnContent}>
              <Text style={styles.actionBtnTitle}>SuperDari</Text>
              <Text style={styles.actionBtnSubtitle}>Add superdari records</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCancel}
            onPress={() => setActionModalVisible(false)}>
            <Text style={styles.actionCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ✅ Enumeration Header Modal (Save to DB) */}
      <Modal
        visible={enumModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEnumModalVisible(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderEnum}>
              <View style={styles.modalTitleContainer}>
                <Ionicons name="add-circle" size={22} color="#ffffff" />
                <Text style={styles.modalTitleEnum}>Create New Site</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEnumModalVisible(false)}
                style={styles.modalCloseBtnEnum}>
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}>
              <Text style={styles.modalSectionTitle}>Location (Locked from Login)</Text>
              <View style={styles.lockedFieldsGrid}>
                <View style={styles.lockedField}>
                  <Text style={styles.lockedLabel}>Zone</Text>
                  <View style={styles.lockedValue}>
                    <Ionicons name="location" size={14} color="#059669" />
                    <Text style={styles.lockedText}>{zone || '-'}</Text>
                  </View>
                </View>
                <View style={styles.lockedField}>
                  <Text style={styles.lockedLabel}>Circle</Text>
                  <View style={styles.lockedValue}>
                    <Ionicons name="business" size={14} color="#059669" />
                    <Text style={styles.lockedText}>{circle || '-'}</Text>
                  </View>
                </View>
                <View style={styles.lockedField}>
                  <Text style={styles.lockedLabel}>Division</Text>
                  <View style={styles.lockedValue}>
                    <Ionicons name="map" size={14} color="#059669" />
                    <Text style={styles.lockedText}>{division || '-'}</Text>
                  </View>
                </View>
                <View style={styles.lockedField}>
                  <Text style={styles.lockedLabel}>Sub-Division</Text>
                  <View style={styles.lockedValue}>
                    <Ionicons name="map" size={14} color="#059669" />
                    <Text style={styles.lockedText}>{subDivision || '-'}</Text>
                  </View>
                </View>
                <View style={styles.lockedField}>
                  <Text style={styles.lockedLabel}>Block</Text>
                  <View style={styles.lockedValue}>
                    <Ionicons name="grid" size={14} color="#059669" />
                    <Text style={styles.lockedText}>{block || '-'}</Text>
                  </View>
                </View>
                <View style={styles.lockedField}>
                  <Text style={styles.lockedLabel}>Beat</Text>
                  <View style={styles.lockedValue}>
                    <Ionicons name="pin" size={14} color="#059669" />
                    <Text style={styles.lockedText}>{beat || '-'}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.modalSectionTitle}>Site Details</Text>

              <DropdownRow
                label="Type of Linear Plantation *"
                value={linearType ? { id: 'lt', name: linearType } : null}
                onChange={opt => {
                  setLinearType(opt.name);
                  setSide('');
                }}
                options={linearTypeOptions}
                required
              />

              <FormRow
                label="Site Name *"
                value={canalName}
                onChangeText={setCanalName}
                placeholder="e.g. Main Canal Plantation, Highway Road Plantation"
                icon="pricetag"
              />

              <FormRow
                label="Compartment (Optional)"
                value={compartment}
                onChangeText={setCompartment}
                placeholder="Enter compartment (if any)"
                icon="cube"
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

              <DropdownRow
                label="Year *"
                value={year ? { id: 'yr', name: year } : null}
                onChange={opt => setYear(opt.name)}
                options={yearOptions}
                required
              />

              <DropdownRow
                label={sideLabel + ' *'}
                value={side ? { id: 'sd', name: side } : null}
                onChange={opt => setSide(opt.name)}
                options={getSideOptions(linearType).map((name, idx) => ({
                  id: String(idx + 1),
                  name,
                }))}
                required
                disabled={!linearType}
              />

              <View style={styles.rangeRow}>
                <View style={styles.rangeInput}>
                  <FormRow
                    label={`${rdKmLabelFrom()} (From) *`}
                    value={rdFrom}
                    onChangeText={setRdFrom}
                    placeholder="0"
                    keyboardType="numeric"
                    icon="arrow-forward"
                  />
                </View>
                <View style={styles.rangeInput}>
                  <FormRow
                    label={`${rdKmLabelTo()} (To) *`}
                    value={rdTo}
                    onChangeText={setRdTo}
                    placeholder="10"
                    keyboardType="numeric"
                    icon="arrow-back"
                  />
                </View>
              </View>

              <FormRow
                label="Remarks (Optional)"
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Enter any additional remarks"
                multiline
                icon="document-text"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEnumModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveBtn} onPress={saveEnumerationForm}>
                  <Ionicons name="save" size={20} color="#fff" />
                  <Text style={styles.modalSaveText}>Save Site</Text>
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
  screen: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#059669',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // Search Section
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  searchCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
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
  filterBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.3)',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  filterBadge: {
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
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },

  // Stats Section
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#065f46',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },

  // Sites Section
  sitesSection: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#065f46',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Grid Container
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },

  // Site Card (2 columns)
  siteCard: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  cardTypeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardYear: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cardYearText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065f46',
  },
  cardSiteName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  cardLocation: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 16,
  },
  cardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  rangeText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(5, 150, 105, 0.1)',
  },
  cardDate: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
  },
  actionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Loading & Empty States
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#4b5563',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 24,
    lineHeight: 20,
  },
  resetFiltersBtn: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  resetFiltersText: {
    color: '#065f46',
    fontWeight: '700',
    fontSize: 14,
  },

  clearAllBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  clearAllText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#059669',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },

  // Filter Modal
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  filterCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5, 150, 105, 0.1)',
  },
  filterTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#065f46',
  },
  filterCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterScroll: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  filterOptionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
  },
  filterOptionActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  filterOptionTextActive: {
    color: '#fff',
  },
  filterInputWrapper: {
    position: 'relative',
  },
  filterInputIcon: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: [{ translateY: -8 }],
    zIndex: 1,
  },
  filterInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 16,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
    marginBottom: 8,
  },
  filterResetBtn: {
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
  filterResetText: {
    color: '#065f46',
    fontWeight: '700',
    fontSize: 15,
  },
  filterApplyBtn: {
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
  filterApplyText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },

  // Action Modal
  actionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  actionCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '20%',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
  },
  actionHeader: {
    marginBottom: 24,
  },
  actionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#065f46',
    marginBottom: 6,
  },
  actionSub: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    marginBottom: 12,
  },
  actionBtnIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
  },
  actionBtnContent: {
    flex: 1,
  },
  actionBtnTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  actionBtnSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  actionCancel: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 12,
  },
  actionCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6b7280',
  },

  // Create Site Modal
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
  },
  modalHeaderEnum: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#059669',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginBottom: 20,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitleEnum: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalCloseBtnEnum: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#065f46',
    marginBottom: 16,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  lockedFieldsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  lockedField: {
    width: '48%',
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
  },
  lockedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lockedValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065f46',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  rangeInput: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  modalCancelText: {
    color: '#065f46',
    fontWeight: '800',
    fontSize: 15,
  },
  modalSaveBtn: {
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
  modalSaveText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },

  // Dropdown Styles
  dropdownContainer: { marginBottom: 16 },
  dropdownLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    fontWeight: '700'
  },
  required: { color: '#dc2626' },
  dropdownSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  dropdownSelectedText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600'
  },
  dropdownPlaceholder: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '600'
  },
  dropdownModal: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '22%',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    padding: 0,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5, 150, 105, 0.1)',
  },
  dropdownModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065f46'
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5, 150, 105, 0.05)',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600'
  },
  dropdownEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  dropdownEmptyText: {
    marginTop: 12,
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
});
