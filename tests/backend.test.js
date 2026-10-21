'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
    os = require('node:os'),
    path = require('node:path'),
    crypto = require('node:crypto');
const { PassThrough } = require('node:stream');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'minikiot-test-'));
process.env.MINIKIOT_DB_PATH = path.join(dir, 'test.db');
process.env.MINIKIOT_ADMIN_PASSWORD = 'Test-password-123';
const db = require('../db'),
    { hashPassword } = require('../security'),
    app = require('../application'),
    { handler } = require('../server');
const { defaultData } = require('../data');
let admin;
function fixture() {
    const d = JSON.parse(JSON.stringify(defaultData));
    for (const k of db.ENTITY_TABLES) d[k] = [];
    d.branches = [
        { id: 'A', code: 'A', name: 'A' },
        { id: 'B', code: 'B', name: 'B' }
    ];
    d.settings = { ...defaultData.settings, branch: 'A' };
    d.products = [
        {
            id: 'SP',
            code: 'SP',
            name: 'Product',
            branch: 'A',
            stock: 3,
            price: 100000,
            costPrice: 50000,
            unit: 'Chiếc',
            category: 'Test',
            status: 'active',
            hasImei: true,
            imeis: ['I1', 'I2', 'I3'],
            minStock: 0
        }
    ];
    d.customers = [
        { id: 'C', code: 'C', name: 'Customer', phone: '000', debt: 0, totalSpent: 0, points: 0 }
    ];
    d.suppliers = [{ id: 'S', code: 'S', name: 'Supplier', phone: '', debt: 0, totalBought: 0 }];
    d.users = [
        {
            id: 'ADMIN',
            code: 'ADMIN',
            name: 'Admin',
            username: 'admin',
            password: hashPassword('Test-password-123'),
            role: 'admin',
            status: 'active',
            permissions: {},
            branch: 'A',
            branches: ['A', 'B']
        }
    ];
    return d;
}
function command(
    type,
    payload,
    revision = app.revision(),
    requestId = crypto.randomUUID(),
    user = admin
) {
    return app.transact(user, { type, payload, revision, requestId });
}
const sell = (opts = {}) =>
    command('sale', {
        branch: 'A',
        items: [{ code: 'SP', qty: 1 }],
        discount: 0,
        given: 100000,
        paymentMethod: 'cash',
        ...opts
    }).result;
