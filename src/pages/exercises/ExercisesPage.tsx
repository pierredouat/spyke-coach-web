import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type {
  Exercise, ExerciseFamily, ExerciseDisciplineGroup, MuscuCycle, ExerciseUnit,
} from '../../types/database'

// ─── Labels ───────────────────────────────────────────────────────────────────

const FAMILY_LABELS: Record<ExerciseFamily, string> = {
  discipline:     'Discipline',
  musculation:    'Musculation',
  plyometrie:     'Plyométrie',
  gainage_prehab: 'Gainage / Préhab',
  cardio_aerobie: 'Cardio / Aérobie',
}

const FAMILY_COLORS: Record<ExerciseFamily, string> = {
  discipline:     'bg-brand/10 text-brand',
  musculation:    'bg-slate-100 text-slate-600',
  plyometrie:     'bg-amber-50 text-amber-700',
  gainage_prehab: 'bg-emerald-50 text-emerald-700',
  cardio_aerobie: 'bg-sky-50 text-sky-700',
}

const GROUP_LABELS: Record<ExerciseDisciplineGroup, string> = {
  sprint:   'Sprint',
  sauts:    'Sauts',
  lancers:  'Lancers',
  demi_fond:'Demi-fond',
  haies:    'Haies',
  combines: 'Combinés',
  marche:   'Marche',
}

const CYCLE_LABELS: Record<MuscuCycle, string> = {
  force:       'Force',
  puissance:   'Puissance',
  vitesse:     'Vitesse',
  hypertrophie:'Hypertrophie',
}

const UNIT_LABELS: Record<ExerciseUnit, string> = {
  kg: 'kg', s: 's', m: 'm', reps: 'rép.', points: 'pts',
}

const ALL_FAMILIES = Object.keys(FAMILY_LABELS) as ExerciseFamily[]
const ALL_GROUPS   = Object.keys(GROUP_LABELS) as ExerciseDisciplineGroup[]
const ALL_CYCLES   = Object.keys(CYCLE_LABELS) as MuscuCycle[]
const ALL_UNITS    = Object.keys(UNIT_LABELS) as ExerciseUnit[]

// ─── Create form state ────────────────────────────────────────────────────────

type CreateForm = {
  name: string
  family: ExerciseFamily
  discipline_group: ExerciseDisciplineGroup | ''
  musculation_cycle: MuscuCycle | ''
  default_unit: ExerciseUnit
}

