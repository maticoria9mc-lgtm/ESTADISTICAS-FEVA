// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
const auth = getAuth(app);

// --- VARIABLES GLOBALES ---
let allMatches = [];
let currentStats = {};
let globalStatisticians = [];

// --- VERIFICACIÓN DE SEGURIDAD (SOLO DESARROLLADOR) ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // No está logueado
        window.location.replace("login.html");
    } else if (user.email !== "maticoria9.mc@gmail.com") {
        // Está logueado pero NO es Matías -> Afuera del dashboard
        window.location.replace("index.html");
    } else {
        // Es Matías -> Cargamos los datos reales
        iniciarEscuchadorDashboard();
    }
});

function iniciarEscuchadorDashboard() {
    onSnapshot(collection(db, "matches"), (snapshot) => {
        allMatches = [];
        let statsSet = new Set(); // Para juntar los nombres de los analistas sin repetirlos
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            allMatches.push(data);
            // Si el partido tiene alguien asignado, lo sumamos a la lista
            if (data.assignedStat && data.assignedStat.trim() !== "") {
                statsSet.add(data.assignedStat);
            }
        });
        
        globalStatisticians = Array.from(statsSet);
        globalStatisticians.push("Sin Asignar"); // Siempre mostramos los que faltan

        initTournamentDropdown();
        updateDashboardUI();
    });
}

// --- FILTRO DE TORNEOS DINÁMICO ---
function initTournamentDropdown() {
    const filter = document.getElementById('dashTournamentFilter');
    const currentSelection = filter.value;
    const tournaments = new Set(allMatches.map(m => m.tournament));
    const sortedTournaments = Array.from(tournaments).sort();

    filter.innerHTML = '<option value="TODOS">Todos los Torneos</option>';
    sortedTournaments.forEach(t => {
        if(!t) return;
        const option = document.createElement('option');
        option.value = t;
        option.textContent = t.replace(/_/g, ' ');
        filter.appendChild(option);
    });

    // Mantenemos la selección si existe el torneo, sino vuelve a TODOS
    if (sortedTournaments.includes(currentSelection)) {
        filter.value = currentSelection;
    }
}

// --- CALCULAR NÚMEROS REALES ---
function calculateDashboardStats(filterTournament = "TODOS") {
    let matchesToProcess = allMatches;
    if (filterTournament !== "TODOS") {
        matchesToProcess = allMatches.filter(m => m.tournament === filterTournament);
    }

    let total = matchesToProcess.length;
    let listos = matchesToProcess.filter(m => m.ready).length;
    let pendientes = total - listos;

    let staffDetails = globalStatisticians.map(name => {
        let matches = matchesToProcess.filter(m => name === "Sin Asignar" ? (!m.assignedStat || m.assignedStat.trim() === "") : m.assignedStat === name);
        return {
            name: name,
            assigned: matches.length,
            ready: matches.filter(m => m.ready).length,
            pending: matches.filter(m => !m.ready).length
        };
    });

    // Ordenamos el staff de mayor carga de trabajo a menor
    staffDetails.sort((a, b) => b.assigned - a.assigned);

    return { total, listos, pendientes, staffDetails, matchesToProcess };
}

// --- ACTUALIZAR TODA LA INTERFAZ ---
function updateDashboardUI() {
    const selectedTournament = document.getElementById('dashTournamentFilter').value;
    currentStats = calculateDashboardStats(selectedTournament);

    // 1. Tarjetas de Arriba
    document.getElementById('kpiTotal').textContent = currentStats.total;
    document.getElementById('kpiReady').textContent = currentStats.listos;
    document.getElementById('kpiPending').textContent = currentStats.pendientes;

    // 2. Gráfico Acelerómetro
    const gaugePercentage = currentStats.total > 0 ? Math.round((currentStats.listos / currentStats.total) * 100) : 0;
    document.getElementById('gaugePercentage').textContent = `${gaugePercentage}%`;
    gaugeChart.data.datasets[0].data = [currentStats.listos, currentStats.pendientes];
    gaugeChart.update();

    // 3. Gráfico de Barras
    staffChart.data.labels = currentStats.staffDetails.map(s => s.name);
    staffChart.data.datasets[0].data = currentStats.staffDetails.map(s => s.assigned);
    
    // Colores dinámicos para las barras
    const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#06b6d4', '#f43f5e'];
    staffChart.data.datasets[0].backgroundColor = currentStats.staffDetails.map((s, i) => s.name === "Sin Asignar" ? '#cbd5e1' : colors[i % colors.length]);
    staffChart.update();

    // 4. Detalle Inferior
    renderStaffReport();
}

