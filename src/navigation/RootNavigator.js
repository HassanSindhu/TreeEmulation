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

// RECORD SCREENS
import MatureTreeRecordsScreen from '../screens/MatureTreeRecordsScreen';
import PoleCropRecordsScreen from '../screens/PoleCropRecordsScreen';
import AfforestationRecordsScreen from '../screens/AfforestationRecordsScreen';

// ✅ NEW DETAIL SCREENS
import DisposalScreen from '../screens/DisposalScreen';
import SuperdariScreen from '../screens/SuperdariScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/* -------------------- TABS -------------------- */
function TabsForRole({role}) {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
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

/* -------------------- MAIN STACK -------------------- */
function MainStack({role}) {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {/* Tabs */}
      <Stack.Screen name="Tabs">
        {() => <TabsForRole role={role} />}
      </Stack.Screen>

      {/* Tree Record Screens */}
      <Stack.Screen name="MatureTreeRecords" component={MatureTreeRecordsScreen} />
      <Stack.Screen name="PoleCropRecords" component={PoleCropRecordsScreen} />
      <Stack.Screen name="AfforestationRecords" component={AfforestationRecordsScreen} />

      {/* ✅ Disposal & Superdari Screens */}
      <Stack.Screen
        name="Disposal"
        component={DisposalScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Superdari"
        component={SuperdariScreen}
        options={{headerShown: false}}
      />
    </Stack.Navigator>
  );
}

/* -------------------- AUTH GATE -------------------- */
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

/* -------------------- ROOT -------------------- */
export default function RootNavigator() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 2600);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return <SplashScreen />;

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
