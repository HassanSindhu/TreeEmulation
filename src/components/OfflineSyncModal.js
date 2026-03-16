import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { offlineService } from '../services/OfflineService';
import COLORS from '../theme/colors';

export default function OfflineSyncModal() {
  const [visible, setVisible] = useState(false);
  const [queue, setQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    const update = () => {
      setVisible(offlineService.isModalVisible);
      setIsSyncing(offlineService.isSyncing);
      setQueue([...offlineService.queue]);
    };
    update();
    const unsub = offlineService.subscribe(update);
    return () => unsub();
  }, []);

  // Reset selection when modal opens
  useEffect(() => {
    if (visible && !isSyncing) {
      // By default, select all items
      setSelectedIds(new Set(queue.map(q => q.id)));
    }
  }, [visible, queue.length]);

  if (!visible) return null;

  const toggleSelection = (id) => {
    const nextSet = new Set(selectedIds);
    if (nextSet.has(id)) {
      nextSet.delete(id);
    } else {
      nextSet.add(id);
    }
    setSelectedIds(nextSet);
  };

  const selectAll = () => {
    setSelectedIds(new Set(queue.map(q => q.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const getDisplayName = (item) => {
    try {
      if (item.url.includes('mature-trees')) return 'Mature Tree Enumeration';
      if (item.url.includes('pole-crop')) return 'Pole Crop Enumeration';
      if (item.url.includes('afforestation')) return 'Afforestation Records';
      if (item.url.includes('verification')) return 'Verification / Action';
      if (item.url.includes('soft-delete')) return 'Site Deletion';
    } catch (e) {}
    
    // Fallback if URL isn't exactly matching
    return `Offline Record (${item.method})`;
  };

  const handleSyncSelected = () => {
    if (selectedIds.size === 0) {
      Alert.alert('No items selected', 'Please select at least one item to sync.');
      return;
    }
    
    const idsToSync = Array.from(selectedIds);
    offlineService.processQueue(idsToSync);
    // Don't close immediately, let the user see the progress if we want, or close immediately.
    // offlineService.closeSyncModal();
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Delete Offline Records?', 
      'Are you sure you want to discard these offline records? This cannot be undone.', 
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            for (let id of selectedIds) {
              await offlineService.removeFromQueue(id);
            }
            setSelectedIds(new Set());
          }
        }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => offlineService.closeSyncModal()}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Sync Offline Data</Text>
            <TouchableOpacity onPress={() => offlineService.closeSyncModal()} disabled={isSyncing}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.summaryBar}>
            <Text style={styles.summaryText}>
              {selectedIds.size} of {queue.length} selected
            </Text>
            <View style={styles.quickActions}>
               <TouchableOpacity onPress={selectAll} disabled={isSyncing}>
                 <Text style={styles.actionText}>Select All</Text>
               </TouchableOpacity>
               <TouchableOpacity onPress={deselectAll} disabled={isSyncing} style={{marginLeft: 15}}>
                 <Text style={styles.actionText}>Select None</Text>
               </TouchableOpacity>
            </View>
          </View>

          {queue.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.success} />
              <Text style={styles.emptyText}>All records are synced!</Text>
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {queue.map((item, idx) => {
                const isSelected = selectedIds.has(item.id);
                const isItemSyncing = item.status === 'processing';
                
                return (
                  <TouchableOpacity 
                    key={item.id} 
                    style={[styles.itemCard, isSelected && styles.itemCardSelected]}
                    onPress={() => toggleSelection(item.id)}
                    disabled={isSyncing}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={isSelected ? "checkbox" : "square-outline"} 
                      size={24} 
                      color={isSelected ? COLORS.primary : "#9ca3af"} 
                    />
                    
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle}>{getDisplayName(item)}</Text>
                      <Text style={styles.itemSub}>Created: {new Date(item.timestamp).toLocaleString()}</Text>
                      {item.body && item.body.name_of_site_id && (
                        <Text style={styles.itemSub}>Site ID: {item.body.name_of_site_id}</Text>
                      )}
                    </View>

                    {isItemSyncing && (
                      <ActivityIndicator size="small" color={COLORS.primary} style={{marginLeft: 10}} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.footer}>
             <TouchableOpacity style={styles.clearBtn} onPress={deleteSelected} disabled={isSyncing || selectedIds.size === 0}>
                <Ionicons name="trash-outline" size={20} color={selectedIds.size === 0 ? "#9ca3af" : COLORS.danger} />
             </TouchableOpacity>
             
             <TouchableOpacity 
               style={[styles.syncBtn, (selectedIds.size === 0 || isSyncing) && styles.syncBtnDisabled]} 
               onPress={handleSyncSelected}
               disabled={selectedIds.size === 0 || isSyncing}
             >
                {isSyncing ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.syncBtnText}>Syncing Data...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={20} color="#fff" />
                    <Text style={styles.syncBtnText}>Sync Selected ({selectedIds.size})</Text>
                  </>
                )}
             </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30, // for safe area
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  summaryText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
  },
  actionText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  list: {
    padding: 15,
    maxHeight: 500,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#f0f9ff',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  itemSub: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 50,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 15,
  },
  clearBtn: {
    width: 60,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  syncBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  syncBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  }
});
