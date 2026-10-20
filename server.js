'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { promisify } = require('node:util');
const db = require('./db');
const auth = require('./security');
const application = require('./application');
const sessions = new Map(),
    attempts = new Map();
const MAX_BODY = 8 * 1024 * 1024;
const ASSETS = {
    '/': 'index.html',
    '/index.html': 'index.html',
    // Old URL kept so existing bookmarks still open the app.
    '/giao_di_n_qu_n_l_b_n_h_ng_kiotviet.html': 'index.html',
    '/app.js': 'app.js',
    '/constants.js': 'constants.js',
    '/data.js': 'client-store.js',
    '/ui-safety.js': 'ui-safety.js',
    '/assets/tailwind.css': 'public/tailwind.css',
    '/assets/inter.css': 'public/inter.css',
    '/assets/inter-vietnamese-wght-normal.woff2': 'public/inter-vietnamese-wght-normal.woff2',
    '/assets/inter-latin-ext-wght-normal.woff2': 'public/inter-latin-ext-wght-normal.woff2',
    '/assets/inter-latin-wght-normal.woff2': 'public/inter-latin-wght-normal.woff2'
};
// Static files cached in memory with a gzip copy; reloaded when mtime/size change on disk.
const assetCache = new Map();
async function loadAsset(file) {
    const full = path.join(__dirname, file),
        stat = await fs.promises.stat(full),
        stamp = `${stat.mtimeMs}:${stat.size}`,
        cached = assetCache.get(file);
    if (cached?.stamp === stamp) return cached;
    const raw = await fs.promises.readFile(full);
    const asset = {
        stamp,
        raw,
        gzip: await promisify(zlib.gzip)(raw, { level: 9 }),
        etag: `"${crypto.createHash('sha1').update(raw).digest('base64url')}"`
    };
    assetCache.set(file, asset);
    return asset;
}
// Responses whose request accepted gzip. Kept outside `res` so test doubles need no extra fields.
const acceptsGzip = new WeakSet();
const gzipAsync = promisify(zlib.gzip);
async function json(res, status, data) {
    let payload = JSON.stringify(data);
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        Vary: 'Accept-Encoding'
    };
    // Full views are several MB of repetitive JSON; level 1 gives ~95% reduction in ~15 ms and
    // runs on the libuv threadpool, so the event loop stays free while compressing.
    if (payload.length > 1024 && acceptsGzip.has(res)) {
        payload = await gzipAsync(payload, { level: 1 });
        headers['Content-Encoding'] = 'gzip';
    }
    headers['Content-Length'] = Buffer.byteLength(payload);
    res.writeHead(status, headers);
    res.end(payload);
}
async function body(req) {
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))
        throw Object.assign(new Error('Yêu cầu JSON.'), { status: 415 });
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) throw Object.assign(new Error('Dữ liệu quá lớn.'), { status: 413 });
        chunks.push(chunk);
    }
    try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            throw new Error('object required');
        return parsed;
    } catch {
        throw Object.assign(new Error('JSON không hợp lệ.'), { status: 400 });
    }
}
function cookie(req) {
    return (req.headers.cookie || '')
        .split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('minikiot_session='))
        ?.slice(17);
}
function sessionUser(req) {
    const token = cookie(req),
        session = sessions.get(token);
    if (!session || session.expires < Date.now()) {
        sessions.delete(token);
        return null;
    }
    const user = db.readSnapshot().users.find((u) => u.id === session.userId);
    if (!user || user.status !== 'active' || user.password !== session.password) {
        sessions.delete(token);
        return null;
    }
    return user;
}
function setCookie(res, token, remember = false, secure = false) {
    res.setHeader(
        'Set-Cookie',
        `minikiot_session=${token}; HttpOnly; SameSite=Strict; Path=/${remember ? '; Max-Age=604800' : ''}${secure ? '; Secure' : ''}`
    );
}
function view(user) {
    const data = db.readSnapshot();
    const fresh = data.users.find((u) => u.id === user.id);
    if (!fresh || fresh.status !== 'active')
        throw Object.assign(new Error('Phiên đăng nhập đã hết hiệu lực.'), { status: 401 });
    return {
        success: true,
        user: auth.publicUser(fresh),
        data: application.project(data, fresh),
        revision: application.revision()
    };
}
async function handler(req, res) {
    if (/\bgzip\b/i.test(req.headers['accept-encoding'] || '')) acceptsGzip.add(res);
    try {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname.startsWith('/api/')) {
            if (req.headers.origin) {
                let origin;
                try {
                    origin = new URL(req.headers.origin);
                } catch {
                    throw Object.assign(new Error('Origin không hợp lệ.'), { status: 403 });
                }
                if (origin.host !== req.headers.host)
                    throw Object.assign(new Error('Không cho phép truy cập từ website khác.'), {
                        status: 403
                    });
            }
            if (req.method === 'OPTIONS')
                return json(res, 405, { success: false, error: 'Method not allowed' });
            if (url.pathname === '/api/login' && req.method === 'POST') {
                const input = await body(req),
                    key = req.socket?.remoteAddress || 'local',
                    time = Date.now();
                for (const [ip, value] of attempts) if (value.until < time) attempts.delete(ip);
                const throttle = attempts.get(key) || { count: 0, until: time + 15 * 60 * 1000 };
                if (throttle.count >= 10)
                    return json(res, 429, {
                        success: false,
                        error: 'Đăng nhập sai nhiều lần. Vui lòng thử lại sau.'
                    });
                const name =
                    typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
                const user = db
                    .readSnapshot()
                    .users.find((u) => u.username.toLowerCase() === name || u.phone === name);
                if (
                    !user ||
                    user.status !== 'active' ||
                    !auth.verifyPassword(input.password, user.password)
                ) {
                    throttle.count++;
                    attempts.set(key, throttle);
                    return json(res, 401, {
                        success: false,
                        error: 'Tên đăng nhập hoặc mật khẩu không đúng.'
                    });
                }
                attempts.delete(key);
                for (const [token, s] of sessions) if (s.expires < time) sessions.delete(token);
                const token = crypto.randomBytes(32).toString('hex'),
                    csrfToken = crypto.randomBytes(32).toString('base64url');
                sessions.set(token, {
                    userId: user.id,
                    password: user.password,
                    csrfToken,
                    expires: time + (input.remember ? 7 * 86400000 : 12 * 3600000)
                });
                setCookie(
                    res,
                    token,
                    !!input.remember,
                    !!req.socket?.encrypted || process.env.MINIKIOT_SECURE_COOKIE === '1'
                );
                return json(res, 200, { ...view(user), csrfToken });
            }
            const user = sessionUser(req);
            if (!user) return json(res, 401, { success: false, error: 'Vui lòng đăng nhập.' });
            const csrfToken = sessions.get(cookie(req)).csrfToken;
            if (!['GET', 'HEAD'].includes(req.method)) {
                const sent = Buffer.from(String(req.headers['x-minikiot-csrf'] || '')),
                    expected = Buffer.from(csrfToken);
                if (sent.length !== expected.length || !crypto.timingSafeEqual(sent, expected))
                    return json(res, 403, {
                        success: false,
                        error: 'Mã bảo vệ phiên không hợp lệ. Hãy tải lại trang.'
                    });
            }
            if (url.pathname === '/api/data' && req.method === 'GET')
                return json(res, 200, { ...view(user), csrfToken });
            if (url.pathname.startsWith('/api/requests/') && req.method === 'GET') {
                const requestId = url.pathname.slice('/api/requests/'.length);
                const record = db
                    .getDb()
                    .prepare('SELECT result FROM processed_requests WHERE id=? AND userId=?')
                    .get(requestId, user.id);
                if (!record)
                    return json(res, 409, {
                        success: false,
                        error: 'Chưa tìm thấy kết quả giao dịch nhân viên. Hãy kiểm tra danh sách trước khi lưu lại.'
                    });
                return json(res, 200, {
                    ...view(user),
                    result: JSON.parse(record.result),
                    replayed: true
                });
            }
            if (url.pathname === '/api/logout' && req.method === 'POST') {
                await body(req);
                sessions.delete(cookie(req));
                res.setHeader(
                    'Set-Cookie',
                    'minikiot_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
                );
                return json(res, 200, { success: true });
            }
            if (url.pathname === '/api/password' && req.method === 'POST') {
                const input = await body(req);
                const fresh = sessionUser(req);
                if (!fresh)
                    return json(res, 401, {
                        success: false,
                        error: 'Phiên đăng nhập đã hết hiệu lực.'
                    });
                if (!auth.verifyPassword(input.current, fresh.password))
                    return json(res, 422, {
                        success: false,
                        error: 'Mật khẩu hiện tại không đúng.'
                    });
                if (
                    typeof input.next !== 'string' ||
                    input.next.length < 8 ||
                    input.next.length > 1024
                )
                    return json(res, 422, {
                        success: false,
                        error: 'Mật khẩu mới phải từ 8 đến 1024 ký tự.'
                    });
                const database = db.getDb();
                database.exec('BEGIN IMMEDIATE');
                try {
                    database
                        .prepare('UPDATE users SET password=? WHERE id=?')
                        .run(auth.hashPassword(input.next), fresh.id);
                    database
                        .prepare(
                            "UPDATE app_meta SET value=CAST(value AS INTEGER)+1 WHERE key='revision'"
                        )
                        .run();
                    database.exec('COMMIT');
                } catch (error) {
                    database.exec('ROLLBACK');
                    throw error;
                }
                for (const [token, s] of sessions) if (s.userId === user.id) sessions.delete(token);
                return json(res, 200, {
                    success: true,
                    message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.'
                });
            }
            if (url.pathname === '/api/command' && req.method === 'POST') {
                const envelope = await body(req),
                    fresh = sessionUser(req);
                if (!fresh)
                    return json(res, 401, {
                        success: false,
                        error: 'Phiên đăng nhập đã hết hiệu lực.'
                    });
                // Client holding the view at revision `base` can take only the changed rows.
                // `prior` is that view, rebuilt from the snapshot (same tick, before the write).
                const base = Number(req.headers['x-minikiot-base']);
                const priorRevision = application.revision();
                const prior =
                    base === priorRevision && envelope?.revision === base
                        ? application.project(db.readSnapshot(), fresh)
                        : null;
                const result = application.transact(fresh, envelope);
                const next = view(fresh);
                // transact checks revision in its own write transaction, so a fresh (not replayed)
                // commit at base+1 was applied on top of exactly the state `prior` was built from.
                const delta =
                    prior && !result.replayed && next.revision === base + 1
                        ? application.diffViews(prior, next.data)
                        : null;
                if (!delta) return json(res, 200, { ...next, ...result });
                const { data, ...rest } = next;
                return json(res, 200, { ...rest, ...result, base, delta });
            }
            if (url.pathname === '/api/status' && req.method === 'GET') {
                auth.requirePermission(user, 'settings');
                const { dbPath, ...stats } = db.getStats();
                return json(res, 200, { success: true, stats });
            }
            // Snapshot replacement/reset are intentionally not public API operations.
            return json(res, 404, { success: false, error: 'API không tồn tại.' });
        }
        if (!['GET', 'HEAD'].includes(req.method))
            return json(res, 405, { success: false, error: 'Method not allowed' });
        const file = Object.hasOwn(ASSETS, url.pathname) ? ASSETS[url.pathname] : null;
        if (!file) return json(res, 404, { success: false, error: 'Không tìm thấy tài nguyên.' });
        const asset = await loadAsset(file);
        const gzip = acceptsGzip.has(res);
        const contentTypes = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.woff2': 'font/woff2'
        };
        const headers = {
            'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'same-origin',
            'Cache-Control': 'no-cache',
            'X-Frame-Options': 'DENY',
            ETag: asset.etag,
            Vary: 'Accept-Encoding'
        };
        if (req.headers['if-none-match'] === asset.etag) {
            res.writeHead(304, headers);
            return res.end();
        }
        const content = gzip ? asset.gzip : asset.raw;
        if (gzip) headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = content.length;
        res.writeHead(200, headers);
        res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
        if (!res.headersSent)
            await json(res, error.status || 500, {
                success: false,
                error: error.status
                    ? error.message
                    : 'Không nhận được kết quả hoàn tất. Hãy đối soát giao dịch chờ trước khi thử lại.'
            });
        else res.end();
        if (!error.status) console.error(error);
    }
}
function createServer() {
    db.initDb();
    return http.createServer(handler);
}
if (require.main === module) {
    const server = createServer();
    server.listen(process.env.PORT || 3000, process.env.HOST || '0.0.0.0', () =>
        console.log(`MiniKiot: http://localhost:${process.env.PORT || 3000}`)
    );
}
module.exports = { handler };
