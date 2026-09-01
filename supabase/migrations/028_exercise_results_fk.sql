-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 028 — Contrainte FK exercise_results → exercises
-- ══════════════════════════════════════════════════════════════════════════════
-- Contexte : migration 021 crée exercise_results.exercise_id avec une déclaration
-- inline "references exercises(id)", mais la contrainte est absente en base
-- (Relationships: [] dans les types Supabase générés → PostgREST ne connaît pas
-- la relation et refuse la jointure).
-- Solution : création explicite de la contrainte avec un nom canonique, idempotente.
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'exercise_results_exercise_id_fkey'
  ) THEN
    ALTER TABLE exercise_results
      ADD CONSTRAINT exercise_results_exercise_id_fkey
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL;
  END IF;
END $$;
