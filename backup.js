'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

// VACUUM INTO includes committed WAL data and creates a consistent standalone file.
function backupDatabase(source, destination) {
    if (!fs.existsSync(source)) throw new Error('Không tìm thấy cơ sở dữ liệu nguồn.');
    if (fs.existsSync(destination)) throw new Error('File đích đã tồn tại; chọn tên mới.');
    const database = new DatabaseSync(source, { readOnly: true });
    try {
        database.exec('PRAGMA busy_timeout = 5000');
        database.prepare('VACUUM INTO ?').run(path.resolve(destination));
    } finally {
        database.close();
    }
    return path.resolve(destination);
}

if (require.main === module) {
    const source = process.env.MINIKIOT_DB_PATH || path.join(__dirname, 'minikiot.db');
    const destination = process.argv[2];
    if (!destination) {
        console.error('Cách dùng: npm run backup -- /duong-dan/ban-sao.db');
        process.exitCode = 1;
    } else {
        try {
            console.log('Đã sao lưu:', backupDatabase(source, destination));
        } catch (error) {
            console.error('Sao lưu thất bại:', error.message);
            process.exitCode = 1;
        }
    }
}

module.exports = { backupDatabase };
