interface RepDate {
  year: number;
  monthIdx: number;
  dayOfMonth: number;
}

const YEAR_STARTS: [number, number][] = [
  [1,  Date.UTC(1792, 8, 22)],
  [2,  Date.UTC(1793, 8, 22)],
  [3,  Date.UTC(1794, 8, 22)],
  [4,  Date.UTC(1795, 8, 23)],
  [5,  Date.UTC(1796, 8, 22)],
  [6,  Date.UTC(1797, 8, 22)],
  [7,  Date.UTC(1798, 8, 22)],
  [8,  Date.UTC(1799, 8, 23)],
  [9,  Date.UTC(1800, 8, 23)],
  [10, Date.UTC(1801, 8, 23)],
  [11, Date.UTC(1802, 8, 23)],
  [12, Date.UTC(1803, 8, 24)],
  [13, Date.UTC(1804, 8, 23)],
  [14, Date.UTC(1805, 8, 23)],
];
const END_DATE_UTC = Date.UTC(1806, 0, 1);

const MONTHS = [
  'Vendémiaire', 'Brumaire', 'Frimaire',
  'Nivôse', 'Pluviôse', 'Ventôse',
  'Germinal', 'Floréal', 'Prairial',
  'Messidor', 'Thermidor', 'Fructidor',
];
const MONTHS_SHORT = [
  'Vend.', 'Brum.', 'Frim.',
  'Niv.', 'Pluv.', 'Vent.',
  'Germ.', 'Flor.', 'Prai.',
  'Mess.', 'Ther.', 'Fruc.',
];
const SANSCULOTTIDES = [
  "jour de la Vertu", "jour du Génie", "jour du Travail",
  "jour de l'Opinion", "jour des Récompenses", "jour de la Révolution",
];

function toRoman(n: number): string {
  if (n <= 0 || n > 39) return String(n);
  const map: [string, number][] = [['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]];
  let s = '';
  for (const [sym, val] of map) {
    while (n >= val) { s += sym; n -= val; }
  }
  return s;
}

export function fromGregorian(yyyy: number, mm: number, dd: number): RepDate | null {
  if (!yyyy || !mm || !dd) return null;
  const date = Date.UTC(yyyy, mm - 1, dd);
  if (date < YEAR_STARTS[0][1] || date >= END_DATE_UTC) return null;

  let republicanYear: number | null = null;
  let yearStart: number | null = null;
  for (let i = YEAR_STARTS.length - 1; i >= 0; i--) {
    if (date >= YEAR_STARTS[i][1]) {
      republicanYear = YEAR_STARTS[i][0];
      yearStart = YEAR_STARTS[i][1];
      break;
    }
  }
  if (republicanYear == null || yearStart == null) return null;
  const daysIntoYear = Math.floor((date - yearStart) / 86400000);
  if (daysIntoYear < 360) {
    return { year: republicanYear, monthIdx: Math.floor(daysIntoYear / 30), dayOfMonth: (daysIntoYear % 30) + 1 };
  }
  return { year: republicanYear, monthIdx: 12, dayOfMonth: daysIntoYear - 359 };
}

export function format(rep: RepDate | null, opts: { short?: boolean } = {}): string {
  if (!rep) return '';
  const months = opts.short ? MONTHS_SHORT : MONTHS;
  if (rep.monthIdx === 12) {
    const name = SANSCULOTTIDES[rep.dayOfMonth - 1] || `${rep.dayOfMonth}ᵉ jour complémentaire`;
    return `${name} an ${toRoman(rep.year)}`;
  }
  return `${rep.dayOfMonth} ${months[rep.monthIdx]} an ${toRoman(rep.year)}`;
}

export function formatGregorian(yyyy: number, mm: number, dd: number, opts?: { short?: boolean }): string | null {
  const rep = fromGregorian(yyyy, mm, dd);
  return rep ? format(rep, opts) : null;
}

export function formatYear(year: number): string | null {
  if (!year || year < 1793 || year > 1805) return null;
  const rep = fromGregorian(year, 4, 15);
  if (!rep) return null;
  return `an ${toRoman(rep.year)}`;
}

export function isInPeriod(year: number | null | undefined): boolean {
  return year != null && year >= 1792 && year <= 1805;
}

export const RepublicanCalendar = { fromGregorian, format, formatGregorian, formatYear, isInPeriod, toRoman };
