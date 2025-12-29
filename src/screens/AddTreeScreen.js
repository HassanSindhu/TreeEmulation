// /screens/AddTreeScreen.js
import React, {useMemo, useState, useEffect} from 'react';
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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FormRow from '../components/FormRow';
import colors from '../theme/colors';

/* ---------- SINGLE-SELECT DROPDOWN ---------- */
const DropdownRow = ({label, value, options, onChange, required}) => {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.dropdownContainer}>
      <Text style={styles.dropdownLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>

      <TouchableOpacity style={styles.dropdownSelected} onPress={() => setOpen(true)}>
        <Text style={value ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
          {value || 'Select...'}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#6b7280" />
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={styles.dropdownModal}>
          <Text style={styles.dropdownModalTitle}>{label}</Text>
          <ScrollView style={{maxHeight: 260}}>
            {options.map(opt => (
              <TouchableOpacity
                key={opt}
                style={styles.dropdownItem}
                onPress={() => {
                  onChange(opt);
                  setOpen(false);
                }}>
                <Text style={styles.dropdownItemText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

export default function AddTreeScreen({navigation}) {
  const [enumModalVisible, setEnumModalVisible] = useState(false);
  const [enumerations, setEnumerations] = useState([]);

  // Row actions modal
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedEnum, setSelectedEnum] = useState(null);

  // ✅ Search (body)
  const [search, setSearch] = useState('');

  // ✅ Filters
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    linearType: '',   // Road/Rail/Canal
    circle: '',
    block: '',
    dateFrom: '',     // YYYY-MM-DD
    dateTo: '',       // YYYY-MM-DD
    kmFrom: '',       // number
    kmTo: '',         // number
  });

  // Enumeration form fields
  const [zone, setZone] = useState('');
  const [circle, setCircle] = useState('');
  const [division, setDivision] = useState('');
  const [subDivision, setSubDivision] = useState('');
  const [linearType, setLinearType] = useState('');
  const [canalName, setCanalName] = useState('');
  const [block, setBlock] = useState('');
  const [beat, setBeat] = useState('');
  const [compartment, setCompartment] = useState('');
  const [year, setYear] = useState('');
  const [side, setSide] = useState('');
  const [rdFrom, setRdFrom] = useState('');
  const [rdTo, setRdTo] = useState('');
  const [remarks, setRemarks] = useState('');

  const zoneOptions = ['Zone 1', 'Zone 2', 'Zone 3'];
  const circleOptions = ['Circle 1', 'Circle 2', 'Circle 3'];
  const divisionOptions = ['Lahore', 'Faisalabad', 'Multan'];
  const subDivisionOptions = ['Range 1', 'Range 2', 'Range 3'];
  const blockOptions = ['Block A', 'Block B', 'Block C'];
  const beatOptions = ['Beat 1', 'Beat 2', 'Beat 3'];
  const linearTypeOptions = ['Road', 'Rail', 'Canal'];

  const yearOptions = [
    '2021-22','2022-23','2023-24','2024-25','2025-26','2026-27','2027-28','2028-29','2029-30',
  ];

  // Road => Left, Right, Both, Median
  // Rail => Left, Right
  // Canal => Left, Right
  const getSideOptions = type => {
    if (type === 'Road') return ['Left', 'Right', 'Both', 'Median'];
    if (type === 'Rail') return ['Left', 'Right'];
    if (type === 'Canal') return ['Left', 'Right'];
    return [];
  };

  const rdKmLabelFrom = () => (linearType === 'Canal' ? 'RDs for Canal' : 'KMs for Road and Rail');
  const rdKmLabelTo = () => 'RDs/KMs To';

  useEffect(() => {
    const loadEnumerations = async () => {
      try {
        const json = await AsyncStorage.getItem('ENUMERATION_FORMS');
        if (json) setEnumerations(JSON.parse(json));
      } catch (e) {
        console.warn('Failed to load enumerations', e);
      }
    };
    loadEnumerations();
  }, []);

  const persistEnumerations = async updated => {
    try {
      await AsyncStorage.setItem('ENUMERATION_FORMS', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save enumerations', e);
    }
  };

  const saveEnumerationForm = async () => {
    if (!zone || !circle || !division || !subDivision || !linearType || !block || !beat || !year || !side) {
      Alert.alert('Missing data', 'Please fill all required dropdown fields.');
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      zone,
      circle,
      division,
      subDivision,
      linearType,
      canalName,
      block,
      beat,
      compartment,
      year,
      side,
      rdFrom,
      rdTo,
      remarks,
      createdAt: new Date().toISOString(),
    };

    const updated = [newItem, ...enumerations];
    setEnumerations(updated);
    await persistEnumerations(updated);

    // reset
    setZone('');
    setCircle('');
    setDivision('');
    setSubDivision('');
    setLinearType('');
    setCanalName('');
    setBlock('');
    setBeat('');
    setCompartment('');
    setYear('');
    setSide('');
    setRdFrom('');
    setRdTo('');
    setRemarks('');
    setEnumModalVisible(false);

    Alert.alert('Saved', 'Enumeration header has been saved offline.');
  };

  const navTo = (screen, params) => {
    const parentNav = navigation.getParent?.();
    (parentNav || navigation).navigate(screen, params);
  };

  const handleCategoryPress = (type, item) => {
    if (!item) return;

    if (type === 'Mature Tree') return navTo('MatureTreeRecords', {enumeration: item});
    if (type === 'Pole Crop') return navTo('PoleCropRecords', {enumeration: item});
    if (type === 'Afforestation') return navTo('AfforestationRecords', {enumeration: item});
    if (type === 'disposal') return navTo('Disposal', {enumeration: item});
    if (type === 'Superdari') return navTo('Superdari', {enumeration: item});
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

  // ✅ Active filters count (badge)
  const activeFilterCount = useMemo(() => {
    const adv = Object.values(filters).filter(v => String(v || '').trim() !== '').length;
    const s = search.trim() ? 1 : 0;
    return adv + s;
  }, [filters, search]);

  const clearAllFilters = () => {
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
  };

  // ✅ Filtering logic
  const filteredEnumerations = useMemo(() => {
    const q = search.trim().toLowerCase();

    // parse filter dates (YYYY-MM-DD)
    const df = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00') : null;
    const dt = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59') : null;

    const kmF = filters.kmFrom !== '' ? Number(filters.kmFrom) : null;
    const kmT = filters.kmTo !== '' ? Number(filters.kmTo) : null;

    return enumerations.filter(item => {
      // Type
      if (filters.linearType && item.linearType !== filters.linearType) return false;

      // Circle
      if (filters.circle && item.circle !== filters.circle) return false;

      // Block
      if (filters.block && item.block !== filters.block) return false;

      // Date range (createdAt)
      if ((df || dt) && item.createdAt) {
        const itemDate = new Date(item.createdAt);
        if (df && itemDate < df) return false;
        if (dt && itemDate > dt) return false;
      } else if ((df || dt) && !item.createdAt) {
        return false;
      }

      // KM/RD range based on item.rdFrom & item.rdTo
      if (kmF !== null || kmT !== null) {
        const a = item.rdFrom !== '' && item.rdFrom != null ? Number(item.rdFrom) : null;
        const b = item.rdTo !== '' && item.rdTo != null ? Number(item.rdTo) : null;

        // if filter applied but item has no km -> reject
        if (a === null && b === null) return false;

        const itemFrom = a !== null ? a : b;
        const itemTo = b !== null ? b : a;

        // normalize
        const minV = Math.min(itemFrom, itemTo);
        const maxV = Math.max(itemFrom, itemTo);

        if (kmF !== null && maxV < kmF) return false;
        if (kmT !== null && minV > kmT) return false;
      }

      // Search
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
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [enumerations, search, filters]);

  const sideLabel =
    linearType === 'Road'
      ? 'Side (Left / Right / Both / Median)'
      : 'Side (Left / Right)';

  return (
    <View style={styles.screen}>
      <ImageBackground source={require('../assets/images/bg.jpg')} style={styles.background} resizeMode="cover">
        <View style={styles.overlay} />

        {/* ✅ CLEAN HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{flex: 1}}>
            <Text style={styles.headerTitle}>Guard Site Information</Text>
            <Text style={styles.headerSubtitle}>Sites</Text>
          </View>
        </View>

        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={{paddingBottom: 110}} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>

              {/* ✅ SEARCH + FILTER BUTTON (BODY میں) */}
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

              {/* Summary row */}
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Guard Enumeration Forms</Text>
                <Text style={styles.sectionMeta}>
                  {filteredEnumerations.length} / {enumerations.length}
                </Text>
              </View>

              {enumerations.length === 0 ? (
                <Text style={styles.emptyText}>
                  No enumeration forms saved yet. Tap the + button to add one.
                </Text>
              ) : filteredEnumerations.length === 0 ? (
                <Text style={styles.emptyText}>
                  No record matches your search/filters.
                </Text>
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
                        {item.linearType} • {item.side} • Block {item.block} • Beat {item.beat}
                      </Text>

                      {(item.rdFrom || item.rdTo) ? (
                        <Text style={styles.cardHint}>
                          {item.linearType === 'Canal'
                            ? `RDs: ${item.rdFrom || '—'} → ${item.rdTo || '—'}`
                            : `KMs: ${item.rdFrom || '—'} → ${item.rdTo || '—'}`}
                        </Text>
                      ) : null}

                      {item.remarks ? (
                        <Text style={styles.cardHint} numberOfLines={1}>
                          Remarks: {item.remarks}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.cardRight}>
                      <View style={styles.typeIconWrap}>
                        <Ionicons name={iconForType(item.linearType)} size={22} color={colors.primary} />
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                    </View>
                  </TouchableOpacity>
                ))
              )}

              {/* Optional: clear filters quick */}
              {(activeFilterCount > 0) && (
                <TouchableOpacity style={styles.clearAllBtn} onPress={clearAllFilters}>
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                  <Text style={styles.clearAllText}>Clear Search & Filters</Text>
                </TouchableOpacity>
              )}

            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* FAB */}
        <TouchableOpacity style={styles.fab} onPress={() => setEnumModalVisible(true)}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </ImageBackground>

      {/* ✅ Filters Modal */}
      <Modal transparent visible={filterModalVisible} animationType="fade" onRequestClose={() => setFilterModalVisible(false)}>
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
              value={filters.linearType}
              onChange={v => setFilters(prev => ({...prev, linearType: v}))}
              options={linearTypeOptions}
              required={false}
            />

            <DropdownRow
              label="Circle"
              value={filters.circle}
              onChange={v => setFilters(prev => ({...prev, circle: v}))}
              options={circleOptions}
              required={false}
            />

            <DropdownRow
              label="Block"
              value={filters.block}
              onChange={v => setFilters(prev => ({...prev, block: v}))}
              options={blockOptions}
              required={false}
            />

            {/* Date range */}
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

            {/* KM/RD range */}
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
      <Modal transparent visible={actionModalVisible} animationType="fade" onRequestClose={() => setActionModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setActionModalVisible(false)}>
          <View style={styles.actionOverlay} />
        </TouchableWithoutFeedback>

        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Select Action</Text>
          <Text style={styles.actionSub}>
            {selectedEnum ? `${selectedEnum.division} • ${selectedEnum.subDivision} • ${selectedEnum.year}` : ''}
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
              handleCategoryPress('Disposed', selectedEnum);
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

      {/* ✅ Enumeration Header Modal */}
      <Modal visible={enumModalVisible} animationType="slide" transparent onRequestClose={() => setEnumModalVisible(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderEnum}>
              <Text style={styles.modalTitleEnum}>Enumeration Form</Text>

              <TouchableOpacity onPress={() => setEnumModalVisible(false)} style={styles.modalCloseBtnEnum}>
                <Ionicons name="close" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <DropdownRow label="Zone" value={zone} onChange={setZone} options={zoneOptions} required />
              <DropdownRow label="Circle" value={circle} onChange={setCircle} options={circleOptions} required />
              <DropdownRow label="Division" value={division} onChange={setDivision} options={divisionOptions} required />
              <DropdownRow label="S.Division / Range" value={subDivision} onChange={setSubDivision} options={subDivisionOptions} required />

              <DropdownRow
                label="Type of Linear Plantation (Road/Rail/Canal)"
                value={linearType}
                onChange={val => {
                  setLinearType(val);
                  setSide('');
                }}
                options={linearTypeOptions}
                required
              />

              <FormRow label="Name of Canal/Road/Site" value={canalName} onChangeText={setCanalName} placeholder="Enter name" />

              <DropdownRow label="Block" value={block} onChange={setBlock} options={blockOptions} required />
              <DropdownRow label="Beat" value={beat} onChange={setBeat} options={beatOptions} required />

              <FormRow label="Compartment (Optional)" value={compartment} onChangeText={setCompartment} placeholder="Enter compartment (if any)" />

              <DropdownRow label="Year (Ex 2021-22)" value={year} onChange={setYear} options={yearOptions} required />

              <DropdownRow label={sideLabel} value={side} onChange={setSide} options={getSideOptions(linearType)} required />

              <FormRow label={`${rdKmLabelFrom()} (From)`} value={rdFrom} onChangeText={setRdFrom} placeholder="From" keyboardType="numeric" />
              <FormRow label={`${rdKmLabelTo()} (To)`} value={rdTo} onChangeText={setRdTo} placeholder="To" keyboardType="numeric" />

              <FormRow label="Remarks" value={remarks} onChangeText={setRemarks} placeholder="Enter remarks" multiline />

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

  // Clean header
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

  // Search + filter row
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

  sectionHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10},
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

  // overlays + modals
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
  actionBtnDanger: {backgroundColor: 'rgba(239, 68, 68, 0.10)', borderColor: 'rgba(239, 68, 68, 0.25)'},
  actionBtnDangerText: {color: '#b91c1c'},
  actionBtnWarn: {backgroundColor: 'rgba(245, 158, 11, 0.10)', borderColor: 'rgba(245, 158, 11, 0.25)'},
  actionBtnWarnText: {color: '#b45309'},
  actionCancel: {alignItems: 'center', paddingVertical: 10},
  actionCancelText: {fontSize: 13, fontWeight: '900', color: '#6b7280'},

  // filter modal
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

  // dropdowns
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

  // add enumeration modal
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
