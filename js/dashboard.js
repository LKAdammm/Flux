// js/dashboard.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let myDocRef = null;
let initialBalance = 0; 
let myChartInstance = null;
let categoryChartInstance = null;
let financialData = null; 
let editingTransaction = null; 

const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// NOUVEAU : Catégories sobres sans emojis
const categoriesDef = {
    expenses: ['Alimentation', 'Logement', 'Transport', 'Scolarité', 'Loisirs', 'Abonnements', 'Frais bancaires', 'Autre'],
    incomes: ['Salaire', 'Bourse / Aides', 'Remboursement', 'Cadeau', 'Autre']
};

const defaultData = {
    summary: { totalIncomes: 0, totalExpenses: 0, finalBalance: 0, savingsGoal: 1000, goalName: 'Objectif', goalActive: false },
    months: [
        {
            id: 'mars-2026', name: 'Mars', year: 2026, status: 'critical',
            incomes: { total: 0, details: [] }, 
            expenses: { total: 0, details: [{label: 'Frais bancaires', amount: 124.50, day: 26, category: 'Frais bancaires'}]},
            endBalance: 0, note: "Couvert par la facilité de caisse."
        },
        {
            id: 'avril-2026', name: 'Avril', year: 2026, status: 'standard',
            incomes: { total: 0, details: [{label: 'Bourse', amount: 382, day: 3, category: 'Bourse / Aides'}, {label: 'Salaire', amount: 240, day: 3, category: 'Salaire'}]},
            expenses: { total: 0, details: [{label: 'Transport', amount: 42, day: 1, category: 'Transport'}, {label: 'Scolarité', amount: 670, day: 15, category: 'Scolarité'}]},
            endBalance: 0, note: ""
        }
    ]
};

const formatEur = (num) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);

// NOUVEAU : Fonction utilitaire pour nettoyer les anciens emojis de ta base de données à l'affichage
const cleanCategory = (cat) => cat ? cat.replace(/[\u1000-\uFFFF]+/g, '').trim() : 'Autre';

function showSaveStatus(message, classes) {
    const statusBadge = document.getElementById('save-status');
    if(!statusBadge) return;
    statusBadge.textContent = message;
    statusBadge.className = `text-[10px] px-2 py-0.5 rounded border border-zinc-800 ml-3 transition-opacity duration-300 ${classes}`;
    statusBadge.style.display = 'inline-block';
    statusBadge.style.opacity = 1;
    setTimeout(() => { statusBadge.style.opacity = 0; }, 3000);
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        myDocRef = doc(db, 'utilisateurs', user.uid);
        loadDataFromCloud();
    } else {
        window.location.href = "index.html";
    }
});

async function loadDataFromCloud() {
    if (!myDocRef) return;
    showSaveStatus('Synchronisation...', 'text-zinc-400');
    try {
        const docSnap = await getDoc(myDocRef);
        if (docSnap.exists()) {
            financialData = docSnap.data();
            if(financialData.summary.savingsGoal === undefined) financialData.summary.savingsGoal = 1000;
            if(financialData.summary.goalName === undefined) financialData.summary.goalName = 'Objectif';
            if(financialData.summary.goalActive === undefined) financialData.summary.goalActive = false;
            showSaveStatus('À jour', 'text-indigo-400');
        } else {
            financialData = JSON.parse(JSON.stringify(defaultData));
            await saveDataToCloud(); 
        }
        window.updateCategoryOptions(); 
        initFilters(); 
        updateApp(true); 
    } catch (error) {
        console.error("Erreur Firestore :", error);
    }
}

async function saveDataToCloud() {
    if (!myDocRef || !financialData) return;
    showSaveStatus('Sauvegarde...', 'text-amber-400');
    try {
        await setDoc(myDocRef, financialData);
        showSaveStatus('Sauvegardé', 'text-emerald-400');
    } catch (error) {
        console.error("Erreur :", error);
    }
}

