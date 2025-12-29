import React, {useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../context/AuthContext';
import colors from '../theme/colors';

export default function ProfileScreen() {
  const {user, logout} = useAuth();

  // ✅ Demo / fallback data (role-based app friendly)
  const profile = useMemo(() => {
    const fallback = {
      name: 'Muhammad Zafar',
      designation: 'Forest Guard',
      role: user?.role || 'FG',
      email: user?.email || 'forest.guard@example.com',
      phone: user?.phone || '+92-000-0000000',
      employeeId: user?.employeeId || 'FG-10234',
      circle: user?.circle || 'Lahore Circle',
      division: user?.division || 'Lahore Division',
      range: user?.subDivision || user?.range || 'Range 2',
      beat: user?.beat || 'Beat 1',
      station: user?.station || 'Forest Station A',
      joinDate: user?.joinDate || '2024-01-15',
      status: user?.status || 'Active',
      avatarUrl: user?.avatarUrl || '', // if you have a remote URL
    };

    return {
      ...fallback,
      name: user?.name || fallback.name,
      role: user?.role || fallback.role,
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
        <Ionicons name={icon} size={18} color={colors.primary} />
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
      primary: {bg: 'rgba(16,185,129,0.14)', fg: '#065f46', bd: 'rgba(16,185,129,0.25)'},
      neutral: {bg: 'rgba(59,130,246,0.12)', fg: '#1e3a8a', bd: 'rgba(59,130,246,0.18)'},
      warning: {bg: 'rgba(245,158,11,0.16)', fg: '#92400e', bd: 'rgba(245,158,11,0.22)'},
      danger: {bg: 'rgba(239,68,68,0.14)', fg: '#7f1d1d', bd: 'rgba(239,68,68,0.22)'},
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
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={require('../assets/images/bg.jpg')}
        style={styles.background}
        resizeMode="cover">
        <View style={styles.overlay} />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ===== HERO ===== */}
          <View style={styles.hero}>
            <View style={styles.heroTopRow}>
              <View style={styles.avatarWrap}>
                {profile.avatarUrl ? (
                  <Image source={{uri: profile.avatarUrl}} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Ionicons name="person" size={42} color="#fff" />
                  </View>
                )}
              </View>

              <View style={styles.heroText}>
                <Text style={styles.name} numberOfLines={1}>
                  {profile.name}
                </Text>
                <Text style={styles.designation} numberOfLines={1}>
                  {profile.designation}
                </Text>

                <View style={styles.chipsRow}>
                  <Chip text={profile.status} tone={profile.status === 'Active' ? 'primary' : 'warning'} />
                  <Chip text={`Role: ${profile.role}`} tone="neutral" />
                </View>
              </View>
            </View>

            <View style={styles.locationBar}>
              <Ionicons name="location" size={16} color="#ffffff" />
              <Text style={styles.locationText} numberOfLines={1}>
                {profile.circle} • {profile.division} • {profile.range}
              </Text>
            </View>
          </View>

          {/* ===== QUICK STATS ===== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity Snapshot</Text>

            <View style={styles.statsRow}>
              <Stat label="Trees Added" value="24" icon="leaf" />
              <Stat label="Verified" value="18" icon="checkmark-done" />
              <Stat label="Pending" value="6" icon="time" />
            </View>


          </View>

          {/* ===== PROFILE DETAILS ===== */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Profile Details</Text>

            <InfoRow icon="person" label="Full Name" value={profile.name} />
            <InfoRow icon="briefcase" label="Designation" value={profile.designation} />
            <InfoRow icon="shield-checkmark" label="Employee ID" value={profile.employeeId} />
            <InfoRow icon="call" label="Phone" value={profile.phone} />
            <InfoRow icon="mail" label="Email" value={profile.email} />

            <View style={styles.divider} />

            <InfoRow icon="map" label="Circle" value={profile.circle} />
            <InfoRow icon="business" label="Division" value={profile.division} />
            <InfoRow icon="git-network" label="Range / Sub-Division" value={profile.range} />
            <InfoRow icon="trail-sign" label="Beat" value={profile.beat} />
            <InfoRow icon="home" label="Station" value={profile.station} />

            <View style={styles.divider} />

            <InfoRow icon="calendar" label="Joined On" value={profile.joinDate} />
          </View>

          {/* ===== ACTIONS ===== */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account & Support</Text>

            <TouchableOpacity style={styles.actionRow} activeOpacity={0.8} onPress={() => Alert.alert('Demo', 'Settings screen can be added later.')}>
              <View style={[styles.actionIcon, {backgroundColor: 'rgba(59,130,246,0.12)'}]}>
                <Ionicons name="settings" size={18} color="#2563eb" />
              </View>
              <View style={styles.actionBody}>
                <Text style={styles.actionTitle}>Settings</Text>
                <Text style={styles.actionSub}>App preferences, notifications, and profile updates</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} activeOpacity={0.8} onPress={() => Alert.alert('Demo', 'Help & Support screen can be added later.')}>
              <View style={[styles.actionIcon, {backgroundColor: 'rgba(245,158,11,0.14)'}]}>
                <Ionicons name="help-circle" size={18} color="#d97706" />
              </View>
              <View style={styles.actionBody}>
                <Text style={styles.actionTitle}>Help & Support</Text>
                <Text style={styles.actionSub}>FAQs, contact support, and troubleshooting</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} activeOpacity={0.8} onPress={() => Alert.alert('Demo', 'Privacy Policy screen can be added later.')}>
              <View style={[styles.actionIcon, {backgroundColor: 'rgba(16,185,129,0.14)'}]}>
                <Ionicons name="document-text" size={18} color="#059669" />
              </View>
              <View style={styles.actionBody}>
                <Text style={styles.actionTitle}>Privacy Policy</Text>
                <Text style={styles.actionSub}>Data usage, storage policy, and permissions</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* ===== SIGN OUT ===== */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <Ionicons name="log-out" size={20} color="#fff" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Forest Management System • v1.0.0</Text>
        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#ffffff'},
  background: {flex: 1, width: '100%'},
  overlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2, 6, 23, 0.08)'},
  scrollContent: {paddingBottom: 34},

  /* Hero */
  hero: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.82)',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  heroTopRow: {flexDirection: 'row', alignItems: 'center'},
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255,255,255,0.18)',
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarImg: {width: '100%', height: '100%', borderRadius: 46},
  avatarFallback: {
    flex: 1,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroText: {flex: 1, marginLeft: 14},
  name: {fontSize: 22, fontWeight: '900', color: '#fff'},
  designation: {fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.92)', marginTop: 2},
  chipsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10},
  chip: {paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1},
  chipText: {fontSize: 12, fontWeight: '900'},
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  locationText: {color: '#fff', fontWeight: '800', fontSize: 12, flex: 1},

  /* Sections */
  section: {marginTop: 14, marginHorizontal: 16},
  sectionTitle: {fontSize: 16, fontWeight: '900', color: '#0f172a', marginBottom: 10},
  sectionHint: {fontSize: 12, color: '#64748b', marginTop: 8},

  statsRow: {flexDirection: 'row', gap: 10},
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 6,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(16,185,129,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {fontSize: 22, fontWeight: '900', color: '#0f172a'},
  statLabel: {fontSize: 12, fontWeight: '800', color: '#64748b'},

  /* Cards */
  card: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  cardTitle: {fontSize: 16, fontWeight: '900', color: '#0f172a', marginBottom: 10},

  infoRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 10},
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.22)',
  },
  infoBody: {flex: 1},
  infoLabel: {fontSize: 12, fontWeight: '800', color: '#64748b'},
  infoValue: {fontSize: 15, fontWeight: '800', color: '#0f172a', marginTop: 2},
  infoRight: {marginLeft: 8},

  divider: {height: 1, backgroundColor: '#eef2f7', marginVertical: 8},

  /* Actions */
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  actionBody: {flex: 1},
  actionTitle: {fontSize: 14, fontWeight: '900', color: '#0f172a'},
  actionSub: {fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 2},

  /* Logout */
  logoutBtn: {
    marginTop: 16,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#ef4444',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  logoutText: {color: '#fff', fontSize: 16, fontWeight: '900'},

  versionText: {
    marginTop: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.70)',
    fontSize: 12,
    fontWeight: '700',
  },
});
