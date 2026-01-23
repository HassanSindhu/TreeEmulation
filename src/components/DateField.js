import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function DateField({
    label,
    value, // Expecting Date object or ISO string (or empty)
    onChange, // (date) => void
    placeholder = 'Select Date',
    containerStyle,
}) {
    const [show, setShow] = useState(false);

    const dateValue = value ? new Date(value) : null;
    const displayValue = dateValue && !isNaN(dateValue.getTime()) ? dateValue : new Date();

    const handleChange = (event, selectedDate) => {
        // On Android, dismiss or set date
        if (Platform.OS === 'android') {
            setShow(false);
        }

        if (event.type === 'dismissed') {
            return;
        }

        if (selectedDate) {
            onChange(selectedDate);
        }
    };

    // Helper to format: YYYY-MM-DD
    const formatDate = (date) => {
        if (!date || isNaN(date.getTime())) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const formattedText = dateValue ? formatDate(dateValue) : '';

    return (
        <View style={[styles.container, containerStyle]}>
            {!!label && <Text style={styles.label}>{label}</Text>}

            <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShow(true)}
                activeOpacity={0.7}
            >
                <Text style={[styles.text, !formattedText && styles.placeholder]}>
                    {formattedText || placeholder}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
            </TouchableOpacity>

            {/* Android: simple conditional render */}
            {Platform.OS === 'android' && show && (
                <DateTimePicker
                    value={displayValue}
                    mode="date"
                    display="default"
                    onChange={handleChange}
                />
            )}

            {/* iOS: Needs a Modal wrapper usually to look good, or inline inside view. 
          Standard native behavior on iOS is often bottom sheet or inline. 
          For simplicity, we use a Modal centered pattern or bottom sheet pattern here.
          But basic implementation:
      */}
            {Platform.OS === 'ios' && show && (
                <Modal transparent animationType="slide" visible={show}>
                    <View style={styles.iosModalOverlay}>
                        <View style={styles.iosModalContent}>
                            <View style={styles.iosHeader}>
                                <TouchableOpacity onPress={() => setShow(false)}>
                                    <Text style={styles.iosCancel}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setShow(false)}>
                                    <Text style={styles.iosDone}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={displayValue}
                                mode="date"
                                display="spinner"
                                onChange={handleChange}
                                style={{ height: 200 }}
                            />
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
    },
    label: {
        fontSize: 12,
        fontWeight: '800',
        color: '#1f2937',
        marginBottom: 6,
    },
    inputContainer: {
        height: 46,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
    },
    text: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1f2937',
    },
    placeholder: {
        color: '#6b7280',
        fontWeight: 'normal',
    },
    // iOS Modal Styles
    iosModalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    iosModalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingBottom: 20,
    },
    iosHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        marginBottom: 0,
    },
    iosCancel: {
        color: '#ef4444',
        fontSize: 16,
        fontWeight: '600'
    },
    iosDone: {
        color: '#059669',
        fontSize: 16,
        fontWeight: '600'
    }
});
