import type { SessionWithExercises } from '../../../types/database'
import { getMonthGrid, fmtDay, isSameDay, formatYMD } from '../../../lib/dates'

const DAY_HEADS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

interface Props {
  year: number
  month: number
  sessions: SessionWithExercises[]
  today: Date
  onDayClick: (d: Date) => void
}

export default function MonthView({ year, month, sessions, today, onDayClick }: Props) {
  const grid = getMonthGrid(year, month)

  function sessionsOnDay(d: Date): number {
    return sessions.filter(s => isSameDay(new Date(s.scheduled_date + 'T00:00:00'), d)).length
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Column headers */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DAY_HEADS.map(h => (
          <div key={h} className="px-3 py-2 text-center text-xs font-medium text-muted">{h}</div>
        ))}
      </div>

      {/* Weeks */}
      {grid.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-50 last:border-0">
          {week.map((d, di) => {
            if (!d) return <div key={di} className="min-h-20 bg-gray-50/50" />
            const count = sessionsOnDay(d)
            const isToday = isSameDay(d, today)
            const isCurrentMonth = d.getMonth() === month
            return (
              <div
                key={formatYMD(d)}
                onClick={() => onDayClick(d)}
                className={`min-h-20 p-2 cursor-pointer transition-colors hover:bg-blue-50/50 ${!isCurrentMonth ? 'opacity-40' : ''}`}
              >
                <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1.5 ${isToday ? 'bg-brand text-white' : 'text-ink'}`}>
                  {fmtDay(d)}
                </div>
                {count > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                      <span key={i} className="w-2 h-2 rounded-full bg-brand/60" />
                    ))}
                    {count > 4 && <span className="text-xs text-muted">+{count - 4}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
