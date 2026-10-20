// KiotViet WebApp - Main Logic Controller
let state = {
    currentView: 'dashboard',
    activePosTab: 0,
    posTabs: [
        {
            id: 1,
            name: 'Hóa đơn 1',
            cart: [],
            customer: null,
            discount: 0,
            paymentMethod: 'cash',
            customerGiven: 0,
            note: '',
            mode: 'fast'
        }
    ],
    selectedInvoice: null,
    selectedImport: null,
    selectedCustomer: null
};

// --- INITIALIZATION ---
async function initApp() {
    setupNavigation();
    setupKeyboardShortcuts();
    const ready = await KVStore.init();
    showLoginScreen(!ready);
    if (ready) {
        renderAllViews();
        renderBranchSelector();
        renderCategorySelectOptions();
        applyUserPermissionsToUI();
        navigateAfterLogin();
    }
}

function renderAllViews() {
    renderDashboard();
    renderProducts();
    renderStocktakes();
    renderTransfers();
    renderInvoices();
    renderImports();
    renderCustomers();
    renderSuppliers();
    renderCashbook();
    renderReports();
    renderPosScreen();
}

// --- NAVIGATION ---
function switchView(viewName) {
    // 1. Permission Guard
    const viewPermMap = {
        dashboard: 'dashboard',
        pos: 'pos',
        products: 'products',
        stocktakes: 'stocktakes',
        transfers: 'transfers',
        imports: 'imports',
        suppliers: 'suppliers',
        invoices: 'invoices',
        customers: 'customers',
        cashbook: 'cashbook',
        reports: 'reports'
    };
    const reqPerm = viewPermMap[viewName];
    if (reqPerm && typeof hasPermission === 'function' && !hasPermission(reqPerm)) {
        const permNames = {
            dashboard: 'Tổng quan',
            pos: 'Bán hàng (POS)',
            products: 'Hàng hóa & Danh mục',
            stocktakes: 'Kiểm kho',
            transfers: 'Chuyển hàng',
            imports: 'Nhập hàng',
            suppliers: 'Nhà cung cấp',
            invoices: 'Đơn hàng & Hóa đơn',
            customers: 'Khách hàng',
            cashbook: 'Sổ quỹ',
            reports: 'Báo cáo & Doanh thu'
        };
        showToast(
            `Tài khoản "${getCurrentUser()?.name || 'Hiện tại'}" không có quyền truy cập: ${permNames[reqPerm] || viewName}!`,
            'error'
        );
        return;
    }

    if (state.currentView !== 'pos') {
        state.previousView = state.currentView;
    }
    state.currentView = viewName;
    const mgmtLayout = document.getElementById('management-layout');
    const posLayout = document.getElementById('pos-layout');

    // Tự động đóng dropdown menu khi chuyển trang
    const hanghoaMenu = document.getElementById('hanghoa-mega-menu');
    if (hanghoaMenu) hanghoaMenu.classList.add('hidden');
    const muahangMenu = document.getElementById('muahang-mega-menu');
    if (muahangMenu) muahangMenu.classList.add('hidden');

    if (viewName === 'pos') {
        mgmtLayout.classList.add('hidden');
        posLayout.classList.remove('hidden');
        renderPosScreen();
        return;
    }

    posLayout.classList.add('hidden');
    mgmtLayout.classList.remove('hidden');

    document.querySelectorAll('.view-container').forEach((el) => el.classList.add('hidden'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.remove('hidden');

    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.remove('nav-item-active'));
    let activeBtnId = `nav-${viewName}`;
    if (viewName === 'stocktakes' || viewName === 'transfers') {
        activeBtnId = 'nav-products';
    } else if (viewName === 'suppliers') {
        activeBtnId = 'nav-imports';
    }
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) activeBtn.classList.add('nav-item-active');

    // Re-render view specific content
    if (viewName === 'dashboard') renderDashboard();
    else if (viewName === 'products') renderProducts();
    else if (viewName === 'stocktakes') renderStocktakes();
    else if (viewName === 'transfers') renderTransfers();
    else if (viewName === 'invoices') renderInvoices();
    else if (viewName === 'imports') renderImports();
    else if (viewName === 'customers') renderCustomers();
    else if (viewName === 'suppliers') renderSuppliers();
    else if (viewName === 'cashbook') renderCashbook();
    else if (viewName === 'reports') renderReports();
}

function setupNavigation() {
    // Hover event listeners for Hàng hóa & Mua hàng dropdowns (Tự hiện khi hover, tự ẩn khi rời chuột)
    const hanghoaWrap = document.getElementById('hanghoa-dropdown-wrapper');
    const hanghoaMenu = document.getElementById('hanghoa-mega-menu');
    if (hanghoaWrap && hanghoaMenu) {
        hanghoaWrap.addEventListener('mouseenter', () => {
            hanghoaMenu.classList.remove('hidden');
        });
        hanghoaWrap.addEventListener('mouseleave', () => {
            hanghoaMenu.classList.add('hidden');
        });
    }

    const muahangWrap = document.getElementById('muahang-dropdown-wrapper');
    const muahangMenu = document.getElementById('muahang-mega-menu');
    if (muahangWrap && muahangMenu) {
        muahangWrap.addEventListener('mouseenter', () => {
            muahangMenu.classList.remove('hidden');
        });
        muahangWrap.addEventListener('mouseleave', () => {
            muahangMenu.classList.add('hidden');
        });
    }

    // Dropdown close on outside click
    document.addEventListener('click', (e) => {
        const dropWrapper = document.getElementById('muahang-dropdown-wrapper');
        const megaMenu = document.getElementById('muahang-mega-menu');
        if (megaMenu && dropWrapper && !dropWrapper.contains(e.target)) {
            megaMenu.classList.add('hidden');
        }
        const hanghoaWrapper = document.getElementById('hanghoa-dropdown-wrapper');
        const hhMenu = document.getElementById('hanghoa-mega-menu');
        if (hhMenu && hanghoaWrapper && !hanghoaWrapper.contains(e.target)) {
            hhMenu.classList.add('hidden');
        }
        const branchWrapper = document.getElementById('branch-dropdown-wrapper');
        const branchMenu = document.getElementById('branch-dropdown-menu');
        if (branchMenu && branchWrapper && !branchWrapper.contains(e.target)) {
            branchMenu.classList.add('hidden');
        }
        const posDrop = document.getElementById('pos-product-dropdown');
        const posSearch = document.getElementById('pos-search-input');
        if (posDrop && posSearch && !posDrop.contains(e.target) && !posSearch.contains(e.target)) {
            posDrop.classList.add('hidden');
        }
        const posCustDrop = document.getElementById('pos-customer-dropdown');
        const posCustInput = document.getElementById('pos-customer-input');
        if (
            posCustDrop &&
            posCustInput &&
            !posCustDrop.contains(e.target) &&
            !posCustInput.contains(e.target)
        ) {
            posCustDrop.classList.add('hidden');
        }
    });
}

function toggleMegaMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('muahang-mega-menu');
    if (menu) menu.classList.toggle('hidden');
}

function toggleHangHoaMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('hanghoa-mega-menu');
    if (menu) menu.classList.toggle('hidden');
}

function getUserAllowedBranches(user = null) {
    if (!user) user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return ['Kalo HCM'];
    if (user.role === 'admin') {
        return (KVStore.data?.branches || []).map((b) => b.name);
    }
    if (Array.isArray(user.branches) && user.branches.length > 0) {
        return user.branches;
    }
    if (user.branch) {
        return [user.branch];
    }
    return ['Kalo HCM'];
}

function toggleBranchDropdown(e) {
    if (e) e.stopPropagation();
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const allowed = getUserAllowedBranches(user);
    const curBr = getCurrentBranch();

    if (user && user.role !== 'admin' && allowed.length <= 1) {
        showToast(
            `Tài khoản "${user.name}" được phân quyền cố định tại ${curBr}. Bạn không thể đổi chi nhánh!`,
            'warning'
        );
        const menu = document.getElementById('branch-dropdown-menu');
        if (menu) menu.classList.add('hidden');
        return;
    }
    const menu = document.getElementById('branch-dropdown-menu');
    if (menu) menu.classList.toggle('hidden');
}

// --- BRANCH MANAGEMENT ---
function getCurrentBranch() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const allowed = getUserAllowedBranches(user);
    const activeSetting = KVStore.data?.settings?.branch;

    if (user && user.role !== 'admin') {
        if (activeSetting && allowed.includes(activeSetting)) {
            return activeSetting;
        }
        return allowed[0] || 'Kalo HCM';
    }
    return activeSetting || 'Kalo HCM';
}

function renderBranchSelector() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const allowed = getUserAllowedBranches(user);
    const isSingleBranchLocked = Boolean(user && user.role !== 'admin' && allowed.length <= 1);
    const isAdmin = Boolean(user && user.role === 'admin');
    const currentBranch = getCurrentBranch();

    const topBranchEl = document.getElementById('top-branch-name');
    if (topBranchEl) topBranchEl.textContent = currentBranch;

    const lockIcon = document.getElementById('top-branch-lock-icon');
    const chevronIcon = document.getElementById('top-branch-chevron-icon');
    const topBranchBtn = document.getElementById('top-branch-btn');

    if (lockIcon) {
        if (isSingleBranchLocked) lockIcon.classList.remove('hidden');
        else lockIcon.classList.add('hidden');
    }
    if (chevronIcon) {
        if (isSingleBranchLocked) chevronIcon.classList.add('hidden');
        else chevronIcon.classList.remove('hidden');
    }
    if (topBranchBtn) {
        if (isSingleBranchLocked) {
            topBranchBtn.title = `Chi nhánh cố định theo phân quyền: ${currentBranch}`;
            topBranchBtn.classList.remove('hover:bg-gray-200/90');
            topBranchBtn.classList.add('bg-amber-50/90', 'border-amber-200/80', 'text-amber-900');
        } else {
            topBranchBtn.title =
                allowed.length > 1 && !isAdmin
                    ? `Đổi chi nhánh làm việc (${allowed.length} chi nhánh được phân quyền)`
                    : 'Bấm để đổi chi nhánh làm việc';
            topBranchBtn.classList.remove(
                'bg-amber-50/90',
                'border-amber-200/80',
                'text-amber-900'
            );
            topBranchBtn.classList.add('hover:bg-gray-200/90');
        }
    }

    const addWrapper = document.getElementById('branch-add-wrapper');
    if (addWrapper) {
        addWrapper.style.display = isAdmin ? '' : 'none';
    }

    const container = document.getElementById('branch-list-container');
    if (!container) return;

    let branches = KVStore.data?.branches || [];
    if (!isAdmin) {
        branches = branches.filter((b) => allowed.includes(b.name));
    }

    container.innerHTML = branches
        .map((b) => {
            const isCurrent = b.name === currentBranch;
            return renderHTML`
            <button data-branch="${b.name}" class="w-full text-left px-3 py-2 rounded-xl text-[12.5px] flex items-center justify-between transition ${isCurrent ? 'bg-blue-50 text-[#0066cc] font-bold' : 'hover:bg-gray-100 text-gray-700 font-medium'} ${isSingleBranchLocked ? 'cursor-default' : ''}">
                <div class="flex flex-col truncate pr-2">
                    <span class="flex items-center space-x-1.5">
                        <span>🏢</span>
                        <span class="truncate">${b.name}</span>
                        ${trustedHTML(isSingleBranchLocked ? trustedHTML('<span class="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full font-semibold ml-1">Cố định</span>') : '')}
                    </span>
                    <span class="text-[11px] text-gray-500 font-normal pl-5 truncate">${b.address || b.phone || ''}</span>
                </div>
                ${trustedHTML(isCurrent ? trustedHTML('<svg class="w-4 h-4 text-[#0066cc] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>') : '')}
            </button>
        `;
        })
        .join('');
    container.querySelectorAll('[data-branch]').forEach((button) => {
        button.onclick = () => {
            if (!isSingleBranchLocked) selectActiveBranch(button.dataset.branch);
        };
    });
}

async function selectActiveBranch(branchName) {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const allowed = getUserAllowedBranches(user);

    if (user && user.role !== 'admin' && !allowed.includes(branchName)) {
        showToast(`Bạn không được phân quyền làm việc tại chi nhánh "${branchName}"!`, 'warning');
        return;
    }

    if (!KVStore.data.settings) KVStore.data.settings = {};
    if (state.posTabs.some((t) => t.cart.length)) {
        showToast('Hoàn tất hoặc xóa giỏ đang mở trước khi đổi chi nhánh.', 'warning');
        return;
    }
    KVStore.data.settings.branch = branchName;
    sessionStorage.setItem('minikiot_branch', branchName);

    const menu = document.getElementById('branch-dropdown-menu');
    if (menu) menu.classList.add('hidden');

    renderBranchSelector();
    renderAllViews();
    showToast(`Đã chuyển làm việc sang chi nhánh: ${branchName}`, 'info');
}

function openAddBranchModal() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (user && user.role !== 'admin') {
        showToast('Chỉ Quản trị viên mới có quyền tạo mới chi nhánh!', 'error');
        return;
    }
    const modal = document.getElementById('branch-modal');
    if (!modal) return;

    const branches = KVStore.data?.branches || [];
    const nextCode = makeCode('CN');

    document.getElementById('branch-code-input').value = nextCode;
    document.getElementById('branch-name-input').value = '';
    document.getElementById('branch-phone-input').value = '';
    document.getElementById('branch-address-input').value = '';
    document.getElementById('branch-note-input').value = '';

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('branch-name-input')?.focus(), 50);
}

async function saveBranchFromModal(e) {
    if (e) e.preventDefault();
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (user && user.role !== 'admin') {
        showToast('Chỉ Quản trị viên mới có quyền thêm chi nhánh!', 'error');
        return;
    }
    const code = document.getElementById('branch-code-input').value.trim();
    const name = document.getElementById('branch-name-input').value.trim();
    const phone = document.getElementById('branch-phone-input').value.trim();
    const address = document.getElementById('branch-address-input').value.trim();
    const note = document.getElementById('branch-note-input').value.trim();

    if (!name) {
        showToast('Vui lòng nhập tên chi nhánh!', 'warning');
        return;
    }

    if (!KVStore.data.branches) KVStore.data.branches = [];

    const exists = KVStore.data.branches.find((b) => b.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        showToast(`Chi nhánh "${name}" đã tồn tại!`, 'warning');
        return;
    }

    const newBranch = {
        id: code,
        code,
        name,
        phone,
        address,
        isDefault: false,
        note
    };

    KVStore.data.branches.push(newBranch);
    KVStore.data.settings.branch = name;
    sessionStorage.setItem('minikiot_branch', name);
    await KVStore.save();

    document.getElementById('branch-modal')?.classList.add('hidden');
    renderBranchSelector();
    renderAllViews();
    showToast(`Đã tạo chi nhánh mới "${name}" thành công!`, 'success');
}

// --- TOAST NOTIFICATION ---
let toastTimer;
function showToast(msg, type = 'info') {
    if (type === 'success' && KVStore._busy) {
        KVStore._successMessage = msg;
        return;
    }
    const toast = document.getElementById('kv-toast');
    const msgEl = document.getElementById('kv-toast-msg');
    const iconEl = document.getElementById('kv-toast-icon');
    if (!toast || !msgEl) return;
    msgEl.textContent = msg;
    if (type === 'success') {
        iconEl.className = 'w-2.5 h-2.5 rounded-full bg-green-400';
    } else if (type === 'error') {
        iconEl.className = 'w-2.5 h-2.5 rounded-full bg-red-400';
    } else {
        iconEl.className = 'w-2.5 h-2.5 rounded-full bg-blue-400';
    }
    toast.classList.remove('translate-x-[150%]');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('translate-x-[150%]'), 2600);
}

// --- UTILS & DATE HELPERS ---
function formatVND(num) {
    return (num || 0).toLocaleString('vi-VN');
}
function parseVND(str) {
    if (typeof str === 'number') return str;
    if (/^-/.test(String(str).trim())) return -parseInt(String(str).replace(/[^0-9]/g, ''), 10);
    return parseInt((str || '0').replace(/[^0-9]/g, ''), 10) || 0;
}
function getCurrentDateTimeString() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseRecordDate(str) {
    if (!str) return null;
    const parts = str.trim().split(' ');
    const datePart = parts[0];
    const segs = datePart.split('/');
    if (segs.length === 3) {
        const day = parseInt(segs[0], 10);
        const month = parseInt(segs[1], 10) - 1;
        const year = parseInt(segs[2], 10);
        let hours = 0,
            minutes = 0;
        if (parts[1]) {
            const timeSegments = parts[1].split(':');
            hours = parseInt(timeSegments[0], 10) || 0;
            minutes = parseInt(timeSegments[1], 10) || 0;
        }
        return new Date(year, month, day, hours, minutes);
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

function matchesDateFilter(recordTimeStr, filterMode) {
    if (!filterMode || filterMode === 'all') return true;
    const d = parseRecordDate(recordTimeStr);
    if (!d) return true;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (filterMode === 'today') {
        return d >= todayStart && d <= todayEnd;
    } else if (filterMode === 'yesterday') {
        const yestStart = new Date(todayStart);
        yestStart.setDate(yestStart.getDate() - 1);
        const yestEnd = new Date(todayEnd);
        yestEnd.setDate(yestEnd.getDate() - 1);
        return d >= yestStart && d <= yestEnd;
    } else if (filterMode === '7days') {
        const past7 = new Date(todayStart);
        past7.setDate(past7.getDate() - 6);
        return d >= past7 && d <= todayEnd;
    } else if (filterMode === 'this_month') {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    } else if (filterMode === 'last_month') {
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return (
            d.getFullYear() === lastMonthDate.getFullYear() &&
            d.getMonth() === lastMonthDate.getMonth()
        );
    }
    return true;
}

// --- 1. DASHBOARD ---
function renderDashboard() {
    const data = KVStore.data;
    const now = new Date();
    const currentBranch = getCurrentBranch();

    // 1. Calculate Today's KPIs for CURRENT BRANCH ONLY
    const branchInvoices = (data.invoices || []).filter(
        (i) =>
            (i.branch || 'Kalo HCM') === currentBranch &&
            (i.status !== 'cancelled' || i.bookingVersion === 2)
    );
    const todayInvoices = branchInvoices.filter((i) => matchesDateFilter(i.time, 'today'));
    const todayRevenue = todayInvoices.reduce((acc, cur) => acc + (cur.total || 0), 0);
    const branchReturns = (data.returns || []).filter(
        (r) =>
            (r.branch || 'Kalo HCM') === currentBranch &&
            !data.invoices.some(
                (i) =>
                    i.code === r.invoiceCode && i.status === 'cancelled' && i.bookingVersion !== 2
            )
    );
    const todayReturns = branchReturns
        .filter((r) => matchesDateFilter(r.time, 'today'))
        .reduce((acc, cur) => acc + (cur.returnValue ?? cur.totalRefund ?? 0), 0);
    const netRevenue = todayRevenue - todayReturns;

    const elRev = document.getElementById('dash-today-revenue');
    if (elRev) elRev.textContent = `${formatVND(todayRevenue)} đ`;
    const elRet = document.getElementById('dash-today-returns');
    if (elRet) elRet.textContent = `${formatVND(todayReturns)} đ`;
    const elNet = document.getElementById('dash-today-net');
    if (elNet) elNet.textContent = `${formatVND(netRevenue)} đ`;
    const elOrders = document.getElementById('dash-today-orders');
    if (elOrders) elOrders.textContent = `${todayInvoices.length} đơn`;

    // 2. Month Net Revenue Badge for CURRENT BRANCH ONLY
    const monthInvoices = branchInvoices.filter((i) => matchesDateFilter(i.time, 'this_month'));
    const monthRevenue = monthInvoices.reduce((acc, cur) => acc + (cur.total || 0), 0);
    const monthReturns = branchReturns
        .filter((r) => matchesDateFilter(r.time, 'this_month'))
        .reduce((acc, cur) => acc + (cur.returnValue ?? cur.totalRefund ?? 0), 0);
    const monthNet = monthRevenue - monthReturns;
    const monthNetEl = document.getElementById('dash-month-net-revenue');
    if (monthNetEl) monthNetEl.textContent = `${formatVND(monthNet)} đ`;

    // 3. Dynamic Daily Revenue Chart for CURRENT BRANCH ONLY (Days 1 to 20 of current month)
    const dailyData = [];
    let maxDayVal = 5000000; // baseline scale

    for (let day = 1; day <= new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); day++) {
        const dayStr = String(day).padStart(2, '0');
        const dayInvs = branchInvoices.filter((i) => {
            const dt = parseRecordDate(i.time);
            if (!dt) return false;
            return (
                dt.getFullYear() === now.getFullYear() &&
                dt.getMonth() === now.getMonth() &&
                dt.getDate() === day
            );
        });

        const dayTotal = dayInvs.reduce((acc, cur) => acc + (cur.total || 0), 0);
        if (dayTotal > maxDayVal) maxDayVal = dayTotal;

        dailyData.push({
            day: dayStr,
            total: dayTotal
        });
    }

    const barsContainer = document.getElementById('dashboard-bars-container');
    const xAxisContainer = document.getElementById('dashboard-xaxis-container');
    if (barsContainer && xAxisContainer) {
        barsContainer.innerHTML = '';
        xAxisContainer.innerHTML = '';
        dailyData.forEach((item) => {
            const col = document.createElement('div');
            col.className =
                'flex flex-col items-center justify-end h-full flex-1 max-w-[28px] min-w-[12px] mx-0.5 group relative cursor-pointer';

            const barHeight = maxDayVal > 0 ? (item.total / maxDayVal) * 88 : 0;

            col.innerHTML = renderHTML`
                <div class="hidden group-hover:block absolute -top-10 bg-gray-900 text-white text-[11px] px-2 py-1 rounded shadow whitespace-nowrap z-20 pointer-events-none">
                    Ngày ${item.day}: ${formatVND(item.total)} đ (${currentBranch})
                </div>
                ${trustedHTML(item.total > 0 ? renderHTML`<div class="w-full max-w-[18px] bg-[#0066cc] hover:bg-[#0052a3] rounded-t-sm transition-all duration-300 shadow-xs" style="height: ${Math.max(6, barHeight)}%"></div>` : renderHTML`<div class="w-full max-w-[18px] bg-gray-200/50 rounded-t-xs" style="height: 2px"></div>`)}
            `;
            barsContainer.appendChild(col);

            const lbl = document.createElement('div');
            lbl.className = 'flex-1 max-w-[28px] min-w-[12px] mx-0.5 text-center truncate';
            lbl.textContent = item.day;
            xAxisContainer.appendChild(lbl);
        });
    }

    const legendLabel = document.getElementById('dashboard-chart-legend-label');
    if (legendLabel) {
        legendLabel.textContent = `Doanh thu ${currentBranch} (Tháng ${now.getMonth() + 1}/${now.getFullYear()})`;
    }

    // 4. Dynamic Top selling products for CURRENT BRANCH ONLY
    const productSalesMap = Object.create(null);
    branchInvoices.forEach((inv) => {
        (inv.items || []).forEach((item) => {
            const key = item.code || item.name;
            if (!productSalesMap[key]) {
                productSalesMap[key] = {
                    name: item.name || item.code,
                    code: item.code || '',
                    qty: 0,
                    revenue: 0
                };
            }
            productSalesMap[key].qty += item.qty || 1;
            productSalesMap[key].revenue += (item.price || 0) * (item.qty || 1);
        });
    });
    const sortedProducts = Object.values(productSalesMap).sort((a, b) => b.qty - a.qty);
    const topEl = document.getElementById('dash-top-product');
    if (topEl) {
        if (sortedProducts.length === 0) {
            topEl.innerHTML = renderHTML`<div class="text-gray-400 py-6 text-center text-[12.5px]">Chưa có dữ liệu bán hàng tại ${currentBranch}</div>`;
        } else {
            topEl.innerHTML = sortedProducts
                .slice(0, 3)
                .map((p, idx) => {
                    const rankBadge =
                        idx === 0
                            ? trustedHTML(
                                  '<span class="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 shadow-xs">1</span>'
                              )
                            : idx === 1
                              ? trustedHTML(
                                    '<span class="w-5 h-5 rounded-full bg-slate-400 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 shadow-xs">2</span>'
                                )
                              : trustedHTML(
                                    '<span class="w-5 h-5 rounded-full bg-amber-700/60 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 shadow-xs">3</span>'
                                );
                    return renderHTML`
                    <div class="flex items-center justify-between py-2 border-b border-gray-100/70 last:border-0">
                        <div class="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                            ${rankBadge}
                            <div class="min-w-0 flex-1">
                                <div class="font-semibold text-gray-900 text-[13px] truncate" title="${p.name}">${p.name}</div>
                                <div class="text-[11px] text-gray-500">${p.code ? 'Mã: ' + p.code : ''}</div>
                            </div>
                        </div>
                        <div class="text-right flex-shrink-0">
                            <div class="font-bold text-[#0066cc] text-[13px] tabular-nums">${p.qty} đã bán</div>
                            <div class="text-[11px] text-gray-500 tabular-nums">${formatVND(p.revenue)} đ</div>
                        </div>
                    </div>
                `;
                })
                .join('');
        }
    }

    // 5. Dynamic Top customers for CURRENT BRANCH ONLY
    const branchCustMap = Object.create(null);
    branchInvoices.forEach((inv) => {
        const custName = inv.customer || 'Khách lẻ';
        const key = inv.phone || custName;
        if (!branchCustMap[key]) {
            branchCustMap[key] = {
                name: custName,
                phone: inv.phone || '',
                totalSpent: 0
            };
        }
        branchCustMap[key].totalSpent += inv.total || 0;
    });
    const sortedCustomers = Object.values(branchCustMap).sort(
        (a, b) => b.totalSpent - a.totalSpent
    );

    const topCustEl = document.getElementById('dash-top-customer');
    if (topCustEl) {
        if (sortedCustomers.length === 0) {
            topCustEl.innerHTML = renderHTML`<div class="text-gray-400 py-6 text-center text-[12.5px]">Chưa có dữ liệu khách hàng tại ${currentBranch}</div>`;
        } else {
            topCustEl.innerHTML = sortedCustomers
                .slice(0, 3)
                .map((c, idx) => {
                    const rankBadge =
                        idx === 0
                            ? trustedHTML(
                                  '<span class="w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 shadow-xs">1</span>'
                              )
                            : idx === 1
                              ? trustedHTML(
                                    '<span class="w-5 h-5 rounded-full bg-slate-400 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 shadow-xs">2</span>'
                                )
                              : trustedHTML(
                                    '<span class="w-5 h-5 rounded-full bg-emerald-700/60 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 shadow-xs">3</span>'
                                );
                    return renderHTML`
                    <div class="flex items-center justify-between py-2 border-b border-gray-100/70 last:border-0">
                        <div class="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                            ${rankBadge}
                            <div class="min-w-0 flex-1">
                                <div class="font-semibold text-gray-900 text-[13px] truncate" title="${c.name}">${c.name}</div>
                                <div class="text-[11px] text-gray-500">${c.phone || ''}</div>
                            </div>
                        </div>
                        <div class="text-right flex-shrink-0">
                            <div class="font-bold text-emerald-600 text-[13px] tabular-nums">${formatVND(c.totalSpent)} đ</div>
                            <div class="text-[11px] text-gray-500">Chi tiêu tích lũy</div>
                        </div>
                    </div>
                `;
                })
                .join('');
        }
    }

    // 6. Recent activity stream for CURRENT BRANCH ONLY
    const actContainer = document.getElementById('dash-recent-activities');
    if (actContainer) {
        actContainer.innerHTML = '';
        const activities = [];
        const branchInvs = (data.invoices || []).filter(
            (i) => (i.branch || 'Kalo HCM') === currentBranch
        );
        const branchImps = (data.imports || []).filter(
            (imp) => (imp.branch || 'Kalo HCM') === currentBranch
        );

        branchInvs.slice(0, 5).forEach((inv) => {
            activities.push({
                type: 'sale',
                title: inv.cashier || 'Thu ngân',
                action: 'vừa bán đơn hàng',
                val: formatVND(inv.total),
                time: inv.time
            });
        });
        branchImps.slice(0, 3).forEach((imp) => {
            activities.push({
                type: 'import',
                title: imp.creator || 'Quản lý kho',
                action: 'vừa nhập hàng',
                val: formatVND(imp.needPay),
                time: imp.time
            });
        });

        (data.recentActivities || [])
            .filter((a) => a.branch === currentBranch || (a.text && a.text.includes(currentBranch)))
            .slice(0, 3)
            .forEach((act) => {
                activities.push({
                    type: 'stock',
                    title: 'Hệ thống',
                    action: act.text,
                    val: '',
                    time: act.time
                });
            });

        if (activities.length === 0) {
            actContainer.innerHTML = renderHTML`<div class="text-gray-400 py-6 text-center text-[12.5px]">Chưa có hoạt động nào tại ${currentBranch}</div>`;
        } else {
            activities.forEach((act) => {
                const div = document.createElement('div');
                div.className =
                    'flex items-center space-x-3 text-[12.5px] p-2 rounded-xl hover:bg-white/60 transition';
                div.innerHTML = renderHTML`
                    <div class="w-8 h-8 rounded-xl bg-blue-50/80 border border-blue-200/50 text-[#0066cc] flex items-center justify-center font-bold text-sm flex-shrink-0">
                        ${act.type === 'sale' ? '🛒' : act.type === 'import' ? '📦' : '📋'}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="truncate leading-snug">
                            <span class="font-semibold text-[#0066cc]">${act.title}</span>
                            <span class="text-gray-600"> ${act.action} </span>
                            ${trustedHTML(act.val ? renderHTML`<span class="font-bold text-gray-900 tabular-nums">${act.val} đ</span>` : '')}
                        </div>
                        <div class="text-[11px] text-gray-400 mt-0.5">${act.time}</div>
                    </div>
                `;
                actContainer.appendChild(div);
            });
        }
    }
}

// --- 2. POS POINT OF SALE SYSTEM ---
function renderPosScreen() {
    const curTab = state.posTabs[state.activePosTab] || state.posTabs[0];
    const cartContainer = document.getElementById('pos-cart-list');
    const totalQtyEl = document.getElementById('pos-total-qty');
    const subtotalEl = document.getElementById('pos-subtotal');
    const grandTotalEl = document.getElementById('pos-grand-total');
    const customerInput = document.getElementById('pos-customer-input');
    const changeEl = document.getElementById('pos-change');
    const tenderInput = document.getElementById('pos-tender-input');

    if (!cartContainer) return;

    const posBranchEl = document.getElementById('pos-branch-badge');
    if (posBranchEl) posBranchEl.textContent = getCurrentBranch();

    // Render POS tabs in header
    const tabsContainer = document.getElementById('pos-tabs-wrapper');
    if (tabsContainer) {
        tabsContainer.innerHTML = '';
        state.posTabs.forEach((tab, index) => {
            const isActive = index === state.activePosTab;
            const tabBtn = document.createElement('div');
            tabBtn.className = `${isActive ? 'bg-[#f4f7fb] text-gray-900 shadow-sm border-t border-x border-white/60' : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white border-transparent'} h-9 px-2.5 sm:px-3.5 rounded-t-xl flex items-center space-x-1.5 sm:space-x-2 font-bold text-[12px] sm:text-[12.5px] cursor-pointer transition whitespace-nowrap flex-shrink-0`;
            tabBtn.innerHTML = renderHTML`
                <svg class="w-3.5 h-3.5 ${isActive ? 'text-[#0066cc]' : 'text-white'} flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                </svg>
                <span>${tab.name}</span>
                ${trustedHTML(state.posTabs.length > 1 ? renderHTML`<button onclick="closePosTab(event, ${index})" class="text-gray-400 hover:text-red-500 font-bold text-xs ml-1 transition">✕</button>` : '')}
            `;
            tabBtn.onclick = () => switchPosTab(index);
            tabsContainer.appendChild(tabBtn);
        });
    }

    // Render Cart items
    cartContainer.innerHTML = '';
    let totalQty = 0;
    let subtotal = 0;

    if (curTab.cart.length === 0) {
        cartContainer.innerHTML = renderHTML`
            <div class="h-full flex flex-col items-center justify-center text-gray-400 py-16">
                <div class="w-16 h-16 rounded-2xl bg-white/60 border border-white/80 shadow-sm flex items-center justify-center text-gray-400 mb-3">
                    <svg class="w-8 h-8 stroke-current" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                </div>
                <div class="font-semibold text-gray-600 text-[14px]">Chưa có sản phẩm nào trong đơn</div>
                <div class="text-[12px] text-gray-400 mt-1">Tìm sản phẩm (F3) hoặc quét mã vạch để thêm vào đơn hàng</div>
            </div>
        `;
    } else {
        curTab.cart.forEach((item, index) => {
            totalQty += item.qty;
            const lineTotal = item.qty * item.price;
            subtotal += lineTotal;

            const row = document.createElement('div');
            row.className =
                'glass-card rounded-2xl p-2.5 sm:p-3 mb-2 shadow-sm border border-white/70 flex flex-col sm:flex-row sm:items-center justify-between text-[13px] hover:border-blue-200/80 transition gap-1.5 sm:gap-0';
            row.innerHTML = renderHTML`
                <div class="flex items-center justify-between w-full sm:w-auto sm:flex-1 min-w-0 pr-1 sm:pr-3">
                    <div class="flex items-center space-x-2 min-w-0 flex-1">
                        <span class="text-gray-400 font-medium w-4.5 text-center flex-shrink-0 text-xs">${index + 1}.</span>
                        <div class="min-w-0 flex-1">
                            <div class="font-semibold text-gray-900 leading-snug truncate text-[13px]">${item.name}</div>
                            <div class="text-[11px] text-gray-400 font-mono mt-0.5">${item.code} | Tồn: ${item.stock || 0}</div>
                        </div>
                    </div>
                    <button onclick="removePosItem('${item.code}')" class="w-6.5 h-6.5 inline-flex items-center justify-center text-gray-400 hover:text-red-500 font-bold transition flex-shrink-0 ml-1 rounded-lg hover:bg-red-50 sm:hidden">✕</button>
                </div>
                <div class="flex items-center justify-between sm:justify-end sm:space-x-4 pt-1 sm:pt-0 border-t border-gray-100 sm:border-0 w-full sm:w-auto flex-shrink-0">
                    <div class="inline-flex items-center border border-gray-200/80 rounded-xl overflow-hidden bg-white/80 backdrop-blur-sm">
                        <button onclick="changePosQty('${item.code}', -1)" class="w-6.5 h-6.5 sm:w-7 sm:h-7 inline-flex items-center justify-center hover:bg-gray-100 font-bold text-gray-600 transition">-</button>
                        <input type="number" onchange="setPosQty('${item.code}', this.value)" value="${item.qty}" class="w-10 sm:w-12 text-center font-bold text-gray-800 bg-transparent focus:outline-none tabular-nums text-xs sm:text-[13px]">
                        <button onclick="changePosQty('${item.code}', 1)" class="w-6.5 h-6.5 sm:w-7 sm:h-7 inline-flex items-center justify-center hover:bg-gray-100 font-bold text-gray-600 transition">+</button>
                    </div>
                    <div class="hidden sm:block w-24 text-right text-gray-700 font-medium tabular-nums text-xs sm:text-[13px]">${formatVND(item.price)}</div>
                    <div class="text-right font-bold text-gray-900 tabular-nums text-[13.5px] sm:text-[14px] sm:w-28">${formatVND(lineTotal)}</div>
                    <button onclick="removePosItem('${item.code}')" class="hidden sm:inline-flex w-6 h-6 items-center justify-center text-gray-400 hover:text-red-500 font-bold transition flex-shrink-0">✕</button>
                </div>
            `;
            cartContainer.appendChild(row);
        });
    }

    const discount = curTab.discount || 0;
    const grandTotal = Math.max(0, subtotal - discount);

    totalQtyEl.textContent = totalQty;
    subtotalEl.textContent = formatVND(subtotal);
    grandTotalEl.textContent = formatVND(grandTotal);

    // Customer display & Badge
    const clearCustBtn = document.getElementById('pos-customer-clear-btn');
    const custBadge = document.getElementById('pos-customer-badge');
    const custPointsEl = document.getElementById('pos-cust-points');
    const custDebtEl = document.getElementById('pos-cust-debt');
    if (customerInput) {
        customerInput.value = curTab.customer
            ? `${curTab.customer.name} - ${curTab.customer.phone}`
            : '';
    }
    if (clearCustBtn) {
        clearCustBtn.classList.toggle('hidden', !curTab.customer);
    }
    if (custBadge && custPointsEl && custDebtEl) {
        if (curTab.customer && curTab.customer.code !== 'KH0011') {
            custBadge.classList.remove('hidden');
            custPointsEl.textContent = `Điểm: ${curTab.customer.points || 0}`;
            custDebtEl.textContent = `Nợ cũ: ${formatVND(curTab.customer.debt || 0)} đ`;
            custDebtEl.className =
                (curTab.customer.debt || 0) > 0 ? 'font-bold text-red-500' : 'text-gray-600';
        } else {
            custBadge.classList.add('hidden');
        }
    }

    // Discount input
    const discountInput = document.getElementById('pos-discount-input');
    if (discountInput && document.activeElement !== discountInput) {
        discountInput.value = curTab.discount > 0 ? curTab.discount : '';
    }

    // Tender input
    if (tenderInput && document.activeElement !== tenderInput) {
        tenderInput.value = curTab.customerGiven > 0 ? formatVND(curTab.customerGiven) : '';
    }

    // Change calculation
    const given = curTab.customerGiven || 0;
    const change = given - grandTotal;
    if (changeEl) {
        if (change >= 0) {
            changeEl.textContent = formatVND(change);
            changeEl.className = 'font-bold text-green-600 tabular-nums';
        } else {
            changeEl.textContent = `Thiếu ${formatVND(Math.abs(change))}`;
            changeEl.className = 'font-bold text-red-500 tabular-nums';
        }
    }
}

function handlePosTenderInput(val) {
    const raw = parseInt((val || '0').replace(/\D/g, ''), 10) || 0;
    const curTab = state.posTabs[state.activePosTab];
    curTab.customerGiven = raw;
    renderPosScreen();
}

function addPosNewTab() {
    const newId = state.posTabs.length + 1;
    state.posTabs.push({
        id: newId,
        name: `Hóa đơn ${newId}`,
        cart: [],
        customer: null,
        discount: 0,
        paymentMethod: 'cash',
        customerGiven: 0,
        note: '',
        mode: 'fast'
    });
    state.activePosTab = state.posTabs.length - 1;
    renderPosScreen();
    showToast(`Đã mở thêm Hóa đơn ${newId}`, 'success');
}

function switchPosTab(index) {
    state.activePosTab = index;
    renderPosScreen();
}

function closePosTab(e, index) {
    e.stopPropagation();
    if (state.posTabs.length <= 1) return;
    state.posTabs.splice(index, 1);
    if (state.activePosTab >= state.posTabs.length) {
        state.activePosTab = state.posTabs.length - 1;
    }
    renderPosScreen();
}

function searchPosProducts(query) {
    const dropdown = document.getElementById('pos-product-dropdown');
    if (!dropdown) return;
    const q = (query || '').toLowerCase().trim();
    dropdown.innerHTML = '';

    const currentBranch = getCurrentBranch();
    const branchProducts = (KVStore.data.products || []).filter(
        (p) => (p.branch || 'Kalo HCM') === currentBranch
    );

    const list = branchProducts.filter(
        (p) =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.includes(q))
    );

    if (list.length === 0) {
        dropdown.innerHTML = renderHTML`<div class="px-4 py-3 text-gray-400 text-center">Không tìm thấy hàng hóa phù hợp tại ${currentBranch}</div>`;
    } else {
        dropdown.innerHTML = renderHTML`<div class="px-3 py-1.5 text-[11px] text-gray-400 border-b border-gray-100 flex justify-between items-center">
            <span>Kết quả tìm kiếm (${list.length})</span>
            <button onclick="document.getElementById('pos-product-dropdown').classList.add('hidden')" class="text-blue-600 hover:underline">Đóng</button>
        </div>`;
        list.slice(0, 8).forEach((p) => {
            const item = document.createElement('div');
            item.className =
                'px-3 py-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center border-b border-gray-50';
            item.innerHTML = renderHTML`
                <div>
                    <div class="font-medium text-[12.5px] text-gray-900">${p.name}</div>
                    <div class="text-[11px] text-gray-500 font-mono">${p.code} | Tồn: <span class="${p.stock <= 0 ? 'text-red-500 font-bold' : (p.minStock || 0) > 0 && p.stock < p.minStock ? 'text-orange-500 font-bold' : 'text-gray-700'}">${p.stock}</span></div>
                </div>
                <div class="font-bold text-[#0066cc] text-[13px]">${formatVND(p.price)}</div>
            `;
            item.onclick = () => {
                addPosCartItem(p);
                dropdown.classList.add('hidden');
                document.getElementById('pos-search-input').value = '';
            };
            dropdown.appendChild(item);
        });
    }
    dropdown.classList.remove('hidden');
}

function handlePosSearchKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const input = document.getElementById('pos-search-input');
        const q = (input.value || '').trim();
        if (!q) return;

        const currentBranch = getCurrentBranch();
        const branchProducts = (KVStore.data.products || []).filter(
            (p) => (p.branch || 'Kalo HCM') === currentBranch
        );

        // 1. Try exact barcode match first
        let matched = branchProducts.find(
            (p) => p.barcode && p.barcode.toLowerCase() === q.toLowerCase()
        );
        // 2. Try exact code match
        if (!matched) {
            matched = branchProducts.find((p) => p.code.toLowerCase() === q.toLowerCase());
        }
        // 3. Try unique search match or first item from search results
        if (!matched) {
            const list = branchProducts.filter(
                (p) =>
                    p.name.toLowerCase().includes(q.toLowerCase()) ||
                    p.code.toLowerCase().includes(q.toLowerCase()) ||
                    (p.barcode && p.barcode.includes(q))
            );
            if (list.length > 0) matched = list[0];
        }

        if (matched) {
            addPosCartItem(matched);
            input.value = '';
            const dropdown = document.getElementById('pos-product-dropdown');
            if (dropdown) dropdown.classList.add('hidden');
            showToast(`Đã thêm ${matched.name} vào đơn!`, 'success');
        } else {
            showToast(`Không tìm thấy sản phẩm "${q}" tại ${currentBranch}!`, 'warning');
        }
    }
}

function searchPosCustomers(query) {
    const dropdown = document.getElementById('pos-customer-dropdown');
    if (!dropdown) return;
    const q = (query || '').toLowerCase().trim();
    dropdown.innerHTML = '';

    let list = KVStore.data.customers;
    if (q) {
        list = list.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.phone.includes(q) ||
                c.code.toLowerCase().includes(q)
        );
    }

    if (list.length === 0) {
        dropdown.innerHTML = renderHTML`<div class="px-3 py-2 text-gray-400 text-center text-xs">Không tìm thấy khách hàng. Bấm [+] để tạo mới.</div>`;
    } else {
        dropdown.innerHTML = renderHTML`<div class="px-3 py-1 text-[11px] text-gray-400 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <span>Chọn khách hàng (${list.length})</span>
            <button type="button" onclick="document.getElementById('pos-customer-dropdown').classList.add('hidden')" class="text-blue-600 hover:underline">Đóng</button>
        </div>`;
        list.slice(0, 8).forEach((c) => {
            const item = document.createElement('div');
            item.className =
                'px-3 py-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center border-b border-gray-50 text-[12.5px]';
            item.innerHTML = renderHTML`
                <div>
                    <div class="font-medium text-gray-900">${c.name} <span class="text-gray-400 font-mono text-[11px]">(${c.code})</span></div>
                    <div class="text-[11px] text-gray-500 font-mono">${c.phone} ${c.address ? '• ' + c.address : ''}</div>
                </div>
                <div class="text-right">
                    ${trustedHTML(c.debt > 0 ? renderHTML`<div class="text-xs text-red-500 font-bold">Nợ: ${formatVND(c.debt)} đ</div>` : trustedHTML('<div class="text-xs text-green-600 font-medium">Hết nợ</div>'))}
                    <div class="text-[11px] text-gray-400">Điểm: ${c.points || 0}</div>
                </div>
            `;
            item.onclick = () => selectPosCustomer(c);
            dropdown.appendChild(item);
        });
    }
    dropdown.classList.remove('hidden');
}

