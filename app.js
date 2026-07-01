// Importamos Firebase desde el CDN para usar Vanilla JS sin frameworks
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, doc, onSnapshot, collection, addDoc, 
    deleteDoc, query, orderBy, serverTimestamp, setDoc, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB3jAN7UyszNfxlgCv_y2J3oJeMsgpg88E",
  authDomain: "paylau-7a4b5.firebaseapp.com",
  databaseURL: "https://paylau-7a4b5-default-rtdb.firebaseio.com",
  projectId: "paylau-7a4b5",
  storageBucket: "paylau-7a4b5.firebasestorage.app",
  messagingSenderId: "940761946817",
  appId: "1:940761946817:web:6e732fb763feda310e1240",
  measurementId: "G-RDZ6QCFHL9"
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Variables globales para el estado
let currentBalance = 0;
let totalSpent = 0;
let allPrizes = [];
let editingPrizeId = null;

// ==========================================
// 1. LÓGICA DE INICIALIZACIÓN (Detectar pantalla)
// ==========================================
function detectAndInit() {
    console.log("Detecting page type...");
    if (document.getElementById('user-balance')) {
        console.log("Initializing Lau App");
        initLauApp(); // Estamos en index.html
    } else if (document.getElementById('login-screen')) {
        console.log("Initializing Admin App");
        initAdminApp(); // Estamos en admin.html
    }
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await setDoc(doc(db, "wallet", "lau"), { dummy: true }, { merge: true });
        detectAndInit();
    });
} else {
    // El DOM ya está cargado
    setDoc(doc(db, "wallet", "lau"), { dummy: true }, { merge: true });
    detectAndInit();
}

// ==========================================
// 2. VISTA DE LAU (index.html)
// ==========================================
function initLauApp() {
    // Escuchar Saldo en tiempo real
    onSnapshot(doc(db, "wallet", "lau"), (docSnap) => {
        const data = docSnap.data();
        currentBalance = data.balance || 0;
        totalSpent = data.totalSpent || 0;
        
        document.getElementById('user-balance').innerText = currentBalance;
        document.getElementById('user-streak').innerText = data.streak || 0;
        
        checkAchievements(totalSpent);
        updateProgressBar();
        renderPrizes(); // Volver a renderizar para habilitar/deshabilitar botones
    });

    // Escuchar Premios
    const qPrizes = query(collection(db, "prizes"), orderBy("cost", "asc"));
    onSnapshot(qPrizes, (snapshot) => {
        allPrizes = [];
        snapshot.forEach(doc => allPrizes.push({ id: doc.id, ...doc.data() }));
        renderPrizes();
        updateProgressBar();
    });

    // Escuchar Historial
    const qHistory = query(collection(db, "history"), orderBy("date", "desc"));
    onSnapshot(qHistory, (snapshot) => {
        const container = document.getElementById('history-container');
        container.innerHTML = '';
        snapshot.forEach(docSnap => {
            const item = docSnap.data();
            const li = document.createElement('li');
            li.className = `history-item ${item.type}`;
            li.innerHTML = `
                <span>${item.reason}</span>
                <span class="amount">${item.type === 'positive' ? '+' : '-'}${item.amount} pts</span>
            `;
            container.appendChild(li);
        });
    });
}

function renderPrizes() {
    const container = document.getElementById('prizes-container');
    if(!container) return;
    container.innerHTML = '';

    allPrizes.forEach(prize => {
        const canAfford = currentBalance >= prize.cost;
        const card = document.createElement('div');
        card.className = 'prize-card';
        card.innerHTML = `
            <div class="prize-icon">🎁</div>
            <div class="prize-title">${prize.name}</div>
            <div class="prize-cost">${prize.cost} pts</div>
            <button class="btn-redeem" ${canAfford ? '' : 'disabled'} 
                onclick="redeemPrize('${prize.name}', ${prize.cost})">
                Canjear
            </button>
        `;
        container.appendChild(card);
    });
}

