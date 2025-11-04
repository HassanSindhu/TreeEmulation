import React, {useMemo, useState} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, FlatList, Pressable, ImageBackground, Dimensions
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import colors from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={require('../assets/images/bg.jpg')} // Add your green plants image here
        style={styles.background}
        resizeMode="cover"
      >
        {/* Overlay for better readability */}
        <View style={styles.overlay} />

        <ScrollView contentContainerStyle={styles.container}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <Text style={styles.heading}>
              Enumeration of trees along linear plantations In Punjab
            </Text>
            <Text style={styles.subtitle}>
              Forest Management Information System
            </Text>
          </View>

          {/* Filters Card */}
          <View style={styles.filterCard}>
            <View style={styles.filterHeader}>
              <Ionicons name="funnel" size={20} color={colors.primary} />
              <Text style={styles.filterTitle}>Area Filters</Text>
            </View>

            <View style={styles.row}>
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

            <View style={styles.row}>
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
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={()=>{
                setDivision(null); setRange(null); setBlock(null); setBeat(null);
              }}>
                <Ionicons name="refresh" size={16} color={colors.primary}/>
                <Text style={[styles.btnText, {color: colors.primary, marginLeft:6}]}>Reset</Text>
              </Pressable>

              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={()=>{
                // Later: call /stats/summary?divisionId=... etc and update stats state
                console.log('Apply filters', {division, range, block, beat});
              }}>
                <Ionicons name="checkmark" size={16} color="#fff"/>
                <Text style={[styles.btnText, {color:'#fff', marginLeft:6}]}>Apply</Text>
              </Pressable>
            </View>
          </View>

          {/* Stats Overview */}
          <View style={styles.statsSection}>
            <Text style={styles.statsTitle}>Statistics Overview</Text>
            <View style={styles.grid}>
              <KpiCard
                title="Pending"
                value={stats.pending}
                icon="time"
                bg="rgba(255, 247, 237, 0.95)"
                border="#fdba74"
                tint="#f97316"
              />
              <KpiCard
                title="Verified"
                value={stats.verified}
                icon="checkmark-done"
                bg="rgba(236, 253, 245, 0.95)"
                border="#86efac"
                tint="#16a34a"
              />
              <KpiCard
                title="Disposed"
                value={stats.disposed}
                icon="trash"
                bg="rgba(240, 249, 255, 0.95)"
                border="#7dd3fc"
                tint="#0ea5e9"
              />
              <KpiCard
                title="Superdari"
                value={stats.superdari}
                icon="briefcase"
                bg="rgba(250, 245, 255, 0.95)"
                border="#c4b5fd"
                tint="#7c3aed"
              />
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionsSection}>
            <Text style={styles.actionsTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <QuickAction
                icon="add-circle"
                title="New Entry"
                color="#10b981"
                onPress={() => console.log('New Entry')}
              />
              <QuickAction
                icon="search"
                title="Search"
                color="#3b82f6"
                onPress={() => console.log('Search')}
              />
              <QuickAction
                icon="document-text"
                title="Reports"
                color="#8b5cf6"
                onPress={() => console.log('Reports')}
              />
              <QuickAction
                icon="map"
                title="Map View"
                color="#ef4444"
                onPress={() => console.log('Map View')}
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
      </ImageBackground>
    </View>
  );
}

/* ---------- Reusable components ---------- */

function SelectField({label, value, placeholder, onPress, disabled}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.select, disabled && {opacity: 0.55}]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.selectLabel}>{label}</Text>
      <View style={styles.selectBox}>
        <Text style={[styles.selectValue, !value && {color:'#9ca3af'}]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#6b7280" />
      </View>
    </TouchableOpacity>
  );
}

function KpiCard({title, value, icon, bg, border, tint}) {
  return (
    <View style={[styles.card, {backgroundColor: bg, borderColor: border}]}>
      <View style={[styles.iconWrap, {backgroundColor: `${tint}20`}]}>
        <Ionicons name={icon} size={20} color={tint}/>
      </View>
      <Text style={[styles.cardValue, {color: '#111827'}]}>{value}</Text>
      <Text style={[styles.cardTitle, {color: '#374151'}]}>{title}</Text>
    </View>
  );
}

function QuickAction({icon, title, color, onPress}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

function PickerModal({visible, title, data, onClose, onSelect}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={data}
            keyExtractor={(item)=> item.id}
            ItemSeparatorComponent={()=><View style={{height:8}}/>}
            renderItem={({item})=>(
              <Pressable style={styles.modalItem} onPress={()=>onSelect(item)}>
                <Text style={styles.modalItemText}>{item.name}</Text>
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
  screen: {flex:1, backgroundColor: '#ffffff'},
  background: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 185, 129, 0.1)', // Green tint overlay
  },
  container: {padding: 16, paddingBottom: 32},

  headerSection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  filterCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  row: {flexDirection: 'row', gap: 12, marginBottom: 12},
  select: {flex: 1},
  selectLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
    fontWeight: '600',
  },
  selectBox: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectValue: {fontSize: 15, color: '#111827', fontWeight: '500'},

  filterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  btn: {
    flexDirection:'row',
    alignItems:'center',
    paddingHorizontal:16,
    height:42,
    borderRadius:12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  btnGhost: {
    backgroundColor:'#ecfdf5',
    borderWidth:1,
    borderColor:'#bbf7d0',
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
  },
  btnText: {fontWeight: '700', fontSize: 14},

  statsSection: {
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconWrap: {
    alignSelf:'flex-start',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  cardValue: {fontSize: 28, fontWeight: '800', marginBottom: 2},
  cardTitle: {fontSize: 13, fontWeight: '600', opacity: 0.8},

  actionsSection: {
    marginBottom: 20,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    width: '23%',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionTitle: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  /* Modal */
  modalBackdrop: {
    flex:1,
    backgroundColor:'rgba(0,0,0,0.5)',
    justifyContent:'flex-end',
  },
  modalCard: {
    backgroundColor:'#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'space-between',
    marginBottom: 16,
  },
  modalTitle: {fontWeight:'800', fontSize:18, color:'#111827'},
  modalItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor:'#e5e7eb',
    backgroundColor:'#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  modalItemText: {fontSize: 15, color: '#111827', fontWeight: '500'},
});