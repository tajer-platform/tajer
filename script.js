// استيراد المكتبات من رابط مباشر (CDN) لضمان العمل على الجوال
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCI_0-7KsqnssqkOSkNVK0FmuRokDNXriE",
  authDomain: "tajer-app-e1b97.firebaseapp.com",
  projectId: "tajer-app-e1b97",
  storageBucket: "tajer-app-e1b97.firebasestorage.app",
  messagingSenderId: "92669858022",
  appId: "1:92669858022:web:a1223e9121190815066b27",
  measurementId: "G-FBCNR2M43Q"
};

// تهيئة Firebase بحذر
let db;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase Connected! ✅");
} catch (error) {
    console.error("Firebase Connection Error: ", error);
}

let balance = 500000;
let assets = [];
const userId = "player_1";

const market = [
    { id: 1, name: "دجاجة", price: 25000, icon: "🐔" },
    { id: 2, name: "خروف بلدي", price: 1200000, icon: "🐏" },
    { id: 3, name: "بقرة حلوب", price: 8500000, icon: "🐄" },
    { id: 4, name: "خلية نحل", price: 150000, icon: "🐝" },
    { id: 5, name: "حصان عربي", price: 25000000, icon: "🐎" }
];

async function saveToCloud() {
    if (!db) return;
    try {
        await setDoc(doc(db, "users", userId), { balance, assets });
    } catch (e) { console.error(e); }
}

async function loadFromCloud() {
    if (!db) { updateUI(); return; }
    try {
        const docSnap = await getDoc(doc(db, "users", userId));
        if (docSnap.exists()) {
            balance = docSnap.data().balance;
            assets = docSnap.data().assets;
        }
    } catch (e) { console.error(e); }
    updateUI();
    renderAssets();
}

function updateUI() {
    const wallet = document.getElementById('wallet-display');
    if (wallet) wallet.innerText = balance.toLocaleString();
    
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    grid.innerHTML = market.map(item => `
        <div class="card">
            <i>${item.icon}</i>
            <h3>${item.name}</h3>
            <span class="price">${item.price.toLocaleString()} ل.س</span>
            <button class="buy-btn" onclick="buy(${item.id})">شراء</button>
        </div>`).join('');
}

window.buy = async function(id) {
    const item = market.find(i => i.id === id);
    if (balance >= item.price) {
        balance -= item.price;
        assets.push(item);
        renderAssets();
        updateUI();
        await saveToCloud();
    } else { alert("الرصيد لا يكفي!"); }
}

window.renderAssets = function() {
    const box = document.getElementById('my-assets');
    if (!box) return;
    box.innerHTML = assets.length ? assets.map(a => `
        <div class="card"><i>${a.icon}</i><h3>${a.name}</h3><small>منتج ✅</small></div>`).join('') 
        : '<div class="empty-msg">لا تملك أصولاً بعد..</div>';
}

window.tab = function(id, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// تشغيل التحميل
loadFromCloud();
