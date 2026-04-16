const BASE = 'http://localhost:4000';
const TS = Date.now();
const results = [];
let n = 0;
function rec(test, expected, actual, pass) {
  n++;
  const s = pass ? 'PASS' : 'FAIL';
  results.push({ n, test, expected, actual, s });
  console.log('  ' + s + ' #' + n + ' ' + test);
}
async function req(method, path, body, headers) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  let data; try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}
const uuid = () => crypto.randomUUID();

async function main() {
  console.log('=== NEW FEATURES QA ===\n');
  const r1 = await req('POST', '/api/users', { displayName: 'NF_User1_' + TS, deviceId: uuid() });
  const r2 = await req('POST', '/api/users', { displayName: 'NF_User2_' + TS, deviceId: uuid() });
  const u1 = r1.data, u2 = r2.data;
  const a1 = { Authorization: 'Bearer ' + u1.token };
  const a2 = { Authorization: 'Bearer ' + u2.token };

  console.log('PERSISTENT ANONYMOUS NAME');
  await req('PATCH', '/api/users/' + u1.userId + '/anonymous', { isAnonymous: true }, a1);
  const p1 = await req('POST', '/api/posts', { content: 'First anon post ' + TS, userId: u1.userId }, a1);
  const anonName1 = p1.data && p1.data.post && p1.data.post.anonDisplayName;
  rec('Anon post has anonDisplayName', 'truthy', anonName1 || 'null', !!anonName1);

  const p2 = await req('POST', '/api/posts', { content: 'Second anon post ' + TS, userId: u1.userId }, a1);
  const anonName2 = p2.data && p2.data.post && p2.data.post.anonDisplayName;
  rec('Second post same anon name', anonName1, anonName2, anonName1 === anonName2);

  const targetPost = await req('POST', '/api/posts', { content: 'Target post ' + TS, userId: u2.userId }, a2);
  const tpid = targetPost.data && targetPost.data.post && targetPost.data.post.id;
  const c1 = await req('POST', '/api/posts/' + tpid + '/comments', { content: 'Anon comment ' + TS, userId: u1.userId }, a1);
  const anonName3 = c1.data && c1.data.comment && c1.data.comment.anonDisplayName;
  rec('Anon comment same name as post', anonName1, anonName3, anonName1 === anonName3);

  const p3 = await req('POST', '/api/posts', { content: 'Third anon post ' + TS, userId: u1.userId }, a1);
  const anonName4 = p3.data && p3.data.post && p3.data.post.anonDisplayName;
  rec('Third post still same name', anonName1, anonName4, anonName1 === anonName4);

  console.log('\nANON PRIVACY');
  const createJson = JSON.stringify(p1.data);
  const createLeaks = createJson.includes('NF_User1_' + TS);
  rec('Create response hides real name', 'no real name', createLeaks ? 'LEAKS' : 'safe', !createLeaks);
  const udn = p1.data && p1.data.post && p1.data.post.user && p1.data.post.user.displayName;
  rec('user.displayName is anon name', anonName1, udn, udn === anonName1);

  const feed = await req('GET', '/api/posts');
  const feedPosts = feed.data && feed.data.posts ? feed.data.posts : [];
  const anonPosts = feedPosts.filter(function(p) { return p.isAnonymous && p.userId === u1.userId; });
  const leaking = anonPosts.filter(function(p) { return p.realUser; });
  rec('Feed anon posts found', '>=1', String(anonPosts.length), anonPosts.length >= 1);
  rec('Feed no realUser leak', '0 leaks', leaking.length + ' leaks', leaking.length === 0);

  if (anonPosts[0]) {
    const sp = await req('GET', '/api/posts/' + anonPosts[0].id);
    const hasReal = !!(sp.data && sp.data.post && sp.data.post.realUser);
    rec('Single post no realUser leak', 'no realUser', hasReal ? 'LEAKS' : 'safe', !hasReal);
  }

  console.log('\nENCOURAGEMENTS GIVEN');
  await req('PATCH', '/api/users/' + u1.userId + '/anonymous', { isAnonymous: false }, a1);
  const s0 = await req('GET', '/api/users/' + u1.userId + '/stats', null, a1);
  const initial = s0.data && s0.data.encouragementsGiven || 0;
  rec('Stats endpoint works', '200', String(s0.status), s0.status === 200);

  const testPost2 = await req('POST', '/api/posts', { content: 'Encourage test ' + TS, userId: u2.userId }, a2);
  const epid = testPost2.data && testPost2.data.post && testPost2.data.post.id;
  await req('POST', '/api/posts/' + epid + '/reactions', { type: 'PRAY', userId: u1.userId }, a1);
  await req('POST', '/api/posts/' + epid + '/comments', { content: 'Praying for you fam ' + TS, userId: u1.userId }, a1);
  const s1 = await req('GET', '/api/users/' + u1.userId + '/stats', null, a1);
  const after = s1.data && s1.data.encouragementsGiven || 0;
  rec('encouragementsGiven +2 (reaction+comment)', String(initial + 2), String(after), after === initial + 2);
  rec('totalReflections is number', 'number', typeof (s1.data && s1.data.totalReflections), typeof (s1.data && s1.data.totalReflections) === 'number');
  rec('streak is number', 'number', typeof (s1.data && s1.data.streak), typeof (s1.data && s1.data.streak) === 'number');

  const ownPost = await req('POST', '/api/posts', { content: 'My own post ' + TS, userId: u1.userId }, a1);
  const opid = ownPost.data && ownPost.data.post && ownPost.data.post.id;
  await req('POST', '/api/posts/' + opid + '/reactions', { type: 'LIKE', userId: u1.userId }, a1);
  await req('POST', '/api/posts/' + opid + '/comments', { content: 'Self comment ' + TS, userId: u1.userId }, a1);
  const s2 = await req('GET', '/api/users/' + u1.userId + '/stats', null, a1);
  const afterSelf = s2.data && s2.data.encouragementsGiven || 0;
  rec('Self-react/comment NOT counted', String(after), String(afterSelf), afterSelf === after);

  console.log('\n' + '='.repeat(60));
  const pass = results.filter(function(r) { return r.s === 'PASS'; }).length;
  const fail = results.filter(function(r) { return r.s === 'FAIL'; }).length;
  console.log('NEW FEATURES QA: ' + results.length + ' tests | ' + pass + ' passed | ' + fail + ' failed');
  if (fail > 0) {
    console.log('\nFAILURES:');
    results.filter(function(r) { return r.s === 'FAIL'; }).forEach(function(r) {
      console.log('  #' + r.n + ' ' + r.test + ': expected=' + r.expected + ', actual=' + r.actual);
    });
  }
  console.log('='.repeat(60));
}
main().catch(function(e) { console.error('CRASHED:', e); process.exit(1); });
