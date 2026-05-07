/** Working days Mon–Sat (Sunday off), local calendar, between two dates (inclusive). */
export function workingDaysInclusive(start: Date, end: Date): number {
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  let n = 0;
  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0) n++;
  }
  return n;
}
