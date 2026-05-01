# Flux — Planificateur de trésorerie personnel

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-active-success.svg)](#)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-f7df1e.svg)](#)
[![Powered by Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)

> Gérez vos revenus et dépenses mois par mois, avec graphiques, objectif d'épargne et export PDF.
> Application web légère, **100% vanilla JS**, déployable en statique sur GitHub Pages.

<!-- Capture d'écran : remplace le chemin ci-dessous par ta propre image -->
<!-- ![Aperçu de Flux](docs/screenshot.png) -->

## ✨ Fonctionnalités

- 🔐 **Authentification** par e-mail / mot de passe (Supabase Auth).
- 💸 **Transactions mensuelles** : encaissements et décaissements avec catégories prédéfinies.
- 🔁 **Récurrence** : planifier une dépense/recette sur N mois avec fréquence configurable (mensuel, trimestriel, semestriel, annuel…).
- 📅 **Gestion des périodes** : créer/supprimer des mois, filtrer par plage de dates.
- 📊 **Tableau de bord** : KPIs (encaissements, décaissements, trésorerie nette, taux d'épargne) avec comparaison au mois précédent.
- 📈 **Trois graphiques** : évolution du solde, répartition des charges, sources de revenus.
- 🎯 **Objectif d'épargne** avec barre de progression dynamique sur la période filtrée.
- 📄 **Export PDF** propre et imprimable du rapport mensuel.
- 🌙 **Dark mode** natif, responsive (mobile, tablette, desktop).

## 🛠 Stack

| Côté client                   | Côté serveur            |
| ----------------------------- | ----------------------- |
| HTML / CSS / JavaScript (ES Modules) | Supabase (PostgreSQL + Auth) |
| Tailwind CSS (CDN)            |                         |
| Chart.js 4.4 (graphiques)     |                         |
| Lucide (icônes)               |                         |
| html2pdf.js (export PDF)      |                         |

**Aucune dépendance npm à installer** — toutes les libs sont chargées via CDN.

## 🚀 Lancement local

```bash
# Cloner le projet
git clone https://github.com/LKAdammm/Flux.git
cd Flux

# Servir les fichiers statiquement (au choix)
python -m http.server 8000
# ou
npx serve .
```

Puis ouvrir <http://localhost:8000>.

> ⚠️ Ouvrir directement `index.html` (file://) ne fonctionne pas — les ES modules requièrent un serveur HTTP.

## ⚙️ Configuration Supabase

L'app a besoin d'un projet Supabase pour l'authentification et le stockage.

### 1. Créer un projet Supabase

Sur [supabase.com](https://supabase.com), créer un nouveau projet et récupérer :

- **Project URL** (ex. `https://xxxxxx.supabase.co`)
- **anon / public key** (clé `anon publishable` — celle-ci peut être exposée côté client)

### 2. Créer la table `user_data`

Dans le SQL Editor de Supabase :

```sql
create table public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
```

### 3. Activer la Row Level Security (CRITIQUE 🔒)

Sans RLS, tout utilisateur authentifié peut lire/écrire les données des autres.

```sql
alter table public.user_data enable row level security;

create policy "Lecture limitée à son propre user_id"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Insertion limitée à son propre user_id"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Update limité à son propre user_id"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Delete limité à son propre user_id"
  on public.user_data for delete
  using (auth.uid() = user_id);
```

### 4. Renseigner les clés dans le code

Éditer `js/supabase-config.js` :

```js
const SUPABASE_URL = 'https://VOTRE-PROJET.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_ANON_KEY';
```

> 🔑 La clé `anon publishable` est conçue pour être exposée côté client.
> La protection des données repose sur les policies RLS configurées à l'étape 3.

## 🌐 Déploiement sur GitHub Pages

1. Pousser le repo sur GitHub.
2. **Settings → Pages → Source** : sélectionner la branche `main` et le dossier `/ (root)`.
3. Le site est disponible à `https://<utilisateur>.github.io/Flux/` après quelques secondes.

Aucun build ni workflow n'est nécessaire — les fichiers sont servis tels quels.

## 📁 Structure du projet

```
Flux/
├── index.html              # Page de connexion
├── dashboard.html          # Application principale
├── js/
│   ├── supabase-config.js  # Initialisation du client Supabase
│   ├── auth.js             # Logique de login / signup
│   ├── dashboard.js        # Orchestrateur (~80 lignes)
│   └── modules/
│       ├── state.js        # État global + chargement/sauvegarde
│       ├── utils.js        # Helpers (format EUR, sanitize, daysInMonth…)
│       ├── filters.js      # Filtre de période (mois début/fin)
│       ├── kpis.js         # KPIs, comparaison, objectif d'épargne
│       ├── charts.js       # Chart.js (évolution + 2 doughnuts)
│       ├── render.js       # Cartes mensuelles + listes éditables
│       ├── transactions.js # CRUD transactions, récurrence
│       ├── months.js       # CRUD mois, toggle cartes
│       ├── drawer.js       # Drawer coulissant (animation)
│       ├── ui.js           # Logout, reset, délégation d'événements
│       ├── pdf-export.js   # Export PDF du rapport
│       └── app.js          # Re-render orchestré
├── README.md
├── LICENSE
├── CHANGELOG.md
└── .gitignore
```

## 🗺 Roadmap

- [ ] Capture d'écran dans le README (`docs/screenshot.png`).
- [ ] Mode clair en plus du dark mode.
- [ ] Internationalisation (i18n FR/EN).
- [ ] Catégories personnalisables par l'utilisateur.
- [ ] Import CSV de transactions.
- [ ] PWA (service worker + cache offline).
- [ ] Couverture de tests (Vitest ou Playwright).

## 🤝 Contribuer

Les issues et pull requests sont les bienvenues. Pour un changement majeur, ouvrir d'abord une issue pour discuter de ce que tu aimerais modifier.

## 📜 Licence

[MIT](LICENSE) © Adam Cohen
