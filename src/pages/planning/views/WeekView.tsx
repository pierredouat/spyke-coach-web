import { useState, type ReactNode } from 'react'
import {
  DndContext, DragOverlay, closestCenter,
  useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import type { SessionWithExercises, Profile } from '../../../types/database'
import { fmtDay, fmtMonthShort, isSameDay, formatYMD } from '../../../lib/dates'

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
  onSessionMove?: (sessionId: string, newDate: string) => void
  onSessionCopy?: (session: SessionWithExercises, newDate: string) => void
}

// ─── Grip handle ──────────────────────────────────────────────────────────────
function GripIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5.5" cy="4"  r="1.2"/>
      <circle cx="10.5" cy="4"  r="1.2"/>
      <circle cx="5.5" cy="8"  r="1.2"/>
      <circle cx="10.5" cy="8"  r="1.2"/>
      <circle cx="5.5" cy="12" r="1.2"/>
      <circle cx="10.5" cy="12" r="1.2"/>
    </svg>
  )
}

// ─── Draggable session card ───────────────────────────────────────────────────
function DraggableSessionCard({ session, athleteName, onSessionClick }: {
  session: SessionWithExercises
  athleteName: string
  onSessionClick: (s: SessionWithExercises) => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: session.id,
    data: { session },
  })

  return (
    <div
      ref={setNodeRef}
      className={`relative group/card w-full text-left bg-brand/8 border border-brand/20 rounded-lg transition-opacity ${isDragging ? 'opacity-20' : ''}`}
    >
      {/* Grip handle — drag activator only */}
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        onClick={e => e.stopPropagation()}
        title="Glisser pour déplacer"
        className="absolute top-1 right-1 p-0.5 cursor-grab active:cursor-grabbing text-brand/25 hover:text-brand/50 opacity-0 group-hover/card:opacity-100 transition-all touch-none z-10"
      >
        <GripIcon />
      </div>

      {/* Clickable card content */}
      <button
        type="button"
        onClick={() => onSessionClick(session)}
        className="w-full text-left px-2 py-1.5 hover:bg-brand/15 rounded-lg transition-colors"
      >
        <p className="text-ink text-xs font-semibold truncate leading-tight pr-4">{session.title}</p>
        <p className="text-muted text-xs truncate mt-0.5">{athleteName}</p>
        {session.session_exercises.length > 0 && (
          <p className="text-muted/60 text-xs mt-0.5">{session.session_exercises.length} ex.</p>
        )}
      </button>
    </div>
  )
}

// ─── Droppable day column ─────────────────────────────────────────────────────
function DroppableDayCol({ dateStr, isToday, children }: {
  dateStr: string
  isToday: boolean
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr })

  return (
    <div
      ref={setNodeRef}
      className={[
        'min-h-32 p-1.5 flex flex-col gap-1 transition-colors',
        isToday ? 'bg-brand/3' : 'bg-white',
        isOver ? 'bg-brand/10 ring-1 ring-inset ring-brand/25' : '',
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}

// ─── Drag overlay (mini preview) ──────────────────────────────────────────────
function SessionOverlay({ session, copyMode }: { session: SessionWithExercises; copyMode: boolean }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-brand/30 rounded-lg px-3 py-2 shadow-lg max-w-[160px]">
      {copyMode && (
        <span className="w-4 h-4 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">+</span>
      )}
      <p className="text-ink text-xs font-semibold truncate">{session.title}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function WeekView({
  days, sessions, athletes, today,
  onDayClick, onSessionClick, onCreateOnDay,
  onDuplicateDay, onDuplicateWeek,
  onSessionMove, onSessionCopy,
}: Props) {
  const [copyMode, setCopyMode]   = useState(false)
  const [activeDrag, setActiveDrag] = useState<SessionWithExercises | null>(null)

  function athleteName(id: string) {
    const a = athletes.find(a => a.id === id)
    return a ? `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() : '—'
  }

  function sessionsOnDay(d: Date) {
    return sessions.filter(s => isSameDay(new Date(s.scheduled_date + 'T00:00:00'), d))
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveDrag((active.data.current as { session: SessionWithExercises }).session)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDrag(null)
    if (!over) return
    const session = (active.data.current as { session: SessionWithExercises }).session
    const newDate = over.id as string
    if (newDate === session.scheduled_date) return
    if (copyMode) {
      onSessionCopy?.(session, newDate)
    } else {
      onSessionMove?.(session.id, newDate)
    }
  }

  const hasSessions = sessions.length > 0

  return (
    <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-2">
        {/* Controls bar */}
        {hasSessions && (
          <div className="flex items-center justify-between">
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
            {onDuplicateWeek && (
              <button
                onClick={onDuplicateWeek}
                className="text-xs text-muted hover:text-ink border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
              >
                Dupliquer cette semaine
              </button>
            )}
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
              <DroppableDayCol key={`col-${i}`} dateStr={formatYMD(d)} isToday={isToday}>
                {daySessions.map(s => (
                  <DraggableSessionCard
                    key={s.id}
                    session={s}
                    athleteName={athleteName(s.athlete_id)}
                    onSessionClick={onSessionClick}
                  />
                ))}
                <button
                  onClick={() => onCreateOnDay(d)}
                  className="w-full flex items-center justify-center py-1 mt-auto text-muted/40 hover:text-brand hover:bg-brand/5 rounded-lg transition-colors opacity-0 hover:opacity-100"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </DroppableDayCol>
            )
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {activeDrag && <SessionOverlay session={activeDrag} copyMode={copyMode} />}
      </DragOverlay>
    </DndContext>
  )
}