function renderStaffReport() {
    const container = document.getElementById('staffReportContainer');
    
    // Si no hay partidos, mostramos un cartel vacío lindo
    if (currentStats.total === 0) {
         container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b; font-size: 1.1rem; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">🏐 No hay partidos cargados en este torneo para auditar.</div>';
         return;
    }

    container.innerHTML = currentStats.staffDetails.map(stat => {
        // Si la persona no tiene asignados en este torneo, lo salteamos para no ensuciar
        if(stat.assigned === 0 && stat.name !== "Sin Asignar") return ''; 

        const percentage = stat.assigned > 0 ? Math.round((stat.ready / stat.assigned) * 100) : 0;
        let colorClass = "var(--primary)";
        if (percentage === 100 && stat.assigned > 0) colorClass = "var(--success)";
        else if (percentage < 40 && stat.assigned > 0) colorClass = "#ef4444"; 

        return `
            <div class="staff-card">
                <div class="staff-header">
                    <h4 class="staff-name">${stat.name}</h4>
                    <span class="staff-perc" style="color: ${colorClass};">${percentage}%</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${percentage}%; background-color: ${percentage === 100 ? 'var(--success)' : 'var(--primary)'}"></div>
                </div>
                <div class="staff-stats">
                    <div class="stat-item">
                        <span>Asignados</span>
                        <span class="clickable-stat" data-staff="${stat.name}" data-type="assigned">${stat.assigned}</span>
                    </div>
                    <div class="stat-item">
                        <span style="color: var(--success);">Listos</span>
                        <span class="clickable-stat" data-staff="${stat.name}" data-type="ready" style="color: var(--success);">${stat.ready}</span>
                    </div>
                    <div class="stat-item">
                        <span style="color: var(--warning);">Pendientes</span>
                        <span class="clickable-stat" data-staff="${stat.name}" data-type="pending" style="color: var(--warning);">${stat.pending}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}


// --- INICIALIZACIÓN DE GRÁFICOS ---
const ctxGauge = document.getElementById('gaugeChart').getContext('2d');
const gaugeChart = new Chart(ctxGauge, {
    type: 'doughnut',
    data: {
        labels: ['Completado', 'Faltante'],
        datasets: [{ data: [0, 1], backgroundColor: ['#10b981', '#e2e8f0'], borderWidth: 0, hoverOffset: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: true, cutout: '80%', rotation: 270, circumference: 180, plugins: { legend: { display: false }, tooltip: { enabled: true } } }
});

const ctxStaff = document.getElementById('staffChart').getContext('2d');
const staffChart = new Chart(ctxStaff, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Partidos Asignados', data: [], backgroundColor: [], borderRadius: 6 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { display: false } }, y: { grid: { display: false } } } }
});


// --- LÓGICA DEL POP-UP DETALLADO ---
const detailsModal = document.getElementById('detailsModal');
const btnCloseDetails = document.getElementById('btnCloseDetails');
const detailsModalList = document.getElementById('detailsModalList');
const detailsModalTitle = document.getElementById('detailsModalTitle');
const detailsModalSubtitle = document.getElementById('detailsModalSubtitle');

document.getElementById('staffReportContainer').addEventListener('click', (e) => {
    if (e.target.classList.contains('clickable-stat')) {
        const staffName = e.target.getAttribute('data-staff');
        const statType = e.target.getAttribute('data-type'); 

        let filteredMatches = currentStats.matchesToProcess.filter(m => 
            staffName === "Sin Asignar" ? (!m.assignedStat || m.assignedStat.trim() === "") : m.assignedStat === staffName
        );

        let titleType = "Asignados";
        if (statType === 'ready') {
            filteredMatches = filteredMatches.filter(m => m.ready === true);
            titleType = "Listos";
        } else if (statType === 'pending') {
            filteredMatches = filteredMatches.filter(m => m.ready === false);
            titleType = "Pendientes";
        }

        detailsModalTitle.textContent = `Partidos ${titleType}`;
        detailsModalSubtitle.textContent = `Analista: ${staffName} (${filteredMatches.length} partidos)`;

        if (filteredMatches.length === 0) {
            detailsModalList.innerHTML = `<p style="text-align:center; color:#64748b; padding: 20px;">No hay partidos en esta categoría.</p>`;
        } else {
            detailsModalList.innerHTML = filteredMatches.map(match => `
                <div class="match-list-item">
                    <div>
                        <span class="match-tag">${match.category}</span>
                        <strong style="color: var(--primary);">${match.teamA} vs ${match.teamB}</strong>
                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
                            ${(match.tournament || '').replace(/_/g, ' ')} | ${match.phase}
                        </div>
                    </div>
                    <div>
                        ${match.ready ? '✅' : '⏳'}
                    </div>
                </div>
            `).join('');
        }
        detailsModal.classList.add('show');
    }
});

btnCloseDetails.addEventListener('click', () => { detailsModal.classList.remove('show'); });
document.getElementById('dashTournamentFilter').addEventListener('change', updateDashboardUI);