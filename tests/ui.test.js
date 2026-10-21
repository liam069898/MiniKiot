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
    w.eval(fs.readFileSync('constants.js', 'utf8'));
    w.eval(fs.readFileSync('ui-safety.js', 'utf8'));
    w.eval(fs.readFileSync('client-store.js', 'utf8'));
    for (const file of ['app-utils.js', 'app-reports.js', 'app-export.js', 'app.js']) {
        w.eval(
            fs
                .readFileSync(file, 'utf8')
                .replace("window.addEventListener('DOMContentLoaded', initApp);", '')
        );
    }
    const d = JSON.parse(JSON.stringify(require('../data').defaultData));
    d.users = d.users.map(({ password, ...u }) => u);
    w.fixtureData = d;
    w.eval(
        'KVStore.data=fixtureData;KVStore._base=copyData(fixtureData);KVStore.user=fixtureData.users[0];KVStore.revision=1;KVStore.isDbConnected=true;'
    );
    return dom;
}
test('POS catalog, search and scanner exclude archived products', () => {
    const dom = browser(),
        w = dom.window;
    try {
        w.eval(`
            const original = KVStore.data.products[0];
            KVStore.data.products = [
                {...original, id:'ACTIVE', code:'ACTIVE', name:'Active', status:'active'},
                {...original, id:'ARCHIVE', code:'ARCHIVE', name:'Archived', status:'archived', barcode:'ARCHIVE-BAR'}
            ];
        `);
        w.renderPosCatalog();
        assert.ok(w.document.getElementById('pos-product-grid').textContent.includes('Active'));
        assert.ok(!w.document.getElementById('pos-product-grid').textContent.includes('Archived'));
        w.searchPosProducts('ARCHIVE');
        assert.ok(
            !w.document.getElementById('pos-product-dropdown').textContent.includes('Archived')
        );
        w.document.getElementById('pos-search-input').value = 'ARCHIVE-BAR';
        w.handlePosSearchKeydown({ key: 'Enter', preventDefault() {} });
        assert.equal(w.eval('state.posTabs[state.activePosTab].cart.length'), 0);
        w.eval('addPosCartItem(KVStore.data.products[1])');
        assert.equal(w.eval('state.posTabs[state.activePosTab].cart.length'), 0);
    } finally {
        w.close();
    }
});
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

test('10% UI scaling, Xoá button title, and item notes work in POS', () => {
    const dom = browser(),
        w = dom.window;
    // 1. Verify 10% zoom in CSS
    const styleContent = Array.from(w.document.querySelectorAll('style'))
        .map((s) => s.textContent)
        .join('\n');
    assert.ok(styleContent.includes('zoom: 1.1'));

    // 2. Add an item to POS cart and check render
    w.eval(
        "state.posTabs[0].cart = [{ code: 'SP001', name: 'Đồng hồ Garmin', price: 6000000, stock: 10, qty: 1, note: '' }];"
    );
    w.renderPosScreen();

    // Check delete button title is 'Xoá'
    const delBtn = w.document.querySelector('[onclick*="removePosItem"]');
    assert.ok(delBtn);
    assert.equal(delBtn.getAttribute('title'), 'Xoá');
    assert.equal(delBtn.getAttribute('aria-label'), 'Xoá');

    // Check note input exists
    const noteInput = w.document.querySelector('input[data-note-code="SP001"]');
    assert.ok(noteInput);
    w.updatePosItemNote('SP001', 'Quà tặng kèm dock sạc');
    assert.equal(w.eval('state.posTabs[0].cart[0].note'), 'Quà tặng kèm dock sạc');

    // Check invoice table header is "Tên hàng hóa"
    const tableHeader = w.document.querySelector('#invoice-detail-modal th:nth-child(3)');
    assert.equal(tableHeader?.textContent?.trim(), 'Tên hàng hóa');

    dom.window.close();
});

