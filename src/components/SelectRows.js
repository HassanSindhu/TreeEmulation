import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export const DropdownRow = ({
  label,
  value,
  options = [],
  onChange,
  required,

  // ✅ NEW (optional)
  searchable = false,
  searchPlaceholder = 'Search...',
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const safeOptions = useMemo(() => {
    const arr = Array.isArray(options) ? options : [];
    // ensure strings + unique
    const seen = new Set();
    const out = [];
    for (const x of arr) {
      const s = String(x ?? '').trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }, [options]);

  const filtered = useMemo(() => {
    if (!searchable) return safeOptions;
    const query = String(q || '').trim().toLowerCase();
    if (!query) return safeOptions;
    return safeOptions.filter(opt => opt.toLowerCase().includes(query));
  }, [safeOptions, q, searchable]);

  const close = () => {
    setOpen(false);
    setQ('');
  };

  return (
    <View style={s.dropdownContainer}>
      <Text style={s.dropdownLabel}>
        {label} {required && <Text style={s.required}>*</Text>}
      </Text>

      <TouchableOpacity style={s.dropdownSelected} onPress={() => setOpen(true)}>
        <Text style={value ? s.dropdownSelectedText : s.dropdownPlaceholder}>
          {value || 'Select...'}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#6b7280" />
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={close}>
        <TouchableWithoutFeedback onPress={close}>
          <View style={s.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={s.dropdownModal}>
          <Text style={s.dropdownModalTitle}>{label}</Text>

          {/* ✅ Search bar */}
          {searchable && (
            <View style={s.searchWrap}>
              <Ionicons name="search" size={16} color="#6b7280" />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={searchPlaceholder}
                placeholderTextColor="#9ca3af"
                style={s.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!!q && (
                <TouchableOpacity onPress={() => setQ('')}>
                  <Ionicons name="close-circle" size={18} color="#dc2626" />
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView style={{maxHeight: 260}} keyboardShouldPersistTaps="handled">
            {filtered.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>No results</Text>
              </View>
            ) : (
              filtered.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={s.dropdownItem}
                  onPress={() => {
                    onChange(opt);
                    close();
                  }}>
                  <Text style={s.dropdownItemText}>{opt}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

export const MultiSelectRow = ({
  label,
  values,
  options = [],
  onChange,
  required,

  // ✅ NEW (optional)
  searchable = false,
  searchPlaceholder = 'Search...',
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const selectedText =
    values && values.length > 0 ? values.join(', ') : 'Select...';

  const safeOptions = useMemo(() => {
    const arr = Array.isArray(options) ? options : [];
    const seen = new Set();
    const out = [];
    for (const x of arr) {
      const s = String(x ?? '').trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }, [options]);

  const filtered = useMemo(() => {
    if (!searchable) return safeOptions;
    const query = String(q || '').trim().toLowerCase();
    if (!query) return safeOptions;
    return safeOptions.filter(opt => opt.toLowerCase().includes(query));
  }, [safeOptions, q, searchable]);

  const toggleOption = opt => {
    const arr = Array.isArray(values) ? values : [];
    if (arr.includes(opt)) onChange(arr.filter(v => v !== opt));
    else onChange([...arr, opt]);
  };

  const close = () => {
    setOpen(false);
    setQ('');
  };

  return (
    <View style={s.dropdownContainer}>
      <Text style={s.dropdownLabel}>
        {label} {required && <Text style={s.required}>*</Text>}
      </Text>

      <TouchableOpacity style={s.dropdownSelected} onPress={() => setOpen(true)}>
        <Text style={values?.length ? s.dropdownSelectedText : s.dropdownPlaceholder}>
          {selectedText}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#6b7280" />
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={close}>
        <TouchableWithoutFeedback onPress={close}>
          <View style={s.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={s.dropdownModal}>
          <Text style={s.dropdownModalTitle}>{label}</Text>

          {/* ✅ Search bar */}
          {searchable && (
            <View style={s.searchWrap}>
              <Ionicons name="search" size={16} color="#6b7280" />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={searchPlaceholder}
                placeholderTextColor="#9ca3af"
                style={s.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!!q && (
                <TouchableOpacity onPress={() => setQ('')}>
                  <Ionicons name="close-circle" size={18} color="#dc2626" />
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView style={{maxHeight: 260}} keyboardShouldPersistTaps="handled">
            {filtered.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>No results</Text>
              </View>
            ) : (
              filtered.map(opt => {
                const isSelected = values?.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    style={s.dropdownItem}
                    onPress={() => toggleOption(opt)}>
                    <View style={s.multiRow}>
                      <Text style={s.dropdownItemText}>{opt}</Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={18} color="#16a34a" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity style={s.doneBtn} onPress={close}>
            <Text style={s.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  dropdownContainer: {marginHorizontal: 4, marginBottom: 12},
  dropdownLabel: {fontSize: 14, color: '#374151', marginBottom: 4, fontWeight: '600'},
  required: {color: '#dc2626'},
  dropdownSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
  },
  dropdownSelectedText: {fontSize: 14, color: '#111827'},
  dropdownPlaceholder: {fontSize: 14, color: '#9ca3af'},

  modalOverlay: {flex: 1, backgroundColor: 'rgba(15,23,42,0.3)'},
  dropdownModal: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '20%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 8,
  },
  dropdownModalTitle: {fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#111827'},

  // ✅ search styles
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    backgroundColor: '#f9fafb',
  },
  searchInput: {flex: 1, fontSize: 14, color: '#111827', fontWeight: '600'},

  dropdownItem: {paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb'},
  dropdownItemText: {fontSize: 14, color: '#111827'},
  multiRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},

  emptyBox: {paddingVertical: 14, alignItems: 'center'},
  emptyText: {color: '#6b7280', fontWeight: '600'},

  doneBtn: {
    marginTop: 10,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  doneText: {color: '#fff', fontWeight: '700'},
});