async function request(method, url, input, cookie, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        const req = new PassThrough();
        req.method = method;
        req.url = url;
        req.headers = {
            host: 'localhost',
            'content-type': 'application/json',
            ...(cookie ? { cookie } : {}),
            ...extraHeaders
        };
        req.socket = { remoteAddress: '127.0.0.1' };
        const headers = {};
        const res = {
            headersSent: false,
            setHeader(k, v) {
                headers[k.toLowerCase()] = v;
            },
            writeHead(status, h) {
                this.status = status;
                Object.assign(headers, h);
                this.headersSent = true;
            },
            end(body) {
                let json;
                try {
                    json = JSON.parse(body);
                } catch {}
                resolve({ status: this.status, headers, body, json });
            }
        };
        handler(req, res).catch(reject);
        req.end(input === undefined ? '' : JSON.stringify(input));
    });
}
before(() => db.initDb());
beforeEach(() => {
    db.saveAllData(fixture());
    db.getDb().exec('DELETE FROM processed_requests');
    admin = db.getAllData().users[0];
});
after(() => db.getDb().close());
test('empty catalog survives restart and passwords are migrated', () => {
    const d = db.getAllData();
    d.products = [];
    d.invoices = [{ id: 'KEEP', code: 'KEEP', items: [], total: 0 }];
    d.users[0].password = 'legacy';
    db.saveAllData(d);
    db.initDb();
    assert.equal(db.getAllData().invoices[0].id, 'KEEP');
    assert.match(db.getAllData().users[0].password, /^scrypt\$/);
});
test('all extended invoice/customer fields survive SQLite roundtrip', () => {
    const d = db.getAllData();
    d.invoices = [
        {
            id: 'I',
            code: 'I',
            items: [],
            paymentMethod: 'card',
            customerId: 'C',
            note: 'n',
            hasReturned: true,
            cancelReason: 'r',
            cancelTime: 't',
            returnedTotal: 123
        }
    ];
    d.customers[0].note = 'customer note';
    db.saveAllData(d);
    assert.equal(db.getAllData().invoices[0].returnedTotal, 123);
    assert.equal(db.getAllData().invoices[0].paymentMethod, 'card');
    assert.equal(db.getAllData().customers[0].note, 'customer note');
});
test('stale snapshot is rejected, preserving committed invoice', () => {
    const rev = app.revision(),
        old = app.project(db.getAllData(), admin);
    sell();
    old.customers[0].name = 'changed';
    assert.throws(
        () => command('edit', old, rev),
        (e) => e.status === 409
    );
    assert.equal(db.getAllData().invoices.length, 1);
});
test('same request retries once, different payload cannot reuse id', () => {
    const id = crypto.randomUUID(),
        rev = app.revision(),
        payload = {
            branch: 'A',
            items: [{ code: 'SP', qty: 1 }],
            discount: 0,
            given: 100000,
            paymentMethod: 'cash'
        };
    command('sale', payload, rev, id);
    assert.equal(command('sale', payload, rev, id).replayed, true);
    assert.equal(db.getAllData().invoices.length, 1);
    assert.throws(
        () => command('sale', { ...payload, given: 0 }, rev, id),
        (e) => e.status === 409
    );
});
test('stock and retail underpayment failures leave no partial changes', () => {
    assert.throws(() => sell({ items: [{ code: 'SP', qty: 4 }], given: 400000 }));
    assert.throws(() => sell({ given: 0 }));
    const d = db.getAllData();
    assert.equal(d.products[0].stock, 3);
    assert.equal(d.products[0].imeis.length, 3);
    assert.equal(d.invoices.length, 0);
    assert.equal(d.cashbook.length, 0);
});
test('sale snapshots serial and historic cost; discounted credit return settles debt first', () => {
    const inv = sell({ discount: 20000, given: 30000, customerId: 'C' });
    assert.deepEqual(inv.items[0].imeis, ['I1']);
    assert.equal(inv.items[0].costPrice, 50000);
    const r = command('return', {
        invoiceId: inv.id,
        items: [{ code: 'SP', qty: 1 }],
        refundMethod: 'cash'
    }).result;
    assert.equal(r.totalRefund, 30000);
    assert.equal(r.returnValue, 80000);
    assert.equal(r.debtReduction, 50000);
    const d = db.getAllData();
    assert.equal(d.customers[0].debt, 0);
    assert.equal(d.customers[0].totalSpent, 0);
    assert.equal(d.products[0].stock, 3);
    assert.deepEqual(d.products[0].imeis.sort(), ['I1', 'I2', 'I3']);
    assert.throws(() => command('return', { invoiceId: inv.id, items: [{ code: 'SP', qty: 1 }] }));
    command('cancel', { invoiceId: inv.id });
    assert.equal(db.getAllData().products[0].stock, 3);
    assert.equal(db.getAllData().cashbook.filter((c) => c.type === 'chi').length, 1);
});
test('partial return then cancel refunds only remainder', () => {
    const inv = sell({ items: [{ code: 'SP', qty: 3 }], discount: 10000, given: 290000 });
    command('return', { invoiceId: inv.id, items: [{ code: 'SP', qty: 1 }] });
    command('cancel', { invoiceId: inv.id });
    const d = db.getAllData();
    assert.equal(
        d.cashbook.filter((c) => c.type === 'chi').reduce((s, c) => s + c.amount, 0),
        290000
    );
    assert.equal(d.products[0].stock, 3);
    assert.throws(() => command('cancel', { invoiceId: inv.id }));
});
test('customer id prevents cancellation against another customer with same name', () => {
    const d = db.getAllData();
    d.customers.unshift({
        ...d.customers[0],
        id: 'OTHER',
        code: 'OTHER',
        phone: '999',
        debt: 300000
    });
    db.saveAllData(d);
    const inv = sell({ given: 0, customerId: 'C' });
    command('cancel', { invoiceId: inv.id });
    const after = db.getAllData();
    assert.equal(after.customers.find((c) => c.id === 'OTHER').debt, 300000);
    assert.equal(after.customers.find((c) => c.id === 'C').debt, 0);
});
test('debt collection allocates invoice payments and later cancel returns collected money', () => {
    const inv = sell({ given: 0, customerId: 'C' });
    command('debt', { branch: 'A', partnerId: 'C', type: 'thu', amount: 100000, method: 'cash' });
    assert.equal(db.getAllData().invoices[0].paid, 100000);
    command('cancel', { invoiceId: inv.id });
    assert.equal(db.getAllData().cashbook.find((c) => c.type === 'chi').amount, 100000);
});
test('receive assigns distinct product IDs to multiple new destination products', () => {
    const d = db.getAllData();
    d.products.push({
        ...d.products[0],
        id: 'SP2',
        code: 'SP2',
        name: 'Second product',
        hasImei: false,
        imeis: [],
        stock: 2
    });
    db.saveAllData(d);
    const transfer = command('transfer', {
        fromBranch: 'A',
        toBranch: 'B',
        items: [
            { code: 'SP', qty: 1 },
            { code: 'SP2', qty: 1 }
        ]
    }).result;
    command('receive', { id: transfer.id });
    const received = db
        .getAllData()
        .products.filter((p) => p.branch === 'B' && ['SP', 'SP2'].includes(p.code));
    assert.equal(received.length, 2);
    assert.equal(new Set(received.map((p) => p.id)).size, 2);
});

