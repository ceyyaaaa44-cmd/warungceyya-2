'use strict';

const path = require('path');
const express = require('express');
const db = require('./firestore-db');

const app = express();
const PORT = process.env.PORT || 3000;

const DEFAULT_USER = { id: 'usr_admin', name: 'Admin Warung', username: 'admin', role: 'admin' };

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Disable caching for all API endpoints so updates always show immediately
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

function requireAuth(req, res, next) {
  req.user = DEFAULT_USER;
  next();
}

/* ----------------------- public customer endpoints ----------------------- */

app.get(['/katalog', '/menu', '/belanja', '/toko'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'katalog.html'));
});

// Profil informasi toko untuk pelanggan (bebas dari data rahasia internal)
app.get('/api/public/store', async (req, res) => {
  await db.syncSettings();
  const s = db.getDB().settings || {};
  res.json({
    storeName: s.storeName || 'Warung Cemilan',
    tagline: s.tagline || 'Aneka makanan & minuman segar',
    address: s.address || '',
    phone: s.phone || '',
    logo: s.logo || '🏪'
  });
});

// Daftar kategori produk untuk pelanggan
app.get('/api/public/categories', async (req, res) => {
  await db.syncCollection('categories');
  const list = (db.getDB().categories || []).map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon || '🗂️',
    color: c.color || '#64748b'
  }));
  res.json({ categories: list });
});

// Katalog produk untuk pelanggan (hanya produk aktif, tanpa harga modal/HPP/margin keuntungan)
app.get('/api/public/products', async (req, res) => {
  await Promise.all([db.syncCollection('products'), db.syncCollection('categories')]);
  const { q, catId } = req.query;
  let list = (db.getDB().products || []).filter((p) => p.status === 'aktif');
  const toys = (s) => String(s || '').toLowerCase();
  if (q) {
    const needle = toys(q);
    list = list.filter((p) => toys(p.name).includes(needle));
  }
  if (catId && catId !== 'Semua') {
    list = list.filter((p) => p.categoryId === catId);
  }
  res.json({ products: list.map(db.customerProduct) });
});

// Ulasan untuk toko: lihat review pelanggan & statistik rating
app.get('/api/public/reviews', async (req, res) => {
  await db.syncCollection('reviews');
  if (db.ensureReviews) db.ensureReviews();
  const reviews = (db.getDB().reviews || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total = reviews.length;
  const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
  const avg = total > 0 ? (sum / total) : 5;
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    const star = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5)));
    counts[star] = (counts[star] || 0) + 1;
  });
  res.json({
    reviews,
    stats: {
      average: Math.round(avg * 10) / 10,
      total,
      counts
    }
  });
});

// Kirim ulasan toko oleh pelanggan
app.post('/api/public/reviews', async (req, res) => {
  const { name, rating, comment } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanComment = String(comment || '').trim();
  const numRating = parseInt(rating, 10);

  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ error: 'Nama minimal 2 karakter.' });
  }
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating harus antara 1 sampai 5 bintang.' });
  }
  if (!cleanComment || cleanComment.length < 3) {
    return res.status(400).json({ error: 'Ulasan minimal 3 karakter.' });
  }

  const review = {
    id: db.uid('rev_'),
    name: cleanName.slice(0, 50),
    rating: numRating,
    comment: cleanComment.slice(0, 500),
    createdAt: db.now()
  };

  if (!Array.isArray(db.getDB().reviews)) {
    db.getDB().reviews = [];
  }
  db.getDB().reviews.push(review);
  await db.addDoc('reviews', review);
  res.status(201).json({ review });
});