function selectPosCustomer(cust) {
    const curTab = state.posTabs[state.activePosTab];
    curTab.customer = cust;
    const dropdown = document.getElementById('pos-customer-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
    renderPosScreen();
    showToast(`Đã chọn khách hàng: ${cust.name}`, 'info');
}

function clearPosCustomer() {
    const curTab = state.posTabs[state.activePosTab];
    curTab.customer = null;
    const dropdown = document.getElementById('pos-customer-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
    renderPosScreen();
}

function openAddCustomerFromPos() {
    openAddCustomerModal(null, (newCust) => {
        selectPosCustomer(newCust);
    });
}

function handlePosDiscountInput(val) {
    const curTab = state.posTabs[state.activePosTab];
    curTab.discount = parseVND(val) || 0;
    const subtotal = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
    const grandTotal = Math.max(0, subtotal - curTab.discount);
    curTab.customerGiven = grandTotal;
    renderPosScreen();
    const tenderInput = document.getElementById('pos-tender-input');
    if (tenderInput) tenderInput.value = formatVND(grandTotal);
}

function addPosCartItem(product) {
    const curTab = state.posTabs[state.activePosTab];
    if (curTab.cart.length && curTab.branch !== getCurrentBranch())
        throw new Error('Giỏ thuộc chi nhánh khác.');
    curTab.branch = getCurrentBranch();
    const existing = curTab.cart.find((i) => i.code === product.code);
    if (existing) {
        existing.qty += 1;
    } else {
        curTab.cart.push({
            code: product.code,
            name: product.name,
            price: product.price,
            costPrice: product.costPrice,
            stock: product.stock,
            qty: 1
        });
    }
    // Auto tender exact money by default
    const sub = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
    curTab.customerGiven = Math.max(0, sub - curTab.discount);
    renderPosScreen();
}

function changePosQty(code, delta) {
    const curTab = state.posTabs[state.activePosTab];
    const item = curTab.cart.find((i) => i.code === code);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
        curTab.cart = curTab.cart.filter((i) => i.code !== code);
    }
    const sub = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
    curTab.customerGiven = Math.max(0, sub - curTab.discount);
    renderPosScreen();
}

function setPosQty(code, qty) {
    const curTab = state.posTabs[state.activePosTab];
    const item = curTab.cart.find((i) => i.code === code);
    if (!item) return;
    item.qty = Math.max(1, parseInt(qty, 10) || 1);
    const sub = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
    curTab.customerGiven = Math.max(0, sub - curTab.discount);
    renderPosScreen();
}

function removePosItem(code) {
    const curTab = state.posTabs[state.activePosTab];
    curTab.cart = curTab.cart.filter((i) => i.code !== code);
    const sub = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
    curTab.customerGiven = Math.max(0, sub - curTab.discount);
    renderPosScreen();
}

function setPosCustomerGiven(amount) {
    const curTab = state.posTabs[state.activePosTab];
    curTab.customerGiven = amount;
    const tenderInput = document.getElementById('pos-tender-input');
    if (tenderInput) tenderInput.value = formatVND(amount);
    renderPosScreen();
}

function setPosExactMoney() {
    const curTab = state.posTabs[state.activePosTab];
    const sub = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
    const grand = Math.max(0, sub - curTab.discount);
    setPosCustomerGiven(grand);
}

function setPosPaymentMethod(method) {
    const curTab = state.posTabs[state.activePosTab];
    curTab.paymentMethod = method;
    document.querySelectorAll('.pos-paymethod-btn').forEach((btn) => {
        btn.classList.remove('bg-blue-50', 'text-[#0066cc]', 'border-[#0066cc]', 'font-bold');
        btn.classList.add('border-gray-200', 'text-gray-700');
    });
    const target = document.getElementById(`paymethod-${method}`);
    if (target) {
        target.classList.add('bg-blue-50', 'text-[#0066cc]', 'border-[#0066cc]', 'font-bold');
        target.classList.remove('border-gray-200', 'text-gray-700');
    }

    const qrBox = document.getElementById('pos-vietqr-container');
    if (method === 'transfer') {
        const sub = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
        const grand = Math.max(0, sub - curTab.discount);
        renderVietQR(grand, 'pos-vietqr-img', 'pos-vietqr-desc');
        if (qrBox) qrBox.classList.remove('hidden');
    } else {
        if (qrBox) qrBox.classList.add('hidden');
    }
}

function renderVietQR(amount, imgId, descId) {
    const s = KVStore.data.settings;
    const imgEl = document.getElementById(imgId);
    const descEl = document.getElementById(descId);
    const addInfo = `KiotViet_${Date.now().toString().slice(-6)}`;
    const qrUrl = `https://api.vietqr.io/image/${s.bankCode}-${s.bankAccount}-compact.jpg?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(s.bankOwner)}`;

    if (imgEl) imgEl.src = qrUrl;
    if (descEl)
        descEl.innerHTML = renderHTML`<strong>${s.bankName}</strong> | STK: <span class="font-mono font-bold">${s.bankAccount}</span><br>Chủ TK: <strong>${s.bankOwner}</strong> | Số tiền: <strong>${formatVND(amount)} đ</strong>`;
}

// --- CHECKOUT & PRINT BILL ---
async function checkoutPos() {
    const tab = state.posTabs[state.activePosTab];
    if (!tab.cart.length) throw new Error('Giỏ hàng trống.');
    const invoice = await KVStore.command('sale', {
        branch: tab.branch || getCurrentBranch(),
        items: tab.cart.map((i) => ({ code: i.code, qty: i.qty, expectedPrice: i.price })),
        customerId: tab.customer?.id || null,
        discount: tab.discount || 0,
        given: tab.customerGiven || 0,
        paymentMethod: tab.paymentMethod,
        note: tab.note || ''
    });
    tab.cart = [];
    tab.customer = null;
    tab.discount = 0;
    tab.customerGiven = 0;
    tab.note = '';
    delete tab.branch;
    renderAllViews();
    openReceiptModal(invoice);
    showToast(`Đã lưu hóa đơn ${invoice.code}.`, 'success');
}

function openReceiptModal(inv) {
    const modal = document.getElementById('receipt-modal');
    if (!modal) return;
    const s = KVStore.data.settings;

    document.getElementById('receipt-store-name').textContent = s.storeName;
    document.getElementById('receipt-address').textContent = s.address;
    document.getElementById('receipt-phone').textContent = `Hotline: ${s.hotline} - ĐT: ${s.phone}`;
    document.getElementById('receipt-code').textContent = inv.code;
    document.getElementById('receipt-time').textContent = inv.time;
    document.getElementById('receipt-customer').textContent = inv.customer;
    document.getElementById('receipt-cashier').textContent = inv.cashier || s.cashier;

    const tbody = document.getElementById('receipt-items-tbody');
    tbody.innerHTML = '';
    (inv.items || []).forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 text-[12px]';
        tr.innerHTML = renderHTML`
            <td class="py-1.5 pr-1">${idx + 1}. ${item.name}</td>
            <td class="py-1.5 px-1 text-center font-bold">${item.qty}</td>
            <td class="py-1.5 px-1 text-right">${formatVND(item.price)}</td>
            <td class="py-1.5 pl-1 text-right font-bold">${formatVND(item.qty * item.price)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('receipt-total').textContent = `${formatVND(inv.total)} đ`;
    document.getElementById('receipt-discount').textContent = `${formatVND(inv.discount || 0)} đ`;
    document.getElementById('receipt-paid').textContent = `${formatVND(inv.paid)} đ`;

    modal.classList.remove('hidden');
}

function closeReceiptModal() {
    document.getElementById('receipt-modal').classList.add('hidden');
}

function printReceipt() {
    printRegion('printable-receipt', true);
}

// Helper: Render standardized empty state row for data tables
function getEmptyStateRow(
    colspan,
    message = 'Không tìm thấy dữ liệu phù hợp',
    subtext = 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'
) {
    return renderHTML`
        <tr>
            <td colspan="${colspan}" class="py-12 text-center text-gray-400">
                <div class="flex flex-col items-center justify-center space-y-2">
                    <svg class="w-10 h-10 text-gray-300 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                    </svg>
                    <span class="text-[13px] font-semibold text-gray-600">${message}</span>
                    <span class="text-[11.5px] text-gray-400">${subtext}</span>
                </div>
            </td>
        </tr>
    `;
}

// --- 3. PRODUCTS MANAGEMENT ---
let productFilterCategory = 'all';
let productFilterStock = 'all';

function renderProducts() {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const currentBranch = getCurrentBranch();
    const q = (document.getElementById('product-search-input')?.value || '').toLowerCase().trim();
    let list = (KVStore.data.products || []).filter(
        (p) => (p.branch || 'Kalo HCM') === currentBranch
    );

    if (productFilterCategory !== 'all') {
        list = list.filter((p) => p.category === productFilterCategory);
    }
    if (productFilterStock === 'warning') {
        list = list.filter((p) => (p.minStock || 0) > 0 && p.stock < p.minStock);
    } else if (productFilterStock === 'out') {
        list = list.filter((p) => p.stock === 0);
    } else if (productFilterStock === 'in') {
        list = list.filter((p) => p.stock > 0);
    }
    if (q) {
        list = list.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                p.code.toLowerCase().includes(q) ||
                (p.barcode && p.barcode.includes(q))
        );
    }

    if (list.length === 0) {
        tbody.innerHTML = getEmptyStateRow(
            9,
            `Không tìm thấy hàng hóa phù hợp tại ${currentBranch}`
        );
        const countEl = document.getElementById('products-total-count');
        if (countEl) countEl.textContent = 'Hiển thị 0 hàng hóa';
        return;
    }

    list.forEach((p) => {
        const tr = document.createElement('tr');
        tr.className = 'table-row-hover border-b border-gray-100/70 transition text-[13px]';
        const isLow = (p.minStock || 0) > 0 && p.stock < p.minStock;
        tr.innerHTML = renderHTML`
            <td class="py-3 pl-3 pr-2 text-center"><input type="checkbox" class="kv-checkbox"></td>
            <td class="py-3 px-3 font-semibold text-[#0066cc] font-mono">${p.code}</td>
            <td class="py-3 px-3 font-medium text-gray-900 leading-snug">
                ${p.name}
                ${trustedHTML(p.hasImei ? renderHTML`<button type="button" onclick="viewProductImeis('${p.code}')" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-bold kv-badge kv-badge-purple ml-1.5 transition cursor-pointer" title="Bấm để xem danh sách IMEI tồn kho">IMEI (${(p.imeis || []).length})</button>` : '')}
            </td>
            <td class="py-3 px-3 text-gray-600">${p.category}</td>
            <td class="py-3 px-3 text-right text-gray-600 tabular-nums">${formatVND(p.costPrice)}</td>
            <td class="py-3 px-3 text-right font-bold text-gray-900 tabular-nums">${formatVND(p.price)}</td>
            <td class="py-3 px-3 text-center">
                <span class="kv-badge ${isLow ? 'kv-badge-danger' : 'kv-badge-success'} tabular-nums">
                    ${p.stock}
                </span>
            </td>
            <td class="py-3 px-3 text-center">
                <span class="kv-badge ${p.status === 'active' ? 'kv-badge-success' : 'kv-badge-secondary'}">
                    ${p.status === 'active' ? 'Đang KD' : 'Ngừng KD'}
                </span>
            </td>
            <td class="py-3 pr-4 text-right space-x-1.5 whitespace-nowrap">
                <button onclick="openBarcodeModal('${p.code}')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg text-[12px] font-medium transition shadow-2xs" title="In tem mã vạch">In mã</button>
                <button onclick="editProduct('${p.code}')" class="px-2.5 py-1 bg-blue-50 hover:bg-[#0066cc] text-[#0066cc] hover:text-white rounded-lg text-[12px] font-medium transition shadow-2xs">Sửa</button>
                <button onclick="deleteProduct('${p.code}')" class="px-2.5 py-1 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-[12px] font-medium transition shadow-2xs">Xóa</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const countEl = document.getElementById('products-total-count');
    if (countEl) countEl.textContent = `Hiển thị ${list.length} hàng hóa`;
}

// Helper: Parse IMEI/Serial strings from multiline or delimited input
function parseImeis(text) {
    if (!text) return [];
    return text
        .split(/[\r\n,;\t ]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

// Product In-Stock IMEIs Modal
let currentViewingProductImeis = null;

function viewProductImeis(code) {
    const currentBranch = getCurrentBranch();
    const prod = (KVStore.data.products || []).find(
        (p) => p.code === code && (p.branch || 'Kalo HCM') === currentBranch
    );
    if (!prod) return;

    currentViewingProductImeis = prod;
    const modal = document.getElementById('product-imeis-modal');
    if (!modal) return;

    document.getElementById('prod-imeis-sub').textContent =
        `${prod.name} (${prod.code}) - Tồn kho: ${prod.stock} - Chi nhánh: ${currentBranch}`;
    document.getElementById('search-prod-imei').value = '';
    renderProductImeisList();
    modal.classList.remove('hidden');
}

function renderProductImeisList(searchTerm = '') {
    const container = document.getElementById('prod-imeis-list');
    if (!container || !currentViewingProductImeis) return;
    container.innerHTML = '';

    const imeis = currentViewingProductImeis.imeis || [];
    let filtered = imeis;
    if (searchTerm) {
        filtered = imeis.filter((im) => im.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (filtered.length === 0) {
        container.innerHTML = renderHTML`<div class="text-center py-6 text-gray-400 italic text-[12.5px]">${searchTerm ? 'Không tìm thấy mã IMEI phù hợp' : 'Chưa có mã IMEI nào trong kho (Hãy nhập hàng để nạp mã)'}</div>`;
    } else {
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 gap-2';
        filtered.forEach((im, idx) => {
            const item = document.createElement('div');
            item.className =
                'flex items-center justify-between px-2.5 py-1.5 bg-white rounded-lg border border-purple-200/60 text-[12px] font-mono text-gray-800 shadow-2xs';
            item.innerHTML = renderHTML`
                <div class="flex items-center space-x-1.5">
                    <span class="text-gray-400 text-[10.5px] w-5">${idx + 1}.</span>
                    <span class="font-bold text-purple-900">${im}</span>
                </div>
                <button type="button" onclick="navigator.clipboard.writeText('${im}'); showToast('Đã sao chép: ${im}', 'info');" class="text-gray-400 hover:text-[#0066cc] text-[11px]" title="Sao chép">📋</button>
            `;
            grid.appendChild(item);
        });
        container.appendChild(grid);
    }

    const countText = document.getElementById('prod-imeis-count-text');
    if (countText) {
        countText.textContent = `Tổng cộng: ${imeis.length} mã IMEI (Hiển thị ${filtered.length})`;
    }
}

function filterProductImeisList() {
    const val = document.getElementById('search-prod-imei')?.value.trim();
    renderProductImeisList(val);
}

function copyAllProductImeis() {
    if (
        !currentViewingProductImeis ||
        !currentViewingProductImeis.imeis ||
        currentViewingProductImeis.imeis.length === 0
    ) {
        showToast('Không có mã IMEI nào để sao chép!', 'warning');
        return;
    }
    const text = currentViewingProductImeis.imeis.join('\n');
    navigator.clipboard
        .writeText(text)
        .then(() => {
            showToast(
                `Đã sao chép toàn bộ ${currentViewingProductImeis.imeis.length} mã IMEI!`,
                'success'
            );
        })
        .catch(() => {
            showToast('Không thể sao chép!', 'error');
        });
}

let productModalCallback = null;

function openAddProductModal(editCode = null, callback = null) {
    productModalCallback = callback;
    const modal = document.getElementById('product-modal');
    if (!modal) return;
    const titleEl = document.getElementById('product-modal-title');
    const form = document.getElementById('product-form');
    form.reset();
    form.dataset.editCode = editCode || '';

    const currentBranch = getCurrentBranch();
    let selectedCat = null;
    if (editCode) {
        titleEl.textContent = 'Chỉnh sửa hàng hóa';
        const p = (KVStore.data.products || []).find(
            (item) => item.code === editCode && (item.branch || 'Kalo HCM') === currentBranch
        );
        if (p) {
            document.getElementById('prod-code').value = p.code;
            document.getElementById('prod-code').readOnly = true;
            document.getElementById('prod-name').value = p.name;
            selectedCat = p.category;
            document.getElementById('prod-cost').value = p.costPrice != null ? p.costPrice : '';
            document.getElementById('prod-price').value = p.price != null ? p.price : '';
            document.getElementById('prod-stock').value = p.stock != null ? p.stock : '';
            document.getElementById('prod-min-stock').value = p.minStock != null ? p.minStock : '';
            document.getElementById('prod-unit').value = p.unit || 'Chiếc';
            document.getElementById('prod-barcode').value = p.barcode || '';
            const imeiCheck = document.getElementById('prod-has-imei');
            if (imeiCheck) imeiCheck.checked = Boolean(p.hasImei);
        }
    } else {
        titleEl.textContent = 'Thêm hàng hóa mới';
        document.getElementById('prod-code').readOnly = false;
        const branchProducts = (KVStore.data.products || []).filter(
            (p) => (p.branch || 'Kalo HCM') === currentBranch
        );
        document.getElementById('prod-code').value = makeCode('SP');
        document.getElementById('prod-cost').value = '';
        document.getElementById('prod-price').value = '';
        document.getElementById('prod-stock').value = '';
        document.getElementById('prod-min-stock').value = '';
        document.getElementById('prod-unit').value = 'Chiếc';
        const imeiCheck = document.getElementById('prod-has-imei');
        if (imeiCheck) imeiCheck.checked = false;
    }
    renderCategorySelectOptions(selectedCat);
    modal.classList.remove('hidden');
}

async function saveProductFromModal(e) {
    e.preventDefault();
    const currentBranch = getCurrentBranch();
    const code = document.getElementById('prod-code').value.trim();
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value.trim();
    const costPrice = parseVND(document.getElementById('prod-cost').value) || 0;
    const price = parseVND(document.getElementById('prod-price').value) || 0;
    const stock = parseInt(document.getElementById('prod-stock').value, 10) || 0;
    const minStock = parseInt(document.getElementById('prod-min-stock').value, 10) || 0;
    const unit = document.getElementById('prod-unit').value.trim() || 'Chiếc';
    const barcode = document.getElementById('prod-barcode').value.trim();
    const hasImei = Boolean(document.getElementById('prod-has-imei')?.checked);

    if (!code || !name) {
        showToast('Vui lòng nhập mã và tên hàng hóa!', 'error');
        return;
    }

    const idx = (KVStore.data.products || []).findIndex(
        (p) => p.code === code && (p.branch || 'Kalo HCM') === currentBranch
    );
    let savedProduct;
    if (idx >= 0 && !document.getElementById('product-form').dataset.editCode)
        throw new Error('Mã sản phẩm đã tồn tại.');
    if (idx >= 0) {
        const currentImeis = KVStore.data.products[idx].imeis || [];
        KVStore.data.products[idx] = {
            ...KVStore.data.products[idx],
            name,
            category,
            costPrice,
            price,
            stock,
            minStock,
            unit,
            barcode,
            branch: currentBranch,
            hasImei,
            imeis: currentImeis
        };
        savedProduct = KVStore.data.products[idx];
        showToast(`Đã cập nhật hàng hóa ${code}!`, 'success');
    } else {
        savedProduct = {
            id: `${code}_${Date.now()}`,
            code,
            name,
            category,
            costPrice,
            price,
            stock,
            minStock,
            unit,
            barcode,
            status: 'active',
            branch: currentBranch,
            hasImei,
            imeis: []
        };
        KVStore.data.products.push(savedProduct);
        showToast(`Đã thêm mới hàng hóa ${code}!`, 'success');
    }

    await KVStore.save();
    renderProducts();
    document.getElementById('product-modal').classList.add('hidden');

    if (productModalCallback) {
        productModalCallback(savedProduct);
        productModalCallback = null;
    }
}

function editProduct(code) {
    openAddProductModal(code);
}

async function deleteProduct(code) {
    const currentBranch = getCurrentBranch();
    if (confirm(`Bạn có chắc chắn muốn xóa sản phẩm ${code}?`)) {
        KVStore.data.products = (KVStore.data.products || []).filter(
            (p) => !(p.code === code && (p.branch || 'Kalo HCM') === currentBranch)
        );
        await KVStore.save();
        renderProducts();
        showToast(`Đã xóa sản phẩm ${code}`, 'success');
    }
}

// --- CATEGORY HIERARCHY (2 LEVELS: PARENT & CHILD) ---
function renderCategorySelectOptions(selectedVal = null) {
    const select = document.getElementById('prod-category');
    if (!select) return;

    const categories = KVStore.data?.categories || [];
    const parents = categories.filter((c) => !c.parentId);

    let html = trustedHTML('<option value="">-- Chọn nhóm hàng --</option>');
    parents.forEach((p) => {
        const isParentSelected = selectedVal === p.name || selectedVal === p.id ? 'selected' : '';
        html += renderHTML`<option value="${p.name}" class="font-bold text-gray-900" ${isParentSelected}>📁 ${p.name}</option>`;

        // Children of this parent
        const children = categories.filter((c) => c.parentId === p.id);
        children.forEach((c) => {
            const isChildSelected =
                selectedVal === c.name || selectedVal === c.id ? 'selected' : '';
            html += renderHTML`<option value="${c.name}" class="text-gray-700" ${isChildSelected}>&nbsp;&nbsp;&nbsp;&nbsp;└─ ${c.name}</option>`;
        });
    });

    // Orphan categories (if any)
    const orphans = categories.filter(
        (c) => c.parentId && !parents.some((p) => p.id === c.parentId)
    );
    orphans.forEach((o) => {
        const isSelected = selectedVal === o.name || selectedVal === o.id ? 'selected' : '';
        html += renderHTML`<option value="${o.name}" ${isSelected}>&nbsp;&nbsp;&nbsp;&nbsp;└─ ${o.name}</option>`;
    });

    select.innerHTML = html;
    if (selectedVal) {
        select.value = selectedVal;
    }
}

function openAddCategoryModal() {
    const modal = document.getElementById('category-modal');
    if (!modal) return;

    document.getElementById('cat-name-input').value = '';
    const parentSelect = document.getElementById('cat-parent-select');
    if (parentSelect) {
        const categories = KVStore.data?.categories || [];
        const parents = categories.filter((c) => !c.parentId);
        let opts = trustedHTML('<option value="">-- Là nhóm gốc (Không có nhóm cha) --</option>');
        parents.forEach((p) => {
            opts += renderHTML`<option value="${p.id}">📁 ${p.name}</option>`;
        });
        parentSelect.innerHTML = opts;
    }

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('cat-name-input')?.focus(), 50);
}

async function saveCategoryFromModal(e) {
    if (e) e.preventDefault();
    const nameInput = document.getElementById('cat-name-input');
    const parentSelect = document.getElementById('cat-parent-select');
    const name = (nameInput?.value || '').trim();
    const parentId = (parentSelect?.value || '').trim() || null;

    if (!name) {
        showToast('Vui lòng nhập tên nhóm hàng!', 'warning');
        return;
    }

    if (!KVStore.data.categories) KVStore.data.categories = [];

    const exists = KVStore.data.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        showToast(`Nhóm hàng "${name}" đã tồn tại!`, 'warning');
        return;
    }

    const newId = 'CAT' + String(Date.now()).slice(-6);
    const newCat = { id: newId, name, parentId };
    KVStore.data.categories.push(newCat);
    await KVStore.save();

    document.getElementById('category-modal')?.classList.add('hidden');
    renderCategorySelectOptions(name);
    showToast(`Đã thêm nhóm hàng "${name}" thành công!`, 'success');
}

// --- 3B. STOCKTAKES (KIỂM KHO) ---
let activeStocktakeItems = [];

function renderStocktakes() {
    const tbody = document.getElementById('stocktakes-tbody');
    const totalCountEl = document.getElementById('stocktakes-total-count');
    if (!tbody) return;

    const currentBranch = getCurrentBranch();
    const stocktakes = (KVStore.data?.stocktakes || []).filter(
        (st) => (st.branch || 'Kalo HCM') === currentBranch
    );
    const q = (document.getElementById('stocktake-search-input')?.value || '').toLowerCase().trim();

    let list = stocktakes;
    if (q) {
        list = list.filter(
            (st) =>
                (st.code || '').toLowerCase().includes(q) ||
                (st.cashier || '').toLowerCase().includes(q) ||
                (st.note || '').toLowerCase().includes(q) ||
                (st.branch || '').toLowerCase().includes(q)
        );
    }

    if (totalCountEl) totalCountEl.textContent = `${list.length} phiếu kiểm kho`;

    if (list.length === 0) {
        tbody.innerHTML = getEmptyStateRow(
            10,
            `Không tìm thấy phiếu kiểm kho nào phù hợp tại ${currentBranch}`
        );
        return;
    }

    tbody.innerHTML = list
        .map((st) => {
            const isBalanced = st.status === 'balanced';
            const statusBadge = isBalanced
                ? trustedHTML('<span class="kv-badge kv-badge-success">Đã cân bằng</span>')
                : trustedHTML('<span class="kv-badge kv-badge-warning">Phiếu tạm</span>');

            const varianceVal = st.totalVariance || 0;
            const varColor =
                varianceVal === 0
                    ? 'text-gray-600'
                    : varianceVal > 0
                      ? 'text-emerald-600 font-bold'
                      : 'text-rose-600 font-bold';
            const varPrefix = varianceVal > 0 ? '+' : '';

            return renderHTML`
            <tr class="border-b border-gray-100 hover:bg-blue-50/40 text-[12.5px] transition group">
                <td class="py-2.5 pl-3 pr-2 text-center"><input type="checkbox" class="kv-checkbox"></td>
                <td class="py-2.5 px-3 font-mono font-bold text-[#0066cc] cursor-pointer hover:underline" onclick="viewStocktakeDetail('${st.id}')">${st.code}</td>
                <td class="py-2.5 px-3 text-gray-600">${st.time || ''}</td>
                <td class="py-2.5 px-3 text-gray-800 font-medium">${st.branch || 'Kalo HCM'}</td>
                <td class="py-2.5 px-3 text-gray-700">${st.cashier || ''}</td>
                <td class="py-2.5 px-3 text-right font-bold text-gray-900">${st.totalActual || 0}</td>
                <td class="py-2.5 px-3 text-right ${varColor}">${varPrefix}${varianceVal}</td>
                <td class="py-2.5 px-3 text-center">${statusBadge}</td>
                <td class="py-2.5 px-3 text-gray-500 max-w-[220px] truncate" title="${(st.note || '').replace(/"/g, '&quot;')}">${st.note || ''}</td>
                <td class="py-2.5 pr-3 text-right">
                    <div class="flex items-center justify-end space-x-1.5">
                        <button onclick="viewStocktakeDetail('${st.id}')" class="px-2.5 py-1 bg-gray-100 hover:bg-[#0066cc] hover:text-white text-gray-700 rounded-lg text-[12px] font-medium transition" title="Xem chi tiết">
                            Chi tiết
                        </button>
                        ${trustedHTML(
                            !isBalanced
                                ? renderHTML`
                        <button onclick="balanceDraftStocktake('${st.id}')" class="px-2.5 py-1 bg-blue-50 hover:bg-[#0066cc] text-[#0066cc] hover:text-white rounded-lg text-[12px] font-bold transition" title="Cân bằng kho">
                            Cân bằng
                        </button>`
                                : ''
                        )}
                    </div>
                </td>
            </tr>
        `;
        })
        .join('');
}

function openCreateStocktakeModal() {
    const modal = document.getElementById('create-stocktake-modal');
    if (!modal) return;

    const currentBranch = getCurrentBranch();
    const stocktakes = KVStore.data?.stocktakes || [];
    const nextCode = makeCode('PKK');

    document.getElementById('stocktake-modal-code').textContent = nextCode;
    document.getElementById('stocktake-branch-input').value = currentBranch;
    document.getElementById('stocktake-cashier-input').value =
        KVStore.data?.settings?.cashier || 'Trần Văn Nhất';
    document.getElementById('stocktake-note-input').value = '';

    // Populate products select for current branch
    const select = document.getElementById('stocktake-add-product-select');
    if (select) {
        const branchProducts = (KVStore.data?.products || []).filter(
            (p) => (p.branch || 'Kalo HCM') === currentBranch
        );
        select.innerHTML =
            trustedHTML('<option value="">+ Chọn hàng hóa thêm vào phiếu kiểm...</option>') +
            branchProducts
                .map(
                    (p) =>
                        renderHTML`<option value="${p.code}">${p.code} - ${p.name} (Tồn HT: ${p.stock})</option>`
                )
                .join('');
    }

    activeStocktakeItems = [];
    renderStocktakeRows();
    modal.classList.remove('hidden');
}

function loadAllProductsToStocktake() {
    const currentBranch = getCurrentBranch();
    const products = (KVStore.data?.products || []).filter(
        (p) => (p.branch || 'Kalo HCM') === currentBranch
    );
    activeStocktakeItems = products.map((p) => ({
        code: p.code,
        name: p.name,
        unit: p.unit || 'Chiếc',
        systemStock: p.stock || 0,
        actualStock: p.stock || 0,
        variance: 0,
        reason: ''
    }));
    renderStocktakeRows();
    showToast(
        `Đã nạp toàn bộ ${activeStocktakeItems.length} sản phẩm của ${currentBranch} vào phiếu kiểm!`,
        'info'
    );
}

function addStocktakeProductRow(code) {
    if (!code) return;
    const exists = activeStocktakeItems.find((it) => it.code === code);
    if (exists) {
        showToast(`Sản phẩm ${code} đã có trong phiếu kiểm!`, 'warning');
        return;
    }
    const currentBranch = getCurrentBranch();
    const p = (KVStore.data?.products || []).find(
        (item) => item.code === code && (item.branch || 'Kalo HCM') === currentBranch
    );
    if (!p) return;

    activeStocktakeItems.push({
        code: p.code,
        name: p.name,
        unit: p.unit || 'Chiếc',
        systemStock: p.stock || 0,
        actualStock: p.stock || 0,
        variance: 0,
        reason: ''
    });
    renderStocktakeRows();
}

function removeStocktakeRow(code) {
    activeStocktakeItems = activeStocktakeItems.filter((it) => it.code !== code);
    renderStocktakeRows();
}

function onStocktakeActualChange(code, val) {
    const item = activeStocktakeItems.find((it) => it.code === code);
    if (!item) return;
    const num = parseInt(val, 10);
    item.actualStock = isNaN(num) ? 0 : Math.max(0, num);
    item.variance = item.actualStock - item.systemStock;
    renderStocktakeRows();
}

function onStocktakeReasonChange(code, reason) {
    const item = activeStocktakeItems.find((it) => it.code === code);
    if (item) item.reason = reason;
}

function renderStocktakeRows() {
    const tbody = document.getElementById('stocktake-items-tbody');
    if (!tbody) return;

    if (activeStocktakeItems.length === 0) {
        tbody.innerHTML = renderHTML`
            <tr>
                <td colspan="9" class="py-8 text-center text-gray-400 text-[13px]">
                    Chưa có hàng hóa nào trong phiếu kiểm. Hãy chọn hàng hoặc bấm "Nạp tất cả hàng hóa".
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = activeStocktakeItems
            .map((item, idx) => {
                const varColor =
                    item.variance === 0
                        ? 'text-gray-500'
                        : item.variance > 0
                          ? 'text-emerald-600 font-bold'
                          : 'text-rose-600 font-bold';
                const varPrefix = item.variance > 0 ? '+' : '';
                return renderHTML`
                <tr class="border-b border-gray-100 hover:bg-gray-50/80">
                    <td class="py-2 px-3 text-center text-gray-500">${idx + 1}</td>
                    <td class="py-2 px-3 font-mono font-semibold text-[#0066cc]">${item.code}</td>
                    <td class="py-2 px-3 font-medium text-gray-800 leading-snug">${item.name}</td>
                    <td class="py-2 px-2 text-center text-gray-600">${item.unit}</td>
                    <td class="py-2 px-3 text-right font-semibold text-gray-700">${item.systemStock}</td>
                    <td class="py-2 px-3 text-right">
                        <input type="number" min="0" value="${item.actualStock}" oninput="onStocktakeActualChange('${item.code}', this.value)" class="w-24 text-right border border-gray-300 rounded px-2 py-1 font-bold text-[#0066cc] focus:border-[#0066cc] focus:outline-none focus:ring-1 focus:ring-blue-500">
                    </td>
                    <td class="py-2 px-3 text-right ${varColor}">${varPrefix}${item.variance}</td>
                    <td class="py-2 px-3">
                        <input type="text" value="${(item.reason || '').replace(/"/g, '&quot;')}" placeholder="Lý do chênh lệch..." onchange="onStocktakeReasonChange('${item.code}', this.value)" class="w-full border border-gray-200 rounded px-2 py-1 text-[12px] focus:border-[#0066cc] focus:outline-none">
                    </td>
                    <td class="py-2 pr-3 text-center">
                        <button type="button" onclick="removeStocktakeRow('${item.code}')" class="text-rose-500 hover:text-rose-700 font-bold p-1" title="Xóa hàng">✕</button>
                    </td>
                </tr>
            `;
            })
            .join('');
    }

    // Summaries
    const sumCount = activeStocktakeItems.length;
    const sumSystem = activeStocktakeItems.reduce((acc, it) => acc + (it.systemStock || 0), 0);
    const sumActual = activeStocktakeItems.reduce((acc, it) => acc + (it.actualStock || 0), 0);
    const sumVariance = sumActual - sumSystem;

    const countEl = document.getElementById('stocktake-sum-count');
    const sysEl = document.getElementById('stocktake-sum-system');
    const actEl = document.getElementById('stocktake-sum-actual');
    const varEl = document.getElementById('stocktake-sum-variance');

    if (countEl) countEl.textContent = sumCount;
    if (sysEl) sysEl.textContent = sumSystem;
    if (actEl) actEl.textContent = sumActual;
    if (varEl) {
        varEl.textContent = (sumVariance > 0 ? '+' : '') + sumVariance;
        varEl.className =
            sumVariance === 0
                ? 'font-bold text-gray-700'
                : sumVariance > 0
                  ? 'font-bold text-emerald-600'
                  : 'font-bold text-rose-600';
    }
}

async function saveStocktake(isBalance) {
    await KVStore.command('stocktake', {
        branch: document.getElementById('stocktake-branch-input').value,
        items: activeStocktakeItems,
        note: document.getElementById('stocktake-note-input').value,
        balance: !!isBalance
    });
    activeStocktakeItems = [];
    document.getElementById('create-stocktake-modal').classList.add('hidden');
    renderAllViews();
    showToast('Đã lưu phiếu kiểm.', 'success');
}

async function balanceDraftStocktake(id) {
    if (!confirm('Chốt phiếu kiểm? Nếu tồn đã thay đổi, cần kiểm đếm lại.')) return;
    await KVStore.command('stocktake', { id, balance: true });
    document.getElementById('stocktake-detail-modal')?.classList.add('hidden');
    renderAllViews();
    showToast('Đã cân bằng kho.', 'success');
}

function viewStocktakeDetail(id) {
    const st = (KVStore.data?.stocktakes || []).find((item) => item.id === id);
    if (!st) return;

    document.getElementById('st-detail-code').textContent = st.code;
    const statusEl = document.getElementById('st-detail-status');
    if (statusEl) {
        if (st.status === 'balanced') {
            statusEl.textContent = 'Đã cân bằng kho';
            statusEl.className =
                'text-[12px] px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200';
        } else {
            statusEl.textContent = 'Phiếu tạm';
            statusEl.className =
                'text-[12px] px-2.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800 border border-amber-200';
        }
    }

    document.getElementById('st-detail-time').textContent = st.time || '';
    document.getElementById('st-detail-branch').textContent = st.branch || 'Kalo HCM';
    document.getElementById('st-detail-cashier').textContent = st.cashier || '';
    document.getElementById('st-detail-note').textContent = st.note || '(Không có ghi chú)';

    const tbody = document.getElementById('st-detail-items-tbody');
    if (tbody) {
        tbody.innerHTML = (st.items || [])
            .map((item) => {
                const varColor =
                    item.variance === 0
                        ? 'text-gray-500'
                        : item.variance > 0
                          ? 'text-emerald-600 font-bold'
                          : 'text-rose-600 font-bold';
                const varPrefix = item.variance > 0 ? '+' : '';
                return renderHTML`
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="py-2 px-3 font-mono font-semibold text-[#0066cc]">${item.code}</td>
                    <td class="py-2 px-3 font-medium text-gray-800">${item.name}</td>
                    <td class="py-2 px-3 text-right font-semibold text-gray-700">${item.systemStock}</td>
                    <td class="py-2 px-3 text-right font-bold text-[#0066cc]">${item.actualStock}</td>
                    <td class="py-2 px-3 text-right ${varColor}">${varPrefix}${item.variance}</td>
                    <td class="py-2 px-3 text-gray-600 text-[12px]">${item.reason || '-'}</td>
                </tr>
            `;
            })
            .join('');
    }

    document.getElementById('stocktake-detail-modal')?.classList.remove('hidden');
}

function printStocktakeDetail() {
    printRegion('stocktake-detail-modal', false);
}

// --- 3C. TRANSFERS (CHUYỂN HÀNG CHI NHÁNH) ---
let activeTransferItems = [];

function renderTransfers() {
    const tbody = document.getElementById('transfers-tbody');
    const totalCountEl = document.getElementById('transfers-total-count');
    if (!tbody) return;

    const currentBranch = getCurrentBranch();
    const transfers = KVStore.data?.transfers || [];
    const q = (document.getElementById('transfer-search-input')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('transfer-status-filter')?.value || 'all';

    let list = transfers.filter(
        (tf) => tf.fromBranch === currentBranch || tf.toBranch === currentBranch
    );
    if (statusFilter !== 'all') {
        list = list.filter((tf) => tf.status === statusFilter);
    }
    if (q) {
        list = list.filter(
            (tf) =>
                (tf.code || '').toLowerCase().includes(q) ||
                (tf.fromBranch || '').toLowerCase().includes(q) ||
                (tf.toBranch || '').toLowerCase().includes(q) ||
                (tf.cashier || '').toLowerCase().includes(q) ||
                (tf.note || '').toLowerCase().includes(q)
        );
    }

    if (totalCountEl) totalCountEl.textContent = `${list.length} phiếu chuyển`;

    if (list.length === 0) {
        tbody.innerHTML = getEmptyStateRow(
            10,
            `Không tìm thấy phiếu chuyển hàng nào liên quan đến ${currentBranch}`
        );
        return;
    }

    tbody.innerHTML = list
        .map((tf) => {
            let statusBadge;
            if (tf.status === 'completed') {
                statusBadge = trustedHTML(
                    '<span class="kv-badge kv-badge-success">Đã nhận hàng</span>'
                );
            } else if (tf.status === 'shipping') {
                statusBadge = trustedHTML(
                    '<span class="kv-badge kv-badge-info">Đang chuyển</span>'
                );
            } else {
                statusBadge = trustedHTML(
                    '<span class="kv-badge kv-badge-secondary">Đã hủy</span>'
                );
            }

            return renderHTML`
            <tr class="border-b border-gray-100 hover:bg-blue-50/40 text-[12.5px] transition group">
                <td class="py-2.5 pl-3 pr-2 text-center"><input type="checkbox" class="kv-checkbox"></td>
                <td class="py-2.5 px-3 font-mono font-bold text-purple-700 cursor-pointer hover:underline" onclick="viewTransferDetail('${tf.id}')">${tf.code}</td>
                <td class="py-2.5 px-3 text-gray-600">${tf.time || ''}</td>
                <td class="py-2.5 px-3 text-gray-800 font-medium">${tf.fromBranch || ''}</td>
                <td class="py-2.5 px-3 text-gray-800 font-medium">${tf.toBranch || ''}</td>
                <td class="py-2.5 px-3 text-gray-700">${tf.cashier || ''}</td>
                <td class="py-2.5 px-3 text-right font-bold text-purple-700">${tf.totalQty || 0}</td>
                <td class="py-2.5 px-3 text-right font-bold text-gray-900">${formatVND(tf.totalValue || 0)} đ</td>
                <td class="py-2.5 px-3 text-center">${statusBadge}</td>
                <td class="py-2.5 pr-3 text-right">
                    <div class="flex items-center justify-end space-x-1.5">
                        <button onclick="viewTransferDetail('${tf.id}')" class="px-2.5 py-1 bg-gray-100 hover:bg-purple-600 hover:text-white text-gray-700 rounded-lg text-[12px] font-medium transition" title="Xem chi tiết">
                            Chi tiết
                        </button>
                        ${trustedHTML(
                            tf.status === 'shipping'
                                ? currentBranch === tf.toBranch
                                    ? renderHTML`
                            <button onclick="confirmReceiveTransfer('${tf.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[12px] font-bold transition shadow-xs" title="Xác nhận chi nhánh ${tf.toBranch} đã nhận đủ hàng">
                                Đã nhận
                            </button>`
                                    : renderHTML`
                            <span class="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-blue-50 text-[#0066cc] border border-blue-200/60" title="Đang chuyển hàng - Chờ chi nhánh ${tf.toBranch} xác nhận">
                                <span class="w-1.5 h-1.5 rounded-full bg-[#0066cc] animate-pulse"></span>
                                <span>Chờ nhận</span>
                            </span>`
                                : ''
                        )}
                    </div>
                </td>
            </tr>
        `;
        })
        .join('');
}

function openCreateTransferModal() {
    const modal = document.getElementById('create-transfer-modal');
    if (!modal) return;

    const transfers = KVStore.data?.transfers || [];
    const nextCode = makeCode('PCH');

    document.getElementById('transfer-modal-code').textContent = nextCode;
    const currentBranch = getCurrentBranch();
    document.getElementById('transfer-from-branch-input').value = currentBranch;

    // Populate toBranch select
    const branches = KVStore.data?.branches || [];
    const toSelect = document.getElementById('transfer-to-branch-select');
    if (toSelect) {
        const otherBranches = branches.filter((b) => b.name !== currentBranch);
        if (otherBranches.length > 0) {
            toSelect.innerHTML = otherBranches
                .map(
                    (b) =>
                        renderHTML`<option value="${b.name}">${b.name} (${b.address || 'Chi nhánh'})</option>`
                )
                .join('');
        } else {
            toSelect.innerHTML = branches
                .map((b) => renderHTML`<option value="${b.name}">${b.name}</option>`)
                .join('');
        }
    }

    document.getElementById('transfer-note-input').value = '';

    // Populate product select from current branch only
    const prodSelect = document.getElementById('transfer-add-product-select');
    if (prodSelect) {
        const branchProducts = (KVStore.data?.products || []).filter(
            (p) => (p.branch || 'Kalo HCM') === currentBranch
        );
        prodSelect.innerHTML =
            trustedHTML('<option value="">+ Chọn hàng hóa cần chuyển...</option>') +
            branchProducts
                .map(
                    (p) =>
                        renderHTML`<option value="${p.code}">${p.code} - ${p.name} (Tồn tại kho gửi: ${p.stock})</option>`
                )
                .join('');
    }

    activeTransferItems = [];
    renderTransferRows();
    modal.classList.remove('hidden');
}

function addTransferProductRow(code) {
    if (!code) return;
    const currentBranch = getCurrentBranch();
    const p = (KVStore.data?.products || []).find(
        (item) => item.code === code && (item.branch || 'Kalo HCM') === currentBranch
    );
    if (!p) return;

    const exists = activeTransferItems.find((it) => it.code === code);
    if (exists) {
        if (exists.qty < (p.stock || 0)) {
            exists.qty += 1;
            exists.total = exists.qty * exists.price;
            renderTransferRows();
            showToast(`Đã tăng số lượng chuyển ${p.name} lên ${exists.qty}`, 'info');
        } else {
            showToast(`Số lượng chuyển đã đạt mức tồn tối đa (${p.stock})!`, 'warning');
        }
        return;
    }

    if ((p.stock || 0) <= 0) {
        showToast(`Sản phẩm "${p.name}" hiện đã hết hàng trong kho gửi (tồn = 0)!`, 'warning');
        return;
    }

    const unitPrice = p.costPrice || p.price || 0;
    activeTransferItems.push({
        code: p.code,
        name: p.name,
        unit: p.unit || 'Chiếc',
        systemStock: p.stock || 0,
        qty: 1,
        price: unitPrice,
        total: unitPrice
    });

    renderTransferRows();
}

function removeTransferRow(code) {
    activeTransferItems = activeTransferItems.filter((it) => it.code !== code);
    renderTransferRows();
}

function onTransferQtyChange(code, val) {
    const item = activeTransferItems.find((it) => it.code === code);
    if (!item) return;
    let num = parseInt(val, 10);
    if (isNaN(num) || num < 1) num = 1;
    if (num > item.systemStock) {
        num = item.systemStock;
        showToast(
            `Số lượng chuyển không thể vượt quá tồn kho gửi (${item.systemStock})!`,
            'warning'
        );
    }
    item.qty = num;
    item.total = item.qty * item.price;
    renderTransferRows();
}

function renderTransferRows() {
    const tbody = document.getElementById('transfer-items-tbody');
    if (!tbody) return;

    if (activeTransferItems.length === 0) {
        tbody.innerHTML = renderHTML`
            <tr>
                <td colspan="9" class="py-8 text-center text-gray-400 text-[13px]">
                    Chưa có hàng hóa nào được chọn để chuyển. Hãy chọn hàng từ danh sách phía trên.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = activeTransferItems
            .map(
                (item, idx) => renderHTML`
            <tr class="border-b border-gray-100 hover:bg-gray-50/80">
                <td class="py-2 px-3 text-center text-gray-500">${idx + 1}</td>
                <td class="py-2 px-3 font-mono font-semibold text-purple-700">${item.code}</td>
                <td class="py-2 px-3 font-medium text-gray-800 leading-snug">${item.name}</td>
                <td class="py-2 px-2 text-center text-gray-600">${item.unit}</td>
                <td class="py-2 px-3 text-right font-semibold text-gray-700">${item.systemStock}</td>
                <td class="py-2 px-3 text-right">
                    <input type="number" min="1" max="${item.systemStock}" value="${item.qty}" oninput="onTransferQtyChange('${item.code}', this.value)" class="w-20 text-right border border-gray-300 rounded px-2 py-1 font-bold text-purple-700 focus:border-purple-600 focus:outline-none">
                </td>
                <td class="py-2 px-3 text-right text-gray-700">${formatVND(item.price)} đ</td>
                <td class="py-2 px-3 text-right font-bold text-gray-900">${formatVND(item.total)} đ</td>
                <td class="py-2 pr-3 text-center">
                    <button type="button" onclick="removeTransferRow('${item.code}')" class="text-rose-500 hover:text-rose-700 font-bold p-1" title="Xóa hàng">✕</button>
                </td>
            </tr>
        `
            )
            .join('');
    }

    const sumCount = activeTransferItems.length;
    const sumQty = activeTransferItems.reduce((acc, it) => acc + (it.qty || 0), 0);
    const sumTotal = activeTransferItems.reduce((acc, it) => acc + (it.total || 0), 0);

    const countEl = document.getElementById('transfer-sum-count');
    const qtyEl = document.getElementById('transfer-sum-qty');
    const totalEl = document.getElementById('transfer-sum-total');

    if (countEl) countEl.textContent = sumCount;
    if (qtyEl) qtyEl.textContent = sumQty;
    if (totalEl) totalEl.textContent = `${formatVND(sumTotal)} đ`;
}

async function saveTransfer() {
    await KVStore.command('transfer', {
        fromBranch: document.getElementById('transfer-from-branch-input').value,
        toBranch: document.getElementById('transfer-to-branch-select').value,
        items: activeTransferItems,
        note: document.getElementById('transfer-note-input').value
    });
    activeTransferItems = [];
    document.getElementById('create-transfer-modal').classList.add('hidden');
    renderAllViews();
    showToast('Đã xuất chuyển hàng và serial.', 'success');
}

async function confirmReceiveTransfer(id) {
    if (!confirm('Xác nhận đã nhận đủ hàng và serial?')) return;
    await KVStore.command('receive', { id });
    document.getElementById('transfer-detail-modal')?.classList.add('hidden');
    renderAllViews();
    showToast('Đã nhận hàng.', 'success');
}

function viewTransferDetail(id) {
    const tf = (KVStore.data?.transfers || []).find((item) => item.id === id);
    if (!tf) return;

    const currentBranch = getCurrentBranch();
    document.getElementById('tf-detail-code').textContent = tf.code;
    const statusEl = document.getElementById('tf-detail-status');
    if (statusEl) {
        if (tf.status === 'completed') {
            statusEl.textContent = 'Đã nhận hàng';
            statusEl.className =
                'text-[12px] px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200';
        } else if (tf.status === 'shipping') {
            statusEl.textContent = 'Đang chuyển';
            statusEl.className =
                'text-[12px] px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-[#0066cc] border border-blue-200';
        } else {
            statusEl.textContent = 'Đã hủy';
            statusEl.className =
                'text-[12px] px-2.5 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-700';
        }
    }

    document.getElementById('tf-detail-time').textContent = tf.time || '';
    document.getElementById('tf-detail-from').textContent = tf.fromBranch || '';
    document.getElementById('tf-detail-to').textContent = tf.toBranch || '';
    document.getElementById('tf-detail-cashier').textContent = tf.cashier || '';
    document.getElementById('tf-detail-note').textContent = tf.note || '(Không có ghi chú)';

    const receiveInfoEl = document.getElementById('tf-detail-receive-info-row');
    if (receiveInfoEl) {
        if (tf.status === 'completed') {
            receiveInfoEl.classList.remove('hidden');
            const timeEl = document.getElementById('tf-detail-received-time');
            const receiverEl = document.getElementById('tf-detail-receiver');
            if (timeEl) timeEl.textContent = tf.receivedTime || 'Đã xác nhận';
            if (receiverEl) receiverEl.textContent = tf.receiver || tf.toBranch;
        } else {
            receiveInfoEl.classList.add('hidden');
        }
    }

    const tbody = document.getElementById('tf-detail-items-tbody');
    if (tbody) {
        tbody.innerHTML = (tf.items || [])
            .map(
                (item) => renderHTML`
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-2 px-3 font-mono font-semibold text-purple-700">${item.code}</td>
                <td class="py-2 px-3 font-medium text-gray-800">${item.name}</td>
                <td class="py-2 px-3 text-center text-gray-600">${item.unit || 'Chiếc'}</td>
                <td class="py-2 px-3 text-right font-bold text-purple-700">${item.qty}</td>
                <td class="py-2 px-3 text-right text-gray-700">${formatVND(item.price || 0)} đ</td>
                <td class="py-2 px-3 text-right font-bold text-gray-900">${formatVND(item.total || 0)} đ</td>
            </tr>
        `
            )
            .join('');
    }

    const receiveContainer = document.getElementById('tf-action-receive-container');
    if (receiveContainer) {
        if (tf.status === 'shipping') {
            if (currentBranch === tf.toBranch) {
                receiveContainer.innerHTML = renderHTML`
                    <button onclick="confirmReceiveTransfer('${tf.id}')" class="glass-btn-primary px-4 py-2 text-white rounded-xl font-bold text-[12.5px] flex items-center space-x-1.5 shadow-xs">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                        <span>Xác nhận đã nhận đủ hàng</span>
                    </button>
                `;
            } else if (currentBranch === tf.fromBranch) {
                receiveContainer.innerHTML = renderHTML`
                    <div class="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-blue-50 text-[#0066cc] border border-blue-200 text-[12px] font-medium">
                        <span class="w-2 h-2 rounded-full bg-[#0066cc] animate-pulse"></span>
                        <span>Đang vận chuyển &bull; Chờ chi nhánh <b>${tf.toBranch}</b> xác nhận nhận đủ hàng</span>
                    </div>
                `;
            } else {
                receiveContainer.innerHTML = renderHTML`
                    <span class="text-blue-600 text-[12px] font-medium">Đang chuyển: Từ ${tf.fromBranch} sang ${tf.toBranch}</span>
                `;
            }
        } else if (tf.status === 'completed') {
            receiveContainer.innerHTML = renderHTML`
                <div class="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-[12px] font-semibold">
                    <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    <span>Đã nhận đủ hàng &bull; Chi nhánh <b>${tf.toBranch}</b> đã xác nhận</span>
                </div>
            `;
        } else {
            receiveContainer.innerHTML = renderHTML`
                <span class="text-gray-500 text-[12.5px]">Phiếu chuyển hàng đã hủy</span>
            `;
        }
    }

    document.getElementById('transfer-detail-modal')?.classList.remove('hidden');
}

function printTransferDetail() {
    printRegion('transfer-detail-modal', false);
}

// --- 4. INVOICES MANAGEMENT ---
let invoiceStatusFilter = 'all';

function renderInvoices() {
    const tbody = document.getElementById('invoice-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const currentBranch = getCurrentBranch();
    const q = (document.getElementById('invoice-search-input')?.value || '').toLowerCase().trim();
    const dateFilter = document.getElementById('invoice-date-filter')?.value || 'all';
    let list = (KVStore.data.invoices || []).filter(
        (i) => (i.branch || 'Kalo HCM') === currentBranch
    );

    if (invoiceStatusFilter === 'completed') {
        list = list.filter((i) => i.status === 'completed' && !i.hasReturned);
    } else if (invoiceStatusFilter === 'returned') {
        list = list.filter((i) => i.hasReturned);
    } else if (invoiceStatusFilter === 'cancelled') {
        list = list.filter((i) => i.status === 'cancelled');
    }

    if (dateFilter !== 'all') {
        list = list.filter((i) => matchesDateFilter(i.time, dateFilter));
    }

    if (q) {
        list = list.filter(
            (i) =>
                i.code.toLowerCase().includes(q) ||
                (i.customer && i.customer.toLowerCase().includes(q)) ||
                (i.phone && i.phone.includes(q))
        );
    }

    if (list.length === 0) {
        tbody.innerHTML = getEmptyStateRow(
            9,
            `Không tìm thấy hóa đơn phù hợp tại ${currentBranch}`
        );
        const countEl = document.getElementById('invoices-total-count');
        if (countEl) countEl.textContent = 'Hiển thị 0 hóa đơn';
        return;
    }

    list.forEach((row) => {
        const tr = document.createElement('tr');
        tr.className = `table-row-hover transition cursor-pointer text-[13px] border-b border-gray-100/70 ${row.status === 'cancelled' ? 'bg-red-50/40 opacity-75' : ''}`;

        let statusBadge = '';
        if (row.status === 'cancelled') {
            statusBadge = trustedHTML(
                '<span class="ml-1.5 kv-badge kv-badge-danger">Đã hủy</span>'
            );
        } else if (row.hasReturned) {
            statusBadge = trustedHTML(
                '<span class="ml-1.5 kv-badge kv-badge-warning">Đã trả hàng</span>'
            );
        }

        tr.innerHTML = renderHTML`
            <td class="py-2.5 pl-3 pr-2 text-center" onclick="event.stopPropagation()"><input type="checkbox" class="kv-checkbox"></td>
            <td class="py-2.5 px-2 text-center text-gray-400 hover:text-yellow-500" onclick="event.stopPropagation(); toggleStar(this)">
                <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
            </td>
            <td class="py-2.5 px-3 font-semibold text-[#0066cc] font-mono">
                <div class="flex items-center space-x-1.5">
                    <span class="${row.status === 'cancelled' ? 'line-through text-gray-500' : ''}">${row.code}</span>
                    ${statusBadge}
                </div>
            </td>
            <td class="py-2.5 px-3 text-gray-600 font-mono text-[12px]">${row.time}</td>
            <td class="py-2.5 px-3 text-gray-800 font-medium">${row.customer}</td>
            <td class="py-2.5 px-3 text-gray-600 font-mono">${row.phone}</td>
            <td class="py-2.5 px-3 text-right font-medium text-gray-800 tabular-nums ${row.status === 'cancelled' ? 'line-through text-gray-400' : ''}">${formatVND(row.total)}</td>
            <td class="py-2.5 px-3 text-right font-bold tabular-nums ${row.status === 'cancelled' ? 'text-gray-400' : row.redPaid ? 'text-red-500' : 'text-gray-900'}">${formatVND(row.paid)}</td>
            <td class="py-2.5 px-3 text-center" onclick="event.stopPropagation()">
                <button onclick="openInvoiceDetailByCode('${row.code}')" class="px-2.5 py-1 bg-gray-100 hover:bg-[#0066cc] hover:text-white text-gray-700 rounded-lg text-[12px] font-medium transition shadow-2xs">Chi tiết</button>
            </td>
        `;
        tr.onclick = () => openInvoiceDetailModal(row);
        tbody.appendChild(tr);
    });

    const countEl = document.getElementById('invoices-total-count');
    if (countEl) countEl.textContent = `Hiển thị ${list.length} hóa đơn`;
}

function openInvoiceDetailByCode(code) {
    const inv = (KVStore.data.invoices || []).find((i) => i.code === code);
    if (inv) openInvoiceDetailModal(inv);
}

function openInvoiceDetailModal(inv) {
    state.selectedInvoice = inv;
    const modal = document.getElementById('invoice-detail-modal');
    if (!modal) return;

    document.getElementById('inv-detail-code').textContent = inv.code;
    document.getElementById('inv-detail-time').textContent = inv.time;
    document.getElementById('inv-detail-customer').textContent = `${inv.customer} (${inv.phone})`;
    document.getElementById('inv-detail-cashier').textContent = inv.cashier || 'Trần Văn Nhất';
    document.getElementById('inv-detail-branch').textContent = inv.branch || 'Kalo HCM';

    // Status warning banner if cancelled or returned
    const bannerEl = document.getElementById('inv-detail-status-banner');
    if (bannerEl) {
        if (inv.status === 'cancelled') {
            bannerEl.innerHTML = renderHTML`<div class="p-2 mb-2 bg-red-100 border border-red-200 text-red-700 font-bold rounded text-center">HÓA ĐƠN NÀY ĐÃ BỊ HỦY - TỒN KHO & TIỀN ĐÃ HOÀN TRẢ</div>`;
            bannerEl.classList.remove('hidden');
        } else if (inv.hasReturned) {
            bannerEl.innerHTML = renderHTML`<div class="p-2 mb-2 bg-orange-100 border border-orange-200 text-orange-700 font-bold rounded text-center">HÓA ĐƠN NÀY ĐÃ CÓ PHIẾU ĐỔI TRẢ HÀNG</div>`;
            bannerEl.classList.remove('hidden');
        } else {
            bannerEl.classList.add('hidden');
        }
    }

    const tbody = document.getElementById('inv-detail-tbody');
    tbody.innerHTML = '';
    (inv.items || []).forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 text-[13px]';
        tr.innerHTML = renderHTML`
            <td class="py-2 pr-2">${idx + 1}</td>
            <td class="py-2 px-2 font-mono text-[#0066cc]">${item.code}</td>
            <td class="py-2 px-2 font-medium">${item.name}</td>
            <td class="py-2 px-2 text-center font-bold">${item.qty}</td>
            <td class="py-2 px-2 text-right">${formatVND(item.price)}</td>
            <td class="py-2 pl-2 text-right font-bold text-gray-900">${formatVND(item.qty * item.price)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('inv-detail-total').textContent = `${formatVND(inv.total)} đ`;
    document.getElementById('inv-detail-paid').textContent = `${formatVND(inv.paid)} đ`;

    // Action buttons inside invoice detail modal
    const actionContainer = document.getElementById('inv-detail-actions');
    if (actionContainer) {
        actionContainer.innerHTML = '';
        if (inv.status !== 'cancelled') {
            actionContainer.innerHTML = renderHTML`
                <button onclick="openReturnModal('${inv.code}')" class="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded font-bold text-[12.5px] flex items-center space-x-1 shadow-sm">
                    <span>🔄 Trả hàng</span>
                </button>
                <button onclick="cancelInvoice('${inv.code}')" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-[12.5px] flex items-center space-x-1 shadow-sm">
                    <span>✕ Hủy hóa đơn</span>
                </button>
                <button onclick="openReceiptModal(state.selectedInvoice)" class="px-3 py-1.5 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded font-bold text-[12.5px] flex items-center space-x-1 shadow-sm">
                    <span>🖨️ In lại HĐ</span>
                </button>
            `;
        } else {
            actionContainer.innerHTML = renderHTML`
                <span class="text-red-500 font-bold text-[12px] italic">Không thể thao tác trên hóa đơn đã hủy</span>
            `;
        }
    }

    modal.classList.remove('hidden');
}

// 4.1 HỦY HÓA ĐƠN (CANCEL INVOICE WITH AUTOMATIC STOCK & CASHBOOK REVERSAL)
async function cancelInvoice(code) {
    const reason = prompt(
        `Hủy hóa đơn ${code}? Chỉ phần chưa trả sẽ được đảo. Nhập lý do:`,
        'Khách hủy'
    );
    if (reason === null) return;
    await KVStore.command('cancel', { invoiceId: code, reason });
    document.getElementById('invoice-detail-modal')?.classList.add('hidden');
    renderAllViews();
    showToast('Đã hủy và đối soát tiền/hàng còn lại.', 'success');
}

// 4.2 TRẢ HÀNG BÁN (SALES RETURN & REFUND WORKFLOW)
let currentReturnInvoice = null;

function openReturnModal(invoiceCode) {
    const inv = KVStore.data.invoices.find((i) => i.code === invoiceCode);
    if (!inv) {
        showToast('Không tìm thấy hóa đơn!', 'error');
        return;
    }
    if (inv.status === 'cancelled') {
        showToast('Không thể trả hàng cho hóa đơn đã hủy!', 'error');
        return;
    }

    currentReturnInvoice = inv;
    const priorReturns = (KVStore.data.returns || []).filter((r) => r.invoiceCode === inv.code);
    const returnedQty = (code) =>
        priorReturns.reduce(
            (sum, r) => sum + r.items.filter((i) => i.code === code).reduce((n, i) => n + i.qty, 0),
            0
        );
    document.getElementById('invoice-detail-modal')?.classList.add('hidden');

    const modal = document.getElementById('return-modal');
    if (!modal) return;

    document.getElementById('ret-inv-code').textContent = inv.code;
    document.getElementById('ret-inv-customer').textContent = `${inv.customer} (${inv.phone})`;
    document.getElementById('ret-inv-time').textContent = inv.time;
    document.getElementById('ret-reason-input').value = 'Khách đổi ý / Không vừa kích thước';

    const tbody = document.getElementById('ret-items-tbody');
    tbody.innerHTML = '';

    (inv.items || []).forEach((item, idx) => {
        const remaining = Math.max(0, item.qty - returnedQty(item.code));
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 text-[12.5px]';
        tr.innerHTML = renderHTML`
            <td class="py-2.5 px-2 text-center">
                <input type="checkbox" ${remaining ? 'checked' : 'disabled'} id="ret-chk-${idx}" onchange="recalculateReturnRefund()" class="kv-checkbox">
            </td>
            <td class="py-2.5 px-2">
                <div class="font-semibold text-gray-900">${item.name}</div>
                <div class="text-[11px] text-gray-500 font-mono">${item.code}</div>
            </td>
            <td class="py-2.5 px-2 text-center font-bold text-gray-700">${item.qty}</td>
            <td class="py-2.5 px-2 text-right text-gray-700">${formatVND(item.price)}</td>
            <td class="py-2.5 px-2 text-center">
                <input type="number" id="ret-qty-${idx}" min="0" max="${remaining}" value="${remaining}" onchange="validateReturnQty(${idx}, ${remaining}); recalculateReturnRefund()" class="w-14 border border-gray-300 rounded px-1.5 py-1 text-center font-bold focus:border-[#0066cc] focus:outline-none">
            </td>
            <td class="py-2.5 px-2 text-right font-bold text-gray-900" id="ret-subtotal-${idx}">${formatVND(item.qty * item.price)}</td>
        `;
        tbody.appendChild(tr);
    });

    recalculateReturnRefund();
    modal.classList.remove('hidden');
}

function validateReturnQty(idx, maxQty) {
    const input = document.getElementById(`ret-qty-${idx}`);
    if (!input) return;
    let val = parseInt(input.value, 10) || 1;
    if (val < 1) val = 1;
    if (val > maxQty) val = maxQty;
    input.value = val;
}

function recalculateReturnRefund() {
    if (!currentReturnInvoice) return;
    let totalRefund = 0;
    (currentReturnInvoice.items || []).forEach((item, idx) => {
        const chk = document.getElementById(`ret-chk-${idx}`);
        const qtyInput = document.getElementById(`ret-qty-${idx}`);
        const subtotalEl = document.getElementById(`ret-subtotal-${idx}`);
        if (chk && chk.checked && qtyInput) {
            const qty = parseInt(qtyInput.value, 10) || 0;
            const sub = Math.round((invoiceLineNet(currentReturnInvoice, item) * qty) / item.qty);
            totalRefund += sub;
            if (subtotalEl) subtotalEl.textContent = formatVND(sub);
        } else if (subtotalEl) {
            subtotalEl.textContent = '0';
        }
    });

    const totalEl = document.getElementById('ret-total-refund');
    if (totalEl) {
        const prior = (KVStore.data.returns || [])
            .filter((r) => r.invoiceCode === currentReturnInvoice.code)
            .reduce((sum, r) => sum + (r.returnValue ?? r.totalRefund), 0);
        const debt = Math.max(0, currentReturnInvoice.total - prior - currentReturnInvoice.paid);
        totalEl.textContent = `${formatVND(Math.max(0, totalRefund - debt))} đ hoàn tiền; ${formatVND(Math.min(debt, totalRefund))} đ giảm nợ`;
    }
}

async function submitReturnGoods() {
    if (!currentReturnInvoice) return;
    const items = currentReturnInvoice.items
        .map((item, index) => ({
            code: item.code,
            qty: document.getElementById(`ret-chk-${index}`)?.checked
                ? Number(document.getElementById(`ret-qty-${index}`).value)
                : 0
        }))
        .filter((i) => i.qty > 0);
    const method = document.getElementById('ret-payment-method').value;
    const slip = await KVStore.command('return', {
        invoiceId: currentReturnInvoice.id,
        items,
        refundMethod: method === 'Tiền mặt' ? 'cash' : method === 'Thẻ' ? 'card' : 'transfer',
        reason: document.getElementById('ret-reason-input').value
    });
    currentReturnInvoice = null;
    document.getElementById('return-modal').classList.add('hidden');
    renderAllViews();
    openReturnReceiptModal(slip);
    showToast('Đã lưu phiếu trả và điều chỉnh công nợ.', 'success');
}

function openReturnReceiptModal(slip) {
    const modal = document.getElementById('return-receipt-modal');
    if (!modal) return;
    const s = KVStore.data.settings;

    document.getElementById('ret-rec-store-name').textContent = s.storeName;
    document.getElementById('ret-rec-address').textContent = s.address;
    document.getElementById('ret-rec-phone').textContent = `Hotline: ${s.hotline} - ĐT: ${s.phone}`;
    document.getElementById('ret-rec-code').textContent = slip.code;
    document.getElementById('ret-rec-inv-code').textContent = slip.invoiceCode;
    document.getElementById('ret-rec-time').textContent = slip.time;
    document.getElementById('ret-rec-customer').textContent = slip.customer;
    document.getElementById('ret-rec-cashier').textContent = slip.cashier || s.cashier;
    document.getElementById('ret-rec-reason').textContent = slip.reason;

    const tbody = document.getElementById('ret-rec-items-tbody');
    tbody.innerHTML = '';
    (slip.items || []).forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 text-[12px]';
        tr.innerHTML = renderHTML`
            <td class="py-1.5 pr-1">${idx + 1}. ${item.name}</td>
            <td class="py-1.5 px-1 text-center font-bold">${item.qty}</td>
            <td class="py-1.5 px-1 text-right">${formatVND(item.price)}</td>
            <td class="py-1.5 pl-1 text-right font-bold">${formatVND(item.total)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('ret-rec-total').textContent = `${formatVND(slip.totalRefund)} đ`;
    document.getElementById('ret-rec-method').textContent = slip.refundMethod;

    modal.classList.remove('hidden');
}

function closeReturnReceiptModal() {
    document.getElementById('return-receipt-modal')?.classList.add('hidden');
}

function printReturnReceipt() {
    printRegion('printable-return-receipt', true);
}

// --- 5. IMPORTS MANAGEMENT ---
function renderImports() {
    const tbody = document.getElementById('import-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const currentBranch = getCurrentBranch();
    const q = (document.getElementById('import-search-input')?.value || '').toLowerCase().trim();
    const dateFilter = document.getElementById('import-date-filter')?.value || 'all';
    let list = (KVStore.data.imports || []).filter(
        (imp) => (imp.branch || 'Kalo HCM') === currentBranch
    );

    if (dateFilter !== 'all') {
        list = list.filter((imp) => matchesDateFilter(imp.time, dateFilter));
    }

    if (q) {
        list = list.filter(
            (imp) =>
                imp.code.toLowerCase().includes(q) ||
                (imp.nccName && imp.nccName.toLowerCase().includes(q)) ||
                (imp.nccCode && imp.nccCode.toLowerCase().includes(q))
        );
    }

    if (list.length === 0) {
        tbody.innerHTML = getEmptyStateRow(
            11,
            `Không tìm thấy phiếu nhập nào phù hợp tại ${currentBranch}`
        );
        const countEl = document.getElementById('imports-total-count');
        if (countEl) countEl.textContent = 'Hiển thị 0 phiếu nhập';
        return;
    }

    list.forEach((row) => {
        let methodBadge = '';
        const pMethod = row.paymentMethod || 'bank';
        if (pMethod === 'cash') {
            methodBadge = trustedHTML('<span class="kv-badge kv-badge-warning">Tiền mặt</span>');
        } else if (pMethod === 'debt' || (row.needPay > row.paid && row.paid === 0)) {
            methodBadge = trustedHTML('<span class="kv-badge kv-badge-danger">Công nợ</span>');
        } else {
            methodBadge = trustedHTML('<span class="kv-badge kv-badge-info">Chuyển khoản</span>');
        }

        const tr = document.createElement('tr');
        tr.className =
            'table-row-hover transition cursor-pointer text-[13px] border-b border-gray-100/70';
        tr.innerHTML = renderHTML`
            <td class="py-3 pl-3 pr-2 text-center"><input type="checkbox" class="kv-checkbox"></td>
            <td class="py-3 px-2 text-center text-gray-400 hover:text-yellow-500" onclick="event.stopPropagation(); toggleStar(this)">
                <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
            </td>
            <td class="py-3 px-3 font-semibold text-[#0066cc] font-mono">${row.code}</td>
            <td class="py-3 px-3 text-gray-600 font-mono text-[12px]">${row.time}</td>
            <td class="py-3 px-3 text-gray-600 font-mono">${row.nccCode || ''}</td>
            <td class="py-3 px-3 text-gray-900 font-medium">${row.nccName || ''}</td>
            <td class="py-3 px-3 text-right font-medium text-gray-800 tabular-nums">${formatVND(row.needPay)}</td>
            <td class="py-3 px-3 text-right font-bold text-gray-900 tabular-nums">${formatVND(row.paid)}</td>
            <td class="py-3 px-3 text-center">${methodBadge}</td>
            <td class="py-3 px-3 text-gray-600 truncate max-w-[200px]">${row.note || ''}</td>
            <td class="py-3 px-3 text-center" onclick="event.stopPropagation()">
                <button onclick="viewImportDetail('${row.code}')" class="px-2.5 py-1 bg-gray-100 hover:bg-[#0066cc] hover:text-white text-gray-700 rounded-lg text-[12px] font-medium transition shadow-2xs">Chi tiết</button>
            </td>
        `;
        tr.onclick = () => viewImportDetail(row.code);
        tbody.appendChild(tr);
    });

    const countEl = document.getElementById('imports-total-count');
    if (countEl) countEl.textContent = `Hiển thị ${list.length} phiếu nhập`;
}

let selectedImportDetail = null;

function viewImportDetail(code) {
    const imp = (KVStore.data.imports || []).find((i) => i.code === code);
    if (!imp) return;
    selectedImportDetail = imp;

    const modal = document.getElementById('import-detail-modal');
    if (!modal) return;

    document.getElementById('imp-detail-code').textContent = imp.code;
    document.getElementById('imp-detail-time').textContent = imp.time;
    document.getElementById('imp-detail-ncc').textContent =
        `${imp.nccName || 'Nhà cung cấp'} (${imp.nccCode || ''})`;
    document.getElementById('imp-detail-branch').textContent = imp.branch || 'Kalo HCM';
    document.getElementById('imp-detail-creator').textContent = imp.creator || 'Quản lý kho';
    document.getElementById('imp-detail-note').textContent = imp.note || 'Không có';

    const tbody = document.getElementById('imp-detail-tbody');
    tbody.innerHTML = '';
    const items = imp.items || [];
    if (items.length === 0) {
        tbody.innerHTML = renderHTML`<tr><td colspan="5" class="py-4 text-center text-gray-400 italic">Phiếu nhập không có chi tiết mặt hàng</td></tr>`;
    } else {
        items.forEach((item, idx) => {
            const hasImei = Boolean(item.hasImei || (item.imeis && item.imeis.length > 0));
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-100 text-[12.5px]';
            tr.innerHTML = renderHTML`
                <td class="py-2.5 px-3 text-gray-500">${idx + 1}</td>
                <td class="py-2.5 px-3 font-medium text-gray-900">
                    <div>${item.name} <span class="text-gray-400 font-mono text-[11px]">(${item.code})</span></div>
                    ${trustedHTML(
                        hasImei && item.imeis && item.imeis.length > 0
                            ? renderHTML`
                        <div class="mt-1 bg-purple-50/70 p-1.5 rounded-lg border border-purple-200/60">
                            <div class="text-[11px] font-bold text-purple-900 mb-0.5">Mã IMEI (${item.imeis.length}):</div>
                            <div class="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                ${trustedHTML(item.imeis.map((m) => renderHTML`<span class="px-1.5 py-0.2 rounded bg-white text-purple-700 border border-purple-200 font-mono text-[10.5px]">${m}</span>`).join(''))}
                            </div>
                        </div>
                    `
                            : ''
                    )}
                </td>
                <td class="py-2.5 px-3 text-center font-bold text-gray-900">${item.qty}</td>
                <td class="py-2.5 px-3 text-right text-gray-700 tabular-nums">${formatVND(item.price)}</td>
                <td class="py-2.5 px-3 text-right font-bold text-gray-900 tabular-nums">${formatVND(item.total || item.qty * item.price)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    const total = imp.needPay || 0;
    const paid = imp.paid || 0;
    const debt = Math.max(0, total - paid);

    document.getElementById('imp-detail-total').textContent = `${formatVND(total)} đ`;
    document.getElementById('imp-detail-paid').textContent = `${formatVND(paid)} đ`;
    const debtEl = document.getElementById('imp-detail-debt');
    debtEl.textContent = `${formatVND(debt)} đ`;
    debtEl.className = debt > 0 ? 'text-red-500 font-bold' : 'text-gray-700 font-bold';

    modal.classList.remove('hidden');
}

function printImportDetailReceipt() {
    printRegion('import-detail-modal', false);
}

let currentImportItems = [];

function openCreateImportModal() {
    const modal = document.getElementById('create-import-modal');
    if (!modal) return;
    document.getElementById('import-code').value = makeCode('PN');
    currentImportItems = [];
    populateImportSuppliers();
    populateImportProducts();
    document.getElementById('import-qty').value = '1';
    const payMethodSelect = document.getElementById('import-payment-method');
    if (payMethodSelect) payMethodSelect.value = 'bank';
    const imeiCheckbox = document.getElementById('import-has-imei');
    if (imeiCheckbox) imeiCheckbox.checked = false;
    const imeiArea = document.getElementById('import-imeis-textarea');
    if (imeiArea) imeiArea.value = '';
    const imeiErr = document.getElementById('import-imei-error');
    if (imeiErr) imeiErr.classList.add('hidden');
    updateImportItemPriceDefault();
    renderImportItemsTable();
    modal.classList.remove('hidden');
}

function handleImportPaymentMethodChange() {
    const method = document.getElementById('import-payment-method')?.value || 'bank';
    const total = currentImportItems.reduce((a, c) => a + c.qty * c.price, 0);
    const paidInput = document.getElementById('import-paid-input');
    if (!paidInput) return;
    if (method === 'debt') {
        paidInput.value = '0';
    } else {
        paidInput.value = total;
    }
    updateImportDebtCalc();
}

function populateImportSuppliers(selectedCode = null) {
    const nccSelect = document.getElementById('import-ncc-select');
    if (!nccSelect) return;
    nccSelect.innerHTML = KVStore.data.suppliers
        .map(
            (s) =>
                renderHTML`<option value="${s.code}" ${selectedCode === s.code ? 'selected' : ''}>${s.name} (${s.code}) - Nợ: ${formatVND(s.debt)}</option>`
        )
        .join('');
}

function populateImportProducts(selectedCode = null) {
    const prodSelect = document.getElementById('import-prod-select');
    if (!prodSelect) return;
    const currentBranch = getCurrentBranch();
    const branchProducts = (KVStore.data.products || []).filter(
        (p) => (p.branch || 'Kalo HCM') === currentBranch
    );
    prodSelect.innerHTML = branchProducts
        .map(
            (p) =>
                renderHTML`<option value="${p.code}" ${selectedCode === p.code ? 'selected' : ''}>${p.name} (${p.code}) - Tồn: ${p.stock} - Giá vốn: ${formatVND(p.costPrice)}</option>`
        )
        .join('');
    updateImportItemPriceDefault();
}

function updateImportItemPriceDefault() {
    const prodCode = document.getElementById('import-prod-select')?.value;
    const currentBranch = getCurrentBranch();
    const prod = (KVStore.data.products || []).find(
        (p) => p.code === prodCode && (p.branch || 'Kalo HCM') === currentBranch
    );
    const costInput = document.getElementById('import-unit-cost');
    if (prod && costInput) {
        costInput.value = prod.costPrice || 0;
    }
    const imeiCheck = document.getElementById('import-has-imei');
    if (imeiCheck) {
        imeiCheck.checked = Boolean(prod && prod.hasImei);
    }
    const imeiArea = document.getElementById('import-imeis-textarea');
    if (imeiArea) imeiArea.value = '';
    toggleImportImeiSection();
}

function toggleImportImeiSection() {
    const isChecked = document.getElementById('import-has-imei')?.checked;
    const box = document.getElementById('import-imei-box');
    const hint = document.getElementById('import-imei-hint');
    if (box) {
        if (isChecked) {
            box.classList.remove('hidden');
            if (hint) hint.classList.remove('hidden');
            handleImportImeiInput();
        } else {
            box.classList.add('hidden');
            if (hint) hint.classList.add('hidden');
        }
    }
}

function handleImportQtyInput() {
    handleImportImeiInput();
    updateImportDebtCalc();
}

function handleImportImeiInput() {
    const area = document.getElementById('import-imeis-textarea');
    const badge = document.getElementById('import-imei-count-badge');
    const errEl = document.getElementById('import-imei-error');
    if (!area || !badge) return;

    const entered = parseImeis(area.value);
    const qty = parseInt(document.getElementById('import-qty')?.value, 10) || 1;
    const count = entered.length;

    // Check duplicates in input
    const duplicates = entered.filter((item, index) => entered.indexOf(item) !== index);
    if (duplicates.length > 0) {
        if (errEl) {
            errEl.textContent = `⚠️ Cảnh báo: Trùng mã IMEI trong danh sách: ${[...new Set(duplicates)].join(', ')}`;
            errEl.classList.remove('hidden');
        }
    } else {
        if (errEl) errEl.classList.add('hidden');
    }

    if (count === qty) {
        badge.className =
            'text-[11.5px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300';
        badge.textContent = `Đã nhập đủ: ${count} / ${qty} IMEI ✓`;
    } else if (count < qty) {
        badge.className =
            'text-[11.5px] font-bold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-md border border-purple-200';
        badge.textContent = `Đã nhập: ${count} / ${qty} (Thiếu ${qty - count})`;
    } else {
        badge.className =
            'text-[11.5px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-300';
        badge.textContent = `Đã nhập: ${count} / ${qty} (Thừa ${count - qty})`;
    }
}

function syncQtyWithImeis() {
    const area = document.getElementById('import-imeis-textarea');
    if (!area) return;
    const entered = parseImeis(area.value);
    if (entered.length > 0) {
        const qtyInput = document.getElementById('import-qty');
        if (qtyInput) qtyInput.value = entered.length;
        handleImportImeiInput();
        updateImportDebtCalc();
        showToast(`Đã đồng bộ số lượng nhập = ${entered.length}`, 'info');
    } else {
        showToast('Chưa có mã IMEI nào trong khung nhập liệu!', 'warning');
    }
}

function openAddSupplierFromImport() {
    openAddSupplierModal(null, (newSup) => {
        populateImportSuppliers(newSup.code);
        showToast(`Đã thêm & chọn NCC: ${newSup.name}!`, 'success');
    });
}

function openAddProductFromImport() {
    openAddProductModal(null, (newProd) => {
        populateImportProducts(newProd.code);
        updateImportItemPriceDefault();
        showToast(`Đã tạo & chọn hàng hóa mới: ${newProd.name}!`, 'success');
    });
}

function addImportItem() {
    const prodCode = document.getElementById('import-prod-select')?.value;
    const currentBranch = getCurrentBranch();
    const prod = (KVStore.data.products || []).find(
        (p) => p.code === prodCode && (p.branch || 'Kalo HCM') === currentBranch
    );
    if (!prod) return;
    const qty = parseInt(document.getElementById('import-qty').value, 10) || 1;
    const cost = parseVND(document.getElementById('import-unit-cost').value) || 0;
    const isImei = Boolean(document.getElementById('import-has-imei')?.checked);

    let enteredImeis = [];
    if (isImei) {
        const imeiText = document.getElementById('import-imeis-textarea')?.value || '';
        enteredImeis = parseImeis(imeiText);

        if (enteredImeis.length === 0) {
            showToast(
                `Sản phẩm "${prod.name}" chọn quản lý bằng IMEI. Bắt buộc phải nhập danh sách IMEI!`,
                'error'
            );
            document.getElementById('import-imeis-textarea')?.focus();
            return;
        }

        if (enteredImeis.length !== qty) {
            showToast(
                `Số lượng IMEI (${enteredImeis.length}) không khớp với số lượng nhập (${qty})! Hãy bấm "Tự động gán SL = số IMEI" hoặc bổ sung mã.`,
                'error'
            );
            return;
        }

        // Duplicate check within entered
        const uniqueSet = new Set(enteredImeis);
        if (uniqueSet.size !== enteredImeis.length) {
            showToast(
                'Có mã IMEI bị trùng lặp trong danh sách vừa nhập! Vui lòng kiểm tra lại.',
                'error'
            );
            return;
        }

        // Duplicate check with existing warehouse stock
        const inStockImeis = prod.imeis || [];
        const duplicateInStock = enteredImeis.find((im) => inStockImeis.includes(im));
        if (duplicateInStock) {
            showToast(
                `Mã IMEI "${duplicateInStock}" đã tồn tại trong kho chi nhánh ${currentBranch}!`,
                'error'
            );
            return;
        }

        // Duplicate check with already added items in current import order
        const alreadyAddedImeis = currentImportItems.flatMap((i) => i.imeis || []);
        const duplicateInOrder = enteredImeis.find((im) => alreadyAddedImeis.includes(im));
        if (duplicateInOrder) {
            showToast(`Mã IMEI "${duplicateInOrder}" đã có trong phiếu nhập hiện tại!`, 'error');
            return;
        }
    }

    const existing = currentImportItems.find((i) => i.code === prod.code);
    if (existing) {
        if (existing.price !== cost)
            throw new Error(
                'Cùng mã hàng có giá nhập khác: hãy lập phiếu nhập riêng để giữ đúng giá vốn.'
            );
        existing.qty += qty;
        existing.price = cost;
        existing.total = existing.qty * cost;
        if (isImei) {
            existing.hasImei = true;
            existing.imeis = [...(existing.imeis || []), ...enteredImeis];
        }
    } else {
        currentImportItems.push({
            code: prod.code,
            name: prod.name,
            qty: qty,
            price: cost,
            total: qty * cost,
            hasImei: isImei,
            imeis: isImei ? enteredImeis : []
        });
    }

    // Reset IMEI textarea and inputs
    const imeiArea = document.getElementById('import-imeis-textarea');
    if (imeiArea) imeiArea.value = '';
    document.getElementById('import-qty').value = '1';
    handleImportImeiInput();
    renderImportItemsTable();
    showToast(
        `Đã thêm ${prod.name} ${isImei ? `(${enteredImeis.length} IMEI)` : ''} vào phiếu nhập`,
        'info'
    );
}

function removeImportItem(code) {
    currentImportItems = currentImportItems.filter((i) => i.code !== code);
    renderImportItemsTable();
}

function renderImportItemsTable() {
    const tbody = document.getElementById('import-items-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (currentImportItems.length === 0) {
        tbody.innerHTML = renderHTML`<tr><td colspan="5" class="py-4 text-center text-gray-400 italic">Chưa có sản phẩm nào. Chọn sản phẩm ở trên và bấm [+ Thêm].</td></tr>`;
    } else {
        currentImportItems.forEach((item) => {
            const hasImei = Boolean(item.hasImei);
            const imeiCount = item.imeis ? item.imeis.length : 0;
            const imeiValid = imeiCount === item.qty;

            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-100';
            tr.innerHTML = renderHTML`
                <td class="py-2.5 px-3">
                    <div class="font-medium text-gray-900">${item.name} <span class="text-gray-400 font-mono text-[11px]">(${item.code})</span></div>
                    ${trustedHTML(
                        hasImei
                            ? renderHTML`
                        <div class="mt-1 flex items-center space-x-1.5 flex-wrap">
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-bold ${imeiValid ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-red-50 text-red-600 border border-red-200'}">
                                📱 IMEI: ${imeiCount}/${item.qty} ${imeiValid ? '✓' : '(Thiếu)'}
                            </span>
                            <button type="button" onclick="editImportItemImeis('${item.code}')" class="text-[11px] text-[#0066cc] hover:underline font-semibold">Xem/Sửa IMEI</button>
                        </div>
                    `
                            : ''
                    )}
                </td>
                <td class="py-2.5 px-2 text-center font-bold text-gray-900">${item.qty}</td>
                <td class="py-2.5 px-2 text-right text-gray-700 tabular-nums">${formatVND(item.price)}</td>
                <td class="py-2.5 px-2 text-right font-bold text-gray-900 tabular-nums">${formatVND(item.total)}</td>
                <td class="py-2.5 px-2 text-center">
                    <button type="button" onclick="removeImportItem('${item.code}')" class="text-gray-400 hover:text-red-500 font-bold transition">✕</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    const subtotal = currentImportItems.reduce((a, c) => a + c.total, 0);
    const totalEl = document.getElementById('import-total-calc');
    if (totalEl) totalEl.textContent = `${formatVND(subtotal)} đ`;

    const paidInput = document.getElementById('import-paid-input');
    const method = document.getElementById('import-payment-method')?.value || 'bank';
    if (paidInput) {
        paidInput.value = method === 'debt' ? 0 : subtotal;
    }
    updateImportDebtCalc();
}

// Edit Item IMEIs Modal logic
let currentEditingImportItem = null;

function editImportItemImeis(code) {
    const item = currentImportItems.find((i) => i.code === code);
    if (!item) return;
    currentEditingImportItem = item;

    const modal = document.getElementById('import-item-imei-modal');
    if (!modal) return;

    document.getElementById('edit-imei-modal-sub').textContent = `${item.name} (${item.code})`;
    document.getElementById('edit-imei-qty').textContent = item.qty;
    const textarea = document.getElementById('edit-imei-textarea');
    if (textarea) textarea.value = (item.imeis || []).join('\n');
    handleEditImeiInput();
    modal.classList.remove('hidden');
}

function closeImportItemImeiModal() {
    const modal = document.getElementById('import-item-imei-modal');
    if (modal) modal.classList.add('hidden');
    currentEditingImportItem = null;
}

function handleEditImeiInput() {
    if (!currentEditingImportItem) return;
    const area = document.getElementById('edit-imei-textarea');
    const badge = document.getElementById('edit-imei-badge');
    const errEl = document.getElementById('edit-imei-error');
    if (!area || !badge) return;

    const entered = parseImeis(area.value);
    const qty = currentEditingImportItem.qty;
    const count = entered.length;

    // Check duplicates
    const duplicates = entered.filter((item, index) => entered.indexOf(item) !== index);
    if (duplicates.length > 0) {
        if (errEl) {
            errEl.textContent = `⚠️ Cảnh báo: Trùng mã IMEI: ${[...new Set(duplicates)].join(', ')}`;
            errEl.classList.remove('hidden');
        }
    } else {
        if (errEl) errEl.classList.add('hidden');
    }

    if (count === qty) {
        badge.className =
            'px-2 py-0.5 rounded-md font-bold text-[11.5px] bg-emerald-100 text-emerald-700 border border-emerald-300';
        badge.textContent = `Đã nhập đủ: ${count} / ${qty} IMEI ✓`;
    } else if (count < qty) {
        badge.className =
            'px-2 py-0.5 rounded-md font-bold text-[11.5px] bg-purple-100 text-purple-700 border border-purple-200';
        badge.textContent = `Đã nhập: ${count} / ${qty} (Thiếu ${qty - count})`;
    } else {
        badge.className =
            'px-2 py-0.5 rounded-md font-bold text-[11.5px] bg-amber-100 text-amber-700 border border-amber-300';
        badge.textContent = `Đã nhập: ${count} / ${qty} (Thừa ${count - qty})`;
    }
}

function saveImportItemImeis() {
    if (!currentEditingImportItem) return;
    const area = document.getElementById('edit-imei-textarea');
    const entered = parseImeis(area?.value || '');
    const qty = currentEditingImportItem.qty;

    if (entered.length !== qty) {
        showToast(`Yêu cầu nhập đủ ${qty} mã IMEI! Hiện có ${entered.length} mã.`, 'error');
        return;
    }

    const uniqueSet = new Set(entered);
    if (uniqueSet.size !== entered.length) {
        showToast('Có mã IMEI bị trùng lặp trong danh sách! Vui lòng kiểm tra lại.', 'error');
        return;
    }

    currentEditingImportItem.hasImei = true;
    currentEditingImportItem.imeis = entered;
    renderImportItemsTable();
    closeImportItemImeiModal();
    showToast(`Đã cập nhật ${entered.length} mã IMEI cho sản phẩm!`, 'success');
}

function updateImportDebtCalc() {
    const subtotal = currentImportItems.reduce((a, c) => a + c.total, 0);
    const paidInput = document.getElementById('import-paid-input');
    const paid = paidInput ? parseVND(paidInput.value) || 0 : subtotal;
    const debt = Math.max(0, subtotal - paid);
    const debtEl = document.getElementById('import-debt-calc');
    if (debtEl) {
        debtEl.textContent = `${formatVND(debt)} đ`;
        debtEl.className = debt > 0 ? 'font-bold text-red-500' : 'font-medium text-gray-600';
    }
}

async function saveNewImport() {
    const receipt = await KVStore.command('import', {
        branch: getCurrentBranch(),
        supplierCode: document.getElementById('import-ncc-select').value,
        items: currentImportItems,
        paid: parseVND(document.getElementById('import-paid-input').value),
        paymentMethod: document.getElementById('import-payment-method').value,
        note: document.getElementById('import-note').value
    });
    currentImportItems = [];
    document.getElementById('create-import-modal').classList.add('hidden');
    renderAllViews();
    showToast(`Đã lưu phiếu nhập ${receipt.code}.`, 'success');
}

// --- 6. CUSTOMERS MANAGEMENT ---
function renderCustomers() {
    const tbody = document.getElementById('customers-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const q = (document.getElementById('customer-search-input')?.value || '').toLowerCase().trim();
    let list = KVStore.data.customers;
    if (q)
        list = list.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.phone.includes(q) ||
                c.code.toLowerCase().includes(q)
        );

    if (list.length === 0) {
        tbody.innerHTML = getEmptyStateRow(8, 'Không tìm thấy khách hàng phù hợp');
        const countEl = document.getElementById('customers-total-count');
        if (countEl) countEl.textContent = 'Hiển thị 0 khách hàng';
        return;
    }

    list.forEach((c) => {
        const tr = document.createElement('tr');
        tr.className = 'table-row-hover border-b border-gray-100/70 text-[13px] transition';
        tr.innerHTML = renderHTML`
            <td class="py-3 pl-3 pr-2 text-center"><input type="checkbox" class="kv-checkbox"></td>
            <td class="py-3 px-3 font-semibold text-[#0066cc] font-mono">${c.code}</td>
            <td class="py-3 px-3 font-medium text-gray-900 leading-snug">${c.name}</td>
            <td class="py-3 px-3 text-gray-600 font-mono">${c.phone}</td>
            <td class="py-3 px-3 text-gray-600 truncate max-w-[240px]">${c.address}</td>
            <td class="py-3 px-3 text-right font-medium text-gray-800 tabular-nums">${formatVND(c.totalSpent)}</td>
            <td class="py-3 px-3 text-right font-bold tabular-nums ${c.debt > 0 ? 'text-red-500' : 'text-gray-600'}">${formatVND(c.debt)}</td>
            <td class="py-3 pr-4 text-right space-x-1.5 whitespace-nowrap">
                ${trustedHTML(c.debt > 0 ? renderHTML`<button onclick="collectCustomerDebt('${c.code}')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-500 hover:text-white text-amber-700 rounded-lg text-[12px] font-medium transition shadow-2xs">Thu nợ</button>` : '')}
                <button onclick="editCustomer('${c.code}')" class="px-2.5 py-1 bg-blue-50 hover:bg-[#0066cc] text-[#0066cc] hover:text-white rounded-lg text-[12px] font-medium transition shadow-2xs">Sửa</button>
                ${trustedHTML(c.code !== 'KH0011' ? renderHTML`<button onclick="deleteCustomer('${c.code}')" class="px-2.5 py-1 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-[12px] font-medium transition shadow-2xs">Xóa</button>` : '')}
            </td>
        `;
        tbody.appendChild(tr);
    });

    const countEl = document.getElementById('customers-total-count');
    if (countEl) countEl.textContent = `Hiển thị ${list.length} khách hàng`;
}

let customerModalCallback = null;

function openAddCustomerModal(editCode = null, callback = null) {
    document.getElementById('cust-code').dataset.editCode = editCode || '';
    document.getElementById('cust-code').readOnly = !!editCode;
    customerModalCallback = callback;
    const modal = document.getElementById('customer-modal');
    if (!modal) return;
    const titleEl = document.getElementById('customer-modal-title');
    const form = document.getElementById('customer-form');
    form.reset();

    if (editCode) {
        titleEl.textContent = 'Chỉnh sửa Khách hàng';
        const c = KVStore.data.customers.find((item) => item.code === editCode);
        if (c) {
            document.getElementById('cust-code').value = c.code;
            document.getElementById('cust-name').value = c.name;
            document.getElementById('cust-phone').value = c.phone;
            document.getElementById('cust-address').value = c.address || '';
            document.getElementById('cust-debt').value = c.debt || 0;
            document.getElementById('cust-points').value = c.points || 0;
            document.getElementById('cust-note').value = c.note || '';
        }
    } else {
        titleEl.textContent = 'Thêm mới Khách hàng';
        const nextNum = KVStore.data.customers.length + 1;
        document.getElementById('cust-code').value = makeCode('KH');
        document.getElementById('cust-debt').value = '0';
        document.getElementById('cust-points').value = '0';
    }
    modal.classList.remove('hidden');
}

async function saveCustomerFromModal(e) {
    e.preventDefault();
    const code = document.getElementById('cust-code').value.trim();
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const debt = parseVND(document.getElementById('cust-debt').value) || 0;
    const points = parseInt(document.getElementById('cust-points').value, 10) || 0;
    const note = document.getElementById('cust-note')?.value.trim() || '';

    if (!code || !name) {
        showToast('Vui lòng nhập mã và tên khách hàng!', 'error');
        return;
    }

    const idx = KVStore.data.customers.findIndex((c) => c.code === code);
    if (idx >= 0 && !document.getElementById('cust-code').dataset.editCode)
        throw new Error('Mã khách hàng đã tồn tại.');
    let savedCustomer;
    if (idx >= 0) {
        KVStore.data.customers[idx] = {
            ...KVStore.data.customers[idx],
            name,
            phone,
            address,
            debt,
            points,
            note
        };
        savedCustomer = KVStore.data.customers[idx];
        showToast(`Đã cập nhật khách hàng ${name}!`, 'success');
    } else {
        savedCustomer = { id: code, code, name, phone, address, debt, points, totalSpent: 0, note };
        KVStore.data.customers.push(savedCustomer);
        showToast(`Đã thêm mới khách hàng ${name}!`, 'success');
    }

    await KVStore.save();
    renderCustomers();
    document.getElementById('customer-modal').classList.add('hidden');

    if (customerModalCallback) {
        customerModalCallback(savedCustomer);
        customerModalCallback = null;
    }
}

function editCustomer(code) {
    openAddCustomerModal(code);
}

async function deleteCustomer(code) {
    if (code === 'KH0011') {
        showToast('Không thể xóa khách hàng mặc định (Khách lẻ)!', 'error');
        return;
    }
    const c = KVStore.data.customers.find((item) => item.code === code);
    if (!c) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa khách hàng ${c.name} (${c.code})?`)) return;

    KVStore.data.customers = KVStore.data.customers.filter((item) => item.code !== code);
    await KVStore.save();
    renderCustomers();
    showToast(`Đã xóa khách hàng ${c.name}!`, 'success');
}

async function collectCustomerDebt(code) {
    const customer = KVStore.data.customers.find((c) => c.code === code);
    if (!customer) return;
    const value = prompt(
        `Thu nợ ${customer.name} (còn ${formatVND(customer.debt)} đ):`,
        customer.debt
    );
    if (value === null) return;
    await KVStore.command('debt', {
        type: 'thu',
        partnerId: customer.id,
        amount: parseVND(value),
        branch: getCurrentBranch(),
        method: 'cash'
    });
    renderAllViews();
    showToast('Đã lưu thu nợ.', 'success');
}

// --- 7. SUPPLIERS MANAGEMENT ---
let supplierModalCallback = null;

function renderSuppliers() {
    const tbody = document.getElementById('suppliers-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const q = (document.getElementById('supplier-search-input')?.value || '').toLowerCase().trim();
    let list = KVStore.data.suppliers;
    if (q) {
        list = list.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.code.toLowerCase().includes(q) ||
                (s.phone && s.phone.includes(q))
        );
    }

    if (list.length === 0) {
        tbody.innerHTML = getEmptyStateRow(8, 'Không tìm thấy nhà cung cấp phù hợp');
        const countEl = document.getElementById('suppliers-total-count');
        if (countEl) countEl.textContent = 'Hiển thị 0 nhà cung cấp';
        return;
    }

    list.forEach((s) => {
        const tr = document.createElement('tr');
        tr.className = 'table-row-hover border-b border-gray-100/70 text-[13px] transition';
        tr.innerHTML = renderHTML`
            <td class="py-3 pl-3 pr-2 text-center"><input type="checkbox" class="kv-checkbox"></td>
            <td class="py-3 px-3 font-semibold text-[#0066cc] font-mono">${s.code}</td>
            <td class="py-3 px-3 font-medium text-gray-900 leading-snug">${s.name}</td>
            <td class="py-3 px-3 text-gray-600 font-mono">${s.phone}</td>
            <td class="py-3 px-3 text-gray-600 truncate max-w-[240px]">${s.address || 'Chưa có'}</td>
            <td class="py-3 px-3 text-right font-medium text-gray-800 tabular-nums">${formatVND(s.totalBought || 0)}</td>
            <td class="py-3 px-3 text-right font-bold tabular-nums ${s.debt > 0 ? 'text-red-500' : 'text-gray-700'}">${formatVND(s.debt || 0)}</td>
            <td class="py-3 pr-4 text-right space-x-1.5 whitespace-nowrap">
                <button onclick="editSupplier('${s.code}')" class="px-2.5 py-1 bg-blue-50 hover:bg-[#0066cc] text-[#0066cc] hover:text-white rounded-lg text-[12px] font-medium transition shadow-2xs">Sửa</button>
                <button onclick="deleteSupplier('${s.code}')" class="px-2.5 py-1 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-[12px] font-medium transition shadow-2xs">Xóa</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const countEl = document.getElementById('suppliers-total-count');
    if (countEl) countEl.textContent = `Hiển thị ${list.length} nhà cung cấp`;
}

function openAddSupplierModal(editCode = null, callback = null) {
    document.getElementById('sup-code').dataset.editCode = editCode || '';
    document.getElementById('sup-code').readOnly = !!editCode;
    supplierModalCallback = callback;
    const modal = document.getElementById('supplier-modal');
    if (!modal) return;
    const titleEl = document.getElementById('supplier-modal-title');
    const form = document.getElementById('supplier-form');
    form.reset();

    if (editCode) {
        titleEl.textContent = 'Chỉnh sửa Nhà cung cấp';
        const s = KVStore.data.suppliers.find((item) => item.code === editCode);
        if (s) {
            document.getElementById('sup-code').value = s.code;
            document.getElementById('sup-name').value = s.name;
            document.getElementById('sup-phone').value = s.phone;
            document.getElementById('sup-address').value = s.address || '';
            document.getElementById('sup-debt').value = s.debt || 0;
            document.getElementById('sup-note').value = s.note || '';
        }
    } else {
        titleEl.textContent = 'Thêm mới Nhà cung cấp';
        const nextNum = KVStore.data.suppliers.length + 1;
        document.getElementById('sup-code').value = makeCode('NCC');
        document.getElementById('sup-debt').value = '0';
    }
    modal.classList.remove('hidden');
}

async function saveSupplierFromModal(e) {
    e.preventDefault();
    const code = document.getElementById('sup-code').value.trim();
    const name = document.getElementById('sup-name').value.trim();
    const phone = document.getElementById('sup-phone').value.trim();
    const address = document.getElementById('sup-address').value.trim();
    const debt = parseVND(document.getElementById('sup-debt').value);
    const note = document.getElementById('sup-note')?.value.trim() || '';

    if (!code || !name) {
        showToast('Vui lòng nhập mã và tên nhà cung cấp!', 'error');
        return;
    }

    const idx = KVStore.data.suppliers.findIndex((s) => s.code === code);
    if (idx >= 0 && !document.getElementById('sup-code').dataset.editCode)
        throw new Error('Mã nhà cung cấp đã tồn tại.');
    let savedSupplier;
    if (idx >= 0) {
        KVStore.data.suppliers[idx] = {
            ...KVStore.data.suppliers[idx],
            name,
            phone,
            address,
            debt,
            note
        };
        savedSupplier = KVStore.data.suppliers[idx];
        showToast(`Đã cập nhật nhà cung cấp ${name}!`, 'success');
    } else {
        savedSupplier = { id: code, code, name, phone, address, debt, totalBought: 0, note };
        KVStore.data.suppliers.push(savedSupplier);
        showToast(`Đã thêm mới nhà cung cấp ${name}!`, 'success');
    }

    await KVStore.save();
    renderSuppliers();
    document.getElementById('supplier-modal').classList.add('hidden');

    if (supplierModalCallback) {
        supplierModalCallback(savedSupplier);
        supplierModalCallback = null;
    }
}

function editSupplier(code) {
    openAddSupplierModal(code);
}

async function deleteSupplier(code) {
    if (confirm(`Bạn có chắc chắn muốn xóa nhà cung cấp ${code}?`)) {
        KVStore.data.suppliers = KVStore.data.suppliers.filter((s) => s.code !== code);
        await KVStore.save();
        renderSuppliers();
        showToast(`Đã xóa nhà cung cấp ${code}`, 'success');
    }
}

// --- 8. CASHBOOK SỔ QUỸ (QUỸ TIỀN MẶT & TÀI KHOẢN NGÂN HÀNG) ---
function renderCashbook() {
    const tbody = document.getElementById('cashbook-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const currentBranch = getCurrentBranch();
    const dateFilter = document.getElementById('cashbook-date-filter')?.value || 'all';
    const fundFilter = document.getElementById('cashbook-fund-filter')?.value || 'all';

    // Calculate branch balances by fund type
    const branchCashbook = (KVStore.data.cashbook || []).filter(
        (tx) => (tx.branch || 'Kalo HCM') === currentBranch
    );

    let cashThu = 0,
        cashChi = 0;
    let bankThu = 0,
        bankChi = 0;

    branchCashbook.forEach((tx) => {
        const isCash = (tx.method || '').toLowerCase().includes('tiền mặt');
        if (isCash) {
            if (tx.type === 'thu') cashThu += tx.amount;
            else cashChi += tx.amount;
        } else {
            // Chuyển khoản / Ngân hàng
            if (tx.type === 'thu') bankThu += tx.amount;
            else bankChi += tx.amount;
        }
    });

    const cashFund = cashThu - cashChi;
    const bankFund = bankThu - bankChi;
    const totalNetFund = cashFund + bankFund;

    // Filter list
    let list = branchCashbook;
    if (dateFilter !== 'all') {
        list = list.filter((tx) => matchesDateFilter(tx.time, dateFilter));
    }
    if (fundFilter === 'cash') {
        list = list.filter((tx) => (tx.method || '').toLowerCase().includes('tiền mặt'));
    } else if (fundFilter === 'bank') {
        list = list.filter((tx) => !(tx.method || '').toLowerCase().includes('tiền mặt'));
    }

    let periodThu = 0;
    let periodChi = 0;

    if (list.length === 0) {
        tbody.innerHTML = getEmptyStateRow(
            8,
            `Không có phiếu thu chi nào phù hợp tại ${currentBranch}`
        );
        const countEl = document.getElementById('cashbook-total-count');
        if (countEl) countEl.textContent = 'Hiển thị 0 phiếu thu chi';
    } else {
        list.forEach((tx) => {
            if (tx.type === 'thu') periodThu += tx.amount;
            else periodChi += tx.amount;

            const isCash = (tx.method || '').toLowerCase().includes('tiền mặt');
            const tr = document.createElement('tr');
            tr.className = 'table-row-hover border-b border-gray-100/70 text-[13px] transition';
            tr.innerHTML = renderHTML`
                <td class="py-3 pl-3 pr-2 text-center"><input type="checkbox" class="kv-checkbox"></td>
                <td class="py-3 px-3 font-semibold text-[#0066cc] font-mono">${tx.code}</td>
                <td class="py-3 px-3 text-gray-600 font-mono text-[12px]">${tx.time}</td>
                <td class="py-3 px-3 text-center font-medium">
                    <span class="kv-badge ${tx.type === 'thu' ? 'kv-badge-success' : 'kv-badge-danger'}">
                        ${tx.type === 'thu' ? 'Thu' : 'Chi'} - ${tx.category}
                    </span>
                </td>
                <td class="py-3 px-3 text-gray-800 font-medium">${tx.person}</td>
                <td class="py-3 px-3 text-center">
                    <span class="kv-badge ${isCash ? 'kv-badge-warning' : 'kv-badge-info'}">
                        ${isCash ? '💵 Tiền mặt' : '💳 Chuyển khoản'}
                    </span>
                </td>
                <td class="py-3 px-3 text-right font-bold tabular-nums ${tx.type === 'thu' ? 'text-emerald-600' : 'text-red-500'}">
                    ${tx.type === 'thu' ? '+' : '-'}${formatVND(tx.amount)}
                </td>
                <td class="py-3 pl-3 pr-4 text-gray-600 text-[12.5px] truncate max-w-[260px]">${tx.note || ''}</td>
            `;
            tbody.appendChild(tr);
        });
        const countEl = document.getElementById('cashbook-total-count');
        if (countEl) countEl.textContent = `Hiển thị ${list.length} phiếu thu chi`;
    }

    const netEl = document.getElementById('cashbook-net-fund');
    if (netEl) netEl.textContent = `${formatVND(totalNetFund)} đ`;
    const cashEl = document.getElementById('cashbook-cash-fund');
    if (cashEl) cashEl.textContent = `${formatVND(cashFund)} đ`;
    const bankEl = document.getElementById('cashbook-bank-fund');
    if (bankEl) bankEl.textContent = `${formatVND(bankFund)} đ`;
    const thuEl = document.getElementById('cashbook-total-thu');
    if (thuEl) thuEl.textContent = `${formatVND(periodThu)} đ`;
    const chiEl = document.getElementById('cashbook-total-chi');
    if (chiEl) chiEl.textContent = `${formatVND(periodChi)} đ`;
    const countEl = document.getElementById('cashbook-total-count');
    if (countEl) countEl.textContent = `Hiển thị ${list.length} phiếu thu chi`;
}

// --- TẠO PHIẾU THU (RECEIPT) ---
function openCreateReceiptModal() {
    const modal = document.getElementById('create-receipt-modal');
    if (!modal) return;
    const currentBranch = getCurrentBranch();
    const count = (KVStore.data.cashbook || []).filter((c) => c.type === 'thu').length;
    document.getElementById('rec-code').value = makeCode('PT');
    document.getElementById('rec-time').value = getCurrentDateTimeString();
    document.getElementById('rec-method').value = 'Tiền mặt';
    document.getElementById('rec-category').value = 'Thu nợ khách hàng';
    document.getElementById('rec-amount').value = '';
    document.getElementById('rec-note').value = '';

    const custSelect = document.getElementById('rec-customer-select');
    if (custSelect) {
        custSelect.innerHTML =
            trustedHTML('<option value="">-- Chọn khách hàng có công nợ --</option>') +
            (KVStore.data.customers || [])
                .map(
                    (c) =>
                        renderHTML`<option value="${c.code}" data-debt="${c.debt || 0}" data-name="${c.name}">${c.name} (${c.code}) - Nợ: ${formatVND(c.debt || 0)} đ</option>`
                )
                .join('');
    }
    document.getElementById('rec-person').value = '';
    handleReceiptCategoryChange();
    modal.classList.remove('hidden');
}

function handleReceiptCategoryChange() {
    const cat = document.getElementById('rec-category')?.value;
    const wrapper = document.getElementById('rec-person-select-wrapper');
    if (wrapper) {
        if (cat === 'Thu nợ khách hàng') {
            wrapper.classList.remove('hidden');
        } else {
            wrapper.classList.add('hidden');
        }
    }
}

function handleReceiptCustomerSelect(code) {
    const select = document.getElementById('rec-customer-select');
    const opt = select?.selectedOptions[0];
    if (opt && opt.value) {
        const name = opt.getAttribute('data-name') || '';
        const debt = Number(opt.getAttribute('data-debt')) || 0;
        document.getElementById('rec-person').value = name;
        if (debt > 0) {
            document.getElementById('rec-amount').value = debt;
        }
    }
}

async function saveNewReceipt(e) {
    e.preventDefault();
    const category = document.getElementById('rec-category').value,
        method = document.getElementById('rec-method').value;
    const payload = {
        type: 'thu',
        branch: getCurrentBranch(),
        category,
        person: document.getElementById('rec-person').value,
        amount: Number(document.getElementById('rec-amount').value),
        method: method === 'Tiền mặt' ? 'cash' : method === 'Thẻ' ? 'card' : 'transfer',
        note: document.getElementById('rec-note').value
    };
    const debt = category === 'Thu nợ khách hàng' || category === 'Chi trả nợ NCC';
    if (debt) payload.partnerId = document.getElementById('rec-customer-select').value;
    await KVStore.command(debt ? 'debt' : 'cash', payload);
    document.getElementById('create-receipt-modal').classList.add('hidden');
    renderAllViews();
    showToast('Đã lưu phiếu.', 'success');
}

// --- TẠO PHIẾU CHI (PAYMENT) ---
function openCreatePaymentModal() {
    const modal = document.getElementById('create-payment-modal');
    if (!modal) return;
    const currentBranch = getCurrentBranch();
    const count = (KVStore.data.cashbook || []).filter((c) => c.type === 'chi').length;
    document.getElementById('pay-code').value = makeCode('PC');
    document.getElementById('pay-time').value = getCurrentDateTimeString();
    document.getElementById('pay-method').value = 'Tiền mặt';
    document.getElementById('pay-category').value = 'Chi trả nợ NCC';
    document.getElementById('pay-amount').value = '';
    document.getElementById('pay-note').value = '';

    const supSelect = document.getElementById('pay-supplier-select');
    if (supSelect) {
        supSelect.innerHTML =
            trustedHTML('<option value="">-- Chọn nhà cung cấp có công nợ --</option>') +
            (KVStore.data.suppliers || [])
                .map(
                    (s) =>
                        renderHTML`<option value="${s.code}" data-debt="${s.debt || 0}" data-name="${s.name}">${s.name} (${s.code}) - Nợ: ${formatVND(s.debt || 0)} đ</option>`
                )
                .join('');
    }
    document.getElementById('pay-person').value = '';
    handlePaymentCategoryChange();
    modal.classList.remove('hidden');
}

function handlePaymentCategoryChange() {
    const cat = document.getElementById('pay-category')?.value;
    const wrapper = document.getElementById('pay-person-select-wrapper');
    if (wrapper) {
        if (cat === 'Chi trả nợ NCC') {
            wrapper.classList.remove('hidden');
        } else {
            wrapper.classList.add('hidden');
        }
    }
}

function handlePaymentSupplierSelect(code) {
    const select = document.getElementById('pay-supplier-select');
    const opt = select?.selectedOptions[0];
    if (opt && opt.value) {
        const name = opt.getAttribute('data-name') || '';
        const debt = Number(opt.getAttribute('data-debt')) || 0;
        document.getElementById('pay-person').value = name;
        if (debt > 0) {
            document.getElementById('pay-amount').value = debt;
        }
    }
}

async function saveNewPayment(e) {
    e.preventDefault();
    const category = document.getElementById('pay-category').value,
        method = document.getElementById('pay-method').value;
    const payload = {
        type: 'chi',
        branch: getCurrentBranch(),
        category,
        person: document.getElementById('pay-person').value,
        amount: Number(document.getElementById('pay-amount').value),
        method: method === 'Tiền mặt' ? 'cash' : method === 'Thẻ' ? 'card' : 'transfer',
        note: document.getElementById('pay-note').value
    };
    const debt = category === 'Thu nợ khách hàng' || category === 'Chi trả nợ NCC';
    if (debt) payload.partnerId = document.getElementById('pay-supplier-select').value;
    await KVStore.command(debt ? 'debt' : 'cash', payload);
    document.getElementById('create-payment-modal').classList.add('hidden');
    renderAllViews();
    showToast('Đã lưu phiếu.', 'success');
}

// --- 9. REPORTS CONTROLLER & ANALYTICS ---
let currentReportTab = 'sales';

function switchReportTab(tab) {
    currentReportTab = tab;
    ['sales', 'products', 'cashflow', 'inventory'].forEach((t) => {
        const btn = document.getElementById(`rep-tab-${t}`);
        if (!btn) return;
        if (t === tab) {
            btn.className =
                'rep-tab-btn px-3 py-1 rounded-xl transition-all shadow-xs bg-white text-[#0066cc] font-bold';
        } else {
            btn.className =
                'rep-tab-btn px-3 py-1 rounded-xl transition-all text-gray-700 hover:text-gray-900 font-semibold';
        }
    });

    const searchInput = document.getElementById('rep-table-search');
    if (searchInput) searchInput.value = '';

    renderReports();
}

function updateKpiCard(index, icon, label, val, subHtml, iconClasses) {
    const iconEl = document.getElementById(`rep-kpi-icon-${index}`);
    const labelEl = document.getElementById(`rep-kpi-label-${index}`);
    const subEl = document.getElementById(`rep-kpi-sub-${index}`);

    if (iconEl) {
        iconEl.textContent = icon;
        if (iconClasses)
            iconEl.className = `w-11 h-11 rounded-xl border border-current/20 flex items-center justify-center font-bold text-[18px] flex-shrink-0 shadow-xs ${iconClasses}`;
    }
    if (labelEl) labelEl.textContent = label;
    if (subEl) subEl.innerHTML = subHtml;

    if (index === 1) {
        const el = document.getElementById('rep-total-revenue');
        if (el) el.textContent = val;
    } else if (index === 2) {
        const el = document.getElementById('rep-gross-profit');
        if (el) el.textContent = val;
    } else if (index === 3) {
        const el = document.getElementById('rep-kpi-val-3');
        if (el) el.textContent = val;
    } else if (index === 4) {
        const el = document.getElementById('rep-inventory-val');
        if (el) el.textContent = val;
    }
}

function renderDualBarChart(containerId, items, label1, color1, label2, color2) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!items || items.length === 0) {
        container.innerHTML = renderHTML`
            <div class="h-full w-full flex flex-col items-center justify-center text-gray-400 py-6">
                <span class="text-3xl mb-1">📊</span>
                <span class="text-[12px] font-medium">Chưa có dữ liệu giao dịch trong khoảng thời gian này</span>
            </div>
        `;
        return;
    }

    const maxVal = Math.max(
        ...items.map((it) => Math.max(Math.abs(it.val1 || 0), Math.abs(it.val2 || 0))),
        1000000
    );

    container.innerHTML = items
        .map((it) => {
            const h1 = Math.max(
                6,
                Math.min(100, Math.round((Math.abs(it.val1 || 0) / maxVal) * 100))
            );
            const h2 =
                it.val2 == null
                    ? 0
                    : Math.max(
                          6,
                          Math.min(100, Math.round((Math.abs(it.val2 || 0) / maxVal) * 100))
                      );
            return renderHTML`
            <div class="flex-1 flex flex-col items-center h-full justify-end group min-w-[42px] max-w-[70px] relative cursor-pointer" title="${it.fullName || it.label}\n${label1}: ${formatVND(it.val1)} đ\n${label2}: ${it.val2 == null ? 'Thiếu giá vốn lịch sử' : formatVND(it.val2) + ' đ'}">
                <div class="w-full flex items-end justify-center space-x-1.5 h-[132px] pb-1">
                    <div style="height: ${h1}%;" class="w-3.5 sm:w-4 rounded-t-md transition-all duration-300 group-hover:brightness-110 shadow-xs ${color1}"></div>
                    <div style="height: ${h2}%;" class="w-3.5 sm:w-4 rounded-t-md transition-all duration-300 group-hover:brightness-110 shadow-xs ${color2}"></div>
                </div>
                <div class="text-[10.5px] font-semibold text-gray-500 group-hover:text-[#0066cc] truncate max-w-full text-center tracking-tighter pt-1 border-t border-gray-100 w-full" title="${it.fullName || it.label}">${it.label}</div>
            </div>
        `;
        })
        .join('');
}

function renderSingleBarChart(containerId, items, barColor) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!items || items.length === 0) {
        container.innerHTML = renderHTML`
            <div class="h-full w-full flex flex-col items-center justify-center text-gray-400 py-6">
                <span class="text-3xl mb-1">📦</span>
                <span class="text-[12px] font-medium">Chưa có phát sinh số liệu</span>
            </div>
        `;
        return;
    }

    const maxVal = Math.max(...items.map((it) => it.value || 0), 1000000);

    container.innerHTML = items
        .map((it) => {
            const h = Math.max(8, Math.min(100, Math.round(((it.value || 0) / maxVal) * 100)));
            return renderHTML`
            <div class="flex-1 flex flex-col items-center h-full justify-end group min-w-[50px] max-w-[85px] relative cursor-pointer" title="${it.fullName || it.label}\n${it.subLabel || ''}\n${formatVND(it.value)} đ">
                <div class="w-full flex items-end justify-center h-[132px] pb-1">
                    <div style="height: ${h}%;" class="w-6 sm:w-8 rounded-t-lg transition-all duration-300 group-hover:brightness-110 shadow-xs ${barColor || 'bg-[#0066cc]'}"></div>
                </div>
                <div class="text-[10.5px] font-semibold text-gray-600 group-hover:text-[#0066cc] truncate max-w-full text-center tracking-tight pt-1 border-t border-gray-100 w-full" title="${it.fullName || it.label}">${it.label}</div>
            </div>
        `;
        })
        .join('');
}

function renderBreakdownBars(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!items || items.length === 0) {
        container.innerHTML = renderHTML`
            <div class="h-full w-full flex flex-col items-center justify-center text-gray-400 py-4">
                <span class="text-2xl mb-1">🍩</span>
                <span class="text-[11.5px] font-medium">Chưa có dữ liệu cơ cấu</span>
            </div>
        `;
        return;
    }

    const total = items.reduce((a, b) => a + (b.value || 0), 0) || 1;

    container.innerHTML = items
        .map((it) => {
            const pct = Math.min(100, Math.round(((it.value || 0) / total) * 100));
            return renderHTML`
            <div class="space-y-1">
                <div class="flex items-center justify-between text-[11.5px]">
                    <span class="font-medium text-gray-700 truncate pr-2 flex items-center space-x-1.5">
                        <span class="w-2 h-2 rounded-full ${it.dotClass || 'bg-blue-500'}"></span>
                        <span class="truncate">${it.label}</span>
                    </span>
                    <span class="font-bold text-gray-900 tabular-nums flex-shrink-0">${formatVND(it.value)} đ <span class="text-gray-400 font-normal">(${pct}%)</span></span>
                </div>
                <div class="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div style="width: ${pct}%;" class="h-full rounded-full transition-all duration-500 ${it.barClass || 'bg-[#0066cc]'}"></div>
                </div>
            </div>
        `;
        })
        .join('');
}

function filterReportTable() {
    const query = (document.getElementById('rep-table-search')?.value || '').toLowerCase().trim();
    const tbody = document.getElementById('rep-table-tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    let visibleCount = 0;
    rows.forEach((r) => {
        const text = r.textContent.toLowerCase();
        if (!query || text.includes(query)) {
            r.style.display = '';
            visibleCount++;
        } else {
            r.style.display = 'none';
        }
    });
    const badge = document.getElementById('rep-table-badge');
    if (badge) {
        badge.textContent = `${visibleCount}/${rows.length} dòng`;
    }
}

function exportCurrentReport() {
    const thead = document.getElementById('rep-table-thead');
    const tbody = document.getElementById('rep-table-tbody');
    if (!thead || !tbody) return;

    const headers = Array.from(thead.querySelectorAll('th')).map(
        (th) => `"${th.innerText.replace(/"/g, '""').trim()}"`
    );
    const rows = Array.from(tbody.querySelectorAll('tr')).filter((r) => r.style.display !== 'none');

    if (rows.length === 0) {
        showToast('Không có dữ liệu nào để xuất!', 'warning');
        return;
    }

    const csvRows = [headers.join(',')];
    rows.forEach((r) => {
        const cols = Array.from(r.querySelectorAll('td')).map((td) => {
            const txt = td.innerText.replace(/"/g, '""').replace(/\n/g, ' ').trim();
            return `"${txt}"`;
        });
        csvRows.push(cols.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `BaoCao_${currentReportTab}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Đã xuất báo cáo ra file Excel (.csv) thành công!', 'success');
}

function printCurrentReport() {
    printRegion('view-reports', false);
}

function renderReports() {
    const data = KVStore.data;
    const currentBranch = getCurrentBranch();
    const branchProducts = (data.products || []).filter(
        (p) => (p.branch || 'Kalo HCM') === currentBranch
    );

    const repBranchEl = document.getElementById('rep-branch-name');
    if (repBranchEl) repBranchEl.textContent = currentBranch;

    const dateFilter = document.getElementById('rep-date-filter')?.value || 'this_month';

    if (currentReportTab === 'sales') {
        renderSalesReportTab(data, currentBranch, branchProducts, dateFilter);
    } else if (currentReportTab === 'products') {
        renderProductsReportTab(data, currentBranch, branchProducts, dateFilter);
    } else if (currentReportTab === 'cashflow') {
        renderCashflowReportTab(data, currentBranch, branchProducts, dateFilter);
    } else if (currentReportTab === 'inventory') {
        renderInventoryReportTab(data, currentBranch, branchProducts, dateFilter);
    }

    filterReportTable();
}

function renderSalesReportTab(data, currentBranch, branchProducts, dateFilter) {
    const branchInvoices = (data.invoices || []).filter(
        (i) =>
            (i.branch || 'Kalo HCM') === currentBranch &&
            (i.status !== 'cancelled' || i.bookingVersion === 2)
    );
    const validInvoices = branchInvoices.filter((i) => matchesDateFilter(i.time, dateFilter));

    const branchReturns = (data.returns || []).filter(
        (r) =>
            (r.branch || 'Kalo HCM') === currentBranch &&
            !data.invoices.some(
                (i) =>
                    i.code === r.invoiceCode && i.status === 'cancelled' && i.bookingVersion !== 2
            )
    );
    const validReturns = branchReturns.filter((r) => matchesDateFilter(r.time, dateFilter));

    const grossRevenue = validInvoices.reduce((a, c) => a + (c.total || 0), 0);
    const totalReturns = validReturns.reduce(
        (a, c) => a + (c.returnValue ?? c.totalRefund ?? 0),
        0
    );
    const netRevenue = grossRevenue - totalReturns;

    let totalCost = 0;
    validInvoices.forEach((inv) => {
        (inv.items || []).forEach((item) => {
            const p = branchProducts.find((x) => x.code === item.code);
            totalCost += (item.costPrice ?? 0) * item.qty;
        });
    });
    validReturns.forEach((ret) =>
        (ret.items || []).forEach((item) => {
            totalCost -= (item.costPrice ?? 0) * item.qty;
        })
    );
    const unknownCost =
        validInvoices.some((inv) => inv.items.some((item) => item.costPrice == null)) ||
        validReturns.some((ret) => ret.items.some((item) => item.costPrice == null));
    const grossProfit = netRevenue - totalCost;
    const margin = netRevenue > 0 ? ((grossProfit / netRevenue) * 100).toFixed(1) : '0.0';
    const invoicesCount = validInvoices.length;
    const aov = invoicesCount > 0 ? Math.round(grossRevenue / invoicesCount) : 0;
    const returnsCount = validReturns.length;

    // 1. KPI Cards
    updateKpiCard(
        1,
        '₫',
        'Doanh thu thuần',
        `${formatVND(netRevenue)} đ`,
        renderHTML`<span class="text-emerald-600 font-semibold">Đã trừ trả hàng (${formatVND(totalReturns)} đ)</span>`,
        'bg-blue-500/15 text-[#0066cc]'
    );
    updateKpiCard(
        2,
        '📈',
        'Lợi nhuận gộp',
        unknownCost ? 'Thiếu giá vốn lịch sử' : `${formatVND(grossProfit)} đ`,
        renderHTML`Tỷ suất: <span id="rep-margin" class="font-bold text-[#0066cc]">${unknownCost ? '—' : margin + '%'}</span>`,
        'bg-emerald-500/15 text-emerald-600'
    );
    updateKpiCard(
        3,
        '🧾',
        'Số lượng hóa đơn',
        `${invoicesCount} đơn`,
        renderHTML`TB đơn (AOV): <span id="rep-kpi-aov-sub" class="font-bold text-gray-700">${formatVND(aov)} đ</span>`,
        'bg-indigo-500/15 text-indigo-600'
    );
    updateKpiCard(
        4,
        '↩️',
        'Tổng giá trị trả hàng',
        `${formatVND(totalReturns)} đ`,
        renderHTML`<span class="font-semibold text-gray-800">${returnsCount}</span> phiếu trả hàng`,
        'bg-rose-500/15 text-rose-600'
    );

    // 2. Chart Titles & Legends
    const mainTitleEl = document.getElementById('rep-main-chart-title');
    if (mainTitleEl) mainTitleEl.textContent = 'Xu hướng Doanh thu & Lợi nhuận';
    const mainLegendEl = document.getElementById('rep-main-chart-legend');
    if (mainLegendEl) {
        mainLegendEl.innerHTML = renderHTML`
            <span class="inline-flex items-center space-x-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[#0066cc]"></span><span>Doanh thu</span></span>
            <span class="inline-flex items-center space-x-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span><span>Lợi nhuận</span></span>
        `;
    }

    const sideTitleEl = document.getElementById('rep-side-chart-title');
    if (sideTitleEl) sideTitleEl.textContent = 'Phương thức thanh toán';
    const sideBadgeEl = document.getElementById('rep-side-chart-badge');
    if (sideBadgeEl) sideBadgeEl.textContent = 'Tỷ trọng';

    // 3. Main Chart Data (Group by date)
    const dayMap = Object.create(null);
    validInvoices.forEach((inv) => {
        const d = parseRecordDate(inv.time);
        const dayKey = d
            ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
            : 'Khác';
        if (!dayMap[dayKey]) {
            dayMap[dayKey] = {
                dayKey,
                dateObj: d || new Date(0),
                gross: 0,
                cost: 0,
                returns: 0,
                count: 0,
                unknownCost: false
            };
        }
        dayMap[dayKey].gross += inv.total || 0;
        dayMap[dayKey].count += 1;
        (inv.items || []).forEach((item) => {
            const p = branchProducts.find((x) => x.code === item.code);
            dayMap[dayKey].cost += (item.costPrice ?? 0) * item.qty;
            dayMap[dayKey].unknownCost ||= item.costPrice == null;
        });
    });

    validReturns.forEach((ret) => {
        const d = parseRecordDate(ret.time);
        const dayKey = d
            ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
            : 'Khác';
        if (!dayMap[dayKey]) {
            dayMap[dayKey] = {
                dayKey,
                dateObj: d || new Date(0),
                gross: 0,
                cost: 0,
                returns: 0,
                count: 0,
                unknownCost: false
            };
        }
        dayMap[dayKey].returns += ret.returnValue ?? ret.totalRefund ?? 0;
        (ret.items || []).forEach((item) => {
            dayMap[dayKey].cost -= (item.costPrice ?? 0) * item.qty;
            dayMap[dayKey].unknownCost ||= item.costPrice == null;
        });
    });

    const daysSorted = Object.values(dayMap).sort((a, b) => a.dateObj - b.dateObj);
    const chartItems = daysSorted.map((d) => {
        const net = d.gross - d.returns;
        const profit = net - d.cost;
        return {
            label: d.dayKey.slice(0, 5),
            fullName: d.dayKey,
            val1: net,
            val2: d.unknownCost ? null : profit
        };
    });
    renderDualBarChart(
        'rep-main-chart-container',
        chartItems,
        'Doanh thu thuần',
        'bg-[#0066cc]',
        'Lợi nhuận',
        'bg-emerald-500'
    );

    // 4. Side Chart: Payment breakdown
    const methods = { cash: 0, transfer: 0, card: 0, unknown: 0 };
    let debtTotal = 0;
    validInvoices.forEach((inv) => {
        debtTotal += Math.max(0, inv.total - (inv.returnedTotal || 0) - inv.paid);
        const payments = inv.payments || [
            { amount: inv.paid, method: inv.paymentMethod || 'unknown' }
        ];
        payments.forEach((p) => {
            methods[Object.hasOwn(methods, p.method) ? p.method : 'unknown'] += p.amount;
        });
    });
    renderBreakdownBars('rep-breakdown-container', [
        {
            label: 'Chuyển khoản (VietQR)',
            value: methods.transfer,
            dotClass: 'bg-[#0066cc]',
            barClass: 'bg-[#0066cc]'
        },
        {
            label: 'Tiền mặt',
            value: methods.cash,
            dotClass: 'bg-emerald-500',
            barClass: 'bg-emerald-500'
        },
        { label: 'Thẻ', value: methods.card, dotClass: 'bg-indigo-500', barClass: 'bg-indigo-500' },
        {
            label: 'Chưa rõ phương thức (dữ liệu cũ)',
            value: methods.unknown,
            dotClass: 'bg-gray-500',
            barClass: 'bg-gray-500'
        },
        {
            label: 'Khách nợ / Chưa trả',
            value: debtTotal,
            dotClass: 'bg-amber-500',
            barClass: 'bg-amber-500'
        }
    ]);

    // 5. Table Rendering
    const tableTitleEl = document.getElementById('rep-table-title');
    if (tableTitleEl) tableTitleEl.textContent = 'Chi tiết Doanh thu theo từng ngày';

    const thead = document.getElementById('rep-table-thead');
    if (thead) {
        thead.innerHTML = renderHTML`
            <tr class="bg-gray-100/80 text-gray-700 font-bold border-b border-gray-200">
                <th class="py-2.5 px-3">Ngày ghi nhận</th>
                <th class="py-2.5 px-3 text-center">Số hóa đơn</th>
                <th class="py-2.5 px-3 text-right">Doanh thu bán</th>
                <th class="py-2.5 px-3 text-right">Tiền trả lại</th>
                <th class="py-2.5 px-3 text-right">Doanh thu thuần</th>
                <th class="py-2.5 px-3 text-right">Tiền vốn</th>
                <th class="py-2.5 px-3 text-right">Lợi nhuận gộp</th>
                <th class="py-2.5 px-3 text-right">Tỷ suất LN</th>
            </tr>
        `;
    }

    const daysDesc = [...daysSorted].reverse();
    const tbody = document.getElementById('rep-table-tbody');
    if (tbody) {
        tbody.innerHTML = daysDesc
            .map((d) => {
                const net = d.gross - d.returns;
                const profit = net - d.cost;
                const rate = net > 0 ? ((profit / net) * 100).toFixed(1) : '0.0';
                return renderHTML`
                <tr class="hover:bg-blue-50/40 transition-colors">
                    <td class="py-2.5 px-3 font-semibold text-gray-900 font-mono">${d.dayKey}</td>
                    <td class="py-2.5 px-3 text-center font-bold text-gray-700">${d.count}</td>
                    <td class="py-2.5 px-3 text-right font-medium text-gray-800 tabular-nums">${formatVND(d.gross)} đ</td>
                    <td class="py-2.5 px-3 text-right font-medium text-rose-600 tabular-nums">${d.returns > 0 ? '-' + formatVND(d.returns) + ' đ' : '0 đ'}</td>
                    <td class="py-2.5 px-3 text-right font-bold text-[#0066cc] tabular-nums">${formatVND(net)} đ</td>
                    <td class="py-2.5 px-3 text-right font-medium text-gray-600 tabular-nums">${d.unknownCost ? 'Thiếu giá vốn' : formatVND(d.cost) + ' đ'}</td>
                    <td class="py-2.5 px-3 text-right font-bold text-emerald-600 tabular-nums">${d.unknownCost ? 'Chưa xác định' : formatVND(profit) + ' đ'}</td>
                    <td class="py-2.5 px-3 text-right font-bold tabular-nums ${parseFloat(rate) >= 20 ? 'text-emerald-600' : 'text-amber-600'}">${d.unknownCost ? '—' : rate + '%'}</td>
                </tr>
            `;
            })
            .join('');
    }

    const tableBadgeEl = document.getElementById('rep-table-badge');
    if (tableBadgeEl) tableBadgeEl.textContent = `${daysDesc.length} ngày`;

    const footer = document.getElementById('rep-table-footer');
    if (footer) {
        footer.innerHTML = renderHTML`
            <div class="flex items-center space-x-4">
                <span>Tổng cộng: <strong class="text-gray-900">${invoicesCount}</strong> đơn hàng</span>
                <span>Doanh thu bán: <strong class="text-gray-900">${formatVND(grossRevenue)} đ</strong></span>
            </div>
            <div class="flex items-center space-x-4">
                <span>DT thuần: <strong class="text-[#0066cc]">${formatVND(netRevenue)} đ</strong></span>
                <span>Lợi nhuận gộp: <strong class="text-emerald-600">${unknownCost ? 'Thiếu giá vốn lịch sử' : formatVND(grossProfit) + ' đ'}</strong></span>
                <span>Tỷ suất TB: <strong class="text-gray-900">${unknownCost ? '—' : margin + '%'}</strong></span>
            </div>
        `;
    }
}

function renderProductsReportTab(data, currentBranch, branchProducts, dateFilter) {
    const branchInvoices = (data.invoices || []).filter(
        (i) =>
            (i.branch || 'Kalo HCM') === currentBranch &&
            (i.status !== 'cancelled' || i.bookingVersion === 2)
    );
    const validInvoices = branchInvoices.filter((i) => matchesDateFilter(i.time, dateFilter));

    const prodMap = Object.create(null);
    validInvoices.forEach((inv) => {
        (inv.items || []).forEach((it) => {
            if (!prodMap[it.code]) {
                const p = branchProducts.find((x) => x.code === it.code);
                prodMap[it.code] = {
                    code: it.code,
                    name: it.name,
                    category: p?.category || 'Chung',
                    costPrice: it.costPrice ?? 0,
                    totalCost: 0,
                    unknownCost: false,
                    stock: p ? p.stock || 0 : 0,
                    minStock: p ? p.minStock || 0 : 0,
                    qty: 0,
                    revenue: 0
                };
            }
            prodMap[it.code].qty += it.qty || 1;
            prodMap[it.code].revenue += invoiceLineNet(inv, it);
            prodMap[it.code].totalCost += (it.costPrice ?? 0) * it.qty;
            prodMap[it.code].unknownCost ||= it.costPrice == null;
        });
    });

    (data.returns || [])
        .filter(
            (r) =>
                r.branch === currentBranch &&
                matchesDateFilter(r.time, dateFilter) &&
                !data.invoices.some(
                    (i) =>
                        i.code === r.invoiceCode &&
                        i.status === 'cancelled' &&
                        i.bookingVersion !== 2
                )
        )
        .forEach((r) =>
            (r.items || []).forEach((it) => {
                if (!prodMap[it.code])
                    prodMap[it.code] = {
                        code: it.code,
                        name: it.name,
                        category: '',
                        stock: 0,
                        minStock: 0,
                        qty: 0,
                        revenue: 0,
                        totalCost: 0,
                        unknownCost: false
                    };
                const p = prodMap[it.code];
                p.qty -= it.qty;
                p.revenue -= it.total;
                p.totalCost -= (it.costPrice ?? 0) * it.qty;
                p.unknownCost ||= it.costPrice == null;
            })
        );
    const prodList = Object.values(prodMap)
        .map((p) => {
            const totalCost = p.totalCost;
            const profit = p.revenue - totalCost;
            const margin = p.revenue > 0 ? ((profit / p.revenue) * 100).toFixed(1) : '0.0';
            return { ...p, totalCost, profit, margin };
        })
        .sort((a, b) => b.revenue - a.revenue);

    const totalQtySold = prodList.reduce((a, b) => a + b.qty, 0);
    const totalProdRev = prodList.reduce((a, b) => a + b.revenue, 0);
    const totalProdProfit = prodList.reduce((a, b) => a + b.profit, 0);
    const avgPrice = totalQtySold > 0 ? Math.round(totalProdRev / totalQtySold) : 0;
    const avgMargin =
        totalProdRev > 0 ? ((totalProdProfit / totalProdRev) * 100).toFixed(1) : '0.0';
    const topProd = prodList[0];

    // 1. KPI Cards
    updateKpiCard(
        1,
        '🛍️',
        'Tổng sản phẩm đã bán',
        `${totalQtySold} SP`,
        renderHTML`Từ <span class="font-semibold text-gray-800">${validInvoices.length}</span> hóa đơn bán`,
        'bg-blue-500/15 text-[#0066cc]'
    );
    updateKpiCard(
        2,
        '₫',
        'Doanh thu sản phẩm',
        `${formatVND(totalProdRev)} đ`,
        renderHTML`Đơn giá TB: <span class="font-semibold text-gray-800">${formatVND(avgPrice)} đ/SP</span>`,
        'bg-emerald-500/15 text-emerald-600'
    );
    updateKpiCard(
        3,
        '💰',
        'Lợi nhuận hàng hóa',
        prodList.some((p) => p.unknownCost)
            ? 'Thiếu giá vốn lịch sử'
            : `${formatVND(totalProdProfit)} đ`,
        renderHTML`Tỷ suất TB: <span id="rep-margin" class="font-bold text-[#0066cc]">${prodList.some((p) => p.unknownCost) ? '—' : avgMargin + '%'}</span>`,
        'bg-indigo-500/15 text-indigo-600'
    );
    updateKpiCard(
        4,
        '🏆',
        'Mặt hàng dẫn đầu',
        topProd
            ? topProd.name.length > 20
                ? topProd.name.slice(0, 18) + '...'
                : topProd.name
            : 'Chưa có',
        topProd
            ? renderHTML`<span class="font-semibold text-[#0066cc]">${topProd.qty} SP</span> (${formatVND(topProd.revenue)} đ)`
            : 'Chưa phát sinh',
        'bg-amber-500/15 text-amber-600'
    );

    // 2. Chart Titles & Legends
    const mainTitleEl = document.getElementById('rep-main-chart-title');
    if (mainTitleEl) mainTitleEl.textContent = 'Top 5 sản phẩm doanh thu & lợi nhuận cao nhất';
    const mainLegendEl = document.getElementById('rep-main-chart-legend');
    if (mainLegendEl) {
        mainLegendEl.innerHTML = renderHTML`
            <span class="inline-flex items-center space-x-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[#0066cc]"></span><span>Doanh thu</span></span>
            <span class="inline-flex items-center space-x-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span><span>Lợi nhuận</span></span>
        `;
    }

    const sideTitleEl = document.getElementById('rep-side-chart-title');
    if (sideTitleEl) sideTitleEl.textContent = 'Doanh thu theo Nhóm hàng';
    const sideBadgeEl = document.getElementById('rep-side-chart-badge');
    if (sideBadgeEl) sideBadgeEl.textContent = 'Danh mục';

    // 3. Main Chart: Top 5 products
    const top5 = prodList.slice(0, 5).map((p) => ({
        label: p.code,
        fullName: p.name,
        val1: p.revenue,
        val2: p.unknownCost ? null : p.profit
    }));
    renderDualBarChart(
        'rep-main-chart-container',
        top5,
        'Doanh thu',
        'bg-[#0066cc]',
        'Lợi nhuận',
        'bg-emerald-500'
    );

    // 4. Side Chart: Category Breakdown
    const catMap = Object.create(null);
    prodList.forEach((p) => {
        catMap[p.category] = (catMap[p.category] || 0) + p.revenue;
    });
    const catItems = Object.entries(catMap).map(([name, val], idx) => {
        const colors = [
            { dot: 'bg-blue-500', bar: 'bg-blue-500' },
            { dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
            { dot: 'bg-indigo-500', bar: 'bg-indigo-500' },
            { dot: 'bg-amber-500', bar: 'bg-amber-500' },
            { dot: 'bg-purple-500', bar: 'bg-purple-500' }
        ];
        const c = colors[idx % colors.length];
        return { label: name, value: val, dotClass: c.dot, barClass: c.bar };
    });
    renderBreakdownBars('rep-breakdown-container', catItems);

    // 5. Table Rendering
    const tableTitleEl = document.getElementById('rep-table-title');
    if (tableTitleEl) tableTitleEl.textContent = 'Bảng xếp hạng hiệu quả kinh doanh theo mặt hàng';

    const thead = document.getElementById('rep-table-thead');
    if (thead) {
        thead.innerHTML = renderHTML`
            <tr class="bg-gray-100/80 text-gray-700 font-bold border-b border-gray-200">
                <th class="py-2.5 px-3">Mã SKU</th>
                <th class="py-2.5 px-3">Tên sản phẩm</th>
                <th class="py-2.5 px-3">Nhóm hàng</th>
                <th class="py-2.5 px-3 text-center">SL bán</th>
                <th class="py-2.5 px-3 text-right">Doanh thu</th>
                <th class="py-2.5 px-3 text-right">Tiền vốn</th>
                <th class="py-2.5 px-3 text-right">Lợi nhuận</th>
                <th class="py-2.5 px-3 text-right">Tỷ suất</th>
                <th class="py-2.5 px-3 text-center">Tồn kho</th>
            </tr>
        `;
    }

    const tbody = document.getElementById('rep-table-tbody');
    if (tbody) {
        tbody.innerHTML = prodList
            .map((p) => {
                const stockBadge =
                    p.stock <= 0
                        ? trustedHTML('<span class="kv-badge kv-badge-danger">Hết hàng (0)</span>')
                        : p.stock <= p.minStock
                          ? renderHTML`<span class="kv-badge kv-badge-warning">Sắp hết (${p.stock})</span>`
                          : renderHTML`<span class="kv-badge kv-badge-success">${p.stock}</span>`;

                return renderHTML`
                <tr class="hover:bg-blue-50/40 transition-colors">
                    <td class="py-2.5 px-3 font-semibold text-[#0066cc] font-mono text-[12px]">${p.code}</td>
                    <td class="py-2.5 px-3 font-semibold text-gray-900 max-w-[260px] truncate" title="${p.name}">${p.name}</td>
                    <td class="py-2.5 px-3 text-gray-600 text-[12px]">${p.category}</td>
                    <td class="py-2.5 px-3 text-center font-bold text-gray-800">${p.qty}</td>
                    <td class="py-2.5 px-3 text-right font-bold text-[#0066cc] tabular-nums">${formatVND(p.revenue)} đ</td>
                    <td class="py-2.5 px-3 text-right font-medium text-gray-600 tabular-nums">${p.unknownCost ? 'Thiếu giá vốn' : formatVND(p.totalCost) + ' đ'}</td>
                    <td class="py-2.5 px-3 text-right font-bold text-emerald-600 tabular-nums">${p.unknownCost ? 'Chưa xác định' : formatVND(p.profit) + ' đ'}</td>
                    <td class="py-2.5 px-3 text-right font-bold tabular-nums ${parseFloat(p.margin) >= 20 ? 'text-emerald-600' : 'text-amber-600'}">${p.unknownCost ? '—' : p.margin + '%'}</td>
                    <td class="py-2.5 px-3 text-center">${stockBadge}</td>
                </tr>
            `;
            })
            .join('');
    }

    const tableBadgeEl = document.getElementById('rep-table-badge');
    if (tableBadgeEl) tableBadgeEl.textContent = `${prodList.length} mặt hàng`;

    const footer = document.getElementById('rep-table-footer');
    if (footer) {
        footer.innerHTML = renderHTML`
            <div class="flex items-center space-x-4">
                <span>Tổng mặt hàng phát sinh: <strong class="text-gray-900">${prodList.length}</strong></span>
                <span>Tổng số lượng bán: <strong class="text-gray-900">${totalQtySold} SP</strong></span>
            </div>
            <div class="flex items-center space-x-4">
                <span>Doanh thu: <strong class="text-[#0066cc]">${formatVND(totalProdRev)} đ</strong></span>
                <span>Lợi nhuận gộp: <strong class="text-emerald-600">${prodList.some((p) => p.unknownCost) ? 'Thiếu giá vốn lịch sử' : formatVND(totalProdProfit) + ' đ'}</strong></span>
                <span>Tỷ suất TB: <strong class="text-gray-900">${prodList.some((p) => p.unknownCost) ? '—' : avgMargin + '%'}</strong></span>
            </div>
        `;
    }
}

function renderCashflowReportTab(data, currentBranch, branchProducts, dateFilter) {
    const branchCashbook = (data.cashbook || []).filter(
        (c) => (c.branch || 'Kalo HCM') === currentBranch
    );
    const validCashbook = branchCashbook.filter((c) => matchesDateFilter(c.time, dateFilter));

    const thuList = validCashbook.filter((c) => c.type === 'thu');
    const chiList = validCashbook.filter((c) => c.type === 'chi');
    const totalThu = thuList.reduce((a, b) => a + (b.amount || 0), 0);
    const totalChi = chiList.reduce((a, b) => a + (b.amount || 0), 0);
    const netCash = totalThu - totalChi;

    const allThu = branchCashbook
        .filter((c) => c.type === 'thu')
        .reduce((a, b) => a + (b.amount || 0), 0);
    const allChi = branchCashbook
        .filter((c) => c.type === 'chi')
        .reduce((a, b) => a + (b.amount || 0), 0);
    const allBalance = allThu - allChi;

    // 1. KPI Cards
    updateKpiCard(
        1,
        '📥',
        'Tổng thu trong kỳ',
        `${formatVND(totalThu)} đ`,
        renderHTML`<span class="text-blue-600 font-semibold">${thuList.length} phiếu thu</span>`,
        'bg-blue-500/15 text-[#0066cc]'
    );
    updateKpiCard(
        2,
        '📤',
        'Tổng chi trong kỳ',
        `${formatVND(totalChi)} đ`,
        renderHTML`<span class="text-rose-600 font-semibold">${chiList.length} phiếu chi</span>`,
        'bg-rose-500/15 text-rose-600'
    );
    updateKpiCard(
        3,
        '⚖️',
        'Dòng tiền ròng (Thu - Chi)',
        `${netCash >= 0 ? '+' : ''}${formatVND(netCash)} đ`,
        renderHTML`<span class="${netCash >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-semibold">${netCash >= 0 ? 'Thặng dư tiền mặt' : 'Thâm hụt dòng tiền'}</span>`,
        netCash >= 0 ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'
    );
    updateKpiCard(
        4,
        '🏦',
        'Tồn quỹ chi nhánh',
        `${formatVND(allBalance)} đ`,
        renderHTML`<span class="font-semibold text-gray-800">Toàn bộ quỹ tích lũy</span>`,
        'bg-amber-500/15 text-amber-600'
    );

    // 2. Chart Titles & Legends
    const mainTitleEl = document.getElementById('rep-main-chart-title');
    if (mainTitleEl) mainTitleEl.textContent = 'Biến động Dòng tiền Thu & Chi theo ngày';
    const mainLegendEl = document.getElementById('rep-main-chart-legend');
    if (mainLegendEl) {
        mainLegendEl.innerHTML = renderHTML`
            <span class="inline-flex items-center space-x-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[#0066cc]"></span><span>Tiền thu</span></span>
            <span class="inline-flex items-center space-x-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-rose-500"></span><span>Tiền chi</span></span>
        `;
    }

    const sideTitleEl = document.getElementById('rep-side-chart-title');
    if (sideTitleEl) sideTitleEl.textContent = 'Cơ cấu Thu - Chi';
    const sideBadgeEl = document.getElementById('rep-side-chart-badge');
    if (sideBadgeEl) sideBadgeEl.textContent = 'Hình thức';

    // 3. Main Chart: Group cashflow by day
    const dayMap = Object.create(null);
    validCashbook.forEach((c) => {
        const d = parseRecordDate(c.time);
        const dayKey = d
            ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
            : 'Khác';
        if (!dayMap[dayKey]) {
            dayMap[dayKey] = { dayKey, dateObj: d || new Date(0), thu: 0, chi: 0 };
        }
        if (c.type === 'thu') dayMap[dayKey].thu += c.amount || 0;
        else dayMap[dayKey].chi += c.amount || 0;
    });

    const daysSorted = Object.values(dayMap).sort((a, b) => a.dateObj - b.dateObj);
    const chartItems = daysSorted.map((d) => ({
        label: d.dayKey.slice(0, 5),
        fullName: d.dayKey,
        val1: d.thu,
        val2: d.chi
    }));
    renderDualBarChart(
        'rep-main-chart-container',
        chartItems,
        'Tiền thu',
        'bg-[#0066cc]',
        'Tiền chi',
        'bg-rose-500'
    );

    // 4. Side Chart: Method / Category
    let transferAmount = 0;
    let cashAmount = 0;
    validCashbook.forEach((c) => {
        const m = (c.method || '').toLowerCase();
        if (m.includes('khoản') || m.includes('vietqr') || m.includes('bank')) {
            transferAmount += c.amount || 0;
        } else {
            cashAmount += c.amount || 0;
        }
    });

    renderBreakdownBars('rep-breakdown-container', [
        {
            label: 'Chuyển khoản ngân hàng',
            value: transferAmount,
            dotClass: 'bg-[#0066cc]',
            barClass: 'bg-[#0066cc]'
        },
        {
            label: 'Tiền mặt tại quầy',
            value: cashAmount,
            dotClass: 'bg-emerald-500',
            barClass: 'bg-emerald-500'
        }
    ]);

    // 5. Table Rendering
    const tableTitleEl = document.getElementById('rep-table-title');
    if (tableTitleEl) tableTitleEl.textContent = 'Sổ nhật ký thu chi chi tiết';

    const thead = document.getElementById('rep-table-thead');
    if (thead) {
        thead.innerHTML = renderHTML`
            <tr class="bg-gray-100/80 text-gray-700 font-bold border-b border-gray-200">
                <th class="py-2.5 px-3">Mã phiếu</th>
                <th class="py-2.5 px-3">Thời gian</th>
                <th class="py-2.5 px-3 text-center">Loại phiếu</th>
                <th class="py-2.5 px-3">Khoản mục</th>
                <th class="py-2.5 px-3">Người nộp / nhận</th>
                <th class="py-2.5 px-3">Phương thức</th>
                <th class="py-2.5 px-3 text-right">Số tiền</th>
                <th class="py-2.5 px-3">Ghi chú</th>
            </tr>
        `;
    }

    const sortedCashbook = [...validCashbook].sort((a, b) => {
        const da = parseRecordDate(a.time) || new Date(0);
        const db = parseRecordDate(b.time) || new Date(0);
        return db - da;
    });

    const tbody = document.getElementById('rep-table-tbody');
    if (tbody) {
        tbody.innerHTML = sortedCashbook
            .map((c) => {
                const isThu = c.type === 'thu';
                const typeBadge = isThu
                    ? trustedHTML('<span class="kv-badge kv-badge-success">Thu tiền</span>')
                    : trustedHTML('<span class="kv-badge kv-badge-danger">Chi tiền</span>');
                const amtColor = isThu ? 'text-blue-600' : 'text-rose-600';
                const amtPrefix = isThu ? '+' : '-';

                return renderHTML`
                <tr class="hover:bg-blue-50/40 transition-colors">
                    <td class="py-2.5 px-3 font-semibold text-[#0066cc] font-mono text-[12px]">${c.code}</td>
                    <td class="py-2.5 px-3 text-gray-600 font-mono text-[12px]">${c.time}</td>
                    <td class="py-2.5 px-3 text-center">${typeBadge}</td>
                    <td class="py-2.5 px-3 font-medium text-gray-900">${c.category || 'Khác'}</td>
                    <td class="py-2.5 px-3 text-gray-700 font-medium">${c.person || '-'}</td>
                    <td class="py-2.5 px-3 text-gray-600 text-[12px]">${c.method || 'Tiền mặt'}</td>
                    <td class="py-2.5 px-3 text-right font-bold tabular-nums ${amtColor}">${amtPrefix}${formatVND(c.amount)} đ</td>
                    <td class="py-2.5 px-3 text-gray-500 text-[12px] max-w-[200px] truncate" title="${c.note || ''}">${c.note || '-'}</td>
                </tr>
            `;
            })
            .join('');
    }

    const tableBadgeEl = document.getElementById('rep-table-badge');
    if (tableBadgeEl) tableBadgeEl.textContent = `${sortedCashbook.length} phiếu`;

    const footer = document.getElementById('rep-table-footer');
    if (footer) {
        footer.innerHTML = renderHTML`
            <div class="flex items-center space-x-4">
                <span>Tổng thu: <strong class="text-blue-600">+${formatVND(totalThu)} đ</strong></span>
                <span>Tổng chi: <strong class="text-rose-600">-${formatVND(totalChi)} đ</strong></span>
            </div>
            <div class="flex items-center space-x-4">
                <span>Chênh lệch ròng: <strong class="${netCash >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${netCash >= 0 ? '+' : ''}${formatVND(netCash)} đ</strong></span>
                <span>Tồn quỹ hiện tại: <strong class="text-gray-900">${formatVND(allBalance)} đ</strong></span>
            </div>
        `;
    }
}

function renderInventoryReportTab(data, currentBranch, branchProducts, dateFilter) {
    const products = branchProducts.filter((p) => p.status !== 'archived');

    const totalStockQty = products.reduce((a, b) => a + (b.stock || 0), 0);
    const totalCostVal = products.reduce((a, b) => a + (b.stock || 0) * (b.costPrice || 0), 0);
    const totalRetailVal = products.reduce((a, b) => a + (b.stock || 0) * (b.price || 0), 0);
    const potentialProfit = Math.max(0, totalRetailVal - totalCostVal);
    const invMargin =
        totalRetailVal > 0 ? ((potentialProfit / totalRetailVal) * 100).toFixed(1) : '0.0';

    const lowStock = products.filter(
        (p) => (p.stock || 0) <= (p.minStock || 0) && (p.stock || 0) > 0
    );
    const outOfStock = products.filter((p) => (p.stock || 0) <= 0);
    const goodStock = products.filter((p) => (p.stock || 0) > (p.minStock || 0));
    const warningCount = lowStock.length + outOfStock.length;

    // 1. KPI Cards
    updateKpiCard(
        1,
        '📦',
        'Giá trị tồn theo vốn',
        `${formatVND(totalCostVal)} đ`,
        renderHTML`<span class="font-semibold text-gray-700">${products.length} mặt hàng</span> (${totalStockQty} SP)`,
        'bg-blue-500/15 text-[#0066cc]'
    );
    updateKpiCard(
        2,
        '🏷️',
        'Giá trị tồn theo giá bán',
        `${formatVND(totalRetailVal)} đ`,
        `Doanh số tiềm năng`,
        'bg-emerald-500/15 text-emerald-600'
    );
    updateKpiCard(
        3,
        '✨',
        'Lợi nhuận gộp kho ước tính',
        `${formatVND(potentialProfit)} đ`,
        renderHTML`Biên LN kho: <span id="rep-margin" class="font-bold text-[#0066cc]">${invMargin}%</span>`,
        'bg-indigo-500/15 text-indigo-600'
    );
    updateKpiCard(
        4,
        '⚠️',
        'Cảnh báo dưới định mức',
        `${warningCount} mặt hàng`,
        renderHTML`<span class="text-rose-600 font-semibold">${outOfStock.length} hết hàng</span> · <span class="text-amber-600 font-semibold">${lowStock.length} sắp hết</span>`,
        'bg-amber-500/15 text-amber-600'
    );

    // 2. Chart Titles & Legends
    const mainTitleEl = document.getElementById('rep-main-chart-title');
    if (mainTitleEl) mainTitleEl.textContent = 'Giá trị tồn kho theo Nhóm hàng (Giá vốn)';
    const mainLegendEl = document.getElementById('rep-main-chart-legend');
    if (mainLegendEl) {
        mainLegendEl.innerHTML = renderHTML`
            <span class="inline-flex items-center space-x-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[#0066cc]"></span><span>Giá trị vốn tồn kho</span></span>
        `;
    }

    const sideTitleEl = document.getElementById('rep-side-chart-title');
    if (sideTitleEl) sideTitleEl.textContent = 'Trạng thái Định mức kho';
    const sideBadgeEl = document.getElementById('rep-side-chart-badge');
    if (sideBadgeEl) sideBadgeEl.textContent = 'Định mức';

    // 3. Main Chart: Category stock value
    const catMap = Object.create(null);
    products.forEach((p) => {
        const val = (p.stock || 0) * (p.costPrice || 0);
        catMap[p.category] = (catMap[p.category] || 0) + val;
    });

    const catChartItems = Object.entries(catMap).map(([name, val]) => ({
        label: name.length > 10 ? name.slice(0, 8) + '..' : name,
        fullName: name,
        subLabel: 'Giá trị vốn tồn',
        value: val
    }));
    renderSingleBarChart('rep-main-chart-container', catChartItems, 'bg-[#0066cc]');

    // 4. Side Chart: Stock Status Breakdown
    renderBreakdownBars('rep-breakdown-container', [
        {
            label: 'Đủ hàng an toàn (> Min)',
            value: goodStock.length,
            dotClass: 'bg-emerald-500',
            barClass: 'bg-emerald-500'
        },
        {
            label: 'Sắp hết hàng (≤ Min)',
            value: lowStock.length,
            dotClass: 'bg-amber-500',
            barClass: 'bg-amber-500'
        },
        {
            label: 'Hết hàng (Hết sạch)',
            value: outOfStock.length,
            dotClass: 'bg-rose-500',
            barClass: 'bg-rose-500'
        }
    ]);

    // 5. Table Rendering
    const tableTitleEl = document.getElementById('rep-table-title');
    if (tableTitleEl) tableTitleEl.textContent = 'Báo cáo chi tiết định mức tồn kho & giá trị hàng';

    const thead = document.getElementById('rep-table-thead');
    if (thead) {
        thead.innerHTML = renderHTML`
            <tr class="bg-gray-100/80 text-gray-700 font-bold border-b border-gray-200">
                <th class="py-2.5 px-3">Mã SKU</th>
                <th class="py-2.5 px-3">Tên hàng hóa</th>
                <th class="py-2.5 px-3">Nhóm hàng</th>
                <th class="py-2.5 px-3 text-center">Tồn kho</th>
                <th class="py-2.5 px-3 text-center">Định mức</th>
                <th class="py-2.5 px-3 text-right">Giá vốn</th>
                <th class="py-2.5 px-3 text-right">Giá bán</th>
                <th class="py-2.5 px-3 text-right">Giá trị vốn tồn</th>
                <th class="py-2.5 px-3 text-center">Trạng thái</th>
            </tr>
        `;
    }

    const sortedProducts = [...products].sort((a, b) => {
        const aWarn = a.stock <= 0 ? 2 : a.stock <= a.minStock ? 1 : 0;
        const bWarn = b.stock <= 0 ? 2 : b.stock <= b.minStock ? 1 : 0;
        if (bWarn !== aWarn) return bWarn - aWarn;
        return (b.stock || 0) * (b.costPrice || 0) - (a.stock || 0) * (a.costPrice || 0);
    });

    const tbody = document.getElementById('rep-table-tbody');
    if (tbody) {
        tbody.innerHTML = sortedProducts
            .map((p) => {
                const valCost = (p.stock || 0) * (p.costPrice || 0);
                let badgeHtml = '';
                if (p.stock <= 0) {
                    badgeHtml = trustedHTML(
                        '<span class="kv-badge kv-badge-danger">Hết hàng</span>'
                    );
                } else if (p.stock <= p.minStock) {
                    badgeHtml = trustedHTML(
                        '<span class="kv-badge kv-badge-warning">Sắp hết</span>'
                    );
                } else {
                    badgeHtml = trustedHTML(
                        '<span class="kv-badge kv-badge-success">Đủ hàng</span>'
                    );
                }

                return renderHTML`
                <tr class="hover:bg-blue-50/40 transition-colors">
                    <td class="py-2.5 px-3 font-semibold text-[#0066cc] font-mono text-[12px]">${p.code}</td>
                    <td class="py-2.5 px-3 font-semibold text-gray-900 max-w-[260px] truncate" title="${p.name}">${p.name}</td>
                    <td class="py-2.5 px-3 text-gray-600 text-[12px]">${p.category}</td>
                    <td class="py-2.5 px-3 text-center font-bold ${p.stock <= 0 ? 'text-rose-600' : p.stock <= p.minStock ? 'text-amber-600' : 'text-gray-800'}">${p.stock || 0}</td>
                    <td class="py-2.5 px-3 text-center text-gray-500 font-medium">${p.minStock || 0}</td>
                    <td class="py-2.5 px-3 text-right font-medium text-gray-600 tabular-nums">${formatVND(p.costPrice)} đ</td>
                    <td class="py-2.5 px-3 text-right font-medium text-gray-800 tabular-nums">${formatVND(p.price)} đ</td>
                    <td class="py-2.5 px-3 text-right font-bold text-[#0066cc] tabular-nums">${formatVND(valCost)} đ</td>
                    <td class="py-2.5 px-3 text-center">${badgeHtml}</td>
                </tr>
            `;
            })
            .join('');
    }

    const tableBadgeEl = document.getElementById('rep-table-badge');
    if (tableBadgeEl) tableBadgeEl.textContent = `${sortedProducts.length} mặt hàng`;

    const footer = document.getElementById('rep-table-footer');
    if (footer) {
        footer.innerHTML = renderHTML`
            <div class="flex items-center space-x-4">
                <span>Tổng tồn kho: <strong class="text-gray-900">${totalStockQty} SP</strong></span>
                <span>Mặt hàng cảnh báo: <strong class="${warningCount > 0 ? 'text-rose-600' : 'text-gray-900'}">${warningCount}</strong></span>
            </div>
            <div class="flex items-center space-x-4">
                <span>Tổng vốn tồn: <strong class="text-[#0066cc]">${formatVND(totalCostVal)} đ</strong></span>
                <span>Tổng giá trị bán: <strong class="text-emerald-600">${formatVND(totalRetailVal)} đ</strong></span>
            </div>
        `;
    }
}

// --- 10. SETTINGS & BACKUP MODAL ---
function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    const s = KVStore.data.settings;
    document.getElementById('set-store-name').value = s.storeName;
    document.getElementById('set-branch').value = s.branch;
    document.getElementById('set-branch').readOnly = true;
    document.getElementById('set-phone').value = s.phone;
    document.getElementById('set-hotline').value = s.hotline;
    document.getElementById('set-address').value = s.address;
    document.getElementById('set-bank-code').value = s.bankCode;
    document.getElementById('set-bank-name').value = s.bankName;
    document.getElementById('set-bank-account').value = s.bankAccount;
    document.getElementById('set-bank-owner').value = s.bankOwner;
    modal.classList.remove('hidden');
}

async function saveSettingsFromModal(e) {
    e.preventDefault();
    const s = KVStore.data.settings;
    s.storeName = document.getElementById('set-store-name').value.trim();
    sessionStorage.setItem('minikiot_branch', getCurrentBranch());
    s.phone = document.getElementById('set-phone').value.trim();
    s.hotline = document.getElementById('set-hotline').value.trim();
    s.address = document.getElementById('set-address').value.trim();
    s.bankCode = document.getElementById('set-bank-code').value.trim();
    s.bankName = document.getElementById('set-bank-name').value.trim();
    s.bankAccount = document.getElementById('set-bank-account').value.trim();
    s.bankOwner = document.getElementById('set-bank-owner').value.trim();

    await KVStore.save();
    document.getElementById('settings-modal').classList.add('hidden');
    showToast('Đã lưu thiết lập cửa hàng!', 'success');
}

// --- SQLITE DATABASE MODAL & SYNC CONTROLLER ---
async function showDbInfoModal() {
    const modal = document.getElementById('db-info-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    try {
        const res = await fetch('/api/status');
        if (res.ok) {
            const json = await res.json();
            if (json.success && json.stats) {
                const s = json.stats;
                const sizeEl = document.getElementById('db-info-size');
                if (sizeEl) sizeEl.textContent = `${s.dbSizeKB || 0} KB`;
                const fileEl = document.getElementById('db-info-file');
                if (fileEl)
                    fileEl.textContent = s.dbPath ? s.dbPath.split('/').pop() : 'minikiot.db';
                if (s.counts) {
                    if (document.getElementById('db-cnt-products'))
                        document.getElementById('db-cnt-products').textContent =
                            s.counts.products || 0;
                    if (document.getElementById('db-cnt-invoices'))
                        document.getElementById('db-cnt-invoices').textContent =
                            s.counts.invoices || 0;
                    if (document.getElementById('db-cnt-customers'))
                        document.getElementById('db-cnt-customers').textContent =
                            s.counts.customers || 0;
                    if (document.getElementById('db-cnt-suppliers'))
                        document.getElementById('db-cnt-suppliers').textContent =
                            s.counts.suppliers || 0;
                    if (document.getElementById('db-cnt-imports'))
                        document.getElementById('db-cnt-imports').textContent =
                            s.counts.imports || 0;
                    if (document.getElementById('db-cnt-cashbook'))
                        document.getElementById('db-cnt-cashbook').textContent =
                            s.counts.cashbook || 0;
                    if (document.getElementById('db-cnt-stocktakes'))
                        document.getElementById('db-cnt-stocktakes').textContent =
                            s.counts.stocktakes || 0;
                    if (document.getElementById('db-cnt-transfers'))
                        document.getElementById('db-cnt-transfers').textContent =
                            s.counts.transfers || 0;
                }
            }
        }
    } catch (e) {
        console.error('Lỗi nạp thống kê SQLite:', e);
    }
}

async function forceSyncDatabase() {
    await KVStore.syncToDatabase();
    showToast('Đã tải dữ liệu và đối soát giao dịch chờ.', 'success');
}

function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F1') {
            e.preventDefault();
            if (state.currentView === 'pos') {
                switchView(state.previousView || 'dashboard');
            } else {
                state.previousView = state.currentView;
                switchView('pos');
            }
        } else if (e.key === 'F3') {
            e.preventDefault();
            if (state.currentView !== 'pos') switchView('pos');
            setTimeout(() => {
                const input = document.getElementById('pos-search-input');
                if (input) input.focus();
            }, 50);
        } else if (e.key === 'F4') {
            e.preventDefault();
            if (state.currentView !== 'pos') switchView('pos');
            setTimeout(() => {
                const input = document.getElementById('pos-customer-input');
                if (input) input.focus();
            }, 50);
        } else if (e.key === 'F9') {
            e.preventDefault();
            if (state.currentView === 'pos') checkoutPos();
        } else if (e.key === 'Escape') {
            const visibleModals = Array.from(document.querySelectorAll('.kv-modal:not(.hidden)'));
            if (visibleModals.length > 0) {
                visibleModals.sort((a, b) => {
                    const za = parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
                    const zb = parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
                    return zb - za;
                });
                visibleModals[0].classList.add('hidden');
            }
        }
    });

    // Global Modal Autofocus: When any modal opens, focus its first active input
    try {
        const modalObserver = new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    const target = m.target;
                    if (
                        target.classList.contains('kv-modal') &&
                        !target.classList.contains('hidden')
                    ) {
                        setTimeout(() => {
                            const firstInput = target.querySelector(
                                'input:not([type="hidden"]):not([readonly]):not([disabled]), select:not([disabled]), textarea:not([readonly]):not([disabled])'
                            );
                            if (firstInput) firstInput.focus();
                        }, 50);
                    }
                }
            });
        });
        document.querySelectorAll('.kv-modal').forEach((el) => {
            modalObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
        });
    } catch (err) {
        console.warn('Modal autofocus observer error:', err);
    }
}

function toggleStar(td) {
    const svg = td.querySelector('svg');
    if (svg.getAttribute('fill') === 'currentColor') {
        svg.setAttribute('fill', 'none');
        td.classList.remove('text-yellow-400');
        td.classList.add('text-gray-400');
    } else {
        svg.setAttribute('fill', 'currentColor');
        td.classList.remove('text-gray-400');
        td.classList.add('text-yellow-400');
    }
}

// --- 10. BARCODE LABEL PRINTING SYSTEM ---
const CODE39_PATTERNS = {
    0: '000110100',
    1: '100100001',
    2: '001100001',
    3: '101100000',
    4: '000110001',
    5: '100110000',
    6: '001110000',
    7: '000100101',
    8: '100100100',
    9: '001100100',
    A: '100001001',
    B: '001001001',
    C: '101001000',
    D: '000011001',
    E: '100011000',
    F: '001011000',
    G: '000001101',
    H: '100001100',
    I: '001001100',
    J: '000011100',
    K: '100000011',
    L: '001000011',
    M: '101000010',
    N: '000010011',
    O: '100010010',
    P: '001010010',
    Q: '000000111',
    R: '100000110',
    S: '001000110',
    T: '000010110',
    U: '110000001',
    V: '011000001',
    W: '111000000',
    X: '010010001',
    Y: '110010000',
    Z: '011010000',
    '-': '010000101',
    '.': '110000100',
    ' ': '011000100',
    $: '010101000',
    '/': '010100010',
    '+': '010001010',
    '%': '000101010',
    '*': '010010100'
};

function drawBarcodeCode39(canvas, text) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const raw = (text || '').toUpperCase().replace(/[^0-9A-Z\-\. \$\/\+\%]/g, '');
    const cleanText = '*' + raw + '*';
    const narrowWidth = 2;
    const wideWidth = 5;
    const gap = 2;
    const barHeight = 44;

    let totalWidth = 20;
    for (let i = 0; i < cleanText.length; i++) {
        const pattern = CODE39_PATTERNS[cleanText[i]];
        if (!pattern) continue;
        for (let j = 0; j < 9; j++) {
            totalWidth += pattern[j] === '1' ? wideWidth : narrowWidth;
        }
        totalWidth += gap;
    }

    canvas.width = Math.max(160, totalWidth);
    canvas.height = barHeight + 18;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let curX = 10;
    ctx.fillStyle = '#000000';

    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const pattern = CODE39_PATTERNS[char];
        if (!pattern) continue;

        for (let j = 0; j < 9; j++) {
            const isBar = j % 2 === 0;
            const w = pattern[j] === '1' ? wideWidth : narrowWidth;
            if (isBar) {
                ctx.fillRect(curX, 0, w, barHeight);
            }
            curX += w;
        }
        curX += gap;
    }

    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(raw, canvas.width / 2, barHeight + 14);
}

let activeBarcodeProduct = null;

function openBarcodeModal(productCode) {
    const currentBranch = getCurrentBranch();
    const p = (KVStore.data.products || []).find(
        (item) => item.code === productCode && (item.branch || 'Kalo HCM') === currentBranch
    );
    if (!p) {
        showToast('Không tìm thấy sản phẩm', 'error');
        return;
    }
    activeBarcodeProduct = p;
    const modal = document.getElementById('barcode-modal');
    if (!modal) return;

    document.getElementById('barcode-modal-pname').textContent = p.name;
    document.getElementById('barcode-modal-pcode').textContent = p.code;
    document.getElementById('barcode-modal-pprice').textContent = `${formatVND(p.price)} đ`;
    document.getElementById('barcode-qty-input').value = '4';

    updateBarcodePreview();
    modal.classList.remove('hidden');
}

function closeBarcodeModal() {
    document.getElementById('barcode-modal')?.classList.add('hidden');
}

function updateBarcodePreview() {
    if (!activeBarcodeProduct) return;
    const qty = parseInt(document.getElementById('barcode-qty-input')?.value || '4', 10) || 1;
    const showStore = document.getElementById('barcode-opt-store')?.checked ?? true;
    const showPrice = document.getElementById('barcode-opt-price')?.checked ?? true;

    const container = document.getElementById('barcode-preview-grid');
    const printContainer = document.getElementById('printable-barcode-sheet');
    if (!container) return;
    container.innerHTML = '';
    if (printContainer) printContainer.innerHTML = '';

    for (let i = 0; i < qty; i++) {
        const card = document.createElement('div');
        card.className =
            'bg-white border border-gray-300 rounded p-2 flex flex-col items-center justify-between text-center shadow-xs w-[170px] h-[130px] flex-shrink-0';

        let storeHtml = showStore
            ? trustedHTML(
                  '<div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">KALO STORE</div>'
              )
            : '';
        let nameHtml = renderHTML`<div class="text-[11px] font-semibold text-gray-900 leading-tight line-clamp-1 w-full" title="${activeBarcodeProduct.name}">${activeBarcodeProduct.name}</div>`;
        let priceHtml = showPrice
            ? renderHTML`<div class="text-[12px] font-bold text-red-600">${formatVND(activeBarcodeProduct.price)} đ</div>`
            : '';

        card.innerHTML = renderHTML`
            ${storeHtml}
            ${nameHtml}
            <canvas class="barcode-canvas-item my-1 max-w-full" style="max-height: 48px"></canvas>
            ${priceHtml}
        `;
        container.appendChild(card);

        const canvas = card.querySelector('.barcode-canvas-item');
        drawBarcodeCode39(canvas, activeBarcodeProduct.barcode || activeBarcodeProduct.code);

        // Print sheet copy
        if (printContainer) {
            const printCard = card.cloneNode(true);
            printCard.className =
                'inline-block m-1.5 border border-dashed border-gray-400 p-2 text-center w-[170px] h-[130px] align-top';
            printContainer.appendChild(printCard);
            const printCanvas = printCard.querySelector('.barcode-canvas-item');
            drawBarcodeCode39(
                printCanvas,
                activeBarcodeProduct.barcode || activeBarcodeProduct.code
            );
        }
    }
}

function printBarcodeStickers() {
    printRegion('printable-barcode-sheet', false);
}

// --- 11. EXPORT TO CSV / EXCEL ---
function exportTableToCSV(type) {
    const currentBranch = getCurrentBranch();
    let filename = `kiotviet_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
    let headers = [];
    let rows = [];

    if (type === 'products') {
        filename = `Danh_muc_hang_hoa_${currentBranch.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        headers = [
            'Mã hàng',
            'Tên hàng hóa',
            'Mã vạch',
            'Nhóm hàng',
            'Giá vốn',
            'Giá bán',
            'Tồn kho',
            'Đơn vị tính',
            'Trạng thái',
            'Chi nhánh'
        ];
        rows = (KVStore.data.products || [])
            .filter((p) => (p.branch || 'Kalo HCM') === currentBranch)
            .map((p) => [
                p.code,
                `"${(p.name || '').replace(/"/g, '""')}"`,
                `"${p.barcode || ''}"`,
                `"${p.category || ''}"`,
                p.costPrice || 0,
                p.price || 0,
                p.stock || 0,
                `"${p.unit || ''}"`,
                p.status === 'active' ? 'Đang kinh doanh' : 'Ngừng KD',
                `"${p.branch || currentBranch}"`
            ]);
    } else if (type === 'invoices') {
        filename = `Danh_sach_hoa_don_${currentBranch.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        headers = [
            'Mã hóa đơn',
            'Thời gian',
            'Khách hàng',
            'Điện thoại',
            'Tổng tiền hàng',
            'Khách đã trả',
            'Giảm giá',
            'Trạng thái',
            'Thu ngân',
            'Chi nhánh'
        ];
        rows = (KVStore.data.invoices || [])
            .filter((i) => (i.branch || 'Kalo HCM') === currentBranch)
            .map((i) => [
                i.code,
                `"${i.time || ''}"`,
                `"${(i.customer || '').replace(/"/g, '""')}"`,
                `"${i.phone || ''}"`,
                i.total || 0,
                i.paid || 0,
                i.discount || 0,
                i.status === 'cancelled' ? 'Đã hủy' : i.hasReturned ? 'Có trả hàng' : 'Hoàn thành',
                `"${i.cashier || ''}"`,
                `"${i.branch || ''}"`
            ]);
    } else if (type === 'imports') {
        filename = `Danh_sach_nhap_hang_${currentBranch.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        headers = [
            'Mã phiếu',
            'Thời gian',
            'Mã NCC',
            'Tên nhà cung cấp',
            'Cần trả NCC',
            'Đã trả',
            'Người tạo',
            'Chi nhánh',
            'Ghi chú'
        ];
        rows = (KVStore.data.imports || [])
            .filter((imp) => (imp.branch || 'Kalo HCM') === currentBranch)
            .map((imp) => [
                imp.code,
                `"${imp.time || ''}"`,
                `"${imp.nccCode || ''}"`,
                `"${(imp.nccName || '').replace(/"/g, '""')}"`,
                imp.needPay || 0,
                imp.paid || 0,
                `"${imp.creator || ''}"`,
                `"${imp.branch || currentBranch}"`,
                `"${(imp.note || '').replace(/"/g, '""').replace(/<br>/g, ' ')}"`
            ]);
    } else if (type === 'customers') {
        filename = `Danh_sach_khach_hang_${new Date().toISOString().slice(0, 10)}.csv`;
        headers = [
            'Mã KH',
            'Tên khách hàng',
            'Điện thoại',
            'Địa chỉ',
            'Tổng chi tiêu',
            'Nợ hiện tại',
            'Điểm tích lũy'
        ];
        rows = (KVStore.data.customers || []).map((c) => [
            c.code,
            `"${(c.name || '').replace(/"/g, '""')}"`,
            `"${c.phone || ''}"`,
            `"${(c.address || '').replace(/"/g, '""')}"`,
            c.totalSpent || 0,
            c.debt || 0,
            c.points || 0
        ]);
    } else if (type === 'suppliers') {
        filename = `Danh_sach_nha_cung_cap_${new Date().toISOString().slice(0, 10)}.csv`;
        headers = [
            'Mã NCC',
            'Tên nhà cung cấp',
            'Điện thoại',
            'Địa chỉ',
            'Tổng tiền mua',
            'Nợ cần trả'
        ];
        rows = (KVStore.data.suppliers || []).map((s) => [
            s.code,
            `"${(s.name || '').replace(/"/g, '""')}"`,
            `"${s.phone || ''}"`,
            `"${(s.address || '').replace(/"/g, '""')}"`,
            s.totalBought || 0,
            s.debt || 0
        ]);
    } else if (type === 'cashbook') {
        filename = `So_quy_tai_chinh_${currentBranch.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        headers = [
            'Mã phiếu',
            'Thời gian',
            'Loại thu/chi',
            'Hạng mục',
            'Người nộp/nhận',
            'Hình thức',
            'Số tiền',
            'Chi nhánh',
            'Ghi chú'
        ];
        rows = (KVStore.data.cashbook || [])
            .filter((tx) => (tx.branch || 'Kalo HCM') === currentBranch)
            .map((tx) => [
                tx.code,
                `"${tx.time || ''}"`,
                tx.type === 'thu' ? 'Thu' : 'Chi',
                `"${tx.category || ''}"`,
                `"${(tx.person || '').replace(/"/g, '""')}"`,
                `"${tx.method || ''}"`,
                tx.amount || 0,
                `"${tx.branch || currentBranch}"`,
                `"${(tx.note || '').replace(/"/g, '""')}"`
            ]);
    } else if (type === 'stocktakes') {
        filename = `Phieu_kiem_kho_${currentBranch.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        headers = [
            'Mã phiếu kiểm',
            'Thời gian',
            'Chi nhánh',
            'Người kiểm',
            'Tổng thực tế',
            'Tổng chênh lệch',
            'Trạng thái',
            'Ghi chú'
        ];
        rows = (KVStore.data.stocktakes || [])
            .filter((st) => (st.branch || 'Kalo HCM') === currentBranch)
            .map((st) => [
                st.code,
                `"${st.time || ''}"`,
                `"${(st.branch || '').replace(/"/g, '""')}"`,
                `"${(st.cashier || '').replace(/"/g, '""')}"`,
                st.totalActual || 0,
                st.totalVariance || 0,
                st.status === 'balanced' ? 'Đã cân bằng' : 'Phiếu tạm',
                `"${(st.note || '').replace(/"/g, '""')}"`
            ]);
    } else if (type === 'transfers') {
        filename = `Phieu_chuyen_hang_${currentBranch.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        headers = [
            'Mã chuyển hàng',
            'Thời gian',
            'Chi nhánh gửi',
            'Chi nhánh nhận',
            'Người chuyển',
            'Tổng SL chuyển',
            'Tổng giá trị',
            'Trạng thái',
            'Ghi chú'
        ];
        rows = (KVStore.data.transfers || [])
            .filter((tf) => tf.fromBranch === currentBranch || tf.toBranch === currentBranch)
            .map((tf) => [
                tf.code,
                `"${tf.time || ''}"`,
                `"${(tf.fromBranch || '').replace(/"/g, '""')}"`,
                `"${(tf.toBranch || '').replace(/"/g, '""')}"`,
                `"${(tf.cashier || '').replace(/"/g, '""')}"`,
                tf.totalQty || 0,
                tf.totalValue || 0,
                tf.status === 'completed'
                    ? 'Đã nhận hàng'
                    : tf.status === 'shipping'
                      ? 'Đang chuyển'
                      : 'Đã hủy',
                `"${(tf.note || '').replace(/"/g, '""')}"`
            ]);
    }

    const csvRows = [headers.join(',')];
    rows.forEach((r) => csvRows.push(r.join(',')));
    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Đã xuất file ${filename} thành công!`, 'success');
}

// ==========================================
// 11. AUTHENTICATION & STAFF MANAGEMENT (RBAC)
// ==========================================

const ROLE_PRESETS = {
    admin: {
        name: 'Quản trị viên',
        permissions: {
            dashboard: true,
            pos: true,
            invoices: true,
            products: true,
            stocktakes: true,
            transfers: true,
            imports: true,
            suppliers: true,
            customers: true,
            cashbook: true,
            reports: true,
            users: true,
            settings: true
        }
    },
    manager: {
        name: 'Quản lý',
        permissions: {
            dashboard: true,
            pos: true,
            invoices: true,
            products: true,
            stocktakes: true,
            transfers: true,
            imports: true,
            suppliers: true,
            customers: true,
            cashbook: true,
            reports: true,
            users: false,
            settings: false
        }
    },
    cashier: {
        name: 'Thu ngân',
        permissions: {
            dashboard: true,
            pos: true,
            invoices: true,
            products: true,
            stocktakes: false,
            transfers: false,
            imports: false,
            suppliers: false,
            customers: true,
            cashbook: false,
            reports: false,
            users: false,
            settings: false
        }
    },
    warehouse: {
        name: 'Thủ kho',
        permissions: {
            dashboard: true,
            pos: false,
            invoices: false,
            products: true,
            stocktakes: true,
            transfers: true,
            imports: true,
            suppliers: true,
            customers: false,
            cashbook: false,
            reports: false,
            users: false,
            settings: false
        }
    },
    custom: {
        name: 'Tùy chỉnh',
        permissions: {}
    }
};

function getRoleDisplayName(role) {
    if (ROLE_PRESETS[role]) return ROLE_PRESETS[role].name;
    if (role === 'admin') return 'Quản trị viên';
    if (role === 'cashier') return 'Thu ngân';
    if (role === 'warehouse') return 'Thủ kho';
    if (role === 'manager') return 'Quản lý';
    return 'Nhân viên';
}

function getCurrentUser() {
    return KVStore.user;
}

function setCurrentUser(user) {
    KVStore.user = user;
}

function getCurrentCashierName() {
    return getCurrentUser()?.name || KVStore.data?.settings?.cashier || 'Trần Văn Nhất';
}

function hasPermission(permKey) {
    const user = getCurrentUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (!user.permissions) return false;
    return Boolean(user.permissions[permKey]);
}

function checkAuthOnStartup() {
    showLoginScreen(!KVStore.user);
}

function showLoginScreen(show) {
    const el = document.getElementById('login-screen');
    if (!el) return;
    if (show) {
        el.classList.remove('hidden');
        el.style.display = 'flex';
        document.getElementById('login-username')?.focus();
    } else {
        el.classList.add('hidden');
        el.style.display = 'none';
    }
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const errorEl = document.getElementById('login-error-msg');
    errorEl?.classList.add('hidden');
    try {
        await KVStore.login(
            document.getElementById('login-username').value,
            document.getElementById('login-password').value,
            document.getElementById('login-remember').checked
        );
        document.getElementById('login-password').value = '';
        showLoginScreen(false);
        applyUserPermissionsToUI();
        renderAllViews();
        renderCategorySelectOptions();
        navigateAfterLogin();
    } catch (error) {
        document.getElementById('login-error-text').textContent = error.message;
        errorEl?.classList.remove('hidden');
    }
}
function navigateAfterLogin() {
    const view = [
        'dashboard',
        'pos',
        'invoices',
        'products',
        'stocktakes',
        'transfers',
        'imports',
        'suppliers',
        'customers',
        'cashbook',
        'reports'
    ].find((p) => hasPermission(p));
    if (view) switchView(view);
}

function toggleLoginPasswordVisibility() {
    const pInput = document.getElementById('login-password');
    if (!pInput) return;
    if (pInput.type === 'password') {
        pInput.type = 'text';
    } else {
        pInput.type = 'password';
    }
}

async function handleLogout() {
    try {
        await KVStore.request('/api/logout', { method: 'POST', body: '{}' });
    } catch (error) {
        showToast('Chưa đăng xuất được trên máy chủ. Hãy kết nối lại và thử lại.', 'error');
        return;
    }
    KVStore.user = null;
    KVStore.data = copyData(defaultData);
    KVStore._base = copyData(defaultData);
    state.posTabs = [
        {
            id: 1,
            name: 'Hóa đơn 1',
            cart: [],
            customer: null,
            discount: 0,
            paymentMethod: 'cash',
            customerGiven: 0,
            note: ''
        }
    ];
    state.activePosTab = 0;
    renderAllViews();
    KVStore.showRecovery();
    toggleUserMenu(false);
    showLoginScreen(true);
}

function toggleUserMenu(force) {
    const menu = document.getElementById('user-dropdown-menu');
    if (!menu) return;
    if (typeof force === 'boolean') {
        if (force) menu.classList.remove('hidden');
        else menu.classList.add('hidden');
    } else {
        menu.classList.toggle('hidden');
    }
}

// Global click outside to dismiss user dropdown
window.addEventListener('click', (e) => {
    const wrapper = document.getElementById('user-menu-wrapper');
    const menu = document.getElementById('user-dropdown-menu');
    if (wrapper && menu && !wrapper.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

function applyUserPermissionsToUI() {
    const user = getCurrentUser();
    if (!user) return;

    // Header display
    const headerName = document.getElementById('header-user-name');
    if (headerName) headerName.textContent = user.name;
    const headerRole = document.getElementById('header-user-role');
    if (headerRole) headerRole.textContent = user.roleName || getRoleDisplayName(user.role);
    const headerAvatar = document.getElementById('header-user-avatar');
    if (headerAvatar) headerAvatar.textContent = (user.name || 'N').charAt(0).toUpperCase();

    // Dropdown display
    const dropName = document.getElementById('dropdown-user-name');
    if (dropName) dropName.textContent = user.name;
    const dropRole = document.getElementById('dropdown-user-role');
    if (dropRole) dropRole.textContent = user.roleName || getRoleDisplayName(user.role);
    const dropBranch = document.getElementById('dropdown-user-branch');
    const allowed = getUserAllowedBranches(user);
    if (dropBranch) {
        if (allowed.length > 1) {
            dropBranch.textContent = `Chi nhánh: ${getCurrentBranch()} (${allowed.length} CN)`;
        } else {
            dropBranch.textContent = `Chi nhánh: ${getCurrentBranch()}`;
        }
    }
    const dropAvatar = document.getElementById('dropdown-user-avatar');
    if (dropAvatar) dropAvatar.textContent = (user.name || 'N').charAt(0).toUpperCase();

    // POS displays
    const posCashier = document.getElementById('pos-cashier-name');
    if (posCashier) posCashier.textContent = user.name;
    const posHeaderUser = document.getElementById('pos-header-user-name');
    if (posHeaderUser) posHeaderUser.textContent = user.name;

    // Navigation Tabs Visibility Check
    const navDashboard = document.getElementById('nav-dashboard');
    if (navDashboard) navDashboard.style.display = hasPermission('dashboard') ? '' : 'none';

    const wrapHangHoa = document.getElementById('hanghoa-dropdown-wrapper');
    if (wrapHangHoa)
        wrapHangHoa.style.display =
            hasPermission('products') || hasPermission('stocktakes') || hasPermission('transfers')
                ? ''
                : 'none';

    const wrapMuaHang = document.getElementById('muahang-dropdown-wrapper');
    if (wrapMuaHang)
        wrapMuaHang.style.display =
            hasPermission('imports') || hasPermission('suppliers') ? '' : 'none';

    const navInvoices = document.getElementById('nav-invoices');
    if (navInvoices) navInvoices.style.display = hasPermission('invoices') ? '' : 'none';

    const navCustomers = document.getElementById('nav-customers');
    if (navCustomers) navCustomers.style.display = hasPermission('customers') ? '' : 'none';

    const navCashbook = document.getElementById('nav-cashbook');
    if (navCashbook) navCashbook.style.display = hasPermission('cashbook') ? '' : 'none';

    const navReports = document.getElementById('nav-reports');
    if (navReports) navReports.style.display = hasPermission('reports') ? '' : 'none';

    const posNavBtn = document.getElementById('pos-nav-btn');
    if (posNavBtn) posNavBtn.style.display = hasPermission('pos') ? '' : 'none';

    const btnSettings = document.getElementById('btn-header-settings');
    if (btnSettings) btnSettings.style.display = hasPermission('settings') ? '' : 'none';

    const btnStaffMgmt = document.getElementById('btn-menu-staff-mgmt');
    if (btnStaffMgmt) btnStaffMgmt.style.display = hasPermission('users') ? '' : 'none';

    // Synchronize top branch selector with user's branch & lock status
    renderBranchSelector();
}

function goToManagementFromPos() {
    if (hasPermission('dashboard')) {
        switchView('dashboard');
    } else if (hasPermission('invoices')) {
        switchView('invoices');
    } else if (hasPermission('products')) {
        switchView('products');
    } else if (hasPermission('stocktakes')) {
        switchView('stocktakes');
    } else if (hasPermission('transfers')) {
        switchView('transfers');
    } else if (hasPermission('imports')) {
        switchView('imports');
    } else if (hasPermission('customers')) {
        switchView('customers');
    } else if (hasPermission('cashbook')) {
        switchView('cashbook');
    } else if (hasPermission('reports')) {
        switchView('reports');
    } else {
        showToast('Bạn chỉ có quyền thao tác trên màn hình Bán hàng (POS)!', 'warning');
    }
}

// --- CHANGE PASSWORD ---
function openChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (!modal) return;
    document.getElementById('pwd-current').value = '';
    document.getElementById('pwd-new').value = '';
    document.getElementById('pwd-confirm').value = '';
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('pwd-current')?.focus(), 50);
}

async function handleChangePasswordSubmit(e) {
    e.preventDefault();
    const next = document.getElementById('pwd-new').value;
    if (next !== document.getElementById('pwd-confirm').value)
        throw new Error('Mật khẩu xác nhận không khớp.');
    await KVStore.request('/api/password', {
        method: 'POST',
        body: JSON.stringify({ current: document.getElementById('pwd-current').value, next })
    });
    KVStore.user = null;
    KVStore.data = copyData(defaultData);
    KVStore._base = copyData(defaultData);
    renderAllViews();
    KVStore.showRecovery();
    document.getElementById('change-password-modal').classList.add('hidden');
    showLoginScreen(true);
    showToast('Đã đổi mật khẩu. Vui lòng đăng nhập lại.', 'success');
}

// --- STAFF MANAGEMENT (MODAL & TABLE) ---
function openStaffModal() {
    if (!hasPermission('users')) {
        showToast('Bạn không có quyền quản lý nhân viên!', 'error');
        return;
    }
    const modal = document.getElementById('staff-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderStaffTable();
}

function renderStaffTable() {
    const tbody = document.getElementById('staff-table-tbody');
    if (!tbody) return;

    const query = (document.getElementById('staff-search-input')?.value || '').toLowerCase().trim();
    let users = KVStore.data?.users || [];

    if (query) {
        users = users.filter(
            (u) =>
                (u.name || '').toLowerCase().includes(query) ||
                (u.username || '').toLowerCase().includes(query) ||
                (u.phone || '').includes(query) ||
                (u.roleName || '').toLowerCase().includes(query)
        );
    }

    const countBadge = document.getElementById('staff-count-badge');
    if (countBadge) countBadge.textContent = `${users.length} nhân viên`;

    const currentUser = getCurrentUser();

    tbody.innerHTML = users
        .map((u) => {
            const isSelf =
                currentUser && (currentUser.id === u.id || currentUser.username === u.username);
            const isMasterAdmin = u.username === 'admin';

            let roleBadge = trustedHTML('<span class="kv-badge kv-badge-info">Nhân viên</span>');
            if (u.role === 'admin')
                roleBadge = trustedHTML(
                    '<span class="kv-badge kv-badge-info font-bold">👑 Quản trị viên</span>'
                );
            else if (u.role === 'cashier')
                roleBadge = trustedHTML(
                    '<span class="kv-badge kv-badge-success">🛍️ Thu ngân</span>'
                );
            else if (u.role === 'warehouse')
                roleBadge = trustedHTML(
                    '<span class="kv-badge kv-badge-warning">📦 Thủ kho</span>'
                );
            else if (u.role === 'manager')
                roleBadge = trustedHTML('<span class="kv-badge kv-badge-purple">🏢 Quản lý</span>');

            const statusBadge =
                u.status === 'locked'
                    ? trustedHTML('<span class="kv-badge kv-badge-danger">Tạm khóa</span>')
                    : trustedHTML('<span class="kv-badge kv-badge-success">Đang làm việc</span>');

            return renderHTML`
            <tr class="hover:bg-blue-50/40 transition-colors">
                <td class="py-2.5 px-3">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-full bg-blue-50 text-[#0066cc] font-bold text-xs flex items-center justify-center border border-blue-200/50 shadow-2xs">
                            ${(u.name || 'N').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="font-bold text-gray-900 flex items-center space-x-1.5">
                                <span>${u.name}</span>
                                ${trustedHTML(isSelf ? trustedHTML('<span class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-full font-bold">Tôi</span>') : '')}
                            </div>
                            <div class="text-[11px] text-gray-500 font-mono">${u.code || ''}</div>
                        </div>
                    </div>
                </td>
                <td class="py-2.5 px-3 font-mono font-semibold text-gray-800">${u.username}</td>
                <td class="py-2.5 px-3">${roleBadge}</td>
                <td class="py-2.5 px-3 font-medium text-gray-700">
                    ${trustedHTML(
                        (() => {
                            const userBranches =
                                Array.isArray(u.branches) && u.branches.length > 0
                                    ? u.branches
                                    : u.branch
                                      ? [u.branch]
                                      : ['Kalo HCM'];
                            let branchDisplay = escapeHTML(userBranches[0]);
                            if (userBranches.length > 1) {
                                branchDisplay += renderHTML` <span class="text-[10px] text-[#0066cc] bg-blue-50 border border-blue-200/60 font-bold px-1.5 py-0.5 rounded-full" title="${userBranches.join(', ')}">+${userBranches.length - 1}</span>`;
                            }
                            return branchDisplay;
                        })()
                    )}
                </td>
                <td class="py-2.5 px-3 font-mono text-gray-600">${u.phone || '-'}</td>
                <td class="py-2.5 px-3 text-center">${statusBadge}</td>
                <td class="py-2.5 px-3 text-center">
                    <div class="flex items-center justify-center space-x-1.5">
                        <button onclick="openStaffFormModal('${u.id}')" class="px-2 py-1 rounded-lg bg-gray-100 hover:bg-[#0066cc] hover:text-white text-gray-700 font-medium text-[11.5px] transition shadow-2xs" title="Chỉnh sửa thông tin & phân quyền">Sửa</button>
                        ${trustedHTML(
                            !isSelf && !isMasterAdmin
                                ? renderHTML`
                            <button onclick="toggleStaffStatus('${u.id}')" class="px-2 py-1 rounded-lg ${u.status === 'locked' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white'} font-medium text-[11.5px] transition shadow-2xs">
                                ${u.status === 'locked' ? 'Mở' : 'Khóa'}
                            </button>
                            <button onclick="deleteStaff('${u.id}')" class="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white font-medium text-[11.5px] transition shadow-2xs" title="Xóa nhân viên">Xóa</button>
                        `
                                : ''
                        )}
                    </div>
                </td>
            </tr>
        `;
        })
        .join('');
}

function renderStaffBranchesCheckboxes(selectedBranches = []) {
    const container = document.getElementById('staff-branches-checkbox-list');
    if (!container) return;
    const branches = KVStore.data?.branches || [];
    container.innerHTML = branches
        .map((b) => {
            const isChecked = selectedBranches.includes(b.name);
            return renderHTML`
            <label class="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-white cursor-pointer transition text-[12.5px] font-medium text-gray-800">
                <input type="checkbox" name="staff-branch-cb" value="${b.name}" ${isChecked ? 'checked' : ''} onchange="updateToggleAllBranchesButton()" class="rounded text-[#0066cc] focus:ring-0">
                <span class="flex items-center space-x-1.5">
                    <span>🏢</span>
                    <span>${b.name}</span>
                </span>
            </label>
        `;
        })
        .join('');
    updateToggleAllBranchesButton();
}

function toggleSelectAllStaffBranches() {
    const cbs = document.querySelectorAll('input[name="staff-branch-cb"]');
    const allChecked = Array.from(cbs).every((cb) => cb.checked);
    cbs.forEach((cb) => (cb.checked = !allChecked));
    updateToggleAllBranchesButton();
}

function updateToggleAllBranchesButton() {
    const btn = document.getElementById('btn-toggle-all-branches');
    if (!btn) return;
    const cbs = document.querySelectorAll('input[name="staff-branch-cb"]');
    const allChecked = cbs.length > 0 && Array.from(cbs).every((cb) => cb.checked);
    btn.textContent = allChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả';
}

function openStaffFormModal(staffId = null) {
    const modal = document.getElementById('staff-form-modal');
    if (!modal) return;

    const idInput = document.getElementById('staff-form-id');
    const nameInput = document.getElementById('staff-input-name');
    const phoneInput = document.getElementById('staff-input-phone');
    const usernameInput = document.getElementById('staff-input-username');
    const pwdInput = document.getElementById('staff-input-password');
    const pwdNote = document.getElementById('staff-pwd-note');
    const roleSelect = document.getElementById('staff-input-role');
    const titleEl = document.getElementById('staff-form-title');

    if (staffId) {
        // Edit mode
        const user = (KVStore.data?.users || []).find((u) => u.id === staffId);
        if (!user) return;

        titleEl.textContent = `Chỉnh sửa nhân viên: ${user.name}`;
        idInput.value = user.id;
        nameInput.value = user.name || '';
        phoneInput.value = user.phone || '';
        usernameInput.value = user.username || '';
        usernameInput.readOnly = user.username === 'admin';
        pwdInput.value = '';
        if (pwdNote) pwdNote.textContent = '(Để trống nếu giữ nguyên)';
        if (roleSelect) roleSelect.value = user.role || 'custom';

        const selectedBranches =
            Array.isArray(user.branches) && user.branches.length > 0
                ? user.branches
                : user.branch
                  ? [user.branch]
                  : ['Kalo HCM'];
        renderStaffBranchesCheckboxes(selectedBranches);

        // Status radio
        const statusRadios = document.querySelectorAll('input[name="staff-status"]');
        statusRadios.forEach((r) => (r.checked = r.value === user.status));

        // Permissions
        const perms = user.permissions || {};
        [
            'dashboard',
            'pos',
            'invoices',
            'products',
            'stocktakes',
            'transfers',
            'imports',
            'suppliers',
            'customers',
            'cashbook',
            'reports',
            'users',
            'settings'
        ].forEach((k) => {
            const cb = document.getElementById(`perm-${k}`);
            if (cb) cb.checked = Boolean(perms[k] ?? user.role === 'admin');
        });
    } else {
        // Create mode
        titleEl.textContent = 'Thêm nhân viên mới';
        idInput.value = '';
        nameInput.value = '';
        phoneInput.value = '';
        usernameInput.value = '';
        usernameInput.readOnly = false;
        pwdInput.value = '';
        if (pwdNote) pwdNote.textContent = '(*) Từ 8 đến 1024 ký tự';
        if (roleSelect) roleSelect.value = 'cashier';

        renderStaffBranchesCheckboxes([getCurrentBranch()]);

        const statusRadios = document.querySelectorAll('input[name="staff-status"]');
        statusRadios.forEach((r) => (r.checked = r.value === 'active'));

        onRolePresetChange('cashier');
    }

    modal.classList.remove('hidden');
    setTimeout(() => nameInput?.focus(), 50);
}

function onRolePresetChange(role) {
    const preset = ROLE_PRESETS[role];
    if (!preset) return;
    const perms = preset.permissions;
    [
        'dashboard',
        'pos',
        'invoices',
        'products',
        'stocktakes',
        'transfers',
        'imports',
        'suppliers',
        'customers',
        'cashbook',
        'reports',
        'users',
        'settings'
    ].forEach((k) => {
        const cb = document.getElementById(`perm-${k}`);
        if (cb) cb.checked = Boolean(perms[k]);
    });
}

async function saveStaffSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('staff-form-id').value;
    const name = document.getElementById('staff-input-name').value.trim();
    const phone = document.getElementById('staff-input-phone').value.trim();
    const username = document.getElementById('staff-input-username').value.trim().toLowerCase();
    const password = document.getElementById('staff-input-password').value;
    const role = document.getElementById('staff-input-role').value;
    const status = document.querySelector('input[name="staff-status"]:checked')?.value || 'active';

    const selectedBranches = Array.from(
        document.querySelectorAll('input[name="staff-branch-cb"]:checked')
    ).map((cb) => cb.value);
    if (selectedBranches.length === 0) {
        showToast('Vui lòng chọn ít nhất một chi nhánh làm việc cho nhân viên!', 'warning');
        return;
    }

    if (!KVStore.data.users) KVStore.data.users = JSON.parse(JSON.stringify(defaultData.users));
    const users = KVStore.data.users;

    // Check duplicate username
    const duplicate = users.find((u) => u.username.toLowerCase() === username && u.id !== id);
    if (duplicate) {
        showToast(`Tên đăng nhập "${username}" đã tồn tại! Vui lòng chọn tên khác.`, 'error');
        return;
    }

    // Collect permissions
    const permissions = {};
    [
        'dashboard',
        'pos',
        'invoices',
        'products',
        'stocktakes',
        'transfers',
        'imports',
        'suppliers',
        'customers',
        'cashbook',
        'reports',
        'users',
        'settings'
    ].forEach((k) => {
        const cb = document.getElementById(`perm-${k}`);
        permissions[k] = cb ? cb.checked : false;
    });
    permissions.users = role === 'admin' || Boolean(document.getElementById('perm-users')?.checked);

    const roleName = getRoleDisplayName(role);
    const primaryBranch = selectedBranches[0];

    if (id) {
        // Update
        const target = users.find((u) => u.id === id);
        if (target) {
            target.name = name;
            target.phone = phone;
            target.username = username;
            if (password) target.password = password;
            target.branch = primaryBranch;
            target.branches = selectedBranches;
            target.role = role;
            target.roleName = roleName;
            target.status = status;
            target.permissions = permissions;

            // If updating current user
            const current = getCurrentUser();
            if (current && (current.id === id || current.username === username)) {
                // Session permissions are refreshed from the server after save.
                applyUserPermissionsToUI();
            }
        }
    } else {
        // Create new
        const newCode = makeCode('NV');
        const newStaff = {
            id: newCode,
            code: newCode,
            name,
            username,
            password: password,
            phone,
            role,
            roleName,
            branch: primaryBranch,
            branches: selectedBranches,
            status,
            permissions
        };
        users.push(newStaff);
    }

    await KVStore.save();
    applyUserPermissionsToUI();
    document.getElementById('staff-form-modal').classList.add('hidden');
    renderStaffTable();
    showToast(`Đã lưu nhân viên "${name}" thành công!`, 'success');
}

async function toggleStaffStatus(staffId) {
    const users = KVStore.data?.users || [];
    const target = users.find((u) => u.id === staffId);
    if (!target) return;

    const current = getCurrentUser();
    if (current && current.id === staffId) {
        showToast('Không thể khóa tài khoản đang đăng nhập!', 'warning');
        return;
    }

    target.status = target.status === 'locked' ? 'active' : 'locked';
    await KVStore.save();
    renderStaffTable();
    showToast(
        `Đã ${target.status === 'locked' ? 'khóa' : 'mở khóa'} tài khoản ${target.name}`,
        'info'
    );
}

async function deleteStaff(staffId) {
    const users = KVStore.data?.users || [];
    const target = users.find((u) => u.id === staffId);
    if (!target) return;

    const current = getCurrentUser();
    if (current && current.id === staffId) {
        showToast('Không thể xóa tài khoản của chính bạn!', 'warning');
        return;
    }
    if (target.username === 'admin') {
        showToast('Không thể xóa tài khoản Quản trị viên gốc!', 'error');
        return;
    }

    if (
        confirm(
            `Bạn có chắc chắn muốn xóa nhân viên "${target.name}" (${target.username}) khỏi hệ thống?`
        )
    ) {
        KVStore.data.users = users.filter((u) => u.id !== staffId);
        await KVStore.save();
        renderStaffTable();
        showToast(`Đã xóa nhân viên ${target.name} thành công!`, 'success');
    }
}

function invoiceLineNet(inv, item) {
    if (item.netTotal != null) return item.netTotal;
    const subtotal = inv.items.reduce((sum, i) => sum + i.qty * i.price, 0);
    return subtotal ? Math.round((item.qty * item.price * inv.total) / subtotal) : 0;
}
function guardMutation(fn) {
    return async function (...args) {
        if (args[0]?.preventDefault) args[0].preventDefault();
        if (KVStore._busy) {
            showToast('Đang lưu giao dịch trước. Vui lòng chờ.', 'warning');
            return;
        }
        if (!KVStore.user) {
            showLoginScreen(true);
            return;
        }
        KVStore._busy = true;
        KVStore._successMessage = null;
        let succeeded = false;
        const branch = getCurrentBranch();
        try {
            const result = await fn(...args);
            succeeded = true;
            return result;
        } catch (error) {
            KVStore.data = copyData(KVStore._base);
            KVStore.data.settings.branch = branch;
            renderAllViews();
            showToast(error.message, 'error');
        } finally {
            KVStore._busy = false;
            if (succeeded && KVStore._successMessage) showToast(KVStore._successMessage, 'success');
            KVStore._successMessage = null;
        }
    };
}
checkoutPos = guardMutation(checkoutPos);
cancelInvoice = guardMutation(cancelInvoice);
submitReturnGoods = guardMutation(submitReturnGoods);
saveNewImport = guardMutation(saveNewImport);
collectCustomerDebt = guardMutation(collectCustomerDebt);
saveNewReceipt = guardMutation(saveNewReceipt);
saveNewPayment = guardMutation(saveNewPayment);
saveTransfer = guardMutation(saveTransfer);
confirmReceiveTransfer = guardMutation(confirmReceiveTransfer);
saveStocktake = guardMutation(saveStocktake);
balanceDraftStocktake = guardMutation(balanceDraftStocktake);
saveBranchFromModal = guardMutation(saveBranchFromModal);
saveProductFromModal = guardMutation(saveProductFromModal);
deleteProduct = guardMutation(deleteProduct);
saveCategoryFromModal = guardMutation(saveCategoryFromModal);
saveCustomerFromModal = guardMutation(saveCustomerFromModal);
deleteCustomer = guardMutation(deleteCustomer);
saveSupplierFromModal = guardMutation(saveSupplierFromModal);
deleteSupplier = guardMutation(deleteSupplier);
saveSettingsFromModal = guardMutation(saveSettingsFromModal);
saveStaffSubmit = guardMutation(saveStaffSubmit);
toggleStaffStatus = guardMutation(toggleStaffStatus);
deleteStaff = guardMutation(deleteStaff);
handleChangePasswordSubmit = guardMutation(handleChangePasswordSubmit);
forceSyncDatabase = guardMutation(forceSyncDatabase);

// Start on load
window.addEventListener('DOMContentLoaded', initApp);
