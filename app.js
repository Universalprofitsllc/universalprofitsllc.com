// Background Animation (Golden Sparks / Stars)
const canvas = document.getElementById('starsCanvas');
const ctx = canvas.getContext('2d');
let particlesArray;

function initCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', initCanvas);

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        // Golden shades base based on theme
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            this.color = `rgba(${212 + Math.random() * 40}, ${175 + Math.random() * 80}, ${55 + Math.random() * 20}, ${Math.random()})`;
        } else {
            this.color = `rgba(${197 + Math.random() * 40}, ${160 + Math.random() * 80}, ${40 + Math.random() * 20}, ${Math.random()})`;
        }
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }
}

function initParticles() {
    particlesArray = [];
    let numberOfParticles = (canvas.height * canvas.width) / 9000;
    for (let i = 0; i < numberOfParticles; i++) {
        particlesArray.push(new Particle());
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();
    }
    requestAnimationFrame(animateParticles);
}

// Initialize Canvas
initCanvas();
initParticles();
animateParticles();

// Theme Change triggers particle re-init to match colors
const observer = new MutationObserver(() => initParticles());
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });


// --- Navigation / View Management ---

function hideAllViews() {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
}

function navigate(viewId) {
    hideAllViews();
    document.getElementById(`view-${viewId}`).classList.add('active');
}

// --- Firebase Config & Global State ---
const firebaseConfig = {
    apiKey: "AIzaSyBHkYblplu7sOYXiTz6Jvschvc8ptvvHp0",
    authDomain: "universal-profits-llc.firebaseapp.com",
    projectId: "universal-profits-llc",
    storageBucket: "universal-profits-llc.firebasestorage.app",
    messagingSenderId: "11955098488",
    appId: "1:11955098488:web:20f7b6ad7cbcfa105b6e8d",
    measurementId: "G-BLD41MEYGP"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let usersDB = [];
let initialLoadDone = false;

// Anti-Bruteforce / Rate Limiting en memoria (Frontend)
let loginAttempts = {};

// Sanitización XSS (OWASP A03:2021)
function escapeHTML(str) {
    if (typeof str !== 'string' && typeof str !== 'number') return str;
    return String(str).replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Real-time listener para guardar en la nube
db.collection("users").onSnapshot((snapshot) => {
    usersDB = [];
    snapshot.forEach((doc) => {
        usersDB.push(doc.data());
    });

    // Sincronizar UI si ya estamos logueados
    if (currentUser && initialLoadDone) {
        const matchedUser = usersDB.find(u => u.username === currentUser.username);
        if (matchedUser) {
            currentUserBalance = matchedUser.balance;
            currentUserInvested = matchedUser.invested;
            currentUserEarnings = matchedUser.earnings;
            savedWalletAddress = matchedUser.wallet || "";
            updateDashboardStats();
            if (currentUser.isAdmin) {
                renderAdminUserList();
                // Refrescar mensajes del chat admin si está abierto
                if (adminChatTargetUsername) adminRenderChatMessages();
            } else {
                // Refrescar vista de chat del usuario si está en esa sección
                const ticketView = document.getElementById('subview-ticket');
                if (ticketView && ticketView.classList.contains('active')) {
                    renderChatView();
                }
                // Actualizar chat flotante siempre
                renderFloatChat();
                // Badge si el panel está cerrado y el último mensaje es del admin
                const mu = usersDB.find(u => u.username === currentUser.username);
                if (mu && mu.chat && mu.chat.messages && mu.chat.messages.length > 0) {
                    const lastMsg = mu.chat.messages[mu.chat.messages.length - 1];
                    if (lastMsg && lastMsg.isAdmin && !floatChatOpen) {
                        notifyFloatChatBadge();
                    }
                }
                // Recargar settings si está activo
                const settingsView = document.getElementById('subview-settings');
                if (settingsView && settingsView.classList.contains('active')) {
                    loadSettingsForm();
                }
            }
        }
    } else if (initialLoadDone && currentUser && currentUser.isAdmin) {
        renderAdminUserList();
    }
});

async function saveUserToDB(userObj) {
    try {
        await db.collection("users").doc(userObj.username).set(userObj);
    } catch (e) { console.error(e); }
}

async function deleteUserFromDB(username) {
    try {
        await db.collection("users").doc(username).delete();
    } catch (e) { console.error(e); }
}

// Sincroniza variables locales del usuario actual a la BD
function syncCurrentUserLocalVarsToDB() {
    if (!currentUser) return;
    const matchedUser = usersDB.find(u => u.username === currentUser.username);
    if (matchedUser) {
        matchedUser.balance = currentUserBalance;
        matchedUser.invested = currentUserInvested;
        matchedUser.earnings = currentUserEarnings;
        matchedUser.wallet = savedWalletAddress;
        matchedUser.daysPaid = daysPaid;
        matchedUser.realDaysElapsed = realDaysElapsed;

        if (!matchedUser.pendingDeposits) matchedUser.pendingDeposits = [];
        if (!matchedUser.tickets) matchedUser.tickets = [];
        if (!matchedUser.investments) {
            matchedUser.investments = currentUserInvested > 0 ? [{ id: 'inv_1', amount: currentUserInvested, earnings: currentUserEarnings, active: true }] : [];
        }

        saveUserToDB(matchedUser);
    }
}

// On Load Check if logged in & Fetch Firebase
function saveLocalDashboardState() {
    if (currentUser) {
        localStorage.setItem('up_currentUser', JSON.stringify(currentUser));
        const activeSubView = document.querySelector('.subview.active');
        if (activeSubView) {
            localStorage.setItem('up_currentView', activeSubView.id.replace('subview-', ''));
        }
        localStorage.setItem('up_simulatedDeposit', simulatedDeposit);
        localStorage.setItem('up_daysPaid', daysPaid);
        localStorage.setItem('up_realDaysElapsed', realDaysElapsed);
    } else {
        localStorage.removeItem('up_currentUser');
        localStorage.removeItem('up_currentView');
    }
}
setInterval(saveLocalDashboardState, 1000);

// Automatic system checker for properties
setInterval(() => {
    if (currentUser) {
        let changed = false;
        usersDB.forEach(u => {
            if (recalculateUserFinances(u)) {
                changed = true;
            }
            if (applyAutomaticProfits(u)) {
                changed = true;
            }
            if (changed) saveUserToDB(u);
        });
        if (changed) updateDashboardStats();
    }
}, 10000); // Check every 10 seconds for real-time magic

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('up-theme') || 'dark';
    setTheme(savedTheme);

    // Initial load will be handled by Firebase DB first fetch
    db.collection("users").get().then((snapshot) => {
        usersDB = [];
        snapshot.forEach(doc => usersDB.push(doc.data()));

        // Seed default admins si la base de datos está vacía (solo primera vez)
        if (usersDB.length === 0) {
            const defaultUsers = [
                { username: "Josue10", password: "Josue1020.", isAdmin: true, firstname: "Josue", lastname: "", balance: 0, invested: 0, earnings: 0, wallet: "", recoveryWords: [], referrer: "", pendingDeposits: [] },
                { username: "Gribel", password: "Josue1020.", isAdmin: false, firstname: "Gribel", lastname: "", balance: 0, invested: 0, earnings: 0, wallet: "", recoveryWords: ["sol", "luna", "rio", "oro", "plata"], referrer: "Josue10", pendingDeposits: [] }
            ];
            defaultUsers.forEach(u => {
                usersDB.push(u);
                saveUserToDB(u);
            });
        }

        const savedUser = localStorage.getItem('up_currentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            const matchedUser = usersDB.find(u => u.username === currentUser.username);

            if (matchedUser) {
                currentUserBalance = matchedUser.balance;
                currentUserInvested = matchedUser.invested;
                currentUserEarnings = matchedUser.earnings;
                savedWalletAddress = matchedUser.wallet;
                simulatedDeposit = parseFloat(localStorage.getItem('up_simulatedDeposit')) || 0;
                daysPaid = matchedUser.daysPaid !== undefined ? matchedUser.daysPaid : (parseInt(localStorage.getItem('up_daysPaid')) || 0);
                realDaysElapsed = matchedUser.realDaysElapsed !== undefined ? matchedUser.realDaysElapsed : (parseInt(localStorage.getItem('up_realDaysElapsed')) || 0);

                if (currentUser.isAdmin) {
                    document.getElementById('admin-menu-item').style.display = 'flex';
                    document.querySelector('#admin-transactions-table tbody').innerHTML = '';
                    usersDB.forEach(u => {
                        if (u.pendingDeposits && u.pendingDeposits.length > 0) {
                            u.pendingDeposits.forEach(pending => {
                                if (pending.status === 'pending') {
                                    addPendingAdminTransactionSync(u.username, 'Depósito', pending.amount, pending.id);
                                }
                            });
                        }
                    });
                }

                const displayFirstname = escapeHTML(matchedUser.firstname || matchedUser.username);
                document.getElementById('welcome-username').innerText = displayFirstname;
                document.getElementById('tree-username').innerText = displayFirstname;

                updateDashboardStats();
                updateWithdrawalStatus();
                navigate('dashboard-layout');

                const savedView = localStorage.getItem('up_currentView') || 'dashboard';
                switchDashboardView(savedView);
                setTimeout(initChart, 300);
                if (!currentUser.isAdmin) showFloatChatBtn();
            } else {
                navigate('landing');
            }
        } else {
            navigate('landing');
        }
        initialLoadDone = true;
    }).catch(err => {
        console.error("Firebase connection error: ", err);
        navigate('landing');
    });
});

// --- Authentication Flow ---

const RECOVERY_DICTIONARY = ["sol", "luna", "rio", "montaña", "mar", "estrella", "nube", "viento", "fuego", "tierra", "oro", "plata", "bronce", "cielo", "valle", "bosque", "hoja", "raiz", "fruto", "semilla"];

let tmpRecoveryWords = [];
let pendingResetUsername = "";

function handleRegister(e) {
    e.preventDefault();

    const firstname = escapeHTML(document.getElementById('reg-firstname').value.trim());
    const lastname = escapeHTML(document.getElementById('reg-lastname').value.trim());
    const username = escapeHTML(document.getElementById('reg-username').value.trim());
    const password = document.getElementById('reg-password').value;

    // Check if user exists
    const exists = usersDB.find(u => u.username === username);
    if (exists) {
        alert("Ese nombre de usuario ya está registrado. Por favor elige otro.");
        return;
    }

    // Generate 5 random words
    tmpRecoveryWords = [];
    while (tmpRecoveryWords.length < 5) {
        const word = RECOVERY_DICTIONARY[Math.floor(Math.random() * RECOVERY_DICTIONARY.length)];
        if (!tmpRecoveryWords.includes(word)) {
            tmpRecoveryWords.push(word);
        }
    }

    // Save to simulated DB
    const newUser = {
        username: username,
        password: password,
        isAdmin: false,
        firstname: firstname,
        lastname: lastname,
        balance: 0,
        invested: 0,
        earnings: 0,
        wallet: "",
        recoveryWords: tmpRecoveryWords,
        referrer: document.getElementById('reg-ref').value.trim() || "",
        pendingDeposits: []
    };
    usersDB.push(newUser);
    saveUserToDB(newUser);

    // Notificar solo al referente directo
    if (newUser.referrer) {
        const referrerUser = usersDB.find(u => u.username.toLowerCase() === newUser.referrer.toLowerCase());
        if (referrerUser) {
            // Si el usuario actual es el referente (lo cual no suele pasar en el mismo navegador pero por si acaso)
            if (currentUser && currentUser.username.toLowerCase() === referrerUser.username.toLowerCase()) {
                addNotification(
                    "Nuevo Afiliado Registrado",
                    `El usuario <strong>${username}</strong> se ha registrado usando tu enlace.`,
                    "fa-user-plus",
                    "var(--success)"
                );
            } else {
                // En un sistema real, esto se guardaría en la BD para que el referente lo vea al loguearse
                // Aquí simulamos guardándolo en un array de notificaciones pendientes si lo tuviéramos
                console.log(`Notificación para ${referrerUser.username}: Nuevo afiliado ${username}`);
            }
        }
    }

    // Show words view
    document.getElementById('recovery-words-display').innerHTML = tmpRecoveryWords.map((w, i) => `<span style="color:var(--text-color); font-size: 0.9em; opacity: 0.7;">${i + 1}.</span> ${w}`).join("&nbsp;&nbsp;&nbsp;");
    navigate('recovery-words');
}

function confirmRecoveryWords() {
    alert("Esperamos que las hayas guardado de forma segura. Volviendo a Login.");
    navigate('login');
}

