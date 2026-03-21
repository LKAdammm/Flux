// js/firebase-config.js

// 1. Importation des modules Firebase (version 11.6.1)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 2. Ta configuration sécurisée
const firebaseConfig = {
    apiKey: "AIzaSyBKtwEKUA9LMaifJ3IfRBeW0R30ngz77ak",
    authDomain: "flux-bb413.firebaseapp.com",
    projectId: "flux-bb413",
    storageBucket: "flux-bb413.firebasestorage.app",
    messagingSenderId: "980735344887",
    appId: "1:980735344887:web:0445970bf2d9501797d3f2"
};

// 3. Initialisation des services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 4. Exportation pour que les autres fichiers (auth.js et dashboard.js) puissent les utiliser
export { app, auth, db };