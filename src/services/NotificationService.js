import messaging from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform, Alert } from 'react-native';

export const requestUserPermission = async () => {
    try {
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
            if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                console.log('Notification permission granted.');
                await getFcmToken();
            } else {
                console.log('Notification permission denied');
            }
        } else {
            const authStatus = await messaging().requestPermission();
            const enabled =
                authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                authStatus === messaging.AuthorizationStatus.PROVISIONAL;

            if (enabled) {
                console.log('Authorization status:', authStatus);
                await getFcmToken();
            }
        }
    } catch (error) {
        console.warn('Permission request error:', error);
    }
};

const getFcmToken = async () => {
    try {
        // Register the device with FCM
        await messaging().registerDeviceForRemoteMessages();

        const fcmToken = await messaging().getToken();
        if (fcmToken) {
            console.log('Your Firebase Token is:', fcmToken);
            // TODO: Send this token to your server or save it for testing
        } else {
            console.log('Failed', 'No token received');
        }
    } catch (error) {
        console.log('Error fetching token:', error);
    }
};

export const notificationListener = () => {
    // Assume a message-notification contains a "type" property in the data payload of the screen to open

    // Background/Quit state handler when opened
    messaging().onNotificationOpenedApp(remoteMessage => {
        console.log(
            'Notification caused app to open from background state:',
            remoteMessage.notification,
        );
        // You can handle navigation here if needed
    });

    // Quit state handler when opened
    messaging()
        .getInitialNotification()
        .then(remoteMessage => {
            if (remoteMessage) {
                console.log(
                    'Notification caused app to open from quit state:',
                    remoteMessage.notification,
                );
            }
        });

    // Foreground handler
    const unsubscribe = messaging().onMessage(async remoteMessage => {
        console.log('A new FCM message arrived!', JSON.stringify(remoteMessage));
        Alert.alert('New Notification', remoteMessage.notification?.body || 'You have a new message');
    });

    return unsubscribe;
};
