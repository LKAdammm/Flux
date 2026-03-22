// js/dashboard.js
import { supabase } from './supabase-config.js';

// ─── État global ────────────────────────────────────────────────────────────
let financialData = null;
let myChartInstance = null;
let categoryChartInstance = null;
let incomeChartInstance = null;
let editingTransaction = null;
let drawerOpen = false;

const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const categoriesDef = {
    expenses: ['Alimentation', 'Logement', 'Transport', 'Scolarité', 'Loisirs', 'Abonnements', 'Frais bancaires', 'Autre'],
    incomes:  ['Salaire', 'Bourse / Aides', 'Remboursement', 'Cadeau', 'Freelance', 'Autre']
};

// ─── Auth guard ──────────────────────────────────────────────────────────────
supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
        window.location.href = 'index.html';
    } else {
        loadData(session.user.id);
    }
});

supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
});

// ─── Données par défaut ──────────────────────────────────────────────────────
function generateDefaultData() {
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

function slugifyMonth(name, year) {
    return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-') + '-' + year;
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────
const formatEur = (n) => new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 2
}).format(n);

function sanitize(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function showSaveStatus(message, classes) {
    const el = document.getElementById('save-status');
    if (!el) return;
    el.textContent = message;
    el.className = `text-[10px] px-2 py-0.5 rounded border border-zinc-800 ml-3 font-medium transition-opacity duration-300 ${classes}`;
    el.style.display = 'inline-block';
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

// ─── Data layer (Supabase) ───────────────────────────────────────────────────
let currentUserId = null;

async function loadData(userId) {
    currentUserId = userId;
    showSaveStatus('Synchronisation...', 'text-zinc-400');

    const { data, error } = await supabase
        .from('user_data')
        .select('data')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Erreur chargement :', error);
        showSaveStatus('Erreur de chargement', 'text-rose-400');
        return;
    }

    if (data) {
        financialData = data.data;
        financialData.summary.savingsGoal  ??= 1000;
        financialData.summary.goalName     ??= 'Objectif';
        financialData.summary.goalActive   ??= false;
        showSaveStatus('À jour', 'text-indigo-400');
    } else {
        financialData = generateDefaultData();
        await saveData();
    }

    window.updateCategoryOptions();
    initFilters();
    updateApp(true);
}

async function saveData() {
    if (!currentUserId || !financialData) return;
    showSaveStatus('Sauvegarde...', 'text-amber-400');

    const { error } = await supabase
        .from('user_data')
        .upsert({ user_id: currentUserId, data: financialData }, { onConflict: 'user_id' });

    if (error) {
        console.error('Erreur sauvegarde :', error);
        showSaveStatus('Erreur de sauvegarde', 'text-rose-400');
    } else {
        showSaveStatus('Sauvegardé', 'text-emerald-400');
    }
}

// ─── Filtres ─────────────────────────────────────────────────────────────────
function initFilters() {
    const s = document.getElementById('filter-start');
    const e = document.getElementById('filter-end');
    if (!s || !financialData) return;
    s.innerHTML = ''; e.innerHTML = '';
    financialData.months.forEach((month, i) => {
        const label = `${month.name} ${month.year}`;
        s.appendChild(new Option(label, i));
        e.appendChild(new Option(label, i));
    });
    s.value = 0;
    e.value = financialData.months.length - 1;
}

function getFilteredMonths() {
    let start = parseInt(document.getElementById('filter-start').value);
    let end   = parseInt(document.getElementById('filter-end').value);
    if (start > end) {
        [start, end] = [end, start];
        document.getElementById('filter-start').value = start;
        document.getElementById('filter-end').value   = end;
    }
    return financialData.months.slice(start, end + 1);
}

// ─── Recalcul ─────────────────────────────────────────────────────────────────
function recalculateState() {
    if (!financialData?.months) return;
    let running = 0;
    financialData.months.forEach(month => {
        month.incomes.details.sort((a, b) => a.day - b.day);
        month.expenses.details.sort((a, b) => a.day - b.day);
        month.incomes.total  = month.incomes.details.reduce((s, i) => s + i.amount, 0);
        month.expenses.total = month.expenses.details.reduce((s, i) => s + i.amount, 0);
        running += month.incomes.total - month.expenses.total;
        month.endBalance = running;
    });
    financialData.summary.finalBalance = running;

    const filtered = getFilteredMonths();
    financialData.summary.totalIncomes  = filtered.reduce((s, m) => s + m.incomes.total, 0);
    financialData.summary.totalExpenses = filtered.reduce((s, m) => s + m.expenses.total, 0);
    financialData.summary.filteredBalance = filtered.length
        ? filtered[filtered.length - 1].endBalance : 0;
}

// ─── Objectif (lié au filtre période) ─────────────────────────────────────────
window.updateGoal = function () {
    financialData.summary.goalActive   = document.getElementById('goal-active').checked;
    financialData.summary.goalName     = document.getElementById('goal-name').value || 'Objectif';
    financialData.summary.savingsGoal  = parseFloat(document.getElementById('goal-input').value) || 0;
    saveData();
    renderGoal();
};

function renderGoal() {
    const bar       = document.getElementById('goal-bar');
    const barWrap   = document.getElementById('goal-bar-container');
    const pct       = document.getElementById('goal-percent');
    const nameInput = document.getElementById('goal-name');
    const amtInput  = document.getElementById('goal-input');
    const activeChk = document.getElementById('goal-active');
    if (!bar || !financialData) return;

    const isActive = financialData.summary.goalActive;
    activeChk.checked = isActive;
    nameInput.value   = financialData.summary.goalName;
    amtInput.value    = financialData.summary.savingsGoal;

    if (isActive) {
        barWrap.classList.remove('hidden');
        pct.classList.remove('hidden');
        // Utilise le solde de la période filtrée, pas le solde global
        const balance = financialData.summary.filteredBalance;
        const goal    = financialData.summary.savingsGoal;
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

// ─── Sélecteur mois du formulaire ────────────────────────────────────────────
function updateMonthSelectOptions() {
    const sel = document.getElementById('form-month');
    if (!sel || !financialData) return;
    const prev = sel.value;
    sel.innerHTML = '';
    financialData.months.forEach(m => {
        sel.appendChild(new Option(`${m.name} ${m.year}`, m.id));
    });
    if (prev) sel.value = prev;
}

// ─── App update ──────────────────────────────────────────────────────────────
window.updateApp = function (skipSave = false) {
    recalculateState();
    updateMonthSelectOptions();
    populateKPIs();
    renderChart();
    renderCategoryChart();
    renderIncomeChart();
    buildMonthlyCards();
    renderEditorLists();
    renderGoal();
    if (window.lucide) window.lucide.createIcons();
    if (!skipSave) saveData();
};

// ─── KPIs ─────────────────────────────────────────────────────────────────────
function populateKPIs() {
    if (!financialData) return;
    const inc = financialData.summary.totalIncomes;
    const exp = financialData.summary.totalExpenses;

    document.getElementById('kpi-incomes').textContent  = formatEur(inc);
    document.getElementById('kpi-expenses').textContent = formatEur(exp);
    document.getElementById('kpi-balance').textContent  = formatEur(financialData.summary.filteredBalance);

    // Taux d'épargne
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

    // Comparaison mois précédent
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
    if (!el || previous === 0) { if (el) el.textContent = ''; return; }
    const pct   = Math.round(((current - previous) / previous) * 100);
    const up    = pct >= 0;
    const good  = invert ? !up : up;
    const arrow = up ? '\u2191' : '\u2193';
    el.textContent = `${arrow} ${Math.abs(pct)}%`;
    el.className   = `text-[10px] font-semibold ${good ? 'text-emerald-500' : 'text-rose-500'}`;
}

// ─── Graphiques ───────────────────────────────────────────────────────────────
function renderChart() {
    const el = document.getElementById('financeChart');
    if (!el || !financialData) return;
    if (myChartInstance) myChartInstance.destroy();
    const months = getFilteredMonths();
    myChartInstance = new Chart(el.getContext('2d'), {
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
                tooltip: { backgroundColor: 'rgba(24,24,27,0.95)', titleColor: '#fff',
                    bodyColor: '#d4d4d8',
                    callbacks: { label: c => (c.dataset.label ?? '') + ': ' + formatEur(c.parsed.y) } },
                legend: { labels: { color: '#a1a1aa' } }
            },
            scales: {
                x: { grid: { color: '#27272a' }, ticks: { color: '#a1a1aa' } },
                y: { grid: { color: '#27272a' }, ticks: { color: '#a1a1aa', callback: v => v + ' €' } }
            }
        }
    });
}

function renderCategoryChart() {
    const el = document.getElementById('categoryChart');
    if (!el || !financialData) return;
    if (categoryChartInstance) categoryChartInstance.destroy();
    const totals = {};
    getFilteredMonths().forEach(m =>
        m.expenses.details.forEach(e => {
            totals[e.category] = (totals[e.category] ?? 0) + e.amount;
        })
    );
    const cats   = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
    const colors = ['#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#3b82f6','#0ea5e9'];
    categoryChartInstance = new Chart(el.getContext('2d'), {
        type: 'doughnut',
        data: { labels: cats, datasets: [{ data: cats.map(c => totals[c]),
            backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '75%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#a1a1aa', font: { size: 10 }, boxWidth: 10, padding: 8 } },
                tooltip: { callbacks: { label: c => ' ' + formatEur(c.parsed) } }
            }
        }
    });
}

