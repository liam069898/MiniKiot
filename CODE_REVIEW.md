**Review NKiot — 20/10/2026**

> Báo cáo này mô tả phiên bản trước khi sửa; số dòng và nhận xét dưới đây được giữ làm lịch sử. Xem [FIXES.md](FIXES.md) để biết thay đổi đã thực hiện, kiểm chứng và giới hạn còn lại.

Đánh giá: dự án có phạm vi chức năng tốt cho một prototype POS, nhưng chưa đủ tin cậy để vận hành dữ liệu bán hàng thật hoặc nhiều máy thu ngân. Các vấn đề ưu tiên nằm ở bảo mật, bảo toàn giao dịch và tính đúng của tiền/tồn kho, trước việc chỉnh giao diện hoặc đổi framework.

**Phạm vi và cách kiểm tra**

- Rà soát backend `server.js`, `db.js`; frontend `app.js`, `data.js`; cấu trúc HTML, cấu hình in, `package.json` và README.
- `index.html` và `giao_di_n_qu_n_l_b_n_h_ng_kiotviet.html` giống nhau hoàn toàn. File HTML backup là bản cũ, không phải entrypoint chính.
- Chạy `node --check` cho cả 4 file JavaScript: không có lỗi cú pháp. Kiểm tra tĩnh HTML chính: không trùng ID; các lời gọi hàm trực tiếp trong event handler có định nghĩa tương ứng.
- Chạy 21 kiểm tra tái hiện/quan sát với Node v24.21.0, database SQLite mới trong thư mục tạm và dữ liệu giả. Backend dùng handler thật với request/response giả lập; nghiệp vụ frontend chạy trong VM với DOM tối thiểu, bỏ qua các hàm render không liên quan.
- Không khởi chạy server của workspace, không ghi vào `minikiot.db` hiện tại và không sửa source ứng dụng. File này là báo cáo bổ sung.
- Chưa kiểm thử trình duyệt end-to-end, giao diện mobile, thiết bị in/scanner, thanh toán thực tế hoặc tải lớn. Kiểm tra XSS xác nhận HTML nguy hiểm đi vào đầu ra; chưa chạy payload trong trình duyệt thật.
- Workspace hiện không có Git repository để đối chiếu lịch sử thay đổi.

P0: cần xử lý trước khi vận hành dữ liệu thật. P1: lỗi nghiêm trọng cần sửa trước khi nghiệm thu. P2: cải thiện chức năng, vận hành và khả năng bảo trì.

**Các phát hiện ưu tiên**

1. **[P0] API không xác thực; mật khẩu được trả về cho client.**

   Vị trí: [server.js:71](/Users/nhattran/Desktop/MiniKiot/server.js:71), [db.js:347](/Users/nhattran/Desktop/MiniKiot/db.js:347), [app.js:5490](/Users/nhattran/Desktop/MiniKiot/app.js:5490).

   `/api/data`, `/api/sync` và `/api/reset` không kiểm tra session hoặc quyền. Đăng nhập chỉ so sánh mật khẩu ở trình duyệt; toàn bộ user, password và permissions được lưu trong browser storage. Ai truy cập được server có thể đọc dữ liệu, sửa quyền hoặc reset database bằng API. CORS cho phép mọi origin làm tăng phạm vi rủi ro; giới hạn CORS riêng lẻ không thay thế xác thực.

   Tái hiện: GET dữ liệu và POST reset không có thông tin đăng nhập đều trả 200; response dữ liệu chứa 4 trường password của dữ liệu mẫu.

   Đề xuất: đăng nhập và kiểm tra quyền/chi nhánh ở server; băm mật khẩu có salt; session an toàn; bỏ password khỏi mọi response nghiệp vụ; tách dữ liệu demo và quy trình tạo quản trị viên khỏi bản vận hành. Kiểm tra quyền tại từng thao tác thay đổi dữ liệu, không chỉ khi mở màn hình.

2. **[P0] Static server cho tải trực tiếp database và source backend.**

   Vị trí: [server.js:105](/Users/nhattran/Desktop/MiniKiot/server.js:105), [server.js:131](/Users/nhattran/Desktop/MiniKiot/server.js:131).

   Server phục vụ mọi file trong thư mục dự án. `/minikiot.db`, các file WAL/SHM nếu tồn tại, `/db.js` và `/server.js` đều nằm trong vùng có thể được trả về. Kiểm tra đường dẫn còn trong root không ngăn việc lộ những file này.

   Tái hiện: GET `/minikiot.db` trả 200 và nội dung có header `SQLite format 3` trên bản tạm.

   Đề xuất: chỉ phục vụ thư mục `public/` hoặc danh sách asset cho phép; đặt database, backup, source backend ngoài web root. Thêm kiểm tra bảo đảm các đường dẫn nhạy cảm trả 403/404.

