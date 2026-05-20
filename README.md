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
- La sauvegarde est locale (localStorage). Vider le cache du navigateur = perdre la partie.

## Stack

TypeScript + Phaser 3 + Vite + Vitest.
