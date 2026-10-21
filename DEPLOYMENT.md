# Triển khai HTTPS và reverse proxy

NKiot chỉ phục vụ HTTP. Khi dùng ngoài một LAN tin cậy, đặt máy chủ sau reverse proxy kết thúc TLS và chỉ cho proxy truy cập cổng Node.

## Chạy ứng dụng

```bash
HOST=127.0.0.1 PORT=3000 MINIKIOT_SECURE_COOKIE=1 \
MINIKIOT_DB_PATH=/var/lib/minikiot/minikiot.db npm start
```

`MINIKIOT_SECURE_COOKIE=1` gắn cờ `Secure` cho cookie phiên. Chỉ bật khi người dùng truy cập bằng HTTPS; nếu không trình duyệt sẽ không gửi cookie.

Không mở trực tiếp cổng `3000` ra Internet. Chạy bằng tài khoản hệ thống riêng, quyền ghi chỉ cho thư mục database và backup.

## Nginx

```nginx
server {
    listen 80;
    server_name pos.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pos.example.com;

    ssl_certificate /etc/letsencrypt/live/pos.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pos.example.com/privkey.pem;
    add_header Strict-Transport-Security "max-age=31536000" always;
    client_max_body_size 8m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Giữ `proxy_set_header Host $host`: máy chủ so sánh `Origin` với `Host` để chặn request từ website khác. Ứng dụng chưa dùng `X-Forwarded-For` cho giới hạn đăng nhập; mọi lần thử đi qua proxy được tính theo IP proxy. Cần thêm rate limit ở proxy nếu mở ra Internet.

Bật HSTS chỉ sau khi HTTPS hoạt động ổn định trên tên miền này.

## Caddy

```caddyfile
pos.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy tự cấp/gia hạn chứng chỉ và chuyển tiếp `Host` mặc định.

## Kiểm tra sau triển khai

1. Mở `https://pos.example.com`, đăng nhập, bán thử một giao dịch trên dữ liệu thử.
2. Trong DevTools, cookie `minikiot_session` phải có `HttpOnly`, `Secure`, `SameSite=Strict`.
3. Không có request nào tới `cdn.tailwindcss.com` hoặc `fonts.googleapis.com`.
4. `http://pos.example.com` chuyển sang HTTPS; cổng `3000` không truy cập được từ ngoài máy chủ.
5. Chạy `npm run backup -- --rotate /var/backups/minikiot 14` thủ công một lần, rồi kiểm tra lại bằng `--verify`.

## CSP

Chưa bật Content-Security-Policy chặt. Giao diện còn inline event handler, inline script/style. Sẽ bật sau khi tách các phần này khỏi `index.html`/`app.js`.
