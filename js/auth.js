// js/auth.js
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const loginBtn = document.getElementById('login-btn');

// NOUVEAU : Le vigile de la page de login !
// Si une session existe déjà dans le cache, on redirige instantanément
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "dashboard.html";
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    loginBtn.textContent = "Connexion en cours...";
    loginBtn.disabled = true;
    errorMessage.classList.add('hidden');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // La redirection se fera automatiquement grâce au vigile au-dessus
    } catch (error) {
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
            try {
                loginBtn.textContent = "Création du compte...";
                await createUserWithEmailAndPassword(auth, email, password);
                // La redirection se fera automatiquement
            } catch (signUpError) {
                showError("Erreur : Le mot de passe doit faire au moins 6 caractères.");
            }
        } else {
            showError("Identifiants incorrects ou erreur réseau.");
        }
    }
});

function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
    loginBtn.textContent = "Se connecter / Créer un compte";
    loginBtn.disabled = false;
}