function initFilters() {
    const startSelect = document.getElementById('filter-start');
    const endSelect = document.getElementById('filter-end');
    if(!startSelect || !financialData) return;
    
    startSelect.innerHTML = ''; endSelect.innerHTML = '';
    
    financialData.months.forEach((month, index) => {
        const option1 = document.createElement('option');
        const option2 = document.createElement('option');
        option1.value = index; option1.textContent = `${month.name} ${month.year}`;
        option1.className = "bg-zinc-950 text-zinc-200"; 
        
        option2.value = index; option2.textContent = `${month.name} ${month.year}`;
        option2.className = "bg-zinc-950 text-zinc-200"; 
        
        startSelect.appendChild(option1);
        endSelect.appendChild(option2);
    });
    
    startSelect.value = 0; 
    endSelect.value = financialData.months.length - 1; 
}

function getFilteredMonths() {
    let startIdx = parseInt(document.getElementById('filter-start').value);
    let endIdx = parseInt(document.getElementById('filter-end').value);
    
    if(startIdx > endIdx) {
        const temp = startIdx; startIdx = endIdx; endIdx = temp;
        document.getElementById('filter-start').value = startIdx;
        document.getElementById('filter-end').value = endIdx;
    }
    
    return financialData.months.slice(startIdx, endIdx + 1);
}

function recalculateState() {
    let runningBalance = initialBalance;
    if(!financialData || !financialData.months) return;

    financialData.months.forEach(month => {
        month.incomes.details.sort((a, b) => a.day - b.day);
        month.expenses.details.sort((a, b) => a.day - b.day);
        month.incomes.total = month.incomes.details.reduce((sum, item) => sum + item.amount, 0);
        month.expenses.total = month.expenses.details.reduce((sum, item) => sum + item.amount, 0);
        runningBalance += (month.incomes.total - month.expenses.total);
        month.endBalance = runningBalance;
    });
    financialData.summary.finalBalance = runningBalance;

    let filteredInc = 0; let filteredExp = 0;
    const filteredMonths = getFilteredMonths();
    filteredMonths.forEach(month => {
        filteredInc += month.incomes.total;
        filteredExp += month.expenses.total;
    });
    financialData.summary.totalIncomes = filteredInc;
    financialData.summary.totalExpenses = filteredExp;
    
    if (filteredMonths.length > 0) {
        financialData.summary.filteredBalance = filteredMonths[filteredMonths.length - 1].endBalance;
    } else {
        financialData.summary.filteredBalance = 0;
    }
}

window.updateGoal = function() {
    const isActive = document.getElementById('goal-active').checked;
    const name = document.getElementById('goal-name').value || 'Objectif';
    const amount = parseFloat(document.getElementById('goal-input').value) || 0;
    
    financialData.summary.goalActive = isActive;
    financialData.summary.goalName = name;
    financialData.summary.savingsGoal = amount;
    
    saveDataToCloud();
    renderGoal();
};

function renderGoal() {
    const goalActive = document.getElementById('goal-active');
    const goalName = document.getElementById('goal-name');
    const goalInput = document.getElementById('goal-input');
    const goalBarContainer = document.getElementById('goal-bar-container');
    const goalBar = document.getElementById('goal-bar');
    const goalPercent = document.getElementById('goal-percent');
    
    if(!goalInput || !financialData) return;
    
    goalActive.checked = financialData.summary.goalActive;
    goalName.value = financialData.summary.goalName;
    goalInput.value = financialData.summary.savingsGoal;
    
    if (financialData.summary.goalActive) {
        goalBarContainer.classList.remove('hidden');
        goalPercent.classList.remove('hidden');
        
        const currentBalance = financialData.summary.finalBalance;
        let percent = 0;
        
        if(financialData.summary.savingsGoal > 0 && currentBalance > 0) {
            percent = Math.min((currentBalance / financialData.summary.savingsGoal) * 100, 100);
        }
        
        goalPercent.textContent = `${Math.round(percent)}%`;
        goalBar.style.width = `${percent}%`;
        
        if(percent >= 100) {
            goalBar.classList.replace('bg-indigo-600', 'bg-emerald-500');
            goalPercent.classList.replace('text-indigo-400', 'text-emerald-500');
        } else {
            goalBar.classList.replace('bg-emerald-500', 'bg-indigo-600');
            goalPercent.classList.replace('text-emerald-500', 'text-indigo-400');
        }
    } else {
        goalBarContainer.classList.add('hidden');
        goalPercent.classList.add('hidden');
    }
}

