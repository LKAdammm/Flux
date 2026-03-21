// js/dashboard.js

// 1. Importations depuis notre configuration centrale
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 2. Variables globales
let myDocRef = null;
let initialBalance = 0; 
let myChartInstance = null;
let financialData = null; 
const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// 3. Les données par défaut (Utiles quand un NOUVEL utilisateur s'inscrit)
const defaultData = {
    summary: { totalIncomes: 0, totalExpenses: 0, finalBalance: 0 },
    months: [
        {
            id: 'mars-2026', name: 'Mars', year: 2026, status: 'critical',
            incomes: { total: 0, details: [] }, 
            expenses: { total: 0, details: [{label: '⚠️ PayPal (Ancien)', amount: 124.50, day: 26}]},
            endBalance: 0, note: "Couvert par le découvert."
        },
        {
            id: 'avril-2026', name: 'Avril', year: 2026, status: 'standard',
            incomes: { total: 0, details: [
                {label: 'Bourse CROUS', amount: 382, day: 3}, {label: 'Salaire (Prorata 25h)', amount: 240, day: 3}, {label: 'Versement Prêt', amount: 2000, day: 5}
            ]},
            expenses: { total: 0, details: [
                {label: 'Navigo', amount: 42, day: 1}, {label: 'Remb. Ami', amount: 160, day: 5}, {label: 'Dépenses', amount: 50, day: 10},
                {label: 'SFR', amount: 15, day: 13}, {label: 'EFREI', amount: 670, day: 15}, {label: 'PayPal (4x)', amount: 160, day: 16}, {label: 'PayPal (Ancien)', amount: 124.50, day: 25}
            ]},
            endBalance: 0, note: "Arrivée du prêt."
        },
        {
            id: 'mai-2026', name: 'Mai', year: 2026, status: 'standard',
            incomes: { total: 0, details: [{label: 'Bourse CROUS', amount: 382, day: 3}, {label: 'Salaire', amount: 416, day: 3}, {label: 'Bonus LCL', amount: 150, day: 15}]},
            expenses: { total: 0, details: [
                {label: 'Navigo', amount: 42, day: 1}, {label: 'Prêt LCL', amount: 34.18, day: 5}, {label: 'Dépenses', amount: 50, day: 10},
                {label: 'SFR', amount: 15, day: 13}, {label: 'EFREI', amount: 670, day: 15}, {label: 'PayPal (4x)', amount: 160, day: 16}, {label: 'PayPal (Ancien) - FIN', amount: 124.50, day: 24}
            ]},
            endBalance: 0, note: ""
        },
        {
            id: 'juin-2026', name: 'Juin', year: 2026, status: 'landing',
            incomes: { total: 0, details: [{label: 'Bourse CROUS', amount: 382, day: 3}, {label: 'Salaire', amount: 416, day: 3}]},
            expenses: { total: 0, details: [
                {label: 'Navigo', amount: 42, day: 1}, {label: 'Prêt LCL', amount: 34.18, day: 5}, {label: 'Dépenses', amount: 50, day: 10},
                {label: 'SFR', amount: 15, day: 13}, {label: 'EFREI - FIN', amount: 670, day: 15}, {label: 'PayPal (4x) - FIN', amount: 160, day: 16}
            ]},
            endBalance: 0, note: "Fin EFREI."
        },
        {
            id: 'juillet-2026', name: 'Juillet', year: 2026, status: 'savings',
            incomes: { total: 0, details: [{label: 'Salaire', amount: 416, day: 3}]},
            expenses: { total: 0, details: [{label: 'Navigo', amount: 42, day: 1}, {label: 'Prêt LCL', amount: 34.18, day: 5}, {label: 'Dépenses', amount: 50, day: 10}, {label: 'SFR', amount: 15, day: 13}]},
            endBalance: 0, note: "Épargne."
        },
        {
            id: 'aout-2026', name: 'Août', year: 2026, status: 'savings',
            incomes: { total: 0, details: [{label: 'Salaire', amount: 416, day: 3}]},
            expenses: { total: 0, details: [{label: 'Navigo', amount: 42, day: 1}, {label: 'Prêt LCL', amount: 34.18, day: 5}, {label: 'Dépenses', amount: 50, day: 10}, {label: 'SFR', amount: 15, day: 13}]},
            endBalance: 0, note: "Épargne."
        }
    ]
};

const formatEur = (num) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);

function showSaveStatus(message, classes) {
    const statusBadge = document.getElementById('save-status');
    if(!statusBadge) return;
    statusBadge.textContent = message;
    statusBadge.className = `text-xs px-2 py-0.5 rounded border ml-3 transition-opacity duration-300 ${classes}`;
    statusBadge.style.display = 'inline-block';
    statusBadge.style.opacity = 1;
    setTimeout(() => { statusBadge.style.opacity = 0; }, 3000);
}

