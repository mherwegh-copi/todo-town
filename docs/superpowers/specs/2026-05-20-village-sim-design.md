# Village Sim — Design Spec

**Date** : 2026-05-20
**Statut** : Approuvé brainstorm, prêt pour planning impl.

## Vision

Animation lente détente à laisser tourner sur second écran. Village vu de haut, style pixel art top-down (esthétique inspirée Minecraft top-down / Stardew Valley). Le temps avance en temps réel (1 min IRL = 1 min sim, comme WoW), cycle jour/nuit calé sur l'heure système. Chaque matin, l'utilisateur fait une petite action stratégique (choisir 1 carte parmi 3) qui fait évoluer le village. Sans pression, sans fin.

## Décisions clés (brainstorm)

| Sujet | Choix |
|---|---|
| Style rendu | 2D pixel art top-down |
| Plateforme | Web app navigateur |
| Action quotidienne | Choix stratégique (carte parmi 3) |
| Reset action | 06:00 heure locale |
| Saisons | Oui, cycle 30 jours IRL = 1 saison |
| Contenu village | Bâtiments + villageois + cultures/nature + météo |
| Progression | Infinie, paliers via Town Hall |
| Assets | Pack pixel art libre (Cute Fantasy / Tiny Swords / Kenney) |
| Interaction hors action | Hover villageois (tooltip), clic bâtiment (info), pan/zoom caméra |
| Persistance | localStorage |
| Stack | Phaser 3 + TypeScript + Vite |
| Carte ratée | Jour neutre, village vit mais pas de progression |

## Architecture

Stack : **Phaser 3** (rendu, scenes, tilemap) + **TypeScript** + **Vite** (dev + build statique).

Séparation stricte :

- **Domain** : types immuables + fonctions pures `(state, event) → newState`
- **Systems** : logique pure (clock, season, AI, weather, daily action, progression, save). Sans dépendance Phaser. Testable en isolation.
- **Scenes** : couche rendu Phaser. Lisent état, projettent en sprites.
- **UI** : overlay (UIScene) pour horloge, action, tooltips, cartes.

```
src/
├─ main.ts                # bootstrap Phaser
├─ config.ts              # constantes (tileSize, mapSize)
├─ scenes/
│  ├─ BootScene.ts        # charge assets
│  ├─ WorldScene.ts       # rendu monde
│  └─ UIScene.ts          # overlay UI
├─ systems/               # logique pure
│  ├─ clock.ts
│  ├─ season.ts
│  ├─ villagerAI.ts
│  ├─ weather.ts
│  ├─ dailyAction.ts
│  ├─ progression.ts
│  └─ save.ts
├─ domain/
│  ├─ state.ts
│  ├─ world.ts
│  ├─ villager.ts
│  ├─ building.ts
│  └─ crop.ts
├─ cards/
│  ├─ types.ts
│  └─ deck.ts
├─ rendering/             # helpers Phaser
└─ ui/                    # widgets UI
```

## Modèle données

État sérialisable JSON, immutable. Updates produisent nouvelle copie (spread ou Immer).

```ts
type GameState = {
  version: number;             // pour migrations futures
  createdAt: number;           // epoch ms
  lastSeenAt: number;          // dernier tick traité
  lastActionDate: string;      // "YYYY-MM-DD"
  seed: number;                // RNG déterministe
  world: {
    width: number; height: number;
    tiles: Tile[];
    buildings: Building[];
    crops: Crop[];
    villagers: Villager[];
  };
  progression: {
    day: number;
    townHallLevel: number;
    unlockedCards: string[];
  };
};

type Villager = {
  id: string; name: string;
  homeId: string;
  workplaceId?: string;
  pos: { x: number; y: number };
  schedule: ScheduleEntry[];
  spriteVariant: number;
};

type Building = {
  id: string; kind: BuildingKind;
  tileX: number; tileY: number;
  builtAt: number;
};

type Crop = {
  id: string; kind: CropKind;
  tileX: number; tileY: number;
  plantedAt: number;
  stage: 0 | 1 | 2 | 3;        // dérivé age + saison
};
```

État dérivé (non stocké) :

- Position villageois à un instant t = `f(schedule, heure)`
- Stade culture = `f(plantedAt, saison, age)`
- Météo du jour = `f(seed, day)` déterministe

Carte initiale : 32×32 tuiles, tile 16px, scale 2x (1024×1024 affichage).

## Temps + simulation

- **Source** : `Date.now()` (heure système). Pas d'horloge interne.
- **Mapping** : 1 min IRL = 1 min sim. Heure village = heure locale.
- **Jour/nuit visuel** : lever ~06:00, coucher ~20:00, ajusté légèrement selon saison.
- **Saison** : `floor(day / 30) % 4` → printemps / été / automne / hiver.
- **Phaser update** : 60fps pour anims sprites.
- **Sim tick** : 1 sec sim → recalcule villageois, cultures, événements ambiants.
- **Catch-up offline** : au reload, calcule jours écoulés, applique progression saisonnière. États dérivés du temps → recalcul instantané, pas de rejeu tick par tick. Plafond 30 jours (au-delà : snap final).
- **Pause rendu** si `document.hidden`. Sim reprend via catch-up au focus.

## Action quotidienne + boucle stratégique

**Déclencheur** : à 06:00 heure locale, nouvelle carte dispo si `today !== lastActionDate`. Icône clignote discrètement coin haut-droit. Clic ouvre overlay : 3 cartes face cachée, joueur choisit 1.

**Carte ratée** : pas d'action auto. Village vit normalement (anims, saisons, cycle jour/nuit) mais aucune nouvelle construction/recrutement ce jour-là.

**Town Hall = cœur progression**

