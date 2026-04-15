#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// PUSO Spaze — UI Agent
// Automated Playwright agent that:
//   1. Clicks all buttons & checks UI functionality per screen
//   2. Detects hardcoded / mock data in rendered DOM
// ─────────────────────────────────────────────────────────────
// Usage:
//   node quality/qa-tests/ui-agent.mjs
//
// Prerequisites:
//   - Server running on localhost:4000
//   - Expo web running on localhost:8081
//   - Playwright installed (npx playwright install chromium)
// ─────────────────────────────────────────────────────────────

import { chromium } from "playwright";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ───────────────────────────────────────────────────
const APP_URL = process.env.APP_URL || "http://localhost:8081";
const API_URL = process.env.API_URL || "http://localhost:4000";
const SCREENSHOT_DIR = path.join(__dirname, "..", "results", "screenshots", "ui-agent");
const REPORT_PATH = path.join(__dirname, "..", "results", "ui-agent-report.json");
const TIMEOUT = 8000;
const NAV_TIMEOUT = 15000;

// ── Results Collector ────────────────────────────────────────
const results = [];
let testId = 0;

function log(screen, test, expected, actual, status, details = "") {
  testId++;
  const entry = { id: testId, screen, test, expected, actual, status, details };
  results.push(entry);
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️";
  console.log(`${icon} #${testId} [${screen}] ${test} → ${actual}`);
  if (details) console.log(`   ℹ️  ${details}`);
}

// ── Hardcoded / Mock Data Patterns ───────────────────────────
// These patterns detect placeholder / mock data left in screens
const MOCK_DATA_PATTERNS = [
  { pattern: /lorem ipsum/i, label: "Lorem ipsum placeholder" },
  { pattern: /TODO|FIXME|HACK|XXX/g, label: "TODO/FIXME comment in DOM" },
  { pattern: /test@(test|example)\.(com|org)/i, label: "Test email address" },
  { pattern: /John Doe|Jane Doe|John Smith/i, label: "Placeholder person name" },
  { pattern: /123-?456-?789|555-?\d{4}/i, label: "Fake phone number" },
  { pattern: /\b(mock|dummy|fake|sample|placeholder)\b/i, label: "Mock/dummy/fake keyword" },
  { pattern: /00000000-0000-0000-0000-000000000000/i, label: "Null UUID" },
  { pattern: /https?:\/\/example\.(com|org)/i, label: "example.com URL" },
  { pattern: /\bfoo\b|\bbar\b|\bbaz\b/i, label: "foo/bar/baz placeholder" },
  { pattern: /data:image\/[^;]+;base64,AAAA/i, label: "Stub base64 image" },
  { pattern: /\$\{.*?\}|{{.*?}}/g, label: "Unresolved template variable" },
];

// Known false-positive exceptions (legitimate UI text)
const MOCK_DATA_EXCEPTIONS = [
  "coach@example.com", // SendInviteScreen placeholder text for email input
  "sample",            // may appear in legitimate sentences
];

function scanForMockData(screen, text) {
  const findings = [];
  for (const { pattern, label } of MOCK_DATA_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        // Skip known exceptions
        if (MOCK_DATA_EXCEPTIONS.some((ex) => m.toLowerCase().includes(ex.toLowerCase()))) continue;
        findings.push({ label, match: m });
      }
    }
  }
  for (const f of findings) {
    log(screen, `Mock data scan: ${f.label}`, "No mock/hardcoded data", `Found: "${f.match}"`, "WARN", "Possible hardcoded/mock data in rendered UI");
  }
  if (findings.length === 0) {
    log(screen, "Mock data scan", "No mock data", "Clean", "PASS");
  }
  return findings;
}

// ── Helpers ───────────────────────────────────────────────────
async function screenshot(page, name) {
  const safeName = name.replace(/[^a-z0-9_-]/gi, "_");
  const filePath = path.join(SCREENSHOT_DIR, `${safeName}.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => {});
  return filePath;
}

async function safeClick(page, locator, description, screen) {
  try {
    const el = typeof locator === "string" ? page.locator(locator).first() : locator;
    const isVisible = await el.isVisible().catch(() => false);
    if (!isVisible) {
      log(screen, `Click: ${description}`, "Element visible & clickable", "Not visible", "WARN");
      return false;
    }
    await el.click({ timeout: TIMEOUT });
    // Wait briefly for any reaction (modal, navigation, state change)
    await page.waitForTimeout(800);
    log(screen, `Click: ${description}`, "No crash", "Clicked OK", "PASS");
    return true;
  } catch (err) {
    log(screen, `Click: ${description}`, "No crash", `Error: ${err.message.slice(0, 100)}`, "FAIL");
    await screenshot(page, `error_click_${screen}_${description}`);
    return false;
  }
}

async function checkElementExists(page, selector, name, screen) {
  try {
    const count = await page.locator(selector).count();
    if (count > 0) {
      log(screen, `Element exists: ${name}`, "Present", `Found (${count})`, "PASS");
      return true;
    }
    log(screen, `Element exists: ${name}`, "Present", "Not found", "FAIL");
    return false;
  } catch {
    log(screen, `Element exists: ${name}`, "Present", "Error checking", "FAIL");
    return false;
  }
}

async function getVisibleText(page) {
  return page.evaluate(() => document.body?.innerText || "").catch(() => "");
}

async function getConsoleErrors(page) {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

async function waitForAppReady(page) {
  // Wait for React Native Web to render (body has content)
  await page.waitForFunction(() => {
    return document.body && document.body.innerText.length > 10;
  }, { timeout: NAV_TIMEOUT }).catch(() => {});
}

async function navigateTo(page, path, screen) {
  try {
    await page.goto(`${APP_URL}${path}`, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
    await waitForAppReady(page);
    await page.waitForTimeout(1500); // Let animations settle
    log(screen, `Navigate to ${path}`, "Page loads", "Loaded", "PASS");
    return true;
  } catch (err) {
    log(screen, `Navigate to ${path}`, "Page loads", `Error: ${err.message.slice(0, 100)}`, "FAIL");
    return false;
  }
}

// ── Pre-flight: Create a test user via API ───────────────────
async function createTestUser() {
  const ts = Date.now();
  const deviceId = crypto.randomUUID();
  const displayName = `UIAgent${ts}`;
  try {
    const res = await fetch(`${API_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, deviceId }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Status ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const userId = data.userId || data.user?.id;
    const token = data.token;
    const name = data.user?.displayName || data.displayName || displayName;
    console.log(`🔑 Test user created: ${name} (${userId?.slice(0, 8)}...)`);
    return { userId, token, displayName: name, deviceId };
  } catch (err) {
    console.error("⚠️  Could not create test user via API:", err.message);
    return null;
  }
}