function updateMonthSelectOptions() {
    const select = document.getElementById('form-month');
    if(!select || !financialData) return;
    const previousValue = select.value;
    select.innerHTML = '';
    financialData.months.forEach(month => {
        const option = document.createElement('option');
        option.value = month.id; option.textContent = `${month.name} ${month.year}`;
        select.appendChild(option);
    });
    if(previousValue) select.value = previousValue;
}

window.updateApp = function(skipSave = false) {
    recalculateState(); 
    updateMonthSelectOptions(); 
    populateKPIs(); 
    renderChart(); 
    renderCategoryChart(); 
    buildMonthlyCards(); 
    renderEditorLists();
    renderGoal();
    if(window.lucide) window.lucide.createIcons(); // Rendu des icônes SVG
    if(!skipSave) { saveDataToCloud(); } 
}

function populateKPIs() {
    if(!financialData) return;
    if(document.getElementById('kpi-incomes')) document.getElementById('kpi-incomes').textContent = formatEur(financialData.summary.totalIncomes);
    if(document.getElementById('kpi-expenses')) document.getElementById('kpi-expenses').textContent = formatEur(financialData.summary.totalExpenses);
    if(document.getElementById('kpi-balance')) document.getElementById('kpi-balance').textContent = formatEur(financialData.summary.filteredBalance);
}

function renderChart() {
    const ctxElement = document.getElementById('financeChart');
    if(!ctxElement || !financialData) return;
    const ctx = ctxElement.getContext('2d');
    if (myChartInstance) myChartInstance.destroy();
    
    const filteredMonths = getFilteredMonths();
    const labels = filteredMonths.map(m => `${m.name.substring(0,3)} ${m.year.toString().slice(-2)}`);
    const incomeData = filteredMonths.map(m => m.incomes.total);
    const expenseData = filteredMonths.map(m => m.expenses.total);
    const balanceData = filteredMonths.map(m => m.endBalance);

    // Ajustement des couleurs pour le thème Zinc Pro
    myChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { type: 'line', label: 'Solde Fin', data: balanceData, borderColor: '#6366f1', backgroundColor: '#6366f1', borderWidth: 2, pointRadius: 4, fill: false, tension: 0.3 },
                { type: 'bar', label: 'Entrées', data: incomeData, backgroundColor: 'rgba(16, 185, 129, 0.8)', borderColor: '#10b981', borderWidth: 1, borderRadius: 2 },
                { type: 'bar', label: 'Sorties', data: expenseData, backgroundColor: 'rgba(244, 63, 94, 0.8)', borderColor: '#f43f5e', borderWidth: 1, borderRadius: 2 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, color: '#a1a1aa', interaction: { mode: 'index', intersect: false },
            plugins: { tooltip: { backgroundColor: 'rgba(24, 24, 27, 0.95)', titleColor: '#fff', bodyColor: '#d4d4d8', callbacks: { label: (c) => (c.dataset.label ? c.dataset.label + ': ' : '') + formatEur(c.parsed.y) } }, legend: {labels:{color: '#a1a1aa'}} },
            scales: { x: { grid: { color: '#27272a' }, ticks: { color: '#a1a1aa' } }, y: { grid: { color: '#27272a' }, ticks: { color: '#a1a1aa', callback: function(value) { return value + ' €'; } } } }
        }
    });
}

function renderCategoryChart() {
    const ctxElement = document.getElementById('categoryChart');
    if(!ctxElement || !financialData) return;
    const ctx = ctxElement.getContext('2d');
    if (categoryChartInstance) categoryChartInstance.destroy();

    let categoryTotals = {};
    const filteredMonths = getFilteredMonths(); 
    
    filteredMonths.forEach(month => {
        month.expenses.details.forEach(exp => {
            const cat = cleanCategory(exp.category);
            if(!categoryTotals[cat]) categoryTotals[cat] = 0;
            categoryTotals[cat] += exp.amount;
        });
    });

    const sortedCategories = Object.keys(categoryTotals).sort((a, b) => categoryTotals[b] - categoryTotals[a]);
    const data = sortedCategories.map(cat => categoryTotals[cat]);
    const labels = sortedCategories;
    // Couleurs plus sobres
    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#3b82f6', '#0ea5e9'];

    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '75%',
            plugins: { 
                legend: { position: 'right', labels: { color: '#a1a1aa', font: {size: 10}, boxWidth: 10 } },
                tooltip: { callbacks: { label: (c) => ' ' + formatEur(c.parsed) } }
            }
        }
    });
}

