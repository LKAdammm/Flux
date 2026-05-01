// Export PDF du rapport mensuel via html2pdf.js.

import { state } from './state.js';
import { formatEur, sanitize, showSaveStatus } from './utils.js';
import { getFilteredMonths } from './filters.js';

export function exportPDF() {
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
                    <td style="border:1px solid #e5e7eb;padding:9px;color:#10b981;font-weight:bold;">${formatEur(state.financialData.summary.totalIncomes)}</td>
                    <td style="border:1px solid #e5e7eb;padding:9px;color:#ef4444;font-weight:bold;">${formatEur(state.financialData.summary.totalExpenses)}</td>
                    <td style="border:1px solid #e5e7eb;padding:9px;font-weight:bold;">${formatEur(state.financialData.summary.filteredBalance)}</td>
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
}
