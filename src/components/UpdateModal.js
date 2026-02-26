
import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import colors from '../theme/colors';

const UpdateModal = ({ visible, latestVersion }) => {
  const handleUpdate = () => {
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.treeenum';
    Linking.openURL(playStoreUrl).catch(err =>
      console.error('Failed to open play store', err),
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <StatusBar backgroundColor="rgba(0,0,0,0.7)" barStyle="light-content" />
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Ionicons name="rocket-outline" size={60} color={colors.primary} />
          </View>

          <Text style={styles.title}>Update Available!</Text>
          <Text style={styles.message}>
            A newer version ({latestVersion}) of the Punjab Tree Enumeration app is available. Please update to continue using the app.
          </Text>

          <TouchableOpacity style={styles.button} onPress={handleUpdate} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Update Now</Text>
            <Ionicons name="cloud-download-outline" size={20} color="#fff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          <Text style={styles.note}>
            This update is mandatory to ensure data security and performance.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  note: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default UpdateModal;
