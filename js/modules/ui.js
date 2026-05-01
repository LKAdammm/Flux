// Logout, reset des données et délégation centralisée des événements (data-action / data-action-change).

import { supabase } from '../supabase-config.js';
import { state, generateDefaultData, saveData } from './state.js';
import { toggleDrawer, closeDrawer } from './drawer.js';
import { updateGoal } from './kpis.js';
import { updateApp } from './app.js';
import { addNextMonth, deleteMonth, toggleCard } from './months.js';
import {
    handleAddTransaction, editTransaction, deleteTransaction, cancelEdit,
    updateCategoryOptions, toggleRecurringOptions, toggleRecurringCustom
} from './transactions.js';
import { updateDayMax } from './render.js';
import { exportPDF } from './pdf-export.js';

export async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

export function resetData() {
    if (!confirm('Réinitialiser toutes les données ? Cette action est irréversible.')) return;
    state.financialData = generateDefaultData();
    saveData().then(() => location.reload());
}

const actions = {
    'toggle-drawer':            ()   => toggleDrawer(),
    'close-drawer':             ()   => closeDrawer(),
    'logout':                   ()   => logout(),
    'export-pdf':               ()   => exportPDF(),
    'add-next-month':           ()   => addNextMonth(),
    'reset-data':               ()   => resetData(),
    'update-goal':              ()   => updateGoal(),
    'update-app':               ()   => updateApp(),
    'update-category-options':  ()   => updateCategoryOptions(),
    'update-day-max':           ()   => updateDayMax(),
    'toggle-recurring-options': ()   => toggleRecurringOptions(),
    'toggle-recurring-custom':  ()   => toggleRecurringCustom(),
    'cancel-edit':              ()   => cancelEdit(),
    'edit-transaction':         (el) => editTransaction(el.dataset.monthId, el.dataset.txType, parseInt(el.dataset.txIndex)),
    'delete-transaction':       (el) => deleteTransaction(el.dataset.monthId, el.dataset.txType, parseInt(el.dataset.txIndex)),
    'delete-month':             (el) => deleteMonth(el.dataset.monthId),
    'toggle-card':              (el) => toggleCard(el.dataset.monthId)
};

export function bindEventDelegation() {
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const handler = actions[target.dataset.action];
        if (handler) handler(target);
    });

    document.addEventListener('change', (e) => {
        const target = e.target.closest('[data-action-change]');
        if (!target) return;
        const handler = actions[target.dataset.actionChange];
        if (handler) handler(target);
    });

    const form = document.getElementById('transaction-form');
    if (form) form.addEventListener('submit', handleAddTransaction);
}
