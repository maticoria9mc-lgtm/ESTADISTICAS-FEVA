// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
// NUEVO: Agregamos getDoc y setDoc para leer/guardar los roles
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { getAuth, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// --- CONFIGURACIÓN FIREBASE ---
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
const db = getFirestore(app, "trac"); 
const storage = getStorage(app); 
const auth = getAuth(app); 
const matchesCollection = collection(db, "matches"); 
const usersCollection = collection(db, "users");

let statisticians = ["Matías Coria", "Analista A", "Analista B"];
let activeCategory = "Mayores"; 
let showOnlyPending = false; 
let allMatches = []; 
let currentEditMatchId = null; 

let currentUser = null;
let currentRole = "statistician"; 
let unsubscribeSnapshot = null;
let unsubscribeUsers = null;
let allUsers = [];

// --- CONTROL DE SESIÓN Y ROLES DINÁMICOS ---
setPersistence(auth, browserLocalPersistence)
    .then(() => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user.email; 
                document.getElementById('displayUserName').textContent = currentUser.split('@')[0];
                
                // TU CUENTA ES INAMOVIBLE (Super Administrador)
                if(user.email === "maticoria9.mc@gmail.com") { 
                    currentRole = "developer";
                } else {
                    // Si es otro, le preguntamos a la base de datos qué rol tiene
                    try {
                        const userDoc = await getDoc(doc(db, "users", user.email));
                        if (userDoc.exists()) {
                            currentRole = userDoc.data().role || "statistician";
                        } else {
                            currentRole = "statistician";
                        }
                    } catch (e) {
                        currentRole = "statistician";
                    }
                }
                
                applyRoleRestrictions();
                iniciarEscuchadorBaseDatos();

                // Si sos desarrollador, escuchamos la lista de usuarios para la configuración
                if (currentRole === "developer") {
                    iniciarEscuchadorUsuarios();
                }
            } else {
                window.location.replace("login.html");
            }
        });
    })
    .catch((error) => {
        window.location.replace("login.html");
    });


// --- ESCUCHADORES DE BASE DE DATOS ---
function iniciarEscuchadorBaseDatos() {
    if (unsubscribeSnapshot) unsubscribeSnapshot(); 
    unsubscribeSnapshot = onSnapshot(matchesCollection, (snapshot) => {
        allMatches = [];
        snapshot.forEach((documento) => {
            allMatches.push({ id: documento.id, ...documento.data() });
        });
        applyFilters();
    });
}

function iniciarEscuchadorUsuarios() {
    if(unsubscribeUsers) unsubscribeUsers();
    unsubscribeUsers = onSnapshot(usersCollection, (snapshot) => {
        allUsers = [];
        snapshot.forEach(doc => {
            allUsers.push({ email: doc.id, ...doc.data() });
        });
        renderUsersManager();
    });
}

const matchesContainer = document.getElementById('matchesContainer');
const tournamentFilter = document.getElementById('tournamentFilter');
const countryFilter = document.getElementById('countryFilter');
const pendingToggle = document.getElementById('pendingToggle');
const categoryList = document.getElementById('categoryList');
const btnPendingFilter = document.getElementById('btnPendingFilter');
const btnLogout = document.getElementById('btnLogout');
const topControlsBar = document.getElementById('topControlsBar');
const globalPendingTitle = document.getElementById('globalPendingTitle');
const displayUserRole = document.getElementById('displayUserRole');

const btnOpenSettings = document.getElementById('btnOpenSettings');
const settingsModal = document.getElementById('settingsModal');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const adminSettingsSection = document.getElementById('adminSettingsSection');

const btnSaveStat = document.getElementById('btnSaveStat');
const newStatNameInput = document.getElementById('newStatName');

// Referencias Nuevas (Gestión de Roles)
const newUserEmail = document.getElementById('newUserEmail');
const newUserRole = document.getElementById('newUserRole');
const btnSaveUser = document.getElementById('btnSaveUser');
const usersList = document.getElementById('usersList');

