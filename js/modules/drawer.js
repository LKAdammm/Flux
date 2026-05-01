// Drawer latéral (animation d'ouverture/fermeture).

import { state } from './state.js';

export function toggleDrawer() {
    state.drawerOpen = !state.drawerOpen;
    const drawer  = document.getElementById('transaction-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (!drawer) return;

    if (state.drawerOpen) {
        overlay.classList.remove('hidden');
        // requestAnimationFrame garantit que le navigateur a appliqué `display`
        // avant de déclencher la transition d'opacité.
        requestAnimationFrame(() => {
            drawer.classList.remove('translate-x-full');
            drawer.classList.add('translate-x-0');
            overlay.style.opacity = '1';
        });
    } else {
        drawer.classList.add('translate-x-full');
        drawer.classList.remove('translate-x-0');
        overlay.style.opacity = '0';
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

export function closeDrawer() {
    if (state.drawerOpen) toggleDrawer();
}
