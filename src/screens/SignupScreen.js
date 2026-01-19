// /screens/SignupScreen.js
import React, {useEffect, useMemo, useRef, useState} from 'react';
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
  ScrollView,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {BlurView} from '@react-native-community/blur';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import Clipboard from '@react-native-clipboard/clipboard';
import colors from '../theme/colors';

// ✅ API base
const API_BASE_URL = 'http://be.lte.gisforestry.com';

// ✅ Empty token (as per your requirement)
const EMPTY_TOKEN = '';

/**
 * ✅ FIX: InlineAddRow moved OUTSIDE SignupScreen
 * Prevents remount on every keystroke -> keyboard no longer closes.
 */
const InlineAddRow = React.memo(function InlineAddRow({
  visible,
  placeholder,
  value,
  onChange,
  onCancel,
  onSave,
  saving,
}) {
  if (!visible) return null;

  return (
    <View style={styles.inlineAddWrap}>
      <View style={styles.inlineAddInputRow}>
        <Ionicons
          name="create-outline"
          size={18}
          color="rgba(17,24,39,0.65)"
          style={{marginRight: 8}}
        />
        <TextInput
          style={styles.inlineAddInput}
          placeholder={placeholder}
          placeholderTextColor="rgba(17,24,39,0.45)"
          value={value}
          onChangeText={onChange}
          autoCapitalize="words"
          returnKeyType="done"
          blurOnSubmit={false}
        />
      </View>

      <View style={styles.inlineAddBtns}>
        <TouchableOpacity
          style={[styles.inlineBtn, styles.inlineBtnCancel]}
          onPress={onCancel}
          disabled={saving}>
          <Text style={styles.inlineBtnTextCancel}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.inlineBtn, styles.inlineBtnSave, saving && {opacity: 0.7}]}
          onPress={onSave}
          disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.inlineBtnTextSave}>Save</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default function SignupScreen({navigation}) {
  // ---------------------------
  // Form state
  // ---------------------------
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    cnic: '',
    roleSlug: '',

    zoneId: '',
    circleId: '',
    divisionId: '',
    subDivisionId: '',
    blockId: '',
    beatId: '',

    designationEmail: '',
    dateOfPosting: new Date().toISOString().split('T')[0],
    placeOfPosting: '',
  });

  const [loading, setLoading] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingDesignation, setLoadingDesignation] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ---------------------------
  // Dropdown data
  // ---------------------------
  const [roles, setRoles] = useState([]);
  const [zones, setZones] = useState([]);
  const [circles, setCircles] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [subDivisions, setSubDivisions] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [beats, setBeats] = useState([]);

  // ---------------------------
  // Dropdown visibility
  // ---------------------------
  const [showRoles, setShowRoles] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const [showCircles, setShowCircles] = useState(false);
  const [showDivisions, setShowDivisions] = useState(false);
  const [showSubDivisions, setShowSubDivisions] = useState(false);
  const [showBlocks, setShowBlocks] = useState(false);
  const [showBeats, setShowBeats] = useState(false);

  const [securePassword, setSecurePassword] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Avoid state update after unmount + avoid duplicate designation calls
  const aliveRef = useRef(true);
  const lastDesignationKeyRef = useRef('');

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // ---------------------------
  // INLINE ADD (SubDivision/Block/Beat)
  // ---------------------------
  const [addMode, setAddMode] = useState({
    subDivision: false,
    block: false,
    beat: false,
  });

  const [newName, setNewName] = useState({
    subDivision: '',
    block: '',
    beat: '',
  });

  const [savingInline, setSavingInline] = useState({
    subDivision: false,
    block: false,
    beat: false,
  });

  const normalizeName = v => String(v || '').trim().replace(/\s+/g, ' ');

  const ensureParentSelectedOrWarn = type => {
    if (type === 'subDivision' && !formData.divisionId) {
      Alert.alert('Select Division', 'Please select Division first.');
      return false;
    }
    if (type === 'block' && !formData.subDivisionId) {
      Alert.alert('Select Sub Division', 'Please select Sub Division first.');
      return false;
    }
    if (type === 'beat' && !formData.blockId) {
      Alert.alert('Select Block', 'Please select Block first.');
      return false;
    }
    return true;
  };

  const openInlineAdd = type => {
    if (!ensureParentSelectedOrWarn(type)) return;
    setAddMode(p => ({...p, [type]: true}));
    setNewName(p => ({...p, [type]: ''}));
  };

  const closeInlineAdd = type => {
    setAddMode(p => ({...p, [type]: false}));
    setNewName(p => ({...p, [type]: ''}));
  };

  const createSubDivision = async name => {
    const payload = {name, division_id: Number(formData.divisionId)};
    const res = await axios.post(`${API_BASE_URL}/forest-info/sub-divisions`, payload, {
      headers: {'Content-Type': 'application/json'},
      timeout: 20000,
    });
    return res.data;
  };

  const createBlock = async name => {
    const payload = {name, sub_division_id: Number(formData.subDivisionId)};
    const res = await axios.post(`${API_BASE_URL}/forest-info/blocks`, payload, {
      headers: {'Content-Type': 'application/json'},
      timeout: 20000,
    });
    return res.data;
  };

  const createBeat = async name => {
    const payload = {name, block_id: Number(formData.blockId)};
    const res = await axios.post(`${API_BASE_URL}/forest-info/beats`, payload, {
      headers: {'Content-Type': 'application/json'},
      timeout: 20000,
    });
    return res.data;
  };

  const handleInlineSave = async type => {
    if (!ensureParentSelectedOrWarn(type)) return;

    const name = normalizeName(newName[type]);
    if (!name) {
      Alert.alert('Name required', 'Please enter a name.');
      return;
    }

    try {
      setSavingInline(p => ({...p, [type]: true}));

      // Prevent duplicates (client-side)
      const list = type === 'subDivision' ? subDivisions : type === 'block' ? blocks : beats;
      const already = list.some(
        x => normalizeName(x?.name).toLowerCase() === name.toLowerCase(),
      );
      if (already) {
        Alert.alert('Already exists', 'This name is already in the list.');
        return;
      }

      let data;
      if (type === 'subDivision') data = await createSubDivision(name);
      if (type === 'block') data = await createBlock(name);
      if (type === 'beat') data = await createBeat(name);

      if (data?.statusCode === 200 || data?.statusCode === 201) {
        // Backend may return created object in data.data
        const created = data?.data;

        // Fallback if API returns only message → refetch list
        if (!created?.id) {
          if (type === 'subDivision') await fetchSubDivisions(formData.divisionId);
          if (type === 'block') await fetchBlocks(formData.subDivisionId);
          if (type === 'beat') await fetchBeats(formData.blockId);

          Alert.alert('Added', 'Added in list, you can check.');
          closeInlineAdd(type);
          return;
        }

        if (type === 'subDivision') {
          setSubDivisions(p => [created, ...p]);
          setFormData(prev => ({...prev, subDivisionId: created.id}));
        }
        if (type === 'block') {
          setBlocks(p => [created, ...p]);
          setFormData(prev => ({...prev, blockId: created.id}));
        }
        if (type === 'beat') {
          setBeats(p => [created, ...p]);
          setFormData(prev => ({...prev, beatId: created.id}));
        }

        Alert.alert('Added', 'Added in list, you can check.');
        closeInlineAdd(type);
      } else {
        Alert.alert('Failed', data?.message || 'Could not create. Please try again.');
      }
    } catch (e) {
      console.error(`inline create ${type} error:`, e?.response?.data || e?.message || e);
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Something went wrong.');
    } finally {
      setSavingInline(p => ({...p, [type]: false}));
    }
  };

  // ---------------------------
  // ROLE → REQUIRED HIERARCHY
  // ---------------------------
  const REQUIRED_LEVELS_BY_ROLE = useMemo(
    () => ({
      dfo: ['zone', 'circle', 'division'],
      sdfo: ['zone', 'circle', 'division', 'subDivision'],
      block_officer: ['zone', 'circle', 'division', 'subDivision', 'block'],
      beat_officer: ['zone', 'circle', 'division', 'subDivision', 'block', 'beat'],
    }),
    [],
  );

  const requiredLevels = useMemo(() => {
    return REQUIRED_LEVELS_BY_ROLE[formData.roleSlug] || [];
  }, [REQUIRED_LEVELS_BY_ROLE, formData.roleSlug]);

  const needs = level => requiredLevels.includes(level);

  const shouldShowDivision = () => needs('division');
  const shouldShowSubDivision = () => needs('subDivision');
  const shouldShowBlock = () => needs('block');
  const shouldShowBeat = () => needs('beat');

  const hasAllFieldsForRole = () => {
    const {roleSlug, zoneId, circleId, divisionId, subDivisionId, blockId, beatId} = formData;
    if (!roleSlug) return false;
    const req = REQUIRED_LEVELS_BY_ROLE[roleSlug];
    if (!req) return false;

    if (!zoneId || !circleId) return false;
    if (req.includes('division') && !divisionId) return false;
    if (req.includes('subDivision') && !subDivisionId) return false;
    if (req.includes('block') && !blockId) return false;
    if (req.includes('beat') && !beatId) return false;

    return true;
  };

  // ---------------------------
  // INIT: Fetch Roles + Zones
  // ---------------------------
  useEffect(() => {
    fetchRoles();
    fetchZones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------
  // Dependent fetch flows
  // ---------------------------
  useEffect(() => {
    if (!formData.zoneId) return;
    fetchCircles(formData.zoneId);
    clearDependentData('zone');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.zoneId]);

  useEffect(() => {
    if (!formData.circleId) return;
    fetchDivisions(formData.circleId);
    clearDependentData('circle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.circleId]);

  useEffect(() => {
    if (!formData.divisionId) return;

    if (shouldShowSubDivision()) {
      fetchSubDivisions(formData.divisionId);
    } else {
      setSubDivisions([]);
    }

    clearDependentData('division');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.divisionId]);

  useEffect(() => {
    if (!formData.subDivisionId) return;

    if (shouldShowBlock()) {
      fetchBlocks(formData.subDivisionId);
    } else {
      setBlocks([]);
    }

    clearDependentData('subDivision');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.subDivisionId]);

  useEffect(() => {
    if (!formData.blockId) return;

    if (shouldShowBeat()) {
      fetchBeats(formData.blockId);
    } else {
      setBeats([]);
    }

    clearDependentData('block');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.blockId]);

  // ---------------------------
  // Designation Email fetch
  // ---------------------------
  useEffect(() => {
    const run = async () => {
      setError('');
      setSuccess('');

      const {roleSlug, zoneId, circleId, divisionId, subDivisionId, blockId, beatId} = formData;
      if (!roleSlug) return;
      if (!hasAllFieldsForRole()) return;

      const payload = {
        roleSlug,
        zoneId: Number(zoneId),
        circleId: Number(circleId),
      };
      if (shouldShowDivision()) payload.divisionId = Number(divisionId);
      if (shouldShowSubDivision()) payload.subDivisionId = Number(subDivisionId);
      if (shouldShowBlock()) payload.blockId = Number(blockId);
      if (shouldShowBeat()) payload.beatId = Number(beatId);

      const key = JSON.stringify(payload);
      if (lastDesignationKeyRef.current === key) return;
      lastDesignationKeyRef.current = key;

      try {
        setLoadingDesignation(true);

        const res = await axios.post(`${API_BASE_URL}/auth/get-designation-email`, payload, {
          headers: {'Content-Type': 'application/json'},
          timeout: 20000,
        });

        if (!aliveRef.current) return;

        if (res.data?.statusCode === 200) {
          const de = res.data?.data?.designationEmail || '';
          setFormData(prev => ({...prev, designationEmail: de}));
        } else {
          setFormData(prev => ({...prev, designationEmail: ''}));
        }
      } catch (e) {
        console.error('get-designation-email error:', e?.response?.data || e?.message || e);
        if (!aliveRef.current) return;
        setFormData(prev => ({...prev, designationEmail: ''}));
      } finally {
        if (aliveRef.current) setLoadingDesignation(false);
      }
    };

    const t = setTimeout(run, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.roleSlug,
    formData.zoneId,
    formData.circleId,
    formData.divisionId,
    formData.subDivisionId,
    formData.blockId,
    formData.beatId,
  ]);

  // ---------------------------
  // API Calls
  // ---------------------------
  const fetchRoles = async () => {
    try {
      setLoadingRoles(true);

      const res = await axios.get(`${API_BASE_URL}/iam/roles`, {
        headers: {
          Authorization: `Bearer ${EMPTY_TOKEN}`,
        },
        timeout: 20000,
      });

      if (res.data?.statusCode === 200) {
        const list = (res.data.data || [])
          .filter(r => r.isActive && !r.isSystemRole)
          .filter(r => ['dfo', 'sdfo', 'block_officer', 'beat_officer'].includes(r.code))
          .sort((a, b) => (a.level ?? 0) - (b.level ?? 0));

        setRoles(list);
      } else {
        setRoles([]);
        setError(res.data?.message || 'Failed to load roles');
      }
    } catch (e) {
      console.error('fetchRoles error:', e?.response?.data || e?.message || e);
      setRoles([]);
      setError('Failed to load roles. Check API base URL.');
    } finally {
      setLoadingRoles(false);
    }
  };

  const fetchZones = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/forest-info/zones`, {timeout: 20000});
      if (res.data?.statusCode === 200) setZones(res.data.data || []);
      else setZones([]);
    } catch (e) {
      console.error('fetchZones error:', e?.response?.data || e?.message || e);
      setZones([]);
    }
  };

  const fetchCircles = async zoneId => {
    try {
      const res = await axios.get(`${API_BASE_URL}/forest-info/circles?zone_id=${zoneId}`, {
        timeout: 20000,
      });
      if (res.data?.statusCode === 200) setCircles(res.data.data || []);
      else setCircles([]);
    } catch (e) {
      console.error('fetchCircles error:', e?.response?.data || e?.message || e);
      setCircles([]);
    }
  };

  const fetchDivisions = async circleId => {
    try {
      const res = await axios.get(`${API_BASE_URL}/forest-info/divisions?circle_id=${circleId}`, {
        timeout: 20000,
      });
      if (res.data?.statusCode === 200) setDivisions(res.data.data || []);
      else setDivisions([]);
    } catch (e) {
      console.error('fetchDivisions error:', e?.response?.data || e?.message || e);
      setDivisions([]);
    }
  };

  const fetchSubDivisions = async divisionId => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/forest-info/sub-divisions?division_id=${divisionId}`,
        {timeout: 20000},
      );
      if (res.data?.statusCode === 200) setSubDivisions(res.data.data || []);
      else setSubDivisions([]);
    } catch (e) {
      console.error('fetchSubDivisions error:', e?.response?.data || e?.message || e);
      setSubDivisions([]);
    }
  };

  const fetchBlocks = async subDivisionId => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/forest-info/blocks?sub_division_id=${subDivisionId}`,
        {timeout: 20000},
      );
      if (res.data?.statusCode === 200) setBlocks(res.data.data || []);
      else setBlocks([]);
    } catch (e) {
      console.error('fetchBlocks error:', e?.response?.data || e?.message || e);
      setBlocks([]);
    }
  };

  const fetchBeats = async blockId => {
    try {
      const res = await axios.get(`${API_BASE_URL}/forest-info/beats?block_id=${blockId}`, {
        timeout: 20000,
      });
      if (res.data?.statusCode === 200) setBeats(res.data.data || []);
      else setBeats([]);
    } catch (e) {
      console.error('fetchBeats error:', e?.response?.data || e?.message || e);
      setBeats([]);
    }
  };

  // ---------------------------
  // Clear dependent fields
  // ---------------------------
  const clearDependentData = level => {
    lastDesignationKeyRef.current = '';

    // close inline add boxes if hierarchy changes
    setAddMode({subDivision: false, block: false, beat: false});
    setNewName({subDivision: '', block: '', beat: ''});

    switch (level) {
      case 'role':
        setFormData(prev => ({
          ...prev,
          zoneId: '',
          circleId: '',
          divisionId: '',
          subDivisionId: '',
          blockId: '',
          beatId: '',
          designationEmail: '',
        }));
        setCircles([]);
        setDivisions([]);
        setSubDivisions([]);
        setBlocks([]);
        setBeats([]);
        break;

      case 'zone':
        setFormData(prev => ({
          ...prev,
          circleId: '',
          divisionId: '',
          subDivisionId: '',
          blockId: '',
          beatId: '',
          designationEmail: '',
        }));
        setCircles([]);
        setDivisions([]);
        setSubDivisions([]);
        setBlocks([]);
        setBeats([]);
        break;

      case 'circle':
        setFormData(prev => ({
          ...prev,
          divisionId: '',
          subDivisionId: '',
          blockId: '',
          beatId: '',
          designationEmail: '',
        }));
        setDivisions([]);
        setSubDivisions([]);
        setBlocks([]);
        setBeats([]);
        break;

      case 'division':
        setFormData(prev => ({
          ...prev,
          subDivisionId: '',
          blockId: '',
          beatId: '',
          designationEmail: '',
        }));
        setSubDivisions([]);
        setBlocks([]);
        setBeats([]);
        break;

      case 'subDivision':
        setFormData(prev => ({
          ...prev,
          blockId: '',
          beatId: '',
          designationEmail: '',
        }));
        setBlocks([]);
        setBeats([]);
        break;

      case 'block':
        setFormData(prev => ({
          ...prev,
          beatId: '',
          designationEmail: '',
        }));
        setBeats([]);
        break;

      default:
        break;
    }
  };

  // ---------------------------
  // Validation + Submit
  // ---------------------------
  const validateForm = () => {
    const {email, password, confirmPassword, firstName, lastName, phone, cnic, roleSlug, zoneId, circleId} =
      formData;

    if (!email || !password || !confirmPassword || !firstName || !lastName || !phone || !cnic) {
      return 'Please fill all required fields';
    }
    if (!roleSlug) return 'Please select a role';
    if (!zoneId || !circleId) return 'Please select Zone and Circle';

    if (shouldShowDivision() && !formData.divisionId) return 'Please select Division';
    if (shouldShowSubDivision() && !formData.subDivisionId) return 'Please select Sub Division';
    if (shouldShowBlock() && !formData.blockId) return 'Please select Block';
    if (shouldShowBeat() && !formData.beatId) return 'Please select Beat';

    if (!email.includes('@')) return 'Please enter a valid email address';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password !== confirmPassword) return 'Passwords do not match';

    if (!formData.designationEmail) return 'Designation email is generating. Please wait...';

    return null;
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    const v = validateForm();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        cnic: formData.cnic,
        roleSlug: formData.roleSlug,

        zoneId: Number(formData.zoneId),
        circleId: Number(formData.circleId),

        designationEmail: formData.designationEmail,
        dateOfPosting: formData.dateOfPosting,
        placeOfPosting: formData.placeOfPosting || 'Not specified',
      };

      if (formData.divisionId) payload.divisionId = Number(formData.divisionId);
      if (formData.subDivisionId) payload.subDivisionId = Number(formData.subDivisionId);
      if (formData.blockId) payload.blockId = Number(formData.blockId);
      if (formData.beatId) payload.beatId = Number(formData.beatId);

      const res = await axios.post(`${API_BASE_URL}/auth/register-enhanced`, payload, {
        headers: {'Content-Type': 'application/json'},
        timeout: 25000,
      });

      if (res.data?.statusCode === 201) {
        setSuccess(res.data?.data?.message || 'Registration successful');
        Alert.alert('Success', res.data?.data?.message || 'Registration successful', [
          {text: 'OK', onPress: () => navigation.navigate('Login')},
        ]);
      } else {
        setError(res.data?.message || 'Registration failed');
      }
    } catch (e) {
      console.error('register-enhanced error:', e?.response?.data || e?.message || e);
      setError(e?.response?.data?.message || e?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------
  // Dropdown renderer
  // ---------------------------
  const renderDropdown = ({
    items,
    selectedValue,
    placeholder,
    showState,
    setShowState,
    onSelect,
    getValue = x => x.id,
    getLabel = x => x.name,
  }) => {
    const selectedLabel = selectedValue
      ? getLabel(items.find(it => String(getValue(it)) === String(selectedValue)) || {})
      : '';

    return (
      <View style={{flex: 1}}>
        <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowState(true)}>
          <Text style={[styles.dropdownText, !selectedValue && styles.placeholder]} numberOfLines={1}>
            {selectedValue ? selectedLabel || placeholder : placeholder}
          </Text>
          <Ionicons name="chevron-down" size={20} color="rgba(17,24,39,0.65)" />
        </TouchableOpacity>

        <Modal
          visible={showState}
          transparent
          animationType="fade"
          onRequestClose={() => setShowState(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowState(false)}>
            <View style={styles.dropdownList}>
              <FlatList
                data={items}
                keyExtractor={item => String(getValue(item))}
                keyboardShouldPersistTaps="handled"
                renderItem={({item}) => {
                  const val = getValue(item);
                  const isSelected = String(selectedValue) === String(val);
                  return (
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        onSelect(val);
                        setShowState(false);
                      }}>
                      <Text style={styles.dropdownItemText}>{getLabel(item)}</Text>
                      {isSelected && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  const showDesignationHint = hasAllFieldsForRole() && !formData.designationEmail && !loadingDesignation;

  return (
    <KeyboardAvoidingView
      style={{flex: 1}}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <ImageBackground
        source={require('../assets/images/login-BG.png')}
        style={styles.bg}
        resizeMode="cover">
        <View style={styles.bgOverlay} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
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
                <View style={styles.headerRow}>
                  <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                  </TouchableOpacity>
                  <Text style={styles.title}>Create Account</Text>
                  <View style={{width: 24}} />
                </View>

                <Text style={styles.subtitle}>Register for field operations access</Text>

                {!!error && (
                  <View style={styles.errBox}>
                    <Ionicons name="alert-circle" size={16} color="#b91c1c" />
                    <Text style={styles.errTxt}>{error}</Text>
                  </View>
                )}

                {!!success && (
                  <View style={styles.successBox}>
                    <Ionicons name="checkmark-circle" size={16} color="#059669" />
                    <Text style={styles.successTxt}>{success}</Text>
                  </View>
                )}

                {/* Personal Information */}
                <Text style={styles.sectionTitle}>Personal Information</Text>

                <View style={styles.row}>
                  <View style={[styles.inputRow, styles.halfInput]}>
                    <Ionicons
                      name="person"
                      size={20}
                      color="rgba(17,24,39,0.65)"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="First Name"
                      placeholderTextColor="rgba(17,24,39,0.45)"
                      value={formData.firstName}
                      onChangeText={text => setFormData(prev => ({...prev, firstName: text}))}
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={[styles.inputRow, styles.halfInput]}>
                    <TextInput
                      style={styles.input}
                      placeholder="Last Name"
                      placeholderTextColor="rgba(17,24,39,0.45)"
                      value={formData.lastName}
                      onChangeText={text => setFormData(prev => ({...prev, lastName: text}))}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={styles.inputRow}>
                  <Ionicons name="mail" size={20} color="rgba(17,24,39,0.65)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Personal Email"
                    placeholderTextColor="rgba(17,24,39,0.45)"
                    value={formData.email}
                    onChangeText={text => setFormData(prev => ({...prev, email: text}))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputRow}>
                  <Ionicons name="call" size={20} color="rgba(17,24,39,0.65)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Phone Number"
                    placeholderTextColor="rgba(17,24,39,0.45)"
                    value={formData.phone}
                    onChangeText={text => setFormData(prev => ({...prev, phone: text}))}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputRow}>
                  <Ionicons name="card" size={20} color="rgba(17,24,39,0.65)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="CNIC (XXXXX-XXXXXXX-X)"
                    placeholderTextColor="rgba(17,24,39,0.45)"
                    value={formData.cnic}
                    onChangeText={text => setFormData(prev => ({...prev, cnic: text}))}
                    keyboardType="numeric"
                  />
                </View>

                {/* Passwords */}
                <Text style={styles.sectionTitle}>Account Security</Text>

                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed" size={20} color="rgba(17,24,39,0.65)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password (min. 6 characters)"
                    placeholderTextColor="rgba(17,24,39,0.45)"
                    value={formData.password}
                    onChangeText={text => setFormData(prev => ({...prev, password: text}))}
                    secureTextEntry={securePassword}
                  />
                  <TouchableOpacity style={styles.trailing} onPress={() => setSecurePassword(prev => !prev)}>
                    <Ionicons name={securePassword ? 'eye-off' : 'eye'} size={20} color="rgba(17,24,39,0.65)" />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed" size={20} color="rgba(17,24,39,0.65)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="rgba(17,24,39,0.45)"
                    value={formData.confirmPassword}
                    onChangeText={text => setFormData(prev => ({...prev, confirmPassword: text}))}
                    secureTextEntry={secureConfirm}
                  />
                  <TouchableOpacity style={styles.trailing} onPress={() => setSecureConfirm(prev => !prev)}>
                    <Ionicons name={secureConfirm ? 'eye-off' : 'eye'} size={20} color="rgba(17,24,39,0.65)" />
                  </TouchableOpacity>
                </View>

                {/* Role & Posting */}
                <Text style={styles.sectionTitle}>Department Role & Posting</Text>

                <View style={styles.inputRow}>
                  <Ionicons name="briefcase" size={20} color="rgba(17,24,39,0.65)" style={styles.inputIcon} />
                  {loadingRoles ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    renderDropdown({
                      items: roles,
                      selectedValue: formData.roleSlug,
                      placeholder: 'Select Role',
                      showState: showRoles,
                      setShowState: setShowRoles,
                      onSelect: slug => {
                        setFormData(prev => ({
                          ...prev,
                          roleSlug: slug,
                          zoneId: '',
                          circleId: '',
                          divisionId: '',
                          subDivisionId: '',
                          blockId: '',
                          beatId: '',
                          designationEmail: '',
                        }));
                        clearDependentData('role');
                      },
                      getValue: r => r.code,
                      getLabel: r => r.name,
                    })
                  )}
                </View>

                {!!formData.roleSlug && (
                  <View style={styles.inputRow}>
                    <Ionicons name="business" size={20} color="rgba(17,24,39,0.65)" style={styles.inputIcon} />
                    {renderDropdown({
                      items: zones,
                      selectedValue: formData.zoneId,
                      placeholder: 'Select Zone',
                      showState: showZones,
                      setShowState: setShowZones,
                      onSelect: id => setFormData(prev => ({...prev, zoneId: id})),
                      getValue: z => z.id,
                      getLabel: z => z.name,
                    })}
                  </View>
                )}

                {formData.zoneId && (
                  <View style={styles.inputRow}>
                    <Ionicons name="location" size={20} color="rgba(17,24,39,0.65)" style={styles.inputIcon} />
                    {renderDropdown({
                      items: circles,
                      selectedValue: formData.circleId,
                      placeholder: 'Select Circle',
                      showState: showCircles,
                      setShowState: setShowCircles,
                      onSelect: id => setFormData(prev => ({...prev, circleId: id})),
                      getValue: c => c.id,
                      getLabel: c => c.name,
                    })}
                  </View>
                )}

                {shouldShowDivision() && formData.circleId && (
                  <View style={styles.inputRow}>
                    <Ionicons name="location" size={20} color="rgba(17,24,39,0.65)" style={styles.inputIcon} />
                    {renderDropdown({
                      items: divisions,
                      selectedValue: formData.divisionId,
                      placeholder: 'Select Division',
                      showState: showDivisions,
                      setShowState: setShowDivisions,
                      onSelect: id => setFormData(prev => ({...prev, divisionId: id})),
                      getValue: d => d.id,
                      getLabel: d => d.name,
                    })}
                  </View>
                )}

                {/* Sub Division + (+) */}
                {shouldShowSubDivision() && formData.divisionId && (
                  <>
                    <View style={styles.addHeaderRow}>
                      <View style={{flex: 1}}>
                        <View style={styles.inputRow}>
                          <Ionicons name="location" size={20} color="rgba(17,24,39,0.65)" style={styles.inputIcon} />
                          {renderDropdown({
                            items: subDivisions,
                            selectedValue: formData.subDivisionId,
                            placeholder: 'Select Sub Division',
                            showState: showSubDivisions,
                            setShowState: setShowSubDivisions,
                            onSelect: id => setFormData(prev => ({...prev, subDivisionId: id})),
                            getValue: sd => sd.id,
                            getLabel: sd => sd.name,
                          })}
                        </View>
                      </View>

                      <TouchableOpacity style={styles.plusBtn} onPress={() => openInlineAdd('subDivision')}>
                        <Ionicons name="add" size={22} color="#fff" />
                      </TouchableOpacity>
                    </View>

                    <InlineAddRow
                      visible={addMode.subDivision}
                      placeholder="Enter new Sub Division name"
                      value={newName.subDivision}
                      onChange={(t) => setNewName(p => ({...p, subDivision: t}))}
                      onCancel={() => closeInlineAdd('subDivision')}
                      onSave={() => handleInlineSave('subDivision')}
                      saving={savingInline.subDivision}
                    />
                  </>
                )}

                {/* Block + (+) */}
                {shouldShowBlock() && formData.subDivisionId && (
                  <>
                    <View style={styles.addHeaderRow}>
                      <View style={{flex: 1}}>
                        <View style={styles.inputRow}>
                          <Ionicons name="location" size={20} color="rgba(17,24,39,0.65)" style={styles.inputIcon} />
                          {renderDropdown({
                            items: blocks,
                            selectedValue: formData.blockId,
                            placeholder: 'Select Block',
                            showState: showBlocks,
                            setShowState: setShowBlocks,
                            onSelect: id => setFormData(prev => ({...prev, blockId: id})),
                            getValue: b => b.id,
                            getLabel: b => b.name,
                          })}
                        </View>
                      </View>

                      <TouchableOpacity style={styles.plusBtn} onPress={() => openInlineAdd('block')}>
                        <Ionicons name="add" size={22} color="#fff" />
                      </TouchableOpacity>
                    </View>

                    <InlineAddRow
                      visible={addMode.block}
                      placeholder="Enter new Block name"
                      value={newName.block}
                      onChange={(t) => setNewName(p => ({...p, block: t}))}
                      onCancel={() => closeInlineAdd('block')}
                      onSave={() => handleInlineSave('block')}
                      saving={savingInline.block}
                    />
                  </>
                )}

                {/* Beat + (+) */}
                {shouldShowBeat() && formData.blockId && (
                  <>
                    <View style={styles.addHeaderRow}>
                      <View style={{flex: 1}}>
                        <View style={styles.inputRow}>
                          <Ionicons name="location" size={20} color="rgba(17,24,39,0.65)" style={styles.inputIcon} />
                          {renderDropdown({
                            items: beats,
                            selectedValue: formData.beatId,
                            placeholder: 'Select Beat',
                            showState: showBeats,
                            setShowState: setShowBeats,
                            onSelect: id => setFormData(prev => ({...prev, beatId: id})),
                            getValue: bt => bt.id,
                            getLabel: bt => bt.name,
                          })}
                        </View>
                      </View>

                      <TouchableOpacity style={styles.plusBtn} onPress={() => openInlineAdd('beat')}>
                        <Ionicons name="add" size={22} color="#fff" />
                      </TouchableOpacity>
                    </View>

                    <InlineAddRow
                      visible={addMode.beat}
                      placeholder="Enter new Beat name"
                      value={newName.beat}
                      onChange={(t) => setNewName(p => ({...p, beat: t}))}
                      onCancel={() => closeInlineAdd('beat')}
                      onSave={() => handleInlineSave('beat')}
                      saving={savingInline.beat}
                    />
                  </>
                )}

                {/* Designation Email + Copy */}
                {loadingDesignation ? (
                  <View style={styles.inputRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingText}>Generating designation email...</Text>
                  </View>
                ) : formData.designationEmail ? (
                  <View style={styles.designationBox}>
                    <Ionicons name="mail" size={16} color="#059669" />
                    <Text style={styles.designationText} numberOfLines={1}>
                      Designation Email: {formData.designationEmail}
                    </Text>

                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={() => {
                        Clipboard.setString(formData.designationEmail);
                        Alert.alert('Copied', 'Designation email copied to clipboard.');
                      }}>
                      <Ionicons name="copy-outline" size={18} color="#059669" />
                      <Text style={styles.copyBtnText}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                ) : showDesignationHint ? (
                  <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={16} color={colors.primary} />
                    <Text style={styles.infoText}>Generating designation email...</Text>
                  </View>
                ) : null}

                {/* Posting Details */}
                <View style={styles.inputRow}>
                  <Ionicons name="calendar" size={20} color="rgba(17,24,39,0.65)" style={styles.inputIcon} />
                  <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                    <Text style={styles.dateText}>Date of Posting: {formData.dateOfPosting}</Text>
                  </TouchableOpacity>
                </View>

                {showDatePicker && (
                  <DateTimePicker
                    value={new Date(formData.dateOfPosting)}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowDatePicker(false);
                      if (date) {
                        setFormData(prev => ({...prev, dateOfPosting: date.toISOString().split('T')[0]}));
                      }
                    }}
                  />
                )}

                <View style={styles.inputRow}>
                  <Ionicons name="pin" size={20} color="rgba(17,24,39,0.65)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Place of Posting"
                    placeholderTextColor="rgba(17,24,39,0.45)"
                    value={formData.placeOfPosting}
                    onChangeText={text => setFormData(prev => ({...prev, placeOfPosting: text}))}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.signInBtn, (loading || !formData.designationEmail) && styles.disabledBtn]}
                  onPress={handleSubmit}
                  disabled={loading || !formData.designationEmail}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.signInTxt}>Create Account</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" style={{marginLeft: 8}} />
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.loginText}>
                    Already have an account? <Text style={styles.loginLinkText}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg: {flex: 1},
  bgOverlay: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.40)'},
  scrollView: {flex: 1},
  scrollContent: {paddingVertical: 20},
  centerWrap: {flex: 1, justifyContent: 'center', paddingHorizontal: 16},

  brandBlock: {alignItems: 'center', justifyContent: 'center', marginBottom: 14, paddingHorizontal: 4},
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

  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4},
  title: {fontSize: 22, fontWeight: '900', color: '#111827', textAlign: 'center', flex: 1},
  subtitle: {
    marginTop: 4,
    color: 'rgba(17,24,39,0.70)',
    marginBottom: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
    paddingLeft: 4,
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
  errTxt: {color: '#b91c1c', marginLeft: 6, fontWeight: '700', flex: 1, fontSize: 14},

  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(209,250,229,0.85)',
    borderColor: 'rgba(110,231,183,0.75)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 10,
  },
  successTxt: {color: '#059669', marginLeft: 6, fontWeight: '700', flex: 1, fontSize: 14},

  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(219,234,254,0.85)',
    borderColor: 'rgba(147,197,253,0.75)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 10,
  },
  infoText: {color: colors.primary, marginLeft: 6, fontWeight: '700', flex: 1, fontSize: 14},

  row: {flexDirection: 'row', justifyContent: 'space-between', gap: 8},

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
  halfInput: {flex: 1},
  inputIcon: {marginRight: 8},
  input: {flex: 1, color: '#111827', paddingVertical: 10, fontWeight: '700', fontSize: 14},
  trailing: {paddingLeft: 8, paddingVertical: 6},

  dropdownTrigger: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  dropdownText: {color: '#111827', fontWeight: '700', fontSize: 14},
  placeholder: {color: 'rgba(17,24,39,0.45)'},

  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20},
  dropdownList: {
    backgroundColor: 'white',
    borderRadius: 14,
    maxHeight: 300,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  dropdownItemText: {fontSize: 16, color: '#111827', fontWeight: '600'},

  designationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(209,250,229,0.5)',
    borderColor: colors.primary,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 12,
  },
  designationText: {
    color: '#059669',
    marginLeft: 6,
    fontWeight: '700',
    flex: 1,
    fontSize: 14,
  },
  loadingText: {color: 'rgba(17,24,39,0.6)', marginLeft: 8, fontStyle: 'italic', fontSize: 14},

  // ✅ Copy button styles
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.35)',
    backgroundColor: 'rgba(209,250,229,0.45)',
  },
  copyBtnText: {
    color: '#059669',
    fontWeight: '900',
    fontSize: 12,
  },

  dateButton: {flex: 1, paddingVertical: 10},
  dateText: {color: '#111827', fontWeight: '700', fontSize: 14},

  signInBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 20,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  disabledBtn: {opacity: 0.7},
  signInTxt: {color: '#fff', fontWeight: '900', fontSize: 16},

  loginLink: {alignItems: 'center', marginTop: 16},
  loginText: {color: 'rgba(17,24,39,0.7)', fontWeight: '600', fontSize: 14},
  loginLinkText: {color: colors.primary, fontWeight: '900', fontSize: 14},

  // (+) Add button row
  addHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },

  // Inline add UI
  inlineAddWrap: {
    marginTop: -6,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.40)',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  inlineAddInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.12)',
    backgroundColor: 'rgba(255,255,255,0.70)',
    paddingHorizontal: 12,
    height: 46,
  },
  inlineAddInput: {
    flex: 1,
    color: '#111827',
    fontWeight: '700',
    fontSize: 14,
  },
  inlineAddBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  inlineBtn: {
    height: 40,
    minWidth: 92,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  inlineBtnCancel: {
    backgroundColor: 'rgba(17,24,39,0.08)',
  },
  inlineBtnSave: {
    backgroundColor: colors.primary,
  },
  inlineBtnTextCancel: {
    color: '#111827',
    fontWeight: '900',
  },
  inlineBtnTextSave: {
    color: '#fff',
    fontWeight: '900',
  },
});
