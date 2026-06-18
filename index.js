import { bootstrapWebPasswordRecoveryUrlFromWindow } from './src/features/authentication/webAuthRecoveryRouting';

if (typeof window !== 'undefined') {
  bootstrapWebPasswordRecoveryUrlFromWindow();
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);

