'use strict';
const { requirePermission, allowedBranches } = require('./security');
const { FALLBACK_BRANCH, RETAIL_CUSTOMER_CODE, generateCode } = require('./constants');
const fail = (message, status = 422) => {
    throw Object.assign(new Error(message), { status });
};
const amount = (value, name = 'Số tiền') => {
    if (!Number.isSafeInteger(value) || value < 0) fail(`${name} phải là số nguyên không âm.`);
    return value;
};
const quantity = (value) => {
    amount(value, 'Số lượng');
    if (!value) fail('Số lượng phải lớn hơn 0.');
    return value;
};
const code = (data, prefix) => generateCode(data, prefix);
const timestamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return {
        time: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
        createdAt: d.toISOString()
    };
};
const branchOf = (record) => record.branch || FALLBACK_BRANCH;
function branch(data, user, name) {
    if (!allowedBranches(user, data).includes(name) || !data.branches.some((b) => b.name === name))
        fail('Chi nhánh không hợp lệ hoặc chưa được cấp quyền.', 403);
    return name;
}
function product(data, code, br) {
    const p = data.products.find((p) => p.code === code && branchOf(p) === br);
    if (!p) fail(`Không tìm thấy sản phẩm ${code} tại ${br}.`);
    return p;
}
function customerFor(data, inv) {
    if (inv.customerId) return data.customers.find((c) => c.id === inv.customerId);
    if (!inv.phone || inv.phone === 'Tại quầy') return null;
    const matches = data.customers.filter(
        (c) => c.phone === inv.phone && c.code !== RETAIL_CUSTOMER_CODE
    );
    if (matches.length !== 1 && inv.total > inv.paid)
        fail('Cần xác định khách hàng duy nhất cho hóa đơn cũ trước khi xử lý công nợ.');
    return matches.length === 1 ? matches[0] : null;
}
function paymentMethod(method) {
    if (!['cash', 'transfer', 'card'].includes(method))
        fail('Phương thức thanh toán không hợp lệ.');
    return method;
}
const methodLabel = (method) =>
    ({ cash: 'Tiền mặt', transfer: 'Chuyển khoản', card: 'Thẻ' })[method] || method;
