-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 025 — Entité Organisation/Équipe avec rôles staff différenciés
-- ══════════════════════════════════════════════════════════════════════════════
-- Nouveaux objets : staff_role enum, teams, team_members, team_invitations
-- Modification   : coach_athlete_relationships + team_id (FK auto-remplie)
-- Backward compat: coach_id conservé sur sessions et coach_athlete_relationships
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Enum staff_role ────────────────────────────────────────────────────────
CREATE TYPE staff_role AS ENUM (
  'head_coach',
  'assistant_coach',
  'strength_coach',
  'trainer'
);

-- ── 2. Table teams ────────────────────────────────────────────────────────────
CREATE TABLE teams (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  university_name text,
  logo_url        text,
  primary_color   text        NOT NULL DEFAULT '#3743BA',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Table team_members ─────────────────────────────────────────────────────
CREATE TABLE team_members (
  team_id    uuid        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       staff_role  NOT NULL DEFAULT 'assistant_coach',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- ── 4. Table team_invitations ─────────────────────────────────────────────────
CREATE TABLE team_invitations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role       staff_role  NOT NULL DEFAULT 'assistant_coach',
  code       text        NOT NULL UNIQUE,
  created_by uuid        NOT NULL REFERENCES profiles(id),
  used_by    uuid        REFERENCES profiles(id),
  used_at    timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 5. team_id sur coach_athlete_relationships ────────────────────────────────
ALTER TABLE coach_athlete_relationships
  ADD COLUMN team_id uuid REFERENCES teams(id);

-- ── 6. Fonction helper SECURITY DEFINER (évite la récursion RLS) ──────────────
CREATE OR REPLACE FUNCTION get_my_team_ids()
RETURNS uuid[] AS $$
  SELECT COALESCE(ARRAY(
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ), '{}')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 7. Migration des données existantes ───────────────────────────────────────
DO $$
DECLARE
  r          RECORD;
  new_tid    uuid;
  coach_name text;
BEGIN
  -- Crée une équipe pour chaque coach ayant des relations existantes
  FOR r IN
    SELECT DISTINCT car.coach_id,
                    p.first_name, p.last_name, p.club
    FROM   coach_athlete_relationships car
    JOIN   profiles p ON p.id = car.coach_id
  LOOP
    coach_name := NULLIF(
      TRIM(COALESCE(r.first_name, '') || ' ' || COALESCE(r.last_name, '')), '');

    INSERT INTO teams (name, university_name)
    VALUES (COALESCE(coach_name, 'Mon équipe'), r.club)
    RETURNING id INTO new_tid;

    INSERT INTO team_members (team_id, user_id, role)
    VALUES (new_tid, r.coach_id, 'head_coach');

    UPDATE coach_athlete_relationships
    SET    team_id = new_tid
    WHERE  coach_id = r.coach_id;
  END LOOP;

  -- Crée une équipe pour les coachs sans aucune relation
  FOR r IN
    SELECT p.id, p.first_name, p.last_name, p.club
    FROM   profiles p
    WHERE  p.role = 'coach'
    AND    NOT EXISTS (
      SELECT 1 FROM team_members tm WHERE tm.user_id = p.id
    )
  LOOP
    coach_name := NULLIF(
      TRIM(COALESCE(r.first_name, '') || ' ' || COALESCE(r.last_name, '')), '');

    INSERT INTO teams (name, university_name)
    VALUES (COALESCE(coach_name, 'Mon équipe'), r.club)
    RETURNING id INTO new_tid;

    INSERT INTO team_members (team_id, user_id, role)
    VALUES (new_tid, r.id, 'head_coach');
  END LOOP;
END $$;

-- ── 8. Trigger : auto-fill team_id quand le mobile crée une relation ──────────
-- Le mobile pose coach_id sans team_id ; le trigger le résout automatiquement.
CREATE OR REPLACE FUNCTION fill_team_id_on_relationship()
RETURNS TRIGGER AS $$
DECLARE
  v_team_id uuid;
BEGIN
  IF NEW.team_id IS NULL AND NEW.coach_id IS NOT NULL THEN
    SELECT tm.team_id INTO v_team_id
    FROM   team_members tm
    WHERE  tm.user_id = NEW.coach_id
      AND  tm.role    = 'head_coach'
    LIMIT  1;

    IF FOUND THEN
      NEW.team_id := v_team_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fill_team_id
  BEFORE INSERT OR UPDATE ON coach_athlete_relationships
  FOR EACH ROW
  EXECUTE FUNCTION fill_team_id_on_relationship();

-- ── 9. Trigger : crée une équipe quand un coach termine l'onboarding ──────────
CREATE OR REPLACE FUNCTION create_team_for_new_coach()
RETURNS TRIGGER AS $$
DECLARE
  new_tid    uuid;
  coach_name text;
BEGIN
  IF NEW.role = 'coach'
     AND NEW.onboarding_completed = true
     AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.onboarding_completed, false))
  THEN
    -- Ne crée pas si déjà membre d'une équipe (ex. staff rejoignant via code)
    IF NOT EXISTS (SELECT 1 FROM team_members WHERE user_id = NEW.id) THEN
      coach_name := NULLIF(
        TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')), '');

      INSERT INTO teams (name)
      VALUES (COALESCE(coach_name, 'Mon équipe'))
      RETURNING id INTO new_tid;

      INSERT INTO team_members (team_id, user_id, role)
      VALUES (new_tid, NEW.id, 'head_coach');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_team_for_coach
  AFTER INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_team_for_new_coach();

-- ── 10. Fonction RPC : rejoindre une équipe via code d'invitation ──────────────
CREATE OR REPLACE FUNCTION join_team_with_code(p_code text)
RETURNS json AS $$
DECLARE
  v_inv  team_invitations%ROWTYPE;
  v_team teams%ROWTYPE;
BEGIN
  SELECT * INTO v_inv
  FROM   team_invitations
  WHERE  code       = p_code
    AND  used_by    IS NULL
    AND  expires_at > now();

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Code invalide ou expiré');
  END IF;

  IF EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = v_inv.team_id AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('error', 'Vous êtes déjà membre de cette équipe');
  END IF;

  INSERT INTO team_members (team_id, user_id, role)
  VALUES (v_inv.team_id, auth.uid(), v_inv.role);

  UPDATE team_invitations
  SET used_by = auth.uid(), used_at = now()
  WHERE id = v_inv.id;

  SELECT * INTO v_team FROM teams WHERE id = v_inv.team_id;

  RETURN json_build_object(
    'success',   true,
    'team_id',   v_inv.team_id,
    'role',      v_inv.role,
    'team_name', v_team.name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 11. Fonction RPC : valider un code (affiche nom équipe + rôle) ─────────────
CREATE OR REPLACE FUNCTION validate_team_invite_code(p_code text)
RETURNS json AS $$
DECLARE
  v_inv  team_invitations%ROWTYPE;
  v_team teams%ROWTYPE;
BEGIN
  SELECT * INTO v_inv
  FROM   team_invitations
  WHERE  code       = p_code
    AND  used_by    IS NULL
    AND  expires_at > now();

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Code invalide ou expiré');
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = v_inv.team_id;

  RETURN json_build_object(
    'valid',     true,
    'team_name', v_team.name,
    'role',      v_inv.role::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ── 12. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE teams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- teams : lecture par membres, modification par head_coach
CREATE POLICY "team_select" ON teams
  FOR SELECT USING (id = ANY(get_my_team_ids()));

CREATE POLICY "team_update" ON teams
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = teams.id
        AND user_id = auth.uid()
        AND role    = 'head_coach'
    )
  );

-- team_members : lecture par membres de la même équipe
CREATE POLICY "team_members_select" ON team_members
  FOR SELECT USING (team_id = ANY(get_my_team_ids()));

-- team_members : ajout par head_coach uniquement
CREATE POLICY "team_members_insert" ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE  tm.team_id = team_members.team_id
        AND  tm.user_id = auth.uid()
        AND  tm.role    = 'head_coach'
    )
  );

