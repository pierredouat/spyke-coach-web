-- Migration 033 : politique SELECT SaaS sur athlete_maxes
--
-- La politique mobile (034 côté mobile) n'autorise la lecture qu'à
-- l'athlète lui-même ou via is_coach_of() (coach_id direct).
-- Côté SaaS, tout membre du staff de l'équipe doit pouvoir lire les maxes
-- pour afficher l'aperçu de charge dans SessionModal.
-- Pattern get_my_team_ids() cohérent avec les autres policies SaaS.

CREATE POLICY "athlete_maxes_team_select"
  ON athlete_maxes
  FOR SELECT
  USING (
    athlete_id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id IN (SELECT get_my_team_ids())
    )
  );
