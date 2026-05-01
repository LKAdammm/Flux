// CRUD transactions, formulaire (édition / création / récurrence).

import { state, categoriesDef } from './state.js';
import { daysInMonth } from './utils.js';
import { addNextMonth } from './months.js';
import { updateMonthSelectOptions, updateDayMax } from './render.js';
import { toggleDrawer } from './drawer.js';
import { updateApp } from './app.js';

export function updateCategoryOptions() {
    const type = document.getElementById('form-type');
    const cat  = document.getElementById('form-category');
    if (!type || !cat) return;
    const prev = cat.value;
    cat.innerHTML = '';
    categoriesDef[type.value].forEach(c => cat.appendChild(new Option(c, c)));
    if (prev && categoriesDef[type.value].includes(prev)) cat.value = prev;
}

export function toggleRecurringOptions() {
    const checked = document.getElementById('form-recurring').checked;
    document.getElementById('recurring-duration-container').classList.toggle('hidden', !checked);
}

export function toggleRecurringCustom() {
    const dur = document.getElementById('form-recurring-duration');
    document.getElementById('form-recurring-custom-wrap').classList.toggle('hidden', dur.value !== 'custom');
}

export function editTransaction(monthId, type, index) {
    const month = state.financialData?.months.find(m => m.id === monthId);
    if (!month) return;
    const item = month[type].details[index];
    if (!item) return;

    if (!state.drawerOpen) toggleDrawer();

    document.getElementById('form-month').value = monthId;
    document.getElementById('form-type').value  = type;
    updateCategoryOptions();
    document.getElementById('form-category').value = item.category;
    document.getElementById('form-label').value    = item.label;
    document.getElementById('form-amount').value   = item.amount;
    document.getElementById('form-day').value      = item.day;
    updateDayMax();

    state.editingTransaction = { monthId, type, index };

    document.getElementById('form-title').innerHTML =
        '<i data-lucide="pencil" class="w-4 h-4 text-amber-500"></i> Éditer la transaction';
    if (window.lucide) window.lucide.createIcons();

    const btn = document.getElementById('submit-btn');
    btn.textContent = 'Mettre à jour';
    btn.className = btn.className
        .replace('bg-indigo-600', 'bg-amber-600')
        .replace('hover:bg-indigo-500', 'hover:bg-amber-500');

    // En mode édition, la récurrence n'a pas de sens : on masque tout le bloc.
    document.getElementById('recurring-container').classList.add('hidden');
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
}

export function cancelEdit() {
    state.editingTransaction = null;
    document.getElementById('transaction-form').reset();
    document.getElementById('form-title').innerHTML =
        '<i data-lucide="plus-circle" class="w-4 h-4 text-indigo-500"></i> Nouvelle transaction';
    if (window.lucide) window.lucide.createIcons();

    const btn = document.getElementById('submit-btn');
    btn.textContent = 'Enregistrer';
    btn.className = btn.className
        .replace('bg-amber-600', 'bg-indigo-600')
        .replace('hover:bg-amber-500', 'hover:bg-indigo-500');

    document.getElementById('recurring-container').classList.remove('hidden');
    document.getElementById('recurring-duration-container').classList.add('hidden');
    document.getElementById('form-recurring-custom-wrap').classList.add('hidden');
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    updateCategoryOptions();
    updateMonthSelectOptions();
}

export function handleAddTransaction(e) {
    e.preventDefault();
    if (!state.financialData) return;

    const monthId  = document.getElementById('form-month').value;
    const type     = document.getElementById('form-type').value;
    const category = document.getElementById('form-category').value;
    const label    = document.getElementById('form-label').value.trim();
    const amount   = parseFloat(document.getElementById('form-amount').value);
    const day      = parseInt(document.getElementById('form-day').value);

    const targetMonth = state.financialData.months.find(m => m.id === monthId);
    const maxDay = targetMonth ? daysInMonth(targetMonth.name, targetMonth.year) : 31;

    if (!label || isNaN(amount) || amount <= 0 || isNaN(day) || day < 1 || day > maxDay) {
        alert(`Vérifiez les champs : montant > 0, jour entre 1 et ${maxDay}, description requise.`);
        return;
    }

    if (state.editingTransaction) {
        const m = state.financialData.months.find(x => x.id === state.editingTransaction.monthId);
        if (m) m[state.editingTransaction.type].details[state.editingTransaction.index] = { label, amount, day, category };
        cancelEdit();
    } else {
        const isRecurring = document.getElementById('form-recurring')?.checked ?? false;
        const duration    = document.getElementById('form-recurring-duration')?.value ?? 'all';
        const frequency   = parseInt(document.getElementById('form-recurring-freq')?.value ?? '1');
        const startIdx    = state.financialData.months.findIndex(m => m.id === monthId);

        if (startIdx !== -1) {
            if (isRecurring) {
                let endIdx;
                if (duration === 'all') {
                    endIdx = state.financialData.months.length;
                } else if (duration === 'custom') {
                    const custom = parseInt(document.getElementById('form-recurring-custom')?.value ?? '3');
                    endIdx = startIdx + custom;
                } else {
                    endIdx = startIdx + parseInt(duration);
                }
                while (state.financialData.months.length < endIdx) addNextMonth(true);
                for (let i = startIdx; i < endIdx; i += frequency) {
                    state.financialData.months[i][type].details.push({ label, amount, day, category });
                }
            } else {
                state.financialData.months[startIdx][type].details.push({ label, amount, day, category });
            }
        }

        // Reset complet du formulaire en conservant le mois et le type sélectionnés
        // (pour permettre la saisie en série).
        document.getElementById('transaction-form').reset();
        document.getElementById('form-month').value = monthId;
        document.getElementById('form-type').value  = type;
        updateCategoryOptions();
        updateDayMax();
        document.getElementById('recurring-duration-container').classList.add('hidden');
        document.getElementById('form-recurring-custom-wrap').classList.add('hidden');
    }
    updateApp();
}

export function deleteTransaction(monthId, type, index) {
    if (!state.financialData) return;
    if (!confirm('Supprimer cette transaction ?')) return;
    const month = state.financialData.months.find(m => m.id === monthId);
    if (!month) return;
    month[type].details.splice(index, 1);
    updateApp();
}
