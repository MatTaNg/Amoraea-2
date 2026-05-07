/**
 * Types aligned with https://audos.com/sdk/audos.js (SDK v1.1.x).
 */

export type AudosInitOptions = {
  apiKey: string;
  /** Defaults to https://audos.com when loading the SDK from audos.com (recommended for Expo web). */
  baseUrl?: string;
  debug?: boolean;
  /** Default true in Audos SDK */
  autoTrack?: boolean;
  pixelId?: string | null;
  consent?: unknown;
};

export type AudosIdentifyPayload = {
  email: string;
  name?: string;
  phone?: string;
  properties?: Record<string, unknown>;
  tags?: string[];
};

export type AudosMetaOptions = {
  eventId?: string;
  email?: string;
  phone?: string;
};

export type AudosCheckoutCreateOptions = {
  amount: number;
  currency?: string;
  productName?: string;
  productDescription?: string;
  successUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
  metadata?: Record<string, unknown>;
};

export type AudosSubscriptionCreateOptions = {
  priceId?: string;
  priceCents?: number;
  currency?: string;
  successUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
  trialDays?: number;
  metadata?: Record<string, unknown>;
  planTier?: string;
  interval?: string;
  intervalCount?: number;
  promoCode?: string;
};

/** Responses vary by Audos API version — narrow at call sites when needed. */
export type AudosJsonResult = Record<string, unknown>;

export type AudosQueuedCommand =
  | ['init', AudosInitOptions]
  | ['track', string]
  | ['track', string, Record<string, unknown>]
  | ['identify', AudosIdentifyPayload]
  | ['meta', string]
  | ['meta', string, Record<string, unknown>]
  | ['meta', string, Record<string, unknown>, AudosMetaOptions]
  | ['tag', string]
  | ['setDebug', boolean];
