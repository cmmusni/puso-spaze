const BASE = 'http://localhost:4000';
const TS = Date.now();
const results = [];
let testNum = 0;
function record(test, input, expected, actual, status) {
  testNum++;
  results.push({ num: testNum, test, input, expected, actual, status });
  const icon = status === 'PASS' ? '  PASS' : status === 'WARN' ? '  WARN' : '  FAIL';
  console.log(icon + ' #' + testNum + ' ' + test + ' -> ' + status + (status !== 'PASS' ? ' [' + actual + ']' : ''));
}
async function req(method, path, body, headers) {
  headers = headers || {};
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  let data = null;
  try { data = await res.json(); } catch { try { data = await res.text(); } catch {} }
  return { status: res.status, data };
}
let mainUser, mainToken, secondUser, secondToken, testPostId, testCommentId;
const uuid = () => crypto.randomUUID();

async function smokeTests() {
  console.log('\nSMOKE TESTS');
  const h = await req('GET', '/health');
  record('Health check', 'GET /health', '200', String(h.status), h.status === 200 ? 'PASS' : 'FAIL');
  try { const w = await fetch('http://localhost:8081'); record('Web app', 'GET :8081', '200', String(w.status), w.status === 200 ? 'PASS' : 'FAIL'); }
  catch (e) { record('Web app', 'GET :8081', '200', 'Error', 'FAIL'); }
}

async function registerUsers() {
  console.log('\nUSER REGISTRATION');
  let r = await req('POST', '/api/users', { displayName: 'QA_Main_' + TS, deviceId: uuid() });
  if (r.status === 201 && r.data && r.data.userId) { mainUser = r.data; mainToken = r.data.token; record('Register main', 'QA_Main', '201', String(r.status), 'PASS'); }
  else { record('Register main', 'QA_Main', '201', r.status + ' ' + JSON.stringify(r.data).substring(0, 60), 'FAIL'); return; }
  r = await req('POST', '/api/users', { displayName: 'QA_Second_' + TS, deviceId: uuid() });
  if (r.status === 201 && r.data) { secondUser = r.data; secondToken = r.data.token; record('Register second', 'QA_Second', '201', String(r.status), 'PASS'); }
  else record('Register second', 'QA_Second', '201', String(r.status), 'FAIL');
  // Duplicate username
  r = await req('POST', '/api/users', { displayName: 'QA_Main_' + TS, deviceId: uuid() });
  record('Duplicate username', 'QA_Main', '400/409', String(r.status), [400, 409].includes(r.status) ? 'PASS' : 'FAIL');
  // Check username - taken (via query param)
  r = await req('GET', '/api/users/check?username=' + encodeURIComponent('QA_Main_' + TS));
  record('Check taken name', 'QA_Main', 'available=false', JSON.stringify(r.data), r.data && r.data.available === false ? 'PASS' : 'FAIL');
  // Check username - free
  r = await req('GET', '/api/users/check?username=FreeUser_' + TS);
  record('Check free name', 'Free', 'available=true', JSON.stringify(r.data), r.data && r.data.available === true ? 'PASS' : 'FAIL');
  // Empty name
  r = await req('POST', '/api/users', { displayName: '', deviceId: uuid() });
  record('Empty name', 'empty', '422', String(r.status), r.status === 422 ? 'PASS' : 'FAIL');
  // 1-char name (min is 2)
  r = await req('POST', '/api/users', { displayName: 'A', deviceId: uuid() });
  record('1-char name', 'A', '422', String(r.status), r.status === 422 ? 'PASS' : 'FAIL');
  // 100-char name (max is 30)
  r = await req('POST', '/api/users', { displayName: 'A'.repeat(100), deviceId: uuid() });
  record('100-char name', '100ch', '422', String(r.status), r.status === 422 ? 'PASS' : 'FAIL');
  // Missing deviceId (optional field - should succeed)
  r = await req('POST', '/api/users', { displayName: 'NoDevice_' + TS });
  record('Missing deviceId', 'none', '201 (optional)', String(r.status), r.status === 201 ? 'PASS' : 'WARN');
  // Special chars in name
  r = await req('POST', '/api/users', { displayName: 'Test@#$%', deviceId: uuid() });
  record('Special chars name', '@#$%', '422', String(r.status), r.status === 422 ? 'PASS' : 'FAIL');
}

