-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 037 — Policy SELECT staff sur session_feedback
-- ══════════════════════════════════════════════════════════════════════════════
-- Contexte : la table session_feedback a été créée directement dans le dashboard
-- Supabase, hors du système de migrations versionné. Aucune migration locale ne
-- la référence. Cette migration n'en recrée pas la structure (DDL déjà en place
-- en base) — elle se limite à ajouter la policy de lecture manquante pour le
-- staff de l'équipe.
--
-- Schéma de la table (documenté ici pour traçabilité) :
--   id, session_id, athlete_id, perceived_effort, mood,
--   completed_as_planned, notes, created_at, volume_compared_to_plan
--
-- RLS souhaitée :
--   SELECT athlète  : déjà en place (l'athlète voit ses propres feedbacks)
--   SELECT staff    : tout membre du staff dont l'athlète est rattaché à
--                     son équipe via coach_athlete_relationships
--                     → même pattern que performances et exercise_results
--                     → jamais de changement côté athlète
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "session_feedback_staff_select" ON session_feedback;

CREATE POLICY "session_feedback_staff_select" ON session_feedback
  FOR SELECT USING (
    athlete_id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id IN (SELECT get_my_team_ids())
    )
  );
