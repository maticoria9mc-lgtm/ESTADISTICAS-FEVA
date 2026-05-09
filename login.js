import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDub8IURJHzoM5B6mJcsuV1Z8LJwGUxqVE",
  authDomain: "vnl-scout-tracker.firebaseapp.com",
  projectId: "vnl-scout-tracker",
  storageBucket: "vnl-scout-tracker.firebasestorage.app",
  messagingSenderId: "910877184486",
  appId: "1:910877184486:web:d1bc362d2cd6bb93848627",
  measurementId: "G-ZDN5PC13HJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Si detecta que ya estás logueado, te manda adentro solo
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.replace("index.html");
    }
});

const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const btnLogin = document.getElementById('btnLogin');
const errorMsg = document.getElementById('errorMsg');

btnLogin.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if(email === "" || password === "") {
        errorMsg.textContent = "Por favor, completá todos los campos.";
        errorMsg.style.display = 'block';
        return;
    }

    btnLogin.textContent = "Verificando...";
    btnLogin.disabled = true;

    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            // EL SECRETO: Le damos medio segundo a Chrome para que guarde el ticket en el disco
            setTimeout(() => {
                window.location.replace("index.html");
            }, 500);
        })
        .catch((error) => {
            btnLogin.textContent = "Ingresar";
            btnLogin.disabled = false;
            errorMsg.textContent = "Usuario o contraseña incorrectos.";
            errorMsg.style.display = 'block';
        });
});