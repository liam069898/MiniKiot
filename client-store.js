'use strict';
const defaultData = {
    settings: {
        storeName: 'MiniKiot',
        branch: FALLBACK_BRANCH,
        phone: '',
        hotline: '',
        address: '',
        bankCode: '',
        bankName: '',
        bankAccount: '',
        bankOwner: ''
    },
    branches: [],
    categories: [],
    products: [],
    customers: [],
    suppliers: [],
    invoices: [],
    imports: [],
    cashbook: [],
    returns: [],
    stocktakes: [],
    transfers: [],
    users: [],
    recentActivities: []
};
const copyData = (value) => JSON.parse(JSON.stringify(value));
const PENDING_PREFIX = 'minikiot.pending.';
// Applies a server delta (see diffViews in application.js) to a view and returns the new view.
// `base` is not modified. Throws if the result does not match the shape the server reported, so
// the caller can fall back to a full reload instead of keeping a silently diverged copy.
function applyDelta(base, delta) {
    const next = { ...base };
    for (const [key, change] of Object.entries(delta)) {
        if (Object.hasOwn(change, 'value')) next[key] = change.value;
        else if (Object.hasOwn(change, 'rows')) next[key] = change.rows;
        else {
            if (!Array.isArray(base[key])) throw new Error('Delta không khớp: ' + key);
            const removed = new Set(change.remove || []),
                updates = new Map((change.update || []).map((r) => [r.id, r]));
            let applied = 0;
            const kept = [];
            for (const row of base[key]) {
                if (removed.has(row.id)) continue;
                const updated = updates.get(row.id);
                if (updated) applied++;
                kept.push(updated || row);
            }
            next[key] = [...(change.prepend || []), ...kept, ...(change.append || [])];
            if (applied !== updates.size || next[key].length !== change.length)
                throw new Error('Delta không khớp: ' + key);
        }
    }
    return next;
}
function makeCode(prefix = 'TX') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return prefix + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
const KVStore = {
    data: copyData(defaultData),
    _base: copyData(defaultData),
    user: null,
    revision: null,
    isDbConnected: false,
    _busy: false,
    csrfToken: null,
    _volatilePending: new Map(),
    async request(url, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(url, {
                credentials: 'same-origin',
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.csrfToken ? { 'X-MiniKiot-CSRF': this.csrfToken } : {}),
                    ...(options.headers || {})
                }
            });
            const json = await response.json();
            if (!response.ok) {
                const error = new Error(json.error || 'Không thể kết nối máy chủ.');
                error.status = response.status;
                if (error.status === 401) {
                    this.user = null;
                    this.csrfToken = null;
                    this.isDbConnected = false;
                    showLoginScreen(true);
                }
                throw error;
            }
            if (json.csrfToken) this.csrfToken = json.csrfToken;
            return json;
        } finally {
            clearTimeout(timeout);
        }
    },
    adopt(json) {
        this.adoptBase(json, copyData(json.data));
    },
    // Command responses may carry only changed rows relative to the view at `json.base`.
    async adoptResult(json) {
        if (!json.delta) return this.adopt(json);
        try {
            if (json.base !== this.revision) throw new Error('Delta base mismatch');
            this.adoptBase(json, applyDelta(this._base, json.delta));
        } catch {
            this.adopt(await this.request('/api/data'));
        }
    },
    adoptBase(json, base) {
        this.user = json.user;
        this.revision = json.revision;
        this._base = base;
        this.data = copyData(base);
        this.isDbConnected = true;
        const allowed =
            this.user.role === 'admin'
                ? this.data.branches.map((b) => b.name)
                : this.user.branches?.length
                  ? this.user.branches
                  : [this.user.branch];
        const preferred = sessionStorage.getItem('minikiot_branch');
        this.data.settings.branch = allowed.includes(preferred)
            ? preferred
            : allowed.includes(this.data.settings.branch)
              ? this.data.settings.branch
              : allowed[0];
        this.updateDbStatus();
    },
    pending() {
        const records = [];
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (!key.startsWith(PENDING_PREFIX)) continue;
            try {
                const record = JSON.parse(localStorage.getItem(key));
                if (record.userId === this.user?.id) records.push(record);
            } catch {}
        }
        return records;
    },
    async init() {
        // Keep pre-upgrade local data for explicit reconciliation, never replay an unversioned snapshot.
        const legacy = localStorage.getItem('kiotviet_app_data_v1');
        if (legacy) {
            try {
                const parsed = JSON.parse(legacy);
                (parsed.users || []).forEach((u) => delete u.password);
                localStorage.setItem('minikiot_legacy_recovery', JSON.stringify(parsed));
                localStorage.removeItem('kiotviet_app_data_v1');
            } catch {}
        }
        localStorage.removeItem('minikiot_auth_user_session');
        sessionStorage.removeItem('minikiot_auth_user_session');
        try {
            await this.fetchFromDatabase();
            return true;
        } catch {
            return false;
        }
    },
    async fetchFromDatabase() {
        this.adopt(await this.request('/api/data'));
        for (const pending of this.pending()) {
            try {
                await this.sendPending(this._volatilePending.get(pending.requestId) || pending);
            } catch (error) {
                if (!error.status || error.status >= 500 || error.status === 401) throw error;
                showToast(error.message, 'warning');
            }
        }
        this.showRecovery();
        return this.data;
    },
    async login(username, password, remember) {
        this.adopt(
            await this.request('/api/login', {
                method: 'POST',
                body: JSON.stringify({ username, password, remember })
            })
        );
        await this.fetchFromDatabase();
    },
    async save() {
        const payload = copyData(this.data);
        payload.settings.branch = this._base.settings.branch;
        return this.command('edit', payload);
    },
    async command(type, payload) {
        if (!this.user || !this.isDbConnected)
            throw new Error('Cần kết nối máy chủ và đăng nhập trước khi ghi giao dịch.');
        if (this.pending().length)
            throw new Error(
                'Có giao dịch chưa xác nhận. Bấm trạng thái lưu để đối soát trước khi tạo giao dịch mới.'
            );
        const requestId = makeCode(),
            pending = {
                userId: this.user.id,
                requestId,
                envelope: { requestId, revision: this.revision, type, payload }
            };
        const sensitive = type === 'edit' && payload.users?.some((u) => u.password);
        // Credentials only live in memory; reload queries the outcome instead of storing/replaying a password.
        localStorage.setItem(
            PENDING_PREFIX + requestId,
            JSON.stringify(
                sensitive ? { userId: this.user.id, requestId, sensitive: true } : pending
            )
        );
        this._volatilePending.set(requestId, pending);
        if (type === 'sale' && typeof state !== 'undefined')
            state.posTabs[state.activePosTab].pendingRequestId = requestId;
        return this.sendPending(pending);
    },
    async sendPending(pending) {
        const key = PENDING_PREFIX + pending.requestId;
        try {
            const result = pending.envelope
                ? await this.request('/api/command', {
                      method: 'POST',
                      headers: { 'X-MiniKiot-Base': String(this.revision) },
                      body: JSON.stringify(pending.envelope)
                  })
                : await this.request('/api/requests/' + encodeURIComponent(pending.requestId));
            localStorage.removeItem(key);
            this._volatilePending.delete(pending.requestId);
            await this.adoptResult(result);
            if (typeof state !== 'undefined') {
                const tab = state.posTabs.find((t) => t.pendingRequestId === pending.requestId);
                if (tab) {
                    tab.cart = [];
                    tab.customer = null;
                    tab.discount = 0;
                    tab.customerGiven = 0;
                    tab.note = '';
                    delete tab.branch;
                    delete tab.pendingRequestId;
                }
            }
            this.showRecovery();
            return result.result;
        } catch (error) {
            if (error.status && error.status !== 401 && error.status < 500) {
                const recovery = copyData(pending);
                if (recovery.envelope?.payload?.users)
                    recovery.envelope.payload.users.forEach((u) => delete u.password);
                localStorage.setItem(
                    `minikiot.rejected.${pending.userId}.${pending.requestId}`,
                    JSON.stringify(recovery)
                );
                localStorage.removeItem(key);
                this._volatilePending.delete(pending.requestId);
                this.adopt(await this.request('/api/data'));
            } else {
                this.isDbConnected = false;
                this.updateDbStatus();
            }
            this.showRecovery();
            throw error;
        }
    },
    async syncToDatabase() {
        await this.fetchFromDatabase();
        if (typeof renderAllViews === 'function') renderAllViews();
    },
    updateDbStatus() {
        const badge = document.getElementById('db-status-badge');
        if (!badge) return;
        badge.textContent = this.pending().length
            ? 'Chờ xác nhận lưu'
            : this.isDbConnected
              ? 'Đã kết nối SQLite'
              : 'Mất kết nối';
        badge.title = 'Bấm để tải dữ liệu mới và đối soát giao dịch đang chờ';
        badge.onclick = () => forceSyncDatabase();
    },
    showRecovery() {
        const button = document.getElementById('recovery-export');
        if (button) button.remove();
    },
    recoveryData() {
        const rejected = [];
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (key.startsWith(`minikiot.rejected.${this.user?.id}.`)) {
                try {
                    rejected.push(JSON.parse(localStorage.getItem(key)));
                } catch {}
            }
        }
        let legacy = null;
        if (this.user?.role === 'admin') {
            try {
                legacy = JSON.parse(localStorage.getItem('minikiot_legacy_recovery') || 'null');
            } catch {}
        }
        return { pending: this.pending(), rejected, legacy };
    },
    download(value, filename) {
        const url = URL.createObjectURL(
            new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
        );
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
    exportJSON() {
        this.download(this.data, `minikiot-export-${new Date().toISOString().slice(0, 10)}.json`);
    }
};
window.addEventListener('online', () => {
    if (KVStore.user && !KVStore._busy) forceSyncDatabase();
});
window.addEventListener('offline', () => {
    KVStore.isDbConnected = false;
    KVStore.updateDbStatus();
});
