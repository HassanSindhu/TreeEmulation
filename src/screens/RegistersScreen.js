import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ImageBackground,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function RegistersScreen() {
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'verified', 'disposed'

  // Mock data - replace with actual API call
  useEffect(() => {
    fetchRegisters();
  }, []);

  const fetchRegisters = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call: /registers
      const mockData = [
        { id: 'reg_1', registerNo: 'REG-23-045', pageNo: '12', status: 'pending', date: '2024-01-15', division: 'Lahore' },
        { id: 'reg_2', registerNo: 'REG-23-046', pageNo: '15', status: 'verified', date: '2024-01-14', division: 'Sheikhupura' },
        { id: 'reg_3', registerNo: 'REG-23-047', pageNo: '18', status: 'disposed', date: '2024-01-13', division: 'Faisalabad' },
        { id: 'reg_4', registerNo: 'REG-23-048', pageNo: '22', status: 'pending', date: '2024-01-12', division: 'Lahore' },
        { id: 'reg_5', registerNo: 'REG-23-049', pageNo: '25', status: 'verified', date: '2024-01-11', division: 'Sheikhupura' },
      ];
      setRegisters(mockData);
    } catch (error) {
      console.error('Error fetching registers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRegisters();
  };

  const filteredRegisters = registers.filter(register => {
    const matchesSearch = register.registerNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         register.division.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || register.status === filter;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#f97316';
      case 'verified': return '#16a34a';
      case 'disposed': return '#0ea5e9';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return 'time';
      case 'verified': return 'checkmark-done';
      case 'disposed': return 'trash';
      default: return 'document';
    }
  };

  const renderRegisterItem = ({ item }) => (
    <TouchableOpacity style={styles.registerCard}>
      <View style={styles.cardHeader}>
        <View style={styles.registerInfo}>
          <Text style={styles.registerNumber}>{item.registerNo}</Text>
          <Text style={styles.division}>{item.division}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
          <Ionicons name={getStatusIcon(item.status)} size={14} color={getStatusColor(item.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="document" size={16} color="#6b7280" />
          <Text style={styles.detailText}>Page {item.pageNo}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="calendar" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{item.date}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="eye" size={16} color="#3b82f6" />
          <Text style={[styles.actionText, { color: '#3b82f6' }]}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="download" size={16} color="#10b981" />
          <Text style={[styles.actionText, { color: '#10b981' }]}>Export</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const FilterButton = ({ title, value, isActive, onPress }) => (
    <TouchableOpacity
      style={[styles.filterBtn, isActive && styles.filterBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <ImageBackground
          source={require('../assets/images/bg.jpg')}
          style={styles.background}
          resizeMode="cover"
        >
          <View style={styles.overlay} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Loading registers...</Text>
          </View>
        </ImageBackground>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={require('../assets/images/bg.jpg')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Registers</Text>
          <Text style={styles.headerSubtitle}>Manage and view all registers</Text>
        </View>

        <View style={styles.content}>
          {/* Search and Filter Section */}
          <View style={styles.searchSection}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#6b7280" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by register no or division..."
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#6b7280" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterContainer}
              contentContainerStyle={styles.filterContent}
            >
              <FilterButton
                title="All"
                value="all"
                isActive={filter === 'all'}
                onPress={() => setFilter('all')}
              />
              <FilterButton
                title="Pending"
                value="pending"
                isActive={filter === 'pending'}
                onPress={() => setFilter('pending')}
              />
              <FilterButton
                title="Verified"
                value="verified"
                isActive={filter === 'verified'}
                onPress={() => setFilter('verified')}
              />
              <FilterButton
                title="Disposed"
                value="disposed"
                isActive={filter === 'disposed'}
                onPress={() => setFilter('disposed')}
              />
            </ScrollView>
          </View>

          {/* Results Count */}
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsText}>
              {filteredRegisters.length} register{filteredRegisters.length !== 1 ? 's' : ''} found
            </Text>
          </View>

          {/* Registers List */}
          <FlatList
            data={filteredRegisters}
            keyExtractor={(item) => item.id}
            renderItem={renderRegisterItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#10b981']}
                tintColor="#10b981"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document" size={48} color="#9ca3af" />
                <Text style={styles.emptyText}>No registers found</Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery ? 'Try a different search term' : 'No registers available'}
                </Text>
              </View>
            }
          />
        </View>
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
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchSection: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    fontSize: 16,
    color: '#111827',
  },
  filterContainer: {
    marginBottom: 8,
  },
  filterContent: {
    paddingRight: 16,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterBtnActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  resultsHeader: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  resultsText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  listContent: {
    paddingBottom: 20,
  },
  registerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  registerInfo: {
    flex: 1,
  },
  registerNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  division: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(243, 244, 246, 0.8)',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});