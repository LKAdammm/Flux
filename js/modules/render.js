// Rendu HTML des cartes mensuelles, des listes éditables et du sélecteur de mois du formulaire.

import { state } from './state.js';
import { formatEur, sanitize, daysInMonth } from './utils.js';
import { getFilteredMonths } from './filters.js';

export function buildMonthlyCards() {
    const container = document.getElementById('monthly-container');
    if (!container || !state.financialData) return;
    container.innerHTML = '';
    let lastYear = 0;

    getFilteredMonths().forEach(month => {
        if (month.year !== lastYear) {
            container.insertAdjacentHTML('beforeend', `
                <div class="col-span-1 md:col-span-2 lg:col-span-3 mt-4 mb-1 flex items-center gap-3">
                    <h2 class="text-base font-bold text-zinc-500">${month.year}</h2>
                    <div class="h-px bg-zinc-800 flex-grow"></div>
                </div>`);
            lastYear = month.year;
        }
        container.insertAdjacentHTML('beforeend', monthCardHTML(month));
    });
}

function monthCardHTML(month) {
    const id = sanitize(month.id);
    const incRows = txRows(month.incomes.details, 'text-emerald-400');
    const expRows = txRows(month.expenses.details, 'text-rose-400');

    return `
        <div class="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex flex-col shadow-sm group">
            <div class="w-full text-left px-4 py-3.5 flex justify-between items-center bg-zinc-900 hover:bg-zinc-800/50 transition-colors cursor-pointer select-none"
                 data-action="toggle-card" data-month-id="${id}">
                <div class="flex items-center gap-2.5">
                    <i data-lucide="calendar" class="w-4 h-4 text-zinc-500 shrink-0"></i>
                    <h3 class="font-semibold text-zinc-100 text-sm">${sanitize(month.name)}</h3>
                </div>
                <div class="flex items-center gap-2">
                    <span data-action="delete-month" data-month-id="${id}"
                          class="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-rose-500 transition-all rounded hover:bg-zinc-800 cursor-pointer"
                          title="Supprimer ce mois">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </span>
                    <i data-lucide="chevron-down" class="w-4 h-4 text-zinc-500 transition-transform duration-300" id="chevron-${id}"></i>
                </div>
            </div>
            <div class="px-4 py-2 border-y border-zinc-800 flex justify-between bg-zinc-950/50 text-xs">
                <span class="text-emerald-500 font-semibold">+ ${formatEur(month.incomes.total)}</span>
                <span class="text-rose-500 font-semibold">- ${formatEur(month.expenses.total)}</span>
            </div>
            <div id="content-${id}" class="month-card-content">
                <div class="p-4 space-y-4">
                    <div>
                        <h4 class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 pb-1 border-b border-zinc-800">Encaissements</h4>
                        <ul class="space-y-2">${incRows}</ul>
                    </div>
                    <div>
                        <h4 class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 pb-1 border-b border-zinc-800">Décaissements</h4>
                        <ul class="space-y-2">${expRows}</ul>
                    </div>
                </div>
            </div>
            <div class="px-4 py-3 mt-auto bg-zinc-950 border-t border-zinc-800 flex justify-between items-center">
                <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Clôture</span>
                <span class="font-bold text-sm ${month.endBalance < 0 ? 'text-rose-500' : 'text-white'}">${formatEur(month.endBalance)}</span>
            </div>
        </div>`;
}

function txRows(details, amountClass) {
    if (!details.length) return '<li class="text-zinc-600 text-[10px] italic">Aucun mouvement</li>';
    return details.map(item => `
        <li class="flex items-start gap-2.5 text-zinc-300">
            <span class="text-[10px] font-mono font-semibold text-zinc-500 bg-zinc-800 rounded px-1.5 py-0.5 shrink-0 mt-0.5 min-w-[2rem] text-center">${String(item.day).padStart(2,'0')}</span>
            <div class="min-w-0 flex-1">
                <span class="font-medium text-xs block truncate">${sanitize(item.label)}</span>
                <span class="text-[10px] text-zinc-500 block">${sanitize(item.category)}</span>
            </div>
            <span class="font-medium ${amountClass} whitespace-nowrap text-xs shrink-0">${formatEur(item.amount)}</span>
        </li>`).join('');
}

export function renderEditorLists() {
    const container = document.getElementById('editor-lists-container');
    if (!container || !state.financialData) return;
    container.innerHTML = '';

    const isEmpty = state.financialData.months.every(m => !m.incomes.details.length && !m.expenses.details.length);
    if (isEmpty) {
        container.innerHTML = '<p class="text-zinc-600 text-xs italic text-center py-4">Aucune transaction saisie</p>';
        return;
    }

    state.financialData.months.forEach(month => {
        const all = [
            ...month.incomes.details.map((item, i) => ({ ...item, type: 'incomes', index: i })),
            ...month.expenses.details.map((item, i) => ({ ...item, type: 'expenses', index: i }))
        ];
        if (!all.length) return;

        const id = sanitize(month.id);
        const rows = all.map(item => `
            <li class="flex items-center justify-between gap-2 px-3 py-2 hover:bg-zinc-800/50 transition-colors rounded-md">
                <div class="min-w-0 flex-1 flex items-center gap-2">
                    <span class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0
                        ${item.type === 'incomes' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}">
                        ${item.type === 'incomes' ? '+' : '−'}
                    </span>
                    <span class="text-zinc-200 text-xs truncate">${sanitize(item.label)}</span>
                    <span class="text-zinc-600 text-[10px] font-mono shrink-0">${formatEur(item.amount)}</span>
                </div>
                <div class="flex gap-0.5 shrink-0">
                    <button data-action="edit-transaction" data-month-id="${id}" data-tx-type="${item.type}" data-tx-index="${item.index}"
                            class="p-1.5 text-zinc-500 hover:text-indigo-400 transition-colors rounded hover:bg-zinc-700">
                        <i data-lucide="pencil" class="w-3 h-3"></i>
                    </button>
                    <button data-action="delete-transaction" data-month-id="${id}" data-tx-type="${item.type}" data-tx-index="${item.index}"
                            class="p-1.5 text-zinc-500 hover:text-rose-500 transition-colors rounded hover:bg-zinc-700">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>
                </div>
            </li>`).join('');

        container.insertAdjacentHTML('beforeend', `
            <div class="bg-zinc-950/50 rounded-lg border border-zinc-800/70 overflow-hidden">
                <div class="px-3 py-2 bg-zinc-900/80 border-b border-zinc-800/70">
                    <h4 class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">${sanitize(month.name)} ${month.year}</h4>
                </div>
                <ul class="py-1">${rows}</ul>
            </div>`);
    });
}

export function updateMonthSelectOptions() {
    const sel = document.getElementById('form-month');
    if (!sel || !state.financialData) return;
    const prev = sel.value;
    sel.innerHTML = '';
    state.financialData.months.forEach(m => {
        sel.appendChild(new Option(`${m.name} ${m.year}`, m.id));
    });
    if (prev && state.financialData.months.some(m => m.id === prev)) sel.value = prev;
    updateDayMax();
}

export function updateDayMax() {
    const sel = document.getElementById('form-month');
    const dayInput = document.getElementById('form-day');
    if (!sel || !dayInput || !state.financialData) return;
    const month = state.financialData.months.find(m => m.id === sel.value);
    if (!month) return;
    const max = daysInMonth(month.name, month.year);
    dayInput.max = max;
    if (parseInt(dayInput.value) > max) dayInput.value = max;
}