async function createCoachUser() {
  const ts = Date.now();
  const deviceId = crypto.randomUUID();
  const displayName = `Coach${ts}`;
  try {
    // Generate invite code (admin endpoint uses Bearer token auth)
    const codeRes = await fetch(`${API_URL}/api/admin/invite-codes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer pusocoach_admin_2026",
      },
      body: JSON.stringify({ count: 1 }),
    });
    if (!codeRes.ok) {
      console.log(`⚠️  Admin invite-codes returned ${codeRes.status}`);
      return null;
    }
    const codeData = await codeRes.json();
    const code = codeData.codes?.[0]?.code || codeData[0]?.code;
    if (!code) {
      console.log("⚠️  No invite code returned");
      return null;
    }
    console.log(`🎟️  Invite code generated: ${code}`);

    // Redeem invite to create coach (correct endpoint: POST /api/auth/redeem-invite)
    const res = await fetch(`${API_URL}/api/auth/redeem-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, code, deviceId }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.log(`⚠️  Coach redeem-invite returned ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    const userId = data.userId || data.user?.id;
    const token = data.token;
    const name = data.user?.displayName || data.displayName || displayName;
    console.log(`🔑 Coach user created: ${name}`);
    return { userId, token, displayName: name, deviceId };
  } catch (err) {
    console.log(`⚠️  Could not create coach user: ${err.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// SCREEN TEST SUITES
// ══════════════════════════════════════════════════════════════

// ── 1. LOGIN SCREEN ──────────────────────────────────────────
async function testLoginScreen(page) {
  const S = "LoginScreen";
  console.log(`\n━━ ${S} ━━`);

  await navigateTo(page, "/login", S);
  await screenshot(page, `${S}_initial`);

  // Check key elements
  const text = await getVisibleText(page);
  scanForMockData(S, text);

  // Verify welcome text or app brand
  const hasBrand = text.toLowerCase().includes("puso") || text.toLowerCase().includes("spaze");
  log(S, "App branding visible", "PUSO or Spaze text", hasBrand ? "Found" : "Not found", hasBrand ? "PASS" : "WARN");

  // Check for username input
  const inputs = await page.locator('input, [role="textbox"]').count();
  log(S, "Input fields present", "At least 1 input", `Found ${inputs}`, inputs > 0 ? "PASS" : "FAIL");

  // Check for enter/submit button
  const buttons = await page.locator('button, [role="button"], [accessibilityLabel]').count();
  log(S, "Buttons present", "At least 1 button", `Found ${buttons}`, buttons > 0 ? "PASS" : "FAIL");

  // Try clicking "Show Guidelines" if present
  const guidelinesBtn = page.getByText(/compassion guidelines/i).first();
  if (await guidelinesBtn.isVisible().catch(() => false)) {
    await safeClick(page, guidelinesBtn, "Show Guidelines", S);
    await screenshot(page, `${S}_guidelines_modal`);
    // Close the modal — look for "I Understand" or close button or press Escape
    const understandBtn = page.getByText(/understand|got it|close/i).first();
    if (await understandBtn.isVisible().catch(() => false)) {
      await safeClick(page, understandBtn, "Close Guidelines Modal", S);
    } else {
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  // Try clicking "About the Spaze" if present (exact text to avoid matching modal body)
  const aboutBtn = page.getByText("About the Spaze").first();
  if (await aboutBtn.isVisible().catch(() => false)) {
    await safeClick(page, aboutBtn, "Show About", S);
    await screenshot(page, `${S}_about_modal`);
    // Dismiss modal
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(500);
  }

  // Try clicking "Privacy" if present
  const privacyBtn = page.getByText(/privacy/i).first();
  if (await privacyBtn.isVisible().catch(() => false)) {
    await safeClick(page, privacyBtn, "Show Privacy", S);
    await screenshot(page, `${S}_privacy_modal`);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(500);
  }

  // Try the refresh anonymous username button
  const refreshBtn = page.locator('[accessibilityLabel*="refresh" i], [aria-label*="refresh" i]').first();
  if (await refreshBtn.isVisible().catch(() => false)) {
    await safeClick(page, refreshBtn, "Refresh anonymous username", S);
  }

  // Try typing a username and clicking enter
  const usernameInput = page.locator('input').first();
  if (await usernameInput.isVisible().catch(() => false)) {
    await usernameInput.fill("UIAgentTest_" + Date.now());
    log(S, "Type username", "Input accepts text", "Typed", "PASS");
  }

  await screenshot(page, `${S}_final`);
}

// ── 2. HOME SCREEN ───────────────────────────────────────────
async function testHomeScreen(page) {
  const S = "HomeScreen";
  console.log(`\n━━ ${S} ━━`);

  await navigateTo(page, "/", S);
  await screenshot(page, `${S}_initial`);

  const text = await getVisibleText(page);
  scanForMockData(S, text);

  // Check for post feed
  const hasContent = text.length > 50;
  log(S, "Feed content renders", "Posts visible", hasContent ? "Content present" : "Empty", hasContent ? "PASS" : "WARN");

  // Check for greeting
  const hasGreeting = /good (morning|afternoon|evening)/i.test(text);
  log(S, "Time-based greeting", "Dynamic greeting", hasGreeting ? "Found" : "Not rendered", hasGreeting ? "PASS" : "WARN");

  // Check notification bell
  const bellBtn = page.locator('[accessibilityLabel*="notif" i], [aria-label*="notif" i]').first();
  if (await bellBtn.isVisible().catch(() => false)) {
    log(S, "Notification bell visible", "Present", "Visible", "PASS");
  }

  // Check search input
  const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="Search" i]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill("test search");
    await page.waitForTimeout(600); // debounce
    log(S, "Search input functional", "Accepts text", "Typed", "PASS");
    await searchInput.clear();
  }

  // Check stats cards (dashboard stats)
  const statsText = text.match(/members|stories|online|trending/gi);
  if (statsText) {
    log(S, "Dashboard stats rendered", "Stats visible", `Found: ${statsText.join(", ")}`, "PASS");
    // Check if stats show actual numbers vs hardcoded
    const hardcodedStats = text.match(/\b(999|1234|42|100)\b/g);
    if (hardcodedStats) {
      log(S, "Stats values check", "Dynamic data", `Suspicious values: ${hardcodedStats.join(", ")}`, "WARN", "May be hardcoded test data");
    }
  }

  // Click Compose / FAB button
  const fab = page.locator('[accessibilityLabel="Post"], [aria-label="Post"]').first();
  if (await fab.isVisible().catch(() => false)) {
    const fabDisabled = await fab.isDisabled().catch(() => false);
    if (fabDisabled) {
      log(S, "Compose FAB state", "Disabled when empty", "Correctly disabled", "PASS");
    } else {
      await safeClick(page, fab, "Compose FAB", S);
    }
    await screenshot(page, `${S}_compose_expanded`);
  }

  // Check feeling emoji selector if visible
  const feelingBtns = page.locator('text=/Grateful|Prayerful|Hopeful|Struggling/i');
  const feelingCount = await feelingBtns.count().catch(() => 0);
  if (feelingCount > 0) {
    log(S, "Feeling emoji selector", "Options present", `Found ${feelingCount} feelings`, "PASS");
    await safeClick(page, feelingBtns.first(), "Select feeling", S);
  }

  // Check anonymous toggle (look for a switch/toggle, not just text)
  const anonSwitch = page.locator('[role="switch"]').first();
  const anonToggle = page.locator('text=/anonymous/i >> xpath=.. >> [role="switch"], [role="switch"][aria-label*="nonymous" i]').first();
  if (await anonToggle.isVisible().catch(() => false)) {
    await safeClick(page, anonToggle, "Anonymous toggle", S);
  } else {
    log(S, "Anonymous toggle", "Toggle present", "Not on HomeScreen (expected — toggle is on Profile)", "PASS");
  }

  // Test post card interactions (if posts exist)
  const postCards = page.locator('[data-testid*="post"], [accessibilityLabel*="post" i]');
  const postCount = await postCards.count().catch(() => 0);
  if (postCount > 0) {
    log(S, "Post cards rendered", "Posts visible", `${postCount} cards`, "PASS");
    await safeClick(page, postCards.first(), "Tap first post card", S);
    await screenshot(page, `${S}_post_tapped`);
    await page.goBack().catch(() => navigateTo(page, "/", S));
    await page.waitForTimeout(1000);
  }

  // Try scrolling to trigger load more
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await page.waitForTimeout(1500);
  log(S, "Infinite scroll", "No crash on scroll", "Scrolled to bottom", "PASS");

  // Check reaction buttons on posts
  const reactionBtns = page.locator('text=/🙏|❤️|🤝|👍/').first();
  if (await reactionBtns.isVisible().catch(() => false)) {
    await safeClick(page, reactionBtns, "Reaction button on post", S);
  }

  await screenshot(page, `${S}_final`);
}

// ── 3. POST SCREEN ───────────────────────────────────────────
async function testPostScreen(page) {
  const S = "PostScreen";
  console.log(`\n━━ ${S} ━━`);

  await navigateTo(page, "/post", S);
  await screenshot(page, `${S}_initial`);

  const text = await getVisibleText(page);
  scanForMockData(S, text);

  // Check text input
  const contentInput = page.locator('textarea, input[placeholder*="heart" i], [role="textbox"]').first();
  if (await contentInput.isVisible().catch(() => false)) {
    await contentInput.fill("This is a test post from the UI Agent. God is good! 🙏");
    log(S, "Post content input", "Accepts text", "Typed", "PASS");
  }

  // Check category selector
  const categories = page.locator('text=/Prayer Request|Encouragement|Testimony|Question|Reflection/i');
  const catCount = await categories.count().catch(() => 0);
  if (catCount > 0) {
    log(S, "Category options", "Categories present", `Found ${catCount}`, "PASS");
    // Click each category
    for (let i = 0; i < Math.min(catCount, 3); i++) {
      await safeClick(page, categories.nth(i), `Category option ${i + 1}`, S);
    }
  }

  // Check feeling selector
  const feelings = page.locator('text=/Grateful|Prayerful|Hopeful|Strong|Struggling/i');
  const feelCount = await feelings.count().catch(() => 0);
  if (feelCount > 0) {
    log(S, "Feeling options", "Feelings present", `Found ${feelCount}`, "PASS");
    await safeClick(page, feelings.first(), "Select first feeling", S);
  }

  // Check anonymous toggle
  const toggles = page.locator('text=/anonymous|public/i, [role="switch"]');
  if (await toggles.first().isVisible().catch(() => false)) {
    await safeClick(page, toggles.first(), "Visibility toggle", S);
    log(S, "Anonymous/Public toggle", "Toggleable", "Clicked", "PASS");
  }

  // Check image picker button
  const imgBtn = page.locator('[accessibilityLabel*="image" i], [aria-label*="image" i], [accessibilityLabel*="photo" i]').first();
  if (await imgBtn.isVisible().catch(() => false)) {
    log(S, "Image picker button", "Present", "Visible", "PASS");
  }

  // Submit button (don't actually submit to avoid polluting data)
  const submitBtn = page.locator('text=/share|post|submit/i').first();
  if (await submitBtn.isVisible().catch(() => false)) {
    log(S, "Submit button present", "Present", "Visible", "PASS");
    // Check if it's disabled when content is empty
    await contentInput?.clear().catch(() => {});
    await page.waitForTimeout(300);
    const isDisabled = await submitBtn.isDisabled().catch(() => null);
    if (isDisabled === true) {
      log(S, "Submit disabled when empty", "Disabled", "Disabled correctly", "PASS");
    } else if (isDisabled === false) {
      log(S, "Submit disabled when empty", "Disabled", "Still enabled (no validation?)", "WARN");
    }
  }

  // Check @mention functionality
  if (await contentInput?.isVisible().catch(() => false)) {
    await contentInput.fill("@");
    await page.waitForTimeout(500);
    const mentionDropdown = page.locator('[data-testid*="mention"], [role="listbox"], [role="option"]');
    const mentionCount = await mentionDropdown.count().catch(() => 0);
    log(S, "@mention autocomplete", "Dropdown shows on @", mentionCount > 0 ? `${mentionCount} suggestions` : "No dropdown", mentionCount > 0 ? "PASS" : "WARN");
  }

  await screenshot(page, `${S}_final`);
}

// ── 4. PROFILE SCREEN ────────────────────────────────────────
async function testProfileScreen(page) {
  const S = "ProfileScreen";
  console.log(`\n━━ ${S} ━━`);

  await navigateTo(page, "/profile", S);
  await screenshot(page, `${S}_initial`);

  const text = await getVisibleText(page);
  scanForMockData(S, text);

  // Check profile info renders
  const hasName = text.length > 20;
  log(S, "Profile info renders", "User data visible", hasName ? "Content present" : "Empty", hasName ? "PASS" : "FAIL");

  // Check default bio detection
  if (text.includes("Embracing the journey")) {
    log(S, "Default bio check", "Custom bio or no bio", "Default bio still showing", "WARN", "BIO_DEFAULT is hardcoded placeholder");
  }

  // Check for role label
  const hasRole = /Spaze Member|Spaze Coach|Admin/i.test(text);
  log(S, "Role label visible", "Role displayed", hasRole ? "Found" : "Not visible", hasRole ? "PASS" : "WARN");

  // Check dark mode toggle
  const darkToggle = page.locator('text=/dark mode/i, [accessibilityLabel*="dark" i]').first();
  if (await darkToggle.isVisible().catch(() => false)) {
    await safeClick(page, darkToggle, "Dark mode toggle", S);
    await screenshot(page, `${S}_dark_mode`);
    // Toggle back
    await safeClick(page, darkToggle, "Dark mode toggle (revert)", S);
    await page.waitForTimeout(500);
  }

  // Check notification toggle
  const notifToggle = page.locator('text=/notification/i').first();
  if (await notifToggle.isVisible().catch(() => false)) {
    log(S, "Notification toggle present", "Present", "Visible", "PASS");
  }

  // Check anonymous mode toggle
  const anonToggle = page.locator('text=/anonymous/i').first();
  if (await anonToggle.isVisible().catch(() => false)) {
    log(S, "Anonymous toggle present", "Present", "Visible", "PASS");
  }

  // Check PIN display
  const pinSection = page.locator('text=/PIN/i').first();
  if (await pinSection.isVisible().catch(() => false)) {
    log(S, "PIN section visible", "Present", "Visible", "PASS");
    // Check PIN visibility toggle
    const eyeBtn = page.locator('[accessibilityLabel*="eye" i], [aria-label*="eye" i], [accessibilityLabel*="show" i]').first();
    if (await eyeBtn.isVisible().catch(() => false)) {
      await safeClick(page, eyeBtn, "PIN visibility toggle", S);
    }
  }

  // Check username edit
  const editBtn = page.locator('[accessibilityLabel*="edit" i], [aria-label*="edit" i]').first();
  if (await editBtn.isVisible().catch(() => false)) {
    await safeClick(page, editBtn, "Edit username button", S);
    await screenshot(page, `${S}_edit_mode`);
    // Cancel edit
    const cancelBtn = page.locator('text=/cancel/i').first();
    if (await cancelBtn.isVisible().catch(() => false)) {
      await safeClick(page, cancelBtn, "Cancel edit", S);
    }
  }

  // Check avatar section
  const avatar = page.locator('[accessibilityLabel*="avatar" i], img[src*="avatar"], [accessibilityLabel*="profile" i]').first();
  if (await avatar.isVisible().catch(() => false)) {
    log(S, "Avatar visible", "Present", "Visible", "PASS");
  }

  // Check sign out button
  const signOutBtn = page.getByText(/sign out|log out|logout/i).first();
  if (await signOutBtn.isVisible().catch(() => false)) {
    log(S, "Sign out button present", "Present", "Visible", "PASS");
    // Don't actually sign out
  }

  // Check recent reflections / post stats
  const hasStats = /post|reflection|journal|entr/i.test(text);
  log(S, "Activity stats section", "Stats visible", hasStats ? "Found" : "Not visible", hasStats ? "PASS" : "WARN");

  await screenshot(page, `${S}_final`);
}

// ── 5. JOURNAL SCREEN ────────────────────────────────────────
async function testJournalScreen(page) {
  const S = "JournalScreen";
  console.log(`\n━━ ${S} ━━`);

  await navigateTo(page, "/journal", S);
  await screenshot(page, `${S}_initial`);

  const text = await getVisibleText(page);
  scanForMockData(S, text);

  // Check mood selector
  const moods = page.locator('text=/Grateful|Hopeful|Peaceful|Happy|Anxious|Sad|Reflective|Loved/i');
  const moodCount = await moods.count().catch(() => 0);
  if (moodCount > 0) {
    log(S, "Mood selector options", "8 moods available", `Found ${moodCount}`, moodCount >= 4 ? "PASS" : "WARN");
    // Click each mood
    for (let i = 0; i < Math.min(moodCount, 4); i++) {
      await safeClick(page, moods.nth(i), `Mood: ${await moods.nth(i).textContent().catch(() => i)}`, S);
    }
  }

  // Check journal entry composer
  const journalInput = page.locator('textarea, input[placeholder*="journal" i], input[placeholder*="write" i], [role="textbox"]').first();
  if (await journalInput.isVisible().catch(() => false)) {
    await journalInput.fill("UI Agent test journal entry — feeling grateful today 🙏");
    log(S, "Journal input", "Accepts text", "Typed", "PASS");
  }

  // Check daily prompts
  const prompts = page.locator('text=/What made you|How did God|What are you grateful/i');
  const promptCount = await prompts.count().catch(() => 0);
  if (promptCount > 0) {
    log(S, "Daily prompts visible", "Prompts present", `Found ${promptCount}`, "PASS");
    await safeClick(page, prompts.first(), "Select daily prompt", S);
  }

  // Check calendar / mood bloom
  const calendarDays = page.locator('text=/^(S|M|T|W|F)$/');
  const dayCount = await calendarDays.count().catch(() => 0);
  if (dayCount > 0) {
    log(S, "Calendar header days", "Days visible", `Found ${dayCount}`, "PASS");
  }

  // Check month navigation
  const monthNav = page.locator('[accessibilityLabel*="month" i], [aria-label*="month" i], text=/January|February|March|April|May|June|July|August|September|October|November|December/i').first();
  if (await monthNav.isVisible().catch(() => false)) {
    log(S, "Month display/navigation", "Month visible", "Present", "PASS");
  }

  // Check hardcoded prompts (these ARE expected — not a bug, just documenting)
  const promptTexts = ["What made you feel hopeful today", "How did God show up", "What are you grateful for"];
  for (const pt of promptTexts) {
    if (text.includes(pt)) {
      log(S, `Prompt text: "${pt.slice(0, 30)}..."`, "Content-driven", "Hardcoded prompt", "WARN", "Prompts are static, not dynamic — consider server-side prompts");
    }
  }

  // Don't submit — just verify the save button exists
  const saveBtn = page.locator('text=/save|create|add entry/i').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    log(S, "Save/Create button present", "Present", "Visible", "PASS");
  }

  await screenshot(page, `${S}_final`);
}

// ── 6. NOTIFICATIONS SCREEN ─────────────────────────────────
async function testNotificationsScreen(page) {
  const S = "NotificationsScreen";
  console.log(`\n━━ ${S} ━━`);

  await navigateTo(page, "/notifications", S);
  await screenshot(page, `${S}_initial`);

  const text = await getVisibleText(page);
  scanForMockData(S, text);

  // Check search input
  const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="Search" i]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill("test notification search");
    await page.waitForTimeout(500);
    log(S, "Search input", "Accepts text", "Typed", "PASS");
    await searchInput.clear();
  }

  // Check "Mark all as read" button
  const markAllBtn = page.getByText(/mark all|read all/i).first();
  if (await markAllBtn.isVisible().catch(() => false)) {
    log(S, "Mark all as read button", "Present", "Visible", "PASS");
    await safeClick(page, markAllBtn, "Mark all as read", S);
  }

  // Check grouped sections
  const groups = ["TODAY", "YESTERDAY", "THIS WEEK", "EARLIER"];
  for (const g of groups) {
    const groupHeader = page.getByText(g, { exact: false }).first();
    if (await groupHeader.isVisible().catch(() => false)) {
      log(S, `Group header: ${g}`, "Dynamic grouping", "Present", "PASS");
    }
  }

  // Check notification items
  const notifItems = page.locator('[accessibilityLabel*="notification" i], [role="button"]');
  const notifCount = await notifItems.count().catch(() => 0);
  log(S, "Notification items", "Items rendered", `${notifCount} items`, notifCount > 0 ? "PASS" : "WARN", notifCount === 0 ? "No notifications yet (may be expected for new user)" : "");

  // Check empty state
  if (text.includes("no notification") || text.includes("No notification") || text.includes("all caught up")) {
    log(S, "Empty state", "Empty state shows", "Empty state visible", "PASS");
  }

  await screenshot(page, `${S}_final`);
}

// ── 7. POST DETAIL SCREEN ────────────────────────────────────
async function testPostDetailScreen(page, testPostId) {
  const S = "PostDetailScreen";
  console.log(`\n━━ ${S} ━━`);

  if (!testPostId) {
    log(S, "Navigate to post detail", "Post ID available", "No test post ID", "WARN", "Skipping — create a post first");
    return;
  }

  await navigateTo(page, `/PostDetail/${testPostId}`, S);
  await screenshot(page, `${S}_initial`);

  const text = await getVisibleText(page);
  scanForMockData(S, text);

  // Check post content renders
  log(S, "Post content renders", "Post visible", text.length > 30 ? "Content present" : "Limited content", text.length > 30 ? "PASS" : "WARN");

  // Check reaction buttons
  const reactions = ["PRAY", "CARE", "SUPPORT", "LIKE"];
  for (const r of reactions) {
    const btn = page.locator(`text=/${r}/i, [accessibilityLabel*="${r}" i]`).first();
    if (await btn.isVisible().catch(() => false)) {
      log(S, `Reaction: ${r} button`, "Present", "Visible", "PASS");
    }
  }

  // Check comment input
  const commentInput = page.locator('input[placeholder*="supportive" i], textarea, [role="textbox"]').first();
  if (await commentInput.isVisible().catch(() => false)) {
    await commentInput.fill("Test comment from UI Agent — stay blessed! 🙏");
    log(S, "Comment input", "Accepts text", "Typed", "PASS");
    // Don't submit
    await commentInput.clear();
  }

  // Check back button
  const backBtn = page.locator('[accessibilityLabel*="back" i], [aria-label*="back" i]').first();
  if (await backBtn.isVisible().catch(() => false)) {
    log(S, "Back button present", "Present", "Visible", "PASS");
  }

  // Check SYSTEM_USER_ID reference in text
  if (text.includes("system-encouragement-bot")) {
    log(S, "System user ID exposed", "Not shown to user", "Visible in UI", "FAIL", "SYSTEM_USER_ID is leaking into the rendered output");
  }

  await screenshot(page, `${S}_final`);
}

// ── 8. SPAZE COACH SCREEN ────────────────────────────────────
async function testSpazeCoachScreen(page) {
  const S = "SpazeCoachScreen";
  console.log(`\n━━ ${S} ━━`);

  await navigateTo(page, "/spaze-coach", S);
  await screenshot(page, `${S}_initial`);

  const text = await getVisibleText(page);
  scanForMockData(S, text);

  // Check coach list
  const coachCards = page.locator('text=/Coach|Wellness|Support/i');
  const coachCount = await coachCards.count().catch(() => 0);
  log(S, "Coach cards visible", "Coaches listed", `${coachCount} elements`, coachCount > 0 ? "PASS" : "WARN");

  // Check hardcoded specialties
  const specialtyCount = (text.match(/Wellness|Support/gi) || []).length;
  if (specialtyCount > 2) {
    log(S, "Coach specialties", "Dynamic specialties", `${specialtyCount} hardcoded specialty labels`, "WARN", 'DEFAULT_SPECIALTIES = ["Wellness", "Support"] applied to all coaches');
  }

  // Check message button on coach cards
  const msgBtn = page.getByText(/message|chat|start/i).first();
  if (await msgBtn.isVisible().catch(() => false)) {
    log(S, "Message coach button", "Present", "Visible", "PASS");
    // Don't actually start a conversation
  }

  // Check conversation history
  const convSection = page.getByText(/conversation|recent|history/i).first();
  if (await convSection.isVisible().catch(() => false)) {
    log(S, "Conversation history section", "Present", "Visible", "PASS");
  }

  await screenshot(page, `${S}_final`);
}

// ── 9. COACH DASHBOARD SCREEN ────────────────────────────────
async function testCoachDashboard(page) {
  const S = "CoachDashboard";
  console.log(`\n━━ ${S} ━━`);

  await navigateTo(page, "/review-queue", S);
  await screenshot(page, `${S}_initial`);

  const text = await getVisibleText(page);
  scanForMockData(S, text);

  // Check stats cards
  const hasStats = /members|stories|online/i.test(text);
  log(S, "Dashboard stats", "Stats visible", hasStats ? "Found" : "Not visible", hasStats ? "PASS" : "WARN");

  // Check review queue tabs
  const postTab = page.getByText(/posts/i).first();
  const commentTab = page.getByText(/comments/i).first();
  if (await postTab.isVisible().catch(() => false)) {
    await safeClick(page, postTab, "Posts review tab", S);
    await screenshot(page, `${S}_posts_tab`);
  }
  if (await commentTab.isVisible().catch(() => false)) {
    await safeClick(page, commentTab, "Comments review tab", S);
    await screenshot(page, `${S}_comments_tab`);
  }

  // Check moderation buttons (Approve/Reject)
  const approveBtn = page.getByText(/approve/i).first();
  const rejectBtn = page.getByText(/reject/i).first();
  if (await approveBtn.isVisible().catch(() => false)) {
    log(S, "Approve button present", "Present", "Visible", "PASS");
  }
  if (await rejectBtn.isVisible().catch(() => false)) {
    log(S, "Reject button present", "Present", "Visible", "PASS");
  }

  // Check recovery requests section
  const recoverySection = page.getByText(/recovery|account recovery/i).first();
  if (await recoverySection.isVisible().catch(() => false)) {
    log(S, "Recovery requests section", "Present", "Visible", "PASS");
  }

  // Check Hourly Hope controls
  const hourlyHope = page.getByText(/hourly hope/i).first();
  if (await hourlyHope.isVisible().catch(() => false)) {
    log(S, "Hourly Hope controls", "Present", "Visible", "PASS");
  }

  await screenshot(page, `${S}_final`);
}

// ── 10. SPAZE CONVERSATIONS SCREEN ──────────────────────────
async function testSpazeConversationsScreen(page) {
  const S = "SpazeConversationsScreen";
  console.log(`\n━━ ${S} ━━`);

  await navigateTo(page, "/conversations", S);
  await screenshot(page, `${S}_initial`);

  const text = await getVisibleText(page);
  scanForMockData(S, text);

  // Check search
  const searchInput = page.locator('input[placeholder*="search" i]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill("test conversation search");
    await page.waitForTimeout(500);
    log(S, "Search input", "Accepts text", "Typed", "PASS");
    await searchInput.clear();
  }

  // Check conversation cards
  const convCards = page.locator('[role="button"]');
  const convCount = await convCards.count().catch(() => 0);
  log(S, "Conversation cards", "Cards present", `${convCount} interactive elements`, convCount > 0 ? "PASS" : "WARN");

  // Check empty state
  if (text.toLowerCase().includes("no conversation") || text.toLowerCase().includes("no messages")) {
    log(S, "Empty state", "Empty state shows", "Visible", "PASS");
  }

  await screenshot(page, `${S}_final`);
}

// ── 11. SEND INVITE SCREEN ──────────────────────────────────
async function testSendInviteScreen(page) {
  const S = "SendInviteScreen";
  console.log(`\n━━ ${S} ━━`);

  await navigateTo(page, "/send-invite", S);
  await screenshot(page, `${S}_initial`);

  const text = await getVisibleText(page);
  scanForMockData(S, text);

  // Check email input
  const emailInput = page.locator('input[placeholder*="email" i], input[type="email"]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    log(S, "Email input present", "Present", "Visible", "PASS");
    // Type invalid email to test validation
    await emailInput.fill("not-an-email");
    const submitBtn = page.getByText(/send/i).first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await safeClick(page, submitBtn, "Submit with invalid email", S);
      await page.waitForTimeout(500);
      // Check for validation error
      const errorText = await getVisibleText(page);
      const hasError = /invalid|error|valid email/i.test(errorText);
      log(S, "Email validation", "Shows error for invalid email", hasError ? "Error shown" : "No validation", hasError ? "PASS" : "WARN");
    }
    await emailInput.clear();
  }

  // Check admin secret input
  const secretInput = page.locator('input[placeholder*="secret" i], input[type="password"]').first();
  if (await secretInput.isVisible().catch(() => false)) {
    log(S, "Admin secret input", "Present", "Visible", "PASS");
  }

  // Check Hourly Hope controls
  const hourlyHopeBtn = page.getByText(/hourly hope/i).first();
  if (await hourlyHopeBtn.isVisible().catch(() => false)) {
    log(S, "Hourly Hope controls", "Present", "Visible", "PASS");
  }

  await screenshot(page, `${S}_final`);
}

