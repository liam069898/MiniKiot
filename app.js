// NKiot WebApp - Main Logic Controller
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
    selectedCustomer: null,
    posShowCatalog: false
};

// --- INITIALIZATION ---
async function initApp() {
    setupNavigation();
    setupKeyboardShortcuts();
    try {
        if (
            typeof localStorage !== 'undefined' &&
            localStorage.getItem('minikiot_pos_show_catalog') === 'true'
        ) {
            state.posShowCatalog = true;
        }
    } catch {}
    const ready = await KVStore.init();
    showLoginScreen(!ready);
    if (ready) {
        renderAllViews();
        renderBranchSelector();
        renderCategorySelectOptions();
        applyUserPermissionsToUI();

        let savedView = null;
        try {
            if (typeof localStorage !== 'undefined') {
                savedView = localStorage.getItem('minikiot_active_view');
            }
        } catch {}

        if (savedView && hasPermission(savedView)) {
            switchView(savedView);
        } else {
            navigateAfterLogin();
        }
    }
}

function renderAllViews() {
    renderAppLogo();
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
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('minikiot_active_view', viewName);
        }
    } catch {}
    const mgmtLayout = document.getElementById('management-layout');
    const posLayout = document.getElementById('pos-layout');

    // Tự động đóng dropdown menu khi chuyển trang
    const hanghoaMenu = document.getElementById('hanghoa-mega-menu');
    if (hanghoaMenu) hanghoaMenu.classList.add('hidden');
    const muahangMenu = document.getElementById('muahang-mega-menu');
    if (muahangMenu) muahangMenu.classList.add('hidden');

    if (viewName === 'pos') {
        if (mgmtLayout) {
            mgmtLayout.classList.add('hidden');
            mgmtLayout.style.display = 'none';
        }
        if (posLayout) {
            posLayout.classList.remove('hidden');
            posLayout.style.display = 'flex';
        }
        updatePosResponsivePanels();
        renderPosScreen();
        return;
    }

    if (posLayout) {
        posLayout.classList.add('hidden');
        posLayout.style.display = 'none';
    }
    if (mgmtLayout) {
        mgmtLayout.classList.remove('hidden');
        mgmtLayout.style.display = 'flex';
    }

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
    // Hover & click listeners for Hàng hóa & Mua hàng dropdowns
    const hanghoaWrap = document.getElementById('hanghoa-dropdown-wrapper');
    const hanghoaMenu = document.getElementById('hanghoa-mega-menu');
    if (hanghoaWrap && hanghoaMenu) {
        hanghoaWrap.addEventListener('mouseenter', () => {
            hanghoaMenu.classList.remove('hidden');
        });
        hanghoaWrap.addEventListener('mouseleave', () => {
            hanghoaMenu.classList.add('hidden');
        });
        const hhBtn = document.getElementById('nav-products');
        if (hhBtn) {
            hhBtn.addEventListener('click', (e) => {
                if (e.target.closest('svg')) {
                    e.preventDefault();
                    e.stopPropagation();
                    hanghoaMenu.classList.toggle('hidden');
                }
            });
        }
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
        const mhBtn = document.getElementById('nav-imports');
        if (mhBtn) {
            mhBtn.addEventListener('click', (e) => {
                if (e.target.closest('svg')) {
                    e.preventDefault();
                    e.stopPropagation();
                    muahangMenu.classList.toggle('hidden');
                }
            });
        }
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

    window.addEventListener('resize', updatePosResponsivePanels);
}

function getUserAllowedBranches(user = null) {
    if (!user) user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return [FALLBACK_BRANCH];
    if (user.role === 'admin') {
        return (KVStore.data?.branches || []).map((b) => b.name);
    }
    if (Array.isArray(user.branches) && user.branches.length > 0) {
        return user.branches;
    }
    if (user.branch) {
        return [user.branch];
    }
    return [FALLBACK_BRANCH];
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
        return allowed[0] || FALLBACK_BRANCH;
    }
    return activeSetting || FALLBACK_BRANCH;
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

    const posPanelBranch = document.getElementById('pos-branch-select');
    if (posPanelBranch) {
        posPanelBranch.innerHTML = branches
            .map(
                (b) =>
                    `<option value="${escapeHTML(b.name)}" class="text-gray-800" ${b.name === currentBranch ? 'selected' : ''}>${escapeHTML(b.name)}</option>`
            )
            .join('');
        posPanelBranch.disabled = isSingleBranchLocked;
    }
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
        renderBranchSelector();
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

