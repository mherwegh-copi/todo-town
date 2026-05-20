# Spec — Migration Supabase & comptes utilisateur

Issue : [#9 — Add supabase](https://github.com/mherwegh-copi/todo-town/issues/9)
Date : 2026-05-20

## Objectif

Migrer la persistance de l'app (aujourd'hui `localStorage` uniquement) vers Supabase,
avec création de compte, pour lier les données à un utilisateur et les synchroniser
entre appareils. L'app doit rester pleinement utilisable hors-ligne.

## Décisions cadrées

| Sujet | Décision |
|---|---|
| Authentification | Session **anonyme** dès le boot ; **upgrade** vers compte email plus tard |
| Modèle réseau | **Local-first** : `localStorage` reste la source locale immédiate, sync en arrière-plan |
| Périmètre | **Tout** synchronisé : todos, état du jeu, préférences UI |
| Login appareil B | Todos **fusionnés**, village **cloud forcé** (un village ne se fusionne pas) |
| Moteur de sync | Pull au démarrage + push à chaque mutation + pull au retour de focus |
| Widget compte | Barre fixe **en bas** de la sidebar (bas-gauche), pas sous la clock |

## État actuel

Toute la persistance passe par `localStorage` :

- `village-sim/state/v1` — état du jeu (`GameState` : motivation, village, villagers…) via `src/systems/save.ts`
- `village-todos` — liste de todos via `src/systems/todoStore.ts`
- `village-todo-sort`, `village-todo-done-collapsed`, `village-todo-daily-goal` — préférences UI

`main.ts` câble les callbacks de la sidebar ; `WorldScene.ts` appelle `saveState`.
L'app fonctionne 100 % offline.

## Architecture

### Nouveau module `src/systems/cloud/`

- `client.ts` — instance `@supabase/supabase-js`, configurée via
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Si les variables sont absentes,
  exporte `null` → le module `cloud` devient un no-op.
- `auth.ts` — session anonyme au boot, upgrade email, login, logout.
- `sync.ts` — moteur pull/push, orchestration de la fusion.
- `merge.ts` — fonctions de fusion **pures** (testables sans réseau).

`localStorage` reste la source locale immédiate. Les fonctions existantes
(`loadTodos` / `saveTodos` / `loadState` / `saveState` / préférences) ne changent pas.
Le module `cloud` se branche par-dessus : il lit/écrit le cache local **et** pousse
vers Supabase.

### Dépendance

Ajout de `@supabase/supabase-js`.

### Schéma Supabase

Trois tables, RLS `user_id = auth.uid()` sur chacune. SQL versionné dans
`supabase/schema.sql` (commité).

| Table | Colonnes |
|---|---|
| `todos` | `id` text PK, `user_id` uuid, `text` text, `done` bool, `created_at` int8 (ms epoch), `updated_at` int8 (ms epoch), `deleted` bool |
| `game_states` | `user_id` uuid PK, `state` jsonb, `updated_at` int8 (ms epoch) |
| `preferences` | `user_id` uuid PK, `sort_mode` text, `done_collapsed` bool, `daily_goal` int, `updated_at` int8 (ms epoch) |

Détails :

