// KPIs (encaissements, décaissements, trésorerie, taux d'épargne, comparaisons) + objectif d'épargne.

import { state, saveData } from './state.js';
import { formatEur } from './utils.js';
import { getFilteredMonths } from './filters.js';

export function recalculateState() {
    if (!state.financialData?.months) return;
    let running = 0;
    state.financialData.months.forEach(month => {
        month.incomes.details.sort((a, b) => a.day - b.day);
        month.expenses.details.sort((a, b) => a.day - b.day);
        month.incomes.total  = month.incomes.details.reduce((s, i) => s + i.amount, 0);
        month.expenses.total = month.expenses.details.reduce((s, i) => s + i.amount, 0);
        running += month.incomes.total - month.expenses.total;
        month.endBalance = running;
    });
    state.financialData.summary.finalBalance = running;

    const filtered = getFilteredMonths();
    state.financialData.summary.totalIncomes   = filtered.reduce((s, m) => s + m.incomes.total, 0);
    state.financialData.summary.totalExpenses  = filtered.reduce((s, m) => s + m.expenses.total, 0);
    state.financialData.summary.filteredBalance = filtered.length
        ? filtered[filtered.length - 1].endBalance : 0;
}

export function populateKPIs() {
    if (!state.financialData) return;
    const inc = state.financialData.summary.totalIncomes;
    const exp = state.financialData.summary.totalExpenses;

    document.getElementById('kpi-incomes').textContent  = formatEur(inc);
    document.getElementById('kpi-expenses').textContent = formatEur(exp);
    document.getElementById('kpi-balance').textContent  = formatEur(state.financialData.summary.filteredBalance);

    const rateEl = document.getElementById('kpi-savings-rate');
    if (rateEl) {
        if (inc > 0) {
            const rate = Math.round(((inc - exp) / inc) * 100);
            rateEl.textContent = `${rate}%`;
            rateEl.className   = `text-xl font-bold tabular-nums ${rate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
        } else {
            rateEl.textContent = '—';
            rateEl.className   = 'text-xl font-bold text-zinc-500';
        }
    }

    renderComparison();
}

function renderComparison() {
    const filtered = getFilteredMonths();
    if (filtered.length < 2) {
        document.querySelectorAll('.kpi-trend').forEach(el => el.textContent = '');
        return;
    }
    const current = filtered[filtered.length - 1];
    const prev    = filtered[filtered.length - 2];
    renderTrend('trend-incomes',  current.incomes.total,  prev.incomes.total);
    renderTrend('trend-expenses', current.expenses.total, prev.expenses.total, true);
}

function renderTrend(elId, current, previous, invert = false) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (previous === 0) { el.textContent = ''; return; }
    const pct   = Math.round(((current - previous) / previous) * 100);
    const up    = pct >= 0;
    const good  = invert ? !up : up;
    const arrow = up ? '↑' : '↓';
    el.textContent = `${arrow} ${Math.abs(pct)}%`;
    el.className   = `text-[10px] font-semibold ${good ? 'text-emerald-500' : 'text-rose-500'}`;
}

export function renderGoal() {
    const bar       = document.getElementById('goal-bar');
    const barWrap   = document.getElementById('goal-bar-container');
    const pct       = document.getElementById('goal-percent');
    const nameInput = document.getElementById('goal-name');
    const amtInput  = document.getElementById('goal-input');
    const activeChk = document.getElementById('goal-active');
    if (!bar || !state.financialData) return;

    const isActive = state.financialData.summary.goalActive;
    activeChk.checked = isActive;
    nameInput.value   = state.financialData.summary.goalName;
    amtInput.value    = state.financialData.summary.savingsGoal;

    if (isActive) {
        barWrap.classList.remove('hidden');
        pct.classList.remove('hidden');
        const balance = state.financialData.summary.filteredBalance;
        const goal    = state.financialData.summary.savingsGoal;
        const percent = goal > 0 && balance > 0
            ? Math.min((balance / goal) * 100, 100) : 0;
        pct.textContent = `${Math.round(percent)}%`;
        bar.style.width = `${percent}%`;
        const done = percent >= 100;
        bar.className = `h-1.5 rounded-full transition-all duration-500 ${done ? 'bg-emerald-500' : 'bg-indigo-600'}`;
        pct.className = `text-xs font-bold ml-auto shrink-0 ${done ? 'text-emerald-500' : 'text-indigo-400'}`;
    } else {
        barWrap.classList.add('hidden');
        pct.classList.add('hidden');
    }
}

export function updateGoal() {
    state.financialData.summary.goalActive  = document.getElementById('goal-active').checked;
    state.financialData.summary.goalName    = document.getElementById('goal-name').value || 'Objectif';
    state.financialData.summary.savingsGoal = parseFloat(document.getElementById('goal-input').value) || 0;
    saveData();
    renderGoal();
}
