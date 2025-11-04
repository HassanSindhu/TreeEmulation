import React, {useState} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, ImageBackground, ActivityIndicator
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../context/AuthContext';
import colors from '../theme/colors';

export default function LoginScreen(){
  const {login} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async () => {
    setErr('');
    if (!email || !password) {
      setErr('Please enter email and password');
      return;
    }
    try {
      setLoading(true);
      // TODO: if remember, persist email in AsyncStorage (later)
      await login({email, password});
    } catch (e) {
      setErr('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{flex:1, backgroundColor:'#fff'}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* Top banner */}
      <ImageBackground
        source={require('../assets/images/login-bg.jpg')}
        resizeMode="cover"
        style={styles.banner}
      >
        <View style={styles.overlay}/>
        <View style={styles.bannerInner}>
          <Image source={require('../assets/images/logo.png')} style={styles.logo} />
          <Text style={styles.appName}>Punjab Tree Enumeration</Text>
          <Text style={styles.tagline}>Enumeration of trees along linear plantations in Punjab</Text>
        </View>
      </ImageBackground>

      {/* Card form */}
      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Use your department account</Text>

          {/* Error */}
          {!!err && (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={16} color="#b91c1c" />
              <Text style={styles.errTxt}>{err}</Text>
            </View>
          )}

          {/* Email */}
          <View style={styles.inputRow}>
            <Ionicons name="mail" size={20} color={colors.muted} style={styles.inputIcon}/>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed" size={20} color={colors.muted} style={styles.inputIcon}/>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={secure}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
            <TouchableOpacity style={styles.trailing} onPress={()=>setSecure(s=>!s)}>
              <Ionicons name={secure ? 'eye-off' : 'eye'} size={20} color={colors.muted}/>
            </TouchableOpacity>
          </View>

          {/* Remember + Forgot */}
          <View style={styles.rowJustify}>
            <TouchableOpacity style={styles.rowCenter} onPress={()=>setRemember(r=>!r)}>
              <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
                {remember && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.chkTxt}>Remember me</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={styles.link}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign in button */}
          <TouchableOpacity style={styles.signInBtn} onPress={onSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff"/>
            ) : (
              <>
                <Text style={styles.signInTxt}>Sign in</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" style={{marginLeft:8}} />
              </>
            )}
          </TouchableOpacity>

          {/* Help line */}
          <View style={styles.helperRow}>
            <Ionicons name="information-circle" size={16} color="#6b7280" />
            <Text style={styles.helperText}> Need access? Contact Admin</Text>
          </View>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  banner: {height: 220, justifyContent: 'flex-end'},
  overlay: {...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.35)'},
  bannerInner: {paddingHorizontal: 20, paddingBottom: 20},
  logo: {width: 56, height: 56, marginBottom: 10},
  appName: {color:'#fff', fontWeight:'800', fontSize:18},
  tagline: {color:'#e5e7eb', marginTop:4, fontSize:12},

  cardWrap: {flex:1, marginTop:-28},
  card: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor:'#fff',
    borderWidth: 1, borderColor:'#e5e7eb',
    shadowColor:'#000', shadowOpacity:0.06, shadowRadius:12, elevation:3,
  },

  title: {fontSize:22, fontWeight:'800', color:'#111827'},
  subtitle: {marginTop:4, color:'#6b7280', marginBottom: 14},

  errBox: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:'#fee2e2', borderColor:'#fecaca', borderWidth:1,
    paddingHorizontal:10, paddingVertical:8, borderRadius:10, marginBottom:10,
  },
  errTxt: {color:'#b91c1c', marginLeft:6, fontWeight:'600'},

  inputRow: {
    flexDirection:'row', alignItems:'center',
    borderColor:'#e5e7eb', borderWidth:1, borderRadius:14,
    paddingHorizontal:12, backgroundColor:'#fff', marginBottom:12, height:52,
  },
  inputIcon: { marginRight:8 },
  input: { flex:1, color:'#111827', paddingVertical:10 },
  trailing: { paddingLeft:8, paddingVertical:6 },

  rowJustify: {flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:2},
  rowCenter: {flexDirection:'row', alignItems:'center'},
  checkbox: {
    width:18, height:18, borderRadius:4, marginRight:8,
    borderWidth:1, borderColor:'#d1d5db', alignItems:'center', justifyContent:'center',
    backgroundColor:'#fff'
  },
  checkboxChecked: {backgroundColor: colors.primary, borderColor: colors.primary},
  chkTxt: {color:'#374151'},

  link: {color: colors.primary, fontWeight:'700'},

  signInBtn: {
    backgroundColor: colors.primary,
    height: 50, borderRadius: 14,
    alignItems:'center', justifyContent:'center', flexDirection:'row',
    marginTop: 14, elevation:3,
    shadowColor: colors.primary, shadowOpacity:0.25, shadowRadius:8,
  },
  signInTxt: {color:'#fff', fontWeight:'700', fontSize:16},

  helperRow: {flexDirection:'row', justifyContent:'center', marginTop:12},
  helperText: {color:'#6b7280'},

  footer: {textAlign:'center', color:'#9ca3af', marginTop:12, marginBottom:12},
});
