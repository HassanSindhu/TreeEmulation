// /src/navigation/RootNavigator.js
import React, {useEffect, useState, useMemo} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {useAuth} from '../context/AuthContext';
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen'; // ADD THIS IMPORT
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
import EnumerationAuditScreen from '../screens/EnumerationAuditScreen';
import PoleCropAuditScreen from '../screens/PoleCropAuditScreen';

import AfforestationAuditListScreen from '../screens/AfforestationAuditListScreen';


const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabsForRole({role}) {
  const r = String(role || '').toLowerCase();

  // Roles
  const isGuard = r === 'beat_officer';
  const isOfficer = ['block_officer', 'sdfo', 'dfo', 'surveyor'].includes(r);

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
      {/* Keep Dashboard for everyone */}
      <Tab.Screen name="Dashboard" component={DashboardScreen} />

      {/* Guard-only: hide for officers */}
      {isGuard && <Tab.Screen name="Registers" component={RegistersScreen} />}
      {isGuard && (
        <Tab.Screen name="Add" component={AddTreeScreen} options={{title: 'Add Tree'}} />
      )}

      {/* Officer-only Verification */}
      {isOfficer && <Tab.Screen name="Verification" component={VerificationScreen} />}

      {/* Profile for everyone */}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function MainStack({role}) {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Tabs">{() => <TabsForRole role={role} />}</Stack.Screen>

      {/* Detail screens (keep as-is) */}
      <Stack.Screen name="MatureTreeRecords" component={MatureTreeRecordsScreen} />
      <Stack.Screen name="PoleCropRecords" component={PoleCropRecordsScreen} />
      <Stack.Screen name="AfforestationRecords" component={AfforestationRecordsScreen} />

      <Stack.Screen name="Disposal" component={DisposalScreen} />
      <Stack.Screen name="Superdari" component={SuperdariScreen} />

      <Stack.Screen name="EnumerationAudit" component={EnumerationAuditScreen} />
      <Stack.Screen name="PoleCropAuditScreen" component={PoleCropAuditScreen} />
      <Stack.Screen
              name="AfforestationAuditListScreen"
              component={AfforestationAuditListScreen}
            />

    </Stack.Navigator>
  );
}


function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{
          title: 'Create Account',
          headerShown: true,
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerTransparent: true,
          headerTintColor: '#111827',
          headerTitleStyle: {
            fontWeight: '900',
          },
          headerBackTitle: 'Back',
          animation: 'slide_from_right',
        }}
      />
    </Stack.Navigator>
  );
}

function Gate() {
  const {user, booting} = useAuth();

  // ✅ role normalized already in AuthContext; keep safe anyway
  const role = useMemo(() => {
    const rr = user?.role;
    if (!rr) return '';
    if (Array.isArray(rr)) return rr[0] || '';
    return String(rr);
  }, [user]);

  if (booting) return <SplashScreen />;

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {user ? (
        <Stack.Screen name="Main">{() => <MainStack role={role} />}</Stack.Screen>
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
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