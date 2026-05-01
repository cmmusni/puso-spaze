import { requireNativeModule } from "expo-modules-core";

type SystemClickModuleType = {
  play(): void;
  vibrate(ms: number): boolean;
  hasVibrator(): boolean;
};

const SystemClickModule = requireNativeModule<SystemClickModuleType>("SystemClickModule");

export function playSystemClick(): void {
  try {
    SystemClickModule.play();
  } catch {
    // no-op
  }
}

// Direct vibrator pulse. Bypasses the system "Touch feedback" toggle that
// silently kills RN Vibration / expo-haptics on some devices.
// Returns true if the call was issued (does not guarantee user felt it).
export function systemVibrate(ms: number): boolean {
  try {
    return SystemClickModule.vibrate(Math.max(1, Math.floor(ms)));
  } catch {
    return false;
  }
}

// Diagnostic: does the device have a vibrator motor at all?
export function hasVibrator(): boolean {
  try {
    return SystemClickModule.hasVibrator();
  } catch {
    return false;
  }
}