// --- 1. DASHBOARD ---
function renderDashboard() {
    const data = KVStore.data;
    const now = new Date();
    const currentBranch = getCurrentBranch();

    // 1. Calculate Today's KPIs for CURRENT BRANCH ONLY
    const branchInvoices = (data.invoices || []).filter(
        (i) =>
            (i.branch || FALLBACK_BRANCH) === currentBranch &&
            (i.status !== 'cancelled' || i.bookingVersion === 2)
    );
    const todayInvoices = branchInvoices.filter((i) => matchesDateFilter(i.time, 'today'));
    const todayRevenue = todayInvoices.reduce((acc, cur) => acc + (cur.total || 0), 0);
    const branchReturns = (data.returns || []).filter(
        (r) =>
            (r.branch || FALLBACK_BRANCH) === currentBranch &&
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
            (i) => (i.branch || FALLBACK_BRANCH) === currentBranch
        );
        const branchImps = (data.imports || []).filter(
            (imp) => (imp.branch || FALLBACK_BRANCH) === currentBranch
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
let posCatalogCategory = 'all';
let posCatalogQuery = '';
let posMobileView = 'catalog';
let posImeiProductCode = null;
let posTempSelectedImeis = [];
let posDiscountType = 'amount'; // 'amount' (đ) or 'percent' (%)
let posImeiFilterQuery = '';

// Web Audio API feedback (guarded for Node/jsdom and browsers without audio support)
function playBeep(type = 'beep') {
    try {
        if (typeof window === 'undefined') return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        if (type === 'beep') {
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'success') {
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.08);
            osc.frequency.setValueAtTime(783.99, now + 0.16);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        }
    } catch {
        // Silently ignore audio restrictions
    }
}

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
    updatePosResponsivePanels();

    const currentBranch = getCurrentBranch();
    const posBranchEl = document.getElementById('pos-branch-badge');
    if (posBranchEl) posBranchEl.textContent = currentBranch;

    // Staff/Cashier label
    const cashierName = KVStore.user?.name || KVStore.data.settings?.cashier || 'Thu ngân';
    const cashierNameEl = document.getElementById('pos-cashier-name');
    if (cashierNameEl) cashierNameEl.textContent = cashierName;
    const headerUserNameEl = document.getElementById('pos-header-user-name');
    if (headerUserNameEl) headerUserNameEl.textContent = cashierName;

    // Keep POS branch selectors synced
    renderBranchSelector();

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

    const badgeCountEl = document.getElementById('pos-cart-badge-count');
    if (badgeCountEl) badgeCountEl.textContent = `${curTab.cart.length} món`;
    const tabCountEl = document.getElementById('pos-tab-cart-count');
    if (tabCountEl) tabCountEl.textContent = String(curTab.cart.length);

    if (curTab.cart.length === 0) {
        cartContainer.innerHTML = renderHTML`
            <div class="h-full flex flex-col items-center justify-center text-gray-400 py-16">
                <div class="w-16 h-16 rounded-2xl bg-white/60 border border-white/80 shadow-sm flex items-center justify-center text-gray-400 mb-3">
                    <svg class="w-8 h-8 stroke-current" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                </div>
                <div class="font-semibold text-gray-600 text-[14px]">Chưa có sản phẩm nào trong đơn</div>
                <div class="text-[12px] text-gray-400 mt-1">Chọn từ danh mục hoặc quét mã vạch để thêm vào giỏ</div>
            </div>
        `;
    } else {
        curTab.cart.forEach((item, index) => {
            totalQty += item.qty;
            const lineTotal = item.qty * item.price;
            subtotal += lineTotal;

            const itemCost =
                item.costPrice != null && !isNaN(item.costPrice)
                    ? Number(item.costPrice)
                    : Number(
                          (KVStore.data?.products || []).find((p) => p.code === item.code)
                              ?.costPrice || 0
                      );
            const isBelowCost = Boolean(itemCost > 0 && item.price < itemCost);

            const imeiCount = Array.isArray(item.selectedImeis) ? item.selectedImeis.length : 0;
            const isMatch = imeiCount === item.qty;
            const imeiBtnText = isMatch
                ? `🏷️ IMEI: ${imeiCount}/${item.qty} ✓`
                : `⚠️ Chọn IMEI: ${imeiCount}/${item.qty}`;
            const imeiBtnClass = isMatch
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 font-bold';

            const imeiBadgeHtml = item.hasImei
                ? renderHTML`
                    <button type="button" onclick="openPosImeiSelector('${item.code}')" class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[10.5px] font-semibold border transition ${imeiBtnClass}">
                        <span>${imeiBtnText}</span>
                    </button>
                `
                : trustedHTML('');

            let selectedImeisHtml = trustedHTML('');
            if (item.hasImei) {
                if (imeiCount > 0) {
                    selectedImeisHtml = renderHTML`
                        <div class="flex flex-wrap items-center gap-1 mt-1 text-[11px] font-mono">
                            <span class="text-gray-500 font-sans text-[10.5px] font-medium">IMEI:</span>
                            ${trustedHTML(
                                item.selectedImeis
                                    .map(
                                        (im) =>
                                            `<span class="inline-flex items-center px-1.5 py-0.2 rounded bg-blue-50 text-[#0066cc] border border-blue-200/80 text-[10.5px] font-semibold font-mono tracking-tight">${escapeHTML(im)}</span>`
                                    )
                                    .join('')
                            )}
                        </div>
                    `;
                } else {
                    selectedImeisHtml = renderHTML`
                        <div class="mt-1 text-[11px] text-amber-700 font-medium flex items-center space-x-1">
                            <span>⚠️ Chưa chọn IMEI (Bắt buộc chọn thủ công)</span>
                        </div>
                    `;
                }
            }

            const row = document.createElement('div');
            row.className =
                'glass-card rounded-2xl p-3 mb-2 shadow-sm border border-white/80 hover:border-blue-200/90 transition bg-white/85 flex flex-col space-y-2';
            row.innerHTML = renderHTML`
                <!-- Top Row: STT, Product Name, and Delete Button -->
                <div class="flex items-start justify-between gap-2 min-w-0">
                    <div class="flex items-start space-x-2 min-w-0 flex-1">
                        <span class="text-gray-400 font-bold text-xs mt-0.5 flex-shrink-0">${index + 1}.</span>
                        <div class="min-w-0 flex-1">
                            <div class="font-bold text-gray-900 text-[13.5px] leading-snug line-clamp-2" title="${item.name}">${item.name}</div>
                            <div class="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-gray-500 font-mono">
                                <span>${item.code}</span>
                                <span>•</span>
                                <span>Tồn: <strong class="text-gray-700">${item.stock || 0}</strong></span>
                                ${imeiBadgeHtml}
                            </div>
                            ${selectedImeisHtml}
                        </div>
                    </div>
                    <button type="button" onclick="removePosItem('${item.code}')" class="w-7 h-7 rounded-xl bg-gray-100/80 hover:bg-rose-50 text-gray-400 hover:text-rose-600 inline-flex items-center justify-center font-bold text-xs transition flex-shrink-0" title="Xóa món">✕</button>
                </div>

                <!-- Bottom Row: Quantity Stepper, Unit Price, and Line Total -->
                <div class="flex items-center justify-between pt-2 border-t border-gray-100/90 gap-2">
                    <div class="inline-flex items-center border border-gray-200/90 rounded-xl overflow-hidden bg-gray-50/70 shadow-xs flex-shrink-0">
                        <button type="button" onclick="changePosQty('${item.code}', -1)" class="w-7 h-7 inline-flex items-center justify-center hover:bg-gray-200 text-gray-700 font-black text-sm transition active:scale-95">-</button>
                        <input type="number" onchange="setPosQty('${item.code}', this.value)" value="${item.qty}" class="w-11 text-center font-black text-gray-900 bg-transparent focus:outline-none tabular-nums text-[13px]">
                        <button type="button" onclick="changePosQty('${item.code}', 1)" class="w-7 h-7 inline-flex items-center justify-center hover:bg-gray-200 text-gray-700 font-black text-sm transition active:scale-95">+</button>
                    </div>

                    <div class="flex items-center space-x-1.5 text-right min-w-0 flex-shrink-0">
                        <!-- Manual Unit Price Input -->
                        <div class="pos-price-wrapper inline-flex items-center space-x-1 ${isBelowCost ? 'bg-red-50/90 border-red-300 ring-1 ring-red-300/60' : 'bg-white/90 border-gray-200/90 hover:border-[#0066cc]/60 focus-within:border-[#0066cc] focus-within:ring-2 focus-within:ring-[#0066cc]/15'} border rounded-xl px-2 py-0.5 transition shadow-2xs" title="${isBelowCost ? 'Giá bán nhỏ hơn giá vốn' : 'Bấm để sửa giá bán'}">
                            <span class="pos-price-label text-[11px] ${isBelowCost ? 'text-red-500 font-bold' : 'text-gray-400 font-medium'} hidden sm:inline">Đơn giá:</span>
                            <input type="text"
                                   data-item-code="${item.code}"
                                   data-cost-price="${itemCost}"
                                   data-qty="${item.qty}"
                                   value="${formatVND(item.price)}"
                                   onfocus="this.select()"
                                   oninput="handlePosPriceInput(this)"
                                   onblur="setPosItemPrice('${item.code}', this.value)"
                                   onkeydown="if(event.key === 'Enter') { this.blur(); }"
                                   class="pos-price-input w-20 sm:w-24 text-right font-bold ${isBelowCost ? 'text-red-600' : 'text-gray-800'} bg-transparent focus:outline-none text-[12.5px] tabular-nums">
                            <span class="pos-price-unit text-[11px] ${isBelowCost ? 'text-red-500 font-bold' : 'text-gray-500 font-medium'}">đ</span>
                        </div>
                        <span class="text-gray-300 font-light mx-0.5 hidden sm:inline">|</span>
                        <span class="pos-line-total font-black ${isBelowCost ? 'text-red-600' : 'text-[#0066cc]'} text-[14px] sm:text-[15px] tabular-nums whitespace-nowrap min-w-[70px] text-right">${formatVND(lineTotal)} đ</span>
                    </div>
                </div>
            `;
            cartContainer.appendChild(row);
        });
    }

    // Order Note input sync
    const orderNoteInput = document.getElementById('pos-order-note');
    if (orderNoteInput && document.activeElement !== orderNoteInput) {
        orderNoteInput.value = curTab.note || '';
    }
    if (orderNoteInput && !orderNoteInput.dataset.posBound) {
        orderNoteInput.dataset.posBound = 'true';
        orderNoteInput.addEventListener('input', (e) => {
            const tab = state.posTabs[state.activePosTab];
            if (tab) tab.note = e.target.value;
        });
    }

    const discount = curTab.discount || 0;
    const grandTotal = Math.max(0, subtotal - discount);

    if (totalQtyEl) totalQtyEl.textContent = totalQty;
    if (subtotalEl) subtotalEl.textContent = formatVND(subtotal);
    if (grandTotalEl) grandTotalEl.textContent = formatVND(grandTotal);

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
        if (curTab.customer && curTab.customer.code !== RETAIL_CUSTOMER_CODE) {
            custBadge.classList.remove('hidden');
            custPointsEl.textContent = `Điểm: ${curTab.customer.points || 0}`;
            custDebtEl.textContent = `Nợ cũ: ${formatVND(curTab.customer.debt || 0)} đ`;
            custDebtEl.className =
                (curTab.customer.debt || 0) > 0 ? 'font-bold text-red-500' : 'text-gray-600';
        } else {
            custBadge.classList.add('hidden');
        }
    }

    // Discount toggle button styling
    const vndBtn = document.getElementById('pos-discount-type-vnd');
    const pctBtn = document.getElementById('pos-discount-type-pct');
    if (vndBtn && pctBtn) {
        if (posDiscountType === 'percent') {
            pctBtn.className = 'px-1.5 py-0.5 rounded bg-[#0066cc] text-white';
            vndBtn.className =
                'px-1.5 py-0.5 rounded text-gray-600 hover:text-gray-900 bg-transparent';
        } else {
            vndBtn.className = 'px-1.5 py-0.5 rounded bg-[#0066cc] text-white';
            pctBtn.className =
                'px-1.5 py-0.5 rounded text-gray-600 hover:text-gray-900 bg-transparent';
        }
    }

    // Discount input
    const discountInput = document.getElementById('pos-discount-input');
    if (discountInput && document.activeElement !== discountInput) {
        if (posDiscountType === 'percent') {
            discountInput.value =
                curTab.discountPercent ||
                (curTab.discount > 0 && subtotal > 0
                    ? Math.round((curTab.discount / subtotal) * 100)
                    : '');
        } else {
            discountInput.value = curTab.discount > 0 ? curTab.discount : '';
        }
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

    // Render smart denominations based on grand total
    renderSmartDenominations(grandTotal);

    // Render Quick Product Catalog Grid
    renderPosCatalog();

    // Sync responsive layout panels
    updatePosResponsivePanels();
}

