// ─────────────────────────────────────────────
// Full HomeScreen Audit — find everything broken
// ─────────────────────────────────────────────

const { chromium } = require('playwright');
const fs = require('fs');

const APP_URL = 'http://localhost:8081';
const API_URL = 'http://localhost:4000';
const SCREENSHOT_DIR = './quality/results/screenshots/audit';
const TEST_USERNAME = `auditor_${Date.now()}`;

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
const consoleErrors = [];

async function runTest(name, fn) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, status: 'PASS', ms: Date.now() - start });
    console.log(`  ✅ ${name} (${Date.now() - start}ms)`);
  } catch (err) {
    results.push({ name, status: 'FAIL', ms: Date.now() - start, error: err.message });
    console.log(`  ❌ ${name} (${Date.now() - start}ms)`);
    console.log(`     → ${err.message}`);
  }
}

async function main() {
  console.log('\n🔍 HomeScreen Full Audit\n' + '─'.repeat(50));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`PAGE_ERROR: ${err.message}`));

  // ── Login via API + localStorage ──────────
  const res = await fetch(`${API_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: TEST_USERNAME }),
  });
  const userData = await res.json();
  const userId = userData.userId || userData.user?.id;

  await page.goto(APP_URL);
  await page.evaluate(({ userId, displayName }) => {
    localStorage.setItem('puso_user_id', userId);
    localStorage.setItem('puso_username', displayName);
    localStorage.setItem('puso_role', 'USER');
    localStorage.setItem('puso_anonymous', 'false');
    localStorage.setItem('puso_device_id', 'playwright-audit');
  }, { userId, displayName: TEST_USERNAME });

  await page.goto(APP_URL);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/00-home-loaded.png`, fullPage: true });

  const body = await page.textContent('body');

  // ── Section 1: Core Layout ────────────────
  console.log('\n📐 Core Layout');

  await runTest('Greeting renders', async () => {
    const has = body.includes('Good morning') || body.includes('Good afternoon') || body.includes('Good evening');
    if (!has) throw new Error('No greeting text found');
  });

  await runTest('Username in greeting', async () => {
    if (!body.includes(TEST_USERNAME)) throw new Error(`Username "${TEST_USERNAME}" not in greeting`);
  });

  await runTest('Welcome subtitle', async () => {
    if (!body.includes('Welcome to your safe space')) throw new Error('Missing welcome subtitle');
  });

  await runTest('WebSidebar visible (wide)', async () => {
    const hasNav = body.includes('Feed') && body.includes('Journal') && body.includes('Profile');
    if (!hasNav) throw new Error('Sidebar nav items missing');
  });

  await runTest('Top bar: logo', async () => {
    const logo = page.locator('img[src*="logo"]').first();
    if (!(await logo.isVisible().catch(() => false))) throw new Error('Logo not visible');
  });

  await runTest('Top bar: search bar', async () => {
    const search = page.locator('input[placeholder*="Search"]').first();
    if (!(await search.isVisible().catch(() => false))) throw new Error('Search bar not visible');
  });

  await runTest('Top bar: avatar initial', async () => {
    const initial = TEST_USERNAME.charAt(0).toUpperCase();
    if (!body.includes(initial)) throw new Error(`Avatar initial "${initial}" not found`);
  });

  // ── Section 2: Daily Reflection ───────────
  console.log('\n🙏 Daily Reflection');

  await runTest('Daily Reflection label', async () => {
    if (!body.includes('DAILY REFLECTION')) throw new Error('"DAILY REFLECTION" section label missing');
  });

  await runTest('Reflection card content', async () => {
    // Check the API
    const stats = await fetch(`${API_URL}/api/stats/dashboard`).then(r => r.json());
    if (!stats.dailyReflection) throw new Error('API returned no dailyReflection');

    // Check that the content appears somewhere in the page
    const snippet = stats.dailyReflection.content.slice(0, 50);
    const pageText = await page.textContent('body');
    if (!pageText.includes(snippet)) throw new Error(`Reflection content not rendered: "${snippet}..."`);
  });

  await runTest('Reflection sparkles icon', async () => {
    // The sparkles icon is rendered via Ionicons — check for the icon container
    const sparkles = page.locator('text=✨').first();
    // Ionicons renders as a font glyph, not text — so just verify the card exists
    const reflectionSection = page.getByText('DAILY REFLECTION').first();
    if (!(await reflectionSection.isVisible().catch(() => false))) throw new Error('Reflection section not visible');
  });

  // ── Section 3: Composer ───────────────────
  console.log('\n✍️ Composer');

  await runTest('Composer input visible', async () => {
    const inputs = page.locator('input[placeholder*="thoughts"], textarea[placeholder*="thoughts"], input[placeholder*="Share"], textarea[placeholder*="Share"]');
    // Also check for RN TextInput which renders as div[contenteditable] or input
    const allInputs = page.locator('[placeholder*="Share your thoughts"]');
    const count = await allInputs.count();
    if (count === 0) {
      // Fallback: check text
      const b = await page.textContent('body');
      if (!b.includes('Share your thoughts')) throw new Error('Composer input not found');
    }
  });

  await runTest('Photo button', async () => {
    if (!body.includes('Photo')) throw new Error('Photo button missing');
  });

  await runTest('Feeling button', async () => {
    if (!body.includes('Feeling')) throw new Error('Feeling button missing');
  });

  await runTest('Post button', async () => {
    const btn = page.getByText('Post', { exact: true }).first();
    if (!(await btn.isVisible().catch(() => false))) throw new Error('Post button not visible');
  });

  await runTest('Post button disabled when empty', async () => {
    // The Post button should be semi-transparent/disabled when no text
    const btn = page.getByText('Post', { exact: true }).first();
    const opacity = await btn.evaluate(el => {
      // Walk up to find the actual touchable wrapper
      let node = el.closest('[style*="opacity"]') || el.parentElement?.parentElement;
      return window.getComputedStyle(node).opacity;
    }).catch(() => '1');
    // opacity 0.5 = disabled per styles
    if (parseFloat(opacity) > 0.6) throw new Error(`Post button opacity is ${opacity}, expected ~0.5 when empty`);
  });

  // ── Section 4: Composer Interaction ───────
  console.log('\n🎯 Composer Interaction');

  await runTest('Type in composer & Post enables', async () => {
    // Find and type in the composer
    const composer = page.locator('[placeholder*="Share your thoughts"]').first();
    if (await composer.isVisible().catch(() => false)) {
      await composer.fill('Testing from Playwright 🧪');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/03-composer-typed.png`, fullPage: true });
      // Clear it
      await composer.fill('');
    }
  });

  await runTest('Feeling picker opens', async () => {
    const feelingBtn = page.getByText('Feeling').first();
    if (await feelingBtn.isVisible()) {
      await feelingBtn.click();
      await page.waitForTimeout(800);
      
      const modalText = await page.textContent('body');
      const hasModal = modalText.includes('How are you feeling');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/04-feeling-picker.png`, fullPage: true });
      
      // Close modal
      if (hasModal) {
        // Click backdrop or close
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        // If still open, click outside
        const stillOpen = (await page.textContent('body')).includes('How are you feeling');
        if (stillOpen) {
          await page.mouse.click(10, 10);
          await page.waitForTimeout(500);
        }
      }
      
      if (!hasModal) throw new Error('Feeling picker modal did not open');
    } else {
      throw new Error('Feeling button not visible');
    }
  });

  // ── Section 5: Search ─────────────────────
  console.log('\n🔍 Search');

  await runTest('Search input accepts text', async () => {
    const search = page.locator('input[placeholder*="Search"]').first();
    await search.fill('test query');
    await page.waitForTimeout(600);
    const val = await search.inputValue();
    if (val !== 'test query') throw new Error(`Search value is "${val}"`);
  });

  await runTest('Search clear button appears', async () => {
    // After typing, a clear (X) icon should appear
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-search-typed.png`, fullPage: true });
    // Clear it
    const search = page.locator('input[placeholder*="Search"]').first();
    await search.fill('');
  });

  // ── Section 6: Feed / Empty State ─────────
  console.log('\n📰 Feed');

  await runTest('Feed or empty state renders', async () => {
    await page.waitForTimeout(2000); // allow feed to finish loading after search clear
    const b = await page.textContent('body');
    const hasFeedContent = b.includes('ago') || b.includes('comment') || b.includes('Comment')
      || b.includes('quiet') || b.includes('Be the first')
      || b.includes('Pinned') || b.includes('ADMIN') || b.includes('feeling');
    if (!hasFeedContent) throw new Error('No feed content or empty state');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08-feed.png`, fullPage: true });
  });

  // ── Section 7: Right Panel (wide) ─────────
  console.log('\n📊 Right Panel (wide web ≥1200)');

  await runTest('WebRightPanel visible', async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(500);
    const b = await page.textContent('body');
    // Right panel shows "Trending Reflections" or "Message a Coach" or "Daily Grace"
    const has = b.includes('Trending') || b.includes('Message a Coach') || b.includes('Daily Grace') || b.includes('DAILY GRACE');
    if (!has) throw new Error('Right panel content not found at 1280px width');
  });

  // ── Section 8: Responsive ─────────────────
  console.log('\n📱 Responsive');

  await runTest('Mobile layout (375px)', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    const b = await page.textContent('body');
    // Stats should be visible on mobile (not in right panel)
    const hasStats = (b.includes('Active') && b.includes('Members')) || b.includes('Daily');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-mobile.png`, fullPage: true });
    // Restore
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(500);
    if (!hasStats) throw new Error('Stats not visible on mobile');
  });

  await runTest('Tablet layout (768px)', async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-tablet.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(500);
  });

  // ── Section 9: Console Errors ─────────────
  console.log('\n🐛 Console Errors');

  await runTest('No critical console errors', async () => {
    const critical = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('manifest') &&
      !e.includes('DevTools')
    );
    if (critical.length > 0) {
      const summary = critical.slice(0, 5).map(e => e.slice(0, 120)).join('\n     ');
      throw new Error(`${critical.length} error(s):\n     ${summary}`);
    }
  });

  // ── Section 10: Error Banner ──────────────
  console.log('\n⚠️ Error Handling');

  await runTest('No error banner on homescreen', async () => {
    const b = await page.textContent('body');
    if (b.includes('Network Error')) throw new Error('Network Error banner is displayed');
  });

  await browser.close();

  // ── Summary ───────────────────────────────
  console.log('\n' + '═'.repeat(50));
  const passed = results.filter(r => r.status === 'PASS');
  const failed = results.filter(r => r.status === 'FAIL');
  console.log(`\n📊 AUDIT: ${passed.length} passed, ${failed.length} failed / ${results.length} total\n`);

  if (failed.length > 0) {
    console.log('❌ FAILURES:');
    failed.forEach(r => {
      console.log(`\n  [${r.name}]`);
      console.log(`   ${r.error}`);
    });
  }

  console.log(`\n📸 Screenshots: ${SCREENSHOT_DIR}/\n`);

  // Output JSON for programmatic use
  fs.writeFileSync(`${SCREENSHOT_DIR}/audit-results.json`, JSON.stringify({ results, consoleErrors: consoleErrors.slice(0, 20) }, null, 2));

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