const DEFAULT_FORM: CreateForm = {
  name: '',
  family: 'musculation',
  discipline_group: '',
  musculation_cycle: 'force',
  default_unit: 'reps',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExercisesPage() {
  const { user } = useAuth()

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFamily, setActiveFamily] = useState<ExerciseFamily | 'all'>('all')
  const [activeGroup, setActiveGroup] = useState<ExerciseDisciplineGroup | null>(null)
  const [activeCycle, setActiveCycle] = useState<MuscuCycle | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateForm>(DEFAULT_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => { fetchExercises() }, [])

  async function fetchExercises() {
    setLoading(true)
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .order('family', { ascending: true })
      .order('name', { ascending: true })
    setExercises(data ?? [])
    setLoading(false)
  }

  // ── Filters ──────────────────────────────────────────────────────────────────

  function handleFamilyChange(f: ExerciseFamily | 'all') {
    setActiveFamily(f)
    setActiveGroup(null)
    setActiveCycle(null)
  }

  const filtered = exercises.filter(ex => {
    if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false
    if (activeFamily !== 'all' && ex.family !== activeFamily) return false
    if (activeGroup && ex.discipline_group !== activeGroup) return false
    if (activeCycle && ex.musculation_cycle !== activeCycle) return false
    return true
  })

  // ── Create ───────────────────────────────────────────────────────────────────

  function setField<K extends keyof CreateForm>(k: K, v: CreateForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!user || !form.name.trim()) return
    setCreating(true)
    setCreateError(null)

    const { data, error } = await supabase
      .from('exercises')
      .insert({
        coach_id:          user.id,
        name:              form.name.trim(),
        family:            form.family,
        discipline_group:  form.family === 'discipline' && form.discipline_group
                             ? form.discipline_group : null,
        musculation_cycle: form.family === 'musculation' && form.musculation_cycle
                             ? form.musculation_cycle : null,
        default_unit:      form.default_unit,
      })
      .select()
      .single()

    if (error) {
      setCreateError(error.message)
    } else if (data) {
      setExercises(prev => [data, ...prev])
      setForm(DEFAULT_FORM)
      setShowCreate(false)
    }
    setCreating(false)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-ink text-2xl font-semibold">Banque d&apos;exercices</h1>
          <p className="text-muted text-sm mt-1">
            {exercises.length} exercice{exercises.length !== 1 ? 's' : ''} disponibles
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(s => !s); setCreateError(null) }}
          className="flex items-center gap-2 bg-brand hover:bg-brand-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Créer un exercice
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
          <h2 className="text-ink text-sm font-semibold mb-4">Nouvel exercice personnalisé</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="col-span-2">
              <label className="block text-xs text-muted mb-1.5">Nom *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                required
                placeholder="Ex : Foulées courtes"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
              />
            </div>
            {/* Family */}
            <div>
              <label className="block text-xs text-muted mb-1.5">Famille</label>
              <select
                value={form.family}
                onChange={e => setField('family', e.target.value as ExerciseFamily)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors bg-white"
              >
                {ALL_FAMILIES.map(f => (
                  <option key={f} value={f}>{FAMILY_LABELS[f]}</option>
                ))}
              </select>
            </div>
            {/* Unit */}
            <div>
              <label className="block text-xs text-muted mb-1.5">Unité par défaut</label>
              <select
                value={form.default_unit}
                onChange={e => setField('default_unit', e.target.value as ExerciseUnit)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors bg-white"
              >
                {ALL_UNITS.map(u => (
                  <option key={u} value={u}>{UNIT_LABELS[u]}</option>
                ))}
              </select>
            </div>
            {/* Discipline group (conditional) */}
            {form.family === 'discipline' && (
              <div>
                <label className="block text-xs text-muted mb-1.5">Groupe de discipline</label>
                <select
                  value={form.discipline_group}
                  onChange={e => setField('discipline_group', e.target.value as ExerciseDisciplineGroup)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors bg-white"
                >
                  <option value="">— Aucun —</option>
                  {ALL_GROUPS.map(g => (
                    <option key={g} value={g}>{GROUP_LABELS[g]}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Musculation cycle (conditional) */}
            {form.family === 'musculation' && (
              <div>
                <label className="block text-xs text-muted mb-1.5">Cycle de musculation</label>
                <select
                  value={form.musculation_cycle}
                  onChange={e => setField('musculation_cycle', e.target.value as MuscuCycle)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors bg-white"
                >
                  <option value="">— Aucun —</option>
                  {ALL_CYCLES.map(c => (
                    <option key={c} value={c}>{CYCLE_LABELS[c]}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Error + actions */}
            {createError && (
              <p className="col-span-2 text-accent text-xs bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}
            <div className="col-span-2 flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={creating || !form.name.trim()}
                className="bg-brand hover:bg-brand-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {creating ? 'Enregistrement…' : 'Créer'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-sm text-muted hover:text-ink transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un exercice…"
          className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2.5 text-sm text-ink placeholder-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Family tabs */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {(['all', ...ALL_FAMILIES] as const).map(f => (
          <button
            key={f}
            onClick={() => handleFamilyChange(f)}
            className={`text-sm px-3.5 py-1.5 rounded-lg font-medium transition-colors ${
              activeFamily === f
                ? 'bg-brand text-white'
                : 'text-muted hover:text-ink hover:bg-gray-100'
            }`}
          >
            {f === 'all' ? 'Tous' : FAMILY_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Sub-filters */}
      {activeFamily === 'discipline' && (
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {ALL_GROUPS.map(g => (
            <button
              key={g}
              onClick={() => setActiveGroup(activeGroup === g ? null : g)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                activeGroup === g
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-gray-200 text-muted hover:border-gray-300 hover:text-ink'
              }`}
            >
              {GROUP_LABELS[g]}
            </button>
          ))}
        </div>
      )}
      {activeFamily === 'musculation' && (
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {ALL_CYCLES.map(c => (
            <button
              key={c}
              onClick={() => setActiveCycle(activeCycle === c ? null : c)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                activeCycle === c
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-gray-200 text-muted hover:border-gray-300 hover:text-ink'
              }`}
            >
              {CYCLE_LABELS[c]}
            </button>
          ))}
        </div>
      )}

      {/* Exercise grid */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted text-sm pt-4">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-muted text-sm">Aucun exercice ne correspond à votre recherche.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 xl:grid-cols-4">
          {filtered.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Exercise card ─────────────────────────────────────────────────────────────

function ExerciseCard({ exercise: ex }: { exercise: Exercise }) {
  const isPersonal = ex.coach_id !== null

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-2 hover:border-gray-200 transition-colors">
      {/* Top row: family badge + generic/personal tag */}
      <div className="flex items-center justify-between gap-2">
        {ex.family ? (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FAMILY_COLORS[ex.family]}`}>
            {FAMILY_LABELS[ex.family]}
          </span>
        ) : (
          <span className="text-xs text-muted/50">—</span>
        )}
        <span className={`text-xs font-medium ${isPersonal ? 'text-accent' : 'text-muted/50'}`}>
          {isPersonal ? 'Perso' : 'Générique'}
        </span>
      </div>

      {/* Name */}
      <p className="text-ink text-sm font-semibold leading-snug">{ex.name}</p>

      {/* Sub-badge row */}
      <div className="flex items-center gap-1.5 flex-wrap mt-auto pt-1">
        {ex.discipline_group && (
          <span className="text-xs text-brand/80 bg-brand/8 px-2 py-0.5 rounded-full">
            {GROUP_LABELS[ex.discipline_group]}
          </span>
        )}
        {ex.musculation_cycle && (
          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
            {CYCLE_LABELS[ex.musculation_cycle]}
          </span>
        )}
        {ex.default_unit && (
          <span className="text-xs text-muted bg-gray-50 px-2 py-0.5 rounded-full ml-auto">
            {UNIT_LABELS[ex.default_unit]}
          </span>
        )}
      </div>
    </div>
  )
}
