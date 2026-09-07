import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  FAMILY_LABELS,
  FILTER_TAB_LABELS, ALL_FILTER_TABS,
  matchesFilterTab, exerciseTabLabel, exerciseTabColor,
  type FilterTab,
} from '../../lib/exerciseLabels'
import type {
  Exercise, ExerciseFamily, ExerciseDisciplineGroup, MuscuCycle, ExerciseUnit,
  ExerciseNoteWithMeta,
} from '../../types/database'

// ─── Labels ───────────────────────────────────────────────────────────────────

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

// ─── Athlete row (for note attribution in ExercisesPage) ─────────────────────
type AthleteRow = { id: string; name: string }

export default function ExercisesPage() {
  const { user } = useAuth()

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab | 'all'>('all')
  const [activeGroup, setActiveGroup] = useState<ExerciseDisciplineGroup | null>(null)
  const [activeCycle, setActiveCycle] = useState<MuscuCycle | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateForm>(DEFAULT_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Note counts per exercise (badge)
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({})

  // Selected exercise panel
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [panelNotes,       setPanelNotes]       = useState<ExerciseNoteWithMeta[]>([])
  const [panelLoading,     setPanelLoading]     = useState(false)

  // Add note form (in panel)
  const [showNoteForm,  setShowNoteForm]  = useState(false)
  const [noteWorked,    setNoteWorked]    = useState(true)
  const [noteComment,   setNoteComment]   = useState('')
  const [noteAthleteId, setNoteAthleteId] = useState<string | null>(null)
  const [noteSaving,    setNoteSaving]    = useState(false)
  const [noteError,     setNoteError]     = useState<string | null>(null)

  // Athletes list for note attribution
  const [athletes, setAthletes] = useState<AthleteRow[]>([])

  useEffect(() => { fetchExercises() }, [])

  // Load athletes once for note form
  useEffect(() => {
    if (!user) return
    supabase
      .from('coach_athlete_relationships')
      .select('athlete_id, athlete:profiles!coach_athlete_relationships_athlete_id_fkey(first_name, last_name)')
      .eq('status', 'active')
      .then(({ data }) => {
        if (!data) return
        const seen = new Set<string>()
        const rows: AthleteRow[] = []
        for (const r of data as { athlete_id: string; athlete: { first_name: string | null; last_name: string | null } | null }[]) {
          if (seen.has(r.athlete_id)) continue
          seen.add(r.athlete_id)
          rows.push({
            id:   r.athlete_id,
            name: [r.athlete?.first_name, r.athlete?.last_name].filter(Boolean).join(' ') || 'Athlète',
          })
        }
        setAthletes(rows.sort((a, b) => a.name.localeCompare(b.name)))
      })
  }, [user])

  async function fetchExercises() {
    setLoading(true)
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .order('name', { ascending: true })
    const exs = (data ?? []) as Exercise[]
    setExercises(exs)
    setLoading(false)

    // Load note counts
    if (exs.length > 0 && user) {
      const { data: notesData } = await supabase
        .from('exercise_notes')
        .select('exercise_id')
        .in('exercise_id', exs.map(e => e.id))
      if (notesData) {
        const counts: Record<string, number> = {}
        for (const row of notesData as { exercise_id: string }[]) {
          counts[row.exercise_id] = (counts[row.exercise_id] ?? 0) + 1
        }
        setNoteCounts(counts)
      }
    }
  }

  // ── Filters ──────────────────────────────────────────────────────────────────

  function handleTabChange(f: FilterTab | 'all') {
    setActiveTab(f)
    setActiveGroup(null)
    setActiveCycle(null)
  }

  const filtered = exercises.filter(ex => {
    if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false
    if (activeTab !== 'all' && !matchesFilterTab(ex, activeTab)) return false
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

  // ── Panel: load notes for a selected exercise ─────────────────────────────
  async function openPanel(ex: Exercise) {
    setSelectedExercise(ex)
    setShowNoteForm(false)
    setNoteComment('')
    setNoteWorked(true)
    setNoteAthleteId(null)
    setPanelLoading(true)
    const { data } = await supabase
      .from('exercise_notes')
      .select(`
        id, coach_id, exercise_id, athlete_id, worked, comment, created_at,
        coach:profiles!exercise_notes_coach_id_fkey(first_name, last_name),
        athlete:profiles!exercise_notes_athlete_id_fkey(first_name, last_name)
      `)
      .eq('exercise_id', ex.id)
      .order('created_at', { ascending: false })
    const rows = (data ?? []) as (ExerciseNoteWithMeta & {
      coach:   { first_name: string | null; last_name: string | null } | null
      athlete: { first_name: string | null; last_name: string | null } | null
    })[]
    setPanelNotes(rows.map(r => ({
      ...r,
      coach_name:   r.coach   ? [r.coach.first_name,   r.coach.last_name  ].filter(Boolean).join(' ') || null : null,
      athlete_name: r.athlete ? [r.athlete.first_name, r.athlete.last_name].filter(Boolean).join(' ') || null : null,
    })))
    setPanelLoading(false)
  }

  async function submitPanelNote(e: FormEvent) {
    e.preventDefault()
    if (!user || !selectedExercise || noteSaving) return
    setNoteSaving(true)
    setNoteError(null)
    const { error } = await supabase.from('exercise_notes').insert({
      coach_id:    user.id,
      exercise_id: selectedExercise.id,
      athlete_id:  noteAthleteId,
      worked:      noteWorked,
      comment:     noteComment.trim(),
    })
    if (error) { setNoteError(error.message); setNoteSaving(false); return }
    // Update count badge
    setNoteCounts(prev => ({ ...prev, [selectedExercise.id]: (prev[selectedExercise.id] ?? 0) + 1 }))
    // Reload panel notes
    await openPanel(selectedExercise)
    setNoteSaving(false)
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
            {/* Family — only SaaS enum values (written to exercises.family) */}
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

      {/* Filter tabs — SaaS families + mobile category values */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {(['all', ...ALL_FILTER_TABS] as const).map(f => (
          <button
            key={f}
            onClick={() => handleTabChange(f)}
            className={`text-sm px-3.5 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === f
                ? 'bg-brand text-white'
                : 'text-muted hover:text-ink hover:bg-gray-100'
            }`}
          >
            {f === 'all' ? 'Tous' : FILTER_TAB_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Sub-filters */}
      {activeTab === 'discipline' && (
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
      {activeTab === 'musculation' && (
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

      {/* Exercise grid + optional notes panel */}
      <div className={selectedExercise ? 'flex gap-6 items-start' : ''}>

        {/* Grid */}
        <div className={selectedExercise ? 'flex-1 min-w-0' : ''}>
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
            <div className={`grid gap-3 ${selectedExercise ? 'grid-cols-2' : 'grid-cols-3 xl:grid-cols-4'}`}>
              {filtered.map(ex => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  noteCount={noteCounts[ex.id] ?? 0}
                  isSelected={selectedExercise?.id === ex.id}
                  onClick={() => selectedExercise?.id === ex.id ? setSelectedExercise(null) : openPanel(ex)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Notes panel */}
        {selectedExercise && (
          <div className="w-80 shrink-0 bg-white rounded-xl border border-gray-100 overflow-hidden sticky top-4">
            {/* Panel header */}
            <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b border-gray-50">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">Notes coach</p>
                <p className="text-sm font-semibold text-ink leading-snug">{selectedExercise.name}</p>
              </div>
              <button
                onClick={() => setSelectedExercise(null)}
                className="text-muted hover:text-ink transition-colors shrink-0 mt-0.5"
                aria-label="Fermer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* Add note toggle */}
              {!showNoteForm && (
                <button
                  onClick={() => setShowNoteForm(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-gray-200 text-xs font-medium text-muted hover:border-brand/40 hover:text-brand transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Ajouter une note
                </button>
              )}

              {/* Note form */}
              {showNoteForm && (
                <form onSubmit={submitPanelNote} className="space-y-3 bg-gray-50 rounded-xl p-3">
                  {/* Worked toggle */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNoteWorked(true)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        noteWorked
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-white border-gray-200 text-muted hover:border-gray-300'
                      }`}
                    >
                      ✓ Fonctionné
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoteWorked(false)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        !noteWorked
                          ? 'bg-red-50 border-red-300 text-red-700'
                          : 'bg-white border-gray-200 text-muted hover:border-gray-300'
                      }`}
                    >
                      ✗ Pas fonctionné
                    </button>
                  </div>

                  {/* Athlete selector */}
                  {athletes.length > 0 && (
                    <div>
                      <label className="block text-xs text-muted mb-1">Pour</label>
                      <select
                        value={noteAthleteId ?? ''}
                        onChange={e => setNoteAthleteId(e.target.value || null)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors bg-white"
                      >
                        <option value="">Général (tous)</option>
                        {athletes.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Comment */}
                  <textarea
                    value={noteComment}
                    onChange={e => setNoteComment(e.target.value)}
                    rows={2}
                    placeholder="Observation, ajustement…"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-ink placeholder-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors resize-none"
                    maxLength={500}
                  />

                  {noteError && (
                    <p className="text-xs text-red-600">{noteError}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={noteSaving}
                      className="bg-brand hover:bg-brand-hover text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {noteSaving ? '…' : 'Enregistrer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowNoteForm(false); setNoteError(null) }}
                      className="text-xs text-muted hover:text-ink transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}

              {/* Notes history */}
              {panelLoading ? (
                <div className="flex items-center gap-2 text-muted text-xs py-2">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Chargement…
                </div>
              ) : panelNotes.length === 0 ? (
                <p className="text-xs text-muted text-center py-4">Aucune note pour cet exercice.</p>
              ) : (
                <div className="space-y-2">
                  {panelNotes.map(note => (
                    <PanelNoteCard key={note.id} note={note} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Exercise card ─────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise: ex,
  noteCount,
  isSelected,
  onClick,
}: {
  exercise: Exercise
  noteCount: number
  isSelected: boolean
  onClick: () => void
}) {
  const isPersonal = ex.coach_id !== null
  const label = exerciseTabLabel(ex)
  const colorClass = label ? exerciseTabColor(ex) : null

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-xl p-4 flex flex-col gap-2 cursor-pointer transition-colors ${
        isSelected
          ? 'border-brand ring-1 ring-brand/20'
          : 'border-gray-100 hover:border-gray-200'
      }`}
    >
      {/* Top row: family badge + notes badge + personal tag */}
      <div className="flex items-center justify-between gap-2">
        {label && colorClass ? (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
            {label}
          </span>
        ) : (
          <span className="text-xs text-muted/50">—</span>
        )}
        <div className="flex items-center gap-1.5">
          {noteCount > 0 && (
            <span className="text-xs font-medium bg-brand/10 text-brand px-2 py-0.5 rounded-full">
              {noteCount} note{noteCount > 1 ? 's' : ''}
            </span>
          )}
          <span className={`text-xs font-medium ${isPersonal ? 'text-accent' : 'text-muted/50'}`}>
            {isPersonal ? 'Perso' : 'Générique'}
          </span>
        </div>
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

// ─── Panel note card ───────────────────────────────────────────────────────────

function PanelNoteCard({ note }: { note: ExerciseNoteWithMeta }) {
  const date = new Date(note.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  return (
    <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          note.worked
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-red-50 text-red-700'
        }`}>
          {note.worked ? '✓ Fonctionné' : '✗ Pas fonctionné'}
        </span>
        <span className="text-xs text-muted shrink-0">{date}</span>
      </div>

      {note.athlete_name && (
        <p className="text-xs text-brand font-medium">Athlète : {note.athlete_name}</p>
      )}

      {note.comment && (
        <p className="text-xs text-ink leading-relaxed">{note.comment}</p>
      )}

      <p className="text-xs text-muted">Par {note.coach_name ?? 'coach'}</p>
    </div>
  )
}