function voucher(
    data,
    {
        type,
        category,
        value,
        person,
        method,
        branch,
        invoiceId,
        customerId,
        supplierId,
        note,
        allocations
    }
) {
    if (!value) return;
    amount(value);
    const id = code(data, type === 'thu' ? 'PT' : 'PC');
    data.cashbook.unshift({
        id,
        code: id,
        ...timestamp(),
        type,
        category,
        amount: value,
        person,
        method: methodLabel(method),
        branch,
        invoiceId,
        customerId,
        supplierId,
        note: note || '',
        allocations: allocations || []
    });
}
function takeStock(p, qty, selected) {
    amount(p.stock, 'Tồn kho');
    if (p.hasImei && (!Array.isArray(p.imeis) || p.imeis.length !== p.stock))
        fail(`Tồn và IMEI ${p.code} không khớp. Cần đối soát trước khi xuất.`);
    if (p.stock < qty) fail(`Không đủ tồn kho ${p.code} (còn ${p.stock}).`, 409);
    let imeis = [];
    if (p.hasImei) {
        imeis = selected || p.imeis.slice(0, qty);
        if (
            !Array.isArray(imeis) ||
            imeis.length !== qty ||
            new Set(imeis).size !== qty ||
            imeis.some((im) => !p.imeis.includes(im))
        )
            fail(`IMEI của ${p.code} không đủ hoặc không hợp lệ.`);
        p.imeis = p.imeis.filter((im) => !imeis.includes(im));
    }
    p.stock -= qty;
    return imeis;
}
function restoreStock(data, p, qty, imeis = [], receivingTransferId = null) {
    if (p.hasImei) {
        if (
            !Array.isArray(imeis) ||
            imeis.length !== qty ||
            new Set(imeis).size !== qty ||
            !Array.isArray(p.imeis) ||
            p.imeis.length !== p.stock ||
            imeis.some(
                (im) =>
                    data.products.some((pr) => pr.imeis?.includes(im)) ||
                    data.transfers.some(
                        (t) =>
                            t.status === 'shipping' &&
                            t.id !== receivingTransferId &&
                            t.items.some((i) => i.imeis?.includes(im))
                    )
            )
        )
            fail(`Không thể khôi phục IMEI ${p.code}; cần đối soát serial của chứng từ gốc.`);
        p.imeis.push(...imeis);
    }
    p.stock = amount(p.stock + qty, 'Tồn kho');
}
// Integer arithmetic keeps VND allocations exact even when intermediate products are large.
function ratio(value, numerator, denominator, round = false) {
    const divisor = BigInt(quantity(denominator));
    const product = BigInt(amount(value)) * BigInt(amount(numerator));
    return amount(Number((product + (round ? divisor / 2n : 0n)) / divisor));
}
function averageCost(stock, cost, qty, price) {
    const totalQty = quantity(amount(stock) + quantity(qty));
    const value = BigInt(stock) * BigInt(amount(cost)) + BigInt(qty) * BigInt(amount(price));
    return amount(Number((value + BigInt(totalQty) / 2n) / BigInt(totalQty)));
}
function sale(data, user, input) {
    requirePermission(user, 'pos');
    const br = branch(data, user, input.branch);
    if (!Array.isArray(input.items) || !input.items.length) fail('Giỏ hàng trống.');
    const seen = new Set();
    const items = input.items.map((row) => {
        if (seen.has(row.code)) fail('Sản phẩm trùng trong giỏ.');
        seen.add(row.code);
        const p = product(data, row.code, br);
        if (row.expectedPrice !== undefined && row.expectedPrice !== p.price)
            fail('Giá bán đã thay đổi. Hãy cập nhật sản phẩm trong giỏ.', 409);
        if (p.status !== 'active') fail('Sản phẩm đã ngừng kinh doanh.');
        const qty = quantity(row.qty),
            price = amount(p.price),
            costPrice = amount(p.costPrice);
        return {
            code: p.code,
            productId: p.id,
            name: p.name,
            qty,
            price,
            costPrice,
            total: amount(price * qty),
            hasImei: !!p.hasImei,
            imeis: takeStock(p, qty, row.imeis),
            note: typeof row.note === 'string' ? row.note.trim() : ''
        };
    });
    const subtotal = amount(items.reduce((s, i) => s + i.total, 0)),
        discount = amount(input.discount ?? 0);
    if (discount > subtotal) fail('Giảm giá vượt tổng tiền hàng.');
    const total = subtotal - discount;
    let allocated = 0,
        cumulative = 0;
    items.forEach((item, index) => {
        cumulative += item.total;
        const target =
            index === items.length - 1
                ? discount
                : subtotal
                  ? ratio(discount, cumulative, subtotal)
                  : 0;
        item.discount = target - allocated;
        allocated = target;
        item.netTotal = item.total - item.discount;
    });
    const cust = input.customerId ? data.customers.find((c) => c.id === input.customerId) : null;
    if (input.customerId && !cust) fail('Khách hàng không tồn tại.');
    const retail = !cust || cust.code === RETAIL_CUSTOMER_CODE;
    const given = amount(input.given),
        paid = Math.min(given, total);
    if (retail && paid < total) fail('Khách lẻ chưa trả đủ tiền. Hãy chọn khách hàng để ghi nợ.');
    const method = paymentMethod(input.paymentMethod),
        id = code(data, 'HD');
    const invoice = {
        id,
        code: id,
        ...timestamp(),
        bookingVersion: 2,
        payments: [{ amount: paid, method, ...timestamp() }],
        customerId: retail ? null : cust.id,
        customer: cust?.name || 'Khách lẻ',
        phone: cust?.phone || 'Tại quầy',
        items,
        total,
        discount,
        paid,
        returnedTotal: 0,
        redPaid: paid < total,
        grayBg: false,
        status: 'completed',
        cashier: user.name,
        branch: br,
        paymentMethod: method,
        note: input.note || ''
    };
    data.invoices.unshift(invoice);
    if (!retail) {
        cust.debt = amount(cust.debt + total - paid);
        cust.totalSpent = amount(cust.totalSpent + total);
        cust.points = amount(cust.points + Math.floor(total / 100000));
    }
    voucher(data, {
        type: 'thu',
        category: 'Bán hàng',
        value: paid,
        person: invoice.customer,
        method,
        branch: br,
        invoiceId: id,
        customerId: invoice.customerId,
        note: `Thu tiền bán hàng hóa đơn ${id}`
    });
    return invoice;
}
function previousReturns(data, inv) {
    return data.returns.filter((r) => r.invoiceCode === inv.code);
}
function lineNet(inv, item) {
    if (Number.isFinite(item.netTotal)) return item.netTotal;
    const total = inv.items.reduce((s, i) => s + i.qty * i.price, 0);
    return total ? ratio(amount(item.qty * item.price), inv.total, total, true) : 0;
}
function returnGoods(data, user, input, cancel = false) {
    requirePermission(user, 'invoices');
    const inv = data.invoices.find((i) => i.id === input.invoiceId || i.code === input.invoiceId);
    if (!inv) fail('Không tìm thấy hóa đơn.');
    branch(data, user, branchOf(inv));
    if (inv.status === 'cancelled') fail('Hóa đơn đã hủy.', 409);
    if (!inv.items.length) fail('Hóa đơn cũ thiếu chi tiết; cần đối soát trước khi hủy/trả.');
    const previous = previousReturns(data, inv),
        totals = new Map();
    if (previous.some((r) => r.returnValue == null))
        fail(
            'Hóa đơn có phiếu trả từ phiên bản cũ chưa đối soát tiền/nợ. Cần kiểm tra trước khi hoàn tiếp.'
        );
    for (const ret of previous)
        for (const it of ret.items) totals.set(it.code, (totals.get(it.code) || 0) + it.qty);
    const requested = cancel
        ? inv.items
              .map((i) => ({ code: i.code, qty: i.qty - (totals.get(i.code) || 0) }))
              .filter((i) => i.qty > 0)
        : input.items;
    if (!Array.isArray(requested) || (!requested.length && !cancel))
        fail('Chọn ít nhất một sản phẩm trả.');
    const seen = new Set();
    let value = 0;
    const items = requested.map((row) => {
        const item = inv.items.find((i) => i.code === row.code);
        if (!item || seen.has(row.code)) fail('Dòng trả hàng không hợp lệ.');
        seen.add(row.code);
        const qty = quantity(row.qty),
            returned = totals.get(row.code) || 0;
        if (qty > item.qty - returned) fail(`Số lượng trả ${row.code} vượt số lượng còn lại.`, 409);
        const p = product(data, item.code, branchOf(inv));
        const imeis = (item.imeis || []).slice(returned, returned + qty);
        restoreStock(data, p, qty, imeis);
        const net = lineNet(inv, item),
            refund =
                ratio(net, returned + qty, item.qty, true) - ratio(net, returned, item.qty, true);
        value += refund;
        return {
            ...item,
            qty,
            imeis,
            total: refund,
            netTotal: refund,
            costPrice: item.costPrice ?? null
        };
    });
    const already = previous.reduce((s, r) => s + (r.returnValue ?? r.totalRefund), 0);
    // Last return receives rounding remainder for legacy discounted invoices.
    const fullyReturned = inv.items.every(
        (i) =>
            (totals.get(i.code) || 0) + (requested.find((r) => r.code === i.code)?.qty || 0) ===
            i.qty
    );
    if (fullyReturned && items.length) {
        const remaining = Math.max(0, inv.total - already);
        items.at(-1).total += remaining - value;
        items.at(-1).netTotal = items.at(-1).total;
        value = remaining;
    }
    const cust = customerFor(data, inv);
    const debtReduction = Math.min(value, Math.max(0, inv.total - already - inv.paid));
    const refund = value - debtReduction;
    if (debtReduction && !cust) fail('Không xác định được khách hàng để giảm công nợ.');
    if (cust) {
        cust.debt = Math.max(0, cust.debt - debtReduction);
        cust.totalSpent = Math.max(0, cust.totalSpent - value);
        cust.points = Math.max(
            0,
            cust.points -
                (Math.floor((inv.total - already) / 100000) -
                    Math.floor((inv.total - already - value) / 100000))
        );
    }
    if (Array.isArray(inv.payments) && refund)
        inv.payments.push({
            amount: -refund,
            method: input.refundMethod || inv.paymentMethod || 'cash',
            ...timestamp()
        });
    inv.paid = Math.max(0, inv.paid - refund);
    inv.returnedTotal = already + value;
    inv.hasReturned = !!(previous.length || items.length);
    inv.redPaid = inv.total - inv.returnedTotal > inv.paid;
    const method = paymentMethod(input.refundMethod || inv.paymentMethod || 'cash'),
        id = code(data, 'TH');
    const slip = {
        id,
        code: id,
        invoiceCode: inv.code,
        invoiceId: inv.id,
        ...timestamp(),
        customer: inv.customer,
        customerId: cust?.id || null,
        phone: inv.phone,
        items,
        totalRefund: refund,
        returnValue: value,
        debtReduction,
        refundMethod: methodLabel(method),
        reason: input.reason || '',
        cashier: user.name,
        branch: branchOf(inv),
        isCancellation: cancel
    };
    if (items.length) data.returns.unshift(slip);
    voucher(data, {
        type: 'chi',
        category: cancel ? 'Hủy hóa đơn' : 'Trả hàng bán',
        value: refund,
        person: inv.customer,
        method,
        branch: branchOf(inv),
        invoiceId: inv.id,
        customerId: cust?.id,
        note: `Hoàn tiền ${id} (${inv.code})`
    });
    if (cancel) {
        inv.status = 'cancelled';
        inv.cancelReason = input.reason || '';
        const cancelled = timestamp();
        inv.cancelTime = cancelled.time;
        inv.cancelledAt = cancelled.createdAt;
    }
    return slip;
}
function importGoods(data, user, input) {
    requirePermission(user, 'imports');
    const br = branch(data, user, input.branch),
        supplier = data.suppliers.find((s) => s.code === input.supplierCode);
    if (!supplier) fail('Chọn nhà cung cấp hợp lệ.');
    if (!Array.isArray(input.items) || !input.items.length) fail('Phiếu nhập trống.');
    const allImeis = new Set([
            ...data.products.flatMap((p) => p.imeis || []),
            ...data.transfers
                .filter((t) => t.status === 'shipping')
                .flatMap((t) => t.items.flatMap((i) => i.imeis || []))
        ]),
        seen = new Set();
    const items = input.items.map((row) => {
        if (seen.has(row.code)) fail('Dòng sản phẩm trùng.');
        seen.add(row.code);
        const p = product(data, row.code, br),
            qty = quantity(row.qty),
            price = amount(row.price),
            imeis = row.imeis || [];
        if (!p.hasImei && row.hasImei && p.stock > 0)
            fail('Cần đối soát hàng đang tồn trước khi bật quản lý IMEI.');
        if (p.hasImei || row.hasImei) {
            if (
                !Array.isArray(imeis) ||
                imeis.length !== qty ||
                new Set(imeis).size !== qty ||
                imeis.some((im) => typeof im !== 'string' || !im || allImeis.has(im))
            )
                fail(`IMEI ${p.code} thiếu hoặc trùng.`);
            imeis.forEach((im) => allImeis.add(im));
            p.hasImei = true;
            p.imeis = (p.imeis || []).concat(imeis);
        }
        p.costPrice = averageCost(p.stock, p.costPrice, qty, price);
        p.stock = amount(p.stock + qty, 'Tồn kho');
        return {
            code: p.code,
            name: p.name,
            qty,
            price,
            total: amount(qty * price),
            hasImei: p.hasImei,
            imeis
        };
    });
    const total = amount(items.reduce((s, i) => s + i.total, 0)),
        paid = amount(input.paid);
    if (paid > total) fail('Tiền trả vượt tổng nhập.');
    const id = code(data, 'PN'),
        method = paymentMethod(
            input.paymentMethod === 'bank'
                ? 'transfer'
                : input.paymentMethod === 'debt'
                  ? 'cash'
                  : input.paymentMethod
        );
    const record = {
        id,
        code: id,
        ...timestamp(),
        nccCode: supplier.code,
        nccName: supplier.name,
        supplierId: supplier.id,
        items,
        needPay: total,
        paid,
        paymentMethod: method,
        note: input.note || '',
        status: 'imported',
        creator: user.name,
        branch: br
    };
    supplier.debt = amount(supplier.debt + total - paid);
    supplier.totalBought = amount(supplier.totalBought + total);
    data.imports.unshift(record);
    voucher(data, {
        type: 'chi',
        category: 'Nhập hàng',
        value: paid,
        person: supplier.name,
        method,
        branch: br,
        supplierId: supplier.id,
        note: `Nhập hàng ${id}`
    });
    return record;
}
function payDebt(data, user, input) {
    if (!['thu', 'chi'].includes(input.type)) fail('Loại thanh toán không hợp lệ.');
    const supplier = input.type === 'chi';
    requirePermission(user, supplier ? 'cashbook' : 'customers');
    const br = branch(data, user, input.branch),
        partner = (supplier ? data.suppliers : data.customers).find(
            (x) => x.id === input.partnerId || x.code === input.partnerId
        );
    if (!partner) fail('Không tìm thấy đối tác.');
    const value = quantity(input.amount);
    if (value > partner.debt) fail('Số tiền vượt công nợ hiện tại.');
    const method = paymentMethod(input.method || 'cash');
    let rest = value;
    const allocations = [];
    const documents = (supplier ? data.imports : data.invoices).filter(
        (i) =>
            i.status !== 'cancelled' &&
            (supplier
                ? i.supplierId === partner.id || i.nccCode === partner.code
                : i.customerId === partner.id ||
                  (!i.customerId &&
                      i.phone === partner.phone &&
                      data.customers.filter((c) => c.phone === partner.phone).length === 1))
    );
    const outstanding = (doc) =>
        Math.max(0, (supplier ? doc.needPay : doc.total - (doc.returnedTotal || 0)) - doc.paid);
    const openingDebt = Math.max(
        0,
        partner.debt - documents.reduce((sum, d) => sum + outstanding(d), 0)
    );
    const allowed = allowedBranches(user, data);
    for (const doc of documents
        .filter((d) => allowed.includes(branchOf(d)))
        .slice()
        .reverse()) {
        const debt = Math.max(
                0,
                (supplier ? doc.needPay : doc.total - (doc.returnedTotal || 0)) - doc.paid
            ),
            allocated = Math.min(rest, debt);
        if (!allocated) continue;
        doc.paid += allocated;
        doc.redPaid = allocated < debt;
        if (Array.isArray(doc.payments))
            doc.payments.push({ amount: allocated, method, ...timestamp() });
        rest -= allocated;
        allocations.push({ documentId: doc.id, amount: allocated });
    }
    if (rest > openingDebt)
        fail('Khoản thanh toán liên quan chứng từ ngoài chi nhánh được cấp quyền.', 403);
    // Unallocated portion settles explicitly stored opening debt of legacy partners.
    partner.debt -= value;
    voucher(data, {
        type: supplier ? 'chi' : 'thu',
        category: supplier ? 'Chi trả nợ NCC' : 'Thu nợ khách hàng',
        value,
        person: partner.name,
        method,
        branch: br,
        customerId: supplier ? null : partner.id,
        supplierId: supplier ? partner.id : null,
        allocations,
        note: input.note || 'Thanh toán công nợ'
    });
    return { amount: value, allocations, openingDebtPaid: rest };
}
function cashEntry(data, user, input) {
    requirePermission(user, 'cashbook');
    const br = branch(data, user, input.branch);
    if (!['thu', 'chi'].includes(input.type)) fail('Loại phiếu không hợp lệ.');
    if (!input.person?.trim()) fail('Nhập người nộp/nhận.');
    voucher(data, {
        type: input.type,
        category: input.category,
        person: input.person,
        note: input.note,
        value: quantity(input.amount),
        method: paymentMethod(input.method),
        branch: br
    });
    return data.cashbook[0];
}
function transfer(data, user, input) {
    requirePermission(user, 'transfers');
    const from = branch(data, user, input.fromBranch),
        to = input.toBranch;
    if (from === to || !data.branches.some((b) => b.name === to))
        fail('Chi nhánh nhận không hợp lệ.');
    if (!Array.isArray(input.items) || !input.items.length) fail('Phiếu chuyển trống.');
    const seen = new Set();
    const items = input.items.map((row) => {
        if (seen.has(row.code)) fail('Dòng chuyển trùng.');
        seen.add(row.code);
        const p = product(data, row.code, from),
            qty = quantity(row.qty);
        return {
            code: p.code,
            name: p.name,
            unit: p.unit,
            qty,
            price: p.costPrice,
            total: amount(p.costPrice * qty),
            hasImei: p.hasImei,
            imeis: takeStock(p, qty, row.imeis),
            productSnapshot: {
                category: p.category,
                price: p.price,
                barcode: p.barcode,
                minStock: p.minStock,
                status: p.status
            }
        };
    });
    const id = code(data, 'PCH'),
        record = {
            id,
            code: id,
            ...timestamp(),
            fromBranch: from,
            toBranch: to,
            cashier: user.name,
            status: 'shipping',
            totalQty: amount(items.reduce((s, i) => s + i.qty, 0)),
            totalValue: amount(items.reduce((s, i) => s + i.total, 0)),
            note: input.note || '',
            items
        };
    data.transfers.unshift(record);
    return record;
}
function receive(data, user, input) {
    requirePermission(user, 'transfers');
    const record = data.transfers.find((r) => r.id === input.id);
    if (!record || record.status !== 'shipping') fail('Phiếu không ở trạng thái đang chuyển.', 409);
    branch(data, user, record.toBranch);
    for (const item of record.items) {
        let p = data.products.find((p) => p.code === item.code && branchOf(p) === record.toBranch);
        if (!p) {
            const source = data.products.find(
                (p) => p.code === item.code && branchOf(p) === record.fromBranch
            );
            p = {
                ...item.productSnapshot,
                id: code(data, 'SP'),
                code: item.code,
                name: item.name,
                unit: item.unit,
                costPrice: item.price,
                stock: 0,
                price: item.productSnapshot?.price ?? source?.price ?? item.price,
                category: item.productSnapshot?.category ?? source?.category ?? '',
                branch: record.toBranch,
                hasImei: !!item.hasImei,
                imeis: [],
                // Transfers created before status was snapshotted fall back to the source product.
                status: item.productSnapshot?.status ?? source?.status ?? 'active'
            };
            data.products.push(p);
        }
        if (!!p.hasImei !== !!item.hasImei) fail('Kiểu quản lý serial không khớp giữa hai kho.');
        p.costPrice = averageCost(p.stock, p.costPrice, item.qty, item.price);
        restoreStock(data, p, item.qty, item.imeis || [], record.id);
    }
    record.status = 'completed';
    const received = timestamp();
    record.receivedTime = received.time;
    record.receivedAt = received.createdAt;
    record.receiver = user.name;
    return record;
}
function stocktake(data, user, input) {
    requirePermission(user, 'stocktakes');
    let record;
    if (input.id) {
        record = data.stocktakes.find((r) => r.id === input.id);
        if (!record || record.status !== 'draft') fail('Phiếu kiểm không còn là bản nháp.', 409);
        branch(data, user, branchOf(record));
    } else {
        const br = branch(data, user, input.branch);
        if (!Array.isArray(input.items) || !input.items.length) fail('Phiếu kiểm trống.');
        const id = code(data, 'PKK');
        record = {
            id,
            code: id,
            ...timestamp(),
            cashier: user.name,
            branch: br,
            status: 'draft',
            note: input.note || '',
            items: input.items.map((row) => {
                const p = product(data, row.code, br);
                if (row.systemStock !== p.stock)
                    fail('Tồn kho đã thay đổi. Hãy kiểm đếm lại.', 409);
                return {
                    code: p.code,
                    name: p.name,
                    unit: p.unit,
                    systemStock: p.stock,
                    actualStock: amount(row.actualStock, 'Tồn thực tế'),
                    variance: row.actualStock - p.stock,
                    reason: row.reason || '',
                    imeis: row.imeis
                };
            })
        };
        if (new Set(record.items.map((i) => i.code)).size !== record.items.length)
            fail('Dòng kiểm trùng.');
        data.stocktakes.unshift(record);
    }
    if (input.balance) {
        for (const item of record.items) {
            const p = product(data, item.code, branchOf(record));
            if (p.stock !== item.systemStock)
                fail('Có phát sinh sau khi kiểm đếm; cần lập lại phiếu kiểm.', 409);
            if (p.hasImei && item.actualStock !== p.stock)
                fail(
                    'Hàng quản lý serial cần đối soát IMEI bằng nghiệp vụ nhập/trả/chuyển trước khi cân bằng.'
                );
            p.stock = item.actualStock;
        }
        record.status = 'balanced';
    }
    record.totalActual = record.items.reduce((s, i) => s + i.actualStock, 0);
    record.totalVariance = record.items.reduce((s, i) => s + i.variance, 0);
    return record;
}
function execute(data, user, type, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        fail('Nội dung thao tác không hợp lệ.');
    for (const key of ['note', 'reason', 'category', 'person'])
        if (
            input[key] !== undefined &&
            (typeof input[key] !== 'string' || input[key].length > 5000)
        )
            fail(`Trường ${key} không hợp lệ.`);
    if (input.items !== undefined) {
        if (!Array.isArray(input.items) || input.items.length > 1000)
            fail('Danh sách hàng không hợp lệ.');
        for (const row of input.items) {
            if (
                !row ||
                typeof row !== 'object' ||
                typeof row.code !== 'string' ||
                row.code.length > 160
            )
                fail('Dòng hàng không hợp lệ.');
            if (
                row.imeis !== undefined &&
                (!Array.isArray(row.imeis) ||
                    row.imeis.some((i) => typeof i !== 'string' || !i || i.length > 200))
            )
                fail('Danh sách IMEI không hợp lệ.');
        }
    }
    switch (type) {
        case 'sale':
            return sale(data, user, input);
        case 'return':
            return returnGoods(data, user, input);
        case 'cancel':
            return returnGoods(data, user, input, true);
        case 'import':
            return importGoods(data, user, input);
        case 'debt':
            return payDebt(data, user, input);
        case 'cash':
            return cashEntry(data, user, input);
        case 'transfer':
            return transfer(data, user, input);
        case 'receive':
            return receive(data, user, input);
        case 'stocktake':
            return stocktake(data, user, input);
        default:
            fail('Thao tác không hợp lệ.', 400);
    }
}
module.exports = { execute, amount, fail, branchOf };
