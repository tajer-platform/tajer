/*************************************************
* 1. Firebase Imports & Config
 *************************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, deleteDoc,
    updateDoc, doc, increment, arrayUnion, setDoc, getDoc,
    serverTimestamp, onSnapshot, query, orderBy, limit, writeBatch
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

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

/*************************************************
 * 2. Helpers & Formatters (أدوات التنسيق)
 *************************************************/

const formatMoney = (num) => {
    if (!num && num !== 0) return "0";
    return Number(num).toLocaleString('en-US');
};

const cleanNumber = (str) => {
    if (!str) return 0;
    // تم تعديلها لتسمح بالإشارة السالبة (-) من أجل عمليات خصم الرصيد
    return Number(String(str).replace(/[^0-9.-]/g, ''));
};

const attachMoneyInputListener = (inputId) => {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener('input', function (e) {
        let rawValue = this.value.replace(/[^0-9-]/g, '');
        if (!rawValue) { this.value = ""; return; }
        this.value = Number(rawValue).toLocaleString('en-US');
    });
};

/*************************************************
 * 3. UI System (التنبيهات والنوافذ)
 *************************************************/

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const box = document.createElement('div');
    box.className = `toast-msg ${type}`;
    box.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    container.appendChild(box);
    setTimeout(() => { box.style.opacity = '1'; box.style.transform = 'translateY(0)'; }, 10);
    setTimeout(() => { box.style.opacity = '0'; setTimeout(() => box.remove(), 300); }, 3000);
}

// دالة التأكيد المخصصة الأصلية (مع إصلاح لضمان عمل Promise)
function askConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').innerText = title;
        document.getElementById('confirmMessage').innerText = message;
        modal.classList.add('show');

        const yesBtn = document.getElementById('confirmYesBtn');
        const noBtn = document.getElementById('confirmNoBtn');

        const newYes = yesBtn.cloneNode(true);
        const newNo = noBtn.cloneNode(true);

        yesBtn.parentNode.replaceChild(newYes, yesBtn);
        noBtn.parentNode.replaceChild(newNo, noBtn);

        newYes.onclick = () => {
            modal.classList.remove('show');
            resolve(true);
        };

        newNo.onclick = () => {
            modal.classList.remove('show');
            resolve(false);
        };
    });
}


function setBtnLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
        btn.dataset.text = btn.innerText;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري المعالجة...';
        btn.disabled = true;
    } else {
        btn.innerText = btn.dataset.text || 'تأكيد';
        btn.disabled = false;
    }
}

/*************************************************
 * 4. Core Logic & Data
 *************************************************/
let globalTotalShares = 0;
let marketList = [];
let currentSharePrice = 0;

onAuthStateChanged(auth, (user) => {
    if (!user || user.email !== "admin33@tajer44.com") {
        window.location.href = "index.html";
    } else {
        initApp();
        setupInputs();
    }
});




function setupInputs() {
    ['profitInput', 'manualSharePriceInput', 'newUserBalance', 'balanceAmount', 'pPrice', 'pQty'].forEach(id => attachMoneyInputListener(id));

    const pInput = document.getElementById("profitInput");
    if (pInput) {
        pInput.addEventListener("input", () => {
            const val = cleanNumber(pInput.value);
            const hint = document.getElementById("profitPerShareHint");
            if (val > 0 && globalTotalShares > 0) {
                const share = val / globalTotalShares;
                hint.innerHTML = `نصيب السهم الواحد: <strong>${share.toFixed(2)}</strong> ل.س`;
                hint.style.display = "block";
            } else {
                hint.style.display = "none";
            }
        });
    }
}

function initApp() {
    onSnapshot(doc(db, "global_settings", "market_prices"), (snap) => {
        if (snap.exists()) {
            currentSharePrice = Number(snap.data().cow) || 0;
            document.getElementById("d-share-value").innerText = formatMoney(currentSharePrice);
            loadInvestors();
        }
    });

    loadInvestors();
    loadMarket();
    loadLogs();
    loadWithdrawals(); // تم تفعيلها هنا لتعمل عند تشغيل التطبيق
}

