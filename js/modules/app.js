// Orchestrateur de re-rendu : appelé après chaque mutation de l'état.

import { saveData } from './state.js';
import { recalculateState, populateKPIs, renderGoal } from './kpis.js';
import { renderChart, renderCategoryChart, renderIncomeChart } from './charts.js';
import { buildMonthlyCards, renderEditorLists, updateMonthSelectOptions } from './render.js';

export function updateApp(skipSave = false) {
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
}
