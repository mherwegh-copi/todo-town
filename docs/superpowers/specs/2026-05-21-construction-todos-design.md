# Design — Construction du village pilotée par les todos

Date : 2026-05-21
Branche : `feat/MH/mon-compte` (point de départ ; la feature aura sa propre branche)

## Contexte

Aujourd'hui, le lien entre les todos et la ville passe par la **motivation** :
fermer un todo fait `motivation +1`, décocher `-1`, la motivation décroît de 1
toutes les 12 h, et son seul effet est d'ajouter 0 à 2 cartes au tirage
quotidien (1 tirage/jour à partir de 6 h).

Problèmes identifiés par le propriétaire du projet :

- Lien **trop indirect / invisible** — on ne « voit » pas que fermer un todo
  fait avancer le village.
- La **décroissance punit** — fermer des todos sert surtout à compenser une fuite.
- **Plafond de 1 carte/jour** — au-delà de quelques todos, l'effort
  supplémentaire n'est pas récompensé.
- La motivation **n'est pas une vraie ressource** — elle ne s'accumule ni ne se
  dépense, elle gonfle juste un pool.

Vision cible : *« le village vit, et le joueur en est l'architecte »*. On veut
**voir la progression avancer** quand on ferme des tâches.

## Objectif

Remplacer la motivation par une **ressource de construction visible** qui
s'accumule au fil des todos fermés et débloque des **ouvertures** (propositions
de cartes) :

- une **ouverture garantie chaque matin** ;
- une **ouverture supplémentaire tous les X todos fermés**, X croissant avec la
  progression.

## Mécanique

### Points de construction

Nouvelle ressource `construction.points` (entier) :

- Fermer un todo → **+1 point**.
- Décocher un todo → **−1 point**, plancher à 0.
- **Aucune décroissance** dans le temps.
- Le compteur **persiste** d'un jour à l'autre — c'est un vrai stock.

### Paliers (X croît avec l'hôtel de ville)

Seuil de palier :

```
X(niveau) = CONSTRUCTION_BASE_THRESHOLD + (niveau − 1) × CONSTRUCTION_THRESHOLD_STEP
```

avec `CONSTRUCTION_BASE_THRESHOLD = 3` et `CONSTRUCTION_THRESHOLD_STEP = 2` :

| Niveau hôtel de ville | X (todos par palier) |
|-----------------------|----------------------|
| 1                     | 3                    |
| 2                     | 5                    |
| 3                     | 7                    |
| n                     | 3 + (n−1)×2          |

Conversion : tant que `points ≥ X(niveau)` **et** que la file d'ouvertures
n'est pas pleine → `points −= X(niveau)` et `openings += 1`. Le surplus de
points reste (le palier suivant est déjà entamé).

Si la file est pleine, la conversion est mise en pause : les points continuent
de s'accumuler et se convertiront dès qu'un créneau se libère. Les points ne
sont pas plafonnés ; seul l'affichage borne la barre à X.

### Ouvertures (file + plafond souple)

- **Ouverture du matin** : à la première interaction avec l'app après
  `DAY_START_HOUR` (6 h) un nouveau jour calendaire, `openings += 1` — garantie,
  même sans aucun todo fermé. Tracée par `construction.lastMorningDate`.
- **Ouvertures de palier** : voir ci-dessus, cumulables avec celle du matin.
- File commune, **plafond `OPENINGS_CAP = 5`**. Toute attribution (matin ou
  palier) qui dépasserait 5 est tout simplement retenue. Plusieurs jours
  d'absence → la file se remplit jusqu'à 5, jamais au-delà ; au plus **une seule
  ouverture matin** est rattrapée par session de retour (pas une par jour
  manqué).

### Tirage

- Le bouton d'action est actif **dès que `openings ≥ 1`** (badge = nombre en
  file), au lieu de « 1 fois/jour ».
- Cliquer **consomme une ouverture** (`openings −= 1`), puis lance un tirage de
  cartes : choix d'une carte → placement. La mécanique `CardOverlay` +
  `PlacementController` reste **inchangée**.
- Nombre de cartes proposées :

```
poolSize(niveau) = min(CARDS_MAX, CARDS_BASE + niveau)
```

avec `CARDS_BASE = 2`, `CARDS_MAX = 5` :

| Niveau | Cartes proposées |
|--------|------------------|
| 1      | 3                |
| 2      | 4                |
| 3+     | 5                |

Le filtrage des cartes par `minTier` et `isAvailable` reste inchangé.

### Suppression de la motivation

On retire entièrement :

- champs `motivation` et `motivationLastDecayAt` de `GameState` ;
- la décroissance de motivation dans `catchup` ;
- les constantes `MOTIVATION_*` de `config.ts` ;
- le coût d'action sur la motivation dans `applyChosenCard` ;
- la barre de motivation dans `StatusBar` ;
- `isActionAvailable` (logique 1/jour) — remplacée par « file non vide ».

Le champ `lastActionDate` n'a plus d'utilité (le rythme quotidien passe par
`lastMorningDate`) ; il est supprimé.

## État du jeu

Nouveau bloc dans `GameState` (remplace `motivation` / `motivationLastDecayAt`) :

```ts
readonly construction: {
  readonly points: number;          // points vers le palier courant
  readonly openings: number;        // ouvertures en file (0..OPENINGS_CAP)
  readonly lastMorningDate: string; // dateKey de la dernière ouverture matin
};
```

