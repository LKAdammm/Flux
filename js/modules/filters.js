// Filtre de période (sélecteurs mois début / fin).

import { state } from './state.js';

export function initFilters() {
    const s = document.getElementById('filter-start');
    const e = document.getElementById('filter-end');
    if (!s || !state.financialData) return;
    s.innerHTML = ''; e.innerHTML = '';
    state.financialData.months.forEach((month, i) => {
        const label = `${month.name} ${month.year}`;
        s.appendChild(new Option(label, i));
        e.appendChild(new Option(label, i));
    });
    s.value = 0;
    e.value = state.financialData.months.length - 1;
}

export function getFilteredMonths() {
    const sEl = document.getElementById('filter-start');
    const eEl = document.getElementById('filter-end');
    if (!sEl || !eEl || !state.financialData) return [];
    let start = parseInt(sEl.value);
    let end   = parseInt(eEl.value);
    if (start > end) {
        [start, end] = [end, start];
        sEl.value = start;
        eEl.value = end;
    }
    return state.financialData.months.slice(start, end + 1);
}
