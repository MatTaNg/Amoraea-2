/** Vignette body markers for S2/S3 — shared without importing transition bundles (avoids circular init). */

export function textContainsScenarioBVignetteBody(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  // Require narrative vignette markers — not reflection/probe mentions of Sarah/James
  // ("celebrate", "appreciated") which appear in S2 closing reflections and Q2/Q3 probes.
  return (
    /sarah has been job hunting/.test(t) ||
    /sarah has been looking for work/.test(t) ||
    /sarah was looking for work/.test(t) ||
    /\bsarah and james\b/.test(t) ||
    (/\bsarah\b/.test(t) &&
      /\bjames\b/.test(t) &&
      /job hunting|looking for work|gets an offer|fight starts|blindsided|together for two years|mentions in passing|never feels appreciated|salary|deadline|commute/.test(
        t,
      ))
  );
}

export function textContainsScenarioCVignetteBody(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  return (
    /\bsophie and daniel\b/.test(t) &&
    (/same argument|same argument/.test(t) || /i need ten minutes/.test(t)) &&
    (/i didn'?t know how/.test(t) ||
      /i didn'?t know what to say|did not know what to say|i didn'?t know how|did not know how/.test(t) ||
      /\bstill upset\b/.test(t))
  );
}
