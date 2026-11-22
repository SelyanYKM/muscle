import { registerWebModule, NativeModule } from 'expo';

// Pas de SoundPool sur le web : no-op (le web n'est utilisé que pour le développement/les tests).
class RestAlarmSoundModule extends NativeModule<{}> {
  playAlarm() {}
}

export default registerWebModule(RestAlarmSoundModule, 'RestAlarmSoundModule');
