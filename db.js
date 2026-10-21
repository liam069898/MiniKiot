// db.js - SQLite Database Manager for MiniKiot
// Utilizes Node.js v24 built-in module 'node:sqlite' (zero npm dependencies)

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const { defaultData } = require('./data.js');

const DB_PATH = process.env.MINIKIOT_DB_PATH || path.join(__dirname, 'minikiot.db');
const { hashPassword } = require('./security.js');
const { FALLBACK_BRANCH, RETAIL_CUSTOMER_CODE } = require('./constants.js');
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
        try {
            db.exec('PRAGMA journal_mode = WAL;');
        } catch {
            // Network filesystems like SMB/NFS may not support WAL shared memory
        }
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
      CREATE TABLE IF NOT EXISTS processed_requests (id TEXT PRIMARY KEY, userId TEXT NOT NULL, digest TEXT NOT NULL, result TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT '');
      INSERT OR IGNORE INTO app_meta VALUES ('revision', '0');`);
        for (const table of ENTITY_TABLES) {
            const columns = d.prepare(`PRAGMA table_info(${table})`).all();
            if (!columns.some((c) => c.name === 'extra'))
                d.exec(`ALTER TABLE ${table} ADD COLUMN extra TEXT NOT NULL DEFAULT '{}'`);
        }
        try {
            d.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(
                'logoUrl',
                '""'
            );
            d.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(
                'logoText',
                '"NKiot"'
            );
        } catch {}
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
        try {
            d.exec("ALTER TABLE processed_requests ADD COLUMN createdAt TEXT NOT NULL DEFAULT ''");
        } catch {}
        // Legacy rows have no timestamp; retention starts counting from this upgrade.
        d.prepare("UPDATE processed_requests SET createdAt=? WHERE createdAt=''").run(
            new Date().toISOString()
        );
        d.exec(
            'CREATE INDEX IF NOT EXISTS processed_requests_createdAt ON processed_requests(createdAt)'
        );
        d.prepare("UPDATE products SET status='archived' WHERE status='inactive'").run();
        // Migrate existing credentials without changing the user's password or business data.
        for (const user of d.prepare('SELECT id, password FROM users').all()) {
            if (!user.password?.startsWith('scrypt$'))
                d.prepare('UPDATE users SET password=? WHERE id=?').run(
                    hashPassword(user.password || ''),
                    user.id
                );
        }
        d.prepare("INSERT OR REPLACE INTO app_meta VALUES ('schema_version', '3')").run();
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
        .prepare('SELECT * FROM branches ORDER BY rowid')
        .all()
        .map((r) => ({
            ...r,
            isDefault: Boolean(r.isDefault)
        }));

    // 3. Categories
    const categories = d.prepare('SELECT * FROM categories ORDER BY rowid').all();

    // 4. Products
    const products = d
        .prepare('SELECT * FROM products ORDER BY rowid')
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
        .prepare('SELECT * FROM customers ORDER BY rowid')
        .all()
        .map((r) => ({
            ...r,
            totalSpent: Number(r.totalSpent) || 0,
            debt: Number(r.debt) || 0,
            points: Number(r.points) || 0
        }));

    // 6. Suppliers
    const suppliers = d
        .prepare('SELECT * FROM suppliers ORDER BY rowid')
        .all()
        .map((r) => ({
            ...r,
            debt: Number(r.debt) || 0,
            totalBought: Number(r.totalBought) || 0
        }));

    // 7. Invoices
    const invoices = d
        .prepare('SELECT * FROM invoices ORDER BY rowid')
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
        .prepare('SELECT * FROM imports ORDER BY rowid')
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
        .prepare('SELECT * FROM cashbook ORDER BY rowid')
        .all()
        .map((r) => ({
            ...r,
            amount: Number(r.amount) || 0
        }));

    // 10. Returns
    const returns = d
        .prepare('SELECT * FROM returns ORDER BY rowid')
        .all()
        .map((r) => ({
            ...r,
            items: parseItems(r.items),
            totalRefund: Number(r.totalRefund) || 0
        }));

    // 11. Stocktakes
    const stocktakes = d
        .prepare('SELECT * FROM stocktakes ORDER BY rowid')
        .all()
        .map((r) => ({
            ...r,
            items: parseItems(r.items),
            totalActual: Number(r.totalActual) || 0,
            totalVariance: Number(r.totalVariance) || 0
        }));

    // 12. Transfers
    const transfers = d
        .prepare('SELECT * FROM transfers ORDER BY rowid')
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
            .prepare('SELECT * FROM users ORDER BY rowid')
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
                    branches = r.branch ? [r.branch] : [FALLBACK_BRANCH];
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
        settings: Object.keys(settings).length
            ? { ...defaultData.settings, ...settings }
            : defaultData.settings,
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
    // Index once instead of scanning returns/customers per invoice (O(n+m) instead of O(n·m)).
    const returnsByInvoice = new Map();
    for (const r of result.returns) {
        const list = returnsByInvoice.get(r.invoiceCode);
        if (list) list.push(r);
        else returnsByInvoice.set(r.invoiceCode, [r]);
    }
    const customersByPhone = new Map();
    for (const c of result.customers) {
        if (c.code === RETAIL_CUSTOMER_CODE) continue;
        const list = customersByPhone.get(c.phone);
        if (list) list.push(c);
        else customersByPhone.set(c.phone, [c]);
    }
    for (const inv of result.invoices) {
        const slips = returnsByInvoice.get(inv.code) || [];
        inv.hasReturned = slips.length > 0 || !!inv.hasReturned;
        inv.returnedTotal = slips.length
            ? slips.reduce((sum, r) => sum + (r.returnValue ?? r.totalRefund), 0)
            : inv.returnedTotal || 0;
        if (!inv.customerId && inv.phone && inv.phone !== 'Tại quầy') {
            const matches = customersByPhone.get(inv.phone) || [];
            if (matches.length === 1) inv.customerId = matches[0].id;
        }
    }
    const activities = d.prepare("SELECT value FROM app_meta WHERE key='recentActivities'").get();
    result.recentActivities = activities ? JSON.parse(activities.value) : [];
    return result;
}

function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const key of Object.keys(value)) deepFreeze(value[key]);
    }
    return value;
}

// Read-only snapshot shared by request handlers that only read (session lookup, /api/data).
// Rebuilt when this connection has written anything (total_changes) or another connection/process
// committed (data_version). Inside a transaction always read fresh so uncommitted rows are never
// cached. The snapshot is deep-frozen: accidental mutation throws instead of corrupting the cache.
// Callers that need to modify data must use getAllData(), which always returns a fresh copy.
let snapshot = null,
    snapshotKey = '';
function readSnapshot() {
    const d = getDb();
    if (d.isTransaction) return getAllData();
    const key = `${d.prepare('SELECT total_changes() AS n').get().n}:${
        d.prepare('PRAGMA data_version').get().data_version
    }`;
    if (!snapshot || key !== snapshotKey) {
        const fresh = getAllData();
        // settings may fall back to the shared defaultData object; copy it before freezing.
        fresh.settings = { ...fresh.settings };
        snapshot = deepFreeze(fresh);
        snapshotKey = key;
    }
    return snapshot;
}

// Mutable data for a write transaction. Must be called inside the transaction (after BEGIN
// IMMEDIATE, before any write), so the snapshot key reflects exactly the committed state. When the
// snapshot is current, cloning it is ~2x cheaper than re-reading every table.
function readForWrite() {
    const d = getDb();
    if (!d.isTransaction) throw new Error('readForWrite() requires an open transaction.');
    const key = `${d.prepare('SELECT total_changes() AS n').get().n}:${
        d.prepare('PRAGMA data_version').get().data_version
    }`;
    return snapshot && key === snapshotKey ? structuredClone(snapshot) : getAllData();
}

// Column order and coercion for each entity table, applied identically on every save.
// `extra` (fields without a dedicated column) is appended by writeTable().
const cols = (s) => s.split(' ');
const items = (v) => (typeof v === 'string' ? v : JSON.stringify(v || []));
const ROW_WRITERS = {
    branches: [
        cols('id code name phone address isDefault note'),
        (b) => [
            b.id || '',
            b.code || '',
            b.name || '',
            b.phone || '',
            b.address || '',
            b.isDefault ? 1 : 0,
            b.note || ''
        ]
    ],
    categories: [cols('id name parentId'), (c) => [c.id || '', c.name || '', c.parentId || null]],
    products: [
        cols(
            'id code name category costPrice price stock minStock unit status barcode branch hasImei imeis'
        ),
        (p) => [
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
            p.branch || FALLBACK_BRANCH,
            p.hasImei ? 1 : 0,
            JSON.stringify(Array.isArray(p.imeis) ? p.imeis : [])
        ]
    ],
    customers: [
        cols('id code name phone address totalSpent debt points'),
        (c) => [
            c.id || '',
            c.code || '',
            c.name || '',
            c.phone || '',
            c.address || '',
            Number(c.totalSpent) || 0,
            Number(c.debt) || 0,
            Number(c.points) || 0
        ]
    ],
    suppliers: [
        cols('id code name phone address debt totalBought'),
        (s) => [
            s.id || '',
            s.code || '',
            s.name || '',
            s.phone || '',
            s.address || '',
            Number(s.debt) || 0,
            Number(s.totalBought) || 0
        ]
    ],
    invoices: [
        cols(
            'id code time customer phone items total paid discount redPaid grayBg status cashier branch'
        ),
        (i) => [
            i.id || '',
            i.code || '',
            i.time || '',
            i.customer || '',
            i.phone || '',
            items(i.items),
            Number(i.total) || 0,
            Number(i.paid) || 0,
            Number(i.discount) || 0,
            i.redPaid ? 1 : 0,
            i.grayBg ? 1 : 0,
            i.status || 'completed',
            i.cashier || '',
            i.branch || FALLBACK_BRANCH
        ]
    ],
    imports: [
        cols(
            'id code time nccCode nccName items needPay paid paymentMethod note status creator branch'
        ),
        (m) => [
            m.id || '',
            m.code || '',
            m.time || '',
            m.nccCode || '',
            m.nccName || '',
            items(m.items),
            Number(m.needPay) || 0,
            Number(m.paid) || 0,
            m.paymentMethod || 'bank',
            m.note || '',
            m.status || 'imported',
            m.creator || '',
            m.branch || FALLBACK_BRANCH
        ]
    ],
    cashbook: [
        cols('id code time type category amount person method note branch'),
        (c) => [
            c.id || '',
            c.code || '',
            c.time || '',
            c.type || 'thu',
            c.category || '',
            Number(c.amount) || 0,
            c.person || '',
            c.method || '',
            c.note || '',
            c.branch || FALLBACK_BRANCH
        ]
    ],
    returns: [
        cols(
            'id code invoiceCode time customer phone items totalRefund refundMethod reason cashier branch'
        ),
        (r) => [
            r.id || '',
            r.code || '',
            r.invoiceCode || '',
            r.time || '',
            r.customer || '',
            r.phone || '',
            items(r.items),
            Number(r.totalRefund) || 0,
            r.refundMethod || '',
            r.reason || '',
            r.cashier || '',
            r.branch || FALLBACK_BRANCH
        ]
    ],
    stocktakes: [
        cols('id code time cashier branch status note totalActual totalVariance items'),
        (s) => [
            s.id || '',
            s.code || '',
            s.time || '',
            s.cashier || '',
            s.branch || FALLBACK_BRANCH,
            s.status || 'balanced',
            s.note || '',
            Number(s.totalActual) || 0,
            Number(s.totalVariance) || 0,
            items(s.items)
        ]
    ],
    transfers: [
        cols(
            'id code time fromBranch toBranch cashier status receivedTime receiver totalQty totalValue note items'
        ),
        (t) => [
            t.id || '',
            t.code || '',
            t.time || '',
            t.fromBranch || FALLBACK_BRANCH,
            t.toBranch || 'Chi nhánh Hà Nội',
            t.cashier || '',
            t.status || 'shipping',
            t.receivedTime || null,
            t.receiver || null,
            Number(t.totalQty) || 0,
            Number(t.totalValue) || 0,
            t.note || '',
            items(t.items)
        ]
    ],
    users: [
        cols(
            'id code name username password phone role roleName branch branches status permissions'
        ),
        (u) => {
            const branchesArr =
                Array.isArray(u.branches) && u.branches.length > 0
                    ? u.branches
                    : u.branch
                      ? [u.branch]
                      : [FALLBACK_BRANCH];
            return [
                u.id || `NV${Date.now()}`,
                u.code || '',
                u.name || '',
                u.username || '',
                u.password || '',
                u.phone || '',
                u.role || 'cashier',
                u.roleName || '',
                u.branch || branchesArr[0] || FALLBACK_BRANCH,
                JSON.stringify(branchesArr),
                u.status || 'active',
                typeof u.permissions === 'object'
                    ? JSON.stringify(u.permissions)
                    : u.permissions || '{}'
            ];
        }
    ]
};

// Brings one table in line with `rows` (array order = rowid order, which getAllData reads back).
// Common case (records prepended/appended, a few edited) touches only the changed rows. Anything
// else (reordering, inserts in the middle, duplicate ids, unexpected legacy columns) falls back to
// the original delete-and-reinsert, so the stored result is identical either way.
function writeTable(d, table, rows, fullRewrite) {
    const [baseColumns, toParams] = ROW_WRITERS[table];
    const columns = [...baseColumns, 'extra'];
    const dbColumns = d
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((c) => c.name);
    const known = new Set(dbColumns);
    const params = rows.map((row) => [
        ...toParams(row),
        JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key]) => !known.has(key))))
    ]);
    const placeholders = columns.map(() => '?').join(',');
    const rewrite = () => {
        d.exec(`DELETE FROM ${table}`);
        const insert = d.prepare(
            `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`
        );
        for (const p of params) insert.run(...p);
    };
    const newIds = params.map((p) => p[0]);
    if (
        fullRewrite ||
        dbColumns.length !== columns.length ||
        dbColumns.some((c) => !columns.includes(c)) ||
        new Set(newIds).size !== newIds.length
    )
        return rewrite();

    const existing = d
        .prepare(`SELECT rowid AS _rowid, ${columns.join(',')} FROM ${table} ORDER BY rowid`)
        .all();
    const oldIndex = new Map(existing.map((r, i) => [r.id, i]));
    // Kept rows must keep their relative order; new rows may only come before or after them.
    let first = -1,
        last = -1,
        previous = -1;
    for (let i = 0; i < newIds.length; i++) {
        const at = oldIndex.get(newIds[i]);
        if (at === undefined) continue;
        if (at < previous) return rewrite();
        previous = at;
        if (first < 0) first = i;
        last = i;
    }
    if (first < 0) return rewrite();
    for (let i = first; i <= last; i++) if (!oldIndex.has(newIds[i])) return rewrite();

    const keep = new Set(newIds.slice(first, last + 1));
    const remove = d.prepare(`DELETE FROM ${table} WHERE rowid=?`);
    for (const row of existing) if (!keep.has(row.id)) remove.run(row._rowid);
    const update = d.prepare(
        `UPDATE ${table} SET ${columns
            .slice(1)
            .map((c) => `${c}=?`)
            .join(',')} WHERE id=?`
    );
    for (let i = first; i <= last; i++) {
        const p = params[i],
            old = existing[oldIndex.get(p[0])];
        // Strict comparison: a type mismatch only causes a redundant UPDATE, never a missed one.
        if (columns.some((c, k) => old[c] !== p[k])) update.run(...p.slice(1), p[0]);
    }
    const insert = d.prepare(
        `INSERT INTO ${table} (rowid,${columns.join(',')}) VALUES (?,${placeholders})`
    );
    // Rows before the first kept row / after the last were deleted above, so these rowids are
    // free. Prefix rowids may go negative, which SQLite allows and still sorts correctly.
    const firstRowid = existing[oldIndex.get(newIds[first])]._rowid;
    for (let i = 0; i < first; i++) insert.run(firstRowid - (first - i), ...params[i]);
    const lastRowid = existing[oldIndex.get(newIds[last])]._rowid;
    for (let i = last + 1; i < params.length; i++) insert.run(lastRowid + (i - last), ...params[i]);
}

// `options.fullRewrite` forces delete-and-reinsert for every table (used to verify the diff path).
function saveAllData(data, withinTransaction = false, options = {}) {
    if (!data) return false;
    const d = getDb();

    if (!withinTransaction) d.exec('BEGIN IMMEDIATE');
    try {
        if (data.settings && typeof data.settings === 'object') {
            d.exec('DELETE FROM settings');
            const stmt = d.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
            for (const [k, v] of Object.entries(data.settings)) stmt.run(k, JSON.stringify(v));
        }
        for (const table of ENTITY_TABLES)
            if (Array.isArray(data[table]))
                writeTable(d, table, data[table], !!options.fullRewrite);
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
    ENTITY_TABLES,
    getDb,
    initDb,
    getAllData,
    readSnapshot,
    readForWrite,
    saveAllData,
    getStats
};
