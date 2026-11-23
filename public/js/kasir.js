(function () {
  'use strict';
  const app = window.Warung;
  app.formatT = app.formatRupiah;

  let products = [];
  let categories = [];
  let settings = { taxRate: 10, discountDefault: 0, storeName: 'Warung Cemilan' };
  let currentCat = 'Semua';
  let currentSearch = '';
  const cart = new Map(); // productId -> { p, qty }
  let payMethod = 'Tunai';

  function num(v) { return parseInt(String(v).replace(/[^\d]/g, ''), 10) || 0; }

  /* ------------------------------ barcode scan ------------------------------ */

  function normCode(v) {
    return String(v == null ? '' : v).replace(/\D/g, '');
  }

  // Pencocokan fleksibel antara barcode produk dengan hasil scan / teks pencarian:
  // kode 12 vs 13 digit (beda check digit), kode 13 digit dari scanner, sisa ketikan
  // scan sebelumnya, dan pencarian sebagian.
  function barcodeMatches(barcode, scanned) {
    const b = normCode(barcode);
    const s = normCode(scanned);
    if (!b || !s) return false;
    if (b === s) return true;
    if (b.includes(s)) return true;
    if (b.length >= 6 && s.includes(b)) return true;
    if (b.length >= 12 && s.length >= 12 && b.slice(0, 12) === s.slice(0, 12)) return true;
    return false;
  }

  function findProductByBarcode(code) {
    const s = normCode(code);
    if (!s) return null;
    return products.find((p) => normCode(p.barcode) === s)
      || products.find((p) => barcodeMatches(p.barcode, s))
      || null;
  }

  function clearSearchBox() {
    const box = document.getElementById('pos-search');
    if (box) box.value = '';
    currentSearch = '';
    renderProducts();
  }

  // Satu jalur untuk semua hasil scan (kamera & scanner USB):
  // cocok -> tambah ke keranjang, tidak cocok -> tampilkan di pencarian.
  function handleScan(code) {
    const clean = String(code == null ? '' : code).trim();
    if (!clean) return;
    const found = findProductByBarcode(clean);
    if (found) {
      addToCart(found.id);
      clearSearchBox();
      app.toast('Produk ditambahkan: ' + found.name);
    } else {
      const box = document.getElementById('pos-search');
      if (box) box.value = clean;
      currentSearch = clean;
      renderProducts();
      app.toast('Pencarian barcode: ' + clean, 'info');
    }
  }

  // Scanner barcode USB (keyboard wedge): mengetik karakter dengan sangat cepat
  // lalu diakhiri Enter/Tab, dari fokus mana pun. Tangkap di level document supaya
  // scan tetap terbaca walau kursor tidak berada di kolom pencarian.
  function setupHardwareScanner() {
    let buf = '';
    let timer = null;

    function reset() {
      buf = '';
      if (timer) { clearTimeout(timer); timer = null; }
    }

    function flush() {
      const code = buf.trim();
      reset();
      if (code.length >= 6) handleScan(code);
    }

    document.addEventListener('keydown', (e) => {
      const el = e.target;
      const tag = el && el.tagName ? el.tagName.toUpperCase() : '';
      // Field input dibiarkan normal (kolom pencarian sudah punya handler sendiri)
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;

      if (e.key === 'Enter' || e.key === 'Tab') {
        if (buf.trim().length < 6) { reset(); return; } // biarkan perilaku default
        e.preventDefault();
        flush();
        return;
      }
      if (e.key && e.key.length === 1) {
        if (buf.length > 64) reset(); // terlalu panjang, kemungkinan bukan barcode
        buf += e.key;
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, 150); // scanner tanpa suffix Enter pun terbaca
      }
    });
  }

  /* ------------------------------ kategori ------------------------------ */

  function renderCats() {
    const wrap = document.getElementById('cat-buttons');
    const all = [{ id: 'Semua', name: 'Semua', icon: '📦', active: currentCat === 'Semua' }, ...categories];
    wrap.innerHTML = all.map((c) => {
      const active = currentCat === c.id;
      return `
        <button data-cat="${c.id}"
          class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left
          ${active ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-gray-600 hover:bg-gray-50'}">
          <span class="text-lg">${c.icon}</span>
          <span class="truncate">${c.name}</span>
        </button>`;
    }).join('');
    wrap.querySelectorAll('[data-cat]').forEach((b) =>
      b.addEventListener('click', () => { currentCat = b.dataset.cat; renderCats(); renderProducts(); })
    );
  }

  /* ------------------------------ produk ------------------------------ */

  function renderProducts() {
    const grid = document.getElementById('product-grid');
    let list = products;
    if (currentCat !== 'Semua') list = list.filter((p) => p.categoryId === currentCat);
    if (currentSearch) {
      const n = currentSearch.toLowerCase();
      const numericQuery = /^[\d\s-]+$/.test(currentSearch.trim());
      list = list.filter((p) => p.name.toLowerCase().includes(n) || (numericQuery && barcodeMatches(p.barcode, currentSearch)));
    }
    list = list.filter((p) => p.status !== 'nonaktif');

    if (!list.length) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center">
          <div class="text-4xl mb-3">🔍</div>
          <p class="font-semibold text-gray-700">Produk tidak ditemukan</p>
        </div>`;
      return;
    }

    grid.innerHTML = list.map((p) => {
      const low = p.stock <= 20;
      const out = p.stock <= 0;
      const imgHtml = p.image
        ? `<div class="w-full h-24 sm:h-28 bg-gray-50/80 flex items-center justify-center p-1.5">
            <img src="${p.image}" alt="${p.name}" class="w-full h-full object-contain rounded-lg group-hover:scale-105 transition duration-300" onerror="this.onerror=null; this.outerHTML='<div class=\\'w-full h-full flex items-center justify-center text-3xl select-none\\'>${p.emoji || '🍔'}</div>';" />
          </div>`
        : `<div class="w-full h-24 sm:h-28 bg-gray-50 flex items-center justify-center text-3xl select-none">${p.emoji || '🍔'}</div>`;

      return `
        <button data-add="${p.id}" ${out ? 'disabled' : ''}
          class="group bg-white rounded-2xl border border-gray-100 shadow-sm text-left hover:shadow-xl hover:-translate-y-1 transition duration-200 overflow-hidden flex flex-col justify-between ${out ? 'opacity-50 cursor-not-allowed' : ''}">
          <div class="relative w-full overflow-hidden">
            ${imgHtml}
            <span class="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md shadow-sm ${out ? 'bg-red-500/90 text-white' : low ? 'bg-amber-500/90 text-white' : 'bg-emerald-500/90 text-white'}">
              ${out ? 'Habis' : 'Stok ' + p.stock}
            </span>
          </div>
          <div class="p-2.5 sm:p-3 flex-1 flex flex-col">
            <div>
              <p class="font-bold text-gray-800 text-xs sm:text-sm leading-tight line-clamp-1 group-hover:text-blue-600 transition">${p.name}</p>
              <p class="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">${p.unit || 'Pcs'}</p>
            </div>
            <div class="mt-1.5 flex items-center justify-between">
              <p class="text-blue-600 font-extrabold text-xs sm:text-sm">${app.formatT(p.price)}</p>
              <span class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              </span>
            </div>
          </div>
        </button>`;
    }).join('');
    lucide.createIcons();

    grid.querySelectorAll('[data-add]').forEach((b) =>
      b.addEventListener('click', () => addToCart(b.dataset.add))
    );
  }

  /* ------------------------------ keranjang ------------------------------ */

  let currentNoteCartKey = null;

  function openPosNoteModal(key) {
    currentNoteCartKey = key;
    const item = cart.get(key);
    if (!item) return;

    const modal = document.getElementById('pos-note-modal');
    const nameEl = document.getElementById('pos-note-product-name');
    const inputEl = document.getElementById('pos-note-input');

    if (nameEl) nameEl.textContent = `Catatan: ${item.p.name}`;
    if (inputEl) inputEl.value = item.note || '';

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  function closePosNoteModal() {
    const modal = document.getElementById('pos-note-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    currentNoteCartKey = null;
  }


  
  // Helper cek apakah produk memiliki fitur level kepedasan (Enoci Pedec, Chikiwings, Bacic)
  function isSpicyProduct(p) {
    if (!p) return false;
    if (p.hasSpicyLevel === true) return true;
    const name = String(p.name || '').toLowerCase();
    return name.includes('enoci') || name.includes('chikiwings') || name.includes('bacic') || name.includes('ayam mpek') || name.includes('cileng bejo') || name.includes('naci oyeng');
  }

  let currentPosSpicyProduct = null;
  let posSpicyLevel = 1;
  let posIsExtraSpicy = false;
  let posExtraSpicyLevel = 6;
  let posSpicyNote = '';

  function openPosSpicyModal(p) {
    currentPosSpicyProduct = p;
    posSpicyLevel = 1;
    posIsExtraSpicy = false;
    posExtraSpicyLevel = 6;
    posSpicyNote = '';

    const modal = document.getElementById('pos-spicy-modal');
    const nameEl = document.getElementById('pos-spicy-product-name');
    const priceEl = document.getElementById('pos-spicy-product-price');
    const extraToggle = document.getElementById('pos-spicy-extra-toggle');
    const extraWrap = document.getElementById('pos-spicy-extra-wrap');
    const noteInput = document.getElementById('pos-spicy-note');
    const lvlDisp = document.getElementById('pos-spicy-level-display');
    const costText = document.getElementById('pos-spicy-extra-cost-text');

    if (nameEl) nameEl.textContent = p.name;
    if (priceEl) priceEl.textContent = app.formatT(p.price) + ' / ' + (p.unit || 'Porsi');
    if (extraToggle) extraToggle.checked = false;
    if (extraWrap) extraWrap.classList.add('hidden');
    if (noteInput) noteInput.value = '';
    if (lvlDisp) lvlDisp.textContent = 'Level 6';
    if (costText) costText.textContent = `+${app.formatT(2000)} / porsi`;

    renderPosSpicyPillStates();
    updatePosSpicySubtotal();

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  function closePosSpicyModal() {
    const modal = document.getElementById('pos-spicy-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    currentPosSpicyProduct = null;
  }

  function renderPosSpicyPillStates() {
    const pills = document.querySelectorAll('#pos-spicy-preset-group .btn-pos-spicy-lvl');
    pills.forEach((btn) => {
      const lvl = parseInt(btn.dataset.lvl, 10);
      if (!posIsExtraSpicy && lvl === posSpicyLevel) {
        btn.className = 'btn-pos-spicy-lvl py-2 px-1 rounded-xl text-xs font-black border transition flex flex-col items-center justify-center gap-0.5 border-orange-500 bg-orange-500 text-white shadow-xs';
      } else {
        btn.className = 'btn-pos-spicy-lvl py-2 px-1 rounded-xl text-xs font-black border transition flex flex-col items-center justify-center gap-0.5 border-gray-200 bg-white text-gray-700 hover:border-orange-300';
      }
    });
  }

  function updatePosSpicySubtotal() {
    const unitTotalEl = document.getElementById('pos-spicy-unit-total');
    if (currentPosSpicyProduct && unitTotalEl) {
      const extra = posIsExtraSpicy ? Math.max(1, posExtraSpicyLevel - 5) * 2000 : 0;
      unitTotalEl.textContent = app.formatT(currentPosSpicyProduct.price + extra);
    }
  }

  function addSpicyToCart(p, level, extraPrice, note) {
    if (!p) return;
    const key = p.id + '_lvl' + level + (note ? '_' + note.replace(/[^a-zA-Z0-9]/g, '') : '');
    const unitPrice = p.price + extraPrice;
    if (cart.has(key)) {
      if (cart.get(key).qty + 1 > p.stock) { app.toast('Stok ' + p.name + ' tidak cukup.', 'error'); return; }
      cart.get(key).qty++;
    } else {
      if (p.stock < 1) { app.toast('Stok ' + p.name + ' habis.', 'error'); return; }
      cart.set(key, { p, key, qty: 1, level, extraPrice, note, unitPrice, ts: Date.now() });
    }
    renderCart();
    app.toast(`Produk ditambahkan: ${p.name} (Level ${level})`);
  }

  const PIZZA_VARIANTS = ['Margherita', 'Pepperoni', 'Veggie', 'Seafood', 'Truffle'];
  const BURGER_VARIANTS = ['Doubble Cheese Burger', 'Beef Burger', 'Veggie Burger', 'Smacker Burger', 'Chicken Burger'];
  const MARTABAK_VARIANTS = ['Kacang', 'Coklat', 'Keju', 'Selai', 'Ketan'];
  const ROTI_BAKAR_VARIANTS = ['Coklat', 'Keju', 'Selai'];

  function isPizzaProduct(p) {
    if (!p) return false;
    const name = String(p.name || '').toLowerCase();
    return name.includes('pyezza');
  }

  function isBurgerProduct(p) {
    if (!p) return false;
    const name = String(p.name || '').toLowerCase();
    return name.includes('bulgel');
  }

  function isMartabakProduct(p) {
    if (!p) return false;
    const name = String(p.name || '').toLowerCase();
    return name.includes('maytabac');
  }

  function isRotiBakarProduct(p) {
    if (!p) return false;
    const name = String(p.name || '').toLowerCase();
    return name.includes('nti bakay') || name.includes('roti bakar');
  }

  function isVariantProduct(p) {
    if (!p) return false;
    if (p.hasVariants === true) return true;
    return isPizzaProduct(p) || isBurgerProduct(p) || isMartabakProduct(p) || isRotiBakarProduct(p);
  }

  function getProductVariants(p) {
    if (!p) return [];
    if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) return p.variants;
    if (isPizzaProduct(p)) return PIZZA_VARIANTS;
    if (isBurgerProduct(p)) return BURGER_VARIANTS;
    if (isMartabakProduct(p)) return MARTABAK_VARIANTS;
    if (isRotiBakarProduct(p)) return ROTI_BAKAR_VARIANTS;
    return [];
  }

  const POS_VARIANT_INFO = {
    'Margherita': { icon: '🧀', sub: 'Klasik Tomat & Basil' },
    'Pepperoni': { icon: '🥩', sub: 'Daging Sapi & Keju Leleh' },
    'Veggie': { icon: '🥦', sub: 'Jamur, Paprika & Sayur' },
    'Seafood': { icon: '🦐', sub: 'Udang, Cumi & Saus' },
    'Truffle': { icon: '🍄', sub: 'Jamur Spesial & Truffle' },
    'Doubble Cheese Burger': { icon: '🧀', sub: 'Double Beef & Keju Leleh' },
    'Beef Burger': { icon: '🥩', sub: 'Daging Panggang & Sayur' },
    'Veggie Burger': { icon: '🥦', sub: 'Patty Nabati & Selada' },
    'Smacker Burger': { icon: '🥓', sub: 'Saus Smacker Gurih' },
    'Chicken Burger': { icon: '🍗', sub: 'Patty Ayam Krispi & Mayo' },
    'Kacang': { icon: '🥜', sub: 'Kacang Gurih Renyah' },
    'Coklat': { icon: '🍫', sub: 'Coklat Manis Lumer' },
    'Keju': { icon: '🧀', sub: 'Keju Cheddar Parut' },
    'Selai': { icon: '🍓', sub: 'Selai Buah Manis Segar' },
    'Ketan': { icon: '🍚', sub: 'Ketan Hitam Legit' },
  };

  let currentPosPizzaProduct = null;
  let posPizzaVariant = '';
  let posPizzaNote = '';

  function openPosPizzaModal(p) {
    currentPosPizzaProduct = p;
    const variants = getProductVariants(p);
    posPizzaVariant = variants[0] || '';
    posPizzaNote = '';

    const modal = document.getElementById('pos-pizza-modal');
    const iconEl = document.getElementById('pos-pizza-icon');
    const labelEl = document.getElementById('pos-pizza-modal-label');
    const nameEl = document.getElementById('pos-pizza-product-name');
    const priceEl = document.getElementById('pos-pizza-product-price');
    const unitTotalEl = document.getElementById('pos-pizza-unit-total');
    const noteInput = document.getElementById('pos-pizza-note');

    const isBurger = isBurgerProduct(p);
    const isMartabak = isMartabakProduct(p);
    const isRotiBakar = isRotiBakarProduct(p);
    if (iconEl) iconEl.textContent = isBurger ? '🍔' : isMartabak ? '🥞' : isRotiBakar ? '🍞' : '🍕';
    if (labelEl) labelEl.textContent = isBurger ? 'Pilih Varian Burger:' : isMartabak ? 'Pilih Varian Maytabac:' : isRotiBakar ? 'Pilih Varian Nti Bakay:' : 'Pilih Varian Pizza:';
    if (nameEl) nameEl.textContent = p.name;
    if (priceEl) priceEl.textContent = app.formatT(p.price) + ' / ' + (p.unit || 'Porsi');
    if (unitTotalEl) unitTotalEl.textContent = app.formatT(p.price);
    if (noteInput) {
      noteInput.placeholder = isBurger 
        ? 'Catatan burger (opsional, misal: tanpa bawang)' 
        : isMartabak 
          ? 'Catatan maytabac (opsional, misal: susu dipisah)'
          : isRotiBakar
            ? 'Catatan nti bakay (opsional, misal: bakar agak garing)'
            : 'Catatan pizza (opsional, misal: potong 8)';
      noteInput.value = '';
    }

    renderPosPizzaVariantStates();

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  function closePosPizzaModal() {
    const modal = document.getElementById('pos-pizza-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    currentPosPizzaProduct = null;
  }

  function renderPosPizzaVariantStates() {
    const group = document.getElementById('pos-pizza-variants-group');
    if (!group || !currentPosPizzaProduct) return;
    const variants = getProductVariants(currentPosPizzaProduct);

    group.innerHTML = variants.map((v) => {
      const isSel = v === posPizzaVariant;
      const info = POS_VARIANT_INFO[v] || { icon: isBurgerProduct(currentPosPizzaProduct) ? '🍔' : '🍕', sub: 'Varian Menu' };
      return `
        <button type="button" class="btn-pos-pizza-var w-full p-2.5 rounded-xl text-left border transition flex items-center justify-between ${isSel ? 'border-orange-500 bg-orange-500 text-white shadow-xs font-bold text-xs' : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300 font-bold text-xs'}" data-variant="${v}">
          <span class="flex items-center gap-2"><span>${info.icon}</span><span>${v}</span></span>
          <span class="text-[10px] ${isSel ? 'opacity-90 text-white' : 'text-gray-400'}">${info.sub}</span>
        </button>
      `;
    }).join('');

    group.querySelectorAll('.btn-pos-pizza-var').forEach((btn) => {
      btn.addEventListener('click', () => {
        posPizzaVariant = btn.dataset.variant;
        renderPosPizzaVariantStates();
      });
    });
  }

  function addPizzaToCart(p, variant, note) {
    if (!p) return;
    const key = p.id + '_var_' + variant.toLowerCase() + (note ? '_' + note.replace(/[^a-zA-Z0-9]/g, '') : '');
    const unitPrice = p.price;
    if (cart.has(key)) {
      if (cart.get(key).qty + 1 > p.stock) { app.toast('Stok ' + p.name + ' tidak cukup.', 'error'); return; }
      cart.get(key).qty++;
    } else {
      if (p.stock < 1) { app.toast('Stok ' + p.name + ' habis.', 'error'); return; }
      cart.set(key, { p, key, qty: 1, variant, note, unitPrice, ts: Date.now() });
    }
    renderCart();
    app.toast(`Produk ditambahkan: ${p.name} (${variant})`);
  }

  function cartEntries() { return [...cart.values()].sort((a, b) => a.ts - b.ts); }

  function addToCart(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    if (cart.has(id)) {
      if (cart.get(id).qty + 1 > p.stock) { app.toast('Stok ' + p.name + ' tidak cukup.', 'error'); return; }
      cart.get(id).qty++;
    } else {
      if (p.stock < 1) return;
      cart.set(id, { p, qty: 1, ts: Date.now() });
    }
    renderCart();
  }

  function changeQty(id, d) {
    const item = cart.get(id);
    if (!item) return;
    item.qty += d;
    if (item.qty <= 0) { cart.delete(id); }
    else if (item.qty > item.p.stock) { item.qty = item.p.stock; app.toast('Stok ' + item.p.name + ' tidak cukup.', 'error'); }
    renderCart();
  }

  function renderCart() {
    const list = document.getElementById('cart-list');
    const entries = cartEntries();
    document.getElementById('cart-count').textContent = sumQty() + ' item';

    if (!entries.length) {
      list.innerHTML = '<p class="text-center text-gray-400 text-sm py-10">Belum ada produk.<br />Klik produk untuk menambah.</p>';
    } else {
      list.innerHTML = entries.map((it) => `
        <div class="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 bg-gray-50/60">
          ${app.renderProductImage(it.p, 'w-10 h-10 rounded-lg')}
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-800 truncate">${it.p.name}</p>
            <p class="text-xs text-gray-400">${app.formatT(it.p.price)}</p>
          </div>
          <div class="flex items-center gap-1.5">
            <button data-dec="${it.p.id}" class="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center transition">
              <i data-lucide="minus" class="w-3.5 h-3.5"></i>
            </button>
            <span class="w-7 text-center font-semibold text-sm">${it.qty}</span>
            <button data-pl="true" data-id="${it.p.id}" class="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center transition">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          <span class="text-sm font-bold text-gray-800 w-14 text-right">${app.formatT(it.p.price * it.qty)}</span>
        </div>`).join('');
    }
    lucide.createIcons();

    list.querySelectorAll('[data-note-btn]').forEach((b) => b.addEventListener('click', () => openPosNoteModal(b.dataset.noteBtn)));
    list.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', () => changeQty(b.dataset.dec, -1)));
    list.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => changeQty(b.dataset.id, 1)));

    updateTotals();
  }

  function sumQty() {
    return cartEntries().reduce((a, it) => a + it.qty, 0);
  }

  function updateTotals() {
    const subtotal = cartEntries().reduce((a, it) => a + (it.unitPrice || it.p.price) * it.qty, 0);
    const discount = num(document.getElementById('c-discount').value || settings.discountDefault);
    document.getElementById('c-subtotal').textContent = app.formatT(subtotal);
    document.getElementById('c-taxrate').textContent = '(' + (settings.taxRate || 0) + '%)';
    const afterDiscount = Math.max(0, subtotal - discount);
    const tax = Math.round(afterDiscount * (settings.taxRate || 0) / 100);
    const total = afterDiscount + tax;
    document.getElementById('c-tax').textContent = app.formatT(tax);
    document.getElementById('c-total').textContent = app.formatT(total);
    return { subtotal, discount, tax, total };
  }

  /* ------------------------------ pembayaran ------------------------------ */

  let posDiningType = 'Makan di Tempat'; // 'Makan di Tempat' | 'Take Away'

  function setPosDiningType(type) {
    posDiningType = type;
    document.querySelectorAll('#pos-dining-type-group .pos-dining-btn').forEach((btn) => {
      if (btn.dataset.dining === type) {
        btn.className = 'pos-dining-btn border-2 border-blue-500 text-blue-600 bg-blue-50 rounded-xl py-2 px-3 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-98';
      } else {
        btn.className = 'pos-dining-btn border-2 border-gray-200 text-gray-600 hover:border-blue-300 rounded-xl py-2 px-3 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-98';
      }
    });
  }


  function openPay() {
    if (!cart.size) { app.toast('Keranjang masih kosong.', 'error'); return; }
    const t = updateTotals();
    document.getElementById('pay-total').textContent = app.formatT(t.total);
    document.getElementById('pay-amount').value = '';
    document.getElementById('pay-change').textContent = 'Rp 0';
    setMethod('Tunai');
    const modal = document.getElementById('pay-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => document.getElementById('pay-amount').focus(), 80);
  }

  function closePay() {
    document.getElementById('pay-modal').classList.add('hidden');
    document.getElementById('pay-modal').classList.remove('flex');
  }

  function setMethod(m) {
    payMethod = m;
    document.querySelectorAll('#pay-modal [data-method]').forEach((b) => {
      const on = b.dataset.method === m;
      b.className = (on ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-500 hover:border-blue-300')
        + ' border-2 rounded-xl py-2.5 text-sm font-semibold flex flex-col items-center gap-1';
    });
    lucide.createIcons();
    const total = num(document.getElementById('pay-total').textContent.replace(/[^\d]/g, ''));
    const cashSec = document.getElementById('cash-payment-section');
    const qrisSec = document.getElementById('qris-payment-section');
    if (m === 'Tunai') {
      cashSec.classList.remove('hidden');
      qrisSec.classList.add('hidden');
      document.getElementById('pay-amount').readOnly = false;
      document.getElementById('pay-amount').value = '';
    } else if (m === 'QRIS') {
      cashSec.classList.add('hidden');
      qrisSec.classList.remove('hidden');
      document.getElementById('pay-amount').value = total.toLocaleString('id-ID');
      document.getElementById('pay-change').textContent = 'Rp 0';
    } else {
      cashSec.classList.remove('hidden');
      qrisSec.classList.add('hidden');
      document.getElementById('pay-amount').readOnly = true;
      document.getElementById('pay-amount').value = total.toLocaleString('id-ID');
      document.getElementById('pay-change').textContent = 'Rp 0';
    }
  }

  let html5QrCode = null;
  function openScanner() {
    const modal = document.getElementById('scanner-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("reader");
    }
    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (decodedText) => {
        closeScanner();
        handleScan(decodedText);
      },
      (error) => {}
    ).catch(err => {
      app.toast('Tidak dapat mengakses kamera.', 'error');
    });
  }

  function closeScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop().catch(() => {});
    }
    document.getElementById('scanner-modal').classList.add('hidden');
    document.getElementById('scanner-modal').classList.remove('flex');
  }

  function updateChange() {
    const total = num(document.getElementById('pay-total').textContent.replace(/[^\d]/g, ''));
    const paid = num(document.getElementById('pay-amount').value);
    const change = paid - total;
    document.getElementById('pay-change').textContent = 'Rp ' + Math.max(0, change).toLocaleString('id-ID');
    return { total, paid, change };
  }

  function confirmPay() {
    if (!cart.size) { app.toast('Keranjang kosong.', 'error'); return; }
    const t = updateTotals();
    const { total, paid } = updateChange();
    if (payMethod === 'Tunai' && paid < total) {
      const short = total - paid;
      document.getElementById('pay-amount').classList.add('shake');
      setTimeout(() => document.getElementById('pay-amount').classList.remove('shake'), 500);
      app.toast('Uang kurang Rp ' + short.toLocaleString('id-ID'), 'error');
      return;
    }
let currentKasir = 'Kasir';
    try {
      const u = JSON.parse(localStorage.getItem('warung_user') || '{}');
      if (u.name) currentKasir = u.name;
    } catch(e) {}

    const payload = {
      method: payMethod,
      discount: num(document.getElementById('c-discount').value),
      paid: payMethod === 'Tunai' ? paid : total,
      items: cartEntries().map((e) => {
        const itemPrice = e.unitPrice || e.p.price;
        let displayName = e.p.name;
        if (e.variant) displayName += ` (${e.variant})`;
        if (e.level) displayName += ` (Level ${e.level}${e.extraPrice > 0 ? ' +Rp ' + e.extraPrice.toLocaleString('id-ID') : ''})`;
        if (e.note) displayName += ` [${e.note}]`;

        return {
          productId: e.p.id,
          qty: e.qty,
          price: itemPrice,
          variant: e.variant || null,
          spicyLevel: e.level || null,
          extraPrice: e.extraPrice || 0,
          spicyNote: e.note || '',
          productName: displayName
        };
      }),
      kasir: currentKasir,
    };
    const btn = document.getElementById('btn-confirm-pay');
    btn.disabled = true;
    btn.textContent = 'Memproses...';
    app.post('api/orders', payload)
      .then((res) => {
        app.toast(`Pembayaran berhasil (${posDiningType})! ${res.order.id}`);
        cart.clear();
        renderCart();
        closePay();
        renderProducts();
      })
      .catch((e) => app.toast(e.message || 'Pembayaran gagal.', 'error'))
      .finally(() => { btn.disabled = false; btn.textContent = 'BAYAR SEKARANG'; });
  }

  /* ------------------------------ boot ------------------------------ */

  app.boot(() => {
    document.getElementById('pos-search').addEventListener('input', app.debounce(function () {
      currentSearch = this.value.trim();
      renderProducts();
    }, 250));
    document.getElementById('pos-search').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const code = this.value.trim();
      if (code) handleScan(code);
    });
    setupHardwareScanner();
    document.getElementById('c-discount').addEventListener('input', () => updateTotals());
    document.getElementById('pay-amount').addEventListener('input', function () {
      this.value = app.escapeInput.toDisplay(this.value);
      updateChange();
    });
    document.querySelectorAll('#pay-modal [data-method]').forEach((b) => b.addEventListener('click', () => setMethod(b.dataset.method)));
    document.querySelectorAll('#pos-dining-type-group [data-dining]').forEach((b) => b.addEventListener('click', () => setPosDiningType(b.dataset.dining)));
    document.querySelectorAll('#pay-modal [data-close]').forEach((el) => el.addEventListener('click', closePay));
    document.getElementById('btn-pay').addEventListener('click', openPay);
    document.getElementById('btn-save-pos').addEventListener('click', () => app.toast('Gunakan tombol Bayar untuk menyimpan transaksi.', 'info'));
    document.getElementById('btn-confirm-pay').addEventListener('click', confirmPay);
    document.getElementById('btn-scan-barcode').addEventListener('click', openScanner);
    document.getElementById('btn-close-scanner').addEventListener('click', closeScanner);
    document.getElementById('close-scanner').addEventListener('click', closeScanner);

    Promise.all([app.get('api/products-full'), app.get('api/categories'), app.get('api/settings')])
      .then(([pd, cd, st]) => {
        products = pd.products;
        categories = cd.categories;
        settings = Object.assign(settings, st);
        const disc = document.getElementById('c-discount');
        if (settings.discountDefault) disc.value = settings.discountDefault.toLocaleString('id-ID');
        if (cart.size === 0) renderCart();
        renderCats();
        renderProducts();
        updateTotals();
      })
      .catch((e) => {
        app.toast(e.message || 'Gagal memuat kasir.', 'error');
        app.clearSkeleton('cat-buttons', '<div class="text-sm text-gray-400 text-center py-4">Gagal memuat kategori.</div>');
        app.clearSkeleton('product-grid', '<div class="col-span-full text-center py-16 text-red-400 text-sm">Gagal memuat produk.</div>');
      });
  });
})();