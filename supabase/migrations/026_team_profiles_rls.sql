-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 026 — RLS profiles : accès équipe
-- ══════════════════════════════════════════════════════════════════════════════
-- Contexte : la table profiles (migration mobile 002) n'autorisait que
--   id = auth.uid()  |  is_coach_of(id)  |  is_athlete_of(id)
-- Lacunes avec le modèle team_id :
--   • Un staff member ne peut pas lire le profil d'un autre membre du staff
--     (pas de relation coach_athlete_relationships entre eux)
--   • Un assistant_coach ne peut pas lire les profils des athlètes de l'équipe
--     car il n'est pas le coach_id de la relation (is_coach_of retourne FALSE)
--   • is_coach_of requiert status = 'active' → les athlètes 'pending'
--     sont illisibles même pour le head_coach
-- Solution : deux politiques permissives supplémentaires (OR logic entre policies)
-- ══════════════════════════════════════════════════════════════════════════════

-- Tout membre d'une équipe peut lire le profil des autres membres du staff
CREATE POLICY "team_staff_profiles_select" ON profiles
  FOR SELECT USING (
    id IN (
      SELECT tm.user_id
      FROM   team_members tm
      WHERE  tm.team_id IN (SELECT get_my_team_ids())
    )
  );

-- Tout membre d'une équipe peut lire les profils des athlètes de l'équipe
-- (couvre pending ET active, couvre tous les rôles staff)
CREATE POLICY "team_athlete_profiles_select" ON profiles
  FOR SELECT USING (
    id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id IN (SELECT get_my_team_ids())
    )
  );