// Buat pesanan langsung dari web oleh pelanggan
app.post('/api/public/orders', async (req, res) => {
  await Promise.all([db.syncSettings(), db.syncCollection('products'), db.syncCollection('orders')]);
  const d = db.getDB();
  const { customerName, customerPhone, deliveryMethod, address, tableNo, paymentMethod, notes, items } = req.body || {};

  const cleanName = String(customerName || '').trim();
  const cleanPhone = String(customerPhone || '').replace(/[^0-9+\s-]/g, '').trim();
  let cleanMethod = 'Makan di Tempat';
  if (deliveryMethod === 'Take Away') {
    cleanMethod = 'Take Away';
  } else if (deliveryMethod === 'Antar / Kirim') {
    cleanMethod = 'Antar / Kirim';
  } else if (deliveryMethod === 'Makan di Tempat') {
    cleanMethod = 'Makan di Tempat';
  } else {
    cleanMethod = 'Take Away';
  }

  const cleanTableNo = (cleanMethod === 'Makan di Tempat' && tableNo) ? String(tableNo).trim() : '';
  const cleanAddress = cleanMethod === 'Antar / Kirim' ? String(address || '').trim() : '';
  const ALLOWED_PAYMENT = ['QRIS', 'Transfer', 'Tunai'];
  const cleanPayment = ALLOWED_PAYMENT.includes(paymentMethod) ? paymentMethod : 'QRIS';
  const cleanNotes = String(notes || '').trim().slice(0, 300);

  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ error: 'Nama pemesan minimal 2 karakter.' });
  }
  if (!cleanPhone || cleanPhone.length < 8) {
    return res.status(400).json({ error: 'Nomor WhatsApp / HP tidak valid (minimal 8 angka).' });
  }
  if (cleanMethod === 'Antar / Kirim' && (!cleanAddress || cleanAddress.length < 5)) {
    return res.status(400).json({ error: 'Alamat pengantaran wajib diisi lengkap.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Keranjang pesanan masih kosong.' });
  }

  const cleanedItems = [];
  let subtotal = 0;

  for (const it of items) {
    const prod = d.products.find((p) => p.id === it.productId && p.status === 'aktif');
    if (!prod) {
      return res.status(400).json({ error: 'Produk tidak ditemukan atau sudah tidak aktif.' });
    }
    const qty = parseInt(it.qty, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: `Jumlah pesanan untuk ${prod.name} tidak valid.` });
    }
    if (prod.stock < qty) {
      return res.status(400).json({ error: `Stok ${prod.name} tidak mencukupi (sisa ${prod.stock}).` });
    }

    // Perhitungan Level Kepedasan (Khusus Enoci Pedec, Chikiwings, Bacic, Topoccii, dll)
    const isSpicy = prod.hasSpicyLevel || (db.isSpicyProduct && db.isSpicyProduct(prod));
    let spicyLevel = null;
    let extraPrice = 0;
    if (isSpicy && it.spicyLevel != null) {
      spicyLevel = parseInt(it.spicyLevel, 10);
      if (!isNaN(spicyLevel) && spicyLevel >= 1) {
        if (spicyLevel > 5) {
          extraPrice = (spicyLevel - 5) * 2000;
        }
      } else {
        spicyLevel = null;
      }
    }

    const isVariantItem = prod.hasVariants || (db.isPizzaProduct && db.isPizzaProduct(prod)) || (db.isBurgerProduct && db.isBurgerProduct(prod)) || (db.isMartabakProduct && db.isMartabakProduct(prod)) || (db.isRotiBakarProduct && db.isRotiBakarProduct(prod)) || (db.isVariantProduct && db.isVariantProduct(prod));
    const variant = (isVariantItem && it.variant) ? String(it.variant).trim() : (it.variant ? String(it.variant).trim() : null);

    const unitPrice = prod.price + extraPrice;
    const itemTotal = unitPrice * qty;

    let displayName = prod.name;
    if (variant) {
      displayName += ` (${variant})`;
    }
    if (spicyLevel) {
      displayName += ` (Level ${spicyLevel}${extraPrice > 0 ? ` +Rp ${extraPrice.toLocaleString('id-ID')}` : ''})`;
    }
    const itemNote = String(it.note || it.notes || it.spicyNote || it.variantNote || '').trim();
    if (itemNote) {
      displayName += ` [${itemNote}]`;
    }

    cleanedItems.push({
      productId: prod.id,
      productName: displayName,
      productEmoji: prod.emoji || '🛍️',
      qty,
      price: unitPrice,
      basePrice: prod.price,
      variant: variant || null,
      spicyLevel,
      extraPrice,
      spicyNote: it.spicyNote ? String(it.spicyNote).trim() : '',
      note: itemNote || null,
      modal: prod.modal || Math.round(prod.price * 0.6),
      total: itemTotal,
    });
    subtotal += itemTotal;
  }

  const orderId = db.nextInvoiceNo();
  const now = db.now();

  const order = {
    id: orderId,
    channel: 'web',
    customerName: cleanName,
    customerPhone: cleanPhone,
    deliveryMethod: cleanTableNo ? `${cleanMethod} (${cleanTableNo})` : cleanMethod,
    tableNo: cleanTableNo || null,
    address: cleanAddress,
    paymentMethod: cleanPayment,
    method: cleanPayment,
    notes: cleanNotes,
    items: cleanedItems,
    subtotal,
    discount: 0,
    taxRate: 0,
    tax: 0,
    total: subtotal,
    paid: cleanPayment === 'Tunai' ? 0 : subtotal,
    change: 0,
    status: 'Pesanan Baru (Web)',
    kasir: `Web (${cleanName})`,
    createdAt: now,
  };

  d.orders.unshift(order);

  // Potong stok dan simpan
  const saves = [db.addDoc('orders', order), db.saveSettings()];
  const stockEntries = [];
  const txEntries = [];

  cleanedItems.forEach((it) => {
    const prod = d.products.find((x) => x.id === it.productId);
    if (prod) {
      prod.stock = Math.max(0, prod.stock - it.qty);
      prod.updatedAt = now;
      saves.push(db.updateDoc('products', prod.id, prod));

      const stk = {
        id: db.uid('stk_'),
        productId: it.productId,
        productName: it.productName,
        productEmoji: it.productEmoji,
        type: 'keluar',
        qty: it.qty,
        reason: 'Pesanan Web ' + order.id,
        user: `Web (${cleanName})`,
        createdAt: now,
      };
      stockEntries.push(stk);
      d.stockHistory.unshift(stk);
      saves.push(db.addDoc('stockHistory', stk));
    }

    const tx = {
      id: db.uid('trx_'),
      invoiceNo: order.id,
      productId: it.productId,
      productName: it.productName,
      productEmoji: it.productEmoji,
      qty: it.qty,
      price: it.price,
      modal: it.modal,
      total: it.total,
      status: 'Lunas',
      method: cleanPayment,
      kasir: `Web (${cleanName})`,
      createdAt: now,
    };
    txEntries.push(tx);
    d.transactions.unshift(tx);
    saves.push(db.addDoc('transactions', tx));
  });

  await Promise.all(saves);

  // Kirim data pesanan yang aman untuk pelanggan (tanpa modal)
  res.status(201).json({
    ok: true,
    order: {
      id: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryMethod: order.deliveryMethod,
      address: order.address,
      paymentMethod: order.paymentMethod,
      notes: order.notes,
      items: order.items.map((it) => ({
        productName: it.productName,
        productEmoji: it.productEmoji,
        variant: it.variant || null,
        note: it.note || null,
        qty: it.qty,
        price: it.price,
        total: it.total,
      })),
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
    },
    store: {
      storeName: d.settings.storeName,
      phone: d.settings.phone,
      address: d.settings.address,
    }
  });
});

