import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCI_0-7KsqnssqkOSkNVK0FmuRokDNXriE",
    authDomain: "tajer-app-e1b97.firebaseapp.com",
    projectId: "tajer-app-e1b97",
    storageBucket: "tajer-app-e1b97.firebasestorage.app",
    messagingSenderId: "92669858022",
    appId: "1:92669858022:web:a1223e9121190815066b27"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let balance = 100000;
let assets = [];
let marketPrices = { chicken: 25000, sheep: 1200000, cow: 8500000, bees: 150000, horse: 25000000 };
const userId = "player_1";

const marketItems = [
    { id: "chicken", name: "دجاجة", icon: "🐔" },
    { id: "sheep", name: "خروف بلدي", icon: "🐏" },
    { id: "cow", name: "بقرة حلوب", icon: "🐄" },
    { id: "bees", name: "خلية نحل", icon: "🐝" },
    { id: "horse", name: "حصان عربي", icon: "🐎" }
];

async function loadGame() {
    const priceDoc = await getDoc(doc(db, "global_settings", "market_prices"));
    if (priceDoc.exists()) marketPrices = priceDoc.data();

    const userSnap = await getDoc(doc(db, "users", userId));
    if (userSnap.exists()) {
        const data = userSnap.data();
        balance = data.balance;
        assets = data.assets || [];
    }
    updateUI();
    renderAssets();
}

function updateUI() {
    const balEl = document.getElementById('wallet-display');
    const totalEl = document.getElementById('total-wallet');
    const countEl = document.getElementById('assets-count');

    if (balEl) balEl.innerText = balance.toLocaleString();
    if (totalEl) totalEl.innerText = balance.toLocaleString();
    if (countEl) countEl.innerText = assets.length;

    const grid = document.getElementById('market-grid');
    if (grid) {
        grid.innerHTML = marketItems.map(item => `
            <div class="card">
                <i>${item.icon}</i>
                <div style="flex:1">
                    <h3>${item.name}</h3>
                    <small>عائد مستقر</small>
                </div>
                <div style="text-align:left">
                    <div style="font-weight:bold; color:#1b4332">${(marketPrices[item.id] || 0).toLocaleString()}</div>
                    <button class="buy-btn" onclick="buyAsset('${item.name}', '${item.id}')">شراء</button>
                </div>
            </div>
        `).join('');
    }
}

function renderAssets() {
    const box = document.getElementById('my-assets-list');
    if (!box) return;
    box.innerHTML = assets.map((a, index) => `
        <div class="card">
            <i>${marketItems.find(m => m.id === a.type)?.icon || '🐾'}</i>
            <div style="flex:1">
                <h3>${a.name}</h3>
                <div style="color:green; font-size:0.8rem">الحالة: نشط ✅</div>
            </div>
            <button onclick="sellAsset(${index})" style="background:#ff4757; color:white; border:none; padding:8px; border-radius:5px">بيع</button>
        </div>
    `).join('');
}

window.buyAsset = async (name, type) => {
    const price = marketPrices[type];
    if (balance >= price) {
        balance -= price;
        assets.push({ name: name, type: type });
        updateUI();
        renderAssets();
        await saveData();
    } else { alert("الرصيد لا يكفي!"); }
};

window.sellAsset = async (index) => {
    const asset = assets[index];
    const price = Math.floor((marketPrices[asset.type] || 0) * 0.8);
    balance += price;
    assets.splice(index, 1);
    updateUI();
    renderAssets();
    await saveData();
};

async function saveData() {
    await setDoc(doc(db, "users", userId), {
        balance: balance,
        assets: assets,
        lastUpdate: serverTimestamp()
    });
}

window.tab = function(id, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
};

loadGame();
