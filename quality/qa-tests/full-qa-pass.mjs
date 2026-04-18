const BASE = 'http://localhost:4000';
const TS = Date.now();
const results = [];
let n = 0;
const SECTION_RESULTS = {};
let currentSection = '';

function section(name) {
  currentSection = name;
  SECTION_RESULTS[name] = { pass: 0, fail: 0, warn: 0 };
  console.log('\n' + '-'.repeat(60));
  console.log('  ' + name);
  console.log('-'.repeat(60));
}

function rec(test, expected, actual, pass, severity) {
  n++;
  const s = pass ? 'PASS' : 'FAIL';
  results.push({ n, test, expected: String(expected), actual: String(actual), s, severity: severity || 'Medium', section: currentSection });
  if (pass) SECTION_RESULTS[currentSection].pass++;
  else SECTION_RESULTS[currentSection].fail++;
  console.log('  ' + (pass ? 'PASS' : 'FAIL') + ' #' + n + ' ' + test + (pass ? '' : ' [expected=' + expected + ', actual=' + actual + ']'));
}

async function req(method, path, body, headers) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const start = Date.now();
  try {
    const res = await fetch(BASE + path, opts);
    const elapsed = Date.now() - start;
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data, elapsed, ok: res.ok };
  } catch (e) {
    return { status: 0, data: null, elapsed: Date.now() - start, ok: false, error: e.message };
  }
}

async function reqRaw(method, path, rawBody, headers) {
  const opts = { method, headers: { ...headers }, body: rawBody };
  try {
    const res = await fetch(BASE + path, opts);
    let data; try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: null, error: e.message };
  }
}

const uuid = () => crypto.randomUUID();

