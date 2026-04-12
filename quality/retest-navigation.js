// ─────────────────────────────────────────────
// Retest: Basic Navigation + Form Interaction
// ─────────────────────────────────────────────

const { chromium } = require('playwright');

const APP_URL = 'http://localhost:8081';
const API_URL = 'http://localhost:4000';
const SCREENSHOT_DIR = './quality/results/screenshots';
const TEST_USERNAME = `tester_${Date.now()}`;

const fs = require('fs');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function main() {
  console.log('\n🧪 Retest: Basic Navigation + Form Interaction\n');
  console.log('─'.repeat(50));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Collect console errors
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  // ── Test 1: Basic Navigation ──────────────
  console.log('\n📋 Test 1: Basic Navigation');

  try {
    // Clear state
    await page.goto(APP_URL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(APP_URL);
    await page.waitForTimeout(3000);

    // Capture what we see
    await page.screenshot({ path: `${SCREENSHOT_DIR}/retest-01-initial-load.png`, fullPage: true });

    const pageContent = await page.textContent('body');

    // Check for login screen elements
    const checks = {
      'PUSO branding': pageContent.includes('PUSO') || pageContent.includes('Spaze'),
      'Enter Spaze button': pageContent.includes('Enter Spaze'),
      'Identity section': pageContent.includes('IDENTITY') || pageContent.includes('username') || pageContent.includes('Anonymous'),
    };

    for (const [check, passed] of Object.entries(checks)) {
      console.log(`  ${passed ? '✅' : '❌'} ${check}`);
    }

    // Check for any CORS / network errors
    const corsErrors = errors.filter((e) => e.includes('CORS') || e.includes('api.puso-spaze'));
    if (corsErrors.length > 0) {
      console.log(`  ⚠️  ${corsErrors.length} CORS error(s) — app is hitting production API`);
      console.log(`     First: ${corsErrors[0].slice(0, 120)}`);
    } else {
      console.log('  ✅ No CORS errors');
    }

    const allPassed = Object.values(checks).every(Boolean);
    console.log(`\n  Result: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/retest-01-error.png`, fullPage: true });
  }

  // ── Test 2: Form Interaction (Login) ──────
  console.log('\n📋 Test 2: Form Interaction — Login with Username');

  errors.length = 0; // reset errors

  try {
    // Clear state fresh
    await page.goto(APP_URL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(APP_URL);
    await page.waitForTimeout(3000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/retest-02a-before-login.png`, fullPage: true });

    // Find and fill the username input
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    console.log(`  Found ${inputCount} input(s)`);

    // Find the custom username input (usually has placeholder with "username")
    let usernameInput = null;
    for (let i = 0; i < inputCount; i++) {
      const placeholder = await inputs.nth(i).getAttribute('placeholder') ?? '';
      const value = await inputs.nth(i).inputValue() ?? '';
      console.log(`  Input ${i}: placeholder="${placeholder}" value="${value}"`);
      if (placeholder.toLowerCase().includes('username') || placeholder.toLowerCase().includes('custom')) {
        usernameInput = inputs.nth(i);
      }
    }

    if (!usernameInput) {
      // Fallback — just use the first visible input
      usernameInput = inputs.first();
      console.log('  ⚠️  No username-specific input found, using first input');
    }

    // Fill username
    await usernameInput.fill(TEST_USERNAME);
    await page.waitForTimeout(500);
    console.log(`  ✅ Filled username: "${TEST_USERNAME}"`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/retest-02b-username-filled.png`, fullPage: true });

    // Click "Enter Spaze"
    const enterBtn = page.getByText('Enter Spaze');
    const btnVisible = await enterBtn.isVisible().catch(() => false);
    console.log(`  Enter Spaze button visible: ${btnVisible}`);

    if (btnVisible) {
      await enterBtn.click();
      console.log('  ✅ Clicked "Enter Spaze"');
    } else {
      // Try any touchable / button element
      const allButtons = page.locator('[role="button"]');
      const btnCount = await allButtons.count();
      console.log(`  ⚠️  Trying role="button" elements (${btnCount} found)`);
      if (btnCount > 0) {
        await allButtons.last().click();
      }
    }

    // Wait for navigation
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/retest-02c-after-login.png`, fullPage: true });

    // Check if we made it to the HomeScreen
    const body = await page.textContent('body');
    const loginSuccess = body.includes('Good morning') || body.includes('Good afternoon') || body.includes('Good evening');
    const hasWelcome = body.includes('Welcome to your safe space');
    const hasUsername = body.includes(TEST_USERNAME);
    const stillOnLogin = body.includes('Enter Spaze');
    const hasError = body.includes('Login Failed') || body.includes('Network Error');

    console.log(`\n  Post-login checks:`);
    console.log(`  ${loginSuccess ? '✅' : '❌'} Greeting visible: ${loginSuccess}`);
    console.log(`  ${hasWelcome ? '✅' : '—'} Welcome message: ${hasWelcome}`);
    console.log(`  ${hasUsername ? '✅' : '—'} Username shown: ${hasUsername}`);
    console.log(`  ${!stillOnLogin ? '✅' : '❌'} Left login screen: ${!stillOnLogin}`);
    console.log(`  ${!hasError ? '✅' : '❌'} No error modal: ${!hasError}`);

    // Check for CORS errors
    const corsErrors = errors.filter((e) => e.includes('CORS') || e.includes('api.puso-spaze'));
    const networkErrors = errors.filter((e) => e.includes('Network Error') || e.includes('ERR_FAILED'));
    if (corsErrors.length > 0) {
      console.log(`  ⚠️  ${corsErrors.length} CORS error(s)`);
    }
    if (networkErrors.length > 0) {
      console.log(`  ⚠️  ${networkErrors.length} network error(s)`);
    }

    const passed = loginSuccess && !hasError;
    console.log(`\n  Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);

    if (!passed) {
      console.log('\n  Diagnostics:');
      // Check what API URL the app is using
      const apiUrl = await page.evaluate(() => {
        // Try to read from the global config
        try {
          const keys = Object.keys(localStorage);
          return { localStorage: Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])) };
        } catch { return {}; }
      });
      console.log(`  localStorage:`, JSON.stringify(apiUrl, null, 2).split('\n').map(l => '    ' + l).join('\n'));

      if (errors.length > 0) {
        console.log(`  First 3 console errors:`);
        errors.slice(0, 3).forEach((e) => console.log(`    • ${e.slice(0, 150)}`));
      }
    }
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/retest-02-error.png`, fullPage: true });
  }

  await browser.close();
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📸 Screenshots saved to ${SCREENSHOT_DIR}/\n`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
