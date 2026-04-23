import { browser, $ } from "@wdio/globals";

/**
 * UiAutomator selector for an element with `text="..."`.
 */
export const byText = (text: string) =>
  `android=new UiSelector().text(${JSON.stringify(text)})`;

/**
 * UiAutomator selector for an element whose text contains a substring.
 */
export const byTextContains = (text: string) =>
  `android=new UiSelector().textContains(${JSON.stringify(text)})`;

/**
 * UiAutomator selector for an element with the given accessibility id
 * (React Native `accessibilityLabel`). Equivalent to `~label` shorthand.
 */
export const byAccessibilityId = (id: string) => `~${id}`;

/**
 * Wait for the React Native root view to render after app launch.
 */
export async function waitForAppReady(timeout = 30_000): Promise<void> {
  const root = await $(
    'android=new UiSelector().className("android.view.ViewGroup")'
  );
  await root.waitForExist({ timeout });
}

/**
 * Save a screenshot to e2e/screenshots/<name>.png for debugging.
 */
export async function screenshot(name: string): Promise<void> {
  await browser.saveScreenshot(`./screenshots/${name}.png`);
}

/**
 * Scroll a UiScrollable container until the element with the given
 * accessibility id (content-desc) is visible. Returns the resolved element.
 * Uses UiAutomator's `scrollIntoView` so it works regardless of nested
 * scroll containers.
 */
export async function scrollToAccessibilityId(
  id: string
): Promise<WebdriverIO.Element> {
  const selector =
    'android=new UiScrollable(new UiSelector().scrollable(true)' +
    ".instance(0)).scrollIntoView(" +
    `new UiSelector().description(${JSON.stringify(id)}))`;
  return await $(selector);
}

/**
 * Tap an element identified by its visible text.
 */
export async function tapText(text: string): Promise<void> {
  const el = await $(byText(text));
  await el.waitForDisplayed({ timeout: 10_000 });
  await el.click();
}

/**
 * React Native renders nested <Text> inside a parent <Text>, which often
 * makes WebDriver `.click()` no-op against the inner press handler. Use
 * UiAutomator2's `mobile: clickGesture` against the element's center to
 * force a real tap that fires `onPress`.
 */
export async function tapElement(
  element: WebdriverIO.Element
): Promise<void> {
  await element.waitForDisplayed({ timeout: 10_000 });
  const id = (element as unknown as { elementId: string }).elementId;
  await browser.executeScript("mobile: clickGesture", [{ elementId: id }]);
}