test('Vietnamese name and address normalization standardizes input to proper Title Case', () => {
    const dom = browser(),
        w = dom.window;
    w.eval('KVStore.save = async () => {}');

    assert.equal(w.normalizeTitleCase('nguyễn văn an'), 'Nguyễn Văn An');
    assert.equal(w.normalizeTitleCase('  trần   thị   hoa  '), 'Trần Thị Hoa');
    assert.equal(
        w.normalizeTitleCase('103 võ văn tần, p.6, quận 3, tp.hcm'),
        '103 Võ Văn Tần, P.6, Quận 3, TP.HCM'
    );

    // Customer save normalizes customer name and address
    w.document.getElementById('cust-code').value = 'KH_TEST_01';
    w.document.getElementById('cust-name').value = '  lê hoàng nam  ';
    w.document.getElementById('cust-phone').value = '0988112233';
    w.document.getElementById('cust-address').value = '12 nguyễn du, q.1, tp.hcm';
    w.saveCustomerFromModal({ preventDefault() {} });

    const saved = w.eval("KVStore.data.customers.find((c) => c.code === 'KH_TEST_01')");
    assert.ok(saved);
    assert.equal(saved.name, 'Lê Hoàng Nam');
    assert.equal(saved.address, '12 Nguyễn Du, Q.1, TP.HCM');

    dom.window.close();
});

test('Custom bill in configuration saves and updates receipt preview and print layout', async () => {
    const dom = browser(),
        w = dom.window;
    w.eval('KVStore.save = async () => {}');

    // Default bill config
    const def = w.getBillConfig();
    assert.equal(def.paperSize, 'k80');
    assert.equal(def.title, 'HÓA ĐƠN BÁN HÀNG');
    assert.equal(def.showNote, true);

    // Open custom bill modal, set values and save
    w.openBillCustomModal();
    w.document.getElementById('bill-opt-paper-k58').checked = true;
    w.document.getElementById('bill-custom-title').value = 'PHIẾU TÍNH TIỀN';
    w.document.getElementById('bill-custom-footer').value = 'Hẹn gặp lại quý khách!';
    w.onBillConfigChange();

    await w.saveBillCustomConfig();

    const updated = w.getBillConfig();
    assert.equal(updated.paperSize, 'k58');
    assert.equal(updated.title, 'PHIẾU TÍNH TIỀN');
    assert.equal(updated.footer, 'Hẹn gặp lại quý khách!');

    // Open receipt modal and check custom title, footer, item note and paper size
    const testInv = {
        code: 'HD000099',
        time: '21/10/2026 10:00',
        customer: 'Nguyễn Văn An',
        cashier: 'Thu ngân 1',
        items: [
            {
                code: 'SP01',
                name: 'Sản phẩm mẫu',
                qty: 2,
                price: 50000,
                note: 'Bảo hành 6 tháng'
            }
        ],
        total: 100000,
        paid: 100000
    };
    w.openReceiptModal(testInv);
    assert.equal(w.document.getElementById('receipt-title').textContent, 'PHIẾU TÍNH TIỀN');
    assert.equal(w.document.getElementById('receipt-footer').textContent, 'Hẹn gặp lại quý khách!');
    assert.ok(
        w.document.getElementById('receipt-items-tbody').textContent.includes('Bảo hành 6 tháng')
    );
    assert.equal(w.document.getElementById('printable-receipt').dataset.paper, 'k58');

    // Test printReceipt uses paperSize k58
    w.printReceipt();
    const printRoot = w.document.getElementById('print-root');
    assert.ok(printRoot);
    assert.equal(printRoot.dataset.paper, 'k58');

    dom.window.close();
});