Bâtiment central, niveau 1→N. Détermine le palier (tier), filtre les cartes dispo dans le deck. Pour monter de niveau : remplir conditions (ex. *3 maisons + 5 villageois employés + 1 saison écoulée*). Anim visible : Town Hall s'agrandit/embellit à chaque niveau.

**Ressources d'état stratégiques** (compteurs dérivés, pas de currency complexe) :

```
populationHoused   = capacité totale maisons
populationCurrent  = villageois actifs
populationFree     = sans emploi assigné
buildingsIdle      = bâtiments sans worker
foodProduction     = champs actifs × rendement saison
townHallLevel
```

**Typologie de cartes** :

| Catégorie | Effet | Prérequis typique |
|---|---|---|
| Habitation | +capacité population | place libre sur carte |
| Travail (forge, moulin, ferme) | crée slot job | nécessite worker assigné post-construction |
| Recrutement | +1 villageois | place maison libre |
| Assignation | déplace villageois libre → bâtiment idle | les 2 existent |
| Infrastructure (puits, route, place) | débloque expansion | palier Town Hall |
| Upgrade Town Hall | +1 niveau, +cartes deck | conditions remplies |
| Événement (festival, marché) | boost moral/production temporaire | conditions souples |

**Modèle carte** :

```ts
type ActionCard = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: CardCategory;
  minTier: number;
  weight: number;
  isAvailable: (state: GameState) => boolean;
  effect: (state: GameState) => GameState;
};
```

**Tirage** : 3 cartes aléatoires du deck filtré par `townHallLevel` et `isAvailable(state)`. Pondération adaptative : si `buildingsIdle > 0`, poids cartes *recrutement / assignation* augmenté. Carte choisie appliquée, autres défaussées.

**Tension stratégique** : bâtir sans villageois → bâtiment idle (fenêtres éteintes la nuit). Recruter sans maison → carte filtrée hors deck. Joueur doit équilibrer construction / population / assignation pour débloquer paliers Town Hall.

**Feedback visuel oisif** : villageois sans job errent / animations distinctes. Bâtiments idle = fenêtres éteintes nuit. Pas d'UI lourde, juste lecture visuelle.

**Animation effet carte** : bâtiment apparaît avec effet pop. Villageois recruté arrive en marchant depuis bord de carte.

## Rendu visuel + assets

**Pack assets** (choix final à l'impl) :

- *Cute Fantasy* (LucasNogueira, itch.io) — 16px, villageois + bâtiments médiévaux
- *Tiny Swords* (Pixel Frog) — sprites animés
- Fallback : Kenney *Tiny Town* (CC0)

Design assume tile 16px, scale 2x.

**Couches de rendu** (back → front) :

1. Terrain (tilemap statique)
2. Cultures + nature (sprites par stade)
3. Bâtiments (sprites multi-tuiles, ombre portée)
4. Personnages (villageois animés, Y-sort pour profondeur)
5. Météo (particules pluie/neige)
6. Lumière jour/nuit (overlay teinte chaud/froid + transitions blue hour, fenêtres éclairées la nuit)
7. UI overlay (UIScene)

**Caméra** : centrée Town Hall au départ. Pan via drag souris, zoom molette (clamp 1x–3x).

**Animations ambiance** : marche villageois (4 frames), sway arbres, fumée cheminée maisons habitées, eau scintillante, particules saisonnières (feuilles automne, neige hiver, pollen printemps).

**Perf cible** : 60fps stable, <30% CPU laptop moyen. Pause rendu si onglet hidden.

## Interaction utilisateur

- **Matin** : clic icône action → overlay 3 cartes → choix.
- **Hover villageois** : tooltip avec nom + tâche courante.
- **Clic bâtiment** : info card latérale (type, occupants, état).
- **Pan/zoom caméra** : drag + molette.
- Pas d'autres interactions au MVP.

## Persistance

- **localStorage** unique source de vérité. Clé `village-sim/state/v1`.
- Sérialisation JSON complète du `GameState` à chaque modification significative (carte appliquée, fin de journée).
- Migration via champ `version`. Au load, si version inférieure → fonction migration vers version courante.
- Erreur parse → fallback état initial + alerte console.

## Tests

- **Unit (Vitest)** : fonctions pures domain + systems. Cible 80%+ couverture sur `domain/` et `systems/`.
  - `applyCard(state, card)` produit état attendu
  - `seasonForDay(45) === 'summer'`
  - `villagerPositionAt(v, time)` déterministe
  - Migration save v1 → v2 préserve données
- **Integration** : scénario boucle 30 jours, applique cartes successives, vérifie invariants (pas de villageois orphelin, pas de double-assignation, Town Hall progresse selon conditions).
- **Pas de E2E Phaser** au MVP (couvert manuellement).

**TDD** : pour chaque carte ajoutée et chaque système, test fonction pure avant impl.

## Dev workflow

```
npm run dev      # Vite HMR
npm run test     # Vitest watch
npm run build    # bundle statique dist/
npm run lint     # ESLint + Prettier
```

Déploiement : ouvrir `dist/index.html` ou servir via `npx serve dist/` sur écran 2.

## Gestion erreurs

- Save corrompu (JSON.parse fail) → fallback état initial + alerte console.
- Asset manquant → placeholder sprite rose visible (debug).
- Catch-up offline borné à 30 jours (au-delà : snap, évite freeze).
- Pas d'autre erreur critique attendue (app locale, pas de réseau au MVP).

## Hors scope MVP

- Animaux (poules, vaches, chats)
- PNJ voyageurs (marchand)
- Backend cloud / sync multi-device
- Audio (musique ambiante, SFX)
- Easter eggs interactions (clic arbre = secoue)
- Export/import save JSON
- E2E tests Phaser

À reconsidérer post-MVP selon retours d'usage.
