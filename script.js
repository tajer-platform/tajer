// 1. استيراد المكتبات اللازمة من Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// 2. إعدادات Firebase الخاصة بمشروعك (تم وضع بياناتك هنا)
const firebaseConfig = {
  apiKey: "AIzaSyCI_0-7KsqnssqkOSkNVK0FmuRokDNXriE",
  authDomain: "tajer-app-e1b97.firebaseapp.com",
  projectId: "tajer-app-e1b97",
  storageBucket: "tajer-app-e1b97.firebasestorage.app",
  messagingSenderId: "92669858022",
  appId: "1:92669858022:web:a1223e9121190815066b27",
  measurementId: "G-FBCNR2M43Q"
};

// 3. تهيئة Firebase و Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// متغيرات اللعبة الأساسية
let balance = 500000;
let assets = [];
const userId = "player_1"; // معرف المستخدم (ثابت حالياً حتى نبرمج تسجيل الدخول)

const market = [
    { id: 1, name: "دجاجة", price: 25000, icon: "🐔" },
    { id: 2, name: "خروف بلدي", price: 1200000, icon: "🐏" },
    { id: 3, name: "بقرة حلوب", price: 8500000, icon: "🐄" },
    { id: 4, name: "خلية نحل", price: 150000, icon: "🐝" },
    { id: 5, name: "حصان عربي", price: 25000000, icon: "🐎" }
];

// 4. وظائف السحابة (حفظ وتحميل البيانات)
async function saveToCloud() {
    try {
        await setDoc(doc(db, "users", userId), {
            balance: balance,
            assets: assets
        });
        console.log("تم حفظ البيانات في السحاب ✅");
    } catch (e) {
        console.error("خطأ في الحفظ: ", e);
    }
}

async function loadFromCloud() {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        balance = data.balance;
        assets = data.assets;
        console.log("تم تحميل بياناتك بنجاح ☁️");
    } else {
        console.log("مستخدم جديد! سيتم إنشاء ملف لك.");
        await saveToCloud();
    }
    updateUI();
    renderAssets();
}

// 5. وظائف واجهة المستخدم (المعدلة لتشمل الحفظ)
function updateUI() {
    document.getElementById('wallet-display').innerText = balance.toLocaleString();
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    grid.innerHTML = '';
    market.forEach(item => {
        grid.innerHTML += `<div class="card">
            <i>${item.icon}</i>
            <h3>${item.name}</h3>
            <span class="price">${item.price.toLocaleString()} ل.س</span>
            <button class="buy-btn" onclick="buy(${item.id})">شراء</button>
        </div>`;
    });
}

// جعل وظيفة الشراء متاحة عالمياً (Window) لأننا نستخدم Type="module"
window.buy = async function(id) {
    const item = market.find(i => i.id === id);
    if (balance >= item.price) {
        balance -= item.price;
        assets.push(item);
        log(`تم شراء ${item.name}`);
        renderAssets();
        updateUI();
        await saveToCloud(); // حفظ بعد كل عملية شراء
    } else { 
        alert("الرصيد لا يكفي!"); 
    }
}

function renderAssets() {
    const box = document.getElementById('my-assets');
    if (!box) return;
    if (assets.length === 0) {
        box.innerHTML = '<div class="empty-msg">لا تملك أصولاً بعد..</div>';
        return;
    }
    box.innerHTML = assets.map(a => `<div class="card"><i>${a.icon}</i><h3>${a.name}</h3><small>منتج ✅</small></div>`).join('');
}

function log(msg) {
    const box = document.getElementById('activity-log');
    if (!box) return;
    const time = new Date().toLocaleTimeString('ar-SY', {hour:'2-digit', minute:'2-digit'});
    box.innerHTML = `<div class="log-item"><span>${msg}</span><small>${time}</small></div>` + box.innerHTML;
}

window.tab = function(id, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

window.sendMsg = function() {
    const i = document.getElementById('chat-in');
    if(i.value) {
        document.getElementById('chat-box').innerHTML += `<div style="background:white; padding:8px; border-radius:8px; margin-bottom:5px;"><b>أنت:</b> ${i.value}</div>`;
        i.value = '';
    }
}

// البدء بتحميل البيانات عند فتح الموقع
loadFromCloud();