/**
 * Constants for AdditionalInfoScreen
 */

export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "CHF",
  "CNY",
  "INR",
  "BRL",
];

export const DIETS = [
  "No specific diet",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Keto",
  "Paleo",
  "Mediterranean",
  "Intermittent Fasting",
  "Low Carb",
  "Gluten-Free",
  "Dairy-Free",
  "Other",
];

export type HabitLevel = "never" | "occasionally" | "sometimes" | "often";

export const HABIT_OPTIONS: { label: string; value: HabitLevel }[] = [
  { label: "Never", value: "never" },
  { label: "Occasionally", value: "occasionally" },
  { label: "Sometimes", value: "sometimes" },
  { label: "Often", value: "often" },
];

export type SleepSchedule = "early-bird" | "night-owl";

export const SLEEP_OPTIONS: { label: string; value: SleepSchedule }[] = [
  { label: "Early Bird", value: "early-bird" },
  { label: "Night Owl", value: "night-owl" },
];

