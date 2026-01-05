// /screens/ProfileScreen.js
import React, {useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const {user, logout} = useAuth();

  const profile = useMemo(() => {
    // role is already normalized in AuthContext, but keep safe
    const roleRaw = user?.role;
    const role =
      Array.isArray(roleRaw) ? (roleRaw[0] || 'USER') : (roleRaw || 'USER');

    const zoneName = user?.zone?.name || user?.zoneName || '';
    const circleName = user?.circle?.name || user?.circleName || '';
    const divisionName = user?.division?.name || user?.divisionName || '';
    const subDivisionName =
      user?.subDivision?.name || user?.subDivisionName || user?.rangeName || '';
    const blockName = user?.block?.name || user?.blockName || '';
    const beatName = user?.beat?.name || user?.beatName || '';

    return {
      name: user?.displayName || user?.name || '-',
      designation: user?.designation || '-',
      role,
      email: user?.email || '-',
      phone: user?.phone || '-',
      employeeId: user?.employeeId || (user?.id ? `EMP-${user.id}` : '-'),
      zone: zoneName || '-',
      circle: circleName || '-',
      division: divisionName || '-',
      range: subDivisionName || '-',
      block: blockName || '-',
      beat: beatName || '-',
      station: user?.station || '-',
      joinDate: user?.joinDate || '-',
      status: user?.isActive === false ? 'Inactive' : 'Active',
      avatarUrl: user?.photoURL || '',
      locationLine: [zoneName, circleName, divisionName, subDivisionName]
        .filter(Boolean)
        .join(' • '),
    };
  }, [user]);

  const handleLogout = () => {
    Alert.alert('Sign out', 'Do you want to sign out?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Sign Out', style: 'destructive', onPress: logout},
    ]);
  };

  const InfoRow = ({icon, label, value, right}) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color="#059669" />
      </View>

      <View style={styles.infoBody}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {value || '-'}
        </Text>
      </View>

      {right ? <View style={styles.infoRight}>{right}</View> : null}
    </View>
  );

  const Chip = ({text, tone = 'primary'}) => {
    const map = {
      primary: {
        bg: 'rgba(5, 150, 105, 0.14)',
        fg: '#065f46',
        bd: 'rgba(5, 150, 105, 0.25)',
      },
      neutral: {
        bg: 'rgba(59, 130, 246, 0.12)',
        fg: '#1e3a8a',
        bd: 'rgba(59, 130, 246, 0.18)',
      },
      warning: {
        bg: 'rgba(245, 158, 11, 0.16)',
        fg: '#92400e',
        bd: 'rgba(245, 158, 11, 0.22)',
      },
      danger: {
        bg: 'rgba(239, 68, 68, 0.14)',
        fg: '#7f1d1d',
        bd: 'rgba(239, 68, 68, 0.22)',
      },
      success: {
        bg: 'rgba(5, 150, 105, 0.14)',
        fg: '#065f46',
        bd: 'rgba(5, 150, 105, 0.25)',
      },
    };
    const t = map[tone] || map.primary;

    return (
      <View style={[styles.chip, {backgroundColor: t.bg, borderColor: t.bd}]}>
        <Text style={[styles.chipText, {color: t.fg}]}>{text}</Text>
      </View>
    );
  };

  const Stat = ({label, value, icon}) => (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={20} color="#059669" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      {/* Header with gradient */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Text style={styles.headerSubtitle}>Your account information</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ===== HERO SECTION ===== */}
        <View style={styles.heroCard}>
          <View style={styles.heroContent}>
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                {profile.avatarUrl ? (
                  <Image source={{uri: profile.avatarUrl}} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Ionicons name="person" size={48} color="#fff" />
                  </View>
                )}
                {profile.status === 'Active' && (
                  <View style={styles.activeBadge}>
                    <View style={styles.activeDot} />
                  </View>
                )}
              </View>

              <View style={styles.profileText}>
                <Text style={styles.name} numberOfLines={1}>
                  {profile.name}
                </Text>
                <Text style={styles.designation} numberOfLines={1}>
                  {profile.designation}
                </Text>
                <View style={styles.employeeId}>
                  <Ionicons name="id-card" size={14} color="#059669" />
                  <Text style={styles.employeeIdText}>{profile.employeeId}</Text>
                </View>
              </View>
            </View>

            <View style={styles.chipsRow}>
              <Chip
                text={profile.status}
                tone={profile.status === 'Active' ? 'success' : 'warning'}
              />
              <Chip text={profile.role} tone="neutral" />
            </View>

            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color="#059669" />
              <Text style={styles.locationText} numberOfLines={2}>
                {profile.locationLine || '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* ===== QUICK STATS ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Overview</Text>
          <View style={styles.statsGrid}>
            <Stat label="Total Sites" value="12" icon="business" />
            <Stat label="Trees Added" value="248" icon="leaf" />
            <Stat label="Verified" value="192" icon="checkmark-done" />
            <Stat label="Pending" value="18" icon="time" />
          </View>
        </View>

        {/* ===== PERSONAL INFO ===== */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle" size={22} color="#065f46" />
            <Text style={styles.cardTitle}>Personal Information</Text>
          </View>

          <InfoRow icon="person" label="Full Name" value={profile.name} />
          <InfoRow icon="briefcase" label="Designation" value={profile.designation} />
          <InfoRow icon="call" label="Phone" value={profile.phone} />
          <InfoRow icon="mail" label="Email" value={profile.email} />
          <InfoRow icon="calendar" label="Joined Date" value={profile.joinDate} />
        </View>

        {/* ===== LOCATION INFO ===== */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="map" size={22} color="#065f46" />
            <Text style={styles.cardTitle}>Location Details</Text>
          </View>

          <View style={styles.locationGrid}>
            <View style={styles.locationItem}>
              <View style={styles.locationIcon}>
                <Ionicons name="business" size={16} color="#059669" />
              </View>
              <Text style={styles.locationLabel}>Zone</Text>
              <Text style={styles.locationValue}>{profile.zone}</Text>
            </View>

            <View style={styles.locationItem}>
              <View style={styles.locationIcon}>
                <Ionicons name="business" size={16} color="#059669" />
              </View>
              <Text style={styles.locationLabel}>Circle</Text>
              <Text style={styles.locationValue}>{profile.circle}</Text>
            </View>

            <View style={styles.locationItem}>
              <View style={styles.locationIcon}>
                <Ionicons name="map" size={16} color="#059669" />
              </View>
              <Text style={styles.locationLabel}>Division</Text>
              <Text style={styles.locationValue}>{profile.division}</Text>
            </View>

            <View style={styles.locationItem}>
              <View style={styles.locationIcon}>
                <Ionicons name="git-branch" size={16} color="#059669" />
              </View>
              <Text style={styles.locationLabel}>Range</Text>
              <Text style={styles.locationValue}>{profile.range}</Text>
            </View>

            <View style={styles.locationItem}>
              <View style={styles.locationIcon}>
                <Ionicons name="grid" size={16} color="#059669" />
              </View>
              <Text style={styles.locationLabel}>Block</Text>
              <Text style={styles.locationValue}>{profile.block}</Text>
            </View>

            <View style={styles.locationItem}>
              <View style={styles.locationIcon}>
                <Ionicons name="trail-sign" size={16} color="#059669" />
              </View>
              <Text style={styles.locationLabel}>Beat</Text>
              <Text style={styles.locationValue}>{profile.beat}</Text>
            </View>

            <View style={styles.locationItem}>
              <View style={styles.locationIcon}>
                <Ionicons name="home" size={16} color="#059669" />
              </View>
              <Text style={styles.locationLabel}>Station</Text>
              <Text style={styles.locationValue}>{profile.station}</Text>
            </View>
          </View>
        </View>

        {/* ===== ACCOUNT ACTIONS ===== */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="settings" size={22} color="#065f46" />
            <Text style={styles.cardTitle}>Account & Settings</Text>
          </View>

          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.8}
            onPress={() => Alert.alert('Settings', 'App settings screen can be added later.')}>
            <View style={[styles.actionIcon, {backgroundColor: 'rgba(5, 150, 105, 0.1)'}]}>
              <Ionicons name="settings-outline" size={20} color="#059669" />
            </View>
            <View style={styles.actionBody}>
              <Text style={styles.actionTitle}>App Settings</Text>
              <Text style={styles.actionSub}>Preferences and configurations</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.8}
            onPress={() => Alert.alert('Support', 'Help & support screen can be added later.')}>
            <View style={[styles.actionIcon, {backgroundColor: 'rgba(245, 158, 11, 0.1)'}]}>
              <Ionicons name="help-circle-outline" size={20} color="#f59e0b" />
            </View>
            <View style={styles.actionBody}>
              <Text style={styles.actionTitle}>Help & Support</Text>
              <Text style={styles.actionSub}>FAQs and contact information</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.8}
            onPress={() => Alert.alert('Privacy', 'Privacy policy screen can be added later.')}>
            <View style={[styles.actionIcon, {backgroundColor: 'rgba(59, 130, 246, 0.1)'}]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#3b82f6" />
            </View>
            <View style={styles.actionBody}>
              <Text style={styles.actionTitle}>Privacy & Security</Text>
              <Text style={styles.actionSub}>Data protection and policies</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.8}
            onPress={() => Alert.alert('About', 'About screen can be added later.')}>
            <View style={[styles.actionIcon, {backgroundColor: 'rgba(139, 92, 246, 0.1)'}]}>
              <Ionicons name="information-circle-outline" size={20} color="#8b5cf6" />
            </View>
            <View style={styles.actionBody}>
              <Text style={styles.actionTitle}>About App</Text>
              <Text style={styles.actionSub}>Version and app information</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* ===== SIGN OUT BUTTON ===== */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* ===== APP VERSION ===== */}
        <View style={styles.footer}>
          <Text style={styles.versionText}>Forest Management System</Text>
          <Text style={styles.versionSubText}>Version 1.0.0 • © 2024</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f0fdf4',
  },

  // Header
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#059669',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Hero Card
  heroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 24,
  },
  heroContent: {
    alignItems: 'center',
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatarImg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  activeBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#059669',
  },
  activeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#059669',
  },
  profileText: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  designation: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 8,
  },
  employeeId: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  employeeIdText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    width: '100%',
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#065f46',
    fontWeight: '600',
    lineHeight: 20,
  },

  // Stats Section
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#065f46',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: (width - 52) / 2, // 2 cards per row with padding
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Cards
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: 0.3,
  },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5, 150, 105, 0.05)',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  infoBody: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  infoRight: {
    marginLeft: 12,
  },

  // Location Grid
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  locationItem: {
    width: (width - 72) / 3, // 3 items per row with padding
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  locationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },

  // Action Rows
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5, 150, 105, 0.05)',
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  actionSub: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    lineHeight: 18,
  },

  // Logout Button
  logoutBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  versionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 6,
  },
  versionSubText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});