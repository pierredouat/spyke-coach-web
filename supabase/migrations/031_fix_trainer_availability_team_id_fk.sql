-- Migration 031 : corrige team_id sur trainer_availability
--
-- Contexte : le schéma mobile définissait team_id REFERENCES profiles(id) (convention
-- où team_id = profile du coach propriétaire côté mobile).
-- Côté SaaS, team_id doit référencer teams(id) — la table équipe réelle exposée par AuthContext.
-- Le bug : TrainerPage.tsx insérait user.id (profile du trainer) au lieu de team.id.
-- Cette migration (a) change la FK, (b) corrige les lignes existantes via team_members.

-- 1. Supprimer la FK mobile (profiles)
ALTER TABLE trainer_availability
  DROP CONSTRAINT IF EXISTS trainer_availability_team_id_fkey;

-- 2. Corriger les lignes dont team_id = trainer_id (données erronées)
--    On résout le bon team_id via team_members (trainer appartient à l'équipe)
UPDATE trainer_availability ta
SET    team_id = tm.team_id
FROM   team_members tm
WHERE  ta.trainer_id = tm.user_id
  AND  ta.team_id    = ta.trainer_id;

-- 3. Ajouter la nouvelle FK SaaS (teams)
ALTER TABLE trainer_availability
  ADD CONSTRAINT trainer_availability_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
