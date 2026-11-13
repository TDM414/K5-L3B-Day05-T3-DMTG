'use strict';
/* Quy tắc mô phỏng. Không có API, backend hay giao dịch thật. */
(function () {
  const F = window.OCEAN_FIXTURES;
  const clone = value => JSON.parse(JSON.stringify(value));
  class DemoEngine {
    constructor(scenario = 'S03', fault = 'none', startWithNotification = false) { this.reset(scenario, fault, startWithNotification); }
    reset(scenario = 'S03', fault = 'none', startWithNotification = false) {
      this.scenario = F.scenarios[scenario] ? scenario : 'S03'; this.fault = fault;
      this.started = Date.now(); this.offset = 0; this.logs = []; this.serial = 0;
      this.flights = clone(F.flights); this.passengers = clone(F.passengers);
      this.selectedFlight = this.scenario === 'N01' ? 'BM 201' : '';
      this.selectedPassengers = this.scenario === 'N01' ? ['an', 'binh'] : [];
      this.version = 0; this.hold = null; this.review = null; this.freeChanges = 1;
      this.currentFlight = null; this.changedPassengers = []; this.pendingChange = null; this.refundSent = false; this.queue = null;
      this.state = 'clarifying'; this.screen = 'A'; this.error = ''; this.notice = '';
      this.reason = ''; this.unknown = false; this.lastError = ''; this.busy = false;
      this.userMessage = F.scenarios[this.scenario].message;
      if (this.scenario === 'S08') {
        this.currentFlight = 'BM 201'; this.changedPassengers = ['an', 'binh']; this.freeChanges = 0; this.selectedFlight = 'BM 201';
        this.selectedPassengers = ['an', 'binh']; this.flights.find(f => f.id === 'BM 201').seats -= 2;
        this.state = 'correction'; this.screen = 'B';
      }
      if (startWithNotification && this.scenario !== 'S08') this.state = 'cancellation_notice';
      else if (this.lookup() && this.scenario === 'S05') this.openRefund();
    }
    openNotification(intent = 'scenario') {
      if (this.state !== 'cancellation_notice') return false;
      this.state = 'clarifying';
      if (!this.lookup()) return false;
      if (intent === 'refund' || (intent === 'scenario' && this.scenario === 'S05')) this.openRefund();
      return true;
    }
    now() { return Date.now() - this.started + this.offset; }
    stamp() { return new Date(new Date(F.now).getTime() + this.now()).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }); }
    log(tool, result, detail = '') { this.logs.push({ time: this.stamp(), tool, result, detail }); }
    consumeFault(name) { if (this.fault === name) { this.fault = 'none'; return true; } return false; }
    names(ids = this.selectedPassengers) { return this.passengers.filter(p => ids.includes(p.id)).map(p => p.name); }
    selected() { return this.flights.find(f => f.id === this.selectedFlight); }
    isLocked() { return this.busy || this.unknown || this.refundSent || !!this.currentFlight; }
    lookup() {
      if (this.consumeFault('lookup')) {
        this.log('tra_cuu_dat_cho', 'thất bại'); this.lastError = 'lookup'; this.state = 'recoverable_error';
        this.error = `Chưa tra được dữ liệu đặt chỗ. ${this.currentFlight ? `Biến thể hiện ghi nhận vé đã đổi sang ${this.currentFlight}; chưa xác minh thêm được.` : this.unknown ? 'Kết quả đổi trước đó vẫn chưa rõ; không tự đổi lại.' : 'Mình chưa đổi vé hoặc gửi hoàn.'} Bạn có thể tra lại hoặc gặp nhân viên.`; return false;
      }
      this.log('tra_cuu_dat_cho', 'thành công', this.unknown ? 'Trạng thái giao dịch vẫn chưa xác định' : 'TRV-7Q2K · dữ liệu dựng');
      return true;
    }
    setSelection(flight, ids) {
      if (this.isLocked() || this.state !== 'clarifying') return false;
      const unique = [...new Set(ids)].filter(id => this.passengers.some(p => p.id === id));
      if (flight && !this.flights.some(f => f.id === flight)) return false;
      this.selectedFlight = flight; this.selectedPassengers = unique; this.version++;
      this.review = null; this.error = ''; return true;
    }
    selectionError() {
      const flight = this.selected();
      if (!flight || !this.selectedPassengers.length) return 'Bạn hãy chọn rõ một chuyến và hành khách cần đổi. Mình chưa giữ chỗ hoặc đổi vé.';
      if (this.selectedPassengers.includes('binh') && !this.selectedPassengers.includes('an')) return 'Bé Nguyễn Gia Bình mới 5 tuổi. Trường hợp trẻ bay riêng cần nhân viên hỗ trợ; mình chưa giữ chỗ hoặc đổi vé.';
      if (flight.seats < this.selectedPassengers.length) return `${flight.id} chỉ còn ${flight.seats} chỗ, không đủ ${this.selectedPassengers.length} hành khách. Bạn hãy chọn chuyến đủ chỗ hoặc gặp nhân viên.`;
      return '';
    }
    prepareChange() {
      if (this.isLocked() || this.state !== 'clarifying') return false;
      this.error = this.selectionError(); if (this.error) return false;
      if (!this.lookup()) return false;
      if (this.consumeFault('hold')) {
        this.log('giu_cho_chuyen_moi', 'thất bại', this.selectedFlight); this.lastError = 'hold';
        this.state = 'recoverable_error'; this.error = 'Chưa giữ được chỗ. Vé chưa đổi và lượt miễn phí vẫn còn. Bạn có thể chọn lại hoặc gặp nhân viên.'; return false;
      }
      const flight = this.selected(); const ids = [...this.selectedPassengers];
      this.hold = { id: `H-${++this.serial}`, flight: flight.id, ids, expiresAt: this.now() + F.policy.holdMinutes * 60000, active: true };
      flight.seats -= ids.length;
      this.review = { flight: flight.id, ids, version: this.version, holdId: this.hold.id };
      this.log('giu_cho_chuyen_moi', 'thành công', `${this.hold.id} · ${flight.id} · ${this.names(ids).join(', ')} · 20 phút`);
      this.state = 'change_review'; this.screen = 'B'; this.error = ''; this.notice = ''; return true;
    }
    releaseHold(reason = 'khách bỏ giữ') {
      if (this.busy && this.state === 'changing') return false;
      if (!this.hold || !this.hold.active) return false;
      const hold = this.hold; hold.active = false;
      this.flights.find(f => f.id === hold.flight).seats += hold.ids.length;
      this.log('nha_cho_dang_giu', 'thành công — mở rộng mô phỏng', `${hold.id} · ${reason}`);
      this.review = null; return true;
    }
    tick() {
      // Tool đã nhận yêu cầu khi lượt giữ còn hạn: không xoá bản duyệt giữa lúc chờ kết quả.
      if (this.busy && this.state === 'changing') return false;
      if (!this.hold || !this.hold.active || this.now() < this.hold.expiresAt) return false;
      this.releaseHold('hết hạn 20 phút');
      if (this.state === 'change_review') this.state = 'hold_expired';
      this.notice = 'Giữ chỗ đã hết hạn, chưa đổi vé. Cần tra lại và xác nhận mới trước khi đổi.'; return true;
    }
    expire() {
      if (!this.hold || !this.hold.active || this.busy) return false;
      this.offset += Math.max(0, this.hold.expiresAt - this.now()) + 1; this.tick(); return true;
    }
    edit(reason = 'khách sửa lựa chọn') {
      if (this.isLocked()) return false;
      this.releaseHold(reason); this.review = null; this.version++; this.screen = 'A';
      this.state = 'clarifying'; this.error = ''; this.notice = 'Chưa đổi vé. Bạn có thể chọn lại; giữ chỗ cũ (nếu có) đã được nhả.'; return true;
    }
    canConfirm() {
      this.tick(); const r = this.review; const h = this.hold;
      return !this.isLocked() && this.state === 'change_review' && !!r && !!h && h.active && h.expiresAt > this.now()
        && r.version === this.version && r.holdId === h.id && r.flight === this.selectedFlight
        && r.ids.join(',') === this.selectedPassengers.join(',') && this.freeChanges === 1;
    }
    beginChange() {
      if (!this.canConfirm()) return false;
      this.log('doi_chuyen_bay', 'đang xử lý', `${this.review.flight} · ${this.names().join(', ')} · khách duyệt bản ${this.version}`);
      this.pendingChange = clone(this.review);
      this.busy = true; this.state = 'changing'; return true;
    }
    finishChange() {
      if (!this.busy || this.state !== 'changing' || !this.pendingChange) return false;
      const request = this.pendingChange; this.pendingChange = null;
      this.busy = false;
      if (this.consumeFault('unknown')) {
        // Tool đã được gọi; không suy ra vé còn nguyên chỉ vì không có phản hồi.
        this.unknown = true; if (this.hold) this.hold.active = false;
        this.state = 'status_unknown'; this.review = null;
        this.log('doi_chuyen_bay', 'chưa rõ kết quả', 'Không tự gọi đổi lần nữa'); return false;
      }
      if (this.consumeFault('change')) {
        this.log('doi_chuyen_bay', 'thất bại — xác nhận chưa đổi'); this.state = 'recoverable_error';
        this.lastError = 'change'; this.error = 'Đổi vé chưa thành công. Kết quả mô phỏng xác nhận chưa đổi, lượt miễn phí chưa dùng. Hãy xem lại điều kiện trước khi thử lại.'; return false;
      }
      this.currentFlight = request.flight; this.changedPassengers = [...request.ids]; this.freeChanges = 0;
      this.hold.active = false; this.review = null; this.state = 'changed'; this.notice = '';
      this.log('doi_chuyen_bay', 'thành công', `${this.currentFlight} · đã dùng lượt miễn phí`); return true;
    }
    openRefund() {
      if (this.isLocked()) return false;
      this.releaseHold('khách chuyển sang luồng hoàn'); this.review = null; this.version++;
      this.selectedPassengers = []; this.screen = 'B'; this.state = 'refund_review'; this.error = ''; this.notice = ''; return true;
    }
    setRefundPassengers(ids) {
      if (this.state !== 'refund_review' || this.isLocked()) return false;
      this.selectedPassengers = [...new Set(ids)].filter(id => this.passengers.some(p => p.id === id)); return true;
    }
    sendRefund() {
      // Chốt bảo vệ tại hàm thực thi, không chỉ disabled ở UI. Fixture này không có nhánh gửi.
      this.error = 'Chưa gửi hoàn: thiếu thông tin nơi nhận tiền và thời gian xử lý. Khách đồng ý không thay thế bước xác minh.';
      return false;
    }
    beginTransfer(reason) {
      if (this.busy) return false;
      if (this.queue) { this.state = 'staff_queued'; this.screen = 'B'; return false; }
      this.reason = reason || this.reason || 'Khách yêu cầu gặp nhân viên';
      this.busy = true; this.previousState = this.state; this.screen = 'B'; this.state = 'transferring';
      this.log('chuyen_nhan_vien', 'đang chuyển', this.reason); return true;
    }
    finishTransfer() {
      if (this.state !== 'transferring' || !this.busy) return false;
      this.busy = false;
      if (this.consumeFault('transfer')) {
        this.state = 'transfer_error'; this.log('chuyen_nhan_vien', 'thất bại'); return false;
      }
      this.queue = { id: 'HT-MO-PHONG-01', summary: this.summary(), reason: this.reason, createdAt: this.stamp() };
      this.state = 'staff_queued'; this.log('chuyen_nhan_vien', 'vào hàng chờ mô phỏng', this.queue.id); return true;
    }
    summary() {
      const h = this.hold;
      return `Đặt chỗ: ${F.booking}\nChuyến gốc: BM 213 · 12/11/2026 19:00 · huỷ do thời tiết\nHành khách đặt chỗ: ${this.names(['an','binh']).join(', ')}\nPhạm vi khách chọn: ${this.names().join(', ') || 'chưa xác nhận'}\nTin khách: ${this.userMessage}\nLý do hỗ trợ: ${this.reason}\nTrạng thái vé: ${this.unknown ? 'chưa rõ kết quả đổi; không tự đổi lại' : this.currentFlight ? `đã đổi sang ${this.currentFlight} cho ${this.names(this.changedPassengers).join(', ')}; người không được chọn chưa đổi` : 'chưa đổi'}\nHoàn vé: chưa gửi\nGiữ chỗ: ${h && h.active ? `${h.id} · ${h.flight} · còn ${Math.max(0,Math.ceil((h.expiresAt-this.now())/1000))} giây tại lúc lập tóm tắt` : 'không có giữ còn hiệu lực'}\nChính sách còn thiếu: nơi nhận tiền, thời gian xử lý\nSLA nhân viên: chưa có dữ liệu\nToàn bộ là dữ liệu dựng.`;
    }
  }
  window.OceanDemo = { DemoEngine };
  if (typeof document === 'undefined') return;

  const $ = selector => document.querySelector(selector);
  const icons = {
    plane:'<path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/>',
    sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/><path d="M20 2v4m-2-2h4"/>',
    shield:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
    pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    sliders:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/>',
    chevron:'<path d="m6 9 6 6 6-6"/>', refresh:'<path d="M20 7a9 9 0 1 0 1 8M20 2v6h-6"/>',
    'arrow-up':'<path d="M12 19V5m-6 6 6-6 6 6"/>', arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
    user:'<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    check:'<path d="m5 12 4 4L19 6"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    warning:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v1"/>',
    support:'<path d="M3 13v-1a9 9 0 0 1 18 0v6a3 3 0 0 1-3 3h-3"/><rect x="2" y="11" width="4" height="7" rx="2"/><rect x="18" y="11" width="4" height="7" rx="2"/>',
    back:'<path d="M20 12H4m6-6-6 6 6 6"/>', copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>'
  };
  function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.info}</svg>`; }
  function hydrateIcons() { document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
  const esc = text => String(text ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const ann = n => `<span class="annotation" aria-label="Chú thích ${n}">${n}</span>`;
  const btn = (action, label, type = 'secondary', ico = '', disabled = false) => `<button type="button" class="btn ${type}" data-action="${action}" ${disabled ? 'disabled' : ''}>${ico ? icon(ico) : ''}${label}</button>`;
  let engine = new DemoEngine('S03', 'none', true); let generation = 0; let toastTimer;
  window.OceanDemo.getEngine = () => engine;
  function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3500); }
  function evidence() { return `<div class="evidence-box">${ann(2)}${icon('info')}<strong>Căn cứ: TRV-7Q2K · Bay Mẫu</strong><br>Chuyến huỷ do thời tiết: đổi miễn phí một lần trong 48 giờ hoặc hoàn toàn bộ; không bồi thường tiền mặt. Số chỗ từ fixture ban đầu: BM 217 — 1, BM 201 — 9, BM 205 — 4. Chưa gồm thao tác mô phỏng hiện tại.</div>`; }
  function userBubble() { return `<div class="user-message"><p>${esc(engine.userMessage)}</p><span class="mini-avatar">MA</span></div>`; }
  function message(text, status = '') { return `${status ? `<div class="status-label">${icon('info')}${status}</div>` : ''}<div class="assistant-message"><div class="message-heading">${icon('sparkles')} OCEAN AI · MÔ PHỎNG</div><p>${text}</p></div>`; }
  function passengerChoices(refund = false) {
    return `<div class="selection-title">${refund ? 'HOÀN CHO HÀNH KHÁCH NÀO?' : 'HÀNH KHÁCH CẦN ĐỔI'}</div><div class="passenger-choices">${engine.passengers.map(p => `<label class="passenger-choice"><input type="checkbox" name="${refund ? 'refund-person' : 'person'}" value="${p.id}" ${engine.selectedPassengers.includes(p.id) ? 'checked' : ''}>${esc(p.name)} ${p.age < 18 ? '(5 tuổi)' : ''}</label>`).join('')}</div>`;
  }
  function flightOptions() {
    return `<div class="selection-title">CHỌN CHUYẾN THAY THẾ</div><div class="flight-options">${engine.flights.map(f => `<label class="flight-option ${engine.selectedFlight === f.id ? 'selected' : ''}"><input type="radio" name="flight" value="${f.id}" ${engine.selectedFlight === f.id ? 'checked' : ''}><span class="flight-time">${f.time}</span><span class="flight-details"><strong>${f.id} <span class="muted">· Bay Mẫu</span></strong><span>${f.date} · HAN → SGN</span></span><span class="flight-seats">Còn ${f.seats} chỗ${f.id === 'BM 201' ? '<small>Sớm nhất đủ chỗ cho cả hai</small>' : f.seats < 2 ? '<small>Không đủ cho cả hai</small>' : ''}</span></label>`).join('')}</div>`;
  }
  function renderBooking() {
    const changed = engine.currentFlight ? engine.flights.find(f => f.id === engine.currentFlight) : null;
    const active = changed || F.original;
    const partial = changed && engine.changedPassengers.length !== engine.passengers.length;
    $('#booking').innerHTML = `<div class="route"><div><div class="airport-code">HAN</div><div class="airport-name">Hà Nội</div></div><div class="route-middle">${icon('plane')}</div><div class="right"><div class="airport-code">SGN</div><div class="airport-name">TP. Hồ Chí Minh</div></div></div><div class="flight-meta"><span>${active.id} · ${active.date.slice(0,5)} · ${active.time}</span><span class="pill ${changed ? 'green' : engine.unknown ? 'amber' : 'red'}">${changed ? partial ? 'Đổi một phần' : 'Đã đổi' : engine.unknown ? 'Cần xác minh' : 'Đã huỷ · Bão'}</span></div>${changed ? '<p class="muted" style="font-size:11px;margin-bottom:10px">Chuyến gốc BM 213 đã huỷ do thời tiết. Trạng thái từng hành khách ở dưới.</p>' : ''}<div class="passenger-list">${engine.passengers.map(p => `<div class="passenger-item"><span class="person-icon">${icon('user')}</span><span>${esc(p.name)}<small class="passenger-status">${engine.unknown ? 'Kết quả đổi cần xác minh' : changed ? engine.changedPassengers.includes(p.id) ? `${changed.id} · ${changed.time} · ${changed.date}` : 'Chưa đổi · BM 213 đã huỷ' : p.age < 18 ? 'Trẻ em · 5 tuổi' : 'Người lớn · 34 tuổi'}</small></span></div>`).join('')}</div><div class="booking-status">${icon(engine.unknown ? 'info' : 'shield')}<span>${engine.unknown ? 'Chưa rõ kết quả đổi. Không thao tác lại.' : engine.freeChanges ? 'Còn 1 lần đổi miễn phí theo chính sách dựng' : 'Lần đổi miễn phí đã được dùng'}</span></div>${partial ? '<p class="choice-warning">Chỉ hành khách đã chọn được đổi; người còn lại chưa có chuyến thay thế. Liên hệ nhân viên nếu cần xử lý tiếp.</p>' : ''}`;
  }
  function holdBox() {
    if (!engine.hold || !engine.hold.active) return '';
    return `<div class="hold-box">${ann(4)}${icon('clock')}<div><strong>Đã giữ chỗ · Chưa đổi vé</strong><span>Cho ${engine.hold.ids.length} hành khách · tự nhả sau 20 phút</span></div><span id="hold-timer" class="timer">${timerText()}</span>${btn('drop-hold','Bỏ giữ','text-button')}</div>`;
  }
  function timerText() { const sec = Math.max(0, Math.ceil(((engine.hold?.expiresAt || 0) - engine.now()) / 1000)); return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`; }
  function renderClarifying() {
    return userBubble() + (engine.notice ? `<p class="choice-warning">${esc(engine.notice)}</p>` : '') + message(`${ann(1)}Mình chưa đổi vé. Có hai lựa chọn: <b>BM 201 lúc 07:00</b> và <b>BM 205 lúc 09:30</b> ngày 13/11/2026. ${engine.scenario === 'N01' ? 'Mình đã điền lựa chọn từ tin nhắn rõ của bạn; hãy xem lại trước khi giữ và duyệt đổi.' : 'Bạn muốn chuyến nào, và đổi cho những ai?'} Đổi vé sẽ dùng lần đổi miễn phí duy nhất.`, 'Chưa đổi vé · Cần chọn rõ phương án') + flightOptions() + passengerChoices() + (engine.error ? `<p class="choice-warning" role="alert">${esc(engine.error)}</p>` : '') + `<div class="actions">${btn('prepare','Xem lại & giữ chỗ','primary','arrow')}${btn('staff','Gặp nhân viên','secondary','support')}</div>` + evidence() + `<div class="bottom-links">${btn('refund','Tôi muốn hoàn vé','text-button') }<span class="muted" style="font-size:10px;padding-top:9px">Chưa dùng lượt đổi miễn phí</span></div>`;
  }
  function reviewCard() {
    const f = engine.selected();
    return `<div class="review-card"><div class="review-top">${ann(3)}${icon('plane')} KIỂM TRA TRƯỚC KHI ĐỔI VÉ</div><div class="review-route"><div><strong>${F.original.time}</strong><small>BM 213 · 12/11 · Đã huỷ</small></div>${icon('arrow')}<div><strong>${f.time}</strong><small>${f.id} · ${f.date}</small></div></div><div class="review-data"><div><span>Hành trình</span><span>Hà Nội → TP. Hồ Chí Minh</span></div><div><span>Hành khách</span><span>${engine.names().map(esc).join('<br>')}</span></div><div><span>Chính sách áp dụng</span><span>Đổi miễn phí 1 lần</span></div></div></div>`;
  }
  function renderReview() {
    return userBubble() + message('Phương án của bạn đã sẵn sàng. <b>Chưa đổi vé.</b> Hãy kiểm tra ngày giờ và từng hành khách trước khi xác nhận.', 'Cần bạn xác nhận') + holdBox() + reviewCard() + (engine.selectedPassengers.length < engine.passengers.length ? `<div class="warning-box">${icon('info')}<span>Chỉ đổi cho ${engine.names().map(esc).join(', ')}. Hành khách không được chọn vẫn ở chuyến đã huỷ, chưa có chuyến thay thế.</span></div>` : '') + `<div class="warning-box">${icon('warning')}<span>Đổi vé sẽ <b>dùng lần đổi miễn phí duy nhất</b>. Dữ liệu hiện có không bảo đảm hoàn tác vé đã đổi.</span></div><div class="actions">${btn('confirm','Xác nhận đổi vé','primary','check',!engine.canConfirm())}${btn('edit','Sửa lựa chọn','secondary')}${btn('staff','Gặp nhân viên','text-button','support')}</div>` + evidence() + `<div class="bottom-links">${btn('refund','Chuyển sang yêu cầu hoàn','text-button')}</div>`;
  }
  function renderRefund() {
    return userBubble() + message(`${ann(5)}Mình chưa gửi yêu cầu hoàn. Bạn muốn hoàn vé cho cả Nguyễn Minh An và Nguyễn Gia Bình phải không? <b>Yêu cầu gửi rồi không huỷ được.</b> Theo dữ liệu Bay Mẫu, chuyến huỷ do thời tiết được hoàn toàn bộ, không có bồi thường tiền mặt. Mình chưa có thông tin tiền hoàn về đâu và mất bao lâu, nên chưa thể gửi yêu cầu; mình có thể chuyển nhân viên xác minh trước khi bạn quyết định.`, 'Chưa gửi hoàn · Cần xác minh chính sách') + passengerChoices(true) + `<div class="policy-grid"><div class="policy-card"><h3>${icon('check')} Đã có căn cứ</h3><p>Hoàn toàn bộ khi chuyến bị huỷ.<br>Huỷ do thời tiết: không bồi thường tiền mặt.</p></div><div class="policy-card missing"><h3>${icon('info')} Chưa có thông tin</h3><p>Tiền hoàn về đâu?<br>Thời gian xử lý bao lâu?</p></div></div><div class="warning-box">${icon('warning')}<span>Gửi rồi <b>không huỷ được yêu cầu</b>. Đồng ý của bạn không thay thế thông tin chính sách còn thiếu.</span></div><div class="actions">${btn('send-refund','Gửi yêu cầu hoàn','secondary','',true)}</div><p class="blocked-note">Nút gửi đang khoá: cần xác minh nơi nhận tiền và thời gian xử lý trước.</p>${engine.error ? `<p class="choice-warning">${esc(engine.error)}</p>` : ''}<div class="actions">${ann(6)}${btn('staff-refund','Chuyển nhân viên xác minh','primary','support')}${btn('edit','Quay lại tìm chuyến','secondary')}</div>`;
  }
  function outcome(ico, title, body, buttons, warning = false) {
    return `<div class="outcome"><div class="outcome-symbol ${warning ? 'error' : ''}">${icon(ico)}</div><h3>${title}</h3><p>${body}</p><div class="actions">${buttons}</div></div>`;
  }
  function renderContent() {
    switch (engine.state) {
      case 'cancellation_notice': return `<section class="cancellation-notice"><div class="notice-topline"><span class="pill blue">${icon('info')} THÔNG BÁO CHUYẾN BAY</span><span>12/11/2026 · 15:00</span></div><div class="notice-symbol">${icon('plane')}</div><h2>Chuyến bay của bạn<br>đã bị huỷ.</h2><p class="notice-lead">Rất tiếc, chuyến <b>BM 213</b> từ Hà Nội đến TP. Hồ Chí Minh ngày <b>12/11/2026 lúc 19:00</b> đã bị huỷ do thời tiết (bão).</p><div class="notice-flight"><div><span>HAN</span><small>Hà Nội</small></div>${icon('plane')}<div><span>SGN</span><small>TP. Hồ Chí Minh</small></div><span class="pill red">Đã huỷ</span></div><div class="notice-policy"><strong>Bạn vẫn có lựa chọn cho hành trình này</strong><p>${icon('check')} Đổi miễn phí một lần trong 48 giờ theo chính sách Bay Mẫu.</p><p>${icon('check')} Hoặc yêu cầu hoàn toàn bộ tiền vé.</p><small>Huỷ do thời tiết không có bồi thường tiền mặt. Chưa đổi vé, chưa gửi yêu cầu hoàn.</small></div><div class="actions">${btn('open-notice','Xem phương án thay thế','primary','arrow')}${btn('notice-refund','Tìm hiểu hoàn vé','secondary')}</div><p class="notice-footnote">Áp dụng cho đặt chỗ TRV-7Q2K · 2 hành khách. Đây là thông báo mô phỏng, không phải thông báo từ hãng thật.</p></section>`;
      case 'clarifying': return renderClarifying();
      case 'change_review': return renderReview();
      case 'refund_review': return renderRefund();
      case 'changing': return outcome('clock','Đang xử lý đổi vé…','Chưa có kết quả. Vui lòng chờ; không gửi lại yêu cầu đổi hoặc hoàn.', '<span class="loading-dot"></span><span class="muted">Đang chờ phản hồi tool mô phỏng</span>');
      case 'changed': { const f = engine.flights.find(f => f.id === engine.currentFlight); return outcome('check','Hành trình mới đã sẵn sàng.', `Đã đổi sang <b>${f.id} · ${f.time} ngày ${f.date}</b> cho ${engine.names(engine.changedPassengers).map(esc).join(' và ')}.<br>Lần đổi miễn phí đã được dùng. Không có yêu cầu hoàn nào được gửi.`, btn('correction','Thông tin chưa đúng?','secondary','support')) + evidence(); }
      case 'hold_expired': return outcome('clock','Giữ chỗ đã hết hạn.','Chỗ giữ đã được nhả. Vé chưa đổi và lượt miễn phí vẫn còn. Hãy tra lại lựa chọn rồi xác nhận mới; thông tin cũ không bảo đảm còn chỗ.', btn('retry-lookup','Tra lại & chọn chuyến','primary','refresh') + btn('staff','Gặp nhân viên','secondary','support'),true);
      case 'transferring': return outcome('support','Đang chuyển yêu cầu…','Chưa có xác nhận vào hàng chờ. Việc chuyển không tự đổi vé, gửi hoàn hoặc gia hạn giữ chỗ.','<span class="loading-dot"></span><span class="muted">Đang chờ tool mô phỏng</span>');
      case 'staff_queued': return outcome('support','Đã vào hàng chờ hỗ trợ.', `${ann(6)}Trong bản mô phỏng, yêu cầu hỗ trợ đã vào hàng chờ <b>${engine.queue.id}</b>. Nhân viên nhận sẵn bối cảnh bên dưới.<br>Chưa có thời gian phản hồi được xác nhận. <b>Chưa gửi yêu cầu hoàn.</b>${engine.currentFlight ? '<br>Vé đã đổi trước đó vẫn giữ trạng thái đã đổi.' : engine.unknown ? '<br>Kết quả đổi vẫn chưa rõ; không tự thao tác lại.' : '<br>Vé chưa đổi.'}`, btn('copy','Sao chép tóm tắt','secondary','copy') + (!engine.isLocked() ? btn('edit','Quay lại tìm chuyến','secondary') : '')) + `<p class="muted" style="font-size:11px;margin-bottom:8px">Tóm tắt tại lúc chuyển ${esc(engine.queue.createdAt)} (không phải trạng thái cập nhật trực tiếp):</p><pre class="summary-pre" id="case-summary" tabindex="0">${esc(engine.queue.summary)}</pre>` + holdBox();
      case 'transfer_error': return outcome('warning','Chưa chuyển được yêu cầu.', `${ann(6)}Bạn có thể thử lại hoặc sao chép tóm tắt để tiếp tục yêu cầu hỗ trợ. Việc chuyển này chưa thực hiện đổi vé hoặc gửi hoàn. ${engine.currentFlight ? 'Vé đã đổi trước đó chưa được khôi phục.' : engine.unknown ? 'Kết quả đổi vẫn cần xác minh.' : ''}`, btn('staff','Thử chuyển lại','primary','refresh') + btn('copy','Sao chép tóm tắt','secondary','copy') + (!engine.isLocked() ? btn('edit','Quay lại tìm chuyến','text-button') : ''),true) + `<pre class="summary-pre" id="case-summary" tabindex="0">${esc(engine.summary())}</pre>` + holdBox();
      case 'correction': { const actual = engine.flights.find(f => f.id === engine.currentFlight); const report = engine.scenario === 'S08' ? `Mình đã đổi nhầm sang ${actual.id} lúc ${actual.time} trong tình huống mô phỏng này. Mình xin lỗi.` : `Bạn báo thông tin chưa đúng. Vé hiện được ghi nhận là ${actual.id} lúc ${actual.time} cho ${engine.names(engine.changedPassengers).map(esc).join(' và ')}; cần kiểm tra lại yêu cầu của bạn.`; return userBubble() + outcome('warning','Mình sẽ giúp bạn kiểm tra lại.',`${report} Lượt đổi miễn phí đã dùng; dữ liệu hiện có không bảo đảm hoàn tác. Cần chuyển nhân viên kiểm tra, không đổi tiếp hoặc hứa khôi phục vé.`, btn('staff-correction','Chuyển nhân viên kiểm tra','primary','support'),true) + evidence(); }
      case 'status_unknown': return outcome('warning','Chưa rõ kết quả đổi vé.','Tool chưa trả kết quả xác định. Mình không tự gọi đổi lần nữa để tránh thao tác lặp. Hãy kiểm tra trạng thái hoặc chuyển nhân viên. Chưa gửi hoàn.', btn('check-status','Kiểm tra trạng thái','secondary','refresh') + btn('staff','Chuyển nhân viên','primary','support'),true);
      case 'recoverable_error': return outcome('warning','Mình chưa thể hoàn tất.',esc(engine.error), btn('retry-lookup',engine.lastError === 'lookup' ? 'Thử tra lại' : 'Xem lại phương án','primary','refresh') + btn('staff','Gặp nhân viên','secondary','support'),true) + holdBox();
      default: return outcome('info','Cần kiểm tra lại.','Chưa có căn cứ để tiếp tục. Bạn có thể gặp nhân viên.',btn('staff','Gặp nhân viên','primary','support'));
    }
  }
  function render() {
    const focused = document.activeElement;
    const restoreSelectionFocus = focused && ['flight','person','refund-person'].includes(focused.name) ? { name: focused.name, value: focused.value } : null;
    engine.tick(); renderBooking();
    $('#content').innerHTML = `<div class="fade-in">${renderContent()}</div>`;
    const isNotice = engine.state === 'cancellation_notice';
    $('.stepper').hidden = isNotice;
    $('#chat-form').hidden = isNotice;
    $('.chat-disclaimer').hidden = isNotice;
    $('#step-a').classList.toggle('active',engine.screen === 'A'); $('#step-b').classList.toggle('active',engine.screen === 'B');
    $('#expire').disabled = !engine.hold?.active || engine.busy;
    $('#chat-input').disabled = engine.busy; $('#chat-form button').disabled = engine.busy;
    $('#tool-log').innerHTML = engine.logs.map(l => `<div class="log-row">${esc(l.time)} · ${esc(l.tool)}<br><b>${esc(l.result)}</b>${l.detail ? ` · ${esc(l.detail)}` : ''}</div>`).join('');
    if (restoreSelectionFocus) $(`input[name="${restoreSelectionFocus.name}"][value="${restoreSelectionFocus.value}"]`)?.focus?.({preventScroll:true});
  }
  function performAsync(begin, finish) {
    if (!begin()) { render(); return; }
    const run = generation; render();
    setTimeout(() => { if (generation !== run) return; finish(); render(); },650);
  }
  function startTransfer(reason) { performAsync(() => engine.beginTransfer(reason), () => engine.finishTransfer()); }
  async function copySummary() {
    const text = engine.queue ? engine.queue.summary : engine.summary();
    try { if (!navigator.clipboard) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(text); toast('Đã sao chép tóm tắt dữ liệu dựng.'); }
    catch (_) { const pre = $('#case-summary'); if (pre) { const range = document.createRange(); range.selectNodeContents(pre); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); pre.focus(); } toast('Trình duyệt chưa cho sao chép tự động. Tóm tắt đã được chọn; dùng Ctrl+C hoặc sao chép thủ công.'); }
  }
  $('#content').addEventListener('change',event => {
    if (event.target.name === 'flight' || event.target.name === 'person') {
      const flight = $('input[name="flight"]:checked')?.value || '';
      const ids = [...document.querySelectorAll('input[name="person"]:checked')].map(el => el.value);
      engine.setSelection(flight,ids); render();
    }
    if (event.target.name === 'refund-person') {
      engine.setRefundPassengers([...document.querySelectorAll('input[name="refund-person"]:checked')].map(el => el.value));
      if (engine.selectedPassengers.length) toast('Đã ghi nhận phạm vi. Chưa gửi hoàn vì vẫn thiếu thông tin chính sách.');
    }
  });
  $('#content').addEventListener('click',event => {
    const action = event.target.closest('[data-action]')?.dataset.action; if (!action) return;
    switch (action) {
      case 'open-notice': engine.openNotification('change'); render(); break;
      case 'notice-refund': engine.userMessage = 'Tôi muốn tìm hiểu hoàn vé cho đặt chỗ này.'; engine.openNotification('refund'); render(); break;
      case 'prepare': if (!engine.prepareChange() && engine.state === 'clarifying' && engine.selectedPassengers.includes('binh') && !engine.selectedPassengers.includes('an')) { startTransfer('Khách chọn riêng trẻ 5 tuổi; cần nhân viên kiểm tra điều kiện bay riêng, chưa giữ hoặc đổi vé'); } else render(); break;
      case 'confirm': performAsync(() => engine.beginChange(), () => engine.finishChange()); break;
      case 'edit': engine.edit(); render(); break;
      case 'drop-hold': if (engine.isLocked()) break; engine.edit('khách bỏ giữ'); render(); toast('Đã bỏ giữ chỗ. Vé chưa đổi.'); break;
      case 'refund': engine.userMessage = 'Tôi muốn tìm hiểu hoàn vé cho đặt chỗ này.'; engine.openRefund(); render(); break;
      case 'send-refund': engine.sendRefund(); render(); break;
      case 'staff': startTransfer(engine.reason || 'Khách yêu cầu gặp nhân viên'); break;
      case 'staff-refund': startTransfer('Xác minh nơi nhận tiền, thời gian hoàn và phạm vi hành khách trước quyết định hoàn'); break;
      case 'staff-correction': startTransfer(`Khách báo thông tin đổi chưa đúng; hiện ghi nhận ${engine.currentFlight}. Yêu cầu: ${engine.userMessage}. Không có bảo đảm hoàn tác.`); break;
      case 'retry-lookup': if (!engine.isLocked()) { engine.releaseHold('tra lại sau lỗi/hết hạn'); if (engine.lookup()) { engine.edit(); if (engine.scenario === 'S05') engine.openRefund(); } } render(); break;
      case 'check-status': engine.lookup(); toast('Trạng thái mô phỏng vẫn chưa xác định. Cần chuyển nhân viên; không tự đổi lại.'); render(); break;
      case 'correction': engine.state = 'correction'; engine.userMessage = 'Thông tin đổi vé chưa đúng với yêu cầu của mình.'; render(); break;
      case 'copy': copySummary(); break;
    }
  });
  function normalize(text) { return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d'); }
  $('#chat-form').addEventListener('submit',event => {
    event.preventDefault(); const input = $('#chat-input'); const raw = input.value.trim(); if (!raw || engine.busy) return; input.value = '';
    engine.userMessage = raw; const text = normalize(raw);
    if (engine.unknown) { engine.notice = 'Chưa rõ kết quả; không đổi hoặc gửi hoàn thêm.'; startTransfer('Khách nhắn khi kết quả đổi chưa rõ: ' + raw); return; }
    if (/doi.*nham|nham.*chuyen|sai.*chuyen|sai.*gio/.test(text) && engine.currentFlight) { engine.state = 'correction'; engine.screen = 'B'; render(); return; }
    if (engine.currentFlight) { startTransfer('Yêu cầu sau khi đã dùng lượt đổi: ' + raw); return; }
    if (engine.queue) { toast('Ca đã vào hàng chờ mô phỏng; không tạo thêm ca trùng.'); render(); return; }
    const refundIntent = /hoan|huy het|huy ve/.test(text);
    const changeIntent = /doi|chuyen|bay/.test(text);
    if (refundIntent && /doi.*ve|doi.*chuyen/.test(text)) { engine.edit(); engine.error = 'Tin nhắn có cả đổi và hoàn. Bạn muốn tìm chuyến thay thế hay yêu cầu hoàn? Mình chưa thực hiện hành động nào.'; render(); return; }
    if (/nhan vien.*hang|bo.*xac nhan|bo.*quy dinh/.test(text)) { engine.edit(); engine.error = 'Lời tự xưng trong chat không cấp quyền bỏ xác nhận. Hãy chọn rõ chuyến và hành khách; chỉ đổi sau khi bạn duyệt.'; render(); return; }
    if (/doi ten/.test(text)) { startTransfer('Đổi tên người bay ngoài bộ tool: ' + raw); return; }
    if (/(be|tre|con).*(di|bay).*(truoc|rieng|mot minh)/.test(text)) { startTransfer('Trẻ 5 tuổi bay riêng cần nhân viên hỗ trợ: ' + raw); return; }
    if (/nhan vien|ho tro|nguoi that/.test(text)) { startTransfer('Khách yêu cầu hỗ trợ: ' + raw); return; }
    if (/boi thuong|den.*bao nhieu/.test(text)) { engine.edit(); engine.error = 'Theo fixture Bay Mẫu: huỷ do thời tiết không có bồi thường tiền mặt. Bạn được đổi miễn phí một lần trong 48 giờ hoặc hoàn toàn bộ tiền vé. Hoàn tiền vé khác bồi thường.'; render(); return; }
    if (refundIntent) { engine.openRefund(); render(); return; }
    if (engine.state === 'refund_review' && /dung|dong y|ca hai|ok/.test(text)) { engine.error = 'Mình chưa gửi hoàn. Bạn hãy chọn rõ hành khách; kể cả đã chọn, nơi nhận tiền và thời gian xử lý vẫn cần nhân viên xác minh.'; render(); return; }
    if (/may gio|gio bay|bay luc/.test(text)) { engine.edit(); engine.error = 'BM 213 ngày 12/11/2026 lúc 19:00 đã HUỶ do thời tiết. Đây không còn là giờ bay có hiệu lực; hãy xem chuyến thay thế bên dưới.'; render(); return; }
    if (changeIntent || /dung|dong y|ok|ca hai/.test(text)) { engine.edit(); engine.error = 'Mình chưa đổi vé. Hãy chọn rõ chuyến và hành khách bằng các lựa chọn bên dưới; tin nhắn không tự thay thế bước duyệt cuối.'; render(); return; }
    engine.error = 'Mình chưa chắc đã hiểu yêu cầu này. Bạn muốn đổi chuyến, tìm hiểu hoàn vé hay gặp nhân viên? Chưa có thao tác đổi hoặc gửi hoàn.';
    if (engine.state !== 'refund_review') engine.edit();
    // edit xoá lỗi cũ; đặt lại để câu lạ luôn có một đường đi rõ.
    engine.error = 'Mình chưa chắc đã hiểu yêu cầu này. Bạn muốn đổi chuyến, tìm hiểu hoàn vé hay gặp nhân viên? Chưa có thao tác đổi hoặc gửi hoàn.';
    render();
  });
  $('#restart').addEventListener('click',() => { generation++; engine = new DemoEngine($('#scenario').value,$('#fault').value,true); render(); toast('Đã bắt đầu lượt demo mới bằng dữ liệu dựng.'); });
  $('#expire').addEventListener('click',() => { if (engine.expire()) { render(); toast('Đã đưa đồng hồ mô phỏng qua hạn giữ 20 phút.'); } });
  $('#annotations').addEventListener('change',event => document.body.classList.toggle('show-annotations',event.target.checked));
  setInterval(() => { if (engine.busy && engine.state === 'changing') return; const changed = engine.tick(); if (changed) render(); else if ($('#hold-timer')) $('#hold-timer').textContent = timerText(); $('#expire').disabled = !engine.hold?.active || engine.busy; },500);
  hydrateIcons(); render();
})();
