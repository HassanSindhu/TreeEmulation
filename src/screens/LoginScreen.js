// /screens/LoginScreen.js
import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {BlurView} from '@react-native-community/blur';
import {useAuth} from '../context/AuthContext';
import colors from '../theme/colors';

export default function LoginScreen() {
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
      await login({email, password, remember});
    } catch (e) {
      setErr(e?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{flex: 1}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ImageBackground
        source={require('../assets/images/login-BG.png')}
        style={styles.bg}
        resizeMode="cover">
        <View style={styles.bgOverlay} />

        <View style={styles.centerWrap}>
          <View style={styles.brandBlock}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <Text style={styles.brandTitle}>Punjab Tree Enumeration</Text>
            <Text style={styles.brandSub}>Field · Verify · Protect</Text>
          </View>

          <View style={styles.glassOuter}>
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType="light"
              blurAmount={18}
              reducedTransparencyFallbackColor="rgba(255,255,255,0.35)"
            />

            <View style={styles.glassInner}>
              <Text style={styles.title}>Sign in</Text>
              <Text style={styles.subtitle}>Use your department account</Text>

              {!!err && (
                <View style={styles.errBox}>
                  <Ionicons name="alert-circle" size={16} color="#b91c1c" />
                  <Text style={styles.errTxt}>{err}</Text>
                </View>
              )}

              <View style={styles.inputRow}>
                <Ionicons
                  name="mail"
                  size={20}
                  color="rgba(17,24,39,0.65)"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="rgba(17,24,39,0.45)"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputRow}>
                <Ionicons
                  name="lock-closed"
                  size={20}
                  color="rgba(17,24,39,0.65)"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="rgba(17,24,39,0.45)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={secure}
                  returnKeyType="done"
                  onSubmitEditing={onSubmit}
                />
                <TouchableOpacity
                  style={styles.trailing}
                  onPress={() => setSecure(s => !s)}>
                  <Ionicons
                    name={secure ? 'eye-off' : 'eye'}
                    size={20}
                    color="rgba(17,24,39,0.65)"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.rowJustify}>
                <TouchableOpacity
                  style={styles.rowCenter}
                  onPress={() => setRemember(r => !r)}>
                  <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
                    {remember && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={styles.chkTxt}>Remember me</Text>
                </TouchableOpacity>

                <TouchableOpacity>
                  <Text style={styles.link}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.signInBtn}
                onPress={onSubmit}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.signInTxt}>Sign in</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color="#fff"
                      style={{marginLeft: 8}}
                    />
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.helperRow}>
                <Ionicons
                  name="information-circle"
                  size={16}
                  color="rgba(17,24,39,0.55)"
                />
                <Text style={styles.helperText}> Need access? Contact Admin</Text>
              </View>
            </View>
          </View>
        </View>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg: {flex: 1},
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  centerWrap: {flex: 1, justifyContent: 'center', paddingHorizontal: 16},

  brandBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  brandLogo: {
    width: 130,
    height: 130,
    marginBottom: 10,
    shadowColor: '#ffffff',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 10,
  },
  brandTitle: {color: '#fff', fontWeight: '900', fontSize: 20, textAlign: 'center'},
  brandSub: {color: 'rgba(255,255,255,0.85)', marginTop: 4, fontSize: 12, textAlign: 'center'},

  glassOuter: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  glassInner: {padding: 16, backgroundColor: 'rgba(255,255,255,0.20)'},

  title: {fontSize: 22, fontWeight: '900', color: '#111827'},
  subtitle: {
    marginTop: 4,
    color: 'rgba(17,24,39,0.70)',
    marginBottom: 14,
    fontWeight: '600',
  },

  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(254,226,226,0.85)',
    borderColor: 'rgba(252,165,165,0.75)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 10,
  },
  errTxt: {color: '#b91c1c', marginLeft: 6, fontWeight: '700'},

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.40)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: 12,
    height: 52,
  },
  inputIcon: {marginRight: 8},
  input: {flex: 1, color: '#111827', paddingVertical: 10, fontWeight: '700'},
  trailing: {paddingLeft: 8, paddingVertical: 6},

  rowJustify: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  rowCenter: {flexDirection: 'row', alignItems: 'center'},
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  checkboxChecked: {backgroundColor: colors.primary, borderColor: colors.primary},
  chkTxt: {color: 'rgba(17,24,39,0.80)', fontWeight: '800'},

  link: {color: colors.primary, fontWeight: '900'},

  signInBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 14,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  signInTxt: {color: '#fff', fontWeight: '900', fontSize: 16},

  helperRow: {flexDirection: 'row', justifyContent: 'center', marginTop: 12},
  helperText: {color: 'rgba(17,24,39,0.70)', fontWeight: '600'},
});
