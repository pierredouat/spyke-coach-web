import type { SessionWithExercises, Profile } from '../../../types/database'
import { fmtDayLong, fmtDay, fmtMonth } from '../../../lib/dates'

interface Props {
  day: Date
  sessions: SessionWithExercises[]
  athletes: Profile[]
  onSessionClick: (s: SessionWithExercises) => void
  onCreateOnDay: (d: Date) => void
}

const STATUS_LABELS = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminée', modifie: 'Modifiée' }
const STATUS_COLORS = {
  a_faire:  'bg-gray-100 text-gray-600',
  en_cours: 'bg-sky-50 text-sky-700',
  termine:  'bg-emerald-50 text-emerald-700',
  modifie:  'bg-amber-50 text-amber-700',
}

export default function DayView({ day, sessions, athletes, onSessionClick, onCreateOnDay }: Props) {
  function athleteName(id: string) {
    const a = athletes.find(a => a.id === id)
    return a ? `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() : '—'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-ink font-semibold">
          {fmtDayLong(day)} {fmtDay(day)} {fmtMonth(day)}
        </h2>
        <button
          onClick={() => onCreateOnDay(day)}
          className="flex items-center gap-1.5 text-sm text-brand hover:text-brand-hover font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter une séance
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <p className="text-muted text-sm">Aucune séance ce jour</p>
          <button
            onClick={() => onCreateOnDay(day)}
            className="mt-3 text-sm text-brand hover:text-brand-hover font-medium transition-colors"
          >
            Créer une séance
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => onSessionClick(s)}
              className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 p-5 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-ink font-semibold">{s.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status]}`}>
                      {STATUS_LABELS[s.status]}
                    </span>
                    {!s.is_revealed && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-muted font-medium">Non visible</span>
                    )}
                  </div>
                  <p className="text-muted text-sm">{athleteName(s.athlete_id)}</p>
                </div>
                <div className="text-right shrink-0">
                  {s.estimated_duration_minutes && (
                    <p className="text-muted text-sm">{s.estimated_duration_minutes} min</p>
                  )}
                  {s.location && <p className="text-muted text-xs mt-0.5">{s.location}</p>}
                </div>
              </div>

              {s.session_exercises.length > 0 && (
                <div className="border-t border-gray-50 pt-3 space-y-1">
                  {s.session_exercises.map((ex, i) => (
                    <div key={ex.id} className="flex items-baseline gap-2 text-sm">
                      <span className="text-muted text-xs w-5 text-right shrink-0">{i + 1}.</span>
                      <span className="text-ink font-medium">{ex.name}</span>
                      <span className="text-muted text-xs">
                        {[
                          ex.sets ? `${ex.sets}×` : null,
                          ex.reps ? `${ex.reps} rép.` : null,
                          ex.distance_meters ? `${ex.distance_meters} m` : null,
                          ex.duration_seconds ? `${ex.duration_seconds} s` : null,
                          ex.intensity || null,
                        ].filter(Boolean).join(' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
