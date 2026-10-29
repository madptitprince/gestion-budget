# Clair — votre budget, simplement

Plateforme personnelle de gestion de budget, en français, conçue à partir du modèle Excel « Budget mensuel ». Interface responsive, sans dépendance JavaScript. Fonctionne en local avec SQLite ou sur Vercel avec PostgreSQL et une connexion privée.

**Accès web :** suivre [le guide Vercel](docs/VERCEL.md).

## Démarrer

Python 3.10 ou plus récent suffit. Depuis le dossier du projet :

```sh
python server.py
```

Le serveur écoute sur l’interface locale, au port 3000. Ouvrir `http://127.0.0.1:3000` dans le navigateur de la même machine. Dans un environnement cloud, utiliser le mécanisme de transfert de port de l’hébergeur s’il est disponible. Pour un accès web permanent, utiliser la configuration Vercel et PostgreSQL décrite dans `docs/VERCEL.md`.

Pour importer un classeur au démarrage :

```sh
python server.py --import-xlsx /chemin/vers/budget.xlsx
```

L’import est également accessible dans l’interface, avec un aperçu et une confirmation. Réimporter le même fichier ignore les cellules déjà importées, y compris celles modifiées dans Clair. Supprimer une ligne importée puis réimporter le fichier réintroduit cette ligne. Pour corriger un montant existant, le modifier dans « Mes opérations ».

## Ce que vous pouvez faire

- Consulter les revenus, dépenses, versements d’épargne et reste disponible du mois.
- Comparer les mois, afficher la répartition des dépenses et consulter une synthèse annuelle.
- Ajouter, rechercher, filtrer, modifier et supprimer des opérations.
- Définir des plafonds par catégorie et par mois, avec indication des dépassements.
- Suivre les versements par support d’épargne et créer des objectifs avec une progression déclarée manuellement.
- Importer le modèle Excel fourni, exporter toutes les opérations en CSV et télécharger une sauvegarde JSON complète.

## Données et calculs

Les montants sont stockés en centimes entiers dans `.data/budget.sqlite3`. Cette base est ignorée par Git ; le fichier Excel d’origine et les données personnelles ne font pas partie du code. Le répertoire `.data` de cette instance contient l’historique importé. Un clone du code seul commence vide.

Le reste disponible est `revenus − dépenses fixes − dépenses variables − versements d’épargne`. Les versements Livret A, assurance vie, PEA et Bitcoin sont séparés des charges. Les cumuls de versements ne sont pas des soldes bancaires ou des valorisations de placements.

Les cellules saisies des colonnes janvier à décembre sont importées. Les totaux, valeurs nulles, titres de groupe et formules sont exclus. Les montants restent associés à un mois, car le classeur ne fournit pas de dates de transactions. Le nom de chaque feuille détermine son année. Les feuilles sans montants ne créent aucune opération ; tous les mois restent accessibles dans le sélecteur.

Les totaux sont recalculés à partir des cellules sources. Si une formule Excel omet une ligne, les totaux de Clair incluent néanmoins tous les montants saisis importés. Les objectifs sont suivis séparément, sans modifier les opérations ni compter deux fois l’épargne. Les budgets sont des plafonds, pas des dépenses.

## Conservation

Utiliser « Sauvegarder mes données » pour télécharger un JSON contenant les opérations, budgets et objectifs, avec les montants en centimes. Le CSV est lisible dans Excel. Pour une sauvegarde directement restaurable du serveur, arrêter l’application et conserver une copie de `.data/budget.sqlite3`, puis la remettre au même emplacement avant redémarrage. Le JSON est un export de données ; la restauration automatique JSON n’est pas implémentée.

Pour choisir un autre fichier SQLite, définir `BUDGET_DB`. Les processus doivent être relancés après un redémarrage de la machine ; la base persiste tant que son disque est conservé.

L’application est destinée à un usage personnel sur une machine de confiance. Le mode local sans `BUDGET_PASSWORD` est réservé à une machine de confiance. Sur Vercel, `DATABASE_URL` (ou `budget_DATABASE_URL`) et un `BUDGET_PASSWORD` de 16 caractères minimum sont obligatoires. La connexion donne accès à un seul espace personnel, accessible depuis plusieurs appareils. Aucune connexion bancaire n’est configurée. Le mode PostgreSQL nécessite `pip install -r requirements.txt`.

## Vérification

Tests d’intégration sans dépendances (base temporaire) :

```sh
python -m unittest discover -s tests -v
node --check web/app.js
```

Le test facultatif de navigateur nécessite le paquet Python `playwright` et Chromium. Le chemin de Chromium est configurable via `CHROMIUM_PATH` :

```sh
python tests/browser_check.py
```

Ce test utilise une base temporaire et des données de test. Le test complet d’import peut recevoir `BUDGET_TEST_XLSX=/chemin/vers/budget.xlsx`. Les contrôles d’interface couvrent les cinq pages à 390, 768 et 1440 pixels, la saisie, la modification, la suppression, les budgets, les objectifs et les exports.

Pour tester également la connexion privée dans le navigateur : `BUDGET_TEST_AUTH=1 python tests/browser_check.py`.