let currentUser = null;
let currentUserBalance = 0;
let currentUserInvested = 0;
let currentUserEarnings = 0;
let simulatedDeposit = 0;
let daysPaid = 0;
let growthChartInstance = null;
let chartLabels = ['Día 0'];
let chartData = [0];
let savedWalletAddress = "";

function updateDashboardStats() {
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    document.getElementById('stat-balance').innerText = formatter.format(currentUserBalance);
    document.getElementById('stat-invested').innerText = formatter.format(currentUserInvested);
    document.getElementById('stat-earnings').innerText = formatter.format(currentUserEarnings);

    renderAffiliateTree();
}

function renderAffiliateTree() {
    const branchesContainer = document.getElementById('affiliate-tree-branches');
    if (!branchesContainer) return;
    if (!currentUser) return;

    // Find direct affiliates
    const affiliates = usersDB.filter(u => u.referrer && u.referrer.toLowerCase() === currentUser.username.toLowerCase());

    // Update stats
    const totalRefElem = document.getElementById('stat-total-referrals');
    const totalEarnElem = document.getElementById('stat-total-ref-earnings');

    let totalRefInvested = 0;
    affiliates.forEach(aff => {
        totalRefInvested += aff.invested;
    });

    if (totalRefElem) totalRefElem.innerText = affiliates.length;
    if (totalEarnElem) {
        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        totalEarnElem.innerText = formatter.format(totalRefInvested * 0.07);
    }

    // Update ref input link locally
    const refInput = document.getElementById('ref-input');
    if (refInput) {
        refInput.value = `${currentUser.username}`;
    }

    // Update Prizes
    renderPrizes(totalRefInvested);

    if (affiliates.length === 0) {
        branchesContainer.innerHTML = '<p class="small-text text-muted" style="padding-left: 20px;">Aún no tienes referidos.</p>';
        return;
    }

    let treeHtml = '';
    affiliates.forEach(aff => {
        const earnings = aff.invested * 0.07;
        const iconColor = aff.invested > 0 ? "var(--success)" : "var(--text-muted)";
        const displayFirstname = escapeHTML(aff.firstname || aff.username);

        treeHtml += `
            <div class="tree-wrapper">
                <div class="tree-node">
                    <span class="node-icon"><i class="fas ${aff.invested > 0 ? 'fa-user-check' : 'fa-user'}" style="color: ${iconColor};"></i></span>
                    <div class="node-details">
                        <h4>${displayFirstname}</h4>
                        <p class="small-text text-muted">Inversión: $${aff.invested.toFixed(2)} | 7%: <strong class="gold">+$${earnings.toFixed(2)}</strong></p>
                    </div>
                </div>
            </div>
        `;
    });

    branchesContainer.innerHTML = treeHtml;
}

function renderPrizes(networkVolume) {
    const container = document.getElementById('prizes-grid-container');
    if (!container) return;

    // Los premios funcionan de forma progresiva. 
    // Premio 1 requiere 20k, Premio 2 requiere OTROS 40k (Total: 60k), Premio 3 requiere OTROS 70k (Total: 130k), etc.
    const prizes = [
        { id: 1, name: "Primer Premio", req: 20000, startAt: 0, endAt: 20000, desc: "iPhone último modelo <br>+ <strong>500 USD</strong> de inversión.", icon: "fa-mobile-alt" },
        { id: 2, name: "Segundo Premio", req: 40000, startAt: 20000, endAt: 60000, desc: "MacBook Pro última generación.", icon: "fa-laptop" },
        { id: 3, name: "Tercer Premio", req: 70000, startAt: 60000, endAt: 130000, desc: "Resort/viaje valorado en aprox. <strong>5,000 USD</strong>.", icon: "fa-plane-departure" },
        { id: 4, name: "Cuarto Premio", req: 100000, startAt: 130000, endAt: 230000, desc: "10,000 USD <br><span style='color: var(--text-muted); font-size: 0.85rem;'>o artículo de lujo equivalente (cadena/Rolex).</span>", icon: "fa-gem" }
    ];

    let html = "";
    prizes.forEach((prize) => {
        const completed = networkVolume >= prize.endAt;
        let progressAmount = 0;
        let isCurrentTier = false;

        if (completed) {
            progressAmount = prize.req; 
        } else if (networkVolume > prize.startAt) {
            progressAmount = networkVolume - prize.startAt;
            isCurrentTier = true;
        } else {
            progressAmount = 0;
        }

        const percentage = Math.min((progressAmount / prize.req) * 100, 100);
        
        let cardStyle = "display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; ";
        let iconColor = "var(--text-muted)";
        let titleColor = "var(--text-muted)";
        let lockHtml = "";

        if (completed || isCurrentTier) {
            // Unlocked or in progress -> Gold/White hybrid
            cardStyle += "background: rgba(212,175,55,0.05); color: #fff; border: 1px solid var(--gold-dark);";
            iconColor = "var(--gold-primary)";
            titleColor = "var(--gold-primary)";
            
            if (completed) {
                cardStyle += "background: var(--gold-primary); color: #fff; box-shadow: 0 5px 15px rgba(212,175,55,0.4); border: 1px solid var(--gold-light);";
                iconColor = "#fff";
                titleColor = "#fff";
            }
        } else {
            // Locked totally -> Semi-transparent, lock overlay
            cardStyle += "background: rgba(255,255,255,0.02); opacity: 0.6;";
            lockHtml = `<div style="position: absolute; top:0; left:0; right:0; bottom:0; display:flex; justify-content:center; align-items:center; background: rgba(0,0,0,0.6); border-radius: 12px; z-index: 10;">
                            <i class="fas fa-lock" style="font-size: 4rem; color: rgba(255,255,255,0.2);"></i>
                        </div>`;
        }

        // Only show "Reclamar" if completed
        const btnHtml = completed ? 
            `<button class="btn btn-outline mt-3" style="background:#fff; color:var(--gold-primary); border:none; padding:8px 20px; font-weight:bold; cursor:pointer;" onclick="claimPrize('${prize.name}')"><i class="fas fa-gift"></i> Reclamar</button>` 
            : '';

        html += `
            <div class="stat-card" style="${cardStyle}">
                ${lockHtml}
                <div style="font-size: 2.5rem; color: ${iconColor}; margin-bottom: 15px;"><i class="fas ${prize.icon}"></i></div>
                <h4 style="color: ${titleColor};">${prize.name}</h4>
                <p class="small-text mt-2" style="${completed ? 'color:#fff;' : 'color:#ccc;'}">Volumen req: <strong>${prize.req.toLocaleString()} USD</strong></p>
                <div style="width: 100%; background: rgba(0,0,0,0.3); height: 8px; border-radius: 4px; margin: 10px 0; overflow:hidden;">
                    <div style="width: ${percentage}%; background: ${completed ? '#fff' : 'var(--gold-primary)'}; height: 100%; border-radius: 4px; transition: 0.5s;"></div>
                </div>
                <p style="font-size:0.85rem; margin-top:-5px; margin-bottom:10px; color:${completed ? '#eee' : 'var(--gold-primary)'}; font-weight: bold;">${progressAmount.toLocaleString()} / ${prize.req.toLocaleString()}</p>
                <p class="mt-2" style="font-size: 0.9rem;">${prize.desc}</p>
                ${btnHtml}
            </div>
        `;
    });

    container.innerHTML = html;
}

window.claimPrize = function(prizeName) {
    if (!currentUser) return;
    
    // Validate Firestore is active
    if (typeof db !== "undefined") {
        const msgRef = db.collection('chats').doc(currentUser.username).collection('messages').doc();
        msgRef.set({
            text: `El usuario ${currentUser.username} acaba de ganar el ${prizeName}. Por favor coordinar la entrega del premio.`,
            sender: currentUser.username,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            alert("¡Felicidades! Se ha notificado al soporte. El chat de soporte se abrirá ahora para que puedas hablar e iniciar la entrega de tu premio.");
            if (typeof showFloatChatBtn === "function") showFloatChatBtn();
            if (typeof openFloatChat === "function") openFloatChat();
        }).catch(err => {
            console.error("Error claimPrize:", err);
            alert("Error al reclamar el premio. Inténtalo de nuevo.");
        });
    } else {
        alert("Felicidades! Pero la conexión no está activa.");
    }
}

function initChart() {
    const ctx = document.getElementById('growthChart');
    if (!ctx) return;

    // Si ya existe instancia, destruirla para evitar solapamientos visuales
    if (growthChartInstance) {
        growthChartInstance.destroy();
    }

    // Configuración del tema (colores del gráfico)
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#aaaaaa' : '#555555';

    growthChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Balance Total ($)',
                data: chartData,
                borderColor: '#d4af37',
                backgroundColor: 'rgba(212, 175, 55, 0.2)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#d4af37',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

var realDaysElapsed = 0; // Para contar los días de la semana

function updateChart(label, value) {
    if (!growthChartInstance) return;
    chartLabels.push(label);

    // Representamos el total de fondos del usuario como el valor actual
    let totalValue = currentUserBalance + currentUserInvested + currentUserEarnings;
    chartData.push(totalValue);

    growthChartInstance.update();
}

function recalculateUserFinances(matchedUser) {
    // Usamos _v3 para asegurar que vuelva a ejecutarse en todos, migrando a quienes no tenían lista
    if (matchedUser.isRecalculatedFromStart_v3) return false;
    
    if (!matchedUser.investments && matchedUser.invested > 0) {
        matchedUser.investments = [{ id: 'inv_old_migrated', amount: matchedUser.invested, earnings: matchedUser.earnings || 0, active: true }];
    }

    let totalEarnings = 0;
    if (matchedUser.investments) {
        matchedUser.investments.forEach((inv) => {
            // Petición de audio: todos iniciaron el 17/03/2026
            if (!inv.wasResetToMar17) {
                inv.date = "2026-03-17T12:00:00.000-04:00"; // Hora del mediodía en DR
                inv.wasResetToMar17 = true;
            }
            let invDateStr = inv.date;
            
            // Count exact weekdays from invDate to today
            let invDate = new Date(new Date(invDateStr).toLocaleString("en-US", {timeZone: "America/Santo_Domingo"}));
        invDate = new Date(invDate.getFullYear(), invDate.getMonth(), invDate.getDate());
        let drTime = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Santo_Domingo"}));
        let today = new Date(drTime.getFullYear(), drTime.getMonth(), drTime.getDate());
        
        let maxEarnings = inv.amount * 2;
        let dailyPct = inv.dailyPct ? (inv.dailyPct / 100) : (inv.amount < 600 ? 0.0080 : (inv.amount < 10000 ? 0.0110 : 0.0180));
        let earningsPerDay = inv.amount * dailyPct;
        
        let earned = 0;
        let ds = new Date(invDate.getTime() + 86400000); // starts the next day
        
        while(ds.getTime() <= today.getTime() && earned < maxEarnings) {
            if (ds.getTime() === today.getTime() && drTime.getHours() < 18) {
                break; // not 6 PM yet
            }
            let w = ds.getDay();
            if (w !== 0 && w !== 6) {
                earned += earningsPerDay;
            }
            ds = new Date(ds.getFullYear(), ds.getMonth(), ds.getDate() + 1);
        }
        if (earned > maxEarnings) earned = maxEarnings;
        
        // Asignar ganancia matématica real al centavo
        inv.earnings = earned;
        inv.lastPaidDateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
        if (earned >= maxEarnings) inv.active = false;
        
        totalEarnings += earned;
    });
    } // End of if (matchedUser.investments)

    let totalBonus = 0;
    if (matchedUser.bonusHistory) {
        matchedUser.bonusHistory.forEach(b => totalBonus += b.amount);
    }
    
    let totalWithdrawals = 0;
    if (matchedUser.withdrawalHistory) {
        matchedUser.withdrawalHistory.forEach(w => {
            if (w.status !== 'denied') {
                totalWithdrawals += w.amount;
            }
        });
    }
    
    matchedUser.totalHistoricalEarnings = totalEarnings + totalBonus;
    matchedUser.earnings = matchedUser.totalHistoricalEarnings;
    
    matchedUser.balance = matchedUser.totalHistoricalEarnings - totalWithdrawals;
    if (matchedUser.balance < 0) matchedUser.balance = 0;
    
    matchedUser.isRecalculatedFromStart_v3 = true;
    return true;
}

function applyAutomaticProfits(matchedUser) {
    if (!matchedUser || !matchedUser.investments) return false;
    
    // Convert current time to DR time
    const drTimeString = new Date().toLocaleString("en-US", {timeZone: "America/Santo_Domingo"});
    const drTime = new Date(drTimeString);
    
    let updated = false;
    let totalAddedBalance = 0;
    
    // DR today at 00:00:00
    const todayStr = `${drTime.getFullYear()}-${drTime.getMonth() + 1}-${drTime.getDate()}`;
    const todayStart = new Date(todayStr + " 00:00:00").getTime();
    
    matchedUser.investments.forEach((inv, index) => {
        if (!inv.active) return;
        
        let invDateStr = inv.date || new Date().toISOString(); 
        let invDateObj = new Date(new Date(invDateStr).toLocaleString("en-US", {timeZone: "America/Santo_Domingo"}));
        
        if (!inv.lastPaidDateStr) {
            inv.lastPaidDateStr = `${invDateObj.getFullYear()}-${invDateObj.getMonth() + 1}-${invDateObj.getDate()}`;
        }
        
        let lastPaid = new Date(inv.lastPaidDateStr + " 00:00:00");
        let maxEarnings = inv.amount * 2;
        
        let dailyPct = inv.dailyPct ? (inv.dailyPct / 100) : (inv.amount < 600 ? 0.0080 : (inv.amount < 10000 ? 0.0110 : 0.0180));
        let earningsPerDay = inv.amount * dailyPct;

        while (true) {
            if (inv.earnings >= maxEarnings) {
                inv.active = false;
                break;
            }
            
            // Next day to pay
            let actualNextDay = new Date(lastPaid.getFullYear(), lastPaid.getMonth(), lastPaid.getDate() + 1);
            let actualNextDayTime = actualNextDay.getTime();
            
            let canPay = false;
            
            if (actualNextDayTime < todayStart) {
                canPay = true;
            } else if (actualNextDayTime === todayStart && drTime.getHours() >= 18) {
                canPay = true;
            }
            
            if (!canPay) break;
            
            let dayOfWeek = actualNextDay.getDay(); // 0 Sunday, 6 Saturday
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                let toAdd = earningsPerDay;
                if (inv.earnings + toAdd > maxEarnings) {
                    toAdd = maxEarnings - inv.earnings;
                }
                inv.earnings += toAdd;
                totalAddedBalance += toAdd;
                updated = true;
                
                if (matchedUser.username === currentUser?.username) {
                    daysPaid++;
                    realDaysElapsed++;
                    addNotification("Rendimiento Automático", `Has recibido ganancias de la red por <strong>$${toAdd.toFixed(2)}</strong>.`, "fa-sync-alt", "var(--success)");
                }
            } else if (matchedUser.username === currentUser?.username) {
                realDaysElapsed++;
                daysPaid++; 
            }
            
            lastPaid = actualNextDay;
            inv.lastPaidDateStr = `${lastPaid.getFullYear()}-${lastPaid.getMonth() + 1}-${lastPaid.getDate()}`;
        }
    });

    if (updated) {
        matchedUser.balance += totalAddedBalance;
        if (!matchedUser.totalHistoricalEarnings) {
            matchedUser.totalHistoricalEarnings = matchedUser.earnings || 0;
        }
        matchedUser.totalHistoricalEarnings += totalAddedBalance;
        matchedUser.earnings = matchedUser.totalHistoricalEarnings;
        
        if (currentUser && matchedUser.username === currentUser.username) {
            currentUserBalance = matchedUser.balance;
            currentUserEarnings = matchedUser.earnings;
            updateChart('Ganancia Diaria', currentUserBalance);
            updateWithdrawalStatus();
        }
        return true;
    }
    return false;
}

