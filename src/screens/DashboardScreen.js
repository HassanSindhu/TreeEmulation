import React, {useMemo, useState} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, FlatList, Pressable, StatusBar, Platform,
  ActivityIndicator
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Theme Colors (consistent with other screens)
const COLORS = {
  primary: '#059669',
  primaryLight: '#10b981',
  primaryDark: '#047857',
  secondary: '#0ea5e9',
  success: '#16a34a',
  warning: '#f97316',
  danger: '#dc2626',
  info: '#7c3aed',
  background: '#f8fafc',
  card: '#ffffff',
  text: '#1f2937',
  textLight: '#6b7280',
  border: '#e5e7eb',
  overlay: 'rgba(15, 23, 42, 0.7)',
};

const SAMPLE_DIVISIONS = [
  {id:'div_1', name:'Lahore'},
  {id:'div_2', name:'Sheikhupura'},
  {id:'div_3', name:'Faisalabad'},
];

const SAMPLE_RANGES = {
  div_1: [{id:'rng_1', name:'Range A'}, {id:'rng_2', name:'Range B'}],
  div_2: [{id:'rng_3', name:'Range C'}],
  div_3: [{id:'rng_4', name:'Range D'}],
};

const SAMPLE_BLOCKS = {
  rng_1: [{id:'blk_1', name:'Block 1'}, {id:'blk_2', name:'Block 2'}],
  rng_2: [{id:'blk_3', name:'Block 3'}],
  rng_3: [{id:'blk_4', name:'Block 4'}],
  rng_4: [{id:'blk_5', name:'Block 5'}],
};

const SAMPLE_BEATS = {
  blk_1: [{id:'bt_1', name:'Beat 1'}, {id:'bt_2', name:'Beat 2'}],
  blk_2: [{id:'bt_3', name:'Beat 3'}],
  blk_3: [{id:'bt_4', name:'Beat 4'}],
  blk_4: [{id:'bt_5', name:'Beat 5'}],
  blk_5: [{id:'bt_6', name:'Beat 6'}],
};

