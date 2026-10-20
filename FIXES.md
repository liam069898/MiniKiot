# Trạng thái sửa lỗi sau review — 20/10/2026

Đối chiếu các phát hiện trong `CODE_REVIEW.md`. Đây là trạng thái của source sau sửa; dữ liệu vận hành chưa được nâng cấp trực tiếp trong quá trình phát triển.

| Phát hiện | Thay đổi và giới hạn |
| --- | --- |
| 1. API/mật khẩu | Đăng nhập phía server, scrypt, cookie HttpOnly/SameSite, phân quyền nghiệp vụ/chi nhánh, giới hạn đăng nhập sai. Không trả password/hash. Bỏ API sync/reset công khai. |
| 2. Tải database/source | Static allowlist chỉ trả asset giao diện; DB, WAL, backup và source backend không được phục vụ. |
| 3. Ghi đè giữa nhiều máy | Transaction `BEGIN IMMEDIATE`, revision, mã yêu cầu chống xử lý lặp, nhật ký thao tác. Còn ghi snapshot nội bộ phía server; tối ưu SQL từng bản ghi là việc tiếp theo. |
| 4. Seed đè dữ liệu | Nhận diện database mới bằng schema. Danh mục rỗng không kích hoạt seed. Sao lưu tự động trước nâng cấp. |
| 5. Mất giao dịch offline | Lưu yêu cầu chưa rõ kết quả, retry đúng mã, đối soát khi tải lại. Không nhận giao dịch bán mới hoàn toàn offline; cache cũ được giữ để đối soát thủ công. |
| 6. Stored XSS | Escape dữ liệu trong HTML/attribute và tham số event handler; bộ test có payload tên/mã độc hại. |
| 7–8. Trả/hủy và tiền/nợ | Giới hạn lượng còn được trả, hủy phần còn lại, hoàn giá sau chiết khấu, giảm nợ trước hoàn tiền, đảo điểm/tổng chi tiêu. |
| 9–10. Bán thiếu kho/thiếu tiền | Kiểm tra tồn, giá, chi nhánh và số tiền trên server. Khách lẻ phải trả đủ; khách có hồ sơ được ghi nợ. |
| 11. IMEI | Lưu serial trong chứng từ bán/chuyển, trả đúng serial; chặn trùng serial tại kho và đang chuyển. Chặn cân bằng làm lệch số serial; chưa có màn hình đối soát serial chuyên biệt. |
| 12. Mất trường | Lưu các trường mở rộng qua cột `extra`; kiểm thử roundtrip. |
| 13. Trùng mã | Mã ngẫu nhiên thay cho số lượng bản ghi; kiểm tra uniqueness. |
| 14–16. Báo cáo | Giá trị dòng/chiết khấu, giá vốn lịch sử, đảo giá vốn khi trả, phân loại phương thức thực tế. Đơn mới hủy ở kỳ sau giữ giao dịch gốc và ghi đảo vào ngày hủy. Không dựng lại giá vốn lịch sử bị thiếu. |
| 17. Payload/JSON lỗi | Validation kiểu, số tiền/số lượng, quyền và trường được sửa. Dữ liệu JSON cũ hỏng không bị âm thầm ghi đè khi lưu giao dịch mới. |
| 18. Khách trùng tên | Liên kết customerId; dữ liệu cũ chỉ suy ra khách khi số điện thoại xác định duy nhất. |
| 19. In | Chọn vùng tài liệu riêng cho hóa đơn, phiếu trả, báo cáo và tem; sao chép canvas khi in. Chưa thử máy in vật lý. |

## Kiểm chứng

- `npm test`: **38/38 test đạt**, kiểm thử backend, DOM và luồng tích hợp frontend–HTTP handler–SQLite trên dữ liệu tạm.
- `npm run check`: kiểm tra cú pháp **15 file JavaScript**, đạt.
- `npm run format:check`: kiểm tra định dạng source JavaScript, đạt.
- Đã thử nâng cấp trên bản sao database hiện có: giữ 2 chi nhánh, 9 nhóm hàng, 13 sản phẩm, 13 khách, 5 nhà cung cấp, 17 hóa đơn, 9 phiếu nhập, 7 phiếu thu/chi, 1 phiếu trả, 2 phiếu kiểm, 2 phiếu chuyển và 4 tài khoản. Không sửa `minikiot.db` gốc.
- Cả 17 hóa đơn trên bản sao thiếu giá vốn lịch sử. Báo cáo lợi nhuận phần dữ liệu đó chưa thể xác định chính xác; cần đối soát nguồn gốc.
- Test tự động kiểm tra nâng cấp có bản sao trước schema, giữ mật khẩu cũ, không seed lại danh mục rỗng; backup chứa commit trong WAL và mở lại được với `integrity_check = ok`.

## Việc còn lại trước nghiệm thu vận hành

Kiểm thử trình duyệt thật, bố cục mobile, scanner, máy in và tải dữ liệu lớn. Kiểm tra số dư/chứng từ cũ thiếu thông tin, đặc biệt hoàn tiền, công nợ và serial. Bộ test hiện chưa chứng minh toàn bộ dữ liệu lịch sử đã đúng nghiệp vụ.

Ứng dụng vẫn còn các giới hạn về tài nguyên CDN, frontend lớn, snapshot nội bộ và session trong bộ nhớ. Những phần này được ghi rõ trong README, không xem là đã hoàn thành một hệ thống POS sản xuất đầy đủ.