test('transfer carries serials, rejects receive twice, updates weighted cost', () => {
    const d = db.getAllData();
    d.products.push({
        ...d.products[0],
        id: 'BSP',
        branch: 'B',
        stock: 1,
        costPrice: 100000,
        imeis: ['B1']
    });
    db.saveAllData(d);
    const transfer = command('transfer', {
        fromBranch: 'A',
        toBranch: 'B',
        items: [{ code: 'SP', qty: 1 }]
    }).result;
    assert.equal(db.getAllData().products.find((p) => p.branch === 'A').imeis.length, 2);
    command('receive', { id: transfer.id });
    const dest = db.getAllData().products.find((p) => p.branch === 'B');
    assert.equal(dest.costPrice, 75000);
    assert.deepEqual(dest.imeis, ['B1', 'I1']);
    assert.throws(() => command('receive', { id: transfer.id }));
});
test('receiving a discontinued product keeps it discontinued at the destination', () => {
    const d = db.getAllData();
    d.products[0].status = 'archived';
    db.saveAllData(d);
    const transfer = command('transfer', {
        fromBranch: 'A',
        toBranch: 'B',
        items: [{ code: 'SP', qty: 1 }]
    }).result;
    // Legacy transfer without a status snapshot falls back to the source product.
    const legacy = command('transfer', {
        fromBranch: 'A',
        toBranch: 'B',
        items: [{ code: 'SP', qty: 1 }]
    }).result;
    const raw = db.getAllData();
    delete raw.transfers.find((t) => t.id === legacy.id).items[0].productSnapshot.status;
    db.saveAllData(raw);
    command('receive', { id: legacy.id });
    command('receive', { id: transfer.id });
    const dest = db.getAllData().products.find((p) => p.branch === 'B');
    assert.equal(dest.status, 'archived');
    assert.equal(dest.stock, 2);
    assert.throws(() => sell({ branch: 'B' }), /ngừng kinh doanh/);
});
test('stocktake draft cannot overwrite subsequent sales', () => {
    const st = command('stocktake', {
        branch: 'A',
        items: [{ code: 'SP', systemStock: 3, actualStock: 3 }],
        balance: false
    }).result;
    sell();
    assert.throws(
        () => command('stocktake', { id: st.id, balance: true }),
        (e) => e.status === 409
    );
    assert.equal(db.getAllData().products[0].stock, 2);
});
test('import rejects duplicate serial across warehouses and invalid amounts', () => {
    assert.throws(() =>
        command('import', {
            branch: 'A',
            supplierCode: 'S',
            items: [{ code: 'SP', qty: 1, price: 50000, hasImei: true, imeis: ['I1'] }],
            paid: 50000,
            paymentMethod: 'cash'
        })
    );
    assert.throws(() => sell({ discount: -1 }));
    assert.throws(() => sell({ given: Infinity }));
});
test('generic edit cannot forge financial records or bypass table permissions', () => {
    const data = app.project(db.getAllData(), admin);
    data.invoices = [{ id: 'bad', items: 'not-json' }];
    assert.throws(
        () => command('edit', data),
        (e) => e.status === 403
    );
    assert.equal(db.getAllData().invoices.length, 0);
    const warehouse = {
        ...admin,
        id: 'W',
        role: 'warehouse',
        branch: 'A',
        branches: ['A'],
        permissions: { products: true },
        status: 'active',
        username: 'warehouse',
        code: 'W'
    };
    const withWarehouse = db.getAllData();
    withWarehouse.users.push(warehouse);
    db.saveAllData(withWarehouse);
    assert.throws(() => sell.call(null, { branch: 'B' }));
    assert.throws(
        () =>
            command(
                'sale',
                { branch: 'A', items: [] },
                app.revision(),
                crypto.randomUUID(),
                warehouse
            ),
        (e) => e.status === 403
    );
});
test('catalog edits preserve passwords and reject duplicate codes', () => {
    const input = app.project(db.getAllData(), admin);
    input.users[0].name = 'New name';
    command('edit', input);
    assert.match(db.getAllData().users[0].password, /^scrypt\$/);
    const dup = app.project(db.getAllData(), admin);
    dup.products.push({ ...dup.products[0], id: 'OTHER' });
    assert.throws(() => command('edit', dup));
});
test('product sync respects branch scope and uses the edited branch row as source', () => {
    const data = db.getAllData();
    data.products.push({
        ...data.products[0],
        id: 'SP-B',
        branch: 'B',
        name: 'B original',
        stock: 0,
        imeis: []
    });
    const worker = {
        ...admin,
        id: 'WORKER',
        code: 'WORKER',
        username: 'worker',
        role: 'warehouse',
        branch: 'A',
        branches: ['A'],
        permissions: { products: true }
    };
    data.users.push(worker);
    db.saveAllData(data);

    const priceOnly = app.project(db.getAllData(), worker);
    priceOnly.products[0].price = 120000;
    command('edit', priceOnly, app.revision(), crypto.randomUUID(), worker);
    assert.equal(db.getAllData().products.find((p) => p.id === 'SP-B').price, 100000);

    const shared = app.project(db.getAllData(), worker);
    shared.products[0].name = 'A changed';
    assert.throws(
        () => command('edit', shared, app.revision(), crypto.randomUUID(), worker),
        (error) => error.status === 403
    );
    assert.equal(db.getAllData().products.find((p) => p.id === 'SP').name, 'Product');

    const fromB = app.project(db.getAllData(), admin);
    fromB.products.reverse().find((p) => p.branch === 'B').name = 'From B';
    command('edit', fromB);
    assert.deepEqual(
        db
            .getAllData()
            .products.map((p) => p.name)
            .sort(),
        ['From B', 'From B']
    );
});
test('customer edits do not trigger product sync or product permission checks', () => {
    const data = db.getAllData();
    const cashier = {
        ...admin,
        id: 'CASHIER',
        code: 'CASHIER',
        username: 'cashier',
        role: 'cashier',
        branch: 'A',
        branches: ['A'],
        permissions: { customers: true }
    };
    data.users.push(cashier);
    db.saveAllData(data);
    const input = app.project(db.getAllData(), cashier);
    input.customers[0].name = 'Changed customer';
    command('edit', input, app.revision(), crypto.randomUUID(), cashier);
    assert.equal(db.getAllData().customers[0].name, 'Changed customer');
    assert.equal(db.getAllData().products.length, 1);
});
test('product IMEI mode cannot propagate to another branch with stock', () => {
    const data = db.getAllData();
    Object.assign(data.products[0], { stock: 0, imeis: [] });
    data.products.push({
        ...data.products[0],
        id: 'SP-B',
        branch: 'B',
        stock: 1,
        imeis: ['B1']
    });
    db.saveAllData(data);
    const input = app.project(db.getAllData(), admin);
    input.products.find((p) => p.branch === 'A').hasImei = false;
    assert.throws(() => command('edit', input), /IMEI/);
    assert.equal(db.getAllData().products.find((p) => p.branch === 'B').hasImei, true);
});
test('generated cross-branch product IDs cannot exceed 160 characters', () => {
    const input = app.project(db.getAllData(), admin);
    input.products.push({
        ...input.products[0],
        id: 'LONG',
        code: 'X'.repeat(159),
        stock: 0,
        imeis: []
    });
    assert.throws(() => command('edit', input), /quá dài/);
    assert.equal(db.getAllData().products.length, 1);
});
test('HTTP routes deny unauthenticated reads/writes and database downloads', async () => {
    for (const url of ['/api/data', '/api/status'])
        assert.equal((await request('GET', url)).status, 401);
    assert.equal((await request('POST', '/api/reset', {})).status, 401);
    for (const url of [
        '/minikiot.db',
        '/minikiot.db-wal',
        '/db.js',
        '/data.js.map',
        '/CODE_REVIEW.md'
    ])
        assert.equal((await request('GET', url)).status, 404);
    const script = await request('GET', '/data.js');
    assert.equal(script.status, 200);
    assert.ok(!script.body.toString().includes("password: '123'"));
});
test('login session hides credentials, enforces origin and invalidates after password change', async () => {
    const login = await request('POST', '/api/login', {
        username: 'admin',
        password: 'Test-password-123'
    });
    assert.equal(login.status, 200);
    assert.ok(!('password' in login.json.user));
    assert.ok(login.json.data.users.every((u) => !('password' in u)));
    const cookie = login.headers['set-cookie'].split(';')[0];
    assert.equal((await request('GET', '/api/data', undefined, cookie)).status, 200);
    assert.equal((await request('POST', '/api/command', {}, cookie)).status, 403);
    assert.equal(
        (
            await request('POST', '/api/command', {}, cookie, {
                origin: 'https://evil.example',
                'x-minikiot-csrf': login.json.csrfToken
            })
        ).status,
        403
    );
    assert.equal(
        (
            await request(
                'POST',
                '/api/password',
                { current: 'Test-password-123', next: 'Changed-password-456' },
                cookie,
                { 'x-minikiot-csrf': login.json.csrfToken }
            )
        ).status,
        200
    );
    assert.equal((await request('GET', '/api/data', undefined, cookie)).status, 401);
});

