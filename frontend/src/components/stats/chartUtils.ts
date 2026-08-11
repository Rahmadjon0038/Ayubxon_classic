// Grafik o'qi uchun "chiroyli" yumaloq maksimal qiymatni topadi (masalan 23 -> 25, 130 -> 150).
export function niceMax(value: number): number {
  if (value <= 0) return 4;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const residual = value / magnitude;
  let niceResidual: number;
  if (residual <= 1) niceResidual = 1;
  else if (residual <= 2) niceResidual = 2;
  else if (residual <= 5) niceResidual = 5;
  else niceResidual = 10;
  return niceResidual * magnitude;
}

// monthNamesShort — locale ning "time.monthsShort" ro'yxati (har biri qisqa, bir-biridan farqli belgi,
// masalan o'zbekchada "iyun"/"iyul" uchun mos ravishda "iyn"/"iyl" — slice(0,3) ikkalasini ham "iyu" qilib qo'yardi).
export function monthShortLabel(monthKey: string, monthNamesShort: string[]): string {
  const [, monthNum] = monthKey.split('-').map(Number);
  return monthNamesShort[monthNum - 1] ?? monthKey;
}

export function monthFullLabel(monthKey: string, monthNames: string[]): string {
  const [year, monthNum] = monthKey.split('-').map(Number);
  return `${monthNames[monthNum - 1] ?? monthKey} ${year}`;
}

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, monthNum] = monthKey.split('-').map(Number);
  const d = new Date(year, monthNum - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
