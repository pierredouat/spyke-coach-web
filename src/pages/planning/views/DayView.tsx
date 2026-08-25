import { useState, type ReactNode } from 'react'
import {
  DndContext, DragOverlay, closestCenter,
  useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import type { SessionWithExercises, SessionExercise, Profile } from '../../../types/database'
import { fmtDayLong, fmtDay, fmtMonth } from '../../../lib/dates'

interface Props {
  day: Date
  sessions: SessionWithExercises[]
  athletes: Profile[]
  onSessionClick: (s: SessionWithExercises) => void
  onCreateOnDay: (d: Date) => void
  onDuplicateDay?: (day: Date) => void
  onExerciseMove?: (ex: SessionExercise, fromSessionId: string, toSessionId: string) => void
  onExerciseCopy?: (ex: SessionExercise, fromSessionId: string, toSessionId: string) => void
}

const STATUS_LABELS = { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminée', modifie: 'Modifiée' }
const STATUS_COLORS = {
  a_faire:  'bg-gray-100 text-gray-600',
  en_cours: 'bg-sky-50 text-sky-700',
  termine:  'bg-emerald-50 text-emerald-700',
  modifie:  'bg-amber-50 text-amber-700',
}

// ─── Drag handle icon ─────────────────────────────────────────────────────────
function GripIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5.5" cy="4"  r="1.25"/>
      <circle cx="10.5" cy="4"  r="1.25"/>
      <circle cx="5.5" cy="8"  r="1.25"/>
      <circle cx="10.5" cy="8"  r="1.25"/>
      <circle cx="5.5" cy="12" r="1.25"/>
      <circle cx="10.5" cy="12" r="1.25"/>
    </svg>
  )
}

