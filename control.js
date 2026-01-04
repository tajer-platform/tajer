/*************************************************
 * 1. Firebase Imports
 *************************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, deleteDoc,
    updateDoc, doc, increment, arrayUnion, setDoc, getDoc,
    serverTimestamp, onSnapshot, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import {
    getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

/*************************************************
 * 2. Configuration & Styles
 *************************************************/
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

// حقن ستايل الإشعارات ديناميكياً
const styleSheet = document.createElement("style");
styleSheet.innerText = `
    .toast-notification {
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: #1f2937; color: #fff; padding: 12px 24px; border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2); z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px;
        opacity: 0; transition: all 0.3s ease; top: -50px;
        display: flex; align-items: center; gap: 10px; min-width: 300px; justify-content: center;
    }
    .toast-notification.show { top: 20px; opacity: 1; }
    .toast-success { border-bottom: 4px solid #10b981; }
    .toast-error { border-bottom: 4px solid #ef4444; }
    
    /* تعطيل الزر أثناء التحميل */
    button:disabled { opacity: 0.6; cursor: not-allowed; pointer-events: none; }
`;
document.head.appendChild(styleSheet);

/*************************************************
 * 3. Global State
 *************************************************/
let globalTotalShares = 0;
let marketItemsList = [];
let currentSharePrice = 0;

