import React, {useEffect, useState} from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import colors from '../theme/colors';
import FormRow from '../components/FormRow';

const STORAGE_KEY = 'MATURE_TREE_RECORDS';

export default function SuperdariScreen({navigation, route}) {
  const {treeId} = route.params;

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [cnic, setCnic] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    const arr = json ? JSON.parse(json) : [];
    const r = arr.find(x => x.id === treeId);
    if (!r?.superdari) return;

    setName(r.superdari.superdarName || '');
    setContact(r.superdari.superdarContact || '');
    setCnic(r.superdari.superdarCnic || '');
    setRemarks(r.superdari.remarks || '');
  };

  const save = async () => {
    if (!name || !contact || !cnic) {
      Alert.alert('Missing', 'All fields required');
      return;
    }

    const json = await AsyncStorage.getItem(STORAGE_KEY);
    const arr = json ? JSON.parse(json) : [];

    const updated = arr.map(r =>
      r.id === treeId
        ? {
            ...r,
            superdari: {
              superdarName: name,
              superdarContact: contact,
              superdarCnic: cnic,
              remarks,
              savedAt: new Date().toISOString(),
            },
          }
        : r,
    );

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    Alert.alert('Saved', 'Superdari saved');
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.title}>Superdari</Text>

      <FormRow label="Name of Superdar" value={name} onChangeText={setName} />
      <FormRow label="Contact No" value={contact} onChangeText={setContact} />
      <FormRow label="CNIC No" value={cnic} onChangeText={setCnic} />
      <FormRow label="Remarks" value={remarks} onChangeText={setRemarks} multiline />

      <TouchableOpacity style={styles.saveBtn} onPress={save}>
        <Ionicons name="save" size={18} color="#fff" />
        <Text style={styles.saveText}>Save Superdari</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, padding: 16, backgroundColor: '#fff'},
  title: {fontSize: 20, fontWeight: '800', marginBottom: 12},
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
