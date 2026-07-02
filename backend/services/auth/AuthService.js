// services/auth/AuthService.js
// ---------------------------------------------------------------------------
// Real authentication for destructive actions (deletes + rule toggle).
//
//  1. AUTHENTICATION — LDAP simple bind as DOMAIN\username with the user's own
//     AD password (StartTLS before bind, mirroring the team's Python ldap3
//     usage: AUTO_BIND_TLS_BEFORE_BIND). A successful bind proves the caller
//     really is that user — no more trusting a client-supplied header.
//  2. AUTHORIZATION — ADAPI isGroupContainsUser against ADAPI_ADMIN_GROUP
//     (cached; members 10 min, non-members 1 min so ADAPI isn't spammed).
//  3. SESSION — login issues a compact HMAC-signed token (default 8h). Gated
//     routes verify the token signature + expiry, then re-check the cached
//     group membership. The password is used only at login, never stored.
//
// Fail-closed: LDAP or ADAPI being unreachable denies the action and logs at
// error level (that outage is itself an incident). If LDAP_URL is unset the
// whole gate is disabled with a startup warning (dev convenience, same
// pattern as INCIDENT_SETTINGS_KEY / ADAPI_URL before it).
// ---------------------------------------------------------------------------
const crypto = require('crypto');
const axios = require('axios');
const { Client, InvalidCredentialsError } = require('ldapts');
const { createLocalCache } = require('../../utils/cache');
const { logger } = require('../../utils/logger');

const log = logger.tagged('auth');

// ---- Configuration ----
const LDAP_URL = process.env.LDAP_URL || '';                       // e.g. ldap://dc01.domain.dom:389
const LDAP_DOMAIN = process.env.LDAP_DOMAIN || '';                 // NetBIOS domain for DOMAIN\user binds
const LDAP_STARTTLS = process.env.LDAP_STARTTLS !== 'false';       // upgrade to TLS before bind (ldap:// only)
const LDAP_TLS_REJECT_UNAUTHORIZED = process.env.LDAP_TLS_REJECT_UNAUTHORIZED === 'true';

const ADAPI_URL = (process.env.ADAPI_URL || '').replace(/\/+$/, '');
const ADAPI_CLIENT_ID = process.env.ADAPI_CLIENT_ID || '';
const ADAPI_ADMIN_GROUP = process.env.ADAPI_ADMIN_GROUP || 'teametequila';

const TOKEN_TTL_MS = (parseInt(process.env.AUTH_TOKEN_TTL_HOURS, 10) || 8) * 60 * 60 * 1000;
// Without a fixed secret, tokens die on restart and pods can't verify each
// other's tokens — fine for a single pod, set the env var for more.
const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

if (!LDAP_URL) {
  log.warn('LDAP_URL is not set — login/auth gate is DISABLED, destructive actions are open');
} else if (!process.env.AUTH_TOKEN_SECRET) {
  log.warn('AUTH_TOKEN_SECRET is not set — using a per-boot secret (tokens invalidate on restart, multi-pod verification will fail)');
}

// ---- Caches ----
const MEMBER_TTL_MS = 10 * 60 * 1000;
const NON_MEMBER_TTL_MS = 60 * 1000;
const membershipCache = createLocalCache('ad-group-membership', { ttlMs: MEMBER_TTL_MS, maxEntries: 500 });

// Failed-login throttle: 5 failures per username per minute. Protects the AD
// account from lockout by a misbehaving client as much as it protects us.
const THROTTLE_LIMIT = 5;
const throttleCache = createLocalCache('auth-login-throttle', { ttlMs: 60 * 1000, maxEntries: 500 });

// ---- Typed errors so the route can map to precise HTTP statuses ----
class BadCredentialsError extends Error { }
class NotGroupMemberError extends Error { }
class AuthUnavailableError extends Error { }
class ThrottledError extends Error { }

const isEnabled = () => Boolean(LDAP_URL);

// ---- ADAPI group membership (cached) ----
async function isUserMemberOfGroup(username) {
  const cacheKey = `${username}|${ADAPI_ADMIN_GROUP}`;
  const cached = membershipCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const response = await axios.get(`${ADAPI_URL}/group/isGroupContainsUser`, {
    params: {
      usersamaccountname: username,
      groupSamAccountName: ADAPI_ADMIN_GROUP
    },
    headers: { clientId: ADAPI_CLIENT_ID },
    timeout: 5000
  });
  const member = response.data === true || response.data === 'true';
  membershipCache.set(cacheKey, member, member ? MEMBER_TTL_MS : NON_MEMBER_TTL_MS);
  return member;
}

// ---- LDAP bind (the actual identity proof) ----
async function ldapBind(username, password) {
  const client = new Client({ url: LDAP_URL, connectTimeout: 5000, timeout: 5000 });
  try {
    if (LDAP_STARTTLS && LDAP_URL.startsWith('ldap://')) {
      await client.startTLS({ rejectUnauthorized: LDAP_TLS_REJECT_UNAUTHORIZED });
    }
    const bindDn = LDAP_DOMAIN ? `${LDAP_DOMAIN}\\${username}` : username;
    await client.bind(bindDn, password);
  } finally {
    await client.unbind().catch(() => { });
  }
}

// ---- Token sign/verify (HMAC-SHA256, no extra deps) ----
function signToken(username) {
  const payload = { u: username, exp: Date.now() + TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url');
  return { token: `${body}.${sig}`, expiresAt: payload.exp };
}

/** Returns { u, exp } or null for anything invalid/expired/tampered. */
function verifyToken(token) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest();
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload?.u || !payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Full login: throttle → LDAP bind → ADAPI group check → signed token.
 * Empty password is rejected explicitly: many LDAP servers treat it as an
 * anonymous bind that "succeeds", which would be a login bypass.
 */
async function login(rawUsername, password) {
  const username = String(rawUsername || '').trim().toLowerCase();
  if (!username || username.length > 100 || !password) {
    throw new BadCredentialsError('Username and password are required');
  }

  const failures = throttleCache.get(username) || 0;
  if (failures >= THROTTLE_LIMIT) {
    throw new ThrottledError('Too many failed attempts — wait a minute and try again');
  }

  try {
    await ldapBind(username, password);
  } catch (e) {
    if (e instanceof InvalidCredentialsError || e.code === 49) {
      throttleCache.set(username, failures + 1);
      throw new BadCredentialsError('Invalid username or password');
    }
    log.error('LDAP unreachable during login', e.message);
    throw new AuthUnavailableError('LDAP unreachable — this is an incident');
  }

  let member;
  try {
    member = await isUserMemberOfGroup(username);
  } catch (e) {
    log.error(`ADAPI unreachable while checking ${username} in ${ADAPI_ADMIN_GROUP}`, e.message);
    throw new AuthUnavailableError('ADAPI unreachable — this is an incident');
  }
  if (!member) {
    throw new NotGroupMemberError(`User "${username}" is not a member of the ${ADAPI_ADMIN_GROUP} group`);
  }

  throttleCache.delete(username);
  const { token, expiresAt } = signToken(username);
  log.info(`login ok: ${username}`);
  return { token, username, expires_at: expiresAt, group: ADAPI_ADMIN_GROUP };
}

module.exports = {
  isEnabled,
  login,
  verifyToken,
  isUserMemberOfGroup,
  ADAPI_ADMIN_GROUP,
  BadCredentialsError,
  NotGroupMemberError,
  AuthUnavailableError,
  ThrottledError
};
