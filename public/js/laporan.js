(function () {
  'use strict';
  const app = window.Warung;
  app.formatT = app.formatRupiah;

  let report = null;
  let currentPeriod = 'custom';
  let filters = { start: '', end: '', kasir: 'Semua', category: 'Semua', period: 'custom' };
  let kasirList = [];
  let catList = [];

  function toDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toDateStr(d);
  }

  function formatFullDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  function initDates() {
    const now = new Date();
    // Default rentang 30 hari terakhir
    filters.start = daysAgo(29);
    filters.end = toDateStr(now);
    document.getElementById('start-date').value = filters.start;
    document.getElementById('end-date').value = filters.end;
  }

  function setPeriod(p) {
    currentPeriod = p;
    filters.period = p;

    // Update styling tabs
    document.querySelectorAll('.period-btn').forEach((btn) => {
      const match = btn.dataset.period === p;
      if (match) {
        btn.className = 'period-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-white text-blue-700 shadow-sm border border-blue-200';
      } else {
        btn.className = 'period-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-gray-600 hover:text-gray-900';
      }
    });

    const now = new Date();
    if (p === 'hari') {
      filters.start = toDateStr(now);
      filters.end = toDateStr(now);
    } else if (p === 'minggu') {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      filters.start = toDateStr(d7);
      filters.end = toDateStr(now);
    } else if (p === 'bulan') {
      const dMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filters.start = toDateStr(dMonth);
      filters.end = toDateStr(now);
    } else if (p === 'tahun') {
      const dYear = new Date(now.getFullYear(), 0, 1);
      filters.start = toDateStr(dYear);
      filters.end = toDateStr(now);
    }

    if (p !== 'custom') {
      document.getElementById('start-date').value = filters.start;
      document.getElementById('end-date').value = filters.end;
    }

    load();
  }

  function loadMeta() {
    const kasirSel = document.getElementById('f-kasir');
    const catSel = document.getElementById('f-cat');

    let loggedInUser = null;
    try {
      loggedInUser = JSON.parse(localStorage.getItem('warung_user'));
    } catch(e) {}

    Promise.all([app.get('api/users'), app.get('api/categories')])
      .then(([u, c]) => {
        kasirList = u.users || [];
        catList = c.categories || [];

        let kasirOpts = '<option value="Semua">Semua Kasir</option>';
        kasirList.forEach((k) => {
          kasirOpts += `<option value="${k.name}">${k.name} (${k.role === 'admin' ? 'Admin' : 'Kasir'})</option>`;
        });
        kasirSel.innerHTML = kasirOpts;

        catSel.innerHTML = '<option value="Semua">Semua Kategori</option>' + catList.map((x) => `<option value="${x.name}">${x.icon || '🛍️'} ${x.name}</option>`).join('');

        // Jika yang login adalah Kasir, otomatis pilih namanya di filter
        if (loggedInUser && loggedInUser.role === 'kasir') {
          const match = kasirList.find((k) => k.name.toLowerCase() === loggedInUser.name.toLowerCase());
          if (match) {
            kasirSel.value = match.name;
            filters.kasir = match.name;
          }
        }
      })
      .catch(() => {});
  }

  function load() {
    filters.start = document.getElementById('start-date').value;
    filters.end = document.getElementById('end-date').value;
    filters.kasir = document.getElementById('f-kasir').value || 'Semua';
    filters.category = document.getElementById('f-cat').value || 'Semua';

    const params = new URLSearchParams();
    if (filters.start) params.set('start', filters.start);
    if (filters.end) params.set('end', filters.end);
    if (filters.kasir !== 'Semua') params.set('kasir', filters.kasir);
    if (filters.category !== 'Semua') params.set('category', filters.category);
    if (currentPeriod !== 'custom') params.set('period', currentPeriod);
    params.set('_t', Date.now());

    return app.get('api/report?' + params.toString())
      .then((d) => {
        report = d;
        render();
      })
      .catch((e) => {
        app.toast(e.message || 'Gagal memuat laporan.', 'error');
        app.clearSkeleton('report-summary', '<div class="col-span-full text-center py-10 text-red-400 text-sm">Gagal memuat ringkasan laporan.</div>');
      });
  }

  function render() {
    if (!report) return;

    // 1. Update Banner Periode
    const sDate = report.period && report.period.start ? report.period.start : filters.start;
    const eDate = report.period && report.period.end ? report.period.end : filters.end;
    const sFormatted = formatFullDate(sDate);
    const eFormatted = formatFullDate(eDate);

    if (sDate === eDate) {
      document.getElementById('banner-date-range').textContent = sFormatted;
    } else {
      document.getElementById('banner-date-range').textContent = `${sFormatted}  s/d  ${eFormatted}`;
    }
    document.getElementById('banner-kasir-name').textContent = filters.kasir === 'Semua' ? 'Semua Kasir' : filters.kasir;

    // 2. Summary Cards
    const cards = [
      { label: 'Penjualan (Omset)', value: app.formatT(report.totalSales), icon: 'trending-up', color: 'blue', sub: report.totalItems + ' item terjual' },
      { label: 'Total Transaksi', value: app.formatNumber(report.totalTransactions), icon: 'receipt', color: 'amber', sub: 'Rata-rata ' + app.formatT(report.summary.avgOrder) },
      { label: 'Modal (HPP)', value: app.formatT(report.totalCost), icon: 'package', color: 'violet', sub: 'Harga pokok modal' },
      { label: 'Laba Bersih', value: app.formatT(report.profit), icon: 'wallet', color: 'green', sub: 'Penjualan dikurangi modal' },
    ];
    const colors = {
      blue: 'bg-blue-100 text-blue-600',
      amber: 'bg-amber-100 text-amber-600',
      violet: 'bg-violet-100 text-violet-600',
      green: 'bg-emerald-100 text-emerald-600'
    };

    document.getElementById('report-summary').innerHTML = cards.map((c) => `
      <div class="relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover-pop">
        <span class="inline-flex items-center justify-center w-10 h-10 rounded-xl ${colors[c.color]} mb-3">
          <i data-lucide="${c.icon}" class="w-5 h-5"></i>
        </span>
        <p class="text-sm text-gray-400 font-medium">${c.label}</p>
        <p class="text-xl font-extrabold text-gray-900 mt-1">${c.value}</p>
        <p class="text-xs text-gray-400 mt-1">${c.sub}</p>
      </div>`).join('');

    // 3. Produk Terlaris
    const bs = report.bestSellers || [];
    document.getElementById('best-sellers').innerHTML = bs.length
      ? bs.slice(0, 5).map((b, i) => `
          <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition">
            <span class="w-6 h-6 rounded-full ${i < 3 ? 'bg-blue-600' : 'bg-gray-200'} text-white text-[11px] font-bold flex items-center justify-center shrink-0 ${i >= 3 ? '!bg-gray-300 !text-gray-500' : ''}">${i + 1}</span>
            <span class="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-lg">${b.emoji || '🛍️'}</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-800 truncate">${b.name}</p>
              <p class="text-xs text-gray-400">${app.formatNumber(b.qty)} terjual</p>
            </div>
            <span class="text-sm font-bold text-gray-800">${app.formatT(b.revenue)}</span>
          </div>`).join('')
      : '<p class="text-sm text-gray-400 text-center py-6">Tidak ada produk terjual.</p>';

    // 4. Metode Pembayaran
    const methods = Object.entries(report.methods || {}).map(([k, v]) => ({ k, v }));
    const total = report.totalSales || 1;
    document.getElementById('method-summary').innerHTML = methods.length ? methods.map((m) => `
      <div>
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="text-gray-500 font-medium">${m.k}</span>
          <span class="text-gray-700 font-semibold">${app.formatT(m.v)} · ${Math.round(m.v / total * 100)}%</span>
        </div>
        <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full bg-blue-500 rounded-full" style="width:${Math.round(m.v / total * 100)}%"></div>
        </div>
      </div>`).join('') : '<p class="text-xs text-gray-400">Belum ada transaksi.</p>';

    // 5. Tabel 1: Rekapitulasi Penghasilan Kasir Harian
    const dailyB = report.dailyBreakdown || [];
    document.getElementById('rekap-count').textContent = dailyB.length + ' hari';
    const rekapRows = document.getElementById('rekap-rows');
    if (!dailyB.length) {
      rekapRows.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-sm text-gray-400">Tidak ada data penghasilan pada periode ini.</td></tr>';
    } else {
      rekapRows.innerHTML = dailyB.map((dg) => `
        <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition">
          <td class="px-6 py-3.5">
            <div class="font-bold text-gray-900">${dg.dayName}, ${dg.dateFormatted}</div>
            <div class="text-[11px] text-gray-400 font-mono mt-0.5">${dg.dateKey}</div>
          </td>
          <td class="px-6 py-3.5">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <i data-lucide="user" class="w-3 h-3"></i> ${dg.kasir}
            </span>
          </td>
          <td class="px-6 py-3.5 text-center">
            <span class="font-bold text-gray-800">${dg.txCount}</span>
            <span class="text-xs text-gray-400 ml-1">(${dg.itemsCount} item)</span>
          </td>
          <td class="px-6 py-3.5 text-right font-extrabold text-blue-600">${app.formatT(dg.totalSales)}</td>
          <td class="px-6 py-3.5 text-right text-gray-500">${app.formatT(dg.totalCost)}</td>
          <td class="px-6 py-3.5 text-right font-extrabold text-emerald-600">${app.formatT(dg.profit)}</td>
        </tr>`).join('');
    }

    // 6. Tabel 2: Catatan Riwayat Transaksi Kasir (Detail Per Penjualan)
    const orders = report.detailedOrders || [];
    document.getElementById('tx-count').textContent = orders.length + ' transaksi';
    const ordersRows = document.getElementById('orders-rows');
    if (!orders.length) {
      ordersRows.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-sm text-gray-400">Tidak ada transaksi pada periode ini.</td></tr>';
    } else {
      ordersRows.innerHTML = orders.map((o) => `
        <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition">
          <td class="px-6 py-3.5 font-bold text-gray-800">${o.id}</td>
          <td class="px-6 py-3.5">
            <div class="font-medium text-gray-800">${o.dayName}, ${o.dateFormatted}</div>
            <div class="text-xs text-gray-400 mt-0.5">${o.timeFormatted}</div>
          </td>
          <td class="px-6 py-3.5">
            <span class="font-semibold text-gray-700">${o.kasir}</span>
          </td>
          <td class="px-6 py-3.5">
            <span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700">${o.method}</span>
          </td>
          <td class="px-6 py-3.5">
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>${o.status}
            </span>
          </td>
          <td class="px-6 py-3.5 text-right font-extrabold text-gray-900">${app.formatT(o.total)}</td>
        </tr>`).join('');
    }

    drawChart();
    lucide.createIcons();
  }

  function drawChart() {
    const canvas = document.getElementById('report-chart');
    if (!window.Chart || !canvas) return;
    document.getElementById('rpt-chart-skel').style.display = 'none';
    if (window.__reportChart) window.__reportChart.destroy();

    const daily = report.daily || [];
    const labels = daily.map((d) => {
      const dt = new Date(d.date + 'T00:00:00');
      return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    });
    const values = daily.map((d) => d.total);

    window.__reportChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: 'rgba(37,99,235,0.75)',
          hoverBackgroundColor: 'rgba(37,99,235,1)',
          borderRadius: 8,
          barPercentage: 0.55
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (c) => {
                const idx = c[0].dataIndex;
                const rawDate = daily[idx] ? daily[idx].date : '';
                return formatFullDate(rawDate);
              },
              label: (c) => ' Penghasilan: ' + app.formatT(c.parsed.y)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226,232,240,0.5)' },
            border: { display: false },
            ticks: { color: '#94a3b8', callback: (v) => app.formatT(v) }
          },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#94a3b8', maxRotation: 0 }
          },
        },
      },
    });
  }

  /* ------------------------------ export ------------------------------ */

  function exportCSV() {
    if (!report) return;
    const rows = [
      ['LAPORAN PENGHASILAN KASIR - WARUNG CEMILAN'],
      ['Periode', formatFullDate(report.period.start) + ' s/d ' + formatFullDate(report.period.end)],
      ['Filter Kasir', filters.kasir],
      ['Total Penjualan', report.totalSales],
      ['Total Modal', report.totalCost],
      ['Laba Bersih', report.profit],
      [],
      ['REKAPITULASI PENGHASILAN HARIAN'],
      ['Hari & Tanggal', 'Kasir', 'Jumlah Transaksi', 'Total Penjualan (Rp)', 'Modal (Rp)', 'Laba Bersih (Rp)']
    ];

    (report.dailyBreakdown || []).forEach((d) => {
      rows.push([
        `${d.dayName}, ${d.dateFormatted}`,
        d.kasir,
        d.txCount,
        d.totalSales,
        d.totalCost,
        d.profit
      ]);
    });

    rows.push([]);
    rows.push(['CATATAN DETAIL TRANSAKSI']);
    rows.push(['No. Invoice', 'Hari, Tanggal & Jam', 'Kasir', 'Metode', 'Total (Rp)']);

    (report.detailedOrders || []).forEach((o) => {
      rows.push([
        o.id,
        `${o.dayName}, ${o.dateFormatted} ${o.timeFormatted}`,
        o.kasir,
        o.method,
        o.total
      ]);
    });

    const csv = '\uFEFF' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `laporan-penghasilan-kasir-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    app.toast('Laporan CSV berhasil diunduh.');
  }

  function exportPDF() {
    if (!report) return;
    const w = window.open('', '_blank');
    if (!w) { app.toast('Izinkan popup untuk mencetak PDF.', 'info'); return; }

    const sDate = formatFullDate(report.period.start);
    const eDate = formatFullDate(report.period.end);
    const periodText = sDate === eDate ? sDate : `${sDate} s/d ${eDate}`;

    const rekapRows = (report.dailyBreakdown || []).map((d) => `
      <tr>
        <td><b>${d.dayName}, ${d.dateFormatted}</b></td>
        <td>${d.kasir}</td>
        <td style="text-align:center">${d.txCount}</td>
        <td style="text-align:right">Rp ${d.totalSales.toLocaleString('id-ID')}</td>
        <td style="text-align:right">Rp ${d.totalCost.toLocaleString('id-ID')}</td>
        <td style="text-align:right;font-weight:bold;color:#16a34a">Rp ${d.profit.toLocaleString('id-ID')}</td>
      </tr>
    `).join('');

    w.document.write(`<!DOCTYPE html><html><head><title>Laporan Penghasilan Kasir</title><style>
      body{font-family:Arial,sans-serif;color:#111;padding:28px;font-size:12px;line-height:1.5}
      h1{font-size:18px;margin:0 0 4px;color:#1e3a8a}
      .meta{color:#555;font-size:11px;margin-bottom:20px}
      .summary-box{display:flex;gap:12px;margin:16px 0}
      .card{flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:12px;background:#f8fafc}
      .card-title{font-size:11px;color:#64748b;font-weight:bold;text-transform:uppercase}
      .card-val{font-size:16px;font-weight:bold;margin-top:4px}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:11px}
      th,td{border:1px solid #e2e8f0;padding:8px 10px}
      th{background:#f1f5f9;font-weight:bold;color:#334155;text-align:left}
      .section-title{font-size:13px;font-weight:bold;margin-top:24px;border-bottom:2px solid #e2e8f0;padding-bottom:6px}
    </style></head><body>
      <h1>LAPORAN PENGHASILAN KASIR — WARUNG CEMILAN</h1>
      <div class="meta">
        <b>Periode:</b> ${periodText}<br/>
        <b>Kasir:</b> ${filters.kasir}<br/>
        <b>Dicetak pada:</b> ${formatFullDate(new Date().toISOString())} ${new Date().toLocaleTimeString('id-ID')} WIB
      </div>

      <div class="summary-box">
        <div class="card">
          <div class="card-title">Total Penjualan</div>
          <div class="card-val" style="color:#2563eb">Rp ${report.totalSales.toLocaleString('id-ID')}</div>
        </div>
        <div class="card">
          <div class="card-title">Total Modal (HPP)</div>
          <div class="card-val">Rp ${report.totalCost.toLocaleString('id-ID')}</div>
        </div>
        <div class="card">
          <div class="card-title">Laba Bersih</div>
          <div class="card-val" style="color:#16a34a">Rp ${report.profit.toLocaleString('id-ID')}</div>
        </div>
        <div class="card">
          <div class="card-title">Total Transaksi</div>
          <div class="card-val">${report.totalTransactions} Transaksi</div>
        </div>
      </div>

      <div class="section-title">REKAPITULASI PENGHASILAN HARIAN (HARI, TANGGAL, BULAN, TAHUN)</div>
      <table>
        <thead>
          <tr>
            <th>Hari & Tanggal</th>
            <th>Kasir</th>
            <th style="text-align:center">Transaksi</th>
            <th style="text-align:right">Penjualan</th>
            <th style="text-align:right">Modal</th>
            <th style="text-align:right">Laba Bersih</th>
          </tr>
        </thead>
        <tbody>
          ${rekapRows || '<tr><td colspan="6" style="text-align:center">Tidak ada data.</td></tr>'}
        </tbody>
      </table>

      <script>window.onload=function(){window.print()};<\/script>
    </body></html>`);
    w.document.close();
  }

  /* ------------------------------ boot ------------------------------ */

  app.boot(() => {
    initDates();
    loadMeta();

    document.querySelectorAll('.period-btn').forEach((btn) => {
      btn.addEventListener('click', () => setPeriod(btn.dataset.period));
    });

    document.getElementById('btn-filter').addEventListener('click', () => {
      currentPeriod = 'custom';
      document.querySelectorAll('.period-btn').forEach((btn) => {
        const match = btn.dataset.period === 'custom';
        btn.className = match
          ? 'period-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-white text-blue-700 shadow-sm border border-blue-200'
          : 'period-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-gray-600 hover:text-gray-900';
      });
      load();
    });

    document.getElementById('btn-refresh').addEventListener('click', () => {
      load().then(() => app.toast('Laporan berhasil disegarkan.'));
    });

    document.getElementById('btn-pdf').addEventListener('click', exportPDF);
    document.getElementById('btn-excel').addEventListener('click', exportCSV);

    load();
  });
})();
