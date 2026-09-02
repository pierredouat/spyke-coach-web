-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 030 — RLS SaaS pour injuries, trainer_availability, appointments
-- ══════════════════════════════════════════════════════════════════════════════
-- Contexte : la migration mobile 022 a créé les tables + RLS avec le modèle
-- mobile (car.coach_id = ANY(ARRAY(SELECT get_my_team_ids()))). Depuis la
-- migration 029, get_my_team_ids() renvoie des teams.id (SaaS), non plus des
-- profiles.id (mobile). Les policies mobiles échouent silencieusement pour le
-- staff SaaS.
-- Solution : ajouter des policies permissives SaaS (OR logic), non conflictuelles
-- avec les policies mobiles existantes.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── injuries : staff SaaS peut lire les blessures des athlètes de l'équipe ──
DROP POLICY IF EXISTS "team_injuries_select" ON injuries;
CREATE POLICY "team_injuries_select" ON injuries
  FOR SELECT USING (
    athlete_id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id IN (SELECT get_my_team_ids())
    )
  );

-- ── trainer_availability : staff SaaS peut lire les créneaux des trainers ───
-- La policy mobile se base sur team_id (= coach_id, profiles.id) qui est
-- incompatible avec get_my_team_ids() SaaS (teams.id). On filtre via team_members.
DROP POLICY IF EXISTS "team_trainer_availability_select" ON trainer_availability;
CREATE POLICY "team_trainer_availability_select" ON trainer_availability
  FOR SELECT USING (
    trainer_id IN (
      SELECT tm.user_id
      FROM   team_members tm
      WHERE  tm.team_id IN (SELECT get_my_team_ids())
    )
  );

-- ── trainer_availability DELETE : absent de la migration mobile, nécessaire ─
-- Un trainer peut supprimer ses propres créneaux libres depuis le SaaS.
DROP POLICY IF EXISTS "team_trainer_availability_delete" ON trainer_availability;
CREATE POLICY "team_trainer_availability_delete" ON trainer_availability
  FOR DELETE USING (
    trainer_id = auth.uid()
    AND is_booked = false
  );

-- ── appointments : staff SaaS peut lire les rdv des athlètes de l'équipe ────
DROP POLICY IF EXISTS "team_appointments_select" ON appointments;
CREATE POLICY "team_appointments_select" ON appointments
  FOR SELECT USING (
    athlete_id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id IN (SELECT get_my_team_ids())
    )
  );
