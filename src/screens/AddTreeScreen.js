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

      <TouchableOpacity
        style={styles.dropdownSelected}
        onPress={() => setOpen(true)}>
        <Text style={value ? styles.dropdownSelectedText : styles.dropdownPlaceholder}>
          {value || 'Select...'}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#6b7280" />
      </TouchableOpacity>

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
  /* -------- enumeration modal + list states -------- */
  const [enumModalVisible, setEnumModalVisible] = useState(false);
  const [enumerations, setEnumerations] = useState([]);

  // Enumeration form fields (header)
  const [division, setDivision] = useState('');
  const [subDivision, setSubDivision] = useState('');
  const [block, setBlock] = useState('');
  const [year, setYear] = useState('');
  const [beat, setBeat] = useState('');

  // Type of Linear Plantation + Side
  const [linearType, setLinearType] = useState(''); // Road | Rail | Canal
  const [side, setSide] = useState('');

  // Other header fields
  const [registerNo, setRegisterNo] = useState('');
  const [pageNo, setPageNo] = useState('');
  const [canalName, setCanalName] = useState(''); // Name of Canal / Road / Site
  const [siteName, setSiteName] = useState('');
  const [compartment, setCompartment] = useState('');
  const [rdFrom, setRdFrom] = useState('');
  const [rdTo, setRdTo] = useState('');
  const [remarks, setRemarks] = useState('');

  /* --------- dropdown options --------- */
  const divisionOptions = ['Lahore', 'Faisalabad', 'Multan'];
  const subDivisionOptions = ['Range 1', 'Range 2', 'Range 3'];
  const blockOptions = ['Block A', 'Block B', 'Block C'];
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
  const beatOptions = ['Beat 1', 'Beat 2', 'Beat 3'];

  const linearTypeOptions = ['Road', 'Rail', 'Canal'];

  const getSideOptions = type => {
    // As you requested:
    // Road => Left, Right, Both (you also had M, but you said only Left/Right/Both for road)
    if (type === 'Road') return ['Left', 'Right', 'Both','Median'];
    // Rail & Canal => Left, Right
    if (type === 'Rail' || type === 'Canal') return ['Left', 'Right'];
    return [];
  };

  /* --------- Load saved enumeration headers --------- */
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

  /* ------------- enumeration header save ------------- */
  const saveEnumerationForm = async () => {
    if (!division || !subDivision || !block || !year || !beat || !linearType || !side) {
      Alert.alert('Missing data', 'Please fill all required dropdown fields.');
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      division,
      subDivision,
      block,
      year,
      beat,
      linearType,
      side,
      registerNo,
      pageNo,
      canalName,
      siteName,
      compartment,
      rdFrom,
      rdTo,
      remarks,
      createdAt: new Date().toISOString(),
    };

    const updated = [newItem, ...enumerations];
    setEnumerations(updated);
    await persistEnumerations(updated);

    // Clear header form
    setDivision('');
    setSubDivision('');
    setBlock('');
    setYear('');
    setBeat('');
    setLinearType('');
    setSide('');
    setRegisterNo('');
    setPageNo('');
    setCanalName('');
    setSiteName('');
    setCompartment('');
    setRdFrom('');
    setRdTo('');
    setRemarks('');
    setEnumModalVisible(false);

    Alert.alert('Saved', 'Enumeration header has been saved offline.');
  };

  /* ------------- tap handlers for category screens ------------- */
  const handleCategoryPress = (type, item) => {
    // Pass enumeration to record screens
    if (type === 'Mature Tree') {
      navigation.navigate('MatureTreeRecords', {enumeration: item});
    } else if (type === 'Pole Crop') {
      navigation.navigate('PoleCropRecords', {enumeration: item});
    } else if (type === 'Afforestation') {
      navigation.navigate('AfforestationRecords', {enumeration: item});
    }
  };

  /* ===================== RENDER ===================== */
  return (
    <View style={styles.screen}>
      <ImageBackground
        source={require('../assets/images/bg.jpg')}
        style={styles.background}
        resizeMode="cover">
        <View style={styles.overlay} />

        {/* Fixed Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Tree Enumeration</Text>
            <Text style={styles.headerSubtitle}>Enumeration header details (offline)</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* Enumeration cards list */}
            <View style={styles.enumListSection}>
              <Text style={styles.sectionTitle}>Enumeration Forms</Text>

              {enumerations.length === 0 && (
                <Text style={styles.emptyText}>
                  No enumeration forms saved yet. Tap the + button to add one.
                </Text>
              )}

              {enumerations.map(item => (
                <View key={item.id} style={styles.enumCard}>
                  <Text style={styles.enumTitle}>
                    {item.division} - {item.block}
                  </Text>

                  <Text style={styles.enumMeta}>
                    Year: {item.year} • Beat: {item.beat}
                    {item.linearType ? ` • ${item.linearType}` : ''} • Side: {item.side}
                  </Text>

                  {(item.canalName || item.siteName) && (
                    <Text style={styles.enumMeta}>
                      {item.canalName || '—'}
                      {item.siteName ? ` | ${item.siteName}` : ''}
                    </Text>
                  )}

                  {(item.rdFrom || item.rdTo) && (
                    <Text style={styles.enumMeta}>
                      {item.linearType === 'Canal' ? 'RD' : 'KM'}: {item.rdFrom || '—'} →{' '}
                      {item.rdTo || '—'}
                    </Text>
                  )}

                  {item.compartment ? (
                    <Text style={styles.enumMeta}>Compartment: {item.compartment}</Text>
                  ) : null}

                  {/* Action buttons */}
                  <View style={styles.enumActionsRow}>
                    <TouchableOpacity
                      style={styles.enumActionBtn}
                      onPress={() => handleCategoryPress('Mature Tree', item)}>
                      <Text style={styles.enumActionText}>Mature Tree</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.enumActionBtn}
                      onPress={() => handleCategoryPress('Pole Crop', item)}>
                      <Text style={styles.enumActionText}>Pole Crop</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.enumActionBtn}
                      onPress={() => handleCategoryPress('Afforestation', item)}>
                      <Text style={styles.enumActionText}>Afforestation</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* floating / hover button */}
        <TouchableOpacity style={styles.fab} onPress={() => setEnumModalVisible(true)}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </ImageBackground>

      {/* Enumeration Header Modal */}
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
              <DropdownRow
                label="Division"
                value={division}
                onChange={setDivision}
                options={divisionOptions}
                required
              />

              <DropdownRow
                label="S. Division / Range"
                value={subDivision}
                onChange={setSubDivision}
                options={subDivisionOptions}
                required
              />

              <FormRow
                label="Name of Canal/Road/Site"
                value={canalName}
                onChangeText={setCanalName}
                placeholder="Enter Canal/Road/Site name"
              />

              <DropdownRow
                label="Block"
                value={block}
                onChange={setBlock}
                options={blockOptions}
                required
              />

              <DropdownRow
                label="Beat"
                value={beat}
                onChange={setBeat}
                options={beatOptions}
                required
              />

              <FormRow
                label="Compartment (Optional)"
                value={compartment}
                onChangeText={setCompartment}
                placeholder="Enter compartment (if any)"
              />

              <DropdownRow
                label="Year (Ex 2021-22)"
                value={year}
                onChange={setYear}
                options={yearOptions}
                required
              />

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

              <DropdownRow
                label={
                  linearType === 'Road'
                    ? 'Side (Road)'
                    : linearType === 'Rail'
                    ? 'Side (Rail)'
                    : linearType === 'Canal'
                    ? 'Side (Canal)'
                    : 'Side'
                }
                value={side}
                onChange={setSide}
                options={getSideOptions(linearType)}
                required
              />

              <FormRow
                label={linearType === 'Canal' ? 'RD From (Canal)' : 'KM From (Road/Rail)'}
                value={rdFrom}
                onChangeText={setRdFrom}
                placeholder="From"
                keyboardType="numeric"
              />

              <FormRow
                label={linearType === 'Canal' ? 'RD To (Canal)' : 'KM To (Road/Rail)'}
                value={rdTo}
                onChangeText={setRdTo}
                placeholder="To"
                keyboardType="numeric"
              />

              <FormRow
                label="Remarks"
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Any remarks"
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
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
  sectionTitle: {fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8},
  emptyText: {fontSize: 13, color: '#6b7280', marginBottom: 8},
  enumCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  enumTitle: {fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2},
  enumMeta: {fontSize: 12, color: '#6b7280'},
  enumActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 6,
  },
  enumActionBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  enumActionText: {fontSize: 12, fontWeight: '600', color: '#0369a1'},

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
  modalHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  modalTitle: {flex: 1, fontSize: 18, fontWeight: '700', color: '#ffffff'},
  modalCloseBtn: {padding: 4, borderRadius: 999},
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
  modalSaveText: {fontSize: 15, fontWeight: '700', color: '#fff'},
  modalHeaderEnum: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginLeft: -16,   // because modalCard has padding:16
    marginRight: -16,  // so header goes full width
    marginTop: -16,
    marginBottom: 12,
  },

  modalTitleEnum: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },

  modalCloseBtnEnum: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginLeft: 10,
  },

});
