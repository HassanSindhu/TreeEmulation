import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  ScrollView
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../context/AuthContext';
import colors from '../theme/colors';

export default function ProfileScreen(){
  const {user, logout} = useAuth();

  const handleLogout = () => {
    // You can add a confirmation dialog here if needed
    logout();
  };

  const ProfileItem = ({ icon, label, value }) => (
    <View style={styles.profileItem}>
      <View style={styles.profileIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.profileInfo}>
        <Text style={styles.profileLabel}>{label}</Text>
        <Text style={styles.profileValue}>{value || '-'}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={require('../assets/images/bg.jpg')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#fff" />
            </View>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.userRole}>{user?.role || 'Role not specified'}</Text>
          </View>

          {/* Profile Information Card */}
          <View style={styles.profileCard}>
            <Text style={styles.cardTitle}>Profile Information</Text>

            <ProfileItem
              icon="person"
              label="Full Name"
              value={user?.name}
            />

            <ProfileItem
              icon="briefcase"
              label="Role"
              value={user?.role}
            />

            <ProfileItem
              icon="mail"
              label="Email"
              value={user?.email}
            />

            <ProfileItem
              icon="business"
              label="Division"
              value={user?.division}
            />

            <ProfileItem
              icon="calendar"
              label="Member Since"
              value={user?.joinDate}
            />
          </View>

          {/* Quick Stats Card */}
          <View style={styles.statsCard}>
            <Text style={styles.cardTitle}>Activity Summary</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>24</Text>
                <Text style={styles.statLabel}>Trees Added</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>18</Text>
                <Text style={styles.statLabel}>Verified</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>6</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
          </View>

          {/* Actions Card */}
          <View style={styles.actionsCard}>
            <Text style={styles.cardTitle}>Account Actions</Text>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="settings" size={20} color="#3b82f6" />
              <Text style={[styles.actionText, { color: '#3b82f6' }]}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="help-circle" size={20} color="#f59e0b" />
              <Text style={[styles.actionText, { color: '#f59e0b' }]}>Help & Support</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="document-text" size={20} color="#10b981" />
              <Text style={[styles.actionText, { color: '#10b981' }]}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={20} color="#fff" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>

          {/* App Version */}
          <Text style={styles.versionText}>Forest Management System v1.0.0</Text>
        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  background: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    padding: 30,
    paddingTop: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  userRole: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    margin: 16,
    marginBottom: 12,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  statsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    margin: 16,
    marginBottom: 12,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  actionsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    margin: 16,
    marginBottom: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  profileLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  profileValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 20,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  versionText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
});