// Cek status pesanan oleh pelanggan berdasarkan ID Pesanan
app.get('/api/public/orders/:id', async (req, res) => {
  await db.syncCollection('orders');
  const o = db.getDB().orders.find((x) => x.id.toLowerCase() === req.params.id.toLowerCase());
  if (!o) return res.status(404).json({ error: 'Nomor pesanan tidak ditemukan.' });

  res.json({
    order: {
      id: o.id,
      customerName: o.customerName || (o.kasir && o.kasir.includes('Web') ? o.kasir : 'Pelanggan'),
      deliveryMethod: o.deliveryMethod || 'Ambil di Warung',
      address: o.address || '',
      paymentMethod: o.paymentMethod || o.method,
      notes: o.notes || '',
      items: (o.items || []).map((it) => ({
        productName: it.productName,
        productEmoji: it.productEmoji,
        variant: it.variant || null,
        note: it.note || null,
        qty: it.qty,
        price: it.price,
        total: it.total,
      })),
      total: o.total,
      status: o.status,
      createdAt: o.createdAt,
    }
  });
});

/* ------------------------------ settings ------------------------------ */

app.get('/api/db-status', (req, res) => {
  res.json({
    status: db.getInitStatus ? db.getInitStatus() : null,
    useFirestore: db.useFirestore
  });
});

app.get('/api/settings', async (req, res) => {
  await db.syncSettings();
  res.json(db.getDB().settings);
});

app.put('/api/settings', async (req, res) => {
  const s = db.getDB().settings;
  const allowed = ['storeName', 'tagline', 'address', 'phone', 'logo', 'printer'];
  allowed.forEach((k) => { if (req.body[k] !== undefined) s[k] = req.body[k]; });
  if (req.body.taxRate !== undefined) s.taxRate = Number(req.body.taxRate) || 0;
  if (req.body.discountDefault !== undefined) s.discountDefault = Number(req.body.discountDefault) || 0;
  await db.saveSettings();
  res.json(s);
});

app.get('/api/backup', (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="warung-backup-' + Date.now() + '.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(db.getDB(), null, 2));
});

app.post('/api/restore', async (req, res) => {
  const data = req.body && req.body.data;
  if (!data) return res.status(400).json({ error: 'Data backup kosong.' });
  try {
    const obj = typeof data === 'string' ? JSON.parse(data) : data;
    if (!Array.isArray(obj.products)) return res.status(400).json({ error: 'File backup tidak valid.' });
    const d = db.getDB();
    if (obj.settings) Object.assign(d.settings, obj.settings);
    d.categories = obj.categories || [];
    d.products = obj.products || [];
    d.suppliers = obj.suppliers || [];
    d.customers = obj.customers || [];
    d.users = obj.users || [];
    d.orders = obj.orders || [];
    d.transactions = obj.transactions || [];
    d.stockHistory = obj.stockHistory || [];
    await db.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'File backup tidak valid.' });
  }
});

/* ------------------------------ dashboard ------------------------------ */

app.get('/api/dashboard', requireAuth, async (req, res) => {
  await Promise.all([db.syncCollection('products'), db.syncCollection('transactions')]);
  const { products, transactions } = db.getDB();
  const today = db.todayKey();

  const todayTx = transactions.filter((t) => db.dayKeyOf(t.createdAt) === today);
  const todaySales = todayTx.reduce((a, t) => a + t.total, 0);
  const revenue = transactions.reduce((a, t) => a + t.total, 0);
  const txCount = transactions.length;
  const stockCount = products.reduce((a, p) => a + p.stock, 0);

  const chartLabels = [];
  const chartValues = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = db.dayKeyOf(d);
    const sum = transactions.filter((t) => db.dayKeyOf(t.createdAt) === key).reduce((a, t) => a + t.total, 0);
    chartLabels.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
    chartValues.push(sum);
  }

  const soldMap = {};
  transactions.forEach((t) => {
    if (!soldMap[t.productId]) soldMap[t.productId] = { name: t.productName, emoji: t.productEmoji, qty: 0, revenue: 0 };
    soldMap[t.productId].qty += t.qty;
    soldMap[t.productId].revenue += t.total;
  });
  const bestSellers = Object.values(soldMap).sort((a, b) => b.qty - a.qty).slice(0, 5);

  res.json({
    stats: {
      todaySales,
      todayOrders: todayTx.length,
      revenue,
      transactions: txCount,
      totalProducts: products.length,
      stockCount,
      avgOrder: txCount ? Math.round(revenue / txCount) : 0,
    },
    chartLabels,
    chartValues,
    bestSellers,
  });
});

/* ------------------------------ categories ------------------------------ */

function publicCategory(c) {
  const d = db.getDB();
  const count = d.products.filter((p) => p.categoryId === c.id).length;
  return { id: c.id, name: c.name, icon: c.icon || '🗂️', color: c.color || '#64748b', count, createdAt: c.createdAt };
}

app.get('/api/categories', async (req, res) => {
  await Promise.all([db.syncCollection('categories'), db.syncCollection('products')]);
  res.json({ categories: db.getDB().categories.map(publicCategory) });
});

