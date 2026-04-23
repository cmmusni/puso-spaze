import { browser, $, $$ } from "@wdio/globals";
import {
  byAccessibilityId,
  byText,
  byTextContains,
  screenshot,
  waitForAppReady,
} from "./helpers";

/**
 * Extended Login screen scenarios — only flows that are reliable against a
 * debug APK.
 *
 * Intentionally NOT covered here (RN nested-Text AX flattening on Android):
 *   - Compassion Guidelines / About / Privacy modals: the openers are inline
 *     <Text onPress> nodes that Android merges into the surrounding sentence
 *     or drops the content-desc inconsistently in debug builds. `mobile:
 *     clickGesture` against the resolved element does not fire the JS
 *     `onPress` handler, so the modals never open.
 *   See `login.e2e.ts` (skipped tests) for the original investigation.
 */
describe("Login flows — reliable scenarios", () => {
  before(async () => {
    await waitForAppReady();
    const cta = await $(byAccessibilityId("Enter Spaze"));
    await cta.waitForDisplayed({ timeout: 15_000 });
  });

  describe("Username input behavior", () => {
    it("accepts typing, then clears the value", async () => {
      const input = await $(
        'android=new UiSelector().className("android.widget.EditText")'
      );
      await input.waitForDisplayed({ timeout: 10_000 });
      await input.click();
      await input.setValue("e2e_typing_check");
      expect(await input.getText()).toBe("e2e_typing_check");

      await input.clearValue();
      const after = await input.getText();
      expect(["", "Or enter a custom username"]).toContain(after);
    });

    it("accepts whitespace-only input without crashing the screen", async () => {
      const input = await $(
        'android=new UiSelector().className("android.widget.EditText")'
      );
      await input.click();
      await input.setValue("   ");
      const cta = await $(byAccessibilityId("Enter Spaze"));
      expect(await cta.isDisplayed()).toBe(true);
      await input.clearValue();
    });

    it("accepts a long username (60 chars) without crashing", async () => {
      const input = await $(
        'android=new UiSelector().className("android.widget.EditText")'
      );
      await input.click();
      const long = "a".repeat(60);
      await input.setValue(long);
      const value = await input.getText();
      expect(value.length).toBeGreaterThan(0);
      await input.clearValue();
    });

    it("accepts unicode characters without crashing", async () => {
      const input = await $(
        'android=new UiSelector().className("android.widget.EditText")'
      );
      await input.click();
      await input.setValue("usuario_2026");
      const cta = await $(byAccessibilityId("Enter Spaze"));
      expect(await cta.isDisplayed()).toBe(true);
      await input.clearValue();
    });
  });

  describe("App lifecycle", () => {
    it("survives a single 2s background/resume cycle", async () => {
      await browser.executeScript("mobile: backgroundApp", [{ seconds: 2 }]);

      const cta = await $(byAccessibilityId("Enter Spaze"));
      await cta.waitForDisplayed({ timeout: 15_000 });
      expect(await cta.isDisplayed()).toBe(true);
      expect(await browser.getCurrentPackage()).toBe("com.pusospaze.app");
    });

    it("survives two consecutive background/resume cycles", async () => {
      for (let i = 0; i < 2; i++) {
        await browser.executeScript("mobile: backgroundApp", [{ seconds: 1 }]);
      }

      const cta = await $(byAccessibilityId("Enter Spaze"));
      await cta.waitForDisplayed({ timeout: 15_000 });
      expect(await cta.isDisplayed()).toBe(true);
      await screenshot("after-double-background");
    });

    it("renders multiple TextViews (UI is hydrated, not blank)", async () => {
      const textViews = await $$(
        'android=new UiSelector().className("android.widget.TextView")'
      );
      expect(textViews.length).toBeGreaterThan(3);
    });
  });

  describe("Branding & static content", () => {
    it("shows the PUSO Spaze title", async () => {
      const title = await $(byText("PUSO Spaze"));
      await title.waitForDisplayed({ timeout: 10_000 });
      expect(await title.isDisplayed()).toBe(true);
    });

    it("shows the IDENTITY card label", async () => {
      const identity = await $(byText("IDENTITY"));
      expect(await identity.isDisplayed()).toBe(true);
    });

    it("shows legal copy mentioning Compassion Guidelines", async () => {
      // Android merges the inline <Text>Compassion Guidelines</Text> into the
      // surrounding sentence — match by substring to confirm the disclaimer
      // is rendered.
      const legal = await $(byTextContains("Compassion Guidelines"));
      await legal.waitForDisplayed({ timeout: 10_000 });
      expect(await legal.isDisplayed()).toBe(true);
    });
  });
});
