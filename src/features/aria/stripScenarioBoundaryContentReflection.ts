import { INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS } from '@features/aria/interviewTransitionBundles';
import { isScenarioBoundaryPositiveAddressReflection } from '@features/aria/interviewReflectionTextStrips';

/**
 * Remove "Nice work, {name} — …" / "What I heard was…" content reflections from a
 * scenario-boundary handoff. No-op while {@link INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS} is true.
 */
export function stripScenarioBoundaryContentReflection(text: string): string {
  if (INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS) return text;
  let t = (text ?? '').trim();
  if (!t) return text;

  t = t.replace(
    /(?:Nice|Good)\s+work(?:,\s+[A-Za-z][\w'-]*)?\s*[—\-–:]\s*[^.!?\n]+[.!?]?\s*/gi,
    '',
  );
  t = t.replace(
    /What\s+(?:I\s+(?:heard|got)|came through|landed for me)\s+was\s+(?:that\s+)?[^.!?\n]+[.!?]?\s*/gi,
    '',
  );
  t = t.replace(
    /You\s+(?:focused on|named|framed|pointed to|highlighted|saw|recognized|picked up on|read)\s+[^.!?\n]+[.!?]?\s*/gi,
    '',
  );
  return t.replace(/[ \t]{2,}/g, ' ').replace(/ \n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** True when this streamed sentence is only a boundary content reflection and should not be spoken. */
export function shouldDropScenarioBoundaryContentReflectionSentence(text: string): boolean {
  if (INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS) return false;
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (isScenarioBoundaryPositiveAddressReflection(t)) return true;
  if (
    /^(?:What\s+(?:I\s+(?:heard|got)|came through|landed for me)\s+was)\b/i.test(t) &&
    !/\?/.test(t)
  ) {
    return true;
  }
  return false;
}