app.post('/api/categories', async (req, res) => {
  const { name, icon, color } = req.body || {};
  const clean = String(name || '').trim();
  if (!clean) return res.status(400).json({ error: 'Nama kategori wajib diisi.' });
  const cat = { id: db.uid('cat_'), name: clean, icon: icon || '🗂️', color: color || '#64748b', createdAt: db.now() };
  db.getDB().categories.push(cat);
  await db.addDoc('categories', cat);
  res.status(201).json({ category: publicCategory(cat) });
});

app.put('/api/categories/:id', async (req, res) => {
  const cat = db.getDB().categories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: 'Kategori tidak ditemukan.' });
  const { name, icon, color } = req.body || {};
  if (name !== undefined) {
    const n = String(name).trim();
    if (!n) return res.status(400).json({ error: 'Nama tidak boleh kosong.' });
    cat.name = n;
  }
  if (icon !== undefined) cat.icon = icon;
  if (color !== undefined) cat.color = color;
  await db.updateDoc('categories', cat.id, cat);
  res.json({ category: publicCategory(cat) });
});

app.delete('/api/categories/:id', async (req, res) => {
  const d = db.getDB();
  const idx = d.categories.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Kategori tidak ditemukan.' });
  const using = d.products.filter((p) => p.categoryId === req.params.id).length;
  if (using) return res.status(400).json({ error: 'Kategori masih dipakai ' + using + ' produk.' });
  d.categories.splice(idx, 1);
  await db.deleteDoc('categories', req.params.id);
  res.json({ ok: true });
});

/* ------------------------------ products ------------------------------ */

function enrichProduct(p) {
  const out = db.publicProduct(p);
  out.sold = db.getDB().transactions.filter((t) => t.productId === p.id).reduce((a, t) => a + t.qty, 0);
  out.stockValue = p.price * p.stock;
  return out;
}

app.get('/api/products', async (req, res) => {
  await Promise.all([db.syncCollection('products'), db.syncCollection('categories')]);
  const { q, catId, status } = req.query;
  let list = db.getDB().products.slice();
  const toys = (s) => String(s || '').toLowerCase();
  if (q) {
    const needle = toys(q);
    list = list.filter((p) => toys(p.name).includes(needle) || toys(p.barcode).includes(needle));
  }
  if (catId && catId !== 'Semua') list = list.filter((p) => p.categoryId === catId);
  if (status && status !== 'Semua') list = list.filter((p) => p.status === status);
  res.json({ products: list.map(enrichProduct), categories: db.getDB().categories.map((c) => c.name) });
});

app.get('/api/products-full', async (req, res) => {
  await Promise.all([db.syncCollection('products'), db.syncCollection('categories')]);
  res.json({ products: db.getDB().products.map(enrichProduct) });
});

const isValidCat = (id) => db.getDB().categories.some((c) => c.id === id);

function parseProductBody(body, existing) {
  const out = {};
  const { name, price, modal, stock, unit, barcode, categoryId, emoji, image, status } = body || {};
  if (name !== undefined) {
    const n = String(name).trim();
    if (!n) return { error: 'Nama produk wajib diisi.' };
    out.name = n;
  }
  const num = (v) => { const x = parseInt(v, 10); return isNaN(x) ? null : x; };
  const p = num(price);
  if (price !== undefined || existing) { if (p === null || p < 0) return { error: 'Harga tidak valid.' }; out.price = p; }
  const m = num(modal);
  if (modal !== undefined) { if (m === null || m < 0) return { error: 'Modal tidak valid.' }; out.modal = m; }
  const s = num(stock);
  if (stock !== undefined) { if (s === null || s < 0) return { error: 'Stok tidak valid.' }; out.stock = s; }
  if (categoryId !== undefined) { if (!isValidCat(categoryId)) return { error: 'Kategori tidak valid.' }; out.categoryId = categoryId; }
  if (unit !== undefined) out.unit = String(unit).trim() || 'Pcs';
  if (barcode !== undefined) out.barcode = String(barcode).trim();
  if (emoji !== undefined) out.emoji = String(emoji || '🛍️').trim();
  if (image !== undefined) out.image = String(image || '').trim();
  if (status !== undefined) out.status = status === 'nonaktif' ? 'nonaktif' : 'aktif';
  if (body && body.createdBy !== undefined) {
    if (typeof body.createdBy === 'object' && body.createdBy !== null) {
      out.createdBy = {
        name: String(body.createdBy.name || 'Kasir').trim(),
        role: String(body.createdBy.role || 'kasir').trim(),
        at: body.createdBy.at || db.now()
      };
    } else if (typeof body.createdBy === 'string' && body.createdBy.trim()) {
      out.createdBy = {
        name: body.createdBy.trim(),
        role: 'kasir',
        at: db.now()
      };
    }
  }
  if (body && body.hasSpicyLevel !== undefined) {
    out.hasSpicyLevel = body.hasSpicyLevel === true || body.hasSpicyLevel === 'true';
    if (out.hasSpicyLevel) {
      out.spicyConfig = body.spicyConfig || { minLevel: 1, maxDefaultLevel: 5, extraLevelPrice: 2000 };
    }
  }
  return out;
}

