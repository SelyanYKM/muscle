package expo.modules.restalarmsound

import android.media.AudioAttributes
import android.media.SoundPool
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Joue le bip de fin de repos via SoundPool plutôt que expo-audio/ExoPlayer : SoundPool ne crée
 * jamais de MediaSession et ne demande jamais le focus audio, donc ne coupe/ne met jamais en
 * pause la musique ou la vidéo d'une autre appli (contrairement à expo-audio même configuré
 * mixWithOthers, confirmé en usage réel). C'est le mécanisme standard des sons d'interface/jeu sur
 * Android, conçu pour ça.
 *
 * USAGE_MEDIA (pas USAGE_ALARM) : "Alarme" force le haut-parleur du téléphone même casque/écouteurs
 * branchés (comportement volontaire d'Android pour les vrais réveils), ce qui donnait un son qui
 * démarre sur le téléphone puis bascule sur le casque en cours de lecture — confirmé en usage réel.
 * "Média" respecte directement la sortie audio déjà active (casque/écouteurs), sans ce bascule.
 */
class RestAlarmSoundModule : Module() {
  private var soundPool: SoundPool? = null
  private var soundId: Int = 0
  private var isLoaded = false
  private var playPending = false

  override fun definition() = ModuleDefinition {
    Name("RestAlarmSound")

    Function<Unit>("playAlarm") {
      val pool = soundPool ?: createPool()
      if (pool != null) {
        if (isLoaded) {
          pool.play(soundId, 1f, 1f, 1, 0, 1f)
        } else {
          playPending = true
        }
      }
    }

    OnDestroy {
      soundPool?.release()
      soundPool = null
    }
  }

  // Créé à la demande (au premier appel) plutôt qu'à OnCreate : le contexte React n'est pas
  // garanti disponible à ce stade-là, alors qu'il l'est forcément quand playAlarm() est appelé.
  private fun createPool(): SoundPool? {
    val context = appContext.reactContext ?: return null

    val attributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_MEDIA)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

    val pool = SoundPool.Builder()
      .setMaxStreams(1)
      .setAudioAttributes(attributes)
      .build()

    pool.setOnLoadCompleteListener { sp, _, status ->
      if (status == 0) {
        isLoaded = true
        if (playPending) {
          playPending = false
          sp.play(soundId, 1f, 1f, 1, 0, 1f)
        }
      }
    }

    soundId = pool.load(context, R.raw.rest_timer_alarm, 1)
    soundPool = pool
    return pool
  }
}