function loadInvestors() {
    // نستخدم onSnapshot لمراقبة التغييرات فورياً
    // نستخدم orderBy لترتيب المستثمرين حسب تاريخ الانضمام (كما في الكود البسيط)
    const q = query(collection(db, "users"), orderBy("joinDate", "desc"));

    onSnapshot(q, (snap) => {
        const table = document.querySelector("#usersTable tbody");
        if (!table) return;

        table.innerHTML = ""; // تفريغ الجدول لبدء الرسم من جديد

        let totalShares = 0;
        let totalCapital = 0;
        let investorsCount = 0;
        let idx = 1;

        snap.forEach(docSnap => {
            investorsCount++;
            const u = docSnap.data();

            // 1. جلب البيانات بالمسميات البسيطة (اسم، بريد، هاتف، تاريخ)
            const name = u.name || "مستخدم جديد";
            const phone = u.phone || "---";
            const email = u.email || "لم يتم إضافة بريد";
            
            // معالجة تاريخ الانضمام (من الكود البسيط)
            let dateStr = "غير مسجل";
            if (u.joinDate) {
                // إذا كان التاريخ مخزن كـ Timestamp في فايربيس
                dateStr = new Date(u.joinDate.toDate()).toLocaleDateString('ar-SA');
            }

            // 2. حسابات الاستثمار (الوظائف المتقدمة)
            const assets = u.assets || [];
            const invested = assets.reduce((sum, item) => sum + (Number(item.priceAtPurchase) || 0), 0);
            
            // حساب الأسهم بناءً على سعر السهم الحالي (currentSharePrice)
            const price = (typeof currentSharePrice !== 'undefined' && currentSharePrice > 0) ? currentSharePrice : 1;
            const myShares = invested / price;

            totalShares += myShares;
            totalCapital += invested;

            // 3. تجميع الممتلكات لنص واحد (مثال: بقرة (2))
            const assetMap = {};
            assets.forEach(a => assetMap[a.name] = (assetMap[a.name] || 0) + 1);
            const assetStr = Object.entries(assetMap).map(([k, v]) => `${k} (${v})`).join("، ") || "-";

            // 4. عرض البيانات في الجدول (مطابق تماماً لـ HTML الخاص بك)
            table.innerHTML += `
                <tr>
                    <td>${idx++}</td> <td>
                        <strong>${name}</strong><br>
                        <span style="font-size:0.8em; color:#666;">${phone}</span><br>
                        <span style="font-size:0.75em; color:#999;">${email}</span><br>
                        <small style="color:#aaa;">انضم في: ${dateStr}</small>
                    </td> <td style="color:#2563eb; font-weight:bold;">${formatMoney(u.balance || 0)}</td> <td style="font-size:0.85em;">${assetStr}</td> <td>${formatMoney(invested)}</td> <td style="color:#16a34a; font-weight:bold;">${myShares.toFixed(2)}</td> <td>
                        <button class="btn-icon purple" onclick="openAssetModal('${docSnap.id}')" title="شراء"><i class="fas fa-shopping-cart"></i></button>
                        <button class="btn-icon orange" onclick="openBalanceModal('${docSnap.id}')" title="الرصيد"><i class="fas fa-coins"></i></button>
                        <button class="btn-icon red" onclick="deleteUser('${docSnap.id}')" title="حذف"><i class="fas fa-trash"></i></button>
                    </td> </tr>
            `;
        });

        // تحديث أرقام الإحصائيات في أعلى الصفحة
        updateText("d-users", investorsCount);
        updateText("d-capital", formatMoney(totalCapital));
        updateText("d-total-shares", totalShares.toFixed(2));
    });
}
// دالة جلب طلبات السحب مع تحديث مباشر
async function loadWithdrawals() {
    const container = document.getElementById('withdrawalsContainer');
    if(!container) return;

    onSnapshot(collection(db, "withdrawals"), (snap) => {
        container.innerHTML = '';
        if(snap.empty) {
            container.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">لا توجد طلبات معلقة</p>';
            return;
        }

        snap.forEach(docRef => {
            const data = docRef.data();
            container.innerHTML += `
                <div class="withdraw-card">
                    <h4>${data.userName}</h4>
                    <div class="price">${Number(data.amount).toLocaleString()} ل.س</div>
                    <div class="date">${data.date || ''}</div>
                    <div class="actions">
                        <button class="btn-approve" onclick="confirmAction('قبول السحب', 'هل أنت متأكد من تحويل المبلغ؟', () => processWithdraw('${docRef.id}', true))" style="background:#dcfce7; color:#166534; padding:8px; border-radius:5px; border:none; cursor:pointer;">موافقة</button>
                        <button class="btn-reject" onclick="confirmAction('رفض الطلب', 'هل تريد رفض هذا الطلب؟', () => processWithdraw('${docRef.id}', false))" style="background:#fee2e2; color:#991b1b; padding:8px; border-radius:5px; border:none; cursor:pointer;">رفض</button>
                    </div>
                </div>
            `;
        });
    });
}

