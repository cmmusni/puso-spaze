package expo.modules.systemclick

import android.content.Context
import android.media.AudioManager
import android.os.Build
import android.os.Vibrator
import android.os.VibratorManager
import android.os.VibrationEffect
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

    // Direct vibrator call. Bypasses the "Touch feedback" / "System haptics"
    // global toggle (those only affect performHapticFeedback + soundEffects).
    // Only needs the VIBRATE permission, which is declared in app.json.
    // ms: vibration duration in milliseconds (default 10).
    Function("vibrate") { ms: Int ->
      val context = appContext.reactContext ?: return@Function false
      try {
        val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
          vm?.defaultVibrator
        } else {
          @Suppress("DEPRECATION")
          context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
        if (vibrator == null || !vibrator.hasVibrator()) return@Function false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          vibrator.vibrate(
            VibrationEffect.createOneShot(
              ms.toLong(),
              VibrationEffect.DEFAULT_AMPLITUDE
            )
          )
        } else {
          @Suppress("DEPRECATION")
          vibrator.vibrate(ms.toLong())
        }
        true
      } catch (e: Throwable) {
        false
      }
    }

    // Reports whether the device actually has a vibrator motor.
    // Useful for diagnostics on tablets that may lack hardware.
    Function("hasVibrator") {
      val context = appContext.reactContext ?: return@Function false
      try {
        val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
          vm?.defaultVibrator
        } else {
          @Suppress("DEPRECATION")
          context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
        vibrator?.hasVibrator() == true
      } catch (e: Throwable) {
        false
      }
    }
  }
}
