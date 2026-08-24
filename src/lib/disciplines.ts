import type { Discipline } from '../types/database'

export const disciplineLabels: Record<Discipline, string> = {
  sprint: 'Sprint',
  demi_fond: 'Demi-fond',
  fond: 'Fond',
  sauts: 'Sauts',
  lancers: 'Lancers',
  combines: 'Combinés',
  marche: 'Marche',
}

export function formatDisciplines(disciplines: Discipline[] | null | undefined): string {
  if (!disciplines?.length) return '—'
  return disciplines.map(d => disciplineLabels[d]).join(', ')
}
