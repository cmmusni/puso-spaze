/**
 * Edge-case tests for POST /api/auth/redeem-invite
 * Run: npx tsx test-results/redeem-invite-edge-cases.ts
 *
 * Prerequisites:
 *   - Server running on localhost:4000
 *   - A valid, unused invite code in the database
 */

const BASE = 'http://localhost:4000';
const ENDPOINT = `${BASE}/api/auth/redeem-invite`;

// ── Helpers ──────────────────────────────────────

let testNum = 0;
let passed = 0;
let failed = 0;
const failures: string[] = [];

async function post(body: unknown) {
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function assert(condition: boolean, label: string, detail?: string) {
  testNum++;
  if (condition) {
    passed++;
    console.log(`  ✅ #${testNum} ${label}`);
  } else {
    failed++;
    const msg = `  ❌ #${testNum} ${label}${detail ? ' — ' + detail : ''}`;
    console.log(msg);
    failures.push(msg);
  }
}

// ── Create a fresh invite code via admin endpoint ──
async function createInviteCode(): Promise<string> {
  const res = await fetch(`${BASE}/api/admin/invite-codes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': 'pusocoach_admin_2026',
    },
  });
  if (!res.ok) throw new Error(`Failed to create invite code: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.code; // format XXXXX-XXXXX
}

function uniqueName(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}`;
}

// ── Tests ────────────────────────────────────────

async function main() {
  console.log('\n🔬 Testing POST /api/auth/redeem-invite — Edge Cases\n');

  // ─── Verify server is up ───
  try {
    const health = await fetch(`${BASE}/health`);
    if (!health.ok) throw new Error();
    console.log('  Server is up ✓\n');
  } catch {
    console.error('  ❗ Server not reachable at', BASE);
    process.exit(1);
  }

  // ═══════════════════════════════════════════════
  // 1. VALIDATION TESTS (should return 422)
  // ═══════════════════════════════════════════════
  console.log('── 1. Validation Tests ──');

  // 1a. Empty body
  {
    const res = await post({});
    assert(res.status === 422, 'Empty body → 422', `got ${res.status}`);
  }

  // 1b. Missing displayName
  {
    const res = await post({ code: 'ABCDE-FGHIJ' });
    assert(res.status === 422, 'Missing displayName → 422', `got ${res.status}`);
  }

  // 1c. Missing code
  {
    const res = await post({ displayName: 'TestUser' });
    assert(res.status === 422, 'Missing code → 422', `got ${res.status}`);
  }

  // 1d. displayName too short (1 char)
  {
    const res = await post({ displayName: 'A', code: 'ABCDE-FGHIJ' });
    assert(res.status === 422, 'displayName 1 char → 422', `got ${res.status}`);
  }

  // 1e. displayName too long (31 chars)
  {
    const res = await post({ displayName: 'A'.repeat(31), code: 'ABCDE-FGHIJ' });
    assert(res.status === 422, 'displayName 31 chars → 422', `got ${res.status}`);
  }

  // 1f. displayName with special characters
  {
    const res = await post({ displayName: 'Test@User!', code: 'ABCDE-FGHIJ' });
    assert(res.status === 422, 'displayName with @! → 422', `got ${res.status}`);
  }

  // 1g. displayName with emoji
  {
    const res = await post({ displayName: 'Test😊User', code: 'ABCDE-FGHIJ' });
    assert(res.status === 422, 'displayName with emoji → 422', `got ${res.status}`);
  }

  // 1h. Code wrong length (too short)
  {
    const res = await post({ displayName: 'TestUser', code: 'ABCDE' });
    assert(res.status === 422, 'Code 5 chars → 422', `got ${res.status}`);
  }

  // 1i. Code wrong length (too long)
  {
    const res = await post({ displayName: 'TestUser', code: 'ABCDE-FGHIJK' });
    assert(res.status === 422, 'Code 12 chars → 422', `got ${res.status}`);
  }

  // 1j. deviceId is present but not a UUID
  {
    const res = await post({ displayName: 'TestUser', code: 'ABCDE-FGHIJ', deviceId: 'not-a-uuid' });
    assert(res.status === 422, 'Invalid deviceId → 422', `got ${res.status}`);
  }

  // 1k. displayName with only spaces
  {
    const res = await post({ displayName: '   ', code: 'ABCDE-FGHIJ' });
    assert(res.status === 422, 'Whitespace-only displayName → 422', `got ${res.status}`);
    const body = await res.json().catch(() => null);
    console.log('    Response:', JSON.stringify(body));
  }

  // 1l. displayName exactly 2 chars (boundary — should pass validation)
  {
    const res = await post({ displayName: 'Ab', code: 'ABCDE-FGHIJ' });
    // Should pass validation (422 would mean validation failed)
    // But should fail with 400 (invalid invite code) — that's expected
    assert(res.status !== 422, 'displayName 2 chars passes validation', `got ${res.status}`);
  }

  // 1m. displayName exactly 30 chars (boundary — should pass validation)
  {
    const res = await post({ displayName: 'A'.repeat(30), code: 'ABCDE-FGHIJ' });
    assert(res.status !== 422, 'displayName 30 chars passes validation', `got ${res.status}`);
  }

  // 1n. Code exactly 11 chars (boundary — should pass validation)
  {
    const res = await post({ displayName: 'TestUser', code: 'ABCDE-FGHIJ' });
    assert(res.status !== 422, 'Code 11 chars passes validation', `got ${res.status}`);
  }

  // ═══════════════════════════════════════════════
  // 2. BUSINESS LOGIC TESTS
  // ═══════════════════════════════════════════════
  console.log('\n── 2. Business Logic Tests ──');

  // 2a. Invalid invite code (nonexistent)
  {
    const res = await post({ displayName: uniqueName('Test'), code: 'ZZZZZ-ZZZZZ' });
    const body = await res.json();
    assert(res.status === 400, 'Nonexistent code → 400', `got ${res.status}`);
    assert(body.error === 'Invalid invite code.', 'Error message: Invalid invite code', `got: ${body.error}`);
  }

  // 2b. Happy path — valid invite code
  let validCode: string;
  let createdUserId: string;
  const happyName = uniqueName('Coach');
  const happyDeviceId = '00000000-0000-4000-8000-000000000001';
  try {
    validCode = await createInviteCode();
    console.log(`  (Created invite code: ${validCode})`);

    const res = await post({ displayName: happyName, code: validCode, deviceId: happyDeviceId });
    const body = await res.json();
    assert(res.status === 201, 'Valid code → 201', `got ${res.status}`);
    assert(body.role === 'COACH', 'User role is COACH', `got: ${body.role}`);
    assert(!!body.token, 'JWT token returned', 'no token');
    assert(body.displayName === happyName, 'displayName matches', `got: ${body.displayName}`);
    assert(!!body.userId, 'userId returned', 'no userId');
    createdUserId = body.userId;
  } catch (err: any) {
    console.error('  ❗ Could not create invite code (admin endpoint may be missing):', err.message);
    console.log('  Skipping remaining business logic tests.\n');
    printSummary();
    return;
  }

  // 2c. Reuse same invite code (should fail)
  {
    const res = await post({ displayName: uniqueName('Test'), code: validCode });
    const body = await res.json();
    assert(res.status === 400, 'Reused code → 400', `got ${res.status}`);
    assert(body.error === 'This invite code has already been used.', 'Error: already used', `got: ${body.error}`);
  }

  // 2d. Same username, different device → 409
  {
    const newCode = await createInviteCode();
    const res = await post({
      displayName: happyName,
      code: newCode,
      deviceId: '00000000-0000-4000-8000-999999999999',
    });
    const body = await res.json();
    assert(res.status === 409, 'Same name + different device → 409', `got ${res.status}`);
    assert(body.error === 'Username is already taken.', 'Error: already taken', `got: ${body.error}`);
  }

  // 2e. Same username, NO deviceId in request (existing user has deviceId) → 409
  {
    const newCode = await createInviteCode();
    const res = await post({ displayName: happyName, code: newCode });
    const body = await res.json();
    assert(res.status === 409, 'Same name + no deviceId → 409', `got ${res.status}`);
    assert(body.error === 'Username is already taken.', 'Error: already taken (no device)', `got: ${body.error}`);
  }

  // 2f. Same username, SAME device → should succeed (re-login/promote)
  {
    const newCode = await createInviteCode();
    const res = await post({ displayName: happyName, code: newCode, deviceId: happyDeviceId });
    const body = await res.json();
    assert(res.status === 201, 'Same name + same device → 201', `got ${res.status}`);
    assert(body.userId === createdUserId, 'Same userId returned on re-login', `got: ${body.userId}`);
  }

  // ═══════════════════════════════════════════════
  // 3. SECURITY / INJECTION TESTS
  // ═══════════════════════════════════════════════
  console.log('\n── 3. Security Tests ──');

  // 3a. SQL injection in displayName
  {
    const res = await post({ displayName: "'; DROP TABLE users; --", code: 'ABCDE-FGHIJ' });
    assert(res.status === 422, 'SQL injection in displayName → 422 (blocked by regex)', `got ${res.status}`);
  }

  // 3b. XSS in displayName
  {
    const res = await post({ displayName: '<script>alert(1)</script>', code: 'ABCDE-FGHIJ' });
    assert(res.status === 422, 'XSS in displayName → 422 (blocked by regex)', `got ${res.status}`);
  }

  // 3c. Very long displayName (1000 chars) — should be blocked by length check
  {
    const res = await post({ displayName: 'A'.repeat(1000), code: 'ABCDE-FGHIJ' });
    assert(res.status === 422, '1000 char displayName → 422', `got ${res.status}`);
  }

  // 3d. Code with case sensitivity (should be case-insensitive via toUpperCase)
  {
    const code = await createInviteCode();
    const name = uniqueName('CaseTest');
    const res = await post({ displayName: name, code: code.toLowerCase() });
    const body = await res.json();
    assert(res.status === 201, 'Lowercase code accepted → 201', `got ${res.status}`);
  }

  // 3e. Null values in body
  {
    const res = await post({ displayName: null, code: null });
    assert(res.status === 422, 'Null values → 422', `got ${res.status}`);
  }

  // 3f. Array values instead of strings
  {
    const res = await post({ displayName: ['test'], code: ['ABCDE-FGHIJ'] });
    assert(res.status === 422, 'Array values → 422', `got ${res.status}`);
  }

  // 3g. Numeric values
  {
    const res = await post({ displayName: 12345, code: 12345 });
    assert(res.status === 422, 'Numeric values → 422', `got ${res.status}`);
  }

  // 3h. Unicode / zero-width characters in displayName
  {
    const res = await post({ displayName: 'Test\u200BUser', code: 'ABCDE-FGHIJ' });
    assert(res.status === 422, 'Zero-width char in displayName → 422', `got ${res.status}`);
  }

  // 3i. NoSQL injection-style object in code
  {
    const res = await post({ displayName: 'TestUser', code: { $gt: '' } });
    assert(res.status === 422, 'Object as code → 422', `got ${res.status}`);
  }

  // ═══════════════════════════════════════════════
  // 4. CONTENT-TYPE / PROTOCOL TESTS
  // ═══════════════════════════════════════════════
  console.log('\n── 4. Protocol Tests ──');

  // 4a. Wrong HTTP method (GET)
  {
    const res = await fetch(ENDPOINT, { method: 'GET' });
    assert(res.status === 404 || res.status === 405, 'GET method rejected', `got ${res.status}`);
  }

  // 4b. Wrong content-type (form-urlencoded)
  {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'displayName=Test&code=ABCDE-FGHIJ',
    });
    // 422 is okay here (validation should still work with urlencoded body via express.urlencoded)
    assert(res.status === 422 || res.status === 400 || res.status === 415, 'Form-urlencoded handled', `got ${res.status}`);
    console.log(`    (form-urlencoded status: ${res.status})`);
  }

  // 4c. No content-type header with body
  {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Test', code: 'ABCDE-FGHIJ' }),
    });
    // Without content-type, body may not be parsed → should get 422 or error
    assert(res.status >= 400, 'No content-type → error status', `got ${res.status}`);
  }

  // 4d. Empty POST body
  {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });
    assert(res.status >= 400, 'Empty body string → error', `got ${res.status}`);
  }

  // 4e. Malformed JSON
  {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"displayName": "Test", code:}',
    });
    assert(res.status === 400 || res.status === 422, 'Malformed JSON → 400/422', `got ${res.status}`);
  }

  // ═══════════════════════════════════════════════
  // 5. RACE CONDITIONS
  // ═══════════════════════════════════════════════
  console.log('\n── 5. Race Condition Tests ──');

  // 5a. Two requests with same code simultaneously
  {
    const code = await createInviteCode();
    const name1 = uniqueName('Race1');
    const name2 = uniqueName('Race2');
    const [r1, r2] = await Promise.all([
      post({ displayName: name1, code }),
      post({ displayName: name2, code }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    // Ideally: one 201 + one 400 (code already used)
    // But due to race condition, both might succeed → that's a bug
    const oneSuccess = statuses.includes(201);
    const oneFail = statuses.includes(400);
    console.log(`    Race condition statuses: ${r1.status}, ${r2.status}`);
    if (statuses[0] === 201 && statuses[1] === 201) {
      assert(false, 'Race: same code used twice (BOTH 201 — BUG!)', 'both requests succeeded');
    } else {
      assert(oneSuccess && oneFail, 'Race: one 201 + one 400', `got ${statuses.join(', ')}`);
    }
  }

  // ═══════════════════════════════════════════════
  // 6. EDGE CASE — displayName with allowed special chars
  // ═══════════════════════════════════════════════
  console.log('\n── 6. Boundary / Misc Tests ──');

  // 6a. displayName with hyphens, underscores, spaces (all allowed by regex)
  {
    const code = await createInviteCode();
    const name = `Test-User_${Date.now().toString(36).slice(-4)}`;
    const res = await post({ displayName: name, code });
    assert(res.status === 201, 'Hyphens/underscores in name → 201', `got ${res.status}`);
  }

  // 6b. displayName with leading/trailing spaces (trim should handle)
  {
    const code = await createInviteCode();
    const baseName = uniqueName('Trim');
    const res = await post({ displayName: `  ${baseName}  `, code });
    const body = await res.json();
    if (res.status === 201) {
      assert(body.displayName === baseName, 'Leading/trailing spaces trimmed', `got: "${body.displayName}"`);
    } else {
      assert(false, 'Leading/trailing spaces → should succeed after trim', `got ${res.status}`);
    }
  }

  // 6c. Code with leading/trailing spaces (trim should handle)
  {
    const code = await createInviteCode();
    const name = uniqueName('TrimCode');
    const res = await post({ displayName: name, code: `  ${code}  ` });
    const body = await res.json();
    // If trim works, this should succeed; if not, it'll fail validation (13 chars)
    console.log(`    Padded code status: ${res.status}`);
    if (res.status === 422) {
      assert(false, 'Code with spaces fails validation (trim not removing padding)', `422 — code length mismatch after trim`);
    } else {
      assert(res.status === 201, 'Code with spaces → 201 (trimmed)', `got ${res.status}`);
    }
  }

  // 6d. Creating user without deviceId (allowed)
  {
    const code = await createInviteCode();
    const name = uniqueName('NoDevice');
    const res = await post({ displayName: name, code });
    const body = await res.json();
    assert(res.status === 201, 'No deviceId → 201', `got ${res.status}`);
    assert(body.role === 'COACH', 'Role is COACH without deviceId', `got: ${body.role}`);
  }

  // 6e. Existing USER tries to become COACH
  // First create a regular user via the user endpoint
  {
    const userName = uniqueName('RegUser');
    const deviceId = '00000000-0000-4000-8000-000000000002';
    // Create a regular user first
    const userRes = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: userName, deviceId }),
    });
    if (userRes.ok) {
      const code = await createInviteCode();
      const res = await post({ displayName: userName, code, deviceId });
      const body = await res.json();
      assert(res.status === 201, 'Existing USER redeems invite → 201', `got ${res.status}`);
      // Check if role was promoted to COACH
      // The upsert uses `update: { lastActiveAt }` — does NOT update role!
      console.log(`    Existing user role after redeem: ${body.role}`);
      if (body.role !== 'COACH') {
        assert(false, 'Existing USER should be promoted to COACH', `role is still: ${body.role}`);
      } else {
        assert(true, 'Existing USER promoted to COACH');
      }
    } else {
      console.log(`    (Skipping: could not create regular user — ${userRes.status})`);
    }
  }

  // ═══════════════════════════════════════════════
  printSummary();
}

function printSummary() {
  console.log('\n════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${testNum} total`);
  if (failures.length) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log(f));
  }
  console.log('════════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