export default function DashboardScreen() {
  const [division, setDivision] = useState(null);
  const [range, setRange] = useState(null);
  const [block, setBlock] = useState(null);
  const [beat, setBeat] = useState(null);
  const [loading, setLoading] = useState(false);

  // Modal picker state
  const [pickerOpen, setPickerOpen] = useState(null); // 'division' | 'range' | 'block' | 'beat' | null

  const ranges = useMemo(() => (division ? (SAMPLE_RANGES[division?.id] || []) : []), [division]);
  const blocks = useMemo(() => (range ? (SAMPLE_BLOCKS[range?.id] || []) : []), [range]);
  const beats  = useMemo(() => (block ? (SAMPLE_BEATS[block?.id] || []) : []), [block]);

  // Demo stats (swap with /stats/summary later)
  const stats = useMemo(() => ({
    pending: 120,
    verified: 97,
    disposed: 22,
    superdari: 5,
  }), [division, range, block, beat]);

  // Reset cascades
  const onPickDivision = (item) => {
    setDivision(item); setRange(null); setBlock(null); setBeat(null); setPickerOpen(null);
  };
  const onPickRange = (item) => {
    setRange(item); setBlock(null); setBeat(null); setPickerOpen(null);
  };
  const onPickBlock = (item) => {
    setBlock(item); setBeat(null); setPickerOpen(null);
  };
  const onPickBeat = (item) => {
    setBeat(item); setPickerOpen(null);
  };

  const applyFilters = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setLoading(false);
    console.log('Apply filters', {division, range, block, beat});
  };

  const resetFilters = () => {
    setDivision(null);
    setRange(null);
    setBlock(null);
    setBeat(null);
  };

  return (
    <View style={styles.screen}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <View style={styles.headerInfo}>
            <View style={styles.infoChip}>
              <Ionicons name="business" size={12} color="#fff" />
              <Text style={styles.infoChipText}>{division?.name || 'All Divisions'}</Text>
            </View>
            <View style={styles.infoChip}>
              <Ionicons name="cube" size={12} color="#fff" />
              <Text style={styles.infoChipText}>{block?.name || 'All Blocks'}</Text>
            </View>
            <View style={styles.infoChip}>
              <Ionicons name="calendar" size={12} color="#fff" />
              <Text style={styles.infoChipText}>2024</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>

        {/* Filters Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="funnel" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Area Filters</Text>
          </View>

          <View style={styles.filterRow}>
            <SelectField
              label="Forest Division"
              value={division?.name}
              placeholder="Select Division"
              onPress={() => setPickerOpen('division')}
            />
            <SelectField
              label="Sub Division / Range"
              value={range?.name}
              placeholder="Select Range"
              disabled={!division}
              onPress={() => division && setPickerOpen('range')}
            />
          </View>

          <View style={styles.filterRow}>
            <SelectField
              label="Block"
              value={block?.name}
              placeholder="Select Block"
              disabled={!range}
              onPress={() => range && setPickerOpen('block')}
            />
            <SelectField
              label="Beat"
              value={beat?.name}
              placeholder="Select Beat"
              disabled={!block}
              onPress={() => block && setPickerOpen('beat')}
            />
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetFilters}
              activeOpacity={0.7}>
              <Ionicons name="refresh" size={16} color={COLORS.primary}/>
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.applyButton, {opacity: loading ? 0.7 : 1}]}
              onPress={applyFilters}
              disabled={loading}
              activeOpacity={0.7}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff"/>
                  <Text style={styles.applyButtonText}>Apply Filters</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="stats-chart" size={20} color={COLORS.text} />
            <Text style={styles.sectionTitle}>Statistics Overview</Text>
          </View>

          <View style={styles.statsGrid}>
            <StatCard
              title="Pending"
              value={stats.pending}
              icon="time-outline"
              color={COLORS.warning}
              bg="rgba(249, 115, 22, 0.1)"
            />
            <StatCard
              title="Verified"
              value={stats.verified}
              icon="checkmark-done-outline"
              color={COLORS.success}
              bg="rgba(22, 163, 74, 0.1)"
            />
            <StatCard
              title="Disposed"
              value={stats.disposed}
              icon="trash-outline"
              color={COLORS.secondary}
              bg="rgba(14, 165, 233, 0.1)"
            />
            <StatCard
              title="Superdari"
              value={stats.superdari}
              icon="briefcase-outline"
              color={COLORS.info}
              bg="rgba(124, 58, 237, 0.1)"
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={20} color={COLORS.text} />
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>

          <View style={styles.actionsGrid}>
            <QuickAction
              icon="add-circle-outline"
              title="New Entry"
              color={COLORS.primary}
              onPress={() => console.log('New Entry')}
            />
            <QuickAction
              icon="search-outline"
              title="Search"
              color={COLORS.secondary}
              onPress={() => console.log('Search')}
            />
            <QuickAction
              icon="document-text-outline"
              title="Reports"
              color={COLORS.info}
              onPress={() => console.log('Reports')}
            />
            <QuickAction
              icon="map-outline"
              title="Map View"
              color={COLORS.warning}
              onPress={() => console.log('Map View')}
            />
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={20} color={COLORS.text} />
            <Text style={styles.sectionTitle}>Recent Activity</Text>
          </View>

          <View style={styles.activityCard}>
            <ActivityItem
              icon="checkmark-circle"
              title="Tree #1234 verified"
              time="2 hours ago"
              color={COLORS.success}
            />
            <ActivityItem
              icon="document-text"
              title="Disposal record added"
              time="4 hours ago"
              color={COLORS.secondary}
            />
            <ActivityItem
              icon="person-add"
              title="New user registered"
              time="1 day ago"
              color={COLORS.info}
            />
            <ActivityItem
              icon="warning"
              title="3 pending records"
              time="2 days ago"
              color={COLORS.warning}
            />
          </View>
        </View>
      </ScrollView>

      {/* Picker Modals */}
      <PickerModal
        visible={pickerOpen === 'division'}
        title="Select Forest Division"
        data={SAMPLE_DIVISIONS}
        onClose={() => setPickerOpen(null)}
        onSelect={onPickDivision}
      />
      <PickerModal
        visible={pickerOpen === 'range'}
        title="Select Range"
        data={ranges}
        onClose={() => setPickerOpen(null)}
        onSelect={onPickRange}
      />
      <PickerModal
        visible={pickerOpen === 'block'}
        title="Select Block"
        data={blocks}
        onClose={() => setPickerOpen(null)}
        onSelect={onPickBlock}
      />
      <PickerModal
        visible={pickerOpen === 'beat'}
        title="Select Beat"
        data={beats}
        onClose={() => setPickerOpen(null)}
        onSelect={onPickBeat}
      />
    </View>
  );
}

/* ---------- Reusable components ---------- */

function SelectField({label, value, placeholder, onPress, disabled}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.selectField, disabled && {opacity: 0.5}]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.selectLabel}>{label}</Text>
      <View style={styles.selectBox}>
        <Text style={[styles.selectValue, !value && styles.selectPlaceholder]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />
      </View>
    </TouchableOpacity>
  );
}

function StatCard({title, value, icon, color, bg}) {
  return (
    <View style={[styles.statCard, {backgroundColor: bg}]}>
      <View style={styles.statIconContainer}>
        <View style={[styles.statIcon, {backgroundColor: `${color}20`}]}>
          <Ionicons name={icon} size={20} color={color}/>
        </View>
      </View>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

function QuickAction({icon, title, color, onPress}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

function ActivityItem({icon, title, time, color}) {
  return (
    <View style={styles.activityItem}>
      <View style={[styles.activityIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activityTime}>{time}</Text>
      </View>
    </View>
  );
}

function PickerModal({visible, title, data, onClose, onSelect}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={data}
            keyExtractor={(item)=> item.id}
            ItemSeparatorComponent={()=><View style={styles.separator}/>}
            renderItem={({item})=>(
              <Pressable style={styles.modalItem} onPress={()=>onSelect(item)}>
                <Text style={styles.modalItemText}>{item.name}</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  headerContent: {
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  headerInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  infoChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  // Cards
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Filter Section
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  selectField: {
    flex: 1,
  },
  selectLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  selectBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  selectValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  selectPlaceholder: {
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    gap: 6,
  },
  resetButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Sections
  statsSection: {
    marginHorizontal: 20,
    marginTop: 12,
  },
  actionsSection: {
    marginHorizontal: 20,
    marginTop: 12,
  },
  activitySection: {
    marginHorizontal: 20,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statIcon: {
    borderRadius: 10,
    padding: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },

  // Quick Actions
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },

  // Activity
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(31, 41, 55, 0.05)',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: COLORS.textLight,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 20,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalItemText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
});