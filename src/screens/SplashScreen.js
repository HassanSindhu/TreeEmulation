import React from 'react';
import {ImageBackground, View, Text, ActivityIndicator, StyleSheet, Image} from 'react-native';
import colors from '../theme/colors';

export default function SplashScreen(){
  return (
    <ImageBackground
      source={require('../assets/images/splash-bg.jpg')}
      style={styles.bg}
      resizeMode="cover"
    >
      {/* subtle overlay to make text more readable */}
      <View style={styles.overlay} />

      <View style={styles.center}>
        <Text style={styles.appName}>Punjab Tree Enumeration</Text>
        <Text style={styles.tagline}>Field · Verify · Protect</Text>
        <ActivityIndicator size="large" color="#fff" style={{marginTop: 22}} />
      </View>

      <Text style={styles.footer}>© Punjab Forest Dept.</Text>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {flex: 1},
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  appName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    color: '#f3f4f6',
    marginTop: 6,
    fontSize: 14,
  },
  footer: {
    color: '#e5e7eb',
    textAlign: 'center',
    paddingBottom: 18,
  },
});
