// Wave 1: XSS, Injection, and Malicious Input Attacks
import crypto from 'crypto';
import fs from 'fs';

const BASE = 'http://localhost:4000'\;
const TS = Date.now();
const OUT = '/tmp/puso-break-wave1.json';
const results = [];
let tid = 0;

function log(test, expected, actual, status) {
  tid++;
  results.push({ id: tid, test, expected, actual, status });
  const icon = status === 'PASS' ? 'OK' : status === 'FAIL' ? 'BUG' : 'WARN';
  console.log(`[${icon}] #${tid} ${test} => ${actual}`);
}

async function api(path, opts = {}) {
  try {
    const r = await fetch(BASE + path, opts);
    let body;
    try { body = await r.json(); } catch { body = null; }
    return { status: r.status, ok: r.ok, body };
  } catch (e) {
    return { status: 0, ok: false, body: null, error: e.message };
  }
}

function hdr(t) {
  const h = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = 'Bearer ' + t;
  return h;
}

// Health check
const hc = await api('/api/posts');
if (!hc.ok) { console.log('SERVER DOWN - aborting'); process.exit(1); }

// Register test user
const reg = await api('/api/users', {
  method: 'POST',
  headers: hdr(),
  body: JSON.stringify({ displayName: 'BreakIt_' + TS, deviceId: crypto.randomUUID() })
});
const UID = reg.body?.userId;
const TOKEN = reg.body?.token;
console.log('Test user:', UID ? 'OK' : 'FAIL');

// ── XSS PAYLOADS ──
const xssPayloads = [
  '<script>alert(document.cookie)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '"><script>alert(1)</script>',
  "javascript:alert('XSS')",
  '<iframe src="javascript:alert(1)">',
  '<body onload=alert(1)>',
  '{{constructor.constructor("return this")()}}',
  '${7*7}',
  '<a href="javascript:alert(1)">click</a>',
];

console.log('\n== XSS in Post Content ==');
for (const payload of xssPayloads) {
  const r = await api('/api/posts', {
    method: 'POST',
    headers: hdr(TOKEN),
    body: JSON.stringify({ content: 'XSS test: ' + payload, userId: UID })
  });
  const stored = r.body?.post?.content || '';
  const rawStored = stored.includes('<script>') || stored.includes('onerror=') || stored.includes('onload=');
  log(
    'XSS post: ' + payload.substring(0, 30),
    'sanitized or rejected',
    r.status + (rawStored ? ' RAW_STORED' : ' clean'),
    (r.status >= 400 || !rawStored) ? 'PASS' : 'FAIL'
  );
  if (r.body?.post?.id) await api('/api/posts/' + r.body.post.id, { method: 'DELETE', headers: hdr(TOKEN), body: JSON.stringify({ userId: UID }) });
}

// ── SQL INJECTION ──
const sqliPayloads = [
  "'; DROP TABLE users; --",
  "' OR '1'='1",
  "' UNION SELECT * FROM users --",
  "1; DELETE FROM posts WHERE 1=1",
  "admin'--",
  "' OR 1=1 --",
  "'; INSERT INTO users (id) VALUES ('hacked'); --",
  "1' AND (SELECT COUNT(*) FROM users) > 0 --",
];

console.log('\n== SQLi in Post Content ==');
for (const payload of sqliPayloads) {
  const r = await api('/api/posts', {
    method: 'POST',
    headers: hdr(TOKEN),
    body: JSON.stringify({ content: 'SQLi test: ' + payload, userId: UID })
  });
  log(
    'SQLi post: ' + payload.substring(0, 30),
    'no crash',
    r.status + '',
    r.status !== 0 && r.status !== 500 ? 'PASS' : 'FAIL'
  );
  if (r.body?.post?.id) await api('/api/posts/' + r.body.post.id, { method: 'DELETE', headers: hdr(TOKEN), body: JSON.stringify({ userId: UID }) });
}