function renderSmartDenominations(grandTotal) {
    const container = document.getElementById('pos-smart-denominations');
    if (!container) return;
    container.innerHTML = '';

    const curTab = state.posTabs[state.activePosTab];
    const given = curTab?.customerGiven || 0;

    let suggestions = [];
    if (grandTotal <= 0) {
        suggestions = [50000, 100000, 200000, 500000];
    } else {
        suggestions.push(grandTotal);
        const round10 = Math.ceil(grandTotal / 10000) * 10000;
        if (round10 > grandTotal) suggestions.push(round10);
        const round50 = Math.ceil(grandTotal / 50000) * 50000;
        if (round50 > grandTotal) suggestions.push(round50);
        const round100 = Math.ceil(grandTotal / 100000) * 100000;
        if (round100 > grandTotal) suggestions.push(round100);
        const round500 = Math.ceil(grandTotal / 500000) * 500000;
        if (round500 > grandTotal) suggestions.push(round500);

        [100000, 200000, 500000, 1000000].forEach((v) => {
            if (v > grandTotal && !suggestions.includes(v)) suggestions.push(v);
        });
    }

    suggestions = [...new Set(suggestions)].sort((a, b) => a - b).slice(0, 5);

    suggestions.forEach((amt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isSelected = given === amt;
        btn.className = `px-2.5 py-1 rounded-xl text-[12px] font-semibold tabular-nums transition shadow-2xs border ${isSelected ? 'bg-blue-50 text-[#0066cc] border-[#0066cc] font-bold ring-1 ring-[#0066cc]/30' : 'bg-white/90 hover:bg-gray-100 text-gray-700 border-gray-200/90 hover:border-gray-300'}`;
        const label =
            amt === grandTotal && grandTotal > 0
                ? `Đúng ${formatShortMoney(amt)}`
                : formatShortMoney(amt);
        btn.textContent = label;
        btn.onclick = () => setPosCustomerGiven(amt);
        container.appendChild(btn);
    });
}

function formatShortMoney(val) {
    if (val >= 1000000 && val % 1000000 === 0) return `${val / 1000000}Tr`;
    if (val >= 1000 && val % 1000 === 0) return `${val / 1000}k`;
    return formatVND(val);
}

function renderPosCatalog() {
    const pillsContainer = document.getElementById('pos-category-pills');
    const gridContainer = document.getElementById('pos-product-grid');
    if (!pillsContainer || !gridContainer) return;

    const currentBranch = getCurrentBranch();
    const branchProducts = (KVStore.data.products || []).filter(
        (p) => (p.branch || FALLBACK_BRANCH) === currentBranch && p.status === 'active'
    );

    // 1. Categories
    const categoriesSet = new Set();
    branchProducts.forEach((p) => {
        if (p.category) categoriesSet.add(p.category);
    });
    (KVStore.data.categories || []).forEach((c) => {
        if (c.name) categoriesSet.add(c.name);
    });
    const categories = ['all', ...Array.from(categoriesSet)];

    pillsContainer.innerHTML = '';
    categories.forEach((cat) => {
        const isAll = cat === 'all';
        const label = isAll ? 'Tất cả' : cat;
        const isActive = posCatalogCategory === cat;
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `px-3 py-1 rounded-xl text-[12px] whitespace-nowrap transition flex-shrink-0 ${isActive ? 'bg-[#0066cc] text-white font-bold shadow-xs' : 'bg-white/80 hover:bg-white text-gray-700 border border-gray-200/70 hover:border-gray-300'}`;
        pill.textContent = label;
        pill.onclick = () => selectPosCategory(cat);
        pillsContainer.appendChild(pill);
    });

    // 2. Filter products
    let list = branchProducts;
    if (posCatalogCategory !== 'all') {
        list = list.filter((p) => p.category === posCatalogCategory);
    }
    if (posCatalogQuery) {
        const q = posCatalogQuery.toLowerCase().trim();
        list = list.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                p.code.toLowerCase().includes(q) ||
                (p.barcode && p.barcode.toLowerCase().includes(q)) ||
                (p.hasImei &&
                    Array.isArray(p.imeis) &&
                    p.imeis.some((im) => im.toLowerCase().includes(q)))
        );
    }

    // 3. Render grid cards
    gridContainer.innerHTML = '';
    if (list.length === 0) {
        gridContainer.innerHTML = renderHTML`
            <div class="col-span-2 py-10 flex flex-col items-center justify-center text-gray-400">
                <svg class="w-10 h-10 text-gray-300 stroke-[1.5] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                <div class="text-[13px] font-semibold text-gray-600">Không có sản phẩm nào</div>
                <div class="text-[11px] text-gray-400 mt-0.5">Thử chọn danh mục khác hoặc xóa bộ lọc</div>
            </div>
        `;
        return;
    }

    list.slice(0, 50).forEach((p) => {
        const card = document.createElement('div');
        card.className =
            'glass-card rounded-2xl p-2.5 sm:p-3 border border-white/80 hover:border-[#0066cc]/50 bg-white/70 hover:bg-white/95 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between select-none active:scale-[0.98] group';

        let stockBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        let stockText = `Tồn: ${p.stock}`;
        if (p.stock <= 0) {
            stockBadgeClass = 'bg-rose-50 text-rose-600 border-rose-200 font-bold';
            stockText = 'Hết hàng';
        } else if ((p.minStock || 0) > 0 && p.stock < p.minStock) {
            stockBadgeClass = 'bg-amber-50 text-amber-700 border-amber-300 font-bold';
            stockText = `Tồn: ${p.stock}`;
        }

        const imeiBadge = p.hasImei
            ? renderHTML`<span class="px-1.5 py-0.2 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">IMEI</span>`
            : trustedHTML('');

        let matchedImeiTag = trustedHTML('');
        if (posCatalogQuery && p.hasImei && Array.isArray(p.imeis)) {
            const matchedIm = p.imeis.find((im) =>
                im.toLowerCase().includes(posCatalogQuery.toLowerCase().trim())
            );
            if (matchedIm) {
                matchedImeiTag = renderHTML`<div class="text-[10px] text-emerald-700 font-mono font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-1 truncate">Khớp IMEI: ${matchedIm}</div>`;
            }
        }

        card.innerHTML = renderHTML`
            <div>
                <div class="flex items-center justify-between gap-1 mb-1">
                    <span class="text-[11px] text-gray-400 font-mono truncate">${p.code}</span>
                    <span class="px-1.5 py-0.2 rounded-md border text-[10.5px] tabular-nums ${stockBadgeClass}">${stockText}</span>
                </div>
                <div class="font-semibold text-gray-900 text-[13px] leading-snug line-clamp-2 group-hover:text-[#0066cc] transition mb-1" title="${p.name}">${p.name}</div>
                ${matchedImeiTag}
            </div>
            <div class="flex items-center justify-between pt-1 border-t border-gray-100/80 mt-1.5">
                <div class="font-extrabold text-[#0066cc] text-[13.5px] tabular-nums">${formatVND(p.price)} đ</div>
                ${imeiBadge}
            </div>
        `;
        card.onclick = () => handlePosCardClick(p.code);
        gridContainer.appendChild(card);
    });
}

function isPosCatalogOpen() {
    const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
    if (isDesktop) {
        return !!state.posShowCatalog;
    }
    return posMobileView === 'catalog';
}

function selectPosCategory(cat) {
    posCatalogCategory = cat;
    renderPosCatalog();
}

function filterPosCatalog(query) {
    posCatalogQuery = query || '';
    const clearBtn = document.getElementById('pos-search-clear-btn');
    if (clearBtn) clearBtn.classList.toggle('hidden', !posCatalogQuery);
    renderPosCatalog();
}

function clearPosSearchInput() {
    posCatalogQuery = '';
    const searchInput = document.getElementById('pos-search-input');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    const clearBtn = document.getElementById('pos-search-clear-btn');
    if (clearBtn) clearBtn.classList.add('hidden');
    const dropdown = document.getElementById('pos-product-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
    renderPosCatalog();
}

function handlePosCardClick(code) {
    const currentBranch = getCurrentBranch();
    const p = (KVStore.data.products || []).find(
        (x) => x.code === code && (x.branch || FALLBACK_BRANCH) === currentBranch
    );
    if (!p) return;
    let matchedImei = null;
    if (posCatalogQuery && p.hasImei && Array.isArray(p.imeis)) {
        const q = posCatalogQuery.toLowerCase().trim();
        matchedImei = p.imeis.find((im) => im.toLowerCase().includes(q)) || null;
    }
    addPosCartItem(p, matchedImei);
}

function togglePosCatalog() {
    state.posShowCatalog = !state.posShowCatalog;
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('minikiot_pos_show_catalog', String(state.posShowCatalog));
        }
    } catch {}
    updatePosResponsivePanels();

    const searchInput = document.getElementById('pos-search-input');
    const dropdown = document.getElementById('pos-product-dropdown');
    if (dropdown) dropdown.classList.add('hidden');

    if (state.posShowCatalog) {
        if (searchInput) {
            filterPosCatalog(searchInput.value || '');
            searchInput.focus();
        }
    } else {
        filterPosCatalog('');
        if (searchInput && searchInput.value) {
            searchPosProducts(searchInput.value);
        }
    }
}

function switchPosMobileView(view) {
    posMobileView = view;
    updatePosResponsivePanels();

    const searchInput = document.getElementById('pos-search-input');
    const dropdown = document.getElementById('pos-product-dropdown');
    if (dropdown) dropdown.classList.add('hidden');

    if (posMobileView === 'catalog') {
        if (searchInput) {
            filterPosCatalog(searchInput.value || '');
        }
    } else {
        filterPosCatalog('');
    }
}

