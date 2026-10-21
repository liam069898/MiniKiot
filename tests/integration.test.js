'use strict';
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
    os = require('node:os'),
    path = require('node:path'),
    vm = require('node:vm');
const { PassThrough } = require('node:stream');
const { JSDOM } = require('jsdom');
process.env.MINIKIOT_DB_PATH = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'minikiot-integration-')),
    'test.db'
);
process.env.MINIKIOT_ADMIN_PASSWORD = 'Test-password-123';
const db = require('../db'),
    application = require('../application'),
    { handler } = require('../server');
const { hashPassword } = require('../security');
const seed = () => {
    const d = JSON.parse(JSON.stringify(require('../data').defaultData));
    for (const table of db.ENTITY_TABLES)
        if (!['branches', 'categories'].includes(table)) d[table] = [];
    d.products = [
        {
            id: 'P',
            code: 'P',
            name: 'Product',
            category: 'Test',
            price: 100000,
            costPrice: 50000,
            stock: 3,
            minStock: 0,
            unit: 'Chiếc',
            barcode: '',
            status: 'active',
            branch: 'Kalo HCM',
            hasImei: true,
            imeis: ['S1', 'S2', 'S3']
        }
    ];
    d.customers = [
        {
            id: 'C',
            code: 'C',
            name: 'Customer',
            phone: '000',
            address: '',
            debt: 0,
            totalSpent: 0,
            points: 0
        }
    ];
    d.suppliers = [
        { id: 'S', code: 'S', name: 'Supplier', phone: '', address: '', debt: 0, totalBought: 0 }
    ];
    d.users = [
        {
            id: 'ADMIN',
            code: 'ADMIN',
            name: 'Admin',
            username: 'admin',
            password: hashPassword('Test-password-123'),
            role: 'admin',
            roleName: 'Admin',
            phone: '',
            status: 'active',
            permissions: {},
            branch: 'Kalo HCM',
            branches: ['Kalo HCM', 'Chi nhánh Hà Nội']
        }
    ];
    return d;
};
before(() => db.initDb());
beforeEach(() => {
    db.saveAllData(seed());
    db.getDb().exec('DELETE FROM processed_requests');
});
after(() => db.getDb().close());
function browser() {
    const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), {
            url: 'http://localhost',
            runScripts: 'outside-only'
        }),
        w = dom.window;
    w.eval = (code) => vm.runInContext(code, dom.getInternalVMContext());
    w.confirm = () => true;
    w.prompt = () => null;
    w.print = () => {};
    let cookie = '';
    const bridge = { loseNextCommand: false, commands: [] };
    w.fetch = async (url, options = {}) =>
        new Promise((resolve, reject) => {
            const req = new PassThrough();
            req.method = options.method || 'GET';
            req.url = url;
            const extra = Object.fromEntries(
                Object.entries(options.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
            );
            req.headers = {
                ...extra,
                host: 'localhost',
                'content-type': 'application/json',
                cookie
            };
            req.socket = { remoteAddress: '127.0.0.1' };
            const response = {
                headersSent: false,
                setHeader(name, value) {
                    if (name.toLowerCase() === 'set-cookie') cookie = value.split(';')[0];
                },
                writeHead(status) {
                    this.status = status;
                    this.headersSent = true;
                },
                end(body) {
                    if (url === '/api/command') bridge.commands.push(JSON.parse(body));
                    if (url === '/api/command' && bridge.loseNextCommand) {
                        bridge.loseNextCommand = false;
                        reject(new Error('Response lost'));
                        return;
                    }
                    resolve({
                        ok: this.status < 400,
                        status: this.status,
                        json: async () => JSON.parse(body)
                    });
                }
            };
            handler(req, response).catch(reject);
            req.end(options.body || '');
        });
    for (const file of [
        'constants.js',
        'ui-safety.js',
        'client-store.js',
        'app-utils.js',
        'app-reports.js',
        'app-export.js',
        'app.js'
    ])
        w.eval(
            fs
                .readFileSync(file, 'utf8')
                .replace("window.addEventListener('DOMContentLoaded', initApp);", '')
        );
    return { dom, w, bridge, close: () => w.close() };
}
async function login(b) {
    await b.w.initApp();
    b.w.document.getElementById('login-username').value = 'admin';
    b.w.document.getElementById('login-password').value = 'Test-password-123';
    await b.w.handleLoginSubmit({ preventDefault() {} });
    assert.equal(b.w.eval('KVStore.user.username'), 'admin');
}
function setValue(w, id, value) {
    w.document.getElementById(id).value = value;
}
function cart(w) {
    w.eval('addPosCartItem(KVStore.data.products[0])');
}
test('real login -> POS -> discounted credit return persists correct inventory, money and serials', async () => {
    const b = browser();
    try {
        await login(b);
        cart(b.w);
        b.w.eval(
            'selectPosCustomer(KVStore.data.customers[0]);state.posTabs[0].discount=20000;state.posTabs[0].customerGiven=30000'
        );
        await b.w.checkoutPos();
        let d = db.getAllData();
        assert.equal(d.invoices.length, 1);
        assert.equal(d.customers[0].debt, 50000);
        assert.equal(d.products[0].stock, 2);
        b.w.openReturnModal(d.invoices[0].code);
        await b.w.submitReturnGoods();
        d = db.getAllData();
        assert.equal(d.products[0].stock, 3);
        assert.equal(d.customers[0].debt, 0);
        assert.equal(d.returns[0].totalRefund, 30000);
        assert.equal(d.returns[0].returnValue, 80000);
    } finally {
        b.close();
    }
});
test('command responses carry only changed rows and the browser ends with the exact server view', async () => {
    const b = browser();
    try {
        await login(b);
        const serverView = () => {
            const snap = db.readSnapshot();
            return JSON.stringify(
                application.project(
                    snap,
                    snap.users.find((u) => u.id === 'ADMIN')
                )
            );
        };
        cart(b.w);
        b.w.eval('selectPosCustomer(KVStore.data.customers[0])');
        await b.w.checkoutPos();
        b.w.openReturnModal(db.getAllData().invoices[0].code);
        await b.w.submitReturnGoods();
        assert.equal(b.bridge.commands.length, 2);
        for (const response of b.bridge.commands) {
            assert.ok(response.delta, 'delta response');
            assert.equal(response.data, undefined);
            assert.equal(response.revision, response.base + 1);
        }
        assert.ok(b.bridge.commands[0].delta.invoices.prepend);
        assert.equal(b.w.eval('JSON.stringify(KVStore._base)'), serverView());
        assert.equal(b.w.eval('KVStore.revision'), application.revision());
        // A delta that does not fit the local base must fall back to a full reload.
        await b.w.eval(
            "KVStore.adoptResult({user: KVStore.user, revision: KVStore.revision, base: KVStore.revision, delta: {invoices: {remove: ['NOPE'], length: 0}}})"
        );
        assert.equal(b.w.eval('JSON.stringify(KVStore._base)'), serverView());
    } finally {
        b.close();
    }
});
test('catalog add, settings save and staff create roundtrip through actual HTTP handler', async () => {
    const b = browser();
    try {
        await login(b);
        b.w.openAddProductModal();
        setValue(b.w, 'prod-code', 'NEW');
        setValue(b.w, 'prod-name', 'Name <img src=x onerror=alert(1)>');
        setValue(b.w, 'prod-price', '200000');
        await b.w.saveProductFromModal({ preventDefault() {} });
        assert.equal(db.getAllData().products.filter((p) => p.code === 'NEW').length, 2);
        assert.equal(db.getAllData().products.length, 3);
        assert.equal(b.w.document.querySelector('#products-tbody img'), null);
        b.w.openSettingsModal();
        setValue(b.w, 'set-bank-account', '00123456789');
        await b.w.saveSettingsFromModal({ preventDefault() {} });
        assert.equal(db.getAllData().settings.bankAccount, '00123456789');
        b.w.openStaffFormModal();
        setValue(b.w, 'staff-input-name', 'New cashier');
        setValue(b.w, 'staff-input-username', 'newcashier');
        setValue(b.w, 'staff-input-password', 'New-password-123');
        b.w.document.querySelector('input[name="staff-branch-cb"]').checked = true;
        await b.w.saveStaffSubmit({ preventDefault() {} });
        assert.equal(db.getAllData().users.length, 2);
        assert.match(
            db.getAllData().users.find((u) => u.username === 'newcashier').password,
            /^scrypt\$/
        );
        assert.ok(!b.w.eval('JSON.stringify(KVStore.data)').includes('scrypt$'));
        for (let i = 0; i < b.w.localStorage.length; i++)
            assert.ok(
                !b.w.localStorage.getItem(b.w.localStorage.key(i)).includes('New-password-123')
            );
    } finally {
        b.close();
    }
});
test('committed sale with lost response is recovered exactly once and clears original cart', async () => {
    const b = browser();
    try {
        await login(b);
        cart(b.w);
        b.bridge.loseNextCommand = true;
        await b.w.checkoutPos();
        assert.equal(db.getAllData().invoices.length, 1);
        assert.equal(b.w.eval('KVStore.pending().length'), 1);
        assert.equal(b.w.eval('state.posTabs[0].cart.length'), 1);
        await b.w.forceSyncDatabase();
        assert.equal(db.getAllData().invoices.length, 1);
        assert.equal(b.w.eval('KVStore.pending().length'), 0);
        assert.equal(b.w.eval('state.posTabs[0].cart.length'), 0);
    } finally {
        b.close();
    }
});
test('two browser instances cannot overwrite each other and conflict keeps unsent cart', async () => {
    const a = browser(),
        b = browser();
    try {
        await login(a);
        await login(b);
        cart(a.w);
        cart(b.w);
        await a.w.checkoutPos();
        await b.w.checkoutPos();
        assert.equal(db.getAllData().invoices.length, 1);
        assert.equal(b.w.eval('state.posTabs[0].cart.length'), 1);
        assert.equal(b.w.eval('KVStore.recoveryData().rejected.length'), 1);
        await b.w.checkoutPos();
        assert.equal(db.getAllData().invoices.length, 2);
        assert.equal(db.getAllData().products[0].stock, 1);
    } finally {
        a.close();
        b.close();
    }
});
test('sensitive staff command never puts credentials in pending browser storage', async () => {
    const b = browser();
    try {
        await login(b);
        b.w.openStaffFormModal();
        setValue(b.w, 'staff-input-name', 'New user');
        setValue(b.w, 'staff-input-username', 'newuser');
        setValue(b.w, 'staff-input-password', 'Secret-test-123');
        b.w.document.querySelector('input[name="staff-branch-cb"]').checked = true;
        b.bridge.loseNextCommand = true;
        await b.w.saveStaffSubmit({ preventDefault() {} });
        assert.equal(db.getAllData().users.length, 2);
        for (let i = 0; i < b.w.localStorage.length; i++)
            assert.ok(
                !b.w.localStorage.getItem(b.w.localStorage.key(i)).includes('Secret-test-123')
            );
        b.w.eval('KVStore._volatilePending.clear()');
        await b.w.forceSyncDatabase();
        assert.equal(b.w.eval('KVStore.pending().length'), 0);
        assert.equal(db.getAllData().users.length, 2);
    } finally {
        b.close();
    }
});
test('product codes synchronize across all branches when created or when new branch is added', async () => {
    const b = browser();
    try {
        await login(b);
        b.w.openAddProductModal();
        setValue(b.w, 'prod-code', 'SP_SYNC_TEST');
        setValue(b.w, 'prod-name', 'Sản phẩm Test Đồng Bộ');
        setValue(b.w, 'prod-price', '150000');
        await b.w.saveProductFromModal({ preventDefault() {} });

        const prodsAfterAdd = db.getAllData().products.filter((p) => p.code === 'SP_SYNC_TEST');
        assert.equal(prodsAfterAdd.length, 2);
        const hcmProd = prodsAfterAdd.find((p) => (p.branch || 'Kalo HCM') === 'Kalo HCM');
        const hnProd = prodsAfterAdd.find((p) => p.branch === 'Chi nhánh Hà Nội');
        assert.ok(hcmProd);
        assert.ok(hnProd);
        assert.equal(hnProd.stock, 0);
        assert.deepEqual(hnProd.imeis, []);
        assert.equal(hnProd.name, 'Sản phẩm Test Đồng Bộ');

        b.w.openAddBranchModal();
        setValue(b.w, 'branch-code-input', 'CN_DN');
        setValue(b.w, 'branch-name-input', 'Chi nhánh Đà Nẵng');
        await b.w.saveBranchFromModal({ preventDefault() {} });

        const prodsAfterBranch = db.getAllData().products.filter((p) => p.code === 'SP_SYNC_TEST');
        assert.equal(prodsAfterBranch.length, 3);
        const dnProd = prodsAfterBranch.find((p) => p.branch === 'Chi nhánh Đà Nẵng');
        assert.ok(dnProd);
        assert.equal(dnProd.stock, 0);
        assert.deepEqual(dnProd.imeis, []);
    } finally {
        b.close();
    }
});
