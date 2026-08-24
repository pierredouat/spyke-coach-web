import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Profile, SessionWithExercises } from '../../types/database'
import {
  formatYMD, addDays, addWeeks, addMonths,
  getWeekStart, getWeekDays,
  fmtMonthYear, fmtDayShort, fmtMonthShort,
} from '../../lib/dates'
import WeekView  from './views/WeekView'
import DayView   from './views/DayView'
import MonthView from './views/MonthView'
import MacroView from './views/MacroView'
import SessionModal from './SessionModal'

// ─── Scale types ──────────────────────────────────────────────────────────────
type Scale = 'day' | 'week' | 'month' | 'trimester' | 'year'

const SCALE_LABELS: Record<Scale, string> = {
  day:       'Jour',
  week:      'Semaine',
  month:     'Mois',
  trimester: 'Trimestre',
  year:      'Année',
}

// ─── Date-range helpers ───────────────────────────────────────────────────────
function rangeForScale(date: Date, scale: Scale): { from: string; to: string } {
  switch (scale) {
    case 'day':
      return { from: formatYMD(date), to: formatYMD(date) }
    case 'week': {
      const ws = getWeekStart(date)
      return { from: formatYMD(ws), to: formatYMD(addDays(ws, 6)) }
    }
    case 'month': {
      const from = new Date(date.getFullYear(), date.getMonth(), 1)
      const to   = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      return { from: formatYMD(from), to: formatYMD(to) }
    }
    case 'trimester': {
      const q = Math.floor(date.getMonth() / 3)
      const from = new Date(date.getFullYear(), q * 3, 1)
      const to   = new Date(date.getFullYear(), q * 3 + 3, 0)
      return { from: formatYMD(from), to: formatYMD(to) }
    }
    case 'year': {
      const from = new Date(date.getFullYear(), 0, 1)
      const to   = new Date(date.getFullYear(), 11, 31)
      return { from: formatYMD(from), to: formatYMD(to) }
    }
  }
}

function navigateDate(date: Date, scale: Scale, dir: 1 | -1): Date {
  switch (scale) {
    case 'day':       return addDays(date, dir)
    case 'week':      return addWeeks(date, dir)
    case 'month':     return addMonths(date, dir)
    case 'trimester': return addMonths(date, dir * 3)
    case 'year':      return addMonths(date, dir * 12)
  }
}

function labelForDate(date: Date, scale: Scale): string {
  switch (scale) {
    case 'day':
      return `${fmtDayShort(date)} ${fmtMonthShort(date)} ${date.getFullYear()}`
    case 'week': {
      const ws = getWeekStart(date)
      const we = addDays(ws, 6)
      return ws.getMonth() === we.getMonth()
        ? `${ws.getDate()}–${we.getDate()} ${fmtMonthShort(ws)} ${ws.getFullYear()}`
        : `${ws.getDate()} ${fmtMonthShort(ws)} – ${we.getDate()} ${fmtMonthShort(we)} ${we.getFullYear()}`
    }
    case 'month':
      return fmtMonthYear(date)
    case 'trimester': {
      const q = Math.floor(date.getMonth() / 3) + 1
      return `T${q} ${date.getFullYear()}`
    }
    case 'year':
      return `${date.getFullYear()}`
  }
}