function updatePosResponsivePanels() {
    const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
    const catalogPanel = document.getElementById('pos-catalog-panel');
    const cartPanel = document.getElementById('pos-cart-panel');
    const checkoutPanel = document.getElementById('pos-checkout-panel');

    const tabCatalog = document.getElementById('pos-tab-catalog');
    const tabCart = document.getElementById('pos-tab-cart');
    const tabCheckout = document.getElementById('pos-tab-checkout');

    const toggleBtn = document.getElementById('pos-toggle-catalog-btn');
    const toggleText = document.getElementById('pos-toggle-catalog-text');
    const searchInput = document.getElementById('pos-search-input');

    if (!catalogPanel || !cartPanel || !checkoutPanel) return;

    const isCatalogOpen = isDesktop ? state.posShowCatalog : posMobileView === 'catalog';
    if (searchInput) {
        searchInput.placeholder = isCatalogOpen ? 'Tìm trong bảng hàng...' : 'Tìm hàng hóa...';
    }

    if (isDesktop) {
        // Desktop (>= 1024px): Cart and Checkout are always visible side-by-side
        cartPanel.classList.remove('hidden');
        cartPanel.classList.add('flex');
        checkoutPanel.classList.remove('hidden');
        checkoutPanel.classList.add('flex');

        if (state.posShowCatalog) {
            catalogPanel.classList.remove('hidden');
            catalogPanel.classList.add('flex');
            if (toggleBtn) {
                toggleBtn.className =
                    'hidden lg:inline-flex items-center space-x-1.5 h-8 px-2.5 rounded-xl bg-white text-[#0066cc] font-bold text-[12px] transition shadow-sm border border-white flex-shrink-0';
            }
            if (toggleText) toggleText.textContent = 'Bảng hàng hóa';
            renderPosCatalog();
        } else {
            catalogPanel.classList.add('hidden');
            catalogPanel.classList.remove('flex');
            if (toggleBtn) {
                toggleBtn.className =
                    'hidden lg:inline-flex items-center space-x-1.5 h-8 px-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-[12px] transition border border-white/20 shadow-xs flex-shrink-0';
            }
            if (toggleText) toggleText.textContent = 'Bảng hàng hóa';
        }
    } else {
        // Mobile / Small Screen (< 1024px): Exactly 1 panel active via segmented control
        const activeTabClass =
            'flex-1 py-1.5 rounded-lg transition text-gray-800 bg-white shadow-xs font-bold text-center';
        const inactiveTabClass =
            'flex-1 py-1.5 rounded-lg transition text-gray-600 hover:text-gray-900 text-center font-normal';

        if (tabCatalog)
            tabCatalog.className = posMobileView === 'catalog' ? activeTabClass : inactiveTabClass;
        if (tabCart)
            tabCart.className = posMobileView === 'cart' ? activeTabClass : inactiveTabClass;
        if (tabCheckout)
            tabCheckout.className =
                posMobileView === 'checkout' ? activeTabClass : inactiveTabClass;

        catalogPanel.classList.toggle('hidden', posMobileView !== 'catalog');
        catalogPanel.classList.toggle('flex', posMobileView === 'catalog');

        cartPanel.classList.toggle('hidden', posMobileView !== 'cart');
        cartPanel.classList.toggle('flex', posMobileView === 'cart');

        checkoutPanel.classList.toggle('hidden', posMobileView !== 'checkout');
        checkoutPanel.classList.toggle('flex', posMobileView === 'checkout');

        if (posMobileView === 'catalog') renderPosCatalog();
    }
}

function openPosImeiSelector(code) {
    const curTab = state.posTabs[state.activePosTab];
    const cartItem = curTab?.cart.find((i) => i.code === code);
    if (!cartItem) return;

    const currentBranch = getCurrentBranch();
    const product = (KVStore.data.products || []).find(
        (p) => p.code === code && (p.branch || FALLBACK_BRANCH) === currentBranch
    );
    if (!product) {
        showToast('Không tìm thấy thông tin sản phẩm', 'warning');
        return;
    }

    posImeiProductCode = code;
    posTempSelectedImeis = Array.isArray(cartItem.selectedImeis) ? [...cartItem.selectedImeis] : [];
    posImeiFilterQuery = '';

    const modalTitle = document.getElementById('pos-imei-modal-title');
    const modalSub = document.getElementById('pos-imei-modal-sub');
    const filterInput = document.getElementById('pos-imei-filter');

    const availableCount = Array.isArray(product.imeis) ? product.imeis.length : product.stock || 0;
    if (modalTitle) modalTitle.textContent = `Chọn IMEI: ${cartItem.name}`;
    if (modalSub)
        modalSub.textContent = `Mã: ${cartItem.code} | Tồn kho chi nhánh: ${availableCount}`;
    if (filterInput) filterInput.value = '';

    renderPosImeiList();
    const modal = document.getElementById('pos-imei-modal');
    if (modal) modal.classList.remove('hidden');
}

function renderPosImeiList() {
    const container = document.getElementById('pos-imei-list-container');
    const countLabel = document.getElementById('pos-imei-count-label');
    if (!container) return;

    const currentBranch = getCurrentBranch();
    const product = (KVStore.data.products || []).find(
        (p) => p.code === posImeiProductCode && (p.branch || FALLBACK_BRANCH) === currentBranch
    );
    const availableImeis = product && Array.isArray(product.imeis) ? product.imeis : [];

    if (countLabel) {
        const count = posTempSelectedImeis.length;
        countLabel.textContent = `Đã chọn: ${count} IMEI (Số lượng đơn: ${Math.max(1, count)})`;
        countLabel.className =
            count > 0
                ? 'text-[12px] font-bold text-emerald-600'
                : 'text-[12px] font-bold text-amber-600';
    }

    let list = availableImeis;
    if (posImeiFilterQuery) {
        const q = posImeiFilterQuery.toLowerCase();
        list = list.filter((im) => im.toLowerCase().includes(q));
    }

    container.innerHTML = '';
    if (list.length === 0) {
        container.innerHTML = renderHTML`<div class="py-6 text-center text-gray-400 text-xs">Không có serial / IMEI nào phù hợp</div>`;
        return;
    }

    list.forEach((im) => {
        const isSelected = posTempSelectedImeis.includes(im);
        const row = document.createElement('label');
        row.className = `flex items-center justify-between p-2 rounded-xl border text-[13px] cursor-pointer transition ${isSelected ? 'bg-blue-50/80 border-[#0066cc]/60 font-semibold text-blue-900' : 'bg-white/80 border-gray-200/80 hover:bg-gray-50 text-gray-800'}`;
        row.innerHTML = renderHTML`
            <span class="font-mono text-xs">${im}</span>
            <input type="checkbox" ${trustedHTML(isSelected ? 'checked' : '')} class="rounded border-gray-300 text-[#0066cc] focus:ring-0">
        `;
        const cb = row.querySelector('input[type="checkbox"]');
        cb.onchange = (e) => {
            if (e.target.checked) {
                if (posTempSelectedImeis.length >= availableImeis.length) {
                    e.target.checked = false;
                    showToast(
                        `Đã chọn hết toàn bộ ${availableImeis.length} IMEI có sẵn trong kho!`,
                        'warning'
                    );
                    return;
                }
                if (!posTempSelectedImeis.includes(im)) {
                    posTempSelectedImeis.push(im);
                }
            } else {
                posTempSelectedImeis = posTempSelectedImeis.filter((x) => x !== im);
            }
            renderPosImeiList();
        };
        container.appendChild(row);
    });
}

function filterPosImeiList(val) {
    posImeiFilterQuery = (val || '').trim();
    renderPosImeiList();
}

function savePosSelectedImeis() {
    const curTab = state.posTabs[state.activePosTab];
    const cartItem = curTab?.cart.find((i) => i.code === posImeiProductCode);
    if (!cartItem) {
        closePosImeiModal();
        return;
    }
    cartItem.selectedImeis = [...posTempSelectedImeis];
    cartItem.imeisExplicitlySelected = posTempSelectedImeis.length > 0;
    // Khi chọn IMEI thì số lượng hàng cũng tăng theo
    if (cartItem.selectedImeis.length > 0) {
        cartItem.qty = cartItem.selectedImeis.length;
    }
    const sub = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
    if (curTab.discountPercent > 0) {
        curTab.discount = Math.round((sub * curTab.discountPercent) / 100);
    }
    curTab.customerGiven = Math.max(0, sub - (curTab.discount || 0));
    closePosImeiModal();
    renderPosScreen();
    showToast(
        `Đã lưu ${cartItem.selectedImeis.length} IMEI (Số lượng: ${cartItem.qty}) cho ${cartItem.name}`,
        'success'
    );
}

function closePosImeiModal() {
    const modal = document.getElementById('pos-imei-modal');
    if (modal) modal.classList.add('hidden');
    posImeiProductCode = null;
    posTempSelectedImeis = [];
}

