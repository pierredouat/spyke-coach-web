import type { SessionWithExercises, Profile } from '../../../types/database'
import { fmtDay, isSameDay } from '../../../lib/dates'

const DAY_HEADERS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

interface Props {
  days: Date[]
  sessions: SessionWithExercises[]
  athletes: Profile[]
  today: Date
  onDayClick: (d: Date) => void
  onSessionClick: (s: SessionWithExercises) => void
  onCreateOnDay: (d: Date) => void
}

export default function WeekView({ days, sessions, athletes, today, onDayClick, onSessionClick, onCreateOnDay }: Props) {
  function athleteName(id: string) {
    const a = athletes.find(a => a.id === id)
    return a ? `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() : '—'
  }

  function sessionsOnDay(d: Date) {
    return sessions.filter(s => isSameDay(new Date(s.scheduled_date + 'T00:00:00'), d))
  }

  return (
    <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
      {/* Headers */}
      {days.map((d, i) => {
        const isToday = isSameDay(d, today)
        return (
          <div
            key={i}
            className={`bg-white px-2 py-2 text-center cursor-pointer hover:bg-gray-50 transition-colors ${isToday ? 'bg-brand/5' : ''}`}
            onClick={() => onDayClick(d)}
          >
            <div className="text-xs font-medium text-muted">{DAY_HEADERS[i]}</div>
            <div className={`text-lg font-semibold mt-0.5 w-8 h-8 flex items-center justify-center mx-auto rounded-full ${isToday ? 'bg-brand text-white' : 'text-ink'}`}>
              {fmtDay(d)}
            </div>
          </div>
        )
      })}

      {/* Day columns */}
      {days.map((d, i) => {
        const daySessions = sessionsOnDay(d)
        const isToday = isSameDay(d, today)
        return (
          <div
            key={`col-${i}`}
            className={`bg-white min-h-32 p-1.5 flex flex-col gap-1 ${isToday ? 'bg-brand/3' : ''}`}
          >
            {daySessions.map(s => (
              <button
                key={s.id}
                onClick={() => onSessionClick(s)}
                className="w-full text-left bg-brand/8 hover:bg-brand/15 border border-brand/20 rounded-lg px-2 py-1.5 transition-colors group"
              >
                <p className="text-ink text-xs font-semibold truncate leading-tight">{s.title}</p>
                <p className="text-muted text-xs truncate mt-0.5">{athleteName(s.athlete_id)}</p>
                {s.session_exercises.length > 0 && (
                  <p className="text-muted/60 text-xs mt-0.5">{s.session_exercises.length} ex.</p>
                )}
              </button>
            ))}
            <button
              onClick={() => onCreateOnDay(d)}
              className="w-full flex items-center justify-center py-1 mt-auto text-muted/40 hover:text-brand hover:bg-brand/5 rounded-lg transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
