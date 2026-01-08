// /src/navigation/RootNavigator.js
import React, {useEffect, useState, useMemo} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {useAuth} from '../context/AuthContext';
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import RegistersScreen from '../screens/RegistersScreen';
import AddTreeScreen from '../screens/AddTreeScreen';
import VerificationScreen from '../screens/VerificationScreen';
import ProfileScreen from '../screens/ProfileScreen';
import colors from '../theme/colors';

import MatureTreeRecordsScreen from '../screens/MatureTreeRecordsScreen';
import PoleCropRecordsScreen from '../screens/PoleCropRecordsScreen';
import AfforestationRecordsScreen from '../screens/AfforestationRecordsScreen';

import DisposalScreen from '../screens/DisposalScreen';
import SuperdariScreen from '../screens/SuperdariScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabsForRole({role}) {
  const canVerify = role === 'DFO' || role === 'CCF' || role === 'ADMIN';

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
      {canVerify && <Tab.Screen name="Verification" component={VerificationScreen} />}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function MainStack({role}) {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Tabs">{() => <TabsForRole role={role} />}</Stack.Screen>

      {/* Detail screens */}
      <Stack.Screen name="MatureTreeRecords" component={MatureTreeRecordsScreen} />
      <Stack.Screen name="PoleCropRecords" component={PoleCropRecordsScreen} />
      <Stack.Screen name="AfforestationRecords" component={AfforestationRecordsScreen} />

      <Stack.Screen name="Disposal" component={DisposalScreen} />
      <Stack.Screen name="Superdari" component={SuperdariScreen} />
    </Stack.Navigator>
  );
}

function Gate() {
  const {user, booting} = useAuth();

  // ✅ role normalized already in AuthContext; keep safe anyway
  const role = useMemo(() => {
    const r = user?.role;
    if (!r) return '';
    if (Array.isArray(r)) return r[0] || '';
    return String(r);
  }, [user]);

  if (booting) return <SplashScreen />;

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {user ? (
        <Stack.Screen name="Main">{() => <MainStack role={role} />}</Stack.Screen>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 2600);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return <SplashScreen />;

  return <Gate />;
}