test('branch permissions and revoked sessions are enforced by the server', async () => {
    const data = db.getAllData();
    const cashier = {
        ...admin,
        id: 'LIMITED',
        code: 'LIMITED',
        username: 'limited',
        role: 'cashier',
        branch: 'A',
        branches: ['A'],
        permissions: { pos: true, invoices: true }
    };
    data.users.push(cashier);
    data.products.push({ ...data.products[0], id: 'BSP', branch: 'B', imeis: ['B1', 'B2', 'B3'] });
    db.saveAllData(data);
    const projected = app.project(data, cashier);
    assert.equal(projected.products.length, 1);
    assert.equal(projected.users.length, 0);
    assert.throws(
        () =>
            command(
                'sale',
                {
                    branch: 'B',
                    items: [{ code: 'SP', qty: 1 }],
                    given: 100000,
                    paymentMethod: 'cash'
                },
                app.revision(),
                crypto.randomUUID(),
                cashier
            ),
        (e) => e.status === 403
    );
    const login = await request('POST', '/api/login', {
        username: 'limited',
        password: 'Test-password-123'
    });
    const cookie = login.headers['set-cookie'].split(';')[0];
    db.getDb().prepare("UPDATE users SET status='locked' WHERE id='LIMITED'").run();
    assert.equal((await request('GET', '/api/data', undefined, cookie)).status, 401);
});

