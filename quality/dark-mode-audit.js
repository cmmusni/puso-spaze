const { chromium } = require('playwright');
const DIR = 'quality/results/screenshots/dark-mode';
require('fs').mkdirSync(DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:8081', { waitUntil: 'load', timeout: 20000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(5000);

  // Anonymous login
  await page.getByText('Enter Spaze').click({ timeout: 5000 });
  await page.waitForTimeout(5000);
  console.log('Logged in');

  // Go to Profile and toggle dark mode
  await page.locator('text="Profile"').first().click({ force: true, timeout: 5000 });
  await page.waitForTimeout(2000);

  const sw = page.locator('[role="switch"]');
  const n = await sw.count();
  if (n >= 3) {
    await sw.nth(n - 1).click({ force: true });
    await page.waitForTimeout(2000);
    console.log('Dark mode ON');
  }
  await page.screenshot({ path: DIR + '/fixed-01-profile.png', fullPage: true });

  // Feed
  await page.locator('text="Feed"').first().click({ force: true, timeout: 5000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: DIR + '/fixed-02-home.png', fullPage: true });
  console.log('Home done');

  // Journal
  await page.locator('text="Journal"').first().click({ force: true, timeout: 5000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: DIR + '/fixed-03-journal.png', fullPage: true });
  console.log('Journal done');

  // Notifications  
  await page.locator('text="Notifications"').first().click({ force: true, timeout: 5000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: DIR + '/fixed-04-notifications.png', fullPage: true });
  console.log('Notifications done');

  // Spaze Coach
  await page.locator('text="Spaze Coach"').first().click({ force: true, timeout: 5000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: DIR + '/fixed-05-coach.png', fullPage: true });
  console.log('Coach done');

  console.log('ALL DONE');
  await browser.close();
  process.exit(0);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