`emptyState` initialise `{ points: 0, openings: 0, lastMorningDate: '' }`.

## Architecture

### Nouveau module `src/systems/construction.ts`

Fonctions pures, testables isolément :

- `thresholdFor(level: number): number` — calcule X(niveau).
- `poolSizeFor(level: number): number` — calcule le nombre de cartes.
- `addPoints(state, n): GameState` — applique `±n` (plancher 0) puis convertit
  les paliers en ouvertures (plafond `OPENINGS_CAP`).
- `consumeOpening(state): GameState` — `openings −= 1` (n'est appelé que si
  `openings > 0`).
- `grantMorningOpening(state, now): GameState` — si nouveau jour depuis
  `lastMorningDate` et heure ≥ `DAY_START_HOUR`, `openings = min(cap, +1)` et met
  à jour `lastMorningDate`. Idempotent dans la journée.

La conversion de paliers est encapsulée dans `addPoints` ; `consumeOpening`
relance aussi la conversion (un créneau libéré peut absorber des points en
attente).

### Modules modifiés

| Fichier | Changement |
|---------|------------|
| `src/domain/state.ts` | Remplace `motivation`/`motivationLastDecayAt` par `construction` ; met à jour `emptyState`. |
| `src/config.ts` | Supprime `MOTIVATION_*` et `BASE_CARDS_DRAWN` ; ajoute `CONSTRUCTION_BASE_THRESHOLD`, `CONSTRUCTION_THRESHOLD_STEP`, `OPENINGS_CAP`, `CARDS_BASE`, `CARDS_MAX` ; bump `SAVE_VERSION`. |
| `src/systems/dailyAction.ts` | `drawCards` utilise `poolSizeFor(level)` (plus de bonus motivation) ; `applyChosenCard` ne touche plus à la motivation ni à `lastActionDate` ; supprime `isActionAvailable`. |
| `src/systems/catchup.ts` | Supprime la décroissance de motivation ; appelle `grantMorningOpening`. |
| `src/main.ts` | `onToggle` : `addPoints(+1)` à la fermeture, `addPoints(-1)` au décochage, au lieu de `bumpMotivation`. |
| `src/ui/StatusBar.ts` | Remplace la barre de motivation par la **barre de chantier** : remplissage `points / X(niveau)`, label `points/X tâches`, + jetons « ouvertures prêtes » (0..OPENINGS_CAP). |
| `src/ui/ActionButton.ts` | Actif quand `openings > 0` ; badge = `openings`. |
| `src/scenes/WorldScene.ts` | Câblage : le clic d'action consomme une ouverture ; `refresh` lit le nouvel état. |

### Flux de données

```
case cochée (main.ts onToggle)
  → construction.addPoints(state, +1)
      → points += 1
      → tant que points ≥ X(level) et openings < cap : points -= X ; openings += 1
  → refresh() → StatusBar barre de chantier + ActionButton badge

ouverture de l'app (catchup)
  → construction.grantMorningOpening(state, now)
      → si nouveau jour : openings = min(cap, openings+1) ; lastMorningDate = today

clic bouton d'action (WorldScene)
  → construction.consumeOpening(state)  (openings -= 1, reconversion paliers)
  → drawCards(state, now) avec poolSizeFor(level)
  → CardOverlay → choix → placement (inchangé)
```

## Persistance et migration

`game_states.state` est un `jsonb` qui stocke le `GameState` entier — les
nouveaux champs `construction` suivent automatiquement, **aucun changement de
schéma Supabase** n'est requis.

Migration des sauvegardes existantes : bump de `SAVE_VERSION`. Le chemin de
chargement de l'état doit, pour toute sauvegarde sans bloc `construction` :

- initialiser `construction = { points: 0, openings: 0, lastMorningDate: '' }` ;
- ignorer/supprimer les anciens champs `motivation`, `motivationLastDecayAt`,
  `lastActionDate`.

La motivation accumulée n'est **pas** convertie en points (repartir de zéro est
acceptable et plus simple ; l'ouverture du matin garantit un démarrage).

## Tests

- `construction.test.ts` :
  - `thresholdFor` / `poolSizeFor` aux niveaux 1, 2, 3.
  - `addPoints` : accumulation, plancher 0 au décochage, conversion d'un palier,
    conversion de **plusieurs** paliers d'un coup, pause à `OPENINGS_CAP`.
  - `consumeOpening` : décrément, reconversion des points en attente.
  - `grantMorningOpening` : accorde une fois par jour, idempotent, respecte le
    plafond, ne rattrape pas plusieurs jours.
- `dailyAction` : `drawCards` renvoie `poolSizeFor(level)` cartes ; mise à jour
  des tests référençant la motivation.
- `catchup` : retrait des tests de décroissance de motivation ; ajout d'un test
  d'ouverture du matin.
- Migration : une sauvegarde « ancienne version » se charge avec un bloc
  `construction` initialisé et sans champ motivation.

## Hors périmètre (YAGNI)

- Pas d'animation de pose de brique ni de réactions de villageois autres que le
  `celebrateRandomVillager` existant.
- Pas de conversion de la motivation héritée en points.
- Pas de plafonnement dur des `points` (seul l'affichage borne à X).
- Pas de notification/son d'ouverture débloquée — la barre et le badge suffisent.
