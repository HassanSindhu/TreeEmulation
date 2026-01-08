// /screens/SuperdariScreen.js
import React, {useEffect, useRef, useState, useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import {launchImageLibrary} from 'react-native-image-picker';

import FormRow from '../components/FormRow';
import {DropdownRow} from '../components/SelectRows';

// Theme Colors (consistent with Disposal screen)
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

const STORAGE_KEY = 'MATURE_TREE_RECORDS';

// ✅ Same as your AuthContext
const API_BASE = 'http://be.lte.gisforestry.com';
const STORAGE_TOKEN = 'AUTH_TOKEN';

// ✅ APIs
const SUPERDARI_URL = `${API_BASE}/enum/superdari`;
const TREE_CONDITION_SOURCE_URL = `${API_BASE}/forest-tree-conditions`; // as per your request

export default function SuperdariScreen({navigation, route}) {
  const {treeId, disposalId: routeDisposalId, enumeration} = route.params || {};

  const [record, setRecord] = useState(null);

  // fields
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [cnic, setCnic] = useState('');
  const [treeCondition, setTreeCondition] = useState(''); // label selected from API
  const [remarks, setRemarks] = useState('');
  const [pictureUris, setPictureUris] = useState([]);

  // Tree condition (fetched from API)
  const [conditionRows, setConditionRows] = useState([]); // [{id,label}]
  const [conditionLoading, setConditionLoading] = useState(false);

  // GPS (auto + manual)
  const [autoGps, setAutoGps] = useState('');
  const [manualGps, setManualGps] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const lastGpsRequestAtRef = useRef(0);

  // API state
  const [submitting, setSubmitting] = useState(false);

  const conditionOptions = useMemo(() => conditionRows.map(x => x.label), [conditionRows]);

  const getConditionId = label => {
    const found = conditionRows.find(x => x.label === label);
    return found?.id ?? null;
  };

  /* ===================== HELPERS ===================== */
  async function safeJson(res) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  const normalizeList = json => {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    if (typeof json === 'object' && Array.isArray(json.data)) return json.data;
    return [];
  };

  const getToken = async () => {
    const t = await AsyncStorage.getItem(STORAGE_TOKEN);
    return (t || '').trim();
  };

  const parseLatLong = txt => {
    const s = String(txt || '').trim();
    if (!s) return {lat: null, long: null};
    const parts = s.split(/[,\s]+/).filter(Boolean);
    if (parts.length < 2) return {lat: null, long: null};
    const lat = Number(parts[0]);
    const long = Number(parts[1]);
    if (Number.isNaN(lat) || Number.isNaN(long)) return {lat: null, long: null};
    return {lat, long};
  };

  const buildPicturesForApi = () => {
    const httpOnes = (pictureUris || []).filter(u => /^https?:\/\//i.test(String(u || '')));
    if (httpOnes.length > 0) return httpOnes;

    // NOTE: This is a placeholder. Ideally you upload images and send returned URLs.
    return ['https://example.com/pic1.jpg'];
  };

  /* ===================== LOAD ===================== */
  useEffect(() => {
    loadLocal();
    fetchTreeConditionFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLocal = async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const arr = json ? JSON.parse(json) : [];
      const r = arr.find(x => x.id === treeId);

      setRecord(r || null);

      if (r?.superdari) {
        setName(r.superdari.superdarName || '');
        setContact(r.superdari.superdarContact || '');
        setCnic(r.superdari.superdarCnic || '');
        setTreeCondition(r.superdari.treeCondition || '');
        setAutoGps(r.superdari.autoGpsLatLong || '');
        setManualGps(r.superdari.manualGpsLatLong || '');
        setRemarks(r.superdari.remarks || '');
        setPictureUris(Array.isArray(r.superdari.pictureUris) ? r.superdari.pictureUris : []);
      }

      // auto fetch if no saved autoGps
      setTimeout(() => {
        if (!(r?.superdari?.autoGpsLatLong || '').trim()) fetchAutoGps(true);
      }, 250);
    } catch (e) {
      console.warn('Superdari load error', e);
    }
  };

  const fetchTreeConditionFromApi = async () => {
    setConditionLoading(true);
    try {
      const res = await fetch(TREE_CONDITION_SOURCE_URL);
      const json = await safeJson(res);

      if (!res.ok) {
        throw new Error(json?.message || `Tree condition API failed (HTTP ${res.status})`);
      }

      const rows = normalizeList(json);

      const mapped = rows
        .map(x => {
          if (typeof x === 'string') return {id: null, label: x};
          return {
            id: x?.id ?? x?.species_id ?? null,
            label: x?.name ?? x?.species_name ?? '',
          };
        })
        .filter(x => x.label);

      // Optional: add blank at top
      const final = [{id: null, label: ''}, ...mapped];

      setConditionRows(final);
    } catch (e) {
      console.warn('Tree condition fetch error', e);
      setConditionRows([{id: null, label: ''}]);
      Alert.alert('Error', e?.message || 'Failed to load Tree Condition list from API.');
    } finally {
      setConditionLoading(false);
    }
  };

  const fetchAutoGps = (silent = false) => {
    const now = Date.now();
    if (now - lastGpsRequestAtRef.current < 1200) return;
    lastGpsRequestAtRef.current = now;

    setGpsLoading(true);
    Geolocation.getCurrentPosition(
      pos => {
        const {latitude, longitude} = pos.coords;
        const value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setAutoGps(value);
        setGpsLoading(false);
      },
      err => {
        setGpsLoading(false);
        if (!silent) Alert.alert('Location Error', err.message);
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  /* ===================== PICTURES ===================== */
  const pickPictures = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.7,
        selectionLimit: 0,
      },
      res => {
        if (res?.didCancel) return;
        if (res?.errorCode) {
          Alert.alert('Image Error', res?.errorMessage || 'Could not pick images');
          return;
        }
        const uris = (res?.assets || []).map(a => a?.uri).filter(Boolean);
        if (uris.length) {
          setPictureUris(prev => {
            const set = new Set([...(prev || []), ...uris]);
            return Array.from(set);
          });
        }
      },
    );
  };

  const removePicture = uri => {
    setPictureUris(prev => (prev || []).filter(x => x !== uri));
  };

  /* ===================== API POST ===================== */
  const postSuperdari = async payload => {
    const token = await getToken();
    if (!token) throw new Error('Auth token not found. Please login again.');

    const res = await fetch(SUPERDARI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await safeJson(res);

    if (!res.ok) {
      throw new Error(json?.message || `Superdari API failed (HTTP ${res.status})`);
    }

    return json;
  };

  /* ===================== SAVE ===================== */
  const save = async () => {
    if (!name?.trim() || !contact?.trim() || !cnic?.trim()) {
      Alert.alert('Missing', 'Name, Contact and CNIC are required.');
      return;
    }
    if (!treeCondition?.trim()) {
      Alert.alert('Missing', 'Tree Condition is required.');
      return;
    }

    const gpsFinal = (manualGps || '').trim() || (autoGps || '').trim();
    if (!gpsFinal) {
      Alert.alert('Missing', 'GPS is required (auto or manual).');
      return;
    }

    const disposalId =
      routeDisposalId ||
      record?.disposalId ||
      record?.disposal?.id ||
      record?.disposal?.disposalId ||
      record?.disposal?.serverDisposalId ||
      null;

    if (!disposalId) {
      Alert.alert(
        'Missing',
        'disposalId not found. Please pass disposalId in navigation params or store it on the record after disposal POST.',
      );
      return;
    }

    const treeConditionId = getConditionId(treeCondition);
    if (treeConditionId === null) {
      Alert.alert('Missing', 'Invalid Tree Condition selection.');
      return;
    }

    const {lat: auto_lat, long: auto_long} = parseLatLong(autoGps);
    const {lat: manual_lat, long: manual_long} = parseLatLong(manualGps);

    const payload = {
      disposalId: Number(disposalId),
      superdar_name: name.trim(),
      contact_no: contact.trim(),
      cnic_no: cnic.trim(),
      treeConditionId: Number(treeConditionId),
      auto_lat: auto_lat ?? null,
      auto_long: auto_long ?? null,
      manual_lat: manual_lat ?? null,
      manual_long: manual_long ?? null,
      pictures: buildPicturesForApi(),
    };

    setSubmitting(true);
    try {
      const apiResp = await postSuperdari(payload);

      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const arr = json ? JSON.parse(json) : [];

      const updated = arr.map(r =>
        r.id === treeId
          ? {
              ...r,
              superdari: {
                superdarName: name.trim(),
                superdarContact: contact.trim(),
                superdarCnic: cnic.trim(),
                treeCondition: treeCondition.trim(),
                treeConditionId: Number(treeConditionId),
                autoGpsLatLong: (autoGps || '').trim(),
                manualGpsLatLong: (manualGps || '').trim(),
                gpsLatLong: gpsFinal,
                remarks,
                pictureUris: pictureUris || [],
                disposalId: Number(disposalId),
                apiResponse: apiResp || null,
                savedAt: new Date().toISOString(),
              },
            }
          : r,
      );

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      Alert.alert('Success', 'Superdari saved and posted to server.');
      navigation.goBack();
    } catch (e) {
      console.warn('Superdari save/post error', e);
      Alert.alert('Error', e?.message || 'Could not save/post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Superdari Record</Text>
            <View style={styles.headerInfo}>
              <View style={styles.infoChip}>
                <Ionicons name="business" size={12} color="#fff" />
                <Text style={styles.infoChipText}>{enumeration?.division || '—'}</Text>
              </View>
              <View style={styles.infoChip}>
                <Ionicons name="cube" size={12} color="#fff" />
                <Text style={styles.infoChipText}>{enumeration?.block || '—'}</Text>
              </View>
              <View style={styles.infoChip}>
                <Ionicons name="calendar" size={12} color="#fff" />
                <Text style={styles.infoChipText}>{enumeration?.year || '—'}</Text>
              </View>
            </View>
            <Text style={styles.siteId}>Tree ID: {String(treeId ?? '—')}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>

        {/* Linking Card */}
        <View style={styles.linkingCard}>
          <View style={styles.linkingCardHeader}>
            <Ionicons name="link" size={20} color={COLORS.primary} />
            <Text style={styles.linkingCardTitle}>Record Information</Text>
          </View>
          <View style={styles.linkingInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tree ID:</Text>
              <Text style={styles.infoValue}>{String(treeId ?? '—')}</Text>
            </View>
          </View>
        </View>

        {/* Basic Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Superdar Information</Text>

          <FormRow
            label="Name of Superdar"
            value={name}
            onChangeText={setName}
            placeholder="Enter superdar name"
            required
          />
          <FormRow
            label="Contact No"
            value={contact}
            onChangeText={setContact}
            placeholder="03xx-xxxxxxx"
            keyboardType="phone-pad"
            required
          />
          <FormRow
            label="CNIC No"
            value={cnic}
            onChangeText={setCnic}
            placeholder="xxxxx-xxxxxxx-x"
            keyboardType="numeric"
            required
          />
        </View>

        {/* Tree Condition */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tree Condition</Text>
          <DropdownRow
            label={conditionLoading ? 'Tree Condition (Loading...)' : 'Select Tree Condition'}
            value={treeCondition}
            onChange={setTreeCondition}
            options={conditionOptions}
            required
            disabled={conditionLoading}
          />
          <Text style={styles.hintText}>
            Options are fetched from: {TREE_CONDITION_SOURCE_URL}
          </Text>
        </View>

        {/* GPS Coordinates */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>GPS Coordinates</Text>

          <View style={styles.gpsSection}>
            <Text style={styles.gpsLabel}>Auto GPS (Auto-fetched)</Text>
            <View style={styles.gpsValueBox}>
              <Text style={styles.gpsValue}>{autoGps || 'Not available'}</Text>
            </View>
          </View>

          <FormRow
            label="Manual GPS (Optional)"
            value={manualGps}
            onChangeText={setManualGps}
            placeholder="31.5204, 74.3587"
          />

          <View style={styles.gpsActions}>
            <TouchableOpacity
              style={styles.gpsButton}
              onPress={() => fetchAutoGps(false)}
              activeOpacity={0.7}>
              <Ionicons name="locate" size={18} color="#fff" />
              <Text style={styles.gpsButtonText}>
                {gpsLoading ? 'Fetching...' : 'Refresh GPS'}
              </Text>
            </TouchableOpacity>

            {gpsLoading && (
              <ActivityIndicator size="small" color={COLORS.primary} style={styles.gpsLoading} />
            )}
          </View>
        </View>

        {/* Remarks */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Remarks</Text>
          <FormRow
            label="Additional Remarks"
            value={remarks}
            onChangeText={setRemarks}
            multiline
            numberOfLines={3}
            placeholder="Enter any additional remarks"
          />
        </View>

        {/* Pictures */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pictures</Text>

          <TouchableOpacity style={styles.picBtn} onPress={pickPictures} activeOpacity={0.7}>
            <Ionicons name="image" size={18} color="#fff" />
            <Text style={styles.picBtnText}>Upload Pictures</Text>
          </TouchableOpacity>

          {pictureUris.length > 0 && (
            <>
              <Text style={styles.picCount}>
                {pictureUris.length} picture(s) selected • API will send: {buildPicturesForApi().length} link(s)
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesContainer}>
                {pictureUris.map(uri => (
                  <View key={uri} style={styles.thumbWrap}>
                    <Image source={{uri}} style={styles.thumb} />
                    <TouchableOpacity
                      style={styles.thumbClose}
                      onPress={() => removePicture(uri)}
                      activeOpacity={0.7}>
                      <Ionicons name="close-circle" size={18} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, {opacity: submitting ? 0.7 : 1}]}
          disabled={submitting}
          onPress={save}
          activeOpacity={0.7}>
          {submitting ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.saveText}>Saving…</Text>
            </>
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.saveText}>Save Superdari Record</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: COLORS.background},
  container: {flex: 1},
  contentContainer: {paddingBottom: 40},

  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  headerContainer: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20},
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: {flex: 1},
  headerTitle: {fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8, letterSpacing: 0.5},
  headerInfo: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8},
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  infoChipText: {fontSize: 12, fontWeight: '600', color: '#fff'},
  siteId: {fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3},

  linkingCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  linkingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
  },
  linkingCardTitle: {fontSize: 16, fontWeight: '700', color: COLORS.text},
  linkingInfo: {gap: 8},
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(31, 41, 55, 0.05)',
  },
  infoLabel: {fontSize: 14, fontWeight: '600', color: COLORS.textLight},
  infoValue: {fontSize: 14, fontWeight: '700', color: COLORS.primary},

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16, letterSpacing: 0.5},

  hintText: {fontSize: 12, color: COLORS.textLight, fontStyle: 'italic', marginTop: 8},

  gpsSection: {marginBottom: 16},
  gpsLabel: {fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8},
  gpsValueBox: {
    backgroundColor: 'rgba(31, 41, 55, 0.03)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gpsValue: {fontSize: 14, fontWeight: '600', color: COLORS.text},
  gpsActions: {flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12},
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    flex: 1,
  },
  gpsButtonText: {color: '#fff', fontWeight: '700', fontSize: 14},
  gpsLoading: {marginLeft: 8},

  picBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  picBtnText: {color: '#fff', fontWeight: '700', fontSize: 14},
  picCount: {fontSize: 12, color: COLORS.textLight, marginTop: 8, marginBottom: 12, fontStyle: 'italic'},
  imagesContainer: {marginTop: 4, paddingBottom: 4},
  thumbWrap: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  thumb: {width: '100%', height: '100%'},
  thumbClose: {position: 'absolute', top: 4, right: 4, backgroundColor: '#fff', borderRadius: 10, padding: 2},

  saveBtn: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveText: {color: '#fff', fontSize: 16, fontWeight: '800'},
});
