import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export const DropdownRow = ({label, value, options, onChange, required}) => {
  const [open, setOpen] = useState(false);

  return (
    <View style={s.dropdownContainer}>
      <Text style={s.dropdownLabel}>
        {label} {required && <Text style={s.required}>*</Text>}
      </Text>

      <TouchableOpacity
        style={s.dropdownSelected}
        onPress={() => setOpen(true)}>
        <Text style={value ? s.dropdownSelectedText : s.dropdownPlaceholder}>
          {value || 'Select...'}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#6b7280" />
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={s.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={s.dropdownModal}>
          <Text style={s.dropdownModalTitle}>{label}</Text>
          <ScrollView style={{maxHeight: 260}}>
            {options.map(opt => (
              <TouchableOpacity
                key={opt}
                style={s.dropdownItem}
                onPress={() => {
                  onChange(opt);
                  setOpen(false);
                }}>
                <Text style={s.dropdownItemText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

export const MultiSelectRow = ({label, values, options, onChange, required}) => {
  const [open, setOpen] = useState(false);
  const selectedText =
    values && values.length > 0 ? values.join(', ') : 'Select...';

  const toggleOption = opt => {
    const arr = Array.isArray(values) ? values : [];
    if (arr.includes(opt)) onChange(arr.filter(v => v !== opt));
    else onChange([...arr, opt]);
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

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={s.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={s.dropdownModal}>
          <Text style={s.dropdownModalTitle}>{label}</Text>
          <ScrollView style={{maxHeight: 260}}>
            {options.map(opt => {
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
            })}
          </ScrollView>
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
  dropdownItem: {paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb'},
  dropdownItemText: {fontSize: 14, color: '#111827'},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(15,23,42,0.3)'},
  multiRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
});
