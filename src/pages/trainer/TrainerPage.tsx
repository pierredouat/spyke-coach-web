import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { BodyZone, AppointmentStatus } from '../../types/database'
import { BODY_ZONE_LABELS } from '../../types/database'

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

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  requested:  'Demande',
  confirmed:  'Confirmé',
  cancelled:  'Annulé',
}

const STATUS_CLASSES: Record<AppointmentStatus, string> = {
  requested: 'text-amber-700 bg-amber-50 border-amber-200',
  confirmed: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  cancelled: 'text-muted bg-gray-100 border-gray-200',
}

function severityClass(s: number) {
  if (s <= 3) return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (s <= 6) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-red-700 bg-red-50 border-red-200'
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

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

export default function TrainerPage() {
  const { user } = useAuth()
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [appointments, setAppointments] = useState<ApptRow[]>([])
  const [loading, setLoading] = useState(true)

  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function loadData() {
    if (!user) return

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: slotsData } = await supabase
      .from('trainer_availability')
      .select('id, start_time, end_time, is_booked')
      .eq('trainer_id', user.id)
      .gte('start_time', todayStart.toISOString())
      .order('start_time')

    const mySlots = (slotsData ?? []) as SlotRow[]
    setSlots(mySlots)

    if (mySlots.length > 0) {
      const slotIds = mySlots.map(s => s.id)
      const { data: apptsData } = await supabase
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

      setAppointments((apptsData ?? []) as unknown as ApptRow[])
    } else {
      setAppointments([])
    }

    setLoading(false)
  }

  useEffect(() => { loadData() }, [user])

  async function createSlot(e: FormEvent) {
    e.preventDefault()
    if (!user || !date || !startTime || !endTime) return
    setFormError(null)
    setCreating(true)

    const startISO = new Date(`${date}T${startTime}:00`).toISOString()
    const endISO = new Date(`${date}T${endTime}:00`).toISOString()

    if (endISO <= startISO) {
      setFormError("L'heure de fin doit être après l'heure de début")
      setCreating(false)
      return
    }

    const { error } = await supabase
      .from('trainer_availability')
      .insert({
        trainer_id: user.id,
        team_id: user.id,
        start_time: startISO,
        end_time: endISO,
      })

    if (error) {
      setFormError(error.message)
    } else {
      setDate('')
      setStartTime('')
      setEndTime('')
      await loadData()
    }
    setCreating(false)
  }

  async function deleteSlot(slotId: string) {
    const { error } = await supabase
      .from('trainer_availability')
      .delete()
      .eq('id', slotId)

    if (!error) {
      setSlots(prev => prev.filter(s => s.id !== slotId))
      setAppointments(prev => prev.filter(a => a.trainer_availability_id !== slotId))
    }
  }

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
          setSlots(prev => prev.map(s =>
            s.id === appt.trainer_availability_id ? { ...s, is_booked: false } : s
          ))
        }
      }
      setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, status } : a))
    }
  }

  const minDate = new Date().toISOString().split('T')[0]

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-ink text-2xl font-semibold">Mes disponibilités</h1>
        <p className="text-muted text-sm mt-1">Gérez vos créneaux et rendez-vous athlètes</p>
      </div>

      {/* ── Nouveau créneau ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-ink text-base font-semibold mb-3">Ajouter un créneau</h2>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <form onSubmit={createSlot} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-muted mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                min={minDate}
                onChange={e => setDate(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">Début</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                required
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">Fin</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                required
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-brand hover:bg-brand-hover text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {creating ? 'Ajout…' : 'Ajouter'}
            </button>
          </form>

          {formError && (
            <p className="mt-3 text-accent text-xs bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}
        </div>
      </section>

      {/* ── Créneaux à venir ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-ink text-base font-semibold">Créneaux à venir</h2>
          {slots.length > 0 && (
            <span className="text-muted text-xs bg-gray-100 px-2 py-0.5 rounded-full">{slots.length}</span>
          )}
        </div>

        {loading ? <Spinner /> : slots.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-8 text-center">
            <p className="text-muted text-sm">Aucun créneau à venir. Ajoutez-en un ci-dessus.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {slots.map((slot, i) => (
              <div
                key={slot.id}
                className={`flex items-center gap-4 px-5 py-4 ${i < slots.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-ink text-sm font-medium">
                    {fmtDateTime(slot.start_time)} – {fmtTime(slot.end_time)}
                  </p>
                  <div className="mt-1">
                    {slot.is_booked ? (
                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        Réservé
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Disponible
                      </span>
                    )}
                  </div>
                </div>

                {!slot.is_booked && (
                  <button
                    onClick={() => deleteSlot(slot.id)}
                    className="text-xs text-muted hover:text-accent border border-gray-200 hover:border-accent/30 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Rendez-vous ──────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-ink text-base font-semibold">Rendez-vous en cours</h2>
          {appointments.length > 0 && (
            <span className="text-muted text-xs bg-gray-100 px-2 py-0.5 rounded-full">{appointments.length}</span>
          )}
        </div>

        {!loading && appointments.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-8 text-center">
            <p className="text-muted text-sm">Aucun rendez-vous en attente ou confirmé.</p>
          </div>
        ) : !loading && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {appointments.map((appt, i) => {
              const athleteName = [appt.profiles?.first_name, appt.profiles?.last_name]
                .filter(Boolean).join(' ') || '—'
              const initial = athleteName.charAt(0).toUpperCase()

              return (
                <div
                  key={appt.id}
                  className={`px-5 py-4 ${i < appointments.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-brand text-sm font-semibold">{initial}</span>
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
    </div>
  )
}
