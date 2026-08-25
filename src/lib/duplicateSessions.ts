import { supabase } from './supabase'
import type { SessionWithExercises } from '../types/database'
import { formatYMD, addDays } from './dates'

// Copy one set of sessions to a target date, preserving all exercises and fields.
export async function duplicateSessionsToDate(
  sessions: SessionWithExercises[],
  targetDate: Date,
): Promise<void> {
  for (const session of sessions) {
    const { data: newSession, error: se } = await supabase
      .from('sessions')
      .insert({
        coach_id:   session.coach_id,
        athlete_id: session.athlete_id,
        title:      session.title,
        scheduled_date: formatYMD(targetDate),
        estimated_duration_minutes: session.estimated_duration_minutes,
        location:    session.location,
        description: session.description,
        coach_notes: session.coach_notes,
        is_revealed: session.is_revealed,
        // status defaults to 'a_faire'
      })
      .select()
      .single()
    if (se) throw se
    if (newSession && session.session_exercises.length > 0) {
      const { error: ee } = await supabase.from('session_exercises').insert(
        session.session_exercises.map((ex, i) => ({
          session_id:      newSession.id,
          exercise_id:     ex.exercise_id,
          name:            ex.name,
          order_index:     i,
          sets:            ex.sets,
          reps:            ex.reps,
          distance_meters: ex.distance_meters,
          duration_seconds:ex.duration_seconds,
          rest_seconds:    ex.rest_seconds,
          intensity:       ex.intensity,
          intention:       ex.intention,
          technical_notes: ex.technical_notes,
          notes:           ex.notes,
        }))
      )
      if (ee) throw ee
    }
  }
}

// Copy a full week of sessions to a target week, preserving day-of-week offsets.
export async function duplicateWeekToStart(
  sessions: SessionWithExercises[],
  sourceWeekStart: Date,
  targetWeekStart: Date,
): Promise<void> {
  for (const session of sessions) {
    const sourceDay = new Date(session.scheduled_date + 'T00:00:00')
    const dayOffset = Math.round((sourceDay.getTime() - sourceWeekStart.getTime()) / 86_400_000)
    const targetDate = addDays(targetWeekStart, dayOffset)
    await duplicateSessionsToDate([session], targetDate)
  }
}