// دالة معالجة السحب (قبول أو رفض) - تمت إضافتها لتكتمل الوظيفة
window.processWithdraw = async (reqId, isApproved) => {
    try {
        const docRef = doc(db, "withdrawals", reqId);
        const snap = await getDoc(docRef);
        if(!snap.exists()) return;
        const reqData = snap.data();

        if (isApproved) {
            // خصم من رصيد المستخدم
            const userRef = doc(db, "users", reqData.userId);
            await updateDoc(userRef, { balance: increment(-reqData.amount) });
            logAction(`موافقة سحب مبلغ ${reqData.amount} للمستخدم ${reqData.userName}`);
            showToast("تمت الموافقة وخصم الرصيد");
        } else {
            logAction(`رفض طلب سحب للمستخدم ${reqData.userName}`);
            showToast("تم رفض الطلب", "error");
        }
        // حذف الطلب بعد المعالجة
        await deleteDoc(docRef);
    } catch (e) {
        showToast("حدث خطأ في المعالجة", "error");
    }
};

function loadMarket() {
    onSnapshot(collection(db, "market_items"), (snap) => {
        const table = document.querySelector("#marketTable tbody");
        const select = document.getElementById("assetSelect");
        if(!table || !select) return;

        table.innerHTML = "";
        select.innerHTML = "<option value=''>-- اختر المنتج --</option>";
        marketList = [];

        snap.forEach(docSnap => {
            const p = docSnap.data();
            const item = { id: docSnap.id, ...p };
            marketList.push(item);

            table.innerHTML += `
                <tr>
                    <td>${p.name}</td>
                    <td>${formatMoney(p.price)}</td>
                    <td>${p.returnRate || 0}%</td>
                    <td>${p.quantity || 0}</td>
                    <td><span class="badge ${p.quantity > 0 ? 'bg-success' : 'bg-danger'}">${p.quantity > 0 ? 'متوفر' : 'نفذ'}</span></td>
                    <td><button class="btn-icon red" onclick="deleteProduct('${docSnap.id}')"><i class="fas fa-trash"></i></button></td>
                </tr>
            `;
            if (p.quantity > 0) {
                select.innerHTML += `<option value="${item.id}">${p.name} - ${formatMoney(p.price)} ل.س</option>`;
            }
        });
    });
}

const assetSelect = document.getElementById("assetSelect");
const qtyInfo = document.getElementById("availableQtyInfo");
const qtyInput = document.getElementById("assetQty");

if (assetSelect) {
    assetSelect.addEventListener("change", () => {
        const itemId = assetSelect.value;
        const item = marketList.find(i => i.id === itemId);

        if (!item) {
            qtyInfo.innerText = "الكمية المتوفرة: --";
            qtyInput.max = 1;
            qtyInput.value = 1;
            return;
        }

        qtyInfo.innerText = `الكمية المتوفرة: ${item.quantity}`;
        qtyInput.max = item.quantity;
        qtyInput.value = 1;
    });
}
/*************************************************
 * إصلاحات منطق الشراء وتحديث الواجهة
 *************************************************/