app.post('/api/products', async (req, res) => {
  const first = db.getDB().categories[0];
  const parsed = parseProductBody({
    ...req.body,
    price: req.body.price || 0,
    stock: req.body.stock || 0,
    modal: req.body.modal || 0,
    categoryId: req.body.categoryId || (first ? first.id : ''),
  });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const defaultCreator = req.body.createdBy || (req.user ? { name: req.user.name, role: req.user.role || 'admin', at: db.now() } : { name: 'Admin Warung', role: 'admin', at: db.now() });
  const p = {
    id: db.uid('prd_'),
    name: parsed.name,
    emoji: parsed.emoji || '🛍️',
    image: parsed.image || '',
    categoryId: parsed.categoryId || '',
    price: parsed.price,
    modal: parsed.modal || 0,
    stock: parsed.stock || 0,
    unit: parsed.unit || 'Pcs',
    barcode: parsed.barcode || '',
    status: parsed.status || 'aktif',
    hasSpicyLevel: parsed.hasSpicyLevel || false,
    spicyConfig: parsed.spicyConfig || null,
    createdBy: parsed.createdBy || defaultCreator,
    createdAt: db.now(),
    updatedAt: db.now(),
  };
  db.getDB().products.push(p);
  await db.addDoc('products', p);
  res.status(201).json({ product: enrichProduct(p) });
});

app.put('/api/products/:id', async (req, res) => {
  const p = db.getDB().products.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  const parsed = parseProductBody(req.body, p);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  Object.assign(p, parsed);
  p.updatedAt = db.now();
  await db.updateDoc('products', p.id, p);
  res.json({ product: enrichProduct(p) });
});

app.delete('/api/products/:id', async (req, res) => {
  const d = db.getDB();
  const idx = d.products.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  d.products.splice(idx, 1);
  await db.deleteDoc('products', req.params.id);
  res.json({ ok: true });
});

/* ------------------------------ stock ------------------------------ */

app.post('/api/products/:id/stock', requireAuth, async (req, res) => {
  const d = db.getDB();
  const p = d.products.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  const { type, qty, reason } = req.body || {};
  const n = parseInt(qty, 10);
  if (!['masuk', 'keluar'].includes(type)) return res.status(400).json({ error: 'Tipe stok tidak valid.' });
  if (isNaN(n) || n <= 0) return res.status(400).json({ error: 'Jumlah stok tidak valid.' });
  if (type === 'keluar' && p.stock - n < 0) return res.status(400).json({ error: 'Stok tidak mencukupi.' });
  p.stock += type === 'masuk' ? n : -n;
  p.updatedAt = db.now();
  const stockEntry = {
    id: db.uid('stk_'),
    productId: p.id,
    productName: p.name,
    productEmoji: p.emoji,
    type,
    qty: n,
    reason: reason || (type === 'masuk' ? 'Pembelian' : 'Penyesuaian'),
    user: req.user.name,
    createdAt: db.now(),
  };
  d.stockHistory.unshift(stockEntry);
  await Promise.all([
    db.updateDoc('products', p.id, p),
    db.addDoc('stockHistory', stockEntry),
  ]);
  res.json({ product: enrichProduct(p) });
});

app.get('/api/stock', async (req, res) => {
  await Promise.all([db.syncCollection('products'), db.syncCollection('stockHistory')]);
  const { productId } = req.query;
  let list = db.getDB().stockHistory.slice();
  if (productId) list = list.filter((s) => s.productId === productId);
  res.json({ history: list.slice(0, 300) });
});
app.get('/api/stok', async (req, res) => {
  await Promise.all([db.syncCollection('products'), db.syncCollection('stockHistory')]);
  const d = db.getDB();
  const list = d.products.map(enrichProduct);
  res.json({ stok: list, history: d.stockHistory.slice(0, 300) });
});

/* ------------------------------ orders (POS) ------------------------------ */

app.get('/api/orders', async (req, res) => {
  await db.syncCollection('orders');
  let list = db.getDB().orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const { q, method, status } = req.query;
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter((o) =>
      o.id.toLowerCase().includes(needle) ||
      (o.kasir && o.kasir.toLowerCase().includes(needle)) ||
      (o.customerName && o.customerName.toLowerCase().includes(needle))
    );
  }
  if (method && method !== 'Semua') {
    list = list.filter((o) => o.method === method || o.paymentMethod === method);
  }
  if (status && status !== 'Semua') {
    list = list.filter((o) => o.status === status);
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 15);
  const start = (page - 1) * limit;
  const total = list.length;
  const paged = list.slice(start, start + limit);
  res.json({
    orders: paged,
    total,
    page,
    limit,
    hasMore: start + limit < total,
  });
});

app.get('/api/orders/:id', async (req, res) => {
  await Promise.all([db.syncCollection('orders'), db.syncSettings()]);
  const o = db.getDB().orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  res.json({ order: o, settings: db.getDB().settings });
});

