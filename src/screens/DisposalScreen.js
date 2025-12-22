import React, {useEffect, useState} from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {launchImageLibrary} from 'react-native-image-picker';

import colors from '../theme/colors';
import FormRow from '../components/FormRow';

const STORAGE_KEY = 'MATURE_TREE_RECORDS';

export default function DisposalScreen({navigation, route}) {
  const {treeId} = route.params;

  const [record, setRecord] = useState(null);

  const [drNo, setDrNo] = useState('');
  const [drDate, setDrDate] = useState('');
  const [firChecked, setFirChecked] = useState(false);
  const [firNo, setFirNo] = useState('');
  const [firDate, setFirDate] = useState('');
  const [peedaChecked, setPeedaChecked] = useState(false);
  const [remarks, setRemarks] = useState('');

  const [drImages, setDrImages] = useState([]);
  const [firImages, setFirImages] = useState([]);
  const [peedaImages, setPeedaImages] = useState([]);

  useEffect(() => {
    loadRecord();
  }, []);

  const loadRecord = async () => {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    const arr = json ? JSON.parse(json) : [];
    const r = arr.find(x => x.id === treeId);
    if (!r) return;

    setRecord(r);
    const d = r.disposal || {};

    setDrNo(d.drNo || '');
    setDrDate(d.drDate || '');
    setFirChecked(!!d.firChecked);
    setFirNo(d.firNo || '');
    setFirDate(d.firDate || '');
    setPeedaChecked(!!d.peedaChecked);
    setRemarks(d.remarks || '');

    setDrImages(d.drImages || []);
    setFirImages(d.firImages || []);
    setPeedaImages(d.peedaImages || []);
  };

  const pickImages = setter => {
    launchImageLibrary({mediaType: 'photo', selectionLimit: 0}, res => {
      if (!res.assets) return;
      setter(prev => [...prev, ...res.assets.map(a => a.uri)]);
    });
  };

  const saveDisposal = async () => {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    const arr = json ? JSON.parse(json) : [];

    const updated = arr.map(r => {
      if (r.id !== treeId) return r;
      return {
        ...r,
        disposal: {
          drNo,
          drDate,
          firChecked,
          firNo,
          firDate,
          peedaChecked,
          remarks,
          drImages,
          firImages,
          peedaImages,
          savedAt: new Date().toISOString(),
        },
      };
    });

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    Alert.alert('Saved', 'Disposal saved successfully');
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.title}>Disposal</Text>

      <FormRow label="DR No" value={drNo} onChangeText={setDrNo} />
      <FormRow label="DR Date" value={drDate} onChangeText={setDrDate} />

      <TouchableOpacity style={styles.checkRow} onPress={() => setFirChecked(!firChecked)}>
        <Ionicons name={firChecked ? 'checkbox' : 'square-outline'} size={20} />
        <Text style={styles.checkText}>FIR Required</Text>
      </TouchableOpacity>

      {firChecked && (
        <>
          <FormRow label="FIR No" value={firNo} onChangeText={setFirNo} />
          <FormRow label="FIR Date" value={firDate} onChangeText={setFirDate} />
        </>
      )}

      <TouchableOpacity style={styles.checkRow} onPress={() => setPeedaChecked(!peedaChecked)}>
        <Ionicons name={peedaChecked ? 'checkbox' : 'square-outline'} size={20} />
        <Text style={styles.checkText}>PEEDA Act</Text>
      </TouchableOpacity>

      <FormRow label="Remarks" value={remarks} onChangeText={setRemarks} multiline />

      <TouchableOpacity style={styles.saveBtn} onPress={saveDisposal}>
        <Ionicons name="save" size={18} color="#fff" />
        <Text style={styles.saveText}>Save Disposal</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, padding: 16, backgroundColor: '#fff'},
  title: {fontSize: 20, fontWeight: '800', marginBottom: 12},
  checkRow: {flexDirection: 'row', alignItems: 'center', marginTop: 12},
  checkText: {marginLeft: 8, fontWeight: '600'},
  saveBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveText: {color: '#fff', fontWeight: '800', marginLeft: 8},
});