function updateWithdrawalStatus() {
    const daysEl = document.getElementById('days-paid');
    if (daysEl) daysEl.innerHTML = `<i class="fas fa-calendar-check"></i> Días Transcurridos: ${daysPaid}`;

    const statusBox = document.getElementById('withdraw-status');
    const btnWithdraw = document.getElementById('btn-withdraw');

    if (!statusBox || !btnWithdraw) return;

    const matchedUser = currentUser ? usersDB.find(u => u.username === currentUser.username) : null;
    const hasDaily = matchedUser && matchedUser.allowDailyWithdraw;

    const hasPendingWithdraw = matchedUser && matchedUser.withdrawalHistory && matchedUser.withdrawalHistory.some(w => w.status === 'pending');

    if (hasPendingWithdraw) {
        statusBox.innerHTML = '<h4 style="color: var(--warning);"><i class="fas fa-hourglass-half"></i> Retiro en Proceso</h4>' +
            '<p class="small-text mt-2">Tienes una solicitud de retiro pendiente. Por favor espera a que sea confirmada por el administrador.</p>';
        statusBox.style.borderColor = 'var(--warning)';
        btnWithdraw.disabled = true;
        btnWithdraw.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Solicitud de retiro pendiente';
        return;
    }

    if (currentUser && currentUser.isAdmin) {
        statusBox.innerHTML = '<h4 style="color: var(--success);"><i class="fas fa-lock-open"></i> Retiros VIP Habilitados</h4>' +
            '<p class="small-text mt-2">Como administrador, puedes retirar en cualquier momento y sin límite de veces.</p>';
        statusBox.style.borderColor = 'var(--success)';
        btnWithdraw.disabled = false;
        btnWithdraw.innerHTML = 'Solicitar Retiro (Admin)';
        return;
    }

    let reachedLimit = false;
    if (matchedUser) {
        const drTime = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Santo_Domingo"}));
        const todayStr = drTime.toISOString().split('T')[0];
        const limit = matchedUser.allowedWithdrawalsPerDay || 1;
        if (matchedUser.lastWithdrawalDate === todayStr && (matchedUser.withdrawalsToday || 0) >= limit) {
            reachedLimit = true;
        }
    }

    if (reachedLimit) {
        statusBox.innerHTML = '<h4 style="color: var(--danger);"><i class="fas fa-times-circle"></i> Límite de Retiros Alcanzado</h4>' +
            '<p class="small-text mt-2">Has alcanzado tu límite de retiros permitidos por hoy. Vuelve a intentarlo mañana.</p>';
        statusBox.style.borderColor = 'var(--danger)';
        btnWithdraw.disabled = true;
        btnWithdraw.innerHTML = 'Límite alcanzado';
        return;
    }

    if (hasDaily) {
        statusBox.innerHTML = '<h4 style="color: var(--success);"><i class="fas fa-lock-open"></i> Retiros Diarios Habilitados</h4>' +
            '<p class="small-text mt-2">Tienes habilitado el retiro en cualquier momento sin restricciones de tiempo.</p>';
        statusBox.style.borderColor = 'var(--success)';
        btnWithdraw.disabled = false;
        btnWithdraw.innerHTML = 'Solicitar Retiro Diario';
        return;
    }

    btnWithdraw.innerHTML = 'Solicitar Retiro';
    let daysSinceLast = daysPaid;
    if (matchedUser && matchedUser.lastWithdrawalDaysPaid !== undefined) {
        daysSinceLast = daysPaid - matchedUser.lastWithdrawalDaysPaid;
    }

    const daysLeft = 7 - daysSinceLast;

    if (daysPaid > 0 && daysSinceLast >= 7) { 
        statusBox.innerHTML = '<h4 style="color: var(--success);"><i class="fas fa-lock-open"></i> Retiros Habilitados</h4>' +
            '<p class="small-text mt-2">Ya has cumplido tu ciclo de 7 días. Puedes solicitar tus fondos ahora.</p>';
        statusBox.style.borderColor = 'var(--success)';
        btnWithdraw.disabled = false;
    } else {
        const remaining = daysLeft > 0 ? daysLeft : 7;
        statusBox.innerHTML = '<h4 style="color: var(--danger);"><i class="fas fa-lock"></i> Retiros Bloqueados</h4>' +
            `<p class="small-text mt-2">Aún no cumples tu ciclo. Días restantes para su próximo periodo de retiro: <strong id="withdraw-days-left">${remaining} días</strong></p>`;
        statusBox.style.borderColor = 'var(--danger)';
        btnWithdraw.disabled = true;
    }
}

function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-identifier').value.trim();
    const pass = document.getElementById('login-password').value;

    const now = Date.now();
    // Verificación de Rate Limiting (Prevención Fuerza Bruta - OWASP A07)
    if (loginAttempts[user] && loginAttempts[user].count >= 5) {
        if (now - loginAttempts[user].time < 15 * 60 * 1000) {
            alert('Demasiados intentos fallidos. Por favor, espera 15 minutos por seguridad.');
            return;
        } else {
            loginAttempts[user].count = 0; // Reiniciar después de 15 min
        }
    }

    const matchedUser = usersDB.find(u => u.username === user && u.password === pass);

    if (matchedUser) {
        // Reiniciar los intentos fallidos al tener éxito
        if (loginAttempts[user]) loginAttempts[user].count = 0;
        currentUser = { username: matchedUser.username, isAdmin: matchedUser.isAdmin };

        // Load User Data from simulated DB
        currentUserBalance = matchedUser.balance;
        currentUserInvested = matchedUser.invested;
        currentUserEarnings = matchedUser.earnings;
        savedWalletAddress = matchedUser.wallet;

        if (currentUser.isAdmin) {
            document.getElementById('admin-menu-item').style.display = 'flex';

            document.querySelector('#admin-transactions-table tbody').innerHTML = '';
            usersDB.forEach(u => {
                if (u.pendingDeposits && u.pendingDeposits.length > 0) {
                    u.pendingDeposits.forEach(pending => {
                        if (pending.status === 'pending') {
                            addPendingAdminTransactionSync(u.username, 'Depósito', pending.amount, pending.id);
                        }
                    });
                }
                if (u.withdrawalHistory && u.withdrawalHistory.length > 0) {
                    u.withdrawalHistory.forEach(w => {
                        if (w.status === 'pending') {
                            addPendingAdminTransactionSync(u.username, 'Retiro', w.amount, w.id, w.wallet);
                        }
                    });
                }
            });
        } else {
            document.getElementById('admin-menu-item').style.display = 'none';
        }

        const displayFirstname = matchedUser.firstname || matchedUser.username;
        document.getElementById('welcome-username').innerText = displayFirstname;
        document.getElementById('tree-username').innerText = displayFirstname;

        // Load local ui state properly
        chartLabels = ['Inicio'];
        chartData = [0];
        daysPaid = matchedUser.daysPaid || 0;
        realDaysElapsed = matchedUser.realDaysElapsed || 0;

        updateDashboardStats();
        updateWithdrawalStatus();

        navigate('dashboard-layout');
        switchDashboardView('dashboard');

        setTimeout(initChart, 300);

        // Mostrar chat flotante si no es admin
        if (!currentUser.isAdmin) showFloatChatBtn();

        // Reset states just in case
        setTimeout(() => {
            if (typeof cancelDeposit === "function") {
                cancelDeposit();
            }
            if (typeof depositTimer !== 'undefined') {
                clearInterval(depositTimer);
                simulatedDeposit = 0;
            }
        }, 100);

    } else {
        // Registrar intento fallido
        if (!loginAttempts[user]) loginAttempts[user] = { count: 0, time: now };
        loginAttempts[user].count += 1;
        loginAttempts[user].time = now;
        
        const intentosRestantes = 5 - loginAttempts[user].count;
        if (intentosRestantes > 0) {
            alert(`Usuario o contraseña incorrectos. Te quedan ${intentosRestantes} intento(s) antes de ser bloqueado.`);
        } else {
            alert('Has excedido el número de intentos. Tu cuenta/IP ha sido bloqueada localmente por 15 minutos.');
        }
    }
}

function handleForgotPassword(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('forgot-username').value;
    const wordsInput = document.getElementById('forgot-words').value.trim().toLowerCase();

    const matchedUser = usersDB.find(u => u.username === usernameInput);

    if (!matchedUser) {
        alert("El usuario no existe.");
        return;
    }

    const userWords = matchedUser.recoveryWords.join(" ");

    if (wordsInput === userWords || matchedUser.isAdmin) {
        // success or if it's admin (simulated skip for admin since admin doesn't have default words generated)
        alert('Palabras verificadas. Ahora puedes cambiar tu contraseña.');
        pendingResetUsername = matchedUser.username;
        document.getElementById('form-forgot').style.display = 'none';
        document.getElementById('form-reset').style.display = 'block';
    } else {
        alert('Las palabras de recuperación no coinciden. Inténtalo de nuevo.');
    }
}