app.post('/api/orders', requireAuth, async (req, res) => {
  await Promise.all([db.syncSettings(), db.syncCollection('products')]);
  const d = db.getDB();
  const { items, discount, method, paid, kasir, deliveryMethod, diningType, tableNo } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Pesanan kosong.' });
  const METHODS = ['Tunai', 'QRIS', 'Transfer'];
  if (!METHODS.includes(method)) return res.status(400).json({ error: 'Metode pembayaran tidak valid.' });

  const cleaned = [];
  let subtotal = 0;
  for (const it of items) {
    const prod = d.products.find((x) => x.id === it.productId);
    if (!prod) return res.status(400).json({ error: 'Produk tidak ditemukan.' });
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    if (prod.stock < qty) return res.status(400).json({ error: 'Stok ' + prod.name + ' tidak cukup (' + prod.stock + ').' });

    // Handle spicy level & extra cost (Khusus Enoci Pedec, Chikiwings, Bacic, Topoccii, dll)
    const isSpicy = prod.hasSpicyLevel || (db.isSpicyProduct && db.isSpicyProduct(prod));
    let spicyLevel = null;
    let extraPrice = 0;
    if (isSpicy && it.spicyLevel != null) {
      spicyLevel = parseInt(it.spicyLevel, 10);
      if (!isNaN(spicyLevel) && spicyLevel >= 1) {
        if (spicyLevel > 5) {
          extraPrice = (spicyLevel - 5) * 2000;
        }
      } else {
        spicyLevel = null;
      }
    }

    const isVariantItem = prod.hasVariants || (db.isPizzaProduct && db.isPizzaProduct(prod)) || (db.isBurgerProduct && db.isBurgerProduct(prod)) || (db.isMartabakProduct && db.isMartabakProduct(prod)) || (db.isRotiBakarProduct && db.isRotiBakarProduct(prod)) || (db.isVariantProduct && db.isVariantProduct(prod));
    const variant = (isVariantItem && it.variant) ? String(it.variant).trim() : (it.variant ? String(it.variant).trim() : null);

    const unitPrice = (it.price && it.price > prod.price) ? it.price : (prod.price + extraPrice);
    const itemTotal = unitPrice * qty;
    const itemNote = String(it.note || it.notes || it.spicyNote || it.variantNote || '').trim();
    let displayName = it.productName;
    if (!displayName) {
      displayName = prod.name;
      if (variant) displayName += ` (${variant})`;
      if (spicyLevel) displayName += ` (Level ${spicyLevel}${extraPrice > 0 ? ` +Rp ${extraPrice.toLocaleString('id-ID')}` : ''})`;
      if (itemNote) displayName += ` [${itemNote}]`;
    } else if (itemNote && !displayName.includes(itemNote)) {
      displayName += ` [${itemNote}]`;
    }

    cleaned.push({
      productId: prod.id,
      productName: displayName,
      productEmoji: prod.emoji,
      qty,
      price: unitPrice,
      basePrice: prod.price,
      variant: variant || null,
      spicyLevel,
      extraPrice,
      spicyNote: it.spicyNote ? String(it.spicyNote).trim() : '',
      note: itemNote || null,
      modal: prod.modal,
      total: itemTotal
    });
    subtotal += itemTotal;
  }

  const discountVal = Math.max(0, parseInt(discount, 10) || 0);
  const taxRate = Number(d.settings.taxRate) || 0;
  const afterDiscount = subtotal - discountVal;
  const tax = Math.round(afterDiscount * taxRate / 100);
  const total = afterDiscount + tax;
  const totalPaid = parseInt(paid, 10) || total;
  const change = totalPaid - total;

  const order = {
    id: db.nextInvoiceNo(),
    items: cleaned,
    subtotal,
    discount: discountVal,
    taxRate,
    tax,
    total,
    paid: totalPaid,
    change,
    method,
    deliveryMethod: deliveryMethod || diningType || 'Makan di Tempat',
    tableNo: tableNo || null,
    status: 'Lunas',
    kasir: kasir || req.user.name || 'Kasir',
    createdAt: db.now(),
  };
  d.orders.unshift(order);

  const txEntries = [];
  const stockEntries = [];
  cleaned.forEach((it) => {
    const prod = d.products.find((x) => x.id === it.productId);
    prod.stock -= it.qty;
    prod.updatedAt = db.now();
    const stk = {
      id: db.uid('stk_'),
      productId: it.productId,
      productName: it.productName,
      productEmoji: it.productEmoji,
      type: 'keluar',
      qty: it.qty,
      reason: 'Penjualan ' + order.id,
      user: order.kasir,
      createdAt: order.createdAt,
    };
    stockEntries.push(stk);
    d.stockHistory.unshift(stk);
    const tx = {
      id: db.uid('trx_'),
      invoiceNo: order.id,
      productId: it.productId,
      productName: it.productName,
      productEmoji: it.productEmoji,
      qty: it.qty,
      price: it.price,
      modal: it.modal || Math.round(it.price * 0.6),
      total: it.total,
      status: 'Lunas',
      method,
      kasir: order.kasir,
      createdAt: order.createdAt,
    };
    txEntries.push(tx);
    d.transactions.push(tx);
  });

  const saves = [db.addDoc('orders', order), db.saveSettings()];
  cleaned.forEach((it) => {
    const prod = d.products.find((x) => x.id === it.productId);
    saves.push(db.updateDoc('products', it.productId, prod));
  });
  stockEntries.forEach((s) => saves.push(db.addDoc('stockHistory', s)));
  txEntries.forEach((t) => saves.push(db.addDoc('transactions', t)));
  await Promise.all(saves);

  res.status(201).json({ order });
});

app.delete('/api/orders/:id', async (req, res) => {
  const d = db.getDB();
  const idx = d.orders.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  d.orders.splice(idx, 1);
  await db.deleteDoc('orders', req.params.id);
  res.json({ ok: true });
});

/* ------------------------------ transactions ------------------------------ */

app.get('/api/transactions', async (req, res) => {
  await db.syncCollection('transactions');
  let list = db.getDB().transactions.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const { start, end, q } = req.query;
  if (start) list = list.filter((t) => db.dayKeyOf(t.createdAt) >= start);
  if (end) list = list.filter((t) => db.dayKeyOf(t.createdAt) <= end);
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter((t) => t.productName.toLowerCase().includes(needle) || t.invoiceNo.toLowerCase().includes(needle));
  }
  const { page = 1, limit = 20 } = req.query;
  const startIdx = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  res.json({ transactions: list.slice(startIdx, startIdx + parseInt(limit, 10)), total: list.length });
});

