import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/ApiService';

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

// ✅ Change this for production
// const API_BASE = 'https://be.punjabtreeenumeration.com';
const API_BASE = 'https://be.punjabtreeenumeration.com';

const STATS_URL = `${API_BASE}/lpe3/stats`;

const SAMPLE_DIVISIONS = [
  { id: 'div_1', name: 'Lahore' },
  { id: 'div_2', name: 'Sheikhupura' },
  { id: 'div_3', name: 'Faisalabad' },
];

const SAMPLE_RANGES = {
  div_1: [
    { id: 'rng_1', name: 'Range A' },
    { id: 'rng_2', name: 'Range B' },
  ],
  div_2: [{ id: 'rng_3', name: 'Range C' }],
  div_3: [{ id: 'rng_4', name: 'Range D' }],
};

const SAMPLE_BLOCKS = {
  rng_1: [
    { id: 'blk_1', name: 'Block 1' },
    { id: 'blk_2', name: 'Block 2' },
  ],
  rng_2: [{ id: 'blk_3', name: 'Block 3' }],
  rng_3: [{ id: 'blk_4', name: 'Block 4' }],
  rng_4: [{ id: 'blk_5', name: 'Block 5' }],
};

const SAMPLE_BEATS = {
  blk_1: [
    { id: 'bt_1', name: 'Beat 1' },
    { id: 'bt_2', name: 'Beat 2' },
  ],
  blk_2: [{ id: 'bt_3', name: 'Beat 3' }],
  blk_3: [{ id: 'bt_4', name: 'Beat 4' }],
  blk_4: [{ id: 'bt_5', name: 'Beat 5' }],
  blk_5: [{ id: 'bt_6', name: 'Beat 6' }],
};