test('SQL badge removed and toast popup slides down from top', async () => {
    const dom = browser(),
        w = dom.window;

    // Check DB status badge is removed
    const dbBadge = w.document.getElementById('db-status-badge');
    assert.equal(dbBadge, null);

    // Check toast container initial position and styling
    const toast = w.document.getElementById('kv-toast');
    assert.ok(toast);
    assert.ok(toast.classList.contains('top-4'));
    assert.ok(toast.classList.contains('left-1/2'));
    assert.ok(toast.classList.contains('-translate-x-1/2'));
    assert.ok(toast.classList.contains('-translate-y-24'));
    assert.ok(toast.classList.contains('opacity-0'));

    // Verify #kv-toast CSS rules exist in <style>
    const styleContent = Array.from(w.document.querySelectorAll('style'))
        .map((s) => s.textContent)
        .join('\n');
    assert.ok(styleContent.includes('#kv-toast {'));
    assert.ok(styleContent.includes('left: 50% !important;'));
    assert.ok(styleContent.includes('transform: translate(-50%, -150%) !important;'));
    assert.ok(styleContent.includes('#kv-toast.translate-y-0 {'));
    assert.ok(styleContent.includes('transform: translate(-50%, 0) !important;'));

    // Trigger toast notification
    w.showToast('Test thông báo', 'success');
    assert.ok(toast.classList.contains('translate-y-0'));
    assert.ok(toast.classList.contains('opacity-100'));
    assert.ok(!toast.classList.contains('-translate-y-24'));
    assert.equal(w.document.getElementById('kv-toast-msg').textContent, 'Test thông báo');

    dom.window.close();
});

test('Admin can select and view Toàn bộ chi nhánh across views', async () => {
    const dom = browser(),
        w = dom.window;
    w.eval('KVStore.save = async () => {}');

    // Setup admin user
    w.eval(
        "KVStore.user = { id: 'u_admin', username: 'admin', role: 'admin', branches: ['Kalo HCM', 'Kalo Hà Nội'] }"
    );

    // Add branches and products in both branches
    w.eval(`
        KVStore.data.branches = [
            { id: 'b1', name: 'Kalo HCM', isDefault: true },
            { id: 'b2', name: 'Kalo Hà Nội' }
        ];
        KVStore.data.products = [
            { id: 'p1', code: 'SP001', name: 'Áo thun HCM', branch: 'Kalo HCM', stock: 10, price: 100000, costPrice: 60000, status: 'active' },
            { id: 'p2', code: 'SP002', name: 'Áo thun HN', branch: 'Kalo Hà Nội', stock: 5, price: 120000, costPrice: 70000, status: 'active' }
        ];
        KVStore.data.invoices = [
            { id: 'inv1', code: 'HD000001', branch: 'Kalo HCM', total: 100000, paid: 100000, status: 'completed', time: '21/10/2026 09:00', items: [{ code: 'SP001', name: 'Áo thun HCM', qty: 1, price: 100000 }] },
            { id: 'inv2', code: 'HD000002', branch: 'Kalo Hà Nội', total: 120000, paid: 120000, status: 'completed', time: '21/10/2026 10:00', items: [{ code: 'SP002', name: 'Áo thun HN', qty: 1, price: 120000 }] }
        ];
    `);

    // Render branch selector as admin
    w.renderBranchSelector();
    const branchContainer = w.document.getElementById('branch-list-container');
    assert.ok(branchContainer);
    assert.ok(branchContainer.textContent.includes('Toàn bộ chi nhánh'));

    // Admin selects Toàn bộ chi nhánh
    await w.selectActiveBranch(w.ALL_BRANCHES);
    assert.equal(w.getCurrentBranch(), w.ALL_BRANCHES);
    assert.equal(w.document.getElementById('top-branch-name').textContent, w.ALL_BRANCHES);

    // Products table displays products from both branches
    w.renderProducts();
    const prodTbody = w.document.getElementById('products-tbody');
    assert.ok(prodTbody.textContent.includes('SP001'));
    assert.ok(prodTbody.textContent.includes('SP002'));
    assert.ok(prodTbody.textContent.includes('Kalo HCM'));
    assert.ok(prodTbody.textContent.includes('Kalo Hà Nội'));

    // Invoices table displays invoices from both branches
    w.renderInvoices();
    const invTbody = w.document.getElementById('invoice-tbody');
    assert.ok(invTbody.textContent.includes('HD000001'));
    assert.ok(invTbody.textContent.includes('HD000002'));

    // Non-admin user cannot select Toàn bộ chi nhánh
    w.eval(
        "KVStore.user = { id: 'u_staff', username: 'staff1', role: 'staff', branches: ['Kalo HCM'] }"
    );
    w.renderBranchSelector();
    assert.ok(!branchContainer.textContent.includes('Toàn bộ chi nhánh'));
    await w.selectActiveBranch(w.ALL_BRANCHES);
    assert.notEqual(w.getCurrentBranch(), w.ALL_BRANCHES);

    dom.window.close();
});

