import React from 'react';
import {View, Text, StyleSheet, FlatList, TouchableOpacity} from 'react-native';

export default function VerificationScreen(){
  // TODO: fetch entries by status (PENDING/VERIFIED/DISPOSED/SUPERDARI)
  const pending = [{id:'ent_1', rdKm:'12+560', species:'Shisham'}];
  return (
    <View style={styles.c}>
      <Text style={styles.h1}>Pending Verification</Text>
      <FlatList
        data={pending}
        keyExtractor={(it)=>it.id}
        renderItem={({item})=>(
          <TouchableOpacity style={styles.item}>
            <Text style={styles.t1}>{item.species || '—'}</Text>
            <Text style={styles.t2}>RD {item.rdKm}</Text>
            {/* Approve/Dispose actions will call workflow APIs */}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  c:{flex:1, padding:16},
  h1:{fontSize:18, fontWeight:'800', marginBottom:8},
  item:{backgroundColor:'#fff', borderRadius:12, padding:12, borderWidth:1, borderColor:'#e5e7eb', marginBottom:8},
  t1:{fontWeight:'700'}, t2:{color:'#6b7280'}
});
