/**
 * Aria – Voice-only matchmaker content.
 * Pillars grounded in Gottman, Sue Johnson, and relationship science.
 */

export const ARIA_INTRO =
  "Welcome to Amoraea. My name is Aria, and over the next 20 to 30 minutes I'd like to get to know you better so I can match you with partners you truly align with. " +
  "I'll ask you six focused questions about emotional regulation, how you resolve conflict, assert boundaries, and more. " +
  "These questions are designed to understand how you behave in relationships. " +
  "This approach is grounded in decades of relationship research, including the work of John Gottman, Sue Johnson, and other leading scientists studying what actually predicts long-term relationship success. " +
  "Whenever possible, answer from a real lived experience. If you don't have a clear example, just let me know and I'll give you a detailed scenario instead. " +
  "If you need to take any extra time to answer these questions, feel free to do so. You can take as much time as you need, and there are no right answers. " +
  "I'm here to understand your patterns so I can match you intentionally. Ready to begin?";

import type { AriaPillarId } from '@domain/models/AriaSession';

export type { AriaPillarId };

export interface AriaPillar {
  id: AriaPillarId;
  title: string;
  real: string;
  fallback: string;
  forces: string; // short label for what we're assessing
}

export const ARIA_PILLARS: AriaPillar[] = [
  {
    id: 'conflict_regulation_repair',
    title: 'Conflict, regulation & repair',
    real:
      "Think of a real argument where emotions were high. What did you do in the first 10 minutes, and what did you do to repair afterward?",
    fallback:
      "You and your partner are arguing about something that keeps coming up. They say, 'Why do I always have to explain this to you?' You feel blamed and misunderstood. Your heart rate goes up and you want to defend yourself. " +
      "What do you do in the next 10 minutes? What do you do later to repair the connection?",
    forces: 'Flooding, defensiveness, escalation control, repair timing',
  },
  {
    id: 'attachment_threat',
    title: 'Attachment threat: withdrawal vs pursuit',
    real:
      "Think of a time you felt emotionally disconnected from your partner. What did you do, and how did they respond?",
    fallback:
      "For the past few days, your partner has been quieter and less affectionate. When you ask if something's wrong, they say 'I'm fine, I just have a lot on my mind.' You still feel distance. " +
      "What do you do that day? What do you do if nothing changes over the next few days?",
    forces: 'Ambiguity tolerance, protest vs withdrawal, pressure vs patience',
  },
  {
    id: 'accountability_growth',
    title: 'Accountability & growth',
    real:
      "Tell us about something a partner asked you to change that was hard to hear. What actually changed afterward?",
    fallback:
      "Your partner says, 'When you shut down during conflict, I feel alone and unsafe.' You don't fully agree with their interpretation, but you can tell they're serious. " +
      "What do you say in that moment? What, if anything, do you change afterward?",
    forces: 'Ownership without collapse, defensiveness, adaptability',
  },
  {
    id: 'reliability_under_inconvenience',
    title: 'Reliability under inconvenience',
    real:
      "Describe a time you were tired, stressed, or unmotivated but your partner needed something from you. What did you do?",
    fallback:
      "You've had an exhausting day and were looking forward to being alone. Your partner asks to talk because they're upset. You really don't want to engage. " +
      "What do you do that night? How do you handle it if this happens repeatedly?",
    forces: 'Follow-through, resentment risk, emotional availability',
  },
  {
    id: 'responsiveness_to_bids',
    title: 'Responsiveness to bids (micro-moments)',
    real:
      "Think of a moment when your partner casually shared stress or good news. How did you respond?",
    fallback:
      "You're focused on something else when your partner says, 'Today was actually really hard for me.' They don't ask for help. They just say it. " +
      "What do you do in that moment? What do you do if you notice this happens often?",
    forces: 'Turning toward vs away, generosity of attention, irritation at needs',
  },
  {
    id: 'desire_mismatch_boundaries',
    title: 'Desire mismatch & boundaries',
    real:
      "Think of a time you and your partner wanted different levels of closeness or intimacy. How did you handle it?",
    fallback:
      "You want more closeness and intimacy than your partner does right now. They say they love you but need more space. " +
      "What do you do that night? What do you do over the next few weeks?",
    forces: 'Entitlement vs patience, withdrawal punishment, boundary respect, resentment formation',
  },
];
