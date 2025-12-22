import React, {useState, useEffect} from 'react';
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

/* ===================== MAIN SCREEN ===================== */
export default function AddTreeScreen({navigation}) {
  const [enumModalVisible, setEnumModalVisible] = useState(false);
  const [enumerations, setEnumerations] = useState([]);

  // ✅ NEW: Action modal for selected enumeration row
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedEnum, setSelectedEnum] = useState(null);

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

  const getSideOptions = type => {
    if (type === 'Road') return ['Left', 'Right', 'Both', 'Median']; // L,R,Both,M
    if (type === 'Rail') return ['Left', 'Right'];                  // L,R
    if (type === 'Canal') return ['Left', 'Right'];                 // L,R
    return [];
  };

  const rdKmLabelFrom = () => (linearType === 'Canal' ? 'RDs for Canal' : 'KMs for Road and Rail');
  const rdKmLabelTo = () => (linearType === 'Canal' ? 'RDs/KMs To' : 'RDs/KMs To');

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

  const handleCategoryPress = (type, item) => {
    if (!item) return;

    if (type === 'Mature Tree') {
      navigation.navigate('MatureTreeRecords', {enumeration: item});
      return;
    }
    if (type === 'Pole Crop') {
      navigation.navigate('PoleCropRecords', {enumeration: item});
      return;
    }
    if (type === 'Afforestation') {
      navigation.navigate('AfforestationRecords', {enumeration: item});
      return;
    }
    if (type === 'Disposed') {
      navigation.navigate('Disposal', {enumeration: item});
      return;
    }
  };

  const sideLabel =
    linearType === 'Road'
      ? 'Side (Left / Right / Both / Median)'
      : 'Side (Left / Right)';

  // ✅ NEW: When user taps table row
  const openRowActions = item => {
    setSelectedEnum(item);
    setActionModalVisible(true);
  };

  return (
    <View style={styles.screen}>
      <ImageBackground source={require('../assets/images/bg.jpg')} style={styles.background} resizeMode="cover">
        <View style={styles.overlay} />

        {/* Fixed Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Tree Enumeration</Text>
            <Text style={styles.headerSubtitle}>Enumeration header details (offline)</Text>
          </View>
        </View>

        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.enumListSection}>
              <Text style={styles.sectionTitle}>Enumeration Forms</Text>

              {enumerations.length === 0 ? (
                <Text style={styles.emptyText}>
                  No enumeration forms saved yet. Tap the + button to add one.
                </Text>
              ) : (
                // ✅ TABLE (Horizontal + Vertical scroll-friendly)
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.tableWrap}>
                    {/* Header Row */}
                    <View style={[styles.tr, styles.thRow]}>
                      <Text style={[styles.th, {width: 90}]}>Zone</Text>
                      <Text style={[styles.th, {width: 90}]}>Circle</Text>
                      <Text style={[styles.th, {width: 110}]}>Division</Text>
                      <Text style={[styles.th, {width: 120}]}>Range</Text>
                      <Text style={[styles.th, {width: 90}]}>Block</Text>
                      <Text style={[styles.th, {width: 90}]}>Beat</Text>
                      <Text style={[styles.th, {width: 95}]}>Year</Text>
                      <Text style={[styles.th, {width: 90}]}>Type</Text>
                      <Text style={[styles.th, {width: 90}]}>Side</Text>
                      <Text style={[styles.th, {width: 110}]}>RD/KM</Text>
                      <Text style={[styles.th, {width: 120}]}>Remarks</Text>
                      <Text style={[styles.th, {width: 90}]}>Open</Text>
                    </View>

                    {/* Data Rows */}
                    {enumerations.map((item, idx) => {
                      const rdText =
                        item.rdFrom || item.rdTo
                          ? `${item.rdFrom || '—'} → ${item.rdTo || '—'}`
                          : '—';

                      return (
                        <TouchableOpacity
                          key={item.id}
                          activeOpacity={0.85}
                          onPress={() => openRowActions(item)}
                          style={[
                            styles.tr,
                            idx % 2 === 0 ? styles.trEven : styles.trOdd,
                          ]}>
                          <Text style={[styles.td, {width: 90}]} numberOfLines={1}>{item.zone || '—'}</Text>
                          <Text style={[styles.td, {width: 90}]} numberOfLines={1}>{item.circle || '—'}</Text>
                          <Text style={[styles.td, {width: 110}]} numberOfLines={1}>{item.division || '—'}</Text>
                          <Text style={[styles.td, {width: 120}]} numberOfLines={1}>{item.subDivision || '—'}</Text>
                          <Text style={[styles.td, {width: 90}]} numberOfLines={1}>{item.block || '—'}</Text>
                          <Text style={[styles.td, {width: 90}]} numberOfLines={1}>{item.beat || '—'}</Text>
                          <Text style={[styles.td, {width: 95}]} numberOfLines={1}>{item.year || '—'}</Text>
                          <Text style={[styles.td, {width: 90}]} numberOfLines={1}>{item.linearType || '—'}</Text>
                          <Text style={[styles.td, {width: 90}]} numberOfLines={1}>{item.side || '—'}</Text>
                          <Text style={[styles.td, {width: 110}]} numberOfLines={1}>{rdText}</Text>
                          <Text style={[styles.td, {width: 120}]} numberOfLines={1}>{item.remarks || '—'}</Text>

                          {/* “Open” hint */}
                          <View style={[styles.openCell, {width: 90}]}>
                            <Ionicons name="open-outline" size={18} color="#0f766e" />
                            <Text style={styles.openText}>Open</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* floating / hover button */}
        <TouchableOpacity style={styles.fab} onPress={() => setEnumModalVisible(true)}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </ImageBackground>

      {/* ✅ Row Actions Modal */}
      <Modal transparent visible={actionModalVisible} animationType="fade" onRequestClose={() => setActionModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setActionModalVisible(false)}>
          <View style={styles.actionOverlay} />
        </TouchableWithoutFeedback>

        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Select Form</Text>
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

          <TouchableOpacity style={styles.actionCancel} onPress={() => setActionModalVisible(false)}>
            <Text style={styles.actionCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Enumeration Header Modal (same as before) */}
      <Modal
        visible={enumModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEnumModalVisible(false)}>
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

              <DropdownRow
                label={sideLabel}
                value={side}
                onChange={setSide}
                options={getSideOptions(linearType)}
                required
              />

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
  overlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16, 185, 129, 0.1)'},

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
    zIndex: 10,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginRight: 12,
  },
  headerContent: {flex: 1},
  headerTitle: {fontSize: 24, fontWeight: '800', color: '#ffffff', marginBottom: 4},
  headerSubtitle: {fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '500'},

  container: {flex: 1},
  scrollView: {flex: 1},
  scrollContent: {paddingBottom: 80},

  enumListSection: {marginHorizontal: 16, marginTop: 12, marginBottom: 4},
  sectionTitle: {fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 10},
  emptyText: {fontSize: 13, color: '#6b7280', marginBottom: 8},

  // ✅ TABLE
  tableWrap: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 44,
  },
  thRow: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)', // light blue-ish
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  th: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  td: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  trEven: {backgroundColor: '#ffffff'},
  trOdd: {backgroundColor: 'rgba(2, 132, 199, 0.04)'},
  openCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  openText: {fontSize: 12, fontWeight: '800', color: '#0f766e'},

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 9,
    shadowColor: colors.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },

  // Action Modal
  actionOverlay: {flex: 1, backgroundColor: 'rgba(15,23,42,0.35)'},
  actionCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '30%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 10,
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
  actionBtnText: {fontSize: 14, fontWeight: '800', color: '#0369a1'},
  actionBtnDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  actionBtnDangerText: {color: '#b91c1c'},
  actionCancel: {alignItems: 'center', paddingVertical: 10},
  actionCancelText: {fontSize: 13, fontWeight: '800', color: '#6b7280'},

  // Dropdown + enum modal styles (same)
  dropdownContainer: {marginHorizontal: 4, marginBottom: 12},
  dropdownLabel: {fontSize: 14, color: '#374151', marginBottom: 4, fontWeight: '600'},
  required: {color: '#dc2626'},
  dropdownSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
  },
  dropdownSelectedText: {fontSize: 14, color: '#111827'},
  dropdownPlaceholder: {fontSize: 14, color: '#9ca3af'},
  dropdownModal: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '20%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  dropdownModalTitle: {fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#111827'},
  dropdownItem: {paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb'},
  dropdownItemText: {fontSize: 14, color: '#111827'},
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
  },
  modalSaveText: {fontSize: 15, fontWeight: '700', color: '#fff', marginLeft: 8},
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
  modalTitleEnum: {flex: 1, fontSize: 18, fontWeight: '800', color: '#ffffff'},
  modalCloseBtnEnum: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginLeft: 10,
  },
});
