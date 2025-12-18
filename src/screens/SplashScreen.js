import React from 'react';
import {View, Text, StyleSheet, Image, ActivityIndicator, StatusBar } from 'react-native';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* TOP WAVE */}
      <Image
        source={require('../assets/images/up.png')}
        style={styles.waveTop}
        resizeMode="stretch"
      />

      {/* CENTER CONTENT */}
      <View style={styles.center}>
        <Image
          source={require('../assets/images/lin.png')}
          style={styles.logo}
        />

        <Text style={styles.appName}>Punjab Tree Enumeration</Text>
        <Text style={styles.tagline}>Field · Verify · Protect</Text>

        <ActivityIndicator size="large" style={{marginTop: 22}} />
      </View>

      {/* BOTTOM WAVE */}
      <Image
        source={require('../assets/images/down.png')}
        style={styles.waveBottom}
        resizeMode="stretch"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  waveTop: {
    width: '100%',
    height: 150,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  logo: {
    width: '100%',
    height: 320,
    marginBottom: 14,
  },

  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  tagline: {
    marginTop: 6,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },

  waveBottom: {
    width: '100%',
    height: 150,
  },
});
