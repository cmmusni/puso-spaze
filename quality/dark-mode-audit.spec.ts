/**
 * Dark Mode Visibility Audit
 * 
 * Navigates through all accessible screens in dark mode,
 * captures screenshots, and checks text contrast.
 */
import { test, expect, type Page } from '@playwright/test';

const APP_URL = 'http://localhost:8081';

async function login(page: Page) {
  await page.goto(APP_URL);
  await page.waitForTimeout(3000);
  const input = page.getByPlaceholder(/enter a custom username/i);
  await input.fill(`DarkTester_${Date.now()}`);
  const btn = page.getByText('Enter Spaze');
  await btn.click();
  await page.waitForTimeout(4000);
}

async function enableDarkMode(page: Page) {
  // Navigate to Profile to toggle dark mode
  // On web, look for Profile/Settings in navigation
  const profileLink = page.locator('text=/Profile/i').first();
  if (await profileLink.count() > 0) {
    await profileLink.click();
    await page.waitForTimeout(2000);
  }

  // Look for dark mode toggle
  const toggle = page.locator('[role="switch"]').first();
  if (await toggle.count() > 0) {
    // Check toggle state — only click if currently off
    await toggle.click();
    await page.waitForTimeout(1500);
  } else {
    // Try finding "Dark Mode" text and clicking near it
    const darkLabel = page.locator('text=/Dark Mode|Dark mode/i').first();
    if (await darkLabel.count() > 0) {
      await darkLabel.click();
      await page.waitForTimeout(1500);
    }
  }
}

/**
 * Check element colors for low contrast issues.
 * Returns elements where text color is too close to background.
 */
