# Prototype T3 — Trợ lý đổi chuyến khi chuyến bay bị huỷ

**Trạng thái:** đã triển khai và review frontend theo [`spec.md` §3–§6](../spec.md). Cú pháp JS hợp lệ; 37/37 kiểm tra logic/renderer DOM giả đạt. Đã mở và quan sát thông báo trên Chrome desktop, chưa bấm hết flow sau sửa cuối và chưa kiểm tra mobile. Checklist nộp: [REVIEW.md](../REVIEW.md).

Thư mục này dành cho prototype và bằng chứng sẽ nộp:

- `index.html`, `style.css`, `fixtures.js`, `app.js`: đã tạo, dùng HTML/CSS/JavaScript thuần, AI/tool mô phỏng. Không dependencies/CDN/backend.
- `assets/saigon-skyline.jpg`: ảnh điểm đến lưu local để chạy offline.
- `checks.cjs`: bộ kiểm tra logic/renderer bằng Node.js, không cần để mở frontend.
- 1–2 ảnh có đánh số vị trí UI: tạo sau khi có prototype được kiểm tra, dùng để giải thích HAX/PAIR và mức tự chủ trong `spec.md` §5.
- Log/ảnh AI thật chỉ bổ sung nếu nhóm duyệt làm bonus; bản bắt buộc dự kiến không gọi AI thật.

Hai màn hình được thiết kế: A — Đặt chỗ & chọn phương án; B — Kiểm tra hành động & kết quả. Ca demo chính S03 là câu “Ừ, đổi đi” sau nhiều lựa chọn chưa rõ chuyến/người; ca phụ S05 là yêu cầu hoàn khi thiếu chính sách. Có điều khiển demo thu gọn để chọn ca, reset và thử hết hạn/lỗi, không bỏ qua xác nhận nghiệp vụ.

Toàn bộ dữ liệu, tool và hàng chờ nhân viên đều là mô phỏng; không gọi AI thật hoặc gửi giao dịch. Gửi hoàn vẫn bị chặn vì fixture chưa cấp nơi nhận tiền và thời gian xử lý.

## Mở demo

1. Trong File Explorer, nhấp phải `index.html` → **Open with → Google Chrome** hoặc **Microsoft Edge**. Cũng có thể kéo file vào trình duyệt.
2. Dùng F11 để trình chiếu toàn màn hình; Ctrl và dấu + để tăng chữ; Ctrl+0 về zoom mặc định.
3. Giữ nguyên cả folder `prototype` khi copy sang máy khác, không chỉ lấy file HTML. Ảnh, CSS và script đều có local, không cần mạng hoặc cài thư viện.

Nếu đã có Python và thích dùng server local, chạy trong folder `prototype`:

```powershell
python -m http.server 5500 --bind 127.0.0.1
```

Mở `http://127.0.0.1:5500`; Ctrl+C trong terminal để dừng. Đây là cách tùy chọn phục vụ file tĩnh, không phải backend nghiệp vụ; server Python chưa chạy trong phiên review. Cách mở file trực tiếp đã quan sát trên Chrome.

## Kịch bản bấm demo

**Flow mở đầu mới:** thông báo “Chuyến bay của bạn đã bị huỷ” → “Xem phương án thay thế” → trợ lý làm rõ chuyến/người → giữ chỗ → xem lại và xác nhận. Có nút “Tìm hiểu hoàn vé” ngay trong thông báo. Chưa bấm tiếp thì chưa gọi tool, chưa đổi vé hoặc gửi hoàn. Thông báo là trạng thái đầu màn A, không thêm màn thứ ba. Reset S03/S05/N01 quay lại thông báo; S08 vẫn là ca đặc biệt bắt đầu sau sự cố đổi nhầm đã dựng sẵn. Thời điểm thông báo 15:00 là mốc giả lập của fixture, không phải thời gian gửi thật.

