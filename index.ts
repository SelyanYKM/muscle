import { registerRootComponent } from 'expo';

import App from './App';
// Enregistre le handler du service au premier plan du minuteur de repos avant tout —
// Android doit pouvoir le retrouver même s'il relance l'app en tâche de fond.
import './src/utils/restTimerService';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
