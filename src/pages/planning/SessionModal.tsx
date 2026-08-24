import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile, Exercise, ExerciseFamily, ExerciseUnit, SessionWithExercises } from '../../types/database'
import { FAMILY_LABELS } from '../../lib/exerciseLabels'

// ─── Exercise entry (draft) ────────────────────────────────────────────────────
interface ExEntry {
  exercise: Exercise
  sets: string
  reps: string
  value: string       // kg / m / s depending on unit
  rest_seconds: string
  intensity: string
  notes: string
}

function emptyEntry(ex: Exercise): ExEntry {
  return { exercise: ex, sets: '', reps: '', value: '', rest_seconds: '', intensity: '', notes: '' }
}

function valueLabel(unit: ExerciseUnit | null): string | null {
  if (unit === 'kg') return 'Charge (kg)'
  if (unit === 'm')  return 'Distance (m)'
  if (unit === 's')  return 'Durée (s)'
  return null
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  coachId: string
  athletes: Profile[]
  defaultDate?: string   // YYYY-MM-DD
  session?: SessionWithExercises | null  // if set → edit mode
  onClose: () => void
  onSaved: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SessionModal({ coachId, athletes, defaultDate, session, onClose, onSaved }: Props) {
  const isEdit = Boolean(session)

  // Session fields
  const [title, setTitle]       = useState(session?.title ?? '')
  const [date, setDate]         = useState(session?.scheduled_date ?? defaultDate ?? '')
  const [duration, setDuration] = useState(session?.estimated_duration_minutes?.toString() ?? '')
  const [location, setLocation] = useState(session?.location ?? '')
  const [description, setDescription] = useState(session?.description ?? '')
  const [coachNotes, setCoachNotes]   = useState(session?.coach_notes ?? '')
  const [isRevealed, setIsRevealed]   = useState(session?.is_revealed ?? true)

  // Athlete selection (multi for create, locked for edit)
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>(
    session ? [session.athlete_id] : athletes.length === 1 ? [athletes[0].id] : []
  )
  const [allSelected, setAllSelected] = useState(false)

  // Exercises
  const [entries, setEntries] = useState<ExEntry[]>(
    session?.session_exercises.map(se => {
      const ex: Exercise = {
        id: se.exercise_id ?? '',
        coach_id: null,
        name: se.name,
        category: null,
        default_unit: null,
        family: null,
        discipline_group: null,
        musculation_cycle: null,
        created_at: '',
      }
      return {
        exercise: ex,
        sets: se.sets?.toString() ?? '',
        reps: se.reps?.toString() ?? '',
        value: se.distance_meters?.toString() ?? se.duration_seconds?.toString() ?? se.intensity ?? '',
        rest_seconds: se.rest_seconds?.toString() ?? '',
        intensity: se.intensity ?? '',
        notes: se.notes ?? '',
      }
    }) ?? []
  )

  // Exercise picker
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerFamily, setPickerFamily] = useState<ExerciseFamily | 'all'>('all')
  const [allExercises, setAllExercises] = useState<Exercise[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    supabase.from('exercises').select('*').order('family').order('name').then(({ data }) => {
      setAllExercises(data ?? [])
    })
  }, [])

  // ── Athlete helpers ─────────────────────────────────────────────────────────
  function toggleAthlete(id: string) {
    setAllSelected(false)
    setSelectedAthleteIds(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }

  function toggleAll() {
    if (allSelected) {
      setAllSelected(false)
      setSelectedAthleteIds([])
    } else {
      setAllSelected(true)
      setSelectedAthleteIds(athletes.map(a => a.id))
    }
  }

  // ── Exercise picker ─────────────────────────────────────────────────────────
  const filteredExercises = allExercises.filter(ex => {
    if (pickerFamily !== 'all' && ex.family !== pickerFamily) return false
    if (pickerSearch && !ex.name.toLowerCase().includes(pickerSearch.toLowerCase())) return false
    return true
  })

  function addExercise(ex: Exercise) {
    setEntries(prev => [...prev, emptyEntry(ex)])
    setShowPicker(false)
    setPickerSearch('')
  }

  function removeEntry(i: number) {
    setEntries(prev => prev.filter((_, j) => j !== i))
  }

  function updateEntry<K extends keyof ExEntry>(i: number, k: K, v: ExEntry[K]) {
    setEntries(prev => prev.map((e, j) => j === i ? { ...e, [k]: v } : e))
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) { setError('Le titre et la date sont obligatoires.'); return }
    const targets = isEdit ? [session!.athlete_id] : selectedAthleteIds
    if (targets.length === 0) { setError('Sélectionnez au moins un athlète.'); return }

    setSaving(true)
    setError(null)

    try {
      if (isEdit) {
        // Update existing session
        const { error: ue } = await supabase.from('sessions').update({
          title: title.trim(),
          scheduled_date: date,
          estimated_duration_minutes: duration ? parseInt(duration) : null,
          location: location.trim() || null,
          description: description.trim() || null,
          coach_notes: coachNotes.trim() || null,
          is_revealed: isRevealed,
        }).eq('id', session!.id)
        if (ue) throw ue

        // Replace exercises
        await supabase.from('session_exercises').delete().eq('session_id', session!.id)
        if (entries.length > 0) {
          await insertExercises(session!.id)
        }
      } else {
        // Create one session per athlete
        for (const athleteId of targets) {
          const { data: newSession, error: ie } = await supabase.from('sessions').insert({
            coach_id: coachId,
            athlete_id: athleteId,
            title: title.trim(),
            scheduled_date: date,
            estimated_duration_minutes: duration ? parseInt(duration) : null,
            location: location.trim() || null,
            description: description.trim() || null,
            coach_notes: coachNotes.trim() || null,
            is_revealed: isRevealed,
          }).select().single()
          if (ie) throw ie
          if (newSession && entries.length > 0) {
            await insertExercises(newSession.id)
          }
        }
      }
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  async function insertExercises(sessionId: string) {
    const rows = entries.map((e, i) => {
      const u = e.exercise.default_unit
      return {
        session_id: sessionId,
        exercise_id: e.exercise.id || null,
        name: e.exercise.name,
        order_index: i,
        sets: e.sets ? parseInt(e.sets) : null,
        reps: e.reps ? parseInt(e.reps) : null,
        distance_meters: u === 'm' && e.value ? parseInt(e.value) : null,
        duration_seconds: u === 's' && e.value ? parseInt(e.value) : null,
        rest_seconds: e.rest_seconds ? parseInt(e.rest_seconds) : null,
        intensity: u === 'kg' && e.value ? `${e.value} kg` : (e.intensity || null),
        notes: e.notes || null,
      }
    })
    const { error } = await supabase.from('session_exercises').insert(rows)
    if (error) throw error
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-ink font-semibold">{isEdit ? 'Modifier la séance' : 'Nouvelle séance'}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-0 divide-x divide-gray-100">

            {/* ── Left column : metadata ─────────────────────────────────── */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-muted mb-1.5">Titre *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} required
                  placeholder="Ex : Séance technique sprint"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1.5">Date *</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1.5">Durée (min)</label>
                  <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                    placeholder="60" min={1}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Lieu</label>
                <input value={location} onChange={e => setLocation(e.target.value)}
                  placeholder="Stade, salle de musculation…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  rows={2} placeholder="Objectifs, contexte…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink resize-none focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Notes privées (coach uniquement)</label>
                <textarea value={coachNotes} onChange={e => setCoachNotes(e.target.value)}
                  rows={2} placeholder="Observations internes…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink resize-none focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" />
              </div>

              {/* Athlete selector */}
              {!isEdit && (
                <div>
                  <label className="block text-xs text-muted mb-2">Athlètes *</label>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-36 overflow-y-auto">
                    <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        className="accent-brand" />
                      <span className="text-sm font-medium text-ink">Tout le groupe ({athletes.length})</span>
                    </label>
                    {athletes.map(a => (
                      <label key={a.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
                        <input type="checkbox"
                          checked={selectedAthleteIds.includes(a.id)}
                          onChange={() => toggleAthlete(a.id)}
                          className="accent-brand" />
                        <span className="text-sm text-ink">{a.first_name} {a.last_name}</span>
                      </label>
                    ))}
                  </div>
                  {selectedAthleteIds.length > 1 && (
                    <p className="text-xs text-muted mt-1.5">
                      {selectedAthleteIds.length} séances seront créées
                    </p>
                  )}
                </div>
              )}

              {/* is_revealed toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setIsRevealed(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${isRevealed ? 'bg-brand' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isRevealed ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-sm text-ink">Visible par l&apos;athlète immédiatement</span>
              </label>
            </div>

            {/* ── Right column : exercises ───────────────────────────────── */}
            <div className="p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted uppercase tracking-wide">Exercices</p>
                <button type="button" onClick={() => setShowPicker(v => !v)}
                  className="flex items-center gap-1 text-sm text-brand hover:text-brand-hover font-medium transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Ajouter
                </button>
              </div>

              {/* Picker */}
              {showPicker && (
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                  <div className="p-2 border-b border-gray-100 bg-white">
                    <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                      placeholder="Rechercher…" autoFocus
                      className="w-full text-sm px-2 py-1.5 rounded focus:outline-none text-ink" />
                  </div>
                  <div className="flex gap-1 px-2 py-1.5 bg-white border-b border-gray-100 overflow-x-auto">
                    {(['all', 'discipline', 'musculation', 'plyometrie', 'gainage_prehab', 'cardio_aerobie'] as const).map(f => (
                      <button key={f} type="button" onClick={() => setPickerFamily(f)}
                        className={`shrink-0 text-xs px-2 py-1 rounded-md font-medium transition-colors ${pickerFamily === f ? 'bg-brand text-white' : 'text-muted hover:text-ink hover:bg-gray-100'}`}>
                        {f === 'all' ? 'Tous' : FAMILY_LABELS[f]}
                      </button>
                    ))}
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {filteredExercises.length === 0 && (
                      <p className="text-center text-muted text-xs py-4">Aucun résultat</p>
                    )}
                    {filteredExercises.map(ex => (
                      <button key={ex.id} type="button" onClick={() => addExercise(ex)}
                        className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-brand/10 transition-colors flex items-center gap-2">
                        <span className="flex-1">{ex.name}</span>
                        {ex.default_unit && <span className="text-xs text-muted shrink-0">{ex.default_unit}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Exercise entries */}
              {entries.length === 0 && !showPicker && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-muted text-sm">Aucun exercice ajouté</p>
                </div>
              )}
              <div className="space-y-2 overflow-y-auto flex-1">
                {entries.map((entry, i) => {
                  const vLabel = valueLabel(entry.exercise.default_unit)
                  return (
                    <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-ink">{i + 1}. {entry.exercise.name}</span>
                        <button type="button" onClick={() => removeEntry(i)} className="text-muted hover:text-accent transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <ExField label="Séries" value={entry.sets} onChange={v => updateEntry(i, 'sets', v)} />
                        <ExField label="Répétitions" value={entry.reps} onChange={v => updateEntry(i, 'reps', v)} />
                        {vLabel
                          ? <ExField label={vLabel} value={entry.value} onChange={v => updateEntry(i, 'value', v)} />
                          : <ExField label="Intensité" value={entry.intensity} onChange={v => updateEntry(i, 'intensity', v)} />
                        }
                        <ExField label="Récup (s)" value={entry.rest_seconds} onChange={v => updateEntry(i, 'rest_seconds', v)} />
                        <div className="col-span-2">
                          <ExField label="Notes" value={entry.notes} onChange={v => updateEntry(i, 'notes', v)} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          {error && <p className="text-accent text-sm">{error}</p>}
          {!error && <span />}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink transition-colors px-4 py-2">
              Annuler
            </button>
            <button
              type="button"
              onClick={e => handleSave(e as unknown as FormEvent)}
              disabled={saving}
              className="bg-brand hover:bg-brand-hover text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ExField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-brand transition-colors bg-white" />
    </div>
  )
}
