'use strict';
const { test } = require('node:test'),
    assert = require('node:assert/strict'),
    fs = require('node:fs');
const { JSDOM } = require('jsdom');
function browser() {
    const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), {
        url: 'http://localhost',
        runScripts: 'outside-only'
    });
    const w = dom.window;
    w.eval = (code) => require('node:vm').runInContext(code, dom.getInternalVMContext());
    w.confirm = () => true;
    w.prompt = () => null;
    w.print = () => {};
    w.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: 'login' }) });
    w.eval(fs.readFileSync('ui-safety.js', 'utf8'));
    w.eval(fs.readFileSync('client-store.js', 'utf8'));
    w.eval(
        fs
            .readFileSync('app.js', 'utf8')
            .replace("window.addEventListener('DOMContentLoaded', initApp);", '')
    );
    const d = JSON.parse(JSON.stringify(require('../data').defaultData));
    d.users = d.users.map(({ password, ...u }) => u);
    w.fixtureData = d;
    w.eval(
        'KVStore.data=fixtureData;KVStore._base=copyData(fixtureData);KVStore.user=fixtureData.users[0];KVStore.revision=1;KVStore.isDbConnected=true;'
    );
    return dom;
}
test('all views render with the shipped data', () => {
    const dom = browser();
    dom.window.renderAllViews();
    dom.window.renderBranchSelector();
    dom.window.renderCategorySelectOptions();
    dom.window.renderStaffTable();
    assert.ok(dom.window.document.querySelector('#products-tbody tr'));
    dom.window.close();
});
test('catalog and report rendering escape stored HTML and attribute injection', () => {
    const dom = browser(),
        w = dom.window;
    w.eval(
        `KVStore.data.products[0].name='<img src=x onerror="window.pwned=1">';KVStore.data.products[0].category='"><svg onload="window.pwned=1">';KVStore.data.customers[0].name='<script>window.pwned=1</script>';KVStore.data.users[0].name='<img src=x onerror="window.pwned=1">';`
    );
    w.renderAllViews();
    w.renderStaffTable();
    assert.equal(w.document.querySelector('#products-tbody img'), null);
    assert.equal(w.document.querySelector('#customers-tbody script'), null);
    assert.equal(w.document.querySelector('#staff-table-tbody img'), null);
    assert.ok(w.document.querySelector('#products-tbody').textContent.includes('<img'));
    dom.window.close();
});
test('legacy malicious identifiers cannot escape quoted inline arguments', () => {
    const dom = browser(),
        w = dom.window;
    w.eval(`KVStore.data.products[0].code="SP');window.pwned=1;//";`);
    w.renderProducts();
    const button = w.document.querySelector('#products-tbody button');
    const handler = button.getAttribute('onclick');
    let code;
    w.viewProductImeis = (value) => (code = value);
    w.openBarcodeModal = (value) => (code = value);
    w.eval(handler);
    assert.equal(w.pwned, undefined);
    assert.equal(code, "SP');window.pwned=1;//");
    dom.window.close();
});
test('POS revenue uses line value and historic costs, cash is categorized correctly', () => {
    const dom = browser(),
        w = dom.window;
    w.eval(
        `KVStore.data.invoices=[{id:'TEST',code:'TEST',branch:'Kalo HCM',status:'completed',time:getCurrentDateTimeString(),customer:'Test',total:100000,paid:100000,discount:0,paymentMethod:'cash',items:[{code:'SP001',name:'Test',qty:1,price:100000,costPrice:50000,total:100000,netTotal:100000}]}];KVStore.data.returns=[];KVStore.data.products[0].costPrice=80000;`
    );
    const cards = {};
    let breakdown;
    w.updateKpiCard = (idx, icon, label, value) => (cards[label] = value);
    w.renderBreakdownBars = (id, items) => (breakdown = items);
    w.eval("renderProductsReportTab(KVStore.data,'Kalo HCM',KVStore.data.products,'all')");
    assert.equal(cards['Doanh thu sản phẩm'], '100.000 đ');
    assert.equal(cards['Lợi nhuận hàng hóa'], '50.000 đ');
    w.eval("renderSalesReportTab(KVStore.data,'Kalo HCM',KVStore.data.products,'all')");
    assert.equal(cards['Lợi nhuận gộp'], '50.000 đ');
    assert.equal(breakdown.find((b) => b.label === 'Tiền mặt').value, 100000);
    dom.window.close();
});
test('print chooses only the requested document and clears previous content', () => {
    const dom = browser(),
        w = dom.window;
    w.document.getElementById('printable-return-receipt').textContent = 'RETURN-TEST';
    w.printReturnReceipt();
    assert.equal(w.document.querySelector('#print-root').textContent, 'RETURN-TEST');
    w.document.getElementById('view-reports').textContent = 'REPORT-TEST';
    w.printCurrentReport();
    assert.equal(w.document.querySelectorAll('#print-root').length, 1);
    assert.equal(w.document.querySelector('#print-root').textContent, 'REPORT-TEST');
    dom.window.close();
});
test('network failure preserves exact pending request for retry, blocks a second transaction', async () => {
    const dom = browser(),
        w = dom.window;
    w.fetch = async () => {
        throw new Error('offline');
    };
    await assert.rejects(w.eval("KVStore.command('sale',{branch:'Kalo HCM',items:[]})"));
    const pending = w.eval('JSON.stringify(KVStore.pending())');
    assert.ok(JSON.parse(pending).length === 1);
    await assert.rejects(w.eval("KVStore.command('sale',{branch:'Kalo HCM',items:[]})"));
    assert.equal(w.eval('JSON.stringify(KVStore.pending())'), pending);
    dom.window.close();
});

