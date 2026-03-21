// js/auth.js
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const loginBtn = document.getElementById('login-btn');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Empêche le rechargement de la page
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Interface en mode "chargement"
    loginBtn.textContent = "Connexion en cours...";
    loginBtn.disabled = true;
    errorMessage.classList.add('hidden');

    try {
        // 1. On tente d'abord de se connecter
        await signInWithEmailAndPassword(auth, email, password);
        // Si ça marche, on redirige vers le tableau de bord
        window.location.href = "dashboard.html";
        
    } catch (error) {
        // 2. Si le compte n'existe pas, on essaie de le créer automatiquement
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
            try {
                loginBtn.textContent = "Création du compte...";
                await createUserWithEmailAndPassword(auth, email, password);
                window.location.href = "dashboard.html"; // Redirection après création
            } catch (signUpError) {
                showError("Erreur lors de la création : Le mot de passe doit faire au moins 6 caractères.");
            }
        } else {
            // Autre erreur (ex: mauvais mot de passe pour un compte existant)
            showError("Identifiants incorrects ou erreur réseau.");
        }
    }
});

// Fonction pour afficher les erreurs proprement
function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
    loginBtn.textContent = "Se connecter";
    loginBtn.disabled = false;
}