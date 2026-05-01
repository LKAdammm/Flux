// Helpers généraux (formatage, sanitization, statut de sauvegarde, calcul de jours).

export const formatEur = (n) => new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 2
}).format(n);

export function sanitize(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

export function showSaveStatus(message, classes) {
    const el = document.getElementById('save-status');
    if (!el) return;
    el.textContent = message;
    el.className = `text-[10px] px-2 py-0.5 rounded border border-zinc-800 ml-3 font-medium transition-opacity duration-300 ${classes}`;
    el.style.display = 'inline-block';
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

const MONTH_INDEX = ['janvier','février','mars','avril','mai','juin',
                     'juillet','août','septembre','octobre','novembre','décembre'];

export function daysInMonth(monthName, year) {
    const idx = MONTH_INDEX.indexOf(monthName.toLowerCase());
    if (idx === -1) return 31;
    return new Date(year, idx + 1, 0).getDate();
}