/* ------------------------------ report ------------------------------ */

app.get('/api/report', async (req, res) => {
  await Promise.all([
    db.syncCollection('transactions'),
    db.syncCollection('orders'),
    db.syncCollection('products'),
    db.syncCollection('categories')
  ]);

  const { start, end, kasir, category, period } = req.query;
  const d = db.getDB();

  let startDate = start;
  let endDate = end;

  const now = new Date();
  const toDayStr = (dt) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (period === 'hari') {
    startDate = toDayStr(now);
    endDate = toDayStr(now);
  } else if (period === 'minggu') {
    const d7 = new Date();
    d7.setDate(d7.getDate() - 6);
    startDate = toDayStr(d7);
    endDate = toDayStr(now);
  } else if (period === 'bulan') {
    const dMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate = toDayStr(dMonth);
    endDate = toDayStr(now);
  } else if (period === 'tahun') {
    const dYear = new Date(now.getFullYear(), 0, 1);
    startDate = toDayStr(dYear);
    endDate = toDayStr(now);
  }

  let list = d.transactions.slice().filter((t) => t.status === 'Lunas');
  if (startDate) list = list.filter((t) => db.dayKeyOf(t.createdAt) >= startDate);
  if (endDate) list = list.filter((t) => db.dayKeyOf(t.createdAt) <= endDate);
  if (kasir && kasir !== 'Semua') list = list.filter((t) => t.kasir === kasir);
  if (category && category !== 'Semua') {
    const prodIds = d.products
      .filter((p) => (d.categories.find((c) => c.id === p.categoryId) || {}).name === category)
      .map((p) => p.id);
    list = list.filter((t) => prodIds.includes(t.productId));
  }

  const totalSales = list.reduce((a, t) => a + t.total, 0);
  const totalCost = list.reduce((a, t) => a + (t.modal || 0) * t.qty, 0);
  const profit = totalSales - totalCost;

  const soldMap = {};
  list.forEach((t) => {
    if (!soldMap[t.productId]) soldMap[t.productId] = { name: t.productName, emoji: t.productEmoji, qty: 0, revenue: 0 };
    soldMap[t.productId].qty += t.qty;
    soldMap[t.productId].revenue += t.total;
  });
  const bestSellers = Object.values(soldMap).sort((a, b) => b.qty - a.qty).slice(0, 10);

  const methodMap = {};
  list.forEach((t) => { methodMap[t.method || 'Tunai'] = (methodMap[t.method || 'Tunai'] || 0) + t.total; });

  const dayGroups = {};
  list.forEach((t) => {
    const k = db.dayKeyOf(t.createdAt);
    if (!dayGroups[k]) {
      const dObj = new Date(t.createdAt);
      dayGroups[k] = {
        dateKey: k,
        dayName: dObj.toLocaleDateString('id-ID', { weekday: 'long' }),
        dateFormatted: dObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        fullDate: dObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        totalSales: 0,
        totalCost: 0,
        profit: 0,
        txCount: 0,
        itemsCount: 0,
        kasirList: [],
        methods: {},
      };
    }
    dayGroups[k].totalSales += t.total;
    dayGroups[k].totalCost += (t.modal || 0) * t.qty;
    dayGroups[k].itemsCount += t.qty;
    dayGroups[k].txCount += 1;
    if (t.kasir && !dayGroups[k].kasirList.includes(t.kasir)) {
      dayGroups[k].kasirList.push(t.kasir);
    }
    const m = t.method || 'Tunai';
    dayGroups[k].methods[m] = (dayGroups[k].methods[m] || 0) + t.total;
  });

  const dailyBreakdown = Object.values(dayGroups).sort((a, b) => b.dateKey.localeCompare(a.dateKey)).map((dg) => ({
    ...dg,
    profit: dg.totalSales - dg.totalCost,
    kasir: dg.kasirList.join(', ') || 'Kasir',
  }));

  const daily = Object.keys(dayGroups).sort().map((k) => ({
    date: k,
    total: dayGroups[k].totalSales,
  }));

  // Orders in period (for the detailed orders record)
  let orderList = d.orders.slice().filter((o) => o.status === 'Lunas');
  if (startDate) orderList = orderList.filter((o) => db.dayKeyOf(o.createdAt) >= startDate);
  if (endDate) orderList = orderList.filter((o) => db.dayKeyOf(o.createdAt) <= endDate);
  if (kasir && kasir !== 'Semua') orderList = orderList.filter((o) => o.kasir === kasir);
  orderList.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const detailedOrders = orderList.slice(0, 100).map((o) => {
    const dObj = new Date(o.createdAt);
    return {
      id: o.id,
      createdAt: o.createdAt,
      dayName: dObj.toLocaleDateString('id-ID', { weekday: 'long' }),
      dateFormatted: dObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      fullDate: dObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      timeFormatted: dObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      kasir: o.kasir || 'Kasir',
      method: o.method || 'Tunai',
      total: o.total,
      subtotal: o.subtotal,
      discount: o.discount || 0,
      tax: o.tax || 0,
      status: o.status,
      itemsCount: Array.isArray(o.items) ? o.items.length : 0,
    };
  });

  const uniqueKasir = [...new Set(d.transactions.map((t) => t.kasir).filter(Boolean))];

  res.json({
    period: {
      start: startDate,
      end: endDate,
      selectedPeriod: period || 'custom',
    },
    summary: {
      totalRevenue: totalSales,
      totalSales,
      totalCost,
      profit,
      totalTransactions: orderList.length || list.length,
      totalItems: list.reduce((a, t) => a + t.qty, 0),
      avgOrder: orderList.length ? Math.round(totalSales / orderList.length) : (list.length ? Math.round(totalSales / list.length) : 0),
      topProduct: bestSellers[0] ? bestSellers[0].name : '-',
    },
    totalSales,
    totalCost,
    profit,
    totalTransactions: orderList.length || list.length,
    totalItems: list.reduce((a, t) => a + t.qty, 0),
    avgOrder: orderList.length ? Math.round(totalSales / orderList.length) : (list.length ? Math.round(totalSales / list.length) : 0),
    bestSellers,
    methods: methodMap,
    daily,
    dailyBreakdown,
    detailedOrders,
    kasirList: uniqueKasir,
  });
});

