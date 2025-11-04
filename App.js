import React from 'react';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import colors from './src/theme/colors';

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

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}
