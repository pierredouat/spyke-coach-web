import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { AthleticEvent, MarkUnit, Gender } from '../../types/database'

// ─── Event metadata ────────────────────────────────────────────────────────────

const ATHLETIC_EVENTS: AthleticEvent[] = [
  '60m', '100m', '200m', '400m',
  '60m_haies', '100m_haies', '110m_haies', '400m_haies',
  '4x100m', '4x400m',
  '800m', '1500m', 'mile', '3000m', '3000m_steeple',
  '5000m', '10000m', 'semi_marathon', 'marathon', 'cross',
  'longueur', 'triple_saut', 'hauteur', 'perche',
  'poids', 'disque', 'javelot', 'marteau',
  'decathlon', 'heptathlon', 'pentathlon',
  'marche_10km', 'marche_20km', 'marche_35km', 'marche_50km',
]

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

const EVENT_UNIT: Record<AthleticEvent, MarkUnit> = {
  '60m': 'seconds', '100m': 'seconds', '200m': 'seconds', '400m': 'seconds',
  '60m_haies': 'seconds', '100m_haies': 'seconds', '110m_haies': 'seconds', '400m_haies': 'seconds',
  '4x100m': 'seconds', '4x400m': 'seconds',
  '800m': 'seconds', '1500m': 'seconds', 'mile': 'seconds', '3000m': 'seconds',
  '3000m_steeple': 'seconds', '5000m': 'seconds', '10000m': 'seconds',
  'semi_marathon': 'seconds', 'marathon': 'seconds', 'cross': 'seconds',
  'longueur': 'meters', 'triple_saut': 'meters', 'hauteur': 'meters', 'perche': 'meters',
  'poids': 'meters', 'disque': 'meters', 'javelot': 'meters', 'marteau': 'meters',
  'decathlon': 'points', 'heptathlon': 'points', 'pentathlon': 'points',
  'marche_10km': 'seconds', 'marche_20km': 'seconds',
  'marche_35km': 'seconds', 'marche_50km': 'seconds',
}

const UNIT_LABEL: Record<MarkUnit, string> = { seconds: 's', meters: 'm', points: 'pts' }

// ─── Local types ───────────────────────────────────────────────────────────────

type AthleteRow = {
  id: string
  first_name: string | null
  last_name: string | null
  gender: Gender | null
  weight_kg: number | null
}

type ExerciseOption = { id: string; name: string; category: string | null }
type ThresholdOp = '<' | '>'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function athleteName(a: AthleteRow) {
  return [a.first_name, a.last_name].filter(Boolean).join(' ') || '—'
}

function relativeStrength(maxKg: number | undefined, weightKg: number | null): number | null {
  if (maxKg == null || !weightKg) return null
  return Math.round((maxKg / weightKg) * 10) / 10
}

