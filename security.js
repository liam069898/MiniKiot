'use strict';
const crypto = require('node:crypto');
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password, encoded) {
    if (typeof password !== 'string' || password.length > 1024 || !encoded?.startsWith('scrypt$'))
        return false;
    const [, salt, digest] = encoded.split('$');
    const stored = Buffer.from(digest || '', 'hex');
    return (
        stored.length === 64 &&
        crypto.timingSafeEqual(stored, crypto.scryptSync(password, salt, 64))
    );
}
function publicUser(user) {
    const { password, ...safe } = user;
    return safe;
}
function can(user, permission) {
    return (
        user?.status === 'active' &&
        (user.role === 'admin' || user.permissions?.[permission] === true)
    );
}
function allowedBranches(user, data) {
    return user.role === 'admin'
        ? data.branches.map((b) => b.name)
        : user.branches?.length
          ? user.branches
          : [user.branch];
}
function requirePermission(user, permission) {
    if (!can(user, permission))
        throw Object.assign(new Error('Bạn không có quyền thực hiện thao tác này.'), {
            status: 403
        });
}
module.exports = {
    hashPassword,
    verifyPassword,
    publicUser,
    can,
    allowedBranches,
    requirePermission
};
