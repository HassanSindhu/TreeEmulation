import React, {useCallback, useMemo, useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import NetInfo from '@react-native-community/netinfo';
import {launchImageLibrary} from 'react-native-image-picker';
import {useFocusEffect} from '@react-navigation/native';

import colors from '../theme/colors';
import FormRow from '../components/FormRow';
import {DropdownRow} from '../components/SelectRows';

const STORAGE_KEY = 'MATURE_TREE_RECORDS';

/**
 * IMPORTANT:
 * - Superdari navigation route name MUST match your navigator route.
 *   If your Stack.Screen is name="Superdari" then set SUPERDARI_ROUTE = 'Superdari'
 *   If your Stack.Screen is name="SuperdariScreen" then set it accordingly.
 */
const SUPERDARI_ROUTE = 'SuperdariScreen'; // ✅ change if your route name is different
const DISPOSAL_ROUTE = 'Disposal';

export default function MatureTreeRecordsScreen({navigation, route}) {
  const enumeration = route?.params?.enumeration;

  const [records, setRecords] = useState([]);

  /* Add/Edit Modal */
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);

  /* ✅ Search + Filters */
  const [search, setSearch] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    species: '',
    condition: '',
    auctionYN: '',
    dateFrom: '',
    dateTo: '',
    kmFrom: '',
    kmTo: '',
  });

  /* Form fields */
  const [registerNo, setRegisterNo] = useState('');
  const [pageNo, setPageNo] = useState('');
  const [systemTreeId, setSystemTreeId] = useState('');
  const [rdKm, setRdKm] = useState('');
  const [treeNo, setTreeNo] = useState('');
  const [species, setSpecies] = useState('');
  const [girthInches, setGirthInches] = useState('');
  const [condition, setCondition] = useState('');

  // ✅ GPS improvements
  const [gpsAuto, setGpsAuto] = useState(''); // auto fetched (network/GPS)
  const [gpsManual, setGpsManual] = useState(''); // user typed
  const [gpsSource, setGpsSource] = useState(''); // "NETWORK" / "GPS" / "MANUAL"
  const [gpsFetching, setGpsFetching] = useState(false);

  const [remarks, setRemarks] = useState('');
  const [pictureUri, setPictureUri] = useState(null);
  const [auctionYN, setAuctionYN] = useState('No');

  const speciesOptions = ['Shisham', 'Kikar', 'Sufaida', 'Siris', 'Neem', 'Other'];
  const conditionOptions = [
    'Green Standing',
    'Green Fallen',
    'Dry',
    'Leaning',
    'Dead',
    'Fallen',
    'Rotten',
    'Fire Burnt',
  ];
  const auctionOptions = ['No', 'Yes'];

  const rdRangeText =
    enumeration?.rdFrom && enumeration?.rdTo
      ? `${enumeration.rdFrom} - ${enumeration.rdTo}`
      : enumeration?.rdFrom || enumeration?.rdTo || '';

  /* Load records */
  const loadRecords = async () => {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    const all = json ? JSON.parse(json) : [];
    setRecords(all.filter(r => r.enumerationId === enumeration?.id));
  };

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [enumeration?.id]),
  );

  /* ✅ helper: normalize coordinate string */
  const formatLatLng = (latitude, longitude) =>
    `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;

  /* ✅ NEW: fetch location with priority:
     internet available -> network-based
     no internet -> GPS high accuracy
  */
  const fetchLocationSmart = async ({silent = false} = {}) => {
    try {
      setGpsFetching(true);

      const net = await NetInfo.fetch();
      const online = !!net.isConnected && (net.isInternetReachable ?? true);

      // Network-based location (coarse) if online
      const options = online
        ? {enableHighAccuracy: false, timeout: 12000, maximumAge: 30000}
        : {enableHighAccuracy: true, timeout: 18000, maximumAge: 5000};

      Geolocation.getCurrentPosition(
        pos => {
          const {latitude, longitude} = pos.coords;
          const val = formatLatLng(latitude, longitude);

          setGpsAuto(val);
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
  };

  /* Pick image */
  const pickImage = () => {
    launchImageLibrary({mediaType: 'photo', quality: 0.7}, res => {
      if (res.assets?.[0]?.uri) setPictureUri(res.assets[0].uri);
    });
  };

  /* Add / Edit */
  const resetForm = () => {
    setIsEdit(false);
    setEditingId(null);
    setRegisterNo(enumeration?.registerNo || '');
    setPageNo(enumeration?.pageNo || '');
    setSystemTreeId(`${enumeration?.id || 'ENUM'}-${Date.now()}`);
    setRdKm(rdRangeText);
    setTreeNo('');
    setSpecies('');
    setGirthInches('');
    setCondition('');

    // ✅ GPS reset
    setGpsAuto('');
    setGpsManual('');
    setGpsSource('');

    setRemarks('');
    setPictureUri(null);
    setAuctionYN('No');
  };

  const openAddForm = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditForm = r => {
    setIsEdit(true);
    setEditingId(r.id);
    setRegisterNo(r.registerNo || '');
    setPageNo(r.pageNo || '');
    setSystemTreeId(r.systemTreeId);
    setRdKm(r.rdKm || '');
    setTreeNo(r.treeNo || '');
    setSpecies(r.species || '');
    setGirthInches(r.girthInches || '');
    setCondition(r.condition || '');

    // ✅ If record has gps saved, put it in manual (so user can edit)
    const savedGps = r.gpsLatLong || '';
    setGpsManual(savedGps);
    setGpsAuto('');
    setGpsSource(savedGps ? 'MANUAL' : '');

    setRemarks(r.remarks || '');
    setPictureUri(r.pictureUri || null);
    setAuctionYN(r.auctionYN || 'No');
    setModalVisible(true);
  };

  // ✅ auto-fetch when modal opens (especially for Add mode)
  useEffect(() => {
    if (!modalVisible) return;
    if (isEdit) return;
    fetchLocationSmart({silent: true});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisible, isEdit]);

  const saveRecord = async () => {
    if (!treeNo) {
      Alert.alert('Missing', 'Tree No is required');
      return;
    }

    // ✅ choose final gps: manual > auto
    const finalGps = (gpsManual || '').trim() || (gpsAuto || '').trim();

    const json = await AsyncStorage.getItem(STORAGE_KEY);
    const arr = json ? JSON.parse(json) : [];

    if (isEdit && editingId) {
      const updated = arr.map(r =>
        r.id === editingId
          ? {
              ...r,
              registerNo,
              pageNo,
              rdKm,
              treeNo,
              species,
              girthInches,
              condition,
              gpsLatLong: finalGps,
              remarks,
              pictureUri,
              auctionYN,
              updatedAt: new Date().toISOString(),
            }
          : r,
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } else {
      const record = {
        id: Date.now().toString(),
        enumerationId: enumeration.id,
        registerNo,
        pageNo,
        systemTreeId,
        rdKm,
        treeNo,
        species,
        girthInches,
        condition,
        gpsLatLong: finalGps,
        remarks,
        pictureUri,
        auctionYN,
        disposal: null,
        superdari: null,
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...arr]));
    }

    setModalVisible(false);
    loadRecords();
  };

  const deleteRecord = id => {
    Alert.alert('Delete', 'Are you sure?', [
      {text: 'Cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const json = await AsyncStorage.getItem(STORAGE_KEY);
          const arr = json ? JSON.parse(json) : [];
          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(arr.filter(r => r.id !== id)),
          );
          loadRecords();
        },
      },
    ]);
  };

  /* ✅ active filter count (badge) */
  const activeFilterCount = useMemo(() => {
    const adv = Object.values(filters).filter(v => String(v || '').trim() !== '').length;
    const s = search.trim() ? 1 : 0;
    return adv + s;
  }, [filters, search]);

  const clearAll = () => {
    setSearch('');
    setFilters({
      species: '',
      condition: '',
      auctionYN: '',
      dateFrom: '',
      dateTo: '',
      kmFrom: '',
      kmTo: '',
    });
  };

  /* ✅ filter + search logic */
  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();

    const df = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00') : null;
    const dt = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59') : null;

    const kmF = filters.kmFrom !== '' ? Number(filters.kmFrom) : null;
    const kmT = filters.kmTo !== '' ? Number(filters.kmTo) : null;

    return records.filter(r => {
      if (filters.species && r.species !== filters.species) return false;
      if (filters.condition && r.condition !== filters.condition) return false;
      if (filters.auctionYN && r.auctionYN !== filters.auctionYN) return false;

      if ((df || dt) && r.createdAt) {
        const d = new Date(r.createdAt);
        if (df && d < df) return false;
        if (dt && d > dt) return false;
      } else if ((df || dt) && !r.createdAt) {
        return false;
      }

      if (kmF !== null || kmT !== null) {
        const num = extractFirstNumber(r.rdKm);
        if (num === null) return false;
        if (kmF !== null && num < kmF) return false;
        if (kmT !== null && num > kmT) return false;
      }

      if (!q) return true;
      const blob = [
        r.treeNo,
        r.species,
        r.condition,
        r.auctionYN,
        r.rdKm,
        r.girthInches,
        r.gpsLatLong,
        r.remarks,
        r.registerNo,
        r.pageNo,
        r.systemTreeId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [records, search, filters]);

  function extractFirstNumber(value) {
    if (!value) return null;
    const m = String(value).match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  }

  // ✅ status helper
  const getStatusText = r => {
    const isDisposed = !!r.disposal;
    const isSuperdari = !!r.superdari;

    if (isDisposed && isSuperdari) return 'Disposed + Superdari';
    if (isDisposed) return 'Disposed';
    if (isSuperdari) return 'Superdari';
    return 'Pending';
  };

  const shouldHidePills = r => !!r.disposal || !!r.superdari; // ✅ hide action pills once done

  return (
    <View style={styles.screen}>
      <ImageBackground source={require('../assets/images/bg.jpg')} style={styles.background}>
        <View style={styles.overlay} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{flex: 1}}>
            <Text style={styles.headerTitle}>Mature Tree</Text>
            <Text style={styles.headerSubtitle}>
              {enumeration?.division} • {enumeration?.block} • {enumeration?.year}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{paddingBottom: 110}}>
          <View style={styles.section}>
            {/* ✅ Search + Filter row (BODY) */}
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
              <Text style={styles.sectionTitle}>Saved Records</Text>
              <Text style={styles.sectionMeta}>
                {filteredRecords.length} / {records.length}
              </Text>
            </View>

            {records.length === 0 ? (
              <Text style={styles.emptyText}>No records saved yet. Tap + to add.</Text>
            ) : filteredRecords.length === 0 ? (
              <Text style={styles.emptyText}>No record matches your search/filters.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tableWrap}>
                  {/* Header Row */}
                  <View style={[styles.tr, styles.thRow]}>
                    <Text style={[styles.th, {width: 70}]}>Tree#</Text>
                    <Text style={[styles.th, {width: 110}]}>Species</Text>
                    <Text style={[styles.th, {width: 110}]}>Condition</Text>
                    <Text style={[styles.th, {width: 90}]}>Auction</Text>
                    <Text style={[styles.th, {width: 110}]}>RD/KM</Text>
                    <Text style={[styles.th, {width: 90}]}>Girth</Text>
                    <Text style={[styles.th, {width: 160}]}>GPS</Text>
                    <Text style={[styles.th, {width: 200}]}>Remarks</Text>
                    <Text style={[styles.th, {width: 260}]}>Actions</Text>
                    <Text style={[styles.th, {width: 140}]}>Status</Text>
                  </View>

                  {/* Data Rows */}
                  {filteredRecords.map((r, idx) => {
                    const statusText = getStatusText(r);
                    const hidePills = shouldHidePills(r);

                    return (
                      <View
                        key={r.id}
                        style={[styles.tr, idx % 2 === 0 ? styles.trEven : styles.trOdd]}>
                        <Text style={[styles.td, {width: 70}]} numberOfLines={1}>
                          {r.treeNo || '—'}
                        </Text>
                        <Text style={[styles.td, {width: 110}]} numberOfLines={1}>
                          {r.species || '—'}
                        </Text>
                        <Text style={[styles.td, {width: 110}]} numberOfLines={1}>
                          {r.condition || '—'}
                        </Text>
                        <Text style={[styles.td, {width: 90}]} numberOfLines={1}>
                          {r.auctionYN || '—'}
                        </Text>
                        <Text style={[styles.td, {width: 110}]} numberOfLines={1}>
                          {r.rdKm || '—'}
                        </Text>
                        <Text style={[styles.td, {width: 90}]} numberOfLines={1}>
                          {r.girthInches || '—'}
                        </Text>
                        <Text style={[styles.td, {width: 160}]} numberOfLines={1}>
                          {r.gpsLatLong || '—'}
                        </Text>
                        <Text style={[styles.td, {width: 200}]} numberOfLines={1}>
                          {r.remarks || '—'}
                        </Text>

                        <View style={[styles.actionsCell, {width: 260}]}>
                          <TouchableOpacity onPress={() => openEditForm(r)} style={styles.iconBtn}>
                            <Ionicons name="create-outline" size={18} color="#0ea5e9" />
                          </TouchableOpacity>

                          <TouchableOpacity onPress={() => deleteRecord(r.id)} style={styles.iconBtn}>
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>

                          {!hidePills && (
                            <>
                              <TouchableOpacity
                                onPress={() => navigation.navigate(DISPOSAL_ROUTE, {treeId: r.id, enumeration})}
                                style={[styles.smallPill, {backgroundColor: '#0f766e'}]}>
                                <Text style={styles.smallPillText}>Dispose</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => navigation.navigate(SUPERDARI_ROUTE, {treeId: r.id, enumeration})}
                                style={[styles.smallPill, {backgroundColor: '#7c3aed'}]}>
                                <Text style={styles.smallPillText}>Superdari</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>

                        <Text style={[styles.td, {width: 140}]} numberOfLines={1}>
                          {statusText}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {activeFilterCount > 0 && (
              <TouchableOpacity style={styles.clearAllBtn} onPress={clearAll}>
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={styles.clearAllText}>Clear Search & Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={openAddForm}>
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
              label="Species"
              value={filters.species}
              onChange={v => setFilters(prev => ({...prev, species: v}))}
              options={speciesOptions}
            />
            <DropdownRow
              label="Condition"
              value={filters.condition}
              onChange={v => setFilters(prev => ({...prev, condition: v}))}
              options={conditionOptions}
            />
            <DropdownRow
              label="Auction"
              value={filters.auctionYN}
              onChange={v => setFilters(prev => ({...prev, auctionYN: v}))}
              options={auctionOptions}
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
                  label="RD/KM From"
                  value={filters.kmFrom}
                  onChangeText={v => setFilters(prev => ({...prev, kmFrom: v}))}
                  placeholder="e.g. 10"
                  keyboardType="numeric"
                />
              </View>
              <View style={{flex: 1}}>
                <FormRow
                  label="RD/KM To"
                  value={filters.kmTo}
                  onChangeText={v => setFilters(prev => ({...prev, kmTo: v}))}
                  placeholder="e.g. 50"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
              <TouchableOpacity style={styles.filterApply} onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.filterApplyText}>Apply</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterClear}
                onPress={() =>
                  setFilters({
                    species: '',
                    condition: '',
                    auctionYN: '',
                    dateFrom: '',
                    dateTo: '',
                    kmFrom: '',
                    kmTo: '',
                  })
                }>
                <Text style={styles.filterClearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ✅ Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalRoot}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEdit ? 'Edit Mature Tree' : 'Add Mature Tree'}
                </Text>

                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>

              <KeyboardAvoidingView
                style={{flex: 1}}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
                <ScrollView
                  style={{flex: 1}}
                  contentContainerStyle={{paddingBottom: 16}}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}>
                  <FormRow label="Register No" value={registerNo} onChangeText={setRegisterNo} />
                  <FormRow label="Page No" value={pageNo} onChangeText={setPageNo} />
                  <FormRow label="RD/KM" value={rdKm} onChangeText={setRdKm} />
                  <FormRow label="Tree No" value={treeNo} onChangeText={setTreeNo} required />
                  <DropdownRow label="Species" value={species} onChange={setSpecies} options={speciesOptions} />
                  <FormRow label="Girth (inches)" value={girthInches} onChangeText={setGirthInches} />
                  <DropdownRow label="Condition" value={condition} onChange={setCondition} options={conditionOptions} />
                  <DropdownRow label="Auction" value={auctionYN} onChange={setAuctionYN} options={auctionOptions} />

                  {/* Auto GPS */}
                  <View style={styles.gpsBox}>
                    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                      <Text style={styles.gpsLabel}>Auto Coordinates</Text>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                        {!!gpsSource && (
                          <View style={styles.gpsChip}>
                            <Text style={styles.gpsChipText}>{gpsSource}</Text>
                          </View>
                        )}
                        {gpsFetching && <Text style={styles.gpsSmall}>Fetching…</Text>}
                      </View>
                    </View>

                    <Text style={styles.gpsValue}>{gpsAuto ? gpsAuto : '—'}</Text>

                    <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                      <TouchableOpacity
                        style={[styles.gpsBtn, {opacity: gpsFetching ? 0.6 : 1}]}
                        disabled={gpsFetching}
                        onPress={() => fetchLocationSmart()}>
                        <Text style={styles.gpsBtnText}>Auto Fetch</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.gpsBtnAlt}
                        onPress={() => {
                          setGpsFetching(true);
                          Geolocation.getCurrentPosition(
                            pos => {
                              const {latitude, longitude} = pos.coords;
                              setGpsAuto(formatLatLng(latitude, longitude));
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
                        <Text style={styles.gpsBtnAltText}>Use GPS</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <FormRow
                    label="Coordinates (Manual)  lat, long"
                    value={gpsManual}
                    onChangeText={t => {
                      setGpsManual(t);
                      setGpsSource(t.trim() ? 'MANUAL' : gpsSource);
                    }}
                    placeholder="e.g. 31.520370, 74.358749"
                  />

                  <View style={styles.finalGpsRow}>
                    <Text style={styles.finalGpsLabel}>Will Save:</Text>
                    <Text style={styles.finalGpsValue}>
                      {(gpsManual || '').trim() || (gpsAuto || '').trim() || '—'}
                    </Text>
                  </View>

                  <FormRow label="Remarks" value={remarks} onChangeText={setRemarks} multiline />

                  <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                    <Text style={styles.imageBtnText}>Upload Image</Text>
                  </TouchableOpacity>
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.saveBtn} onPress={saveRecord}>
                    <Text style={styles.saveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  background: {flex: 1},
  overlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,185,129,0.1)'},

  header: {padding: 20, paddingTop: 50, backgroundColor: 'rgba(16,185,129,0.85)', flexDirection: 'row', gap: 12},
  backButton: {padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.20)', marginTop: 2},
  headerTitle: {fontSize: 22, fontWeight: '800', color: '#fff'},
  headerSubtitle: {fontSize: 13, color: '#e5e7eb', marginTop: 2},

  section: {margin: 16},
  sectionHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10},
  sectionTitle: {fontSize: 18, fontWeight: '700', color: '#ffffff'},
  sectionMeta: {fontSize: 12, fontWeight: '800', color: '#ffffff'},
  emptyText: {fontSize: 13, color: '#6b7280'},

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

  tableWrap: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden', // ✅ keep it; widths fixed so no clipping now
    backgroundColor: '#fff',
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 44,
  },
  thRow: {backgroundColor: 'rgba(14, 165, 233, 0.15)', borderBottomWidth: 1, borderBottomColor: '#cbd5e1'},
  th: {paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, fontWeight: '800', color: '#0f172a'},
  td: {paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, fontWeight: '600', color: '#111827'},
  trEven: {backgroundColor: '#ffffff'},
  trOdd: {backgroundColor: 'rgba(2, 132, 199, 0.04)'},

  actionsCell: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10},
  iconBtn: {padding: 6, borderRadius: 10, backgroundColor: 'rgba(15,23,42,0.04)'},
  smallPill: {paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999},
  smallPillText: {color: '#fff', fontWeight: '800', fontSize: 11},

  clearAllBtn: {
    marginTop: 10,
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
    bottom: 30,
    backgroundColor: colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter modal
  actionOverlay: {flex: 1, backgroundColor: 'rgba(15,23,42,0.35)'},
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
  filterHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6},
  filterTitle: {fontSize: 16, fontWeight: '900', color: '#111827'},
  filterApply: {flex: 1, backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center'},
  filterApplyText: {color: '#fff', fontWeight: '900'},
  filterClear: {flex: 1, backgroundColor: '#f3f4f6', paddingVertical: 12, borderRadius: 12, alignItems: 'center'},
  filterClearText: {color: '#111827', fontWeight: '900'},

  // Modal
  modalRoot: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingVertical: 18},
  modalCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    height: '90%',
  },
  modalTitle: {fontSize: 18, fontWeight: '800'},
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: {color: '#111827', fontWeight: '900'},
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveText: {color: '#fff', fontWeight: '800'},

  // GPS UI
  gpsBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  gpsLabel: {fontSize: 12, fontWeight: '900', color: '#111827'},
  gpsValue: {marginTop: 6, fontSize: 14, fontWeight: '700', color: '#111827'},
  gpsSmall: {fontSize: 12, color: '#6b7280', fontWeight: '700'},
  gpsChip: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  gpsChipText: {fontSize: 11, fontWeight: '900', color: '#065f46'},

  gpsBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  gpsBtnText: {color: '#fff', fontWeight: '900'},
  gpsBtnAlt: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  gpsBtnAltText: {color: '#fff', fontWeight: '900'},

  finalGpsRow: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  finalGpsLabel: {fontSize: 12, fontWeight: '900', color: '#111827'},
  finalGpsValue: {fontSize: 12, fontWeight: '800', color: '#111827'},

  imageBtn: {
    marginTop: 10,
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  imageBtnText: {color: '#fff', fontWeight: '700'},
});

