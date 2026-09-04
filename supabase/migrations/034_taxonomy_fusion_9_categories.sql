-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 034 — Fusion taxonomie exercices : 9 catégories finales
-- ══════════════════════════════════════════════════════════════════════════════
-- Catégories finales :
--   musculation · explosif · pliometrie · gainage · mobilite
--   vitesse · coordination · discipline · cardio_aerobie
--
-- Contenu :
--   Étape 1 — Extension de exercise_family_enum (ALTER TYPE séparés)
--   Étape 2 — Réaffectations confirmées (Arraché, Épaulé-jeté, éducatifs sprint)
--   Étape 3 — Triage des 17 exercices gainage_prehab
--   Étape 4 — Synchronisation bidirectionnelle family ↔ category
--
-- ⚠  Les ALTER TYPE sont placés EN PREMIER.
--    Sur Supabase (PG 15), ADD VALUE + UPDATE dans la même transaction fonctionne.
--    Si le moteur refuse (rare), appliquer manuellement les 6 lignes ALTER TYPE
--    d'abord, puis ré-appliquer la migration complète (les ADD VALUE IF NOT EXISTS
--    seront silencieusement ignorés).
-- ══════════════════════════════════════════════════════════════════════════════


-- ── Étape 1 : extension de exercise_family_enum ──────────────────────────────
-- Chaque instruction est séparée — ne pas combiner.

-- Renommage : les lignes exercises.family = 'plyometrie' passent automatiquement
-- à 'pliometrie' sans UPDATE manuel (PostgreSQL met à jour le catalogue).
ALTER TYPE exercise_family_enum RENAME VALUE 'plyometrie' TO 'pliometrie';

ALTER TYPE exercise_family_enum ADD VALUE IF NOT EXISTS 'explosif';

ALTER TYPE exercise_family_enum ADD VALUE IF NOT EXISTS 'gainage';

ALTER TYPE exercise_family_enum ADD VALUE IF NOT EXISTS 'mobilite';

ALTER TYPE exercise_family_enum ADD VALUE IF NOT EXISTS 'vitesse';

ALTER TYPE exercise_family_enum ADD VALUE IF NOT EXISTS 'coordination';

-- Note : 'gainage_prehab' reste présent dans l'enum après cette migration
-- (impossible de supprimer une valeur d'enum en PG sans recréer le type).
-- Après l'étape 3, aucune ligne ne l'utilise plus — valeur morte, sans impact.


-- ── Étape 2 : réaffectations confirmées ──────────────────────────────────────

-- Arraché + Épaulé-jeté : musculation/puissance → explosif
-- musculation_cycle = NULL (sans sens sémantique hors de la famille musculation)
UPDATE exercises
SET    family            = 'explosif',
       musculation_cycle = NULL
WHERE  coach_id IS NULL
  AND  lower(name) IN ('arraché', 'épaulé-jeté');

-- Départs blocks + Lignes droites + Sprint résisté : discipline/sprint → vitesse
-- discipline_group = NULL (sans sens hors de la famille discipline)
UPDATE exercises
SET    family           = 'vitesse',
       discipline_group = NULL
WHERE  coach_id IS NULL
  AND  lower(name) IN ('départs blocks', 'lignes droites', 'sprint résisté');


-- ── Étape 3 : triage des 17 exercices gainage_prehab ─────────────────────────
-- Filtre family = 'gainage_prehab' ajouté pour éviter tout effet de bord.

-- musculation (6) — renforcement fonctionnel chargé ou unilatéral lourd
-- Inclut 'Renforcement ischios (nordic curl)' (force excentrique élevée)
UPDATE exercises
SET    family = 'musculation'
WHERE  coach_id IS NULL
  AND  family  = 'gainage_prehab'
  AND  lower(name) IN (
    'squat bulgare (unilatéral)',
    'fentes avant unilatérales',
    'hip thrust unilatéral',
    'élévations mollets unilatérales',
    'renforcement ischios (nordic curl)',
    'marche en fentes contrôlée'
  );

-- gainage (6) — préhabilitation, activation neuromusculaire, proprioception
-- Inclut 'Renforcement excentrique ischios' (réathlétisation, distinct du nordic curl)
UPDATE exercises
SET    family = 'gainage'
WHERE  coach_id IS NULL
  AND  family  = 'gainage_prehab'
  AND  lower(name) IN (
    'gainage dynamique',
    'gainage statique',
    'renforcement chevilles',
    'travail proprioception cheville',
    'renforcement excentrique ischios',
    'réveil musculaire genou'
  );

-- mobilite (5) — étirements et mobilité articulaire
UPDATE exercises
SET    family = 'mobilite'
WHERE  coach_id IS NULL
  AND  family  = 'gainage_prehab'
  AND  lower(name) IN (
    'mobilité hanches',
    'mobilité chevilles',
    'mobilité hanches (90/90)',
    'mobilité thoracique',
    'étirements dynamiques pré-séance'
  );


-- ── Étape 4 : synchronisation bidirectionnelle family ↔ category ─────────────

-- 4a : aligner category sur family pour tout exercice avec family renseigné
--      Couvre : SaaS génériques, exercices coach, et les lignes qu'on vient de mettre à jour.
UPDATE exercises
SET    category = family::text
WHERE  family IS NOT NULL
  AND  (category IS NULL OR category IS DISTINCT FROM family::text);

-- 4b : pour les exercices mobiles (family IS NULL, category renseignée),
--      déduire family depuis category — seules les 9 valeurs finales de l'enum sont acceptées.
UPDATE exercises
SET    family = category::exercise_family_enum
WHERE  family IS NULL
  AND  category IN (
         'musculation', 'explosif', 'pliometrie', 'gainage',
         'mobilite',    'vitesse',  'coordination',
         'discipline',  'cardio_aerobie'
       );

-- 4c : aligner category sur le family nouvellement déduit (exercices mobiles qui avaient
--      family NULL — après 4b ils ont family, mais category peut différer légèrement)
UPDATE exercises
SET    category = family::text
WHERE  family IS NOT NULL
  AND  (category IS NULL OR category IS DISTINCT FROM family::text);