- Les `id` de todo restent les `todo-<ts>-<n>` actuels (pas d'UUID serveur) →
  fusion par id triviale.
- `created_at` / `updated_at` en **int8 millisecondes** pour coller au domaine TS
  (`Todo.createdAt` / `Todo.updatedAt` sont des `number`).
- Colonne `deleted` = **tombstone** : un delete marque la ligne au lieu de la
  supprimer — sinon l'appareil B ne saurait jamais qu'un todo a disparu.

## Moteur de synchronisation

### Cycle de vie

1. **Boot** — `auth.ts` garantit une session : pas de session → `signInAnonymously()`.
   Tout utilisateur (anonyme ou permanent) a un `user_id`.
2. **Pull initial** — `sync.ts` tire `todos` + `game_states` + `preferences`,
   fusionne avec le cache local, écrit le résultat fusionné dans `localStorage`,
   re-render l'UI.
3. **Push à la mutation** — chaque callback de `main.ts` (`onAdd`, `onToggle`,
   `onEdit`, `onDelete`, daily goal, tri, collapse) et chaque `saveState` de
   `WorldScene` déclenche un push **débounce ~800 ms** (upsert).
4. **Pull au focus** — sur `visibilitychange` → visible, re-pull + re-fusion.
   Réutilise le handler `visibilitychange` déjà présent dans `main.ts`.

### Résolution de conflits — last-write-wins

| Donnée | Règle |
|---|---|
| Todos | Granularité **ligne**, par `id`. Union local ∪ cloud ; pour un id des deux côtés → version au `updated_at` le plus grand. `deleted: true` est un état comme un autre (gagne s'il est plus récent). |
| État du jeu | Blob entier. LWW sur `game_states.updated_at` cloud vs `state.lastSeenAt` local. **Pas de fusion.** |
| Préférences | LWW global sur la ligne via son `updated_at`. |

### Cas login appareil B

Pull spécial déclenché après un login réussi :

- Todos : fusion normale par id (les todos anonymes de B remontent → rien perdu).
- État du jeu : **cloud forcé** (LWW ignoré, le village du compte gagne).
- Préférences : LWW normal.

### Tombstones — purge

Un todo `deleted: true` reste en base. Purge **paresseuse** : au pull, le cache
local droppe les tombstones de plus de 30 jours. La ligne cloud reste (coût
négligeable, base mono-utilisateur).

## Authentification & UI

### États de session

`anonyme` (défaut, dès le boot) ou `permanent` (email confirmé).

### Widget compte — `src/ui/AccountBar.ts`

Barre fixe en bas de la sidebar. Layout `side-pane` révisé :

```
┌─ side-pane ──────┐
│ clock-mount      │  flex 0 0 auto
│ todo-pane        │  flex 1 1 auto (scroll)
│ account-mount    │  flex 0 0 auto  ← barre compte, collée en bas
└──────────────────┘
```

- `index.html` : nouveau `<div id="account-mount">` après `todo-pane`, style
  `border-top: 1px solid #2a2d34`, registre visuel proche de `.clock-bar`.
- Anonyme → « 👤 Invité · **Créer un compte** ».
- Permanent → « 👤 email@… · **Déconnexion** ».
- Clic « Créer un compte » / « Se connecter » → mini-formulaire (email + mot de
  passe) ouvert au-dessus de la barre, hors du flux de la todo-list. Réutilise le
  style des champs de `TodoSidebar`.

### Upgrade anonyme → permanent

- Soumission du formulaire → `supabase.auth.updateUser({ email, password })`.
- Supabase envoie un email de confirmation ; la session anonyme **conserve son
  `user_id`** → aucune migration de données, village et todos déjà synchronisés
  restent liés.
- Le mot de passe choisi à l'upgrade permet le re-login sur appareil B.

### Login appareil B

- Même formulaire, bascule « J'ai déjà un compte ».
- `signInWithPassword({ email, password })`. Au succès → pull spécial « login
  appareil B » (voir plus haut).
- Mot de passe oublié : `resetPasswordForEmail()` (lien email). Minimal en v1 —
  juste l'envoi du lien, pas de page custom.

### Déconnexion

`signOut()` puis nouvelle `signInAnonymously()` → session invité propre. Le cache
`localStorage` est **vidé** à la déconnexion pour ne pas fuiter les données du
compte vers la session invité suivante.

### Secrets

`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` dans `.env` (gitignored).
`.env.example` commité. La clé `anon` est publique par design — la sécurité repose
sur les **policies RLS**, pas sur le secret de la clé.

## Migration localStorage → cloud

Pas de script de migration séparé. Au premier boot avec le nouveau code :

1. `signInAnonymously()` → `user_id` créé.
2. Pull cloud → vide (nouveau user).
3. Fusion → le cache `localStorage` existant gagne par défaut.
4. Push initial → les données locales sont upsertées dans Supabase.

→ La migration **est** le premier cycle de sync. Aucune perte, aucun code jetable.

## Gestion d'erreurs

Le local-first doit rester intact quoi qu'il arrive.

- Toute erreur réseau/Supabase est catchée, loggée (`console.warn`), **non
  bloquante** — l'app continue sur `localStorage`.
- Push échoué → marqué « sale » ; re-tenté au prochain push débounce ou au pull
  de focus. File d'attente en mémoire (pas de persistance de la file en v1 — un
  reload re-pousse tout via le push initial).
- Pull échoué → cache local conservé, nouvel essai au prochain `visibilitychange`.
- `.env` absent → `client.ts` exporte `null`, le module `cloud` est un no-op,
  l'app tourne 100 % offline comme aujourd'hui. CI et dev sans backend restent
  verts.

## Tests

Vitest, pattern existant `tests/unit/systems/`.

- `merge.ts` (fonctions pures) :
  - fusion todos : union par id, LWW sur `updatedAt`, tombstone gagne si plus récent
  - LWW état du jeu
  - cas « login appareil B » : todos fusionnés, village cloud forcé
  - LWW préférences
  - purge tombstones > 30 jours
- Le réseau (`client.ts`, appels Supabase) **non testé en unitaire** — isolé
  derrière l'interface de `sync.ts`. Logique pure testée, I/O isolée.

## Hors périmètre (v1)

- Sync temps réel (Supabase Realtime).
- Page custom de réinitialisation de mot de passe.
- Persistance de la file d'attente de push entre reloads.
- OAuth tiers (Google/GitHub).
