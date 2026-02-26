import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Platform, SafeAreaView } from 'react-native';

const FullScreenLoader = ({ visible, text = 'Syncing offline records...' }) => {
    if (!visible) return null;

    return (
        <SafeAreaView pointerEvents="none" style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.content}>
                    <ActivityIndicator size="small" color="#059669" />
                    <Text style={styles.text}>{text}</Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20,
        left: 0,
        right: 0,
        zIndex: 9999,
        elevation: 10,
        alignItems: 'center',
    },
    container: {
        width: '100%',
        alignItems: 'center',
    },
    content: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 30,
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    text: {
        marginLeft: 12,
        fontSize: 13,
        fontWeight: '700',
        color: '#059669',
    }
});

export default FullScreenLoader;
