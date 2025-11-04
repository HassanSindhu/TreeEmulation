import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import colors from '../theme/colors';

export default function StatCard({title, value}) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card:{width:'48%', borderWidth:2, borderColor:colors.primary, borderRadius:16, padding:14, backgroundColor:'#fff', marginBottom:12},
  value:{fontSize:28, fontWeight:'800'},
  title:{marginTop:4, color:'#4b5563'},
});