export default function DashboardScreen() {
  const [division, setDivision] = useState(null);
  const [range, setRange] = useState(null);
  const [block, setBlock] = useState(null);
  const [beat, setBeat] = useState(null);

  // Modal picker state
  const [pickerOpen, setPickerOpen] = useState(null); // 'division' | 'range' | 'block' | 'beat' | null

  const ranges = useMemo(
    () => (division ? SAMPLE_RANGES[division?.id] || [] : []),
    [division],
  );
  const blocks = useMemo(() => (range ? SAMPLE_BLOCKS[range?.id] || [] : []), [range]);
  const beats = useMemo(() => (block ? SAMPLE_BEATS[block?.id] || [] : []), [block]);

  // ✅ Stats state (from /lpe3/stats)
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsRefreshing, setStatsRefreshing] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [statsData, setStatsData] = useState(null);

  const getAuthToken = async () => {
    const t = await AsyncStorage.getItem('AUTH_TOKEN');
    return t || '';
  };

  const normalizeRoleKey = key => {
    const k = String(key || '').toLowerCase();
    if (k === 'block_officer') return 'Block Officer';
    if (k === 'sdfo') return 'SDFO';
    if (k === 'dfo') return 'DFO';
    if (k === 'surveyor') return 'Surveyor';
    return key;
  };

  const fetchStats = useCallback(
    async ({ refresh = false } = {}) => {
      try {
        refresh ? setStatsRefreshing(true) : setStatsLoading(true);
        setStatsError('');

        const json = await apiService.get(STATS_URL);

        setStatsData(json?.data || null);
      } catch (e) {
        setStatsData(null);
        setStatsError(e?.message || 'Failed to load stats');
      } finally {
        refresh ? setStatsRefreshing(false) : setStatsLoading(false);
      }
    },
    [division, range, block, beat],
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset cascades
  const onPickDivision = item => {
    setDivision(item);
    setRange(null);
    setBlock(null);
    setBeat(null);
    setPickerOpen(null);
  };
  const onPickRange = item => {
    setRange(item);
    setBlock(null);
    setBeat(null);
    setPickerOpen(null);
  };
  const onPickBlock = item => {
    setBlock(item);
    setBeat(null);
    setPickerOpen(null);
  };
  const onPickBeat = item => {
    setBeat(item);
    setPickerOpen(null);
  };

  const applyFilters = async () => {
    // ✅ For now filters are UI only. When your backend supports it,
    // pass these IDs as query params in fetchStats()
    await fetchStats({ refresh: true });
  };

  const resetFilters = () => {
    setDivision(null);
    setRange(null);
    setBlock(null);
    setBeat(null);
    // You can refresh stats for "All"
    fetchStats({ refresh: true });
  };

  const totals = useMemo(() => {
    const total = Number(statsData?.total_enumeration || 0);

    const approvedTotal = Number(statsData?.approved?.total || 0);
    const rejectedTotal = Number(statsData?.rejected?.total || 0);
    const pendingTotal = Number(statsData?.pending?.total || 0);

    return {
      total,
      approvedTotal,
      rejectedTotal,
      pendingTotal,
    };
  }, [statsData]);

  const statusCards = useMemo(() => {
    const total = Math.max(0, totals.total);

    const mk = (title, icon, color, bg, totalValue, roleObj) => {
      const safeTotalValue = Number(totalValue || 0);
      const pct = total > 0 ? safeTotalValue / total : 0;

      // Role breakdown rows (excluding "total")
      const roleRows = [];
      const obj = roleObj && typeof roleObj === 'object' ? roleObj : {};
      Object.keys(obj).forEach(k => {
        if (k === 'total') return;
        roleRows.push({
          key: k,
          label: normalizeRoleKey(k),
          value: Number(obj[k] || 0),
        });
      });

      // consistent order (if keys exist)
      const order = ['block_officer', 'sdfo', 'dfo', 'surveyor'];
      roleRows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

      return {
        title,
        icon,
        color,
        bg,
        totalValue: safeTotalValue,
        pct,
        roleRows,
      };
    };

    return [
      mk(
        'Pending',
        'time-outline',
        COLORS.warning,
        'rgba(249, 115, 22, 0.08)',
        totals.pendingTotal,
        statsData?.pending,
      ),
      mk(
        'Approved',
        'checkmark-done-outline',
        COLORS.success,
        'rgba(22, 163, 74, 0.08)',
        totals.approvedTotal,
        statsData?.approved,
      ),
      mk(
        'Rejected',
        'close-circle-outline',
        COLORS.danger,
        'rgba(220, 38, 38, 0.08)',
        totals.rejectedTotal,
        statsData?.rejected,
      ),
    ];
  }, [statsData, totals]);

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
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={statsRefreshing}
            onRefresh={() => fetchStats({ refresh: true })}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>

        {/* ✅ Stats Overview (from API) */}
        <View style={styles.statsSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="stats-chart" size={20} color={COLORS.text} />
            <Text style={styles.sectionTitle}>Statistics Overview</Text>
          </View>

          {/* Error Banner */}
          {!!statsError && (
            <View style={styles.errorCard}>
              <View style={styles.errorHeader}>
                <Ionicons name="warning" size={18} color={COLORS.danger} />
                <Text style={styles.errorTitle}>Stats Error</Text>
              </View>
              <Text style={styles.errorText}>{statsError}</Text>
              <TouchableOpacity
                style={styles.errorBtn}
                onPress={() => fetchStats({ refresh: true })}>
                <Text style={styles.errorBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Total Card */}
          <View style={styles.totalCard}>
            <View style={styles.totalTopRow}>
              <View style={styles.totalLeft}>
                <View style={[styles.totalIcon, { backgroundColor: 'rgba(5, 150, 105, 0.12)' }]}>
                  <Ionicons name="leaf-outline" size={18} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.totalTitle}>Total Enumerations</Text>
                  <Text style={styles.totalSubtitle}>
                    Pending + Approved + Rejected distribution
                  </Text>
                </View>
              </View>

              <Text style={styles.totalValue}>{Number(totals.total || 0).toLocaleString()}</Text>
            </View>

            {/* One progress bar showing distribution */}
            <StackedBar
              total={Math.max(0, totals.total)}
              segments={[
                { value: totals.pendingTotal, color: COLORS.warning },
                { value: totals.approvedTotal, color: COLORS.success },
                { value: totals.rejectedTotal, color: COLORS.danger },
              ]}
            />

            <View style={styles.legendRow}>
              <LegendDot label={`Pending: ${totals.pendingTotal}`} color={COLORS.warning} />
              <LegendDot label={`Approved: ${totals.approvedTotal}`} color={COLORS.success} />
              <LegendDot label={`Rejected: ${totals.rejectedTotal}`} color={COLORS.danger} />
            </View>
          </View>

          {/* Status Cards with progress and role breakdown */}
          <View style={styles.statsGrid2}>
            {statusCards.map(card => (
              <StatusStatCard
                key={card.title}
                title={card.title}
                icon={card.icon}
                color={card.color}
                bg={card.bg}
                total={Math.max(0, totals.total)}
                value={card.totalValue}
                roleRows={card.roleRows}
              />
            ))}
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

/* ---------- Helpers ---------- */

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/* ---------- Reusable components ---------- */

function SelectField({ label, value, placeholder, onPress, disabled }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.selectField, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}>
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





function PickerModal({ visible, title, data, onClose, onSelect }) {
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
            keyExtractor={item => item.id}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable style={styles.modalItem} onPress={() => onSelect(item)}>
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

function LegendDot({ label, color }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function ProgressBar({ value, total, color }) {
  const pct = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

function StackedBar({ total, segments }) {
  const t = Math.max(0, Number(total || 0));
  const safeSegments = Array.isArray(segments) ? segments : [];

  return (
    <View style={styles.stackedTrack}>
      {t <= 0 ? (
        <View style={[styles.stackedSeg, { width: '100%', backgroundColor: 'rgba(31,41,55,0.08)' }]} />
      ) : (
        safeSegments.map((s, idx) => {
          const w = Math.max(0, Math.min(1, Number(s?.value || 0) / t));
          return (
            <View
              key={`${idx}`}
              style={[
                styles.stackedSeg,
                { width: `${w * 100}%`, backgroundColor: s?.color || 'rgba(31,41,55,0.25)' },
              ]}
            />
          );
        })
      )}
    </View>
  );
}

function StatusStatCard({ title, icon, color, bg, total, value, roleRows }) {
  const totalNum = Math.max(0, Number(total || 0));
  const valueNum = Math.max(0, Number(value || 0));
  const pctText = totalNum > 0 ? `${Math.round((valueNum / totalNum) * 100)}%` : '0%';

  return (
    <View style={[styles.statusCard, { backgroundColor: bg }]}>
      <View style={styles.statusTop}>
        <View style={[styles.statusIcon, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>{title}</Text>
          <Text style={styles.statusMeta}>
            {valueNum.toLocaleString()} / {totalNum.toLocaleString()} ({pctText})
          </Text>
        </View>
      </View>

      <ProgressBar value={valueNum} total={totalNum} color={color} />

      {!!roleRows?.length && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.breakdownTitle}>By Role</Text>

          {roleRows.map(r => (
            <View key={r.key} style={styles.roleRow}>
              <Text style={styles.roleLabel} numberOfLines={1}>
                {r.label}
              </Text>
              <Text style={styles.roleValue}>{Number(r.value || 0).toLocaleString()}</Text>
              <View style={{ flex: 1 }}>
                <ProgressBar value={Number(r.value || 0)} total={valueNum || 1} color={color} />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  contentContainer: { paddingBottom: 40 },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  headerContent: { paddingHorizontal: 20 },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  headerInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  infoChipText: { fontSize: 12, fontWeight: '600', color: '#fff' },

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
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  // Filter Section
  filterRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  selectField: { flex: 1 },
  selectLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
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
  selectValue: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  selectPlaceholder: { color: COLORS.textLight, fontStyle: 'italic' },
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
  resetButtonText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
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
  applyButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Sections
  statsSection: { marginHorizontal: 20, marginTop: 12 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  // Error card
  errorCard: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderColor: 'rgba(220, 38, 38, 0.2)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  errorHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  errorTitle: { fontSize: 14, fontWeight: '800', color: COLORS.danger },
  errorText: { fontSize: 13, color: COLORS.text, lineHeight: 18 },
  errorBtn: {
    marginTop: 10,
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  errorBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Total card
  totalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  totalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  totalIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  totalTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  totalSubtitle: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  totalValue: { fontSize: 22, fontWeight: '900', color: COLORS.text },

  // Stacked bar
  stackedTrack: {
    height: 10,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(31,41,55,0.08)',
    flexDirection: 'row',
    marginTop: 14,
  },
  stackedSeg: { height: '100%' },

  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },

  // Status cards grid
  statsGrid2: { gap: 12 },

  statusCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statusTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  statusMeta: { fontSize: 12, color: COLORS.textLight, marginTop: 2, fontWeight: '600' },

  // Progress
  progressTrack: {
    height: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(31,41,55,0.08)',
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: { height: '100%', borderRadius: 10 },

  // Breakdown
  breakdownTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  roleLabel: { width: 90, fontSize: 12, color: COLORS.text, fontWeight: '700' },
  roleValue: { width: 42, textAlign: 'right', fontSize: 12, color: COLORS.text, fontWeight: '800' },



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
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  closeButton: { padding: 4 },
  separator: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 20 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalItemText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
});