3. **[P0] Đồng bộ toàn bộ snapshot làm mất giao dịch giữa các máy/tab.**

   Vị trí: [data.js:390](/Users/nhattran/Desktop/MiniKiot/data.js:390), [db.js:415](/Users/nhattran/Desktop/MiniKiot/db.js:415), [db.js:457](/Users/nhattran/Desktop/MiniKiot/db.js:457).

   Mỗi client gửi toàn bộ store; server xóa rồi chèn lại từng bảng. Không có revision, phát hiện xung đột hoặc API giao dịch riêng. Hai client không cần ghi đúng cùng một thời điểm để gây mất dữ liệu.

   Tái hiện: A và B cùng đọc snapshot; A thêm hóa đơn rồi lưu; B chỉ đổi tên khách hàng và lưu snapshot cũ. Hóa đơn của A biến mất. SQLite transaction vẫn chạy đúng, nhưng không giải quyết việc ghi đè dữ liệu từ client cũ.

   Đề xuất: chuyển sang API theo nghiệp vụ; server cập nhật hóa đơn, tồn kho, công nợ và sổ quỹ trong một transaction; có khóa chống xử lý lặp và kiểm soát phiên bản. Có thể chặn snapshot cũ bằng revision như biện pháp chuyển tiếp, nhưng không xem đó là giải pháp đồng bộ offline hoàn chỉnh.

4. **[P0] Khởi động khi không còn sản phẩm sẽ ghi đè dữ liệu cửa hàng bằng dữ liệu mẫu.**

   Vị trí: [db.js:237](/Users/nhattran/Desktop/MiniKiot/db.js:237).

   `products.count === 0` được coi là database mới và gọi `saveAllData(defaultData)` cho toàn bộ bảng. Danh mục trống là trạng thái hợp lệ, ví dụ sau khi xóa hết sản phẩm, không đồng nghĩa chưa khởi tạo hệ thống.

   Tái hiện: lưu database có hóa đơn riêng và `products: []`, chạy lại `initDb()`: hóa đơn riêng bị thay bằng dữ liệu mẫu.

   Đề xuất: dùng bảng/version migration đánh dấu khởi tạo; seed demo chỉ qua lệnh chủ động. Không suy luận trạng thái khởi tạo từ số lượng bản ghi nghiệp vụ.

5. **[P1] Giao dịch offline có thể mất khi mở lại ứng dụng.**

   Vị trí: [data.js:338](/Users/nhattran/Desktop/MiniKiot/data.js:338), [data.js:351](/Users/nhattran/Desktop/MiniKiot/data.js:351), [data.js:384](/Users/nhattran/Desktop/MiniKiot/data.js:384).

   Sau khi đọc LocalStorage, ứng dụng tải server và thay toàn bộ `this.data`. Không có hàng đợi giao dịch chưa đồng bộ, tự retry sau lỗi hoặc xử lý reconnect. Cờ `_isSyncing` chỉ được gán, không ngăn request chồng nhau. UI báo thanh toán thành công trước khi có xác nhận lưu từ server.

   Tái hiện: store local có một hóa đơn chưa sync; tải snapshot server chưa có hóa đơn đó làm số hóa đơn local về 0.

   Đề xuất: hàng đợi bền vững cho thao tác chờ đồng bộ, ID giao dịch duy nhất, retry có kiểm soát, chống ghi lặp; phân biệt trạng thái chờ lưu/đã lưu/lưu lỗi. Khi khởi động phải bảo vệ giao dịch chưa được server xác nhận. Nếu chưa hỗ trợ đúng offline thì chặn giao dịch mới khi mất kết nối.

