// Graphiques Chart.js : évolution combinée + 2 doughnuts (charges / revenus).

import { state } from './state.js';
import { formatEur } from './utils.js';
import { getFilteredMonths } from './filters.js';

const EXPENSE_PALETTE = ['#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#3b82f6','#0ea5e9'];
const INCOME_PALETTE  = ['#10b981','#34d399','#6ee7b7','#a7f3d0','#059669','#047857','#065f46','#064e3b'];

export function renderChart() {
    const el = document.getElementById('financeChart');
    if (!el || !state.financialData) return;
    if (state.charts.finance) state.charts.finance.destroy();

    const months = getFilteredMonths();
    state.charts.finance = new Chart(el.getContext('2d'), {
        type: 'bar',
        data: {
            labels: months.map(m => `${m.name.substring(0,3)} ${m.year.toString().slice(-2)}`),
            datasets: [
                { type: 'line', label: 'Solde', data: months.map(m => m.endBalance),
                  borderColor: '#6366f1', backgroundColor: '#6366f1',
                  borderWidth: 2, pointRadius: 4, fill: false, tension: 0.3 },
                { type: 'bar', label: 'Entrées', data: months.map(m => m.incomes.total),
                  backgroundColor: 'rgba(16,185,129,0.8)', borderColor: '#10b981',
                  borderWidth: 1, borderRadius: 2 },
                { type: 'bar', label: 'Sorties', data: months.map(m => m.expenses.total),
                  backgroundColor: 'rgba(244,63,94,0.8)', borderColor: '#f43f5e',
                  borderWidth: 1, borderRadius: 2 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, color: '#a1a1aa',
            interaction: { mode: 'index', intersect: false },
            plugins: {
                tooltip: {
                    backgroundColor: 'rgba(24,24,27,0.95)', titleColor: '#fff', bodyColor: '#d4d4d8',
                    callbacks: { label: c => (c.dataset.label ?? '') + ': ' + formatEur(c.parsed.y) }
                },
                legend: { labels: { color: '#a1a1aa' } }
            },
            scales: {
                x: { grid: { color: '#27272a' }, ticks: { color: '#a1a1aa' } },
                y: { grid: { color: '#27272a' }, ticks: { color: '#a1a1aa', callback: v => v + ' €' } }
            }
        }
    });
}

function renderDoughnut(canvasId, instanceKey, getDetails, palette) {
    const el = document.getElementById(canvasId);
    if (!el || !state.financialData) return;
    if (state.charts[instanceKey]) state.charts[instanceKey].destroy();

    const totals = {};
    getFilteredMonths().forEach(m =>
        getDetails(m).forEach(item => {
            totals[item.category] = (totals[item.category] ?? 0) + item.amount;
        })
    );
    const cats = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);

    state.charts[instanceKey] = new Chart(el.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: cats,
            datasets: [{ data: cats.map(c => totals[c]), backgroundColor: palette, borderWidth: 0, hoverOffset: 4 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '75%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#a1a1aa', font: { size: 10 }, boxWidth: 10, padding: 8 } },
                tooltip: { callbacks: { label: c => ' ' + formatEur(c.parsed) } }
            }
        }
    });
}

export function renderCategoryChart() {
    renderDoughnut('categoryChart', 'category', m => m.expenses.details, EXPENSE_PALETTE);
}

export function renderIncomeChart() {
    renderDoughnut('incomeChart', 'income', m => m.incomes.details, INCOME_PALETTE);
}
