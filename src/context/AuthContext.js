// /context/AuthContext.js
import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

const API_BASE = 'http://be.lte.gisforestry.com';
const STORAGE_TOKEN = 'AUTH_TOKEN';
const STORAGE_USER = 'AUTH_USER';

/* ===================== HELPERS ===================== */
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function pickName(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') return v.name || v.title || v.label || v.value || '';
  return '';
}

function pickId(v) {
  if (!v) return null;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object') return v.id ? String(v.id) : v._id ? String(v._id) : null;
  return null;
}

function pickFirst(obj, keys = []) {
  for (const k of keys) {
    const val = obj?.[k];
    if (val !== undefined && val !== null) return val;
  }
  return null;
}

/**
 * Normalize entity from different API shapes:
 * - nested object: user.zone = {id,name} or {_id,name}
 * - flat: user.zoneId + user.zoneName
 * - string: user.zone = "Lahore"
 */
function pickEntity(user, {objKeys = [], idKeys = [], nameKeys = []}) {
  const objVal = pickFirst(user, objKeys);
  const flatId = pickFirst(user, idKeys);
  const flatName = pickFirst(user, nameKeys);

  const id = pickId(objVal) || (flatId ? String(flatId) : null);
  const name = pickName(objVal) || (flatName ? String(flatName) : '');

  return {id, name};
}

function normalizeRole(roleRaw) {
  if (!roleRaw) return '';
  if (Array.isArray(roleRaw)) return String(roleRaw[0] || '');
  return String(roleRaw);
}

/**
 * Ensures app always receives stable structure:
 * user.zone/circle/division/subDivision/block/beat as {id,name}
 * plus keeps original fields as well.
 */
function normalizeUserProfile(rawUser) {
  if (!rawUser || typeof rawUser !== 'object') return rawUser;

  const zone = pickEntity(rawUser, {
    objKeys: ['zone'],
    idKeys: ['zoneId', 'zone_id'],
    nameKeys: ['zoneName', 'zone_name'],
  });

  const circle = pickEntity(rawUser, {
    objKeys: ['circle'],
    idKeys: ['circleId', 'circle_id'],
    nameKeys: ['circleName', 'circle_name'],
  });

  const division = pickEntity(rawUser, {
    objKeys: ['division'],
    idKeys: ['divisionId', 'division_id'],
    nameKeys: ['divisionName', 'division_name'],
  });

  const subDivision = pickEntity(rawUser, {
    objKeys: ['subDivision', 'sub_division', 'range'],
    idKeys: ['subDivisionId', 'sub_division_id', 'rangeId', 'range_id'],
    nameKeys: ['subDivisionName', 'sub_division_name', 'rangeName', 'range_name'],
  });

  const block = pickEntity(rawUser, {
    objKeys: ['block'],
    idKeys: ['blockId', 'block_id'],
    nameKeys: ['blockName', 'block_name'],
  });

  const beat = pickEntity(rawUser, {
    objKeys: ['beat'],
    idKeys: ['beatId', 'beat_id'],
    nameKeys: ['beatName', 'beat_name'],
  });

  return {
    ...rawUser,

    // normalized role
    role: normalizeRole(rawUser.role),

    // normalized entities (always object shape for UI)
    zone: zone.id || zone.name ? zone : rawUser.zone,
    circle: circle.id || circle.name ? circle : rawUser.circle,
    division: division.id || division.name ? division : rawUser.division,
    subDivision: subDivision.id || subDivision.name ? subDivision : rawUser.subDivision,
    block: block.id || block.name ? block : rawUser.block,
    beat: beat.id || beat.name ? beat : rawUser.beat,

    // also expose flat keys for convenience (optional)
    zoneId: zone.id || rawUser.zoneId || rawUser.zone_id || null,
    zoneName: zone.name || rawUser.zoneName || rawUser.zone_name || '',

    circleId: circle.id || rawUser.circleId || rawUser.circle_id || null,
    circleName: circle.name || rawUser.circleName || rawUser.circle_name || '',

    divisionId: division.id || rawUser.divisionId || rawUser.division_id || null,
    divisionName: division.name || rawUser.divisionName || rawUser.division_name || '',

    subDivisionId:
      subDivision.id ||
      rawUser.subDivisionId ||
      rawUser.sub_division_id ||
      rawUser.rangeId ||
      rawUser.range_id ||
      null,
    subDivisionName:
      subDivision.name ||
      rawUser.subDivisionName ||
      rawUser.sub_division_name ||
      rawUser.rangeName ||
      rawUser.range_name ||
      '',

    blockId: block.id || rawUser.blockId || rawUser.block_id || null,
    blockName: block.name || rawUser.blockName || rawUser.block_name || '',

    beatId: beat.id || rawUser.beatId || rawUser.beat_id || null,
    beatName: beat.name || rawUser.beatName || rawUser.beat_name || '',
  };
}

/* ===================== API ===================== */
async function postLogin(email, password) {
  const res = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password}),
  });

  const json = await safeJson(res);

  if (!res.ok) {
    throw new Error(json?.message || `Login failed (HTTP ${res.status})`);
  }

  if (json?.statusCode !== 200 || !json?.data?.token) {
    throw new Error(json?.message || 'Token not received from server');
  }

  // data: { token, user, expiresIn }
  return json.data;
}

async function getMe(token) {
  const res = await fetch(`${API_BASE}/auth`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await safeJson(res);

  if (!res.ok) {
    throw new Error(json?.message || `Profile fetch failed (HTTP ${res.status})`);
  }

  if (json?.statusCode !== 200 || !json?.data) {
    throw new Error(json?.message || 'Invalid profile response');
  }

  return json.data;
}

/* ===================== CONTEXT ===================== */
export function AuthProvider({children}) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  // Restore session
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const savedToken = await AsyncStorage.getItem(STORAGE_TOKEN);
        const savedUser = await AsyncStorage.getItem(STORAGE_USER);

        if (!mounted) return;

        if (savedToken) setToken(savedToken);

        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          setUser(normalizeUserProfile(parsed));
        }
      } catch (e) {
        await AsyncStorage.multiRemove([STORAGE_TOKEN, STORAGE_USER]);
        if (mounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (mounted) setBooting(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * login flow:
   * 1) POST /auth -> token
   * 2) GET  /auth (Bearer token) -> profile
   * 3) Save token + normalized profile (remember flag)
   */
  const login = async ({email, password, remember = true}) => {
    // Step 1: POST auth
    const loginData = await postLogin(email, password);
    const t = loginData.token;

    // Fallback if POST also returns user
    const userFromPost = loginData.user ? normalizeUserProfile(loginData.user) : null;

    // Step 2: GET auth/me (same endpoint)
    let profile = null;
    try {
      profile = normalizeUserProfile(await getMe(t));
    } catch (e) {
      if (userFromPost) profile = userFromPost;
      else throw e;
    }

    // Save in state
    setToken(t);
    setUser(profile);

    // Save in storage based on remember flag
    if (remember) {
      await AsyncStorage.setItem(STORAGE_TOKEN, t);
      await AsyncStorage.setItem(STORAGE_USER, JSON.stringify(profile));
    } else {
      await AsyncStorage.multiRemove([STORAGE_TOKEN, STORAGE_USER]);
    }

    return {token: t, user: profile};
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([STORAGE_TOKEN, STORAGE_USER]);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      isLoggedIn: !!token,
      booting,
      login,
      logout,
    }),
    [token, user, booting],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