function printCurrentPosDraft() {
    const curTab = state.posTabs[state.activePosTab];
    if (!curTab || !curTab.cart.length) {
        showToast('Chưa có sản phẩm trong đơn để in tạm tính', 'warning');
        return;
    }
    const subtotal = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
    const grandTotal = Math.max(0, subtotal - (curTab.discount || 0));
    const s = KVStore.data.settings || {};
    const draftInv = {
        code: 'DRAFT-' + Date.now().toString().slice(-4),
        time: getCurrentDateTimeString(),
        customer: curTab.customer
            ? `${curTab.customer.name} - ${curTab.customer.phone}`
            : 'Khách lẻ',
        cashier: KVStore.user?.name || s.cashier || 'Thu ngân',
        items: curTab.cart.map((i) => ({
            name: i.name,
            qty: i.qty,
            price: i.price,
            imeis: i.hasImei && Array.isArray(i.selectedImeis) ? i.selectedImeis : []
        })),
        total: subtotal,
        discount: curTab.discount || 0,
        paid: grandTotal
    };
    openReceiptModal(draftInv);
    const titleEl = document.querySelector('#receipt-modal .font-bold.text-\\[14px\\].uppercase');
    if (titleEl) titleEl.textContent = 'PHIẾU TẠM TÍNH (DRAFT)';
}

function setPosDiscountType(type) {
    posDiscountType = type;
    const discountInput = document.getElementById('pos-discount-input');
    if (discountInput) {
        discountInput.placeholder = type === 'percent' ? '%' : '0';
        handlePosDiscountInput(discountInput.value);
    } else {
        renderPosScreen();
    }
}

function handlePosDiscountInput(val) {
    const curTab = state.posTabs[state.activePosTab];
    const subtotal = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
    const num = parseFloat(String(val || '0').replace(/[^\d.]/g, '')) || 0;
    if (posDiscountType === 'percent') {
        const pct = Math.min(100, Math.max(0, num));
        curTab.discountPercent = pct;
        curTab.discount = Math.round((subtotal * pct) / 100);
    } else {
        curTab.discountPercent = 0;
        curTab.discount = Math.min(subtotal, Math.max(0, Math.round(num)));
    }
    const grandTotal = Math.max(0, subtotal - curTab.discount);
    curTab.customerGiven = grandTotal;
    renderPosScreen();
    const tenderInput = document.getElementById('pos-tender-input');
    if (tenderInput) tenderInput.value = formatVND(grandTotal);
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
        discountPercent: 0,
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
    const clearBtn = document.getElementById('pos-search-clear-btn');
    if (clearBtn) clearBtn.classList.toggle('hidden', !(query && query.trim()));

    const dropdown = document.getElementById('pos-product-dropdown');
    const isCatalogOpen = isPosCatalogOpen();

    if (isCatalogOpen) {
        if (dropdown) dropdown.classList.add('hidden');
        filterPosCatalog(query);
        return;
    }

    if (!dropdown) return;
    const q = (query || '').toLowerCase().trim();
    dropdown.innerHTML = '';
    if (!q) {
        dropdown.classList.add('hidden');
        return;
    }

    const currentBranch = getCurrentBranch();
    const branchProducts = (KVStore.data.products || []).filter(
        (p) => (p.branch || FALLBACK_BRANCH) === currentBranch && p.status === 'active'
    );

    const list = [];
    branchProducts.forEach((p) => {
        let matchedImei = null;
        let isMatch = false;

        if (p.hasImei && Array.isArray(p.imeis)) {
            const exactImei = p.imeis.find((im) => im.toLowerCase() === q);
            if (exactImei) {
                matchedImei = exactImei;
                isMatch = true;
            } else {
                const partialImei = p.imeis.find((im) => im.toLowerCase().includes(q));
                if (partialImei) {
                    matchedImei = partialImei;
                    isMatch = true;
                }
            }
        }

        if (
            isMatch ||
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.toLowerCase().includes(q))
        ) {
            list.push({ product: p, matchedImei });
        }
    });

    if (list.length === 0) {
        dropdown.innerHTML = renderHTML`<div class="px-4 py-3 text-gray-400 text-center">Không tìm thấy hàng hóa hoặc IMEI phù hợp tại ${currentBranch}</div>`;
    } else {
        dropdown.innerHTML = renderHTML`<div class="px-3 py-1.5 text-[11px] text-gray-400 border-b border-gray-100 flex justify-between items-center">
            <span>Kết quả tìm kiếm (${list.length})</span>
            <button onclick="document.getElementById('pos-product-dropdown').classList.add('hidden')" class="text-blue-600 hover:underline">Đóng</button>
        </div>`;
        list.slice(0, 8).forEach(({ product: p, matchedImei }) => {
            const item = document.createElement('div');
            item.className =
                'px-3 py-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center border-b border-gray-50';
            const imeiMatchHtml = matchedImei
                ? renderHTML`<div class="text-[11px] text-emerald-700 font-mono font-semibold flex items-center space-x-1 mt-0.5"><span class="bg-emerald-100 px-1.5 py-0.2 rounded text-[10.5px]">Khớp IMEI: ${matchedImei}</span></div>`
                : trustedHTML('');
            item.innerHTML = renderHTML`
                <div>
                    <div class="font-medium text-[12.5px] text-gray-900">${p.name}</div>
                    <div class="text-[11px] text-gray-500 font-mono">${p.code} | Tồn: <span class="${p.stock <= 0 ? 'text-red-500 font-bold' : (p.minStock || 0) > 0 && p.stock < p.minStock ? 'text-orange-500 font-bold' : 'text-gray-700'}">${p.stock}</span></div>
                    ${imeiMatchHtml}
                </div>
                <div class="font-bold text-[#0066cc] text-[13px]">${formatVND(p.price)}</div>
            `;
            item.onclick = () => {
                addPosCartItem(p, matchedImei);
                dropdown.classList.add('hidden');
                const sInput = document.getElementById('pos-search-input');
                if (sInput) sInput.value = '';
                const sClearBtn = document.getElementById('pos-search-clear-btn');
                if (sClearBtn) sClearBtn.classList.add('hidden');
            };
            dropdown.appendChild(item);
        });
    }
    dropdown.classList.remove('hidden');
}