async function findLowContrastElements(page: Page): Promise<{ selector: string; text: string; color: string; bg: string }[]> {
  return page.evaluate(() => {
    const results: { selector: string; text: string; color: string; bg: string }[] = [];
    const textElements = document.querySelectorAll('div, span, p, h1, h2, h3, h4, h5, h6, label, a, button');
    
    function getEffectiveBg(el: Element): string {
      let current: Element | null = el;
      while (current) {
        const style = window.getComputedStyle(current);
        const bg = style.backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          return bg;
        }
        current = current.parentElement;
      }
      return 'rgb(255, 255, 255)';
    }

    function parseRgb(color: string): [number, number, number] | null {
      const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return null;
      return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
    }

    function luminance(r: number, g: number, b: number): number {
      const [rs, gs, bs] = [r, g, b].map(c => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    function contrastRatio(c1: [number, number, number], c2: [number, number, number]): number {
      const l1 = luminance(...c1);
      const l2 = luminance(...c2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    textElements.forEach((el, i) => {
      const text = (el as HTMLElement).innerText?.trim();
      if (!text || text.length > 100 || text.length < 1) return;
      // Skip hidden elements
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const style = window.getComputedStyle(el);
      const color = style.color;
      const bg = getEffectiveBg(el);

      const fgRgb = parseRgb(color);
      const bgRgb = parseRgb(bg);
      if (!fgRgb || !bgRgb) return;

      const ratio = contrastRatio(fgRgb, bgRgb);
      // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
      if (ratio < 3) {
        results.push({
          selector: `${el.tagName.toLowerCase()}[${i}]`,
          text: text.slice(0, 60),
          color,
          bg,
        });
      }
    });

    return results.slice(0, 30); // Limit output
  });
}

const SCREENSHOT_DIR = 'quality/results/screenshots/dark-mode';

test.describe('Dark Mode Visibility Audit', () => {
  test.beforeAll(async () => {
    const fs = await import('fs');
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('Audit all screens in dark mode', async ({ page }) => {
    // 1. Login
    await login(page);
    console.log('[DM] Logged in');

    // 2. Enable dark mode from Profile
    await enableDarkMode(page);
    console.log('[DM] Dark mode toggled');

    // Take profile screenshot first (we're already on Profile)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-profile.png`, fullPage: true });

    // Check contrast on Profile
    const profileIssues = await findLowContrastElements(page);
    console.log(`[DM] Profile: ${profileIssues.length} low-contrast elements`);
    profileIssues.forEach(i => console.log(`  ⚠ "${i.text}" — fg:${i.color} bg:${i.bg}`));

    // 3. Navigate to Home
    const homeLink = page.locator('text=/Home/i').first();
    if (await homeLink.count() > 0) {
      await homeLink.click();
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-home.png`, fullPage: true });
    const homeIssues = await findLowContrastElements(page);
    console.log(`[DM] Home: ${homeIssues.length} low-contrast elements`);
    homeIssues.forEach(i => console.log(`  ⚠ "${i.text}" — fg:${i.color} bg:${i.bg}`));

    // 4. Navigate to Journal
    const journalLink = page.locator('text=/Journal/i').first();
    if (await journalLink.count() > 0) {
      await journalLink.click();
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-journal.png`, fullPage: true });
    const journalIssues = await findLowContrastElements(page);
    console.log(`[DM] Journal: ${journalIssues.length} low-contrast elements`);
    journalIssues.forEach(i => console.log(`  ⚠ "${i.text}" — fg:${i.color} bg:${i.bg}`));

    // 5. Navigate to Notifications
    const notifLink = page.locator('text=/Notifications/i').first();
    if (await notifLink.count() > 0) {
      await notifLink.click();
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-notifications.png`, fullPage: true });
    const notifIssues = await findLowContrastElements(page);
    console.log(`[DM] Notifications: ${notifIssues.length} low-contrast elements`);
    notifIssues.forEach(i => console.log(`  ⚠ "${i.text}" — fg:${i.color} bg:${i.bg}`));

    // 6. Navigate to Spaze Coach
    const coachLink = page.locator('text=/Spaze Coach|Coach/i').first();
    if (await coachLink.count() > 0) {
      await coachLink.click();
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-coach.png`, fullPage: true });
    const coachIssues = await findLowContrastElements(page);
    console.log(`[DM] Spaze Coach: ${coachIssues.length} low-contrast elements`);
    coachIssues.forEach(i => console.log(`  ⚠ "${i.text}" — fg:${i.color} bg:${i.bg}`));

    // 7. Navigate to Chat/Conversations
    const chatLink = page.locator('text=/Chat|Conversations/i').first();
    if (await chatLink.count() > 0) {
      await chatLink.click();
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-chat.png`, fullPage: true });
    const chatIssues = await findLowContrastElements(page);
    console.log(`[DM] Chat: ${chatIssues.length} low-contrast elements`);
    chatIssues.forEach(i => console.log(`  ⚠ "${i.text}" — fg:${i.color} bg:${i.bg}`));

    // 8. Go back to Home and click a post to test PostDetail
    const homeLink2 = page.locator('text=/Home/i').first();
    if (await homeLink2.count() > 0) {
      await homeLink2.click();
      await page.waitForTimeout(3000);
    }
    // Click first post card
    const firstPost = page.locator('[data-testid="post-card"]').first();
    if (await firstPost.count() > 0) {
      await firstPost.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/07-post-detail.png`, fullPage: true });
      const postDetailIssues = await findLowContrastElements(page);
      console.log(`[DM] Post Detail: ${postDetailIssues.length} low-contrast elements`);
      postDetailIssues.forEach(i => console.log(`  ⚠ "${i.text}" — fg:${i.color} bg:${i.bg}`));
    }

    // Summary
    const allIssues = [
      ...profileIssues.map(i => ({ screen: 'Profile', ...i })),
      ...homeIssues.map(i => ({ screen: 'Home', ...i })),
      ...journalIssues.map(i => ({ screen: 'Journal', ...i })),
      ...notifIssues.map(i => ({ screen: 'Notifications', ...i })),
      ...coachIssues.map(i => ({ screen: 'Coach', ...i })),
      ...chatIssues.map(i => ({ screen: 'Chat', ...i })),
    ];
    
    console.log(`\n[DM] ══════ SUMMARY ══════`);
    console.log(`[DM] Total low-contrast issues found: ${allIssues.length}`);
    allIssues.forEach(i => {
      console.log(`[DM]   ${i.screen}: "${i.text}" — fg:${i.color} bg:${i.bg}`);
    });
  });
});
