// App.js
import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import colors from './src/theme/colors';
import { AuthProvider } from './src/context/AuthContext';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: '#ffffff',
    text: '#111827',
    card: '#ffffff',
    border: '#e5e7eb',
    notification: colors.primary,
  },
};

import { requestUserPermission, notificationListener } from './src/services/NotificationService';

export default function App() {
  React.useEffect(() => {
    requestUserPermission();
    const unsubscribe = notificationListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);
  return (
    <AuthProvider>
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}