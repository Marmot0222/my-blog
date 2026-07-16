export function formatFullDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${year}.${month}.${day}`;
}

export function formatMonthDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${month}.${day}`;
}