test('staff managers cannot grant privileges or modify administrators', () => {
    const data = db.getAllData();
    const manager = {
        ...admin,
        id: 'M',
        code: 'M',
        username: 'manager',
        role: 'manager',
        branch: 'A',
        branches: ['A'],
        permissions: { users: true }
    };
    data.users.push(manager);
    db.saveAllData(data);
    const elevated = app.project(db.getAllData(), manager);
    elevated.users.find((u) => u.id === 'M').permissions.cashbook = true;
    assert.throws(
        () => command('edit', elevated, app.revision(), crypto.randomUUID(), manager),
        (e) => e.status === 403
    );
    const editAdmin = app.project(db.getAllData(), manager);
    editAdmin.users.find((u) => u.id === 'ADMIN').name = 'Changed';
    assert.throws(
        () => command('edit', editAdmin, app.revision(), crypto.randomUUID(), manager),
        (e) => e.status === 403
    );
    const noAdmin = app.project(db.getAllData(), admin);
    noAdmin.users[0].role = 'manager';
    assert.throws(() => command('edit', noAdmin));
    assert.equal(db.getAllData().users[0].role, 'admin');
});

test('in-transit serials cannot be recreated through import or catalog edits', () => {
    command('transfer', { fromBranch: 'A', toBranch: 'B', items: [{ code: 'SP', qty: 1 }] });
    assert.throws(() =>
        command('import', {
            branch: 'A',
            supplierCode: 'S',
            items: [{ code: 'SP', qty: 1, price: 50000, hasImei: true, imeis: ['I1'] }],
            paid: 50000,
            paymentMethod: 'cash'
        })
    );
    const edit = app.project(db.getAllData(), admin);
    edit.products[0].stock++;
    edit.products[0].imeis.push('I1');
    assert.throws(() => command('edit', edit));
    assert.equal(db.getAllData().products[0].stock, 2);
});

test('malformed legacy JSON stays intact and blocks mutations without crashing reads', () => {
    sell();
    db.getDb().prepare("UPDATE invoices SET items='bad-json'").run();
    assert.doesNotThrow(() => db.getAllData());
    assert.throws(
        () => sell(),
        (e) => e.status === 422
    );
    assert.equal(db.getDb().prepare('SELECT items FROM invoices').get().items, 'bad-json');
    db.getDb().prepare("UPDATE invoices SET items='[]'").run();
    db.getDb().prepare("UPDATE customers SET extra='bad-json'").run();
    assert.throws(
        () => sell(),
        (e) => e.status === 422
    );
    assert.equal(db.getDb().prepare('SELECT extra FROM customers').get().extra, 'bad-json');
});

test('backup captures WAL commits, is restorable, and refuses to overwrite files', () => {
    sell();
    const { backupDatabase } = require('../backup');
    const destination = path.join(dir, 'snapshot.db');
    backupDatabase(process.env.MINIKIOT_DB_PATH, destination);
    const restored = new (require('node:sqlite').DatabaseSync)(destination, { readOnly: true });
    try {
        assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
        assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM invoices').get().n, 1);
        assert.equal(restored.prepare('SELECT stock FROM products').get().stock, 2);
    } finally {
        restored.close();
    }
    assert.throws(() => backupDatabase(process.env.MINIKIOT_DB_PATH, destination));
});

