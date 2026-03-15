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
            if (currentUser.isAdmin) renderAdminUserList();
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
    const matchedUser = window.usersDB?.find(u => u.username === currentUser.username);
    if (matchedUser) {
        matchedUser.balance = currentUserBalance;
        matchedUser.invested = currentUserInvested;
        matchedUser.earnings = currentUserEarnings;
        matchedUser.wallet = savedWalletAddress;

        if (!matchedUser.pendingDeposits) matchedUser.pendingDeposits = [];

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
                daysPaid = parseInt(localStorage.getItem('up_daysPaid')) || 0;
                realDaysElapsed = parseInt(localStorage.getItem('up_realDaysElapsed')) || 0;

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

                const displayFirstname = matchedUser.firstname || matchedUser.username;
                document.getElementById('welcome-username').innerText = displayFirstname;
                document.getElementById('tree-username').innerText = displayFirstname;

                updateDashboardStats();
                updateWithdrawalStatus();
                navigate('dashboard-layout');

                const savedView = localStorage.getItem('up_currentView') || 'dashboard';
                switchDashboardView(savedView);
                setTimeout(initChart, 300);
            } else {
                navigate('login');
            }
        } else {
            navigate('login');
        }
        initialLoadDone = true;
    }).catch(err => {
        console.error("Firebase connection error: ", err);
        navigate('login');
    });
});

// --- Authentication Flow ---

const RECOVERY_DICTIONARY = ["sol", "luna", "rio", "montaña", "mar", "estrella", "nube", "viento", "fuego", "tierra", "oro", "plata", "bronce", "cielo", "valle", "bosque", "hoja", "raiz", "fruto", "semilla"];

let tmpRecoveryWords = [];
let pendingResetUsername = "";

