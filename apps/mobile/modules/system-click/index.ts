import { requireNativeModule } from "expo-modules-core";

type SystemClickModuleType = {
  play(): void;
};

const SystemClickModule = requireNativeModule<SystemClickModuleType>("SystemClickModule");

export function playSystemClick(): void {
  try {
    SystemClickModule.play();
  } catch {
    // no-op
  }
}
