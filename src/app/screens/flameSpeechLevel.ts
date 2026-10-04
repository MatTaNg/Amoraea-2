type Listener = () => void;

const listeners = new Set<Listener>();

let level = 0;

export function setFlameSpeechLevel(next: number): void {
  const clamped = Number.isFinite(next) ? Math.min(1, Math.max(0, next)) : 0;
  if (clamped === level) return;
  level = clamped;
  listeners.forEach((listener) => listener());
}

export function clearFlameSpeechLevel(): void {
  setFlameSpeechLevel(0);
}

export function subscribeFlameSpeechLevel(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFlameSpeechLevel(): number {
  return level;
}
