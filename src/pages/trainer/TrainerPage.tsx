import { useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import frLocale from '@fullcalendar/core/locales/fr'
import type { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core'
import type { EventDropArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { BodyZone, AppointmentStatus } from '../../types/database'
import { BODY_ZONE_LABELS } from '../../types/database'

// ─── Types ────────────────────────────────────────────────────────────────────
type SlotRow = {
  id: string
  start_time: string
  end_time: string
  is_booked: boolean
}

type ApptRow = {
  id: string
  status: AppointmentStatus
  trainer_availability_id: string
  athlete_id: string
  injury_id: string | null
  created_at: string
  trainer_availability: { start_time: string; end_time: string } | null
  profiles: { first_name: string | null; last_name: string | null } | null
  injuries: { body_zone: BodyZone; side: string | null; severity: number } | null
}

// Pending drag/resize confirmation (optimistic UI: event already moved visually)
type PendingAction = {
  eventId: string
  type: 'move' | 'resize'
  message: string
  originalStart: string
  originalEnd: string
  newStart: string
  newEnd: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function severityClass(s: number) {
  if (s <= 3) return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (s <= 6) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-red-700 bg-red-50 border-red-200'
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  requested: 'Demande',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
}

const STATUS_CLASSES: Record<AppointmentStatus, string> = {
  requested: 'text-amber-700 bg-amber-50 border-amber-200',
  confirmed: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  cancelled: 'text-muted bg-gray-100 border-gray-200',
}

function slotToEvent(slot: SlotRow): EventInput {
  return {
    id: slot.id,
    start: slot.start_time,
    end: slot.end_time,
    title: slot.is_booked ? 'Réservé' : 'Disponible',
    backgroundColor: slot.is_booked ? '#D97706' : '#3743BA',
    borderColor: slot.is_booked ? '#B45309' : '#2d389e',
    textColor: '#ffffff',
    editable: !slot.is_booked,
    classNames: slot.is_booked ? ['fc-event-booked'] : [],
    extendedProps: { isBooked: slot.is_booked },
  }
}

// ─── Delete confirmation modal ────────────────────────────────────────────────
function DeleteModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-ink text-base font-semibold mb-2">Supprimer ce créneau ?</h2>
        <p className="text-muted text-sm mb-5">
          Ce créneau sera supprimé définitivement. Cette action est irréversible.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-200 text-ink text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-accent hover:bg-accent/90 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Booked slot info modal ───────────────────────────────────────────────────
function BookedModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-ink text-base font-semibold">Créneau réservé</h2>
        </div>
        <p className="text-muted text-sm mb-5">
          Ce créneau est déjà réservé par un athlète. Pour le modifier, annulez d&apos;abord le rendez-vous associé depuis la section ci-dessous.
        </p>
        <button
          onClick={onClose}
          className="w-full bg-ink text-white text-sm font-medium py-2.5 rounded-lg hover:bg-ink/90 transition-colors"
        >
          Compris
        </button>
      </div>
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center gap-2 text-muted text-sm py-6">
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Chargement…
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TrainerPage() {
  const { user } = useAuth()
  const calendarRef = useRef<FullCalendar>(null)

  const [events, setEvents] = useState<EventInput[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [showBookedModal, setShowBookedModal] = useState(false)
  const [appointments, setAppointments] = useState<ApptRow[]>([])
  const [apptLoading, setApptLoading] = useState(true)

  // ── Load initial data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    loadCalendarData()
    loadAppointments()
  }, [user])

  async function loadCalendarData() {
    if (!user) return
    setLoading(true)

    // Load slots from start of current week onwards (no upper bound)
    const startOfWeek = new Date()
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7))
    startOfWeek.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('trainer_availability')
      .select('id, start_time, end_time, is_booked')
      .eq('trainer_id', user.id)
      .gte('start_time', startOfWeek.toISOString())
      .order('start_time')

    setEvents((data ?? []).map(slotToEvent))
    setLoading(false)
  }

  async function loadAppointments() {
    if (!user) return
    setApptLoading(true)

    const { data: slotsData } = await supabase
      .from('trainer_availability')
      .select('id')
      .eq('trainer_id', user.id)

    const slotIds = (slotsData ?? []).map(s => s.id)
    if (slotIds.length === 0) { setApptLoading(false); return }

    const { data } = await supabase
      .from('appointments')
      .select(`
        id, status, trainer_availability_id, athlete_id, injury_id, created_at,
        trainer_availability!appointments_trainer_availability_id_fkey(start_time, end_time),
        profiles!appointments_athlete_id_fkey(first_name, last_name),
        injuries!appointments_injury_id_fkey(body_zone, side, severity)
      `)
      .in('trainer_availability_id', slotIds)
      .in('status', ['requested', 'confirmed'])
      .order('created_at')

    setAppointments((data ?? []) as unknown as ApptRow[])
    setApptLoading(false)
  }

  // ── Calendar event handlers ─────────────────────────────────────────────────

  // Click-drag on empty cell → create new slot
  async function handleSelect(info: DateSelectArg) {
    if (!user) return
    const { start, end } = info

    const { data, error } = await supabase
      .from('trainer_availability')
      .insert({
        trainer_id: user.id,
        team_id: user.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      })
      .select('id, start_time, end_time, is_booked')
      .single()

    if (!error && data) {
      setEvents(prev => [...prev, slotToEvent(data as SlotRow)])
    }

    calendarRef.current?.getApi().unselect()
  }

  // Click on existing event → delete (if free) or info (if booked)
  function handleEventClick(info: EventClickArg) {
    if (info.event.extendedProps.isBooked) {
      setShowBookedModal(true)
      return
    }
    setDeleteTargetId(info.event.id)
  }

  // Drag to move → show confirmation bar (optimistic UI: state updated immediately)
  function handleEventDrop(info: EventDropArg) {
    if (info.event.extendedProps.isBooked) {
      info.revert()
      return
    }

    const originalStart = info.oldEvent.start!.toISOString()
    const originalEnd = info.oldEvent.end!.toISOString()
    const newStart = info.event.start!.toISOString()
    const newEnd = info.event.end!.toISOString()

    // Update state to match what FullCalendar already shows (optimistic)
    setEvents(prev => prev.map(e =>
      e.id === info.event.id ? { ...e, start: newStart, end: newEnd } : e
    ))

    setPendingAction({
      eventId: info.event.id,
      type: 'move',
      message: `Déplacer ce créneau vers ${fmtDateTime(newStart)} ?`,
      originalStart, originalEnd, newStart, newEnd,
    })
  }

  // Resize → show confirmation bar (optimistic UI)
  function handleEventResize(info: EventResizeDoneArg) {
    if (info.event.extendedProps.isBooked) {
      info.revert()
      return
    }

    const originalStart = info.oldEvent.start!.toISOString()
    const originalEnd = info.oldEvent.end!.toISOString()
    const newStart = info.event.start!.toISOString()
    const newEnd = info.event.end!.toISOString()

    setEvents(prev => prev.map(e =>
      e.id === info.event.id ? { ...e, start: newStart, end: newEnd } : e
    ))

    setPendingAction({
      eventId: info.event.id,
      type: 'resize',
      message: `Modifier la durée du créneau (fin : ${fmtTime(newEnd)}) ?`,
      originalStart, originalEnd, newStart, newEnd,
    })
  }

  // Confirm pending drag/resize → save to DB
  async function confirmPending() {
    if (!pendingAction) return
    const { eventId, type, newStart, newEnd } = pendingAction

    const patch: { end_time: string; start_time?: string } = { end_time: newEnd }
    if (type === 'move') patch.start_time = newStart

    const { error } = await supabase
      .from('trainer_availability')
      .update(patch)
      .eq('id', eventId)

    if (error) {
      // Revert state to original positions
      setEvents(prev => prev.map(e =>
        e.id === eventId
          ? { ...e, start: pendingAction.originalStart, end: pendingAction.originalEnd }
          : e
      ))
    }
    setPendingAction(null)
  }

  // Cancel pending → revert state to original positions
  function cancelPending() {
    if (!pendingAction) return
    setEvents(prev => prev.map(e =>
      e.id === pendingAction.eventId
        ? { ...e, start: pendingAction.originalStart, end: pendingAction.originalEnd }
        : e
    ))
    setPendingAction(null)
  }

  // Confirm delete
  async function confirmDelete() {
    if (!deleteTargetId) return

    const { error } = await supabase
      .from('trainer_availability')
      .delete()
      .eq('id', deleteTargetId)

    if (!error) {
      setEvents(prev => prev.filter(e => e.id !== deleteTargetId))
      setAppointments(prev => prev.filter(a => a.trainer_availability_id !== deleteTargetId))
    }
    setDeleteTargetId(null)
  }

  // Confirm/cancel appointment
  async function updateAppointment(apptId: string, status: 'confirmed' | 'cancelled') {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', apptId)

    if (!error) {
      if (status === 'cancelled') {
        const appt = appointments.find(a => a.id === apptId)
        if (appt) {
          await supabase
            .from('trainer_availability')
            .update({ is_booked: false })
            .eq('id', appt.trainer_availability_id)
          // Refresh calendar to show slot as free again
          setEvents(prev => prev.map(e =>
            e.id === appt.trainer_availability_id
              ? { ...e, title: 'Disponible', backgroundColor: '#3743BA', borderColor: '#2d389e', editable: true, classNames: [], extendedProps: { isBooked: false } }
              : e
          ))
        }
      }
      setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, status } : a))
    }
  }

  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-ink text-2xl font-semibold">Mes disponibilités</h1>
          <p className="text-muted text-sm mt-1">
            Cliquez-glissez pour créer un créneau · Glissez pour déplacer · Redimensionnez pour ajuster la durée
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 shrink-0 mt-1">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="w-3 h-3 rounded-sm bg-brand inline-block shrink-0" />
            Disponible
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block shrink-0" />
            Réservé
          </span>
        </div>
      </div>

      {/* Pending confirmation bar */}
      {pendingAction && (
        <div className="flex items-center gap-4 bg-brand/5 border border-brand/20 rounded-xl px-5 py-3.5">
          <svg className="w-4 h-4 text-brand shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-ink flex-1">{pendingAction.message}</p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={cancelPending}
              className="text-xs text-muted border border-gray-200 hover:border-gray-300 hover:text-ink px-3 py-1.5 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={confirmPending}
              className="text-xs bg-brand hover:bg-brand-hover text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Confirmer
            </button>
          </div>
        </div>
      )}

      {/* Calendar card */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        {loading ? (
          <Spinner />
        ) : (
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            locale={frLocale}
            firstDay={1}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: '',
            }}
            selectable={true}
            selectMirror={true}
            editable={true}
            eventDurationEditable={true}
            events={events}
            select={handleSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            slotMinTime="07:00:00"
            slotMaxTime="21:00:00"
            allDaySlot={false}
            nowIndicator={true}
            height="auto"
            slotDuration="00:30:00"
            snapDuration="00:15:00"
            expandRows={true}
            stickyHeaderDates={true}
            eventMinHeight={24}
            selectMinDistance={5}
          />
        )}
      </div>

      {/* Appointments */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-ink text-base font-semibold">Rendez-vous en cours</h2>
          {appointments.length > 0 && (
            <span className="text-muted text-xs bg-gray-100 px-2 py-0.5 rounded-full">
              {appointments.length}
            </span>
          )}
        </div>

        {apptLoading ? <Spinner /> : appointments.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-8 text-center">
            <p className="text-muted text-sm">Aucun rendez-vous en attente ou confirmé.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {appointments.map((appt, i) => {
              const athleteName = [appt.profiles?.first_name, appt.profiles?.last_name]
                .filter(Boolean).join(' ') || '—'

              return (
                <div
                  key={appt.id}
                  className={`px-5 py-4 ${i < appointments.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-brand text-sm font-semibold">
                        {athleteName.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-ink text-sm font-medium">{athleteName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_CLASSES[appt.status]}`}>
                          {STATUS_LABELS[appt.status]}
                        </span>
                      </div>

                      {appt.trainer_availability && (
                        <p className="text-muted text-xs">
                          {fmtDateTime(appt.trainer_availability.start_time)} – {fmtTime(appt.trainer_availability.end_time)}
                        </p>
                      )}

                      {appt.injuries && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs text-muted">Blessure :</span>
                          <span className="text-xs text-ink">
                            {BODY_ZONE_LABELS[appt.injuries.body_zone]}
                            {appt.injuries.side
                              ? ` (${appt.injuries.side === 'left' ? 'gauche' : 'droite'})`
                              : ''}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${severityClass(appt.injuries.severity)}`}>
                            {appt.injuries.severity}/10
                          </span>
                        </div>
                      )}
                    </div>

                    {appt.status === 'requested' && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => updateAppointment(appt.id, 'confirmed')}
                          className="text-xs text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          Confirmer
                        </button>
                        <button
                          onClick={() => updateAppointment(appt.id, 'cancelled')}
                          className="text-xs text-muted border border-gray-200 hover:border-accent/30 hover:text-accent px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          Refuser
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Delete confirmation modal */}
      {deleteTargetId && (
        <DeleteModal
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}

      {/* Booked slot info modal */}
      {showBookedModal && (
        <BookedModal onClose={() => setShowBookedModal(false)} />
      )}
    </div>
  )
}