// 1. تحديث بيانات المنتج المختار في واجهة الشراء
const updateProductUI = () => {
    const assetSelect = document.getElementById("assetSelect");
    const itemId = assetSelect.value;
    const item = marketList.find(i => i.id === itemId);
    const card = document.getElementById("productDetailCard");
    const qtyInput = document.getElementById("assetQty");

    if (!item) {
        card.style.display = "none";
        return;
    }

    card.style.display = "block";
    document.getElementById("detailPrice").innerText = formatMoney(item.price) + " ل.س";
    document.getElementById("detailReturn").innerText = (item.returnRate || 0) + "%";
    document.getElementById("detailStock").innerText = item.quantity || 0;
    
    calculateTotal();
};

// 2. حساب المجموع الكلي ومقارنته بالرصيد
const calculateTotal = () => {
    const assetSelect = document.getElementById("assetSelect");
    const item = marketList.find(i => i.id === assetSelect.value);
    const qty = parseInt(document.getElementById("assetQty").value) || 0;
    const totalDisplay = document.getElementById("totalPurchasePrice");
    const warning = document.getElementById("balanceWarning");
    const btn = document.getElementById("confirmPurchaseBtn");

    if (!item) return;

    const total = item.price * qty;
    totalDisplay.innerText = formatMoney(total) + " ل.س";

    // جلب رصيد المستخدم الحالي من السجل المفتوح
    const currentBalance = cleanNumber(document.getElementById("currentBalanceSpan").innerText);
    
    if (total > currentBalance) {
        warning.style.display = "block";
        btn.style.opacity = "0.5";
        btn.disabled = true;
    } else {
        warning.style.display = "none";
        btn.style.opacity = "1";
        btn.disabled = false;
    }
};

// 3. ربط الأحداث للواجهة الاحترافية
document.getElementById("assetSelect")?.addEventListener("change", updateProductUI);
document.getElementById("assetQty")?.addEventListener("input", calculateTotal);

// 4. دالة الشراء المطورة (التي كانت معطلة)
// تأكد من حذف النسخ القديمة لهذه الدالة واستخدام هذه النسخة فقط
window.confirmAddAsset = async () => {
    const uid = document.getElementById("assetUserId").value;
    const itemId = document.getElementById("assetSelect").value;
    const qtyInput = document.getElementById("assetQty");
    const qty = parseInt(qtyInput.value);
    
    // البحث عن المنتج في القائمة المحلية
    const item = marketList.find(i => i.id === itemId);

    // 1. التحقق المبدئي
    if (!item || isNaN(qty) || qty <= 0) {
        return showToast("يرجى اختيار منتج وتحديد كمية صحيحة", "error");
    }

    // ملاحظة: تأكد هل الحقل في الفايربيز اسمه quantity أم qty
    // سأفترض أنه quantity بناءً على دالة loadMarket
    if (item.quantity < qty) {
        return showToast(`المخزون لا يكفي، المتوفر حالياً: ${item.quantity}`, "error");
    }

    const totalCost = item.price * qty;

    // 2. نافذة التأكيد
    const confirmed = await askConfirm(
        "تأكيد عملية الشراء",
        `هل أنت متأكد من شراء (${qty}) وحدة من "${item.name}"؟ \n التكلفة الإجمالية: ${formatMoney(totalCost)} ل.س`
    );
    
    if (!confirmed) return;

    const btn = document.getElementById("confirmPurchaseBtn");
    setBtnLoading(btn, true);

    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) throw new Error("المستخدم غير موجود");
        
        const userData = userSnap.data();

        // 3. التحقق من الرصيد
        if (userData.balance < totalCost) {
            throw new Error("عذراً، رصيد المستثمر غير كافٍ لإتمام العملية");
        }

        const batch = writeBatch(db);

        // تجهيز بيانات الأصول
        const newAssets = [];
        for (let i = 0; i < qty; i++) {
            newAssets.push({
                assetId: crypto.randomUUID(),
                name: item.name,
                priceAtPurchase: Number(item.price),
                purchaseDate: new Date().toISOString(),
                returnRate: item.returnRate || 0
            });
        }

        // 4. تنفيذ العمليات (Batch)
        batch.update(userRef, { 
            balance: increment(-totalCost), 
            assets: arrayUnion(...newAssets) 
        });

        batch.update(doc(db, "market_items", itemId), { 
            quantity: increment(-qty) 
        });

        batch.set(doc(collection(db, "logs")), { 
            text: `تم شراء ${qty} من (${item.name}) للمستثمر ${userData.name}`,
            type: 'purchase',
            timestamp: serverTimestamp() 
        });

        await batch.commit();

        showToast("تمت عملية الشراء بنجاح!");
        closeModal("assetModal");
        
    } catch (e) { 
        console.error("Purchase Error:", e);
        showToast(e.message || "حدث خطأ أثناء التنفيذ", "error"); 
    } finally { 
        setBtnLoading(btn, false); 
    }
};