function handleResetPassword(e) {
    e.preventDefault();
    const pass = document.getElementById('reset-new-password').value;
    const confirmPass = document.getElementById('reset-confirm-password').value;

    if (pass !== confirmPass) {
        alert('Las contraseñas no coinciden.');
        return;
    }

    // Find the pending user and update
    const matchedUser = usersDB.find(u => u.username === pendingResetUsername);
    if (matchedUser) {
        matchedUser.password = pass;
        saveUserToDB(matchedUser);
        alert('Contraseña actualizada correctamente.');
        navigate('login');
        document.getElementById('form-forgot').style.display = 'block';
        document.getElementById('form-reset').style.display = 'none';
        document.getElementById('form-forgot').reset();
        document.getElementById('form-reset').reset();
        pendingResetUsername = "";
    }
}

function logout() {
    currentUser = null;

    // Ocultar elementos de admin
    const adminMenu = document.getElementById('admin-menu-item');
    if (adminMenu) adminMenu.style.display = 'none';

    // Limpiar campos de login
    const loginId = document.getElementById('login-identifier');
    const loginPass = document.getElementById('login-password');
    if (loginId) loginId.value = '';
    if (loginPass) loginPass.value = '';

    // Detener procesos activos
    if (typeof cancelDeposit === "function") {
        cancelDeposit();
    }
    if (typeof depositTimer !== 'undefined') {
        clearInterval(depositTimer);
    }
    simulatedDeposit = 0;

    // Limpiar notificaciones visuales
    const notifContainer = document.getElementById('notifications-container');
    if (notifContainer) notifContainer.innerHTML = '';
    const notifBadge = document.querySelector('a.nav-item[onclick*="notifications"] .badge');
    if (notifBadge) {
        notifBadge.style.display = 'none';
        notifBadge.innerText = '0';
    }

    // Volver a la vista principal
    hideFloatChatBtn();
    navigate('landing');
}


// --- Dashboard Subviews ---

function hideAllSubviews() {
    document.querySelectorAll('.subview').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(v => v.classList.remove('active'));
}

function switchDashboardView(subViewId) {
    hideAllSubviews();
    document.getElementById(`subview-${subViewId}`).classList.add('active');

    // Highlight nav
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        if (item.getAttribute('onclick').includes(subViewId)) {
            item.classList.add('active');
        }
    });

    if (subViewId === 'settings') {
        loadSettingsForm();
    }

    if (subViewId === 'admin') {
        renderAdminUserList();
    }

    if (subViewId === 'invest') {
        checkApprovedDeposits();
    }
    
    if (subViewId === 'withdraw') {
        updateCancelContractDetails();
    }
    
    if (subViewId === 'history') {
        renderHistory('investments');
    }
    
    if (subViewId === 'ticket') {
        renderChat();
    }
    
    // Si estamos en movil, cerramos el menu luego de clickear una opcion
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
    }

    // For mobile: if we pick an option, we might want to auto-scroll up
    window.scrollTo(0, 0);
}

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('mobile-open');
    }
}

// =============================================
// SISTEMA DE CHAT — LIMPIO Y FUNCIONAL
// =============================================

let adminChatTargetUsername = null;

// ---- USUARIO: abrir nuevo chat ----
function openNewChat() {
    if (!currentUser) return;
    const u = usersDB.find(u => u.username === currentUser.username);
    if (!u) return;
    u.chat = { status: 'open', messages: [] };
    saveUserToDB(u);
    renderChat();
}

// ---- USUARIO: enviar mensaje ----
function sendMessage() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const text = escapeHTML(input.value.trim()); // Sanitizar input
    if (!text) return;

    const u = usersDB.find(u => u.username === currentUser.username);
    if (!u) return;

    if (!u.chat || u.chat.status === 'closed') {
        openNewChat();
        return;
    }

    if (!u.chat.messages) u.chat.messages = [];
    u.chat.messages.push({
        sender: currentUser.username,
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAdmin: false
    });

    saveUserToDB(u);
    input.value = '';
    renderChat();

    // Notificar al admin
    addNotification(
        'Nuevo mensaje de ' + currentUser.username,
        text,
        'fa-comments',
        'var(--gold-primary)',
        "switchDashboardView('admin')"
    );
}

// ---- USUARIO: renderizar la sección de soporte ----
function renderChat() {
    if (!currentUser || currentUser.isAdmin) return;

    const panelStart  = document.getElementById('chat-start-panel');
    const panelActive = document.getElementById('chat-active-panel');
    const panelClosed = document.getElementById('chat-closed-notice');
    const badge       = document.getElementById('chat-status-badge');
    if (!panelStart) return;

    const u = usersDB.find(u => u.username === currentUser.username);

    // Sin chat nunca iniciado
    if (!u || !u.chat) {
        panelStart.style.display  = 'block';
        panelActive.style.display = 'none';
        panelClosed.style.display = 'none';
        badge.style.display       = 'none';
        return;
    }

    // Chat cerrado por el admin
    if (u.chat.status === 'closed') {
        panelStart.style.display  = 'none';
        panelActive.style.display = 'none';
        panelClosed.style.display = 'block';
        badge.style.display = 'inline-block';
        badge.style.cssText += 'background:rgba(255,77,79,0.15);color:var(--danger);border:1px solid var(--danger);';
        badge.innerHTML = '<i class="fas fa-lock"></i> Chat cerrado';
        return;
    }

    // Chat abierto — mostrar mensajes
    panelStart.style.display  = 'none';
    panelActive.style.display = 'flex';
    panelClosed.style.display = 'none';
    badge.style.display = 'inline-block';
    badge.style.cssText += 'background:rgba(82,196,26,0.15);color:var(--success);border:1px solid var(--success);';
    badge.innerHTML = '<i class="fas fa-circle" style="font-size:0.55rem;vertical-align:middle;margin-right:4px;"></i> En línea';

    _renderMsgs(u.chat.messages || [], 'chat-messages-container', false);
}

// También se llama desde switchDashboardView
function renderChatView() { renderChat(); }

// ---- ADMIN: lista de conversaciones ----
function renderAdminChatList() {
    const listEl = document.getElementById('admin-chats-list');
    const emptyMsg = document.getElementById('admin-no-chats-msg');
    if (!listEl) return;

    // Usuarios que tienen chat abierto (con mensajes)
    const withChat = usersDB.filter(u => u.chat && u.chat.messages && u.chat.messages.length > 0);

    // Limpiar tarjetas anteriores (no el mensaje vacío)
    Array.from(listEl.children).forEach(c => { if (c.id !== 'admin-no-chats-msg') c.remove(); });

    if (withChat.length === 0) {
        emptyMsg.style.display = 'block';
        return;
    }
    emptyMsg.style.display = 'none';

    withChat.forEach(u => {
        const last   = u.chat.messages[u.chat.messages.length - 1];
        const isOpen = u.chat.status === 'open';
        const active = adminChatTargetUsername === u.username;

        const card = document.createElement('div');
        card.style.cssText = `
            padding:14px 18px; border-radius:10px; cursor:pointer;
            border:1px solid ${active ? 'var(--gold-primary)' : 'var(--panel-border)'};
            background:${active ? 'rgba(212,175,55,0.08)' : 'var(--panel-bg)'};
            display:flex; align-items:center; gap:14px; transition:all 0.2s;
        `;

        card.innerHTML = `
            <div style="width:10px;height:10px;border-radius:50%;flex-shrink:0;
                background:${isOpen ? 'var(--success)' : 'var(--danger)'};
                box-shadow:0 0 6px ${isOpen ? 'var(--success)' : 'var(--danger)'};"></div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;color:var(--gold-primary);">
                    ${u.firstname ? u.firstname + ' ' + (u.lastname || '') : u.username}
                    <span style="font-weight:400;font-size:0.75rem;color:var(--text-muted);margin-left:6px;">@${u.username}</span>
                </div>
                <div style="font-size:0.82rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    ${last ? (last.isAdmin ? '✉ Tú: ' : '') + last.text : 'Sin mensajes'}
                </div>
            </div>
            <span style="font-size:0.72rem;color:var(--text-muted);white-space:nowrap;">${u.chat.messages.length} msg</span>
        `;
        card.onclick = () => adminOpenChat(u.username);
        listEl.appendChild(card);
    });

    // Si el chat activo sigue abierto, refrescar sus mensajes
    if (adminChatTargetUsername) adminRenderChatMessages();
}

// ---- ADMIN: abrir un chat ----
function adminOpenChat(username) {
    adminChatTargetUsername = username;

    const panel = document.getElementById('admin-chat-reply-panel');
    const nameEl = document.getElementById('admin-chat-target-name');
    if (!panel || !nameEl) return;

    const u = usersDB.find(u => u.username === username);
    nameEl.innerText = u ? (u.firstname ? u.firstname + ' ' + (u.lastname || '') + ' (@' + username + ')' : username) : username;

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    adminRenderChatMessages();
    renderAdminChatList();
}

// ---- ADMIN: renderizar mensajes del chat seleccionado ----
function adminRenderChatMessages() {
    if (!adminChatTargetUsername) return;
    const u = usersDB.find(u => u.username === adminChatTargetUsername);
    if (!u || !u.chat) return;
    _renderMsgs(u.chat.messages || [], 'admin-chat-messages', true);
}

// ---- ADMIN: enviar mensaje ----
function adminSendMessage() {
    if (!adminChatTargetUsername) return;
    const input = document.getElementById('admin-chat-input');
    const text = input ? escapeHTML(input.value.trim()) : ''; // Sanitizar input
    if (!text) return;

    const u = usersDB.find(u => u.username === adminChatTargetUsername);
    if (!u) return;

    if (!u.chat) u.chat = { status: 'open', messages: [] };
    if (!u.chat.messages) u.chat.messages = [];

    u.chat.messages.push({
        sender: 'Admin',
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAdmin: true
    });
    u.chat.status = 'open';

    saveUserToDB(u);
    input.value = '';
    adminRenderChatMessages();
}

// ---- ADMIN: finalizar y limpiar chat ----
function adminEndChat() {
    if (!adminChatTargetUsername) return;

    const u = usersDB.find(u => u.username === adminChatTargetUsername);
    if (!u) return;

    // Borrar completamente el chat (sin rastro y sin recuperar)
    delete u.chat;
    saveUserToDB(u);

    // Ocultar panel de respuesta
    const panel = document.getElementById('admin-chat-reply-panel');
    if (panel) panel.style.display = 'none';

    adminChatTargetUsername = null;
    renderAdminChatList();
}

// ---- Función interna: renderizar burbujas de mensajes ----
function _renderMsgs(messages, containerId, isAdminView) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:30px;color:var(--text-muted);">
                <i class="fas fa-comments" style="font-size:2rem;opacity:0.3;display:block;margin-bottom:8px;"></i>
                Sin mensajes aún.
            </div>`;
        return;
    }

    container.innerHTML = messages.map(m => {
        // En vista admin: los mensajes del admin van a la derecha
        // En vista usuario: los mensajes del usuario van a la derecha
        const isMine = isAdminView ? m.isAdmin : !m.isAdmin;
        const label  = escapeHTML(m.isAdmin ? 'Soporte' : m.sender);
        return `
            <div class="msg ${isMine ? 'msg-user' : 'msg-admin'}">
                <span style="font-size:0.68rem;opacity:0.55;display:block;margin-bottom:2px;">${label}</span>
                <p style="margin:0;">${escapeHTML(m.text)}</p>
                <span class="msg-time">${escapeHTML(m.time)}</span>
            </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

// Compatibilidad con llamadas antiguas
function endChat() { openNewChat(); }

