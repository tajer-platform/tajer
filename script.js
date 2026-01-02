let balance = 500000;
let assets = [];

const market = [
    { id: 1, name: "دجاجة", price: 25000, icon: "🐔" },
    { id: 2, name: "خروف بلدي", price: 1200000, icon: "🐏" },
    { id: 3, name: "بقرة حلوب", price: 8500000, icon: "🐄" },
    { id: 4, name: "خلية نحل", price: 150000, icon: "🐝" },
    { id: 5, name: "حصان عربي", price: 25000000, icon: "🐎" }
];

function updateUI() {
    document.getElementById('wallet-display').innerText = balance.toLocaleString();
    const grid = document.getElementById('market-grid');
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

function buy(id) {
    const item = market.find(i => i.id === id);
    if (balance >= item.price) {
        balance -= item.price;
        assets.push(item);
        log(`تم شراء ${item.name}`);
        renderAssets();
        updateUI();
    } else { alert("الرصيد لا يكفي!"); }
}

function renderAssets() {
    const box = document.getElementById('my-assets');
    box.innerHTML = assets.map(a => `<div class="card"><i>${a.icon}</i><h3>${a.name}</h3><small>منتج ✅</small></div>`).join('');
}

function log(msg) {
    const box = document.getElementById('activity-log');
    const time = new Date().toLocaleTimeString('ar-SY', {hour:'2-digit', minute:'2-digit'});
    box.innerHTML = `<div class="log-item"><span>${msg}</span><small>${time}</small></div>` + box.innerHTML;
}

function tab(id, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function sendMsg() {
    const i = document.getElementById('chat-in');
    if(i.value) {
        document.getElementById('chat-box').innerHTML += `<div style="background:white; padding:8px; border-radius:8px; margin-bottom:5px;"><b>أنت:</b> ${i.value}</div>`;
        i.value = '';
    }
}

updateUI();
