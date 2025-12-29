import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ImageBackground,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import {launchImageLibrary} from 'react-native-image-picker';

import colors from '../theme/colors';
import FormRow from '../components/FormRow';
import {DropdownRow} from '../components/SelectRows';

const STORAGE_KEY = 'MATURE_TREE_RECORDS';

/**
 * Superdari UI: table-like (left column "Input", right column field),
 * dark theme like your attached image + includes:
 * - Register No, Page No (prefilled from tree record; editable if you want)
 * - Name, Contact, CNIC
 * - Tree Condition dropdown (options from image)
 * - GPS: auto fetch + manual input (both shown)
 * - Remarks
 * - Pictures (multi-select)
 */

export default function SuperdariScreen({navigation, route}) {
  const {treeId} = route.params;

  const [record, setRecord] = useState(null);

  // fields
  const [registerNo, setRegisterNo] = useState('');
  const [pageNo, setPageNo] = useState('');

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [cnic, setCnic] = useState('');

  const [treeCondition, setTreeCondition] = useState('');
  const conditionOptions = [
    '',
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

  // GPS (auto + manual)
  const [autoGps, setAutoGps] = useState('');
  const [manualGps, setManualGps] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const lastGpsRequestAtRef = useRef(0);

  const [remarks, setRemarks] = useState('');
  const [pictureUris, setPictureUris] = useState([]); // multiple

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const arr = json ? JSON.parse(json) : [];
      const r = arr.find(x => x.id === treeId);

      setRecord(r || null);

      // try to prefill register/page from parent record if present
      setRegisterNo(r?.registerNo || '');
      setPageNo(r?.pageNo || '');

      if (r?.superdari) {
        setRegisterNo(r.superdari.registerNo || r?.registerNo || '');
        setPageNo(r.superdari.pageNo || r?.pageNo || '');
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

  const pickPictures = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.7,
        selectionLimit: 0, // ✅ multiple
      },
      res => {
        if (res.didCancel) return;
        if (res.errorCode) {
          Alert.alert('Image Error', res.errorMessage || 'Could not pick images');
          return;
        }
        const uris = (res.assets || []).map(a => a?.uri).filter(Boolean);
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

  const save = async () => {
    if (!registerNo?.trim() || !pageNo?.trim()) {
      Alert.alert('Missing', 'Register No and Page No are required.');
      return;
    }
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

    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const arr = json ? JSON.parse(json) : [];

      const updated = arr.map(r =>
        r.id === treeId
          ? {
              ...r,
              superdari: {
                registerNo: registerNo.trim(),
                pageNo: pageNo.trim(),
                superdarName: name.trim(),
                superdarContact: contact.trim(),
                superdarCnic: cnic.trim(),
                treeCondition: treeCondition.trim(),

                // ✅ keep both + computed
                autoGpsLatLong: (autoGps || '').trim(),
                manualGpsLatLong: (manualGps || '').trim(),
                gpsLatLong: gpsFinal,

                remarks,
                pictureUris: pictureUris || [],
                savedAt: new Date().toISOString(),
              },
            }
          : r,
      );

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      Alert.alert('Saved', 'Superdari saved');
      navigation.goBack();
    } catch (e) {
      console.warn('Superdari save error', e);
      Alert.alert('Error', 'Could not save. Please try again.');
    }
  };

  const TableRow = ({label, children}) => (
    <View style={styles.row}>
      <View style={styles.leftCell}>
        <Text style={styles.leftText}>Input</Text>
      </View>
      <View style={styles.rightCell}>
        <Text style={styles.label}>{label}</Text>
        <View style={{marginTop: 8}}>{children}</View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={require('../assets/images/bg.jpg')}
        style={styles.background}
        resizeMode="cover">
        <View style={styles.overlay} />

        {/* Header bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Superdari</Text>

          <View style={{width: 36}} />
        </View>

        <ScrollView contentContainerStyle={{paddingBottom: 30}}>
          <View style={styles.table}>

            {/* PK row (optional like screenshot) */}
            <View style={styles.pkRow}>
              <Text style={styles.pkText}>PK</Text>
              <Text style={styles.pkValue}>{record?.id || treeId || '—'}</Text>
            </View>

            <TableRow label="Register No">
              <FormRow value={registerNo} onChangeText={setRegisterNo} placeholder="Register No" />
            </TableRow>

            <TableRow label="Page No">
              <FormRow value={pageNo} onChangeText={setPageNo} placeholder="Page No" />
            </TableRow>

            <TableRow label="Name of Superdar">
              <FormRow value={name} onChangeText={setName} placeholder="Name" />
            </TableRow>

            <TableRow label="Contact No">
              <FormRow value={contact} onChangeText={setContact} placeholder="03xx-xxxxxxx" keyboardType="phone-pad" />
            </TableRow>

            <TableRow label="CNIC No">
              <FormRow value={cnic} onChangeText={setCnic} placeholder="xxxxx-xxxxxxx-x" keyboardType="numeric" />
            </TableRow>

            <TableRow label="Tree Condition (Green Standing, Green Fallen, Dry, Leaning, Dead, Hollow, Fallen, Rotten, Fire Burnt, Forked, 1/4, 1/2)">
              <DropdownRow
                label=""
                value={treeCondition}
                onChange={setTreeCondition}
                options={conditionOptions}
              />
            </TableRow>

            <TableRow label="GPS Coordinates">
              <View style={styles.gpsBox}>
                <Text style={styles.gpsSmallLabel}>Auto GPS</Text>
                <Text style={styles.gpsValue}>{autoGps || '—'}</Text>

                <View style={{height: 10}} />

                <Text style={styles.gpsSmallLabel}>Manual (optional)</Text>
                <FormRow
                  value={manualGps}
                  onChangeText={setManualGps}
                  placeholder="31.5204, 74.3587"
                />

                <View style={styles.gpsBtnRow}>
                  <TouchableOpacity style={styles.gpsBtn} onPress={() => fetchAutoGps(false)}>
                    <Ionicons name="locate" size={16} color="#fff" />
                    <Text style={styles.gpsBtnText}>Re-Fetch</Text>
                  </TouchableOpacity>

                  {gpsLoading ? (
                    <View style={styles.gpsLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.gpsLoadingText}>Getting location…</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </TableRow>

            <TableRow label="Remarks">
              <FormRow value={remarks} onChangeText={setRemarks} placeholder="Remarks" multiline />
            </TableRow>

            <TableRow label="Pictures">
              <TouchableOpacity style={styles.picBtn} onPress={pickPictures}>
                <Ionicons name="images-outline" size={18} color="#fff" />
                <Text style={styles.picBtnText}>Upload Pictures</Text>
              </TouchableOpacity>

              <Text style={styles.picMeta}>
                {pictureUris.length ? `${pictureUris.length} selected` : 'No picture selected'}
              </Text>

              {pictureUris.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 10}}>
                  {pictureUris.map(uri => (
                    <View key={uri} style={styles.thumbWrap}>
                      <Image source={{uri}} style={styles.thumb} />
                      <TouchableOpacity style={styles.thumbRemove} onPress={() => removePicture(uri)}>
                        <Ionicons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </TableRow>

          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={save}>
            <Ionicons name="save" size={18} color="#fff" />
            <Text style={styles.saveText}>Save Superdari</Text>
          </TouchableOpacity>
        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#0b1220'},
  background: {flex: 1},
  overlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2, 6, 23, 0.78)'},

  headerBar: {
    paddingTop: Platform.OS === 'ios' ? 54 : 46,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  headerTitle: {flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '900'},

  table: {
    margin: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
  },

  pkRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pkText: {
    width: 74,
    paddingVertical: 12,
    textAlign: 'center',
    color: '#fff',
    fontWeight: '900',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.10)',
  },
  pkValue: {flex: 1, paddingVertical: 12, paddingHorizontal: 14, color: '#fff', fontWeight: '800'},

  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  leftCell: {
    width: 74,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  leftText: {color: 'rgba(255,255,255,0.85)', fontWeight: '900'},
  rightCell: {flex: 1, paddingVertical: 14, paddingHorizontal: 14},
  label: {color: '#fff', fontSize: 15, fontWeight: '900'},

  gpsBox: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  gpsSmallLabel: {color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '900'},
  gpsValue: {color: '#fff', marginTop: 6, fontWeight: '900'},
  gpsBtnRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10},
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
  },
  gpsBtnText: {color: '#fff', fontWeight: '900'},
  gpsLoading: {flexDirection: 'row', alignItems: 'center', gap: 8},
  gpsLoadingText: {color: 'rgba(255,255,255,0.75)', fontWeight: '800'},

  picBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#0ea5e9',
    alignSelf: 'flex-start',
  },
  picBtnText: {color: '#fff', fontWeight: '900'},
  picMeta: {marginTop: 8, color: 'rgba(255,255,255,0.70)', fontWeight: '800'},

  thumbWrap: {marginRight: 10, position: 'relative'},
  thumb: {width: 84, height: 84, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)'},
  thumbRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveBtn: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 20,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  saveText: {color: '#fff', fontWeight: '900'},
});