test('legacy missing costs never show fabricated profit or margin in reports', () => {
    const dom = browser(),
        w = dom.window;
    w.eval(
        `KVStore.data.invoices=[{id:'OLD',code:'OLD',branch:'Kalo HCM',status:'completed',time:getCurrentDateTimeString(),total:100000,paid:100000,items:[{code:'constructor',name:'Old product',qty:1,price:100000,total:100000}]}];KVStore.data.returns=[];`
    );
    w.eval("renderProductsReportTab(KVStore.data,'Kalo HCM',KVStore.data.products,'all')");
    assert.ok(w.document.getElementById('rep-margin').textContent.includes('—'));
    assert.ok(
        w.document
            .getElementById('rep-main-chart-container')
            .querySelector('[title]')
            .title.includes('Thiếu giá vốn lịch sử')
    );
    assert.ok(w.document.getElementById('rep-table-tbody').textContent.includes('Chưa xác định'));
    dom.window.close();
});

test('cancellation in a later period preserves original sale and books reversal on return date', () => {
    const dom = browser(),
        w = dom.window;
    w.eval(
        `KVStore.data.invoices=[{id:'I',code:'I',bookingVersion:2,branch:'Kalo HCM',status:'cancelled',time:'01/01/2025 10:00',total:100000,paid:0,returnedTotal:100000,paymentMethod:'cash',items:[{code:'P',name:'Product',qty:1,price:100000,costPrice:50000,netTotal:100000}]}];KVStore.data.returns=[{id:'R',invoiceCode:'I',branch:'Kalo HCM',time:getCurrentDateTimeString(),returnValue:100000,totalRefund:100000,items:[{code:'P',name:'Product',qty:1,total:100000,costPrice:50000}]}];`
    );
    const cards = {};
    w.updateKpiCard = (idx, icon, label, value) => (cards[label] = value);
    w.eval("renderSalesReportTab(KVStore.data,'Kalo HCM',KVStore.data.products,'today')");
    assert.equal(cards['Doanh thu thuần'], '-100.000 đ');
    assert.equal(cards['Lợi nhuận gộp'], '-50.000 đ');
    w.eval("renderSalesReportTab(KVStore.data,'Kalo HCM',KVStore.data.products,'all')");
    assert.equal(cards['Doanh thu thuần'], '0 đ');
    assert.equal(cards['Lợi nhuận gộp'], '0 đ');
    dom.window.close();
});

test('staff form starts without a default password and preserves separate user-management permission', () => {
    const dom = browser(),
        w = dom.window;
    w.openStaffFormModal();
    assert.equal(w.document.getElementById('staff-input-password').value, '');
    w.eval('KVStore.data.users[1].permissions.users=true');
    w.openStaffFormModal(w.eval('KVStore.data.users[1].id'));
    assert.equal(w.document.getElementById('perm-users').checked, true);
    dom.window.close();
});