// إضافة وظيفة لفتح نافذة الشراء مع جلب الرصيد
window.openAssetModal = async (id) => {
    const userSnap = await getDoc(doc(db, "users", id));
    if (userSnap.exists()) {
        document.getElementById("currentBalanceSpan").innerText = formatMoney(userSnap.data().balance) + " ل.س";
        document.getElementById("assetUserId").value = id;
        openModal("assetModal");
        updateProductUI(); // لتصفير البيانات السابقة
    }
};

function loadLogs() {
    onSnapshot(query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(50)), (snap) => {
        const fullLogContainer = document.getElementById("logsTimeline");
        const miniLogContainer = document.getElementById("miniLogBox");
        if (!fullLogContainer) return;

        fullLogContainer.innerHTML = "";
        if (miniLogContainer) miniLogContainer.innerHTML = "";

        let lastDate = "";
        let count = 0;

        snap.forEach(docSnap => {
            const log = docSnap.data();
            const dateObj = log.timestamp ? log.timestamp.toDate() : new Date();
            const dateStr = dateObj.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

            if (dateStr !== lastDate) {
                fullLogContainer.innerHTML += `<div class="timeline-date">${dateStr}</div>`;
                lastDate = dateStr;
            }

            fullLogContainer.innerHTML += `
                <div class="timeline-item">
                    <div class="time">${timeStr}</div>
                    <div class="content">${log.text}</div>
                </div>
            `;

            if (count < 4 && miniLogContainer) {
                miniLogContainer.innerHTML += `
                    <div style="padding: 10px; border-bottom: 1px solid #eee; font-size: 0.9em; display:flex; justify-content:space-between;">
                        <span style="color:#333;">${log.text}</span>
                        <span style="color:#999; font-size:0.8em;">${timeStr}</span>
                    </div>
                `;
            }
            count++;
        });
    });
}

/*************************************************
 * 5. Actions (الوظائف التنفيذية)
 *************************************************/

window.addProduct = async () => {
    const name = document.getElementById("pName").value;
    const price = cleanNumber(document.getElementById("pPrice").value);
    const ret = document.getElementById("pReturn").value;
    const qty = cleanNumber(document.getElementById("pQty").value);

    if (!name || price <= 0) return showToast("يرجى إدخال اسم وسعر صحيح", "error");
    const btn = document.querySelector("#market button");
    setBtnLoading(btn, true);

    try {
        await addDoc(collection(db, "market_items"), {
            name, price: Number(price), returnRate: Number(ret) || 0,
            quantity: Number(qty) || 0, createdAt: serverTimestamp()
        });
        showToast("تمت إضافة المنتج للسوق");
        document.getElementById("pName").value = "";
        document.getElementById("pPrice").value = "";
        document.getElementById("pReturn").value = "";
        document.getElementById("pQty").value = "";
        logAction(`إضافة منتج: ${name}`);
    } catch (e) { showToast("خطأ في الإضافة", "error"); }
    finally { setBtnLoading(btn, false); }
};