test('Toàn bộ chi nhánh aggregates products with same SKU across branches and does not double rows or stock', async () => {
    const dom = browser(),
        w = dom.window;
    w.eval('KVStore.save = async () => {}');

    w.eval(
        "KVStore.user = { id: 'u_admin', username: 'admin', role: 'admin', branches: ['Kalo HCM', 'Kalo Hà Nội'] }"
    );

    w.eval(`
        KVStore.data.branches = [
            { id: 'b1', name: 'Kalo HCM', isDefault: true },
            { id: 'b2', name: 'Kalo Hà Nội' }
        ];
        KVStore.data.products = [
            { id: 'p1_hcm', code: 'SP001', name: 'iPhone 15', branch: 'Kalo HCM', stock: 1, minStock: 2, price: 20000000, costPrice: 15000000, status: 'active', hasImei: true, imeis: ['IMEI_HCM_1'] },
            { id: 'p1_hn', code: 'SP001', name: 'iPhone 15', branch: 'Kalo Hà Nội', stock: 0, minStock: 2, price: 20000000, costPrice: 15000000, status: 'active', hasImei: true, imeis: [] }
        ];
    `);

    // Switch to Toàn bộ chi nhánh
    await w.selectActiveBranch(w.ALL_BRANCHES);
    assert.equal(w.getCurrentBranch(), w.ALL_BRANCHES);

    // 1. In products list: exactly 1 row rendered for SP001, total stock is 1 (not duplicated)
    w.renderProducts();
    const rows = w.document.querySelectorAll('#products-tbody tr');
    assert.equal(rows.length, 1);
    const countEl = w.document.getElementById('products-total-count');
    assert.equal(countEl.textContent, 'Hiển thị 1 hàng hóa');
    assert.ok(rows[0].textContent.includes('iPhone 15'));

    // 2. viewProductImeis aggregates imeis across branches
    w.viewProductImeis('SP001');
    assert.equal(
        w.document.getElementById('prod-imeis-sub').textContent.includes('Tồn kho: 1'),
        true
    );

    // 3. Reports inventory tab
    w.eval("currentReportTab = 'inventory'");
    w.renderReports();
    const repRows = w.document.querySelectorAll('#rep-table-tbody tr');
    assert.equal(repRows.length, 1);

    dom.window.close();
});

test('Product table renders Chi tiết button and opens product detail modal with actions', async () => {
    const dom = browser(),
        w = dom.window;
    w.eval('KVStore.save = async () => {}');

    w.renderProducts();
    const actionBtn = w.document.querySelector('#products-tbody tr td:last-child button');
    assert.ok(actionBtn);
    assert.equal(actionBtn.textContent.trim(), 'Chi tiết');

    // Open detail modal
    w.viewProductDetail('SP001');
    const modal = w.document.getElementById('product-detail-modal');
    assert.ok(modal);
    assert.ok(!modal.classList.contains('hidden'));
    assert.equal(w.document.getElementById('prod-detail-code').textContent, 'SP001');
    assert.ok(modal.textContent.includes('In mã'));
    assert.ok(modal.textContent.includes('Sửa'));
    assert.ok(modal.textContent.includes('Xóa'));

    dom.window.close();
});