// ─── Draggable exercise row ───────────────────────────────────────────────────
function DraggableExercise({ ex, index, sessionId }: {
  ex: SessionExercise
  index: number
  sessionId: string
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ex.id,
    data: { ex, sourceSessionId: sessionId },
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-1 text-sm transition-opacity ${isDragging ? 'opacity-20' : ''}`}
    >
      <div
        {...listeners}
        {...attributes}
        onClick={e => e.stopPropagation()}
        className="cursor-grab active:cursor-grabbing p-0.5 text-gray-300 hover:text-gray-400 transition-colors touch-none shrink-0"
        title="Glisser pour déplacer"
      >
        <GripIcon />
      </div>
      <span className="text-muted text-xs w-5 text-right shrink-0">{index + 1}.</span>
      <span className="text-ink font-medium truncate flex-1">{ex.name}</span>
      <span className="text-muted text-xs shrink-0">
        {[
          ex.sets ? `${ex.sets}×` : null,
          ex.reps ? `${ex.reps} rép.` : null,
          ex.distance_meters ? `${ex.distance_meters} m` : null,
          ex.duration_seconds ? `${ex.duration_seconds} s` : null,
          ex.intensity || null,
        ].filter(Boolean).join(' ')}
      </span>
    </div>
  )
}

// ─── Droppable exercise list within a session ─────────────────────────────────
function DroppableExerciseList({ sessionId, isActiveDrag, hasExercises, children }: {
  sessionId: string
  isActiveDrag: boolean  // an exercise from ANOTHER session is being dragged
  hasExercises: boolean
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: sessionId })

  return (
    <div
      ref={setNodeRef}
      className={[
        'transition-all rounded-lg',
        hasExercises ? 'border-t border-gray-50 pt-3 mt-3 space-y-1' : (isActiveDrag ? 'mt-3 min-h-8' : ''),
        isOver ? 'bg-brand/5 ring-1 ring-inset ring-brand/20 px-1.5 pb-1.5' : '',
      ].filter(Boolean).join(' ')}
    >
      {children}
      {isOver && (
        <p className="text-xs text-brand/60 text-center pt-1 pb-0.5">Déposer ici</p>
      )}
      {!isOver && isActiveDrag && !hasExercises && (
        <p className="text-xs text-gray-200 text-center border border-dashed border-gray-200 rounded-lg py-2">
          Déposer ici
        </p>
      )}
    </div>
  )
}

// ─── Mini card shown while dragging ──────────────────────────────────────────
function ExerciseOverlay({ ex, copyMode }: { ex: SessionExercise; copyMode: boolean }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-brand/30 rounded-lg px-3 py-2 shadow-lg max-w-xs">
      {copyMode && (
        <span className="w-4 h-4 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">+</span>
      )}
      <span className="text-ink text-sm font-medium truncate">{ex.name}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DayView({
  day, sessions, athletes,
  onSessionClick, onCreateOnDay,
  onDuplicateDay, onExerciseMove, onExerciseCopy,
}: Props) {
  const [copyMode, setCopyMode] = useState(false)
  const [activeDrag, setActiveDrag] = useState<{ ex: SessionExercise; sourceSessionId: string } | null>(null)

  const hasAnyExercises = sessions.some(s => s.session_exercises.length > 0)
  const multiSession    = sessions.length > 1

  function athleteName(id: string) {
    const a = athletes.find(a => a.id === id)
    return a ? `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() : '—'
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveDrag(active.data.current as { ex: SessionExercise; sourceSessionId: string })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDrag(null)
    if (!over) return
    const { ex, sourceSessionId } = active.data.current as { ex: SessionExercise; sourceSessionId: string }
    const targetSessionId = over.id as string
    if (sourceSessionId === targetSessionId) return
    if (copyMode) {
      onExerciseCopy?.(ex, sourceSessionId, targetSessionId)
    } else {
      onExerciseMove?.(ex, sourceSessionId, targetSessionId)
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div>
        {/* ── Header ── */}
        <div className="flex items-center flex-wrap gap-2 mb-4 justify-between">
          <h2 className="text-ink font-semibold">
            {fmtDayLong(day)} {fmtDay(day)} {fmtMonth(day)}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Copy/move toggle — only useful when exercises can be dragged between sessions */}
            {hasAnyExercises && multiSession && (
              <button
                onClick={() => setCopyMode(v => !v)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                  copyMode
                    ? 'border-brand bg-brand/8 text-brand'
                    : 'border-gray-200 text-muted hover:text-ink hover:bg-gray-50'
                }`}
              >
                {copyMode ? '⊕ Mode copie' : '↕ Mode déplacement'}
              </button>
            )}
            {sessions.length > 0 && onDuplicateDay && (
              <button
                onClick={() => onDuplicateDay(day)}
                className="text-xs text-muted hover:text-ink border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
              >
                Dupliquer ce jour
              </button>
            )}
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
        </div>

        {/* ── Sessions ── */}
        {sessions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
            <p className="text-muted text-sm">Aucune séance ce jour</p>
            <button onClick={() => onCreateOnDay(day)}
              className="mt-3 text-sm text-brand hover:text-brand-hover font-medium transition-colors">
              Créer une séance
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => {
              const isDragSource = activeDrag?.sourceSessionId === s.id
              const isOtherDrag  = activeDrag !== null && !isDragSource
              return (
                <div
                  key={s.id}
                  className={`bg-white rounded-xl border border-gray-100 p-5 transition-colors ${isDragSource ? '' : 'hover:border-gray-200'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <button
                          onClick={() => onSessionClick(s)}
                          className="text-ink font-semibold hover:text-brand transition-colors text-left"
                        >
                          {s.title}
                        </button>
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

                  <DroppableExerciseList
                    sessionId={s.id}
                    isActiveDrag={isOtherDrag}
                    hasExercises={s.session_exercises.length > 0}
                  >
                    {s.session_exercises.map((ex, i) => (
                      <DraggableExercise key={ex.id} ex={ex} index={i} sessionId={s.id} />
                    ))}
                  </DroppableExerciseList>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {activeDrag && <ExerciseOverlay ex={activeDrag.ex} copyMode={copyMode} />}
      </DragOverlay>
    </DndContext>
  )
}
