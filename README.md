# Village Sim

Animation détente de village pixel-art top-down, à laisser tourner sur second écran. Une action par matin fait évoluer le village.

## Démarrage

```bash
npm install
npm run dev
```

Ouvre http://localhost:5173.

## Scripts

- `npm run dev` — Vite HMR
- `npm run build` — bundle statique `dist/`
- `npm run preview` — sert le build
- `npm run test` — Vitest watch
- `npm run test:run` — Vitest run-once
- `npm run lint` — ESLint

## Fonctionnement

- Le temps de la simulation suit l'heure locale (1 min IRL = 1 min sim).
- Chaque matin (≥ 06:00, heure locale), une nouvelle carte d'action est disponible : choisis 1 carte parmi 3 pour faire évoluer ton village.
- Si tu loupes un matin, le village vit normalement mais ne progresse pas ce jour-là.
- Les saisons défilent toutes les 30 jours IRL (printemps → été → automne → hiver).
- La sauvegarde est locale (localStorage) et fonctionne hors-ligne.
- Avec un compte (optionnel), les données sont synchronisées via Supabase entre appareils. Voir `supabase/schema.sql` et `.env.example` pour la configuration.

## Stack

TypeScript + Phaser 4 + Vite + Vitest. Synchronisation optionnelle via Supabase.

## Edge function `delete-account`

Suppression de compte. Déployer une fois le projet Supabase configuré :

```bash
supabase functions deploy delete-account
```

Le runtime injecte automatiquement `SUPABASE_URL`, `SUPABASE_ANON_KEY` et
`SUPABASE_SERVICE_ROLE_KEY` — aucun secret à définir manuellement.
