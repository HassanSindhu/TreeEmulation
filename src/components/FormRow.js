import React from 'react';
import {View, Text, TextInput, StyleSheet} from 'react-native';

export default function FormRow({label, value, onChangeText, placeholder}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder}/>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap:{marginBottom:12},
  label:{marginBottom:6, fontWeight:'600', color:'#111827'},
  input:{borderWidth:1, borderColor:'#e5e7eb', borderRadius:10, padding:12, backgroundColor:'#fff'},
});
