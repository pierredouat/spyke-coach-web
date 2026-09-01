import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type {
  Profile, JournalCoachSummary, SleepHoursEnum, SleepQualityTextEnum,
  AthleticEvent, MarkUnit,
} from '../../types/database'
import { formatYMD, addDays, parseYMD, fmtDay, fmtMonthShort } from '../../lib/dates'
import { formatDisciplines } from '../../lib/disciplines'

// ─── Sleep enum mappings ──────────────────────────────────────────────────────
const SLEEP_HOURS_LABEL: Record<SleepHoursEnum, string> = {
  less_6:   '< 6h',
  '6_to_8': '6–8h',
  more_8:   '> 8h',
}
const SLEEP_HOURS_VALUE: Record<SleepHoursEnum, number> = {
  less_6:   1,
  '6_to_8': 2,
  more_8:   3,
}
const SLEEP_QUALITY_LABEL: Record<SleepQualityTextEnum, string> = {
  agitated: 'Agité',
  okay:     'Correct',
  restful:  'Reposant',
}

// ─── Athletic event labels ────────────────────────────────────────────────────
const EVENT_LABELS: Record<AthleticEvent, string> = {
  '60m': '60m', '100m': '100m', '200m': '200m', '400m': '400m',
  '60m_haies': '60m haies', '100m_haies': '100m haies',
  '110m_haies': '110m haies', '400m_haies': '400m haies',
  '4x100m': '4×100m', '4x400m': '4×400m',
  '800m': '800m', '1500m': '1500m', 'mile': 'Mile', '3000m': '3000m',
  '3000m_steeple': '3000m steeple', '5000m': '5000m', '10000m': '10 000m',
  'semi_marathon': 'Semi-marathon', 'marathon': 'Marathon', 'cross': 'Cross',
  'longueur': 'Longueur', 'triple_saut': 'Triple saut',
  'hauteur': 'Hauteur', 'perche': 'Perche',
  'poids': 'Poids', 'disque': 'Disque', 'javelot': 'Javelot', 'marteau': 'Marteau',
  'decathlon': 'Décathlon', 'heptathlon': 'Heptathlon', 'pentathlon': 'Pentathlon',
  'marche_10km': 'Marche 10km', 'marche_20km': 'Marche 20km',
  'marche_35km': 'Marche 35km', 'marche_50km': 'Marche 50km',
}

// ─── Local types ──────────────────────────────────────────────────────────────
type PerformanceRow = {
  id: string
  event: AthleticEvent
  mark: string
  mark_value: number
  unit: MarkUnit
  is_pb: boolean
  date: string
}

type ExerciseResultPoint = {
  actual_value: string
  actual_value_numeric: number
  unit: string | null
  recorded_at: string
}

type ExerciseGroup = {
  id: string
  name: string
  unit: string | null
  points: ExerciseResultPoint[]
}

// ─── Metric config ────────────────────────────────────────────────────────────
const NUMERIC_METRICS = [
  { key: 'stress_level'     as const, label: 'Stress',       unit: '/5', color: '#D97706', scale: [1, 5] as [number, number], invert: true  },
  { key: 'soreness_level'   as const, label: 'Courbatures',  unit: '/5', color: '#C1592E', scale: [1, 5] as [number, number], invert: true  },
  { key: 'motivation_level' as const, label: 'Motivation',   unit: '/5', color: '#0D9488', scale: [1, 5] as [number, number], invert: false },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ─── SVG sparkline ────────────────────────────────────────────────────────────
function SparkLine({ data, color, scale }: {
  data: (number | null)[]
  color: string
  scale: [number, number]
}) {
  const W = 300, H = 60, PAD = 6
  const clamp = (v: number) => Math.min(Math.max(v, scale[0]), scale[1])
  const toY = (v: number) => PAD + (1 - (clamp(v) - scale[0]) / (scale[1] - scale[0])) * (H - PAD * 2)
  const toX = (i: number) => data.length < 2 ? W / 2 : (i / (data.length - 1)) * W

  let d = ''; let inLine = false
  data.forEach((v, i) => {
    if (v === null) { inLine = false; return }
    const x = toX(i), y = toY(v)
    d += inLine ? ` L ${x.toFixed(1)} ${y.toFixed(1)}` : ` M ${x.toFixed(1)} ${y.toFixed(1)}`
    inLine = true
  })
  const dots = data.map((v, i) => v === null ? null : { x: toX(i), y: toY(v), i })
  const lastDotIdx = [...dots].reverse().find(d => d !== null)?.i ?? -1

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full" style={{ height: 64 }}>
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={0} y1={PAD + f * (H - PAD * 2)} x2={W} y2={PAD + f * (H - PAD * 2)} stroke="#F3F4F6" strokeWidth="1.5" />
      ))}
      {d && <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {dots.map(dot => dot === null ? null : (
        <circle key={dot.i} cx={dot.x.toFixed(1)} cy={dot.y.toFixed(1)}
          r={dot.i === lastDotIdx ? 4 : 3}
          fill={dot.i === lastDotIdx ? color : '#fff'}
          stroke={color} strokeWidth="2" />
      ))}
    </svg>
  )
}

