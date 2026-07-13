(function () {
  'use strict';

  const SESSION_KEY = 'nations-cup-firebase-session-v1';

  function config() {
    return window.NATIONS_CUP_LIVE || {};
  }

  function isConfigured() {
    const settings = config();
    return Boolean(
      settings.enabled === true
      && settings.firebaseApiKey
      && !String(settings.firebaseApiKey).includes('PASTE_')
      && settings.databaseURL
      && !String(settings.databaseURL).includes('YOUR-PROJECT-ID')
      && settings.adminEmail
    );
  }

  function databaseURL() {
    return String(config().databaseURL || '').replace(/\/$/, '');
  }

  function dataPath() {
    return String(config().dataPath || 'tournament')
      .split('/')
      .filter(Boolean)
      .map(encodeURIComponent)
      .join('/');
  }

  function databaseEndpoint(authToken) {
    const base = `${databaseURL()}/${dataPath()}.json`;
    return authToken ? `${base}?auth=${encodeURIComponent(authToken)}` : base;
  }

  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    } catch (error) {
      return null;
    }
  }

  function writeSession(payload) {
    const session = {
      idToken: payload.idToken,
      refreshToken: payload.refreshToken,
      expiresAt: Date.now() + (Number(payload.expiresIn || 3600) * 1000) - 60000,
      email: payload.email || config().adminEmail
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function hasSession() {
    const session = readSession();
    return Boolean(session?.idToken || session?.refreshToken);
  }

  async function readJSON(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = body?.error?.message || body?.error || `HTTP_${response.status}`;
      const error = new Error(String(code));
      error.code = String(code);
      error.status = response.status;
      throw error;
    }
    return body;
  }

  async function signIn(password) {
    if (!isConfigured()) throw new Error('LIVE_CONNECTION_NOT_CONFIGURED');
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config().firebaseApiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: config().adminEmail,
        password,
        returnSecureToken: true
      })
    });
    return writeSession(await readJSON(response));
  }

  async function refreshSession(refreshToken) {
    const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config().firebaseApiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });
    const payload = await readJSON(response);
    return writeSession({
      idToken: payload.id_token,
      refreshToken: payload.refresh_token,
      expiresIn: payload.expires_in,
      email: config().adminEmail
    });
  }

  async function ensureToken() {
    if (!isConfigured()) throw new Error('LIVE_CONNECTION_NOT_CONFIGURED');
    const session = readSession();
    if (!session) throw new Error('AUTH_REQUIRED');
    if (session.idToken && Number(session.expiresAt) > Date.now()) return session.idToken;
    if (!session.refreshToken) throw new Error('AUTH_REQUIRED');
    return (await refreshSession(session.refreshToken)).idToken;
  }

  async function loadTournament() {
    if (!isConfigured()) return null;
    const response = await fetch(`${databaseEndpoint()}?v=${Date.now()}`, { cache: 'no-store' });
    return readJSON(response);
  }

  async function saveTournament(data) {
    const idToken = await ensureToken();
    const response = await fetch(databaseEndpoint(idToken), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return readJSON(response);
  }

  async function changePassword(currentPassword, nextPassword) {
    await signIn(currentPassword);
    const idToken = await ensureToken();
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${encodeURIComponent(config().firebaseApiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, password: nextPassword, returnSecureToken: true })
    });
    return writeSession(await readJSON(response));
  }

  function pathParts(path) {
    return String(path || '/')
      .split('/')
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
  }

  function setAtPath(root, path, value) {
    const parts = pathParts(path);
    if (!parts.length) return value;
    const nextRoot = root && typeof root === 'object' ? root : {};
    let target = nextRoot;
    parts.slice(0, -1).forEach((part) => {
      if (!target[part] || typeof target[part] !== 'object') target[part] = {};
      target = target[part];
    });
    const key = parts.at(-1);
    if (value === null) delete target[key];
    else target[key] = value;
    return nextRoot;
  }

  function patchAtPath(root, path, patch) {
    let nextRoot = root && typeof root === 'object' ? root : {};
    Object.entries(patch || {}).forEach(([key, value]) => {
      const combined = `${String(path || '/').replace(/\/$/, '')}/${key}`;
      nextRoot = setAtPath(nextRoot, combined, value);
    });
    return nextRoot;
  }

  function subscribeTournament(onData, onError) {
    if (!isConfigured() || !window.EventSource) return () => {};
    const stream = new EventSource(databaseEndpoint());
    let cache = null;

    const handle = (type) => (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        cache = type === 'patch'
          ? patchAtPath(cache, payload.path, payload.data)
          : setAtPath(cache, payload.path, payload.data);
        if (cache && typeof cache === 'object') onData(cache);
      } catch (error) {
        onError?.(error);
      }
    };

    stream.addEventListener('put', handle('put'));
    stream.addEventListener('patch', handle('patch'));
    stream.addEventListener('cancel', () => onError?.(new Error('LIVE_READ_CANCELLED')));
    stream.addEventListener('auth_revoked', () => onError?.(new Error('LIVE_READ_AUTH_REVOKED')));
    stream.onerror = () => onError?.(new Error('LIVE_STREAM_RECONNECTING'));

    return () => stream.close();
  }

  function friendlyError(error) {
    const code = String(error?.code || error?.message || error || 'UNKNOWN_ERROR');
    const messages = {
      LIVE_CONNECTION_NOT_CONFIGURED: 'The one-time Firebase connection has not been configured yet.',
      AUTH_REQUIRED: 'Your admin session expired. Lock the desk and sign in again.',
      INVALID_PASSWORD: 'The password is incorrect.',
      INVALID_LOGIN_CREDENTIALS: 'The password is incorrect.',
      EMAIL_NOT_FOUND: 'The Firebase admin account has not been created yet.',
      USER_DISABLED: 'The Firebase admin account is disabled.',
      OPERATION_NOT_ALLOWED: 'Email/password login is not enabled in Firebase.',
      PERMISSION_DENIED: 'Firebase blocked the update. Check the database rules.',
      NETWORK_REQUEST_FAILED: 'The live database could not be reached.'
    };
    return messages[code] || code.replaceAll('_', ' ').toLowerCase();
  }

  window.LiveData = {
    SESSION_KEY,
    isConfigured,
    hasSession,
    signIn,
    signOut: clearSession,
    ensureToken,
    loadTournament,
    saveTournament,
    changePassword,
    subscribeTournament,
    friendlyError
  };
}());