window.confirmAddAsset = async () => {
    const uid = document.getElementById("assetUserId").value;
    const itemId = document.getElementById("assetSelect").value;
    const qtyInput = document.getElementById("assetQty");
    const qty = Number(qtyInput.value);
    
    // البحث عن المنتج في القائمة المحلية
    const item = marketList.find(i => i.id === itemId);

    // 1. التحقق المبدئي
    if (!item || qty <= 0) return showToast("يرجى اختيار منتج وكمية صحيحة", "error");
    if (item.qty < qty) return showToast(`المخزون لا يكفي، المتوفر: ${item.qty}`, "error");

    const totalCost = item.price * qty;

    // 2. نافذة تأكيد احترافية
    const confirmed = await askConfirm(
        "تأكيد عملية الشراء",
        `هل أنت متأكد من شراء (${qty}) وحدة من "${item.name}"؟ \n التكلفة الإجمالية: ${formatMoney(totalCost)} ل.س`
    );
    if (!confirmed) return;

    const btn = document.getElementById("confirmPurchaseBtn");
    setBtnLoading(btn, true);

    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        // 3. التحقق من رصيد المستخدم
        if (userData.balance < totalCost) {
            showToast("فشل العملية: رصيد المستثمر غير كافٍ", "error");
            setBtnLoading(btn, false);
            return;
        }

        const batch = writeBatch(db);

        // تجهيز بيانات الأصول الجديدة التي ستضاف للمستثمر
        const newAssets = Array(qty).fill().map(() => ({
            id: crypto.randomUUID(),
            name: item.name,
            priceAtPurchase: Number(item.price),
            expectedReturn: item.return || 0, // أضفنا العائد هنا أيضاً
            boughtAt: new Date().toISOString()
        }));

        // 4. تنفيذ العمليات (Batch) لضمان الدقة
        // خصم الرصيد وإضافة الأصول للمستخدم
        batch.update(userRef, { 
            balance: increment(-totalCost), 
            assets: arrayUnion(...newAssets) 
        });

        // خصم الكمية من المخزن (السوق)
        batch.update(doc(db, "market_items", itemId), { 
            qty: increment(-qty) // تأكد أن الحقل في قاعدة البيانات اسمه qty
        });

        // تسجيل العملية في السجل
        batch.set(doc(collection(db, "logs")), { 
            text: `تم شراء ${qty} من (${item.name}) للمستثمر ${userData.name} بمبلغ ${formatMoney(totalCost)}`,
            type: 'purchase',
            timestamp: serverTimestamp() 
        });

        await batch.commit();

        showToast("تمت عملية الشراء بنجاح وتحديث محفظة المستثمر");
        closeModal("assetModal");
        
        // إعادة تصفير الحقول
        qtyInput.value = 1;
        if(typeof loadInvestors === 'function') loadInvestors(); // تحديث القائمة فوراً

    } catch (e) { 
        console.error(e);
        showToast("حدث خطأ تقني أثناء تنفيذ العملية", "error"); 
    } finally { 
        setBtnLoading(btn, false); 
    }
};
window.executeDistribution = async () => {
    const profitInput = document.getElementById("profitInput");
    const totalProfit = cleanNumber(profitInput.value);
    if (totalProfit <= 0 || globalTotalShares <= 0) return showToast("بيانات التوزيع غير صحيحة", "error");

    const perShare = totalProfit / globalTotalShares;
    const confirmed = await askConfirm("توزيع الأرباح", `توزيع ${formatMoney(totalProfit)} ل.س؟`);
    if (!confirmed) return;

    const btn = document.getElementById("distributeBtn");
    setBtnLoading(btn, true);

    try {
        const usersSnap = await getDocs(collection(db, "users"));
        const batch = writeBatch(db);
        usersSnap.forEach(docSnap => {
            const u = docSnap.data();
            const invested = (u.assets || []).reduce((sum, a) => sum + (Number(a.priceAtPurchase)||0), 0);
            const shares = currentSharePrice > 0 ? (invested / currentSharePrice) : 0;
            if (shares > 0) {
                batch.update(doc(db, "users", docSnap.id), { balance: increment(shares * perShare) });
            }
        });
        batch.set(doc(collection(db, "logs")), { text: `توزيع أرباح بقيمة ${totalProfit}`, timestamp: serverTimestamp() });
        await batch.commit();
        showToast("تم التوزيع بنجاح");
        profitInput.value = "";
    } catch (e) { showToast("فشل التوزيع", "error"); }
    finally { setBtnLoading(btn, false); }
};

