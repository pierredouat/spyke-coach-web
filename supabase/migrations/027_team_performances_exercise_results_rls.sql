-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 027 — RLS performances + exercise_results + exercises : accès équipe
-- ══════════════════════════════════════════════════════════════════════════════
-- Contexte : ces tables utilisent is_coach_of() qui ne couvre que le coach_id
-- direct. Les autres membres staff (assistant_coach, etc.) et le head_coach
-- sur le nouveau modèle team_id ne peuvent pas lire les données.
-- Solution : trois politiques permissives supplémentaires (OR logic entre policies).
-- ══════════════════════════════════════════════════════════════════════════════

-- performances : tout membre staff peut lire les perfs des athlètes de l'équipe
CREATE POLICY "team_performances_select" ON performances
  FOR SELECT USING (
    athlete_id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id IN (SELECT get_my_team_ids())
    )
  );

-- exercise_results : tout membre staff peut lire les résultats des athlètes de l'équipe
CREATE POLICY "team_exercise_results_select" ON exercise_results
  FOR SELECT USING (
    athlete_id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id IN (SELECT get_my_team_ids())
    )
  );

-- exercises : tout membre staff peut lire les exercices créés par les membres de l'équipe
-- (nécessaire pour la jointure exercise_results → exercises dans les graphiques)
CREATE POLICY "team_exercises_select" ON exercises
  FOR SELECT USING (
    coach_id IN (
      SELECT tm.user_id
      FROM   team_members tm
      WHERE  tm.team_id IN (SELECT get_my_team_ids())
    )
  );
