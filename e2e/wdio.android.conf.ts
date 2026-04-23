import path from "node:path";
import type { Options } from "@wdio/types";

const APK_PATH = path.resolve(
  __dirname,
  "../apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
);

export const config: Options.Testrunner = {
  runner: "local",
  tsConfigPath: "./tsconfig.json",

  specs: ["./tests/**/*.e2e.ts"],
  maxInstances: 1,

  capabilities: [
    {
      platformName: "Android",
      "appium:automationName": "UiAutomator2",
      "appium:deviceName": "Android Emulator",
      "appium:app": APK_PATH,
      "appium:appPackage": "com.pusospaze.app",
      "appium:appActivity": ".MainActivity",
      "appium:autoGrantPermissions": true,
      "appium:newCommandTimeout": 240,
      "appium:noReset": false,
    },
  ],

  logLevel: "info",
  bail: 0,
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // Connect to a separately-started Appium server (npm run appium).
  hostname: "127.0.0.1",
  port: 4723,
  path: "/",

  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },
};
