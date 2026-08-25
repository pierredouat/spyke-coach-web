import { useState } from 'react'
import type { SessionWithExercises } from '../../types/database'
import { duplicateWeekToStart } from '../../lib/duplicateSessions'
import { addWeeks, addDays, getWeekStart, fmtDay, fmtMonthShort, fmtMonthYear, parseYMD, formatYMD } from '../../lib/dates'

interface Props {
  weekStart: Date
  sessions: SessionWithExercises[]
  onClose: () => void
  onDone: () => void
}

// Build a human-readable label for a target week (relative to source)
function weekRangeLabel(start: Date): string {
  const end = addDays(start, 6)
  return start.getMonth() === end.getMonth()
    ? `${fmtDay(start)}–${fmtDay(end)} ${fmtMonthShort(end)} ${end.getFullYear()}`
    : `${fmtDay(start)} ${fmtMonthShort(start)} – ${fmtDay(end)} ${fmtMonthShort(end)} ${end.getFullYear()}`
}

const QUICK_OFFSETS = [1, 2, 3, 4] // weeks ahead

export default function DuplicateWeekModal({ weekStart, sessions, onClose, onDone }: Props) {
  const [selectedOffsets, setSelectedOffsets] = useState<number[]>([1])
  const [customWeekStr, setCustomWeekStr]     = useState('')
  const [customSelected, setCustomSelected]   = useState(false)
  const [copying, setCopying] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function toggleOffset(n: number) {
    setSelectedOffsets(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
    )
  }

  function toggleCustom() {
    setCustomSelected(v => !v)
  }

  // Compute the actual target week starts
  function targetWeeks(): Date[] {
    const weeks: Date[] = []
    for (const o of selectedOffsets) weeks.push(addWeeks(weekStart, o))
    if (customSelected && customWeekStr) {
      const d = parseYMD(customWeekStr)
      if (!isNaN(d.getTime())) weeks.push(getWeekStart(d))
    }
    return weeks
  }

  async function handleDuplicate() {
    const targets = targetWeeks()
    if (targets.length === 0 || copying) return
    setCopying(true); setError(null)
    try {
      for (const targetWeekStart of targets) {
        await duplicateWeekToStart(sessions, weekStart, targetWeekStart)
      }
      onDone()
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Erreur inconnue')
      setCopying(false)
    }
  }

  const targets = targetWeeks()
  const totalSessions = targets.length * sessions.length

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-ink font-semibold text-sm">Dupliquer cette semaine</h2>
            <p className="text-muted text-xs mt-0.5 capitalize">
              {fmtMonthYear(weekStart)} — {weekRangeLabel(weekStart)} · {sessions.length} séance{sessions.length > 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Week options */}
        <div className="p-5 space-y-2">
          {QUICK_OFFSETS.map(n => {
            const target = addWeeks(weekStart, n)
            const label  = weekRangeLabel(target)
            const checked = selectedOffsets.includes(n)
            return (
              <label key={n} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleOffset(n)}
                  className="accent-brand w-4 h-4 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-ink">
                    {n === 1 ? 'Semaine suivante' : `Dans ${n} semaines`}
                  </span>
                  <span className="text-xs text-muted ml-2">{label}</span>
                </div>
              </label>
            )
          })}

          {/* Custom week */}
          <div className="pt-2 border-t border-gray-100">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={customSelected}
                onChange={toggleCustom}
                className="accent-brand w-4 h-4 mt-0.5 shrink-0"
              />
              <div className="flex-1 space-y-1.5">
                <span className="text-sm text-ink">Autre semaine</span>
                {customSelected && (
                  <div>
                    <input
                      type="date"
                      value={customWeekStr}
                      onChange={e => setCustomWeekStr(e.target.value)}
                      placeholder={formatYMD(addWeeks(weekStart, 5))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-brand transition-colors"
                    />
                    {customWeekStr && (() => {
                      const d = parseYMD(customWeekStr)
                      return !isNaN(d.getTime())
                        ? <p className="text-xs text-muted mt-1">Semaine du {weekRangeLabel(getWeekStart(d))}</p>
                        : null
                    })()}
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <span className="text-xs text-muted">
            {targets.length === 0
              ? 'Sélectionnez au moins une semaine'
              : `${totalSessions} séance${totalSessions > 1 ? 's' : ''} à créer`}
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
              disabled={targets.length === 0 || copying}
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
