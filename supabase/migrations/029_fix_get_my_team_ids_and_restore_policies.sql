-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 029 — Correction get_my_team_ids() + restauration complète des policies
-- ══════════════════════════════════════════════════════════════════════════════
-- Contexte : DROP FUNCTION get_my_team_ids() CASCADE a supprimé 10 policies.
-- La fonction a ensuite été recréée avec le corps du projet mobile (retourne des
-- profiles.id au lieu des teams.id), ce qui casse toutes les policies restantes.
-- 2 policies recréées manuellement ont aussi perdu leur WITH CHECK (trou sécu).
--
-- Cette migration :
--   1. Recrée get_my_team_ids() avec le bon corps (team_members → teams.id)
--   2. Recrée les 2 policies avec leur WITH CHECK manquant
--   3. Restaure les 10 policies supprimées par CASCADE
--   Toutes les policies utilisent IN (SELECT get_my_team_ids()) pour compatibilité
--   avec RETURNS SETOF uuid.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Corriger get_my_team_ids() ─────────────────────────────────────────────
-- Corps précédent (mobile) : retournait profiles.id / coach_id.
-- Corps corrigé : retourne les team_id de la table team_members pour l'utilisateur courant.
-- SECURITY DEFINER conservé : évite la récursion (la policy team_members_select
-- appelle cette fonction, qui interroge team_members ; sans SECURITY DEFINER ce
-- serait une récursion infinie).
CREATE OR REPLACE FUNCTION public.get_my_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid()
$$;

-- ── 2. Corriger les policies recréées sans WITH CHECK ─────────────────────────

-- team_invitations INSERT : n'importe qui pouvait insérer (WITH CHECK = null)
DROP POLICY IF EXISTS "team_inv_insert" ON team_invitations;
CREATE POLICY "team_inv_insert" ON team_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE  team_id = team_invitations.team_id
        AND  user_id = auth.uid()
        AND  role    = 'head_coach'
    )
  );

-- team_members INSERT : n'importe qui pouvait insérer (WITH CHECK = null)
DROP POLICY IF EXISTS "team_members_insert" ON team_members;
CREATE POLICY "team_members_insert" ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE  tm.team_id = team_members.team_id
        AND  tm.user_id = auth.uid()
        AND  tm.role    = 'head_coach'
    )
  );

-- ── 3. Restaurer les policies supprimées par CASCADE ─────────────────────────

-- ─ team_invitations : lecture ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "team_inv_select" ON team_invitations;
CREATE POLICY "team_inv_select" ON team_invitations
  FOR SELECT USING (team_id IN (SELECT get_my_team_ids()));

-- ─ coach_athlete_relationships : lecture (cause directe du roster vide) ────────
DROP POLICY IF EXISTS "team_car_select" ON coach_athlete_relationships;
CREATE POLICY "team_car_select" ON coach_athlete_relationships
  FOR SELECT USING (
    team_id IS NOT NULL
    AND team_id IN (SELECT get_my_team_ids())
  );

-- ─ sessions ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "team_sessions_select" ON sessions;
CREATE POLICY "team_sessions_select" ON sessions
  FOR SELECT USING (
    athlete_id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id IN (SELECT get_my_team_ids())
        AND  car.status  = 'active'
    )
  );

DROP POLICY IF EXISTS "team_sessions_insert" ON sessions;
CREATE POLICY "team_sessions_insert" ON sessions
  FOR INSERT WITH CHECK (
    athlete_id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id IN (SELECT get_my_team_ids())
        AND  car.status  = 'active'
    )
  );

DROP POLICY IF EXISTS "team_sessions_update" ON sessions;
CREATE POLICY "team_sessions_update" ON sessions
  FOR UPDATE USING (
    athlete_id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id IN (SELECT get_my_team_ids())
        AND  car.status  = 'active'
    )
  );

-- ─ session_exercises ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "team_session_exercises_select" ON session_exercises;
CREATE POLICY "team_session_exercises_select" ON session_exercises
  FOR SELECT USING (
    session_id IN (
      SELECT s.id FROM sessions s
      WHERE  s.athlete_id IN (
        SELECT car.athlete_id
        FROM   coach_athlete_relationships car
        WHERE  car.team_id IN (SELECT get_my_team_ids())
          AND  car.status  = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "team_session_exercises_insert" ON session_exercises;
CREATE POLICY "team_session_exercises_insert" ON session_exercises
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT s.id FROM sessions s
      WHERE  s.athlete_id IN (
        SELECT car.athlete_id
        FROM   coach_athlete_relationships car
        WHERE  car.team_id IN (SELECT get_my_team_ids())
          AND  car.status  = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "team_session_exercises_update" ON session_exercises;
CREATE POLICY "team_session_exercises_update" ON session_exercises
  FOR UPDATE USING (
    session_id IN (
      SELECT s.id FROM sessions s
      WHERE  s.athlete_id IN (
        SELECT car.athlete_id
        FROM   coach_athlete_relationships car
        WHERE  car.team_id IN (SELECT get_my_team_ids())
          AND  car.status  = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "team_session_exercises_delete" ON session_exercises;
CREATE POLICY "team_session_exercises_delete" ON session_exercises
  FOR DELETE USING (
    session_id IN (
      SELECT s.id FROM sessions s
      WHERE  s.athlete_id IN (
        SELECT car.athlete_id
        FROM   coach_athlete_relationships car
        WHERE  car.team_id IN (SELECT get_my_team_ids())
          AND  car.status  = 'active'
      )
    )
  );

-- ─ performances (migration 027 non appliquée) ─────────────────────────────────
DROP POLICY IF EXISTS "team_performances_select" ON performances;
CREATE POLICY "team_performances_select" ON performances
  FOR SELECT USING (
    athlete_id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id IN (SELECT get_my_team_ids())
    )
  );

-- ─ exercise_results (migration 027 non appliquée) ─────────────────────────────
DROP POLICY IF EXISTS "team_exercise_results_select" ON exercise_results;
CREATE POLICY "team_exercise_results_select" ON exercise_results
  FOR SELECT USING (
    athlete_id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id IN (SELECT get_my_team_ids())
    )
  );

-- ─ exercises (migration 027 non appliquée) ────────────────────────────────────
DROP POLICY IF EXISTS "team_exercises_select" ON exercises;
CREATE POLICY "team_exercises_select" ON exercises
  FOR SELECT USING (
    coach_id IN (
      SELECT tm.user_id
      FROM   team_members tm
      WHERE  tm.team_id IN (SELECT get_my_team_ids())
    )
  );
