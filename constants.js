'use strict';
// Giá trị dùng chung cho server (require) và trình duyệt (<script>).
// Chi nhánh gán cho bản ghi cũ không có trường branch. Không đổi nếu database đã có dữ liệu,
// vì dữ liệu lịch sử phụ thuộc giá trị này.
const FALLBACK_BRANCH = 'Kalo HCM';
// Mã khách lẻ hệ thống: không ghi nợ, không xóa, không dùng để suy ra khách theo số điện thoại.
const RETAIL_CUSTOMER_CODE = 'KH0011';
if (typeof module !== 'undefined') module.exports = { FALLBACK_BRANCH, RETAIL_CUSTOMER_CODE };
