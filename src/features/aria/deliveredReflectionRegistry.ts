import type { MutableRefObject } from 'react';

import { remoteLog } from '@utilities/remoteLog';

export type DeliveredReflectionSlot =
  | 'm4_grudge_to_threshold'
  | 'm4_threshold_to_m5'
  | 'scenario_boundary'
  | 'closing'
  | 'other';

export type DeliveredReflectionRecord = {
  slot: DeliveredReflectionSlot;
  text: string;
  deliveredAtMs: number;
};

export function normalizeReflectionText(text: string): string {
  return (text ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[.!?…]+$/, '');
}

function reflectionComparisonCore(text: string): string {
  const t = normalizeReflectionText(text);
  const withoutOpener = t.replace(
    /^(?:what (?:i (?:heard|got)|came through|landed for me) was that|you (?:focused on|named|framed|pointed to|highlighted))\s+/i,
    '',
  );
  return withoutOpener.trim();
}

/** True when two reflection sentences are the same or near-duplicates. */
export function reflectionsAreNearIdentical(a: string, b: string): boolean {
  const na = normalizeReflectionText(a);
  const nb = normalizeReflectionText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ca = reflectionComparisonCore(a);
  const cb = reflectionComparisonCore(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  const shorter = ca.length <= cb.length ? ca : cb;
  const longer = ca.length <= cb.length ? cb : ca;
  return longer.includes(shorter.slice(0, Math.min(48, shorter.length)));
}

export function deliveredReflectionTexts(registry: readonly DeliveredReflectionRecord[]): string[] {
  return registry.map((r) => r.text);
}

export function isReflectionDuplicateOfRegistry(
  registry: readonly DeliveredReflectionRecord[] | readonly string[],
  candidate: string,
): boolean {
  const trimmed = candidate.trim();
  if (!trimmed) return false;
  for (const entry of registry) {
    const prior = typeof entry === 'string' ? entry : entry.text;
    if (reflectionsAreNearIdentical(prior, trimmed)) return true;
  }
  return false;
}

export function registerDeliveredReflection(
  registryRef: MutableRefObject<DeliveredReflectionRecord[]>,
  slot: DeliveredReflectionSlot,
  reflectionText: string,
  logPayload?: Record<string, unknown>,
): void {
  const text = reflectionText.trim();
  if (!text) return;
  registryRef.current.push({ slot, text, deliveredAtMs: Date.now() });
  const payload = { slot, text, ...(logPayload ?? {}) };
  if (typeof console !== 'undefined' && console.log) {
    console.log('[ReflectionDelivered]', payload);
  }
  void remoteLog('[REFLECTION_DELIVERED]', payload);
}

export function extractLeadingReflectionFromMoment4ThresholdProbe(text: string): string | null {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  const marker = 'Thanks for sharing that.';
  const idx = raw.indexOf(marker);
  if (idx <= 0) return null;
  const lead = raw.slice(0, idx).trim();
  if (!lead || /at what point do you decide/i.test(lead)) return null;
  return lead.replace(/\n+/g, ' ').trim();
}

export function extractLeadingReflectionFromMoment5HandoffBundle(text: string): string | null {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  const pivot = "Here's one more question about you";
  const idx = raw.indexOf(pivot);
  if (idx <= 0) return null;
  const lead = raw.slice(0, idx).trim();
  if (!lead || /think of a time you really had a conflict/i.test(lead)) return null;
  return lead.replace(/\n+/g, ' ').trim();
}