test('Import cancellation updates UI, hides cancel button, shows status banner and filters', async () => {
    const dom = browser(),
        w = dom.window;
    try {
        w.eval(`
            window.commanded = null;
            KVStore.command = async (cmd, payload) => {
                window.commanded = { cmd, payload };
                const imp = KVStore.data.imports.find((i) => i.code === payload.importId);
                if (imp) {
                    imp.status = 'cancelled';
                    imp.cancelReason = payload.reason;
                    imp.cancelTime = '21/10/2026 15:30';
                }
                KVStore._base = copyData(KVStore.data);
                return { result: imp };
            };
        `);

        // 1. Initial render of imports
        w.renderImports();
        const initialRows = w.document.querySelectorAll('#import-tbody tr');
        assert.ok(initialRows.length > 0);

        // 2. Open import detail modal for first import
        const targetCode = w.eval('KVStore.data.imports[0].code');
        w.viewImportDetail(targetCode);
        const modal = w.document.getElementById('import-detail-modal');
        assert.ok(!modal.classList.contains('hidden'));
        const banner = w.document.getElementById('imp-detail-status-banner');
        const cancelBtn = w.document.getElementById('imp-detail-cancel-btn');
        assert.ok(banner.classList.contains('hidden'));
        assert.ok(!cancelBtn.classList.contains('hidden'));

        // 3. User cancels import through accessible dialog
        const pending = w.cancelImport(targetCode);
        const dialog = w.document.getElementById('action-dialog');
        assert.ok(!dialog.classList.contains('hidden'));
        assert.equal(dialog.getAttribute('role'), 'dialog');
        const paid = w.eval('KVStore.data.imports[0].paid') || 0;
        assert.equal(
            w.document.getElementById('action-dialog-method-wrap').classList.contains('hidden'),
            paid <= 0
        );
        w.document.getElementById('action-dialog-input').value = '';
        w.document.getElementById('action-dialog-form').requestSubmit();
        assert.ok(!w.document.getElementById('action-dialog-error').classList.contains('hidden'));
        w.document.getElementById('action-dialog-input').value = 'Hàng lỗi kỹ thuật';
        w.document.getElementById('action-dialog-method').value = 'transfer';
        w.document.getElementById('action-dialog-form').requestSubmit();
        await pending;

        const commanded = w.eval('window.commanded');
        assert.equal(commanded.cmd, 'cancel_import');
        assert.equal(commanded.payload.importId, targetCode);
        assert.equal(commanded.payload.reason, 'Hàng lỗi kỹ thuật');
        assert.equal(commanded.payload.refundMethod, paid > 0 ? 'transfer' : undefined);

        // 4. Modal is closed and import is marked cancelled
        assert.ok(modal.classList.contains('hidden'));
        assert.equal(w.eval('KVStore.data.imports[0].status'), 'cancelled');

        // 5. Open detail of cancelled import
        w.viewImportDetail(targetCode);
        assert.ok(!banner.classList.contains('hidden'));
        assert.ok(banner.textContent.includes('Hàng lỗi kỹ thuật'));
        assert.ok(cancelBtn.classList.contains('hidden'));

        // 6. Test status filter in imports view
        const statusFilter = w.document.getElementById('import-status-filter');
        assert.ok(statusFilter);

        statusFilter.value = 'imported';
        w.renderImports();
        let rows = w.document.querySelectorAll('#import-tbody tr');
        assert.ok(!Array.from(rows).some((r) => r.textContent.includes(targetCode)));

        statusFilter.value = 'cancelled';
        w.renderImports();
        rows = w.document.querySelectorAll('#import-tbody tr');
        assert.ok(
            Array.from(rows).some(
                (r) => r.textContent.includes(targetCode) && r.textContent.includes('Đã hủy')
            )
        );

        statusFilter.value = 'all';
        w.renderImports();
        rows = w.document.querySelectorAll('#import-tbody tr');
        assert.ok(Array.from(rows).some((r) => r.textContent.includes(targetCode)));
    } finally {
        dom.window.close();
    }
});
