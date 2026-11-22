import { NativeModule, requireNativeModule } from 'expo';

declare class RestAlarmSoundModule extends NativeModule<{}> {
  playAlarm(): void;
}

export default requireNativeModule<RestAlarmSoundModule>('RestAlarmSound');