function defaultOpForUnit(unit: MarkUnit): ThresholdOp {
  return unit === 'seconds' ? '<' : '>'
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function GenderBadge({ gender }: { gender: Gender | null }) {
  if (!gender) return <span className="text-muted text-xs">—</span>
  return (
    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
      gender === 'men'
        ? 'bg-blue-50 text-blue-600'
        : 'bg-pink-50 text-pink-600'
    }`}>
      {gender === 'men' ? 'H' : 'F'}
    </span>
  )
}

type AthleteTableProps = {
  athletes: AthleteRow[]
  maxes: Record<string, number>
  perfs: Record<string, { mark: string; mark_value: number }>
  exerciseName: string
  thresholdEvent: AthleticEvent | ''
}

function AthleteTable({ athletes, maxes, perfs, exerciseName, thresholdEvent }: AthleteTableProps) {
  if (athletes.length === 0) {
    return <p className="text-sm text-muted italic py-4 text-center">Aucun athlète</p>
  }

  const showExercise = !!exerciseName
  const showPerf = !!thresholdEvent

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-xs text-muted">
          <th className="text-left py-2 pr-3 font-medium">Athlète</th>
          <th className="text-center py-2 px-2 font-medium">Genre</th>
          <th className="text-right py-2 px-2 font-medium">Poids</th>
          {showExercise && (
            <>
              <th className="text-right py-2 px-2 font-medium">Max · {exerciseName}</th>
              <th className="text-right py-2 pl-2 font-medium">Force rel.</th>
            </>
          )}
          {showPerf && (
            <th className="text-right py-2 pl-2 font-medium">Meilleure perf.</th>
          )}
        </tr>
      </thead>
      <tbody>
        {athletes.map(a => {
          const max = maxes[a.id]
          const rs = relativeStrength(max, a.weight_kg)
          const perf = perfs[a.id]
          return (
            <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="py-2.5 pr-3 font-medium text-ink">{athleteName(a)}</td>
              <td className="py-2.5 px-2 text-center"><GenderBadge gender={a.gender} /></td>
              <td className="py-2.5 px-2 text-right text-muted">
                {a.weight_kg != null ? `${a.weight_kg} kg` : '—'}
              </td>
              {showExercise && (
                <>
                  <td className="py-2.5 px-2 text-right text-muted">
                    {max != null ? `${max} kg` : '—'}
                  </td>
                  <td className="py-2.5 pl-2 text-right">
                    {rs != null
                      ? <span className="font-semibold text-ink">{rs}×</span>
                      : <span className="text-muted">—</span>
                    }
                  </td>
                </>
              )}
              {showPerf && (
                <td className="py-2.5 pl-2 text-right text-muted">
                  {perf ? perf.mark : '—'}
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TeamAnalysisPage() {
  const { team } = useAuth()

  // ── Data ────────────────────────────────────────────────────────────────────
  const [athletes, setAthletes] = useState<AthleteRow[]>([])
  const [exercises, setExercises] = useState<ExerciseOption[]>([])
  const [maxes, setMaxes] = useState<Record<string, number>>({})
  const [perfs, setPerfs] = useState<Record<string, { mark: string; mark_value: number }>>({})
  const [loading, setLoading] = useState(true)

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [genderFilter, setGenderFilter] = useState<Gender | 'all'>('all')
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [thresholdEvent, setThresholdEvent] = useState<AthleticEvent | ''>('')
  const [thresholdOp, setThresholdOp] = useState<ThresholdOp>('<')
  const [thresholdValue, setThresholdValue] = useState('')

  // ── Load athletes ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!team) return
    setLoading(true)
    supabase
      .from('coach_athlete_relationships')
      .select(`
        athlete_id,
        athlete:profiles!coach_athlete_relationships_athlete_id_fkey (
          id, first_name, last_name, gender, weight_kg
        )
      `)
      .eq('team_id', team.id)
      .eq('status', 'active')
      .then(({ data }) => {
        const rows = (data ?? []).map((r: any) => r.athlete).filter(Boolean) as AthleteRow[]
        setAthletes(rows)
        setLoading(false)
      })
  }, [team])

  // ── Load exercises ───────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('exercises')
      .select('id, name, category')
      .order('name')
      .then(({ data }) => setExercises((data ?? []) as ExerciseOption[]))
  }, [])

  // ── Load maxes when exercise changes ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedExerciseId || athletes.length === 0) { setMaxes({}); return }
    supabase
      .from('athlete_maxes')
      .select('athlete_id, max_value_kg')
      .eq('exercise_id', selectedExerciseId)
      .in('athlete_id', athletes.map(a => a.id))
      .then(({ data }) => {
        const map: Record<string, number> = {}
        ;(data ?? []).forEach((r: any) => { map[r.athlete_id] = r.max_value_kg })
        setMaxes(map)
      })
  }, [selectedExerciseId, athletes])

  // ── Load best perfs when threshold event changes ──────────────────────────────
  useEffect(() => {
    if (!thresholdEvent || athletes.length === 0) { setPerfs({}); return }
    const lowerIsBetter = EVENT_UNIT[thresholdEvent] === 'seconds'
    supabase
      .from('performances')
      .select('athlete_id, mark_value, mark')
      .eq('event', thresholdEvent)
      .in('athlete_id', athletes.map(a => a.id))
      .then(({ data }) => {
        const map: Record<string, { mark: string; mark_value: number }> = {}
        for (const p of (data ?? [])) {
          const ex = map[p.athlete_id]
          if (!ex) { map[p.athlete_id] = p; continue }
          const better = lowerIsBetter ? p.mark_value < ex.mark_value : p.mark_value > ex.mark_value
          if (better) map[p.athlete_id] = p
        }
        setPerfs(map)
      })
  }, [thresholdEvent, athletes])

  // ── Derived ──────────────────────────────────────────────────────────────────

  const exerciseName = exercises.find(e => e.id === selectedExerciseId)?.name ?? ''

  const thresholdUnit = thresholdEvent ? UNIT_LABEL[EVENT_UNIT[thresholdEvent]] : ''

  const hasThreshold =
    !!thresholdEvent && thresholdValue !== '' && !isNaN(parseFloat(thresholdValue))
  const thresholdNum = hasThreshold ? parseFloat(thresholdValue) : null

  // Exercise dropdown filter
  const filteredExercises = useMemo(() => {
    const q = exerciseSearch.trim().toLowerCase()
    return q ? exercises.filter(e => e.name.toLowerCase().includes(q)) : exercises
  }, [exercises, exerciseSearch])

  // Group exercises by category for optgroups
  const exercisesByCategory = useMemo(() => {
    const map: Record<string, ExerciseOption[]> = {}
    for (const ex of filteredExercises) {
      const cat = ex.category ?? 'Autre'
      ;(map[cat] ??= []).push(ex)
    }
    return map
  }, [filteredExercises])

  const filteredAthletes = useMemo(
    () => athletes.filter(a => genderFilter === 'all' || a.gender === genderFilter),
    [athletes, genderFilter],
  )

  function sortByStrength(list: AthleteRow[]) {
    return [...list].sort((a, b) => {
      if (selectedExerciseId) {
        const ra = relativeStrength(maxes[a.id], a.weight_kg) ?? -1
        const rb = relativeStrength(maxes[b.id], b.weight_kg) ?? -1
        if (rb !== ra) return rb - ra
      }
      return athleteName(a).localeCompare(athleteName(b))
    })
  }

  function meetsThreshold(id: string): boolean | null {
    if (!thresholdNum) return null
    const p = perfs[id]
    if (!p) return null
    return thresholdOp === '<' ? p.mark_value < thresholdNum : p.mark_value > thresholdNum
  }

  const allSorted = !hasThreshold ? sortByStrength(filteredAthletes) : []
  const meetsGroup   = hasThreshold ? sortByStrength(filteredAthletes.filter(a => meetsThreshold(a.id) === true))  : []
  const doesntGroup  = hasThreshold ? sortByStrength(filteredAthletes.filter(a => meetsThreshold(a.id) === false)) : []
  const noDataGroup  = hasThreshold ? sortByStrength(filteredAthletes.filter(a => meetsThreshold(a.id) === null))  : []

  const meetsLabel  = thresholdOp === '<'
    ? `Sous ${thresholdValue} ${thresholdUnit}`
    : `Au-dessus de ${thresholdValue} ${thresholdUnit}`
  const doesntLabel = thresholdOp === '<'
    ? `Au-dessus de ${thresholdValue} ${thresholdUnit}`
    : `Sous ${thresholdValue} ${thresholdUnit}`

  // ── Handler: selecting a threshold event resets op to a sensible default ──────
  function handleThresholdEventChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const ev = e.target.value as AthleticEvent | ''
    setThresholdEvent(ev)
    if (ev) setThresholdOp(defaultOpForUnit(EVENT_UNIT[ev]))
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Analyse d'équipe</h1>
        <p className="text-sm text-muted mt-1">
          Comparez les athlètes par force relative et performance sur épreuve.
        </p>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-5">

        {/* Row 1 : genre + sous-groupe */}
        <div className="flex flex-wrap gap-6 items-end">

          {/* Genre */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Genre</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm">
              {(['all', 'men', 'women'] as const).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenderFilter(g)}
                  className={`px-3 py-1.5 transition-colors ${
                    genderFilter === g
                      ? 'bg-brand text-white font-medium'
                      : 'bg-white text-muted hover:bg-gray-50'
                  } ${g !== 'all' ? 'border-l border-gray-200' : ''}`}
                >
                  {g === 'all' ? 'Tous' : g === 'men' ? 'Hommes' : 'Femmes'}
                </button>
              ))}
            </div>
          </div>

          {/* Sous-groupe (placeholder) */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Sous-groupe</label>
            <div className="relative group">
              <select
                disabled
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-muted bg-gray-50 cursor-not-allowed pr-8"
              >
                <option>Tous les groupes</option>
              </select>
              <span className="absolute -top-7 left-0 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                À venir — définissez des groupes dans Mon équipe
              </span>
            </div>
          </div>
        </div>

        {/* Row 2 : exercice (force) */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">
            Exercice — force relative
          </label>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="text"
              value={exerciseSearch}
              onChange={e => setExerciseSearch(e.target.value)}
              placeholder="Rechercher un exercice…"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-brand bg-white w-52 transition-colors"
            />
            <select
              value={selectedExerciseId}
              onChange={e => setSelectedExerciseId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-brand bg-white max-w-xs transition-colors"
            >
              <option value="">— Aucun exercice —</option>
              {Object.entries(exercisesByCategory).map(([cat, exs]) => (
                <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                  {exs.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedExerciseId && (
              <button
                type="button"
                onClick={() => { setSelectedExerciseId(''); setExerciseSearch('') }}
                className="text-xs text-muted hover:text-accent transition-colors"
              >
                Effacer
              </button>
            )}
          </div>
        </div>

        {/* Row 3 : seuil de performance */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">
            Seuil de performance — grouper les athlètes
          </label>
          <div className="flex gap-2 items-center flex-wrap">
            <select
              value={thresholdEvent}
              onChange={handleThresholdEventChange}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-brand bg-white transition-colors"
            >
              <option value="">— Choisir une épreuve —</option>
              {ATHLETIC_EVENTS.map(ev => (
                <option key={ev} value={ev}>{EVENT_LABELS[ev]}</option>
              ))}
            </select>

            {thresholdEvent && (
              <>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm">
                  {(['<', '>'] as ThresholdOp[]).map(op => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setThresholdOp(op)}
                      className={`px-3 py-1.5 transition-colors font-mono ${
                        thresholdOp === op
                          ? 'bg-brand text-white'
                          : 'bg-white text-muted hover:bg-gray-50'
                      } ${op === '>' ? 'border-l border-gray-200' : ''}`}
                    >
                      {op}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  value={thresholdValue}
                  onChange={e => setThresholdValue(e.target.value)}
                  placeholder="10.80"
                  step="0.01"
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-brand bg-white w-24 transition-colors"
                />

                {thresholdUnit && (
                  <span className="text-sm text-muted font-medium">{thresholdUnit}</span>
                )}

                <button
                  type="button"
                  onClick={() => { setThresholdEvent(''); setThresholdValue('') }}
                  className="text-xs text-muted hover:text-accent transition-colors"
                >
                  Effacer
                </button>
              </>
            )}
          </div>
          {thresholdEvent && !hasThreshold && thresholdValue === '' && (
            <p className="text-xs text-muted mt-1.5">
              Entrez une valeur pour activer le groupement par seuil.
            </p>
          )}
        </div>
      </div>

      {/* ── Results ────────────────────────────────────────────────────────────── */}
      {loading ? (
        <p className="text-sm text-muted text-center py-12">Chargement…</p>
      ) : filteredAthletes.length === 0 ? (
        <p className="text-sm text-muted text-center py-12">
          Aucun athlète actif{genderFilter !== 'all' ? ' pour ce filtre genre' : ''}.
        </p>
      ) : hasThreshold ? (
        /* ── Grouped view ── */
        <div className="space-y-6">
          {/* Summary */}
          <p className="text-xs text-muted">
            {filteredAthletes.length} athlète{filteredAthletes.length > 1 ? 's' : ''} —
            groupés par rapport au seuil&nbsp;
            <strong>{thresholdOp} {thresholdValue} {thresholdUnit}</strong> sur{' '}
            <strong>{EVENT_LABELS[thresholdEvent as AthleticEvent]}</strong>
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Meets threshold */}
            <div className="bg-white border border-emerald-100 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                    Seuil atteint
                  </span>
                  <p className="text-xs text-emerald-600 font-mono mt-0.5">{meetsLabel}</p>
                </div>
                <span className="text-sm font-bold text-emerald-700 bg-emerald-100 rounded-full w-7 h-7 flex items-center justify-center">
                  {meetsGroup.length}
                </span>
              </div>
              <div className="px-5 py-2">
                <AthleteTable
                  athletes={meetsGroup}
                  maxes={maxes}
                  perfs={perfs}
                  exerciseName={exerciseName}
                  thresholdEvent={thresholdEvent}
                />
              </div>
            </div>

            {/* Doesn't meet */}
            <div className="bg-white border border-amber-100 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    Seuil non atteint
                  </span>
                  <p className="text-xs text-amber-600 font-mono mt-0.5">{doesntLabel}</p>
                </div>
                <span className="text-sm font-bold text-amber-700 bg-amber-100 rounded-full w-7 h-7 flex items-center justify-center">
                  {doesntGroup.length}
                </span>
              </div>
              <div className="px-5 py-2">
                <AthleteTable
                  athletes={doesntGroup}
                  maxes={maxes}
                  perfs={perfs}
                  exerciseName={exerciseName}
                  thresholdEvent={thresholdEvent}
                />
              </div>
            </div>
          </div>

          {/* No perf group */}
          {noDataGroup.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                  Sans performance enregistrée
                </span>
                <span className="text-sm font-bold text-muted bg-gray-100 rounded-full w-7 h-7 flex items-center justify-center">
                  {noDataGroup.length}
                </span>
              </div>
              <div className="px-5 py-2">
                <AthleteTable
                  athletes={noDataGroup}
                  maxes={maxes}
                  perfs={perfs}
                  exerciseName={exerciseName}
                  thresholdEvent={thresholdEvent}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Single table view ── */
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wide">
              Athlètes actifs
            </span>
            <span className="text-xs text-muted">
              {filteredAthletes.length} athlète{filteredAthletes.length > 1 ? 's' : ''}
              {selectedExerciseId && ' · trié par force relative'}
            </span>
          </div>
          <div className="px-5 py-2">
            <AthleteTable
              athletes={allSorted}
              maxes={maxes}
              perfs={perfs}
              exerciseName={exerciseName}
              thresholdEvent={thresholdEvent}
            />
          </div>
        </div>
      )}
    </div>
  )
}
