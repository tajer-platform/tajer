/*************************************************
 * Firebase Imports  أوامر الاستيراد (Import Statements)، وهي المسؤولة عن ربط موقعك بخدمات Firebase (قاعدة بيانات جوجل السحابية).
 *************************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, deleteDoc,
    updateDoc, doc, increment, arrayUnion,
    serverTimestamp, onSnapshot, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import {
    getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

/*************************************************
 * Firebase Config  هذه المعلومات هي "إحداثيات" مشروعك. بفضل الـ apiKey والـ projectId الحقيقيين، سيعرف المتصفح أين يرسل بيانات المستثمرين الجدد وأين يبحث عن الأسهم.
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

/*************************************************
 * Global State
 *************************************************/
let globalTotalShares = 0;
let marketItemsList = [];
let profitMode = "total";

/*************************************************
 * Auth Guard  قسم التحقق من هوية المستخدم
 *************************************************/
onAuthStateChanged(auth, (user) => {
    if (!user || user.email !== "admin33@tajer44.com") {
        location.href = "admin-login.html";
    } else {
        initApp();
    }
});

window.logout = () => signOut(auth);

/*************************************************
 * Init App
 *************************************************/
function initApp() {

    /* ===== USERS ===== */
    onSnapshot(query(collection(db, "users"), orderBy("createdAt", "desc")), snap => {
        const tbody = document.querySelector("#usersTable tbody");
        tbody.innerHTML = "";

        let totalCap = 0;
        let totalShares = 0;

        snap.forEach(d => {
            const u = d.data();
            const balance = u.balance || 0;
            const shares = (u.assets || []).length;

            totalCap += balance;
            totalShares += shares;
            //القسم المسئول عن بيانات المستخدمين
            tbody.innerHTML += `
                <tr>
                    <td>${d.id.slice(0,6)}</td>
                    <td>${u.name}</td>
                    <td>${balance.toLocaleString()}</td>
                    <td>${shares}</td>
                    <td>
                        <button onclick="openAssetModal('${d.id}')" class="btn btn-purple btn-sm">شراء</button>
                        <button onclick="openBalanceModal('${d.id}')" class="btn btn-warning btn-sm">محفظة</button>
                        <button onclick="delUser('${d.id}')" class="btn btn-danger btn-sm">حذف</button>
                    </td>
                </tr>
            `;
        });
        //القسم المسؤول عن رصيد المستخدمين والاسهم
        globalTotalShares = totalShares;

        document.getElementById("d-users").innerText = snap.size;
        document.getElementById("d-capital").innerText = totalCap.toLocaleString();
        document.getElementById("d-total-shares").innerText = totalShares;
        document.getElementById("d-share-value").innerText =
            totalShares ? Math.floor(totalCap / totalShares).toLocaleString() : 0;

        document.getElementById("activeSharesDisplay").innerText = totalShares;
    });

    /* ===== MARKET ===== */
    //هذا الجزء من الكود هو المسؤول عن "إدارة السوق الاستثماري". وظيفته جلب الفرص الاستثمارية (الأسهم أو الأصول) من قاعدة البيانات وعرضها في مكانين مختلفين في نفس الوقت.
    onSnapshot(collection(db, "market_items"), snap => {
        const tbody = document.querySelector("#marketTable tbody");
        const select = document.getElementById("assetSelect");
        tbody.innerHTML = "";
        select.innerHTML = "";

        marketItemsList = [];

        snap.forEach(d => {
            const p = d.data();
            marketItemsList.push({ id: d.id, ...p });

            tbody.innerHTML += `
                <tr>
                    <td>${p.name}</td>
                    <td>${p.price.toLocaleString()}</td>
                    <td>${p.returnRate}%</td>
                    <td>نشط</td>
                    <td><button onclick="delProduct('${d.id}')" class="btn btn-danger btn-sm">حذف</button></td>
                </tr>
            `;

            select.innerHTML += `<option value="${d.id}">${p.name} (${p.price})</option>`;
        });
    });

    /* ===== WITHDRAWALS ===== */  // المسؤول عن "نظام الصرف المالي". وظيفته جلب طلبات السحب التي أرسلها المستخدمون من تطبيقهم لكي تراجعها أنت وتوافق عليها أو ترفضها.
    onSnapshot(query(collection(db,"withdrawals"), where("status","==","pending")), snap => {
        const tbody = document.querySelector("#withdrawalsTable tbody");
        tbody.innerHTML = "";

        snap.forEach(d => {
            const w = d.data();
            tbody.innerHTML += `
                <tr>
                    <td>${w.userName}</td>
                    <td>${w.amount.toLocaleString()}</td>
                    <td>${w.createdAt?.toDate().toLocaleDateString() || "-"}</td>
                    <td>
                        <button onclick="approveWithdraw('${d.id}','${w.userId}',${w.amount})" class="btn btn-success btn-sm">قبول</button>
                        <button onclick="rejectWithdraw('${d.id}')" class="btn btn-danger btn-sm">رفض</button>
                    </td>
                </tr>
            `;
        });
    });

    /* ===== LOGS ===== */
    //المراقبة المباشرة للسجلات (collection(db, "logs"))
    //الكود يراقب مجموعة في قاعدة البيانات تسمى logs. أي عملية يقوم بها النظام (إضافة مستخدم، سحب رصيد، توزيع أرباح) يجب أن تُرسل نصاً إلى هذه المجموعة لتظهر هنا فوراً.
    onSnapshot(query(collection(db,"logs"), orderBy("timestamp","desc")), snap => {
        const box = document.getElementById("timelineBox");
        box.innerHTML = "";
        snap.forEach(d=>{
            const l = d.data();
            box.innerHTML += `<div class="timeline-item">${l.text}</div>`;
        });
    });
}

