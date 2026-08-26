import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Profile, JournalCoachSummary, SleepHoursEnum, SleepQualityTextEnum } from '../../types/database'
import { formatYMD, addDays, parseYMD, fmtDay, fmtMonthShort } from '../../lib/dates'
import { formatDisciplines } from '../../lib/disciplines'

// ─── Sleep enum mappings ──────────────────────────────────────────────────────
const SLEEP_HOURS_LABEL: Record<SleepHoursEnum, string> = {
  less_6:  '< 6h',
  '6_to_8': '6–8h',
  more_8:  '> 8h',
}
const SLEEP_HOURS_VALUE: Record<SleepHoursEnum, number> = {
  less_6:  1,
  '6_to_8': 2,
  more_8:  3,
}
const SLEEP_QUALITY_LABEL: Record<SleepQualityTextEnum, string> = {
  agitated: 'Agité',
  okay:     'Correct',
  restful:  'Reposant',
}

// ─── Metric config ────────────────────────────────────────────────────────────
const NUMERIC_METRICS = [
  {
    key:    'stress_level'    as const,
    label:  'Stress',
    unit:   '/5',
    color:  '#D97706',
    scale:  [1, 5] as [number, number],
    invert: true,  // higher = worse
  },
  {
    key:    'soreness_level'  as const,
    label:  'Courbatures',
    unit:   '/5',
    color:  '#C1592E',
    scale:  [1, 5] as [number, number],
    invert: true,
  },
  {
    key:    'motivation_level' as const,
    label:  'Motivation',
    unit:   '/5',
    color:  '#0D9488',
    scale:  [1, 5] as [number, number],
    invert: false,
  },
]

// ─── SVG sparkline ────────────────────────────────────────────────────────────
function SparkLine({ data, color, scale }: {
  data: (number | null)[]
  color: string
  scale: [number, number]
}) {
  const W = 300
  const H = 60
  const PAD = 6

  const clamp = (v: number) => Math.min(Math.max(v, scale[0]), scale[1])
  const toY = (v: number) => PAD + (1 - (clamp(v) - scale[0]) / (scale[1] - scale[0])) * (H - PAD * 2)
  const toX = (i: number) => data.length < 2 ? W / 2 : (i / (data.length - 1)) * W

  // Build SVG path segments (split on null gaps)
  let d = ''
  let inLine = false
  data.forEach((v, i) => {
    if (v === null) { inLine = false; return }
    const x = toX(i)
    const y = toY(v)
    d += inLine ? ` L ${x.toFixed(1)} ${y.toFixed(1)}` : ` M ${x.toFixed(1)} ${y.toFixed(1)}`
    inLine = true
  })

  const dots = data.map((v, i) => v === null ? null : { x: toX(i), y: toY(v), i })
  const lastDotIdx = [...dots].reverse().find(d => d !== null)?.i ?? -1

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full" style={{ height: 64 }}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={0} y1={PAD + f * (H - PAD * 2)} x2={W} y2={PAD + f * (H - PAD * 2)}
          stroke="#F3F4F6" strokeWidth="1.5" />
      ))}
      {/* Line */}
      {d && <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {/* Dots */}
      {dots.map(dot => dot === null ? null : (
        <circle
          key={dot.i}
          cx={dot.x.toFixed(1)} cy={dot.y.toFixed(1)}
          r={dot.i === lastDotIdx ? 4 : 3}
          fill={dot.i === lastDotIdx ? color : '#fff'}
          stroke={color}
          strokeWidth="2"
        />
      ))}
    </svg>
  )
}

