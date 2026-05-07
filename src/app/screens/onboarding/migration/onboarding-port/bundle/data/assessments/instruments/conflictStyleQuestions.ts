export type ConflictStyle =
  | "competing"
  | "collaborating"
  | "compromising"
  | "avoiding"
  | "accommodating";

export interface ConflictStylePair {
  id: number;
  prompt: string;
  optionA: { text: string; style: ConflictStyle };
  optionB: { text: string; style: ConflictStyle };
}

export const CONFLICT_STYLE_PAIRS: ConflictStylePair[] = [
  {
    id: 1,
    prompt: "When a disagreement isn't going anywhere:",
    optionA: {
      text: "I usually try to restate my position clearly and hold to it until something moves.",
      style: "competing",
    },
    optionB: {
      text: "I tend to ask more questions — I find it helps to understand what's behind each other's position.",
      style: "collaborating",
    },
  },
  {
    id: 2,
    prompt: "When a conflict feels like it can't be resolved right now:",
    optionA: {
      text: "I sometimes find it useful to step back and let it breathe rather than push for a resolution.",
      style: "avoiding",
    },
    optionB: {
      text: "I tend to go along with what my partner wants — I find that usually eases things between us.",
      style: "accommodating",
    },
  },
  {
    id: 3,
    prompt: "When we both want different things:",
    optionA: {
      text: "I usually try to find a middle ground — I think giving a little on both sides tends to work well.",
      style: "compromising",
    },
    optionB: {
      text: "I tend to keep exploring until we find something that works properly for both of us.",
      style: "collaborating",
    },
  },
  {
    id: 4,
    prompt: "When I believe I'm right about something important:",
    optionA: {
      text: "I tend to keep making my case — I find it important that my view gets a fair hearing.",
      style: "competing",
    },
    optionB: {
      text: "I'll usually try to meet halfway, even when I think my position was stronger.",
      style: "compromising",
    },
  },
  {
    id: 5,
    prompt: "When a conflict gets emotionally intense:",
    optionA: {
      text: "I usually try to stay in it — I find it helps to understand what's underneath things even when it's hard.",
      style: "collaborating",
    },
    optionB: {
      text: "I tend to create some distance first — I find things usually go better once we've both had space.",
      style: "avoiding",
    },
  },
  {
    id: 6,
    prompt: "When my partner wants something I'm not fully on board with:",
    optionA: {
      text: "I usually try to negotiate something we can both live with.",
      style: "compromising",
    },
    optionB: {
      text: "I tend to go with what they want — I find keeping things smooth often matters more than the specific outcome.",
      style: "accommodating",
    },
  },
  {
    id: 7,
    prompt: "When a conversation hits a wall:",
    optionA: {
      text: "I tend to try to get my point across before we step back from it.",
      style: "competing",
    },
    optionB: {
      text: "I usually find it more useful to pull back for a while — I think some things resolve better with time.",
      style: "avoiding",
    },
  },
  {
    id: 8,
    prompt: "When my partner is upset with me:",
    optionA: {
      text: "I tend to try to work through it together — I find we usually both need to feel heard before things improve.",
      style: "collaborating",
    },
    optionB: {
      text: "I usually focus on making them feel better first — I find that tends to help more than airing my own side.",
      style: "accommodating",
    },
  },
  {
    id: 9,
    prompt: "When a disagreement is dragging on:",
    optionA: {
      text: "I tend to propose a practical split — I find it helps to have something concrete to move forward with.",
      style: "compromising",
    },
    optionB: {
      text: "I sometimes find it better to set it aside — I think forcing a resolution before it's ready rarely helps.",
      style: "avoiding",
    },
  },
  {
    id: 10,
    prompt: "When we disagree about something that matters to me:",
    optionA: {
      text: "I usually try to make sure my position gets real consideration before we land anywhere.",
      style: "competing",
    },
    optionB: {
      text: "I tend to defer to my partner — I find it's often easier than letting it turn into a bigger thing.",
      style: "accommodating",
    },
  },
  {
    id: 11,
    prompt: "When a topic keeps coming up and I'm worn down by it:",
    optionA: {
      text: "I sometimes find it useful to disengage for a while rather than keep going around in circles.",
      style: "avoiding",
    },
    optionB: {
      text: "I tend to give in on it — I find that sometimes just removing the friction is worth it.",
      style: "accommodating",
    },
  },
  {
    id: 12,
    prompt: "When my partner challenges a decision I've already made:",
    optionA: {
      text: "I tend to defend it — I usually find it important to be clear about where I stand.",
      style: "competing",
    },
    optionB: {
      text: "I try to hear them out properly — I find I sometimes reconsider things when I understand their reasoning.",
      style: "collaborating",
    },
  },
  {
    id: 13,
    prompt: "When we need to repair after a fight:",
    optionA: {
      text: "I tend to try to agree on what we'll each do differently and close it out — I find moving forward helps more than revisiting it.",
      style: "compromising",
    },
    optionB: {
      text: "I usually try to talk through what actually happened for each of us first — I find repair works better when we both feel understood.",
      style: "collaborating",
    },
  },
  {
    id: 14,
    prompt: "When I feel strongly that my approach is better:",
    optionA: {
      text: "I tend to advocate for it fully — I find it's worth pushing for something if I think it's genuinely the right call.",
      style: "competing",
    },
    optionB: {
      text: "I usually try to blend my approach with theirs — I find we're both more committed when we've each had input.",
      style: "compromising",
    },
  },
  {
    id: 15,
    prompt: "When something my partner said hurt me:",
    optionA: {
      text: "I tend to bring it up — I usually find it helps to understand what happened on both sides.",
      style: "collaborating",
    },
    optionB: {
      text: "I sometimes find it better to let it pass — I think raising smaller things can sometimes do more harm than good.",
      style: "avoiding",
    },
  },
  {
    id: 16,
    prompt: "When my partner pushes back on something I want:",
    optionA: {
      text: "I usually try to find a version that works for both of us — I find a fair trade tends to stick better anyway.",
      style: "compromising",
    },
    optionB: {
      text: "I tend to let them have it — I find that the relationship usually matters more to me than the specific thing.",
      style: "accommodating",
    },
  },
  {
    id: 17,
    prompt: "When a conflict is still unresolved at the end of the day:",
    optionA: {
      text: "I tend to want to keep going — I find an open loop is usually harder to sit with than the conversation itself.",
      style: "competing",
    },
    optionB: {
      text: "I usually find it helps to sleep on it — I think a night apart from it often does more than pushing through tired.",
      style: "avoiding",
    },
  },
  {
    id: 18,
    prompt: "When my partner is clearly more invested in an outcome than I am:",
    optionA: {
      text: "I still try to make sure my perspective is part of the conversation — I find it usually leads to a better outcome.",
      style: "collaborating",
    },
    optionB: {
      text: "I tend to step back and let them lead — I find that when something matters more to them, deferring makes sense.",
      style: "accommodating",
    },
  },
  {
    id: 19,
    prompt: "When a conflict keeps resurfacing:",
    optionA: {
      text: "I tend to try to work out some kind of practical agreement — I find even an imperfect deal helps stop the cycle.",
      style: "compromising",
    },
    optionB: {
      text: "I sometimes find it more useful to disengage for a while — I think forcing it usually makes things worse.",
      style: "avoiding",
    },
  },
  {
    id: 20,
    prompt: "When we see a situation completely differently:",
    optionA: {
      text: "I tend to hold my ground — I find that giving up my view without being heard doesn't actually resolve anything.",
      style: "competing",
    },
    optionB: {
      text: "I'll often try to adopt their framing — I find that staying connected usually matters more to me than being right.",
      style: "accommodating",
    },
  },
];
