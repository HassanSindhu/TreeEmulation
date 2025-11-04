import React, {useState} from 'react';
import {
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  View,
  ImageBackground,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FormRow from '../components/FormRow';
import colors from '../theme/colors';

export default function AddTreeScreen({ navigation }){
  // minimal core fields (you'll extend to match the register row later)
  const [rdKm, setRdKm] = useState('');
  const [treeNo2025, setTreeNo2025] = useState('');
  const [species, setSpecies] = useState('');
  const [girth2025, setGirth2025] = useState('');
  const [condition2025, setCondition2025] = useState('GREEN');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  const save = async () => {
    // TODO: call api.createEntry(registerId, payload, token)
    const payload = {
      rdKm,
      treeNo_2025_26: treeNo2025,
      speciesText: species,
      girth_2025_26: Number(girth2025) || null,
      condition_2025_26: condition2025,
      gpsLat: lat? Number(lat): null,
      gpsLong: lng? Number(lng): null,
      status: 'PENDING',
    };
    console.log('submit', payload);
    Alert.alert('Success', 'Tree enumeration data has been saved successfully!', [
      {
        text: "OK",
        onPress: () => navigation.goBack()
      }
    ]);
  };

  const conditionOptions = ['GREEN', 'DRY', 'DISEASED', 'MISSING', 'CUT'];

  const getConditionColor = (condition) => {
    switch (condition) {
      case 'GREEN': return '#16a34a';
      case 'DRY': return '#f97316';
      case 'DISEASED': return '#dc2626';
      case 'MISSING': return '#6b7280';
      case 'CUT': return '#7c3aed';
      default: return '#6b7280';
    }
  };

  const ConditionButton = ({ condition, isSelected, onPress }) => (
    <TouchableOpacity
      style={[
        styles.conditionBtn,
        isSelected && {
          backgroundColor: `${getConditionColor(condition)}15`,
          borderColor: getConditionColor(condition)
        }
      ]}
      onPress={onPress}
    >
      <View style={[
        styles.conditionDot,
        { backgroundColor: getConditionColor(condition) }
      ]} />
      <Text style={[
        styles.conditionText,
        isSelected && { color: getConditionColor(condition), fontWeight: '700' }
      ]}>
        {condition}
      </Text>
    </TouchableOpacity>
  );

  const isFormValid = rdKm && treeNo2025 && species && condition2025;

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={require('../assets/images/bg.jpg')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

        {/* Fixed Header - Outside ScrollView */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Add Tree Enumeration</Text>
            <Text style={styles.headerSubtitle}>Record new tree data for 2025-26</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* ScrollView only for form content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Form Card */}
            <View style={styles.formCard}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Basic Information</Text>
                <FormRow
                  label="RD/Km"
                  value={rdKm}
                  onChangeText={setRdKm}
                  placeholder="Enter road kilometer"
                  required
                />
                <FormRow
                  label="Tree No (2025-26)"
                  value={treeNo2025}
                  onChangeText={setTreeNo2025}
                  placeholder="Enter tree number"
                  required
                />
                <FormRow
                  label="Species"
                  value={species}
                  onChangeText={setSpecies}
                  placeholder="Enter tree species"
                  required
                />
                <FormRow
                  label="Girth (2025-26, cm)"
                  value={girth2025}
                  onChangeText={setGirth2025}
                  placeholder="Enter girth in cm"
                  keyboardType="numeric"
                />
              </View>

              {/* Condition Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Tree Condition (2025-26) <Text style={styles.required}>*</Text>
                </Text>
                <Text style={styles.sectionSubtitle}>Select the current condition of the tree</Text>
                <View style={styles.conditionGrid}>
                  {conditionOptions.map((condition) => (
                    <ConditionButton
                      key={condition}
                      condition={condition}
                      isSelected={condition2025 === condition}
                      onPress={() => setCondition2025(condition)}
                    />
                  ))}
                </View>
              </View>

              {/* GPS Coordinates */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>GPS Coordinates</Text>
                <Text style={styles.sectionSubtitle}>Optional location data</Text>
                <View style={styles.gpsRow}>
                  <View style={styles.gpsInput}>
                    <FormRow
                      label="Latitude"
                      value={lat}
                      onChangeText={setLat}
                      placeholder="e.g., 31.5204"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.gpsInput}>
                    <FormRow
                      label="Longitude"
                      value={lng}
                      onChangeText={setLng}
                      placeholder="e.g., 74.3587"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* GPS Action Buttons */}
                <View style={styles.gpsActions}>
                  <TouchableOpacity style={styles.gpsBtn}>
                    <Ionicons name="locate" size={18} color="#3b82f6" />
                    <Text style={[styles.gpsBtnText, { color: '#3b82f6' }]}>Get Current Location</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.gpsBtn}>
                    <Ionicons name="map" size={18} color="#10b981" />
                    <Text style={[styles.gpsBtnText, { color: '#10b981' }]}>Pick on Map</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  !isFormValid && styles.saveBtnDisabled
                ]}
                onPress={save}
                disabled={!isFormValid}
              >
                <Ionicons name="save" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Save Tree Enumeration</Text>
              </TouchableOpacity>

              {/* Form Status */}
              {!isFormValid && (
                <Text style={styles.requiredText}>
                  * Please fill all required fields
                </Text>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  background: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  // Fixed Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
    zIndex: 10, // Ensure header stays above content
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    margin: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  required: {
    color: '#ef4444',
  },
  conditionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    minWidth: 100,
  },
  conditionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  conditionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  gpsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gpsInput: {
    flex: 1,
  },
  gpsActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  gpsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(243, 244, 246, 0.8)',
    gap: 6,
  },
  gpsBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginTop: 8,
  },
  saveBtnDisabled: {
    backgroundColor: '#9ca3af',
    shadowColor: '#6b7280',
    shadowOpacity: 0.2,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  requiredText: {
    textAlign: 'center',
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
  },
});