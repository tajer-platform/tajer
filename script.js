// ===============================
// 1. استيراد Firebase
// ===============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp as rtTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// ===============================
// 2. إعداد Firebase
// ===============================
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
const rdb = getDatabase(app);

// ===============================
// 3. بيانات اللعبة الأولية
// ===============================
let balance = 100_000;
let assets = [];
let marketPrices = { chicken: 25000, sheep: 1_200_000, cow: 8_500_000, bees: 150_000, horse: 25_000_000 };
const userId = "player_" + Math.floor(Math.random() * 10000);

const marketItems = [
    { id: "chicken", name: "دجاجة", icon: "🐔" },
    { id: "sheep", name: "خروف بلدي", icon: "🐏" },
    { id: "cow", name: "بقرة حلوب", icon: "🐄" },
    { id: "bees", name: "خلية نحل", icon: "🐝" },
    { id: "horse", name: "حصان عربي", icon: "🐎" }
];

// ===============================
// 4. تحميل البيانات
// ===============================
async function loadGame() {
    try {
        // تحميل أسعار السوق من Firestore
        const priceDoc = await getDoc(doc(db, "global_settings", "market_prices"));
        if (priceDoc.exists()) marketPrices = priceDoc.data();

        // تحميل بيانات المستخدم
        const userSnap = await getDoc(doc(db, "users", userId));
        if (userSnap.exists()) {
            const data = userSnap.data();
            balance = data.balance ?? balance;
            assets = data.assets ?? [];
        }

        updateUI();
        renderAssets();
        renderMarket();
        listenToMessages(); // تشغيل الدردشة

    } catch (err) {
        console.error("خطأ في تحميل البيانات:", err);
        alert("حدث خطأ أثناء تحميل بيانات اللعبة.");
    }
}

// ===============================
// 5. تحديث واجهة المستخدم
// ===============================
function updateUI() {
    const wallet = document.getElementById('wallet-display');
    const totalWallet = document.getElementById('total-wallet');
    const assetsCount = document.getElementById('assets-count');

    if(wallet) wallet.innerText = balance.toLocaleString();
    if(totalWallet) totalWallet.innerText = balance.toLocaleString();
    if(assetsCount) assetsCount.innerText = assets.length;
}

// ===============================
// 6. عرض السوق
// ===============================
function renderMarket() {
    const grid = document.getElementById('market-grid');
    if(!grid) return;

    grid.innerHTML = marketItems.map(item => `
        <div class="card">
            <i style="font-style: normal; font-size: 2rem;">${item.icon}</i>
            <div style="flex:1">
                <h3>${item.name}</h3>
                <small>عائد مستمر</small>
            </div>
            <div style="text-align:left">
                <div style="font-weight:bold; color: var(--primary)">${(marketPrices[item.id] || 0).toLocaleString()}</div>
                <button class="buy-btn" onclick="buyAsset('${item.name}', '${item.id}')">شراء</button>
            </div>
        </div>
    `).join('');
}

// ===============================
// 7. عرض الأصول
// ===============================
function renderAssets() {
    const box = document.getElementById('my-assets-list');
    if(!box) return;

    if(assets.length === 0) {
        box.innerHTML = `<p style="color:#64748b; text-align:center; padding:20px;">لا يوجد أصول مملوكة بعد</p>`;
        return;
    }

    box.innerHTML = assets.map((a,index) => {
        const info = marketItems.find(m => m.id === a.type);
        return `
            <div class="card">
                <i style="font-style: normal; font-size: 2rem;">${info ? info.icon : '🐾'}</i>
                <div style="flex:1">
                    <h3>${a.name}</h3>
                    <div style="color:green; font-size:0.8rem">الحالة: نشط ✅</div>
                </div>
                <button onclick="sellAsset(${index})" style="background:#ff4757; color:white; border:none; padding:8px; border-radius:5px">بيع</button>
            </div>
        `;
    }).join('');
}

// ===============================
// 8. نظام المحادثة
// ===============================
window.sendMessage = async () => {
    const input = document.getElementById('chat-in');
    const text = input.value.trim();
    if(!text) return;

    await push(ref(rdb, 'global_messages'), {
        senderId: userId,
        message: text,
        timestamp: rtTimestamp()
    });
    input.value = "";
};

function listenToMessages() {
    const chatBox = document.getElementById('chat-box');
    onChildAdded(ref(rdb, 'global_messages'), (snapshot) => {
        const msgData = snapshot.val();
        const isMe = msgData.senderId === userId;
        const msgDiv = document.createElement('div');
        msgDiv.className = `msg ${isMe ? 'sent' : 'received'}`;
        msgDiv.innerHTML = `<small>${isMe ? 'أنا' : 'تاجر'}</small><br>${msgData.message}`;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// ===============================
// 9. الشراء والبيع
// ===============================
window.buyAsset = async (name,type) => {
    const price = marketPrices[type];
    if(balance >= price) {
        balance -= price;
        assets.push({ name, type });
        updateUI(); renderAssets(); await saveData();
    } else { alert("الرصيد لا يكفي!"); }
};

window.sellAsset = async (index) => {
    const asset = assets[index];
    const price = Math.floor((marketPrices[asset.type] || 0) * 0.8);
    balance += price;
    assets.splice(index,1);
    updateUI(); renderAssets(); await saveData();
};

// ===============================
// 10. حفظ البيانات
// ===============================
async function saveData() {
    try {
        await setDoc(doc(db,"users",userId), { balance, assets, lastUpdate: serverTimestamp() });
    } catch(err) {
        console.error("خطأ عند حفظ البيانات:", err);
    }
}

// ===============================
// 11. التبويبات
// ===============================
window.tab = function(id, btn) {
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
};

// ===============================
// 12. تشغيل اللعبة
// ===============================
loadGame();
