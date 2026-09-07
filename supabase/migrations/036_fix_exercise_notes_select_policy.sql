-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 036 — Correction policy SELECT exercise_notes (visibilité inter-staff)
-- ══════════════════════════════════════════════════════════════════════════════
-- Contexte : la table exercise_notes a probablement été créée directement dans
-- le dashboard Supabase avant que la migration 035 ne soit appliquée, avec une
-- policy SELECT restrictive (coach_id = auth.uid() — auteur uniquement).
-- La migration 035 contient la bonne policy mais n'a pas été poussée sur le
-- projet distant. Cette migration corrige l'état réel de la base en recréant
-- la policy avec le bon pattern équipe, cohérent avec les autres tables.
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "ex_notes_select" ON exercise_notes;

CREATE POLICY "ex_notes_select" ON exercise_notes
  FOR SELECT USING (
    coach_id IN (
      SELECT tm.user_id
      FROM   team_members tm
      WHERE  tm.team_id IN (SELECT get_my_team_ids())
    )
  );
