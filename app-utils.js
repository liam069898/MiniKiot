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
