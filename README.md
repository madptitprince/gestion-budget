# MADFIN — Smart Cashflow & Budget

Plateforme personnelle et moderne de gestion budgétaire, conçue pour un pilotage fluide, précis et professionnel de vos finances personnelles.

Intègre un **diagramme de flux de trésorerie interactif divergent** (style Finary), une gestion mensuelle et annuelle complète, des exports PDF vectoriels de qualité publication, ainsi qu'une authentification sécurisée par mot de passe avec synchronisation **Neon PostgreSQL** et déploiement **Vercel**.

---

## Fonctionnalités Clés

- **Authentification & Espace Privé** :
  - Page de connexion sécurisée avec mot de passe personnel (`BUDGET_PASSWORD`).
  - Sessions sécurisées de 24 heures (cookies `HttpOnly`, `SameSite=Lax`, `Secure`).
  - Protection contre les attaques par force brute (limite de tentatives).
  - Déconnexion en 1 clic depuis la barre de navigation.

- **Diagramme de Flux de Trésorerie Divergent** :
  - Visualisation fluide de la répartition : *Revenus $\to$ Budget $\to$ Piliers $\to$ Postes détaillés*.
  - Piliers distincts : Investissements & Épargne, Logement & Charges, Vie quotidienne, Abonnements, Reste libre.
  - Rubans connectés avec badges de montants et pourcentages en direct.
  - Export direct en image HD (PNG) et en PDF haute définition.

- **Pilotage Budgétaire Mensuel** :
  - 5 cartes KPIs clés en temps réel avec badges de pourcentage (Revenus, Fixes, Épargne, Variables, Solde Net).
  - Frise de répartition globale dynamique.
  - Édition rapide des montants et ajout de dépenses à la volée.
  - Duplication intelligente en 1 clic depuis le mois précédent.

- **Bilan Annuel Consolidé 12 Mois** :
  - Matrice complète des postes de Janvier à Décembre.
  - Synthèse des totaux mensuels : *Total des sorties*, *Solde net / Reste à vivre* (coloration positive/négative) et *Taux d'épargne (%)*.

- **Exports PDF Vectoriels Professionnels** (générés via `jspdf` et `jspdf-autotable`) :
  - **Rapport Mensuel (A4 Portrait)** : KPIs, frise d'allocation, ventilation détaillée par catégorie avec parts en %.
  - **Bilan Annuel Consolidé (A4 Paysage)** : Tableau 12 mois complet tenant parfaitement sur une seule page.
  - **Diagramme de Flux (A4 Paysage HD)** : Rendu vectoriel ultra-léger (~260 Ko) et haute définition.

- **Expérience Utilisateur** :
  - Mode sombre élégant actif par défaut, bascule instantanée en mode clair.
  - Design ultra-responsive avec barre de navigation mobile inférieure (PWA ready).

---

## Configuration & Déploiement sur Vercel

Le projet est conçu pour remplacer directement l'ancien déploiement sur Vercel en conservant la même base de données **Neon PostgreSQL** et les mêmes variables d'environnement.

### 1. Variables d'Environnement

Dans les paramètres de votre projet Vercel (**Settings → Environment Variables**) :

| Variable | Description |
| :--- | :--- |
| `BUDGET_PASSWORD` | Votre mot de passe personnel d'accès à l'application. |
| `DATABASE_URL` ou `budget_DATABASE_URL` | Chaîne de connexion Neon PostgreSQL (fournie automatiquement par l'intégration Neon). |

### 2. Paramètres de Build Vercel

- **Framework Preset** : `Vite` (détecté automatiquement).
- **Build Command** : `npm run build`
- **Output Directory** : `dist`
- **Install Command** : `npm install`

Les Serverless Functions dans le dossier `api/` (`session.ts`, `login.ts`, `logout.ts`, `budget.ts`) s'exécutent automatiquement sur Node.js et se connectent à Neon via `@neondatabase/serverless`.

---

## Démarrage en Local

### Prérequis
- Node.js 18+ et npm.

### Installation & Lancement

```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement local
npm run dev
```

L'application est accessible sur `http://localhost:5173`.
En mode développement local, vous pouvez vous connecter avec votre mot de passe (ou tout mot de passe de test si `BUDGET_PASSWORD` n'est pas configuré localement).

### Build de Production

```bash
npm run build
```
Le résultat optimisé est généré dans le dossier `dist/`.

---

## Sauvegarde & Sécurité

- Les données peuvent être sauvegardées à tout moment au format JSON (`Sauvegarde JSON` dans la barre de navigation).
- En production avec Neon PostgreSQL, toutes les modifications sont synchronisées de manière atomique dans la base de données.
- Vos données personnelles et fichiers `.xlsx` sont exclus du suivi Git via `.gitignore`.
