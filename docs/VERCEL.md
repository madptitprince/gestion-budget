# Mettre Clair en ligne avec Vercel

Cette version utilise une fonction Python Vercel, une base PostgreSQL permanente et une connexion privée à propriétaire unique. Les données financières ne sont jamais intégrées au déploiement Git.

## 1. Importer le dépôt

Dans Vercel : **Add New → Project**, puis importer `madptitprince/gestion-budget`.

- Framework : **Other** (aucun framework).
- Root Directory : racine du dépôt.
- Laisser les commandes Build/Install et Output Directory aux valeurs automatiques ; ne pas saisir `python server.py` comme commande de build.
- `api/index.py`, `requirements.txt`, `.python-version` et `vercel.json` configurent la fonction Python et les routes.

## 2. Connecter le stockage

Dans le projet Vercel, créer/connecter une base **Neon PostgreSQL** via la section Storage ou Marketplace. Choisir une région proche de celle de la fonction. Vérifier l’offre et ses limites dans le fournisseur avant validation.

L’intégration doit fournir une variable `DATABASE_URL` ou `budget_DATABASE_URL` au projet pour l’environnement **Production**. Le préfixe `budget_` choisi lors de la connexion Neon est reconnu automatiquement ; il n’est pas nécessaire de renommer les variables. Si les deux noms existent, `DATABASE_URL` est prioritaire. Pour un autre préfixe, ajouter `DATABASE_URL` avec la chaîne de connexion PostgreSQL fournie par Neon. Utiliser de préférence la connexion poolée. Saisir les valeurs uniquement dans les paramètres sécurisés Vercel, jamais dans Git ou dans le chat.

Le pilote impose TLS avec vérification du certificat et du nom d’hôte. Le bundle de certificats Mozilla est fourni explicitement par la dépendance `certifi`, pour ne pas dépendre des chemins de certificats du système Vercel. Le schéma est initialisé automatiquement au premier accès, sans effacer les données existantes. L’utilisateur PostgreSQL doit pouvoir créer les tables et séquences dans sa propre base.

Pour les previews, utiliser une base distincte (ou une branche Neon) et des variables propres à Preview. Ne pas connecter une preview de code non vérifié aux données financières de production.

## 3. Définir le mot de passe

Dans **Settings → Environment Variables**, ajouter `BUDGET_PASSWORD` pour Production : saisir votre mot de passe. Aucune longueur minimale n’est imposée ; la valeur doit simplement être non vide. L’application possède un seul espace personnel. Ne pas utiliser le préfixe `NEXT_PUBLIC_`.

Les sessions durent 24 heures, sont stockées en base et utilisent un cookie HttpOnly, Secure sur Vercel, SameSite=Lax. Se déconnecter invalide la session côté serveur. Changer `BUDGET_PASSWORD` puis redéployer invalide les anciennes sessions. Après 10 tentatives de connexion dans une fenêtre de 15 minutes, les tentatives suivantes sont temporairement refusées.

L’application refuse de servir les données sur Vercel si le mot de passe ou PostgreSQL ne sont pas configurés. Elle ne bascule jamais sur un fichier SQLite temporaire en production.

## 4. Déployer et vérifier

Lancer **Deploy**, ou **Redeploy** après modification des variables. Vercel fournit alors l’adresse du projet. Cette adresse n’existe pas tant que le déploiement n’a pas abouti.

Sur l’adresse obtenue :

1. Vérifier que la page de connexion s’affiche.
2. Se connecter, puis importer votre classeur Excel depuis « Mes opérations → Importer ».
3. Vérifier le nombre de lignes dans l’aperçu avant confirmation.
4. Sélectionner un mois renseigné et comparer les revenus, dépenses, versements d’épargne et reste disponible aux cellules sources du classeur.
5. Recharger et vérifier les chiffres. Réimporter le même classeur ne doit pas ajouter de doublons.
6. Se déconnecter et ouvrir l’adresse dans une fenêtre privée : les données et les exports doivent demander une connexion.
7. Vérifier après un redéploiement que les données restent présentes.

La base locale `.data/budget.sqlite3` est exclue du dépôt et de Vercel. Le premier déploiement commence donc vide. Si des opérations, budgets ou objectifs ont été ajoutés après l’import initial, conserver la sauvegarde locale avant une migration : réimporter le classeur seul ne migre pas ces changements supplémentaires.

## Validation effectuée et restante

Les tests locaux couvrent les opérations, les imports, les contraintes de budget, les sessions, la limitation des tentatives, les routes de la fonction Vercel et l’interface responsive. Les dépendances PostgreSQL sont installables sous Python 3.12.

Le test `tests/postgres_check.py` a également validé le fonctionnement sur un vrai PostgreSQL 17 local avec TLS, l’initialisation répétée du schéma, les imports sans doublons, les opérations authentifiées et le refus des certificats invalides. La connexion à votre base Neon et le déploiement Vercel doivent encore être vérifiés dans votre compte.


## Diagnostic du stockage

Si le stockage est indisponible, la réponse et les journaux Vercel contiennent un code fixe. Aucune chaîne de connexion, aucun mot de passe ni exception brute ne sont exposés.

- `DB_TLS` : vérification TLS ou certificats.
- `DB_AUTH` : identifiants PostgreSQL refusés.
- `DB_PERMISSIONS` : droits insuffisants sur la base.
- `DB_NAME` : nom de base inexistant.
- `DB_URL` : chaîne de connexion invalide.
- `DB_NETWORK` : connexion refusée, résolution DNS ou délai dépassé.
- `DB_DRIVER` : dépendance PostgreSQL manquante.
- `DB_UNAVAILABLE` : erreur non classée.

Pour signaler un problème, transmettre le code et le message fixe affiché, jamais la valeur de `DATABASE_URL` ou de `budget_DATABASE_URL`.


Si le bon mot de passe ramenait silencieusement au formulaire, mettre à jour le déploiement : la lecture des cookies prend désormais en charge plusieurs en-têtes Cookie, et le navigateur vérifie la session avant d’ouvrir le tableau de bord. Les cookies de session sont Secure et HttpOnly sur Vercel, avec SameSite=Lax pour conserver la connexion après une navigation externe ; les protections contre les écritures depuis une autre origine restent actives.

Si le navigateur bloque le cookie, le formulaire le signale explicitement. Ouvrir l’adresse du site dans un onglet normal et autoriser ses cookies. Le code `SESSION_INVALID` signifie que le cookie est transmis mais que la session n’est pas reconnue par le serveur. Aucun jeton de session ni mot de passe ne doit être transmis pour diagnostiquer ce cas.
