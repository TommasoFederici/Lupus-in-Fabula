// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-analytics.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Configurazione (la tua)
const firebaseConfig = {
  apiKey: "AIzaSyA18O_8XvZ9hUBHGfCnaefUBemc5NNT4gc",
  authDomain: "lupus-in-fabula-1f963.firebaseapp.com",
  projectId: "lupus-in-fabula-1f963",
  storageBucket: "lupus-in-fabula-1f963.firebasestorage.app",
  messagingSenderId: "780546327951",
  appId: "1:780546327951:web:6f1a90d9dbdb6241f177fa",
  measurementId: "G-1NQF3VQ41B",
  databaseURL: "https://lupus-in-fabula-1f963-default-rtdb.europe-west1.firebasedatabase.app"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getDatabase(app);
export const auth = getAuth(app);

// Login anonimo (semplice per ora)
signInAnonymously(auth)
  .then(() => console.log("✅ Accesso anonimo a Firebase"))
  .catch((err) => console.error("❌ Errore login anonimo:", err));