function handleRegister(e) {
    e.preventDefault();

    const firstname = document.getElementById('reg-firstname').value;
    const lastname = document.getElementById('reg-lastname').value;
    const username = document.getElementById('reg-username').value;
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
        const displayFirstname = aff.firstname || aff.username;

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

    const prizes = [
        { id: 1, name: "Primer Premio", req: 20000, desc: "iPhone último modelo <br>+ <strong>500 USD</strong> de inversión en la plataforma.", icon: "fa-mobile-alt" },
        { id: 2, name: "Segundo Premio", req: 40000, desc: "MacBook Pro última generación.", icon: "fa-laptop" },
        { id: 3, name: "Tercer Premio", req: 70000, desc: "Resort/viaje valorado en aprox. <strong>5,000 USD</strong>.", icon: "fa-plane-departure" },
        { id: 4, name: "Cuarto Premio", req: 100000, desc: "10,000 USD <br><span style='color: var(--text-color); font-weight: normal; font-size: 0.85rem;'>o artículo de lujo equivalente (cadena de diamantes o Rolex).</span>", icon: "fa-gem" }
    ];

    let html = "";
    prizes.forEach(prize => {
        const unlocked = networkVolume >= prize.req;

        // Estilos base
        let cardStyle = "display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; ";
        let iconColor = "var(--text-muted)";
        let titleColor = "var(--text-muted)";
        let lockHtml = "";

        if (unlocked) {
            // Unlocked -> Gold & White
            cardStyle += "background: var(--gold-primary); color: #fff; box-shadow: 0 5px 15px rgba(212,175,55,0.4);";
            iconColor = "#fff";
            titleColor = "#fff";
        } else {
            // Locked -> Semi-transparent, lock overlay
            cardStyle += "background: rgba(255,255,255,0.02); opacity: 0.6;";
            lockHtml = `<div style="position: absolute; top:0; left:0; right:0; bottom:0; display:flex; justify-content:center; align-items:center; background: rgba(0,0,0,0.4); border-radius: 12px; z-index: 10;">
                            <i class="fas fa-lock" style="font-size: 4rem; color: rgba(255,255,255,0.2);"></i>
                        </div>`;
        }

        html += `
            <div class="stat-card" style="${cardStyle}">
                ${lockHtml}
                <div style="font-size: 2.5rem; color: ${iconColor}; margin-bottom: 15px;"><i class="fas ${prize.icon}"></i></div>
                <h4 style="color: ${titleColor};">${prize.name}</h4>
                <p class="small-text mt-2" style="${unlocked ? 'color:#fff;' : 'color:var(--text-muted);'}">Volumen req: <strong>${prize.req.toLocaleString()} USD</strong></p>
                <div style="width: 100%; background: rgba(0,0,0,0.2); height: 6px; border-radius: 3px; margin: 10px 0;">
                    <div style="width: ${Math.min((networkVolume / prize.req) * 100, 100)}%; background: ${unlocked ? '#fff' : 'var(--gold-primary)'}; height: 100%; border-radius: 3px;"></div>
                </div>
                <p class="mt-2" style="font-size: 0.9rem;">${prize.desc}</p>
                ${unlocked ? '<div style="margin-top: 10px; padding: 5px 10px; background: rgba(255,255,255,0.2); border-radius: 15px; font-size: 0.8rem; font-weight: bold; color: var(--gold-primary);"><i class="fas fa-check-circle"></i> DESBLOQUEADO</div>' : ''}
            </div>
        `;
    });

    container.innerHTML = html;
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

function simulateDailyPayment() {
    if (currentUserInvested <= 0) {
        alert('No tienes ninguna inversión activa para generar rendimientos.');
        return;
    }

    // Incrementar dias semanales simulados
    realDaysElapsed++;

    // Supongamos que día 1 es Lunes, día 6 es sábado, y día 7 (0) es Domingo
    let dayOfWeek = (realDaysElapsed % 7);
    let maxEarnings = currentUserInvested * 2; // El doble de su capital (Ciclo de 200%)

    if (currentUserEarnings >= maxEarnings) {
        alert('Has alcanzado el ciclo máximo del 200% para esta inversión. Tu paquete actual no generará más rendimientos hasta realizar una reinversión.');
        return;
    }

    if (dayOfWeek === 6 || dayOfWeek === 0) {
        // Fin de semana
        addNotification(
            "Mercado Cerrado",
            `Hoy es fin de semana. No se generan rendimientos de inversión los sábados ni domingos.`,
            "fa-bed",
            "text-muted"
        );
        daysPaid++; // El ciclo de 7 días avanza igual, aunque no se pague
    } else {
        // Calcular porcentaje diario según el capital
        let dailyPercent = 0;
        if (currentUserInvested < 600) {
            dailyPercent = 0.0080; // 0.80%
        } else if (currentUserInvested >= 600 && currentUserInvested < 10000) {
            dailyPercent = 0.0110; // 1.10%
        } else if (currentUserInvested >= 10000) {
            dailyPercent = 0.0180; // 1.80%
        }

        let earnings = currentUserInvested * dailyPercent;

        // Limitar ganancias al 200% máximo
        if (currentUserEarnings + earnings > maxEarnings) {
            earnings = maxEarnings - currentUserEarnings; // Ajuste final para no sobrepasar
            addNotification("Ciclo 200% Finalizado", `Has completado el límite máximo del 200% de esta inversión.`, "fa-check-double", "var(--success)");
        }

        currentUserEarnings += earnings;
        currentUserBalance += earnings; // Adds to available balance

        // Add specific notification for user
        addNotification(
            "Rendimiento Diario Acreditado",
            `¡Felicidades! Usted ha recibido su porción diaria de ganancias (<strong>$${earnings.toFixed(2)}</strong>).`,
            "fa-sync-alt",
            "var(--success)"
        );

        daysPaid++;
    }

    syncCurrentUserLocalVarsToDB();
    updateDashboardStats();
    updateChart('Día ' + daysPaid, currentUserBalance);
    updateWithdrawalStatus();
}

function updateWithdrawalStatus() {
    const daysEl = document.getElementById('days-paid');
    if (daysEl) daysEl.innerHTML = `<i class="fas fa-calendar-check"></i> Días Transcurridos: ${daysPaid}`;

    const statusBox = document.getElementById('withdraw-status');
    const btnWithdraw = document.getElementById('btn-withdraw');

    if (!statusBox || !btnWithdraw) return;

    const daysLeft = 7 - (daysPaid % 7);

    if (daysPaid > 0 && daysPaid % 7 === 0) { // Es día de retiro (Múltiplo de 7)
        statusBox.innerHTML = '<h4 style="color: var(--success);"><i class="fas fa-lock-open"></i> Retiros Habilitados</h4>' +
            '<p class="small-text mt-2">Hoy es tu día de retiro. Puedes solicitar tus fondos ahora.</p>';
        statusBox.style.borderColor = 'var(--success)';
        btnWithdraw.disabled = false;
    } else {
        const remaining = daysPaid === 0 ? 7 : daysLeft;
        statusBox.innerHTML = '<h4 style="color: var(--danger);"><i class="fas fa-lock"></i> Retiros Bloqueados</h4>' +
            `<p class="small-text mt-2">Aún no cumples tu ciclo. Días restantes para su próximo periodo de retiro: <strong id="withdraw-days-left">${remaining} días</strong></p>`;
        statusBox.style.borderColor = 'var(--danger)';
        btnWithdraw.disabled = true;
    }
}

function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-identifier').value;
    const pass = document.getElementById('login-password').value;

    const matchedUser = usersDB.find(u => u.username === user && u.password === pass);

    if (matchedUser) {
        currentUser = { username: matchedUser.username, isAdmin: matchedUser.isAdmin };

        // Load User Data from simulated DB
        currentUserBalance = matchedUser.balance;
        currentUserInvested = matchedUser.invested;
        currentUserEarnings = matchedUser.earnings;
        savedWalletAddress = matchedUser.wallet;

        if (currentUser.isAdmin) {
            document.getElementById('admin-menu-item').style.display = 'flex';

            // Re-render pending admin transactions as notifications upon login
            document.querySelector('#admin-transactions-table tbody').innerHTML = '';
            usersDB.forEach(u => {
                if (u.pendingDeposits && u.pendingDeposits.length > 0) {
                    u.pendingDeposits.forEach(pending => {
                        if (pending.status === 'pending') {
                            // Re-insert into DOM (simulate table row + notification alert)
                            addPendingAdminTransactionSync(u.username, 'Depósito', pending.amount, pending.id);
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

        // Reset local ui state
        chartLabels = ['Inicio'];
        chartData = [0];
        daysPaid = 0;
        realDaysElapsed = 0;

        updateDashboardStats();
        updateWithdrawalStatus();

        navigate('dashboard-layout');
        switchDashboardView('dashboard');

        setTimeout(initChart, 300);

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
        alert('Usuario o contraseña incorrectos. Por favor intente nuevamente.');
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

    // Volver a la vista de login
    navigate('login');
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

    // For mobile: if we pick an option, we might want to auto-scroll up
    window.scrollTo(0, 0);
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
        targetWallet = document.getElementById('withdraw-new-wallet').value;
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

    if (daysPaid === 0 || daysPaid % 7 !== 0) {
        alert('Solo puedes retirar dinero en tus días de ciclo correspondientes (cada 7 días).');
        return;
    }

    // Simulate deduction (and 5% fee logic simply reducing balance)
    if (withdrawAmount > 0 && withdrawAmount <= currentUserBalance) {
        currentUserBalance -= withdrawAmount;

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
        addPendingAdminTransaction(currentUser.username, 'Retiro', withdrawAmount);
    }
}

function cancelContract() {
    if (confirm('¿Estás seguro de cancelar tu contrato de inversión? Se aplicará una deducción del 20% si tu inversión tiene menos de 4 meses, o 10% si es mayor a 4 meses.')) {
        alert('Contrato cancelado de acuerdo con los términos y condiciones.');
    }
}

function toggleEditProfile() {
    const fields = ['settings-firstname', 'settings-lastname', 'settings-current-pass', 'settings-new-pass', 'settings-wallet'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
    });

    const btnSave = document.getElementById('btn-save-settings');
    if (btnSave) {
        btnSave.disabled = false;
        btnSave.style.opacity = '1';
        btnSave.style.cursor = 'pointer';
    }
}

function loadSettingsForm() {
    if (!currentUser) return;
    const matchedUser = usersDB.find(u => u.username === currentUser.username);
    if (!matchedUser) return;

    // Reset disabling
    const fields = ['settings-firstname', 'settings-lastname', 'settings-current-pass', 'settings-new-pass', 'settings-wallet'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = true;
            el.value = ""; // clear passes
        }
    });

    const btnSave = document.getElementById('btn-save-settings');
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.style.opacity = '0.5';
        btnSave.style.cursor = 'not-allowed';
    }

    // Populate data
    const fname = document.getElementById('settings-firstname');
    if (fname) fname.value = matchedUser.firstname || "";

    const lname = document.getElementById('settings-lastname');
    if (lname) lname.value = matchedUser.lastname || "";

    const wallet = document.getElementById('settings-wallet');
    if (wallet) wallet.value = matchedUser.wallet || "";
}

function handleSettings(e) {
    e.preventDefault();
    if (!currentUser) return;

    const matchedUser = usersDB.find(u => u.username === currentUser.username);
    if (!matchedUser) return;

    const firstname = document.getElementById('settings-firstname').value;
    const lastname = document.getElementById('settings-lastname').value;
    const newWallet = document.getElementById('settings-wallet').value;
    const currentPass = document.getElementById('settings-current-pass').value;
    const newPass = document.getElementById('settings-new-pass').value;

    // Check pass logic
    if (newPass || currentPass) {
        if (matchedUser.password !== currentPass) {
            alert("La contraseña actual es incorrecta. No se guardaron los cambios de contraseña.");
            return;
        }
        if (newPass.length < 5) {
            alert("La nueva contraseña debe tener al menos 5 caracteres.");
            return;
        }
        matchedUser.password = newPass;
    }

    // Update names
    matchedUser.firstname = firstname;
    matchedUser.lastname = lastname;
    const displayFirstname = firstname || matchedUser.username;

    const welcomeEl = document.getElementById('welcome-username');
    if (welcomeEl) welcomeEl.innerText = displayFirstname;
    const treeEl = document.getElementById('tree-username');
    if (treeEl) treeEl.innerText = displayFirstname;

    // Update wallet
    matchedUser.wallet = newWallet;
    savedWalletAddress = newWallet;
    saveUserToDB(matchedUser);

    // Attempt to update withdraw input if it's currently on "saved"
    toggleNewWalletInput();

    alert('Ajustes guardados correctamente. Sus datos personales han sido actualizados.');

    // Lock again
    loadSettingsForm();
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

        // Handle referral bonus for new investment differences
        if (matchedUser.invested > oldInvested && matchedUser.referrer) {
            const addedInvestment = matchedUser.invested - oldInvested;
            const referrerUser = usersDB.find(u => u.username.toLowerCase() === matchedUser.referrer.toLowerCase());
            if (referrerUser) {
                const bonus = addedInvestment * 0.07;
                referrerUser.balance += bonus;
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
                    updateDashboardStats(); // Update immediately
                }
            }
        }

        const newPass = document.getElementById('admin-edit-password').value;
        if (newPass.trim()) {
            matchedUser.password = newPass;
        }

        saveUserToDB(matchedUser);

        alert("Los datos del usuario " + matchedUser.username + " han sido actualizados y guardados en la BD.");

        renderAdminUserList(); // Update list after save

        // If the admin is somehow editing themselves, update their whole specific UI
        if (currentUser.username === matchedUser.username) {
            currentUserBalance = matchedUser.balance;
            currentUserInvested = matchedUser.invested;
            savedWalletAddress = matchedUser.wallet;
            updateDashboardStats();
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

    if (!amount || amount < 10) {
        alert("Por favor, ingresa el monto a depositar (mínimo 10 USDT).");
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

    // Mínimo de $10 exigido
    if (!amount || amount < 10) {
        alert("El depósito mínimo para entrar a Universal Profits es de $10 USDT. Por favor, ingresa una cantidad válida.");
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
function addPendingAdminTransaction(username, type, amount) {
    const tBody = document.querySelector('#admin-transactions-table tbody');
    const emptyRow = document.getElementById('empty-transactions-msg');
    if (emptyRow && emptyRow.parentNode) {
        emptyRow.parentNode.removeChild(emptyRow);
    }

    const rowId = 'admin-row-' + Date.now();

    if (currentUser && currentUser.isAdmin) {
        let msg = type === 'Depósito' ?
            `El usuario <strong>${username}</strong> ha reportado un depósito de <strong>$${amount}</strong>. Revisa el Panel de Admin para confirmarlo.` :
            `El usuario <strong>${username}</strong> ha solicitado un retiro de <strong>$${amount}</strong>. Revisa el Panel de Admin para procesarlo.`;

        let color = type === 'Depósito' ? 'gold' : 'var(--danger)';
        addNotification(
            type + " Pendiente",
            msg,
            "fa-exchange-alt",
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

    const row = document.createElement('tr');
    row.id = rowId;
    row.style.borderBottom = '1px solid rgba(212,175,55,0.1)';
    row.style.transition = 'background-color 0.5s ease';

    const typeLabel = type === 'Depósito' ? `<span style="color: var(--gold-primary)">Depósito</span>` : `<span style="color: var(--danger)">Retiro</span>`;

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

function addPendingAdminTransactionSync(username, type, amount, pendingId) {
    const tBody = document.querySelector('#admin-transactions-table tbody');
    const emptyRow = document.getElementById('empty-transactions-msg');
    if (emptyRow && emptyRow.parentNode) {
        emptyRow.parentNode.removeChild(emptyRow);
    }

    let msg = type === 'Depósito' ?
        `El usuario <strong>${username}</strong> ha reportado un depósito de <strong>$${amount}</strong>. Revisa el Panel de Admin para confirmarlo.` :
        `El usuario <strong>${username}</strong> ha solicitado un retiro de <strong>$${amount}</strong>. Revisa el Panel de Admin para procesarlo.`;

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

    const typeLabel = type === 'Depósito' ? `<span style="color: var(--gold-primary)">Depósito</span>` : `<span style="color: var(--danger)">Retiro</span>`;

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
        alert("❌ Has denegado el retiro. Recomendamos contactar al usuario.");
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

            // Handle referral bonus
            if (dbUser.referrer) {
                const referrerUser = usersDB.find(u => u.username.toLowerCase() === dbUser.referrer.toLowerCase());
                if (referrerUser) {
                    const bonus = (netInvestment * 0.07);
                    referrerUser.balance += bonus;

                    // Notificar al referente si está logueado o simplemente registrarlo
                    if (currentUser && currentUser.username.toLowerCase() === referrerUser.username.toLowerCase()) {
                        addNotification(
                            "Comisión por Referido (7%)",
                            `Has recibido una comisión de <strong>$${bonus.toFixed(2)}</strong> por la inversión de tu referido <strong>${dbUser.username}</strong> (7%).`,
                            "fa-percentage",
                            "var(--success)"
                        );
                        currentUserBalance = referrerUser.balance; // Actualizar balance local si es el mismo usuario
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
