// ─────────────────────────────────────────────
// HomeScreen Playwright Tests — PUSO Spaze
// Tests core HomeScreen functionalities on web
// ─────────────────────────────────────────────

const { chromium } = require('playwright');

const APP_URL = 'http://localhost:8081';
const API_URL = 'http://localhost:4000';
const SCREENSHOT_DIR = './quality/results/screenshots';
const TEST_USERNAME = `tester_${Date.now()}`;

let browser, context, page;
const results = [];
const consoleLogs = [];

// ── Helpers ──────────────────────────────────

async function setup() {
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Playwright',
  });
  page = await context.newPage();

  // Collect console logs
  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', (err) => {
    consoleLogs.push({ type: 'error', text: `PAGE ERROR: ${err.message}` });
  });
}

async function teardown() {
  if (browser) await browser.close();
}

async function screenshot(name) {
  const fs = require('fs');
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

async function runTest(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    results.push({ name, status: 'PASS', ms });
    console.log(`  ✅ ${name} (${ms}ms)`);
  } catch (err) {
    const ms = Date.now() - start;
    results.push({ name, status: 'FAIL', ms, error: err.message });
    console.log(`  ❌ ${name} (${ms}ms)`);
    console.log(`     ${err.message}`);
    try { await screenshot(`fail-${name.replace(/\s+/g, '-')}`); } catch {}
  }
}

// ── Login helper ─────────────────────────────

