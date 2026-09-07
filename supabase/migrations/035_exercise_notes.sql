-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 035 — Notes coach sur l'efficacité des exercices
-- ══════════════════════════════════════════════════════════════════════════════
-- coach_id    : auteur de la note (membre du staff)
-- exercise_id : FK vers la banque d'exercices partagée
-- athlete_id  : NULL = note générale (groupe/équipe)
--               non-NULL = note propre à cet athlète
-- worked      : true = a fonctionné, false = n'a pas fonctionné
-- comment     : texte libre d'observation
--
-- RLS :
--   SELECT : tout le staff de l'équipe peut lire les notes de ses collègues
--            (coach_id ∈ team_members de mes équipes)
--   INSERT : uniquement si coach_id = auth.uid() (on ne peut écrire qu'en son nom)
--   UPDATE / DELETE : auteur seulement
--   Aucune policy athlète → table invisible côté athlète
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE exercise_notes (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id    uuid        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  exercise_id uuid        NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  athlete_id  uuid                 REFERENCES profiles(id)  ON DELETE SET NULL,
  worked      boolean     NOT NULL,
  comment     text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exercise_notes_exercise_id_idx ON exercise_notes (exercise_id);
CREATE INDEX exercise_notes_coach_id_idx    ON exercise_notes (coach_id);

ALTER TABLE exercise_notes ENABLE ROW LEVEL SECURITY;

-- Lecture : tout le staff de l'équipe
CREATE POLICY "ex_notes_select" ON exercise_notes
  FOR SELECT USING (
    coach_id IN (
      SELECT tm.user_id
      FROM   team_members tm
      WHERE  tm.team_id IN (SELECT get_my_team_ids())
    )
  );

-- Insertion : staff uniquement, en son propre nom
CREATE POLICY "ex_notes_insert" ON exercise_notes
  FOR INSERT WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Modification : auteur seulement
CREATE POLICY "ex_notes_update" ON exercise_notes
  FOR UPDATE USING (coach_id = auth.uid());

-- Suppression : auteur seulement
CREATE POLICY "ex_notes_delete" ON exercise_notes
  FOR DELETE USING (coach_id = auth.uid());