function updateProgressBar() {
    // Buscar el próximo premio que todavía no puede pagar
    const nextPrize = allPrizes.find(p => p.cost > currentBalance);
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');

    if (nextPrize) {
        const needed = nextPrize.cost - currentBalance;
        progressText.innerText = `${needed} puntos más para: ${nextPrize.name}`;
        const percentage = (currentBalance / nextPrize.cost) * 100;
        progressFill.style.width = `${percentage}%`;
    } else {
        progressText.innerText = "¡Tenés saldo para todos los premios! 🎉";
        progressFill.style.width = `100%`;
    }
}

function checkAchievements(spent) {
    const titleBadge = document.getElementById('tini-title');
    if (!titleBadge) return;
    
    titleBadge.classList.remove('hidden');
    if (spent >= 5000) {
        titleBadge.innerText = "✨ La nueva Tini ✨";
    } else if (spent >= 2500) {
        titleBadge.innerText = "💍 Marida 💍";
    } else if (spent >= 1500) {
        titleBadge.innerText = "💖 Noviaza 💖";
    } else {
        titleBadge.classList.add('hidden');
    }
}

// Función global para canjear (asignada a window para que ande en el onclick del HTML)
window.redeemPrize = async (name, cost) => {
    if (currentBalance >= cost) {
        const newBalance = currentBalance - cost;
        const newSpent = totalSpent + cost;

        // Actualizar saldo
        await setDoc(doc(db, "wallet", "lau"), { 
            balance: newBalance,
            totalSpent: newSpent 
        }, { merge: true });

        // Guardar en historial
        await addDoc(collection(db, "history"), {
            reason: `Canjeaste: ${name}`,
            amount: cost,
            type: 'negative',
            date: serverTimestamp()
        });

        // Efectos!
        document.getElementById('ding-sound').play();
        spawnHearts();
    }
};

function spawnHearts() {
    const container = document.getElementById('hearts-container');
    for (let i = 0; i < 15; i++) {
        const heart = document.createElement('div');
        heart.innerHTML = '❤️';
        heart.className = 'heart';
        heart.style.left = Math.random() * 100 + 'vw';
        heart.style.top = '100vh';
        heart.style.animationDelay = Math.random() * 0.5 + 's';
        container.appendChild(heart);
        setTimeout(() => heart.remove(), 2500);
    }
}

// Función global para las pestañas
window.showTab = (tabName) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    event.currentTarget.classList.add('active');
};


// ==========================================
// 3. VISTA ADMIN (admin.html)
// ==========================================
window.checkPassword = () => {
    const pass = document.getElementById('admin-pass').value;
    if (pass === 'kingoftokyo') {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
    } else {
        alert("Contraseña incorrecta, intruso. 🛑");
    }
};

