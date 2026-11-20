(function () {
  'use strict';
  const app = window.Warung;
  app.formatT = app.formatRupiah;

  // Pagination & Lazy Load state
  let orders = [];
  let currentOrder = null;
  let currentPage = 1;
  let pageSize = 10;
  let totalOrders = 0;
  let totalPages = 1;
  let isLoading = false;
  let filters = { q: '', method: 'Semua', status: 'Semua' };

  function methodBadge(m) {
    const map = {
      Tunai: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
      QRIS: 'bg-blue-50 text-blue-700 border-blue-200/60',
      Transfer: 'bg-violet-50 text-violet-700 border-violet-200/60',
    };
    return `<span class="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${map[m] || 'bg-gray-100 text-gray-600 border-gray-200'}">${m || 'QRIS'}</span>`;
  }

  function statusBadge(status) {
    const isLunas = status === 'Lunas';
    const isWeb = status && status.includes('Web');
    const colorClass = isLunas 
      ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60' 
      : (isWeb ? 'bg-amber-50 text-amber-700 border-amber-200/60' : 'bg-gray-100 text-gray-600 border-gray-200');
    const dotClass = isLunas ? 'bg-emerald-500' : (isWeb ? 'bg-amber-500 animate-pulse' : 'bg-gray-400');

    return `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${colorClass}">
        <span class="w-1.5 h-1.5 rounded-full ${dotClass}"></span>
        <span>${status || 'Lunas'}</span>
      </span>
    `;
  }

  function createRowHTML(o) {
    const dateFormatted = new Date(o.createdAt).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const isWebOrder = o.channel === 'web' || (o.kasir && o.kasir.includes('Web'));
    const kasirDisplay = isWebOrder 
      ? `<span class="inline-flex items-center gap-1 text-orange-600 font-semibold"><i data-lucide="globe" class="w-3.5 h-3.5"></i> ${o.kasir}</span>`
      : o.kasir;

    return `
      <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition group" id="row-${o.id}">
        <td class="px-6 py-3.5 font-bold text-gray-900">${o.id}</td>
        <td class="px-6 py-3.5 text-gray-500 text-xs">${dateFormatted}</td>
        <td class="px-6 py-3.5 text-gray-700">${kasirDisplay}</td>
        <td class="px-6 py-3.5">${methodBadge(o.method || o.paymentMethod)}</td>
        <td class="px-6 py-3.5">${statusBadge(o.status)}</td>
        <td class="px-6 py-3.5 font-extrabold text-gray-900">${app.formatT(o.total)}</td>
        <td class="px-6 py-3.5">
          <div class="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition">
            <button data-detail="${o.id}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i> Detail
            </button>
            <button data-print="${o.id}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i> Cetak
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function renderTable() {
    const tbody = document.getElementById('ri-rows');
    if (!tbody) return;

    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-16 text-center"><div class="text-4xl mb-3">🧾</div><p class="font-semibold text-gray-700">Belum ada riwayat transaksi</p><p class="text-xs text-gray-400 mt-1">Transaksi yang masuk akan otomatis tampil di sini.</p></td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(createRowHTML).join('');
    if (window.lucide) lucide.createIcons();

    tbody.querySelectorAll('[data-detail]').forEach((b) => {
      b.onclick = () => openDetail(b.dataset.detail);
    });
    tbody.querySelectorAll('[data-print]').forEach((b) => {
      b.onclick = () => printOrder(b.dataset.print);
    });

    const scrollContainer = document.getElementById('table-scroll-container');
    if (scrollContainer) scrollContainer.scrollTop = 0;
  }

  function updatePaginationControls() {
    totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));

    // Badge Total Count
    const totalBadge = document.getElementById('badge-total-count');
    if (totalBadge) totalBadge.textContent = `Total: ${totalOrders} Transaksi`;

    // Lazy info
    const infoEl = document.getElementById('lazy-info');
    if (infoEl) {
      if (totalOrders === 0) {
        infoEl.textContent = 'Tidak ada transaksi ditemukan.';
      } else {
        const startRecord = (currentPage - 1) * pageSize + 1;
        const endRecord = Math.min(currentPage * pageSize, totalOrders);
        infoEl.textContent = `Menampilkan ${startRecord} - ${endRecord} dari ${totalOrders} transaksi`;
      }
    }

    // Prev / Next Buttons
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    if (btnPrev) {
      btnPrev.disabled = currentPage <= 1;
    }
    if (btnNext) {
      btnNext.disabled = currentPage >= totalPages;
    }

    // Numbered page buttons
    const numContainer = document.getElementById('page-numbers-container');
    if (numContainer) {
      let html = '';
      
      let startP = Math.max(1, currentPage - 2);
      let endP = Math.min(totalPages, startP + 4);
      if (endP - startP < 4) {
        startP = Math.max(1, endP - 4);
      }

      for (let p = startP; p <= endP; p++) {
        const isActive = p === currentPage;
        html += `
          <button type="button" class="page-num-btn w-8 h-8 rounded-xl font-bold text-xs transition ${isActive ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'}" data-page="${p}">
            ${p}
          </button>
        `;
      }

      numContainer.innerHTML = html;

      numContainer.querySelectorAll('.page-num-btn').forEach((b) => {
        b.onclick = () => {
          const targetP = parseInt(b.dataset.page, 10);
          if (targetP !== currentPage) {
            currentPage = targetP;
            loadData();
          }
        };
      });
    }
  }

  function loadData() {
    if (isLoading) return Promise.resolve();
    isLoading = true;

    const loader = document.getElementById('lazy-loader');
    const tbody = document.getElementById('ri-rows');

    if (loader) loader.classList.remove('hidden');
    if (tbody && !orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8"><div class="skeleton h-10 rounded-lg"></div><div class="skeleton h-10 rounded-lg mt-2"></div><div class="skeleton h-10 rounded-lg mt-2"></div></td></tr>';
    }

    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', String(pageSize));
    if (filters.q) params.set('q', filters.q);
    if (filters.method && filters.method !== 'Semua') params.set('method', filters.method);
    if (filters.status && filters.status !== 'Semua') params.set('status', filters.status);

    return app.get('api/orders?' + params.toString())
      .then((data) => {
        orders = data.orders || [];
        totalOrders = data.total || 0;
        renderTable();
        updatePaginationControls();
      })
      .catch((e) => {
        app.toast(e.message || 'Gagal memuat riwayat.', 'error');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-12 text-center text-sm text-red-500 font-semibold">Gagal memuat data transaksi.</td></tr>';
      })
      .finally(() => {
        isLoading = false;
        if (loader) loader.classList.add('hidden');
      });
  }

  function openDetail(id) {
    app.get('api/orders/' + id).then(({ order, settings }) => {
      currentOrder = order;
      document.getElementById('det-id').textContent = order.id + ' · ' + order.kasir;
      document.getElementById('detail-date').textContent = new Date(order.createdAt).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      
      const custBox = document.getElementById('detail-customer-info');
      if (custBox) {
        if (order.customerName || order.customerPhone || order.deliveryMethod || order.address) {
          custBox.classList.remove('hidden');
          const cleanPhone = String(order.customerPhone || '').replace(/[^0-9]/g, '');
          const waLink = cleanPhone ? (cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone) : '';
          
          let mapButton = '';
          if (order.address && order.address.includes('http')) {
            const m = order.address.match(/(https?:\/\/[^\s)]+)/);
            if (m) {
              mapButton = `<a href="${m[0]}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-[11px] shadow-xs mt-1 transition"><i data-lucide="map-pin" class="w-3 h-3"></i> Buka Titik GPS Google Maps ↗</a>`;
            }
          }

          custBox.innerHTML = `
            <div class="font-bold flex items-center justify-between text-blue-950">
              <span>👤 Info Pemesan: ${order.customerName || 'Pelanggan'}</span>
              <span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px]">${order.deliveryMethod || 'Ambil di Warung'}</span>
            </div>
            ${order.customerPhone ? `<div class="flex items-center gap-1.5"><i data-lucide="phone" class="w-3 h-3 text-emerald-600"></i><span>${order.customerPhone}</span> <a href="https://wa.me/${waLink}" target="_blank" class="text-emerald-700 font-semibold underline text-[11px] ml-1">Chat WA ↗</a></div>` : ''}
            ${order.address ? `<div class="pt-1 border-t border-blue-200/60 mt-1"><p class="font-semibold text-[11px] text-blue-900">Alamat / Lokasi Pengantaran:</p><p class="text-slate-700">${order.address}</p>${mapButton}</div>` : ''}
            ${order.notes ? `<div class="text-[11px] text-slate-500 italic">Catatan: "${order.notes}"</div>` : ''}
          `;
        } else {
          custBox.classList.add('hidden');
        }
      }

      document.getElementById('detail-items').innerHTML = (order.items || []).map((it) => `
        <div class="flex items-center gap-3 p-2 rounded-xl bg-gray-50/60">
          <span class="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-lg">${it.productEmoji || '🛍️'}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-800 truncate">${it.productName}</p>
            <p class="text-xs text-gray-400">${it.qty} x ${app.formatT(it.price)}</p>
          </div>
          <span class="text-sm font-bold text-gray-800">${app.formatT(it.total)}</span>
        </div>`).join('');

      document.getElementById('d-sub').textContent = app.formatT(order.subtotal);
      document.getElementById('d-disc').textContent = order.discount ? '- ' + app.formatT(order.discount) : 'Rp 0';
      document.getElementById('d-taxrate').textContent = (order.taxRate || 0) + '%';
      document.getElementById('d-tax').textContent = app.formatT(order.tax || 0);
      document.getElementById('d-total').textContent = app.formatT(order.total);
      document.getElementById('d-paid').textContent = app.formatT(order.paid || order.total);
      document.getElementById('d-change').textContent = app.formatT(order.change || 0);
      
      const m = document.getElementById('detail-modal');
      m.classList.remove('hidden'); m.classList.add('flex');
      if (window.lucide) lucide.createIcons();
    }).catch((e) => app.toast(e.message, 'error'));
  }

  function closeDetail() {
    const m = document.getElementById('detail-modal');
    if (m) {
      m.classList.add('hidden');
      m.classList.remove('flex');
    }
  }

  function printOrder(id) {
    app.get('api/orders/' + id).then(({ order, settings }) => {
      const w = window.open('', '_blank');
      if (!w) { app.toast('Izinkan popup untuk mencetak.', 'info'); return; }
      const items = (order.items || []).map((it) => `
        <div class="line"><span>${it.qty}x ${it.productName}</span><span>Rp ${it.total.toLocaleString('id-ID')}</span></div>`).join('');
      w.document.write(`<!DOCTYPE html><html><head><title>${settings.storeName || 'Struk'}</title><style>
        *{font-family:Arial,sans-serif;margin:0;padding:0;box-sizing:border-box}
        body{width:300px;margin:0 auto;padding:16px;color:#000;font-size:13px}
        h1{font-size:16px;text-align:center}.meta{text-align:center;font-size:11px;margin:4px 0 10px;color:#333}
        .rule{border-top:1px dashed #000;margin:8px 0}
        .line{display:flex;justify-content:space-between;padding:2px 0}
        .total{display:flex;justify-content:space-between;font-weight:bold;font-size:14px;padding:4px 0}
        .small{font-size:11px;color:#333}
        </style></head><body>
        <h1>${settings.storeName || 'Warung Cemilan'}</h1>
        <div class="meta">${settings.address || ''}<br/>${settings.phone || ''}</div>
        <div class="rule"></div>
        <div class="line"><span>${order.id}</span><span>${new Date(order.createdAt).toLocaleString('id-ID')}</span></div>
        <div class="line"><span>Kasir: ${order.kasir}</span><span>${order.method || order.paymentMethod}</span></div>
        <div class="rule"></div>
        ${items}
        <div class="total"><span>Subtotal</span><span>Rp ${order.subtotal.toLocaleString('id-ID')}</span></div>
        ${order.discount ? '<div class="line"><span>Diskon</span><span>-Rp ' + order.discount.toLocaleString('id-ID') + '</span></div>' : ''}
        <div class="line"><span>Pajak (${order.taxRate || 0}%)</span><span>Rp ${(order.tax || 0).toLocaleString('id-ID')}</span></div>
        <div class="rule"></div>
        <div class="total"><span>TOTAL</span><span>Rp ${order.total.toLocaleString('id-ID')}</span></div>
        <div class="line"><span>Bayar</span><span>Rp ${(order.paid || order.total).toLocaleString('id-ID')}</span></div>
        <div class="line"><span>Kembalian</span><span>Rp ${(order.change || 0).toLocaleString('id-ID')}</span></div>
        <div class="rule"></div>
        <div class="meta">Terima kasih atas kunjungan Anda!</div>
        <script>window.onload=function(){window.print()};<\/script>
        </body></html>`);
      w.document.close();
    }).catch((e) => app.toast(e.message, 'error'));
  }

  app.boot(() => {
    // Search input (debounced reset to page 1)
    const searchEl = document.getElementById('ri-search');
    if (searchEl) {
      searchEl.addEventListener('input', app.debounce(function () {
        filters.q = this.value.trim();
        currentPage = 1;
        loadData();
      }, 300));
    }

    // Filter button
    const btnBox = document.getElementById('btn-box');
    if (btnBox) {
      btnBox.addEventListener('click', () => {
        filters.method = document.getElementById('ri-method').value;
        filters.status = document.getElementById('ri-status')?.value || 'Semua';
        currentPage = 1;
        loadData();
      });
    }

    // Refresh button
    const btnRef = document.getElementById('btn-refresh');
    if (btnRef) {
      btnRef.addEventListener('click', () => {
        const icon = btnRef.querySelector('i, svg');
        if (icon) icon.classList.add('animate-spin');
        loadData().finally(() => { if (icon) icon.classList.remove('animate-spin'); });
      });
    }

    // Page size dropdown (10 / 20 / 50 per halaman)
    const selectPageSize = document.getElementById('select-page-size');
    if (selectPageSize) {
      selectPageSize.addEventListener('change', () => {
        pageSize = parseInt(selectPageSize.value, 10) || 10;
        currentPage = 1;
        loadData();
      });
    }

    // Prev / Next Page Buttons
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          loadData();
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          loadData();
        }
      });
    }

    // Window focus & visibility
    window.addEventListener('focus', () => loadData());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadData(); });

    // Modals
    document.querySelectorAll('#detail-modal [data-close]').forEach((el) => el.addEventListener('click', closeDetail));
    const btnPrintDetail = document.getElementById('btn-print-detail');
    if (btnPrintDetail) {
      btnPrintDetail.addEventListener('click', () => { if (currentOrder) printOrder(currentOrder.id); });
    }

    // Initial load
    loadData();
  });
})();