function renderIncomeChart() {
    const el = document.getElementById('incomeChart');
    if (!el || !financialData) return;
    if (incomeChartInstance) incomeChartInstance.destroy();
    const totals = {};
    getFilteredMonths().forEach(m =>
        m.incomes.details.forEach(i => {
            totals[i.category] = (totals[i.category] ?? 0) + i.amount;
        })
    );
    const cats   = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
    const colors = ['#10b981','#34d399','#6ee7b7','#a7f3d0','#059669','#047857','#065f46','#064e3b'];
    incomeChartInstance = new Chart(el.getContext('2d'), {
        type: 'doughnut',
        data: { labels: cats, datasets: [{ data: cats.map(c => totals[c]),
            backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '75%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#a1a1aa', font: { size: 10 }, boxWidth: 10, padding: 8 } },
                tooltip: { callbacks: { label: c => ' ' + formatEur(c.parsed) } }
            }
        }
    });
}

// ─── Cartes mensuelles ────────────────────────────────────────────────────────
function buildMonthlyCards() {
    const container = document.getElementById('monthly-container');
    if (!container || !financialData) return;
    container.innerHTML = '';
    let lastYear = 0;
    getFilteredMonths().forEach(month => {
        if (month.year !== lastYear) {
            container.insertAdjacentHTML('beforeend',
                `<div class="col-span-1 md:col-span-2 lg:col-span-3 mt-4 mb-1 flex items-center gap-3">
                    <h2 class="text-base font-bold text-zinc-500">${month.year}</h2>
                    <div class="h-px bg-zinc-800 flex-grow"></div>
                 </div>`);
            lastYear = month.year;
        }

        const incRows = month.incomes.details.length
            ? month.incomes.details.map(item => `
                <li class="flex items-start gap-2.5 text-zinc-300">
                    <span class="text-[10px] font-mono font-semibold text-zinc-500 bg-zinc-800 rounded px-1.5 py-0.5 shrink-0 mt-0.5 min-w-[2rem] text-center">${String(item.day).padStart(2,'0')}</span>
                    <div class="min-w-0 flex-1">
                        <span class="font-medium text-xs block truncate">${sanitize(item.label)}</span>
                        <span class="text-[10px] text-zinc-500 block">${sanitize(item.category)}</span>
                    </div>
                    <span class="font-medium text-emerald-400 whitespace-nowrap text-xs shrink-0">${formatEur(item.amount)}</span>
                </li>`).join('')
            : '<li class="text-zinc-600 text-[10px] italic">Aucun mouvement</li>';

        const expRows = month.expenses.details.length
            ? month.expenses.details.map(item => `
                <li class="flex items-start gap-2.5 text-zinc-300">
                    <span class="text-[10px] font-mono font-semibold text-zinc-500 bg-zinc-800 rounded px-1.5 py-0.5 shrink-0 mt-0.5 min-w-[2rem] text-center">${String(item.day).padStart(2,'0')}</span>
                    <div class="min-w-0 flex-1">
                        <span class="font-medium text-xs block truncate">${sanitize(item.label)}</span>
                        <span class="text-[10px] text-zinc-500 block">${sanitize(item.category)}</span>
                    </div>
                    <span class="font-medium text-rose-400 whitespace-nowrap text-xs shrink-0">${formatEur(item.amount)}</span>
                </li>`).join('')
            : '<li class="text-zinc-600 text-[10px] italic">Aucun mouvement</li>';

        container.insertAdjacentHTML('beforeend', `
            <div class="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex flex-col shadow-sm group">
                <div class="w-full text-left px-4 py-3.5 flex justify-between items-center bg-zinc-900 hover:bg-zinc-800/50 transition-colors cursor-pointer select-none"
                     onclick="window.toggleCard('${month.id}')">
                    <div class="flex items-center gap-2.5">
                        <i data-lucide="calendar" class="w-4 h-4 text-zinc-500 shrink-0"></i>
                        <h3 class="font-semibold text-zinc-100 text-sm">${sanitize(month.name)}</h3>
                    </div>
                    <div class="flex items-center gap-2">
                        <span onclick="event.stopPropagation(); window.deleteMonth('${month.id}')"
                              class="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-rose-500 transition-all rounded hover:bg-zinc-800 cursor-pointer"
                              title="Supprimer ce mois">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </span>
                        <i data-lucide="chevron-down" class="w-4 h-4 text-zinc-500 transition-transform duration-300" id="chevron-${month.id}"></i>
                    </div>
                </div>
                <div class="px-4 py-2 border-y border-zinc-800 flex justify-between bg-zinc-950/50 text-xs">
                    <span class="text-emerald-500 font-semibold">+ ${formatEur(month.incomes.total)}</span>
                    <span class="text-rose-500 font-semibold">- ${formatEur(month.expenses.total)}</span>
                </div>
                <div id="content-${month.id}" class="month-card-content">
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
            </div>`);
    });
}