6. **[P1] Dữ liệu nhập được chèn thẳng vào HTML, tạo nguy cơ stored XSS.**

   Vị trí: [app.js:1360](/Users/nhattran/Desktop/MiniKiot/app.js:1360), [app.js:283](/Users/nhattran/Desktop/MiniKiot/app.js:283), [app.js:2723](/Users/nhattran/Desktop/MiniKiot/app.js:2723).

   Tên sản phẩm, tên chi nhánh, khách hàng và nhiều trường khác được nội suy vào `innerHTML`; mã/chuỗi còn được ghép vào `onclick`. Dữ liệu có thể đi vào từ form, import JSON hoặc API rồi xuất hiện trên máy khác.

   Tái hiện mức đầu ra: tên sản phẩm chứa thẻ `img` và thuộc tính `onerror` xuất hiện nguyên dạng trong HTML của dòng sản phẩm.

   Đề xuất: dùng `textContent`, DOM API và `addEventListener`; tách dữ liệu khỏi JavaScript nội tuyến. Với trường thực sự cho phép HTML cần sanitizer và tập thẻ/thuộc tính cho phép. CSP là lớp bổ sung, không thay thế việc sửa cách render.

7. **[P1] Trả hàng nhiều lần hoặc hủy sau khi trả làm cộng kho và hoàn tiền lặp.**

   Vị trí: [app.js:2701](/Users/nhattran/Desktop/MiniKiot/app.js:2701), [app.js:2783](/Users/nhattran/Desktop/MiniKiot/app.js:2783), [app.js:2640](/Users/nhattran/Desktop/MiniKiot/app.js:2640).

   Mở phiếu trả chỉ chặn hóa đơn đã hủy; không trừ số lượng đã trả trong các phiếu trước. `hasReturned` chỉ phục vụ hiển thị. Hủy hóa đơn vẫn hoàn toàn bộ số lượng và `inv.paid`, không đối chiếu phần đã hoàn.

   Tái hiện: bán 1 sản phẩm từ kho 3; trả cùng sản phẩm hai lần làm kho lên 4; hủy tiếp làm kho lên 5 và phát sinh thêm phiếu hoàn tiền.

   Đề xuất: tính số lượng còn được trả theo dòng hóa đơn; kiểm tra lại tại server khi ghi; trạng thái chứng từ và giao dịch đảo phải đối chiếu các lần xử lý trước. Chống double-submit và request lặp.

8. **[P1] Hoàn tiền bỏ qua chiết khấu và công nợ.**

   Vị trí: [app.js:2789](/Users/nhattran/Desktop/MiniKiot/app.js:2789), [app.js:2837](/Users/nhattran/Desktop/MiniKiot/app.js:2837).

   Tiền hoàn luôn bằng số lượng nhân giá niêm yết và được ghi thành tiền chi. Không phân bổ giảm giá hóa đơn, không giảm công nợ, tổng chi tiêu hoặc điểm khách hàng.

   Tái hiện: hàng giá 100, giảm 20, khách trả 30 và nợ 50; trả toàn bộ hàng tạo phiếu chi 100, trong khi nợ 50 vẫn giữ nguyên. Một lần trả đã sai, độc lập với lỗi trả lặp.

   Đề xuất: lưu giá trị thực sau giảm giá theo dòng; tách phần giảm nợ và tiền thực hoàn; cập nhật điểm/chi tiêu theo chính sách đã xác định. Mọi bút toán phải cùng transaction và đối chiếu khoản thanh toán gốc.

9. **[P1] Checkout không kiểm tra đủ tồn, có thể trừ nhầm chi nhánh.**

   Vị trí: [app.js:1048](/Users/nhattran/Desktop/MiniKiot/app.js:1048), [app.js:1197](/Users/nhattran/Desktop/MiniKiot/app.js:1197).

   Giỏ cho tăng số lượng tùy ý; checkout dùng `Math.max(0, stock - qty)` để che số âm. Khi không tìm thấy mã ở chi nhánh hiện tại, code fallback sang sản phẩm cùng mã ở bất kỳ chi nhánh nào. Giỏ không lưu chi nhánh cố định nên việc đổi chi nhánh trong khi có đơn mở cũng cần được kiểm soát.

   Tái hiện: tồn 1 nhưng bán 3 vẫn tạo hóa đơn và đưa tồn về 0.

   Đề xuất: kiểm tra và trừ tồn nguyên tử trên server theo `productId + branchId`; không fallback sang chi nhánh khác. Gắn chi nhánh vào giỏ/chứng từ và kiểm tra lại khi thanh toán. Nếu cho phép âm kho thì phải có chính sách rõ, không ép số âm thành 0.

