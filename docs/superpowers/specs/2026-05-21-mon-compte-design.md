# Design — Popup « Mon compte »

Date : 2026-05-21

## Objectif

Permettre à un utilisateur connecté (compte permanent) d'ouvrir une popup overlay
« Mon compte » pour : voir son email, changer son mot de passe, consulter l'état de
synchronisation cloud et supprimer son compte. Pas de pages séparées : un seul
overlay DOM.

## Périmètre

Concerne uniquement les comptes `kind === 'permanent'`. Les sessions invité
(`anonymous`) gardent le comportement actuel de `AccountBar` (bouton
« Créer un compte »).

## Architecture

### Composant `src/ui/AccountModal.ts`
- Overlay DOM plein écran, masqué par défaut.
- Monté sur un conteneur `#modal-mount` ajouté dans `index.html` (hors `#app`).
- Backdrop semi-transparent ; clic sur le backdrop ou sur la croix `✕` ferme la
  modale. Touche `Échap` ferme également.
- Réalisé en DOM pur (pas de Phaser), testable comme `AccountBar` /
  `TodoSidebar` / `DailyStats`.

### `src/ui/AccountBar.ts`
- Pour `kind === 'permanent'`, la barre affiche : `👤 email`, un bouton
  `Compte` **et** un bouton `Déconnexion` (les deux conservés dans la barre).
- Le bouton `Compte` ouvre `AccountModal`.
- Le bouton `Déconnexion` garde le flux existant.

### Edge function `supabase/functions/delete-account/`
- Vérifie le JWT de l'appelant, extrait l'`uid`.
- Client service-role : `auth.admin.deleteUser(uid)`.
- Les tables `todos`, `game_states`, `preferences` ont `on delete cascade` vers
  `auth.users` → les données du user sont supprimées automatiquement.
- Renvoie `200` en cas de succès, une erreur sinon.

### `src/systems/cloud/auth.ts`
Deux helpers ajoutés :
- `changePassword(newPassword: string): Promise<void>` — via
  `supabase.auth.updateUser({ password })`.
- `deleteAccount(): Promise<void>` — appelle l'edge function `delete-account`.

### `src/systems/cloud/sync.ts`
- Ajout d'un suivi `lastSyncAt: number`, mis à jour à chaque `pullAndMerge`
  réussi.
- Exposé via une nouvelle méthode `getStatus()` du type `CloudSync`, renvoyant
  l'état de synchro (cloud configuré ou non, horodatage de la dernière synchro).

## Contenu de la modale

```
┌─ Mon compte ──────────────────── ✕ ┐
│ 👤  matthieu@exemple.com            │
│                                     │
│ Mot de passe                        │
│  [ nouveau mot de passe        ]    │
│  [ confirmer                   ]    │
│  ( Mettre à jour )                  │
│                                     │
│ Synchronisation                     │
│  ☁ Synchronisé · il y a 2 min       │
│                                     │
│ ─────────────────────────────────   │
│  Zone danger                        │
│  ( Supprimer le compte )            │
└─────────────────────────────────────┘
```

Sections :
1. **En-tête** — titre « Mon compte » + croix `✕`.
2. **Email** — `👤 email`, lecture seule.
3. **Mot de passe** — champ « nouveau mot de passe » + champ « confirmer » +
   bouton « Mettre à jour ».
4. **Synchronisation** — ligne d'état : « Synchronisé · il y a X » ou
   « Sync cloud désactivée » si Supabase non configuré.
5. **Zone danger** — bouton « Supprimer le compte ». La déconnexion **n'est pas**
   dans la modale (elle reste dans la barre).

## Flux de données

`main.ts` instancie `AccountModal` et câble ses callbacks :
- `onChangePassword(pwd)` → `changePassword(pwd)` → succès/erreur affiché inline.
- `onDeleteAccount()` → `deleteAccount()` → `signOut` → `ensureSession()` (retour
  en session invité) → `accountBar.setAuth(...)` → modale fermée.
- `getSyncStatus()` → `cloud.getStatus()`.

`AccountBar` reçoit un callback supplémentaire `onOpenAccount()` que `main.ts`
branche sur `accountModal.open(auth)`.

## Gestion d'erreurs

- **Changement de mot de passe** : si les deux champs diffèrent, message inline
  sans appel réseau. Erreurs Supabase (mot de passe trop court, etc.) affichées
  inline. Bouton désactivé pendant l'appel.
- **Suppression de compte** : confirmation inline en deux temps — le premier clic
  transforme le bouton en « Confirmer la suppression ? », le second clic exécute.
  Pas de `window.confirm` (les dialogs bloquent l'environnement). Erreurs (edge
  function injoignable, etc.) affichées inline.
- **État de synchro** : si Supabase non configuré, la section affiche
  « Sync cloud désactivée » au lieu d'un horodatage.

## Tests

- `tests/unit/ui/AccountModal.test.ts` — DOM pur :
  - rendu de l'email,
  - validation de la confirmation du mot de passe (mismatch → erreur inline),
  - confirmation en deux temps de la suppression,
  - ouverture/fermeture (backdrop, croix, Échap).
- L'edge function `delete-account` n'est pas testée localement (infra serveur).

## Hors périmètre

- Suppression sélective des données locales sans supprimer le compte.
- Gestion multi-appareils avancée, export de données.
- Modification de l'email du compte.
