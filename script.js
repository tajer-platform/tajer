// ... (أكواد Firebase السابقة هنا) ...

function updateUI() {
    const balEl = document.getElementById('wallet-display');
    const totalWalletEl = document.getElementById('total-wallet');
    const assetsCountEl = document.getElementById('assets-count');

    if (balEl) balEl.innerText = balance.toLocaleString();
    if (totalWalletEl) totalWalletEl.innerText = balance.toLocaleString(); // يمكن إضافة قيمة الأصول هنا
    if (assetsCountEl) assetsCountEl.innerText = assets.length;

    // تحديث السوق
    const grid = document.getElementById('market-grid');
    if (grid) {
        grid.innerHTML = marketItems.map(item => `
            <div class="card">
                <i>${item.icon}</i>
                <div style="flex:1">
                    <h3>${item.name}</h3>
                    <small>العائد المتوقع: +5% شهرياً</small>
                </div>
                <div style="text-align:left">
                    <div style="font-weight:bold; color:var(--primary)">${(marketPrices[item.id] || 0).toLocaleString()}</div>
                    <button class="buy-btn" onclick="buyAsset('${item.name}', '${item.id}')">شراء</button>
                </div>
            </div>
        `).join('');
    }
}

// تعديل renderAssets ليعكس حالة "نشط"
function renderAssets() {
    const box = document.getElementById('my-assets-list');
    if (!box) return;
    box.innerHTML = assets.map((a, index) => `
        <div class="card">
            <i>${marketItems.find(m => m.id === a.type)?.icon || '🐾'}</i>
            <div style="flex:1">
                <h3>${a.name}</h3>
                <small>تاريخ الشراء: ${new Date().toLocaleDateString('ar-SY')}</small>
                <div style="color:green; font-size:0.8rem">الحالة: نشط ✅</div>
            </div>
            <button onclick="sellAsset(${index})" style="background:#ff4757; color:white; border:none; padding:8px; border-radius:5px">بيع</button>
        </div>
    `).join('');
}