// --- 4. LE VIGILE : AUTHENTIFICATION & LIAISON DE LA BASE DE DONNÉES ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Connecté :", user.email);
        // MAGIE : On crée un lien unique vers le coffre-fort de CET utilisateur !
        myDocRef = doc(db, 'utilisateurs', user.uid);
        loadDataFromCloud();
    } else {
        // Retour à la page de connexion si non connecté
        window.location.href = "index.html";
    }
});

// --- 5. FONCTIONS CLOUD (Lecture & Écriture) ---
async function loadDataFromCloud() {
    if (!myDocRef) return;
    showSaveStatus('Connexion...', 'text-stone-400 border-stone-600 bg-stone-800');
    try {
        const docSnap = await getDoc(myDocRef);
        if (docSnap.exists()) {
            // L'utilisateur a déjà des données, on les charge
            financialData = docSnap.data();
            showSaveStatus('À jour', 'text-indigo-400 border-indigo-800 bg-indigo-900/50');
        } else {
            // L'utilisateur est nouveau, on initialise son compte avec les données par défaut
            financialData = JSON.parse(JSON.stringify(defaultData));
            await saveDataToCloud(); 
        }
        updateApp(true); 
    } catch (error) {
        console.error("Erreur Firestore :", error);
        showSaveStatus('Erreur connexion', 'text-rose-400 border-rose-800 bg-rose-900/50');
    }
}

async function saveDataToCloud() {
    if (!myDocRef || !financialData) return;
    showSaveStatus('Sauvegarde...', 'text-amber-400 border-amber-800 bg-amber-900/50');
    try {
        await setDoc(myDocRef, financialData);
        showSaveStatus('Sauvegardé', 'text-emerald-400 border-emerald-800 bg-emerald-900/50');
    } catch (error) {
        console.error("Erreur sauvegarde :", error);
        showSaveStatus('Échec sauvegarde', 'text-rose-400 border-rose-800 bg-rose-900/50');
    }
}

// --- 6. LOGIQUE MÉTIER & CALCULS ---
function recalculateState() {
    let runningBalance = initialBalance;
    let globalInc = 0; let globalExp = 0;
    if(!financialData || !financialData.months) return;

    financialData.months.forEach(month => {
        month.incomes.details.sort((a, b) => a.day - b.day);
        month.expenses.details.sort((a, b) => a.day - b.day);
        month.incomes.total = month.incomes.details.reduce((sum, item) => sum + item.amount, 0);
        month.expenses.total = month.expenses.details.reduce((sum, item) => sum + item.amount, 0);
        runningBalance += (month.incomes.total - month.expenses.total);
        month.endBalance = runningBalance;
        globalInc += month.incomes.total; globalExp += month.expenses.total;
    });
    financialData.summary.totalIncomes = globalInc;
    financialData.summary.totalExpenses = globalExp;
    financialData.summary.finalBalance = runningBalance;
}

function updateMonthSelectOptions() {
    const select = document.getElementById('form-month');
    if(!select || !financialData) return;
    select.innerHTML = '';
    financialData.months.forEach(month => {
        const option = document.createElement('option');
        option.value = month.id; option.textContent = `${month.name} ${month.year}`;
        select.appendChild(option);
    });
}

function updateApp(skipSave = false) {
    recalculateState(); updateMonthSelectOptions(); populateKPIs(); renderChart(); buildMonthlyCards(); renderEditorLists();
    if(!skipSave) { saveDataToCloud(); } 
}

// --- 7. AFFICHAGE (Rendu Graphique) ---
function populateKPIs() {
    if(!financialData) return;
    if(document.getElementById('kpi-incomes')) document.getElementById('kpi-incomes').textContent = formatEur(financialData.summary.totalIncomes);
    if(document.getElementById('kpi-expenses')) document.getElementById('kpi-expenses').textContent = formatEur(financialData.summary.totalExpenses);
    if(document.getElementById('kpi-balance')) document.getElementById('kpi-balance').textContent = formatEur(financialData.summary.finalBalance);
}