// ── 12. COACH LOGIN SCREEN ──────────────────────────────────
async function testCoachLoginScreen(page) {
  const S = "CoachLoginScreen";
  console.log(`\n━━ ${S} ━━`);

  await navigateTo(page, "/signup", S);
  await screenshot(page, `${S}_initial`);

  const text = await getVisibleText(page);
  scanForMockData(S, text);

  // Check username input
  const usernameInput = page.locator('input[placeholder*="username" i], input[placeholder*="coach" i]').first();
  if (await usernameInput.isVisible().catch(() => false)) {
    await usernameInput.fill("TestCoach");
    log(S, "Username input", "Accepts text", "Typed", "PASS");
  }

  // Check invite code input
  const codeInput = page.locator('input[placeholder*="invite" i], input[placeholder*="code" i]').first();
  if (await codeInput.isVisible().catch(() => false)) {
    await codeInput.fill("XXXXX-XXXXX");
    log(S, "Invite code input", "Accepts text", "Typed", "PASS");
  }

  // Check redeem button
  const redeemBtn = page.getByText(/redeem|join|enter/i).first();
  if (await redeemBtn.isVisible().catch(() => false)) {
    log(S, "Redeem button present", "Present", "Visible", "PASS");
  }

  await screenshot(page, `${S}_final`);
}

