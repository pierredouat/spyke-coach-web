import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Profile, JournalCoachSummary, SleepHoursEnum } from '../../types/database'
import { formatYMD, addDays } from '../../lib/dates'
import { formatDisciplines } from '../../lib/disciplines'

// ─── Fatigue signal per athlete ───────────────────────────────────────────────
type FatigueSignal = 'ok' | 'alert' | 'no_data'

function computeSignal(entries: JournalCoachSummary[]): FatigueSignal {
  if (entries.length === 0) return 'no_data'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const last = new Date(entries.at(-1)!.date + 'T00:00:00')
  const daysSince = Math.round((today.getTime() - last.getTime()) / 86400000)
  if (daysSince > 2) return 'no_data'

  const recent = entries.slice(-3)
  const avg = (arr: (number | null)[]) => {
    const v = arr.filter((x): x is number => x !== null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }
  const stress   = avg(recent.map(e => e.stress_level))
  const soreness = avg(recent.map(e => e.soreness_level))
  const motiv    = avg(recent.map(e => e.motivation_level))
  // sleep_hours is an enum — alert if majority of recent entries report < 6h
  const sleepValues = recent.map(e => e.sleep_hours).filter((v): v is SleepHoursEnum => v !== null)
  const lowSleep = sleepValues.length > 0 && sleepValues.filter(v => v === 'less_6').length > sleepValues.length / 2

  if (
    (stress !== null && stress >= 4) ||
    (soreness !== null && soreness >= 4) ||
    (motiv !== null && motiv <= 2) ||
    lowSleep
  ) return 'alert'

  return 'ok'
}

// ─── Signal badge ─────────────────────────────────────────────────────────────
function FatigueBadge({ signal }: { signal: FatigueSignal }) {
  if (signal === 'ok') return null
  if (signal === 'no_data') return (
    <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" title="Aucune donnée récente" />
  )
  return (
    <span
      className="w-2 h-2 rounded-full bg-amber-400 shrink-0 ring-2 ring-amber-100"
      title="Signal de fatigue élevée"
    />
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [athletes, setAthletes] = useState<Profile[]>([])
  const [signals, setSignals]   = useState<Record<string, FatigueSignal>>({})
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  async function load() {
    const { data: relationships } = await supabase
      .from('coach_athlete_relationships')
      .select('athlete_id')
      .eq('coach_id', user!.id)
      .eq('status', 'active')

    if (!relationships?.length) { setLoading(false); return }

    const athleteIds = relationships.map(r => r.athlete_id)

    const [{ data: profiles }, { data: journal }] = await Promise.all([
      supabase.from('profiles').select('*').in('id', athleteIds),
      supabase
        .from('journal_entries_coach_summary')
        .select('athlete_id, date, sleep_hours, sleep_quality_text, stress_level, soreness_level, motivation_level')
        .in('athlete_id', athleteIds)
        .gte('date', formatYMD(addDays(new Date(), -5)))
        .order('date', { ascending: true }),
    ])

    const loadedAthletes = (profiles ?? []) as unknown as Profile[]
    setAthletes(loadedAthletes)

    const journalRows = (journal ?? []) as JournalCoachSummary[]
    const signalMap: Record<string, FatigueSignal> = {}
    for (const a of loadedAthletes) {
      signalMap[a.id] = computeSignal(journalRows.filter(j => j.athlete_id === a.id))
    }
    setSignals(signalMap)
    setLoading(false)
  }

  const alertCount = Object.values(signals).filter(s => s === 'alert').length

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-ink text-2xl font-semibold">Vue d&apos;ensemble</h1>
        <p className="text-muted text-sm mt-1">Votre groupe d&apos;athlètes</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Chargement…
        </div>
      ) : athletes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center max-w-md">
          <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <p className="text-ink font-medium mb-1">Aucun athlète pour l&apos;instant</p>
          <p className="text-muted text-sm">
            Partagez votre code d&apos;invitation à vos athlètes pour qu&apos;ils rejoignent votre groupe via l&apos;app mobile SPYKE.
          </p>
        </div>
      ) : (
        <>
          {/* Alert banner */}
          {alertCount > 0 && (
            <div className="mb-4 flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <p className="text-amber-800 text-sm">
                <strong>{alertCount} athlète{alertCount > 1 ? 's' : ''}</strong> présentent un signal de fatigue ou stress élevé ces derniers jours.
              </p>
            </div>
          )}

          {/* Athlete list */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] px-5 py-3 border-b border-gray-50 text-xs font-medium text-muted uppercase tracking-wide">
              <span>Athlète</span>
              <span className="mr-8">Discipline</span>
              <span>État récent</span>
            </div>
            {athletes.map((athlete, i) => {
              const signal = signals[athlete.id] ?? 'no_data'
              return (
                <button
                  key={athlete.id}
                  onClick={() => navigate(`/athletes/${athlete.id}`)}
                  className={`w-full grid grid-cols-[1fr_auto_auto] items-center px-5 py-4 gap-4 text-left transition-colors hover:bg-gray-50 ${
                    i < athletes.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                      <span className="text-brand text-xs font-semibold">
                        {(athlete.first_name ?? athlete.last_name ?? '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-ink text-sm font-medium truncate">
                      {[athlete.first_name, athlete.last_name].filter(Boolean).join(' ') || '—'}
                    </span>
                  </div>
                  <span className="text-muted text-sm mr-8">{formatDisciplines(athlete.disciplines)}</span>
                  <div className="flex items-center justify-center w-16">
                    {signal === 'ok' ? (
                      <span className="text-xs text-emerald-600 font-medium">OK</span>
                    ) : signal === 'alert' ? (
                      <span className="flex items-center gap-1.5">
                        <FatigueBadge signal={signal} />
                        <span className="text-xs text-amber-700 font-medium">Fatigue</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <FatigueBadge signal={signal} />
                        <span className="text-xs text-muted">Inactif</span>
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted mt-3">Cliquez sur un athlète pour voir ses tendances détaillées.</p>
        </>
      )}
    </div>
  )
}
