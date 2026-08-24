import type { SessionWithExercises } from '../../../types/database'
import { getWeekDays, getWeekNumber, formatYMD, isSameDay, fmtDay, fmtMonthShort, addWeeks } from '../../../lib/dates'

interface Props {
  startDate: Date
  weeks: number
  sessions: SessionWithExercises[]
  today: Date
  onWeekClick: (weekStart: Date) => void
}

export default function MacroView({ startDate, weeks, sessions, today, onWeekClick }: Props) {
  const rows = Array.from({ length: weeks }, (_, i) => {
    const ws = addWeeks(startDate, i)
    const days = getWeekDays(ws)
    const we = days[6]
    const count = sessions.filter(s => {
      const sd = new Date(s.scheduled_date + 'T00:00:00')
      return sd >= ws && sd <= we
    }).length
    const isCurrentWeek = days.some(d => isSameDay(d, today))
    return { ws, days, count, isCurrentWeek }
  })

  const maxCount = Math.max(...rows.map(r => r.count), 1)

  function weekLabel({ ws, days }: { ws: Date; days: Date[] }): string {
    const we = days[6]
    const startStr = `${fmtDay(ws)} ${fmtMonthShort(ws)}`
    const endStr   = `${fmtDay(we)} ${fmtMonthShort(we)}`
    return ws.getMonth() === we.getMonth()
      ? `${fmtDay(ws)}–${fmtDay(we)} ${fmtMonthShort(we)}`
      : `${startStr} – ${endStr}`
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="grid grid-cols-[auto_1fr_auto] text-xs font-medium text-muted uppercase tracking-wide px-4 py-2 border-b border-gray-100">
        <span className="w-16">Sem.</span>
        <span className="px-3">Période</span>
        <span>Séances</span>
      </div>
      <div className="divide-y divide-gray-50">
        {rows.map(({ ws, days, count, isCurrentWeek }) => (
          <div
            key={formatYMD(ws)}
            onClick={() => onWeekClick(ws)}
            className={`grid grid-cols-[auto_1fr_auto] items-center px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${isCurrentWeek ? 'bg-brand/4' : ''}`}
          >
            <span className={`w-16 text-xs font-medium ${isCurrentWeek ? 'text-brand' : 'text-muted'}`}>
              S{getWeekNumber(ws)}
            </span>
            <div className="px-3 flex-1">
              <span className="text-sm text-ink">{weekLabel({ ws, days })}</span>
              {count > 0 && (
                <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden w-full max-w-xs">
                  <div
                    className="h-full rounded-full bg-brand/60 transition-all"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
              )}
            </div>
            <span className={`text-sm font-medium min-w-[4ch] text-right ${count > 0 ? 'text-brand' : 'text-muted/40'}`}>
              {count > 0 ? `${count}` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
