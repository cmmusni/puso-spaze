# PUSO Spaze — Appium E2E

End-to-end tests for the native Android app using **Appium 2 + WebdriverIO + Mocha**.

## Prerequisites

- Node.js 18+
- Android SDK with `adb` on `PATH`
- A running emulator: `emulator -avd Pixel_Tablet_35` (or any AVD)
- JDK 17 — set `JAVA_HOME` (e.g. `export JAVA_HOME=$(/usr/libexec/java_home -v 17)`)
- Debug APK built at `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
  - Build via: `cd apps/mobile/android && ./gradlew app:assembleDebug -x lint -x test`

## One-time install

```bash
# Global Appium server + Android driver (already done if you followed setup)
npm install -g appium
appium driver install uiautomator2

# Local test deps
cd e2e
npm install
```

## Run

In **one terminal**, start the Appium server:

```bash
cd e2e
npm run appium
```

In **another terminal**, run the tests against the running emulator:

```bash
cd e2e
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
npm run test:smoke
```

## Adding tests

Drop new files under `e2e/tests/` matching `*.e2e.ts`. Use UiAutomator selectors
for native React Native views, e.g.:

```ts
await $('android=new UiSelector().textContains("Sign in")').click();
await $('android=new UiSelector().resourceId("com.pusospaze.app:id/...")');
```

For React Native components, add `accessibilityLabel="login-button"` in the
component, then locate via:

```ts
await $('~login-button').click();
```

## Tips

- Use **Appium Inspector** (https://github.com/appium/appium-inspector/releases)
  to explore the UI tree and copy selectors.
- React Native exposes `accessibilityLabel` as `content-desc` → `~label` selector.
- For Detox-style stable selectors, prefer `accessibilityLabel` over text.