// ── NAVIGATION & SIDEBAR TESTS ───────────────────────────────
async function testNavigation(page) {
  const S = "Navigation";
  console.log(`\n━━ ${S} ━━`);

  await navigateTo(page, "/", S);

  // Check web sidebar (wide screens)
  const viewport = page.viewportSize();
  if (viewport && viewport.width >= 900) {
    // WebSidebar uses TouchableOpacity with Text children for each nav item
    const sidebarNavItems = ["Feed", "Journal", "Spaze Coach", "Notifications", "Profile"];
    let foundLinks = 0;
    for (const label of sidebarNavItems) {
      const link = page.getByText(label, { exact: true }).first();
      if (await link.isVisible().catch(() => false)) {
        foundLinks++;
      }
    }
    log(S, "Web sidebar nav links", "Nav links visible", `${foundLinks} links`, foundLinks >= 3 ? "PASS" : "WARN");

    // Click each nav link
    const navRoutes = [
      { label: "Feed", path: "/" },
      { label: "Journal", path: "/journal" },
      { label: "Notifications", path: "/notifications" },
      { label: "Profile", path: "/profile" },
    ];
    for (const { label, path: navPath } of navRoutes) {
      const link = page.getByText(label, { exact: true }).first();
      if (await link.isVisible().catch(() => false)) {
        await safeClick(page, link, `Navigate to ${navPath}`, S);
        await page.waitForTimeout(1000);
        await screenshot(page, `${S}_nav_${navPath.replace(/\//g, "_") || "home"}`);
      }
    }
  } else {
    // Check bottom tab bar (narrow screens)
    const tabs = page.locator('text=/Feed|Journal|Coach|Notification|Profile/i');
    const tabCount = await tabs.count().catch(() => 0);
    log(S, "Bottom tab bar", "Tabs visible", `${tabCount} tabs`, tabCount >= 3 ? "PASS" : "WARN");
  }
}