// ─── Performance progression chart ───────────────────────────────────────────
function PerformanceProgressionChart({ perfs, unit }: { perfs: PerformanceRow[]; unit: MarkUnit }) {
  if (perfs.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 rounded-xl bg-gray-50 border border-gray-100">
        <p className="text-xs text-muted text-center">
          {perfs.length === 0 ? 'Aucune marque enregistrée' : 'Ajoute au moins 2 marques pour voir la courbe'}
        </p>
      </div>
    )
  }

  const sorted = [...perfs].sort((a, b) => a.date.localeCompare(b.date))
  const invert = unit === 'seconds'
  const W = 560, H = 180, PAD_X = 20, PAD_Y = 20

  const values = sorted.map(p => p.mark_value)
  const minV = Math.min(...values), maxV = Math.max(...values)
  const range = maxV - minV || 1
  const bestV = invert ? minV : maxV

  const pts = sorted.map((p, i) => {
    const x = PAD_X + (sorted.length === 1 ? 0 : (i / (sorted.length - 1)) * (W - PAD_X * 2))
    const norm = (p.mark_value - minV) / range
    const y = invert ? PAD_Y + norm * (H - PAD_Y * 2) : PAD_Y + (1 - norm) * (H - PAD_Y * 2)
    return { x, y, p }
  })

  const path = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
  const BRAND = '#3743BA'

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <line x1={PAD_X} x2={W - PAD_X} y1={H - PAD_Y} y2={H - PAD_Y} stroke="#F3F4F6" strokeWidth={1} />
        <path
          d={`${path} L ${pts.at(-1)!.x.toFixed(1)} ${H - PAD_Y} L ${pts[0].x.toFixed(1)} ${H - PAD_Y} Z`}
          fill={BRAND} fillOpacity={0.06}
        />
        <path d={path} fill="none" stroke={BRAND} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((pt, i) => {
          const isPb = pt.p.is_pb || pt.p.mark_value === bestV
          return (
            <g key={i}>
              {isPb && <circle cx={pt.x} cy={pt.y} r={11} fill="none" stroke={BRAND} strokeOpacity={0.2} strokeWidth={2} />}
              <circle cx={pt.x} cy={pt.y} r={isPb ? 6 : 3.5}
                fill={isPb ? BRAND : '#fff'} stroke={BRAND} strokeWidth={2} />
              {i === pts.length - 1 && (
                <text x={pt.x} y={pt.y - 14} textAnchor="middle" fontSize={10} fontWeight={700} fill={BRAND}>
                  {pt.p.mark}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between text-xs text-muted mt-1 px-1">
        <span>{fmtDate(sorted[0].date)}</span>
        <span>{fmtDate(sorted.at(-1)!.date)}</span>
      </div>
    </div>
  )
}

// ─── Exercise progression chart ───────────────────────────────────────────────
function ExerciseProgressionChartView({ points, name }: { points: ExerciseResultPoint[]; name: string }) {
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 rounded-xl bg-gray-50 border border-gray-100">
        <p className="text-xs text-muted text-center">
          {points.length === 0 ? 'Aucun résultat enregistré' : `2 résultats min pour voir la courbe de « ${name} »`}
        </p>
      </div>
    )
  }

  const sorted = [...points].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
  const W = 560, H = 160, PAD_X = 20, PAD_Y = 20

  const values = sorted.map(p => p.actual_value_numeric)
  const minV = Math.min(...values), maxV = Math.max(...values)
  const range = maxV - minV || 1
  const bestV = maxV

  const pts = sorted.map((p, i) => {
    const x = PAD_X + (sorted.length === 1 ? 0 : (i / (sorted.length - 1)) * (W - PAD_X * 2))
    const norm = (p.actual_value_numeric - minV) / range
    const y = PAD_Y + (1 - norm) * (H - PAD_Y * 2)
    return { x, y, p }
  })

  const path = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
  const BRAND = '#3743BA'

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <line x1={PAD_X} x2={W - PAD_X} y1={H - PAD_Y} y2={H - PAD_Y} stroke="#F3F4F6" strokeWidth={1} />
        <path
          d={`${path} L ${pts.at(-1)!.x.toFixed(1)} ${H - PAD_Y} L ${pts[0].x.toFixed(1)} ${H - PAD_Y} Z`}
          fill={BRAND} fillOpacity={0.06}
        />
        <path d={path} fill="none" stroke={BRAND} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((pt, i) => {
          const isBest = pt.p.actual_value_numeric === bestV
          return (
            <g key={i}>
              {isBest && <circle cx={pt.x} cy={pt.y} r={11} fill="none" stroke={BRAND} strokeOpacity={0.2} strokeWidth={2} />}
              <circle cx={pt.x} cy={pt.y} r={isBest ? 6 : 3.5}
                fill={isBest ? BRAND : '#fff'} stroke={BRAND} strokeWidth={2} />
              {i === pts.length - 1 && (
                <text x={pt.x} y={pt.y - 14} textAnchor="middle" fontSize={10} fontWeight={700} fill={BRAND}>
                  {pt.p.actual_value}{pt.p.unit ? ` ${pt.p.unit}` : ''}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between text-xs text-muted mt-1 px-1">
        <span>{fmtDate(sorted[0].recorded_at)}</span>
        <span>{fmtDate(sorted.at(-1)!.recorded_at)}</span>
      </div>
    </div>
  )
}

// ─── Numeric metric card ──────────────────────────────────────────────────────
function NumericMetricCard({ metric, entries, days }: {
  metric: typeof NUMERIC_METRICS[number]
  entries: JournalCoachSummary[]
  days: number
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
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
  const trendColor = trendSign === 0 ? 'text-muted'
    : (metric.invert ? trendSign > 0 : trendSign < 0) ? 'text-amber-600' : 'text-emerald-600'

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{metric.label}</p>
          {avg !== null && (
            <p className="text-xl font-semibold text-ink mt-0.5">
              {avg.toFixed(1)}<span className="text-xs font-normal text-muted ml-1">moy{metric.unit}</span>
            </p>
          )}
        </div>
        <div className="text-right">
          {lastValue !== null && <p className="text-sm text-muted">Dernier : <span className="text-ink font-medium">{lastValue}</span></p>}
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

// ─── Sleep card ───────────────────────────────────────────────────────────────
function SleepCard({ entries, days }: { entries: JournalCoachSummary[]; days: number }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const hoursSlots: (number | null)[] = Array.from({ length: days }, (_, i) => {
    const d = formatYMD(addDays(today, i - days + 1))
    const h = entries.find(e => e.date === d)?.sleep_hours ?? null
    return h ? SLEEP_HOURS_VALUE[h] : null
  })
  const rawHours: (SleepHoursEnum | null)[] = Array.from({ length: days }, (_, i) => {
    const d = formatYMD(addDays(today, i - days + 1))
    return entries.find(e => e.date === d)?.sleep_hours ?? null
  })
  const lastHours  = rawHours.filter(v => v !== null).at(-1) ?? null
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
              {SLEEP_HOURS_LABEL[lastHours]}<span className="text-xs font-normal text-muted ml-1">dernier</span>
            </p>
          )}
        </div>
        {lastQuality && <p className="text-sm text-muted">Qualité : <span className="text-ink font-medium">{SLEEP_QUALITY_LABEL[lastQuality]}</span></p>}
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

// ─── Date axis strip ──────────────────────────────────────────────────────────
function DateStrip({ days }: { days: number }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const step = days <= 7 ? 1 : Math.ceil(days / 7)
  const labels: { label: string; pct: number }[] = []
  for (let i = 0; i < days; i += step) {
    const d = addDays(today, i - days + 1)
    labels.push({ label: `${fmtDay(d)} ${fmtMonthShort(d)}`, pct: (i / (days - 1)) * 100 })
  }
  labels.push({ label: "Auj.", pct: 100 })
  return (
    <div className="relative h-5 mx-0">
      {labels.map((l, i) => (
        <span key={i} className="absolute text-xs text-muted whitespace-nowrap"
          style={{ left: `${l.pct}%`, transform: l.pct === 0 ? 'none' : l.pct === 100 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
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

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold text-ink mb-3">{title}</h2>
  )
}

// ─── Pill selector ────────────────────────────────────────────────────────────
function PillSelector<T extends string>({ options, selected, onSelect, getLabel }: {
  options: T[]
  selected: T | null
  onSelect: (v: T) => void
  getLabel: (v: T) => string
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-none">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
            selected === opt
              ? 'bg-brand text-white border-brand'
              : 'bg-white text-muted border-gray-200 hover:border-brand/40 hover:text-ink'
          }`}
        >
          {getLabel(opt)}
        </button>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AthleteDetailPage() {
  const { id: athleteId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, team, loading: authLoading } = useAuth()

  const [athlete,   setAthlete]   = useState<Profile | null>(null)
  const [allowed,   setAllowed]   = useState(true)
  const [loading,   setLoading]   = useState(true)

  // Performances
  const [performances,   setPerformances]   = useState<PerformanceRow[]>([])
  const [selectedEvent,  setSelectedEvent]  = useState<AthleticEvent | null>(null)

  // Exercises
  const [exerciseGroups,      setExerciseGroups]      = useState<ExerciseGroup[]>([])
  const [selectedExerciseId,  setSelectedExerciseId]  = useState<string | null>(null)

  // Journal
  const [entries,        setEntries]        = useState<JournalCoachSummary[]>([])
  const [days,           setDays]           = useState<7 | 30>(7)
  const [journalLoading, setJournalLoading] = useState(false)

  // ── Effect 1: auth check + profile + charts ──────────────────────────────
  useEffect(() => {
    if (authLoading || !user || !team || !athleteId) return

    async function load() {
      const { data: rel } = await supabase
        .from('coach_athlete_relationships')
        .select('id')
        .eq('team_id', team!.id)
        .eq('athlete_id', athleteId!)
        .maybeSingle()

      if (!rel) { setAllowed(false); setLoading(false); return }

      const [profileRes, perfRes, exRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', athleteId!)
          .single(),
        supabase
          .from('performances')
          .select('id, event, mark, mark_value, unit, is_pb, date')
          .eq('athlete_id', athleteId!)
          .order('date', { ascending: true }),
        supabase
          .from('exercise_results')
          .select(`
            actual_value,
            actual_value_numeric,
            unit,
            recorded_at,
            exercise_id,
            exercises!exercise_results_exercise_id_fkey (name)
          `)
          .eq('athlete_id', athleteId!)
          .not('exercise_id', 'is', null)
          .not('actual_value_numeric', 'is', null)
          .order('recorded_at', { ascending: true }),
      ])

      if (profileRes.data) setAthlete(profileRes.data as unknown as Profile)

      if (perfRes.data) {
        const perfs = perfRes.data as PerformanceRow[]
        setPerformances(perfs)
        const events = [...new Set(perfs.map(p => p.event))]
        if (events.length > 0) setSelectedEvent(events[0])
      }

      if (exRes.data) {
        const groups = new Map<string, ExerciseGroup>()
        for (const row of exRes.data as {
          actual_value: string
          actual_value_numeric: number
          unit: string | null
          recorded_at: string
          exercise_id: string | null
          exercises: { name: string } | null
        }[]) {
          if (!row.exercise_id || row.actual_value_numeric === null) continue
          if (!groups.has(row.exercise_id)) {
            groups.set(row.exercise_id, {
              id: row.exercise_id,
              name: row.exercises?.name ?? 'Exercice',
              unit: row.unit,
              points: [],
            })
          }
          groups.get(row.exercise_id)!.points.push({
            actual_value:         row.actual_value,
            actual_value_numeric: row.actual_value_numeric,
            unit:                 row.unit,
            recorded_at:          row.recorded_at,
          })
        }
        const arr = [...groups.values()]
        setExerciseGroups(arr)
        if (arr.length > 0) setSelectedExerciseId(arr[0].id)
      }

      setLoading(false)
    }

    load()
  }, [authLoading, user, team, athleteId])

  // ── Effect 2: journal (re-runs when days or allowed changes post-load) ────
  useEffect(() => {
    if (!athleteId || !allowed || loading) return
    setJournalLoading(true)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const from = formatYMD(addDays(today, -days + 1))
    supabase
      .from('journal_entries_coach_summary')
      .select('athlete_id, date, sleep_hours, sleep_quality_text, stress_level, soreness_level, motivation_level')
      .eq('athlete_id', athleteId)
      .gte('date', from)
      .order('date', { ascending: true })
      .then(({ data }) => {
        setEntries((data ?? []) as JournalCoachSummary[])
        setJournalLoading(false)
      })
  }, [athleteId, days, allowed, loading])

  // ── Derived ───────────────────────────────────────────────────────────────
  const eventPerfs = performances.filter(p => p.event === selectedEvent)
  const eventUnit  = eventPerfs[0]?.unit ?? 'seconds'
  const pb = eventPerfs
    .filter(p => p.is_pb)
    .sort((a, b) => eventUnit === 'seconds' ? a.mark_value - b.mark_value : b.mark_value - a.mark_value)[0]
    ?? null

  const eventList = [...new Set(performances.map(p => p.event))]
  const selectedExercise = exerciseGroups.find(g => g.id === selectedExerciseId) ?? null

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const lastEntry = entries.length ? entries.at(-1) : null
  const daysSinceLastEntry = lastEntry
    ? Math.round((today.getTime() - parseYMD(lastEntry.date).getTime()) / 86400000)
    : null
  const noRecentData = entries.length === 0 || (daysSinceLastEntry !== null && daysSinceLastEntry > 3)

  // ── Render guards ─────────────────────────────────────────────────────────
  if (!allowed) {
    return <div className="p-8 text-muted text-sm">Accès non autorisé.</div>
  }
  if (loading) {
    return (
      <div className="max-w-4xl">
        <button onClick={() => navigate('/athletes')}
          className="flex items-center gap-1.5 text-muted hover:text-ink text-sm mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour aux athlètes
        </button>
        <Spinner />
      </div>
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
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
            <span className="text-brand text-lg font-semibold">
              {(athlete.first_name ?? athlete.last_name ?? '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-ink text-xl font-semibold">
              {[athlete.first_name, athlete.last_name].filter(Boolean).join(' ') || '—'}
            </h1>
            <p className="text-muted text-sm">
              {formatDisciplines(athlete.disciplines)}{athlete.club ? ` · ${athlete.club}` : ''}
            </p>
          </div>
        </div>
      )}

      {/* ── Section 1 : Progression par épreuve ──────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <SectionHeading title="Progression par épreuve" />
          {eventPerfs.length > 0 && (
            <span className="text-xs text-muted">{eventPerfs.length} marque{eventPerfs.length > 1 ? 's' : ''}</span>
          )}
        </div>

        {eventList.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-8 text-center">
            <p className="text-muted text-sm">Aucune performance enregistrée</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <PillSelector
              options={eventList}
              selected={selectedEvent}
              onSelect={setSelectedEvent}
              getLabel={e => EVENT_LABELS[e] ?? e}
            />

            {pb && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-brand bg-brand/8 border border-brand/20 px-2.5 py-1 rounded-full">
                  Record personnel : {pb.mark}
                </span>
              </div>
            )}

            <PerformanceProgressionChart perfs={eventPerfs} unit={eventUnit} />
          </div>
        )}
      </section>

      {/* ── Section 2 : Musculation ───────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <SectionHeading title="Musculation" />
          {selectedExercise && selectedExercise.points.length > 0 && (
            <span className="text-xs text-muted">
              {selectedExercise.points.length} résultat{selectedExercise.points.length > 1 ? 's' : ''}
              {selectedExercise.unit ? ` · ${selectedExercise.unit}` : ''}
            </span>
          )}
        </div>

        {exerciseGroups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-8 text-center">
            <p className="text-muted text-sm">Aucun résultat d&apos;exercice enregistré</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <PillSelector
              options={exerciseGroups.map(g => g.id)}
              selected={selectedExerciseId}
              onSelect={setSelectedExerciseId}
              getLabel={id => exerciseGroups.find(g => g.id === id)?.name ?? id}
            />

            {selectedExercise && (
              <ExerciseProgressionChartView
                points={selectedExercise.points}
                name={selectedExercise.name}
              />
            )}
          </div>
        )}
      </section>

      {/* ── Section 3 : Fatigue / Récupération ───────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <SectionHeading title="Fatigue / Récupération" />
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

        {journalLoading ? <Spinner /> : (
          <>
            {noRecentData ? (
              <div className="mb-5 flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {entries.length === 0 ? (
                  <p className="text-amber-800 text-sm">Aucune entrée sur les {days} derniers jours.</p>
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
      </section>
    </div>
  )
}
