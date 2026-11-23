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
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();

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
            ${isSpicyProduct(p) ? `
              <div class="mb-1.5">
                <span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold text-red-600 bg-red-50 border border-red-200/80 px-2 py-0.5 rounded-full shadow-2xs">
                  🌶️ Level 1-5 (+Request Lvl)
                </span>
              </div>
            ` : ''}
            ${isPizzaProduct(p) ? `
              <div class="mb-1.5">
                <span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full shadow-2xs">
                  🍕 5 Varian Rasa
                </span>
              </div>
            ` : ''}
            ${isBurgerProduct(p) ? `
              <div class="mb-1.5">
                <span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full shadow-2xs">
                  🍔 5 Varian Burger
                </span>
              </div>
            ` : ''}
            ${isMartabakProduct(p) ? `
              <div class="mb-1.5">
                <span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full shadow-2xs">
                  🥞 5 Pilihan Topping
                </span>
              </div>
            ` : ''}
            ${isRotiBakarProduct(p) ? `
              <div class="mb-1.5">
                <span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full shadow-2xs">
                  🍞 3 Pilihan Rasa
                </span>
              </div>
            ` : ''}
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
              const isSpicy = isSpicyProduct(p);
              const isPizza = isPizzaProduct(p);
              const isBurger = isBurgerProduct(p);
              const isMartabak = isMartabakProduct(p);
              const isRotiBakar = isRotiBakarProduct(p);
              const hasVar = isPizza || isBurger || isMartabak || isRotiBakar || p.hasVariants;
              if (inCart && inCart.qty > 0 && !isSpicy && !hasVar) {
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
                <button type="button" class="btn-add-cart ${isSpicy ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:to-red-600 shadow-red-500/20' : hasVar ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/20' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/25'} text-white shadow-sm active:scale-95 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 sm:gap-1.5" data-id="${p.id}">
                  <i data-lucide="${isSpicy ? 'flame' : isPizza ? 'pizza' : isBurger ? 'sandwich' : isMartabak ? 'cake' : hasVar ? 'sparkles' : 'plus'}" class="w-3.5 h-3.5"></i>
                  <span>${isSpicy ? 'Pilih Level' : hasVar ? 'Pilih Varian' : 'Pesan'}</span>
                </button>
              `;
            })()}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();

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
  
  // Helper cek apakah produk memiliki fitur level kepedasan (Enoci Pedec, Chikiwings, Bacic)
  function isSpicyProduct(p) {
    if (!p) return false;
    if (p.hasSpicyLevel === true) return true;
    const name = String(p.name || '').toLowerCase();
    return name.includes('enoci') || name.includes('chikiwings') || name.includes('bacic') || name.includes('ayam mpek') || name.includes('cileng bejo') || name.includes('naci oyeng');
  }

  // Spicy option modal states
  let selectedSpicyLevel = 1;
  let selectedIsExtraSpicy = false;
  let selectedExtraSpicyLevel = 6;
  let selectedSpicyNote = '';
  let multiOrderSpicySelections = {}; // { [productId]: level }

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

  const PIZZA_VARIANTS = ['Margherita', 'Pepperoni', 'Veggie', 'Seafood', 'Truffle'];
  const BURGER_VARIANTS = ['Doubble Cheese Burger', 'Beef Burger', 'Veggie Burger', 'Smacker Burger', 'Chicken Burger'];
  const MARTABAK_VARIANTS = ['Kacang', 'Coklat', 'Keju', 'Selai', 'Ketan'];
  const ROTI_BAKAR_VARIANTS = ['Coklat', 'Keju', 'Selai'];

  const VARIANT_DETAILS_MAP = {
    'Margherita': { icon: '🧀', desc: 'Saus tomat, mozzarella & basil' },
    'Pepperoni': { icon: '🥩', desc: 'Daging sapi & keju leleh' },
    'Veggie': { icon: '🥦', desc: 'Jamur, paprika & jagung manis' },
    'Seafood': { icon: '🦐', desc: 'Udang, cumi & saus spesial' },
    'Truffle': { icon: '🍄', desc: 'Jamur spesial & aroma truffle' },
    'Doubble Cheese Burger': { icon: '🧀', desc: 'Double beef patty & keju leleh melimpah' },
    'Beef Burger': { icon: '🥩', desc: 'Daging sapi panggang & sayuran segar' },
    'Veggie Burger': { icon: '🥦', desc: 'Patty nabati sehat, selada & tomat' },
    'Smacker Burger': { icon: '🥓', desc: 'Burger spesial dengan saus smacker gurih' },
    'Chicken Burger': { icon: '🍗', desc: 'Patty ayam krispi renyah & mayo' },
    'Kacang': { icon: '🥜', desc: 'Taburan kacang tanah sangrai gurih & renyah' },
    'Coklat': { icon: '🍫', desc: 'Coklat butir manis legit lumer di lidah' },
    'Keju': { icon: '🧀', desc: 'Keju cheddar parut melimpah & creamy gurih' },
    'Selai': { icon: '🍓', desc: 'Selai buah segar manis aroma wangi' },
    'Ketan': { icon: '🍚', desc: 'Ketan hitam legit manis gurih dengan susu kental' },
  };

  function getProductVariants(p) {
    if (!p) return [];
    if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) return p.variants;
    if (isPizzaProduct(p)) return PIZZA_VARIANTS;
    if (isBurgerProduct(p)) return BURGER_VARIANTS;
    if (isMartabakProduct(p)) return MARTABAK_VARIANTS;
    if (isRotiBakarProduct(p)) return ROTI_BAKAR_VARIANTS;
    return [];
  }

  let selectedProductVariant = '';
  let selectedPizzaVariant = 'Margherita';
  let multiOrderPizzaSelections = {}; // { [productId]: variant }
  let multiOrderBurgerSelections = {}; // { [productId]: variant }
  let multiOrderMartabakSelections = {}; // { [productId]: variant }
  let multiOrderRotiBakarSelections = {}; // { [productId]: variant }
  let multiOrderNotes = {}; // { [productId]: note }

  let selectedOptionProduct = null;
  let selectedOptionQty = 1;

  function getSpicyExtraPerUnit() {
    if (!selectedOptionProduct || !isSpicyProduct(selectedOptionProduct)) return 0;
    if (selectedIsExtraSpicy) {
      return Math.max(1, selectedExtraSpicyLevel - 5) * 2000;
    }
    return 0;
  }

  function getEffectiveSpicyLevel() {
    if (!selectedOptionProduct || !isSpicyProduct(selectedOptionProduct)) return null;
    return selectedIsExtraSpicy ? selectedExtraSpicyLevel : selectedSpicyLevel;
  }

  function renderProductVariantPills(product) {
    const group = document.getElementById('opt-variant-group');
    if (!group || !product) return;
    const variants = getProductVariants(product);
    if (!variants.length) return;

    if (!variants.includes(selectedProductVariant)) {
      selectedProductVariant = variants[0];
    }

    group.innerHTML = variants.map((v) => {
      const isSel = v === selectedProductVariant;
      const info = VARIANT_DETAILS_MAP[v] || { icon: isBurgerProduct(product) ? '🍔' : '🍕', desc: 'Varian menu spesial' };
      return `
        <button type="button" class="btn-product-variant p-2.5 rounded-xl text-left border transition flex items-center gap-2.5 ${isSel ? 'border-orange-500 bg-orange-500 text-white shadow-xs scale-101' : 'border-slate-200 bg-white text-slate-700 hover:border-amber-400'}" data-variant="${v}">
          <span class="text-lg">${info.icon}</span>
          <div class="min-w-0 flex-1">
            <span class="text-xs font-bold block leading-tight ${isSel ? 'text-white' : 'text-slate-800'}">${v}</span>
            <span class="text-[10px] ${isSel ? 'opacity-90 text-white' : 'text-slate-400'} block leading-tight">${info.desc}</span>
          </div>
        </button>
      `;
    }).join('');

    group.querySelectorAll('.btn-product-variant').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedProductVariant = btn.dataset.variant;
        selectedPizzaVariant = btn.dataset.variant;
        renderProductVariantPills(product);
      });
    });

    const badge = document.getElementById('opt-variant-badge');
    if (badge) {
      badge.textContent = `Varian: ${selectedProductVariant}`;
    }
  }

  function renderPizzaVariantPillStates() {
    if (selectedOptionProduct) {
      renderProductVariantPills(selectedOptionProduct);
    }
  }

  function renderSpicyPillStates() {
    const pills = document.querySelectorAll('#opt-spicy-preset-group .btn-spicy-lvl');
    pills.forEach((btn) => {
      const lvl = parseInt(btn.dataset.lvl, 10);
      if (!selectedIsExtraSpicy && lvl === selectedSpicyLevel) {
        btn.className = 'btn-spicy-lvl py-2 px-1 rounded-xl text-xs font-black border transition flex flex-col items-center justify-center gap-0.5 border-red-500 bg-gradient-to-b from-orange-500 to-red-600 text-white shadow-xs scale-102';
      } else {
        btn.className = 'btn-spicy-lvl py-2 px-1 rounded-xl text-xs font-black border transition flex flex-col items-center justify-center gap-0.5 border-slate-200 bg-white text-slate-700 hover:border-orange-300';
      }
    });

    const badge = document.getElementById('opt-spicy-badge');
    if (badge) {
      if (selectedIsExtraSpicy) {
        const extra = (selectedExtraSpicyLevel - 5) * 2000;
        badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700';
        badge.textContent = `Level ${selectedExtraSpicyLevel} (+${formatRp(extra)})`;
      } else {
        badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700';
        badge.textContent = `Level ${selectedSpicyLevel} (Gratis)`;
      }
    }
  }

  function updateOptionSubtotal() {
    const qtyEl = document.getElementById('opt-qty-value');
    const subtotalEl = document.getElementById('opt-subtotal');
    const priceEl = document.getElementById('opt-product-price');
    if (qtyEl) qtyEl.textContent = selectedOptionQty;
    if (selectedOptionProduct) {
      const extraPerPorsi = getSpicyExtraPerUnit();
      const unitPrice = selectedOptionProduct.price + extraPerPorsi;
      const subtotal = unitPrice * selectedOptionQty;
      if (priceEl) {
        if (extraPerPorsi > 0) {
          priceEl.innerHTML = `${formatRp(unitPrice)} <span class="text-xs text-red-500 font-bold">(+${formatRp(extraPerPorsi)} Level ${getEffectiveSpicyLevel()})</span>`;
        } else {
          priceEl.textContent = `${formatRp(selectedOptionProduct.price)} / ${selectedOptionProduct.unit || 'Pcs'}`;
        }
      }
      if (subtotalEl) {
        subtotalEl.innerHTML = `Total: <span class="text-orange-600 font-extrabold">${formatRp(subtotal)}</span>`;
      }
    }
  }

  function openProductOptionModal(product) {
    selectedOptionProduct = product;
    selectedOptionQty = 1;
    selectedSpicyLevel = 1;
    selectedIsExtraSpicy = false;
    selectedExtraSpicyLevel = 6;
    selectedSpicyNote = '';

    const modal = document.getElementById('product-option-modal');
    const imgWrap = document.getElementById('opt-product-img-wrap');
    const nameEl = document.getElementById('opt-product-name');
    const catEl = document.getElementById('opt-product-category');
    const priceEl = document.getElementById('opt-product-price');
    const spicySec = document.getElementById('opt-spicy-section');
    const optGeneralNote = document.getElementById('opt-item-note');
    if (optGeneralNote) optGeneralNote.value = '';

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

    // Reset & toggle variant section (Pizza & Burger)
    const variantSec = document.getElementById('opt-variant-section');
    if (variantSec) {
      if (isVariantProduct(product)) {
        variantSec.classList.remove('hidden');
        const variants = getProductVariants(product);
        selectedProductVariant = variants[0] || '';
        selectedPizzaVariant = selectedProductVariant;

        const vTitle = document.getElementById('opt-variant-title');
        const vIcon = document.getElementById('opt-variant-icon');
        const vDesc = document.getElementById('opt-variant-desc');
        const vNoteInput = document.getElementById('opt-variant-note');

        if (isPizzaProduct(product)) {
          if (vTitle) vTitle.textContent = 'Pilih Varian Pizza';
          if (vIcon) vIcon.textContent = '🍕';
          if (vDesc) vDesc.textContent = 'Pilih salah satu varian rasa pizza favorit Anda:';
          if (vNoteInput) {
            vNoteInput.placeholder = 'Catatan pizza (opsional, misal: potong 8 slice, saus dipisah)';
            vNoteInput.value = '';
          }
        } else if (isBurgerProduct(product)) {
          if (vTitle) vTitle.textContent = 'Pilih Varian Burger';
          if (vIcon) vIcon.textContent = '🍔';
          if (vDesc) vDesc.textContent = 'Pilih salah satu varian rasa burger favorit Anda:';
          if (vNoteInput) {
            vNoteInput.placeholder = 'Catatan burger (opsional, misal: tanpa bawang, ekstra saus/mayo)';
            vNoteInput.value = '';
          }
        } else if (isMartabakProduct(product)) {
          if (vTitle) vTitle.textContent = 'Pilih Varian Maytabac';
          if (vIcon) vIcon.textContent = '🥞';
          if (vDesc) vDesc.textContent = 'Pilih salah satu varian topping maytabac favorit Anda:';
          if (vNoteInput) {
            vNoteInput.placeholder = 'Catatan maytabac (opsional, misal: susu kental manis dipisah)';
            vNoteInput.value = '';
          }
        } else if (isRotiBakarProduct(product)) {
          if (vTitle) vTitle.textContent = 'Pilih Varian Nti Bakay';
          if (vIcon) vIcon.textContent = '🍞';
          if (vDesc) vDesc.textContent = 'Pilih salah satu varian rasa roti bakar favorit Anda:';
          if (vNoteInput) {
            vNoteInput.placeholder = 'Catatan nti bakay (opsional, misal: bakar agak garing, margarin banyakin)';
            vNoteInput.value = '';
          }
        } else {
          if (vTitle) vTitle.textContent = 'Pilih Varian Menu';
          if (vIcon) vIcon.textContent = '✨';
          if (vDesc) vDesc.textContent = 'Pilih salah satu varian menu favorit Anda:';
          if (vNoteInput) {
            vNoteInput.placeholder = 'Catatan varian (opsional)';
            vNoteInput.value = '';
          }
        }
        renderProductVariantPills(product);
      } else {
        variantSec.classList.add('hidden');
      }
    }

    // Reset & toggle spicy section
    if (spicySec) {
      if (isSpicyProduct(product)) {
        spicySec.classList.remove('hidden');
        const extraToggle = document.getElementById('opt-spicy-extra-toggle');
        const extraWrap = document.getElementById('opt-spicy-extra-wrap');
        const noteInput = document.getElementById('opt-spicy-note');
        const levelDisplay = document.getElementById('opt-spicy-level-display');
        const costText = document.getElementById('opt-spicy-extra-cost-text');

        if (extraToggle) extraToggle.checked = false;
        if (extraWrap) extraWrap.classList.add('hidden');
        if (noteInput) noteInput.value = '';
        if (levelDisplay) levelDisplay.textContent = 'Level 6';
        if (costText) costText.textContent = `+${formatRp(2000)} / porsi`;
        renderSpicyPillStates();
      } else {
        spicySec.classList.add('hidden');
      }
    }

    updateOptionSubtotal();
    modal.classList.remove('hidden');
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
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
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
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
              ${isSpicyProduct(p) ? `
                <div class="mt-1 flex items-center gap-1.5">
                  <span class="text-[10px] font-bold text-red-600">🌶️ Level:</span>
                  <select class="multi-spicy-select text-[10px] font-bold text-red-700 bg-white border border-red-200 rounded-lg px-1.5 py-0.5 cursor-pointer outline-none focus:border-red-400" data-id="${p.id}">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lvl) => {
                      const curLvl = multiOrderSpicySelections[p.id] || 1;
                      const extra = lvl > 5 ? ` (+${formatRp((lvl - 5) * 2000)})` : ' (Gratis)';
                      return `<option value="${lvl}" ${curLvl === lvl ? 'selected' : ''}>Lvl ${lvl}${extra}</option>`;
                    }).join('')}
                  </select>
                </div>
              ` : ''}
              ${isPizzaProduct(p) ? `
                <div class="mt-1 flex items-center gap-1.5">
                  <span class="text-[10px] font-bold text-amber-700">🍕 Varian:</span>
                  <select class="multi-pizza-select text-[10px] font-bold text-amber-800 bg-white border border-amber-200 rounded-lg px-1.5 py-0.5 cursor-pointer outline-none focus:border-amber-400" data-id="${p.id}">
                    ${['Margherita', 'Pepperoni', 'Veggie', 'Seafood', 'Truffle'].map((v) => {
                      const curV = multiOrderPizzaSelections[p.id] || 'Margherita';
                      return `<option value="${v}" ${curV === v ? 'selected' : ''}>${v}</option>`;
                    }).join('')}
                  </select>
                </div>
              ` : ''}
              ${isBurgerProduct(p) ? `
                <div class="mt-1 flex items-center gap-1.5">
                  <span class="text-[10px] font-bold text-amber-700">🍔 Varian:</span>
                  <select class="multi-burger-select text-[10px] font-bold text-amber-800 bg-white border border-amber-200 rounded-lg px-1.5 py-0.5 cursor-pointer outline-none focus:border-amber-400" data-id="${p.id}">
                    ${BURGER_VARIANTS.map((v) => {
                      const curV = multiOrderBurgerSelections[p.id] || 'Doubble Cheese Burger';
                      return `<option value="${v}" ${curV === v ? 'selected' : ''}>${v}</option>`;
                    }).join('')}
                  </select>
                </div>
              ` : ''}
              ${isMartabakProduct(p) ? `
                <div class="mt-1 flex items-center gap-1.5">
                  <span class="text-[10px] font-bold text-amber-700">🥞 Topping:</span>
                  <select class="multi-martabak-select text-[10px] font-bold text-amber-800 bg-white border border-amber-200 rounded-lg px-1.5 py-0.5 cursor-pointer outline-none focus:border-amber-400" data-id="${p.id}">
                    ${MARTABAK_VARIANTS.map((v) => {
                      const curV = multiOrderMartabakSelections[p.id] || 'Kacang';
                      return `<option value="${v}" ${curV === v ? 'selected' : ''}>${v}</option>`;
                    }).join('')}
                  </select>
                </div>
              ` : ''}
              ${isRotiBakarProduct(p) ? `
                <div class="mt-1 flex items-center gap-1.5">
                  <span class="text-[10px] font-bold text-amber-700">🍞 Rasa:</span>
                  <select class="multi-rotibakar-select text-[10px] font-bold text-amber-800 bg-white border border-amber-200 rounded-lg px-1.5 py-0.5 cursor-pointer outline-none focus:border-amber-400" data-id="${p.id}">
                    ${ROTI_BAKAR_VARIANTS.map((v) => {
                      const curV = multiOrderRotiBakarSelections[p.id] || 'Coklat';
                      return `<option value="${v}" ${curV === v ? 'selected' : ''}>${v}</option>`;
                    }).join('')}
                  </select>
                </div>
              ` : ''}
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
        <div class="px-2 pb-2 -mt-1 ${isSelected ? 'bg-orange-50/70 border-x border-b border-orange-200/80 rounded-b-2xl' : ''}">
          <input type="text" class="multi-note-input w-full text-[11px] bg-white border border-slate-200 rounded-lg px-2.5 py-1 placeholder:text-slate-400 outline-none focus:border-orange-400 transition" placeholder="📝 Request catatan untuk ${p.name} (opsional)..." data-id="${p.id}" value="${multiOrderNotes[p.id] || ''}" />
        </div>
      `;
    }).join('');

    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();

    // Spicy select in multi-order
    container.querySelectorAll('.multi-spicy-select').forEach((sel) => {
      sel.addEventListener('change', () => {
        const id = sel.dataset.id;
        multiOrderSpicySelections[id] = parseInt(sel.value, 10) || 1;
        updateMultiOrderSummary();
      });
    });

    // Pizza variant select in multi-order
    container.querySelectorAll('.multi-pizza-select').forEach((sel) => {
      sel.addEventListener('change', () => {
        const id = sel.dataset.id;
        multiOrderPizzaSelections[id] = sel.value || 'Margherita';
      });
    });

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
        const isSpicy = isSpicyProduct(prod);
        const spicyLvl = isSpicy ? (multiOrderSpicySelections[id] || 1) : null;
        const extra = (spicyLvl && spicyLvl > 5) ? (spicyLvl - 5) * 2000 : 0;
        totalPrice += (prod.price + extra) * qty;
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
        const isSpicy = isSpicyProduct(prod);
        const isPizza = isPizzaProduct(prod);
        const isBurger = isBurgerProduct(prod);
        const spicyLvl = isSpicy ? (multiOrderSpicySelections[id] || 1) : null;
        const extra = (spicyLvl && spicyLvl > 5) ? (spicyLvl - 5) * 2000 : 0;
        const variant = isPizza 
          ? (multiOrderPizzaSelections[id] || 'Margherita') 
          : isBurger 
            ? (multiOrderBurgerSelections[id] || 'Doubble Cheese Burger') 
            : isMartabakProduct(prod)
              ? (multiOrderMartabakSelections[id] || 'Kacang')
              : isRotiBakarProduct(prod)
                ? (multiOrderRotiBakarSelections[id] || 'Coklat')
                : null;
        addToCart(prod, qty, false, {
          variant: variant,
          spicyLevel: spicyLvl,
          extraPrice: extra,
          note: multiOrderNotes[id] || '',
          spicyNote: multiOrderNotes[id] || '',
          variantNote: multiOrderNotes[id] || '',
        });
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

  function addToCart(product, qty = 1, showFeedback = true, options = null) {
    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    const isSpicy = isSpicyProduct(product);
    const isPizza = isPizzaProduct(product);
    const isBurger = isBurgerProduct(product);
    const isMartabak = isMartabakProduct(product);
    const spicyLevel = (options && options.spicyLevel != null) 
      ? options.spicyLevel 
      : (isSpicy ? 1 : null);
    const extraPrice = (spicyLevel && spicyLevel > 5) ? (spicyLevel - 5) * 2000 : 0;
    const note = (options && options.note) 
      ? options.note.trim() 
      : (options && options.spicyNote) 
        ? options.spicyNote.trim() 
        : (options && options.variantNote) 
          ? options.variantNote.trim() 
          : '';
    const variant = (options && options.variant) ? options.variant : (isPizza ? 'Margherita' : isBurger ? 'Doubble Cheese Burger' : isMartabak ? 'Kacang' : null);

    const noteSlug = note ? '_' + note.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) : '';
    let cartItemId = product.id;
    if (variant) {
      cartItemId = `${product.id}_var_${variant.toLowerCase()}${noteSlug}`;
    } else if (spicyLevel) {
      cartItemId = `${product.id}_lvl${spicyLevel}${noteSlug}`;
    } else if (note) {
      cartItemId = `${product.id}${noteSlug}`;
    }

    const existing = cart.find((it) => (it.cartItemId || it.id) === cartItemId);
    if (existing) {
      existing.qty += quantity;
    } else {
      cart.push({
        id: product.id,
        cartItemId: cartItemId,
        name: product.name,
        price: product.price + extraPrice,
        basePrice: product.price,
        variant: variant,
        variantNote: note,
        spicyLevel: spicyLevel,
        extraPrice: extraPrice,
        spicyNote: note,
        note: note,
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
      const levelText = spicyLevel ? ` [Level ${spicyLevel}${extraPrice > 0 ? ` +${formatRp(extraPrice)}` : ''}]` : '';
      const varText = variant ? ` [Varian: ${variant}]` : '';
      const noteText = note ? ` [Catatan: "${note}"]` : '';
      showToast(`✓ "${product.name}${varText}${levelText}${noteText}" (${quantity} ${product.unit || 'item'}) masuk keranjang`);
    }
  }

  function updateCartQty(key, delta) {
    const item = cart.find((it) => (it.cartItemId || it.id) === key);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter((it) => (it.cartItemId || it.id) !== key);
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

    container.innerHTML = cart.map((it) => {
      const itemKey = it.cartItemId || it.id;
      const spicyBadgeHtml = it.spicyLevel ? `
        <div class="flex items-center gap-1 mt-0.5 flex-wrap">
          <span class="inline-flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${it.spicyLevel > 5 ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-orange-100 text-orange-800'}">
            🌶️ Level ${it.spicyLevel} ${it.extraPrice > 0 ? `(+${formatRp(it.extraPrice)})` : ''}
          </span>
          ${it.spicyNote ? `<span class="text-[10px] text-slate-500 italic max-w-[130px] truncate" title="${it.spicyNote}">"${it.spicyNote}"</span>` : ''}
        </div>
      ` : '';
      const varIcon = isPizzaProduct(it) ? '🍕' : isBurgerProduct(it) ? '🍔' : isMartabakProduct(it) ? '🥞' : isRotiBakarProduct(it) ? '🍞' : '✨';
      const variantBadgeHtml = it.variant ? `
        <div class="flex items-center gap-1 mt-0.5 flex-wrap">
          <span class="inline-flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-200/80">
            ${varIcon} ${it.variant}
          </span>
          ${it.variantNote ? `<span class="text-[10px] text-slate-500 italic max-w-[130px] truncate" title="${it.variantNote}">"${it.variantNote}"</span>` : ''}
        </div>
      ` : '';

      const itemNote = it.note || it.spicyNote || it.variantNote || '';
      const noteBadgeHtml = itemNote ? `
        <div class="flex items-center gap-1 text-[10px] text-slate-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70 mt-1 max-w-full">
          <span class="shrink-0">📝</span>
          <span class="italic truncate flex-1" title="${itemNote}">"${itemNote}"</span>
          <button type="button" class="btn-edit-cart-note text-[10px] text-orange-600 hover:underline font-bold shrink-0 ml-1" data-key="${itemKey}">Ubah</button>
        </div>
      ` : `
        <button type="button" class="btn-edit-cart-note text-[10px] text-slate-400 hover:text-orange-600 flex items-center gap-0.5 mt-1 font-medium" data-key="${itemKey}">
          <i data-lucide="edit-3" class="w-3 h-3"></i>
          <span>+ Catatan</span>
        </button>
      `;

      return `
        <div class="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl shrink-0 shadow-xs border border-slate-100">
              ${it.emoji || '🛍️'}
            </div>
            <div class="min-w-0 flex-1">
              <h5 class="text-xs font-bold text-slate-900 leading-tight truncate">${it.name}</h5>
              ${variantBadgeHtml}
              ${spicyBadgeHtml}
              ${noteBadgeHtml}
              <p class="text-xs text-orange-600 font-extrabold mt-0.5">${formatRp(it.price)} <span class="text-[10px] text-slate-400 font-normal">/${it.unit}</span></p>
            </div>
          </div>

          <div class="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-2xs shrink-0">
            <button type="button" class="btn-qty-minus text-slate-500 hover:text-slate-800 p-0.5 rounded transition" data-key="${itemKey}">
              <i data-lucide="minus" class="w-3.5 h-3.5"></i>
            </button>
            <span class="w-6 text-center text-xs font-bold text-slate-800">${it.qty}</span>
            <button type="button" class="btn-qty-plus text-slate-500 hover:text-slate-800 p-0.5 rounded transition" data-key="${itemKey}">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();

    container.querySelectorAll('.btn-edit-cart-note').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const it = cart.find((x) => (x.cartItemId || x.id) === key);
        if (!it) return;
        const curNote = it.note || it.spicyNote || it.variantNote || '';
        const newNote = prompt(`Request catatan untuk ${it.name}:`, curNote);
        if (newNote !== null) {
          it.note = newNote.trim();
          it.spicyNote = it.note;
          it.variantNote = it.note;
          saveCartToStorage();
          renderCart();
        }
      });
    });

    container.querySelectorAll('.btn-qty-minus').forEach((btn) => {
      btn.addEventListener('click', () => updateCartQty(btn.dataset.key, -1));
    });

    container.querySelectorAll('.btn-qty-plus').forEach((btn) => {
      btn.addEventListener('click', () => updateCartQty(btn.dataset.key, 1));
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

        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
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
    const method = methodInput ? methodInput.value : 'Makan di Tempat';

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
      const varDesc = it.variant ? ` [Varian: ${it.variant}]` : '';
      const spicyDesc = it.spicyLevel 
        ? ` [Level ${it.spicyLevel}${it.extraPrice > 0 ? ` (+Rp ${it.extraPrice.toLocaleString('id-ID')}/porsi)` : ''}]` 
        : '';
      const noteDesc = (it.note || it.spicyNote || it.variantNote) ? ` (Catatan: ${it.note || it.spicyNote || it.variantNote})` : '';
      msg += `${idx + 1}. ${it.name}${varDesc}${spicyDesc}${noteDesc} (${it.qty}x) = ${formatRp(it.price * it.qty)}\n`;
    });
    msg += `\n*Total Item:* ${totalQty} item\n`;
    msg += `*Total Pembayaran:* ${formatRp(totalPrice)}\n\n`;
    msg += `*Nama Pemesan:* ${name}\n`;
    if (phone) msg += `*No. HP/WA:* ${phone}\n`;
    let methodDisplay = method;
    if (method === 'Makan di Tempat') {
      const tableInput = document.getElementById('order-table-no');
      const tableVal = (tableInput ? tableInput.value : '').trim();
      methodDisplay = `Makan di Tempat 🍽️${tableVal ? ` (${tableVal})` : ''}`;
    } else if (method === 'Take Away') {
      methodDisplay = 'Take Away (Bungkus) 🥡';
    } else if (method === 'Antar / Kirim') {
      methodDisplay = 'Antar / Kirim (Delivery) 🛵';
    }
    msg += `*Layanan / Metode:* ${methodDisplay}\n`;
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
    const method = methodInput ? methodInput.value : 'Makan di Tempat';

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
      variant: it.variant || null,
      note: it.note || it.variantNote || it.spicyNote || '',
      variantNote: it.note || it.variantNote || '',
      spicyLevel: it.spicyLevel || null,
      extraPrice: it.extraPrice || 0,
      spicyNote: it.note || it.spicyNote || '',
    }));

    const btnSubmit = document.getElementById('btn-submit-web-order');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Memproses Pesanan...</span>';
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }

    try {
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          deliveryMethod: method,
          tableNo: (method === 'Makan di Tempat' && document.getElementById('order-table-no')) ? document.getElementById('order-table-no').value.trim() : '',
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
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
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
            if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
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

    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
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

    // Toggle Delivery Address & Table No Input
    const methodRadios = document.querySelectorAll('input[name="order-method"]');
    const wrapAddress = document.getElementById('wrap-order-address');
    const wrapTableNo = document.getElementById('wrap-table-no');
    methodRadios.forEach((r) => {
      r.addEventListener('change', () => {
        if (wrapAddress) {
          if (r.value === 'Antar / Kirim') {
            wrapAddress.classList.remove('hidden');
          } else {
            wrapAddress.classList.add('hidden');
          }
        }
        if (wrapTableNo) {
          if (r.value === 'Makan di Tempat') {
            wrapTableNo.classList.remove('hidden');
          } else {
            wrapTableNo.classList.add('hidden');
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
    // Spicy level pill selections
    const spicyPills = document.querySelectorAll('#opt-spicy-preset-group .btn-spicy-lvl');
    spicyPills.forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedSpicyLevel = parseInt(btn.dataset.lvl, 10);
        selectedIsExtraSpicy = false;
        const extraToggle = document.getElementById('opt-spicy-extra-toggle');
        const extraWrap = document.getElementById('opt-spicy-extra-wrap');
        if (extraToggle) extraToggle.checked = false;
        if (extraWrap) extraWrap.classList.add('hidden');
        renderSpicyPillStates();
        updateOptionSubtotal();
      });
    });

    const optSpicyExtraToggle = document.getElementById('opt-spicy-extra-toggle');
    const optSpicyExtraWrap = document.getElementById('opt-spicy-extra-wrap');
    if (optSpicyExtraToggle) {
      optSpicyExtraToggle.addEventListener('change', (e) => {
        selectedIsExtraSpicy = e.target.checked;
        if (selectedIsExtraSpicy) {
          if (optSpicyExtraWrap) optSpicyExtraWrap.classList.remove('hidden');
          selectedExtraSpicyLevel = Math.max(6, selectedExtraSpicyLevel || 6);
          const lvlDisp = document.getElementById('opt-spicy-level-display');
          const costText = document.getElementById('opt-spicy-extra-cost-text');
          if (lvlDisp) lvlDisp.textContent = `Level ${selectedExtraSpicyLevel}`;
          if (costText) costText.textContent = `+${formatRp((selectedExtraSpicyLevel - 5) * 2000)} / porsi`;
        } else {
          if (optSpicyExtraWrap) optSpicyExtraWrap.classList.add('hidden');
        }
        renderSpicyPillStates();
        updateOptionSubtotal();
      });
    }

    const btnSpicyMinus = document.getElementById('btn-spicy-minus');
    const btnSpicyPlus = document.getElementById('btn-spicy-plus');
    if (btnSpicyMinus) {
      btnSpicyMinus.addEventListener('click', () => {
        if (selectedExtraSpicyLevel > 6) {
          selectedExtraSpicyLevel -= 1;
        } else {
          selectedExtraSpicyLevel = 6;
          selectedIsExtraSpicy = false;
          selectedSpicyLevel = 5;
          if (optSpicyExtraToggle) optSpicyExtraToggle.checked = false;
          if (optSpicyExtraWrap) optSpicyExtraWrap.classList.add('hidden');
        }
        const lvlDisp = document.getElementById('opt-spicy-level-display');
        const costText = document.getElementById('opt-spicy-extra-cost-text');
        if (lvlDisp) lvlDisp.textContent = `Level ${selectedExtraSpicyLevel}`;
        if (costText) costText.textContent = `+${formatRp((selectedExtraSpicyLevel - 5) * 2000)} / porsi`;
        renderSpicyPillStates();
        updateOptionSubtotal();
      });
    }
    if (btnSpicyPlus) {
      btnSpicyPlus.addEventListener('click', () => {
        selectedExtraSpicyLevel += 1;
        const lvlDisp = document.getElementById('opt-spicy-level-display');
        const costText = document.getElementById('opt-spicy-extra-cost-text');
        if (lvlDisp) lvlDisp.textContent = `Level ${selectedExtraSpicyLevel}`;
        if (costText) costText.textContent = `+${formatRp((selectedExtraSpicyLevel - 5) * 2000)} / porsi`;
        renderSpicyPillStates();
        updateOptionSubtotal();
      });
    }

    // Pizza variant buttons listener
    const pizzaVariantBtns = document.querySelectorAll('#opt-variant-group .btn-pizza-variant');
    pizzaVariantBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedPizzaVariant = btn.dataset.variant || 'Margherita';
        renderPizzaVariantPillStates();
      });
    });

    if (btnOptAddToCart) {
      btnOptAddToCart.addEventListener('click', () => {
        if (selectedOptionProduct) {
          const isSpicy = isSpicyProduct(selectedOptionProduct);
          const hasVar = isVariantProduct(selectedOptionProduct);
          const spicyLevel = isSpicy ? (selectedIsExtraSpicy ? selectedExtraSpicyLevel : selectedSpicyLevel) : null;
          const extraPrice = (spicyLevel && spicyLevel > 5) ? (spicyLevel - 5) * 2000 : 0;
          const generalNote = (document.getElementById('opt-item-note')?.value || '').trim();
          const spicyNote = isSpicy ? (document.getElementById('opt-spicy-note')?.value || '').trim() : '';
          const variantNote = hasVar ? (document.getElementById('opt-variant-note')?.value || '').trim() : '';
          const finalNote = generalNote || spicyNote || variantNote || '';
          const variant = hasVar ? selectedProductVariant : null;

          addToCart(selectedOptionProduct, selectedOptionQty, true, {
            variant,
            variantNote: finalNote,
            spicyLevel,
            extraPrice,
            spicyNote: finalNote,
            note: finalNote,
          });
          closeProductOptionModal();
        }
      });
    }
    if (btnOptOrderNow) {
      btnOptOrderNow.addEventListener('click', () => {
        if (selectedOptionProduct) {
          const isSpicy = isSpicyProduct(selectedOptionProduct);
          const hasVar = isVariantProduct(selectedOptionProduct);
          const spicyLevel = isSpicy ? (selectedIsExtraSpicy ? selectedExtraSpicyLevel : selectedSpicyLevel) : null;
          const extraPrice = (spicyLevel && spicyLevel > 5) ? (spicyLevel - 5) * 2000 : 0;
          const generalNote = (document.getElementById('opt-item-note')?.value || '').trim();
          const spicyNote = isSpicy ? (document.getElementById('opt-spicy-note')?.value || '').trim() : '';
          const variantNote = hasVar ? (document.getElementById('opt-variant-note')?.value || '').trim() : '';
          const finalNote = generalNote || spicyNote || variantNote || '';
          const variant = hasVar ? selectedProductVariant : null;

          addToCart(selectedOptionProduct, selectedOptionQty, false, {
            variant,
            variantNote: finalNote,
            spicyLevel,
            extraPrice,
            spicyNote: finalNote,
            note: finalNote,
          });
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