10. **[P1] Khách lẻ trả thiếu vẫn được ghi nhận đã thu đủ tiền.**

    Vị trí: [app.js:1164](/Users/nhattran/Desktop/MiniKiot/app.js:1164), [app.js:1225](/Users/nhattran/Desktop/MiniKiot/app.js:1225).

    `paid` mặc định bằng toàn bộ giá trị đơn và chỉ điều chỉnh khi khách không phải khách lẻ. Tái hiện: đơn tiền mặt 100, số tiền khách đưa 0 vẫn lưu `paid = 100` và phiếu thu 100.

    Đề xuất: chặn thanh toán thiếu cho khách lẻ hoặc yêu cầu chọn khách hàng và ghi nợ rõ ràng. Chỉ ghi sổ quỹ số tiền thực nhận; tách tiền khách đưa, tiền thừa và số tiền được phân bổ cho đơn.

11. **[P1] Vòng đời IMEI chưa được bảo toàn qua bán/trả/chuyển/kiểm kho.**

    Vị trí: [app.js:1184](/Users/nhattran/Desktop/MiniKiot/app.js:1184), [app.js:1204](/Users/nhattran/Desktop/MiniKiot/app.js:1204), [app.js:2255](/Users/nhattran/Desktop/MiniKiot/app.js:2255), [app.js:2323](/Users/nhattran/Desktop/MiniKiot/app.js:2323).

    Hóa đơn sao chép giỏ trước khi IMEI được gán vào `cartItem`, nên mất dấu IMEI đã bán. Trả/hủy chỉ cộng số lượng, không khôi phục IMEI. Chuyển hàng chỉ thay đổi stock; sản phẩm mới ở kho nhận không sao chép cờ quản lý IMEI. Kiểm kho cũng chỉ gán lại số lượng.

    Tái hiện phần bán: I1 bị lấy khỏi kho nhưng dòng hóa đơn không chứa I1.

    Đề xuất: quản lý serial thành thực thể có mã duy nhất, trạng thái và vị trí; liên kết serial với dòng bán, trả và chuyển. Chọn serial trước khi tạo snapshot hóa đơn; ràng buộc số lượng tồn khớp số serial đang ở kho.

12. **[P1] SQLite không lưu đầy đủ các trường frontend đang sử dụng.**

    Vị trí: [db.js:83](/Users/nhattran/Desktop/MiniKiot/db.js:83), [db.js:458](/Users/nhattran/Desktop/MiniKiot/db.js:458), [app.js:2677](/Users/nhattran/Desktop/MiniKiot/app.js:2677).

    Tái hiện vòng lưu/đọc: mất `invoice.paymentMethod`, `note`, `hasReturned`, `cancelReason`, `cancelTime`; ghi chú khách hàng cũng mất. Schema nhà cung cấp không lưu `note`, và `recentActivities` không có phần lưu tương ứng.

    Hệ quả: tải lại có thể mất trạng thái hiển thị trả hàng, lịch sử lý do hủy và dữ liệu cần cho báo cáo thanh toán.

    Đề xuất: định nghĩa schema dữ liệu thống nhất giữa frontend/backend; migration có version cho trường còn thiếu. Viết kiểm tra round-trip cho từng loại chứng từ và trường nghiệp vụ bắt buộc.

13. **[P1] Quy tắc sinh mã chứng từ không thống nhất, gây trùng khóa và hỏng đồng bộ.**

    Vị trí: [app.js:1227](/Users/nhattran/Desktop/MiniKiot/app.js:1227), [app.js:3916](/Users/nhattran/Desktop/MiniKiot/app.js:3916), [app.js:4013](/Users/nhattran/Desktop/MiniKiot/app.js:4013).

    Phiếu tự động dùng tổng độ dài cashbook; phiếu thủ công đếm riêng thu hoặc chi. Ví dụ đã có PT0001, PC0002; bán hàng tạo PT0003; tạo phiếu thu thủ công tiếp theo cũng đề xuất PT0003. Các mã dựa vào độ dài mảng còn có vấn đề khi xóa bản ghi hoặc nhiều client làm việc.

    Tái hiện: mã thủ công trùng mã có sẵn; SQLite báo `UNIQUE constraint failed: cashbook.id` và rollback toàn bộ sync. Frontend vẫn có thể đã báo lưu thành công trước đó.

    Đề xuất: ID nội bộ duy nhất, mã chứng từ do server cấp qua sequence trong transaction; kiểm tra uniqueness trước commit. Thông báo thành công phải phản ánh trạng thái lưu thực tế.