test('backup CLI uses the same NKIOT_DB_PATH precedence as the server', () => {
    const destination = path.join(dir, 'cli-snapshot.db');
    const result = require('node:child_process').spawnSync(
        process.execPath,
        ['backup.js', destination],
        {
            cwd: path.join(__dirname, '..'),
            env: {
                ...process.env,
                NKIOT_DB_PATH: process.env.MINIKIOT_DB_PATH,
                MINIKIOT_DB_PATH: path.join(dir, 'missing.db')
            },
            encoding: 'utf8'
        }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(require('../backup').validateBackup(destination), true);
});

test('backup rotation validates every retained snapshot', () => {
    const { rotateBackups, validateBackup } = require('../backup');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'minikiot-rotation-'));
    const first = rotateBackups(process.env.MINIKIOT_DB_PATH, directory, 1);
    assert.equal(validateBackup(first), true);
    const second = rotateBackups(process.env.MINIKIOT_DB_PATH, directory, 1);
    assert.equal(validateBackup(second), true);
    assert.equal(fs.readdirSync(directory).filter((name) => name.endsWith('.db')).length, 1);
});
test('status migration, createdAt and idempotency retention are applied', () => {
    db.getDb().exec("UPDATE products SET status='inactive' WHERE id='SP'");
    db.initDb();
    assert.equal(db.getAllData().products[0].status, 'archived');
    db.getDb().exec("UPDATE products SET status='active' WHERE id='SP'");
    const requestId = crypto.randomUUID();
    const { result } = command(
        'sale',
        { branch: 'A', items: [{ code: 'SP', qty: 1 }], given: 100000, paymentMethod: 'cash' },
        app.revision(),
        requestId
    );
    assert.match(result.createdAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.match(result.time, /^\d\d\/\d\d\/\d{4} \d\d:\d\d$/);
    const database = db.getDb();
    database
        .prepare(
            'INSERT INTO processed_requests (id,userId,digest,result,createdAt) VALUES (?,?,?,?,?)'
        )
        .run('OLD', admin.id, 'digest', '{}', '2000-01-01T00:00:00.000Z');
    sell();
    assert.equal(
        database.prepare("SELECT 1 FROM processed_requests WHERE id='OLD'").get(),
        undefined
    );
    // Expired cached result: the audit row still blocks a second execution of the same request.
    database.prepare('DELETE FROM processed_requests WHERE id=?').run(requestId);
    assert.throws(
        () =>
            command(
                'sale',
                {
                    branch: 'A',
                    items: [{ code: 'SP', qty: 1 }],
                    given: 100000,
                    paymentMethod: 'cash'
                },
                app.revision(),
                requestId
            ),
        { status: 409 }
    );
    assert.equal(db.getAllData().invoices.length, 2);
});
test('deterministic fuzz keeps stock, serials and failed commands consistent', () => {
    let seed = 0x5eed;
    const random = (n) => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed % n;
    };
    const dump = () => JSON.stringify(db.getAllData());
    for (let step = 0; step < 150; step++) {
        const data = db.getAllData(),
            p = data.products[0],
            invoices = data.invoices.filter((i) => i.status !== 'cancelled'),
            before = dump();
        try {
            const kind = random(3);
            if (kind === 0)
                sell({
                    items: [{ code: 'SP', qty: 1 + random(3) }],
                    given: random(2) ? 1000000 : random(100000)
                });
            else if (kind === 1 && invoices.length)
                command('return', {
                    invoiceId: invoices[random(invoices.length)].id,
                    items: [{ code: 'SP', qty: 1 + random(2) }]
                });
            else
                command('import', {
                    branch: 'A',
                    supplierCode: 'S',
                    paymentMethod: 'cash',
                    paid: 0,
                    items: [
                        {
                            code: 'SP',
                            qty: 1,
                            price: 50000,
                            imeis: [random(4) ? `F${step}` : p.imeis[0] || `F${step}`]
                        }
                    ]
                });
        } catch (error) {
            assert.ok(error.status >= 400 && error.status < 500, error.stack);
            assert.equal(dump(), before, `step ${step} changed data after ${error.message}`);
        }
        const after = db.getAllData().products[0];
        assert.ok(after.stock >= 0);
        assert.equal(after.imeis.length, after.stock);
        assert.equal(new Set(after.imeis).size, after.imeis.length);
    }
});
test('discount rounding remains exact across partial returns of a large invoice', () => {
    const data = db.getAllData();
    data.products[0].price = 1000000000000001;
    db.saveAllData(data);
    const inv = sell({
        items: [{ code: 'SP', qty: 3 }],
        discount: 1000000000000000,
        given: 3000000000000003
    });
    for (let i = 0; i < 3; i++)
        command('return', { invoiceId: inv.id, items: [{ code: 'SP', qty: 1 }] });
    const refunds = db.getAllData().returns.reduce((s, r) => s + r.totalRefund, 0);
    assert.equal(refunds, inv.total);
    assert.equal(db.getAllData().invoices[0].paid, 0);
});

test('JSON arrays and null are rejected as malformed API bodies', async () => {
    assert.equal((await request('POST', '/api/login', null)).status, 400);
    assert.equal((await request('POST', '/api/login', [])).status, 400);
});

test('read snapshot is frozen, shared, and refreshed after any write', () => {
    const first = db.readSnapshot();
    assert.equal(db.readSnapshot(), first);
    assert.ok(Object.isFrozen(first.products[0]));
    assert.throws(() => {
        first.products[0].stock = 99;
    }, TypeError);
    assert.equal(Object.isFrozen(db.getAllData().products[0]), false);
    db.getDb().prepare("UPDATE products SET minStock=7 WHERE id='SP'").run();
    assert.equal(db.readSnapshot().products[0].minStock, 7);
    sell();
    assert.equal(db.readSnapshot().products[0].stock, 2);
    assert.equal(db.readSnapshot().invoices.length, 1);
    const projected = app.project(db.readSnapshot(), admin);
    assert.equal(projected.users[0].password, undefined);
    assert.ok(db.readSnapshot().users[0].password);
});