// ─── Suppression de mois ──────────────────────────────────────────────────────
window.deleteMonth = function (monthId) {
    if (!financialData) return;
    if (financialData.months.length <= 1) {
        alert('Impossible de supprimer le dernier mois restant.');
        return;
    }
    const month = financialData.months.find(m => m.id === monthId);
    if (!month) return;
    const hasTx = month.incomes.details.length + month.expenses.details.length;
    const msg = hasTx
        ? `Supprimer ${month.name} ${month.year} et ses ${hasTx} transaction(s) ?`
        : `Supprimer ${month.name} ${month.year} ?`;
    if (!confirm(msg)) return;
    financialData.months = financialData.months.filter(m => m.id !== monthId);
    initFilters();
    document.getElementById('filter-end').value = financialData.months.length - 1;
    window.updateApp();
};

// ─── Liste d'édition rapide (design amélioré) ─────────────────────────────────
function renderEditorLists() {
    const container = document.getElementById('editor-lists-container');
    if (!container || !financialData) return;
    container.innerHTML = '';

    if (financialData.months.every(m => !m.incomes.details.length && !m.expenses.details.length)) {
        container.innerHTML = '<p class="text-zinc-600 text-xs italic text-center py-4">Aucune transaction saisie</p>';
        return;
    }

    financialData.months.forEach(month => {
        const all = [
            ...month.incomes.details.map((item, i) => ({ ...item, type: 'incomes', index: i })),
            ...month.expenses.details.map((item, i) => ({ ...item, type: 'expenses', index: i }))
        ];
        if (!all.length) return;

        let rows = all.map(item => `
            <li class="flex items-center justify-between gap-2 px-3 py-2 hover:bg-zinc-800/50 transition-colors rounded-md">
                <div class="min-w-0 flex-1 flex items-center gap-2">
                    <span class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0
                        ${item.type === 'incomes'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-rose-500/10 text-rose-500'}">
                        ${item.type === 'incomes' ? '+' : '−'}
                    </span>
                    <span class="text-zinc-200 text-xs truncate">${sanitize(item.label)}</span>
                    <span class="text-zinc-600 text-[10px] font-mono shrink-0">${formatEur(item.amount)}</span>
                </div>
                <div class="flex gap-0.5 shrink-0">
                    <button onclick="window.editTransaction('${month.id}','${item.type}',${item.index})"
                            class="p-1.5 text-zinc-500 hover:text-indigo-400 transition-colors rounded hover:bg-zinc-700">
                        <i data-lucide="pencil" class="w-3 h-3"></i>
                    </button>
                    <button onclick="window.deleteTransaction('${month.id}','${item.type}',${item.index})"
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

// ─── Drawer (panneau coulissant) ──────────────────────────────────────────────
window.toggleDrawer = function () {
    drawerOpen = !drawerOpen;
    const drawer   = document.getElementById('transaction-drawer');
    const overlay  = document.getElementById('drawer-overlay');
    if (!drawer) return;
    if (drawerOpen) {
        drawer.classList.remove('translate-x-full');
        drawer.classList.add('translate-x-0');
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('opacity-100'), 10);
    } else {
        drawer.classList.add('translate-x-full');
        drawer.classList.remove('translate-x-0');
        overlay.classList.remove('opacity-100');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
};

window.closeDrawer = function () {
    if (drawerOpen) window.toggleDrawer();
};

// ─── Interactions ─────────────────────────────────────────────────────────────
window.updateCategoryOptions = function () {
    const type = document.getElementById('form-type');
    const cat  = document.getElementById('form-category');
    if (!type || !cat) return;
    cat.innerHTML = '';
    categoriesDef[type.value].forEach(c => cat.appendChild(new Option(c, c)));
};

window.toggleCard = function (id) {
    const content = document.getElementById(`content-${id}`);
    const chevron = document.getElementById(`chevron-${id}`);
    if (!content) return;
    const isOpen = content.classList.contains('active');
    content.classList.toggle('active', !isOpen);
    if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
};

window.editTransaction = function (monthId, type, index) {
    const month = financialData.months.find(m => m.id === monthId);
    if (!month) return;
    const item = month[type].details[index];

    // Ouvrir le drawer si fermé
    if (!drawerOpen) window.toggleDrawer();

    document.getElementById('form-month').value    = monthId;
    document.getElementById('form-type').value     = type;
    window.updateCategoryOptions();
    document.getElementById('form-category').value = item.category;
    document.getElementById('form-label').value    = item.label;
    document.getElementById('form-amount').value   = item.amount;
    document.getElementById('form-day').value      = item.day;

    editingTransaction = { monthId, type, index };

    document.getElementById('form-title').innerHTML =
        '<i data-lucide="pencil" class="w-4 h-4 text-amber-500"></i> Éditer la transaction';
    if (window.lucide) window.lucide.createIcons();

    const btn = document.getElementById('submit-btn');
    btn.textContent = 'Mettre à jour';
    btn.className = btn.className
        .replace('bg-indigo-600', 'bg-amber-600')
        .replace('hover:bg-indigo-500', 'hover:bg-amber-500');

    document.getElementById('recurring-container').classList.add('hidden');
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
};

window.cancelEdit = function () {
    editingTransaction = null;
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
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    window.updateCategoryOptions();
};

window.toggleRecurringOptions = function () {
    const isCustom = document.getElementById('form-recurring').checked;
    document.getElementById('recurring-duration-container').classList.toggle('hidden', !isCustom);
    // Quand on active la récurrence, afficher les options de fréquence
    const freqContainer = document.getElementById('recurring-freq-container');
    if (freqContainer) freqContainer.classList.toggle('hidden', !isCustom);
};

window.addNextMonth = function (skipRender = false) {
    if (!financialData) return;
    const last     = financialData.months[financialData.months.length - 1];
    const lastIdx  = monthNames.findIndex(m => m === last.name);
    const nextIdx  = (lastIdx + 1) % 12;
    const nextName = monthNames[nextIdx];
    const nextYear = nextIdx === 0 ? last.year + 1 : last.year;
    const nextId   = slugifyMonth(nextName, nextYear);

    if (financialData.months.some(m => m.id === nextId)) return;

    financialData.months.push({
        id: nextId, name: nextName, year: nextYear, status: 'standard',
        incomes: { total: 0, details: [] }, expenses: { total: 0, details: [] },
        endBalance: 0, note: ''
    });

    initFilters();
    if (!skipRender) {
        document.getElementById('filter-end').value = financialData.months.length - 1;
        window.updateApp();
    }
};

window.handleAddTransaction = function (e) {
    e.preventDefault();
    if (!financialData) return;

    const monthId  = document.getElementById('form-month').value;
    const type     = document.getElementById('form-type').value;
    const category = document.getElementById('form-category').value;
    const label    = document.getElementById('form-label').value.trim();
    const amount   = parseFloat(document.getElementById('form-amount').value);
    const day      = parseInt(document.getElementById('form-day').value);

    if (!label || isNaN(amount) || amount <= 0 || isNaN(day) || day < 1 || day > 31) {
        alert('Vérifiez les champs : montant > 0, jour entre 1 et 31, description requise.');
        return;
    }

    if (editingTransaction) {
        const month = financialData.months.find(m => m.id === editingTransaction.monthId);
        if (month) month[editingTransaction.type].details[editingTransaction.index] = { label, amount, day, category };
        window.cancelEdit();
    } else {
        const isRecurring = document.getElementById('form-recurring')?.checked ?? false;
        const duration    = document.getElementById('form-recurring-duration')?.value ?? 'all';
        const frequency   = parseInt(document.getElementById('form-recurring-freq')?.value ?? '1');
        const startIdx    = financialData.months.findIndex(m => m.id === monthId);

        if (startIdx !== -1) {
            if (isRecurring) {
                let endIdx;
                if (duration === 'all') {
                    endIdx = financialData.months.length;
                } else if (duration === 'custom') {
                    const customMonths = parseInt(document.getElementById('form-recurring-custom')?.value ?? '3');
                    endIdx = startIdx + customMonths;
                } else {
                    endIdx = startIdx + parseInt(duration);
                }
                // Créer les mois manquants
                while (financialData.months.length < endIdx) window.addNextMonth(true);
                // Appliquer avec la fréquence
                for (let i = startIdx; i < endIdx; i += frequency) {
                    financialData.months[i][type].details.push({ label, amount, day, category });
                }
            } else {
                financialData.months[startIdx][type].details.push({ label, amount, day, category });
            }
        }

        document.getElementById('form-label').value  = '';
        document.getElementById('form-amount').value = '';
        if (document.getElementById('form-recurring')) {
            document.getElementById('form-recurring').checked = false;
            window.toggleRecurringOptions();
        }
    }
    window.updateApp();
};

window.deleteTransaction = function (monthId, type, index) {
    if (!financialData) return;
    if (!confirm('Supprimer cette transaction ?')) return;
    const month = financialData.months.find(m => m.id === monthId);
    if (month) { month[type].details.splice(index, 1); window.updateApp(); }
};

window.resetData = function () {
    if (!confirm('Réinitialiser toutes les données ? Cette action est irréversible.')) return;
    financialData = generateDefaultData();
    saveData().then(() => location.reload());
};

// ─── Export PDF ───────────────────────────────────────────────────────────────
window.exportPDF = function () {
    showSaveStatus('Export en cours...', 'text-emerald-400');
    const filtered = getFilteredMonths();
    if (!filtered.length) return;
    const start = filtered[0];
    const end   = filtered[filtered.length - 1];

    let html = `
        <div style="padding:20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1f2937;background:white;">
            <div style="border-bottom:2px solid #e5e7eb;padding-bottom:10px;margin-bottom:20px;">
                <h1 style="color:#4f46e5;font-size:24px;margin:0;">Rapport Financier — Flux</h1>
                <p style="font-size:13px;color:#6b7280;margin-top:5px;">
                    Exercice : ${sanitize(start.name)} ${start.year} → ${sanitize(end.name)} ${end.year}<br>
                    Édité le : ${new Date().toLocaleDateString('fr-FR')}
                </p>
            </div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
                <tr>
                    <th style="border:1px solid #e5e7eb;padding:9px;background:#f9fafb;text-align:left;">Total Encaissements</th>
                    <th style="border:1px solid #e5e7eb;padding:9px;background:#f9fafb;text-align:left;">Total Décaissements</th>
                    <th style="border:1px solid #e5e7eb;padding:9px;background:#f3f4f6;text-align:left;color:#4f46e5;">Trésorerie Nette</th>
                </tr>
                <tr>
                    <td style="border:1px solid #e5e7eb;padding:9px;color:#10b981;font-weight:bold;">${formatEur(financialData.summary.totalIncomes)}</td>
                    <td style="border:1px solid #e5e7eb;padding:9px;color:#ef4444;font-weight:bold;">${formatEur(financialData.summary.totalExpenses)}</td>
                    <td style="border:1px solid #e5e7eb;padding:9px;font-weight:bold;">${formatEur(financialData.summary.filteredBalance)}</td>
                </tr>
            </table>`;

    filtered.forEach(month => {
        const txs = [
            ...month.incomes.details.map(i => ({ ...i, txType: 'Encaissement' })),
            ...month.expenses.details.map(i => ({ ...i, txType: 'Décaissement' }))
        ].sort((a, b) => a.day - b.day);

        const rows = txs.length
            ? txs.map(tx => `
                <tr>
                    <td style="border:1px solid #e5e7eb;padding:7px;text-align:center;">${String(tx.day).padStart(2,'0')}</td>
                    <td style="border:1px solid #e5e7eb;padding:7px;color:${tx.txType==='Encaissement'?'#10b981':'#ef4444'};font-weight:bold;">${tx.txType}</td>
                    <td style="border:1px solid #e5e7eb;padding:7px;color:#6b7280;">${sanitize(tx.category)}</td>
                    <td style="border:1px solid #e5e7eb;padding:7px;">${sanitize(tx.label)}</td>
                    <td style="border:1px solid #e5e7eb;padding:7px;text-align:right;font-weight:bold;">${formatEur(tx.amount)}</td>
                </tr>`).join('')
            : `<tr><td colspan="5" style="border:1px solid #e5e7eb;padding:7px;text-align:center;color:#9ca3af;font-style:italic;">Aucune transaction</td></tr>`;

        html += `
            <div style="page-break-inside:avoid;">
                <h2 style="font-size:15px;color:#111827;margin:20px 0 8px;padding-bottom:5px;border-bottom:1px solid #e5e7eb;">
                    ${sanitize(month.name)} ${month.year}
                </h2>
                <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:5px;">
                    <thead>
                        <tr>
                            <th style="border:1px solid #e5e7eb;padding:7px;background:#f9fafb;text-align:left;width:8%;">Jour</th>
                            <th style="border:1px solid #e5e7eb;padding:7px;background:#f9fafb;text-align:left;width:15%;">Type</th>
                            <th style="border:1px solid #e5e7eb;padding:7px;background:#f9fafb;text-align:left;width:22%;">Catégorie</th>
                            <th style="border:1px solid #e5e7eb;padding:7px;background:#f9fafb;text-align:left;width:40%;">Description</th>
                            <th style="border:1px solid #e5e7eb;padding:7px;background:#f9fafb;text-align:right;width:15%;">Montant</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <div style="text-align:right;font-size:13px;margin-bottom:24px;">
                    <strong>Clôture ${sanitize(month.name)} : <span style="color:${month.endBalance<0?'#ef4444':'#4f46e5'}">${formatEur(month.endBalance)}</span></strong>
                </div>
            </div>`;
    });

    html += '</div>';
    const div = document.createElement('div');
    div.innerHTML = html;

    html2pdf().set({
        margin: 10,
        filename: `Flux_Rapport_${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        pagebreak: { mode: ['css', 'avoid-all'] },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(div).save().then(() => showSaveStatus('Terminé', 'text-indigo-400'));
};

// ─── Déconnexion ──────────────────────────────────────────────────────────────
window.logout = async function () {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
};
