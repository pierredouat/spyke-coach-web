import { useState } from 'react'
import type { SessionWithExercises } from '../../types/database'
import { duplicateSessionsToDate } from '../../lib/duplicateSessions'
import { getMonthGrid, addMonths, fmtMonthYear, fmtDayLong, fmtDay, fmtMonth, isSameDay } from '../../lib/dates'

const DAY_HEADS = ['Lu','Ma','Me','Je','Ve','Sa','Di']

interface Props {
  sourceDate: Date
  sessions: SessionWithExercises[]
  onClose: () => void
  onDone: () => void
}

export default function DuplicateDayModal({ sourceDate, sessions, onClose, onDone }: Props) {
  const [viewMonth, setViewMonth] = useState(
    () => new Date(sourceDate.getFullYear(), sourceDate.getMonth(), 1)
  )
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date(); today.setHours(0,0,0,0)
  const grid = getMonthGrid(viewMonth.getFullYear(), viewMonth.getMonth())

  function toggleDate(d: Date) {
    if (isSameDay(d, sourceDate)) return
    setSelectedDates(prev =>
      prev.some(x => isSameDay(x, d))
        ? prev.filter(x => !isSameDay(x, d))
        : [...prev, d]
    )
  }

  async function handleDuplicate() {
    if (selectedDates.length === 0 || copying) return
    setCopying(true); setError(null)
    try {
      for (const targetDate of selectedDates) {
        await duplicateSessionsToDate(sessions, targetDate)
      }
      onDone()
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Erreur inconnue')
      setCopying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-ink font-semibold text-sm">Dupliquer ce jour</h2>
            <p className="text-muted text-xs mt-0.5">
              {fmtDayLong(sourceDate)} {fmtDay(sourceDate)} {fmtMonth(sourceDate)} —{' '}
              {sessions.length} séance{sessions.length > 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Calendar */}
        <div className="p-4">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setViewMonth(m => addMonths(m, -1))}
              className="w-7 h-7 flex items-center justify-center text-muted hover:text-ink hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-medium text-ink capitalize">{fmtMonthYear(viewMonth)}</span>
            <button onClick={() => setViewMonth(m => addMonths(m, 1))}
              className="w-7 h-7 flex items-center justify-center text-muted hover:text-ink hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_HEADS.map(h => (
              <div key={h} className="text-center text-xs text-muted py-1">{h}</div>
            ))}
          </div>

          {/* Date grid */}
          <div className="space-y-0.5">
            {grid.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((d, di) => {
                  if (!d) return <div key={di} />
                  const isSource  = isSameDay(d, sourceDate)
                  const isToday   = isSameDay(d, today)
                  const isSelected = selectedDates.some(x => isSameDay(x, d))
                  const inMonth    = d.getMonth() === viewMonth.getMonth()
                  return (
                    <button
                      key={di}
                      type="button"
                      onClick={() => toggleDate(d)}
                      disabled={isSource}
                      className={[
                        'w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm transition-colors',
                        isSource     ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                        isSelected   ? 'bg-brand text-white' :
                        isToday      ? 'ring-1 ring-brand text-brand hover:bg-brand/10' :
                        inMonth      ? 'text-ink hover:bg-gray-100' :
                                       'text-gray-300 hover:bg-gray-50',
                      ].filter(Boolean).join(' ')}
                    >
                      {d.getDate()}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <span className="text-xs text-muted">
            {selectedDates.length === 0
              ? 'Sélectionnez une ou plusieurs dates'
              : `${selectedDates.length} date${selectedDates.length > 1 ? 's' : ''} sélectionnée${selectedDates.length > 1 ? 's' : ''}`}
          </span>
          {error && <p className="text-accent text-xs">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="text-sm text-muted hover:text-ink px-3 py-1.5 transition-colors">
              Annuler
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={selectedDates.length === 0 || copying}
              className="bg-brand hover:bg-brand-hover text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            >
              {copying ? 'Copie…' : 'Dupliquer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