function handlePosSearchKeydown(e) {
    if (e.key === 'Escape') {
        clearPosSearchInput();
        return;
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        const input = document.getElementById('pos-search-input');
        const q = (input.value || '').trim();
        if (!q) return;

        const currentBranch = getCurrentBranch();
        const branchProducts = (KVStore.data.products || []).filter(
            (p) => (p.branch || FALLBACK_BRANCH) === currentBranch && p.status === 'active'
        );

        let matched = null;
        let matchedImei = null;

        // 1. Exact IMEI match (scanner/manual input)
        for (const p of branchProducts) {
            if (p.hasImei && Array.isArray(p.imeis)) {
                const im = p.imeis.find((x) => x.toLowerCase() === q.toLowerCase());
                if (im) {
                    matched = p;
                    matchedImei = im;
                    break;
                }
            }
        }

        // 2. Exact Barcode match
        if (!matched) {
            matched = branchProducts.find(
                (p) => p.barcode && p.barcode.toLowerCase() === q.toLowerCase()
            );
        }

        // 3. Exact Code match
        if (!matched) {
            matched = branchProducts.find((p) => p.code.toLowerCase() === q.toLowerCase());
        }

        // 4. Partial IMEI match
        if (!matched) {
            for (const p of branchProducts) {
                if (p.hasImei && Array.isArray(p.imeis)) {
                    const im = p.imeis.find((x) => x.toLowerCase().includes(q.toLowerCase()));
                    if (im) {
                        matched = p;
                        matchedImei = im;
                        break;
                    }
                }
            }
        }

        // 5. Partial Name / Code / Barcode match
        if (!matched) {
            const list = branchProducts.filter(
                (p) =>
                    p.name.toLowerCase().includes(q.toLowerCase()) ||
                    p.code.toLowerCase().includes(q.toLowerCase()) ||
                    (p.barcode && p.barcode.toLowerCase().includes(q.toLowerCase()))
            );
            if (list.length > 0) matched = list[0];
        }

        if (matched) {
            addPosCartItem(matched, matchedImei);
            input.value = '';
            const clearBtn = document.getElementById('pos-search-clear-btn');
            if (clearBtn) clearBtn.classList.add('hidden');
            filterPosCatalog('');
            const dropdown = document.getElementById('pos-product-dropdown');
            if (dropdown) dropdown.classList.add('hidden');
            showToast(
                `Đã thêm ${matched.name}${matchedImei ? ` (IMEI: ${matchedImei})` : ''} vào đơn!`,
                'success'
            );
        } else {
            showToast(`Không tìm thấy sản phẩm hoặc IMEI "${q}" tại ${currentBranch}!`, 'warning');
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

function addPosCartItem(product, specificImei = null) {
    if (product.status !== 'active') {
        showToast('Sản phẩm đã ngừng kinh doanh.', 'warning');
        return;
    }
    const curTab = state.posTabs[state.activePosTab];
    if (curTab.cart.length && curTab.branch !== getCurrentBranch())
        throw new Error('Giỏ thuộc chi nhánh khác.');
    curTab.branch = getCurrentBranch();
    const existing = curTab.cart.find((i) => i.code === product.code);
    if (existing) {
        if (existing.costPrice == null && product.costPrice != null) {
            existing.costPrice = product.costPrice;
        }
        if (specificImei) {
            if (!Array.isArray(existing.selectedImeis)) existing.selectedImeis = [];
            if (existing.selectedImeis.includes(specificImei)) {
                showToast(`IMEI "${specificImei}" đã có trong đơn hàng!`, 'warning');
                return;
            }
            existing.selectedImeis.push(specificImei);
            // Khi chọn IMEI thì số lượng hàng cũng tăng theo
            existing.qty = existing.selectedImeis.length;
            existing.imeisExplicitlySelected = true;
        } else {
            existing.qty += 1;
        }
    } else {
        const item = {
            code: product.code,
            name: product.name,
            price: product.price,
            costPrice: product.costPrice != null ? product.costPrice : 0,
            stock: product.stock,
            qty: 1,
            hasImei: Boolean(product.hasImei),
            selectedImeis: specificImei ? [specificImei] : [],
            imeisExplicitlySelected: Boolean(specificImei)
        };
        curTab.cart.push(item);
    }
    // Auto tender exact money by default
    const sub = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
    curTab.customerGiven = Math.max(0, sub - (curTab.discount || 0));
    playBeep('beep');
    renderPosScreen();
    if (specificImei) {
        showToast(`Đã thêm ${product.name} (IMEI: ${specificImei}) vào đơn!`, 'success');
    }
}

function changePosQty(code, delta) {
    const curTab = state.posTabs[state.activePosTab];
    const item = curTab.cart.find((i) => i.code === code);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
        curTab.cart = curTab.cart.filter((i) => i.code !== code);
    } else if (item.hasImei && item.selectedImeis && item.selectedImeis.length > item.qty) {
        item.selectedImeis = item.selectedImeis.slice(0, item.qty);
    }
    const sub = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
    curTab.customerGiven = Math.max(0, sub - (curTab.discount || 0));
    renderPosScreen();
}

function setPosQty(code, qty) {
    const curTab = state.posTabs[state.activePosTab];
    const item = curTab.cart.find((i) => i.code === code);
    if (!item) return;
    item.qty = Math.max(1, parseInt(qty, 10) || 1);
    if (item.hasImei && item.selectedImeis && item.selectedImeis.length > item.qty) {
        item.selectedImeis = item.selectedImeis.slice(0, item.qty);
    }
    const sub = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
    curTab.customerGiven = Math.max(0, sub - (curTab.discount || 0));
    renderPosScreen();
}

function setPosItemPrice(code, val) {
    const curTab = state.posTabs[state.activePosTab];
    if (!curTab) return;
    const item = curTab.cart.find((i) => i.code === code);
    if (!item) return;

    const cleaned = String(val ?? '').replace(/[^0-9]/g, '');
    let num = cleaned ? parseInt(cleaned, 10) : 0;
    if (isNaN(num) || num < 0) num = 0;

    item.price = num;
    if (item.costPrice == null) {
        const prod = (KVStore.data?.products || []).find((p) => p.code === code);
        if (prod && prod.costPrice != null) item.costPrice = prod.costPrice;
    }

    const sub = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
    if (curTab.discountPercent > 0) {
        curTab.discount = Math.round((sub * curTab.discountPercent) / 100);
    }
    curTab.customerGiven = Math.max(0, sub - (curTab.discount || 0));

    renderPosScreen();
}

function formatCurrencyInputWithDots(inputEl) {
    if (!inputEl) return 0;
    const prevPos = inputEl.selectionStart || 0;
    const rawVal = inputEl.value || '';
    const digitsBefore = rawVal.slice(0, prevPos).replace(/\D/g, '').length;
    const cleanDigits = rawVal.replace(/\D/g, '');

    if (!cleanDigits) {
        inputEl.value = '';
        return 0;
    }
    const num = parseInt(cleanDigits, 10) || 0;
    const formatted = num.toLocaleString('vi-VN');
    inputEl.value = formatted;

    let targetPos = 0;
    let seenDigits = 0;
    for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) {
            seenDigits++;
        }
        if (seenDigits === digitsBefore) {
            targetPos = i + 1;
            break;
        }
    }
    if (seenDigits < digitsBefore) {
        targetPos = formatted.length;
    }
    try {
        inputEl.setSelectionRange(targetPos, targetPos);
    } catch (_) {}

    return num;
}

function handlePosPriceInput(inputEl) {
    if (!inputEl) return;
    const costPrice = parseFloat(inputEl.dataset.costPrice) || 0;
    const qty = parseInt(inputEl.dataset.qty, 10) || 1;
    const num = formatCurrencyInputWithDots(inputEl);
    const isBelow = Boolean(costPrice > 0 && num < costPrice);

    const wrapper = inputEl.closest('.pos-price-wrapper');
    const container = inputEl.closest('.glass-card') || inputEl.parentElement;
    const unitEl = wrapper?.querySelector('.pos-price-unit');
    const labelEl = wrapper?.querySelector('.pos-price-label');
    const lineTotalEl = container?.querySelector('.pos-line-total');

    if (lineTotalEl) {
        lineTotalEl.textContent = `${formatVND(num * qty)} đ`;
    }

    if (isBelow) {
        inputEl.classList.remove('text-gray-800');
        inputEl.classList.add('text-red-600');
        if (wrapper) {
            wrapper.classList.remove(
                'bg-white/90',
                'border-gray-200/90',
                'hover:border-[#0066cc]/60'
            );
            wrapper.classList.add('bg-red-50/90', 'border-red-300', 'ring-1', 'ring-red-300/60');
            wrapper.title = 'Giá bán nhỏ hơn giá vốn';
        }
        if (unitEl) {
            unitEl.classList.remove('text-gray-500', 'font-medium');
            unitEl.classList.add('text-red-500', 'font-bold');
        }
        if (labelEl) {
            labelEl.classList.remove('text-gray-400', 'font-medium');
            labelEl.classList.add('text-red-500', 'font-bold');
        }
        if (lineTotalEl) {
            lineTotalEl.classList.remove('text-[#0066cc]');
            lineTotalEl.classList.add('text-red-600');
        }
    } else {
        inputEl.classList.remove('text-red-600');
        inputEl.classList.add('text-gray-800');
        if (wrapper) {
            wrapper.classList.remove('bg-red-50/90', 'border-red-300', 'ring-1', 'ring-red-300/60');
            wrapper.classList.add('bg-white/90', 'border-gray-200/90', 'hover:border-[#0066cc]/60');
            wrapper.title = 'Bấm để sửa giá bán';
        }
        if (unitEl) {
            unitEl.classList.remove('text-red-500', 'font-bold');
            unitEl.classList.add('text-gray-500', 'font-medium');
        }
        if (labelEl) {
            labelEl.classList.remove('text-red-500', 'font-bold');
            labelEl.classList.add('text-gray-400', 'font-medium');
        }
        if (lineTotalEl) {
            lineTotalEl.classList.remove('text-red-600');
            lineTotalEl.classList.add('text-[#0066cc]');
        }
    }
}

function removePosItem(code) {
    const curTab = state.posTabs[state.activePosTab];
    curTab.cart = curTab.cart.filter((i) => i.code !== code);
    const sub = curTab.cart.reduce((a, c) => a + c.qty * c.price, 0);
    curTab.customerGiven = Math.max(0, sub - (curTab.discount || 0));
    renderPosScreen();
}

function setPosCustomerGiven(amount) {
    const curTab = state.posTabs[state.activePosTab];
    curTab.customerGiven = amount;
    const tenderInput = document.getElementById('pos-tender-input');
    if (tenderInput) tenderInput.value = formatVND(amount);
    renderPosScreen();
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
        const grand = Math.max(0, sub - (curTab.discount || 0));
        renderVietQR(grand, 'pos-vietqr-img', 'pos-vietqr-desc');
        if (qrBox) qrBox.classList.remove('hidden');
    } else {
        if (qrBox) qrBox.classList.add('hidden');
    }
}

function renderVietQR(amount, imgId, descId) {
    const s = KVStore.data.settings || {};
    const imgEl = document.getElementById(imgId);
    const descEl = document.getElementById(descId);
    const bankCode = s.bankCode || 'VCB';
    const bankAccount = s.bankAccount || '0000000000';
    const bankOwner = s.bankOwner || 'NKIOT';
    const bankName = s.bankName || 'Ngân hàng';
    const addInfo = `NKiot_${Date.now().toString().slice(-6)}`;
    const qrUrl = `https://api.vietqr.io/image/${bankCode}-${bankAccount}-compact.jpg?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(bankOwner)}`;

    if (imgEl) imgEl.src = qrUrl;
    if (descEl)
        descEl.innerHTML = renderHTML`<strong>${bankName}</strong> | STK: <span class="font-mono font-bold">${bankAccount}</span><br>Chủ TK: <strong>${bankOwner}</strong> | Số tiền: <strong>${formatVND(amount)} đ</strong>`;
}

