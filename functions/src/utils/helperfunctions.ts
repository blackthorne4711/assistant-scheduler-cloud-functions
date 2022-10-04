// WEEKDAYS
const weekdayNames = [
  "Söndag",
  "Måndag",
  "Tisdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lördag",
];

export function getWeekday(date: string) {
  return weekdayNames[(new Date(date)).getDay()];
}