function renderChart() {
    const ctxElement = document.getElementById('financeChart');
    if(!ctxElement || !financialData) return;
    const ctx = ctxElement.getContext('2d');
    if (myChartInstance) myChartInstance.destroy();
    const labels = financialData.months.map(m => `${m.name.substring(0,3)} ${m.year.toString().slice(-2)}`);
    const incomeData = financialData.months.map(m => m.incomes.total);
    const expenseData = financialData.months.map(m => m.expenses.total);
    const balanceData = financialData.months.map(m => m.endBalance);

    myChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { type: 'line', label: 'Solde Fin', data: balanceData, borderColor: '#818cf8', backgroundColor: '#818cf8', borderWidth: 3, pointRadius: 5, fill: false, tension: 0.3 },
                { type: 'bar', label: 'Entrées', data: incomeData, backgroundColor: 'rgba(52, 211, 153, 0.8)', borderColor: '#34d399', borderWidth: 1, borderRadius: 4 },
                { type: 'bar', label: 'Sorties', data: expenseData, backgroundColor: 'rgba(251, 113, 133, 0.8)', borderColor: '#fb7185', borderWidth: 1, borderRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, color: '#a8a29e', interaction: { mode: 'index', intersect: false },
            plugins: { tooltip: { backgroundColor: 'rgba(28, 25, 23, 0.95)', titleColor: '#fff', bodyColor: '#d6d3d1', callbacks: { label: (c) => (c.dataset.label ? c.dataset.label + ': ' : '') + formatEur(c.parsed.y) } } },
            scales: { x: { grid: { color: '#44403c' }, ticks: { color: '#a8a29e' } }, y: { grid: { color: '#44403c' }, ticks: { color: '#a8a29e', callback: function(value) { return value + ' €'; } } } }
        }
    });
}

function buildMonthlyCards() {
    const container = document.getElementById('monthly-container');
    if(!container || !financialData) return;
    container.innerHTML = ''; 
    let currentDisplayedYear = 0;

    financialData.months.forEach((month) => {
        if (month.year !== currentDisplayedYear) {
            container.insertAdjacentHTML('beforeend', `<div class="col-span-1 md:col-span-2 xl:col-span-4 mt-6 mb-2 flex items-center"><h2 class="text-3xl font-black text-stone-600 mr-4 tracking-tight">${month.year}</h2><div class="h-px bg-stone-700 flex-grow"></div></div>`);
            currentDisplayedYear = month.year;
        }

        let headerClass = 'bg-stone-700 text-stone-200 border-stone-600'; let icon = '📅';
        if(month.status === 'critical') { headerClass = 'bg-rose-900/30 text-rose-300 border-rose-800/50'; icon = '⚠️'; }
        if(month.status === 'landing') { headerClass = 'bg-teal-900/40 text-teal-300 border-teal-800'; icon = '🏁'; }
        if(month.status === 'savings') { headerClass = 'bg-indigo-900/40 text-indigo-300 border-indigo-800'; icon = '📈'; }

        const cardHTML = `
            <div class="bg-stone-800 rounded-2xl border border-stone-700 overflow-hidden flex flex-col h-full shadow-lg">
                <button class="w-full text-left px-5 py-4 flex justify-between items-center focus:outline-none ${headerClass}" onclick="window.toggleCard('${month.id}')">
                    <div class="flex items-center"><span class="mr-3 text-xl icon-symbol">${icon}</span><h3 class="font-bold text-lg">${month.name}</h3></div><span class="text-stone-400 transform transition-transform duration-300" id="chevron-${month.id}">▼</span>
                </button>
                <div class="px-5 py-4 border-b border-stone-700 flex justify-between text-sm bg-stone-800/50">
                    <span class="text-emerald-400 font-bold">+ ${formatEur(month.incomes.total)}</span><span class="text-rose-400 font-bold">- ${formatEur(month.expenses.total)}</span>
                </div>
                <div id="content-${month.id}" class="month-card-content bg-stone-900/50 flex-grow">
                    <div class="p-5">
                        <p class="text-xs text-stone-400 italic mb-4 leading-relaxed">${month.note}</p>
                        <div class="mb-5">
                            <h4 class="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 border-b border-stone-700 pb-1">Entrées</h4>
                            <ul class="text-sm space-y-3">
                                ${month.incomes.details.length ? month.incomes.details.map(item => `
                                    <li class="flex justify-between items-start text-stone-300">
                                        <div class="flex flex-col pr-2">
                                            <span class="font-medium">${item.label}</span>
                                            <span class="text-[10px] text-indigo-400 font-semibold bg-indigo-900/30 px-1.5 rounded inline-block w-max mt-0.5">Le ${item.day < 10 ? '0'+item.day : item.day}</span>
                                        </div>
                                        <span class="font-bold text-emerald-300">${formatEur(item.amount)}</span>
                                    </li>`).join('') : '<li class="text-stone-500 text-xs italic">Aucune entrée</li>'}
                            </ul>
                        </div>
                        <div>
                            <h4 class="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 border-b border-stone-700 pb-1">Sorties</h4>
                            <ul class="text-sm space-y-3">
                                ${month.expenses.details.length ? month.expenses.details.map(item => `
                                    <li class="flex justify-between items-start text-stone-300">
                                        <div class="flex flex-col pr-2">
                                            <span class="${item.label.includes('⚠️') ? 'text-amber-400 font-bold' : 'font-medium'}">${item.label}</span>
                                            <span class="text-[10px] text-stone-400 font-semibold bg-stone-800 px-1.5 rounded inline-block w-max mt-0.5">Le ${item.day < 10 ? '0'+item.day : item.day}</span>
                                        </div>
                                        <span class="font-bold text-rose-300">${formatEur(item.amount)}</span>
                                    </li>`).join('') : '<li class="text-stone-500 text-xs italic">Aucune sortie</li>'}
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="px-5 py-4 mt-auto bg-stone-800 border-t border-stone-700 flex justify-between items-center">
                    <span class="text-xs font-bold text-stone-400 uppercase tracking-wide">Solde fin de mois</span>
                    <span class="font-black text-xl ${month.endBalance < 0 ? 'text-rose-500' : 'text-indigo-400'}">${formatEur(month.endBalance)}</span>
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
        let html = `<div class="bg-stone-800 p-4 rounded-xl border border-stone-700 mb-3">
                        <h4 class="font-bold text-white mb-3 border-b border-stone-600 pb-1">${month.name} ${month.year}</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
        
        html += `<div><h5 class="text-xs font-bold text-emerald-400 mb-2">Entrées</h5><ul class="text-sm space-y-2">`;
        month.incomes.details.forEach((item, index) => {
            html += `<li class="flex justify-between items-center bg-stone-900 p-2 rounded border border-stone-700">
                        <span class="truncate text-stone-300"><span class="text-stone-500 mr-1">[${item.day}]</span> ${item.label} (${item.amount}€)</span>
                        <button onclick="window.deleteTransaction('${month.id}', 'incomes', ${index})" class="text-rose-500 hover:text-rose-400 font-bold px-2 ml-2">&times;</button>
                     </li>`;
        });
        html += `</ul></div>`;

        html += `<div><h5 class="text-xs font-bold text-rose-400 mb-2">Sorties</h5><ul class="text-sm space-y-2">`;
        month.expenses.details.forEach((item, index) => {
            html += `<li class="flex justify-between items-center bg-stone-900 p-2 rounded border border-stone-700">
                        <span class="truncate text-stone-300"><span class="text-stone-500 mr-1">[${item.day}]</span> ${item.label} (${item.amount}€)</span>
                        <button onclick="window.deleteTransaction('${month.id}', 'expenses', ${index})" class="text-rose-500 hover:text-rose-400 font-bold px-2 ml-2">&times;</button>
                     </li>`;
        });
        html += `</ul></div></div></div>`;
        
        container.insertAdjacentHTML('beforeend', html);
    });
}