14. **[P1] Báo cáo sản phẩm ghi doanh thu bằng 0 với đơn POS mới.**

    Vị trí: [app.js:1054](/Users/nhattran/Desktop/MiniKiot/app.js:1054), [app.js:4517](/Users/nhattran/Desktop/MiniKiot/app.js:4517).

    Giỏ lưu `price`, `qty`, `costPrice` nhưng không có `total`; báo cáo cộng `it.total || 0`. Tái hiện: đơn POS 100 cho doanh thu sản phẩm 0.

    Đề xuất: chuẩn hóa dòng hóa đơn có tổng dòng và giảm giá phân bổ; dùng chung quy tắc tính giữa checkout, in và báo cáo. Có test đối chiếu tổng doanh thu dòng với tổng hóa đơn.

15. **[P1] Lợi nhuận quá khứ thay đổi khi sửa/nhập giá vốn; hàng trả chưa đảo giá vốn.**

    Vị trí: [app.js:4341](/Users/nhattran/Desktop/MiniKiot/app.js:4341), [app.js:4509](/Users/nhattran/Desktop/MiniKiot/app.js:4509).

    Báo cáo lấy `product.costPrice` hiện tại thay cho `item.costPrice` lúc bán; nếu sản phẩm đã xóa thì ước lượng 70% giá bán. Doanh thu bị trừ hàng trả nhưng giá vốn tương ứng không được đảo. `Math.max(0, grossRevenue - totalReturns)` còn che mất doanh thu thuần âm ở kỳ có nhiều hoàn trả.

    Tái hiện: bán 100 với vốn 50; đổi vốn sản phẩm thành 80 làm lợi nhuận đơn cũ đổi từ 50 thành 20.

    Đề xuất: lưu giá vốn lịch sử theo dòng và bút toán giá vốn cho bán/trả; không dùng số ước lượng trong báo cáo thực tế. Báo cáo theo kỳ cần cho phép các số âm hợp lệ.

16. **[P1] Báo cáo phương thức thanh toán dùng trạng thái nợ để phân loại tiền mặt/chuyển khoản.**

    Vị trí: [app.js:4418](/Users/nhattran/Desktop/MiniKiot/app.js:4418).

    `redPaid` được đặt theo việc còn nợ nhưng báo cáo dùng nó để chọn tiền mặt hoặc ngân hàng. Tái hiện: đơn tiền mặt trả đủ 100 lại được cộng 100 vào Chuyển khoản/VietQR.

    Đề xuất: lấy phương thức từ bản ghi thanh toán thực tế; hỗ trợ nhiều lần/phương thức thanh toán nếu cần. Chuẩn hóa enum tiền mặt/chuyển khoản/thẻ, đồng thời bổ sung lưu trường phương thức vào DB.

17. **[P1] Payload sai được lưu thành công rồi làm API đọc dữ liệu lỗi.**

    Vị trí: [server.js:77](/Users/nhattran/Desktop/MiniKiot/server.js:77), [db.js:466](/Users/nhattran/Desktop/MiniKiot/db.js:466), [db.js:298](/Users/nhattran/Desktop/MiniKiot/db.js:298).

    Server không kiểm tra schema. Trường `items` là chuỗi bất kỳ sẽ được lưu nguyên văn, sau đó `JSON.parse` không được bảo vệ khi đọc hóa đơn.

    Tái hiện trên DB tạm: sync `items: 'not-json'` trả 200; GET `/api/data` kế tiếp trả 500. Kiểu dữ liệu, số âm, giá trị không hữu hạn, mã tham chiếu và tính nhất quán tổng tiền cũng chưa có kiểm tra nghiệp vụ ở server.

    Đề xuất: validate schema và các bất biến trước transaction, trả 400/422 cho dữ liệu không hợp lệ; bổ sung ràng buộc DB phù hợp. Migration/import phải phát hiện dữ liệu lỗi trước khi thay thế dữ liệu đang dùng.

