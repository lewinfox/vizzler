// Sliding 3-second window of onset event timestamps, exposing onsets/sec.

const WINDOW_MS = 3000;

const events: number[] = [];

export function recordOnsetEvent(now: number): void {
  events.push(now);
  while (events.length && now - events[0] > WINDOW_MS) events.shift();
}

export function onsetDensityNow(): number {
  return events.length / 3.0; // events per second
}
