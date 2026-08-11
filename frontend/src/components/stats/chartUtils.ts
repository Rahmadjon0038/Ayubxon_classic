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

export function monthShortLabel(monthKey: string, monthNames: string[]): string {
  const [, monthNum] = monthKey.split('-').map(Number);
  return monthNames[monthNum - 1]?.slice(0, 3) ?? monthKey;
}

export function monthFullLabel(monthKey: string, monthNames: string[]): string {
  const [year, monthNum] = monthKey.split('-').map(Number);
  return `${monthNames[monthNum - 1] ?? monthKey} ${year}`;
}
