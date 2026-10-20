// db.js - SQLite Database Manager for MiniKiot
// Utilizes Node.js v24 built-in module 'node:sqlite' (zero npm dependencies)

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const { defaultData } = require('./data.js');

const DB_PATH = process.env.MINIKIOT_DB_PATH || path.join(__dirname, 'minikiot.db');
const { hashPassword } = require('./security.js');
const ENTITY_TABLES = [
    'branches',
    'categories',
    'products',
    'customers',
    'suppliers',
    'invoices',
    'imports',
    'cashbook',
    'returns',
    'stocktakes',
    'transfers',
    'users'
];
let db = null;

function getDb() {
    if (!db) {
        db = new DatabaseSync(DB_PATH);
        db.exec('PRAGMA journal_mode = WAL;');
        db.exec('PRAGMA synchronous = FULL;');
        db.exec('PRAGMA busy_timeout = 5000;');
    }
    return db;
}

function initDb() {
    const d = getDb();
    const isNew = !d
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'")
        .get();
    const hasMeta = d
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_meta'")
        .get();
    if (!isNew && !hasMeta) {
        const backupPath = `${DB_PATH}.before-v2-${Date.now()}.bak`;
        d.prepare('VACUUM INTO ?').run(backupPath);
        console.log('Đã sao lưu trước nâng cấp:', backupPath);
    }
    d.exec('BEGIN IMMEDIATE');
    try {
        d.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS branches (
            id TEXT PRIMARY KEY,
            code TEXT,
            name TEXT,
            phone TEXT,
            address TEXT,
            isDefault INTEGER DEFAULT 0,
            note TEXT
        );

        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT,
            parentId TEXT
        );

        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            code TEXT,
            name TEXT,
            category TEXT,
            costPrice REAL DEFAULT 0,
            price REAL DEFAULT 0,
            stock REAL DEFAULT 0,
            minStock REAL DEFAULT 0,
            unit TEXT,
            status TEXT DEFAULT 'active',
            barcode TEXT,
            branch TEXT,
            hasImei INTEGER DEFAULT 0,
            imeis TEXT DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            code TEXT,
            name TEXT,
            phone TEXT,
            address TEXT,
            totalSpent REAL DEFAULT 0,
            debt REAL DEFAULT 0,
            points REAL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS suppliers (
            id TEXT PRIMARY KEY,
            code TEXT,
            name TEXT,
            phone TEXT,
            address TEXT,
            debt REAL DEFAULT 0,
            totalBought REAL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            code TEXT,
            time TEXT,
            customer TEXT,
            phone TEXT,
            items TEXT,
            total REAL DEFAULT 0,
            paid REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            redPaid INTEGER DEFAULT 0,
            grayBg INTEGER DEFAULT 0,
            status TEXT DEFAULT 'completed',
            cashier TEXT,
            branch TEXT
        );

        CREATE TABLE IF NOT EXISTS imports (
            id TEXT PRIMARY KEY,
            code TEXT,
            time TEXT,
            nccCode TEXT,
            nccName TEXT,
            items TEXT,
            needPay REAL DEFAULT 0,
            paid REAL DEFAULT 0,
            paymentMethod TEXT DEFAULT 'bank',
            note TEXT,
            status TEXT DEFAULT 'imported',
            creator TEXT,
            branch TEXT
        );

        CREATE TABLE IF NOT EXISTS cashbook (
            id TEXT PRIMARY KEY,
            code TEXT,
            time TEXT,
            type TEXT,
            category TEXT,
            amount REAL DEFAULT 0,
            person TEXT,
            method TEXT,
            note TEXT,
            branch TEXT
        );

        CREATE TABLE IF NOT EXISTS returns (
            id TEXT PRIMARY KEY,
            code TEXT,
            invoiceCode TEXT,
            time TEXT,
            customer TEXT,
            phone TEXT,
            items TEXT,
            totalRefund REAL DEFAULT 0,
            refundMethod TEXT,
            reason TEXT,
            cashier TEXT,
            branch TEXT
        );

        CREATE TABLE IF NOT EXISTS stocktakes (
            id TEXT PRIMARY KEY,
            code TEXT,
            time TEXT,
            cashier TEXT,
            branch TEXT,
            status TEXT DEFAULT 'balanced',
            note TEXT,
            totalActual REAL DEFAULT 0,
            totalVariance REAL DEFAULT 0,
            items TEXT
        );

        CREATE TABLE IF NOT EXISTS transfers (
            id TEXT PRIMARY KEY,
            code TEXT,
            time TEXT,
            fromBranch TEXT,
            toBranch TEXT,
            cashier TEXT,
            status TEXT DEFAULT 'shipping',
            receivedTime TEXT,
            receiver TEXT,
            totalQty REAL DEFAULT 0,
            totalValue REAL DEFAULT 0,
            note TEXT,
            items TEXT
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            code TEXT,
            name TEXT,
            username TEXT UNIQUE,
            password TEXT,
            phone TEXT,
            role TEXT,
            roleName TEXT,
            branch TEXT,
            status TEXT DEFAULT 'active',
            permissions TEXT
        );
    `);

        // Migration safeguard: Ensure paymentMethod column exists in imports
        try {
            d.exec('ALTER TABLE imports ADD COLUMN paymentMethod TEXT DEFAULT "bank";');
        } catch {}

        // Migration safeguard: Ensure hasImei and imeis columns exist in products
        try {
            d.exec('ALTER TABLE products ADD COLUMN hasImei INTEGER DEFAULT 0;');
        } catch {}
        try {
            d.exec('ALTER TABLE products ADD COLUMN imeis TEXT DEFAULT "[]";');
        } catch {}

        // Migration safeguard: Ensure users table has branches column
        try {
            d.exec('ALTER TABLE users ADD COLUMN branches TEXT DEFAULT "[]";');
        } catch {}

        d.exec(`CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY, requestId TEXT UNIQUE, userId TEXT NOT NULL, action TEXT NOT NULL, time TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS processed_requests (id TEXT PRIMARY KEY, userId TEXT NOT NULL, digest TEXT NOT NULL, result TEXT NOT NULL);
      INSERT OR IGNORE INTO app_meta VALUES ('revision', '0');`);
        for (const table of ENTITY_TABLES) {
            const columns = d.prepare(`PRAGMA table_info(${table})`).all();
            if (!columns.some((c) => c.name === 'extra'))
                d.exec(`ALTER TABLE ${table} ADD COLUMN extra TEXT NOT NULL DEFAULT '{}'`);
        }
        if (isNew) {
            const initial = JSON.parse(JSON.stringify(defaultData));
            for (const key of ENTITY_TABLES)
                if (!['branches', 'categories'].includes(key)) initial[key] = [];
            if (
                process.env.MINIKIOT_ADMIN_PASSWORD &&
                (process.env.MINIKIOT_ADMIN_PASSWORD.length < 8 ||
                    process.env.MINIKIOT_ADMIN_PASSWORD.length > 1024)
            )
                throw new Error('MINIKIOT_ADMIN_PASSWORD phải từ 8 đến 1024 ký tự.');
            const password =
                process.env.MINIKIOT_ADMIN_PASSWORD ||
                require('node:crypto').randomBytes(18).toString('base64url');
            initial.users = [{ ...defaultData.users[0], password: hashPassword(password) }];
            saveAllData(initial, true);
            if (!process.env.MINIKIOT_ADMIN_PASSWORD)
                console.log('Tài khoản admin mới. Mật khẩu dùng lần đầu:', password);
        }
        // Migrate existing credentials without changing the user's password or business data.
        for (const user of d.prepare('SELECT id, password FROM users').all()) {
            if (!user.password?.startsWith('scrypt$'))
                d.prepare('UPDATE users SET password=? WHERE id=?').run(
                    hashPassword(user.password || ''),
                    user.id
                );
        }
        d.prepare("INSERT OR REPLACE INTO app_meta VALUES ('schema_version', '2')").run();
        d.exec('COMMIT');
    } catch (error) {
        d.exec('ROLLBACK');
        throw error;
    }
}

function parseItems(value) {
    try {
        const items = JSON.parse(value || '[]');
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

function getAllData() {
    const d = getDb();

    // 1. Settings
    const settingRows = d.prepare('SELECT * FROM settings').all();
    const settings = {};
    settingRows.forEach((r) => {
        try {
            settings[r.key] = String(JSON.parse(r.value) ?? '');
        } catch {
            settings[r.key] = r.value;
        }
    });

    // 2. Branches
    const branches = d
        .prepare('SELECT * FROM branches')
        .all()
        .map((r) => ({
            ...r,
            isDefault: Boolean(r.isDefault)
        }));

    // 3. Categories
    const categories = d.prepare('SELECT * FROM categories').all();

    // 4. Products
    const products = d
        .prepare('SELECT * FROM products')
        .all()
        .map((r) => ({
            ...r,
            costPrice: Number(r.costPrice) || 0,
            price: Number(r.price) || 0,
            stock: Number(r.stock) || 0,
            minStock: Number(r.minStock) || 0,
            hasImei: Boolean(r.hasImei),
            imeis: r.imeis
                ? typeof r.imeis === 'string'
                    ? (() => {
                          try {
                              return JSON.parse(r.imeis);
                          } catch {
                              return [];
                          }
                      })()
                    : r.imeis
                : []
        }));

    // 5. Customers
    const customers = d
        .prepare('SELECT * FROM customers')
        .all()
        .map((r) => ({
            ...r,
            totalSpent: Number(r.totalSpent) || 0,
            debt: Number(r.debt) || 0,
            points: Number(r.points) || 0
        }));

    // 6. Suppliers
    const suppliers = d
        .prepare('SELECT * FROM suppliers')
        .all()
        .map((r) => ({
            ...r,
            debt: Number(r.debt) || 0,
            totalBought: Number(r.totalBought) || 0
        }));

    // 7. Invoices
    const invoices = d
        .prepare('SELECT * FROM invoices')
        .all()
        .map((r) => ({
            ...r,
            items: parseItems(r.items),
            total: Number(r.total) || 0,
            paid: Number(r.paid) || 0,
            discount: Number(r.discount) || 0,
            redPaid: Boolean(r.redPaid),
            grayBg: Boolean(r.grayBg)
        }));

    // 8. Imports
    const imports = d
        .prepare('SELECT * FROM imports')
        .all()
        .map((r) => ({
            ...r,
            items: parseItems(r.items),
            needPay: Number(r.needPay) || 0,
            paid: Number(r.paid) || 0,
            paymentMethod: r.paymentMethod || 'bank'
        }));

    // 9. Cashbook
    const cashbook = d
        .prepare('SELECT * FROM cashbook')
        .all()
        .map((r) => ({
            ...r,
            amount: Number(r.amount) || 0
        }));

    // 10. Returns
    const returns = d
        .prepare('SELECT * FROM returns')
        .all()
        .map((r) => ({
            ...r,
            items: parseItems(r.items),
            totalRefund: Number(r.totalRefund) || 0
        }));

    // 11. Stocktakes
    const stocktakes = d
        .prepare('SELECT * FROM stocktakes')
        .all()
        .map((r) => ({
            ...r,
            items: parseItems(r.items),
            totalActual: Number(r.totalActual) || 0,
            totalVariance: Number(r.totalVariance) || 0
        }));

    // 12. Transfers
    const transfers = d
        .prepare('SELECT * FROM transfers')
        .all()
        .map((r) => ({
            ...r,
            items: parseItems(r.items),
            totalQty: Number(r.totalQty) || 0,
            totalValue: Number(r.totalValue) || 0
        }));

    // 13. Users (Staff & Permissions)
    let users = [];
    try {
        users = d
            .prepare('SELECT * FROM users')
            .all()
            .map((r) => {
                let branches = [];
                try {
                    branches = r.branches
                        ? typeof r.branches === 'string'
                            ? JSON.parse(r.branches)
                            : r.branches
                        : [];
                } catch {}
                if (!Array.isArray(branches) || branches.length === 0) {
                    branches = r.branch ? [r.branch] : ['Kalo HCM'];
                }
                let permissions = {};
                try {
                    const parsed = JSON.parse(r.permissions || '{}');
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
                        permissions = parsed;
                } catch {}
                return { ...r, branches, permissions };
            });
    } catch {}

    const result = {
        settings: Object.keys(settings).length ? settings : defaultData.settings,
        branches,
        categories,
        products,
        customers,
        suppliers,
        invoices,
        imports,
        cashbook,
        returns,
        stocktakes,
        transfers,
        users
    };
    for (const table of ENTITY_TABLES)
        result[table] = result[table].map((row) => {
            const { extra, ...known } = row;
            let fields = {};
            try {
                fields = JSON.parse(extra || '{}');
            } catch {}
            return { ...fields, ...known };
        });
    for (const inv of result.invoices) {
        const slips = result.returns.filter((r) => r.invoiceCode === inv.code);
        inv.hasReturned = slips.length > 0 || !!inv.hasReturned;
        inv.returnedTotal = slips.length
            ? slips.reduce((sum, r) => sum + (r.returnValue ?? r.totalRefund), 0)
            : inv.returnedTotal || 0;
        if (!inv.customerId && inv.phone && inv.phone !== 'Tại quầy') {
            const matches = result.customers.filter(
                (c) => c.phone === inv.phone && c.code !== 'KH0011'
            );
            if (matches.length === 1) inv.customerId = matches[0].id;
        }
    }
    const activities = d.prepare("SELECT value FROM app_meta WHERE key='recentActivities'").get();
    result.recentActivities = activities ? JSON.parse(activities.value) : [];
    return result;
}

function saveAllData(data, withinTransaction = false) {
    if (!data) return false;
    const d = getDb();

    if (!withinTransaction) d.exec('BEGIN IMMEDIATE');
    try {
        // 1. Settings
        if (data.settings && typeof data.settings === 'object') {
            d.exec('DELETE FROM settings');
            const stmt = d.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
            for (const [k, v] of Object.entries(data.settings)) {
                stmt.run(k, JSON.stringify(v));
            }
        }

        // 2. Branches
        if (Array.isArray(data.branches)) {
            d.exec('DELETE FROM branches');
            const stmt = d.prepare(
                'INSERT INTO branches (id, code, name, phone, address, isDefault, note) VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            data.branches.forEach((b) => {
                stmt.run(
                    b.id || '',
                    b.code || '',
                    b.name || '',
                    b.phone || '',
                    b.address || '',
                    b.isDefault ? 1 : 0,
                    b.note || ''
                );
            });
        }

        // 3. Categories
        if (Array.isArray(data.categories)) {
            d.exec('DELETE FROM categories');
            const stmt = d.prepare('INSERT INTO categories (id, name, parentId) VALUES (?, ?, ?)');
            data.categories.forEach((c) => {
                stmt.run(c.id || '', c.name || '', c.parentId || null);
            });
        }

        // 4. Products
        if (Array.isArray(data.products)) {
            d.exec('DELETE FROM products');
            const stmt = d.prepare(
                'INSERT INTO products (id, code, name, category, costPrice, price, stock, minStock, unit, status, barcode, branch, hasImei, imeis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            data.products.forEach((p) => {
                stmt.run(
                    p.id || '',
                    p.code || '',
                    p.name || '',
                    p.category || '',
                    Number(p.costPrice) || 0,
                    Number(p.price) || 0,
                    Number(p.stock) || 0,
                    Number(p.minStock) || 0,
                    p.unit || '',
                    p.status || 'active',
                    p.barcode || '',
                    p.branch || 'Kalo HCM',
                    p.hasImei ? 1 : 0,
                    JSON.stringify(Array.isArray(p.imeis) ? p.imeis : [])
                );
            });
        }

        // 5. Customers
        if (Array.isArray(data.customers)) {
            d.exec('DELETE FROM customers');
            const stmt = d.prepare(
                'INSERT INTO customers (id, code, name, phone, address, totalSpent, debt, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            data.customers.forEach((c) => {
                stmt.run(
                    c.id || '',
                    c.code || '',
                    c.name || '',
                    c.phone || '',
                    c.address || '',
                    Number(c.totalSpent) || 0,
                    Number(c.debt) || 0,
                    Number(c.points) || 0
                );
            });
        }

        // 6. Suppliers
        if (Array.isArray(data.suppliers)) {
            d.exec('DELETE FROM suppliers');
            const stmt = d.prepare(
                'INSERT INTO suppliers (id, code, name, phone, address, debt, totalBought) VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            data.suppliers.forEach((s) => {
                stmt.run(
                    s.id || '',
                    s.code || '',
                    s.name || '',
                    s.phone || '',
                    s.address || '',
                    Number(s.debt) || 0,
                    Number(s.totalBought) || 0
                );
            });
        }

        // 7. Invoices
        if (Array.isArray(data.invoices)) {
            d.exec('DELETE FROM invoices');
            const stmt = d.prepare(
                'INSERT INTO invoices (id, code, time, customer, phone, items, total, paid, discount, redPaid, grayBg, status, cashier, branch) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            data.invoices.forEach((i) => {
                stmt.run(
                    i.id || '',
                    i.code || '',
                    i.time || '',
                    i.customer || '',
                    i.phone || '',
                    typeof i.items === 'string' ? i.items : JSON.stringify(i.items || []),
                    Number(i.total) || 0,
                    Number(i.paid) || 0,
                    Number(i.discount) || 0,
                    i.redPaid ? 1 : 0,
                    i.grayBg ? 1 : 0,
                    i.status || 'completed',
                    i.cashier || '',
                    i.branch || 'Kalo HCM'
                );
            });
        }

        // 8. Imports
        if (Array.isArray(data.imports)) {
            d.exec('DELETE FROM imports');
            const stmt = d.prepare(
                'INSERT INTO imports (id, code, time, nccCode, nccName, items, needPay, paid, paymentMethod, note, status, creator, branch) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            data.imports.forEach((m) => {
                stmt.run(
                    m.id || '',
                    m.code || '',
                    m.time || '',
                    m.nccCode || '',
                    m.nccName || '',
                    typeof m.items === 'string' ? m.items : JSON.stringify(m.items || []),
                    Number(m.needPay) || 0,
                    Number(m.paid) || 0,
                    m.paymentMethod || 'bank',
                    m.note || '',
                    m.status || 'imported',
                    m.creator || '',
                    m.branch || 'Kalo HCM'
                );
            });
        }

        // 9. Cashbook
        if (Array.isArray(data.cashbook)) {
            d.exec('DELETE FROM cashbook');
            const stmt = d.prepare(
                'INSERT INTO cashbook (id, code, time, type, category, amount, person, method, note, branch) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            data.cashbook.forEach((c) => {
                stmt.run(
                    c.id || '',
                    c.code || '',
                    c.time || '',
                    c.type || 'thu',
                    c.category || '',
                    Number(c.amount) || 0,
                    c.person || '',
                    c.method || '',
                    c.note || '',
                    c.branch || 'Kalo HCM'
                );
            });
        }

        // 10. Returns
        if (Array.isArray(data.returns)) {
            d.exec('DELETE FROM returns');
            const stmt = d.prepare(
                'INSERT INTO returns (id, code, invoiceCode, time, customer, phone, items, totalRefund, refundMethod, reason, cashier, branch) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            data.returns.forEach((r) => {
                stmt.run(
                    r.id || '',
                    r.code || '',
                    r.invoiceCode || '',
                    r.time || '',
                    r.customer || '',
                    r.phone || '',
                    typeof r.items === 'string' ? r.items : JSON.stringify(r.items || []),
                    Number(r.totalRefund) || 0,
                    r.refundMethod || '',
                    r.reason || '',
                    r.cashier || '',
                    r.branch || 'Kalo HCM'
                );
            });
        }

        // 11. Stocktakes
        if (Array.isArray(data.stocktakes)) {
            d.exec('DELETE FROM stocktakes');
            const stmt = d.prepare(
                'INSERT INTO stocktakes (id, code, time, cashier, branch, status, note, totalActual, totalVariance, items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            data.stocktakes.forEach((s) => {
                stmt.run(
                    s.id || '',
                    s.code || '',
                    s.time || '',
                    s.cashier || '',
                    s.branch || 'Kalo HCM',
                    s.status || 'balanced',
                    s.note || '',
                    Number(s.totalActual) || 0,
                    Number(s.totalVariance) || 0,
                    typeof s.items === 'string' ? s.items : JSON.stringify(s.items || [])
                );
            });
        }

        // 12. Transfers
        if (Array.isArray(data.transfers)) {
            d.exec('DELETE FROM transfers');
            const stmt = d.prepare(
                'INSERT INTO transfers (id, code, time, fromBranch, toBranch, cashier, status, receivedTime, receiver, totalQty, totalValue, note, items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            data.transfers.forEach((t) => {
                stmt.run(
                    t.id || '',
                    t.code || '',
                    t.time || '',
                    t.fromBranch || 'Kalo HCM',
                    t.toBranch || 'Chi nhánh Hà Nội',
                    t.cashier || '',
                    t.status || 'shipping',
                    t.receivedTime || null,
                    t.receiver || null,
                    Number(t.totalQty) || 0,
                    Number(t.totalValue) || 0,
                    t.note || '',
                    typeof t.items === 'string' ? t.items : JSON.stringify(t.items || [])
                );
            });
        }

        // 13. Users
        if (Array.isArray(data.users)) {
            d.exec('DELETE FROM users');
            const stmt = d.prepare(`
                INSERT INTO users (id, code, name, username, password, phone, role, roleName, branch, branches, status, permissions)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            data.users.forEach((u) => {
                const branchesArr =
                    Array.isArray(u.branches) && u.branches.length > 0
                        ? u.branches
                        : u.branch
                          ? [u.branch]
                          : ['Kalo HCM'];
                stmt.run(
                    u.id || `NV${Date.now()}`,
                    u.code || '',
                    u.name || '',
                    u.username || '',
                    u.password || '',
                    u.phone || '',
                    u.role || 'cashier',
                    u.roleName || '',
                    u.branch || branchesArr[0] || 'Kalo HCM',
                    JSON.stringify(branchesArr),
                    u.status || 'active',
                    typeof u.permissions === 'object'
                        ? JSON.stringify(u.permissions)
                        : u.permissions || '{}'
                );
            });
        }

        for (const table of ENTITY_TABLES) {
            if (!Array.isArray(data[table])) continue;
            const known = new Set(
                d
                    .prepare(`PRAGMA table_info(${table})`)
                    .all()
                    .map((c) => c.name)
            );
            const update = d.prepare(`UPDATE ${table} SET extra=? WHERE id=?`);
            for (const row of data[table])
                update.run(
                    JSON.stringify(
                        Object.fromEntries(Object.entries(row).filter(([key]) => !known.has(key)))
                    ),
                    row.id
                );
        }
        if (data.recentActivities)
            d.prepare("INSERT OR REPLACE INTO app_meta VALUES ('recentActivities', ?)").run(
                JSON.stringify(data.recentActivities)
            );
        if (!withinTransaction) d.exec('COMMIT');
        return true;
    } catch (e) {
        if (!withinTransaction) d.exec('ROLLBACK');
        console.error('❌ Lỗi lưu dữ liệu vào SQLite:', e);
        throw e;
    }
}

