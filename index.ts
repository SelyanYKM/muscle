import { registerRootComponent } from 'expo';
import notifee from 'react-native-notify-kit';

import App from './App';
import { registerRestTimerForegroundService, relayRestTimerNotifeeEvent } from './src/utils/restTimerNotifee';

// Doit être enregistré au niveau module, avant tout rendu : notifee exige un "runner" de
// Foreground Service déclaré dès le démarrage pour pouvoir afficher une notification de
// repos qui reste active tant qu'on ne l'arrête pas explicitement (voir restTimerNotifee.ts).
registerRestTimerForegroundService();

// Réception des appuis sur les boutons Pause/Reprendre/Passer de la notification de repos
// quand l'app est en arrière-plan (app ouverte : voir l'écouteur onForegroundEvent dans
// App.tsx). Les deux pointent vers la même fonction, qui relaie vers RestTimerOverlay.
notifee.onBackgroundEvent(async (event) => relayRestTimerNotifeeEvent(event));

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
