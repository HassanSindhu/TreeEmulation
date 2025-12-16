import React, {useEffect, useState} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';

import AuthProvider, {useAuth} from '../context/AuthContext';
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import RegistersScreen from '../screens/RegistersScreen';
import AddTreeScreen from '../screens/AddTreeScreen';
import VerificationScreen from '../screens/VerificationScreen';
import ProfileScreen from '../screens/ProfileScreen';
import colors from '../theme/colors';

// ✅ NEW SCREENS (add these files in /screens)
import MatureTreeRecordsScreen from '../screens/MatureTreeRecordsScreen';
import PoleCropRecordsScreen from '../screens/PoleCropRecordsScreen';
import AfforestationRecordsScreen from '../screens/AfforestationRecordsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/** Tabs remain same (Dashboard/Register/Add/Verification/Profile) **/
function TabsForRole({role}) {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        headerTitleAlign: 'center',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#9ca3af',
        tabBarIcon: ({color, size}) => {
          const icons = {
            Dashboard: 'speedometer',
            Registers: 'book',
            Add: 'add-circle',
            Verification: 'checkmark-done-circle',
            Profile: 'person',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Registers" component={RegistersScreen} />
      <Tab.Screen name="Add" component={AddTreeScreen} options={{title: 'Add Tree'}} />
      {(role === 'DFO' || role === 'CCF' || role === 'ADMIN') && (
        <Tab.Screen name="Verification" component={VerificationScreen} />
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/**
 * ✅ NEW: A Stack around Tabs
 * So you can open new screens from AddTreeScreen without adding them in Tab bar.
 */
function MainStack({role}) {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {/* Tabs as the first screen */}
      <Stack.Screen name="Tabs">
        {() => <TabsForRole role={role} />}
      </Stack.Screen>

      {/* ✅ Detail screens opened from AddTreeScreen */}
      <Stack.Screen
        name="MatureTreeRecords"
        component={MatureTreeRecordsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="PoleCropRecords"
        component={PoleCropRecordsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="AfforestationRecords"
        component={AfforestationRecordsScreen}
        options={{headerShown: false}}
      />
    </Stack.Navigator>
  );
}

function Gate() {
  const {user} = useAuth();

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {user ? (
        <Stack.Screen name="Main">
          {() => <MainStack role={user.role} />}
        </Stack.Screen>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1600);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return <SplashScreen />;

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
