// CRUD mois (création du mois suivant, suppression, expand/collapse de carte).

import { state, monthNames, slugifyMonth } from './state.js';
import { showSaveStatus } from './utils.js';
import { initFilters } from './filters.js';
import { updateApp } from './app.js';

export function addNextMonth(skipRender = false) {
    if (!state.financialData) return;
    const last     = state.financialData.months[state.financialData.months.length - 1];
    const lastIdx  = monthNames.findIndex(m => m === last.name);
    const nextIdx  = (lastIdx + 1) % 12;
    const nextName = monthNames[nextIdx];
    const nextYear = nextIdx === 0 ? last.year + 1 : last.year;
    const nextId   = slugifyMonth(nextName, nextYear);

    if (state.financialData.months.some(m => m.id === nextId)) return;

    state.financialData.months.push({
        id: nextId, name: nextName, year: nextYear, status: 'standard',
        incomes:  { total: 0, details: [] },
        expenses: { total: 0, details: [] },
        endBalance: 0, note: ''
    });

    initFilters();
    if (!skipRender) {
        document.getElementById('filter-end').value = state.financialData.months.length - 1;
        updateApp();
    }
}

export function deleteMonth(monthId) {
    if (!state.financialData) return;
    if (state.financialData.months.length <= 1) {
        alert('Impossible de supprimer le dernier mois restant.');
        return;
    }
    const month = state.financialData.months.find(m => m.id === monthId);
    if (!month) {
        showSaveStatus('Mois introuvable', 'text-rose-400');
        return;
    }
    const txCount = month.incomes.details.length + month.expenses.details.length;
    const msg = txCount
        ? `Supprimer ${month.name} ${month.year} et ses ${txCount} transaction(s) ?`
        : `Supprimer ${month.name} ${month.year} ?`;
    if (!confirm(msg)) return;

    state.financialData.months = state.financialData.months.filter(m => m.id !== monthId);
    initFilters();
    document.getElementById('filter-end').value = state.financialData.months.length - 1;
    updateApp();
}

export function toggleCard(id) {
    const content = document.getElementById(`content-${id}`);
    const chevron = document.getElementById(`chevron-${id}`);
    if (!content) return;
    const isOpen = content.classList.contains('active');
    content.classList.toggle('active', !isOpen);
    if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}