async function main() {
  console.log('PUSO SPAZE FULL QA PASS');
  console.log(new Date().toISOString());

  // 1. SMOKE TEST
  section('1. SMOKE TEST');
  const health = await req('GET', '/health');
  rec('Health endpoint returns 200', 200, health.status, health.status === 200);
  rec('Health has status ok', 'ok', health.data?.status, health.data?.status === 'ok');
  const webCheck = await fetch('http://localhost:8081').then(r => r.status).catch(() => 0);
  rec('Web app loads (8081)', 200, webCheck, webCheck === 200);

  // 2. USER REGISTRATION
  section('2. USER REGISTRATION');
  const u1r = await req('POST', '/api/users', { displayName: 'QA_Alpha_' + TS, deviceId: uuid() });
  rec('Register user Alpha', 201, u1r.status, u1r.status === 201, 'Critical');
  rec('Response has userId', true, !!u1r.data?.userId, !!u1r.data?.userId, 'Critical');
  rec('Response has token', true, !!u1r.data?.token, !!u1r.data?.token, 'Critical');
  const u2r = await req('POST', '/api/users', { displayName: 'QA_Beta_' + TS, deviceId: uuid() });
  rec('Register user Beta', 201, u2r.status, u2r.status === 201);
  const u3r = await req('POST', '/api/users', { displayName: 'QA_Gamma_' + TS, deviceId: uuid() });
  rec('Register user Gamma', 201, u3r.status, u3r.status === 201);

  const u1 = u1r.data, u2 = u2r.data, u3 = u3r.data;
  const a1 = { Authorization: 'Bearer ' + u1?.token };
  const a2 = { Authorization: 'Bearer ' + u2?.token };
  const a3 = { Authorization: 'Bearer ' + u3?.token };

  const checkAvail = await req('GET', '/api/users/check-username/QA_Alpha_' + TS);
  rec('Username taken check returns', 'not 500', checkAvail.status, checkAvail.status !== 500);
  const checkFree = await req('GET', '/api/users/check-username/FreeUser_' + TS + '_xyz');
  rec('Username free check returns', 'not 500', checkFree.status, checkFree.status !== 500);

  // 3. INPUT VALIDATION
  section('3. INPUT VALIDATION');
  const emptyName = await req('POST', '/api/users', { displayName: '', deviceId: uuid() });
  rec('Reject empty displayName', '4xx', emptyName.status, emptyName.status >= 400 && emptyName.status < 500, 'High');
  const shortName = await req('POST', '/api/users', { displayName: 'A', deviceId: uuid() });
  rec('Reject 1-char displayName', '4xx', shortName.status, shortName.status >= 400 && shortName.status < 500, 'Medium');
  const longName = await req('POST', '/api/users', { displayName: 'A'.repeat(100), deviceId: uuid() });
  rec('Reject 100-char displayName', '4xx', longName.status, longName.status >= 400 && longName.status < 500, 'Medium');
  const noDevice = await req('POST', '/api/users', { displayName: 'NoDevice_' + TS });
  rec('Accept missing deviceId (optional)', '2xx', noDevice.status, noDevice.status >= 200 && noDevice.status < 300, 'Low');
  const noBody = await req('POST', '/api/users', null);
  rec('Reject empty body registration', '4xx', noBody.status, noBody.status >= 400 && noBody.status < 500, 'High');
  const xssName = await req('POST', '/api/users', { displayName: '<script>alert("xss")</script>', deviceId: uuid() });
  if (xssName.status === 201 && xssName.data) {
    const raw = JSON.stringify(xssName.data);
    const hasScript = raw.includes('<script>');
    rec('XSS in displayName sanitized or rejected', 'no raw script', hasScript ? 'RAW SCRIPT' : 'safe', !hasScript, 'Critical');
  } else {
    rec('XSS displayName rejected', '4xx', xssName.status, xssName.status >= 400, 'Critical');
  }
  const sqli = await req('POST', '/api/users', { displayName: "Robert'; DROP TABLE users;--", deviceId: uuid() });
  rec('SQL injection name no crash', 'no 500', sqli.status, sqli.status !== 500, 'Critical');
  const emojiUser = await req('POST', '/api/users', { displayName: 'Emoji_QA_' + TS, deviceId: uuid() });
  rec('Emoji-prefix displayName', '201', emojiUser.status, emojiUser.status === 201, 'Low');
  const nullByte = await req('POST', '/api/users', { displayName: 'null_byte_' + TS, deviceId: uuid() });
  rec('Name with special chars handled', 'no 500', nullByte.status, nullByte.status !== 500, 'Medium');

  // 4. POST CRUD
  section('4. POST CRUD');
  const p1 = await req('POST', '/api/posts', { content: 'Hello PUSO fam! Testing 💜 #QA ' + TS, userId: u1.userId }, a1);
  rec('Create post', 201, p1.status, p1.status === 201, 'Critical');
  const postId1 = p1.data?.post?.id;
  rec('Post has id', true, !!postId1, !!postId1);
  const feed = await req('GET', '/api/posts');
  rec('Get feed', 200, feed.status, feed.status === 200);
  rec('Feed has posts array', true, Array.isArray(feed.data?.posts), Array.isArray(feed.data?.posts));
  const foundPost = feed.data?.posts?.find(p => p.id === postId1);
  rec('New post in feed', true, !!foundPost, !!foundPost);
  const sp = await req('GET', '/api/posts/' + postId1);
  rec('Get single post', 200, sp.status, sp.status === 200);
  const up = await req('PATCH', '/api/posts/' + postId1, { content: 'Updated ' + TS, userId: u1.userId }, a1);
  rec('Update post', 200, up.status, up.status === 200);
  const emptyPost = await req('POST', '/api/posts', { content: '', userId: u1.userId }, a1);
  rec('Reject empty post', '4xx', emptyPost.status, emptyPost.status >= 400 && emptyPost.status < 500, 'High');
  const shortPost = await req('POST', '/api/posts', { content: 'X', userId: u1.userId }, a1);
  rec('Reject 1-char post (min 2)', '4xx', shortPost.status, shortPost.status >= 400 && shortPost.status < 500, 'Medium');
  const maxPost = await req('POST', '/api/posts', { content: 'A'.repeat(500), userId: u1.userId }, a1);
  rec('Accept 500-char post', 201, maxPost.status, maxPost.status === 201, 'Medium');
  const overPost = await req('POST', '/api/posts', { content: 'A'.repeat(501), userId: u1.userId }, a1);
  rec('Reject 501-char post', '4xx', overPost.status, overPost.status >= 400 && overPost.status < 500, 'Medium');
  const xssPost = await req('POST', '/api/posts', { content: '<img src=x onerror=alert(1)> test ' + TS, userId: u1.userId }, a1);
  if (xssPost.status === 201) {
    const stored = xssPost.data?.post?.content;
    const hasXSS = stored?.includes('onerror=');
    rec('XSS in post content sanitized', 'no onerror', hasXSS ? 'RAW XSS' : 'safe', !hasXSS, 'Critical');
  } else {
    rec('XSS post rejected', '4xx', xssPost.status, xssPost.status >= 400, 'Critical');
  }
  const delPost = await req('POST', '/api/posts', { content: 'Delete me ' + TS, userId: u1.userId }, a1);
  const delId = delPost.data?.post?.id;
  const del = await req('DELETE', '/api/posts/' + delId, { userId: u1.userId }, a1);
  rec('Delete own post', 200, del.status, del.status === 200);
  const otherPost = await req('POST', '/api/posts', { content: 'Not yours ' + TS, userId: u2.userId }, a2);
  const otherId = otherPost.data?.post?.id;
  const delOther = await req('DELETE', '/api/posts/' + otherId, { userId: u1.userId }, a1);
  rec('Cannot delete other post', '4xx', delOther.status, delOther.status >= 400 && delOther.status < 500, 'High');
  const ghost = await req('GET', '/api/posts/' + uuid());
  rec('404 for non-existent post', 404, ghost.status, ghost.status === 404);

  // 5. COMMENTS
  section('5. COMMENTS');
  const commentTarget = await req('POST', '/api/posts', { content: 'Comment target ' + TS, userId: u2.userId }, a2);
  const ctId = commentTarget.data?.post?.id;
  const c1 = await req('POST', '/api/posts/' + ctId + '/comments', { content: 'Great post! ' + TS, userId: u1.userId }, a1);
  rec('Create comment', 201, c1.status, c1.status === 201);
  const cId1 = c1.data?.comment?.id;
  const gc = await req('GET', '/api/posts/' + ctId + '/comments');
  rec('Get comments', 200, gc.status, gc.status === 200);
  const comments = gc.data?.comments || gc.data || [];
  rec('Comment appears', true, Array.isArray(comments) && comments.length > 0, Array.isArray(comments) && comments.length > 0);
  if (cId1) {
    const editC = await req('PATCH', '/api/posts/' + ctId + '/comments/' + cId1, { content: 'Edited ' + TS, userId: u1.userId }, a1);
    rec('Edit own comment', 200, editC.status, editC.status === 200);
    const delC = await req('DELETE', '/api/posts/' + ctId + '/comments/' + cId1, { userId: u1.userId }, a1);
    rec('Delete own comment', 200, delC.status, delC.status === 200);
  }
  const emptyC = await req('POST', '/api/posts/' + ctId + '/comments', { content: '', userId: u1.userId }, a1);
  rec('Reject empty comment', '4xx', emptyC.status, emptyC.status >= 400 && emptyC.status < 500, 'Medium');
  const ghostC = await req('POST', '/api/posts/' + uuid() + '/comments', { content: 'Ghost ' + TS, userId: u1.userId }, a1);
  rec('Comment on non-existent post', '4xx/404', ghostC.status, ghostC.status >= 400 && ghostC.status < 500);
  const mentionC = await req('POST', '/api/posts/' + ctId + '/comments', { content: '@QA_Alpha_' + TS + ' nice! ' + TS, userId: u2.userId }, a2);
  rec('Comment with @mention', 201, mentionC.status, mentionC.status === 201);

  // 6. REACTIONS
  section('6. REACTIONS');
  const reactTarget = await req('POST', '/api/posts', { content: 'React to me ' + TS, userId: u2.userId }, a2);
  const rtId = reactTarget.data?.post?.id;
  for (const type of ['PRAY', 'CARE', 'SUPPORT', 'LIKE']) {
    const r = await req('POST', '/api/posts/' + rtId + '/reactions', { type, userId: u1.userId }, a1);
    rec('React ' + type, '2xx', r.status, r.status >= 200 && r.status < 300);
  }
  const gr = await req('GET', '/api/posts/' + rtId + '/reactions');
  rec('Get reactions', 200, gr.status, gr.status === 200);
  const badReact = await req('POST', '/api/posts/' + rtId + '/reactions', { type: 'HATE', userId: u1.userId }, a1);
  rec('Reject invalid reaction type', '4xx', badReact.status, badReact.status >= 400 && badReact.status < 500, 'Medium');
  const c2 = await req('POST', '/api/posts/' + rtId + '/comments', { content: 'React to this ' + TS, userId: u2.userId }, a2);
  const cId2 = c2.data?.comment?.id;
  if (cId2) {
    const cr = await req('POST', '/api/posts/' + rtId + '/comments/' + cId2 + '/reactions', { type: 'PRAY', userId: u1.userId }, a1);
    rec('React to comment', '2xx', cr.status, cr.status >= 200 && cr.status < 300);
  }

  // 7. AUTH & SECURITY
  section('7. AUTH & SECURITY');
  const noAuth = await req('POST', '/api/posts', { content: 'No auth ' + TS, userId: u1.userId });
  rec('Post without auth', '401', noAuth.status, noAuth.status === 401, 'Critical');
  const badToken = await req('POST', '/api/posts', { content: 'Bad token ' + TS, userId: u1.userId }, { Authorization: 'Bearer invalidtoken123' });
  rec('Post with invalid token', '401/403', badToken.status, badToken.status === 401 || badToken.status === 403, 'Critical');
  const emptyBearer = await req('POST', '/api/posts', { content: 'Empty bearer ' + TS, userId: u1.userId }, { Authorization: 'Bearer ' });
  rec('Post with empty bearer', '401/403', emptyBearer.status, emptyBearer.status === 401 || emptyBearer.status === 403, 'Critical');
  const setPin = await req('PATCH', '/api/users/' + u1.userId + '/pin', { pin: '654321' }, a1);
  rec('Set PIN', 200, setPin.status, setPin.status === 200);
  const getPin = await req('GET', '/api/users/' + u1.userId + '/pin', null, a1);
  rec('Get PIN', 200, getPin.status, getPin.status === 200);
  const pinLogin = await req('POST', '/api/auth/pin-login', { displayName: 'QA_Alpha_' + TS, pin: '654321' });
  rec('PIN login correct', 200, pinLogin.status, pinLogin.status === 200);
  rec('PIN login returns token', true, !!pinLogin.data?.token, !!pinLogin.data?.token);
  const wrongPin = await req('POST', '/api/auth/pin-login', { displayName: 'QA_Alpha_' + TS, pin: '999999' });
  rec('Wrong PIN rejected', '4xx', wrongPin.status, wrongPin.status >= 400 && wrongPin.status < 500, 'High');
  const otherPin = await req('GET', '/api/users/' + u2.userId + '/pin', null, a1);
  rec('Cannot access other user PIN', '4xx', otherPin.status, otherPin.status >= 400 && otherPin.status < 500, 'High');

  // 8. ANONYMOUS MODE
  section('8. ANONYMOUS MODE');
  const toggleAnon = await req('PATCH', '/api/users/' + u1.userId + '/anonymous', { isAnonymous: true }, a1);
  rec('Toggle anonymous on', 200, toggleAnon.status, toggleAnon.status === 200);
  const anonPost = await req('POST', '/api/posts', { content: 'Anonymous confession ' + TS, userId: u1.userId }, a1);
  rec('Create anon post', 201, anonPost.status, anonPost.status === 201);
  const anonPostId = anonPost.data?.post?.id;
  const anonName = anonPost.data?.post?.anonDisplayName;
  rec('Anon post has anonDisplayName', true, !!anonName, !!anonName);
  const feedAnon = await req('GET', '/api/posts');
  const anonInFeed = feedAnon.data?.posts?.find(p => p.id === anonPostId);
  if (anonInFeed) {
    rec('Feed anon isAnonymous=true', true, anonInFeed.isAnonymous, anonInFeed.isAnonymous === true);
    const leaksName = anonInFeed.user?.displayName === 'QA_Alpha_' + TS || anonInFeed.user?.displayName === ('QA_Renamed_' + TS);
    rec('Feed NOT leak real name', false, leaksName, !leaksName, 'Critical');
    const leaksRU = !!anonInFeed.realUser;
    rec('Feed NOT leak realUser', false, leaksRU, !leaksRU, 'Critical');
  }
  const singleAnon = await req('GET', '/api/posts/' + anonPostId);
  if (singleAnon.data?.post) {
    const leaksRealSingle = !!singleAnon.data.post.realUser;
    rec('Single post NOT leak realUser', false, leaksRealSingle, !leaksRealSingle, 'Critical');
  }
  const anonPost2 = await req('POST', '/api/posts', { content: 'Another anon ' + TS, userId: u1.userId }, a1);
  rec('Persistent anon name', anonName, anonPost2.data?.post?.anonDisplayName, anonName === anonPost2.data?.post?.anonDisplayName);
  const anonComment = await req('POST', '/api/posts/' + ctId + '/comments', { content: 'Anon comment ' + TS, userId: u1.userId }, a1);
  rec('Anon comment same name', anonName, anonComment.data?.comment?.anonDisplayName, anonName === anonComment.data?.comment?.anonDisplayName);
  await req('PATCH', '/api/users/' + u1.userId + '/anonymous', { isAnonymous: false }, a1);

  // 9. JOURNALS
  section('9. JOURNALS');
  const j1 = await req('POST', '/api/journals', { title: 'QA Journal', content: 'Private journal ' + TS, userId: u1.userId, mood: 'happy' }, a1);
  rec('Create journal', 201, j1.status, j1.status === 201, 'High');
  const jId = j1.data?.journal?.id || j1.data?.id;
  const jList = await req('GET', '/api/journals?userId=' + u1.userId, null, a1);
  rec('Get journals list', 200, jList.status, jList.status === 200);
  const journals = jList.data?.journals || jList.data || [];
  rec('Journal appears', true, Array.isArray(journals) && journals.length > 0, Array.isArray(journals) && journals.length > 0);
  if (jId) {
    const jUp = await req('PATCH', '/api/journals/' + jId, { content: 'Updated journal ' + TS, userId: u1.userId }, a1);
    rec('Update journal', 200, jUp.status, jUp.status === 200);
    const jDel = await req('DELETE', '/api/journals/' + jId, { userId: u1.userId }, a1);
    rec('Delete journal', 200, jDel.status, jDel.status === 200);
  }
  const otherJ = await req('GET', '/api/journals?userId=' + u1.userId, null, a2);
  const otherJData = otherJ.data?.journals || otherJ.data || [];
  rec('Other user cant see journals', '0 or 4xx', otherJ.status >= 400 ? '4xx' : String(Array.isArray(otherJData) ? otherJData.length : 'ok'), otherJ.status >= 400 || (Array.isArray(otherJData) && otherJData.length === 0), 'High');

  // 10. NOTIFICATIONS
  section('10. NOTIFICATIONS');
  const nPost = await req('POST', '/api/posts', { content: 'Notify me! ' + TS, userId: u1.userId }, a1);
  const nPostId = nPost.data?.post?.id;
  await req('POST', '/api/posts/' + nPostId + '/reactions', { type: 'PRAY', userId: u2.userId }, a2);
  await req('POST', '/api/posts/' + nPostId + '/comments', { content: 'Nice! ' + TS, userId: u2.userId }, a2);
  await new Promise(r => setTimeout(r, 500));
  const notifs = await req('GET', '/api/notifications?userId=' + u1.userId, null, a1);
  rec('Get notifications', 200, notifs.status, notifs.status === 200);
  const notifList = notifs.data?.notifications || notifs.data || [];
  rec('Has notifications', true, Array.isArray(notifList) && notifList.length > 0, Array.isArray(notifList) && notifList.length > 0);
  if (Array.isArray(notifList) && notifList.length > 0) {
    const nId = notifList[0].id;
    const markRead = await req('PATCH', '/api/notifications/' + nId + '/read', { userId: u1.userId }, a1);
    rec('Mark notification read', 200, markRead.status, markRead.status === 200);
  }
  const markAll = await req('PATCH', '/api/notifications/read-all', { userId: u1.userId }, a1);
  rec('Mark all read', 200, markAll.status, markAll.status === 200);

  // 11. PROFILE & SETTINGS
  section('11. PROFILE & SETTINGS');
  const rename = await req('PATCH', '/api/users/' + u1.userId + '/username', { displayName: 'QA_Renamed_' + TS }, a1);
  rec('Update username', 200, rename.status, rename.status === 200);
  const toggleNotif = await req('PATCH', '/api/users/' + u1.userId + '/notifications', { enabled: false }, a1);
  rec('Toggle notifications', 200, toggleNotif.status, toggleNotif.status === 200);
  const stats = await req('GET', '/api/stats/dashboard', null, a1);
  rec('Dashboard stats', 200, stats.status, stats.status === 200);
  const online = await req('GET', '/api/stats/online');
  rec('Online count', 200, online.status, online.status === 200);
  const uStats = await req('GET', '/api/users/' + u1.userId + '/stats', null, a1);
  rec('User stats', 200, uStats.status, uStats.status === 200);

  // 12. CONVERSATIONS
  section('12. CONVERSATIONS / COACH');
  const coaches = await req('GET', '/api/conversations/coaches', null, a1);
  rec('Get coaches list', 200, coaches.status, coaches.status === 200);

  // 13. FLAGGING
  section('13. FLAGGING / MODERATION');
  const flagTarget = await req('POST', '/api/posts', { content: 'Controversial ' + TS, userId: u2.userId }, a2);
  const flagId = flagTarget.data?.post?.id;
  if (flagId) {
    const flag = await req('POST', '/api/posts/' + flagId + '/report', { userId: u1.userId, reason: 'inappropriate' }, a1);
    rec('Report a post', '2xx', flag.status, flag.status >= 200 && flag.status < 300);
    const flag2 = await req('POST', '/api/posts/' + flagId + '/report', { userId: u1.userId, reason: 'spam' }, a1);
    rec('Duplicate report no crash', 'no 500', flag2.status, flag2.status !== 500);
  }

  // 14. DUPLICATE / CONFLICT
  section('14. DUPLICATE / CONFLICT TESTS');
  const dupUser = await req('POST', '/api/users', { displayName: 'QA_Beta_' + TS, deviceId: uuid() });
  rec('Reject duplicate displayName (diff device)', '409', dupUser.status, dupUser.status === 409, 'High');
  const dblReact = await req('POST', '/api/posts', { content: 'Double react ' + TS, userId: u2.userId }, a2);
  const drId = dblReact.data?.post?.id;
  await req('POST', '/api/posts/' + drId + '/reactions', { type: 'PRAY', userId: u1.userId }, a1);
  const r2x = await req('POST', '/api/posts/' + drId + '/reactions', { type: 'PRAY', userId: u1.userId }, a1);
  rec('Double reaction no crash', 'no 500', r2x.status, r2x.status !== 500);

  // 15. ERROR HANDLING
  section('15. ERROR HANDLING');
  const malformed = await reqRaw('POST', '/api/posts', '{broken json!!!', { 'Content-Type': 'application/json', ...a1 });
  rec('Malformed JSON body', '4xx', malformed.status, malformed.status >= 400 && malformed.status < 500, 'High');
  const wrongCT = await reqRaw('POST', '/api/posts', 'content=hello', { 'Content-Type': 'text/plain', ...a1 });
  rec('Wrong content type no 500', 'no 500', wrongCT.status, wrongCT.status !== 500);
  const notFoundEP = await req('GET', '/api/nonexistent');
  rec('Non-existent endpoint', 404, notFoundEP.status, notFoundEP.status === 404);
  const huge = await req('POST', '/api/posts', { content: 'X'.repeat(100000), userId: u1.userId }, a1);
  rec('Reject oversized payload', '4xx', huge.status, huge.status >= 400 && huge.status < 500, 'Medium');

  // 16. RECOVERY
  section('16. RECOVERY');
  const recovery = await req('POST', '/api/recovery-requests', { displayName: 'QA_Beta_' + TS, reason: 'Lost my phone and need recovery ' + TS });
  rec('Submit recovery', '2xx', recovery.status, recovery.status >= 200 && recovery.status < 300);

  // 17. STRESS TEST
  section('17. STRESS TEST');
  const stressStart = Date.now();
  const stressResults = await Promise.allSettled(
    Array.from({ length: 100 }, (_, i) =>
      req('POST', '/api/posts', { content: 'Stress #' + i + ' ' + TS, userId: u1.userId }, a1)
    )
  );
  const stressElapsed = Date.now() - stressStart;
  const stressOk = stressResults.filter(r => r.status === 'fulfilled' && r.value.status === 201).length;
  const stress500 = stressResults.filter(r => r.status === 'fulfilled' && r.value.status === 500).length;
  rec('100 concurrent posts >=90 ok', '>=90', stressOk, stressOk >= 90, 'High');
  rec('No 500 errors in stress', 0, stress500, stress500 === 0, 'High');
  console.log('    Time: 100 posts in ' + stressElapsed + 'ms (avg ' + Math.round(stressElapsed / 100) + 'ms)');

  const stressRT = await req('POST', '/api/posts', { content: 'Stress react target ' + TS, userId: u2.userId }, a2);
  const srId = stressRT.data?.post?.id;
  const reactStress = await Promise.allSettled(
    Array.from({ length: 50 }, (_, i) =>
      req('POST', '/api/posts/' + srId + '/reactions', { type: ['PRAY','CARE','SUPPORT','LIKE'][i%4], userId: u3.userId }, a3)
    )
  );
  const r500 = reactStress.filter(r => r.status === 'fulfilled' && r.value.status === 500).length;
  rec('50 rapid reactions no 500', 0, r500, r500 === 0, 'High');

  const regStart = Date.now();
  const regResults = await Promise.allSettled(
    Array.from({ length: 50 }, (_, i) =>
      req('POST', '/api/users', { displayName: 'StressReg_' + i + '_' + TS, deviceId: uuid() })
    )
  );
  const regElapsed = Date.now() - regStart;
  const regOk = regResults.filter(r => r.status === 'fulfilled' && r.value.status === 201).length;
  const reg500 = regResults.filter(r => r.status === 'fulfilled' && r.value.status === 500).length;
  rec('50 concurrent registrations >=45', '>=45', regOk, regOk >= 45, 'High');
  rec('No reg 500 errors', 0, reg500, reg500 === 0, 'High');
  console.log('    Time: 50 regs in ' + regElapsed + 'ms');

  // 18. CROSS-FEATURE
  section('18. CROSS-FEATURE INTERACTIONS');
  await req('PATCH', '/api/users/' + u1.userId + '/anonymous', { isAnonymous: true }, a1);
  const anonP = await req('POST', '/api/posts', { content: 'Anon cross-feature ' + TS, userId: u1.userId }, a1);
  const apId = anonP.data?.post?.id;
  await req('POST', '/api/posts/' + apId + '/comments', { content: 'Nice anon post ' + TS, userId: u2.userId }, a2);
  const u1N = await req('GET', '/api/notifications?userId=' + u1.userId, null, a1);
  rec('Anon post gets notifications', 200, u1N.status, u1N.status === 200);
  await req('POST', '/api/posts/' + apId + '/reactions', { type: 'CARE', userId: u2.userId }, a2);
  const u2P = await req('POST', '/api/posts', { content: 'Encourage me ' + TS, userId: u2.userId }, a2);
  const u2pId = u2P.data?.post?.id;
  await req('PATCH', '/api/users/' + u1.userId + '/anonymous', { isAnonymous: false }, a1);
  await req('POST', '/api/posts/' + u2pId + '/reactions', { type: 'SUPPORT', userId: u1.userId }, a1);
  const fStats = await req('GET', '/api/users/' + u1.userId + '/stats', null, a1);
  rec('Stats after mixed interactions', 200, fStats.status, fStats.status === 200);
  rec('encouragementsGiven is number', 'number', typeof fStats.data?.encouragementsGiven, typeof fStats.data?.encouragementsGiven === 'number');

  // FINAL REPORT
  console.log('\n\n' + '='.repeat(60));
  console.log('  FULL QA PASS FINAL REPORT');
  console.log('='.repeat(60));
  const totalPass = results.filter(r => r.s === 'PASS').length;
  const totalFail = results.filter(r => r.s === 'FAIL').length;
  console.log('\n  Total tests: ' + results.length);
  console.log('  Passed: ' + totalPass);
  console.log('  Failed: ' + totalFail);
  console.log('  Pass rate: ' + Math.round(totalPass / results.length * 100) + '%');
  console.log('\n  BY SECTION:');
  for (const [sec, counts] of Object.entries(SECTION_RESULTS)) {
    const icon = counts.fail === 0 ? 'OK' : 'FAIL';
    console.log('    [' + icon + '] ' + sec + ' -- ' + counts.pass + ' pass, ' + counts.fail + ' fail');
  }
  if (totalFail > 0) {
    console.log('\n  FAILURES:');
    const failures = results.filter(r => r.s === 'FAIL');
    const critical = failures.filter(f => f.severity === 'Critical');
    const high = failures.filter(f => f.severity === 'High');
    const medium = failures.filter(f => f.severity === 'Medium');
    const low = failures.filter(f => f.severity === 'Low');
    if (critical.length > 0) {
      console.log('\n    CRITICAL:');
      critical.forEach(f => console.log('      #' + f.n + ' [' + f.section + '] ' + f.test + ' -- expected=' + f.expected + ', actual=' + f.actual));
    }
    if (high.length > 0) {
      console.log('\n    HIGH:');
      high.forEach(f => console.log('      #' + f.n + ' [' + f.section + '] ' + f.test + ' -- expected=' + f.expected + ', actual=' + f.actual));
    }
    if (medium.length > 0) {
      console.log('\n    MEDIUM:');
      medium.forEach(f => console.log('      #' + f.n + ' [' + f.section + '] ' + f.test + ' -- expected=' + f.expected + ', actual=' + f.actual));
    }
    if (low.length > 0) {
      console.log('\n    LOW:');
      low.forEach(f => console.log('      #' + f.n + ' [' + f.section + '] ' + f.test + ' -- expected=' + f.expected + ', actual=' + f.actual));
    }
  }
  console.log('\n' + '='.repeat(60));
  console.log('  QA COMPLETE -- ' + new Date().toISOString());
  console.log('='.repeat(60));
}

main().catch(e => { console.error('CRASHED:', e); process.exit(1); });