// ── NoSQL / JSON Injection ──
console.log('\n== JSON Injection ==');
const jsonPayloads = [
  '{"$gt":""}',
  '{"$ne":null}',
  '{"$where":"sleep(5000)"}',
  '{"__proto__":{"isAdmin":true}}',
  '{"constructor":{"prototype":{"isAdmin":true}}}',
];
for (const payload of jsonPayloads) {
  const r = await api('/api/posts', {
    method: 'POST',
    headers: hdr(TOKEN),
    body: JSON.stringify({ content: payload, userId: UID })
  });
  log(
    'JSON inject: ' + payload.substring(0, 30),
    'no crash',
    r.status + '',
    r.status !== 0 && r.status !== 500 ? 'PASS' : 'FAIL'
  );
  if (r.body?.post?.id) await api('/api/posts/' + r.body.post.id, { method: 'DELETE', headers: hdr(TOKEN), body: JSON.stringify({ userId: UID }) });
}

// ── XSS in Username ──
console.log('\n== XSS in Username ==');
for (const payload of xssPayloads.slice(0, 5)) {
  const r = await api('/api/users', {
    method: 'POST',
    headers: hdr(),
    body: JSON.stringify({ displayName: payload, deviceId: crypto.randomUUID() })
  });
  log(
    'XSS username: ' + payload.substring(0, 25),
    'rejected 4xx',
    r.status + '',
    r.status >= 400 && r.status < 500 ? 'PASS' : 'FAIL'
  );
}

// ── XSS in Comment ──
console.log('\n== XSS in Comments ==');
const tempPost = await api('/api/posts', {
  method: 'POST',
  headers: hdr(TOKEN),
  body: JSON.stringify({ content: 'Temp post for XSS comment test ' + TS, userId: UID })
});
const TPID = tempPost.body?.post?.id;
for (const payload of xssPayloads.slice(0, 5)) {
  const r = await api('/api/posts/' + TPID + '/comments', {
    method: 'POST',
    headers: hdr(TOKEN),
    body: JSON.stringify({ content: 'XSS comment: ' + payload, userId: UID })
  });
  const stored = r.body?.comment?.content || '';
  const rawStored = stored.includes('<script>') || stored.includes('onerror=');
  log(
    'XSS comment: ' + payload.substring(0, 25),
    'sanitized or rejected',
    r.status + (rawStored ? ' RAW_STORED' : ' clean'),
    (r.status >= 400 || !rawStored) ? 'PASS' : 'FAIL'
  );
}
await api('/api/posts/' + TPID, { method: 'DELETE', headers: hdr(TOKEN), body: JSON.stringify({ userId: UID }) });

// ── Path Traversal ──
console.log('\n== Path Traversal ==');
const traversals = [
  '/api/posts/../../etc/passwd',
  '/api/users/../../../etc/shadow',
  '/api/posts/..%2F..%2Fetc%2Fpasswd',
  '/api/%2e%2e/%2e%2e/etc/passwd',
];
for (const path of traversals) {
  const r = await api(path);
  log(
    'Traversal: ' + path.substring(0, 35),
    '4xx',
    r.status + '',
    r.status >= 400 || r.status === 0 ? 'PASS' : 'FAIL'
  );
}

// ── CRLF Injection ──
console.log('\n== CRLF Injection ==');
const r1 = await api('/api/posts', {
  method: 'POST',
  headers: hdr(TOKEN),
  body: JSON.stringify({ content: 'Test\r\nX-Injected: true\r\n\r\nEvil body', userId: UID })
});
log('CRLF in content', 'no header inject', r1.status + '', r1.status !== 0 ? 'PASS' : 'FAIL');
if (r1.body?.post?.id) await api('/api/posts/' + r1.body.post.id, { method: 'DELETE', headers: hdr(TOKEN), body: JSON.stringify({ userId: UID }) });

// Final health
const finalH = await api('/api/posts');
log('Server alive after Wave 1', 'up', finalH.ok ? 'up' : 'DOWN', finalH.ok ? 'PASS' : 'FAIL');

// Summary
const p = results.filter(r => r.status === 'PASS').length;
const f = results.filter(r => r.status === 'FAIL').length;
const w = results.filter(r => r.status === 'WARN').length;
console.log(`\n${'='.repeat(50)}\nWAVE 1 SUMMARY: ${results.length} tests | ${p} pass | ${f} fail | ${w} warn\n${'='.repeat(50)}`);
if (f > 0) { console.log('\nFAILURES:'); results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  #${r.id} ${r.test}: expected=${r.expected} actual=${r.actual}`)); }
fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
