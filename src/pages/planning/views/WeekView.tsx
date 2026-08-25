import type { SessionWithExercises, Profile } from '../../../types/database'
import { fmtDay, fmtMonthShort, isSameDay } from '../../../lib/dates'

const DAY_HEADERS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

interface Props {
  days: Date[]
  sessions: SessionWithExercises[]
  athletes: Profile[]
  today: Date
  onDayClick: (d: Date) => void
  onSessionClick: (s: SessionWithExercises) => void
  onCreateOnDay: (d: Date) => void
  onDuplicateDay?: (day: Date) => void
  onDuplicateWeek?: () => void
}

export default function WeekView({ days, sessions, athletes, today, onDayClick, onSessionClick, onCreateOnDay, onDuplicateDay, onDuplicateWeek }: Props) {
  function athleteName(id: string) {
    const a = athletes.find(a => a.id === id)
    return a ? `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() : '—'
  }

  function sessionsOnDay(d: Date) {
    return sessions.filter(s => isSameDay(new Date(s.scheduled_date + 'T00:00:00'), d))
  }

  const hasSessions = sessions.length > 0

  return (
    <div className="space-y-2">
      {/* Week-level action */}
      {hasSessions && onDuplicateWeek && (
        <div className="flex justify-end">
          <button
            onClick={onDuplicateWeek}
            className="text-xs text-muted hover:text-ink border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
          >
            Dupliquer cette semaine
          </button>
        </div>
      )}

      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
        {/* Day headers */}
        {days.map((d, i) => {
          const isToday = isSameDay(d, today)
          const daySessions = sessionsOnDay(d)
          return (
            <div
              key={i}
              className={`bg-white px-2 py-2 text-center group/hdr ${isToday ? 'bg-brand/5' : ''}`}
            >
              <div className="relative">
                <div
                  className="cursor-pointer hover:bg-gray-50 rounded-lg pb-1 transition-colors"
                  onClick={() => onDayClick(d)}
                >
                  <div className="text-xs font-medium text-muted">{DAY_HEADERS[i]}</div>
                  <div className={`text-lg font-semibold mt-0.5 w-8 h-8 flex items-center justify-center mx-auto rounded-full ${isToday ? 'bg-brand text-white' : 'text-ink'}`}>
                    {fmtDay(d)}
                  </div>
                </div>
                {/* Per-day duplicate button — appears on hover */}
                {daySessions.length > 0 && onDuplicateDay && (
                  <button
                    onClick={e => { e.stopPropagation(); onDuplicateDay(d) }}
                    title={`Dupliquer le ${fmtDay(d)} ${fmtMonthShort(d)}`}
                    className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-muted hover:text-brand hover:bg-brand/10 rounded-full opacity-0 group-hover/hdr:opacity-100 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                )}
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
                  className="w-full text-left bg-brand/8 hover:bg-brand/15 border border-brand/20 rounded-lg px-2 py-1.5 transition-colors"
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
                className="w-full flex items-center justify-center py-1 mt-auto text-muted/40 hover:text-brand hover:bg-brand/5 rounded-lg transition-colors opacity-0 hover:opacity-100"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