-- team_members : suppression par head_coach (pas soi-même)
CREATE POLICY "team_members_delete" ON team_members
  FOR DELETE USING (
    user_id != auth.uid()
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE  tm.team_id = team_members.team_id
        AND  tm.user_id = auth.uid()
        AND  tm.role    = 'head_coach'
    )
  );

-- team_invitations : lecture par membres de l'équipe
CREATE POLICY "team_inv_select" ON team_invitations
  FOR SELECT USING (team_id = ANY(get_my_team_ids()));

-- team_invitations : création par head_coach
CREATE POLICY "team_inv_insert" ON team_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE  team_id = team_invitations.team_id
        AND  user_id = auth.uid()
        AND  role    = 'head_coach'
    )
  );

-- coach_athlete_relationships : tout membre staff peut lire son roster
CREATE POLICY "team_car_select" ON coach_athlete_relationships
  FOR SELECT USING (
    team_id IS NOT NULL AND team_id = ANY(get_my_team_ids())
  );

-- sessions : tout membre staff peut lire les séances des athlètes de l'équipe
CREATE POLICY "team_sessions_select" ON sessions
  FOR SELECT USING (
    athlete_id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id = ANY(get_my_team_ids())
        AND  car.status  = 'active'
    )
  );

-- sessions : tout membre staff peut créer des séances pour les athlètes de l'équipe
CREATE POLICY "team_sessions_insert" ON sessions
  FOR INSERT WITH CHECK (
    athlete_id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id = ANY(get_my_team_ids())
        AND  car.status  = 'active'
    )
  );