// ─── Macro weeks count ───────────────────────────────────────────────────────
function weeksForScale(scale: Scale): number {
  if (scale === 'trimester') return 13
  if (scale === 'year') return 52
  return 0
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PlanningPage() {
  const { user } = useAuth()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [scale, setScale]       = useState<Scale>('week')
  const [currentDate, setCurrentDate] = useState<Date>(today)
  const [athletes, setAthletes] = useState<Profile[]>([])
  const [filteredAthleteId, setFilteredAthleteId] = useState<string | 'all'>('all')
  const [sessions, setSessions] = useState<SessionWithExercises[]>([])
  const [loading, setLoading]   = useState(true)

  // Modal state
  const [modalOpen, setModalOpen]       = useState(false)
  const [editSession, setEditSession]   = useState<SessionWithExercises | null>(null)
  const [defaultDate, setDefaultDate]   = useState<string | undefined>()

  // ── Load athletes ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    supabase
      .from('coach_athlete_relationships')
      .select('athlete_id')
      .eq('coach_id', user.id)
      .eq('status', 'active')
      .then(async ({ data }) => {
        const ids = (data ?? []).map(r => r.athlete_id)
        if (ids.length === 0) { setAthletes([]); return }
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', ids)
        setAthletes((profiles ?? []) as unknown as Profile[])
      })
  }, [user])

  // ── Load sessions ────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { from, to } = rangeForScale(currentDate, scale)
    let query = supabase
      .from('sessions')
      .select('*, session_exercises(*)')
      .eq('coach_id', user.id)
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
      .order('scheduled_date')
      .order('created_at')

    if (filteredAthleteId !== 'all') {
      query = query.eq('athlete_id', filteredAthleteId)
    }

    const { data } = await query
    setSessions((data ?? []) as unknown as SessionWithExercises[])
    setLoading(false)
  }, [user, currentDate, scale, filteredAthleteId])

  useEffect(() => { loadSessions() }, [loadSessions])

  // ── Navigation ───────────────────────────────────────────────────────────
  function go(dir: 1 | -1) { setCurrentDate(d => navigateDate(d, scale, dir)) }
  function goToday() { setCurrentDate(today) }

  // ── Modal helpers ────────────────────────────────────────────────────────
  function openCreate(date?: Date) {
    setEditSession(null)
    setDefaultDate(date ? formatYMD(date) : undefined)
    setModalOpen(true)
  }
  function openEdit(s: SessionWithExercises) {
    setEditSession(s)
    setDefaultDate(undefined)
    setModalOpen(true)
  }
  function closeModal() { setModalOpen(false); setEditSession(null) }
  async function onSaved() { closeModal(); await loadSessions() }

  // ── Scale change — keep date in range ───────────────────────────────────
  function changeScale(s: Scale) {
    setScale(s)
    // If switching to week, snap to current week start
    if (s === 'week') setCurrentDate(getWeekStart(currentDate))
  }

  // ── View renders ─────────────────────────────────────────────────────────
  const weekDays = getWeekDays(getWeekStart(currentDate))
  const isMacro  = scale === 'trimester' || scale === 'year'

  return (
    <div className="min-h-full p-6 lg:p-8 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-ink">Planning</h1>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-2 bg-brand hover:bg-brand-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle séance
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Scale selector */}
        <div className="flex bg-white border border-gray-200 rounded-lg p-0.5 gap-0.5">
          {(Object.keys(SCALE_LABELS) as Scale[]).map(s => (
            <button
              key={s}
              onClick={() => changeScale(s)}
              className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
                scale === s ? 'bg-brand text-white shadow-sm' : 'text-muted hover:text-ink hover:bg-gray-50'
              }`}
            >
              {SCALE_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button onClick={() => go(-1)}
            className="w-8 h-8 flex items-center justify-center text-muted hover:text-ink hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={goToday}
            className="px-3 h-8 text-sm font-medium text-muted hover:text-ink hover:bg-gray-100 rounded-lg transition-colors">
            {labelForDate(currentDate, scale)}
          </button>
          <button onClick={() => go(1)}
            className="w-8 h-8 flex items-center justify-center text-muted hover:text-ink hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Athlete filter */}
        {athletes.length > 1 && (
          <select
            value={filteredAthleteId}
            onChange={e => setFilteredAthleteId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-ink bg-white focus:outline-none focus:border-brand transition-colors"
          >
            <option value="all">Tous les athlètes</option>
            {athletes.map(a => (
              <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── View ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {scale === 'day' && (
            <DayView
              day={currentDate}
              sessions={sessions}
              athletes={athletes}
              onSessionClick={openEdit}
              onCreateOnDay={openCreate}
            />
          )}

          {scale === 'week' && (
            <WeekView
              days={weekDays}
              sessions={sessions}
              athletes={athletes}
              today={today}
              onDayClick={d => { setCurrentDate(d); changeScale('day') }}
              onSessionClick={openEdit}
              onCreateOnDay={openCreate}
            />
          )}

          {scale === 'month' && (
            <MonthView
              year={currentDate.getFullYear()}
              month={currentDate.getMonth()}
              sessions={sessions}
              today={today}
              onDayClick={d => { setCurrentDate(d); changeScale('day') }}
            />
          )}

          {isMacro && (
            <MacroView
              startDate={getWeekStart(currentDate)}
              weeks={weeksForScale(scale)}
              sessions={sessions}
              today={today}
              onWeekClick={ws => { setCurrentDate(ws); changeScale('week') }}
            />
          )}
        </>
      )}

      {/* ── Modal ── */}
      {modalOpen && user && (
        <SessionModal
          coachId={user.id}
          athletes={athletes}
          defaultDate={defaultDate}
          session={editSession}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
