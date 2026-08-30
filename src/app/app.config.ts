import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideServiceWorker} from '@angular/service-worker';

import {routes} from './app.routes';
import { StorageService, IndexedDbStorageService } from './core/services/storage.service';
import { EmulatorService, NesEmulatorService } from './core/services/emulator.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    { provide: StorageService, useClass: IndexedDbStorageService },
    { provide: EmulatorService, useClass: NesEmulatorService },
  ],
};
