# MiniKiot

Ứng dụng bán hàng dùng giao diện JavaScript thuần, máy chủ Node.js và SQLite. Máy chủ kiểm tra đăng nhập, quyền, chi nhánh và thực hiện giao dịch; trình duyệt nhập liệu và hiển thị kết quả.

## Khởi chạy

Yêu cầu **Node.js 24 trở lên**. Máy chủ dùng module `node:sqlite` tích hợp, không cần cài thư viện để chạy:

```bash
npm start
```

Mở `http://localhost:3000`. Thiết bị cùng LAN dùng `http://<IP-máy-chủ>:3000`. Không mở trực tiếp `index.html` bằng `file://`.

- Database mặc định: `minikiot.db` trong thư mục dự án. Có thể đổi bằng biến môi trường `MINIKIOT_DB_PATH`.
- `HOST` mặc định `0.0.0.0`, `PORT` mặc định `3000`.
- Database mới có danh mục/chi nhánh mặc định, bảng nghiệp vụ trống và tài khoản `admin`. Mật khẩu ngẫu nhiên được in một lần ở terminal. Có thể đặt `MINIKIOT_ADMIN_PASSWORD` trước lần khởi tạo đầu tiên, từ 8 đến 1024 ký tự.
- Với database có sẵn, tài khoản và mật khẩu đăng nhập được giữ nguyên; mật khẩu được chuyển sang dạng băm. Nên đổi các mật khẩu ngắn/mặc định còn lại.
- Phiên đăng nhập nằm trong bộ nhớ máy chủ; khởi động lại máy chủ yêu cầu đăng nhập lại. Giao dịch chờ và khóa chống ghi trùng vẫn được lưu bền vững.

Giao diện còn dùng Tailwind/font từ CDN và hình VietQR từ dịch vụ ngoài, nên cần Internet để tải đầy đủ những tài nguyên đó. Thanh toán chuyển khoản/thẻ là ghi nhận do thu ngân nhập; chưa có xác nhận tự động từ ngân hàng.

## Nâng cấp từ bản cũ

Dừng tiến trình máy chủ cũ trước khi chạy bản mới. Lần nâng cấp schema đầu tiên tự tạo bản sao nhất quán `minikiot.db.before-v2-<timestamp>.bak` bằng SQLite trước khi sửa schema. Nếu sao lưu hoặc nâng cấp thất bại, máy chủ không tiếp tục khởi động. Không chạy đồng thời phiên bản máy chủ cũ và mới trên cùng database.

Dữ liệu nghiệp vụ không được tự thay bằng dữ liệu mẫu khi danh mục sản phẩm trống. Cache LocalStorage cũ được giữ riêng để quản trị viên tải về đối soát, không tự ghi đè database. Bản sao trước nâng cấp có thể chứa mật khẩu dạng cũ; lưu trong thư mục chỉ người quản trị máy chủ có quyền truy cập.

Hóa đơn cũ thiếu giá vốn lịch sử sẽ hiển thị **“Thiếu giá vốn lịch sử”**. Chứng từ thiếu serial hoặc có phiếu trả cũ chưa xác định đủ tiền/nợ phải được đối soát trước khi tiếp tục hoàn/hủy. Không suy đoán rồi tự sửa số liệu lịch sử.

## Lưu giao dịch và mất kết nối

