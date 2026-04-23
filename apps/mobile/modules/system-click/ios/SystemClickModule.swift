import ExpoModulesCore
import AudioToolbox

public class SystemClickModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SystemClickModule")

    Function("play") {
      // 1104 is the standard "Tock" UI click on iOS — closest to a touch tick.
      AudioServicesPlaySystemSound(1104)
    }
  }
}
