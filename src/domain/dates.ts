// Monday-Sunday week boundaries, shared by the client (Today/Progress) and
// the server (friend comparison), so "this week" means the same thing
// wherever it is computed.
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function mondayKey(date: Date): string {
  const start = new Date(date);
  start.setHours(12, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() - ((day + 6) % 7));
  return localDateKey(start);
}

export function nextMondayKey(date: Date): string {
  const start = new Date(`${mondayKey(date)}T12:00:00`);
  start.setDate(start.getDate() + 7);
  return localDateKey(start);
}

export function formatWeekLabel(
  weekStartKey: string,
  weekEndExclusiveKey: string,
  isCurrent: boolean,
): string {
  if (isCurrent) return "Current week";
  const start = new Date(`${weekStartKey}T12:00:00`);
  const end = new Date(`${weekEndExclusiveKey}T12:00:00`);
  end.setDate(end.getDate() - 1);
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    start,
  );
  const endText = new Intl.DateTimeFormat(
    undefined,
    sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" },
  ).format(end);
  return `${startText} – ${endText}`;
}
