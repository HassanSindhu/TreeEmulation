// /screens/AddTreeScreen.js
import React, {useMemo, useState, useEffect, useCallback} from 'react';
import {
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  View,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useFocusEffect} from '@react-navigation/native';
import FormRow from '../components/FormRow';
import colors from '../theme/colors';
import {useAuth} from '../context/AuthContext';

/* ===================== API ===================== */
const API_BASE = 'http://be.lte.gisforestry.com';
const ENUM_CREATE_URL = `${API_BASE}/enum/name-of-site`;
const ENUM_MY_SITES_URL = `${API_BASE}/enum/name-of-site/my/sites`;

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
        style={[styles.dropdownSelected, isDisabled && {opacity: 0.65}]}
        onPress={() => !isDisabled && setOpen(true)}
        activeOpacity={0.8}>
        <Text style={displayText ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
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
            <Text style={styles.dropdownModalTitle}>{label}</Text>

            <ScrollView style={{maxHeight: 260}} showsVerticalScrollIndicator={false}>
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
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={{color: '#6b7280', paddingVertical: 12}}>
                  {loading ? 'Loading...' : 'No options available.'}
                </Text>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
};

export default function AddTreeScreen({navigation}) {
  const {user, token} = useAuth();

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

  const linearTypeOptions = ['Road', 'Rail', 'Canal'].map((name, idx) => ({
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
  ].map((name, idx) => ({id: String(idx + 1), name}));

  const getSideOptions = type => {
    if (type === 'Road') return ['Left', 'Right', 'Both', 'Median'];
    if (type === 'Rail') return ['Left', 'Right', 'Both'];
    if (type === 'Canal') return ['Left', 'Right', 'Both'];
    return [];
  };

  const rdKmLabelFrom = () => (linearType === 'Canal' ? 'RDs for Canal' : 'KMs for Road and Rail');
  const rdKmLabelTo = () => 'RDs/KMs To';

  const sideLabel =
    linearType === 'Road' ? 'Side (Left / Right / Both / Median)' : 'Side (Left / Right / Both)';

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
      // API sample fields:
      // zoneId,circleId,divisionId,subDivisionId,plantation_type,site_name,blockId,beatId,userId,compartment,year,side,rds_from,rds_to,id,created_at
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
        // IMPORTANT: keep stable id + also keep explicit name_of_site_id for downstream screens
        id: resolvedId != null ? String(resolvedId) : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name_of_site_id: resolvedId != null ? Number(resolvedId) : null,

        // IDs (from API)
        zoneId: apiItem?.zoneId != null ? String(apiItem.zoneId) : zoneId,
        circleId: apiItem?.circleId != null ? String(apiItem.circleId) : circleId,
        divisionId: apiItem?.divisionId != null ? String(apiItem.divisionId) : divisionId,
        subDivisionId: apiItem?.subDivisionId != null ? String(apiItem.subDivisionId) : subDivisionId,
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
    async ({silent = false} = {}) => {
      if (!token) {
        if (!silent) Alert.alert('Session', 'Token missing. Please login again.');
        return;
      }

      try {
        if (!silent) setLoadingList(true);

        const res = await fetch(ENUM_MY_SITES_URL, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await safeJson(res);

        if (!res.ok) {
          throw new Error(json?.message || `Fetch failed (HTTP ${res.status})`);
        }

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
      fetchMySites({silent: true});
    }, [fetchMySites]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMySites({silent: true});
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
      };

      const res = await fetch(ENUM_CREATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await safeJson(res);

      if (!res.ok) {
        throw new Error(json?.message || `Failed to save (HTTP ${res.status})`);
      }

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
      setRemarks('');

      setEnumModalVisible(false);
      Alert.alert('Success', 'Enumeration saved successfully.');
    } catch (e) {
      console.error('Save enumeration error:', e);
      Alert.alert('Error', e?.message || 'Unable to save enumeration.');
    }
  };

  /* ===================== NAVIGATION ===================== */
  const navTo = (screen, params) => {
    const parentNav = navigation.getParent?.();
    (parentNav || navigation).navigate(screen, params);
  };

  // FIX: make each branch exclusive + pass a stable site id field to downstream screens
  const handleCategoryPress = (type, item) => {
    if (!item) return;

    // prefer explicit name_of_site_id if present, else fallback to id
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
          name_of_site_id:
            item?.name_of_site_id ??
            item?.name_of_site?.id ??
            item?.site_id ??
            item?.id,
        },
      });
    }


    if (type === 'Afforestation') {
      // pass id in the strongest form; your Afforestation screen resolver will pick it up
      return navTo('AfforestationRecords', {
        enumeration: {
          ...item,
          name_of_site_id: resolvedSiteId,
        },
        nameOfSiteId: resolvedSiteId,
        siteId: resolvedSiteId,
        site: item, // optional header
      });
    }

    if (type === 'disposal') {
      return navTo('Disposal', {enumeration: item});
    }

    if (type === 'Superdari') {
      return navTo('Superdari', {enumeration: item});
    }
  };

  const openRowActions = item => {
    setSelectedEnum(item);
    setActionModalVisible(true);
  };

  const iconForType = t => {
    if (t === 'Road') return 'car-sport-outline';
    if (t === 'Rail') return 'train-outline';
    if (t === 'Canal') return 'water-outline';
    return 'leaf-outline';
  };

  /* ===================== RENDER ===================== */
  return (
    <View style={styles.screen}>
      <ImageBackground
        source={require('../assets/images/bg.jpg')}
        style={styles.background}
        resizeMode="cover">
        <View style={styles.overlay} />

        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{flex: 1}}>
            <Text style={styles.headerTitle}>Guard Site Information</Text>
            <Text style={styles.headerSubtitle}>Sites</Text>
          </View>

          <TouchableOpacity
            style={[styles.backButton, {paddingHorizontal: 10}]}
            onPress={() => fetchMySites()}
            activeOpacity={0.85}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={{paddingBottom: 110}}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            <View style={styles.section}>
              <View style={styles.searchFilterRow}>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={18} color="#6b7280" />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search here..."
                    placeholderTextColor="#9ca3af"
                    style={styles.searchInput}
                  />
                  {!!search && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                      <Ionicons name="close-circle" size={18} color="#9ca3af" />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterModalVisible(true)}>
                  <Ionicons name="options-outline" size={20} color="#111827" />
                  {activeFilterCount > 0 && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Guard Enumeration Forms</Text>
                <Text style={styles.sectionMeta}>
                  {filteredEnumerations.length} / {enumerations.length}
                </Text>
              </View>

              {loadingList ? (
                <View style={{paddingVertical: 20, alignItems: 'center'}}>
                  <ActivityIndicator />
                  <Text style={{marginTop: 8, color: '#6b7280', fontWeight: '700'}}>
                    Loading sites...
                  </Text>
                </View>
              ) : enumerations.length === 0 ? (
                <Text style={styles.emptyText}>
                  No sites found yet. Tap the + button to add one.
                </Text>
              ) : filteredEnumerations.length === 0 ? (
                <Text style={styles.emptyText}>No record matches your search/filters.</Text>
              ) : (
                filteredEnumerations.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.9}
                    onPress={() => openRowActions(item)}
                    style={styles.cardRow}>
                    <View style={{flex: 1}}>
                      <Text style={styles.cardTitle}>
                        {item.division} • {item.subDivision}
                      </Text>

                      <Text style={styles.cardSub}>
                        {item.zone} • {item.circle} • {item.year}
                      </Text>

                      <Text style={styles.cardSub2}>
                        {item.linearType} • {item.side} • {item.block} • {item.beat}
                      </Text>

                      {item.rdFrom || item.rdTo ? (
                        <Text style={styles.cardHint}>
                          {item.linearType === 'Canal'
                            ? `RDs: ${item.rdFrom || '—'} → ${item.rdTo || '—'}`
                            : `KMs: ${item.rdFrom || '—'} → ${item.rdTo || '—'}`}
                        </Text>
                      ) : null}

                      {item.canalName ? (
                        <Text style={styles.cardHint} numberOfLines={1}>
                          Site: {item.canalName}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.cardRight}>
                      <View style={styles.typeIconWrap}>
                        <Ionicons
                          name={iconForType(item.linearType)}
                          size={22}
                          color={colors.primary}
                        />
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                    </View>
                  </TouchableOpacity>
                ))
              )}

              {activeFilterCount > 0 && (
                <TouchableOpacity style={styles.clearAllBtn} onPress={clearAllFilters}>
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                  <Text style={styles.clearAllText}>Clear Search & Filters</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <TouchableOpacity style={styles.fab} onPress={() => setEnumModalVisible(true)}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </ImageBackground>

      {/* ✅ Filters Modal */}
      <Modal
        transparent
        visible={filterModalVisible}
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
          <View style={styles.actionOverlay} />
        </TouchableWithoutFeedback>

        <View style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Filters</Text>
            <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <DropdownRow
              label="Type (Road/Rail/Canal)"
              value={filters.linearType ? {id: 't', name: filters.linearType} : null}
              onChange={opt => setFilters(prev => ({...prev, linearType: opt.name}))}
              options={linearTypeOptions}
              required={false}
            />

            <FormRow
              label="Circle (exact match)"
              value={filters.circle}
              onChangeText={v => setFilters(prev => ({...prev, circle: v}))}
              placeholder="Type circle name"
            />

            <FormRow
              label="Block (exact match)"
              value={filters.block}
              onChangeText={v => setFilters(prev => ({...prev, block: v}))}
              placeholder="Type block name"
            />

            <View style={{flexDirection: 'row', gap: 10}}>
              <View style={{flex: 1}}>
                <FormRow
                  label="Saved Date From (YYYY-MM-DD)"
                  value={filters.dateFrom}
                  onChangeText={v => setFilters(prev => ({...prev, dateFrom: v}))}
                  placeholder="2025-12-01"
                />
              </View>
              <View style={{flex: 1}}>
                <FormRow
                  label="Saved Date To (YYYY-MM-DD)"
                  value={filters.dateTo}
                  onChangeText={v => setFilters(prev => ({...prev, dateTo: v}))}
                  placeholder="2025-12-31"
                />
              </View>
            </View>

            <View style={{flexDirection: 'row', gap: 10}}>
              <View style={{flex: 1}}>
                <FormRow
                  label="KM/RD From"
                  value={filters.kmFrom}
                  onChangeText={v => setFilters(prev => ({...prev, kmFrom: v}))}
                  placeholder="e.g. 10"
                  keyboardType="numeric"
                />
              </View>
              <View style={{flex: 1}}>
                <FormRow
                  label="KM/RD To"
                  value={filters.kmTo}
                  onChangeText={v => setFilters(prev => ({...prev, kmTo: v}))}
                  placeholder="e.g. 50"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
              <TouchableOpacity
                style={styles.filterApply}
                onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.filterApplyText}>Apply</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterClear}
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
                <Text style={styles.filterClearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
          <Text style={styles.actionTitle}>Select Action</Text>
          <Text style={styles.actionSub}>
            {selectedEnum
              ? `${selectedEnum.division} • ${selectedEnum.subDivision} • ${selectedEnum.year}`
              : ''}
          </Text>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setActionModalVisible(false);
              handleCategoryPress('Mature Tree', selectedEnum);
            }}>
            <Text style={styles.actionBtnText}>Mature Tree</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setActionModalVisible(false);
              handleCategoryPress('Pole Crop', selectedEnum);
            }}>
            <Text style={styles.actionBtnText}>Pole Crop</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setActionModalVisible(false);
              handleCategoryPress('Afforestation', selectedEnum);
            }}>
            <Text style={styles.actionBtnText}>Afforestation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={() => {
              setActionModalVisible(false);
              handleCategoryPress('disposal', selectedEnum);
            }}>
            <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>Disposed</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnWarn]}
            onPress={() => {
              setActionModalVisible(false);
              handleCategoryPress('Superdari', selectedEnum);
            }}>
            <Text style={[styles.actionBtnText, styles.actionBtnWarnText]}>Superdari</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCancel} onPress={() => setActionModalVisible(false)}>
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
              <Text style={styles.modalTitleEnum}>Enumeration Form</Text>

              <TouchableOpacity
                onPress={() => setEnumModalVisible(false)}
                style={styles.modalCloseBtnEnum}>
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Locked from login */}
              <DropdownRow label="Zone" required lockedText={zone || '-'} />
              <DropdownRow label="Circle" required lockedText={circle || '-'} />
              <DropdownRow label="Division" required lockedText={division || '-'} />
              <DropdownRow label="S.Division / Range" required lockedText={subDivision || '-'} />
              <DropdownRow label="Block" required lockedText={block || '-'} />
              <DropdownRow label="Beat" required lockedText={beat || '-'} />

              {/* Editable fields */}
              <DropdownRow
                label="Type of Linear Plantation (Road/Rail/Canal)"
                value={linearType ? {id: 'lt', name: linearType} : null}
                onChange={opt => {
                  setLinearType(opt.name);
                  setSide('');
                }}
                options={linearTypeOptions}
                required
              />

              <FormRow
                label="Name of Canal/Road/Site (Site Name)"
                value={canalName}
                onChangeText={setCanalName}
                placeholder="e.g. Main Canal Plantation"
              />

              <FormRow
                label="Compartment (Optional)"
                value={compartment}
                onChangeText={setCompartment}
                placeholder="Enter compartment (if any)"
              />

              <DropdownRow
                label="Year (Ex 2024-25)"
                value={year ? {id: 'yr', name: year} : null}
                onChange={opt => setYear(opt.name)}
                options={yearOptions}
                required
              />

              <DropdownRow
                label={sideLabel}
                value={side ? {id: 'sd', name: side} : null}
                onChange={opt => setSide(opt.name)}
                options={getSideOptions(linearType).map((name, idx) => ({
                  id: String(idx + 1),
                  name,
                }))}
                required
                disabled={!linearType}
              />

              <FormRow
                label={`${rdKmLabelFrom()} (From)`}
                value={rdFrom}
                onChangeText={setRdFrom}
                placeholder="0"
                keyboardType="numeric"
              />
              <FormRow
                label={`${rdKmLabelTo()} (To)`}
                value={rdTo}
                onChangeText={setRdTo}
                placeholder="10"
                keyboardType="numeric"
              />

              <FormRow
                label="Remarks (Optional)"
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Enter remarks"
                multiline
              />

              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveEnumerationForm}>
                <Ionicons name="save" size={20} color="#fff" />
                <Text style={styles.modalSaveText}>Save Enumeration</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ===================== STYLES ===================== */