18. **[P1] Hủy hóa đơn có thể giảm công nợ nhầm khách trùng tên.**

    Vị trí: [app.js:1182](/Users/nhattran/Desktop/MiniKiot/app.js:1182), [app.js:2666](/Users/nhattran/Desktop/MiniKiot/app.js:2666).

    Hóa đơn chỉ lưu tên/số điện thoại; hủy tìm khách bằng điều kiện tên khớp HOẶC số điện thoại khớp. Khi khách trùng tên, bản ghi đầu tiên có thể được chọn dù điện thoại khác.

    Tái hiện: A và B cùng tên, khác điện thoại; hủy đơn nợ 100 của B làm nợ A giảm 100, còn nợ B giữ nguyên.

    Đề xuất: lưu `customerId` bất biến và dùng khóa đó cho mọi bút toán; tương tự với nhà cung cấp và chi nhánh. Lưu tên/địa chỉ trên chứng từ chỉ để giữ thông tin hiển thị lịch sử. Công nợ nên có sổ phát sinh và phân bổ thanh toán theo chứng từ, thay vì chỉ cộng/trừ một biến tổng.

19. **[P2] CSS in không hỗ trợ các chứng từ ngoài hóa đơn bán và tem.**

    Vị trí: [index.html:379](/Users/nhattran/Desktop/MiniKiot/index.html:379), [app.js:2907](/Users/nhattran/Desktop/MiniKiot/app.js:2907), [app.js:4303](/Users/nhattran/Desktop/MiniKiot/app.js:4303).

    CSS ẩn toàn bộ nội dung khi in, chỉ mở lại `#printable-receipt` và `#printable-barcode-sheet`. Phiếu trả có ID riêng không được mở lại; các hàm in phiếu nhập, kiểm kho, chuyển kho và báo cáo chỉ gọi `window.print()`. Nội dung mục tiêu vì vậy vẫn bị CSS ẩn; sheet tem đã tạo trước đó có thể còn xuất hiện do luôn có `display: flex !important` lúc in.

    Kết luận này dựa trên CSS/handler, chưa xác nhận trên máy in thật.

    Đề xuất: một vùng in rõ ràng được chọn theo loại chứng từ, reset vùng in cũ và kiểm tra print preview/PDF cho từng loại.

**Đánh giá kiến trúc và các cải thiện tiếp theo**

Điểm tốt: số lượng phân hệ đã bao phủ khá rộng; hàm được đặt tên theo luồng nghiệp vụ; SQL ghi dữ liệu dùng bind parameters; `saveAllData` có transaction và rollback; stack nhỏ, ít phụ thuộc nên dễ dựng môi trường. Kiểm tra rollback thực tế hoạt động. Những điểm này có thể giữ lại khi sửa kiến trúc.

Các điểm cần cải thiện sau nhóm ưu tiên:

- `app.js` có 6.064 dòng, trộn DOM, phân quyền, tính tiền và cập nhật dữ liệu. Tách theo module POS, inventory, returns, payments, reports, auth; phần tính toán nên độc lập DOM để kiểm thử trực tiếp. Không bắt buộc chuyển framework mới.
- Hai HTML chính giống hệt nhau tạo rủi ro sửa lệch; giữ một entrypoint. Đưa bản backup khỏi vùng phục vụ web.
- GET lấy mọi bản ghi và POST ghi lại toàn bộ database; render nhiều màn hình cùng lúc. Chi phí sẽ tăng theo lịch sử giao dịch. Sau khi chuyển API nghiệp vụ, bổ sung truy vấn theo chi nhánh/thời gian, phân trang và index theo truy vấn thực tế. Chưa benchmark tải nên chưa kết luận ngưỡng số lượng hóa đơn.
- SQLite có thể tiếp tục được giữ trong giai đoạn sửa. Đổi database không tự giải quyết lỗi snapshot, phân quyền hay kế toán giao dịch đang nằm trong ứng dụng.
- Tách product master, stock theo branch, dòng hóa đơn, dòng nhập, stock movements, serials, payments và debt entries. Dùng ID thay tên làm tham chiếu; bổ sung khóa ngoại và ràng buộc sau khi chuẩn hóa dữ liệu.
- Kiểm kho nháp đang gán thẳng `actualStock` khi chốt; cần xử lý phát sinh bán/nhập trong khoảng từ lúc kiểm đến lúc chốt. Chuyển kho tới sản phẩm đã tồn tại chỉ cộng số lượng, chưa cập nhật vốn bình quân theo giá trị hàng nhận. Cần xác định quy tắc và bổ sung test nghiệp vụ.
- Thu/trả nợ hiện chỉ giảm biến tổng, không phân bổ về hóa đơn/phiếu nhập; số `paid` của chứng từ không được cập nhật theo khoản thu nợ sau đó. Sổ phát sinh và phân bổ thanh toán sẽ giúp đối soát, hủy và hoàn tiền đúng.
- Xóa khách/NCC còn nợ hoặc sản phẩm có lịch sử hiện là xóa trực tiếp. Nên ngừng hoạt động/soft-delete và giữ khóa tham chiếu của chứng từ.
- Tên/mã sản phẩm đề xuất từ số lượng mảng có thể tái sử dụng mã sau khi xóa. Form tạo mới đang dùng mã có sẵn để quyết định cập nhật, có thể vô tình sửa sản phẩm khác. Tách rõ create/edit và bảo vệ mã duy nhất.
- Dashboard chỉ vẽ ngày 1–20, bỏ ngày 21 đến cuối tháng. Cần vẽ theo kỳ người dùng chọn. Tách các công thức báo cáo dùng chung để tránh màn hình tổng quan và báo cáo lệch nhau.
- Tài nguyên Tailwind/font đang lấy từ CDN; chưa có service worker hoặc cơ chế cache asset chủ động. Khả năng offline hiện không bao gồm đảm bảo mở mới ứng dụng khi mất mạng. Đóng gói asset phục vụ tại chỗ nếu offline là yêu cầu vận hành.
- Thêm test runner và CI cho nghiệp vụ trọng yếu; khai báo phiên bản Node hỗ trợ trong `package.json`. Hiện package chỉ có script `start`, chưa có test/lint hoặc cấu hình CI trong workspace.
- README mô tả đồng thời ứng dụng 100% client-side và SQLite backend; các tuyên bố tự phục hồi offline, đa thiết bị và tính hoàn chỉnh chưa khớp hành vi đã kiểm tra. Cập nhật theo khả năng thực tế.
- Xây dựng backup nhất quán và quy trình restore thử; không chỉ dựa vào xuất snapshot của một trình duyệt có thể đã cũ. Đưa database/backup ra khỏi web root, có lưu giữ nhiều phiên bản và ghi nhận lần backup gần nhất.

