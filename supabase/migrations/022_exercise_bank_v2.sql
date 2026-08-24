-- ══════════════════════════════════════════════════════════════
-- Migration 022 — Banque d'exercices v2 : familles + seed générique
-- ══════════════════════════════════════════════════════════════
-- ⚠ Compatible avec les données existantes : nouvelles colonnes
--   nullable, aucune modification des RLS existantes.

-- 1. Nouveaux types enum
-- ──────────────────────────────────────────────────────────────
create type exercise_family_enum as enum (
  'discipline',
  'musculation',
  'plyometrie',
  'gainage_prehab',
  'cardio_aerobie'
);

-- Groupes spécifiques aux exercices (étend les disciplines athlètes + haies)
create type exercise_discipline_group_enum as enum (
  'sprint', 'sauts', 'lancers', 'demi_fond', 'haies', 'combines', 'marche'
);

create type musculation_cycle_enum as enum (
  'force', 'puissance', 'vitesse', 'hypertrophie'
);

-- 2. Nouvelles colonnes sur exercises
-- ──────────────────────────────────────────────────────────────
alter table exercises
  add column family            exercise_family_enum,
  add column discipline_group  exercise_discipline_group_enum,
  add column musculation_cycle musculation_cycle_enum;

-- 3. Seed — bibliothèque générique (coach_id = null)
-- ──────────────────────────────────────────────────────────────
insert into exercises (name, family, musculation_cycle, discipline_group, default_unit) values

  -- Musculation — Force
  ('Squat',                 'musculation', 'force',     null,      'kg'),
  ('Soulevé de terre',      'musculation', 'force',     null,      'kg'),
  ('Développé couché',      'musculation', 'force',     null,      'kg'),
  ('Tirage horizontal',     'musculation', 'force',     null,      'kg'),

  -- Musculation — Puissance
  ('Arraché',               'musculation', 'puissance', null,      'kg'),
  ('Épaulé-jeté',           'musculation', 'puissance', null,      'kg'),
  ('Squat jump chargé',     'musculation', 'puissance', null,      'kg'),
  ('Développé explosif',    'musculation', 'puissance', null,      'kg'),

  -- Musculation — Vitesse
  ('Squat léger rapide',    'musculation', 'vitesse',   null,      'reps'),

  -- Plyométrie
  ('Bondissements',         'plyometrie',  null,        null,      'reps'),
  ('Foulées bondissantes',  'plyometrie',  null,        null,      'm'),
  ('Multibonds',            'plyometrie',  null,        null,      'm'),
  ('Drop jump',             'plyometrie',  null,        null,      'reps'),
  ('Squat jump',            'plyometrie',  null,        null,      'reps'),
  ('Skipping genoux hauts', 'plyometrie',  null,        null,      'reps'),

  -- Discipline — Sprint
  ('Départs blocks',        'discipline',  null,        'sprint',  's'),
  ('Lignes droites',        'discipline',  null,        'sprint',  's'),
  ('Sprint résisté',        'discipline',  null,        'sprint',  's'),

  -- Discipline — Haies
  ('Franchissement haies',  'discipline',  null,        'haies',   'reps'),
  ('Rythme inter-haies',    'discipline',  null,        'haies',   'reps'),

  -- Discipline — Sauts
  ('Course d''élan longueur','discipline', null,        'sauts',   'm'),
  ('Appel-saut hauteur',    'discipline',  null,        'sauts',   'm'),
  ('Technique perche',      'discipline',  null,        'sauts',   'reps'),

  -- Discipline — Lancers
  ('Lancer poids rotation', 'discipline',  null,        'lancers', 'm'),
  ('Technique disque',      'discipline',  null,        'lancers', 'reps'),
  ('Technique javelot',     'discipline',  null,        'lancers', 'm'),

  -- Gainage / Préhab
  ('Gainage dynamique',     'gainage_prehab', null,     null,      's'),
  ('Gainage statique',      'gainage_prehab', null,     null,      's'),
  ('Renforcement chevilles','gainage_prehab', null,     null,      'reps'),
  ('Mobilité hanches',      'gainage_prehab', null,     null,      'reps'),

  -- Cardio / Aérobie
  ('Footing',               'cardio_aerobie', null,     null,      'm'),
  ('Fartlek',               'cardio_aerobie', null,     null,      's'),
  ('Course continue',       'cardio_aerobie', null,     null,      'm')

on conflict do nothing;
