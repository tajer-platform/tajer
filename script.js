// ===============================
// 1. استيراد Firebase المحدث
// ===============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// ===============================
// 2. إعداد Firebase (نفس الإعدادات السابقة)
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
const auth = getAuth(app);

// ===============================
// 3. متغيرات الحالة (State)
// ===============================
let currentUser = null;
let userData = { balance: 0, assets: [], name: "مستثمر جديد" };
let currentChatType = 'global'; // global أو support

// ===============================
// 4. نظام التحقق من المستخدم (Auth)
// ===============================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        listenToUserData();
        listenToMarket();
        listenToMessages('global'); // الافتراضي هو الدردشة العامة
    } else {
        // هنا يمكنك توجيه المستخدم لصفحة تسجيل دخول إذا أردت
        console.log("لا يوجد مستخدم مسجل");
    }
});

// ===============================
// 5. جلب البيانات الحية (Real-time Listeners)
// ===============================

// مراقبة بيانات المستخدم (رصيد، أصول)
function listenToUserData() {
    onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
        if (snap.exists()) {
            userData = snap.data();
            updateUI();
            renderMyAssets();
        } else {
            // إنشاء مستخدم جديد في قاعدة البيانات إذا لم يوجد
            setDoc(doc(db, "users", currentUser.uid), {
                name: "مستثمر " + Math.floor(Math.random() * 1000),
                balance: 10000,
                assets: [],
                createdAt: serverTimestamp()
            });
        }
    });
}

// جلب السوق من لوحة الإدارة
function listenToMarket() {
    onSnapshot(collection(db, "market_items"), (snap) => {
        const grid = document.getElementById('market-grid');
        if (!grid) return;
        grid.innerHTML = "";
        
        snap.forEach((doc) => {
            const item = doc.data();
            const itemId = doc.id;
            grid.innerHTML += `
                <div class="card">
                    <i style="font-style: normal; font-size: 2rem;">📦</i>
                    <div style="flex:1">
                        <h3>${item.name}</h3>
                        <small>عائد: ${item.returnRate || 'متغير'}</small>
                    </div>
                    <div style="text-align:left">
                        <div style="font-weight:bold; color: var(--primary)">${Number(item.price).toLocaleString()} ل.س</div>
                        <button class="buy-btn" onclick="buyAsset('${itemId}', ${item.price}, '${item.name}')">شراء</button>
                    </div>
                </div>`;
        });
    });
}

// ===============================
// 6. نظام الشراء والبيع (مرتبط بالآدمن)
// ===============================
window.buyAsset = async (itemId, price, itemName) => {
    if (userData.balance >= price) {
        try {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, {
                balance: increment(-price),
                assets: [...userData.assets, { id: itemId, name: itemName, buyDate: new Date() }]
            });
            alert(`تم شراء ${itemName} بنجاح!`);
        } catch (err) {
            alert("حدث خطأ أثناء الشراء.");
        }
    } else {
        alert("رصيدك غير كافٍ!");
    }
};

// ===============================
// 7. نظام الدردشة المزدوج (عام + دعم فني)
// ===============================
window.switchChat = (type) => {
    currentChatType = type;
    document.getElementById('btn-global').classList.toggle('active', type === 'global');
    document.getElementById('btn-private').classList.toggle('active', type === 'support');
    listenToMessages(type);
};

function listenToMessages(type) {
    const chatBox = document.getElementById('chat-box');
    const path = type === 'global' ? "global_messages" : `chats/${currentUser.uid}/messages`;
    
    const q = query(collection(db, path), orderBy("timestamp", "asc"));
    
    onSnapshot(q, (snap) => {
        chatBox.innerHTML = "";
        snap.forEach(d => {
            const m = d.data();
            const isMe = m.senderId === currentUser.uid || m.sender === 'user';
            const msgDiv = document.createElement('div');
            msgDiv.className = `msg ${isMe ? 'sent' : 'received'} ${m.sender === 'admin' ? 'msg-admin' : ''}`;
            msgDiv.innerHTML = `<small>${m.sender === 'admin' ? 'الدعم الفني' : (isMe ? 'أنا' : 'تاجر')}</small><br>${m.text || m.message}`;
            chatBox.appendChild(msgDiv);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

window.sendMessage = async () => {
    const input = document.getElementById('chat-in');
    const text = input.value.trim();
    if (!text || !currentUser) return;

    const path = currentChatType === 'global' ? "global_messages" : `chats/${currentUser.uid}/messages`;
    
    await addDoc(collection(db, path), {
        senderId: currentUser.uid,
        sender: 'user',
        text: text,
        timestamp: serverTimestamp()
    });

    // إذا كانت رسالة دعم، نحدث مستند الشات الرئيسي ليراها الآدمن
    if(currentChatType === 'support') {
        await setDoc(doc(db, "chats", currentUser.uid), {
            userName: userData.name,
            lastMessage: text,
            timestamp: serverTimestamp()
        }, { merge: true });
    }

    input.value = "";
};

// ===============================
// 8. تحديث الواجهة والتبويبات
// ===============================
function updateUI() {
    document.getElementById('wallet-display').innerText = userData.balance.toLocaleString();
    document.getElementById('total-wallet').innerText = userData.balance.toLocaleString();
    document.getElementById('assets-count').innerText = userData.assets.length;
    document.getElementById('user-name-display').innerText = userData.name;
}

function renderMyAssets() {
    const box = document.getElementById('my-assets-list');
    if (!box) return;
    box.innerHTML = userData.assets.map(a => `
        <div class="card">
            <i style="font-style: normal; font-size: 2rem;">🐾</i>
            <div style="flex:1"><h3>${a.name}</h3><small>الحالة: نشط ✅</small></div>
        </div>
    `).join('') || '<p style="text-align:center; padding:20px;">لا تملك أصولاً بعد</p>';
}

window.tab = function(id, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(btn && btn.classList.contains('nav-item')) btn.classList.add('active');
};

// ربط زر الإرسال
document.getElementById('send-msg-btn').onclick = window.sendMessage;