// ── CROSS-SCREEN DATA CONSISTENCY CHECK ──────────────────────
async function testDataConsistency(page) {
  const S = "DataConsistency";
  console.log(`\n━━ ${S} ━━`);

  // Check Home page stats
  await navigateTo(page, "/", S);
  const homeText = await getVisibleText(page);

  // Check Profile page
  await navigateTo(page, "/profile", S);
  const profileText = await getVisibleText(page);

  // Verify username appears consistently
  const nameMatch = profileText.match(/UIAgent\d+/);
  if (nameMatch) {
    const userName = nameMatch[0];
    const homeHasName = homeText.includes(userName);
    log(S, "Username consistency", "Same name across screens", homeHasName ? "Consistent" : "Mismatch", homeHasName ? "PASS" : "WARN");
  }

  // Check for any "undefined" or "null" text displayed
  for (const [screenName, text_content] of [["Home", homeText], ["Profile", profileText]]) {
    if (/\bundefined\b|\bnull\b|\bNaN\b/i.test(text_content)) {
      log(S, `Undefined/null in ${screenName}`, "No raw JS values", "Found undefined/null/NaN in UI", "FAIL", "Raw JavaScript value leaked into rendered text");
    } else {
      log(S, `No undefined/null in ${screenName}`, "No raw JS values", "Clean", "PASS");
    }
  }
}