// ─── Metric card (numeric: stress / soreness / motivation) ───────────────────
function NumericMetricCard({ metric, entries, days }: {
  metric: typeof NUMERIC_METRICS[number]
  entries: JournalCoachSummary[]
  days: number
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const slots: (number | null)[] = Array.from({ length: days }, (_, i) => {
    const d = formatYMD(addDays(today, i - days + 1))
    const entry = entries.find(e => e.date === d)
    return entry ? (entry[metric.key] ?? null) : null
  })

  const values = slots.filter((v): v is number => v !== null)
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  const lastValue = values.at(-1) ?? null

  const half = Math.floor(values.length / 2)
  const trend = values.length >= 4
    ? (values.slice(-3).reduce((a, b) => a + b, 0) / 3) - (values.slice(0, half).reduce((a, b) => a + b, 0) / half)
    : 0
  const trendSign = Math.abs(trend) < 0.2 ? 0 : trend > 0 ? 1 : -1
  const trendColor = trendSign === 0
    ? 'text-muted'
    : (metric.invert ? trendSign > 0 : trendSign < 0) ? 'text-amber-600' : 'text-emerald-600'

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{metric.label}</p>
          {avg !== null && (
            <p className="text-xl font-semibold text-ink mt-0.5">
              {avg.toFixed(1)}
              <span className="text-xs font-normal text-muted ml-1">moy{metric.unit}</span>
            </p>
          )}
        </div>
        <div className="text-right">
          {lastValue !== null && (
            <p className="text-sm text-muted">Dernier : <span className="text-ink font-medium">{lastValue}</span></p>
          )}
          {values.length >= 4 && trendSign !== 0 && (
            <span className={`text-sm font-semibold ${trendColor}`}>{trendSign > 0 ? '↑' : '↓'}</span>
          )}
        </div>
      </div>
      {values.length >= 2 ? (
        <SparkLine data={slots} color={metric.color} scale={metric.scale} />
      ) : (
        <div className="flex items-center justify-center h-16 rounded-lg bg-gray-50">
          <p className="text-xs text-muted">Pas assez de données</p>
        </div>
      )}
    </div>
  )
}

// ─── Sleep card (categorical enum) ───────────────────────────────────────────
function SleepCard({ entries, days }: { entries: JournalCoachSummary[]; days: number }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const hoursSlots: (number | null)[] = Array.from({ length: days }, (_, i) => {
    const d = formatYMD(addDays(today, i - days + 1))
    const entry = entries.find(e => e.date === d)
    const h = entry?.sleep_hours ?? null
    return h ? SLEEP_HOURS_VALUE[h] : null
  })

  const rawHours: (SleepHoursEnum | null)[] = Array.from({ length: days }, (_, i) => {
    const d = formatYMD(addDays(today, i - days + 1))
    return entries.find(e => e.date === d)?.sleep_hours ?? null
  })

  const lastHours = rawHours.filter(v => v !== null).at(-1) ?? null
  const lastQuality = Array.from({ length: days }, (_, i) => {
    const d = formatYMD(addDays(today, i - days + 1))
    return entries.find(e => e.date === d)?.sleep_quality_text ?? null
  }).filter(v => v !== null).at(-1) ?? null

  const validCount = hoursSlots.filter(v => v !== null).length

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">Sommeil</p>
          {lastHours && (
            <p className="text-xl font-semibold text-ink mt-0.5">
              {SLEEP_HOURS_LABEL[lastHours]}
              <span className="text-xs font-normal text-muted ml-1">dernier</span>
            </p>
          )}
        </div>
        {lastQuality && (
          <p className="text-sm text-muted">
            Qualité : <span className="text-ink font-medium">{SLEEP_QUALITY_LABEL[lastQuality]}</span>
          </p>
        )}
      </div>
      {validCount >= 2 ? (
        <>
          <SparkLine data={hoursSlots} color="#3743BA" scale={[1, 3]} />
          <div className="flex justify-between mt-1 text-xs text-muted/60 px-0.5">
            <span>&lt; 6h</span><span>6–8h</span><span>&gt; 8h</span>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-16 rounded-lg bg-gray-50">
          <p className="text-xs text-muted">Pas assez de données</p>
        </div>
      )}
    </div>
  )
}

