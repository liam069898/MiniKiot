'use strict';
const crypto = require('node:crypto');
const db = require('./db');
const { can, allowedBranches, publicUser, requirePermission, hashPassword } = require('./security');
const { execute, fail, amount, branchOf } = require('./domain');
const clone = (x) => JSON.parse(JSON.stringify(x));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const readable = {
    products: ['pos', 'products', 'imports', 'stocktakes', 'transfers', 'reports', 'dashboard'],
    customers: ['pos', 'customers', 'invoices', 'cashbook'],
    suppliers: ['suppliers', 'imports', 'cashbook'],
    invoices: ['invoices', 'reports', 'dashboard'],
    imports: ['imports', 'reports', 'dashboard'],
    cashbook: ['cashbook', 'reports'],
    returns: ['invoices', 'reports', 'dashboard'],
    stocktakes: ['stocktakes'],
    transfers: ['transfers'],
    users: ['users']
};
function project(data, user) {
    const result = clone(data),
        branches = allowedBranches(user, data);
    for (const [table, perms] of Object.entries(readable)) {
        if (!perms.some((p) => can(user, p))) {
            result[table] = [];
            continue;
        }
        if (
            ['products', 'invoices', 'imports', 'cashbook', 'returns', 'stocktakes'].includes(table)
        )
            result[table] = result[table].filter((r) => branches.includes(branchOf(r)));
        if (table === 'transfers')
            result[table] = result[table].filter(
                (r) => branches.includes(r.fromBranch) || branches.includes(r.toBranch)
            );
    }
    result.users = result.users.map(publicUser);
    // Branch directory is needed to select destinations; inventory is still scoped above.
    result.recentActivities = (result.recentActivities || []).filter((r) =>
        branches.includes(r.branch)
    );
    return result;
}
function revision() {
    return Number(
        db.getDb().prepare("SELECT value FROM app_meta WHERE key='revision'").get().value
    );
}
const editable = {
    products: 'products',
    customers: 'customers',
    suppliers: 'suppliers',
    categories: 'products',
    branches: 'settings',
    users: 'users'
};
const fields = {
    products: [
        'id',
        'code',
        'name',
        'category',
        'costPrice',
        'price',
        'stock',
        'minStock',
        'unit',
        'status',
        'barcode',
        'branch',
        'hasImei',
        'imeis'
    ],
    customers: ['id', 'code', 'name', 'phone', 'address', 'totalSpent', 'debt', 'points', 'note'],
    suppliers: ['id', 'code', 'name', 'phone', 'address', 'debt', 'totalBought', 'note'],
    categories: ['id', 'name', 'parentId'],
    branches: ['id', 'code', 'name', 'phone', 'address', 'isDefault', 'note'],
    users: [
        'id',
        'code',
        'name',
        'username',
        'password',
        'phone',
        'role',
        'roleName',
        'branch',
        'branches',
        'status',
        'permissions'
    ]
};
function validateRecord(table, row, data, old, user) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail('Bản ghi không hợp lệ.');
    if (typeof row.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,160}$/.test(row.id))
        fail('ID không hợp lệ.');
    if (
        row.code !== undefined &&
        (typeof row.code !== 'string' || !/^[A-Za-z0-9_.:-]{1,160}$/.test(row.code))
    )
        fail('Mã chỉ được gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.');
    for (const key of Object.keys(row))
        if (!fields[table].includes(key)) fail(`Trường ${table}.${key} không được hỗ trợ.`);
    if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 500)
        fail('Tên không hợp lệ.');
    for (const [key, value] of Object.entries(row)) {
        if (
            ![
                'costPrice',
                'price',
                'stock',
                'minStock',
                'totalSpent',
                'totalBought',
                'debt',
                'points',
                'hasImei',
                'isDefault',
                'permissions',
                'branches',
                'imeis'
            ].includes(key) &&
            value != null &&
            typeof value !== 'string'
        )
            fail(`Trường ${key} phải là chuỗi.`);
        if (typeof value === 'string' && value.length > 5000) fail(`Trường ${key} quá dài.`);
        if (
            !['permissions', 'branches', 'imeis'].includes(key) &&
            value !== null &&
            typeof value === 'object'
        )
            fail(`Trường ${key} không đúng kiểu.`);
    }
    for (const key of [
        'costPrice',
        'price',
        'stock',
        'minStock',
        'totalSpent',
        'totalBought',
        'debt',
        'points'
    ])
        if (key in row) amount(row[key], key);
    if (
        !old &&
        ['customers', 'suppliers'].includes(table) &&
        user.role !== 'admin' &&
        ['debt', 'points', 'totalSpent', 'totalBought'].some((k) => row[k])
    )
        fail('Số dư ban đầu cần quyền quản trị.', 403);
    if (old && ['customers', 'suppliers'].includes(table) && user.role !== 'admin')
        for (const key of ['debt', 'totalSpent', 'totalBought', 'points'])
            if (!equal(row[key], old[key]))
                fail('Điều chỉnh số dư phải qua nghiệp vụ thanh toán hoặc quản trị viên.', 403);
    if (table === 'products') {
        if (!allowedBranches(user, data).includes(branchOf(row)))
            fail('Không được sửa kho khác.', 403);
        if (old && (row.code !== old.code || row.branch !== old.branch))
            fail('Không thể đổi mã/chi nhánh của sản phẩm có sẵn.');
        if (typeof row.hasImei !== 'boolean' || !['active', 'archived'].includes(row.status))
            fail('Trạng thái sản phẩm không hợp lệ.');
        if (
            !Array.isArray(row.imeis) ||
            row.imeis.some((i) => typeof i !== 'string' || !i || i.length > 200) ||
            new Set(row.imeis).size !== row.imeis.length
        )
            fail('Danh sách IMEI không hợp lệ.');
        if (row.hasImei && row.imeis.length !== row.stock)
            fail('Tồn kho phải bằng số IMEI. Nhập hàng có IMEI qua phiếu nhập.');
        if (
            old &&
            row.hasImei !== old.hasImei &&
            (old.stock ||
                ['invoices', 'imports', 'returns'].some((t) =>
                    data[t].some(
                        (d) =>
                            branchOf(d) === branchOf(old) &&
                            d.items.some((i) => i.code === old.code)
                    )
                ))
        )
            fail('Không thể đổi cách quản lý IMEI khi còn tồn kho hoặc lịch sử chứng từ.');
        const otherSerials = new Set(
            data.products.filter((p) => p.id !== row.id).flatMap((p) => p.imeis || [])
        );
        if (row.imeis.some((i) => otherSerials.has(i))) fail('IMEI đã có tại kho khác.');
    }
    if (table === 'branches' && old && row.name !== old.name)
        fail('Không thể đổi tên chi nhánh đã được tham chiếu.');
    if (table === 'users') {
        if (typeof row.username !== 'string' || !/^[a-z0-9_.-]{1,80}$/.test(row.username))
            fail('Tên đăng nhập không hợp lệ.');
        if (
            !['admin', 'manager', 'cashier', 'warehouse', 'custom'].includes(row.role) ||
            !['active', 'locked'].includes(row.status)
        )
            fail('Vai trò/trạng thái không hợp lệ.');
        if (
            user.role !== 'admin' &&
            (old?.role === 'admin' ||
                (row.branches || []).some((b) => !allowedBranches(user, data).includes(b)))
        )
            fail('Không được quản lý quản trị viên hoặc nhân viên ngoài chi nhánh.', 403);
        if (
            user.role !== 'admin' &&
            (row.role === 'admin' ||
                Object.entries(row.permissions || {}).some(([p, v]) => v && !can(user, p)))
        )
            fail('Không thể cấp quyền vượt quyền hiện tại.', 403);
        if (
            !row.permissions ||
            typeof row.permissions !== 'object' ||
            Array.isArray(row.permissions) ||
            Object.values(row.permissions).some((v) => typeof v !== 'boolean')
        )
            fail('Phân quyền không hợp lệ.');
        if (
            !Array.isArray(row.branches) ||
            !row.branches.length ||
            row.branches.some((b) => !data.branches.some((x) => x.name === b))
        )
            fail('Chi nhánh nhân viên không hợp lệ.');
        if (row.id === user.id && row.status !== 'active') fail('Không thể tự khóa tài khoản.');
        if (row.password) {
            if (typeof row.password !== 'string') fail('Mật khẩu phải là chuỗi.');
            if (row.password.length < 8 || row.password.length > 1024)
                fail('Mật khẩu mới phải từ 8 đến 1024 ký tự.');
            row.password = hashPassword(row.password);
        } else if (old) row.password = old.password;
        else fail('Nhập mật khẩu cho nhân viên mới.');
    }
}
function applyEdit(data, user, incoming) {
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming))
        fail('Dữ liệu không hợp lệ.');
    const visible = project(data, user);
    for (const table of db.ENTITY_TABLES) {
        if (!Array.isArray(incoming[table])) fail(`Thiếu danh sách ${table}.`);
        if (equal(visible[table], incoming[table])) continue;
        if (!editable[table])
            fail(`Chứng từ ${table} phải được cập nhật qua nghiệp vụ riêng.`, 403);
        requirePermission(user, editable[table]);
        const rows = incoming[table],
            ids = new Set();
        for (const row of rows) {
            if (!row || typeof row !== 'object' || Array.isArray(row))
                fail('Bản ghi không hợp lệ.');
            if (ids.has(row.id)) fail('Trùng mã bản ghi.');
            ids.add(row.id);
        }
        const visibleIds = new Set(visible[table].map((r) => r.id)),
            oldMap = new Map(data[table].map((r) => [r.id, r]));
        for (const row of rows) {
            const old = oldMap.get(row.id);
            if (old && !visibleIds.has(row.id)) fail('Không được sửa dữ liệu ngoài phạm vi.', 403);
            const before = visible[table].find((r) => r.id === row.id);
            if (!equal(row, before)) validateRecord(table, row, data, old, user);
        }
        for (const old of visible[table].filter((r) => !ids.has(r.id))) {
            if (
                table === 'users' &&
                user.role !== 'admin' &&
                (old.role === 'admin' ||
                    (old.branches || [old.branch]).some(
                        (b) => !allowedBranches(user, data).includes(b)
                    ))
            )
                fail('Không được xóa nhân viên ngoài phạm vi.', 403);
            if (table === 'users' && old.id === user.id) fail('Không thể tự xóa tài khoản.');
            if (table === 'categories' && data.categories.some((c) => c.parentId === old.id))
                fail('Nhóm hàng còn nhóm con không thể xóa.');
            if (table === 'branches') fail('Không thể xóa chi nhánh qua danh mục.');
            if (
                table === 'customers' &&
                (old.debt ||
                    data.invoices.some((i) => i.customerId === old.id || i.phone === old.phone))
            )
                fail('Khách hàng còn công nợ/lịch sử không thể xóa.');
            if (
                table === 'suppliers' &&
                (old.debt || data.imports.some((i) => i.nccCode === old.code))
            )
                fail('Nhà cung cấp còn công nợ/lịch sử không thể xóa.');
            if (
                table === 'products' &&
                (old.stock ||
                    ['invoices', 'imports', 'returns', 'stocktakes'].some((t) =>
                        data[t].some(
                            (i) =>
                                branchOf(i) === branchOf(old) &&
                                i.items.some((it) => it.code === old.code)
                        )
                    ) ||
                    data.transfers.some(
                        (t) =>
                            (t.fromBranch === branchOf(old) || t.toBranch === branchOf(old)) &&
                            t.items.some((it) => it.code === old.code)
                    ))
            )
                fail('Sản phẩm còn tồn/lịch sử không thể xóa.');
        }
        data[table] = data[table]
            .filter((r) => !visibleIds.has(r.id))
            .concat(
                rows.map((r) =>
                    table === 'users' && !r.password
                        ? { ...r, password: oldMap.get(r.id)?.password }
                        : r
                )
            );
        const keys = new Set();
        for (const r of data[table]) {
            const key =
                table === 'products'
                    ? `${r.branch}:${r.code}`
                    : table === 'users'
                      ? r.username
                      : table === 'categories'
                        ? r.id
                        : table === 'branches'
                          ? r.name
                          : r.code;
            if (keys.has(key)) fail('Mã/tên bị trùng.');
            keys.add(key);
        }
    }
    if (!equal(visible.settings, incoming.settings)) {
        requirePermission(user, 'settings');
        if (
            !incoming.settings ||
            typeof incoming.settings !== 'object' ||
            Array.isArray(incoming.settings)
        )
            fail('Cài đặt không hợp lệ.');
        for (const [k, v] of Object.entries(incoming.settings)) {
            if (!Object.hasOwn(data.settings, k) || typeof v !== 'string' || v.length > 1000)
                fail('Trường cài đặt không hợp lệ.');
        }
        if (Object.keys(data.settings).some((k) => !Object.hasOwn(incoming.settings, k)))
            fail('Thiếu trường cài đặt.');
        data.settings = incoming.settings;
    }
    const serials = new Set(
        data.transfers
            .filter((t) => t.status === 'shipping')
            .flatMap((t) => t.items.flatMap((i) => i.imeis || []))
    );
    for (const p of data.products) {
        for (const serial of p.imeis || []) {
            if (serials.has(serial)) fail('IMEI bị trùng giữa các sản phẩm/kho.');
            serials.add(serial);
        }
    }
    if (!data.users.some((u) => u.role === 'admin' && u.status === 'active'))
        fail('Phải giữ ít nhất một quản trị viên hoạt động.');
    return { saved: true };
}
function transact(user, envelope) {
    if (
        !envelope ||
        typeof envelope.requestId !== 'string' ||
        !/^[a-zA-Z0-9-]{16,100}$/.test(envelope.requestId)
    )
        fail('Thiếu mã giao dịch hợp lệ.', 400);
    const d = db.getDb(),
        digest = crypto.createHash('sha256').update(JSON.stringify(envelope)).digest('hex');
    d.exec('BEGIN IMMEDIATE');
    try {
        const prior = d
            .prepare('SELECT * FROM processed_requests WHERE id=?')
            .get(envelope.requestId);
        if (prior) {
            if (prior.userId !== user.id || prior.digest !== digest)
                fail('Mã giao dịch đã được dùng với nội dung khác.', 409);
            d.exec('COMMIT');
            return { result: JSON.parse(prior.result), replayed: true };
        }
        if (envelope.revision !== revision())
            fail(
                'Dữ liệu đã thay đổi ở máy khác. Hãy tải lại dữ liệu và kiểm tra trước khi thử lại.',
                409
            );
        db.assertReadableRecords();
        const data = db.getAllData();
        const current = data.users.find((u) => u.id === user.id);
        if (!current || current.status !== 'active') fail('Phiên đăng nhập đã hết hiệu lực.', 401);
        user = current;
        const result =
            envelope.type === 'edit'
                ? applyEdit(data, user, envelope.payload)
                : execute(data, user, envelope.type, envelope.payload || {});
        db.saveAllData(data, true);
        d.prepare('INSERT INTO audit_log (requestId,userId,action,time) VALUES (?,?,?,?)').run(
            envelope.requestId,
            user.id,
            envelope.type,
            new Date().toISOString()
        );
        d.prepare("UPDATE app_meta SET value=CAST(value AS INTEGER)+1 WHERE key='revision'").run();
        d.prepare('INSERT INTO processed_requests VALUES (?,?,?,?)').run(
            envelope.requestId,
            user.id,
            digest,
            JSON.stringify(result)
        );
        d.exec('COMMIT');
        return { result, replayed: false };
    } catch (e) {
        d.exec('ROLLBACK');
        throw e;
    }
}
module.exports = { project, revision, transact, validateRecord };