const btnImportExcel = document.getElementById('btnImportExcel');
const btnOpenAddMatch = document.getElementById('btnOpenAddMatch');
const excelFileInput = document.getElementById('excelFileInput');
const btnDownloadTemplate = document.getElementById('btnDownloadTemplate');
const addMatchModal = document.getElementById('addMatchModal');
const btnCancelMatch = document.getElementById('btnCancelMatch');
const btnSaveMatch = document.getElementById('btnSaveMatch');
const btnDownloadAllScouts = document.getElementById('btnDownloadAllScouts');
const editMatchModal = document.getElementById('editMatchModal');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const btnSaveEdit = document.getElementById('btnSaveEdit');
const videoModal = document.getElementById('videoModal');
const newVideoUrlInput = document.getElementById('newVideoUrl');
const btnCancelVideo = document.getElementById('btnCancelVideo');
const btnSaveVideo = document.getElementById('btnSaveVideo');
const fileUploadInput = document.getElementById('fileUploadInput');

let currentUploadMatchId = null;
let currentUploadType = null; 
let currentVideoMatchId = null;

let alertConfirmCallback = null;
const customAlertModal = document.getElementById('customAlertModal');
const btnAlertCancel = document.getElementById('btnAlertCancel');
const btnAlertConfirm = document.getElementById('btnAlertConfirm');

function showCustomAlert(title, message, isConfirm = false, onConfirm = null) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;
    if (isConfirm) {
        btnAlertCancel.style.display = 'inline-flex';
        btnAlertConfirm.textContent = 'Confirmar';
        btnAlertConfirm.style.background = '#10b981';
        alertConfirmCallback = onConfirm;
    } else {
        btnAlertCancel.style.display = 'none';
        btnAlertConfirm.textContent = 'Aceptar';
        btnAlertConfirm.style.background = '#3b82f6';
        alertConfirmCallback = null;
    }
    customAlertModal.classList.add('show');
}

btnAlertCancel.addEventListener('click', () => customAlertModal.classList.remove('show'));
btnAlertConfirm.addEventListener('click', () => {
    customAlertModal.classList.remove('show');
    if (alertConfirmCallback) alertConfirmCallback();
});

categoryList.addEventListener('click', (e) => {
    if (e.target.classList.contains('chip')) {
        if (showOnlyPending) togglePendingMode();
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        activeCategory = e.target.getAttribute('data-cat');
        tournamentFilter.value = "TODOS";
        applyFilters(); 
    }
});

btnPendingFilter.addEventListener('click', togglePendingMode);

function togglePendingMode() {
    showOnlyPending = !showOnlyPending;
    if (showOnlyPending) {
        btnPendingFilter.style.background = '#fef08a'; 
        btnPendingFilter.textContent = "📋 Volver a Categorías";
        topControlsBar.style.display = 'none';
        globalPendingTitle.style.display = 'block';
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    } else {
        btnPendingFilter.style.background = 'transparent';
        btnPendingFilter.textContent = "📋 Mis Pendientes";
        topControlsBar.style.display = 'flex';
        globalPendingTitle.style.display = 'none';
        document.querySelector(`.chip[data-cat="${activeCategory}"]`)?.classList.add('active');
    }
    applyFilters();
}

btnLogout.addEventListener('click', () => {
    showCustomAlert("Cerrar Sesión", "¿Estás seguro que querés salir del sistema?", true, () => {
        signOut(auth).then(() => {
            window.location.replace("login.html");
        });
    });
});

btnOpenSettings.addEventListener('click', () => settingsModal.classList.add('show'));
btnCloseSettings.addEventListener('click', () => settingsModal.classList.remove('show'));

function applyRoleRestrictions() {
    const isAdmin = currentRole === "developer";
    displayUserRole.textContent = isAdmin ? "Desarrollador" : "Estadístico";
    displayUserRole.style.background = isAdmin ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.3)";
    if(isAdmin) {
        btnImportExcel.style.display = 'inline-flex';
        btnOpenAddMatch.style.display = 'inline-flex';
        adminSettingsSection.style.display = 'block';
    } else {
        btnImportExcel.style.display = 'none';
        btnOpenAddMatch.style.display = 'none';
        adminSettingsSection.style.display = 'none';
    }
    applyFilters(); 
}

