// État global de l'app + accès Supabase (load / save).

import { supabase } from '../supabase-config.js';
import { showSaveStatus } from './utils.js';

export const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export const categoriesDef = {
    expenses: ['Alimentation', 'Logement', 'Transport', 'Scolarité', 'Loisirs', 'Abonnements', 'Frais bancaires', 'Autre'],
    incomes:  ['Salaire', 'Bourse / Aides', 'Remboursement', 'Cadeau', 'Freelance', 'Autre']
};

// Objet partagé par référence entre tous les modules.
export const state = {
    financialData: null,
    currentUserId: null,
    editingTransaction: null,
    drawerOpen: false,
    charts: { finance: null, category: null, income: null }
};

export function slugifyMonth(name, year) {
    return name.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '-') + '-' + year;
}

export function generateDefaultData() {
    const d = new Date();
    const currentMonth = monthNames[d.getMonth()];
    const currentYear  = d.getFullYear();
    return {
        summary: {
            totalIncomes: 0, totalExpenses: 0, finalBalance: 0,
            savingsGoal: 1000, goalName: 'Mon premier objectif', goalActive: false
        },
        months: [{
            id: slugifyMonth(currentMonth, currentYear),
            name: currentMonth, year: currentYear, status: 'standard',
            incomes:  { total: 0, details: [] },
            expenses: { total: 0, details: [] },
            endBalance: 0,
            note: 'Bienvenue sur Flux ! Saisissez votre première transaction.'
        }]
    };
}

export async function loadData(userId) {
    state.currentUserId = userId;
    showSaveStatus('Synchronisation...', 'text-zinc-400');

    const { data, error } = await supabase
        .from('user_data')
        .select('data')
        .eq('user_id', userId)
        .single();

    // PGRST116 = aucune ligne trouvée — comportement attendu pour un nouveau compte.
    if (error && error.code !== 'PGRST116') {
        showSaveStatus('Erreur de chargement', 'text-rose-400');
        return null;
    }

    if (data) {
        state.financialData = data.data;
        state.financialData.summary.savingsGoal ??= 1000;
        state.financialData.summary.goalName    ??= 'Objectif';
        state.financialData.summary.goalActive  ??= false;
        showSaveStatus('À jour', 'text-indigo-400');
    } else {
        state.financialData = generateDefaultData();
        await saveData();
    }
    return state.financialData;
}

export async function saveData() {
    if (!state.currentUserId || !state.financialData) return;
    showSaveStatus('Sauvegarde...', 'text-amber-400');

    const { error } = await supabase
        .from('user_data')
        .upsert(
            { user_id: state.currentUserId, data: state.financialData },
            { onConflict: 'user_id' }
        );

    showSaveStatus(error ? 'Erreur de sauvegarde' : 'Sauvegardé',
                   error ? 'text-rose-400' : 'text-emerald-400');
}