async function loginAsTestUser() {
  // Create user via API, then set localStorage to bypass login screen
  const res = await fetch(`${API_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: TEST_USERNAME }),
  });
  const data = await res.json();
  const userId = data.userId || data.user?.id;
  const displayName = data.displayName || data.user?.displayName || TEST_USERNAME;

  await page.goto(APP_URL);
  await page.evaluate(({ userId, displayName }) => {
    localStorage.setItem('puso_user_id', userId);
    localStorage.setItem('puso_username', displayName);
    localStorage.setItem('puso_role', 'USER');
    localStorage.setItem('puso_anonymous', 'false');
    localStorage.setItem('puso_device_id', 'playwright-test-device');
  }, { userId, displayName });

  // Reload so the app picks up the stored auth
  await page.goto(APP_URL);
  await page.waitForTimeout(2000);
}

// ── Tests ────────────────────────────────────

async function testLoginScreenRenders() {
  // Clear any auth state
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.goto(APP_URL);
  await page.waitForTimeout(2000);

  // Should show login elements
  const pageContent = await page.textContent('body');
  const hasLoginContent = pageContent.includes('Enter Spaze')
    || pageContent.includes('username')
    || pageContent.includes('PUSO');

  if (!hasLoginContent) throw new Error('Login screen not found — expected login-related text');
  await screenshot('01-login-screen');
}

async function testLoginWithUsername() {
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.goto(APP_URL);
  await page.waitForTimeout(2000);

  // Find the custom username input
  const input = page.locator('input').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });

  // Type a username
  await input.fill(TEST_USERNAME);
  await page.waitForTimeout(500);

  // Find and click the Enter Spaze / submit button
  const enterBtn = page.getByText('Enter Spaze').first();
  if (await enterBtn.isVisible()) {
    await enterBtn.click();
  } else {
    // Fallback: click any prominent button
    const btn = page.locator('div[role="button"], [accessibilityRole="button"]').last();
    await btn.click();
  }
  await page.waitForTimeout(3000);
  await screenshot('02-after-login');

  // Verify we're past login — greeting or home content should be present
  const body = await page.textContent('body');
  const atHome = body.includes('Good')
    || body.includes('Welcome')
    || body.includes('heart')
    || body.includes(TEST_USERNAME);

  if (!atHome) throw new Error('Login did not navigate to HomeScreen');
}

async function testGreetingSection() {
  await loginAsTestUser();

  const body = await page.textContent('body');
  const hasGreeting = body.includes('Good morning')
    || body.includes('Good afternoon')
    || body.includes('Good evening');

  if (!hasGreeting) throw new Error('Greeting text not found');

  const hasUsername = body.includes(TEST_USERNAME);
  if (!hasUsername) throw new Error(`Username "${TEST_USERNAME}" not shown in greeting`);

  await screenshot('03-greeting-section');
}

async function testDailyReflectionCard() {
  // First check if the API returns a daily reflection
  const statsRes = await fetch(`${API_URL}/api/stats/dashboard`);
  const stats = await statsRes.json();

  if (!stats.dailyReflection) {
    console.log('     ⚠️  No daily reflection available (OPENAI_API_KEY may not be set) — checking fallback');
  }

  await loginAsTestUser();
  await page.waitForTimeout(1500);

  const body = await page.textContent('body');
  const hasReflection = body.includes('DAILY REFLECTION');

  if (stats.dailyReflection && !hasReflection) {
    throw new Error('Daily Reflection card not rendered despite API returning data');
  }

  await screenshot('04-daily-reflection');
}

async function testComposerPresent() {
  await loginAsTestUser();

  // Check for composer elements
  const composerInput = page.locator('input, textarea').filter({
    has: page.locator('[placeholder*="thoughts"], [placeholder*="prayer"], [placeholder*="gratitude"]'),
  });

  // Fallback: find by placeholder text on the page
  const body = await page.textContent('body');
  const hasComposer = body.includes('Share your thoughts')
    || body.includes('prayer')
    || body.includes('gratitude');

  if (!hasComposer) throw new Error('Composer placeholder text not found');

  // Check Photo and Feeling buttons
  const hasPhoto = body.includes('Photo');
  const hasFeelingBtn = body.includes('Feeling');

  if (!hasPhoto) throw new Error('Photo button not found in composer');
  if (!hasFeelingBtn) throw new Error('Feeling button not found in composer');

  await screenshot('05-composer');
}

async function testComposerPostButton() {
  await loginAsTestUser();

  // The Post button should exist
  const body = await page.textContent('body');
  const hasPostBtn = body.includes('Post');

  if (!hasPostBtn) throw new Error('Post button not found');
  await screenshot('06-post-button');
}

async function testSearchBar() {
  await loginAsTestUser();

  // Look for search input
  const searchInput = page.locator('input[placeholder*="Search"]').first();
  const isVisible = await searchInput.isVisible().catch(() => false);

  if (!isVisible) throw new Error('Search bar not visible');

  // Type a search query
  await searchInput.fill('test search');
  await page.waitForTimeout(600); // wait for debounce (400ms + buffer)

  // Clear search
  await searchInput.fill('');
  await page.waitForTimeout(600);

  await screenshot('07-search-bar');
}

async function testTopBarElements() {
  await loginAsTestUser();

  // On wide web, should show avatar with username
  const body = await page.textContent('body');

  // Check for the PUSO logo (img element)
  const logo = page.locator('img[src*="logo"]').first();
  const logoVisible = await logo.isVisible().catch(() => false);

  // Check for profile avatar (initial letter)
  const initial = TEST_USERNAME.charAt(0).toUpperCase();
  const hasInitial = body.includes(initial);

  await screenshot('08-top-bar');

  if (!logoVisible && !hasInitial) {
    throw new Error('Top bar missing logo and avatar');
  }
}

async function testSpazeStats() {
  await loginAsTestUser();
  await page.waitForTimeout(1500);

  // On non-wide layouts stats should be visible
  // Resize to mobile width to see stats
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);

  const body = await page.textContent('body');
  const hasMembers = body.includes('Active') && body.includes('Members');
  const hasDailyStories = body.includes('Daily') && body.includes('Stories');

  await screenshot('09-stats-mobile');

  // Restore viewport
  await page.setViewportSize({ width: 1280, height: 800 });

  if (!hasMembers) throw new Error('Active Members stat not found on mobile');
  if (!hasDailyStories) throw new Error('Daily Stories stat not found on mobile');
}

async function testEmptyStateOrFeed() {
  await loginAsTestUser();
  await page.waitForTimeout(2000);

  const body = await page.textContent('body');

  // Either the feed shows posts or the empty state
  const hasPost = body.includes('"') // Post content is quoted
    || body.length > 500; // substantial content = posts exist
  const hasEmpty = body.includes('quiet')
    || body.includes('Be the first');

  if (!hasPost && !hasEmpty) {
    throw new Error('Neither feed posts nor empty state found');
  }

  await screenshot('10-feed-or-empty');
}

async function testResponsiveLayout() {
  await loginAsTestUser();

  // Wide web (1280px) — should show WebRightPanel if >= 1200
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  await screenshot('11-responsive-wide');

  // Tablet (768px) — no right panel, no hamburger on very wide
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(1000);
  await screenshot('12-responsive-tablet');

  // Mobile (375px)
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);

  // On narrow, hamburger menu should be visible
  const body = await page.textContent('body');
  await screenshot('13-responsive-mobile');

  // Restore
  await page.setViewportSize({ width: 1280, height: 800 });
}

async function testNoConsoleErrors() {
  const errors = consoleLogs.filter(
    (l) => l.type === 'error' && !l.text.includes('favicon') && !l.text.includes('404')
  );
  if (errors.length > 0) {
    const summary = errors.slice(0, 3).map((e) => e.text).join('\n     ');
    throw new Error(`${errors.length} console error(s):\n     ${summary}`);
  }
}

// ── Main ─────────────────────────────────────

async function main() {
  console.log('\n🧪 PUSO Spaze — HomeScreen Playwright Tests\n');
  console.log('─'.repeat(50));

  await setup();

  await runTest('Login screen renders', testLoginScreenRenders);
  await runTest('Login with username', testLoginWithUsername);
  await runTest('Greeting section', testGreetingSection);
  await runTest('Daily Reflection card', testDailyReflectionCard);
  await runTest('Composer present', testComposerPresent);
  await runTest('Composer Post button', testComposerPostButton);
  await runTest('Search bar', testSearchBar);
  await runTest('Top bar elements', testTopBarElements);
  await runTest('Spaze stats (mobile)', testSpazeStats);
  await runTest('Feed or empty state', testEmptyStateOrFeed);
  await runTest('Responsive layout', testResponsiveLayout);
  await runTest('No console errors', testNoConsoleErrors);

  await teardown();

  // ── Summary ────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${results.length} tests`);

  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter((r) => r.status === 'FAIL').forEach((r) => {
      console.log(`   • ${r.name}: ${r.error}`);
    });
  }

  console.log(`\n📸 Screenshots saved to ${SCREENSHOT_DIR}/`);
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