/*************************************************
 * UI Helpers  "المحرك التشغيلي" للنوافذ المنبثقة (Modals). وظيفته الأساسية هي الربط بين أزرار الجدول التي شرحناها سابقاً وبين النوافذ التي تظهر للمدير.
 *************************************************/
window.openModal = id => document.getElementById(id).classList.add("show");
window.closeModal = id => document.getElementById(id).classList.remove("show");

window.openBalanceModal = id => {
    document.getElementById("editUserId").value = id;
    openModal("balanceModal");
};

window.openAssetModal = id => {
    document.getElementById("assetUserId").value = id;
    openModal("assetModal");
};

/*************************************************
 * Actions  "أمر التنفيذ" الأول الذي يغير البيانات فعلياً في السحاب
 *************************************************/
window.confirmAddUser = async () => {
    const name = newUserName.value;
    const bal = Number(newUserBalance.value || 0);
    if (!name) return alert("أدخل الاسم");

    await addDoc(collection(db,"users"), {
        name, balance: bal, assets: [], createdAt: serverTimestamp()
    });
    log(`إضافة مستثمر ${name}`);
    closeModal("userModal");
};
//"المحاسب المالي" للنظام، وهو المسؤول عن تنفيذ عمليات الإيداع والسحب في محافظ المستثمرين بدقة وأمان.
window.confirmEditBalance = async () => {
    await updateDoc(doc(db,"users",editUserId.value), {
        balance: increment(Number(balanceAmount.value))
    });
    log("تعديل محفظة");
    closeModal("balanceModal");
};
//المسؤول عن "توليد الملكية"، حيث يقوم بربط الأسهم المتاحة في السوق بمحفظة مستثمر معين.
window.confirmAddAsset = async () => {
    const uid = assetUserId.value;
    const qty = Number(assetQty.value);
    const item = marketItemsList.find(i=>i.id===assetSelect.value);

    for(let i=0;i<qty;i++){
        await updateDoc(doc(db,"users",uid),{
            assets: arrayUnion({ name:item.name, addedAt:new Date().toISOString() })
        });
    }
    log("شراء أسهم");
    closeModal("assetModal");
};
//"أمر الحذف النهائي"، وهو بسيط ولكنه حساس جداً لأنه يقوم بإزالة بيانات المستثمر وكل ما يتعلق بمحفظته من قاعدة البيانات بشكل دائم.
window.delUser = async id => {
    if(confirm("حذف؟")){
        await deleteDoc(doc(db,"users",id));
        log("حذف مستخدم");
    }
};
//المسؤول عن "تغذية السوق" بالفرص الاستثمارية. بفضله، تستطيع إضافة شركات أو أصول جديدة ليقوم المستثمرون (أو أنت نيابة عنهم) بشرائها
window.addProduct = async () => {
    await addDoc(collection(db,"market_items"),{
        name:pName.value,
        price:Number(pPrice.value),
        returnRate:pReturn.value,
        createdAt:serverTimestamp()
    });
    log("إضافة سهم للسوق");
};
//هو المسؤول عن تنظيف السوق من الأسهم القديمة أو التي لم تعد متاحة:
window.delProduct = async id => deleteDoc(doc(db,"market_items",id));

window.toggleProfitMode = mode => {
    profitMode = mode;
};
//هذا الكود هو "حاسبة المعاينة"، ووظيفته الأساسية هي منع "مفاجآت الحسابات" للمدير. هو يقوم بعملية حسابية "افتراضية" تظهر لك النتيجة قبل أن تضغط على زر التوزيع النهائي.
window.calculatePreview = () => {
    const total = Number(profitInput.value);
    if (!total || !globalTotalShares) {
        previewText.innerText = "المبلغ لكل سهم: 0";
        return;
    }
    previewText.innerText =
        `المبلغ لكل سهم: ${Math.floor(total/globalTotalShares).toLocaleString()} ل.س`;
};
//"المفتاح الرئيسي" للنظام. هذه الدالة هي الأهم لأنها تقوم بالعملية الأكثر تعقيداً: توزيع الأرباح على الجميع بضغطة زر واحدة.
window.executeDistribution = async () => {
    if(!globalTotalShares) return alert("لا يوجد أسهم");

    const total = Number(profitInput.value);
    const perShare = Math.floor(total/globalTotalShares);

    const snap = await getDocs(collection(db,"users"));
    snap.forEach(d=>{
        const shares = (d.data().assets||[]).length;
        if(shares){
            updateDoc(doc(db,"users",d.id),{
                balance: increment(shares*perShare)
            });
        }
    });

    log("توزيع أرباح");
    alert("تم التوزيع");
};

/*************************************************
 * Logger//هذا هو الكود الذي "يؤمّن" عملك كمدير. فبدون هذه الدالة، كانت كل الأوامر السابقة (مثل log("إضافة مستخدم")) ستتسبب في توقف الموقع عن العمل.
 *************************************************/
async function log(text){
    await addDoc(collection(db,"logs"),{text,timestamp:serverTimestamp()});
}

/*************************************************
 * Tabs //هذا الكود هو المسؤول عن جعل لوحة التحكم تبدو كـ تطبيق احترافي (Single Page Application):
 *************************************************/
window.openTab = (id,btn)=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    document.querySelectorAll(".nav button").forEach(b=>b.classList.remove("active"));
    if(btn) btn.classList.add("active");
};

window.logout = () => {
    if(confirm("هل تريد تسجيل الخروج؟")) {
        signOut(auth).then(() => {
            window.location.href = "index.html";
        });
    }
};