// --- GESTIÓN DE NOMBRES EN EL DESPLEGABLE ---
function renderStatisticiansManager() {
    const container = document.getElementById('statisticiansList');
    container.innerHTML = statisticians.map((name, index) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; padding:6px 12px; border-radius:4px; border:1px solid #e2e8f0;">
            <span style="font-size:0.9rem; font-weight: 500;">${name}</span>
            <button onclick="removeStat(${index})" style="background:none; border:none; cursor:pointer; color: #b91c1c;" title="Eliminar">❌</button>
        </div>
    `).join('');
}

window.removeStat = (index) => {
    statisticians.splice(index, 1);
    renderStatisticiansManager();
    applyFilters(); 
};

btnSaveStat.addEventListener('click', () => {
    const name = newStatNameInput.value.trim();
    if (name !== "") {
        statisticians.push(name);
        newStatNameInput.value = '';
        renderStatisticiansManager();
        applyFilters(); 
    }
});


// --- GESTIÓN DE PERMISOS DE USUARIOS (NUEVO) ---
function renderUsersManager() {
    if (!usersList) return;
    
    // Matías siempre aparece como Intocable en la UI
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; padding:6px 12px; border-radius:4px; border:1px solid #e2e8f0;">
            <div>
                <span style="font-size:0.9rem; font-weight: 700;">maticoria9.mc@gmail.com</span> 
                <span style="font-size:0.7rem; background:#10b981; color:white; padding:2px 4px; border-radius:4px; margin-left:5px;">Admin Fijo</span>
            </div>
        </div>
    `;
    
    html += allUsers.map((u) => {
        if(u.email === "maticoria9.mc@gmail.com") return ''; // Ya lo mostramos fijo arriba
        return `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; padding:6px 12px; border-radius:4px; border:1px solid #e2e8f0;">
            <div>
                <span style="font-size:0.9rem; font-weight: 500;">${u.email}</span>
                <span style="font-size:0.7rem; background:${u.role === 'developer' ? '#3b82f6' : '#64748b'}; color:white; padding:2px 4px; border-radius:4px; margin-left:5px;">
                    ${u.role === 'developer' ? 'Desarrollador' : 'Estadístico'}
                </span>
            </div>
            <button onclick="removeUserAccess('${u.email}')" style="background:none; border:none; cursor:pointer; color: #b91c1c;" title="Eliminar Permisos Especiales">❌</button>
        </div>
    `}).join('');
    
    usersList.innerHTML = html;
}

window.removeUserAccess = async (email) => {
    showCustomAlert("Quitar Permisos", `¿Seguro que querés quitarle los permisos a ${email}? Pasará a ser un Estadístico básico.`, true, async () => {
        try {
            await deleteDoc(doc(db, "users", email));
            showCustomAlert("Éxito", "Permisos revocados correctamente.");
        } catch (error) {
            showCustomAlert("Error", "No se pudo eliminar el acceso.");
        }
    });
};

btnSaveUser.addEventListener('click', async () => {
    const email = newUserEmail.value.trim().toLowerCase();
    const role = newUserRole.value;
    
    if (email !== "" && email.includes("@")) {
        try {
            await setDoc(doc(db, "users", email), { role: role });
            newUserEmail.value = '';
            showCustomAlert("¡Éxito!", `Permisos de ${role === 'developer' ? 'Desarrollador' : 'Estadístico'} guardados para ${email}.`);
        } catch (error) {
            showCustomAlert("Error", "No se pudieron guardar los permisos en la base de datos.");
        }
    } else {
        showCustomAlert("Atención", "Por favor ingresá un correo electrónico válido.");
    }
});



// --- LÓGICA MODAL AGREGAR PARTIDO ---
btnOpenAddMatch.addEventListener('click', () => {
    document.getElementById('newMatchCategory').value = activeCategory;
    addMatchModal.classList.add('show');
});
btnCancelMatch.addEventListener('click', () => addMatchModal.classList.remove('show'));

btnSaveMatch.addEventListener('click', async () => {
    addMatchModal.classList.remove('show'); 
    const newMatch = {
        matchNumber: document.getElementById('newMatchNumber').value || "S/N",
        category: document.getElementById('newMatchCategory').value,
        tournament: document.getElementById('newMatchTournament').value || 'Amistoso',
        phase: document.getElementById('newMatchPhase').value || 'Fase Unica',
        teamA: document.getElementById('newMatchTeamA').value.toUpperCase() || 'EQA',
        teamB: document.getElementById('newMatchTeamB').value.toUpperCase() || 'EQB',
        date: document.getElementById('newMatchDate').value ? document.getElementById('newMatchDate').value.split('-').reverse().join('-') : "Sin fecha",
        downloaded: false, corrected: false, ready: false, priority: "INDEFINIDO", 
        p2Url: "", scoutUrl: "", videoUrl: "", assignedStat: "",
        createdAt: Date.now() 
    };
    try {
        await addDoc(matchesCollection, newMatch);
    } catch (error) {
        showCustomAlert("Error", "No se pudo guardar el partido.");
    }
});

btnCancelEdit.addEventListener('click', () => editMatchModal.classList.remove('show'));

btnSaveEdit.addEventListener('click', async () => {
    editMatchModal.classList.remove('show'); 
    const updatedData = {
        matchNumber: document.getElementById('editMatchNumber').value || "S/N",
        category: document.getElementById('editMatchCategory').value,
        tournament: document.getElementById('editMatchTournament').value || 'Amistoso',
        phase: document.getElementById('editMatchPhase').value || 'Fase Unica',
        teamA: document.getElementById('editMatchTeamA').value.toUpperCase() || 'EQA',
        teamB: document.getElementById('editMatchTeamB').value.toUpperCase() || 'EQB',
        date: document.getElementById('editMatchDate').value ? document.getElementById('editMatchDate').value.split('-').reverse().join('-') : "Sin fecha"
    };
    try {
        await updateDoc(doc(db, "matches", currentEditMatchId), updatedData);
    } catch (error) {
        showCustomAlert("Error", "No se pudo actualizar el partido.");
    }
});

function updateDropdowns(matchesInCategory) {
    const currentTourneySelection = tournamentFilter.value;
    const currentCountrySelection = countryFilter.value;
    const tournaments = new Set();
    matchesInCategory.forEach(match => tournaments.add(match.tournament));
    const sortedTournaments = Array.from(tournaments).sort();
    tournamentFilter.innerHTML = '<option value="TODOS">Todos los Torneos</option>';
    sortedTournaments.forEach(t => {
        const option = document.createElement('option'); option.value = t; option.textContent = t.replace(/_/g, ' '); 
        tournamentFilter.appendChild(option);
    });
    tournamentFilter.value = sortedTournaments.includes(currentTourneySelection) ? currentTourneySelection : "TODOS";
    const teams = new Set();
    matchesInCategory.forEach(match => { teams.add(match.teamA); teams.add(match.teamB); });
    const sortedTeams = Array.from(teams).sort();
    countryFilter.innerHTML = '<option value="TODOS">Todos los Equipos</option>';
    sortedTeams.forEach(team => {
        const option = document.createElement('option'); option.value = team; option.textContent = team;
        countryFilter.appendChild(option);
    });
    countryFilter.value = sortedTeams.includes(currentCountrySelection) ? currentCountrySelection : "TODOS";
}

function getBadgeClass(phase) {
    const p = phase.toLowerCase();
    if(p.includes('wk1')) return 'badge wk1'; if(p.includes('wk2')) return 'badge wk2'; if(p.includes('wk3')) return 'badge wk3';
    if(p.includes('final') || p.includes('semi')) return 'badge final'; if(p.includes('amistoso')) return 'badge amistoso';
    return 'badge default'; 
}

btnDownloadAllScouts.addEventListener('click', () => {
    const selectedTournament = tournamentFilter.value;
    if (selectedTournament === "TODOS") {
        showCustomAlert("Falta Torneo", "Por favor, seleccioná un torneo específico.");
        return;
    }
    const matchesToDownload = allMatches.filter(m => m.category === activeCategory && m.tournament === selectedTournament && m.scoutUrl && m.scoutUrl !== "");
    if (matchesToDownload.length === 0) {
        showCustomAlert("Sin Archivos", "No hay archivos Scout subidos.");
        return;
    }
    showCustomAlert("Descarga Múltiple", `Se van a abrir ${matchesToDownload.length} archivos.`, true, () => {
        matchesToDownload.forEach((match, index) => {
            setTimeout(() => { window.open(match.scoutUrl, '_blank'); }, index * 500); 
        });
    });
});

function renderMatches(matches) {
    matchesContainer.innerHTML = ''; 
    if (matches.length === 0) {
        matchesContainer.innerHTML = `<div class="empty-state">🏐 No hay partidos que mostrar.</div>`;
        return;
    }
    
    matches.sort((a, b) => b.createdAt - a.createdAt);

    matches.forEach(match => {
        let isEnabled = true;
        if (match.date && match.date !== "Sin fecha") {
            const parts = match.date.split('-');
            const matchDateObj = new Date(parts[2], parts[1]-1, parts[0]); 
            const now = new Date();
            const twelveHours = 12 * 60 * 60 * 1000;
            
            if (now.getTime() < (matchDateObj.getTime() - twelveHours)) {
                isEnabled = false;
            }
        }

        const statOptions = statisticians.map(s => `<option value="${s}" ${match.assignedStat === s ? 'selected' : ''}>${s}</option>`).join('');
        
        const card = document.createElement('div');
        card.className = `match-card priority-${match.priority.toLowerCase()} ${match.ready ? 'ready' : ''} ${!isEnabled ? 'upcoming' : ''}`;
        
        const categoryLabel = showOnlyPending ? `<span style="font-size:0.75rem; color:#64748b; background:#e2e8f0; padding:2px 6px; border-radius:4px; margin-right:5px;">${match.category}</span>` : '';

        const btnP2HTML = match.p2Url 
            ? `<div style="display:flex; gap:2px; width:100%;"><button class="btn btn-download" onclick="window.open('${match.p2Url}', '_blank')">P2</button><button class="btn btn-danger btn-replace-p2" data-id="${match.id}">🔄</button></div>`
            : `<button class="btn btn-p2" data-id="${match.id}">📄 P2</button>`;

        const btnScoutHTML = match.scoutUrl
            ? `<div style="display:flex; gap:2px; width:100%;"><button class="btn btn-download" onclick="window.open('${match.scoutUrl}', '_blank')">Scout</button><button class="btn btn-danger btn-replace-scout" data-id="${match.id}">🔄</button></div>`
            : `<button class="btn btn-scout" data-id="${match.id}">📊 Scout</button>`;

        const btnVideoHTML = match.videoUrl
            ? `<div style="display:flex; gap:2px; width:100%;"><button class="btn btn-download" style="background:#f3e8ff; color:#7e22ce; border-color:#d8b4fe;" onclick="window.open('${match.videoUrl}', '_blank')">▶️ Ver</button><button class="btn btn-danger btn-replace-video" data-id="${match.id}">🔄</button></div>`
            : `<button class="btn btn-video" data-id="${match.id}">🎬 Video</button>`;

        const editDeleteHTML = currentRole === "developer" ? `
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <button class="btn-options-inline edit-btn" data-id="${match.id}">✏️ Editar</button>
                <button class="btn-options-inline delete-btn" data-id="${match.id}">🗑️ Eliminar</button>
            </div>
        ` : '';

        card.innerHTML = `
            <div class="match-info">
                ${editDeleteHTML}
                <div class="match-teams">
                    <span class="match-number">#${match.matchNumber || '-'}</span> 
                    ${match.teamA} vs ${match.teamB} 
                    <span class="${getBadgeClass(match.phase)}">${match.phase}</span>
                </div>
                <div style="display:flex; align-items:center; margin-top:8px;">
                    ${categoryLabel}
                    <div class="match-date">📅 ${match.date}</div>
                    <select class="stat-selector" data-id="${match.id}" title="Asignar Estadístico">
                        <option value="">👤 Sin asignar</option>
                        ${statOptions}
                    </select>
                </div>
            </div>
            
            <div class="match-status">
                <label class="status-item"><span>Descargado</span><input type="checkbox" class="check-status" data-id="${match.id}" data-field="downloaded" ${match.downloaded ? 'checked' : ''} ${!isEnabled ? 'disabled' : ''}></label>
                <label class="status-item"><span>Corregido</span><input type="checkbox" class="check-status" data-id="${match.id}" data-field="corrected" ${match.corrected ? 'checked' : ''} ${!isEnabled ? 'disabled' : ''}></label>
                <label class="status-item"><span><b>Listo</b></span><input type="checkbox" class="check-status" data-id="${match.id}" data-field="ready" ${match.ready ? 'checked' : ''} ${!isEnabled ? 'disabled' : ''}></label>
            </div>
            
            <div class="match-actions">
                <select class="priority-selector ${match.priority.toLowerCase()}" data-id="${match.id}">
                    <option value="INDEFINIDO" ${match.priority === 'INDEFINIDO' ? 'selected' : ''}>⚪ INDEFINIDO</option>
                    <option value="IMPORTANTE" ${match.priority === 'IMPORTANTE' ? 'selected' : ''}>🟡 IMPORTANTE</option>
                    <option value="URGENTE" ${match.priority === 'URGENTE' ? 'selected' : ''}>🔴 URGENTE</option>
                </select>
                <div class="file-buttons">
                    ${btnP2HTML}
                    ${btnScoutHTML}
                    ${btnVideoHTML}
                </div>
            </div>
        `;
        matchesContainer.appendChild(card);
    });
}

function applyFilters() {
    let filteredMatches = [];
    if (showOnlyPending) {
        const currentName = currentUser.split('@')[0];
        filteredMatches = allMatches.filter(match => match.ready === false && (match.assignedStat === currentUser || match.assignedStat === currentName));
    } else {
        let matchesInCategory = allMatches.filter(match => match.category === activeCategory);
        updateDropdowns(matchesInCategory);
        filteredMatches = matchesInCategory;
        const selectedTournament = tournamentFilter.value;
        const selectedCountry = countryFilter.value;
        if (selectedTournament !== "TODOS") filteredMatches = filteredMatches.filter(match => match.tournament === selectedTournament);
        if (selectedCountry !== "TODOS") filteredMatches = filteredMatches.filter(match => match.teamA === selectedCountry || match.teamB === selectedCountry);
        if (pendingToggle.checked) filteredMatches = filteredMatches.filter(match => match.ready === false);
    }
    renderMatches(filteredMatches);
}

matchesContainer.addEventListener('click', async (e) => {
    const btn = e.target;
    if (btn.classList.contains('edit-btn')) {
        const matchId = btn.getAttribute('data-id');
        const matchToEdit = allMatches.find(m => m.id === matchId);
        if (matchToEdit) {
            currentEditMatchId = matchId;
            document.getElementById('editMatchNumber').value = matchToEdit.matchNumber !== "S/N" ? matchToEdit.matchNumber : "";
            document.getElementById('editMatchCategory').value = matchToEdit.category;
            document.getElementById('editMatchTournament').value = matchToEdit.tournament;
            document.getElementById('editMatchPhase').value = matchToEdit.phase;
            document.getElementById('editMatchTeamA').value = matchToEdit.teamA;
            document.getElementById('editMatchTeamB').value = matchToEdit.teamB;
            let formatedDate = "";
            if(matchToEdit.date && matchToEdit.date !== "Sin fecha") {
                const parts = matchToEdit.date.split('-');
                if(parts.length === 3) formatedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            document.getElementById('editMatchDate').value = formatedDate;
            editMatchModal.classList.add('show');
        }
    }
    if (btn.classList.contains('delete-btn')) {
        const matchId = btn.getAttribute('data-id');
        showCustomAlert("Eliminar Partido", "¿Seguro que querés borrar este partido?", true, async () => {
            try { await deleteDoc(doc(db, "matches", matchId)); } catch (error) {}
        });
    }
    if (btn.classList.contains('btn-p2')) {
        currentUploadMatchId = btn.getAttribute('data-id');
        currentUploadType = 'p2Url';
        fileUploadInput.accept = ".pdf"; 
        fileUploadInput.click();
    }
    if (btn.classList.contains('btn-scout')) {
        currentUploadMatchId = btn.getAttribute('data-id');
        currentUploadType = 'scoutUrl';
        fileUploadInput.accept = ".dvw"; 
        fileUploadInput.click();
    }
    if (btn.classList.contains('btn-video')) {
        currentVideoMatchId = btn.getAttribute('data-id');
        newVideoUrlInput.value = "";
        videoModal.classList.add('show');
    }
    if (btn.classList.contains('btn-replace-p2') || btn.closest('.btn-replace-p2')) {
        const targetBtn = btn.classList.contains('btn-replace-p2') ? btn : btn.closest('.btn-replace-p2');
        await updateDoc(doc(db, "matches", targetBtn.getAttribute('data-id')), { p2Url: "" });
    }
    if (btn.classList.contains('btn-replace-scout') || btn.closest('.btn-replace-scout')) {
        const targetBtn = btn.classList.contains('btn-replace-scout') ? btn : btn.closest('.btn-replace-scout');
        await updateDoc(doc(db, "matches", targetBtn.getAttribute('data-id')), { scoutUrl: "" });
    }
    if (btn.classList.contains('btn-replace-video') || btn.closest('.btn-replace-video')) {
        const targetBtn = btn.classList.contains('btn-replace-video') ? btn : btn.closest('.btn-replace-video');
        await updateDoc(doc(db, "matches", targetBtn.getAttribute('data-id')), { videoUrl: "" });
    }
});

fileUploadInput.addEventListener('change', async (e) => {
    if (e.target.id === "excelFileInput") return;
    const file = e.target.files[0];
    if (!file || !currentUploadMatchId) return;
    showCustomAlert("Subiendo Archivo", `Subiendo ${file.name}...`);
    try {
        const fileRef = ref(storage, `matches/${currentUploadMatchId}/${file.name}`);
        await uploadBytes(fileRef, file);
        const downloadURL = await getDownloadURL(fileRef);
        await updateDoc(doc(db, "matches", currentUploadMatchId), { [currentUploadType]: downloadURL });
        customAlertModal.classList.remove('show');
        fileUploadInput.value = '';
    } catch (error) {
        customAlertModal.classList.remove('show');
        showCustomAlert("Error", "No se pudo subir el archivo.");
    }
});

matchesContainer.addEventListener('change', async (e) => {
    const matchId = e.target.getAttribute('data-id');
    const matchRef = doc(db, "matches", matchId); 
    try {
        if (e.target.classList.contains('check-status')) {
            const field = e.target.getAttribute('data-field');
            const isChecked = e.target.checked;
            let updateData = { [field]: isChecked };
            if (field === 'ready' && isChecked) {
                updateData.downloaded = true;
                updateData.corrected = true;
            }
            await updateDoc(matchRef, updateData);
        }
        if (e.target.classList.contains('stat-selector')) await updateDoc(matchRef, { assignedStat: e.target.value });
        if (e.target.classList.contains('priority-selector')) await updateDoc(matchRef, { priority: e.target.value });
    } catch (error) {}
});

btnCancelVideo.addEventListener('click', () => videoModal.classList.remove('show'));
btnSaveVideo.addEventListener('click', async () => {
    const link = newVideoUrlInput.value.trim();
    if (currentVideoMatchId && link !== "") {
        videoModal.classList.remove('show');
        await updateDoc(doc(db, "matches", currentVideoMatchId), { videoUrl: link });
    }
});

tournamentFilter.addEventListener('change', applyFilters);
countryFilter.addEventListener('change', applyFilters);
pendingToggle.addEventListener('change', applyFilters);

btnDownloadTemplate.addEventListener('click', () => {
    const ws_data = [ ["TORNEO", "VNL 26"], ["CATEGORIA", activeCategory], [], ["FECHA", "Fase", "N° Partido", "Equipo 1", "Equipo 2"] ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws_data), "Fixture");
    XLSX.writeFile(wb, "MCN_Modelo_Fixture.xlsx");
});

btnImportExcel.addEventListener('click', () => excelFileInput.click());
excelFileInput.addEventListener('change', (e) => {
    if (e.target.id !== "excelFileInput") return; 
    if (!e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = async function(event) {
        const data = new Uint8Array(event.target.result);
        const rows = XLSX.utils.sheet_to_json(XLSX.read(data, { type: 'array' }).Sheets[XLSX.read(data, { type: 'array' }).SheetNames[0]], { header: 1, defval: "" }); 
        if (rows.length < 5) return;
        const torneo = String(rows[0][1] || '').trim();
        const categoria = (String(rows[1][1] || '').trim().toLowerCase() === 'mayores') ? 'Mayores' : String(rows[1][1] || '').trim().toUpperCase();
        try {
            for (let i = 4; i < rows.length; i++) {
                if (!rows[i] || !rows[i][0] || !rows[i][3]) continue;
                let fecha = String(rows[i][0]).trim();
                if (!isNaN(fecha) && fecha !== "") {
                    const dateObj = XLSX.SSF.parse_date_code(Number(fecha));
                    fecha = `${String(dateObj.d).padStart(2, '0')}-${String(dateObj.m).padStart(2, '0')}-${dateObj.y}`;
                }
                const newMatch = {
                    category: categoria || activeCategory, 
                    tournament: torneo, 
                    phase: String(rows[i][1] || 'Fase Unica').trim(), 
                    matchNumber: String(rows[i][2] || 'S/N').trim(), 
                    teamA: String(rows[i][3] || '').trim().toUpperCase(), 
                    teamB: String(rows[i][4] || '').trim().toUpperCase(), 
                    date: fecha, 
                    downloaded: false, corrected: false, ready: false, priority: "INDEFINIDO", 
                    p2Url: "", scoutUrl: "", videoUrl: "", assignedStat: "",
                    createdAt: Date.now() + i
                };
                await addDoc(matchesCollection, newMatch);
            }
        } catch (error) {}
    };
    reader.readAsArrayBuffer(e.target.files[0]);
});

renderStatisticiansManager();