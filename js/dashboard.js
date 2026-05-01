// Orchestrateur principal du tableau de bord :
// - Garde d'authentification (redirige vers index.html si non connecté).
// - Charge les données utilisateur depuis Supabase.
// - Branche la délégation d'événements et déclenche le premier rendu.

import { supabase } from './supabase-config.js';
import { state, loadData } from './modules/state.js';
import { initFilters } from './modules/filters.js';
import { updateApp } from './modules/app.js';
import { updateCategoryOptions } from './modules/transactions.js';
import { bindEventDelegation } from './modules/ui.js';

// Auth guard
supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    await loadData(session.user.id);
    if (!state.financialData) return;

    updateCategoryOptions();
    initFilters();
    bindEventDelegation();
    updateApp(true);
});

supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
});
