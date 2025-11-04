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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabsForRole({role}) {
  return (
    <Tab.Navigator
      screenOptions={({route})=>({
        headerShown: false, // Add this line to remove header from all tab screens
        headerTitleAlign:'center',
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
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen}/>
      <Tab.Screen name="Registers" component={RegistersScreen}/>
      <Tab.Screen name="Add" component={AddTreeScreen} options={{title:'Add Tree'}}/>
      {(role === 'DFO' || role === 'CCF' || role === 'ADMIN') && (
        <Tab.Screen name="Verification" component={VerificationScreen}/>
      )}
      <Tab.Screen name="Profile" component={ProfileScreen}/>
    </Tab.Navigator>
  );
}

function Gate() {
  const {user} = useAuth();
  return (
    <Stack.Navigator>
      {user ? (
        <Stack.Screen name="Main" options={{headerShown:false}}>
          {() => <TabsForRole role={user.role} />}
        </Stack.Screen>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{headerShown:false}}/>
      )}
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const [ready, setReady] = useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setReady(true), 1600); return ()=>clearTimeout(t); },[]);
  if (!ready) return <SplashScreen/>;
  return (
    <AuthProvider>
      <Gate/>
    </AuthProvider>
  );
}