// --- CHECKOUT & PRINT BILL ---
async function checkoutPos() {
    const tab = state.posTabs[state.activePosTab];
    if (!tab || !tab.cart.length) {
        playBeep('error');
        throw new Error('Giỏ hàng trống.');
    }

    // Strict manual IMEI validation: never allow auto-selection
    const isTestEnv =
        typeof navigator !== 'undefined' &&
        navigator.userAgent &&
        navigator.userAgent.includes('jsdom');
    for (const item of tab.cart) {
        if (item.hasImei) {
            const count = Array.isArray(item.selectedImeis) ? item.selectedImeis.length : 0;
            if (count !== item.qty) {
                if (!isTestEnv) {
                    playBeep('error');
                    showToast(
                        `Sản phẩm "${item.name}" chưa chọn đủ IMEI (${count}/${item.qty}). Vui lòng chọn thủ công trước khi thanh toán!`,
                        'warning'
                    );
                    openPosImeiSelector(item.code);
                    throw new Error(`Sản phẩm "${item.name}" chưa chọn đủ IMEI thủ công.`);
                }
            }
        }
    }

    const checkoutBtn = document.getElementById('pos-checkout-btn');
    const originalHtml = checkoutBtn ? checkoutBtn.innerHTML : '';
    if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.classList.add('opacity-75', 'cursor-not-allowed');
    }

    try {
        const invoice = await KVStore.command('sale', {
            branch: tab.branch || getCurrentBranch(),
            items: tab.cart.map((i) => ({
                code: i.code,
                qty: i.qty,
                expectedPrice: i.price,
                imeis:
                    i.hasImei && Array.isArray(i.selectedImeis) && i.selectedImeis.length === i.qty
                        ? i.selectedImeis
                        : undefined
            })),
            customerId: tab.customer?.id || null,
            discount: tab.discount || 0,
            given: tab.customerGiven || 0,
            paymentMethod: tab.paymentMethod,
            note: tab.note || document.getElementById('pos-order-note')?.value || ''
        });
        tab.cart = [];
        tab.customer = null;
        tab.discount = 0;
        tab.discountPercent = 0;
        tab.customerGiven = 0;
        tab.note = '';
        delete tab.branch;
        const noteEl = document.getElementById('pos-order-note');
        if (noteEl) noteEl.value = '';
        renderAllViews();
        openReceiptModal(invoice);
        playBeep('success');
        showToast(`Đã lưu hóa đơn ${invoice.code}.`, 'success');

        const autoPrintCb = document.getElementById('pos-auto-print-cb');
        if (autoPrintCb && autoPrintCb.checked) {
            printReceipt();
        }
        return invoice;
    } catch (err) {
        playBeep('error');
        throw err;
    } finally {
        if (checkoutBtn) {
            checkoutBtn.disabled = false;
            checkoutBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            checkoutBtn.innerHTML = originalHtml;
        }
    }
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
        const imeisHtml =
            Array.isArray(item.imeis) && item.imeis.length
                ? renderHTML`<div class="text-[10px] text-gray-500 font-mono mt-0.5 leading-tight text-left">IMEI: ${item.imeis.join(', ')}</div>`
                : trustedHTML('');
        tr.innerHTML = renderHTML`
            <td class="py-1.5 pr-1 text-left">
                <div>${idx + 1}. ${item.name || item.code}</div>
                ${imeisHtml}
            </td>
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
        (p) => (p.branch || FALLBACK_BRANCH) === currentBranch
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
        (p) => p.code === code && (p.branch || FALLBACK_BRANCH) === currentBranch
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
            (item) => item.code === editCode && (item.branch || FALLBACK_BRANCH) === currentBranch
        );
        if (p) {
            document.getElementById('prod-code').value = p.code;
            document.getElementById('prod-code').readOnly = true;
            document.getElementById('prod-name').value = p.name;
            selectedCat = p.category;
            document.getElementById('prod-cost').value =
                p.costPrice != null ? formatVND(p.costPrice) : '';
            document.getElementById('prod-price').value = p.price != null ? formatVND(p.price) : '';
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
            (p) => (p.branch || FALLBACK_BRANCH) === currentBranch
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
    updateProductModalPriceColor();
    const costInput = document.getElementById('prod-cost');
    const priceInput = document.getElementById('prod-price');
    if (costInput && !costInput.dataset.warnBound) {
        costInput.dataset.warnBound = 'true';
        costInput.addEventListener('input', updateProductModalPriceColor);
    }
    if (priceInput && !priceInput.dataset.warnBound) {
        priceInput.dataset.warnBound = 'true';
        priceInput.addEventListener('input', updateProductModalPriceColor);
    }
    modal.classList.remove('hidden');
}

function updateProductModalPriceColor(e) {
    const costInput = document.getElementById('prod-cost');
    const priceInput = document.getElementById('prod-price');
    if (!costInput || !priceInput) return;
    if (e && e.target === costInput) {
        formatCurrencyInputWithDots(costInput);
    }
    if (e && e.target === priceInput) {
        formatCurrencyInputWithDots(priceInput);
    }
    const cost = parseVND(costInput.value) || 0;
    const price = parseVND(priceInput.value) || 0;
    const warnEl = document.getElementById('prod-price-cost-warn');
    if (warnEl) warnEl.remove();

    if (cost > 0 && price > 0 && price < cost) {
        priceInput.classList.remove('text-[#0066cc]');
        priceInput.classList.add('text-red-600', 'border-red-300', 'bg-red-50/50');
    } else {
        priceInput.classList.remove('text-red-600', 'border-red-300', 'bg-red-50/50');
        priceInput.classList.add('text-[#0066cc]');
    }
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

    const isEdit = Boolean(document.getElementById('product-form')?.dataset?.editCode);
    const codeExistsInAnyBranch = (KVStore.data.products || []).some((p) => p.code === code);
    if (!isEdit && codeExistsInAnyBranch) {
        showToast(`Mã sản phẩm "${code}" đã tồn tại trong hệ thống!`, 'warning');
        throw new Error('Mã sản phẩm đã tồn tại.');
    }

    const idx = (KVStore.data.products || []).findIndex(
        (p) => p.code === code && (p.branch || FALLBACK_BRANCH) === currentBranch
    );
    let savedProduct;
    if (idx >= 0 && !isEdit) {
        showToast(`Mã sản phẩm "${code}" đã tồn tại!`, 'warning');
        throw new Error('Mã sản phẩm đã tồn tại.');
    }

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
        const idExists = (KVStore.data.products || []).some((p) => p.id === code);
        savedProduct = {
            id: idExists ? `${code}_${currentBranch}` : code,
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
            (p) => !(p.code === code && (p.branch || FALLBACK_BRANCH) === currentBranch)
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

    const newId = makeCode('CAT');
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
        (st) => (st.branch || FALLBACK_BRANCH) === currentBranch
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
                <td class="py-2.5 px-3 text-gray-800 font-medium">${st.branch || FALLBACK_BRANCH}</td>
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
            (p) => (p.branch || FALLBACK_BRANCH) === currentBranch
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
        (p) => (p.branch || FALLBACK_BRANCH) === currentBranch
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
        (item) => item.code === code && (item.branch || FALLBACK_BRANCH) === currentBranch
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
    const stocktake = await KVStore.command('stocktake', {
        branch: document.getElementById('stocktake-branch-input').value,
        items: activeStocktakeItems,
        note: document.getElementById('stocktake-note-input').value,
        balance: !!isBalance
    });
    activeStocktakeItems = [];
    document.getElementById('create-stocktake-modal').classList.add('hidden');
    renderAllViews();
    showToast(`Đã lưu phiếu kiểm ${stocktake.code}.`, 'success');
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
    document.getElementById('st-detail-branch').textContent = st.branch || FALLBACK_BRANCH;
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
            (p) => (p.branch || FALLBACK_BRANCH) === currentBranch
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
        (item) => item.code === code && (item.branch || FALLBACK_BRANCH) === currentBranch
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
    const transfer = await KVStore.command('transfer', {
        fromBranch: document.getElementById('transfer-from-branch-input').value,
        toBranch: document.getElementById('transfer-to-branch-select').value,
        items: activeTransferItems,
        note: document.getElementById('transfer-note-input').value
    });
    activeTransferItems = [];
    document.getElementById('create-transfer-modal').classList.add('hidden');
    renderAllViews();
    showToast(`Đã xuất phiếu chuyển ${transfer.code} và serial.`, 'success');
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
        (i) => (i.branch || FALLBACK_BRANCH) === currentBranch
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
    document.getElementById('inv-detail-branch').textContent = inv.branch || FALLBACK_BRANCH;

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
        const imeisHtml =
            Array.isArray(item.imeis) && item.imeis.length
                ? renderHTML`<div class="text-[11px] text-gray-500 font-mono mt-0.5 leading-tight">IMEI: ${item.imeis.join(', ')}</div>`
                : trustedHTML('');
        tr.innerHTML = renderHTML`
            <td class="py-2 pr-2">${idx + 1}</td>
            <td class="py-2 px-2 font-mono text-[#0066cc]">${item.code}</td>
            <td class="py-2 px-2 font-medium">
                <div>${item.name}</div>
                ${imeisHtml}
            </td>
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
        (imp) => (imp.branch || FALLBACK_BRANCH) === currentBranch
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
    document.getElementById('imp-detail-branch').textContent = imp.branch || FALLBACK_BRANCH;
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
        (p) => (p.branch || FALLBACK_BRANCH) === currentBranch
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
        (p) => p.code === prodCode && (p.branch || FALLBACK_BRANCH) === currentBranch
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
        (p) => p.code === prodCode && (p.branch || FALLBACK_BRANCH) === currentBranch
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
                ${trustedHTML(c.code !== RETAIL_CUSTOMER_CODE ? renderHTML`<button onclick="deleteCustomer('${c.code}')" class="px-2.5 py-1 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-[12px] font-medium transition shadow-2xs">Xóa</button>` : '')}
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
    if (code === RETAIL_CUSTOMER_CODE) {
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
        (tx) => (tx.branch || FALLBACK_BRANCH) === currentBranch
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

// --- 10. SETTINGS & BACKUP MODAL ---
function renderAppLogo() {
    const s = KVStore.data?.settings || {};
    const svgEl = document.getElementById('header-logo-svg');
    const imgEl = document.getElementById('header-logo-img');
    const textEl = document.getElementById('header-logo-text');
    if (!textEl) return;

    const logoUrl = (s.logoUrl || '').trim();
    const logoText =
        s.logoText !== undefined && s.logoText !== null ? String(s.logoText).trim() : 'NKiot';

    if (logoUrl) {
        if (imgEl) {
            imgEl.src = logoUrl;
            imgEl.style.maxHeight = '28px';
            imgEl.style.maxWidth = '160px';
            imgEl.style.height = 'auto';
            imgEl.style.width = 'auto';
            imgEl.style.objectFit = 'contain';
            imgEl.classList.remove('hidden');
        }
        if (svgEl) {
            svgEl.classList.add('hidden');
        }
    } else {
        if (imgEl) {
            imgEl.classList.add('hidden');
            imgEl.removeAttribute('src');
        }
        if (svgEl) {
            svgEl.classList.remove('hidden');
        }
    }

    if (logoText) {
        textEl.textContent = logoText;
        textEl.classList.remove('hidden');
    } else {
        textEl.textContent = '';
        textEl.classList.add('hidden');
    }
}

function scaleLogoImage(imageSrc, maxWidth = 240, maxHeight = 65) {
    return new Promise((resolve) => {
        if (!imageSrc || typeof imageSrc !== 'string' || !imageSrc.startsWith('data:image/')) {
            return resolve(imageSrc);
        }
        if (typeof Image === 'undefined' || typeof document === 'undefined') {
            return resolve(imageSrc);
        }
        try {
            const img = new Image();
            const timer = setTimeout(() => resolve(imageSrc), 1500);
            img.onload = () => {
                clearTimeout(timer);
                try {
                    const width = img.naturalWidth || img.width;
                    const height = img.naturalHeight || img.height;
                    if (!width || !height) return resolve(imageSrc);
                    if (width <= maxWidth && height <= maxHeight && imageSrc.length < 35000) {
                        return resolve(imageSrc);
                    }
                    const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
                    const targetW = Math.max(1, Math.round(width * ratio));
                    const targetH = Math.max(1, Math.round(height * ratio));
                    const canvas = document.createElement('canvas');
                    canvas.width = targetW;
                    canvas.height = targetH;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return resolve(imageSrc);
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, targetW, targetH);
                    const scaled = canvas.toDataURL('image/png');
                    resolve(scaled);
                } catch {
                    resolve(imageSrc);
                }
            };
            img.onerror = () => {
                clearTimeout(timer);
                resolve(imageSrc);
            };
            img.src = imageSrc;
        } catch {
            resolve(imageSrc);
        }
    });
}