**Thứ tự triển khai đề xuất**

1. **Bảo vệ dữ liệu trước:** xử lý xác thực/phân quyền, static file exposure, seed tự động, chặn snapshot cũ và validation. Tạo bản sao dữ liệu nhất quán trước khi migration.
2. **Đưa nghiệp vụ ghi về server:** API bán, nhập, trả, hủy, chuyển, kiểm kho và thanh toán; transaction trọn vẹn; ID duy nhất và chống xử lý lặp. Giữ frontend làm phần nhập liệu/hiển thị.
3. **Sửa tính đúng nghiệp vụ:** hoàn trả theo số lượng còn lại, chiết khấu/công nợ, IMEI, serial kho, snapshot giá vốn, đầy đủ trường lưu và báo cáo đối soát được.
4. **Hoàn thiện vận hành:** hàng đợi offline nếu cần, trạng thái lưu rõ ràng, test hồi quy, backup/restore, in ấn, phân trang và tách module.

Không nên triển khai nhiều máy thu ngân với dữ liệu thật trước khi nhóm 1–3 được sửa và kiểm chứng. Việc ưu tiên viết lại UI trước sẽ không xử lý các nguồn gây sai/mất dữ liệu đã nêu.

**Các điều kiện nghiệm thu quan trọng**

- Người chưa đăng nhập hoặc sai quyền không thể đọc/ghi/reset; database/source backend không tải được qua static URL.
- Hai client bán/sửa dữ liệu nối tiếp hoặc đồng thời không mất hóa đơn; cạnh tranh tồn kho có kết quả xác định.
- Mất mạng, retry, reload và gửi lại cùng request không làm mất hoặc nhân đôi giao dịch.
- Bán/trả/hủy/thu nợ bảo toàn tiền, số lượng, công nợ và serial; trả nhiều lần không vượt lượng đã bán.
- Lưu rồi đọc lại giữ nguyên các trường nghiệp vụ; khởi động với danh mục rỗng không tự seed đè dữ liệu.
- Doanh thu báo cáo sản phẩm khớp tổng đơn sau phân bổ giảm giá/trả hàng; lợi nhuận quá khứ không đổi khi cập nhật vốn hiện tại.
- Tất cả mã chứng từ không trùng; lỗi DB được hiển thị đúng, không thông báo đã lưu khi transaction chưa thành công.
- Print preview và backup/restore được kiểm thử riêng với bộ dữ liệu mẫu có đối soát.
