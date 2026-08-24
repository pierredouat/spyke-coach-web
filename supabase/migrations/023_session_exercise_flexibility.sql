-- ══════════════════════════════════════════════════════════════
-- Migration 023 — session_exercises : intention + technical_notes
-- ══════════════════════════════════════════════════════════════
-- Deux champs texte libres, nullable, sans impact sur les RLS
-- ni sur les données existantes.

alter table session_exercises
  add column if not exists intention       text,
  add column if not exists technical_notes text;
