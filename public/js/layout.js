(function () {
  'use strict';

  const app = window.Warung;

  const NAV = [
    { key: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', href: 'dashboard.html' },
    { key: 'kasir', label: 'Kasir', icon: 'shopping-cart', href: 'kasir.html' },
    {
      group: 'Master',
      children: [
        { key: 'produk', label: 'Produk', icon: 'package', href: 'produk.html' },
        { key: 'kategori', label: 'Kategori', icon: 'tags', href: 'kategori.html' },
        { key: 'supplier', label: 'Supplier', icon: 'truck', href: 'supplier.html' },
        { key: 'pelanggan', label: 'Pelanggan', icon: 'users', href: 'pelanggan.html' },
      ],
    },
    { key: 'transaksi', label: 'Riwayat', icon: 'receipt', href: 'transaksi.html' },
    { key: 'laporan', label: 'Laporan', icon: 'bar-chart-3', href: 'laporan.html' },
    { key: 'stok', label: 'Stok', icon: 'boxes', href: 'stok.html' },
    { key: 'pengguna', label: 'Pengguna', icon: 'user-cog', href: 'pengguna.html' },
    { key: 'pengaturan', label: 'Pengaturan', icon: 'settings', href: 'pengaturan.html' },
  ];

  const TITLES = {
    dashboard: 'Dashboard', kasir: 'Kasir', produk: 'Produk', kategori: 'Kategori',
    supplier: 'Supplier', pelanggan: 'Pelanggan', transaksi: 'Riwayat',
    laporan: 'Laporan Penjualan', stok: 'Stok Produk', pengguna: 'Pengguna', pengaturan: 'Pengaturan',
  };

  function currentPage() {
    return document.body.dataset.page || 'dashboard';
  }

  function getCurrentUser() {
    try {
      const stored = localStorage.getItem('warung_user');
      if (stored) return JSON.parse(stored);
    } catch(e) {}
    return null;
  }

  function checkAuth() {
    const user = getCurrentUser();
    if (!user) {
      window.location.href = 'index.html';
      return null;
    }
    const page = currentPage();
    if (user.role === 'kasir') {
      const allowed = ['kasir', 'transaksi', 'laporan'];
      if (!allowed.includes(page)) {
        window.location.href = 'kasir.html';
        return null;
      }
    }
    return user;
  }

  function itemHTML(key, p) {
    const active = key === currentPage();
    const base = 'nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600';
    return `
      <a href="${p.href}" class="${base} ${active ? 'active' : ''}">
        <i data-lucide="${p.icon}" class="w-5 h-5 shrink-0"></i>
        <span class="flex-1">${p.label}</span>
        ${active ? '<span class="w-1.5 h-1.5 rounded-full bg-white"></span>' : ''}
      </a>`;
  }

  function navHTML() {
    const user = getCurrentUser();
    const isKasir = user && user.role === 'kasir';

    const list = isKasir ? [
      { key: 'kasir', label: 'Kasir (POS)', icon: 'shopping-cart', href: 'kasir.html' },
      { key: 'transaksi', label: 'Riwayat Transaksi', icon: 'receipt', href: 'transaksi.html' },
      { key: 'laporan', label: 'Laporan Penghasilan', icon: 'bar-chart-3', href: 'laporan.html' },
    ] : NAV;

    return list.map((item) => {
      if (item.group) {
        return `
          <div class="pt-4">
            <p class="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">${item.group}</p>
            <div class="space-y-1">${item.children.map((c) => itemHTML(c.key, c)).join('')}</div>
          </div>`;
      }
      return itemHTML(item.key, item);
    }).join('');
  }

  function sidebarHTML() {
    return `
      <div class="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 bg-white border-r border-gray-100 z-40 transition-transform duration-300 lg:translate-x-0" id="sidebar-inner">
        ${sidebarBody()}
      </div>
      <div class="fixed inset-0 z-40 lg:hidden hidden" id="sidebar-overlay"></div>
      <aside class="fixed inset-y-0 left-0 z-50 w-72 -translate-x-full lg:hidden transition-transform duration-300 bg-white shadow-2xl flex flex-col" id="sidebar-mobile">
        ${sidebarBody()}
      </aside>`;
  }

  function sidebarBody() {
    const user = getCurrentUser() || { name: 'Admin Warung', role: 'admin' };
    const isAdmin = user.role === 'admin';
    const roleLabel = isAdmin ? 'Administrator' : 'Kasir';
    const roleColor = isAdmin ? 'bg-blue-600' : 'bg-emerald-600';
    const roleBadge = isAdmin
      ? '<span class="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">Admin</span>'
      : '<span class="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Kasir</span>';
    const initials = (user.name || 'U').substring(0, 2).toUpperCase();

    return `
      <div class="flex items-center gap-3 px-5 pt-6 pb-5">
        <div class="w-11 h-11 rounded-xl bg-gradient-to-br ${isAdmin ? 'from-blue-600 to-indigo-600' : 'from-emerald-600 to-teal-500'} flex items-center justify-center text-white shadow-lg ${isAdmin ? 'shadow-blue-600/30' : 'shadow-emerald-600/30'}">
          <i data-lucide="${isAdmin ? 'store' : 'shopping-bag'}" class="w-6 h-6"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-bold text-gray-900 leading-tight truncate" data-store-name>Warung Cemilan</p>
          <div class="flex items-center gap-1.5 mt-0.5">
            ${roleBadge}
          </div>
        </div>
      </div>
      <div class="mx-5 h-px bg-gray-100"></div>
      <nav class="flex-1 px-3 py-4 overflow-y-auto no-scrollbar">
        <p class="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          ${isAdmin ? 'Menu Administrator' : 'Menu Kasir'}
        </p>
        ${navHTML()}
      </nav>
      <div class="p-4 border-t border-gray-100">
        <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
          <div class="w-9 h-9 rounded-full ${roleColor} text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">${initials}</div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-800 truncate">${user.name || 'Pengguna'}</p>
            <p class="text-xs text-gray-400 truncate">${roleLabel}</p>
          </div>
          <button id="btn-logout" title="Keluar" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
            <i data-lucide="log-out" class="w-4 h-4"></i>
          </button>
        </div>
      </div>`;
  }

  function topbarHTML() {
    const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const pageLabel = TITLES[currentPage()] || 'Dashboard';
    const user = getCurrentUser() || { role: 'admin' };
    const isAdmin = user.role === 'admin';

    return `
      <div class="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-100">
        <div class="flex items-center gap-3 px-4 sm:px-6 lg:px-8 h-16">
          <button id="btn-drawer" class="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 transition">
            <i data-lucide="menu" class="w-6 h-6"></i>
          </button>
          <div class="min-w-0">
            <h1 class="text-lg font-bold text-gray-900 leading-tight">${pageLabel}</h1>
            <p class="text-xs text-gray-400 hidden sm:block capitalize">${today}</p>
          </div>
          <div class="flex-1"></div>
          ${isAdmin ? `
          <a href="kasir.html" class="hidden md:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-md shadow-blue-600/25 transition">
            <i data-lucide="shopping-cart" class="w-4 h-4"></i> Kasir
          </a>` : `
          <div class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Mode Kasir
          </div>
          `}
        </div>
      </div>`;
  }

  function footerHTML() {
    return `
      <footer class="px-4 sm:px-6 lg:px-8 py-5">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-gray-100 pt-5">
          <p class="text-xs text-gray-400">© ${new Date().getFullYear()} <span data-store-name>Warung Cemilan</span> — Aplikasi Penjualan</p>
          <p class="text-xs text-gray-400 flex items-center gap-1.5">
            <i data-lucide="heart" class="w-3.5 h-3.5 text-red-400"></i>
            Dibuat dengan Tailwind & Lucide
          </p>
        </div>
      </footer>`;
  }

  function initShell() {
    const user = checkAuth();
    if (!user) return;

    document.getElementById('sidebar').innerHTML = sidebarHTML();
    document.getElementById('topbar').innerHTML = topbarHTML();
    document.getElementById('footer').innerHTML = footerHTML();

    const mobile = document.getElementById('sidebar-mobile');
    const overlay = document.getElementById('sidebar-overlay');
    function openDrawer() {
      mobile && mobile.classList.remove('-translate-x-full');
      overlay && overlay.classList.remove('hidden');
    }
    function closeDrawer() {
      mobile && mobile.classList.add('-translate-x-full');
      overlay && overlay.classList.add('hidden');
    }
    document.getElementById('btn-drawer')?.addEventListener('click', openDrawer);
    overlay?.addEventListener('click', closeDrawer);

    document.querySelectorAll('#btn-logout').forEach((b) => {
      b.addEventListener('click', () => {
        app.confirm({
          title: 'Keluar Aplikasi',
          message: 'Anda yakin ingin keluar dari sesi ini?',
          confirmText: 'Keluar',
          danger: true,
          onConfirm: () => {
            localStorage.removeItem('warung_user');
            window.location.href = 'index.html';
          }
        });
      });
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Ambil nama warung dari pengaturan supaya sidebar & footer ikut berubah
    if (typeof app.get === 'function') {
      app.get('api/settings')
        .then((s) => app.applyStoreName(s && s.storeName))
        .catch(() => {});
    }
  }

  app.applyStoreName = function (name) {
    const n = String(name || '').trim() || 'Warung Cemilan';
    document.querySelectorAll('[data-store-name]').forEach((el) => { el.textContent = n; });
  };

  app.renderShell = function () {
    initShell();
  };
})();
