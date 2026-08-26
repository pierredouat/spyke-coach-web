-- ══════════════════════════════════════════════════════════════
-- Migration 024 — Banque d'exercices : renforcement, réathlétisation, mobilité
-- ══════════════════════════════════════════════════════════════
insert into exercises (name, family, default_unit) values

  -- Renforcement unilatéral / gainage_prehab
  ('Squat bulgare (unilatéral)',          'gainage_prehab', 'reps'),
  ('Fentes avant unilatérales',           'gainage_prehab', 'reps'),
  ('Hip thrust unilatéral',               'gainage_prehab', 'reps'),
  ('Élévations mollets unilatérales',     'gainage_prehab', 'reps'),
  ('Renforcement ischios (nordic curl)',   'gainage_prehab', 'reps'),

  -- Réathlétisation
  ('Travail proprioception cheville',     'gainage_prehab', 's'),
  ('Renforcement excentrique ischios',    'gainage_prehab', 'reps'),
  ('Réveil musculaire genou',             'gainage_prehab', 'reps'),
  ('Marche en fentes contrôlée',          'gainage_prehab', 'm'),

  -- Mobilité
  ('Mobilité chevilles',                  'gainage_prehab', 'reps'),
  ('Mobilité hanches (90/90)',            'gainage_prehab', 's'),
  ('Mobilité thoracique',                 'gainage_prehab', 'reps'),
  ('Étirements dynamiques pré-séance',   'gainage_prehab', 'reps')

on conflict do nothing;