test('static assets support gzip and ETag revalidation', async () => {
    const zlib = require('node:zlib');
    const plain = await request('GET', '/app.js');
    assert.equal(plain.status, 200);
    assert.equal(plain.headers['Content-Encoding'], undefined);
    const etag = plain.headers.ETag;
    assert.match(etag, /^"[\w-]+"$/);
    const zipped = await request('GET', '/app.js', undefined, undefined, {
        'accept-encoding': 'gzip, br'
    });
    assert.equal(zipped.headers['Content-Encoding'], 'gzip');
    assert.equal(zlib.gunzipSync(zipped.body).toString(), plain.body.toString());
    assert.ok(zipped.body.length < plain.body.length / 3);
    const revalidated = await request('GET', '/app.js', undefined, undefined, {
        'if-none-match': etag
    });
    assert.equal(revalidated.status, 304);
    assert.equal(revalidated.body, undefined);
});
test('local CSS and fonts are served with correct MIME types', async () => {
    for (const [url, type] of [
        ['/assets/tailwind.css', 'text/css'],
        ['/assets/inter.css', 'text/css'],
        ['/assets/inter-vietnamese-wght-normal.woff2', 'font/woff2'],
        ['/assets/inter-latin-ext-wght-normal.woff2', 'font/woff2'],
        ['/assets/inter-latin-wght-normal.woff2', 'font/woff2']
    ]) {
        const response = await request('GET', url);
        assert.equal(response.status, 200);
        assert.ok(response.headers['Content-Type'].startsWith(type));
        assert.ok(response.body.length > 100);
    }
    const html = (await request('GET', '/')).body.toString();
    assert.ok(!html.includes('cdn.tailwindcss.com'));
    assert.ok(!html.includes('fonts.googleapis.com'));
});
test('diff-based save stores exactly what a full rewrite stores', () => {
    const d = db.getDb();
    const dump = () =>
        Object.fromEntries(
            db.ENTITY_TABLES.map((t) => [t, d.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()])
        );
    // Same input saved both ways, each from the same starting state (rolled back in between).
    const saveBoth = (data) => {
        const out = [];
        for (const fullRewrite of [false, true]) {
            d.exec('BEGIN IMMEDIATE');
            try {
                db.saveAllData(structuredClone(data), true, { fullRewrite });
                out.push({ rows: dump(), read: db.getAllData() });
            } finally {
                d.exec('ROLLBACK');
            }
        }
        return out;
    };
    let seed = 7;
    const rand = (n) => (((seed = (seed * 1103515245 + 12345) % 2147483648) % n) + n) % n;
    const base = db.getAllData();
    for (let i = 0; i < 40; i++)
        base.invoices.push({
            id: `I${i}`,
            code: `HD${i}`,
            total: i * 1000,
            items: [],
            branch: 'A'
        });
    for (let i = 0; i < 20; i++)
        base.products.push({ id: `P${i}`, code: `P${i}`, name: `P${i}`, stock: i, branch: 'A' });
    db.saveAllData(base);
    const mutations = [
        (rows) => rows.unshift({ id: `NEW${rand(1e9)}`, code: 'N', total: 5, items: [] }),
        (rows) => rows.push({ id: `NEW${rand(1e9)}`, code: 'N', stock: 2 }),
        (rows) => rows.length && rows.splice(rand(rows.length), 1),
        (rows) => rows.length && Object.assign(rows[rand(rows.length)], { note: `x${rand(99)}` }),
        (rows) => rows.length && (rows[rand(rows.length)].code = `C${rand(99)}`),
        (rows) => rows.length > 2 && rows.splice(1, 0, { id: `MID${rand(1e9)}`, code: 'M' }),
        (rows) => rows.reverse(),
        (rows) => rows.length && rows.push({ ...rows[0] }) // duplicate id: both paths must fail
    ];
    for (let round = 0; round < 60; round++) {
        const data = db.getAllData();
        for (let k = 0; k < 3; k++) {
            const table = rand(2) ? 'invoices' : 'products';
            mutations[rand(mutations.length)](data[table]);
        }
        const dup = ['invoices', 'products'].some(
            (t) => new Set(data[t].map((r) => r.id)).size !== data[t].length
        );
        if (dup) {
            for (const fullRewrite of [false, true])
                assert.throws(() => db.saveAllData(structuredClone(data), false, { fullRewrite }));
            continue;
        }
        const [diff, full] = saveBoth(data);
        assert.deepEqual(diff.rows, full.rows, `round ${round}`);
        assert.deepEqual(diff.read, full.read, `round ${round}`);
        assert.deepEqual(
            diff.read.invoices.map((r) => r.id),
            data.invoices.map((r) => r.id)
        );
        db.saveAllData(data); // carry state forward so later rounds start from varied rowids
    }
    // Saving unchanged data must not touch any entity row.
    const before = d.prepare('SELECT total_changes() AS n').get().n;
    d.exec('BEGIN IMMEDIATE');
    try {
        const settingsRows = Object.keys(db.getAllData().settings).length;
        db.saveAllData(db.getAllData(), true);
        const written = d.prepare('SELECT total_changes() AS n').get().n - before;
        assert.equal(written, settingsRows * 2 + 1); // settings delete+insert, recentActivities
    } finally {
        d.exec('ROLLBACK');
    }
});
test('readForWrite returns a mutable copy of current data inside a transaction', () => {
    assert.throws(() => db.readForWrite(), /transaction/);
    const snap = db.readSnapshot();
    const d = db.getDb();
    d.exec('BEGIN IMMEDIATE');
    try {
        const copy = db.readForWrite();
        assert.deepEqual(copy, db.getAllData());
        assert.notEqual(copy, snap);
        copy.products[0].stock = 99;
        assert.equal(snap.products[0].stock, 3);
    } finally {
        d.exec('ROLLBACK');
    }
    // A write the snapshot has not seen must not be served from it.
    d.prepare("UPDATE products SET stock=8 WHERE id='SP'").run();
    d.exec('BEGIN IMMEDIATE');
    try {
        assert.equal(db.readForWrite().products[0].stock, 8);
    } finally {
        d.exec('ROLLBACK');
    }
});
test('JSON API responses are gzipped only when the client accepts it', async () => {
    const zlib = require('node:zlib');
    const login = await request('POST', '/api/login', {
        username: 'admin',
        password: 'Test-password-123'
    });
    const cookie = login.headers['set-cookie'].split(';')[0];
    const plain = await request('GET', '/api/data', undefined, cookie);
    assert.equal(plain.headers['Content-Encoding'], undefined);
    assert.equal(plain.headers.Vary, 'Accept-Encoding');
    const zipped = await request('GET', '/api/data', undefined, cookie, {
        'accept-encoding': 'gzip, deflate'
    });
    assert.equal(zipped.headers['Content-Encoding'], 'gzip');
    assert.equal(zipped.headers['Content-Length'], zipped.body.length);
    assert.deepEqual(JSON.parse(zlib.gunzipSync(zipped.body)), plain.json);
    const small = await request('GET', '/api/nope', undefined, cookie, {
        'accept-encoding': 'gzip'
    });
    assert.equal(small.status, 404);
    assert.equal(small.headers['Content-Encoding'], undefined);
});
test('view deltas rebuild the exact next view through the browser merge', () => {
    const vm = require('node:vm');
    const ctx = { FALLBACK_BRANCH: 'A', crypto: globalThis.crypto };
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, '..', 'client-store.js'), 'utf8') +
            ';this.applyDelta = applyDelta;',
        Object.assign(ctx, { window: { addEventListener() {} } })
    );
    let seed = 11;
    const rand = (n) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
    const row = (i) => ({ id: 'R' + i, v: rand(5) });
    let n = 0;
    for (let round = 0; round < 300; round++) {
        const prev = {
            settings: { a: rand(2) },
            t: Array.from({ length: rand(30) }, () => row(n++))
        };
        const next = { settings: { a: rand(2) }, t: prev.t.map((r) => ({ ...r })) };
        for (let k = rand(4); k >= 0; k--) {
            const op = rand(6),
                t = next.t;
            if (op === 0) t.unshift(row(n++));
            else if (op === 1) t.push(row(n++));
            else if (op === 2 && t.length) t.splice(rand(t.length), 1);
            else if (op === 3 && t.length) t[rand(t.length)].v = 9;
            else if (op === 4 && t.length > 1) t.splice(1, 0, row(n++));
            else if (op === 5) t.reverse();
        }
        const delta = app.diffViews(prev, next);
        const merged = ctx.applyDelta(prev, JSON.parse(JSON.stringify(delta)));
        assert.equal(JSON.stringify(merged), JSON.stringify(next), `round ${round}`);
    }
    assert.deepEqual(app.diffViews({ t: [{ id: 'X' }] }, { t: [{ id: 'X' }] }), {});
    assert.equal(app.diffViews({ a: 1 }, { b: 1 }), null);
    assert.throws(() => ctx.applyDelta({ t: [] }, { t: { remove: ['X'], length: 1 } }));
});
test('command response is a delta only when the client base matches the server revision', async () => {
    const login = await request('POST', '/api/login', {
        username: 'admin',
        password: 'Test-password-123'
    });
    const cookie = login.headers['set-cookie'].split(';')[0];
    const sale = (base, rev = app.revision()) =>
        request(
            'POST',
            '/api/command',
            {
                type: 'sale',
                requestId: crypto.randomUUID(),
                revision: rev,
                payload: {
                    branch: 'A',
                    items: [{ code: 'SP', qty: 1 }],
                    given: 100000,
                    paymentMethod: 'cash'
                }
            },
            cookie,
            {
                'x-minikiot-csrf': login.json.csrfToken,
                ...(base === undefined ? {} : { 'x-minikiot-base': String(base) })
            }
        );
    const rev = app.revision();
    const before = (await request('GET', '/api/data', undefined, cookie)).json.data;
    const withDelta = await sale(rev);
    assert.equal(withDelta.status, 200);
    assert.equal(withDelta.json.data, undefined);
    assert.equal(withDelta.json.base, rev);
    assert.equal(withDelta.json.revision, rev + 1);
    assert.equal(withDelta.json.delta.invoices.prepend.length, 1);
    assert.equal(withDelta.json.delta.products.update[0].stock, before.products[0].stock - 1);
    assert.ok(withDelta.json.result.code);
    const legacy = await sale(undefined);
    assert.ok(legacy.json.data && !legacy.json.delta);
    const stale = await sale(rev);
    assert.ok(stale.json.data && !stale.json.delta);
});
