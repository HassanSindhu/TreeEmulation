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
import Geolocation from '@react-native-community/geolocation';
import Slider from '@react-native-community/slider';
import {launchImageLibrary} from 'react-native-image-picker';
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
        <Text
          style={
            value ? styles.dropdownSelectedText : styles.dropdownPlaceholder
          }>
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

/* ---------- MULTI-SELECT DROPDOWN (for Pole Crop Species) ---------- */
const MultiSelectRow = ({label, values, options, onChange, required}) => {
  const [open, setOpen] = useState(false);
  const selectedText =
    values && values.length > 0 ? values.join(', ') : 'Select...';

  const toggleOption = opt => {
    if (!values) {
      onChange([opt]);
      return;
    }
    if (values.includes(opt)) {
      onChange(values.filter(v => v !== opt));
    } else {
      onChange([...values, opt]);
    }
  };

  return (
    <View style={styles.dropdownContainer}>
      <Text style={styles.dropdownLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TouchableOpacity
        style={styles.dropdownSelected}
        onPress={() => setOpen(true)}>
        <Text
          style={
            values && values.length
              ? styles.dropdownSelectedText
              : styles.dropdownPlaceholder
          }>
          {selectedText}
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
            {options.map(opt => {
              const isSelected = values?.includes(opt);
              return (
                <TouchableOpacity
                  key={opt}
                  style={styles.dropdownItem}
                  onPress={() => toggleOption(opt)}>
                  <View style={styles.multiRow}>
                    <Text style={styles.dropdownItemText}>{opt}</Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color="#16a34a"
                        style={{marginLeft: 8}}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
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

  /* -------- detail forms (Mature / Afforestation / Pole) -------- */
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailType, setDetailType] = useState(null); // 'MATURE' | 'AFFORESTATION' | 'POLE'
  const [activeEnum, setActiveEnum] = useState(null);

  // Mature Tree form
  const [mtRegisterNo, setMtRegisterNo] = useState('');
  const [mtPageNo, setMtPageNo] = useState('');
  const [mtTreeId, setMtTreeId] = useState('');
  const [mtRdKm, setMtRdKm] = useState('');
  const [mtTreeNo, setMtTreeNo] = useState('');
  const [mtSpecies, setMtSpecies] = useState('');
  const [mtGirthInches, setMtGirthInches] = useState('');
  const [mtCondition, setMtCondition] = useState('');
  const [mtGps, setMtGps] = useState('');
  const [mtRemarks, setMtRemarks] = useState('');
  const [mtPictureUri, setMtPictureUri] = useState(null);

  // Pole Crop form
  const [pcRegisterNo, setPcRegisterNo] = useState('');
  const [pcPageNo, setPcPageNo] = useState('');
  const [pcTreeId, setPcTreeId] = useState('');
  const [pcRdKm, setPcRdKm] = useState('');
  const [pcSpecies, setPcSpecies] = useState([]); // multi-select
  const [pcCount, setPcCount] = useState('');
  const [pcGps, setPcGps] = useState('');
  const [pcRemarks, setPcRemarks] = useState('');

  // Afforestation form
  const [afRegisterNo, setAfRegisterNo] = useState('');
  const [afPageNo, setAfPageNo] = useState('');
  const [afAvgMilesKm, setAfAvgMilesKm] = useState('');
  const [afSuccess, setAfSuccess] = useState(0); // slider 0–100
  const [afMainSpecies, setAfMainSpecies] = useState('');
  const [afYear, setAfYear] = useState('');
  const [afSchemeType, setAfSchemeType] = useState('');
  const [afProjectName, setAfProjectName] = useState('');
  const [afNonDevScheme, setAfNonDevScheme] = useState('');
  const [afPlants, setAfPlants] = useState('');
  const [afGpsList, setAfGpsList] = useState(['']); // multiple coordinates
  const [afRemarks, setAfRemarks] = useState('');
  const [afPictureUri, setAfPictureUri] = useState(null);

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

  const schemeOptions = ['Development', 'Non Development'];

  const nonDevOptions = [
    '1% Plantation',
    'Replenishment',
    'Gap Filling',
    'Other',
  ];

  const linearTypeOptions = ['Road', 'Rail', 'Canal'];

  const getSideOptions = type => {
    if (type === 'Road') return ['L', 'R', 'Both', 'M'];
    if (type === 'Rail' || type === 'Canal') return ['L', 'R'];
    return [];
  };

  // Common species & condition options
  const speciesOptions = [
    'Shisham',
    'Kikar',
    'Sufaida',
    'Siris',
    'Neem',
    'Other',
  ];
  const conditionOptions = [
    'Green Standing',
    'Green Fallen',
    'Dry',
    'Leaning',
    'Dead',
    'Hollow',
    'Fallen',
    'Rotten',
    'Fire Burnt',
    'Forked',
    '1/4',
    '1/2',
  ];

  /* --------- Load saved enumeration headers --------- */
  useEffect(() => {
    const loadEnumerations = async () => {
      try {
        const json = await AsyncStorage.getItem('ENUMERATION_FORMS');
        if (json) {
          setEnumerations(JSON.parse(json));
        }
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
    if (
      !division ||
      !subDivision ||
      !block ||
      !year ||
      !beat ||
      !linearType ||
      !side
    ) {
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

  /* ---------------- helpers ---------------- */
  const resetDetailForms = () => {
    // Mature
    setMtRegisterNo('');
    setMtPageNo('');
    setMtTreeId('');
    setMtRdKm('');
    setMtTreeNo('');
    setMtSpecies('');
    setMtGirthInches('');
    setMtCondition('');
    setMtGps('');
    setMtRemarks('');
    setMtPictureUri(null);

    // Pole
    setPcRegisterNo('');
    setPcPageNo('');
    setPcTreeId('');
    setPcRdKm('');
    setPcSpecies([]);
    setPcCount('');
    setPcGps('');
    setPcRemarks('');

    // Afforestation
    setAfRegisterNo('');
    setAfPageNo('');
    setAfAvgMilesKm('');
    setAfSuccess(0);
    setAfMainSpecies('');
    setAfYear('');
    setAfSchemeType('');
    setAfProjectName('');
    setAfNonDevScheme('');
    setAfPlants('');
    setAfGpsList(['']);
    setAfRemarks('');
    setAfPictureUri(null);
  };

  const openDetailForm = (type, enumeration) => {
    setActiveEnum(enumeration);
    setDetailType(type);
    resetDetailForms();

    if (enumeration) {
      const rdRangeText =
        enumeration.rdFrom && enumeration.rdTo
          ? `${enumeration.rdFrom} - ${enumeration.rdTo}`
          : enumeration.rdFrom || enumeration.rdTo || '';

      if (type === 'MATURE') {
        setMtRegisterNo(enumeration.registerNo || '');
        setMtPageNo(enumeration.pageNo || '');
        setMtRdKm(rdRangeText);
        setMtTreeId(`${enumeration.id || 'ENUM'}-${Date.now()}`);
      } else if (type === 'POLE') {
        setPcRegisterNo(enumeration.registerNo || '');
        setPcPageNo(enumeration.pageNo || '');
        setPcRdKm(rdRangeText);
        setPcTreeId(`${enumeration.id || 'ENUM'}-${Date.now()}`);
      } else if (type === 'AFFORESTATION') {
        setAfRegisterNo(enumeration.registerNo || '');
        setAfPageNo(enumeration.pageNo || '');
      }
    }

    setDetailModalVisible(true);
  };

  const appendRecord = async (key, record) => {
    try {
      const old = await AsyncStorage.getItem(key);
      const arr = old ? JSON.parse(old) : [];
      const updated = [record, ...arr];
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save records for', key, e);
    }
  };

  /* --------- GPS fetch (Mature / Pole / Afforestation) --------- */
  const fetchGpsCoords = () => {
    Geolocation.getCurrentPosition(
      pos => {
        const {latitude, longitude} = pos.coords;
        const value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

        if (detailType === 'MATURE') {
          setMtGps(value);
        } else if (detailType === 'POLE') {
          setPcGps(value);
        } else if (detailType === 'AFFORESTATION') {
          setAfGpsList(prev => {
            if (!prev || prev.length === 0) return [value];
            const copy = [...prev];
            copy[copy.length - 1] = value; // fill last field
            return copy;
          });
        }
      },
      error => {
        Alert.alert('Location Error', error.message);
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  /* --------- Image pickers --------- */
  const handlePickMatureImage = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.7,
      },
      response => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert(
            'Image Error',
            response.errorMessage || 'Could not pick image',
          );
          return;
        }
        const asset = response.assets && response.assets[0];
        if (asset?.uri) {
          setMtPictureUri(asset.uri);
        }
      },
    );
  };

  const handlePickAfforestationImage = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.7,
      },
      response => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert(
            'Image Error',
            response.errorMessage || 'Could not pick image',
          );
          return;
        }
        const asset = response.assets && response.assets[0];
        if (asset?.uri) {
          setAfPictureUri(asset.uri);
        }
      },
    );
  };

  /* ------------- save Mature Tree record ------------- */
  const saveMatureTree = async () => {
    if (!mtRdKm || !mtTreeNo) {
      Alert.alert('Missing data', 'Please enter RD/KM and Tree No.');
      return;
    }
    if (!activeEnum?.id) {
      Alert.alert('Error', 'No parent enumeration selected.');
      return;
    }

    const record = {
      id: Date.now().toString(),
      enumerationId: activeEnum.id,
      registerNo: mtRegisterNo,
      pageNo: mtPageNo,
      systemTreeId: mtTreeId,
      rdKm: mtRdKm,
      treeNo: mtTreeNo,
      species: mtSpecies,
      girthInches: mtGirthInches,
      condition: mtCondition,
      gpsLatLong: mtGps,
      remarks: mtRemarks,
      pictureUri: mtPictureUri,
      createdAt: new Date().toISOString(),
    };

    await appendRecord('MATURE_TREE_RECORDS', record);
    setDetailModalVisible(false);
    Alert.alert('Saved', 'Mature Tree record saved offline.');
  };

  /* ------------- save Pole Crop record ------------- */
  const savePoleCrop = async () => {
    if (!pcRdKm || !pcCount) {
      Alert.alert('Missing data', 'Please enter RD/KM and Count.');
      return;
    }
    if (!activeEnum?.id) {
      Alert.alert('Error', 'No parent enumeration selected.');
      return;
    }

    const record = {
      id: Date.now().toString(),
      enumerationId: activeEnum.id,
      registerNo: pcRegisterNo,
      pageNo: pcPageNo,
      systemTreeId: pcTreeId,
      rdKm: pcRdKm,
      species: pcSpecies, // array of strings
      count: pcCount,
      gpsLatLong: pcGps,
      remarks: pcRemarks,
      createdAt: new Date().toISOString(),
    };

    await appendRecord('POLE_CROP_RECORDS', record);
    setDetailModalVisible(false);
    Alert.alert('Saved', 'Pole Crop record saved offline.');
  };

  /* ------------- save Afforestation record ------------- */
  const saveAfforestation = async () => {
    if (!afAvgMilesKm || !afYear) {
      Alert.alert('Missing data', 'Please fill Av. Miles/KM and Year.');
      return;
    }
    if (!activeEnum?.id) {
      Alert.alert('Error', 'No parent enumeration selected.');
      return;
    }

    const cleanGpsList = afGpsList.map(g => g.trim()).filter(g => g.length > 0);

    const record = {
      id: Date.now().toString(),
      enumerationId: activeEnum.id,
      registerNo: afRegisterNo,
      pageNo: afPageNo,
      avgMilesKm: afAvgMilesKm,
      successPercent: afSuccess, // numeric 0–100
      mainSpecies: afMainSpecies,
      year: afYear,
      schemeType: afSchemeType,
      projectName: afProjectName,
      nonDevScheme: afNonDevScheme,
      noOfPlants: afPlants,
      gpsBoundingBox: cleanGpsList, // array of coordinates
      remarks: afRemarks,
      pictureUri: afPictureUri,
      createdAt: new Date().toISOString(),
    };

    await appendRecord('AFFORESTATION_RECORDS', record);
    setDetailModalVisible(false);
    Alert.alert('Saved', 'Afforestation record saved offline.');
  };

  /* ------------- tap handlers for card buttons ------------- */
  const handleCategoryPress = (type, item) => {
    if (type === 'Mature Tree') {
      openDetailForm('MATURE', item);
    } else if (type === 'Afforestation') {
      openDetailForm('AFFORESTATION', item);
    } else if (type === 'Pole Crop') {
      openDetailForm('POLE', item);
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
            <Text style={styles.headerSubtitle}>
              Enumeration header details (offline)
            </Text>
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
                    Year: {item.year} • Beat: {item.beat}{' '}
                    {item.linearType ? `• ${item.linearType}` : ''} • Side:{' '}
                    {item.side}
                  </Text>
                  {(item.canalName || item.siteName) && (
                    <Text style={styles.enumMeta}>
                      {item.canalName || '—'}
                      {item.siteName ? ` | ${item.siteName}` : ''}
                    </Text>
                  )}
                  {(item.rdFrom || item.rdTo) && (
                    <Text style={styles.enumMeta}>
                      RD/KM: {item.rdFrom || '—'} → {item.rdTo || '—'}
                    </Text>
                  )}
                  {item.compartment ? (
                    <Text style={styles.enumMeta}>
                      Compartment: {item.compartment}
                    </Text>
                  ) : null}

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
                      onPress={() =>
                        handleCategoryPress('Afforestation', item)
                      }>
                      <Text style={styles.enumActionText}>Afforestation</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* floating / hover button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setEnumModalVisible(true)}>
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enumeration Form</Text>
              <TouchableOpacity
                onPress={() => setEnumModalVisible(false)}
                style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#6b7280" />
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
                    ? 'Side L/R/Both/M (Only for Road)'
                    : linearType === 'Rail' || linearType === 'Canal'
                    ? 'Side L/R'
                    : 'Side'
                }
                value={side}
                onChange={setSide}
                options={getSideOptions(linearType)}
                required
              />

              <FormRow
                label={
                  linearType === 'Canal'
                    ? 'RDs From (Canal)'
                    : linearType === 'Road' || linearType === 'Rail'
                    ? 'KMs From (Road/Rail)'
                    : 'RDs/KMs From'
                }
                value={rdFrom}
                onChangeText={setRdFrom}
                placeholder="From"
              />
              <FormRow
                label={
                  linearType === 'Canal'
                    ? 'RDs To (Canal)'
                    : linearType === 'Road' || linearType === 'Rail'
                    ? 'KMs To (Road/Rail)'
                    : 'RDs/KMs To'
                }
                value={rdTo}
                onChangeText={setRdTo}
                placeholder="To"
              />

              <FormRow
                label="Remarks"
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Any remarks"
                multiline
              />

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={saveEnumerationForm}>
                <Ionicons name="save" size={20} color="#fff" />
                <Text style={styles.modalSaveText}>Save Enumeration</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Detail Modal for Mature Tree / Pole Crop / Afforestation */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {detailType === 'MATURE'
                  ? 'Mature Tree'
                  : detailType === 'POLE'
                  ? 'Pole Crop'
                  : detailType === 'AFFORESTATION'
                  ? 'Afforestation'
                  : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setDetailModalVisible(false)}
                style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Show parent enumeration info */}
            {activeEnum && (
              <View style={styles.parentInfo}>
                <Text style={styles.parentInfoText}>
                  {activeEnum.division} • {activeEnum.block} •{' '}
                  {activeEnum.year}
                </Text>
                <Text style={styles.parentInfoText}>
                  Beat {activeEnum.beat} • {activeEnum.linearType} • Side{' '}
                  {activeEnum.side}
                </Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* -------- MATURE TREE -------- */}
              {detailType === 'MATURE' && (
                <>
                  <FormRow
                    label="Register No"
                    value={mtRegisterNo}
                    onChangeText={setMtRegisterNo}
                    placeholder="Register No"
                  />
                  <FormRow
                    label="Page No"
                    value={mtPageNo}
                    onChangeText={setMtPageNo}
                    placeholder="Page No"
                  />

                  <View style={styles.readonlyRow}>
                    <Text style={styles.readonlyLabel}>
                      System Generated Tree ID
                    </Text>
                    <Text style={styles.readonlyValue}>
                      {mtTreeId || 'Will be generated'}
                    </Text>
                  </View>

                  <FormRow
                    label="RD/KM"
                    value={mtRdKm}
                    onChangeText={setMtRdKm}
                    placeholder="RD/KM"
                    required
                  />
                  <FormRow
                    label="Tree No (RD/Km wise)"
                    value={mtTreeNo}
                    onChangeText={setMtTreeNo}
                    placeholder="Tree No"
                    required
                  />

                  <DropdownRow
                    label="Species"
                    value={mtSpecies}
                    onChange={setMtSpecies}
                    options={speciesOptions}
                  />
                  <FormRow
                    label="Girth in inches"
                    value={mtGirthInches}
                    onChangeText={setMtGirthInches}
                    placeholder="Enter girth in inches"
                    keyboardType="numeric"
                  />
                  <DropdownRow
                    label="Condition"
                    value={mtCondition}
                    onChange={setMtCondition}
                    options={conditionOptions}
                  />

                  <FormRow
                    label="GPS Coordinates LAT/Long"
                    value={mtGps}
                    onChangeText={setMtGps}
                    placeholder="31.5204, 74.3587"
                  />
                  <TouchableOpacity
                    style={styles.gpsBtn}
                    onPress={fetchGpsCoords}>
                    <Ionicons name="locate" size={18} color="#fff" />
                    <Text style={styles.gpsBtnText}>Fetch GPS</Text>
                  </TouchableOpacity>

                  <FormRow
                    label="Remarks"
                    value={mtRemarks}
                    onChangeText={setMtRemarks}
                    placeholder="Any remarks"
                    multiline
                  />

                  <View style={{marginHorizontal: 4, marginTop: 8}}>
                    <Text style={styles.dropdownLabel}>Picture</Text>

                    <TouchableOpacity
                      style={styles.imageBtn}
                      onPress={handlePickMatureImage}>
                      <Ionicons name="image" size={18} color="#fff" />
                      <Text style={styles.imageBtnText}>
                        Upload from device
                      </Text>
                    </TouchableOpacity>

                    {mtPictureUri ? (
                      <Text style={styles.imageInfoText}>Image selected</Text>
                    ) : (
                      <Text style={styles.imageInfoTextMuted}>
                        No image selected yet
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.modalSaveBtn}
                    onPress={saveMatureTree}>
                    <Ionicons name="save" size={20} color="#fff" />
                    <Text style={styles.modalSaveText}>Save Mature Tree</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* -------- POLE CROP -------- */}
              {detailType === 'POLE' && (
                <>
                  <FormRow
                    label="Register No"
                    value={pcRegisterNo}
                    onChangeText={setPcRegisterNo}
                    placeholder="Register No"
                  />
                  <FormRow
                    label="Page No"
                    value={pcPageNo}
                    onChangeText={setPcPageNo}
                    placeholder="Page No"
                  />

                  <View style={styles.readonlyRow}>
                    <Text style={styles.readonlyLabel}>
                      System Generated Tree ID
                    </Text>
                    <Text style={styles.readonlyValue}>
                      {pcTreeId || 'Will be generated'}
                    </Text>
                  </View>

                  <FormRow
                    label="RD/KM"
                    value={pcRdKm}
                    onChangeText={setPcRdKm}
                    placeholder="RD/KM"
                    required
                  />

                  <MultiSelectRow
                    label="Species"
                    values={pcSpecies}
                    onChange={setPcSpecies}
                    options={speciesOptions}
                  />

                  <FormRow
                    label="Count"
                    value={pcCount}
                    onChangeText={setPcCount}
                    placeholder="Number of poles"
                    keyboardType="numeric"
                    required
                  />

                  <FormRow
                    label="GPS Coordinates"
                    value={pcGps}
                    onChangeText={setPcGps}
                    placeholder="31.5204, 74.3587"
                  />
                  <TouchableOpacity
                    style={styles.gpsBtn}
                    onPress={fetchGpsCoords}>
                    <Ionicons name="locate" size={18} color="#fff" />
                    <Text style={styles.gpsBtnText}>Fetch GPS</Text>
                  </TouchableOpacity>

                  <FormRow
                    label="Remarks"
                    value={pcRemarks}
                    onChangeText={setPcRemarks}
                    placeholder="Any remarks"
                    multiline
                  />

                  <TouchableOpacity
                    style={styles.modalSaveBtn}
                    onPress={savePoleCrop}>
                    <Ionicons name="save" size={20} color="#fff" />
                    <Text style={styles.modalSaveText}>Save Pole Crop</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* -------- AFFORESTATION -------- */}
              {detailType === 'AFFORESTATION' && (
                <>
                  <FormRow
                    label="Register No"
                    value={afRegisterNo}
                    onChangeText={setAfRegisterNo}
                    placeholder="Register No"
                  />

                  <FormRow
                    label="Page No"
                    value={afPageNo}
                    onChangeText={setAfPageNo}
                    placeholder="Page No"
                  />

                  <FormRow
                    label="Av. Miles/ KM ="
                    value={afAvgMilesKm}
                    onChangeText={setAfAvgMilesKm}
                    placeholder="Average Miles/KM"
                    keyboardType="numeric"
                    required
                  />

                  {/* Success slider 0–100 */}
                  <View style={styles.sliderBlock}>
                    <Text style={styles.dropdownLabel}>
                      Success % (0 – 100)
                    </Text>
                    <Slider
                      style={{width: '100%', height: 40}}
                      minimumValue={0}
                      maximumValue={100}
                      step={1}
                      value={afSuccess}
                      onValueChange={setAfSuccess}
                      minimumTrackTintColor={colors.primary}
                      maximumTrackTintColor="#e5e7eb"
                      thumbTintColor={colors.primary}
                    />
                    <Text style={styles.sliderValue}>{afSuccess}%</Text>
                  </View>

                  <DropdownRow
                    label="Main Species"
                    value={afMainSpecies}
                    onChange={setAfMainSpecies}
                    options={speciesOptions}
                  />

                  <DropdownRow
                    label="Year (Ex 2021-22)"
                    value={afYear}
                    onChange={setAfYear}
                    options={yearOptions}
                    required
                  />

                  <DropdownRow
                    label="Scheme Dev/Non Development"
                    value={afSchemeType}
                    onChange={val => {
                      setAfSchemeType(val);
                      setAfProjectName('');
                      setAfNonDevScheme('');
                    }}
                    options={schemeOptions}
                    required
                  />

                  {afSchemeType === 'Development' && (
                    <FormRow
                      label="If Development → Project Name"
                      value={afProjectName}
                      onChangeText={setAfProjectName}
                      placeholder="Enter Project Name"
                    />
                  )}

                  {afSchemeType === 'Non Development' && (
                    <DropdownRow
                      label="If Non Development → Scheme"
                      value={afNonDevScheme}
                      onChange={setAfNonDevScheme}
                      options={nonDevOptions}
                    />
                  )}

                  <FormRow
                    label="No. of Plants"
                    value={afPlants}
                    onChangeText={setAfPlants}
                    placeholder="Enter No. of Plants"
                    keyboardType="numeric"
                  />

                  {/* GPS multiple coordinates with + button */}
                  <View style={{marginHorizontal: 4, marginTop: 8}}>
                    <Text style={styles.dropdownLabel}>
                      GPS Coordinates / Bounding Box
                    </Text>
                    {afGpsList.map((coord, index) => (
                      <FormRow
                        key={index}
                        label={`Coordinate ${index + 1}`}
                        value={coord}
                        onChangeText={text => {
                          const copy = [...afGpsList];
                          copy[index] = text;
                          setAfGpsList(copy);
                        }}
                        placeholder="31.5204, 74.3587"
                      />
                    ))}

                    <TouchableOpacity
                      style={styles.addCoordBtn}
                      onPress={() => setAfGpsList(prev => [...prev, ''])}>
                      <Ionicons name="add-circle-outline" size={18} color="#fff" />
                      <Text style={styles.addCoordText}>Add Coordinate</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.gpsBtn, {marginTop: 8}]}
                      onPress={fetchGpsCoords}>
                      <Ionicons name="locate" size={18} color="#fff" />
                      <Text style={styles.gpsBtnText}>Fill last with GPS</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{marginHorizontal: 4, marginTop: 12}}>
                    <Text style={styles.dropdownLabel}>Pictures</Text>

                    <TouchableOpacity
                      style={styles.imageBtn}
                      onPress={handlePickAfforestationImage}>
                      <Ionicons name="image" size={18} color="#fff" />
                      <Text style={styles.imageBtnText}>
                        Upload from device
                      </Text>
                    </TouchableOpacity>

                    {afPictureUri ? (
                      <Text style={styles.imageInfoText}>Image selected</Text>
                    ) : (
                      <Text style={styles.imageInfoTextMuted}>
                        No image selected yet
                      </Text>
                    )}
                  </View>

                  <FormRow
                    label="Remarks"
                    value={afRemarks}
                    onChangeText={setAfRemarks}
                    placeholder="Enter Remarks"
                    multiline
                  />

                  <TouchableOpacity
                    style={styles.modalSaveBtn}
                    onPress={saveAfforestation}>
                    <Ionicons name="save" size={20} color="#fff" />
                    <Text style={styles.modalSaveText}>
                      Save Afforestation
                    </Text>
                  </TouchableOpacity>
                </>
              )}
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
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
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
  dropdownLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    fontWeight: '600',
  },
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
  multiRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(15,23,42,0.3)'},

  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {backgroundColor: '#ffffff', borderRadius: 20, padding: 16, maxHeight: '85%'},
  modalHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  modalTitle: {flex: 1, fontSize: 18, fontWeight: '700', color: '#111827'},
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

  parentInfo: {marginBottom: 8},
  parentInfoText: {fontSize: 12, color: '#6b7280'},

  readonlyRow: {marginHorizontal: 4, marginBottom: 8},
  readonlyLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 2,
  },
  readonlyValue: {fontSize: 13, color: '#4b5563'},

  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 4,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  gpsBtnText: {fontSize: 12, color: '#fff', marginLeft: 4, fontWeight: '600'},

  imageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  imageBtnText: {fontSize: 13, color: '#fff', marginLeft: 6, fontWeight: '600'},
  imageInfoText: {fontSize: 12, color: '#16a34a', marginTop: 4},
  imageInfoTextMuted: {fontSize: 12, color: '#9ca3af', marginTop: 4},

  sliderBlock: {marginHorizontal: 4, marginBottom: 12},
  sliderValue: {fontSize: 13, color: '#111827', fontWeight: '600', textAlign: 'right', marginTop: -4},

  addCoordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0ea5e9',
  },
  addCoordText: {fontSize: 12, color: '#fff', marginLeft: 4, fontWeight: '600'},
});
