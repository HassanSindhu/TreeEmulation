import React, {createContext, useContext, useMemo, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({children}) {
  const [user, setUser] = useState(null);

  const login = async ({email, password}) => {
    // TODO: replace with real API call
    // const res = await api.login(email, password); await AsyncStorage.setItem('token', res.token);
    setUser({id: 'u_1', name: 'Muhammad Ali', role: 'Forest Guard'}); // ENUMERATOR | DFO | CCF | ADMIN
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setUser(null);
  };

  const value = useMemo(() => ({user, login, logout}), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