function buildMonthlyCards() {
    const container = document.getElementById('monthly-container');
    if(!container || !financialData) return;
    container.innerHTML = ''; 
    let currentDisplayedYear = 0;
    
    const filteredMonths = getFilteredMonths();

    filteredMonths.forEach((month) => {
        if (month.year !== currentDisplayedYear) {
            container.insertAdjacentHTML('beforeend', `<div class="col-span-1 md:col-span-2 lg:col-span-3 mt-6 mb-2 flex items-center"><h2 class="text-xl font-bold text-zinc-500 mr-4 tracking-tight">${month.year}</h2><div class="h-px bg-zinc-800 flex-grow"></div></div>`);
            currentDisplayedYear = month.year;
        }

        const cardHTML = `
            <div class="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex flex-col h-full shadow-sm">
                <button class="w-full text-left px-5 py-4 flex justify-between items-center focus:outline-none bg-zinc-900 hover:bg-zinc-800/50 transition-colors" onclick="window.toggleCard('${month.id}')">
                    <div class="flex items-center"><i data-lucide="calendar" class="w-4 h-4 mr-3 text-zinc-400"></i><h3 class="font-semibold text-zinc-100">${month.name}</h3></div><i data-lucide="chevron-down" class="w-4 h-4 text-zinc-500 transform transition-transform duration-300" id="chevron-${month.id}"></i>
                </button>
                <div class="px-5 py-3 border-b border-t border-zinc-800 flex justify-between text-xs bg-zinc-950/50">
                    <span class="text-emerald-500 font-semibold">+ ${formatEur(month.incomes.total)}</span><span class="text-rose-500 font-semibold">- ${formatEur(month.expenses.total)}</span>
                </div>
                <div id="content-${month.id}" class="month-card-content bg-zinc-900/30 flex-grow">
                    <div class="p-5">
                        <div class="mb-5">
                            <h4 class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 border-b border-zinc-800 pb-1">Encaissements</h4>
                            <ul class="text-xs space-y-2">
                                ${month.incomes.details.length ? month.incomes.details.map(item => `
                                    <li class="flex justify-between items-start text-zinc-300">
                                        <div class="flex flex-col pr-2">
                                            <span class="font-medium truncate block max-w-[150px]">${item.label}</span>
                                            <span class="text-[9px] text-zinc-500 block">${cleanCategory(item.category)}</span>
                                        </div>
                                        <span class="font-medium text-emerald-400 whitespace-nowrap">${formatEur(item.amount)}</span>
                                    </li>`).join('') : '<li class="text-zinc-600 text-[10px] italic">Aucun mouvement</li>'}
                            </ul>
                        </div>
                        <div>
                            <h4 class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 border-b border-zinc-800 pb-1">Décaissements</h4>
                            <ul class="text-xs space-y-2">
                                ${month.expenses.details.length ? month.expenses.details.map(item => `
                                    <li class="flex justify-between items-start text-zinc-300">
                                        <div class="flex flex-col pr-2">
                                            <span class="font-medium truncate block max-w-[150px]">${item.label}</span>
                                            <span class="text-[9px] text-zinc-500 block">${cleanCategory(item.category)}</span>
                                        </div>
                                        <span class="font-medium text-rose-400 whitespace-nowrap">${formatEur(item.amount)}</span>
                                    </li>`).join('') : '<li class="text-zinc-600 text-[10px] italic">Aucun mouvement</li>'}
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="px-5 py-3 mt-auto bg-zinc-950 border-t border-zinc-800 flex justify-between items-center">
                    <span class="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Clôture</span>
                    <span class="font-bold text-base ${month.endBalance < 0 ? 'text-rose-500' : 'text-white'}">${formatEur(month.endBalance)}</span>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
}

function renderEditorLists() {
    const container = document.getElementById('editor-lists-container');
    if(!container || !financialData) return;
    container.innerHTML = '';
    
    financialData.months.forEach(month => {
        let html = `<div class="bg-zinc-950 p-3 rounded-md border border-zinc-800 mb-2"><h4 class="font-semibold text-zinc-300 text-xs mb-2 border-b border-zinc-800 pb-1">${month.name} ${month.year}</h4><div class="grid grid-cols-1 gap-2">`;
        html += `<div><ul class="text-[11px] space-y-1">`;
        
        month.incomes.details.forEach((item, index) => {
            html += `<li class="flex justify-between items-center bg-zinc-900 p-1.5 rounded border border-zinc-800">
                        <span class="truncate text-zinc-400 flex-grow"><span class="text-emerald-500 mr-1">+</span>${item.label} (${item.amount}€)</span>
                        <div class="flex gap-1 ml-2">
                            <button onclick="window.editTransaction('${month.id}', 'incomes', ${index})" class="text-zinc-500 hover:text-indigo-400 transition-colors"><i data-lucide="pencil" class="w-3 h-3"></i></button>
                            <button onclick="window.deleteTransaction('${month.id}', 'incomes', ${index})" class="text-zinc-500 hover:text-rose-500 transition-colors"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                        </div>
                     </li>`;
        });
        month.expenses.details.forEach((item, index) => {
            html += `<li class="flex justify-between items-center bg-zinc-900 p-1.5 rounded border border-zinc-800">
                        <span class="truncate text-zinc-400 flex-grow"><span class="text-rose-500 mr-1">-</span>${item.label} (${item.amount}€)</span>
                        <div class="flex gap-1 ml-2">
                            <button onclick="window.editTransaction('${month.id}', 'expenses', ${index})" class="text-zinc-500 hover:text-indigo-400 transition-colors"><i data-lucide="pencil" class="w-3 h-3"></i></button>
                            <button onclick="window.deleteTransaction('${month.id}', 'expenses', ${index})" class="text-zinc-500 hover:text-rose-500 transition-colors"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                        </div>
                     </li>`;
        });
        html += `</ul></div></div></div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

window.updateCategoryOptions = function() {
    const typeSelect = document.getElementById('form-type');
    const categorySelect = document.getElementById('form-category');
    if(!typeSelect || !categorySelect) return;
    categorySelect.innerHTML = '';
    const currentCategories = categoriesDef[typeSelect.value];
    currentCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat; option.textContent = cat;
        categorySelect.appendChild(option);
    });
};

window.toggleCard = function(id) {
    const content = document.getElementById(`content-${id}`);
    const chevron = document.getElementById(`chevron-${id}`);
    if(!content || !chevron) return;
    const isExpanded = content.classList.contains('active');
    if (isExpanded) { content.classList.remove('active'); chevron.style.transform = 'rotate(0deg)'; } 
    else { content.classList.add('active'); chevron.style.transform = 'rotate(180deg)'; }
};

window.editTransaction = function(monthId, type, index) {
    const month = financialData.months.find(m => m.id === monthId);
    if(!month) return;
    const item = month[type].details[index];

    document.getElementById('form-month').value = monthId;
    document.getElementById('form-type').value = type;
    window.updateCategoryOptions();
    // Nettoie l'emoji de l'ancienne donnée si besoin pour le formulaire
    document.getElementById('form-category').value = cleanCategory(item.category);
    document.getElementById('form-label').value = item.label;
    document.getElementById('form-amount').value = item.amount;
    document.getElementById('form-day').value = item.day;

    editingTransaction = { monthId, type, index };
    
    document.getElementById('form-title').innerHTML = '<i data-lucide="pencil" class="w-5 h-5 text-amber-500"></i> Éditer la transaction';
    if(window.lucide) window.lucide.createIcons();
    
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.textContent = "Mettre à jour";
    submitBtn.classList.replace('bg-indigo-600', 'bg-amber-600');
    submitBtn.classList.replace('hover:bg-indigo-500', 'hover:bg-amber-500');
    
    document.getElementById('recurring-container').classList.add('hidden');
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
};

window.cancelEdit = function() {
    editingTransaction = null;
    document.getElementById('transaction-form').reset();
    document.getElementById('form-title').innerHTML = '<i data-lucide="plus-circle" class="w-5 h-5 text-indigo-500"></i> Saisir une transaction';
    if(window.lucide) window.lucide.createIcons();

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.textContent = "Enregistrer";
    submitBtn.classList.replace('bg-amber-600', 'bg-indigo-600');
    submitBtn.classList.replace('hover:bg-amber-500', 'hover:bg-indigo-500');
    document.getElementById('recurring-container').classList.remove('hidden');
    document.getElementById('recurring-duration-container').classList.add('hidden');
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    window.updateCategoryOptions();
};

window.toggleRecurringOptions = function() {
    const container = document.getElementById('recurring-duration-container');
    if(document.getElementById('form-recurring').checked) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
};

window.addNextMonth = function(skipRender = false) {
    if(!financialData) return;
    const lastMonth = financialData.months[financialData.months.length - 1];
    const lastIndex = monthNames.findIndex(m => m.toLowerCase() === lastMonth.name.toLowerCase());
    let nextIndex = (lastIndex + 1) % 12;
    const nextName = monthNames[nextIndex];
    let nextYear = lastMonth.year;
    if (nextIndex === 0) { nextYear++; }
    const nextId = `${nextName.toLowerCase().replace('é', 'e').replace('û', 'u')}-${nextYear}`;

    financialData.months.push({
        id: nextId, name: nextName, year: nextYear, status: 'standard',
        incomes: { total: 0, details: [] }, expenses: { total: 0, details: [] }, endBalance: 0, note: ``
    });
    
    initFilters(); 
    
    if(!skipRender) {
        document.getElementById('filter-end').value = financialData.months.length - 1;
        window.updateApp();
    }
};

window.handleAddTransaction = function(e) {
    e.preventDefault();
    if(!financialData) return;
    
    const monthId = document.getElementById('form-month').value;
    const type = document.getElementById('form-type').value;
    const category = document.getElementById('form-category').value;
    const label = document.getElementById('form-label').value;
    const amount = parseFloat(document.getElementById('form-amount').value);
    const day = parseInt(document.getElementById('form-day').value);
    
    const isRecurring = document.getElementById('form-recurring') ? document.getElementById('form-recurring').checked : false;
    const recurringDuration = document.getElementById('form-recurring-duration') ? document.getElementById('form-recurring-duration').value : 'all';

    if (editingTransaction) {
        const month = financialData.months.find(m => m.id === editingTransaction.monthId);
        if (month) {
            month[editingTransaction.type].details[editingTransaction.index] = { label, amount, day, category };
        }
        window.cancelEdit(); 
    } else {
        const startIndex = financialData.months.findIndex(m => m.id === monthId);
        if (startIndex !== -1) {
            if (isRecurring) {
                let limit = financialData.months.length;
                if (recurringDuration !== 'all') {
                    limit = startIndex + parseInt(recurringDuration);
                }
                while(financialData.months.length < limit) {
                    window.addNextMonth(true); 
                }
                for (let i = startIndex; i < limit; i++) {
                    financialData.months[i][type].details.push({ label, amount, day, category });
                }
            } else {
                financialData.months[startIndex][type].details.push({ label, amount, day, category });
            }
        }
        document.getElementById('form-label').value = '';
        document.getElementById('form-amount').value = '';
        if(document.getElementById('form-recurring')) {
            document.getElementById('form-recurring').checked = false;
            window.toggleRecurringOptions();
        }
    }
    window.updateApp(); 
};

window.deleteTransaction = function(monthId, type, index) {
    if(!financialData) return;
    const month = financialData.months.find(m => m.id === monthId);
    if (month) { month[type].details.splice(index, 1); window.updateApp(); }
};

window.resetData = function() {
    if(confirm("Attention : Rétablir la base de données effacera vos données. Continuer ?")) {
        financialData = JSON.parse(JSON.stringify(defaultData));
        saveDataToCloud().then(() => { location.reload(); });
    }
};

window.exportPDF = function() {
    showSaveStatus('Export en cours...', 'text-emerald-400');
    
    const filteredMonths = getFilteredMonths();
    if(filteredMonths.length === 0) return;
    const startMonth = filteredMonths[0];
    const endMonth = filteredMonths[filteredMonths.length - 1];

    let htmlContent = `
        <div style="padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; background: white;">
            
            <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px;">
                <h1 style="color: #4f46e5; font-size: 24px; margin: 0;">Rapport Financier - Flux</h1>
                <p style="font-size: 14px; color: #6b7280; margin-top: 5px;">
                    Exercice : ${startMonth.name} ${startMonth.year} à ${endMonth.name} ${endMonth.year}<br>
                    Édité le : ${new Date().toLocaleDateString('fr-FR')}
                </p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
                <tr style="page-break-inside: avoid;">
                    <th style="border: 1px solid #e5e7eb; padding: 10px; background-color: #f9fafb; text-align: left;">Total Encaissements</th>
                    <th style="border: 1px solid #e5e7eb; padding: 10px; background-color: #f9fafb; text-align: left;">Total Décaissements</th>
                    <th style="border: 1px solid #e5e7eb; padding: 10px; background-color: #f3f4f6; text-align: left; color: #4f46e5;">Variation Nette</th>
                </tr>
                <tr style="page-break-inside: avoid;">
                    <td style="border: 1px solid #e5e7eb; padding: 10px; color: #10b981; font-weight: bold;">${formatEur(financialData.summary.totalIncomes)}</td>
                    <td style="border: 1px solid #e5e7eb; padding: 10px; color: #ef4444; font-weight: bold;">${formatEur(financialData.summary.totalExpenses)}</td>
                    <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">${formatEur(financialData.summary.filteredBalance)}</td>
                </tr>
            </table>
    `;

    filteredMonths.forEach(month => {
        htmlContent += `
            <div style="page-break-inside: avoid;">
                <h2 style="font-size: 16px; color: #111827; margin-top: 20px; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #e5e7eb;">
                    ${month.name} ${month.year}
                </h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 5px;">
                    <thead>
                        <tr style="page-break-inside: avoid;">
                            <th style="border: 1px solid #e5e7eb; padding: 8px; background: #f9fafb; text-align: left; width: 10%;">Date</th>
                            <th style="border: 1px solid #e5e7eb; padding: 8px; background: #f9fafb; text-align: left; width: 15%;">Type</th>
                            <th style="border: 1px solid #e5e7eb; padding: 8px; background: #f9fafb; text-align: left; width: 25%;">Catégorie</th>
                            <th style="border: 1px solid #e5e7eb; padding: 8px; background: #f9fafb; text-align: left; width: 35%;">Description</th>
                            <th style="border: 1px solid #e5e7eb; padding: 8px; background: #f9fafb; text-align: right; width: 15%;">Montant</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        let allTransactions = [];
        month.incomes.details.forEach(item => allTransactions.push({...item, txType: 'Encaissement'}));
        month.expenses.details.forEach(item => allTransactions.push({...item, txType: 'Décaissement'}));
        allTransactions.sort((a, b) => a.day - b.day);

        if (allTransactions.length === 0) {
            htmlContent += `<tr style="page-break-inside: avoid;"><td colspan="5" style="border: 1px solid #e5e7eb; padding: 8px; text-align: center; color: #9ca3af; font-style: italic;">Aucune transaction comptabilisée</td></tr>`;
        } else {
            allTransactions.forEach(tx => {
                const color = tx.txType === 'Encaissement' ? '#10b981' : '#ef4444';
                htmlContent += `
                    <tr style="page-break-inside: avoid;">
                        <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">${tx.day < 10 ? '0'+tx.day : tx.day}</td>
                        <td style="border: 1px solid #e5e7eb; padding: 8px; color: ${color}; font-weight: bold;">${tx.txType}</td>
                        <td style="border: 1px solid #e5e7eb; padding: 8px; color: #6b7280;">${cleanCategory(tx.category)}</td>
                        <td style="border: 1px solid #e5e7eb; padding: 8px;">${tx.label}</td>
                        <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: bold;">${formatEur(tx.amount)}</td>
                    </tr>
                `;
            });
        }

        htmlContent += `
                    </tbody>
                </table>
                <div style="text-align: right; font-size: 14px; margin-bottom: 30px; page-break-inside: avoid;">
                    <strong>Clôture ${month.name} : <span style="color: ${month.endBalance < 0 ? '#ef4444' : '#4f46e5'}">${formatEur(month.endBalance)}</span></strong>
                </div>
            </div>
        `;
    });

    htmlContent += `</div>`;

    const printDiv = document.createElement('div');
    printDiv.innerHTML = htmlContent;

    const opt = {
      margin:       10,
      filename:     `Flux_Rapport_${new Date().toISOString().slice(0,10)}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      pagebreak:    { mode: ['css', 'avoid-all'] }, 
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(printDiv).save().then(() => {
        showSaveStatus('Terminé', 'text-indigo-400');
    });
};

window.logout = async function() {
    await signOut(auth);
    window.location.href = "index.html";
};