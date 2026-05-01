# Changelog

Toutes les modifications notables de ce projet sont documentées ici.
Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Unreleased]

### Ajouté
- README, LICENSE (MIT), CHANGELOG, .gitignore.
- Découpage de `js/dashboard.js` (828 lignes) en 11 modules ES dans `js/modules/`.
- Délégation d'événements unique sur `document` via attributs `data-action`.
- Validation dynamique du jour selon le mois sélectionné (28/29/30/31).

### Corrigé
- Animation de l'overlay du drawer (apparition/disparition fluide).
- Réinitialisation complète du formulaire de transaction après ajout (jour, catégorie, récurrence).
- Section "récurrence" correctement masquée en mode édition de transaction existante.
- Toast d'erreur quand `deleteMonth` ne trouve pas le mois.

### Modifié
- `console.error` remplacés par des toasts utilisateur via `showSaveStatus`.
- Suppression des fonctions exposées sur `window.*` (encapsulation via modules).
- Factorisation des deux graphiques doughnut (catégories dépenses/revenus) en une fonction unique.

## [0.1.0] - Initial

Version initiale (Firebase puis migration Supabase). Voir l'historique Git pour le détail.
