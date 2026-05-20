function startOfLocalDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayIndex(createdAt: number, now: number): number {
  const startCreated = startOfLocalDay(createdAt);
  const startNow = startOfLocalDay(now);
  return Math.round((startNow - startCreated) / (24 * 60 * 60 * 1000));
}

export function hourOfDay(t: number): number {
  return new Date(t).getHours();
}

export function dateKey(t: number): string {
  const d = new Date(t);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function daysBetween(a: number, b: number): number {
  const sa = startOfLocalDay(a);
  const sb = startOfLocalDay(b);
  return Math.round((sb - sa) / (24 * 60 * 60 * 1000));
}