// --- History System Logic ---
function switchHistoryTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick*="${tabName}"]`).classList.add('active');
    
    document.querySelectorAll('.history-tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`hist-${tabName}`).classList.add('active');
    
    renderHistory(tabName);
}

function renderHistory(tab) {
    const matchedUser = usersDB.find(u => u.username === currentUser.username);
    if (!matchedUser) return;

    const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

    function fmtDate(iso) {
        if (!iso) return 'N/A';
        const d = new Date(iso);
        return d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })
            + ' ' + d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
    }

    if (tab === 'investments') {
        const tbody = document.getElementById('hist-investments-tbody');
        if (!tbody) return;
        const invs = matchedUser.investments || [];

        if (!invs.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">No hay inversiones registradas aún.</td></tr>';
            return;
        }

        tbody.innerHTML = invs.map((inv, i) => {
            // Fecha: priorizar campo date, fallback al timestamp del id
            let dateStr = 'N/A';
            if (inv.date) {
                dateStr = fmtDate(inv.date);
            } else {
                const ts = parseInt(inv.id.split('_')[1]);
                if (ts && !isNaN(ts)) dateStr = fmtDate(new Date(ts).toISOString());
            }

            const pct = inv.dailyPct ? inv.dailyPct + '%' : (inv.amount < 600 ? '0.80%' : inv.amount < 10000 ? '1.10%' : '1.80%');
            const statusStyle = inv.active ? 'color:var(--success); font-weight:600;' : 'color:var(--text-muted);';
            const statusLabel = inv.active ? '✔ Activa' : 'Cerrada';
            const earnings = inv.earnings || 0;
            const maxEarnings = inv.amount * 2;
            const progress = Math.min((earnings / maxEarnings) * 100, 100).toFixed(1);

            return `
                <tr>
                    <td style="color:var(--text-muted); font-size:0.8rem;">#${i + 1}</td>
                    <td style="color:var(--gold-primary); font-weight:600;">${fmt.format(inv.amount)}</td>
                    <td style="color:var(--success);">${fmt.format(earnings)}</td>
                    <td>
                        <span style="font-size:0.8rem; background:rgba(212,175,55,0.1); padding:3px 8px; border-radius:10px; color:var(--gold-primary);">${pct} / día</span>
                    </td>
                    <td><span style="${statusStyle}">${statusLabel}</span>
                        <div style="width:100%; background:rgba(255,255,255,0.07); height:4px; border-radius:2px; margin-top:4px;">
                            <div style="width:${progress}%; background:var(--gold-primary); height:4px; border-radius:2px;"></div>
                        </div>
                        <span style="font-size:0.7rem; color:var(--text-muted);">${progress}% del 200%</span>
                    </td>
                    <td style="font-size:0.82rem; color:var(--text-muted);">${dateStr}</td>
                </tr>
            `;
        }).join('');
    }

    if (tab === 'withdrawals') {
        const tbody = document.getElementById('hist-withdrawals-tbody');
        if (!tbody) return;
        const wds = matchedUser.withdrawalHistory || [];

        if (!wds.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">No hay retiros registrados aún.</td></tr>';
            return;
        }

        tbody.innerHTML = [...wds].reverse().map(wd => {
            const statusMap = {
                pending:  { label: '⏳ Pendiente',  color: 'var(--gold-primary)' },
                approved: { label: '✔ Aprobado',    color: 'var(--success)' },
                denied:   { label: '✖ Rechazado',   color: 'var(--danger)' }
            };
            const s = statusMap[wd.status] || statusMap.pending;
            const walletShort = wd.wallet ? wd.wallet.slice(0, 8) + '...' + wd.wallet.slice(-4) : 'N/A';
            return `
                <tr>
                    <td style="color:var(--gold-primary); font-weight:600;">${fmt.format(wd.amount)}</td>
                    <td style="color:var(--danger); font-size:0.85rem;">${fmt.format(wd.fee || 0)} (5%)</td>
                    <td title="${wd.wallet || ''}" style="font-size:0.8rem; color:var(--text-muted); cursor:default;">${walletShort}</td>
                    <td style="color:${s.color}; font-weight:600;">${s.label}</td>
                    <td style="font-size:0.82rem; color:var(--text-muted);">${fmtDate(wd.date)}</td>
                </tr>
            `;
        }).join('');
    }

    if (tab === 'bonuses') {
        const tbody = document.getElementById('hist-bonuses-tbody');
        if (!tbody) return;

        // Usar bonusHistory si existe (datos reales con fecha)
        if (matchedUser.bonusHistory && matchedUser.bonusHistory.length > 0) {
            tbody.innerHTML = [...matchedUser.bonusHistory].reverse().map(b => `
                <tr>
                    <td style="color:var(--gold-primary);">${b.from}</td>
                    <td style="color:var(--success); font-weight:600;">+${fmt.format(b.amount)}</td>
                    <td>${fmt.format(b.investedAmount)}</td>
                    <td style="font-size:0.82rem; color:var(--text-muted);">${fmtDate(b.date)}</td>
                </tr>
            `).join('');
        } else {
            // Fallback: calcular desde referidos actuales (para datos pre-existentes)
            const referrals = usersDB.filter(u => u.referrer && u.referrer.toLowerCase() === currentUser.username.toLowerCase() && u.invested > 0);
            if (referrals.length) {
                tbody.innerHTML = referrals.map(ref => `
                    <tr>
                        <td style="color:var(--gold-primary);">${ref.username}</td>
                        <td style="color:var(--success); font-weight:600;">+${fmt.format(ref.invested * 0.07)}</td>
                        <td>${fmt.format(ref.invested)}</td>
                        <td style="color:var(--text-muted); font-size:0.82rem;">—</td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">No hay bonos generados aún.</td></tr>';
            }
        }
    }
}


// --- Modals ---

function showTerms() {
    const modal = document.getElementById('terms-modal');
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function closeTerms() {
    const modal = document.getElementById('terms-modal');
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}


// --- User Actions ---

function clearNotifications() {
    // Remover clase 'unread' de todas las notificaciones
    document.querySelectorAll('.notification-item.unread').forEach(item => {
        item.classList.remove('unread');
        item.classList.add('read');
    });

    // Ocultar el badge rojo del menu
    const notifBadge = document.querySelector('a.nav-item[onclick*="notifications"] .badge');
    if (notifBadge) {
        notifBadge.style.display = 'none';
        notifBadge.innerText = '0';
    }
}

function addNotification(title, message, iconClass, colorClass = '', onClickFnStr = null) {
    const container = document.getElementById('notifications-container');
    if (!container) return;

    const notifDiv = document.createElement('div');
    notifDiv.className = 'notification-item unread';
    if (onClickFnStr) {
        notifDiv.style.cursor = 'pointer';
        notifDiv.setAttribute('onclick', onClickFnStr);
    }

    notifDiv.innerHTML = `
        <div class="notif-icon"><i class="fas ${iconClass} ${colorClass}"></i></div>
        <div class="notif-content">
            <h4>${title}</h4>
            <p class="text-muted small-text">${message}</p>
            <span class="notif-time">Justo ahora</span>
        </div>
    `;

    // Insertar al inicio
    container.insertBefore(notifDiv, container.firstChild);

    // Actualizar badge
    const notifBadge = document.querySelector('a.nav-item[onclick*="notifications"] .badge');
    if (notifBadge) {
        let currentCount = parseInt(notifBadge.innerText) || 0;
        currentCount++;
        notifBadge.innerText = currentCount;
        notifBadge.style.display = 'inline-block';
    }
}

function copyWallet() {
    const input = document.getElementById('wallet-input');
    input.select();
    input.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(input.value);
    alert('Dirección copiada: ' + input.value);
}

function copyRef() {
    const input = document.getElementById('ref-input');
    input.select();
    input.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(input.value);
    alert('Enlace copiado: ' + input.value);
}

function toggleNewWalletInput() {
    const select = document.getElementById('withdraw-wallet-select');
    const newWalletGroup = document.getElementById('new-wallet-group');
    const savedWalletGroup = document.getElementById('saved-wallet-display-group');
    const withdrawNewWallet = document.getElementById('withdraw-new-wallet');
    const savedWalletInput = document.getElementById('withdraw-saved-wallet');

    if (select && select.value === 'new') {
        newWalletGroup.style.display = 'block';
        savedWalletGroup.style.display = 'none';
        withdrawNewWallet.setAttribute('required', 'true');
    } else if (select) {
        newWalletGroup.style.display = 'none';
        savedWalletGroup.style.display = 'block';
        withdrawNewWallet.removeAttribute('required');

        if (savedWalletAddress) {
            savedWalletInput.value = savedWalletAddress;
            savedWalletInput.style.color = "var(--success)";
        } else {
            savedWalletInput.value = "No hay wallet guardada";
            savedWalletInput.style.color = "var(--gold-primary)";
        }
    }
}

function handleWithdraw(e) {
    e.preventDefault();
    const withdrawAmount = parseFloat(document.getElementById('withdraw-amount').value);

    const select = document.getElementById('withdraw-wallet-select');
    let targetWallet = "";
    if (select.value === 'new') {
        targetWallet = escapeHTML(document.getElementById('withdraw-new-wallet').value.trim());
        if (!targetWallet) {
            alert("Por favor, ingresa una dirección de billetera válida.");
            return;
        }
    } else {
        targetWallet = savedWalletAddress;
        if (!targetWallet) {
            alert("No tienes una billetera guardada. Por favor añade una nueva o configúrala en Ajustes.");
            return;
        }
    }

    if (withdrawAmount > currentUserBalance && withdrawAmount > 0) {
        alert('Balance insuficiente para retirar.');
        return;
    }

    const matchedCurrentUser = usersDB.find(u => u.username === currentUser.username);
    const hasDaily = matchedCurrentUser && matchedCurrentUser.allowDailyWithdraw;

    let daysSinceLast = daysPaid;
    if (matchedCurrentUser && matchedCurrentUser.lastWithdrawalDaysPaid !== undefined) {
        daysSinceLast = daysPaid - matchedCurrentUser.lastWithdrawalDaysPaid;
    }

    if (!currentUser.isAdmin && !hasDaily && daysSinceLast < 7) {
        alert('Solo puedes retirar dinero tras cumplir un ciclo de 7 días desde tu último retiro.');
        return;
    }

    if (!currentUser.isAdmin) {
        const drTime = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Santo_Domingo"}));
        const todayStr = drTime.toISOString().split('T')[0];
        
        if (matchedCurrentUser.lastWithdrawalDate !== todayStr) {
            matchedCurrentUser.withdrawalsToday = 0;
            matchedCurrentUser.lastWithdrawalDate = todayStr;
        }

        const limit = matchedCurrentUser.allowedWithdrawalsPerDay || 1;
        if ((matchedCurrentUser.withdrawalsToday || 0) >= limit) {
            alert(`Has alcanzado el límite permitido de ${limit} retiro(s) por día. Por favor inténtalo mañana.`);
            return;
        }
        
        matchedCurrentUser.withdrawalsToday = (matchedCurrentUser.withdrawalsToday || 0) + 1;
        matchedCurrentUser.lastWithdrawalDaysPaid = daysPaid; // Reset the 7-day countdown!
    }

    // Simulate deduction (and 5% fee logic simply reducing balance)
    if (withdrawAmount > 0 && withdrawAmount <= currentUserBalance) {
        const fee = withdrawAmount * 0.05;
        const netWithdraw = withdrawAmount - fee;
        currentUserBalance -= withdrawAmount;

        // Guardar en historial de retiros del usuario
        const dbUser = usersDB.find(u => u.username === currentUser.username);
        if (dbUser) {
            if (!dbUser.withdrawalHistory) dbUser.withdrawalHistory = [];
            dbUser.withdrawalHistory.push({
                id: 'wd_' + Date.now(),
                amount: withdrawAmount,
                fee: fee,
                net: netWithdraw,
                wallet: targetWallet,
                status: 'pending',
                date: new Date().toISOString()
            });
        }

        syncCurrentUserLocalVarsToDB();
        updateDashboardStats();

        // Actualizar grafico
        updateChart('Retiro', currentUserBalance);

        // Enviar notificacion y resetear la vista
        addNotification(
            "Solicitud de Retiro",
            `Su retiro por <strong>$${withdrawAmount.toFixed(2)}</strong> ha sido solicitado con éxito y está en proceso de envío.`,
            "fa-file-invoice-dollar",
            "gold"
        );

        alert(`Solicitud de retiro de $${withdrawAmount} USDT enviada correctamente para revisión.`);
        e.target.reset();
        switchDashboardView('dashboard');

        // Solicitar a Admin
        addPendingAdminTransaction(currentUser.username, 'Retiro', withdrawAmount, targetWallet);
        updateWithdrawalStatus();
    }
}

function updateCancelContractDetails() {
    if (!currentUser) return;
    
    // Asumimos que la cancelación total es sobre TODAS las inversiones.
    // También se puede actualizar para permitir elegir cuál cancelar, 
    // pero para este caso sumaremos todo el amount invertido.
    
    const matchedUser = usersDB.find(u => u.username === currentUser.username);
    let totalActivo = 0;
    
    if (matchedUser && matchedUser.investments) {
        matchedUser.investments.forEach(inv => {
            if(inv.active) totalActivo += inv.amount;
        });
    } else {
        totalActivo = currentUserInvested;
    }
    
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    document.getElementById('cancel-total-invested').innerText = formatter.format(totalActivo);
    
    // Calculate months elapsed roughly based on realDaysElapsed (30 days = 1 month)
    const monthsElapsed = Math.floor(realDaysElapsed / 30);
    document.getElementById('cancel-time-elapsed').innerText = `${monthsElapsed} Meses`;
    
    // Penalidad calculation
    let penaltyPercent = 0.20; // 20% default si < 4 meses
    if (monthsElapsed >= 4) {
        penaltyPercent = 0.10; // 10% si >= 4 meses
    }
    
    const penaltyAmount = totalActivo * penaltyPercent;
    const finalAmount = totalActivo - penaltyAmount;
    
    document.getElementById('cancel-penalty-amount').innerText = `${formatter.format(penaltyAmount)} (${penaltyPercent * 100}%)`;
    document.getElementById('cancel-receive-amount').innerText = formatter.format(finalAmount);
}

function cancelContract() {
    if (currentUserInvested <= 0) {
        alert("No tienes ninguna inversión activa que cancelar.");
        return;
    }

    const destination = document.getElementById('cancel-wallet-destination').value;
    if(!destination) {
        alert("Por favor, ingresa la billetera destino (USDT TRC20) donde deseas recibir tus fondos.");
        document.getElementById('cancel-wallet-destination').focus();
        return;
    }

    const monthsElapsed = Math.floor(realDaysElapsed / 30);
    let penaltyPercent = 0.20;
    if (monthsElapsed >= 4) {
        penaltyPercent = 0.10;
    }

    if (confirm(`⚠️ ATENCIÓN: Estás a punto de cancelar toda tu inversión definitivamente.\n\nTiempo transcurrido: ${monthsElapsed} meses.\nSe te descontará una penalidad del ${penaltyPercent * 100}%.\n\nEl dinero se enviará a: ${destination}\n\n¿Estás completamente seguro de continuar con la cancelación?`)) {
        
        const penaltyAmount = currentUserInvested * penaltyPercent;
        const finalAmountToReceive = currentUserInvested - penaltyAmount;
        
        // Remove active investment completely
        currentUserInvested = 0;
        
        const matchedUser = usersDB.find(u => u.username === currentUser.username);
        if(matchedUser) {
            if(matchedUser.investments) {
                // Deactivate all
                matchedUser.investments.forEach(inv => inv.active = false);
            }
        }
        
        saveLocalDashboardState();
        syncCurrentUserLocalVarsToDB();
        updateDashboardStats();
        
        // Request "special" admin withdrawal for cancellation
        addPendingAdminTransaction(currentUser.username, 'Cancelación (' + destination + ')', finalAmountToReceive);
        
        alert(`¡Inversión cancelada con éxito!\n\nUna solicitud de envío por $${finalAmountToReceive.toFixed(2)} USDT ha sido enviada al administrador a la billetera:\n${destination}\n\nNota: Has perdido tus posibles ganancias futuras.`);
        
        switchDashboardView('dashboard');
    }
}

function toggleEditProfile() {
    // Ya no se necesita — campos siempre activos
}

function loadSettingsForm() {
    if (!currentUser) return;
    const matchedUser = usersDB.find(u => u.username === currentUser.username);
    if (!matchedUser) return;

    const fname = document.getElementById('settings-firstname');
    if (fname) fname.value = matchedUser.firstname || '';

    const lname = document.getElementById('settings-lastname');
    if (lname) lname.value = matchedUser.lastname || '';

    const wallet = document.getElementById('settings-wallet');
    if (wallet) wallet.value = matchedUser.wallet || '';

    // Limpiar contraseñas (nunca se muestran)
    const cp = document.getElementById('settings-current-pass');
    const np = document.getElementById('settings-new-pass');
    if (cp) cp.value = '';
    if (np) np.value = '';
}

function handleSettings(e) {
    e.preventDefault();
    if (!currentUser) return;

    const matchedUser = usersDB.find(u => u.username === currentUser.username);
    if (!matchedUser) return;

    const firstname = escapeHTML(document.getElementById('settings-firstname').value.trim());
    const lastname  = escapeHTML(document.getElementById('settings-lastname').value.trim());
    const newWallet = escapeHTML(document.getElementById('settings-wallet').value.trim());
    const currentPass = document.getElementById('settings-current-pass').value;
    const newPass     = document.getElementById('settings-new-pass').value;

    // Cambio de contraseña (opcional)
    if (newPass || currentPass) {
        if (matchedUser.password !== currentPass) {
            alert('La contraseña actual es incorrecta. El resto de los cambios no se guardaron.');
            return;
        }
        if (newPass.length < 5) {
            alert('La nueva contraseña debe tener al menos 5 caracteres.');
            return;
        }
        matchedUser.password = newPass;
    }

    // Guardar nombre y apellido
    matchedUser.firstname = firstname;
    matchedUser.lastname  = lastname;

    // Actualizar nombre visible en el dashboard
    const displayName = firstname || matchedUser.username;
    const welcomeEl = document.getElementById('welcome-username');
    if (welcomeEl) welcomeEl.innerText = displayName;
    const treeEl = document.getElementById('tree-username');
    if (treeEl) treeEl.innerText = displayName;

    // Guardar wallet
    matchedUser.wallet = newWallet;
    savedWalletAddress = newWallet;

    // Guardar en Firebase
    saveUserToDB(matchedUser);

    toggleNewWalletInput();

    // Feedback visual en el botón
    const btn = document.getElementById('btn-save-settings');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-check"></i> ¡Guardado!';
        btn.style.background = 'var(--success)';
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
            btn.style.background = '';
        }, 2500);
    }

    // Limpiar campos de contraseña
    document.getElementById('settings-current-pass').value = '';
    document.getElementById('settings-new-pass').value = '';
}