function resetDatabase() {
    saveAllData(defaultData);
    return getAllData();
}

function getStats() {
    const d = getDb();
    const stats = {};
    [
        'branches',
        'categories',
        'products',
        'customers',
        'suppliers',
        'invoices',
        'imports',
        'cashbook',
        'stocktakes',
        'transfers',
        'users'
    ].forEach((tbl) => {
        try {
            stats[tbl] = d.prepare(`SELECT count(*) as count FROM ${tbl}`).get().count;
        } catch {
            stats[tbl] = 0;
        }
    });
    let dbSize = 0;
    if (fs.existsSync(DB_PATH)) {
        dbSize = fs.statSync(DB_PATH).size;
    }
    return {
        dbType: 'SQLite (Node.js 24 node:sqlite)',
        dbPath: DB_PATH,
        dbSizeKB: Math.round(dbSize / 1024),
        counts: stats
    };
}

function assertReadableRecords() {
    const fields = {
        products: { imeis: 'array' },
        invoices: { items: 'array' },
        imports: { items: 'array' },
        returns: { items: 'array' },
        stocktakes: { items: 'array' },
        transfers: { items: 'array' },
        users: { permissions: 'object', branches: 'array' }
    };
    for (const table of ENTITY_TABLES) {
        const checks = { extra: 'object', ...fields[table] };
        for (const row of getDb()
            .prepare(`SELECT id, ${Object.keys(checks).join(',')} FROM ${table}`)
            .all()) {
            for (const [column, kind] of Object.entries(checks)) {
                let valid = false;
                try {
                    const value = JSON.parse(row[column] || (kind === 'array' ? '[]' : '{}'));
                    valid =
                        kind === 'array'
                            ? Array.isArray(value)
                            : value !== null && typeof value === 'object' && !Array.isArray(value);
                } catch {}
                if (!valid)
                    throw Object.assign(
                        new Error(
                            `Dữ liệu cũ ${table}/${row.id}.${column} có JSON lỗi. Cần sửa dữ liệu gốc trước khi ghi giao dịch mới.`
                        ),
                        { status: 422 }
                    );
            }
        }
    }
}

module.exports = {
    assertReadableRecords,
    DB_PATH,
    ENTITY_TABLES,
    getDb,
    initDb,
    getAllData,
    saveAllData,
    resetDatabase,
    getStats
};