app.get('/api/laporan', (req, res) => {
  req.url = '/api/report' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  return app._router.handle(req, res);
});

/* ------------------------------ users ------------------------------ */

app.get('/api/users', (req, res) => {
  res.json({ users: db.getDB().users.map((u) => ({ id: u.id, name: u.name, username: u.username, role: u.role, status: u.status, createdAt: u.createdAt })) });
});

app.post('/api/users', async (req, res) => {
  const d = db.getDB();
  const o = { id: db.uid('usr_'), name: req.body.name || '', username: req.body.username || '', role: req.body.role || 'kasir', status: 'aktif', createdAt: db.now() };
  if (!String(o.name).trim() || !String(o.username).trim()) return res.status(400).json({ error: 'Nama dan username wajib diisi.' });
  d.users.push(o);
  await db.addDoc('users', o);
  res.status(201).json({ user: o });
});

app.put('/api/users/:id', async (req, res) => {
  const o = db.getDB().users.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  if (req.body.name !== undefined) o.name = req.body.name;
  if (req.body.role !== undefined) o.role = req.body.role;
  if (req.body.status !== undefined) o.status = req.body.status;
  await db.updateDoc('users', o.id, o);
  res.json({ user: o });
});

app.delete('/api/users/:id', async (req, res) => {
  const arr = db.getDB().users;
  const idx = arr.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  arr.splice(idx, 1);
  await db.deleteDoc('users', req.params.id);
  res.json({ ok: true });
});

/* ------------------------------ suppliers ------------------------------ */

app.get('/api/suppliers', (req, res) => res.json({ suppliers: db.getDB().suppliers }));

app.post('/api/suppliers', async (req, res) => {
  const d = db.getDB();
  const o = { id: db.uid('sup_'), name: req.body.name || '', phone: req.body.phone || '', address: req.body.address || '', createdAt: db.now() };
  if (!String(o.name).trim()) return res.status(400).json({ error: 'Nama supplier wajib diisi.' });
  d.suppliers.push(o);
  await db.addDoc('suppliers', o);
  res.status(201).json({ supplier: o });
});

app.put('/api/suppliers/:id', async (req, res) => {
  const o = db.getDB().suppliers.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Supplier tidak ditemukan.' });
  if (req.body.name !== undefined) o.name = req.body.name;
  if (req.body.phone !== undefined) o.phone = req.body.phone;
  if (req.body.address !== undefined) o.address = req.body.address;
  await db.updateDoc('suppliers', o.id, o);
  res.json({ supplier: o });
});

app.delete('/api/suppliers/:id', async (req, res) => {
  const arr = db.getDB().suppliers;
  const idx = arr.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Supplier tidak ditemukan.' });
  arr.splice(idx, 1);
  await db.deleteDoc('suppliers', req.params.id);
  res.json({ ok: true });
});

/* ------------------------------ customers ------------------------------ */

app.get('/api/customers', (req, res) => res.json({ customers: db.getDB().customers }));

app.post('/api/customers', async (req, res) => {
  const d = db.getDB();
  const o = { id: db.uid('cus_'), name: req.body.name || '', phone: req.body.phone || '', createdAt: db.now() };
  if (!String(o.name).trim()) return res.status(400).json({ error: 'Nama pelanggan wajib diisi.' });
  d.customers.push(o);
  await db.addDoc('customers', o);
  res.status(201).json({ customer: o });
});

app.put('/api/customers/:id', async (req, res) => {
  const o = db.getDB().customers.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
  if (req.body.name !== undefined) o.name = req.body.name;
  if (req.body.phone !== undefined) o.phone = req.body.phone;
  await db.updateDoc('customers', o.id, o);
  res.json({ customer: o });
});

app.delete('/api/customers/:id', async (req, res) => {
  const arr = db.getDB().customers;
  const idx = arr.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Pelanggan tidak ditemukan.' });
  arr.splice(idx, 1);
  await db.deleteDoc('customers', req.params.id);
  res.json({ ok: true });
});

/* ------------------------------- fallback ----------------------------- */

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
  next();
});

/* ------------------------------ startup ------------------------------ */

async function start() {
  await db.load();
  console.log('[Firestore] Data loaded from Firestore into memory cache.');
  app.listen(PORT, () => {
    console.log('\n  Warung Cemilan app running at: http://localhost:' + PORT + '\n');
  });
}

if (process.env.VERCEL) {
  module.exports = (async () => { await db.load(); return app; })();
} else if (require.main === module) {
  start().catch((err) => {
    console.error('[Startup] Failed to start:', err.message);
    process.exit(1);
  });
} else {
  module.exports = app;
}