window.confirmAddUser = async () => {
    const name = document.getElementById("newUserName").value;
    const phone = document.getElementById("newUserPhone").value;
    const balance = cleanNumber(document.getElementById("newUserBalance").value);
    if (!name) return showToast("الاسم مطلوب", "error");

    const btn = document.querySelector("#userModal .btn-primary");
    setBtnLoading(btn, true);
    try {
        await addDoc(collection(db, "users"), { name, phone, balance, assets: [], createdAt: serverTimestamp() });
        showToast("تمت إضافة المستثمر");
        closeModal("userModal");
        logAction(`إضافة مستثمر: ${name}`);
    } catch (e) { showToast("خطأ", "error"); }
    finally { setBtnLoading(btn, false); }
};


window.confirmEditBalance = async () => {
    const uid = document.getElementById("editUserId").value;
    const rawVal = document.getElementById("balanceAmount").value.replace(/,/g, '');
    const finalAmount = Number(rawVal);
    if (finalAmount === 0) return showToast("أدخل المبلغ", "error");

    const confirmed = await askConfirm("تعديل الرصيد", `تعديل الرصيد بقيمة ${formatMoney(finalAmount)}؟`);
    if (!confirmed) return;

    try {
        await updateDoc(doc(db, "users", uid), { balance: increment(finalAmount) });
        showToast("تم تحديث المحفظة");
        closeModal("balanceModal");
        logAction(`تعديل رصيد مستخدم بقيمة ${finalAmount}`);
    } catch (e) { showToast("خطأ", "error"); }
};

window.deleteUser = async (id) => {
    if (await askConfirm("حذف مستثمر", "هل أنت متأكد؟")) {
        await deleteDoc(doc(db, "users", id));
        showToast("تم الحذف");
    }
};

window.deleteProduct = async (id) => {
    if (await askConfirm("حذف منتج", "هل أنت متأكد؟")) {
        await deleteDoc(doc(db, "market_items", id));
        showToast("تم الحذف");
    }
};


window.saveSharePrice = async () => {
    const val = cleanNumber(document.getElementById("manualSharePriceInput").value);
    if (val <= 0) return showToast("أدخل سعراً صحيحاً", "error");
    if (await askConfirm("تحديث السهم", `تغيير السعر لـ ${formatMoney(val)}؟`)) {
        await setDoc(doc(db, "global_settings", "market_prices"), { cow: val, updatedAt: serverTimestamp() });
        showToast("تم التحديث");
        closeModal("sharePriceModal");
    }
};

window.logout = () => signOut(auth).then(() => window.location.href = "index.html");

async function logAction(text) {
    try { await addDoc(collection(db, "logs"), { text, timestamp: serverTimestamp() }); } catch(e){}
}
function updateText(id, val) { const el = document.getElementById(id); if(el) el.innerText = val; }
window.openModal = (id) => document.getElementById(id).classList.add("show");
window.closeModal = (id) => document.getElementById(id).classList.remove("show");
window.openTab = (id, btn) => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    document.querySelectorAll(".nav button").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
};



window.openAssetModal = (id) => { document.getElementById("assetUserId").value = id; openModal("assetModal"); };
window.openBalanceModal = (id) => { document.getElementById("editUserId").value = id; openModal("balanceModal"); };