// ─── Date axis label strip ────────────────────────────────────────────────────
function DateStrip({ days }: { days: number }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const step = days <= 7 ? 1 : Math.ceil(days / 7)
  const labels: { label: string; pct: number }[] = []

  for (let i = 0; i < days; i += step) {
    const d = addDays(today, i - days + 1)
    labels.push({ label: `${fmtDay(d)} ${fmtMonthShort(d)}`, pct: (i / (days - 1)) * 100 })
  }
  // Always include last
  labels.push({ label: "Auj.", pct: 100 })

  return (
    <div className="relative h-5 mx-0">
      {labels.map((l, i) => (
        <span
          key={i}
          className="absolute text-xs text-muted whitespace-nowrap"
          style={{
            left: `${l.pct}%`,
            transform: l.pct === 0 ? 'none' : l.pct === 100 ? 'translateX(-100%)' : 'translateX(-50%)',
          }}
        >
          {l.label}
        </span>
      ))}
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center gap-2 text-muted text-sm pt-4">
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Chargement…
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AthleteDetailPage() {
  const { id: athleteId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [athlete, setAthlete]   = useState<Profile | null>(null)
  const [entries, setEntries]   = useState<JournalCoachSummary[]>([])
  const [days, setDays]         = useState<7 | 30>(7)
  const [loading, setLoading]   = useState(true)
  const [allowed, setAllowed]   = useState(true)

  // Verify coach–athlete relationship before fetching any data
  useEffect(() => {
    if (!user || !athleteId) return
    supabase
      .from('coach_athlete_relationships')
      .select('id')
      .eq('coach_id', user.id)
      .eq('athlete_id', athleteId)
      .eq('status', 'active')
      .single()
      .then(({ data }) => {
        if (!data) { setAllowed(false); setLoading(false) }
      })
    supabase
      .from('profiles')
      .select('*')
      .eq('id', athleteId)
      .single()
      .then(({ data }) => setAthlete(data as unknown as Profile))
  }, [user, athleteId])

  useEffect(() => {
    if (!athleteId || !allowed) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const from = formatYMD(addDays(today, -days + 1))

    setLoading(true)
    supabase
      .from('journal_entries_coach_summary')
      .select('athlete_id, date, sleep_hours, sleep_quality_text, stress_level, soreness_level, motivation_level')
      .eq('athlete_id', athleteId)
      .gte('date', from)
      .order('date', { ascending: true })
      .then(({ data }) => {
        setEntries((data ?? []) as JournalCoachSummary[])
        setLoading(false)
      })
  }, [athleteId, days, allowed])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const lastEntry = entries.length ? entries.at(-1) : null
  const daysSinceLastEntry = lastEntry
    ? Math.round((today.getTime() - parseYMD(lastEntry.date).getTime()) / 86400000)
    : null

  const noRecentData = entries.length === 0 || (daysSinceLastEntry !== null && daysSinceLastEntry > 3)

  if (!allowed) {
    return (
      <div className="p-8 text-muted text-sm">Accès non autorisé.</div>
    )
  }

  return (
    <div className="max-w-4xl">
      {/* Back */}
      <button
        onClick={() => navigate('/athletes')}
        className="flex items-center gap-1.5 text-muted hover:text-ink text-sm mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Retour aux athlètes
      </button>

      {/* Header */}
      {athlete && (
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
            <span className="text-brand text-lg font-semibold">
              {(athlete.first_name ?? athlete.last_name ?? '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-ink text-xl font-semibold">
              {[athlete.first_name, athlete.last_name].filter(Boolean).join(' ') || '—'}
            </h1>
            <p className="text-muted text-sm">{formatDisciplines(athlete.disciplines)}{athlete.club ? ` · ${athlete.club}` : ''}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-ink">Suivi fatigue / récupération</h2>
        <div className="flex bg-white border border-gray-200 rounded-lg p-0.5 gap-0.5">
          {([7, 30] as const).map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
                days === d ? 'bg-brand text-white shadow-sm' : 'text-muted hover:text-ink hover:bg-gray-50'
              }`}
            >
              {d} jours
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* Last entry status */}
          {noRecentData ? (
            <div className="mb-5 flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {entries.length === 0 ? (
                <p className="text-amber-800 text-sm">Aucune entrée sur les {days} derniers jours — l'athlète n'a pas rempli son check-in matinal.</p>
              ) : (
                <p className="text-amber-800 text-sm">
                  Dernier check-in il y a <strong>{daysSinceLastEntry} jours</strong> — données potentiellement obsolètes.
                </p>
              )}
            </div>
          ) : lastEntry && (
            <p className="text-xs text-muted mb-5">
              Dernier check-in : {daysSinceLastEntry === 0 ? "aujourd'hui" : daysSinceLastEntry === 1 ? 'hier' : `il y a ${daysSinceLastEntry} jours`}
            </p>
          )}

          {/* Metric grid */}
          {entries.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-2">
                <SleepCard entries={entries} days={days} />
                {NUMERIC_METRICS.map(m => (
                  <NumericMetricCard key={m.key} metric={m} entries={entries} days={days} />
                ))}
              </div>
              <DateStrip days={days} />
            </>
          )}
        </>
      )}
    </div>
  )
}
