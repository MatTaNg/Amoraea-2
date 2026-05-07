import { Platform } from 'react-native';
import type {
  AudosCheckoutCreateOptions,
  AudosIdentifyPayload,
  AudosInitOptions,
  AudosJsonResult,
  AudosMetaOptions,
  AudosQueuedCommand,
  AudosSubscriptionCreateOptions,
} from './types';

export type {
  AudosCheckoutCreateOptions,
  AudosIdentifyPayload,
  AudosInitOptions,
  AudosMetaOptions,
  AudosSubscriptionCreateOptions,
} from './types';

const SCRIPT_ID = 'audos-sdk-script';
const SCRIPT_SRC = 'https://audos.com/sdk/audos.js';
const DEFAULT_BASE_URL = 'https://audos.com';

/** Narrow internal shape — matches hosted audos.js exports we call from TS. */
export type AudosNativeInstance = {
  version?: string;
  init: (options: AudosInitOptions) => unknown;
  track: (eventType: string, properties?: Record<string, unknown>) => Promise<AudosJsonResult>;
  identify: (userData: AudosIdentifyPayload) => Promise<AudosJsonResult>;
  meta: (
    eventName: string,
    eventData?: Record<string, unknown>,
    options?: AudosMetaOptions
  ) => Promise<AudosJsonResult>;
  tag: (tagName: string) => Promise<AudosJsonResult>;
  getVisitorId: () => string | null;
  getSessionId: () => string | null;
  setDebug: (enabled: boolean) => unknown;
  payments: {
    createCheckout: (options: AudosCheckoutCreateOptions) => Promise<AudosJsonResult>;
    createSubscription: (options: AudosSubscriptionCreateOptions) => Promise<AudosJsonResult>;
    getSessionStatus: (sessionId: string) => Promise<AudosJsonResult>;
  };
};

declare global {
  interface Window {
    _audosQueue?: AudosQueuedCommand[];
    audos?: AudosNativeInstance;
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function ensureQueue(): AudosQueuedCommand[] {
  if (typeof window === 'undefined') return [];
  window._audosQueue = window._audosQueue ?? [];
  return window._audosQueue;
}

function queue(cmd: AudosQueuedCommand): void {
  ensureQueue().push(cmd);
}

function getNativeAudos(): AudosNativeInstance | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.audos;
}

/**
 * Injects audos.js once and resolves when the script has executed (window.audos available).
 */
export function loadAudosScript(): Promise<void> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return Promise.resolve();
  }

  if (getNativeAudos()) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (getNativeAudos()) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('[Audos] Script failed to load')), {
        once: true,
      });
      return;
    }

    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.async = true;
    s.src = SCRIPT_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('[Audos] Script failed to load'));
    document.head.appendChild(s);
  });

  return scriptLoadPromise;
}

/**
 * Queue-friendly init (safe before the script loads). Matches:
 * `(window._audosQueue = ...).push(['init', { apiKey, autoTrack }]);`
 */
export function initAudos(options: AudosInitOptions): void {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    if (__DEV__) {
      console.warn('[Audos] init skipped: missing apiKey (set EXPO_PUBLIC_AUDOS_API_KEY)');
    }
    return;
  }

  if (Platform.OS !== 'web') {
    if (__DEV__) {
      console.warn('[Audos] Web SDK not loaded on native; events are no-ops.');
    }
    return;
  }

  const merged: AudosInitOptions = {
    ...options,
    apiKey,
    baseUrl: (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
  };

  queue(['init', merged]);
  void loadAudosScript().catch(() => {
    /* surfaced by callers if they await concrete APIs */
  });
}

/** Initialize from Expo env (recommended). */
export function initAudosFromEnv(): void {
  initAudos({
    apiKey: process.env.EXPO_PUBLIC_AUDOS_API_KEY?.trim() ?? '',
    autoTrack: process.env.EXPO_PUBLIC_AUDOS_AUTO_TRACK !== 'false',
    baseUrl: process.env.EXPO_PUBLIC_AUDOS_BASE_URL?.trim() || DEFAULT_BASE_URL,
    pixelId: process.env.EXPO_PUBLIC_AUDOS_PIXEL_ID?.trim() || undefined,
    debug: process.env.EXPO_PUBLIC_AUDOS_DEBUG === 'true',
  });
}

async function withInstance<T>(
  run: (a: AudosNativeInstance) => Promise<T>
): Promise<T | undefined> {
  if (Platform.OS !== 'web') return undefined;
  try {
    await loadAudosScript();
  } catch {
    return undefined;
  }
  const a = getNativeAudos();
  if (!a) return undefined;
  return run(a);
}

/**
 * Facade matching documented Audos usage (`audos.track`, `audos.identify`, …).
 * On native builds these resolve to `undefined` without throwing.
 */
export const audos = {
  async track(eventType: string, properties?: Record<string, unknown>) {
    return withInstance((a) => a.track(eventType, properties ?? {}));
  },

  async identify(userData: AudosIdentifyPayload) {
    return withInstance((a) => a.identify(userData));
  },

  async meta(eventName: string, eventData?: Record<string, unknown>, options?: AudosMetaOptions) {
    return withInstance((a) => a.meta(eventName, eventData ?? {}, options));
  },

  async tag(tagName: string) {
    return withInstance((a) => a.tag(tagName));
  },

  getVisitorId(): string | null | undefined {
    return Platform.OS === 'web' ? getNativeAudos()?.getVisitorId() : undefined;
  },

  getSessionId(): string | null | undefined {
    return Platform.OS === 'web' ? getNativeAudos()?.getSessionId() : undefined;
  },

  setDebug(enabled: boolean): void {
    if (Platform.OS !== 'web') return;
    queue(['setDebug', enabled]);
    void loadAudosScript();
  },

  payments: {
    async createCheckout(options: AudosCheckoutCreateOptions) {
      return withInstance((a) => a.payments.createCheckout(options));
    },

    async createSubscription(options: AudosSubscriptionCreateOptions) {
      return withInstance((a) => a.payments.createSubscription(options));
    },

    async getSessionStatus(sessionId: string) {
      return withInstance((a) => a.payments.getSessionStatus(sessionId));
    },
  },
};
