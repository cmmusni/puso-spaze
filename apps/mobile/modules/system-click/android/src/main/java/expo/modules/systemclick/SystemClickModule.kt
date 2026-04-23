package expo.modules.systemclick

import android.content.Context
import android.media.AudioManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SystemClickModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SystemClickModule")

    Function("play") {
      val context = appContext.reactContext
      if (context != null) {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        // Standard UI click sound effect (same one TouchableOpacity uses).
        am?.playSoundEffect(AudioManager.FX_KEY_CLICK)
      }
    }
  }
}