- **S03:** chọn BM 201/BM 205 và cả hai hành khách → “Xem lại & giữ chỗ” → kiểm tra tóm tắt và đếm ngược → “Xác nhận đổi vé”. “Ừ, đổi đi” ban đầu chưa đổi vé. Có thể sửa hoặc bỏ giữ trước đổi. Sau đổi có đường báo thông tin chưa đúng và chuyển người, không có hoàn tác vé giả.
- **S05:** mở Điều khiển demo, chọn S05 và “Bắt đầu lại” → chọn hành khách cần hoàn → xem thông tin thiếu → nút gửi vẫn khoá → chuyển nhân viên xác minh hoặc quay lại tìm chuyến. Vào hàng chờ không đồng nghĩa đã gửi hoàn.
- **N01:** chuyến/người đã rõ, vẫn duyệt tóm tắt trước đổi. **S08:** biến thể đã đổi nhầm BM 201, lượt miễn phí đã dùng; chuyển người.
- **S10:** sau giữ chỗ, bấm “Cho giữ chỗ hết hạn”; xác nhận cũ không được dùng, cần tra lại và duyệt mới.
- Chọn lỗi mô phỏng trước khi bắt đầu lại để thử tra/giữ/đổi/chuyển thất bại. Lỗi đổi chưa rõ kết quả không tự thử đổi lại. Lỗi chuyển cho thử chuyển lại hoặc sao chép tóm tắt.
- BM 217 chỉ còn 1 chỗ, không giữ cho cả hai; trẻ 5 tuổi bay riêng không vào luồng đổi thường. Dùng “Gặp nhân viên” để tiếp tục ca đặc biệt.
- Ô chat hiểu theo quy tắc đơn giản, không phải model thật; không nhập dữ liệu cá nhân thật. Câu lạ đi hỏi lại; khớp từ khoá không cấp quyền đổi/gửi hoàn.
- Bật “Hiện số HAX/PAIR”, mở “Căn cứ, nguyên tắc & nhật ký mô phỏng” để giải thích G10/G11/PAIR và tool. Log không phải lời gọi AI thật.
- Reset chỉ phục vụ buổi demo bằng dữ liệu dựng, không phải chức năng khách hoàn tác giao dịch. Đóng điều khiển demo khi trình chiếu luồng khách.

## Kiểm tra và giới hạn

Chạy trong folder `prototype` nếu đã có Node.js:

```powershell
node --check app.js
node --check fixtures.js
node checks.cjs
```

Kết quả sau review: **37/37 kiểm tra logic/renderer DOM giả đạt**, gồm thông báo chưa gọi tool, chỉ mở trợ lý sau thao tác khách, chặn đổi mơ hồ, thiếu chỗ, trẻ bay riêng, tồn kho không trừ hai lần, duyệt một lần, hết hạn sát lúc xử lý, sửa lựa chọn, chặn gửi hoàn thiếu chính sách, lỗi chuyển/thử lại/mở lại ca cũ, kết quả đổi chưa rõ, trạng thái từng hành khách và hard tests qua chat. Kết quả lưu tại [verification.txt](verification.txt).

**Phạm vi browser QA:** đã mở và quan sát thông báo huỷ trên Chrome desktop. Chưa bấm hết các ca sau sửa cuối, chưa kiểm tra mobile/bàn phím/clipboard vì người dùng dừng Computer Use. DOM giả không xác minh CSS hoặc thao tác native. Chưa tuyên bố M3/R5 đạt; vẫn cần 1–2 ảnh thật có đánh số theo checklist trong REVIEW.md.

Hạn chế: không tồn kho trực tiếp, không SLA nhân viên, không hiểu mọi câu tiếng Việt, không gửi hoàn thành công khi thiếu chính sách, không bảo đảm hoàn tác vé đã đổi và không tự tính mốc hết quyền 48 giờ khi fixture chưa chỉ rõ mốc bắt đầu.

## Nguồn ảnh

Ảnh TP.HCM: [Tron Le trên Unsplash](https://unsplash.com/photos/wUk2U5Wirxg), tải từ `images.unsplash.com/photo-1583417319070-4a69db38a482`. Đây là cảnh quan công khai minh hoạ điểm đến. Dữ liệu đặt chỗ và hành khách vẫn hoàn toàn là dữ liệu dựng của đề.
