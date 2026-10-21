'use strict';
// Giá trị dùng chung cho server (require) và trình duyệt (<script>).
// Chi nhánh gán cho bản ghi cũ không có trường branch. Không đổi nếu database đã có dữ liệu,
// vì dữ liệu lịch sử phụ thuộc giá trị này.
const FALLBACK_BRANCH = 'Kalo HCM';
// Mã khách lẻ hệ thống: không ghi nợ, không xóa, không dùng để suy ra khách theo số điện thoại.
const RETAIL_CUSTOMER_CODE = 'KH0011';
const CODE_PREFIXES = {
    SP: { table: 'products', minPad: 3 },
    HD: { table: 'invoices', minPad: 6 },
    PN: { table: 'imports', minPad: 6 },
    PCH: { table: 'transfers', minPad: 6 },
    PKK: { table: 'stocktakes', minPad: 6 },
    TH: { table: 'returns', minPad: 6 },
    KH: { table: 'customers', minPad: 4 },
    NCC: { table: 'suppliers', minPad: 6 },
    PT: { table: 'cashbook', minPad: 4, type: 'thu' },
    PC: { table: 'cashbook', minPad: 4, type: 'chi' },
    CN: { table: 'branches', minPad: 2 },
    NV: { table: 'users', minPad: 4 },
    CAT: { table: 'categories', minPad: 2 }
};
function generateCode(data, prefix = 'TX') {
    const cleanPrefix = String(prefix || 'TX').toUpperCase();
    const config = CODE_PREFIXES[cleanPrefix];
    let items = [];
    if (data && config && Array.isArray(data[config.table])) {
        items = config.type
            ? data[config.table].filter((item) => item.type === config.type)
            : data[config.table];
    } else if (data && typeof data === 'object') {
        items = Object.values(data).filter(Array.isArray).flat();
    }
    const minPad = config?.minPad || 6;
    const regex = new RegExp(`^${cleanPrefix}(\\d+)$`, 'i');
    let maxNum = 0;
    let padLength = minPad;
    const existing = new Set();
    for (const item of items) {
        if (!item) continue;
        const values = typeof item === 'string' ? [item] : [item.code, item.id];
        for (const value of values) {
            if (typeof value !== 'string') continue;
            existing.add(value.toUpperCase());
            const match = value.match(regex);
            if (!match) continue;
            maxNum = Math.max(maxNum, Number.parseInt(match[1], 10));
            padLength = Math.max(padLength, match[1].length);
        }
    }
    let next = maxNum + 1;
    let candidate = `${cleanPrefix}${String(next).padStart(padLength, '0')}`;
    while (existing.has(candidate.toUpperCase())) {
        next++;
        candidate = `${cleanPrefix}${String(next).padStart(padLength, '0')}`;
    }
    return candidate;
}
if (typeof module !== 'undefined')
    module.exports = { FALLBACK_BRANCH, RETAIL_CUSTOMER_CODE, CODE_PREFIXES, generateCode };