/*************************************************
 * 4. UI Helpers (الإشعارات والتحميل)
 *************************************************/
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast-notification');
    if(existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span><span>${message}</span>`;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function setBtnLoading(btnElement, isLoading, loadingText = "جاري التنفيذ...") {
    if (!btnElement) return;
    if (isLoading) {
        if(!btnElement.dataset.originalText) btnElement.dataset.originalText = btnElement.innerText;
        btnElement.innerText = loadingText;
        btnElement.disabled = true;
    } else {
        btnElement.innerText = btnElement.dataset.originalText || "تأكيد";
        btnElement.disabled = false;
    }
}

/*************************************************
 * 5. Math Helpers (حسابات الأسهم الدقيقة)
 *************************************************/
function calculateUserShares(assets, sharePrice) {
    const sPrice = Number(sharePrice) || 0;
    if (sPrice <= 0) return 0;

    const totalInvested = calculateTotalInvested(assets);
    
    // النتيجة = (سعر البقرة 1 + سعر البقرة 2 + ...) / سعر السهم
    return totalInvested / sPrice;
}

function calculateTotalInvested(assets) {
    if (!assets || !Array.isArray(assets)) return 0;
    // التأكد من تحويل priceAtPurchase لرقم وجمعه لكل العناصر
    return assets.reduce((sum, asset) => {
        const price = Number(asset.priceAtPurchase) || 0;
        return sum + price;
    }, 0);
}

/*************************************************
 * 6. Initialization & Listeners
 *************************************************/
onAuthStateChanged(auth, (user) => {
    if (!user || user.email !== "admin33@tajer44.com") {
        location.href = "admin-login.html";
    } else {
        initApp();
        setupEnterKeyListeners();
    }
});

function setupEnterKeyListeners() {
    const bindEnter = (inputId, action) => {
        const el = document.getElementById(inputId);
        if (el) el.addEventListener("keypress", (e) => { if (e.key === "Enter") action(e); });
    };
    bindEnter("assetQty", window.confirmAddAsset);
    bindEnter("newUserName", window.confirmAddUser);
    bindEnter("newUserBalance", window.confirmAddUser);
    bindEnter("balanceAmount", window.confirmEditBalance);
    bindEnter("profitInput", window.executeDistribution);
    bindEnter("manualSharePriceInput", window.saveSharePrice);
}

function initApp() {

    let unsubscribeUsers = null;

    // 1️⃣ مراقبة سعر السهم (المرجع)
    onSnapshot(doc(db, "global_settings", "market_prices"), (docSnap) => {
        if (!docSnap.exists()) return;

        const data = docSnap.data();
        currentSharePrice = Number(data.cow) || 0;

        // تحديث مربع التعديل
        const inlineInput = document.getElementById("inlineSharePrice");
        if (inlineInput) inlineInput.value = currentSharePrice;

        // تحديث العرض
        const priceDisplay = document.getElementById("currentPriceDisplay");
        if (priceDisplay) {
            priceDisplay.innerText =
                `سعر السهم الحالي: ${currentSharePrice.toLocaleString()} ل.س`;
        }

        // 🔥 بعد ما صار السعر جاهز → حمّل المستثمرين
        if (unsubscribeUsers) unsubscribeUsers();
        loadInvestors();
    });


    // 2️⃣ تحميل المستثمرين (مرتبط بسعر السهم)
    function loadInvestors() {
        unsubscribeUsers = onSnapshot(
            query(collection(db, "users"), orderBy("createdAt", "desc")),
            snap => {

                const tbody = document.querySelector("#usersTable tbody");
                if (!tbody) return;
                tbody.innerHTML = "";

                let totalCap = 0;
                let totalShares = 0;
                let totalInvestors = 0;
                let index = 1;

                snap.forEach(d => {
                    const u = d.data();
                    const balance = Number(u.balance) || 0;
                    const phone = u.phone || "غير مسجل";
                    const assets = Array.isArray(u.assets) ? u.assets : [];

                    if (assets.length === 0) return;

                    totalInvestors++;

                    // مجموع المبالغ المدفوعة
                    const totalInvestedAmount = assets.reduce(
                        (sum, a) => sum + (Number(a.priceAtPurchase) || 0), 0
                    );

                    // تجميع الممتلكات
                    const assetSummary = {};
                    assets.forEach(a => {
                        assetSummary[a.name] = (assetSummary[a.name] || 0) + 1;
                    });

                    const propertiesText = Object.entries(assetSummary)
                        .map(([name, qty]) => `${qty} ${name}`)
                        .join("، ");

                    // حساب الأسهم
                    const rawShares =
                        currentSharePrice > 0
                            ? totalInvestedAmount / currentSharePrice
                            : 0;

                    totalShares += rawShares;
                    totalCap += totalInvestedAmount;

                    const displayShares =
                        rawShares === 0 ? "0" :
                        Number.isInteger(rawShares) ? rawShares :
                        rawShares.toFixed(2);

                    tbody.innerHTML += `
                        <tr>
                            <td>${index}</td>
                            <td style="font-weight:bold;">${u.name}</td>
                            <td>${phone}</td>
                            <td style="color:#2563eb;">${balance.toLocaleString()} ل.س</td>
                            <td style="font-size:0.9em;color:#4b5563;">${propertiesText}</td>
                            <td style="font-weight:bold;color:#d97706;">
                                ${totalInvestedAmount.toLocaleString()} ل.س
                            </td>
                            <td style="font-weight:bold;color:#16a34a;">
                                ${displayShares} سهم
                            </td>
                            <td>
                                <div style="display:flex;gap:5px;">
                                    <button onclick="openAssetModal('${d.id}')" class="btn btn-purple btn-sm">شراء</button>
                                    <button onclick="openBalanceModal('${d.id}')" class="btn btn-warning btn-sm">محفظة</button>
                                    <button onclick="delUser('${d.id}')" class="btn btn-danger btn-sm">حذف</button>
                                </div>
                            </td>
                        </tr>
                    `;
                    index++;
                });

                // تحديث البطاقات العلوية
                globalTotalShares = totalShares;

                if (document.getElementById("d-total-shares"))
                    document.getElementById("d-total-shares").innerText =
                        Number.isInteger(totalShares) ? totalShares : totalShares.toFixed(2);

                if (document.getElementById("d-capital"))
                    document.getElementById("d-capital").innerText =
                        totalCap.toLocaleString();

                if (document.getElementById("d-investors"))
                    document.getElementById("d-investors").innerText =
                        totalInvestors;
            }
        );
    }


    // 3️⃣ السوق (كما هو – بدون تغيير)
    onSnapshot(collection(db, "market_items"), snap => {
        const tbody = document.querySelector("#marketTable tbody");
        const select = document.getElementById("assetSelect");

        if (tbody) tbody.innerHTML = "";
        if (select) select.innerHTML = '<option value="">-- اختر المنتج --</option>';

        marketItemsList = [];
        let pIndex = 1;

        snap.forEach(d => {
            const p = d.data();
            marketItemsList.push({ id: d.id, ...p });

            if (tbody) {
                tbody.innerHTML += `
                    <tr>
                        <td>${pIndex}</td>
                        <td>${p.name}</td>
                        <td>${Number(p.price).toLocaleString()}</td>
                        <td>${p.returnRate}%</td>
                        <td>نشط</td>
                        <td>
                            <button onclick="delProduct('${d.id}')" class="btn btn-danger btn-sm">
                                حذف
                            </button>
                        </td>
                    </tr>
                `;
            }

            if (select) {
                select.innerHTML += `
                    <option value="${d.id}">
                        ${p.name} (${Number(p.price).toLocaleString()})
                    </option>
                `;
            }
            pIndex++;
        });
    });
}


/*************************************************
 * 7. Actions (الوظائف الرئيسية)
 *************************************************/

// الشراء (المطور)
window.confirmAddAsset = async (e) => {
    // محاولة التقاط الزر سواء جاء الحدث من الضغط أو من Enter
    let btn = e ? e.target : null;
    if (btn && btn.tagName !== 'BUTTON') btn = document.querySelector("#assetModal .btn-purple");
    if (!btn) btn = document.querySelector("#assetModal .btn-purple"); // Fallback

    const uid = document.getElementById("assetUserId").value;
    const qtyInput = document.getElementById("assetQty");
    const qty = Number(qtyInput.value);
    const itemId = document.getElementById("assetSelect").value;
    const item = marketItemsList.find(i => i.id === itemId);

    if (!item || qty <= 0) return showToast("البيانات غير مكتملة", "error");

    const unitPrice = Number(item.price);
    const totalPrice = unitPrice * qty;

    try {
        setBtnLoading(btn, true);

        const userRef = doc(db, "users", uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();

        if (userData.balance < totalPrice) {
            setBtnLoading(btn, false);
            return showToast(`الرصيد غير كافٍ! (المطلوب: ${totalPrice})`, "error");
        }

        const newAssets = [];
        for (let i = 0; i < qty; i++) {
            newAssets.push({
                id: crypto.randomUUID(), // 🔑 معرف فريد لكل أصل
                name: item.name,
                priceAtPurchase: unitPrice,
                addedAt: new Date().toISOString()
            });
        }

        await updateDoc(userRef, {
            balance: increment(-totalPrice),
            assets: arrayUnion(...newAssets)
        });

        showToast(`تم شراء ${qty} ${item.name} بنجاح`);
        log(`شراء ${qty} ${item.name} للمستثمر ${userData.name}`);
        closeModal("assetModal");
        qtyInput.value = "1";

    } catch (error) {
        console.error(error);
        showToast("خطأ في العملية", "error");
    } finally {
        setBtnLoading(btn, false);
    }
};
// وظيفة تحديث سعر السهم من صفحة المستثمرين مباشرة
window.updateInlinePrice = async (e) => {
    const btn = e?.target;
    const input = document.getElementById("inlineSharePrice");
    const newVal = Number(input.value);

    if (!newVal || newVal <= 0) {
        return showToast("أدخل سعر سهم صحيح", "error");
    }

    try {
        setBtnLoading(btn, true);

        await updateDoc(
            doc(db, "global_settings", "market_prices"),
            {
                cow: newVal,
                updatedAt: serverTimestamp()
            }
        );

        showToast("✅ تم حفظ سعر السهم بنجاح");

    } catch (err) {
        console.error(err);
        showToast("❌ فشل حفظ السعر", "error");
    } finally {
        setBtnLoading(btn, false);
    }
};

// حفظ سعر السهم من لوحة الإدارة
window.saveSharePrice = async function () {
    const input = document.getElementById("manualSharePriceInput");
    if (!input) return;

    const newPrice = Number(input.value);

    if (!newPrice || newPrice <= 0) {
        alert("❌ أدخل قيمة صحيحة لسعر السهم");
        return;
    }

    try {
        await updateDoc(
            doc(db, "global_settings", "market_prices"),
            {
                cow: newPrice,
                updatedAt: serverTimestamp()
            }
        );

        // تحديث العرض فورًا
        document.getElementById("d-share-value").innerText =
            newPrice.toLocaleString();

        closeModal("sharePriceModal");

        showToast
            ? showToast("✅ تم تحديث سعر السهم")
            : alert("✅ تم تحديث سعر السهم");

    } catch (err) {
        console.error(err);
        alert("❌ فشل حفظ السعر");
    }
};


// توزيع الأرباح (يدعم الكسور)
window.executeDistribution = async (e) => {
    let btn = e ? e.target : null;
    if (btn && btn.tagName !== 'BUTTON') btn = document.querySelector("#distributeBtn");

    if (!globalTotalShares || globalTotalShares <= 0) return showToast("لا يوجد أسهم للتوزيع", "error");

    const profitInput = document.getElementById("profitInput");
    const totalProfit = Number(profitInput.value);

    if (totalProfit <= 0) return showToast("أدخل مبلغ الربح", "error");

    try {
        setBtnLoading(btn, true);

        // حساب حصة السهم الواحد (بدون تقريب للحفاظ على دقة الكسور)
        const perShare = totalProfit / globalTotalShares;

        const snap = await getDocs(collection(db, "users"));
        const promises = [];
        let count = 0;

        snap.forEach(d => {
            const u = d.data();
            const shares = calculateUserShares(u.assets || [], currentSharePrice);
            
            if (shares > 0) {
                // ضرب عدد الأسهم (حتى لو كسرية) في حصة السهم
                const shareVal = shares * perShare;
                // يمكن استخدام Math.floor هنا للناتج النهائي للمستخدم إذا أردت عدم تحويل قروش، لكن يفضل تركه دقيقاً
                promises.push(updateDoc(doc(db, "users", d.id), { balance: increment(shareVal) }));
                count++;
            }
        });

        await Promise.all(promises);
        
        showToast(`تم توزيع ${totalProfit} ل.س`);
        log(`توزيع أرباح بقيمة ${totalProfit}`);
        closeModal("profitModal");
        profitInput.value = "";

    } catch (err) {
        console.error(err);
        showToast("فشل التوزيع", "error");
    } finally {
        setBtnLoading(btn, false);
    }
};

// إضافة مستخدم
window.confirmAddUser = async (e) => {
    let btn = document.querySelector("#userModal .btn-primary");
    const nameInp = document.getElementById("newUserName");
    const phoneInp = document.getElementById("newUserPhone"); // تأكد من إضافة هذا الـ ID في الـ Modal
    const balInp = document.getElementById("newUserBalance");

    if (!nameInp.value) return showToast("أدخل الاسم", "error");

    try {
        setBtnLoading(btn, true);
        await addDoc(collection(db, "users"), {
            name: nameInp.value,
            phone: phoneInp ? phoneInp.value : "", // حفظ رقم الجوال
            balance: Number(balInp.value || 0),
            assets: [],
            createdAt: serverTimestamp()
        });
        showToast("تمت إضافة المستثمر بنجاح");
        closeModal("userModal");
        nameInp.value = ""; if(phoneInp) phoneInp.value = ""; balInp.value = "";
    } catch (error) { 
        showToast("خطأ في الإضافة", "error"); 
    } finally { 
        setBtnLoading(btn, false); 
    }
};

// تعديل رصيد
window.confirmEditBalance = async (e) => {
    let btn = document.querySelector("#balanceModal .btn-warning");
    const id = document.getElementById("editUserId").value;
    const amount = Number(document.getElementById("balanceAmount").value);

    try {
        setBtnLoading(btn, true);
        await updateDoc(doc(db, "users", id), { balance: increment(amount) });
        showToast("تم تحديث الرصيد");
        closeModal("balanceModal");
        document.getElementById("balanceAmount").value = "";
    } catch (err) { showToast("خطأ", "error"); }
    finally { setBtnLoading(btn, false); }
};

// سعر السهم
window.saveSharePrice = async (e) => {
    let btn = document.querySelector("#sharePriceModal .btn-success");
    const val = Number(document.getElementById("manualSharePriceInput").value);

    if (val <= 0) return showToast("السعر غير صحيح", "error");

    try {
        setBtnLoading(btn, true);
        await setDoc(doc(db, "settings", "market"), { sharePrice: val, lastUpdate: serverTimestamp() });
        showToast("تم التحديث");
        closeModal("sharePriceModal");
    } catch(err) { showToast("خطأ", "error"); }
    finally { setBtnLoading(btn, false); }
};

// دوال مساعدة
window.delUser = async id => { if(confirm("تأكيد الحذف؟")) await deleteDoc(doc(db,"users",id)); };
window.delProduct = async id => { if(confirm("حذف المنتج؟")) await deleteDoc(doc(db,"market_items",id)); };
window.addProduct = async () => {
    const n = document.getElementById("pName").value;
    const p = document.getElementById("pPrice").value;
    if(!n || !p) return showToast("بيانات ناقصة","error");
    await addDoc(collection(db,"market_items"),{name:n, price:Number(p), returnRate:0, createdAt:serverTimestamp()});
    showToast("تمت الإضافة");
    document.getElementById("pName").value=""; document.getElementById("pPrice").value="";
};
async function log(text) { await addDoc(collection(db, "logs"), { text, timestamp: serverTimestamp() }); }

// UI
window.openModal = id => document.getElementById(id).classList.add("show");
window.closeModal = id => document.getElementById(id).classList.remove("show");
window.openBalanceModal = id => { document.getElementById("editUserId").value = id; openModal("balanceModal"); setTimeout(()=>document.getElementById("balanceAmount").focus(),100); };
window.openAssetModal = id => { 
    document.getElementById("assetUserId").value = id; 
    document.getElementById("assetQty").value = "1"; 
    openModal("assetModal"); 
    setTimeout(()=>document.getElementById("assetQty").focus(),100); 
};
window.openTab = (id,btn)=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    document.querySelectorAll(".nav button").forEach(b=>b.classList.remove("active"));
    if(btn) btn.classList.add("active");
};
window.logout = () => signOut(auth).then(() => location.href = "index.html");