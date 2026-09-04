import type { ExerciseFamily } from '../types/database'

// FilterTab = ExerciseFamily now that the enum covers all 9 categories.
export type FilterTab = ExerciseFamily

export const FAMILY_LABELS: Record<ExerciseFamily, string> = {
  discipline:    'Discipline',
  musculation:   'Musculation',
  explosif:      'Explosif',
  pliometrie:    'Plyométrie',
  gainage:       'Gainage',
  mobilite:      'Mobilité',
  vitesse:       'Vitesse',
  coordination:  'Coordination',
  cardio_aerobie:'Cardio / Aérobie',
}

// Re-export as FILTER_TAB_LABELS for consumers that imported the old name.
export const FILTER_TAB_LABELS = FAMILY_LABELS

export const FILTER_TAB_COLORS: Record<ExerciseFamily, string> = {
  discipline:    'bg-brand/10 text-brand',
  musculation:   'bg-slate-100 text-slate-600',
  explosif:      'bg-orange-50 text-orange-700',
  pliometrie:    'bg-amber-50 text-amber-700',
  gainage:       'bg-emerald-50 text-emerald-700',
  mobilite:      'bg-violet-50 text-violet-700',
  vitesse:       'bg-red-50 text-red-600',
  coordination:  'bg-teal-50 text-teal-700',
  cardio_aerobie:'bg-sky-50 text-sky-700',
}

export const ALL_FILTER_TABS: ExerciseFamily[] = [
  'discipline',
  'musculation',
  'explosif',
  'pliometrie',
  'gainage',
  'mobilite',
  'vitesse',
  'coordination',
  'cardio_aerobie',
]

/**
 * Returns true if an exercise matches a filter tab.
 * Checks both exercises.family (enum) and exercises.category (text from mobile)
 * — after the migration, both columns use the same 9 string values.
 */
export function matchesFilterTab(
  ex: { family?: string | null; category?: string | null },
  tab: FilterTab,
): boolean {
  return ex.family === tab || ex.category === tab
}

/** Returns the display label for an exercise's category/family. */
export function exerciseTabLabel(ex: { family?: string | null; category?: string | null }): string | null {
  const key = (ex.family ?? ex.category) as ExerciseFamily | null
  if (!key) return null
  return FAMILY_LABELS[key] ?? key
}

/** Returns the color classes for an exercise's category/family badge. */
export function exerciseTabColor(ex: { family?: string | null; category?: string | null }): string {
  const key = (ex.family ?? ex.category) as ExerciseFamily | null
  if (key && key in FILTER_TAB_COLORS) return FILTER_TAB_COLORS[key]
  return 'bg-gray-100 text-gray-600'
}