async function inputValidation() {
  console.log('\nINPUT VALIDATION');
  if (mainUser == null) return;
  const auth = { Authorization: 'Bearer ' + mainToken };
  let r;
  r = await req('POST', '/api/posts', { content: '', userId: mainUser.userId }, auth);
  record('Empty post', 'empty', '422', String(r.status), r.status === 422 ? 'PASS' : 'FAIL');
  r = await req('POST', '/api/posts', { content: 'AB', userId: mainUser.userId }, auth);
  record('2-char post', 'AB', '422', String(r.status), r.status === 422 ? 'PASS' : 'FAIL');
  r = await req('POST', '/api/posts', { content: '     ', userId: mainUser.userId }, auth);
  record('Whitespace post', 'spaces', '422', String(r.status), r.status === 422 ? 'PASS' : 'FAIL');
  r = await req('POST', '/api/posts', { content: 'B'.repeat(2000), userId: mainUser.userId }, auth);
  record('2000-char post', '2000ch', '422', String(r.status), r.status === 422 ? 'PASS' : 'FAIL');
  // XSS
  const xss = '<script>alert(1)</script>';
  r = await req('POST', '/api/posts', { content: xss, userId: mainUser.userId }, auth);
  if (r.status === 201) { const safe = JSON.stringify(r.data).indexOf('<script>') === -1; record('XSS in post', xss, 'sanitized', safe ? 'sanitized' : 'XSS present', safe ? 'PASS' : 'FAIL'); }
  else record('XSS in post', xss, 'rejected/sanitized', String(r.status), [400, 422].includes(r.status) ? 'PASS' : 'WARN');
  // SQL injection in username
  r = await req('POST', '/api/users', { displayName: 'DROP TABLE users', deviceId: uuid() });
  record('SQL injection', 'DROP TABLE', 'safe', String(r.status), [201, 409, 422].includes(r.status) ? 'PASS' : 'FAIL');
  // Unicode/Taglish
  r = await req('POST', '/api/posts', { content: 'Salamat po sa Diyos ang hirap ng buhay', userId: mainUser.userId }, auth);
  record('Taglish post', 'Salamat po...', '201', String(r.status), r.status === 201 ? 'PASS' : 'FAIL');
  // Valid post for comment tests
  r = await req('POST', '/api/posts', { content: 'Valid post for comment tests here', userId: mainUser.userId }, auth);
  if (r.status === 201) {
    const pid = r.data.post.id;
    let r2 = await req('POST', '/api/posts/' + pid + '/comments', { content: '', userId: mainUser.userId }, auth);
    record('Empty comment', 'empty', '422', String(r2.status), r2.status === 422 ? 'PASS' : 'FAIL');
    r2 = await req('POST', '/api/posts/' + pid + '/comments', { content: '   ', userId: mainUser.userId }, auth);
    record('Whitespace comment', 'spaces', '422', String(r2.status), r2.status === 422 ? 'PASS' : 'FAIL');
  }
  // Journal needs title field
  r = await req('POST', '/api/journals', { title: 'Test', content: 'J'.repeat(10000), userId: mainUser.userId, mood: 'happy' }, auth);
  record('10k journal', '10000ch', '201/422', String(r.status), [201, 409, 422].includes(r.status) ? 'PASS' : 'FAIL');
  r = await req('POST', '/api/journals', { title: 'Test', content: 'Test', userId: mainUser.userId, mood: 'INVALID' }, auth);
  record('Invalid mood', 'INVALID', '422', String(r.status), r.status === 422 ? 'PASS' : 'WARN');
}