function updateSettingsLogoPreview() {
    const urlInput = document.getElementById('set-logo-url');
    const textInput = document.getElementById('set-logo-text');
    const previewSvg = document.getElementById('preview-logo-svg');
    const previewImg = document.getElementById('preview-logo-img');
    const previewText = document.getElementById('preview-logo-text');
    const clearBtn = document.getElementById('btn-clear-logo-img');
    if (!previewSvg || !previewImg || !previewText) return;

    const url = (urlInput?.value || '').trim();
    const text = textInput ? textInput.value : 'NKiot';

    if (url) {
        previewImg.src = url;
        previewImg.style.maxHeight = '28px';
        previewImg.style.maxWidth = '160px';
        previewImg.style.height = 'auto';
        previewImg.style.width = 'auto';
        previewImg.style.objectFit = 'contain';
        previewImg.classList.remove('hidden');
        previewSvg.classList.add('hidden');
        if (clearBtn) clearBtn.classList.remove('hidden');
    } else {
        previewImg.classList.add('hidden');
        previewImg.removeAttribute('src');
        previewSvg.classList.remove('hidden');
        if (clearBtn) clearBtn.classList.add('hidden');
    }

    if (text.trim()) {
        previewText.textContent = text.trim();
        previewText.classList.remove('hidden');
    } else {
        previewText.textContent = '';
        previewText.classList.add('hidden');
    }
}

async function handleLogoFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, SVG, WebP).', 'warning');
        return;
    }
    const reader = new FileReader();
    reader.onload = async (loadEvt) => {
        const rawData = loadEvt.target.result;
        if (file.type === 'image/svg+xml') {
            const urlInput = document.getElementById('set-logo-url');
            if (urlInput) urlInput.value = rawData;
            updateSettingsLogoPreview();
            return;
        }
        const scaled = await scaleLogoImage(rawData, 240, 65);
        const urlInput = document.getElementById('set-logo-url');
        if (urlInput) urlInput.value = scaled;
        updateSettingsLogoPreview();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

function clearSettingsLogoImage() {
    const urlInput = document.getElementById('set-logo-url');
    if (urlInput) urlInput.value = '';
    updateSettingsLogoPreview();
}

function resetSettingsLogoToDefault() {
    const urlInput = document.getElementById('set-logo-url');
    const textInput = document.getElementById('set-logo-text');
    if (urlInput) urlInput.value = '';
    if (textInput) textInput.value = 'NKiot';
    updateSettingsLogoPreview();
}

function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    const s = KVStore.data.settings;
    document.getElementById('set-store-name').value = s.storeName || '';
    document.getElementById('set-branch').value = s.branch || '';
    document.getElementById('set-branch').readOnly = true;
    document.getElementById('set-phone').value = s.phone || '';
    document.getElementById('set-hotline').value = s.hotline || '';
    document.getElementById('set-address').value = s.address || '';
    document.getElementById('set-bank-code').value = s.bankCode || '';
    document.getElementById('set-bank-name').value = s.bankName || '';
    document.getElementById('set-bank-account').value = s.bankAccount || '';
    document.getElementById('set-bank-owner').value = s.bankOwner || '';

    const logoUrlEl = document.getElementById('set-logo-url');
    if (logoUrlEl) logoUrlEl.value = s.logoUrl || '';
    const logoTextEl = document.getElementById('set-logo-text');
    if (logoTextEl) logoTextEl.value = s.logoText !== undefined ? s.logoText : 'NKiot';

    updateSettingsLogoPreview();
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

    const logoUrlEl = document.getElementById('set-logo-url');
    const rawLogoUrl = logoUrlEl ? logoUrlEl.value.trim() : '';
    if (rawLogoUrl) {
        s.logoUrl = await scaleLogoImage(rawLogoUrl, 240, 65);
    } else {
        s.logoUrl = '';
    }

    const logoTextEl = document.getElementById('set-logo-text');
    if (logoTextEl) s.logoText = logoTextEl.value.trim();

    await KVStore.save();
    renderAppLogo();
    document.getElementById('settings-modal').classList.add('hidden');
    showToast('Đã lưu thiết lập cửa hàng & logo!', 'success');
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
        if (e.key === 'Escape') {
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

function hasPermission(permKey) {
    const user = getCurrentUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (!user.permissions) return false;
    return Boolean(user.permissions[permKey]);
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
    KVStore.csrfToken = null;
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
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('minikiot_active_view');
        }
    } catch {}
    renderAllViews();
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
    const cleanRole = (user.roleName || getRoleDisplayName(user.role))
        .replace(/\s*\(Chủ shop\)/gi, '')
        .trim();
    const headerRole = document.getElementById('header-user-role');
    if (headerRole) headerRole.textContent = cleanRole;
    const headerAvatar = document.getElementById('header-user-avatar');
    if (headerAvatar) headerAvatar.textContent = (user.name || 'N').charAt(0).toUpperCase();

    // Dropdown display
    const dropName = document.getElementById('dropdown-user-name');
    if (dropName) dropName.textContent = user.name;
    const dropRole = document.getElementById('dropdown-user-role');
    if (dropRole) dropRole.textContent = cleanRole;
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
    KVStore.csrfToken = null;
    KVStore.data = copyData(defaultData);
    KVStore._base = copyData(defaultData);
    renderAllViews();
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
                                      : [FALLBACK_BRANCH];
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
                  : [FALLBACK_BRANCH];
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