// --- 8. ÉCOUTEURS D'ÉVÉNEMENTS (Liés au HTML) ---

window.toggleEditor = function() {
    const panel = document.getElementById('editor-panel');
    if(panel) panel.classList.toggle('hidden');
};

window.toggleCard = function(id) {
    const content = document.getElementById(`content-${id}`);
    const chevron = document.getElementById(`chevron-${id}`);
    if(!content || !chevron) return;
    const isExpanded = content.classList.contains('active');
    if (isExpanded) {
        content.classList.remove('active');
        chevron.style.transform = 'rotate(0deg)';
    } else {
        content.classList.add('active');
        chevron.style.transform = 'rotate(180deg)';
    }
};

window.addNextMonth = function() {
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
        incomes: { total: 0, details: [] },
        expenses: { total: 0, details: [] },
        endBalance: 0, note: ``
    });

    updateApp();
    const editorLists = document.getElementById('editor-lists-container');
    if(editorLists) editorLists.scrollTop = editorLists.scrollHeight;
};

window.resetData = function() {
    if(confirm("Attention : Vous allez effacer toutes vos modifications ! Continuer ?")) {
        financialData = JSON.parse(JSON.stringify(defaultData));
        saveDataToCloud().then(() => { location.reload(); });
    }
};

window.handleAddTransaction = function(e) {
    e.preventDefault();
    if(!financialData) return;
    const monthId = document.getElementById('form-month').value;
    const type = document.getElementById('form-type').value;
    const label = document.getElementById('form-label').value;
    const amount = parseFloat(document.getElementById('form-amount').value);
    const day = parseInt(document.getElementById('form-day').value);

    const month = financialData.months.find(m => m.id === monthId);
    if (month) {
        month[type].details.push({ label, amount, day });
        updateApp(); 
        e.target.reset(); 
    }
};

window.deleteTransaction = function(monthId, type, index) {
    if(!financialData) return;
    const month = financialData.months.find(m => m.id === monthId);
    if (month) {
        month[type].details.splice(index, 1);
        updateApp(); 
    }
};

// Fonction de déconnexion !
window.logout = async function() {
    await signOut(auth);
    window.location.href = "index.html"; // Redirige vers le login une fois déconnecté
};