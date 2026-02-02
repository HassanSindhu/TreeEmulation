
import React from 'react';
import { View, Modal, ActivityIndicator, Text, StyleSheet } from 'react-native';

const FullScreenLoader = ({ visible, text = 'Syncing records...' }) => {
    return (
        <Modal
            transparent={true}
            animationType="fade"
            visible={visible}
            onRequestClose={() => { }}>
            <View style={styles.container}>
                <View style={styles.content}>
                    <ActivityIndicator size="large" color="#000" />
                    <Text style={styles.text}>{text}</Text>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    text: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    }
});

export default FullScreenLoader;
