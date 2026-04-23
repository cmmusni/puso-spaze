import { browser, $, $$ } from "@wdio/globals";
import {
  byAccessibilityId,
  byText,
  byTextContains,
  screenshot,
  tapElement,
  waitForAppReady,
} from "./helpers";

describe("Login screen — UI", () => {
  before(async () => {
    await waitForAppReady();
  });

  it("displays the PUSO Spaze title and IDENTITY card label", async () => {
    const title = await $(byText("PUSO Spaze"));
    await title.waitForDisplayed({ timeout: 15_000 });
    expect(await title.isDisplayed()).toBe(true);

    const identityLabel = await $(byText("IDENTITY"));
    expect(await identityLabel.isDisplayed()).toBe(true);
  });

  it("shows the Enter Spaze CTA via accessibility label", async () => {
    const cta = await $(byAccessibilityId("Enter Spaze"));
    await cta.waitForDisplayed({ timeout: 10_000 });
    expect(await cta.isDisplayed()).toBe(true);
  });

  it("renders an anonymous username matching the expected pattern", async () => {
    const anonRegex = /^[A-Z][a-z]+[A-Z][a-z]+\d{0,4}$/;
    const elements = await $$(
      'android=new UiSelector().className("android.widget.TextView")'
    );
    let foundAnon: string | undefined;
    for (const el of elements) {
      const txt = await el.getText();
      if (anonRegex.test(txt)) {
        foundAnon = txt;
        break;
      }
    }
    expect(foundAnon).toBeDefined();
  });

  it("accepts a custom username in the input field", async () => {
    const input = await $(
      'android=new UiSelector().className("android.widget.EditText")'
    );
    await input.waitForDisplayed({ timeout: 10_000 });
    await input.click();
    await input.setValue("e2e_tester_42");
    expect(await input.getText()).toBe("e2e_tester_42");

    // Clear before next test.
    await input.clearValue();
  });

  // SKIPPED: React Native renders nested <Text onPress=...> nodes inside a parent
  // <Text>; on Android the parent View receives the tap, so the inner press handler
  // doesn't fire via UiAutomator2 (.click() and mobile:clickGesture both no-op).
  // Workaround would be to compute exact text-glyph coordinates and tap, or to
  // refactor LoginScreen to wrap each link in a Pressable with a measurable hit area.
  it.skip("opens and closes the Compassion Guidelines modal", async () => {
    const link = await $(byTextContains("Compassion Guidelines"));
    await tapElement(link);

    const understand = await $(byText("I Understand"));
    await understand.waitForDisplayed({ timeout: 10_000 });
    await tapElement(understand);
    await understand.waitForDisplayed({ reverse: true, timeout: 10_000 });
  });

  it.skip("opens and closes the About modal", async () => {
    const aboutLink = await $(byText("About the Spaze"));
    await tapElement(aboutLink);

    const aboutTitle = await $(byText("About PUSO Spaze"));
    await aboutTitle.waitForDisplayed({ timeout: 10_000 });

    const close = await $(byText("Close"));
    await tapElement(close);
    await aboutTitle.waitForDisplayed({ reverse: true, timeout: 10_000 });
  });

  it.skip("opens and closes the Privacy Policy modal", async () => {
    const privacyLink = await $(byText("Privacy"));
    await tapElement(privacyLink);

    const privacyTitle = await $(byText("Privacy Policy"));
    await privacyTitle.waitForDisplayed({ timeout: 10_000 });

    const close = await $(byText("Close"));
    await tapElement(close);
    await privacyTitle.waitForDisplayed({ reverse: true, timeout: 10_000 });
  });

  it("login screen is still functional after interactions", async () => {
    const cta = await $(byAccessibilityId("Enter Spaze"));
    expect(await cta.isDisplayed()).toBe(true);
    await screenshot("login-final-state");
  });
});