async function authTesting() {
  console.log('\nAUTH TESTING');
  let r;
  r = await req('POST', '/api/posts', { content: 'No auth test here', userId: 'fake' });
  record('POST no auth', 'no token', '401', String(r.status), r.status === 401 ? 'PASS' : 'FAIL');
  r = await req('POST', '/api/posts', { content: 'Bad token test', userId: 'fake' }, { Authorization: 'Bearer invalidtoken' });
  record('POST bad token', 'invalid', '401', String(r.status), r.status === 401 ? 'PASS' : 'FAIL');
  r = await req('POST', '/api/posts', { content: 'Malformed auth test', userId: 'fake' }, { Authorization: 'NotBearer x' });
  record('Malformed auth', 'NotBearer', '401', String(r.status), r.status === 401 ? 'PASS' : 'FAIL');
  r = await req('POST', '/api/posts', { content: 'Empty bearer test', userId: 'fake' }, { Authorization: 'Bearer ' });
  record('Empty bearer', 'empty', '401', String(r.status), r.status === 401 ? 'PASS' : 'FAIL');
  r = await req('GET', '/api/posts');
  record('GET posts public', 'no token', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
  r = await req('DELETE', '/api/posts/nonexistent-id');
  record('DELETE no auth', 'no token', '401', String(r.status), r.status === 401 ? 'PASS' : 'FAIL');
  if (mainUser && mainToken) {
    const auth = { Authorization: 'Bearer ' + mainToken };
    r = await req('GET', '/api/users/' + mainUser.userId + '/pin', null, auth);
    record('Get PIN', 'userId', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
    if (r.data && r.data.pin) {
      const pin = r.data.pin;
      r = await req('POST', '/api/auth/pin-login', { pin, deviceId: uuid() });
      record('PIN login valid', pin, '200', String(r.status), r.status === 200 ? 'PASS' : 'WARN');
      r = await req('POST', '/api/auth/pin-login', { pin: '000000', deviceId: uuid() });
      record('PIN wrong', '000000', '401/404', String(r.status), [401, 404].includes(r.status) ? 'PASS' : 'WARN');
      r = await req('POST', '/api/auth/pin-login', { pin: '', deviceId: uuid() });
      record('PIN empty', 'empty', '400-422', String(r.status), [400, 401, 404, 422].includes(r.status) ? 'PASS' : 'WARN');
    }
  }
}

async function happyPath() {
  console.log('\nHAPPY PATH CRUD');
  if (mainUser == null) { console.log('  Skipping'); return; }
  const auth = { Authorization: 'Bearer ' + mainToken };
  const auth2 = secondToken ? { Authorization: 'Bearer ' + secondToken } : auth;
  let r;
  // Create post
  r = await req('POST', '/api/posts', { content: 'Happy path post test ' + TS, userId: mainUser.userId }, auth);
  if (r.status === 201 && r.data && r.data.post) { testPostId = r.data.post.id; record('Create post', 'valid', '201', String(r.status), 'PASS'); }
  else { record('Create post', 'valid', '201', String(r.status), 'FAIL'); return; }
  // Get post
  r = await req('GET', '/api/posts/' + testPostId);
  record('Get post', 'id', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
  // Update post
  r = await req('PATCH', '/api/posts/' + testPostId, { content: 'Updated post ' + TS, userId: mainUser.userId }, auth);
  record('Update post', 'new', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
  // Feed check
  r = await req('GET', '/api/posts');
  const feedPosts = r.data && r.data.posts ? r.data.posts : (Array.isArray(r.data) ? r.data : []);
  const found = feedPosts.some(function(p) { return p.id === testPostId; });
  record('Feed has post', 'id', 'found', found ? 'found' : 'not found', found ? 'PASS' : 'WARN');
  // Reactions
  for (const type of ['PRAY', 'CARE', 'SUPPORT', 'LIKE']) {
    const uid = type === 'PRAY' ? mainUser.userId : (secondUser ? secondUser.userId : mainUser.userId);
    const a = type === 'PRAY' ? auth : auth2;
    r = await req('POST', '/api/posts/' + testPostId + '/reactions', { type, userId: uid }, a);
    record('React ' + type, type, '200/201', String(r.status), [200, 201].includes(r.status) ? 'PASS' : 'FAIL');
  }
  r = await req('GET', '/api/posts/' + testPostId + '/reactions');
  record('Get reactions', 'GET', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
  r = await req('POST', '/api/posts/' + testPostId + '/reactions', { type: 'INVALID', userId: mainUser.userId }, auth);
  record('Invalid reaction', 'INVALID', '400/422', String(r.status), [400, 422].includes(r.status) ? 'PASS' : 'FAIL');
  // Comment
  r = await req('POST', '/api/posts/' + testPostId + '/comments', { content: 'QA Comment ' + TS, userId: mainUser.userId }, auth);
  if (r.status === 201 && r.data) { testCommentId = r.data.id; record('Create comment', 'valid', '201', String(r.status), 'PASS'); }
  else record('Create comment', 'valid', '201', String(r.status), 'FAIL');
  // @mention comment
  if (secondUser) {
    r = await req('POST', '/api/posts/' + testPostId + '/comments', { content: 'Hey @' + secondUser.displayName + ' praying for you', userId: mainUser.userId }, auth);
    record('Comment @mention', '@second', '201', String(r.status), r.status === 201 ? 'PASS' : 'FAIL');
  }
  r = await req('GET', '/api/posts/' + testPostId + '/comments');
  record('Get comments', 'GET', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
  // Update comment
  if (testCommentId) {
    r = await req('PATCH', '/api/posts/' + testPostId + '/comments/' + testCommentId, { content: 'Updated comment ' + TS }, auth);
    record('Update comment', 'new', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
    r = await req('POST', '/api/posts/' + testPostId + '/comments/' + testCommentId + '/reactions', { type: 'PRAY', userId: secondUser ? secondUser.userId : mainUser.userId }, auth2);
    record('React comment', 'PRAY', '200/201', String(r.status), [200, 201].includes(r.status) ? 'PASS' : 'FAIL');
  }
  // Journal (needs title)
  r = await req('POST', '/api/journals', { title: 'QA Journal', content: 'Journal entry ' + TS, userId: mainUser.userId, mood: 'grateful' }, auth);
  record('Create journal', 'grateful', '201', String(r.status), r.status === 201 ? 'PASS' : 'FAIL');
  const jid = r.data && r.data.journal && r.data.journal.id;
  r = await req('GET', '/api/journals?userId=' + mainUser.userId, null, auth);
  record('Get journals', 'userId', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
  if (jid) { r = await req('PATCH', '/api/journals/' + jid, { content: 'Updated journal ' + TS, mood: 'happy', userId: mainUser.userId }, auth); record('Update journal', 'happy', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL'); }
  // Notifications
  r = await req('GET', '/api/notifications?userId=' + mainUser.userId, null, auth);
  record('Get notifs', 'userId', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
  r = await req('PATCH', '/api/notifications/read-all', { userId: mainUser.userId }, auth);
  record('Mark all read', 'userId', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
  // Dashboard stats (at /api/stats/dashboard)
  r = await req('GET', '/api/stats/dashboard?userId=' + mainUser.userId, null, auth);
  record('Dashboard stats', 'userId', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
  r = await req('GET', '/api/stats/online');
  record('Online count', 'GET', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
  // Flag
  r = await req('POST', '/api/posts/' + testPostId + '/report', { userId: secondUser ? secondUser.userId : mainUser.userId, reason: 'test flag' }, auth2);
  record('Flag post', 'reason', '200/201', String(r.status), [200, 201].includes(r.status) ? 'PASS' : 'FAIL');
  // Toggle notifications
  r = await req('PATCH', '/api/users/' + mainUser.userId + '/notifications', { enabled: false }, auth);
  record('Notifs off', 'false', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
  r = await req('PATCH', '/api/users/' + mainUser.userId + '/notifications', { enabled: true }, auth);
  record('Notifs on', 'true', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
}

async function anonymousMode() {
  console.log('\nANONYMOUS MODE');
  if (mainUser == null) return;
  const auth = { Authorization: 'Bearer ' + mainToken };
  let r;
  r = await req('PATCH', '/api/users/' + mainUser.userId + '/anonymous', { isAnonymous: true }, auth);
  record('Anon ON', 'true', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
  r = await req('POST', '/api/posts', { content: 'Anonymous post test ' + TS, userId: mainUser.userId }, auth);
  if (r.status === 201) {
    const postData = r.data.post || r.data;
    const leak = JSON.stringify(postData).includes(mainUser.displayName);
    record('Anon post no leak', 'anon=true', 'no real name', leak ? 'LEAKS' : 'safe', leak ? 'FAIL' : 'PASS');
    const r2 = await req('GET', '/api/posts/' + postData.id);
    record('Anon in feed', 'GET', 'no name', JSON.stringify(r2.data).includes(mainUser.displayName) ? 'LEAKS' : 'safe', JSON.stringify(r2.data).includes(mainUser.displayName) ? 'FAIL' : 'PASS');
    if (secondUser) {
      const auth2 = { Authorization: 'Bearer ' + secondToken };
      await req('POST', '/api/posts/' + postData.id + '/comments', { content: 'Praying for you bro', userId: secondUser.userId }, auth2);
      const r3 = await req('GET', '/api/notifications?userId=' + mainUser.userId, null, auth);
      const anonNotifs = r3.data && r3.data.notifications ? r3.data.notifications : (Array.isArray(r3.data) ? r3.data : []);
      if (r3.status === 200 && anonNotifs.length > 0) {
        const leaks = JSON.stringify(anonNotifs[0]).includes(mainUser.displayName);
        record('Anon notif privacy', 'notif payload', 'no name', leaks ? 'LEAKS in notif' : 'safe', leaks ? 'WARN' : 'PASS');
      }
    }
  } else record('Anon post', 'anon=true', '201', String(r.status), 'FAIL');
  r = await req('PATCH', '/api/users/' + mainUser.userId + '/anonymous', { isAnonymous: false }, auth);
  record('Anon OFF', 'false', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
}

async function errorHandling() {
  console.log('\nERROR HANDLING');
  if (mainUser == null) return;
  const auth = { Authorization: 'Bearer ' + mainToken };
  let r;
  r = await req('GET', '/api/posts/00000000-0000-0000-0000-000000000000');
  record('Nonexistent post', 'fake UUID', '404', String(r.status), r.status === 404 ? 'PASS' : 'FAIL');
  r = await req('GET', '/api/posts/not-a-uuid');
  record('Invalid UUID', 'bad', '400-422', String(r.status), [400, 404, 422].includes(r.status) ? 'PASS' : 'FAIL');
  try { const res = await fetch(BASE + '/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + mainToken }, body: '{invalid' });
    record('Malformed JSON', '{invalid', '400', String(res.status), res.status === 400 ? 'PASS' : 'FAIL'); }
  catch (e) { record('Malformed JSON', '{invalid', '400', 'Error', 'FAIL'); }
  r = await req('DELETE', '/api/posts/00000000-0000-0000-0000-000000000000', { userId: mainUser.userId }, auth);
  record('Delete nonexistent', 'fake UUID', '404/422', String(r.status), [404, 422].includes(r.status) ? 'PASS' : 'FAIL');
  r = await req('POST', '/api/posts/00000000-0000-0000-0000-000000000000/comments', { content: 'test comment here', userId: mainUser.userId }, auth);
  record('Comment nonexistent', 'fake UUID', '404', String(r.status), r.status === 404 ? 'PASS' : 'FAIL');
  r = await req('POST', '/api/posts/00000000-0000-0000-0000-000000000000/reactions', { type: 'PRAY', userId: mainUser.userId }, auth);
  record('React nonexistent', 'fake UUID', '404', String(r.status), r.status === 404 ? 'PASS' : 'FAIL');
  // Delete/update other user's post
  if (testPostId && secondToken) {
    const auth2 = { Authorization: 'Bearer ' + secondToken };
    r = await req('DELETE', '/api/posts/' + testPostId, { userId: secondUser.userId }, auth2);
    record('Delete other post', 'id', '403', String(r.status), r.status === 403 ? 'PASS' : 'FAIL');
    r = await req('PATCH', '/api/posts/' + testPostId, { content: 'Hijacked content', userId: secondUser.userId }, auth2);
    record('Update other post', 'id', '403', String(r.status), r.status === 403 ? 'PASS' : 'FAIL');
  }
  // Recovery (at /api/recovery-requests)
  r = await req('POST', '/api/recovery-requests', { displayName: 'QA_Main_' + TS, reason: 'Lost my phone' });
  record('Recovery req', 'valid', '200/201', String(r.status), [200, 201].includes(r.status) ? 'PASS' : 'FAIL');
  r = await req('POST', '/api/recovery-requests', { displayName: 'QA_Main_' + TS, reason: '' });
  record('Recovery empty reason', 'empty', '400/422', String(r.status), [400, 422].includes(r.status) ? 'PASS' : 'FAIL');
  r = await req('GET', '/api/conversations/coaches');
  record('Get coaches', 'GET', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
  // Rename
  r = await req('PATCH', '/api/users/' + mainUser.userId + '/username', { displayName: 'QA_Renamed_' + TS }, auth);
  record('Rename user', 'new name', '200', String(r.status), r.status === 200 ? 'PASS' : 'FAIL');
  await req('PATCH', '/api/users/' + mainUser.userId + '/username', { displayName: 'QA_Main_' + TS }, auth);
}

async function duplicateConflict() {
  console.log('\nDUPLICATE/CONFLICT');
  if (mainUser == null) return;
  const auth = { Authorization: 'Bearer ' + mainToken };
  if (testPostId) {
    await req('POST', '/api/posts/' + testPostId + '/reactions', { type: 'PRAY', userId: mainUser.userId }, auth);
    const r = await req('POST', '/api/posts/' + testPostId + '/reactions', { type: 'PRAY', userId: mainUser.userId }, auth);
    record('Double react toggle', 'PRAY x2', 'toggle', String(r.status), [200, 201].includes(r.status) ? 'PASS' : 'FAIL');
  }
}

async function crossFeature() {
  console.log('\nCROSS-FEATURE');
  if (mainUser == null) return;
  const auth = { Authorization: 'Bearer ' + mainToken };
  const auth2 = secondToken ? { Authorization: 'Bearer ' + secondToken } : auth;
  let r;
  // Create -> Comment -> React -> Notifs -> Delete -> Verify gone
  r = await req('POST', '/api/posts', { content: 'Cross test post ' + TS, userId: mainUser.userId }, auth);
  if (r.status === 201) {
    const pid = r.data.post.id;
    r = await req('POST', '/api/posts/' + pid + '/comments', { content: 'God bless you', userId: secondUser ? secondUser.userId : mainUser.userId }, auth2);
    record('Cross: comment', 'pid', '201', String(r.status), r.status === 201 ? 'PASS' : 'FAIL');
    r = await req('POST', '/api/posts/' + pid + '/reactions', { type: 'PRAY', userId: secondUser ? secondUser.userId : mainUser.userId }, auth2);
    record('Cross: react', 'pid', '200/201', String(r.status), [200, 201].includes(r.status) ? 'PASS' : 'FAIL');
    r = await req('GET', '/api/notifications?userId=' + mainUser.userId, null, auth);
    const notifs = r.data && r.data.notifications ? r.data.notifications : (Array.isArray(r.data) ? r.data : []);
    record('Cross: notifs', 'userId', 'has notifs', notifs.length > 0 ? notifs.length + ' notifs' : 'none', notifs.length > 0 ? 'PASS' : 'WARN');
    r = await req('DELETE', '/api/posts/' + pid, { userId: mainUser.userId }, auth);
    record('Cross: delete', 'pid', '200/204', String(r.status), [200, 204].includes(r.status) ? 'PASS' : 'FAIL');
    r = await req('GET', '/api/posts/' + pid);
    record('Cross: post gone', 'pid', '404', String(r.status), r.status === 404 ? 'PASS' : 'FAIL');
  }
  // Delete comment
  if (testCommentId && testPostId) {
    r = await req('DELETE', '/api/posts/' + testPostId + '/comments/' + testCommentId, null, auth);
    record('Cross: del comment', 'cid', '200/204', String(r.status), [200, 204].includes(r.status) ? 'PASS' : 'FAIL');
  }
  // Journal create + delete
  r = await req('POST', '/api/journals', { title: 'Temp Journal', content: 'Temp ' + TS, userId: mainUser.userId, mood: 'sad' }, auth);
  if (r.status === 201 && r.data && r.data.journal) {
    const r2 = await req('DELETE', '/api/journals/' + r.data.journal.id, { userId: mainUser.userId }, auth);
    record('Cross: del journal', 'jid', '200/204', String(r2.status), [200, 204].includes(r2.status) ? 'PASS' : 'FAIL');
  }
}

async function stressTests() {
  console.log('\nSTRESS TESTS');
  if (mainUser == null) return;
  const auth = { Authorization: 'Bearer ' + mainToken };
  // 50 concurrent posts
  console.log('  50 concurrent posts...');
  const p1 = Date.now();
  const pr = await Promise.allSettled(Array.from({ length: 50 }, function(_, i) { return req('POST', '/api/posts', { content: 'Stress post number ' + i + ' ts ' + TS, userId: mainUser.userId }, auth); }));
  const pOk = pr.filter(function(r) { return r.status === 'fulfilled' && r.value.status === 201; }).length;
  record('50 concurrent posts', '50 parallel', '>=45', pOk + ' ok ' + (Date.now() - p1) + 'ms', pOk >= 45 ? 'PASS' : 'FAIL');
  // 50 concurrent reads
  console.log('  50 concurrent reads...');
  const r1t = Date.now();
  const rr = await Promise.allSettled(Array.from({ length: 50 }, function() { return req('GET', '/api/posts'); }));
  const rOk = rr.filter(function(r) { return r.status === 'fulfilled' && r.value.status === 200; }).length;
  record('50 concurrent reads', '50 parallel', '>=48', rOk + ' ok ' + (Date.now() - r1t) + 'ms', rOk >= 48 ? 'PASS' : 'FAIL');
  // 30 concurrent registrations
  console.log('  30 concurrent registrations...');
  const g1 = Date.now();
  const gr = await Promise.allSettled(Array.from({ length: 30 }, function(_, i) { return req('POST', '/api/users', { displayName: 'SU_' + TS + '_' + i, deviceId: uuid() }); }));
  const gOk = gr.filter(function(r) { return r.status === 'fulfilled' && r.value.status === 201; }).length;
  record('30 concurrent regs', '30 parallel', '>=25', gOk + ' ok ' + (Date.now() - g1) + 'ms', gOk >= 25 ? 'PASS' : 'FAIL');
  // 20 rapid reaction toggles
  if (testPostId) {
    console.log('  20 rapid reaction toggles...');
    const t1 = Date.now();
    let tOk = 0;
    for (let i = 0; i < 20; i++) { const r = await req('POST', '/api/posts/' + testPostId + '/reactions', { type: 'LIKE', userId: mainUser.userId }, auth); if ([200, 201].includes(r.status)) tOk++; }
    record('20 reaction toggles', 'LIKE x20', '20 ok', tOk + ' ok ' + (Date.now() - t1) + 'ms', tOk === 20 ? 'PASS' : 'WARN');
  }
}

function printReport() {
  console.log('\n' + '='.repeat(72));
  console.log('FULL QA TEST REPORT - PUSO Spaze');
  console.log('='.repeat(72));
  console.log('Date: ' + new Date().toISOString());
  console.log('Server: http://localhost:4000 | Web: http://localhost:8081');
  const passed = results.filter(function(r) { return r.status === 'PASS'; }).length;
  const failed = results.filter(function(r) { return r.status === 'FAIL'; }).length;
  const warned = results.filter(function(r) { return r.status === 'WARN'; }).length;
  console.log('\nTotal: ' + results.length + ' | Passed: ' + passed + ' | Failed: ' + failed + ' | Warnings: ' + warned);
  console.log('-'.repeat(72));
  const failures = results.filter(function(r) { return r.status === 'FAIL'; });
  if (failures.length > 0) {
    console.log('\nBUGS FOUND:');
    failures.forEach(function(f, i) { console.log('\n  [BUG-' + String(i + 1).padStart(3, '0') + '] ' + f.test); console.log('    Input:    ' + f.input); console.log('    Expected: ' + f.expected); console.log('    Actual:   ' + f.actual); });
  }
  const warns = results.filter(function(r) { return r.status === 'WARN'; });
  if (warns.length > 0) {
    console.log('\nWARNINGS:');
    warns.forEach(function(w, i) { console.log('  ' + (i + 1) + '. ' + w.test + ': expected ' + w.expected + ', got ' + w.actual); });
  }
  console.log('\n' + '='.repeat(72));
}

async function main() {
  console.log('PUSO Spaze - Full QA Pass');
  console.log('Timestamp: ' + TS);
  await smokeTests();
  await registerUsers();
  await inputValidation();
  await authTesting();
  await happyPath();
  await anonymousMode();
  await errorHandling();
  await duplicateConflict();
  await crossFeature();
  await stressTests();
  printReport();
}
main().catch(function(e) { console.error('CRASHED:', e); process.exit(1); });
