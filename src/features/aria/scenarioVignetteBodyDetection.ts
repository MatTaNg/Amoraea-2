/** Vignette body markers for S2/S3 — shared without importing transition bundles (avoids circular init). */



export function textContainsScenarioBVignetteBody(text: string): boolean {

  const t = (text ?? '').trim().toLowerCase();

  if (!t) return false;

  // Require narrative vignette markers — not reflection/probe mentions of Sarah/James

  // ("celebrate", "appreciated") which appear in S2 closing reflections and Q2/Q3 probes.

  // Also catch known wrong/legacy S2 fiction so TTS can rewrite to the job-offer vignette.

  return (

    /sarah has been job hunting/.test(t) ||

    /sarah has been looking for work/.test(t) ||

    /sarah was looking for work/.test(t) ||

    /sarah has just got(?:ten)? a promotion/.test(t) ||

    /sarah has been planning a birthday/.test(t) ||

    /sarah has been working late/.test(t) ||

    /sarah has been feeling underappreciated/.test(t) ||

    (/\bsarah\b/.test(t) &&

      /\bjames\b/.test(t) &&

      /job hunting|looking for work|gets an offer|fight starts|blindsided|together for two years|mentions in passing|never feels appreciated|salary|deadline|commute|promotion|comes home excited|working late|birthday dinner|must be nice to finally/.test(

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



/** Authoritative Situation 3 script markers (leave / ten minutes / same argument). */

function textHasCanonicalScenarioCScriptMarkers(text: string): boolean {

  const t = text.toLowerCase();

  return (

    /same argument/.test(t) ||

    /i need ten minutes/.test(t) ||

    /we need to finish this/.test(t) ||

    /can'?t just keep avoiding/.test(t) ||

    /didn'?t know what to say/.test(t) ||

    /should have come back sooner/.test(t) ||

    /sophie is still upset/.test(t)

  );

}



/**

 * Model-invented Sophie/Daniel stories that are NOT the authoritative Situation 3 vignette.

 * Used to suppress/rewrite fiction — never invents alternate vignette copy.

 *

 * Continuations often drop names mid-paragraph ("She's close to her family…"); those must

 * still match so parallel TTS does not speak half a fake situation.

 */

export function looksLikeNonCanonicalScenarioCVignetteFiction(text: string): boolean {

  const t = (text ?? '').trim().toLowerCase();

  if (!t) return false;



  if (

    /launches into (?:his|her) own story/.test(t) ||

    /i'?ve been through that too/.test(t) ||

    /i guess i just don'?t belong anywhere/.test(t) ||

    /outsider in (?:her|his|my) own family/.test(t) ||

    /close to (?:her|his) family and sees them every sunday/.test(t) ||

    /daniel has started coming along/.test(t) ||

    /on the drive home (?:sophie|she) waited/.test(t) ||

    /went quiet and went to bed early/.test(t) ||

    (/sister made a comment/.test(t) && /(?:family|sophie|daniel|outsider)/.test(t)) ||

    (/don'?t say that/.test(t) && /it'?s not true/.test(t) && /(?:sophie|daniel|family)/.test(t))

  ) {

    return true;

  }



  const hasSophie = /\bsophie\b/.test(t);

  const hasDaniel = /\bdaniel\b/.test(t);

  if (!hasSophie && !hasDaniel) return false;



  /** Repair / Q probes — not vignette fiction. */

  if (

    /\bhow would you repair\b/.test(t) ||

    /\bif you were (?:sophie|daniel)\b/.test(t) ||

    /\bwhat do you make of that\b/.test(t) ||

    /\bwhen daniel comes back\b/.test(t)

  ) {

    return false;

  }



  if (textHasCanonicalScenarioCScriptMarkers(t)) {

    return false;

  }



  return (

    /trying to get closer/.test(t) ||

    /have been together for/.test(t) ||

    /dating for (?:a few|\d+|eight|six|two|three|four|five|seven|nine|ten)/.test(t) ||

    /(?:hard week|work stress|not sleeping well|generally feeling low)/.test(t) ||

    /sophie has been/.test(t) ||

    /she'?s close to (?:her )?family/.test(t) ||

    /daniel (?:always|keeps|tends to)/.test(t) ||

    (/when they fight/.test(t) &&

      /leave the room|goes quiet|feels abandoned|needs space/.test(t)) ||

    (hasSophie &&

      hasDaniel &&

      /(?:together|dating|family|sunday|argument|fight|silent|quiet|leaves|leave|sister|outsider)/.test(

        t,

      ))

  );

}