// --- Admin Panel Actions ---
let currentlyEditingUsername = "";

function adminSearchUser() {
    if (!currentUser || !currentUser.isAdmin) return;

    const searchInput = document.getElementById('admin-search-user').value;
    const matchedUser = usersDB.find(u => u.username === searchInput);

    if (matchedUser) {
        currentlyEditingUsername = matchedUser.username;
        document.getElementById('admin-edit-username').innerText = matchedUser.username;
        document.getElementById('admin-edit-balance').value = matchedUser.balance;
        document.getElementById('admin-edit-invested').value = matchedUser.invested;
        document.getElementById('admin-edit-password').value = "";
        document.getElementById('admin-edit-wallet').value = matchedUser.wallet;
        
        const newUsernameInput = document.getElementById('admin-edit-new-username');
        if (newUsernameInput) newUsernameInput.value = "";
        
        const dailyToggle = document.getElementById('admin-edit-daily-withdraw');
        if (dailyToggle) dailyToggle.checked = !!matchedUser.allowDailyWithdraw;

        const limitInput = document.getElementById('admin-edit-withdraw-limit');
        if (limitInput) limitInput.value = matchedUser.allowedWithdrawalsPerDay || 1;

        document.getElementById('admin-user-edit-section').style.display = 'block';
    } else {
        alert("Usuario no encontrado en la base de datos.");
        document.getElementById('admin-user-edit-section').style.display = 'none';
    }
}

function adminSaveUser() {
    if (!currentUser || !currentUser.isAdmin || !currentlyEditingUsername) return;

    const matchedUser = usersDB.find(u => u.username === currentlyEditingUsername);
    if (matchedUser) {
        const oldInvested = matchedUser.invested;
        matchedUser.balance = parseFloat(document.getElementById('admin-edit-balance').value) || 0;
        matchedUser.invested = parseFloat(document.getElementById('admin-edit-invested').value) || 0;
        matchedUser.wallet = document.getElementById('admin-edit-wallet').value;

        const dailyToggle = document.getElementById('admin-edit-daily-withdraw');
        if (dailyToggle) {
            matchedUser.allowDailyWithdraw = dailyToggle.checked;
        }

        const limitInput = document.getElementById('admin-edit-withdraw-limit');
        if (limitInput && limitInput.value) {
            matchedUser.allowedWithdrawalsPerDay = parseInt(limitInput.value) || 1;
        }

        let oldUsername = matchedUser.username;
        const newUsernameInput = document.getElementById('admin-edit-new-username');
        if (newUsernameInput && newUsernameInput.value.trim() !== "") {
            const newUsername = newUsernameInput.value.trim();
            if (newUsername !== matchedUser.username) {
                // Check if already in use
                const existing = usersDB.find(u => u.username.toLowerCase() === newUsername.toLowerCase());
                if (existing) {
                    alert("Ese nombre de usuario ya está en uso. Elige otro.");
                    return;
                }
                
                matchedUser.username = newUsername;

                // Update referrers
                usersDB.forEach(u => {
                    if (u.referrer && u.referrer.toLowerCase() === oldUsername.toLowerCase()) {
                        u.referrer = newUsername;
                        saveUserToDB(u);
                    }
                });
                
                currentlyEditingUsername = newUsername;
            }
        }

        // Handle referral bonus for new investment differences
        if (matchedUser.invested > oldInvested && matchedUser.referrer) {
            const addedInvestment = matchedUser.invested - oldInvested;
            const referrerUser = usersDB.find(u => u.username.toLowerCase() === matchedUser.referrer.toLowerCase());
            if (referrerUser) {
                const bonus = addedInvestment * 0.07;
                referrerUser.balance += bonus;
                referrerUser.earnings += bonus;
                saveUserToDB(referrerUser);

                // Notificar al referente
                if (currentUser && currentUser.username.toLowerCase() === referrerUser.username.toLowerCase()) {
                    addNotification(
                        "Comisión por Referido (7%)",
                        `Has recibido una comisión de <strong>$${bonus.toFixed(2)}</strong> por la inversión manual de tu referido <strong>${matchedUser.username}</strong>.`,
                        "fa-percentage",
                        "var(--success)"
                    );
                    currentUserBalance = referrerUser.balance;
                    currentUserEarnings = referrerUser.earnings;
                    updateDashboardStats(); // Update immediately
                }
            }
        }

        const newPass = document.getElementById('admin-edit-password').value;
        if (newPass.trim()) {
            matchedUser.password = newPass;
        }

        if (oldUsername !== matchedUser.username) {
            deleteUserFromDB(oldUsername);
        }
        saveUserToDB(matchedUser);

        alert("Los datos del usuario " + matchedUser.username + " han sido actualizados y guardados en la BD.");

        renderAdminUserList(); // Update list after save

        // If the admin is somehow editing themselves, update their whole specific UI
        if (currentUser.username === oldUsername || currentUser.username === matchedUser.username) {
            currentUser.username = matchedUser.username;
            currentUserBalance = matchedUser.balance;
            currentUserInvested = matchedUser.invested;
            savedWalletAddress = matchedUser.wallet;
            updateDashboardStats();
            const welcomeEl = document.getElementById('welcome-username');
            if (welcomeEl) welcomeEl.innerText = matchedUser.firstname ? matchedUser.firstname : matchedUser.username;
        }

        document.getElementById('admin-user-edit-section').style.display = 'none';
        document.getElementById('admin-search-user').value = "";
    }
}

function adminDeleteUser() {
    if (!currentUser || !currentUser.isAdmin || !currentlyEditingUsername) return;

    if (currentlyEditingUsername === currentUser.username) {
        alert("No puedes eliminar tu propio usuario administrador principal.");
        return;
    }

    if (confirm(`¿Estás extremadamente seguro de que deseas ELIMINAR al usuario '${currentlyEditingUsername}'?\n\nEsta acción borrará toda su inversión, referidos y dinero permanentemente del sistema.`)) {
        const index = usersDB.findIndex(u => u.username === currentlyEditingUsername);
        if (index > -1) {
            usersDB.splice(index, 1); // Delete from DB
            deleteUserFromDB(currentlyEditingUsername);
            alert(`El usuario ${currentlyEditingUsername} ha sido eliminado definitivamente.`);
            document.getElementById('admin-user-edit-section').style.display = 'none';
            document.getElementById('admin-search-user').value = "";
            currentlyEditingUsername = "";
            renderAdminUserList(); // Update list
        }
    }
}

function renderAdminUserList() {
    renderAdminChatList(); // Actualizar lista de chats también
    const tBody = document.getElementById('admin-all-users-tbody');
    if (!tBody) return;

    if (usersDB.length === 0) {
        tBody.innerHTML = '<tr><td colspan="5" style="padding: 10px; text-align: center; color: var(--text-muted);">No hay usuarios registrados.</td></tr>';
        return;
    }

    let html = '';
    usersDB.forEach(user => {
        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        const refName = user.referrer || '<span class="text-muted">Ninguno</span>';

        html += `
            <tr style="border-bottom: 1px solid rgba(212,175,55,0.1);">
                <td style="padding: 10px;">${user.username} ${user.isAdmin ? '<i class="fas fa-shield-alt gold" title="Admin"></i>' : ''}</td>
                <td style="padding: 10px; color: var(--success);">${formatter.format(user.balance)}</td>
                <td style="padding: 10px;">${formatter.format(user.invested)}</td>
                <td style="padding: 10px;">${refName}</td>
                <td style="padding: 10px;">
                    <button class="btn btn-outline" style="padding: 5px 10px; font-size: 0.8rem;" onclick="adminDirectEdit('${user.username}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                </td>
            </tr>
        `;
    });
    tBody.innerHTML = html;
}