-- sessions : tout membre staff peut modifier les séances de l'équipe
CREATE POLICY "team_sessions_update" ON sessions
  FOR UPDATE USING (
    athlete_id IN (
      SELECT car.athlete_id
      FROM   coach_athlete_relationships car
      WHERE  car.team_id = ANY(get_my_team_ids())
        AND  car.status  = 'active'
    )
  );

-- session_exercises : accès via la session parente (politique permissive)
CREATE POLICY "team_session_exercises_select" ON session_exercises
  FOR SELECT USING (
    session_id IN (
      SELECT s.id FROM sessions s
      WHERE  s.athlete_id IN (
        SELECT car.athlete_id
        FROM   coach_athlete_relationships car
        WHERE  car.team_id = ANY(get_my_team_ids())
          AND  car.status  = 'active'
      )
    )
  );

CREATE POLICY "team_session_exercises_insert" ON session_exercises
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT s.id FROM sessions s
      WHERE  s.athlete_id IN (
        SELECT car.athlete_id
        FROM   coach_athlete_relationships car
        WHERE  car.team_id = ANY(get_my_team_ids())
          AND  car.status  = 'active'
      )
    )
  );

CREATE POLICY "team_session_exercises_update" ON session_exercises
  FOR UPDATE USING (
    session_id IN (
      SELECT s.id FROM sessions s
      WHERE  s.athlete_id IN (
        SELECT car.athlete_id
        FROM   coach_athlete_relationships car
        WHERE  car.team_id = ANY(get_my_team_ids())
          AND  car.status  = 'active'
      )
    )
  );

CREATE POLICY "team_session_exercises_delete" ON session_exercises
  FOR DELETE USING (
    session_id IN (
      SELECT s.id FROM sessions s
      WHERE  s.athlete_id IN (
        SELECT car.athlete_id
        FROM   coach_athlete_relationships car
        WHERE  car.team_id = ANY(get_my_team_ids())
          AND  car.status  = 'active'
      )
    )
  );
