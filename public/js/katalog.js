(function () {
  'use strict';

  // State
  let storeInfo = {
    storeName: 'Warung Cemilan',
    tagline: 'Aneka makanan & minuman segar',
    address: 'Jl. Contoh No. 88, Bandung',
    phone: '081234567890',
    logo: '🏪',
  };

  let allProducts = [];
  let categories = [];
  let selectedCategory = 'Semua';
  let searchQuery = '';
  let cart = []; // items: [{ id, name, price, emoji, image, qty, unit }]
  let selectedRating = 5;

  const RATING_LABELS = {
    5: '5 Bintang (Luar Biasa)',
    4: '4 Bintang (Sangat Bagus)',
    3: '3 Bintang (Cukup Bagus)',
    2: '2 Bintang (Kurang)',
    1: '1 Bintang (Kecewa)',
  };

  // Helper formatting
  function formatRp(num) {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
  }

  function cleanPhone(raw) {
    if (!raw) return '6281234567890';
    let p = String(raw).replace(/[^0-9]/g, '');
    if (p.startsWith('0')) p = '62' + p.slice(1);
    return p;
  }

  function showToast(message, isSuccess = true) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toast-msg');
    const icon = document.getElementById('toast-icon');
    if (!toast || !msg) return;

    msg.textContent = message;
    icon.innerHTML = isSuccess 
      ? '<i data-lucide="check-circle" class="w-5 h-5 text-emerald-400"></i>' 
      : '<i data-lucide="alert-circle" class="w-5 h-5 text-rose-400"></i>';
    if (window.lucide) lucide.createIcons();

    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0');
      toast.classList.remove('translate-y-0', 'opacity-100');
    }, 3000);
  }

  // ------------------------- 1. STORE INFO -------------------------
  async function loadStoreInfo() {
    try {
      const res = await fetch('/api/public/store');
      if (res.ok) {
        storeInfo = await res.json();
        renderStoreInfo();
      }
    } catch (e) {
      console.warn('Gagal memuat info toko:', e);
    }
  }

  function renderStoreInfo() {
    document.title = (storeInfo.storeName || 'Warung Cemilan') + ' — Katalog & Layanan Pelanggan';

    const nameEls = ['store-name', 'footer-name'];
    nameEls.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = storeInfo.storeName || 'Warung Cemilan';
    });

    const logoEls = ['store-logo', 'footer-logo'];
    logoEls.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = storeInfo.logo || '🏪';
    });

    const taglineEl = document.getElementById('store-tagline');
    if (taglineEl) taglineEl.textContent = storeInfo.tagline || 'Aneka makanan & minuman segar';

    const addressEl = document.getElementById('hero-address');
    if (addressEl) addressEl.textContent = storeInfo.address || 'Bandung';

    const footerAddress = document.getElementById('footer-address');
    if (footerAddress) footerAddress.textContent = storeInfo.address || 'Bandung';

    const phoneEl = document.getElementById('hero-phone');
    if (phoneEl) phoneEl.textContent = storeInfo.phone || '0812-3456-7890';

    const btnDirectWa = document.getElementById('btn-direct-wa');
    if (btnDirectWa) {
      const targetPhone = cleanPhone(storeInfo.phone);
      btnDirectWa.href = `https://wa.me/${targetPhone}?text=${encodeURIComponent('Halo ' + (storeInfo.storeName || 'Warung Cemilan') + ', saya ingin bertanya mengenai menu dan cara pemesanan.')}`;
    }
  }

  // ------------------------- 2. CATEGORIES & PRODUCTS -------------------------
  async function loadCategories() {
    try {
      const res = await fetch('/api/public/categories');
      if (res.ok) {
        const data = await res.json();
        categories = data.categories || [];
        renderCategoryPills();
      }
    } catch (e) {
      console.warn('Gagal memuat kategori:', e);
    }
  }

  function renderCategoryPills() {
    const container = document.getElementById('category-pills');
    if (!container) return;

    let html = `
      <button type="button" class="cat-pill ${selectedCategory === 'Semua' ? 'active bg-orange-500 text-white shadow-sm shadow-orange-500/20' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'} px-4 py-2 rounded-xl whitespace-nowrap transition font-semibold" data-cat="Semua">
        Semua Produk
      </button>
    `;

    categories.forEach((c) => {
      const isActive = selectedCategory === c.id;
      html += `
        <button type="button" class="cat-pill ${isActive ? 'active bg-orange-500 text-white shadow-sm shadow-orange-500/20' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'} px-4 py-2 rounded-xl whitespace-nowrap transition font-semibold flex items-center gap-1.5" data-cat="${c.id}">
          <span>${c.icon || '🗂️'}</span>
          <span>${c.name}</span>
        </button>
      `;
    });

    container.innerHTML = html;

    // Attach click events
    container.querySelectorAll('.cat-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedCategory = btn.dataset.cat;
        renderCategoryPills();
        filterAndRenderProducts();
      });
    });
  }

  async function loadProducts() {
    const loading = document.getElementById('products-loading');
    const grid = document.getElementById('products-grid');
    const empty = document.getElementById('products-empty');

    try {
      const res = await fetch('/api/public/products');
      if (res.ok) {
        const data = await res.json();
        allProducts = data.products || [];
        if (loading) loading.classList.add('hidden');
        if (grid) grid.classList.remove('hidden');
        filterAndRenderProducts();
      }
    } catch (e) {
      if (loading) loading.classList.add('hidden');
      if (empty) empty.classList.remove('hidden');
      console.warn('Gagal memuat produk:', e);
    }
  }

  function filterAndRenderProducts() {
    const grid = document.getElementById('products-grid');
    const empty = document.getElementById('products-empty');
    if (!grid) return;

    let list = allProducts.slice();

    // Category filter
    if (selectedCategory && selectedCategory !== 'Semua') {
      list = list.filter((p) => p.categoryId === selectedCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const needle = searchQuery.toLowerCase().trim();
      list = list.filter((p) => (p.name || '').toLowerCase().includes(needle) || (p.category || '').toLowerCase().includes(needle));
    }

    if (list.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');

    grid.innerHTML = list.map((p) => {
      const isAvailable = p.inStock && p.stock > 0;
      const stockBadge = isAvailable
        ? `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
             <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Tersedia
           </span>`
        : `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
             Habis
           </span>`;

      const imageHtml = p.image
        ? `<img src="${p.image}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" onerror="this.onerror=null;this.parentElement.innerHTML='<span class=\\'text-5xl\\'>${p.emoji || '🛍️'}</span>';" />`
        : `<div class="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-tr from-amber-50 to-orange-100 group-hover:scale-110 transition duration-300">${p.emoji || '🛍️'}</div>`;

      return `
        <div class="group bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-2.5 sm:p-4 flex flex-col justify-between shadow-xs hover:shadow-lg transition duration-200 hover:-translate-y-1">
          <div>
            <!-- Image Wrap -->
            <div class="relative w-full h-32 sm:h-44 rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center mb-2 sm:mb-3">
              ${imageHtml}
              <div class="absolute top-1.5 left-1.5 sm:top-2 sm:left-2">
                <span class="px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-bold text-white shadow-xs backdrop-blur-md" style="background-color: ${p.categoryColor || '#f97316'}">
                  ${p.category || 'Menu'}
                </span>
              </div>
            </div>

            <!-- Title & Details -->
            <div class="flex items-start justify-between gap-1 mb-1">
              <h3 class="font-bold text-slate-900 text-xs sm:text-base leading-snug line-clamp-2">${p.name}</h3>
            </div>
            
            <div class="flex items-center justify-between gap-1 mb-2 sm:mb-3">
              <span class="text-[11px] sm:text-xs text-slate-500 font-medium">per ${p.unit || 'Pcs'}</span>
              ${stockBadge}
            </div>
          </div>

          <!-- Price & Add to Cart / Stepper Action -->
          <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 sm:gap-2">
            <div>
              <p class="text-[9px] sm:text-[10px] text-slate-400 font-medium uppercase tracking-wider">Harga</p>
              <p class="text-xs sm:text-base font-extrabold text-orange-600">${formatRp(p.price)}</p>
            </div>

            ${(() => {
              if (!isAvailable) {
                return `<button type="button" class="bg-slate-100 text-slate-400 cursor-not-allowed px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold" disabled>Habis</button>`;
              }
              const inCart = cart.find((it) => it.id === p.id);
              if (inCart && inCart.qty > 0) {
                return `
                  <div class="flex items-center gap-1 bg-orange-50 px-1.5 py-1 rounded-xl border border-orange-200 shadow-2xs">
                    <button type="button" class="btn-card-minus text-orange-700 hover:bg-white p-1 rounded-lg transition active:scale-95" data-id="${p.id}" title="Kurangi">
                      <i data-lucide="minus" class="w-3.5 h-3.5"></i>
                    </button>
                    <span class="w-5 text-center text-xs font-black text-orange-900">${inCart.qty}</span>
                    <button type="button" class="btn-card-plus text-orange-700 hover:bg-white p-1 rounded-lg transition active:scale-95" data-id="${p.id}" title="Tambah">
                      <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                `;
              }
              return `
                <button type="button" class="btn-add-cart bg-orange-500 hover:bg-orange-600 text-white shadow-sm shadow-orange-500/25 active:scale-95 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 sm:gap-1.5" data-id="${p.id}">
                  <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                  <span class="hidden sm:inline">Pesan</span>
                </button>
              `;
            })()}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();

    // Attach click events to "Pesan" - Menampilkan pilihan 2 opsi
    grid.querySelectorAll('.btn-add-cart').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const prod = allProducts.find((x) => x.id === id);
        if (prod) {
          openProductOptionModal(prod);
        }
      });
    });

    // Attach inline stepper clicks for quick multi-item ordering on the catalog
    grid.querySelectorAll('.btn-card-minus').forEach((btn) => {
      btn.addEventListener('click', () => {
        updateCartQty(btn.dataset.id, -1);
      });
    });

    grid.querySelectorAll('.btn-card-plus').forEach((btn) => {
      btn.addEventListener('click', () => {
        updateCartQty(btn.dataset.id, 1);
      });
    });
  }

  // ------------------------- 2B. PRODUCT OPTION MODAL (2 OPSI PESANAN) -------------------------
  let selectedOptionProduct = null;
  let selectedOptionQty = 1;

  function updateOptionSubtotal() {
    const qtyEl = document.getElementById('opt-qty-value');
    const subtotalEl = document.getElementById('opt-subtotal');
    if (qtyEl) qtyEl.textContent = selectedOptionQty;
    if (subtotalEl && selectedOptionProduct) {
      const subtotal = selectedOptionProduct.price * selectedOptionQty;
      subtotalEl.textContent = `Total: ${formatRp(subtotal)}`;
    }
  }

  function openProductOptionModal(product) {
    selectedOptionProduct = product;
    selectedOptionQty = 1;

    const modal = document.getElementById('product-option-modal');
    const imgWrap = document.getElementById('opt-product-img-wrap');
    const nameEl = document.getElementById('opt-product-name');
    const catEl = document.getElementById('opt-product-category');
    const priceEl = document.getElementById('opt-product-price');

    if (!modal) return;

    if (nameEl) nameEl.textContent = product.name;
    if (catEl) {
      catEl.textContent = product.category || 'Menu';
      catEl.style.backgroundColor = product.categoryColor || '#f97316';
    }
    if (priceEl) priceEl.textContent = `${formatRp(product.price)} / ${product.unit || 'Pcs'}`;

    if (imgWrap) {
      if (product.image) {
        imgWrap.innerHTML = `<img src="${product.image}" alt="${product.name}" class="w-full h-full object-cover" onerror="this.onerror=null;this.parentElement.innerHTML='<span class=\\'text-3xl\\'>${product.emoji || '🛍️'}</span>';" />`;
      } else {
        imgWrap.innerHTML = `<span class="text-3xl">${product.emoji || '🛍️'}</span>`;
      }
    }

    updateOptionSubtotal();
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  function closeProductOptionModal() {
    const modal = document.getElementById('product-option-modal');
    if (modal) modal.classList.add('hidden');
    selectedOptionProduct = null;
    selectedOptionQty = 1;
  }

  // ------------------------- 2C. MULTI-ORDER (PESAN BEBERAPA MENU SEKALIGUS) -------------------------
  let multiOrderSelections = {}; // { [productId]: qty }
  let multiOrderFilterQuery = '';

  function openMultiOrderModal() {
    const modal = document.getElementById('multi-order-modal');
    if (!modal) return;

    // Inisialisasi pilihan menu dari keranjang saat ini atau menu yang tersedia
    multiOrderSelections = {};
    cart.forEach((it) => {
      multiOrderSelections[it.id] = it.qty;
    });

    multiOrderFilterQuery = '';
    const searchInput = document.getElementById('multi-order-search');
    if (searchInput) searchInput.value = '';

    renderMultiOrderList();
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  function closeMultiOrderModal() {
    const modal = document.getElementById('multi-order-modal');
    if (modal) modal.classList.add('hidden');
  }

  function renderMultiOrderList() {
    const container = document.getElementById('multi-order-items-list');
    if (!container) return;

    const q = (multiOrderFilterQuery || '').toLowerCase().trim();
    let items = allProducts.filter((p) => p.inStock && p.stock > 0);
    if (q) {
      items = items.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="text-center py-10 px-4">
          <div class="text-3xl mb-2">🔍</div>
          <p class="font-bold text-xs text-slate-700">Tidak ada menu yang sesuai</p>
          <p class="text-[11px] text-slate-400 mt-0.5">Coba gunakan kata kunci pencarian yang lain.</p>
        </div>
      `;
      updateMultiOrderSummary();
      return;
    }

    container.innerHTML = items.map((p) => {
      const qty = multiOrderSelections[p.id] || 0;
      const isSelected = qty > 0;
      const imageHtml = p.image 
        ? `<img src="${p.image}" alt="${p.name}" class="w-full h-full object-cover" onerror="this.onerror=null;this.parentElement.innerHTML='<span class=\\'text-xl\\'>${p.emoji || '🛍️'}</span>';" />`
        : `<span class="text-xl">${p.emoji || '🛍️'}</span>`;

      return `
        <div class="pt-2.5 first:pt-0 flex items-center justify-between gap-3 group transition rounded-2xl ${isSelected ? 'bg-orange-50/70 p-2 border border-orange-200/80 shadow-2xs' : 'p-1.5'}">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <input type="checkbox" class="multi-check w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 cursor-pointer shrink-0" data-id="${p.id}" ${isSelected ? 'checked' : ''} />
            <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-100 shadow-2xs">
              ${imageHtml}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h4 class="font-bold text-xs sm:text-sm text-slate-900 truncate">${p.name}</h4>
                <span class="text-[9px] font-bold px-1.5 py-0.2 rounded text-white" style="background-color: ${p.categoryColor || '#f97316'}">${p.category || 'Menu'}</span>
              </div>
              <p class="text-xs text-orange-600 font-extrabold mt-0.5">${formatRp(p.price)} <span class="text-[10px] text-slate-400 font-normal">/${p.unit || 'Pcs'}</span></p>
            </div>
          </div>

          <div class="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-2xs shrink-0">
            <button type="button" class="btn-multi-minus text-slate-500 hover:text-slate-800 p-0.5 rounded transition" data-id="${p.id}" title="Kurangi porsi">
              <i data-lucide="minus" class="w-3.5 h-3.5"></i>
            </button>
            <span class="w-6 text-center text-xs font-black text-slate-900">${qty}</span>
            <button type="button" class="btn-multi-plus text-slate-500 hover:text-slate-800 p-0.5 rounded transition" data-id="${p.id}" title="Tambah porsi">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();

    // Checkbox toggles
    container.querySelectorAll('.multi-check').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.id;
        if (cb.checked) {
          multiOrderSelections[id] = Math.max(1, multiOrderSelections[id] || 1);
        } else {
          delete multiOrderSelections[id];
        }
        renderMultiOrderList();
      });
    });

    // Stepper minus
    container.querySelectorAll('.btn-multi-minus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const current = multiOrderSelections[id] || 0;
        if (current > 1) {
          multiOrderSelections[id] = current - 1;
        } else {
          delete multiOrderSelections[id];
        }
        renderMultiOrderList();
      });
    });

    // Stepper plus
    container.querySelectorAll('.btn-multi-plus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const current = multiOrderSelections[id] || 0;
        multiOrderSelections[id] = current + 1;
        renderMultiOrderList();
      });
    });

    updateMultiOrderSummary();
  }

  function updateMultiOrderSummary() {
    const countEl = document.getElementById('multi-summary-count');
    const totalEl = document.getElementById('multi-summary-total');

    const keys = Object.keys(multiOrderSelections).filter((id) => (multiOrderSelections[id] || 0) > 0);
    const menuCount = keys.length;
    let totalItems = 0;
    let totalPrice = 0;

    keys.forEach((id) => {
      const qty = multiOrderSelections[id];
      const prod = allProducts.find((p) => p.id === id);
      if (prod && qty > 0) {
        totalItems += qty;
        totalPrice += prod.price * qty;
      }
    });

    if (countEl) countEl.textContent = `${menuCount} Menu Dipilih (${totalItems} Porsi)`;
    if (totalEl) totalEl.textContent = formatRp(totalPrice);
  }

  function applyMultiOrderToCart(openDrawer = false) {
    const keys = Object.keys(multiOrderSelections).filter((id) => (multiOrderSelections[id] || 0) > 0);
    if (keys.length === 0) {
      alert('Silakan pilih dan beri jumlah minimal 1 menu cemilan atau minuman.');
      return;
    }

    keys.forEach((id) => {
      const prod = allProducts.find((p) => p.id === id);
      const qty = multiOrderSelections[id];
      if (prod && qty > 0) {
        const existing = cart.find((it) => it.id === prod.id);
        if (existing) {
          existing.qty = qty;
        } else {
          cart.push({
            id: prod.id,
            name: prod.name,
            price: prod.price,
            emoji: prod.emoji || '🛍️',
            image: prod.image || '',
            unit: prod.unit || 'Pcs',
            qty: qty,
          });
        }
      }
    });

    saveCartToStorage();
    renderCart();
    filterAndRenderProducts();
    closeMultiOrderModal();

    if (openDrawer) {
      toggleCart(true);
      showToast(`🛒 ${keys.length} menu siap dipesan, silakan lengkapi pesanan!`);
    } else {
      showToast(`✓ Berhasil memasukkan ${keys.length} menu ke keranjang`);
    }
  }

  // ------------------------- 3. CART SYSTEM -------------------------
  function loadCartFromStorage() {
    try {
      const stored = localStorage.getItem('warung_public_cart');
      if (stored) cart = JSON.parse(stored);
    } catch (e) {}
    renderCart();
  }

  function saveCartToStorage() {
    try {
      localStorage.setItem('warung_public_cart', JSON.stringify(cart));
    } catch (e) {}
  }

  function addToCart(product, qty = 1, showFeedback = true) {
    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    const existing = cart.find((it) => it.id === product.id);
    if (existing) {
      existing.qty += quantity;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        emoji: product.emoji || '🛍️',
        image: product.image || '',
        unit: product.unit || 'Pcs',
        qty: quantity,
      });
    }
    saveCartToStorage();
    renderCart();
    filterAndRenderProducts();
    if (showFeedback) {
      showToast(`✓ "${product.name}" (${quantity} ${product.unit || 'item'}) masuk keranjang`);
    }
  }

  function updateCartQty(id, delta) {
    const item = cart.find((it) => it.id === id);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter((it) => it.id !== id);
    }
    saveCartToStorage();
    renderCart();
    filterAndRenderProducts();
  }

  function renderCart() {
    const badge = document.getElementById('cart-badge');
    const drawerCount = document.getElementById('cart-drawer-count');
    const container = document.getElementById('cart-items-container');
    const summaryItems = document.getElementById('cart-summary-items');
    const summaryTotal = document.getElementById('cart-summary-total');
    const mobileCartBar = document.getElementById('mobile-cart-bar');
    const mobileCartCount = document.getElementById('mobile-cart-count');
    const mobileCartTotal = document.getElementById('mobile-cart-total');

    const totalQty = cart.reduce((acc, it) => acc + it.qty, 0);
    const totalPrice = cart.reduce((acc, it) => acc + (it.price * it.qty), 0);

    if (badge) badge.textContent = totalQty;
    if (drawerCount) drawerCount.textContent = `${totalQty} item dipilih`;
    if (summaryItems) summaryItems.textContent = `${totalQty} item`;
    if (summaryTotal) summaryTotal.textContent = formatRp(totalPrice);

    // Update floating mobile cart bar
    if (mobileCartCount) mobileCartCount.textContent = totalQty;
    if (mobileCartTotal) mobileCartTotal.textContent = formatRp(totalPrice);
    if (mobileCartBar) {
      if (totalQty > 0) {
        mobileCartBar.classList.remove('hidden');
      } else {
        mobileCartBar.classList.add('hidden');
      }
    }

    if (!container) return;

    if (cart.length === 0) {
      container.innerHTML = `
        <div class="text-center py-16 px-4">
          <div class="w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center text-3xl mx-auto mb-3">
            🛒
          </div>
          <h4 class="font-bold text-sm text-slate-800">Keranjang Masih Kosong</h4>
          <p class="text-xs text-slate-400 mt-1">Silakan pilih makanan atau minuman dari katalog untuk memesan.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = cart.map((it) => `
      <div class="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl shrink-0 shadow-xs border border-slate-100">
            ${it.emoji || '🛍️'}
          </div>
          <div>
            <h5 class="text-xs font-bold text-slate-900 leading-tight">${it.name}</h5>
            <p class="text-xs text-orange-600 font-extrabold mt-0.5">${formatRp(it.price)} <span class="text-[10px] text-slate-400 font-normal">/${it.unit}</span></p>
          </div>
        </div>

        <div class="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-2xs">
          <button type="button" class="btn-qty-minus text-slate-500 hover:text-slate-800 p-0.5 rounded transition" data-id="${it.id}">
            <i data-lucide="minus" class="w-3.5 h-3.5"></i>
          </button>
          <span class="w-6 text-center text-xs font-bold text-slate-800">${it.qty}</span>
          <button type="button" class="btn-qty-plus text-slate-500 hover:text-slate-800 p-0.5 rounded transition" data-id="${it.id}">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();

    container.querySelectorAll('.btn-qty-minus').forEach((btn) => {
      btn.addEventListener('click', () => updateCartQty(btn.dataset.id, -1));
    });

    container.querySelectorAll('.btn-qty-plus').forEach((btn) => {
      btn.addEventListener('click', () => updateCartQty(btn.dataset.id, 1));
    });
  }

  function toggleCart(open) {
    const overlay = document.getElementById('cart-drawer-overlay');
    const drawer = document.getElementById('cart-drawer');
    if (!overlay || !drawer) return;

    if (open) {
      overlay.classList.remove('hidden');
      setTimeout(() => {
        drawer.classList.remove('translate-x-full');
      }, 10);
    } else {
      drawer.classList.add('translate-x-full');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 300);
    }
  }

  // ------------------------- 4. DIRECT WEB ORDERING & SHARE LOCATION -------------------------
  let addressInputMode = 'manual'; // 'manual' | 'gps'
  let gpsLocationData = null; // { lat, lng, accuracy, mapsUrl, detectedAddress }

  function switchAddressTab(mode) {
    addressInputMode = mode;
    const tabManual = document.getElementById('tab-addr-manual');
    const tabGps = document.getElementById('tab-addr-gps');
    const panelManual = document.getElementById('addr-manual-panel');
    const panelGps = document.getElementById('addr-gps-panel');

    if (mode === 'manual') {
      if (tabManual) {
        tabManual.classList.add('bg-orange-500', 'text-white', 'shadow-xs');
        tabManual.classList.remove('text-slate-600');
      }
      if (tabGps) {
        tabGps.classList.remove('bg-orange-500', 'text-white', 'shadow-xs');
        tabGps.classList.add('text-slate-600');
      }
      if (panelManual) panelManual.classList.remove('hidden');
      if (panelGps) panelGps.classList.add('hidden');
    } else {
      if (tabGps) {
        tabGps.classList.add('bg-orange-500', 'text-white', 'shadow-xs');
        tabGps.classList.remove('text-slate-600');
      }
      if (tabManual) {
        tabManual.classList.remove('bg-orange-500', 'text-white', 'shadow-xs');
        tabManual.classList.add('text-slate-600');
      }
      if (panelGps) panelGps.classList.remove('hidden');
      if (panelManual) panelManual.classList.add('hidden');
    }
  }

  function fetchGPSLocation() {
    if (!navigator.geolocation) {
      alert('Browser Anda tidak mendukung fitur deteksi lokasi (GPS). Silakan gunakan opsi Ketik Manual.');
      switchAddressTab('manual');
      return;
    }

    const btnText = document.getElementById('btn-gps-text');
    const statusBox = document.getElementById('gps-status-box');
    const coordsText = document.getElementById('gps-coords-text');
    const previewLink = document.getElementById('gps-preview-link');
    const detectedAddressEl = document.getElementById('gps-address-detected');

    if (btnText) btnText.textContent = 'Mendeteksi titik koordinat GPS...';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const acc = Math.round(pos.coords.accuracy);
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

        gpsLocationData = {
          lat,
          lng,
          accuracy: acc,
          mapsUrl,
          detectedAddress: '',
        };

        if (btnText) btnText.textContent = '📍 Perbarui Titik Lokasi Saya';
        if (statusBox) statusBox.classList.remove('hidden');
        if (coordsText) coordsText.textContent = `Koordinat: ${lat}, ${lng} (Akurasi: ±${acc}m)`;
        if (previewLink) previewLink.href = mapsUrl;

        showToast('✓ Titik lokasi GPS berhasil diperoleh!');

        // Coba reverse geocoding via OpenStreetMap Nominatim
        try {
          const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
            headers: { 'Accept': 'application/json' }
          });
          if (revRes.ok) {
            const revData = await revRes.json();
            if (revData && revData.display_name) {
              gpsLocationData.detectedAddress = revData.display_name;
              if (detectedAddressEl) {
                detectedAddressEl.classList.remove('hidden');
                detectedAddressEl.innerHTML = `<span class="font-bold text-slate-800">Alamat Terdeteksi:</span> ${revData.display_name}`;
              }
            }
          }
        } catch (e) {}

        if (window.lucide) lucide.createIcons();
      },
      (err) => {
        let errMsg = 'Gagal mengakses GPS.';
        if (err.code === 1) errMsg = 'Izin lokasi ditolak. Silakan izinkan akses lokasi di browser atau gunakan Ketik Manual.';
        else if (err.code === 2) errMsg = 'Lokasi GPS tidak dapat ditemukan.';
        else if (err.code === 3) errMsg = 'Waktu deteksi GPS habis (timeout).';
        
        alert(errMsg);
        if (btnText) btnText.textContent = 'Ambil Titik Lokasi Saya (GPS)';
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  function getFinalDeliveryAddress(deliveryMethod) {
    if (deliveryMethod !== 'Antar / Kirim') return '';

    if (addressInputMode === 'manual') {
      const addrInput = document.getElementById('order-customer-address');
      const addr = (addrInput ? addrInput.value : '').trim();
      if (!addr || addr.length < 5) {
        alert('Mohon ketikkan alamat lengkap pengantaran (minimal 5 karakter).');
        if (addrInput) addrInput.focus();
        return null;
      }
      return addr;
    } else {
      // GPS Mode
      if (!gpsLocationData || !gpsLocationData.mapsUrl) {
        alert('Silakan klik tombol "Ambil Titik Lokasi Saya (GPS)" terlebih dahulu, atau beralih ke tab "Ketik Manual".');
        const btnGps = document.getElementById('btn-get-gps');
        if (btnGps) btnGps.focus();
        return null;
      }

      const notesInput = document.getElementById('order-gps-notes');
      const notes = (notesInput ? notesInput.value : '').trim();
      
      let resultText = '';
      if (gpsLocationData.detectedAddress) {
        resultText = notes ? `${notes}, ${gpsLocationData.detectedAddress}` : gpsLocationData.detectedAddress;
      } else {
        resultText = notes ? `${notes} (Lokasi GPS)` : 'Lokasi Terpilih via GPS';
      }

      return `${resultText} (Titik GPS: ${gpsLocationData.mapsUrl})`;
    }
  }

  function submitOrderToWhatsApp() {
    if (cart.length === 0) {
      alert('Keranjang pesanan Anda masih kosong.');
      return;
    }

    const nameInput = document.getElementById('order-customer-name');
    const name = (nameInput ? nameInput.value : '').trim();
    if (!name) {
      alert('Mohon masukkan nama pemesan terlebih dahulu.');
      if (nameInput) nameInput.focus();
      return;
    }

    const phoneInput = document.getElementById('order-customer-phone');
    const phone = (phoneInput ? phoneInput.value : '').trim();

    const methodInput = document.querySelector('input[name="order-method"]:checked');
    const method = methodInput ? methodInput.value : 'Ambil di Warung';

    const address = getFinalDeliveryAddress(method);
    if (method === 'Antar / Kirim' && address === null) {
      return; // Validation failed
    }

    const paymentInput = document.querySelector('input[name="order-payment"]:checked');
    const payment = paymentInput ? paymentInput.value : 'QRIS';

    const notesInput = document.getElementById('order-customer-notes');
    const notes = (notesInput ? notesInput.value : '').trim();

    const totalQty = cart.reduce((acc, it) => acc + it.qty, 0);
    const totalPrice = cart.reduce((acc, it) => acc + (it.price * it.qty), 0);

    let msg = `Halo ${storeInfo.storeName || 'Warung Cemilan'}! Saya ingin memesan:\n\n`;
    cart.forEach((it, idx) => {
      msg += `${idx + 1}. ${it.name} (${it.qty}x) = ${formatRp(it.price * it.qty)}\n`;
    });
    msg += `\n*Total Item:* ${totalQty} item\n`;
    msg += `*Total Pembayaran:* ${formatRp(totalPrice)}\n\n`;
    msg += `*Nama Pemesan:* ${name}\n`;
    if (phone) msg += `*No. HP/WA:* ${phone}\n`;
    msg += `*Metode Transaksi:* ${method}\n`;
    if (method === 'Antar / Kirim' && address) {
      msg += `*Alamat / Titik Pengantaran:* ${address}\n`;
    }
    msg += `*Metode Pembayaran:* ${payment}\n`;
    if (notes) {
      msg += `*Catatan Khusus:* ${notes}\n`;
    }
    msg += `\nMohon konfirmasi pesanan saya. Terima kasih!`;

    const targetPhone = cleanPhone(storeInfo.phone);
    const url = `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  async function submitWebOrder() {
    if (cart.length === 0) {
      showToast('Keranjang pesanan masih kosong.', false);
      return;
    }

    const nameInput = document.getElementById('order-customer-name');
    const name = (nameInput ? nameInput.value : '').trim();
    if (!name || name.length < 2) {
      alert('Mohon masukkan nama pemesan (minimal 2 karakter).');
      if (nameInput) nameInput.focus();
      return;
    }

    const phoneInput = document.getElementById('order-customer-phone');
    const phone = (phoneInput ? phoneInput.value : '').trim();
    if (!phone || phone.length < 8) {
      alert('Mohon masukkan nomor WhatsApp / HP yang valid (minimal 8 angka).');
      if (phoneInput) phoneInput.focus();
      return;
    }

    const methodInput = document.querySelector('input[name="order-method"]:checked');
    const method = methodInput ? methodInput.value : 'Ambil di Warung';

    const address = getFinalDeliveryAddress(method);
    if (method === 'Antar / Kirim' && address === null) {
      return; // Validation failed
    }

    const paymentInput = document.querySelector('input[name="order-payment"]:checked');
    const paymentMethod = paymentInput ? paymentInput.value : 'QRIS';

    const notesInput = document.getElementById('order-customer-notes');
    const notes = (notesInput ? notesInput.value : '').trim();

    const items = cart.map((it) => ({
      productId: it.id,
      qty: it.qty,
    }));

    const btnSubmit = document.getElementById('btn-submit-web-order');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Memproses Pesanan...</span>';
      if (window.lucide) lucide.createIcons();
    }

    try {
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          deliveryMethod: method,
          address,
          paymentMethod,
          notes,
          items,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat pesanan.');
      }

      // Order created successfully!
      const order = data.order;

      // Empty cart
      cart = [];
      saveCartToStorage();
      renderCart();
      toggleCart(false);

      // Open Success / Digital Receipt Modal
      showReceiptModal(order);

      // Refresh products to update stock badges
      loadProducts();
    } catch (err) {
      alert('Gagal membuat pesanan: ' + err.message);
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i data-lucide="check-circle-2" class="w-4 h-4"></i><span>Pesan Langsung di Web</span>';
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  let currentReceiptOrder = null;

  function showReceiptModal(order) {
    currentReceiptOrder = order;
    const modal = document.getElementById('order-success-modal');
    if (!modal) return;

    const idEl = document.getElementById('receipt-order-id');
    const nameEl = document.getElementById('receipt-customer-name');
    const methodEl = document.getElementById('receipt-delivery-method');
    const rowAddress = document.getElementById('receipt-row-address');
    const addressEl = document.getElementById('receipt-address');
    const paymentEl = document.getElementById('receipt-payment-method');
    const itemsEl = document.getElementById('receipt-items-list');
    const totalEl = document.getElementById('receipt-total');
    const guideText = document.getElementById('receipt-guide-text');
    const btnWaConfirm = document.getElementById('btn-receipt-wa-confirm');

    if (idEl) idEl.textContent = order.id;
    if (nameEl) nameEl.textContent = order.customerName || '-';
    if (methodEl) methodEl.textContent = order.deliveryMethod || 'Ambil di Warung';

    if (order.deliveryMethod === 'Antar / Kirim' && order.address) {
      if (rowAddress) rowAddress.classList.remove('hidden');
      if (addressEl) {
        if (order.address.includes('http')) {
          const m = order.address.match(/(https?:\/\/[^\s)]+)/);
          if (m) {
            const cleanText = order.address.replace(m[0], '').replace(/\(Titik GPS:\s*\)/g, '').trim();
            addressEl.innerHTML = `
              <div class="text-slate-800">${cleanText || 'Lokasi Titik GPS'}</div>
              <a href="${m[0]}" target="_blank" class="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:underline mt-0.5">
                <i data-lucide="map-pin" class="w-3 h-3 text-orange-500"></i> Buka Titik di Google Maps ↗
              </a>
            `;
            if (window.lucide) lucide.createIcons();
          } else {
            addressEl.textContent = order.address;
          }
        } else {
          addressEl.textContent = order.address;
        }
      }
    } else {
      if (rowAddress) rowAddress.classList.add('hidden');
    }

    if (paymentEl) paymentEl.textContent = order.paymentMethod || 'QRIS';
    if (totalEl) totalEl.textContent = formatRp(order.total);

    if (itemsEl) {
      itemsEl.innerHTML = (order.items || []).map((it) => `
        <div class="flex items-center justify-between py-1 border-b border-slate-50 last:border-0 text-slate-700">
          <div class="flex items-center gap-1.5">
            <span>${it.productEmoji || '🛍️'}</span>
            <span class="font-medium">${it.productName} <span class="text-slate-400 font-normal">x${it.qty}</span></span>
          </div>
          <span class="font-semibold text-slate-800">${formatRp(it.total)}</span>
        </div>
      `).join('');
    }

    if (guideText) {
      if (order.paymentMethod === 'QRIS') {
        guideText.textContent = `Silakan lakukan pembayaran QRIS sebesar ${formatRp(order.total)}. Anda dapat meminta barcode QRIS via WhatsApp kasir atau scan langsung di warung kami.`;
      } else if (order.paymentMethod === 'Transfer') {
        guideText.textContent = `Silakan transfer sejumlah ${formatRp(order.total)} ke rekening warung kami, lalu konfirmasikan bukti transfer ke WhatsApp kasir.`;
      } else {
        guideText.textContent = `Pesanan Anda segera disiapkan oleh tim dapur! Pembayaran tunai sebesar ${formatRp(order.total)} dapat dibayarkan langsung di meja kasir saat pengambilan.`;
      }
    }

    if (btnWaConfirm) {
      const waMsg = `Halo ${storeInfo.storeName || 'Warung Cemilan'}! Saya sudah memesan langsung di web dengan *No. Pesanan: ${order.id}* atas nama *${order.customerName}* (Total: ${formatRp(order.total)}, Metode: ${order.deliveryMethod}). Mohon segera diproses ya. Terima kasih!`;
      const targetPhone = cleanPhone(storeInfo.phone);
      btnWaConfirm.href = `https://wa.me/${targetPhone}?text=${encodeURIComponent(waMsg)}`;
    }

    modal.classList.remove('hidden');
  }

  function printReceipt() {
    if (!currentReceiptOrder) return;
    const o = currentReceiptOrder;
    const w = window.open('', '_blank');
    if (!w) {
      alert('Izinkan popup untuk mencetak nota.');
      return;
    }

    const itemsHtml = (o.items || []).map((it) => `
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span>${it.qty}x ${it.productName}</span>
        <span>${formatRp(it.total)}</span>
      </div>
    `).join('');

    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Nota Pesanan - ${o.id}</title>
        <style>
          body { font-family: monospace; max-width: 300px; margin: 20px auto; padding: 10px; font-size: 13px; color: #111; }
          .center { text-align: center; }
          .line { border-top: 1px dashed #444; margin: 10px 0; }
          .bold { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size:16px;">${storeInfo.storeName || 'Warung Cemilan'}</div>
        <div class="center" style="font-size:11px; margin-top:2px;">${storeInfo.address || 'Bandung'}</div>
        <div class="center" style="font-size:11px;">WA: ${storeInfo.phone || ''}</div>
        <div class="line"></div>
        <div>No. Pesanan: <span class="bold">${o.id}</span></div>
        <div>Tanggal: ${new Date(o.createdAt || Date.now()).toLocaleString('id-ID')}</div>
        <div>Pemesan: ${o.customerName}</div>
        <div>Metode: ${o.deliveryMethod}</div>
        <div>Bayar: ${o.paymentMethod}</div>
        <div class="line"></div>
        ${itemsHtml}
        <div class="line"></div>
        <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:15px;">
          <span>TOTAL:</span>
          <span>${formatRp(o.total)}</span>
        </div>
        <div class="line"></div>
        <div class="center" style="font-size:11px; margin-top:12px;">Terima kasih atas pesanan Anda!</div>
        <script>window.onload = function() { window.print(); };<\/script>
      </body>
      </html>
    `);
    w.document.close();
  }

  // ------------------------- 5. TRACK ORDER -------------------------
  async function trackOrder() {
    const input = document.getElementById('track-input-id');
    const resultBox = document.getElementById('track-result');
    const btn = document.getElementById('btn-submit-track');
    if (!input || !resultBox) return;

    const id = input.value.trim();
    if (!id) {
      alert('Masukkan nomor pesanan terlebih dahulu.');
      input.focus();
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Mencari...';
    }

    try {
      const res = await fetch(`/api/public/orders/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Pesanan tidak ditemukan.');
      }

      const o = data.order;
      resultBox.classList.remove('hidden');
      resultBox.innerHTML = `
        <div class="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <span class="font-bold text-slate-800 text-sm">${o.id}</span>
            <p class="text-[11px] text-slate-500">${new Date(o.createdAt).toLocaleString('id-ID')}</p>
          </div>
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            ${o.status || 'Pesanan Diterima'}
          </span>
        </div>

        <div class="space-y-1 text-slate-600">
          <p><strong>Pemesan:</strong> ${o.customerName}</p>
          <p><strong>Pengambilan:</strong> ${o.deliveryMethod}</p>
          <p><strong>Pembayaran:</strong> ${o.paymentMethod}</p>
          <div class="mt-2 pt-2 border-t border-slate-100 font-bold text-slate-900 flex justify-between">
            <span>Total Tagihan:</span>
            <span class="text-orange-600">${formatRp(o.total)}</span>
          </div>
        </div>
      `;
    } catch (err) {
      resultBox.classList.remove('hidden');
      resultBox.innerHTML = `
        <div class="p-3 bg-rose-50 text-rose-700 rounded-xl text-center">
          <p class="font-bold">Pesanan Tidak Ditemukan</p>
          <p class="text-[11px] mt-0.5">Pastikan nomor pesanan benar (contoh: ${o ? o.id : 'INV1600'}).</p>
        </div>
      `;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Cari';
      }
    }
  }

  // ------------------------- 4. REVIEWS SYSTEM -------------------------
  async function loadReviews() {
    try {
      const res = await fetch('/api/public/reviews');
      if (res.ok) {
        const data = await res.json();
        renderReviews(data.reviews || [], data.stats || {});
      }
    } catch (e) {
      console.warn('Gagal memuat ulasan:', e);
    }
  }

  function renderReviews(reviews, stats) {
    const avgScoreEl = document.getElementById('review-avg-score');
    const totalCountEl = document.getElementById('review-total-count');
    const navReviewBadge = document.getElementById('nav-review-badge');
    const listEl = document.getElementById('reviews-list');

    const avg = stats.average !== undefined ? stats.average : 5.0;
    const total = stats.total !== undefined ? stats.total : reviews.length;

    if (avgScoreEl) avgScoreEl.textContent = avg.toFixed(1);
    if (totalCountEl) totalCountEl.textContent = total;
    if (navReviewBadge) navReviewBadge.textContent = `${avg.toFixed(1)} ★`;

    // Distribution Bars
    const counts = stats.counts || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (let star = 1; star <= 5; star++) {
      const c = counts[star] || 0;
      const pct = total > 0 ? Math.round((c / total) * 100) : 0;
      const bar = document.getElementById(`bar-star-${star}`);
      const txt = document.getElementById(`count-star-${star}`);
      if (bar) bar.style.width = `${pct}%`;
      if (txt) txt.textContent = c;
    }

    if (!listEl) return;

    if (reviews.length === 0) {
      listEl.innerHTML = `
        <div class="col-span-full text-center py-10 bg-white rounded-3xl border border-slate-200">
          <p class="text-sm font-semibold text-slate-600">Belum ada ulasan untuk toko.</p>
          <p class="text-xs text-slate-400 mt-1">Jadilah yang pertama memberikan ulasan & testimoni!</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = reviews.map((r) => {
      const initial = (r.name || 'P').charAt(0).toUpperCase();
      const starsStr = '★'.repeat(Math.min(5, Math.max(1, r.rating || 5)));
      const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Baru saja';

      return `
        <div class="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition">
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 text-white font-black flex items-center justify-center text-sm shadow-xs">
                  ${initial}
                </div>
                <div>
                  <h4 class="font-bold text-sm text-slate-900">${r.name}</h4>
                  <div class="flex items-center gap-1.5 text-xs">
                    <span class="text-amber-500 tracking-wider">${starsStr}</span>
                    <span class="text-slate-400">• ${dateStr}</span>
                  </div>
                </div>
              </div>
              <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                <i data-lucide="check" class="w-3 h-3 text-emerald-600"></i> Pelanggan
              </span>
            </div>

            <p class="text-xs sm:text-sm text-slate-600 leading-relaxed italic">
              "${r.comment}"
            </p>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  function initStarPicker() {
    const starPicker = document.getElementById('star-picker');
    const starLabel = document.getElementById('star-label');
    const ratingInput = document.getElementById('review-rating-value');
    if (!starPicker) return;

    const stars = starPicker.querySelectorAll('span');

    function updateStarsDisplay(score) {
      stars.forEach((s) => {
        const val = parseInt(s.dataset.star, 10);
        if (val <= score) {
          s.classList.add('text-amber-400');
          s.classList.remove('text-slate-300');
        } else {
          s.classList.add('text-slate-300');
          s.classList.remove('text-amber-400');
        }
      });
      if (starLabel) starLabel.textContent = RATING_LABELS[score] || `${score} Bintang`;
      if (ratingInput) ratingInput.value = score;
    }

    stars.forEach((s) => {
      s.addEventListener('mouseenter', () => {
        const hoverVal = parseInt(s.dataset.star, 10);
        updateStarsDisplay(hoverVal);
      });
      s.addEventListener('click', () => {
        selectedRating = parseInt(s.dataset.star, 10);
        updateStarsDisplay(selectedRating);
      });
    });

    starPicker.addEventListener('mouseleave', () => {
      updateStarsDisplay(selectedRating);
    });

    updateStarsDisplay(selectedRating);
  }

  async function submitReview(e) {
    e.preventDefault();
    const nameEl = document.getElementById('review-name');
    const commentEl = document.getElementById('review-comment');
    const ratingEl = document.getElementById('review-rating-value');
    const errorEl = document.getElementById('review-error');
    const btnSubmit = document.getElementById('btn-submit-review');

    if (errorEl) errorEl.classList.add('hidden');

    const name = (nameEl ? nameEl.value : '').trim();
    const comment = (commentEl ? commentEl.value : '').trim();
    const rating = parseInt(ratingEl ? ratingEl.value : '5', 10);

    if (!name || name.length < 2) {
      if (errorEl) {
        errorEl.textContent = 'Nama minimal 2 karakter.';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    if (!comment || comment.length < 3) {
      if (errorEl) {
        errorEl.textContent = 'Silakan tulis ulasan minimal 3 karakter.';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.classList.add('opacity-70');
    }

    try {
      const res = await fetch('/api/public/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, comment, rating }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim ulasan.');
      }

      // Close modal
      toggleReviewModal(false);
      if (nameEl) nameEl.value = '';
      if (commentEl) commentEl.value = '';

      showToast('Terima kasih! Ulasan Anda berhasil dikirim.');
      await loadReviews();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
      }
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.classList.remove('opacity-70');
      }
    }
  }

  function toggleReviewModal(open) {
    const modal = document.getElementById('review-modal-overlay');
    if (!modal) return;
    if (open) {
      modal.classList.remove('hidden');
    } else {
      modal.classList.add('hidden');
    }
  }

  // ------------------------- 5. EVENTS & INITIALIZATION -------------------------
  document.addEventListener('DOMContentLoaded', () => {
    loadStoreInfo();
    loadCategories();
    loadProducts();
    loadReviews();
    loadCartFromStorage();
    initStarPicker();

    // Search events
    const searchInput = document.getElementById('search-input');
    const clearSearch = document.getElementById('btn-clear-search');
    const resetFilterBtn = document.getElementById('btn-reset-filter');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (clearSearch) {
          if (searchQuery.length > 0) clearSearch.classList.remove('hidden');
          else clearSearch.classList.add('hidden');
        }
        filterAndRenderProducts();
      });
    }

    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          searchQuery = '';
          clearSearch.classList.add('hidden');
          filterAndRenderProducts();
        }
      });
    }

    if (resetFilterBtn) {
      resetFilterBtn.addEventListener('click', () => {
        selectedCategory = 'Semua';
        searchQuery = '';
        if (searchInput) searchInput.value = '';
        if (clearSearch) clearSearch.classList.add('hidden');
        renderCategoryPills();
        filterAndRenderProducts();
      });
    }

    // Cart Drawer Toggle
    const btnOpenCart = document.getElementById('btn-open-cart');
    const btnMobileOpenCart = document.getElementById('btn-mobile-open-cart');
    const btnCloseCart = document.getElementById('btn-close-cart');
    const cartOverlay = document.getElementById('cart-drawer-overlay');
    const btnSubmitOrder = document.getElementById('btn-submit-order');
    const btnSubmitWebOrder = document.getElementById('btn-submit-web-order');

    if (btnOpenCart) btnOpenCart.addEventListener('click', () => toggleCart(true));
    if (btnMobileOpenCart) btnMobileOpenCart.addEventListener('click', () => toggleCart(true));
    if (btnCloseCart) btnCloseCart.addEventListener('click', () => toggleCart(false));
    if (cartOverlay) {
      cartOverlay.addEventListener('click', (e) => {
        if (e.target === cartOverlay) toggleCart(false);
      });
    }
    if (btnSubmitOrder) btnSubmitOrder.addEventListener('click', submitOrderToWhatsApp);
    if (btnSubmitWebOrder) btnSubmitWebOrder.addEventListener('click', submitWebOrder);

    // Toggle Delivery Address Input
    const methodRadios = document.querySelectorAll('input[name="order-method"]');
    const wrapAddress = document.getElementById('wrap-order-address');
    methodRadios.forEach((r) => {
      r.addEventListener('change', () => {
        if (wrapAddress) {
          if (r.value === 'Antar / Kirim') {
            wrapAddress.classList.remove('hidden');
          } else {
            wrapAddress.classList.add('hidden');
          }
        }
      });
    });

    // Address Tabs & Share Location GPS
    const tabAddrManual = document.getElementById('tab-addr-manual');
    const tabAddrGps = document.getElementById('tab-addr-gps');
    const btnGetGps = document.getElementById('btn-get-gps');

    if (tabAddrManual) tabAddrManual.addEventListener('click', () => switchAddressTab('manual'));
    if (tabAddrGps) tabAddrGps.addEventListener('click', () => switchAddressTab('gps'));
    if (btnGetGps) btnGetGps.addEventListener('click', fetchGPSLocation);

    // Receipt Modal Actions
    const btnCloseReceipt = document.getElementById('btn-close-receipt-modal');
    const btnDoneReceipt = document.getElementById('btn-done-receipt');
    const btnPrintReceipt = document.getElementById('btn-print-receipt');
    const btnCopyOrderId = document.getElementById('btn-copy-order-id');
    const receiptModal = document.getElementById('order-success-modal');

    function closeReceiptModal() {
      if (receiptModal) receiptModal.classList.add('hidden');
    }

    if (btnCloseReceipt) btnCloseReceipt.addEventListener('click', closeReceiptModal);
    if (btnDoneReceipt) btnDoneReceipt.addEventListener('click', closeReceiptModal);
    if (btnPrintReceipt) btnPrintReceipt.addEventListener('click', printReceipt);
    if (btnCopyOrderId) {
      btnCopyOrderId.addEventListener('click', () => {
        const idEl = document.getElementById('receipt-order-id');
        if (idEl && idEl.textContent) {
          navigator.clipboard.writeText(idEl.textContent).then(() => {
            showToast('✓ Nomor pesanan disalin ke clipboard');
          }).catch(() => {
            showToast('Nomor pesanan: ' + idEl.textContent);
          });
        }
      });
    }

    // Product Option Modal (2 Opsi: Keranjang vs Langsung Pesan)
    const btnCloseOptModal = document.getElementById('btn-close-product-option-modal');
    const optModal = document.getElementById('product-option-modal');
    const btnOptMinus = document.getElementById('btn-opt-qty-minus');
    const btnOptPlus = document.getElementById('btn-opt-qty-plus');
    const btnOptAddToCart = document.getElementById('btn-opt-add-to-cart');
    const btnOptOrderNow = document.getElementById('btn-opt-order-now');

    if (btnCloseOptModal) btnCloseOptModal.addEventListener('click', closeProductOptionModal);
    if (optModal) {
      optModal.addEventListener('click', (e) => {
        if (e.target === optModal) closeProductOptionModal();
      });
    }
    if (btnOptMinus) {
      btnOptMinus.addEventListener('click', () => {
        if (selectedOptionQty > 1) {
          selectedOptionQty -= 1;
          updateOptionSubtotal();
        }
      });
    }
    if (btnOptPlus) {
      btnOptPlus.addEventListener('click', () => {
        selectedOptionQty += 1;
        updateOptionSubtotal();
      });
    }
    if (btnOptAddToCart) {
      btnOptAddToCart.addEventListener('click', () => {
        if (selectedOptionProduct) {
          addToCart(selectedOptionProduct, selectedOptionQty, true);
          closeProductOptionModal();
        }
      });
    }
    if (btnOptOrderNow) {
      btnOptOrderNow.addEventListener('click', () => {
        if (selectedOptionProduct) {
          addToCart(selectedOptionProduct, selectedOptionQty, false);
          closeProductOptionModal();
          toggleCart(true);
          showToast(`🛒 Silakan lengkapi pesanan Anda`);
        }
      });
    }

    // Multi-Order Modal (Pesan Beberapa Menu Sekaligus)
    const btnOpenMultiOrder = document.getElementById('btn-open-multi-order');
    const btnCloseMultiOrder = document.getElementById('btn-close-multi-order');
    const multiOrderModal = document.getElementById('multi-order-modal');
    const multiOrderSearch = document.getElementById('multi-order-search');
    const btnMultiSelectAll = document.getElementById('btn-multi-select-all');
    const btnMultiClearAll = document.getElementById('btn-multi-clear-all');
    const btnMultiAddCart = document.getElementById('btn-multi-add-cart');
    const btnMultiCheckoutNow = document.getElementById('btn-multi-checkout-now');

    if (btnOpenMultiOrder) btnOpenMultiOrder.addEventListener('click', openMultiOrderModal);
    if (btnCloseMultiOrder) btnCloseMultiOrder.addEventListener('click', closeMultiOrderModal);
    if (multiOrderModal) {
      multiOrderModal.addEventListener('click', (e) => {
        if (e.target === multiOrderModal) closeMultiOrderModal();
      });
    }
    if (multiOrderSearch) {
      multiOrderSearch.addEventListener('input', (e) => {
        multiOrderFilterQuery = e.target.value;
        renderMultiOrderList();
      });
    }
    if (btnMultiSelectAll) {
      btnMultiSelectAll.addEventListener('click', () => {
        allProducts.filter((p) => p.inStock && p.stock > 0).forEach((p) => {
          if (!multiOrderSelections[p.id]) multiOrderSelections[p.id] = 1;
        });
        renderMultiOrderList();
      });
    }
    if (btnMultiClearAll) {
      btnMultiClearAll.addEventListener('click', () => {
        multiOrderSelections = {};
        renderMultiOrderList();
      });
    }
    if (btnMultiAddCart) {
      btnMultiAddCart.addEventListener('click', () => applyMultiOrderToCart(false));
    }
    if (btnMultiCheckoutNow) {
      btnMultiCheckoutNow.addEventListener('click', () => applyMultiOrderToCart(true));
    }

    // Track Order Modal
    const btnOpenTrack = document.getElementById('btn-open-track');
    const btnCloseTrack = document.getElementById('btn-close-track-modal');
    const trackModal = document.getElementById('track-order-modal');
    const btnSubmitTrack = document.getElementById('btn-submit-track');
    const trackInput = document.getElementById('track-input-id');

    function toggleTrackModal(open) {
      if (!trackModal) return;
      if (open) {
        trackModal.classList.remove('hidden');
        if (trackInput) trackInput.focus();
      } else {
        trackModal.classList.add('hidden');
      }
    }

    if (btnOpenTrack) btnOpenTrack.addEventListener('click', () => toggleTrackModal(true));
    if (btnCloseTrack) btnCloseTrack.addEventListener('click', () => toggleTrackModal(false));
    if (trackModal) {
      trackModal.addEventListener('click', (e) => {
        if (e.target === trackModal) toggleTrackModal(false);
      });
    }
    if (btnSubmitTrack) btnSubmitTrack.addEventListener('click', trackOrder);
    if (trackInput) {
      trackInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') trackOrder();
      });
    }

    // Review Modal Toggle & Form Submit
    const btnOpenReview = document.getElementById('btn-open-review-modal');
    const btnCloseReview = document.getElementById('btn-close-review-modal');
    const reviewOverlay = document.getElementById('review-modal-overlay');
    const formReview = document.getElementById('form-review');

    if (btnOpenReview) btnOpenReview.addEventListener('click', () => toggleReviewModal(true));
    if (btnCloseReview) btnCloseReview.addEventListener('click', () => toggleReviewModal(false));
    if (reviewOverlay) {
      reviewOverlay.addEventListener('click', (e) => {
        if (e.target === reviewOverlay) toggleReviewModal(false);
      });
    }
    if (formReview) formReview.addEventListener('submit', submitReview);

    // Smooth Scroll Tabs Navigation Highlight
    const navTabs = document.querySelectorAll('.nav-tab, .mobile-nav-link');
    window.addEventListener('scroll', () => {
      const scrollPos = window.scrollY + 200;
      const sections = ['katalog', 'cara-transaksi', 'ulasan'];
      let currentSec = 'katalog';

      sections.forEach((secId) => {
        const el = document.getElementById(secId);
        if (el && el.offsetTop <= scrollPos) {
          currentSec = secId;
        }
      });

      navTabs.forEach((tab) => {
        const target = tab.dataset.target;
        if (target === currentSec) {
          if (tab.classList.contains('nav-tab')) {
            tab.classList.add('bg-white', 'text-slate-900', 'font-semibold', 'shadow-sm');
            tab.classList.remove('text-slate-600');
          } else {
            tab.classList.add('text-amber-600', 'bg-amber-50', 'font-bold');
            tab.classList.remove('text-slate-600');
          }
        } else {
          if (tab.classList.contains('nav-tab')) {
            tab.classList.remove('bg-white', 'text-slate-900', 'font-semibold', 'shadow-sm');
            tab.classList.add('text-slate-600');
          } else {
            tab.classList.remove('text-amber-600', 'bg-amber-50', 'font-bold');
            tab.classList.add('text-slate-600');
          }
        }
      });
    });
  });

})();