function adminDirectEdit(username) {
    document.getElementById('admin-search-user').value = username;
    adminSearchUser();
    // Scroll to search area if needed
    document.getElementById('admin-search-user').scrollIntoView({ behavior: 'smooth' });
}

// --- TRONSCAN & Deposits Simulation ---

function initiateDeposit() {
    const inputField = document.getElementById('deposit-amount-input');
    const amount = parseFloat(inputField.value);

    if (!amount || amount < 50) {
        alert("Por favor, ingresa el monto a depositar (mínimo 50 USDT).");
        return;
    }

    // Show step 2, hide step 1
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    document.getElementById('display-deposit-amount').innerText = formatter.format(amount);

    document.getElementById('deposit-step-1').style.display = 'none';
    document.getElementById('deposit-step-2').style.display = 'block';
}

function cancelDeposit() {
    // Reset inputs and visibility
    document.getElementById('deposit-amount-input').value = '';
    document.getElementById('deposit-step-1').style.display = 'block';
    document.getElementById('deposit-step-2').style.display = 'none';

    // Reset verify status if it was active
    document.getElementById('verify-status').style.display = 'none';
    document.getElementById('apply-investment-section').style.display = 'none';
    document.getElementById('btn-verify').disabled = false;
}

function verifyDeposit() {
    const inputField = document.getElementById('deposit-amount-input');
    const amount = parseFloat(inputField.value);

    // Mínimo de $50 exigido
    if (!amount || amount < 50) {
        alert("El depósito mínimo para entrar a Universal Profits es de $50 USDT. Por favor, ingresa una cantidad válida.");
        return;
    }

    const btn = document.getElementById('btn-verify');
    const btnCancel = document.getElementById('btn-cancel');
    const statusText = document.getElementById('verify-status');

    btn.disabled = true;
    btnCancel.disabled = true;
    statusText.style.display = 'block';
    statusText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando comprobante a sucursal...';

    // Simular envío de solicitud a Admin
    setTimeout(() => {
        statusText.style.color = '#d4af37'; // gold
        statusText.innerHTML = '<i class="fas fa-clock"></i> <strong>cargando esperando confirmación de depósito</strong>';

        // Simular notificación al admin en su panel
        addPendingAdminTransaction(currentUser.username, 'Depósito', amount);

        // Simular que el usuario recibe la respuesta (para esto hacemos polling visual)
        checkDepositStatusLoop(amount);

    }, 2000);
}

// Variables Globales para simular comunicación Admin <-> User
let depositTimer;

function checkDepositStatusLoop(amount) {
    const matchedUser = usersDB.find(u => u.username === currentUser.username);
    if (!matchedUser) return;

    // Buscar si la transaccion pendiente fue removida/procesada
    const pendingInfo = matchedUser.pendingDeposits.find(t => t.amount === amount && t.status !== 'pending');

    if (pendingInfo && pendingInfo.status === 'approved') {
        clearInterval(depositTimer);
        const statusText = document.getElementById('verify-status');
        const applySection = document.getElementById('apply-investment-section');

        statusText.style.color = 'var(--success)';
        statusText.innerHTML = '<i class="fas fa-check-circle"></i> <strong>depósito confirmado ahora usted necesita aplicar la inversión ya que está confirmado como estaba anteriormente</strong>';

        // Navegar automáticamente a la opción de invertir
        switchDashboardView('invest');

        simulatedDeposit = amount;
        const fee = simulatedDeposit * 0.05;

        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        document.getElementById('detected-balance').innerText = formatter.format(simulatedDeposit);
        document.getElementById('detected-fee').innerText = formatter.format(fee);

        applySection.style.display = 'block';

        // Remove from db to clean up
        matchedUser.pendingDeposits = matchedUser.pendingDeposits.filter(t => t !== pendingInfo);

    } else if (pendingInfo && pendingInfo.status === 'denied') {
        clearInterval(depositTimer);
        const statusText = document.getElementById('verify-status');
        const applySection = document.getElementById('apply-investment-section');

        statusText.style.color = 'var(--danger)';
        statusText.innerHTML = '<i class="fas fa-times-circle"></i> <strong>Su depósito no ha sido recibido. Reinténtelo de nuevo.</strong>';

        applySection.style.display = 'none';

        document.getElementById('btn-verify').disabled = false;
        document.getElementById('btn-cancel').disabled = false;

        // Remove from db 
        matchedUser.pendingDeposits = matchedUser.pendingDeposits.filter(t => t !== pendingInfo);

    } else {
        depositTimer = setTimeout(() => checkDepositStatusLoop(amount), 1000); // Check every sec
    }
}

function checkApprovedDeposits() {
    if (!currentUser) return;
    const matchedUser = usersDB.find(u => u.username === currentUser.username);
    if (!matchedUser) return;

    let amountToApply = simulatedDeposit;

    const pendingInfo = matchedUser.pendingDeposits.find(t => t.status === 'approved');
    if (pendingInfo) {
        amountToApply = pendingInfo.amount;
        simulatedDeposit = amountToApply;
        // Clean up from DB
        matchedUser.pendingDeposits = matchedUser.pendingDeposits.filter(t => t !== pendingInfo);
    }

    if (amountToApply > 0) {
        document.getElementById('deposit-step-1').style.display = 'none';
        document.getElementById('deposit-step-2').style.display = 'block';

        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        document.getElementById('display-deposit-amount').innerText = formatter.format(amountToApply);

        const statusText = document.getElementById('verify-status');
        const applySection = document.getElementById('apply-investment-section');

        statusText.style.display = 'block';
        statusText.style.color = 'var(--success)';
        statusText.innerHTML = '<i class="fas fa-check-circle"></i> <strong>depósito confirmado ahora usted necesita aplicar la inversión ya que está confirmado como estaba anteriormente</strong>';

        const fee = amountToApply * 0.05;
        document.getElementById('detected-balance').innerText = formatter.format(amountToApply);
        document.getElementById('detected-fee').innerText = formatter.format(fee);

        applySection.style.display = 'block';

        document.getElementById('btn-verify').disabled = true;
        document.getElementById('btn-cancel').disabled = true;
    }
}

// Admin Panel Transactions
function addPendingAdminTransaction(username, type, amount, extraOpt = null) {
    const tBody = document.querySelector('#admin-transactions-table tbody');
    const emptyRow = document.getElementById('empty-transactions-msg');
    if (emptyRow && emptyRow.parentNode) {
        emptyRow.parentNode.removeChild(emptyRow);
    }

    const rowId = 'admin-row-' + Date.now();

    if (currentUser && currentUser.isAdmin) {
        let msg = "";
        let color = "";
        let icon = "fa-exchange-alt";
        
        if(type === 'Ticket') {
             msg = `El usuario <strong>${username}</strong> ha enviado un nuevo ticket: <strong>${amount}</strong>. Revisa el Panel de Admin.`;
             color = "var(--gold-primary)";
             icon = "fa-ticket-alt";
        } else if (type === 'Depósito') {
             msg = `El usuario <strong>${username}</strong> ha reportado un depósito de <strong>$${amount}</strong>. Revisa el Panel de Admin para confirmarlo.`;
             color = 'gold';
        } else {
             msg = `El usuario <strong>${username}</strong> ha solicitado un retiro de <strong>$${amount}</strong>.<br>Wallet: <strong style="color:var(--gold-primary)">${extraOpt || 'N/A'}</strong><br>Revisa el Panel de Admin para procesarlo.`;
             color = 'var(--danger)';
        }

        addNotification(
            type + " Pendiente",
            msg,
            icon,
            color,
            `highlightAdminRow('${rowId}')`
        );
    }

    // Log intent to DB
    const dbUser = usersDB.find(u => u.username === username);
    if (dbUser && type === 'Depósito') {
        dbUser.pendingDeposits.push({ id: rowId, amount: amount, status: 'pending' });
        saveUserToDB(dbUser);
    }
    // tickets are already saved by submitTicket locally before calling this

    const row = document.createElement('tr');
    row.id = rowId;
    row.style.borderBottom = '1px solid rgba(212,175,55,0.1)';
    row.style.transition = 'background-color 0.5s ease';

    let typeLabel = "";
    if(type === 'Depósito') typeLabel = `<span style="color: var(--gold-primary)">Depósito</span>`;
    else if(type === 'Ticket') typeLabel = `<span style="color: var(--gold-primary)"><i class="fas fa-headset"></i> Soporte</span>`;
    else typeLabel = `<span style="color: var(--danger)">Retiro<br><small style="font-size: 0.8em; opacity: 0.8;">Wallet: ${extraOpt || 'N/A'}</small></span>`;
    
    let actionButtons = "";
    if(type === 'Ticket') {
        // Encontrar el último ticket del user para el ID (simplificado por asincronía)
        const t = dbUser && dbUser.tickets && dbUser.tickets[dbUser.tickets.length -1];
        const tid = t ? t.id : '';
        actionButtons = `
            <div style="display: flex; flex-direction: column; gap: 5px;">
                <input type="text" placeholder="Escribe tu respuesta..." class="admin-ticket-answer" style="padding: 5px; background: rgba(0,0,0,0.3); border: 1px solid var(--panel-border); color: #fff;">
                <button class="btn btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="answerTicketAdmin(this, '${username}', '${tid}')"><i class="fas fa-paper-plane"></i> Responder</button>
            </div>
        `;
    } else {
        actionButtons = `
            <button class="btn btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="approveTransactionAdmin(this, '${type}', '${username}', ${amount})"><i class="fas fa-check"></i> Confirmar</button>
            <button class="btn btn-danger" style="padding: 5px 10px; font-size: 0.8rem;" onclick="denyTransactionAdmin(this, '${type}', '${username}', ${amount})"><i class="fas fa-times"></i> Rechazar</button>
        `;
    }

    let amountValue = (type === 'Ticket') ? amount /* amount contains subject string here */ : '$' + amount;

    row.innerHTML = `
        <td style="padding: 10px;">${username}</td>
        <td style="padding: 10px;">${typeLabel}</td>
        <td style="padding: 10px; color: var(--gold-primary);">${amountValue}</td>
        <td style="padding: 10px;"><span style="color: #d4af37;">En Revisión</span></td>
        <td style="padding: 10px; display: flex; gap: 5px;">
            ${actionButtons}
        </td>
    `;
    tBody.appendChild(row);
}

function addPendingAdminTransactionSync(username, type, amount, pendingId, extraOpt = null) {
    const tBody = document.querySelector('#admin-transactions-table tbody');
    const emptyRow = document.getElementById('empty-transactions-msg');
    if (emptyRow && emptyRow.parentNode) {
        emptyRow.parentNode.removeChild(emptyRow);
    }

    let msg = type === 'Depósito' ?
        `El usuario <strong>${username}</strong> ha reportado un depósito de <strong>$${amount}</strong>. Revisa el Panel de Admin para confirmarlo.` :
        `El usuario <strong>${username}</strong> ha solicitado un retiro de <strong>$${amount}</strong>.<br>Wallet: <strong style="color:var(--gold-primary)">${extraOpt || 'N/A'}</strong><br>Revisa el Panel de Admin para procesarlo.`;

    let color = type === 'Depósito' ? 'gold' : 'var(--danger)';
    addNotification(
        type + " Pendiente",
        msg,
        "fa-exchange-alt",
        color,
        `highlightAdminRow('${pendingId}')`
    );

    // Solo se regenera la tabla HTML (los datos ya están en la DB)
    const row = document.createElement('tr');
    row.id = pendingId;
    row.style.borderBottom = '1px solid rgba(212,175,55,0.1)';
    row.style.transition = 'background-color 0.5s ease';

    const typeLabel = type === 'Depósito' ? `<span style="color: var(--gold-primary)">Depósito</span>` : `<span style="color: var(--danger)">Retiro<br><small style="font-size: 0.8em; opacity: 0.8;">Wallet: ${extraOpt || 'N/A'}</small></span>`;

    row.innerHTML = `
        <td style="padding: 10px;">${username}</td>
        <td style="padding: 10px;">${typeLabel}</td>
        <td style="padding: 10px; color: var(--gold-primary);">$${amount}</td>
        <td style="padding: 10px;"><span style="color: #d4af37;">En Revisión</span></td>
        <td style="padding: 10px; display: flex; gap: 5px;">
            <button class="btn btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="approveTransactionAdmin(this, '${type}', '${username}', ${amount})"><i class="fas fa-check"></i> Confirmar</button>
            <button class="btn btn-danger" style="padding: 5px 10px; font-size: 0.8rem;" onclick="denyTransactionAdmin(this, '${type}', '${username}', ${amount})"><i class="fas fa-times"></i> Rechazar</button>
        </td>
    `;
    tBody.appendChild(row);
}

