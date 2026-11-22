// A small interpreter for the common weekly forms of the OSM `opening_hours` tag, enough to show
// one line per weekday in the details. Anything it does not understand (months, weeks, dates,
// comments, `||` fallbacks, open-ended times) makes the whole value uninterpretable, so the UI
// shows the raw text instead of a guess. Public holiday (`PH`) selectors are ignored: the weekly
// view describes an ordinary week.

export interface TimeRange {
  /** "HH:MM", 24-hour clock. */
  readonly start: string;
  /** "HH:MM"; may be "24:00", or earlier than `start` for a range past midnight. */
  readonly end: string;
}

/** Index 0 is Monday, 6 is Sunday. An empty list means closed. */
export type WeeklyHours = readonly (readonly TimeRange[])[];

export type InterpretedHours =
  | { kind: "weekly"; days: WeeklyHours }
  | { kind: "raw"; text: string };

const dayCodes = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
const allDays = [0, 1, 2, 3, 4, 5, 6] as const;

const tokenPattern =
  /\s*(?:(?<day>Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:\s*-\s*(?<dayEnd>Mo|Tu|We|Th|Fr|Sa|Su))?|(?<start>\d{1,2}:\d{2})\s*-\s*(?<end>\d{1,2}:\d{2})|(?<off>off|closed)|(?<always>24\/7)|(?<comma>,))\s*/iy;

interface Rule {
  /** Weekday indexes; null when the rule has no day selector (every day). */
  days: Set<number> | null;
  ranges: TimeRange[];
  off: boolean;
  /** Rules after a comma add to earlier ones; rules after a semicolon replace them. */
  additional: boolean;
}

export function interpretOpeningHours(value: string): InterpretedHours {
  const raw = { kind: "raw", text: value } as const;
  const week: TimeRange[][] = allDays.map(() => []);
  let applied = false;
  for (const part of value.split(";")) {
    if (part.trim() === "") continue;
    const rules = parseRules(part);
    if (!rules) return raw;
    for (const rule of rules) {
      // A selector naming only public holidays ("PH off") does not describe an ordinary week.
      if (rule.days?.size === 0) continue;
      for (const day of rule.days ?? allDays) {
        if (rule.off) week[day] = [];
        else week[day] = rule.additional ? [...week[day]!, ...rule.ranges] : [...rule.ranges];
      }
      applied = true;
    }
  }
  if (!applied) return raw;
  return { kind: "weekly", days: week.map(mergeRanges) };
}

function parseRules(part: string): Rule[] | null {
  const rules: Rule[] = [];
  let rule = newRule(false);
  let hasSelector = false;
  tokenPattern.lastIndex = 0;
  while (tokenPattern.lastIndex < part.length) {
    const match = tokenPattern.exec(part);
    if (!match?.groups) return null;
    const { day, dayEnd, start, end, off, always } = match.groups;
    if (day) {
      if (rule.ranges.length > 0 || rule.off) {
        rules.push(rule);
        rule = newRule(true);
        hasSelector = false;
      }
      hasSelector = true;
      if (!addDays(rule, day, dayEnd)) return null;
    } else if (start && end) {
      if (rule.off) return null;
      const range = parseRange(start, end);
      if (!range) return null;
      rule.ranges.push(range);
    } else if (off) {
      if (rule.ranges.length > 0) return null;
      rule.off = true;
    } else if (always) {
      if (hasSelector || rule.ranges.length > 0 || rule.off) return null;
      rule.ranges.push({ start: "00:00", end: "24:00" });
    }
  }
  // A selector without times ("Mo-Fr") means open all day in OSM; too rare to trust here.
  if (rule.ranges.length === 0 && !rule.off) return null;
  rules.push(rule);
  return rules;
}

function newRule(additional: boolean): Rule {
  return { days: null, ranges: [], off: false, additional };
}

function addDays(rule: Rule, day: string, dayEnd: string | undefined): boolean {
  rule.days ??= new Set();
  if (day.toUpperCase() === "PH") return dayEnd === undefined;
  const first = dayIndex(day);
  const last = dayEnd ? dayIndex(dayEnd) : first;
  // Ranges may wrap past Sunday, as in "Su-Fr" or "Fr-Mo".
  for (let index = first; ; index = (index + 1) % 7) {
    rule.days.add(index);
    if (index === last) return true;
  }
}

function dayIndex(code: string): number {
  return dayCodes.findIndex((candidate) => candidate.toLowerCase() === code.toLowerCase());
}

function parseRange(start: string, end: string): TimeRange | null {
  const from = parseTime(start);
  const to = parseTime(end);
  if (from === null || to === null || from >= 24 * 60 || from === to) return null;
  return { start: formatTime(from), end: formatTime(to) };
}

function parseTime(text: string): number | null {
  const [hours, minutes] = text.split(":").map(Number);
  if (hours === undefined || minutes === undefined || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return total <= 24 * 60 ? total : null;
}

function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function mergeRanges(ranges: readonly TimeRange[]): TimeRange[] {
  const sorted = ranges.toSorted((a, b) => a.start.localeCompare(b.start));
  const merged: TimeRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    const sameDay = range.end > range.start && last && last.end > last.start;
    if (last && sameDay && range.start <= last.end) {
      if (range.end > last.end) merged[merged.length - 1] = { start: last.start, end: range.end };
    } else if (!merged.some((m) => m.start === range.start && m.end === range.end)) {
      merged.push(range);
    }
  }
  return merged;
}