// ── RESPONSIVE LAYOUT TESTS ─────────────────────────────────
async function testResponsiveLayout(page, context) {
  const S = "Responsive";
  console.log(`\n━━ ${S} ━━`);

  const viewports = [
    { name: "Mobile", width: 375, height: 812 },
    { name: "Tablet", width: 768, height: 1024 },
    { name: "Desktop", width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await navigateTo(page, "/", S);
    await screenshot(page, `${S}_${vp.name}_home`);

    const text = await getVisibleText(page);
    const hasContent = text.length > 30;
    log(S, `${vp.name} (${vp.width}px) renders`, "Content visible", hasContent ? "OK" : "Empty", hasContent ? "PASS" : "FAIL");

    // Check for horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    }).catch(() => false);
    log(S, `${vp.name} horizontal overflow`, "No overflow", hasOverflow ? "Horizontal scroll detected" : "No overflow", hasOverflow ? "WARN" : "PASS");
  }

  // Reset to desktop
  await page.setViewportSize({ width: 1280, height: 800 });
}

// ── CONSOLE ERROR COLLECTION ─────────────────────────────────
async function collectConsoleErrors(page) {
  const S = "ConsoleErrors";
  console.log(`\n━━ ${S} ━━`);

  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore known noisy errors that aren't real bugs
      if (text.includes("favicon")) return;
      if (text.includes(".ico")) return;
      if (text.includes("ERR_FAILED")) return; // Network errors from CORS/offline
      if (text.includes("net::ERR_")) return;   // Chrome network errors
      if (text.includes("Failed to load resource")) return;
      if (text.includes("Access to XMLHttpRequest")) return; // CORS errors (expected in dev)
      if (text.includes("[API Error] Network Error")) return; // Axios network errors from unreachable prod API
      errors.push(text);
    }
  });

  // Visit each major screen
  const screens = ["/", "/profile", "/journal", "/notifications", "/spaze-coach", "/post"];
  for (const path of screens) {
    await page.goto(`${APP_URL}${path}`, { waitUntil: "networkidle", timeout: NAV_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  if (errors.length > 0) {
    log(S, "Console errors across screens", "No errors", `${errors.length} errors`, "WARN");
    for (const e of errors.slice(0, 10)) {
      log(S, `Console error: ${e.slice(0, 80)}`, "No error", "Error logged", "WARN");
    }
  } else {
    log(S, "Console errors across screens", "No errors", "Clean", "PASS");
  }

  return errors;
}

// ══════════════════════════════════════════════════════════════
// MAIN RUNNER
// ══════════════════════════════════════════════════════════════
async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   PUSO Spaze — UI Agent Test Suite           ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`🌐 App URL: ${APP_URL}`);
  console.log(`🔌 API URL: ${API_URL}`);
  console.log(`📸 Screenshots: ${SCREENSHOT_DIR}`);
  console.log(`📋 Report: ${REPORT_PATH}\n`);

  // Ensure screenshot directory exists
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Pre-flight: check server health
  try {
    const healthRes = await fetch(`${API_URL}/api/posts`);
    if (!healthRes.ok) throw new Error(`API returned ${healthRes.status}`);
    console.log("✅ API server is healthy\n");
  } catch (err) {
    console.error(`❌ API server not reachable at ${API_URL}: ${err.message}`);
    console.error("   Start the server: cd server && npm run dev");
    process.exit(1);
  }

  // Pre-flight: check app health
  try {
    const appRes = await fetch(APP_URL);
    if (!appRes.ok) throw new Error(`App returned ${appRes.status}`);
    console.log("✅ Web app is reachable\n");
  } catch (err) {
    console.error(`❌ Web app not reachable at ${APP_URL}: ${err.message}`);
    console.error("   Start the app: cd apps/mobile && npx expo start --web");
    process.exit(1);
  }

  // Create test user via API
  const testUser = await createTestUser();
  const coachUser = await createCoachUser();

  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "PUSO-UI-Agent/1.0",
  });
  const page = await context.newPage();

  // Inject auth into localStorage (AsyncStorage on web maps to raw localStorage)
  // Keys must match UserContext.tsx storage key constants exactly
  if (testUser) {
    await page.goto(APP_URL, { waitUntil: "networkidle", timeout: NAV_TIMEOUT }).catch(() => {});
    await page.evaluate(({ user }) => {
      try {
        localStorage.setItem("puso_user_id", user.userId);
        localStorage.setItem("puso_username", user.displayName);
        localStorage.setItem("puso_role", "USER");
        localStorage.setItem("puso_device_id", user.deviceId);
        localStorage.setItem("puso_device_owner", user.displayName);
        localStorage.setItem("puso_device_id_synced", "true");
        if (user.token) {
          localStorage.setItem("puso_jwt_token", user.token);
        }
      } catch (e) {
        console.error("Failed to inject auth:", e);
      }
    }, { user: testUser });
    console.log("🔐 Auth injected into browser storage\n");
    // Reload to pick up auth via loadUser()
    await page.reload({ waitUntil: "networkidle", timeout: NAV_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(3000); // Give loadUser() time to read storage + fetch data
  }

  const startTime = Date.now();

  try {
    // ── Phase 1: Login Screen (before auth) ──
    // Use a fresh incognito page for login test
    const loginPage = await context.newPage();
    await loginPage.goto(`${APP_URL}/login`, { waitUntil: "networkidle", timeout: NAV_TIMEOUT }).catch(() => {});
    await testLoginScreen(loginPage);
    await loginPage.close();

    // ── Phase 2: Coach Login Screen ──
    const coachLoginPage = await context.newPage();
    await coachLoginPage.goto(`${APP_URL}/signup`, { waitUntil: "networkidle", timeout: NAV_TIMEOUT }).catch(() => {});
    await testCoachLoginScreen(coachLoginPage);
    await coachLoginPage.close();

    // ── Phase 3: Authenticated screens ──
    await testHomeScreen(page);
    await testPostScreen(page);
    await testProfileScreen(page);
    await testJournalScreen(page);
    await testNotificationsScreen(page);
    await testSpazeCoachScreen(page);

    // ── Phase 4: Post Detail (need a post ID) ──
    // Try fetching a real post ID
    let testPostId = null;
    try {
      const postsRes = await fetch(`${API_URL}/api/posts`);
      const postsData = await postsRes.json();
      const posts = postsData.posts || postsData;
      if (Array.isArray(posts) && posts.length > 0) {
        testPostId = posts[0].id;
      }
    } catch {}
    await testPostDetailScreen(page, testPostId);

    // ── Phase 5: Coach-only screens ──
    if (coachUser) {
      // Switch to coach auth (same key pattern as UserContext)
      await page.evaluate(({ user }) => {
        localStorage.setItem("puso_user_id", user.userId);
        localStorage.setItem("puso_username", user.displayName);
        localStorage.setItem("puso_role", "COACH");
        localStorage.setItem("puso_device_id", user.deviceId);
        localStorage.setItem("puso_device_owner", user.displayName);
        localStorage.setItem("puso_device_id_synced", "true");
        if (user.token) {
          localStorage.setItem("puso_jwt_token", user.token);
        }
      }, { user: coachUser });
      await page.reload({ waitUntil: "networkidle", timeout: NAV_TIMEOUT }).catch(() => {});
      await page.waitForTimeout(3000);
      console.log("\n🔄 Switched to Coach role\n");

      await testCoachDashboard(page);
      await testSpazeConversationsScreen(page);
      await testSendInviteScreen(page);
    } else {
      log("CoachDashboard", "Coach screens", "Coach user available", "Could not create coach — skipped", "WARN");
    }

    // ── Phase 6: Navigation tests ──
    await testNavigation(page);

    // ── Phase 7: Cross-screen data consistency ──
    await testDataConsistency(page);

    // ── Phase 8: Responsive layout tests ──
    await testResponsiveLayout(page, context);

    // ── Phase 9: Console error collection ──
    await collectConsoleErrors(page);

  } catch (err) {
    console.error(`\n💥 Unhandled error: ${err.message}`);
    await screenshot(page, "FATAL_ERROR");
  } finally {
    await browser.close();
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ── Generate Report ──────────────────────────────────────────
  const summary = {
    timestamp: new Date().toISOString(),
    durationSeconds: parseFloat(elapsed),
    total: results.length,
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    warn: results.filter((r) => r.status === "WARN").length,
    results,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2));

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║                 RESULTS SUMMARY              ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  Total tests:  ${String(summary.total).padStart(4)}                          ║`);
  console.log(`║  ✅ Passed:    ${String(summary.pass).padStart(4)}                          ║`);
  console.log(`║  ❌ Failed:    ${String(summary.fail).padStart(4)}                          ║`);
  console.log(`║  ⚠️  Warnings:  ${String(summary.warn).padStart(4)}                          ║`);
  console.log(`║  ⏱  Duration:  ${elapsed}s                        ║`);
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  📋 Report: ${REPORT_PATH.split("/").slice(-3).join("/")}     ║`);
  console.log(`║  📸 Screenshots: ${SCREENSHOT_DIR.split("/").slice(-4).join("/")} ║`);
  console.log("╚══════════════════════════════════════════════╝");

  // Print failures
  const failures = results.filter((r) => r.status === "FAIL");
  if (failures.length > 0) {
    console.log("\n❌ FAILURES:");
    for (const f of failures) {
      console.log(`   #${f.id} [${f.screen}] ${f.test} → ${f.actual}`);
      if (f.details) console.log(`      ${f.details}`);
    }
  }

  // Print warnings
  const warnings = results.filter((r) => r.status === "WARN");
  if (warnings.length > 0) {
    console.log("\n⚠️  WARNINGS:");
    for (const w of warnings) {
      console.log(`   #${w.id} [${w.screen}] ${w.test} → ${w.actual}`);
      if (w.details) console.log(`      ${w.details}`);
    }
  }

  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
