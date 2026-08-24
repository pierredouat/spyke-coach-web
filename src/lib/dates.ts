export function formatYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function parseYMD(s: string): Date {
  const [y, m, day] = s.split('-').map(Number)
  return new Date(y, m - 1, day)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function addWeeks(d: Date, n: number): Date { return addDays(d, n * 7) }

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}

export function getWeekStart(d: Date): Date {
  const r = new Date(d)
  const dow = r.getDay() === 0 ? 6 : r.getDay() - 1 // 0 = Mon
  r.setDate(r.getDate() - dow)
  r.setHours(0, 0, 0, 0)
  return r
}

export function getWeekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export function getWeekNumber(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const MONTH_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAY_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
const DAY_LONG  = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

export function fmtDay(d: Date): string { return String(d.getDate()) }
export function fmtDayShort(d: Date): string { return DAY_SHORT[d.getDay()] }
export function fmtDayLong(d: Date): string { return DAY_LONG[d.getDay()] }
export function fmtMonth(d: Date): string { return MONTH_FR[d.getMonth()] }
export function fmtMonthShort(d: Date): string { return MONTH_FR[d.getMonth()].slice(0, 3) }
export function fmtMonthYear(d: Date): string { return `${MONTH_FR[d.getMonth()]} ${d.getFullYear()}` }

export function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const startDow = first.getDay() === 0 ? 6 : first.getDay() - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
