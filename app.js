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
document.addEventListener('DOMContentLoaded', async () => {
    // Asegurarnos de que el documento de la billetera exista
    await setDoc(doc(db, "wallet", "lau"), { dummy: true }, { merge: true });

    if (document.getElementById('user-balance')) {
        initLauApp(); // Estamos en index.html
    } else if (document.getElementById('login-screen')) {
        initAdminApp(); // Estamos en admin.html
    }
});

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

    // Botones del admin
    document.getElementById('btn-update-points')?.addEventListener('click', async () => {
        const amount = parseInt(document.getElementById('point-amount').value);
        const reason = document.getElementById('point-reason').value;
        if (!amount || !reason) return alert("Completá monto y razón");

        const newBalance = currentBalance + amount;
        await setDoc(doc(db, "wallet", "lau"), { balance: newBalance }, { merge: true });
        
        await addDoc(collection(db, "history"), {
            reason: reason,
            amount: Math.abs(amount),
            type: amount > 0 ? 'positive' : 'negative',
            date: serverTimestamp()
        });

        document.getElementById('point-amount').value = '';
        document.getElementById('point-reason').value = '';
        alert("Puntos actualizados!");
    });

    document.getElementById('btn-add-prize')?.addEventListener('click', async () => {
        const name = document.getElementById('prize-name').value;
        const cost = parseInt(document.getElementById('prize-cost').value);
        if (!name || !cost) return alert("Completá nombre y costo");

        await addDoc(collection(db, "prizes"), { name, cost });
        
        document.getElementById('prize-name').value = '';
        document.getElementById('prize-cost').value = '';
    });

    document.getElementById('btn-save-edit')?.addEventListener('click', async () => {
        const newName = document.getElementById('edit-prize-name').value;
        const newCost = parseInt(document.getElementById('edit-prize-cost').value);
        if (!newName || !newCost) return alert("Completá nombre y costo");

        await updateDoc(doc(db, "prizes", editingPrizeId), {
            name: newName,
            cost: newCost
        });

        closeEditModal();
    });
}

// Función global para abrir modal de edición
window.openEditModal = (id, name, cost) => {
    editingPrizeId = id;
    document.getElementById('edit-prize-name').value = name;
    document.getElementById('edit-prize-cost').value = cost;
    document.getElementById('edit-prize-modal').classList.remove('hidden');
};

// Función global para cerrar modal
window.closeEditModal = () => {
    editingPrizeId = null;
    document.getElementById('edit-prize-modal').classList.add('hidden');
    document.getElementById('edit-prize-name').value = '';
    document.getElementById('edit-prize-cost').value = '';
};

// Función global para borrar premio
window.deletePrize = async (id) => {
    if(confirm("¿Seguro que querés borrar este premio?")) {
        await deleteDoc(doc(db, "prizes", id));
    }
};