function highlightAdminRow(rowId) {
    if (!currentUser.isAdmin) return;
    switchDashboardView('admin');

    setTimeout(() => {
        const row = document.getElementById(rowId);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight background
            row.style.backgroundColor = 'rgba(212, 175, 55, 0.3)';

            // Revert after 10 seconds
            setTimeout(() => {
                row.style.backgroundColor = 'transparent';
            }, 10000);
        }
    }, 100);
}

function approveTransactionAdmin(btnElement, type, username, amount) {
    // Cambiar estado a aprobado visualmente
    btnElement.parentNode.innerHTML = '<span style="color: var(--success);"><i class="fas fa-check"></i> Confirmado</span>';

    if (type === 'Depósito') {
        const dbUser = usersDB.find(u => u.username === username);
        if (dbUser) {
            const t = dbUser.pendingDeposits.find(tx => tx.amount === amount && tx.status === 'pending');
            if (t) t.status = 'approved';
            saveUserToDB(dbUser);
        }
        alert("💰 Has confirmado el depósito correctamente. El usuario ha sido notificado para activar su inversión.");
    } else {
        // Marcar retiro como aprobado en historial del usuario
        const dbUser = usersDB.find(u => u.username === username);
        if (dbUser && dbUser.withdrawalHistory) {
            const wd = dbUser.withdrawalHistory.slice().reverse().find(w => w.amount === amount && w.status === 'pending');
            if (wd) {
                wd.status = 'approved';
                wd.processedDate = new Date().toISOString();
            }
            saveUserToDB(dbUser);
        }
        alert("💸 Has procesado el retiro correctamente. El balance del usuario ya ha sido actualizado.");
    }
}

function denyTransactionAdmin(btnElement, type, username, amount) {
    // Cambiar estado a denegado visualmente
    btnElement.parentNode.innerHTML = '<span style="color: var(--danger);"><i class="fas fa-times"></i> Rechazado</span>';

    if (type === 'Depósito') {
        const dbUser = usersDB.find(u => u.username === username);
        if (dbUser) {
            const t = dbUser.pendingDeposits.find(tx => tx.amount === amount && tx.status === 'pending');
            if (t) t.status = 'denied';
            saveUserToDB(dbUser);
        }
        alert("❌ Has marcado el depósito como NO RECIBIDO. El usuario ha sido notificado.");
    } else {
        // Devolver el dinero al balance
        const dbUser = usersDB.find(u => u.username === username);
        if (dbUser && dbUser.withdrawalHistory) {
            const wd = dbUser.withdrawalHistory.slice().reverse().find(w => w.amount === amount && w.status === 'pending');
            if (wd) {
                wd.status = 'denied';
                wd.processedDate = new Date().toISOString();
                dbUser.isRecalculatedFromStart_v3 = false; // Fuerza recálculo si usara la vieja formula, aunque la nueva lo excluye automático de `totalWithdrawals`
            }
            saveUserToDB(dbUser);
        }
        alert("❌ Has denegado el retiro. El dinero regresó al balance del usuario.");
    }
}

function applyInvestment() {
    if (simulatedDeposit > 0) {
        const fee = simulatedDeposit * 0.05;
        const netInvestment = simulatedDeposit - fee;

        // Sumar la inversión activa del usuario
        currentUserInvested += netInvestment;
        simulatedDeposit = 0; // Reset

        // Update DB
        const dbUser = usersDB.find(u => u.username === currentUser.username);
        if (dbUser) {
            dbUser.invested = currentUserInvested;
            
            const now = Date.now();
            const dailyPct = netInvestment < 600 ? 0.80 : netInvestment < 10000 ? 1.10 : 1.80;
            const newInv = {
                id: 'inv_' + now,
                amount: netInvestment,
                earnings: 0,
                active: true,
                date: new Date().toISOString(),
                dailyPct: dailyPct
            };
            if(!dbUser.investments) {
                dbUser.investments = [newInv];
            } else {
                dbUser.investments.push(newInv);
            }

            // Handle referral bonus
            if (dbUser.referrer) {
                const referrerUser = usersDB.find(u => u.username.toLowerCase() === dbUser.referrer.toLowerCase());
                if (referrerUser) {
                    const bonus = (netInvestment * 0.07);
                    referrerUser.balance += bonus;
                    referrerUser.earnings += bonus;

                    // Guardar bono en historial del referente
                    if (!referrerUser.bonusHistory) referrerUser.bonusHistory = [];
                    referrerUser.bonusHistory.push({
                        from: dbUser.username,
                        amount: bonus,
                        investedAmount: netInvestment,
                        date: new Date().toISOString()
                    });

                    // Modificar a Ganancia Total Histórica
                    if (!referrerUser.totalHistoricalEarnings) referrerUser.totalHistoricalEarnings = referrerUser.earnings || 0;
                    referrerUser.totalHistoricalEarnings += bonus;
                    referrerUser.earnings = referrerUser.totalHistoricalEarnings;

                    // Notificar al referente si está logueado o simplemente registrarlo
                    if (currentUser && currentUser.username.toLowerCase() === referrerUser.username.toLowerCase()) {
                        addNotification(
                            "Comisión por Referido (7%)",
                            `Has recibido una comisión de <strong>$${bonus.toFixed(2)}</strong> por la inversión de tu referido <strong>${dbUser.username}</strong> (7%).`,
                            "fa-percentage",
                            "var(--success)"
                        );
                        currentUserBalance = referrerUser.balance; // Actualizar balance local si es el mismo usuario
                        currentUserEarnings = referrerUser.earnings; // Actualizar ganancias totales locales si es el mismo usuario
                    }
                    saveUserToDB(referrerUser); // Asegurar que el referente guarda su nueva comisión instantáneamente
                }
            }
            saveUserToDB(dbUser);
        }

        updateDashboardStats();

        // Update Chart adding a specific data point for the new investment
        daysPaid += 1; // Para la demonstración, mostramos que avanzó
        updateChart('Inversión ($' + netInvestment + ')', currentUserInvested);

        document.getElementById('apply-investment-section').style.display = 'none';

        const statusText = document.getElementById('verify-status');
        statusText.style.color = 'var(--success)';

        // Calcular el próximo día hábil
        const today = new Date();
        const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
        let nextPaymentDayText = "mañana";

        if (currentDay === 5) { // Viernes
            nextPaymentDayText = "el próximo Lunes";
        } else if (currentDay === 6) { // Sábado
            nextPaymentDayText = "el próximo Lunes";
        }

        statusText.innerHTML = `<i class="fas fa-check-circle"></i> <strong>Inversión Activada.</strong><br><br>Su inversión ha sido acreditada exitosamente descontando el 5% de Fee. Comenzará a generar retornos a partir de ${nextPaymentDayText} a las <strong>6:00 PM (Hora de República Dominicana)</strong>.`;

        // Simular reinicio después de 15 seg
        setTimeout(() => {
            document.getElementById('btn-verify').disabled = false;
            statusText.style.display = 'none';
            statusText.style.color = 'var(--text-muted)';

            // Volver al paso 1
            document.getElementById('deposit-amount-input').value = '';
            document.getElementById('deposit-step-1').style.display = 'block';
            document.getElementById('deposit-step-2').style.display = 'none';
        }, 15000);
    }
}


// --- Theme Settings ---

function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('up-theme', themeName);

    // Update buttons
    document.getElementById('btn-theme-dark').classList.remove('active');
    document.getElementById('btn-theme-light').classList.remove('active');
    document.getElementById(`btn-theme-${themeName}`).classList.add('active');

    // Mantenemos los colores dinámicos del gráfico al cambiar de tema si el usuario está logueado
    if (growthChartInstance) {
        initChart();
    }

    // Update QR color based on theme
    const qrImage = document.getElementById('qr-image');
    if (qrImage) {
        if (themeName === 'light') {
            qrImage.src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TGCEGCmXpcxEv8RwyebbCUyHAYn8ugCVZ7&color=c5a028&bgcolor=ffffff";
        } else {
            qrImage.src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TGCEGCmXpcxEv8RwyebbCUyHAYn8ugCVZ7&color=d4af37&bgcolor=1a1a1a";
        }
    }
}

// ===== CHAT FLOTANTE =====

let floatChatOpen = false;

function showFloatChatBtn() {
    if (!currentUser || currentUser.isAdmin) return;
    const btn = document.getElementById('float-chat-btn');
    if (btn) btn.style.display = 'block';
}

function hideFloatChatBtn() {
    const btn = document.getElementById('float-chat-btn');
    if (btn) btn.style.display = 'none';
    const panel = document.getElementById('float-chat-panel');
    if (panel) panel.style.display = 'none';
    floatChatOpen = false;
}

function toggleFloatChat() {
    floatChatOpen = !floatChatOpen;
    const panel = document.getElementById('float-chat-panel');
    if (!panel) return;
    panel.style.display = floatChatOpen ? 'block' : 'none';
    if (floatChatOpen) {
        renderFloatChat();
        // Quitar badge
        const badge = document.getElementById('float-chat-badge');
        if (badge) badge.style.display = 'none';
    }
}

function renderFloatChat() {
    if (!currentUser) return;
    const u = usersDB.find(u => u.username === currentUser.username);
    const messagesEl = document.getElementById('float-chat-messages');
    const inputArea  = document.getElementById('float-chat-input-area');
    const closedEl   = document.getElementById('float-chat-closed');
    const statusText = document.getElementById('float-chat-status-text');
    if (!messagesEl) return;

    const show = (el, v) => { if (el) el.style.display = v; };

    if (!u || !u.chat) {
        show(messagesEl, 'flex'); show(inputArea, 'flex'); show(closedEl, 'none');
        if (statusText) statusText.textContent = 'Escríbenos, te respondemos pronto';
        messagesEl.innerHTML = `<div style="text-align:center;margin:auto;padding:20px;color:var(--text-muted);">
            <i class="fas fa-comments" style="font-size:2rem;opacity:0.3;display:block;margin-bottom:8px;"></i>
            Envíanos un mensaje.</div>`;
        return;
    }

    if (u.chat.status === 'closed') {
        show(messagesEl, 'none'); show(inputArea, 'none'); show(closedEl, 'block');
        if (statusText) statusText.textContent = 'Chat cerrado';
        return;
    }

    show(messagesEl, 'flex'); show(inputArea, 'flex'); show(closedEl, 'none');
    if (statusText) statusText.textContent = 'En línea — te respondemos pronto';

    const msgs = u.chat.messages || [];
    if (msgs.length === 0) {
        messagesEl.innerHTML = `<div style="text-align:center;margin:auto;padding:20px;color:var(--text-muted);">
            <i class="fas fa-comments" style="font-size:2rem;opacity:0.3;display:block;margin-bottom:8px;"></i>
            Envíanos un mensaje.</div>`;
        return;
    }

    messagesEl.innerHTML = msgs.map(m => `
        <div class="float-msg ${m.isAdmin ? 'float-msg-admin' : 'float-msg-user'}">
            <span class="float-msg-sender">${m.isAdmin ? 'Soporte' : m.sender}</span>
            ${m.text}
            <span class="float-msg-time">${m.time}</span>
        </div>`).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function floatChatSend() {
    const input = document.getElementById('float-chat-input');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    const u = usersDB.find(u => u.username === currentUser.username);
    if (!u) return;

    if (!u.chat || u.chat.status === 'closed') {
        u.chat = { status: 'open', messages: [] };
    }
    if (!u.chat.messages) u.chat.messages = [];

    u.chat.messages.push({
        sender: currentUser.username,
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAdmin: false
    });
    u.chat.status = 'open';

    saveUserToDB(u);
    input.value = '';
    renderFloatChat();

    addNotification(
        'Nuevo mensaje de ' + currentUser.username,
        text,
        'fa-comments',
        'var(--gold-primary)',
        "switchDashboardView('admin')"
    );
}

function notifyFloatChatBadge() {
    if (floatChatOpen) return;
    const badge = document.getElementById('float-chat-badge');
    if (badge) badge.style.display = 'flex';
}