function initAdminApp() {
    console.log("Admin app initialized");
    
    // Escuchar saldo
    onSnapshot(doc(db, "wallet", "lau"), (docSnap) => {
        const data = docSnap.data();
        currentBalance = data.balance || 0;
        const balanceEl = document.getElementById('admin-balance');
        if(balanceEl) balanceEl.innerText = currentBalance;
    });

    // Escuchar premios para administrarlos
    const q = query(collection(db, "prizes"), orderBy("cost", "asc"));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('admin-prizes-list');
        if(!list) return;
        list.innerHTML = '';
        snapshot.forEach(docSnap => {
            const prize = docSnap.data();
            const div = document.createElement('div');
            div.className = 'admin-prize-item';
            div.innerHTML = `
                <span>${prize.name} (${prize.cost} pts)</span>
                <div class="admin-prize-buttons">
                    <button class="btn-edit" onclick="openEditModal('${docSnap.id}', '${prize.name}', ${prize.cost})">Editar</button>
                    <button class="btn-delete" onclick="deletePrize('${docSnap.id}')">Borrar</button>
                </div>
            `;
            list.appendChild(div);
        });
    });

    // Botones del admin - Actualizar Puntos
    const btnUpdatePoints = document.getElementById('btn-update-points');
    console.log("btn-update-points found:", !!btnUpdatePoints);
    if (btnUpdatePoints) {
        btnUpdatePoints.addEventListener('click', async () => {
            const amountInput = document.getElementById('point-amount');
            const reasonInput = document.getElementById('point-reason');
            const amount = parseInt(amountInput.value);
            const reason = reasonInput.value.trim();
            
            console.log("Update points clicked:", { amount, reason });
            
            if (!amount || !reason) {
                alert("Completá monto y razón");
                return;
            }

            const newBalance = currentBalance + amount;
            await setDoc(doc(db, "wallet", "lau"), { balance: newBalance }, { merge: true });
            
            await addDoc(collection(db, "history"), {
                reason: reason,
                amount: Math.abs(amount),
                type: amount > 0 ? 'positive' : 'negative',
                date: serverTimestamp()
            });

            amountInput.value = '';
            reasonInput.value = '';
            alert("Puntos actualizados!");
        });
    }

    // Botones del admin - Crear Premio
    const btnAddPrize = document.getElementById('btn-add-prize');
    console.log("btn-add-prize found:", !!btnAddPrize);
    if (btnAddPrize) {
        btnAddPrize.addEventListener('click', async () => {
            const nameInput = document.getElementById('prize-name');
            const costInput = document.getElementById('prize-cost');
            const name = nameInput.value.trim();
            const cost = parseInt(costInput.value);
            
            console.log("Add prize clicked:", { name, cost });
            
            if (!name || !cost) {
                alert("Completá nombre y costo");
                return;
            }

            try {
                await addDoc(collection(db, "prizes"), { name, cost });
                nameInput.value = '';
                costInput.value = '';
                alert("Premio creado!");
            } catch (error) {
                console.error("Error adding prize:", error);
                alert("Error al crear el premio: " + error.message);
            }
        });
    }

    // Botones del admin - Guardar Edición
    const btnSaveEdit = document.getElementById('btn-save-edit');
    console.log("btn-save-edit found:", !!btnSaveEdit);
    if (btnSaveEdit) {
        btnSaveEdit.addEventListener('click', async () => {
            const newName = document.getElementById('edit-prize-name').value.trim();
            const newCost = parseInt(document.getElementById('edit-prize-cost').value);
            
            console.log("Save edit clicked:", { newName, newCost });
            
            if (!newName || !newCost) {
                alert("Completá nombre y costo");
                return;
            }

            try {
                await updateDoc(doc(db, "prizes", editingPrizeId), {
                    name: newName,
                    cost: newCost
                });
                closeEditModal();
                alert("Premio actualizado!");
            } catch (error) {
                console.error("Error updating prize:", error);
                alert("Error al actualizar el premio: " + error.message);
            }
        });
    }
}

// Función global para abrir modal de edición
window.openEditModal = (id, name, cost) => {
    console.log("Opening edit modal for:", { id, name, cost });
    editingPrizeId = id;
    document.getElementById('edit-prize-name').value = name;
    document.getElementById('edit-prize-cost').value = cost;
    document.getElementById('edit-prize-modal').classList.remove('hidden');
};

// Función global para cerrar modal
window.closeEditModal = () => {
    console.log("Closing edit modal");
    editingPrizeId = null;
    document.getElementById('edit-prize-modal').classList.add('hidden');
    document.getElementById('edit-prize-name').value = '';
    document.getElementById('edit-prize-cost').value = '';
};

// Función global para borrar premio
window.deletePrize = async (id) => {
    if(confirm("¿Seguro que querés borrar este premio?")) {
        try {
            await deleteDoc(doc(db, "prizes", id));
            alert("Premio borrado!");
        } catch (error) {
            console.error("Error deleting prize:", error);
            alert("Error al borrar el premio: " + error.message);
        }
    }
};
