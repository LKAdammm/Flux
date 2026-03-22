// js/auth.js
import { supabase } from './supabase-config.js';

const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const loginBtn = document.getElementById('login-btn');

// Si session active, redirection immédiate
supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) window.location.href = 'dashboard.html';
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setLoading(true);
    hideError();

    // Tentative de connexion
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (!signInError) {
        // Succès : la redirection se fait via onAuthStateChange dans dashboard
        window.location.href = 'dashboard.html';
        return;
    }

    // Si le compte n'existe pas, on propose la création explicitement
    if (signInError.message.includes('Invalid login credentials')) {
        showError('Identifiants incorrects. Vérifiez votre email et mot de passe.');
    } else if (signInError.message.includes('Email not confirmed')) {
        showError('Confirmez votre email avant de vous connecter.');
    } else {
        showError('Erreur de connexion. Vérifiez votre connexion internet.');
    }

    setLoading(false);
});

// Bouton "Créer un compte" séparé
document.getElementById('signup-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showError('Remplissez l\'email et le mot de passe pour créer un compte.');
        return;
    }
    if (password.length < 6) {
        showError('Le mot de passe doit faire au moins 6 caractères.');
        return;
    }

    setLoading(true, 'Création du compte...');
    hideError();

    const { error } = await supabase.auth.signUp({ email, password });

    if (!error) {
        showError('Compte créé ! Vérifiez votre email pour confirmer votre inscription.', 'success');
    } else if (error.message.includes('already registered')) {
        showError('Cet email est déjà utilisé. Connectez-vous à la place.');
    } else {
        showError('Erreur lors de la création : ' + error.message);
    }

    setLoading(false);
});

function setLoading(isLoading, text = 'Connexion en cours...') {
    loginBtn.disabled = isLoading;
    loginBtn.textContent = isLoading ? text : 'Se connecter';
}

function showError(msg, type = 'error') {
    errorMessage.textContent = msg;
    errorMessage.className = type === 'success'
        ? 'text-emerald-400 text-sm font-medium text-center bg-emerald-900/30 p-3 rounded-lg border border-emerald-800/50'
        : 'text-rose-400 text-sm font-medium text-center bg-rose-900/30 p-3 rounded-lg border border-rose-800/50';
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}
