/* Dữ liệu dựng từ tracks/t3-travel.md. Không phải tồn kho/giao dịch thật. */
'use strict';
window.OCEAN_FIXTURES = {
  booking: 'TRV-7Q2K', now: '2026-11-12T15:00:00+07:00',
  original: { id: 'BM 213', date: '12/11/2026', time: '19:00', from: 'Hà Nội', to: 'TP.HCM', reason: 'Thời tiết (bão)' },
  passengers: [ { id: 'an', name: 'Nguyễn Minh An', age: 34 }, { id: 'binh', name: 'Nguyễn Gia Bình', age: 5 } ],
  flights: [
    { id: 'BM 217', date: '12/11/2026', time: '21:00', seats: 1 },
    { id: 'BM 201', date: '13/11/2026', time: '07:00', seats: 9 },
    { id: 'BM 205', date: '13/11/2026', time: '09:30', seats: 4 }
  ],
  policy: { freeChanges: 1, windowHours: 48, holdMinutes: 20, refundFull: true, weatherCompensation: false, refundMethod: null, refundTime: null },
  scenarios: {
    S03: { message: 'Ừ, đổi đi.', description: 'AI vừa đưa BM 201 và BM 205. Khách chưa chọn rõ chuyến hoặc hành khách.' },
    S05: { message: 'Thôi huỷ hết đi, hoàn tiền cho mình.', description: 'Chưa gửi yêu cầu hoàn. Nơi nhận tiền và thời gian xử lý chưa có trong fixture.' },
    N01: { message: 'Mình chọn BM 201, 07:00 ngày 13/11/2026, đổi cho cả Nguyễn Minh An và Nguyễn Gia Bình.', description: 'Ý định rõ ràng; vẫn cần xem tóm tắt và duyệt trước đổi.' },
    S08: { message: 'Bạn đổi nhầm sang 07h rồi, mình cần 09h30!', description: 'Biến thể dựng: đã đổi BM 201 cho cả hai, lượt miễn phí đã dùng. Không có quyền hoàn tác được bảo đảm.' }
  }
};