const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#ffffff'},
  background: {flex: 1, width: '100%'},
  overlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16, 185, 129, 0.10)'},

  header: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
  },
  backButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginTop: 2,
  },
  headerTitle: {fontSize: 20, fontWeight: '900', color: '#fff'},
  headerSubtitle: {fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2},

  container: {flex: 1},
  section: {paddingHorizontal: 16, paddingTop: 14},

  searchFilterRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12},
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {flex: 1, fontSize: 14, color: '#111827'},

  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterBadge: {
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
  filterBadgeText: {color: '#fff', fontSize: 11, fontWeight: '900'},

  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  sectionTitle: {fontSize: 16, fontWeight: '900', color: '#111827'},
  sectionMeta: {fontSize: 12, fontWeight: '800', color: '#6b7280'},
  emptyText: {fontSize: 13, color: '#6b7280', marginTop: 4},

  cardRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 4,
  },
  cardTitle: {fontSize: 14, fontWeight: '900', color: '#111827'},
  cardSub: {fontSize: 12, fontWeight: '800', color: '#6b7280', marginTop: 4},
  cardSub2: {fontSize: 12, fontWeight: '700', color: '#6b7280', marginTop: 2},
  cardHint: {fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 6},

  cardRight: {alignItems: 'center', justifyContent: 'space-between'},
  typeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  clearAllBtn: {
    marginTop: 6,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  clearAllText: {color: '#fff', fontWeight: '900'},

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 6},
  },

  actionOverlay: {flex: 1, backgroundColor: 'rgba(15,23,42,0.35)'},
  actionCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '24%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 12,
  },
  actionTitle: {fontSize: 16, fontWeight: '900', color: '#111827'},
  actionSub: {fontSize: 12, color: '#6b7280', marginTop: 4, marginBottom: 12},
  actionBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.25)',
    marginBottom: 10,
    alignItems: 'center',
  },
  actionBtnText: {fontSize: 14, fontWeight: '900', color: '#0369a1'},
  actionBtnDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  actionBtnDangerText: {color: '#b91c1c'},
  actionBtnWarn: {
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  actionBtnWarnText: {color: '#b45309'},
  actionCancel: {alignItems: 'center', paddingVertical: 10},
  actionCancelText: {fontSize: 13, fontWeight: '900', color: '#6b7280'},

  filterCard: {
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
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  filterTitle: {fontSize: 16, fontWeight: '900', color: '#111827'},
  filterApply: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterApplyText: {color: '#fff', fontWeight: '900'},
  filterClear: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterClearText: {color: '#111827', fontWeight: '900'},

  dropdownContainer: {marginHorizontal: 4, marginBottom: 12},
  dropdownLabel: {fontSize: 14, color: '#374151', marginBottom: 4, fontWeight: '700'},
  required: {color: '#dc2626'},
  dropdownSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
  },
  dropdownSelectedText: {fontSize: 14, color: '#111827', fontWeight: '700'},
  dropdownPlaceholder: {fontSize: 14, color: '#9ca3af', fontWeight: '700'},
  dropdownModal: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '22%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  dropdownModalTitle: {fontSize: 16, fontWeight: '900', marginBottom: 8, color: '#111827'},
  dropdownItem: {paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb'},
  dropdownItemText: {fontSize: 14, color: '#111827', fontWeight: '700'},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(15,23,42,0.3)'},

  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {backgroundColor: '#ffffff', borderRadius: 20, padding: 16, maxHeight: '85%'},
  modalSaveBtn: {
    marginTop: 16,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    gap: 8,
  },
  modalSaveText: {fontSize: 15, fontWeight: '900', color: '#fff'},
  modalHeaderEnum: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginLeft: -16,
    marginRight: -16,
    marginTop: -16,
    marginBottom: 12,
  },
  modalTitleEnum: {flex: 1, fontSize: 18, fontWeight: '900', color: '#ffffff'},
  modalCloseBtnEnum: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginLeft: 10,
  },
});
