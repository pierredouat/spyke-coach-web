-- Migration 032 : bucket team-logos + RLS Storage
--
-- Pattern : helper SECURITY DEFINER (cohérent avec get_my_team_ids()) pour
-- éviter la répétition d'un sous-select imbriqué dans chaque policy.
-- Convention de chemin : {team_id}/{timestamp}.{ext}
-- Lecture publique sans auth ; écriture réservée au head_coach de l'équipe.

-- ── 1. Fonction helper ────────────────────────────────────────────────────────
-- Vérifie que auth.uid() est head_coach de l'équipe dont l'id est le premier
-- segment du chemin d'un objet Storage (ex. "{team_id}/1234567890.png").
-- SECURITY DEFINER : contourne la RLS de team_members (même raison que
-- get_my_team_ids). search_path figé pour éviter l'injection de schéma.

CREATE OR REPLACE FUNCTION public.is_head_coach_of_team_path(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   team_members
    WHERE  user_id = auth.uid()
      AND  team_id = split_part(object_name, '/', 1)::uuid
      AND  role    = 'head_coach'
  )
$$;

-- ── 2. Bucket ─────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team-logos',
  'team-logos',
  true,
  2097152,
  '{image/jpeg,image/png,image/gif,image/webp,image/svg+xml}'
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Policies Storage ───────────────────────────────────────────────────────

CREATE POLICY "team_logos_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'team-logos');

CREATE POLICY "team_logos_head_coach_insert"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'team-logos'
    AND public.is_head_coach_of_team_path(name)
  );

CREATE POLICY "team_logos_head_coach_update"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'team-logos'
    AND public.is_head_coach_of_team_path(name)
  );

CREATE POLICY "team_logos_head_coach_delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'team-logos'
    AND public.is_head_coach_of_team_path(name)
  );