- Bán, nhập, trả, hủy, chuyển kho, nhận hàng, kiểm kho, thu/chi và thanh toán công nợ được xử lý trên máy chủ trong transaction.
- Mỗi yêu cầu có mã chống xử lý lặp và revision. Dữ liệu cũ từ máy khác bị từ chối; tải lại và kiểm tra trước khi gửi lại.
- Mất phản hồi sau khi gửi: trình duyệt giữ yêu cầu chờ, đối soát lại cùng mã để tránh ghi trùng. Không xóa dữ liệu trình duyệt khi còn yêu cầu chưa rõ kết quả.
- Hệ thống **không hỗ trợ tạo giao dịch bán mới hoàn toàn offline**. Cần kết nối máy chủ để xác nhận thành công; không nhầm Internet với kết nối LAN tới máy chủ.
- Nút tải dữ liệu/đối soát và bản tải phục hồi giúp kiểm tra yêu cầu chờ hoặc bị từ chối. Giao dịch sửa nhân viên có mật khẩu không lưu mật khẩu vào hàng đợi LocalStorage; khi tải lại trang, ứng dụng hỏi máy chủ xem yêu cầu đã được ghi hay chưa.
- Giỏ hàng chưa gửi nằm trong bộ nhớ trang và không phải bản nháp được lưu bền vững. Giao dịch đã gửi nhưng chưa rõ kết quả được lưu riêng để phục hồi.

## Sao lưu và phục hồi

Tạo bản sao nhất quán, kể cả dữ liệu đã commit còn nằm trong WAL, bằng:

```bash
npm run backup -- /duong-dan/ban-sao-2026-10-20.db
```

Thư mục đích phải tồn tại và tên file phải mới. Lệnh không ghi đè file cũ. Có thể chạy khi máy chủ đang hoạt động. Giữ nhiều bản sao ở nơi khác với máy vận hành; không chỉ sao chép riêng file `.db` trong lúc đang chạy WAL.

Phục hồi:

1. Dừng toàn bộ tiến trình đang sử dụng database.
2. Giữ nguyên bộ file hiện tại (`.db`, `-wal`, `-shm`) trong một thư mục lưu riêng để có thể quay lại.
3. Chép bản sao cần phục hồi thành một file `.db` mới, ở đường dẫn không có WAL/SHM cũ cùng tên.
4. Đặt `MINIKIOT_DB_PATH` trỏ tới file phục hồi và chạy máy chủ. Kiểm tra số lượng chứng từ, tồn kho và công nợ trước khi tiếp tục bán.

Nút xuất JSON trong giao diện chỉ xuất dữ liệu tài khoản được phép xem và không có mật khẩu. Đó không phải bản sao đầy đủ để khôi phục máy chủ.

## Kiểm thử và bảo trì

```bash
npm ci
npm run check
npm test
npm run format:check
```

Các thư viện npm chỉ phục vụ phát triển/kiểm thử. Bộ test dùng SQLite tạm và jsdom, nối frontend tới HTTP handler thật bằng request/response giả lập; không sử dụng `minikiot.db` hiện tại. Bao gồm phân quyền, chống mất/ghi trùng giao dịch, tồn kho/IMEI, hoàn tiền/công nợ, XSS, báo cáo, migration và phục hồi bản sao. Chưa thay thế kiểm thử trên trình duyệt thật, máy in, scanner, mobile và tải lớn.

Các module chính:

- `server.js`, `security.js`: HTTP, session, mật khẩu và quyền.
- `application.js`, `domain.js`: revision, giao dịch, validation, nghiệp vụ.
- `db.js`, `backup.js`: SQLite, migration và sao lưu.
- `client-store.js`, `ui-safety.js`, `app.js`: kết nối, phục hồi yêu cầu, render/in và giao diện.
- `data.js`: dữ liệu ví dụ cho test và mặc định khởi tạo, không phục vụ ra trình duyệt. URL `/data.js` trả về `client-store.js`.

Xem [trạng thái sửa lỗi](FIXES.md) và [báo cáo review ban đầu](CODE_REVIEW.md). Các bước phát triển tiếp theo: cập nhật từng bản ghi thay vì ghi lại snapshot phía server, phân trang dữ liệu, tách tiếp `app.js`, đóng gói tài nguyên CDN và kiểm thử thiết bị thực tế. Nếu triển khai ngoài LAN, cần cấu hình HTTPS và proxy phù hợp; máy chủ hiện chỉ phục vụ HTTP.
