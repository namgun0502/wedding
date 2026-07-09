/* ==========================================================================
   [app.js] 청첩장 전체 동작 스크립트 - 통합 안정화 버전
   - 실시간 편집기, 암호화 저장, Supabase 연동, 웰컴보드, QR 추적
   - 관리자 비밀번호 wedding_admin_auth 독립 테이블 인증
   - 브라우저 자동완성 방지 체크박스 스위치
   - 하객용 QR 생성 시 UUID 기반 티켓 발급(wedding_tickets) 및 현장 검증 연동
   - 클립보드 복사 시 QR 이미지를 Base64 데이터로 받아 리치 텍스트 복사 (카톡 연동 최적화)
   ========================================================================== */

/* ==========================================================================
   [A. 기본 설정값]
   ========================================================================== */
const DEFAULT_CONFIG = {
  groomName:         "박준서",
  groomFirstName:    "준서",
  groomParentsNames: "박민우 · 최지영",
  groomFatherName:   "박민우",
  groomRelation:     "차남",
  groomPhone:        "01012345678",
  groomAccount1:     "신한은행 110-123-456789",
  groomAccount2:     "국민은행 123456-02-789012",

  brideName:         "이서연",
  brideFirstName:    "서연",
  brideParentsNames: "이재현 · 정다은",
  brideFatherName:   "이재현",
  brideRelation:     "장녀",
  bridePhone:        "01087654321",
  brideAccount1:     "우리은행 1002-123-456789",
  brideAccount2:     "농협은행 302-1234-5678-90",

  weddingDateTime:     "2026-10-24T13:00",
  weddingDateText:     "2026. 10. 24 SAT PM 01:00",
  weddingFullDateText: "2026년 10월 24일 (토) 오후 1:00",

  hallName:     "그랜드 웨딩홀 그랜드볼룸",
  hallFullName: "그랜드 웨딩홀 3층 그랜드볼룸",
  hallAddress:  "서울특별시 강남구 테헤란로 123 (역삼동)",
  hallPhone:    "TEL. 02-1234-5678",

  subwayInfo1:  "2호선 역삼역 1번 출구 도보 3분",
  subwayInfo2:  "2호선/신분당선 강남역 12번 출구 도보 8분",
  busStop:      "강남역·역삼역 정류장 하차",
  busLines:     "간선(파랑): 146, 341, 360, 740 / 지선(초록): 4434, 8441",
  carInfo:      "네비게이션 '그랜드 웨딩홀 강남점' 검색",
  parkingInfo:  "지하 1층~3층 무료 주차 (하객 2시간 무료)"
};

const ADMIN_PASSWORD_STORAGE_KEY = "wedding_admin_password_local";
const DEFAULT_ADMIN_PASSWORD = "1234";

/* ==========================================================================
   [B. 보안 암호화/복호화]
   ========================================================================== */
const SECURITY_KEY = 77;

function encryptData(text) {
  if (!text) return "";
  const utf8String = unescape(encodeURIComponent(text));
  let codes = [];
  for (let i = 0; i < utf8String.length; i++) {
    codes.push(utf8String.charCodeAt(i) ^ SECURITY_KEY);
  }
  return btoa(codes.join(','));
}

function decryptData(encryptedText) {
  if (!encryptedText) return "";
  try {
    const codes = atob(encryptedText).split(',').map(Number);
    let result = "";
    for (let i = 0; i < codes.length; i++) {
      result += String.fromCharCode(codes[i] ^ SECURITY_KEY);
    }
    return decodeURIComponent(escape(result));
  } catch (e) {
    console.error("복호화 오류:", e);
    return "";
  }
}

/* ==========================================================================
   [C. Supabase 클라이언트 초기화]
   ========================================================================== */
let supabaseClient = null;
let isSupabaseActive = false;

if (
  typeof SUPABASE_CONFIG !== "undefined" &&
  SUPABASE_CONFIG.SUPABASE_URL &&
  SUPABASE_CONFIG.SUPABASE_ANON_KEY &&
  SUPABASE_CONFIG.SUPABASE_URL !== "YOUR_SUPABASE_PROJECT_URL_HERE" &&
  SUPABASE_CONFIG.SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY_HERE"
) {
  try {
    const { createClient } = supabase;
    supabaseClient = createClient(SUPABASE_CONFIG.SUPABASE_URL, SUPABASE_CONFIG.SUPABASE_ANON_KEY);
    isSupabaseActive = true;
    console.log("✅ Supabase 연동 성공");
  } catch (e) {
    console.error("Supabase 초기화 에러:", e);
  }
}

/* ==========================================================================
   [D. 설정 로드/저장]
   ========================================================================== */
const CONFIG_STORAGE_KEY = "wedding_custom_config";
let currentConfig = { ...DEFAULT_CONFIG };

async function loadWeddingConfig() {
  if (isSupabaseActive) {
    try {
      const { data, error } = await supabaseClient
        .from("wedding_config")
        .select("config_data")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (data && data.config_data) {
        const parsed = JSON.parse(decryptData(data.config_data));
        currentConfig = { ...DEFAULT_CONFIG, ...parsed };
        applyConfigToPage(currentConfig);
        return;
      }
    } catch (e) {
      console.warn("Supabase 설정 로드 실패, 로컬 구동:", e);
    }
  }
  const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(decryptData(raw));
      currentConfig = { ...DEFAULT_CONFIG, ...parsed };
    } catch (e) {
      console.error("로컬 설정 파싱 오류:", e);
    }
  }
  applyConfigToPage(currentConfig);
}

async function saveWeddingConfig(configObj) {
  const encrypted = encryptData(JSON.stringify(configObj));
  localStorage.setItem(CONFIG_STORAGE_KEY, encrypted);
  if (isSupabaseActive) {
    try {
      const { error } = await supabaseClient
        .from("wedding_config")
        .upsert({ id: 1, config_data: encrypted, updated_at: new Date().toISOString() });
      if (error) throw error;
    } catch (e) {
      console.error("Supabase 설정 저장 실패:", e);
    }
  }
  applyConfigToPage(configObj);
}

/* ==========================================================================
   [E. 동적 텍스트 적용 (Hydration)]
   ========================================================================== */
function applyConfigToPage(config) {
  document.querySelectorAll("[data-config]").forEach(el => {
    const key = el.getAttribute("data-config");
    if (config[key] !== undefined) el.innerText = config[key];
  });
  document.querySelectorAll(".btn-copy[data-config]").forEach(btn => {
    const key = btn.getAttribute("data-config");
    if (config[key] !== undefined) btn.setAttribute("data-account", config[key]);
  });
  document.querySelectorAll("[data-config-href]").forEach(el => {
    const key    = el.getAttribute("data-config-href");
    const prefix = el.getAttribute("data-config-href-prefix") || "";
    if (config[key] !== undefined) el.setAttribute("href", prefix + config[key]);
  });
  currentConfig = config;
}

loadWeddingConfig();

/* ==========================================================================
   [F. D-Day 카운트다운 타이머]
   ========================================================================== */
function updateCountdown() {
  const weddingDate = new Date(currentConfig.weddingDateTime);
  const now  = new Date();
  const diff = weddingDate.getTime() - now.getTime();

  const daysEl    = document.getElementById("days");
  const hoursEl   = document.getElementById("hours");
  const minutesEl = document.getElementById("minutes");
  const secondsEl = document.getElementById("seconds");
  const summaryEl = document.getElementById("dday-summary");

  if (!daysEl) return;

  if (diff > 0) {
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    daysEl.innerText    = String(d).padStart(2, "0");
    hoursEl.innerText   = String(h).padStart(2, "0");
    minutesEl.innerText = String(m).padStart(2, "0");
    secondsEl.innerText = String(s).padStart(2, "0");
    if (summaryEl) summaryEl.innerText = `${currentConfig.groomFirstName} & ${currentConfig.brideFirstName}의 결혼식이 ${d}일 남았습니다.`;
  } else {
    daysEl.innerText = hoursEl.innerText = minutesEl.innerText = secondsEl.innerText = "00";
    if (summaryEl) summaryEl.innerText = "축하해 주셔서 감사합니다. 예쁘게 잘 살겠습니다! 💕";
  }
}

updateCountdown();
setInterval(updateCountdown, 1000);

/* ==========================================================================
   [G. 포토 갤러리 슬라이더]
   ========================================================================== */
const sliderWrapper = document.getElementById("gallery-slider");
const prevBtn       = document.getElementById("gallery-prev-btn");
const nextBtn       = document.getElementById("gallery-next-btn");
const dots          = document.querySelectorAll("#gallery-dots .dot");

let currentSlide = 0;
const totalSlides = 3;

function goToSlide(index) {
  currentSlide = index;
  if (sliderWrapper) sliderWrapper.style.transform = `translateX(${-currentSlide * 33.3333}%)`;
  dots.forEach((dot, i) => dot.classList.toggle("active", i === currentSlide));
}

if (nextBtn) nextBtn.addEventListener("click", () => goToSlide((currentSlide + 1) % totalSlides));
if (prevBtn) prevBtn.addEventListener("click", () => goToSlide((currentSlide - 1 + totalSlides) % totalSlides));
dots.forEach(dot => dot.addEventListener("click", e => goToSlide(parseInt(e.target.getAttribute("data-index")))));

/* ==========================================================================
   [H. 계좌 아코디언 메뉴]
   ========================================================================== */
document.querySelectorAll(".accordion-header").forEach(header => {
  header.addEventListener("click", () => header.parentElement.classList.toggle("active"));
});

/* ==========================================================================
   [I. 계좌번호 복사 & 토스트 알림]
   ========================================================================== */
const toastEl = document.getElementById("toast-alert");

function showToast(msg) {
  if (!toastEl) return;
  toastEl.innerText = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2500);
}

document.querySelectorAll(".btn-copy").forEach(btn => {
  btn.addEventListener("click", () => {
    const account = btn.getAttribute("data-account");
    const copyTarget = btn.getAttribute("data-copy-target");
    copyToClipboard(account || copyTarget || "");
  });
});

function copyToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => showToast("복사되었습니다!"))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "absolute";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); showToast("복사되었습니다!"); }
  catch { alert("직접 드래그해서 복사해 주세요."); }
  document.body.removeChild(ta);
}

/* ==========================================================================
   [J. 방명록 시스템 (Secure Guestbook)]
   ========================================================================== */
const GUESTBOOK_KEY          = "encrypted_guestbook_messages";
const guestbookForm          = document.getElementById("guestbook-form");
const guestNameInput         = document.getElementById("guest-name");
const guestPasswordInput     = document.getElementById("guest-password");
const guestMessageInput      = document.getElementById("guest-message");
const guestbookListContainer = document.getElementById("guestbook-list-container");
const emptyNotice            = document.getElementById("empty-guestbook-notice");
const deleteModal            = document.getElementById("delete-modal");
const deletePasswordInput    = document.getElementById("delete-password-input");
const btnConfirmDelete       = document.getElementById("btn-confirm-delete-message");
let messageIdToDelete        = null;

function showEmptyNotice() {
  if (emptyNotice) emptyNotice.style.display = "block";
  if (guestbookListContainer) guestbookListContainer.innerHTML = "";
}

function openDeleteModal(id) {
  messageIdToDelete = id;
  if (deletePasswordInput) deletePasswordInput.value = "";
  if (deleteModal) deleteModal.classList.add("show");
  setTimeout(() => { if (deletePasswordInput) deletePasswordInput.focus(); }, 200);
}

function closeDeleteModal() {
  if (deleteModal) deleteModal.classList.remove("show");
  messageIdToDelete = null;
  if (deletePasswordInput) deletePasswordInput.value = "";
}

const btnCloseModal = document.getElementById("btn-close-modal");
if (btnCloseModal) btnCloseModal.addEventListener("click", closeDeleteModal);
if (deleteModal) deleteModal.addEventListener("click", e => { if (e.target === deleteModal) closeDeleteModal(); });

async function loadGuestbook() {
  if (isSupabaseActive) {
    try {
      const { data, error } = await supabaseClient
        .from("wedding_guestbook")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      if (!data || data.length === 0) { showEmptyNotice(); return; }

      if (emptyNotice) emptyNotice.style.display = "none";
      guestbookListContainer.innerHTML = "";

      data.forEach(msg => {
        const dateObj = new Date(msg.created_at);
        const dateStr = `${dateObj.getFullYear()}. ${String(dateObj.getMonth()+1).padStart(2,'0')}. ${String(dateObj.getDate()).padStart(2,'0')}`;
        const card = document.createElement("div");
        card.className = "guest-card";
        const headerEl = document.createElement("div");
        headerEl.className = "guest-card-header";
        headerEl.innerHTML = `<span class="guest-card-name">${msg.name}</span><span class="guest-card-date">${dateStr}</span>`;
        const contentEl = document.createElement("div");
        contentEl.className = "guest-card-content";
        contentEl.innerText = decryptData(msg.message);
        const delBtn = document.createElement("button");
        delBtn.className = "btn-delete-card";
        delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        delBtn.addEventListener("click", () => openDeleteModal(msg.id));
        card.appendChild(headerEl);
        card.appendChild(contentEl);
        card.appendChild(delBtn);
        guestbookListContainer.appendChild(card);
      });
      return;
    } catch (e) {
      console.warn("Supabase 방명록 로드 실패:", e);
    }
  }

  const raw = localStorage.getItem(GUESTBOOK_KEY);
  if (!raw) { showEmptyNotice(); return; }
  let messages = [];
  try { messages = JSON.parse(decryptData(raw)); } catch { messages = []; }
  if (!messages.length) { showEmptyNotice(); return; }

  if (emptyNotice) emptyNotice.style.display = "none";
  guestbookListContainer.innerHTML = "";
  messages.forEach(msg => {
    const card = document.createElement("div");
    card.className = "guest-card";
    const headerEl = document.createElement("div");
    headerEl.className = "guest-card-header";
    headerEl.innerHTML = `<span class="guest-card-name">${msg.name}</span><span class="guest-card-date">${msg.date}</span>`;
    const contentEl = document.createElement("div");
    contentEl.className = "guest-card-content";
    contentEl.innerText = msg.message;
    const delBtn = document.createElement("button");
    delBtn.className = "btn-delete-card";
    delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    delBtn.addEventListener("click", () => openDeleteModal(msg.id));
    card.appendChild(headerEl);
    card.appendChild(contentEl);
    card.appendChild(delBtn);
    guestbookListContainer.appendChild(card);
  });
}

if (guestbookForm) {
  guestbookForm.addEventListener("submit", async e => {
    e.preventDefault();
    const name     = guestNameInput.value.trim();
    const password = guestPasswordInput.value.trim();
    const message  = guestMessageInput.value.trim();
    if (!name || !password || !message) return;

    if (isSupabaseActive) {
      try {
        const { error } = await supabaseClient
          .from("wedding_guestbook")
          .insert({ name, message: encryptData(message), password_hash: encryptData(password) });
        if (error) throw error;
        guestNameInput.value = guestPasswordInput.value = guestMessageInput.value = "";
        loadGuestbook();
        showToast("축하 메시지가 등록되었습니다! 🌸");
        return;
      } catch (e) {
        console.error("Supabase 방명록 등록 에러:", e);
      }
    }

    const today = new Date();
    const dateStr = `${today.getFullYear()}. ${String(today.getMonth()+1).padStart(2,'0')}. ${String(today.getDate()).padStart(2,'0')}`;
    let messages = [];
    const raw = localStorage.getItem(GUESTBOOK_KEY);
    if (raw) { try { messages = JSON.parse(decryptData(raw)); } catch { messages = []; } }
    messages.push({ id: Date.now(), name, password, message, date: dateStr });
    localStorage.setItem(GUESTBOOK_KEY, encryptData(JSON.stringify(messages)));
    guestNameInput.value = guestPasswordInput.value = guestMessageInput.value = "";
    loadGuestbook();
    showToast("축하 메시지가 등록되었습니다! 🌸");
  });
}

if (btnConfirmDelete) {
  btnConfirmDelete.addEventListener("click", async () => {
    const entered = deletePasswordInput.value.trim();
    if (!entered) { alert("비밀번호를 입력해 주세요."); return; }

    if (isSupabaseActive && messageIdToDelete) {
      try {
        const { data, error } = await supabaseClient
          .from("wedding_guestbook")
          .select("password_hash")
          .eq("id", messageIdToDelete)
          .single();
        if (error) throw error;
        if (data && decryptData(data.password_hash) === entered) {
          await supabaseClient.from("wedding_guestbook").delete().eq("id", messageIdToDelete);
          showToast("메시지가 삭제되었습니다.");
          closeDeleteModal();
          loadGuestbook();
        } else {
          alert("비밀번호가 일치하지 않습니다.");
          deletePasswordInput.value = "";
          deletePasswordInput.focus();
        }
        return;
      } catch (e) {
        console.error("Supabase 삭제 오류:", e);
      }
    }

    const raw = localStorage.getItem(GUESTBOOK_KEY);
    if (!raw) { closeDeleteModal(); return; }
    let messages = [];
    try { messages = JSON.parse(decryptData(raw)); } catch { messages = []; }
    const target = messages.find(m => m.id === messageIdToDelete);
    if (!target) { closeDeleteModal(); return; }
    if (target.password === entered) {
      const filtered = messages.filter(m => m.id !== messageIdToDelete);
      if (!filtered.length) localStorage.removeItem(GUESTBOOK_KEY);
      else localStorage.setItem(GUESTBOOK_KEY, encryptData(JSON.stringify(filtered)));
      showToast("메시지가 삭제되었습니다.");
      closeDeleteModal();
      loadGuestbook();
    } else {
      alert("비밀번호가 일치하지 않습니다.");
      deletePasswordInput.value = "";
      deletePasswordInput.focus();
    }
  });
}

/* ==========================================================================
   [K. 하객 맞이 웰컴 보드 & QR 방문객 추적]
   ========================================================================== */
const checkinModal         = document.getElementById("checkin-modal");
const btnOpenCheckin       = document.getElementById("btn-open-checkin");
const btnCloseCheckinModal = document.getElementById("btn-close-checkin-modal");
const btnSubmitCheckin     = document.getElementById("btn-submit-checkin");
const checkinNameInput     = document.getElementById("checkin-name");
const checkinSideSelect    = document.getElementById("checkin-side");
const checkinRelationInput = document.getElementById("checkin-relation");

if (btnOpenCheckin) {
  btnOpenCheckin.addEventListener("click", () => {
    if (checkinNameInput) checkinNameInput.value = "";
    if (checkinRelationInput) checkinRelationInput.value = "";
    if (checkinModal) checkinModal.classList.add("show");
  });
}

function closeCheckinModal() {
  if (checkinModal) checkinModal.classList.remove("show");
}
if (btnCloseCheckinModal) btnCloseCheckinModal.addEventListener("click", closeCheckinModal);
if (checkinModal) checkinModal.addEventListener("click", e => { if (e.target === checkinModal) closeCheckinModal(); });

if (btnSubmitCheckin) {
  btnSubmitCheckin.addEventListener("click", async () => {
    const nameStr = checkinNameInput ? checkinNameInput.value.trim() : "";
    const sideStr = checkinSideSelect ? (checkinSideSelect.value === "groom" ? "신랑측" : "신부측") : "하객";
    const relStr  = checkinRelationInput ? checkinRelationInput.value.trim() : "";
    if (!nameStr || !relStr) { alert("성함과 관계를 모두 적어주세요!"); return; }
    const fullRelation = `${sideStr} ${relStr}`;
    if (isSupabaseActive) {
      try {
        await supabaseClient.from("wedding_visitor_logs").insert({ guest_name: nameStr, relation: fullRelation });
        showToast("🌸 예식장 전광판에 등록되었습니다! 🌸");
        closeCheckinModal();
        return;
      } catch (e) { console.error("하객 체크인 DB 저장 실패:", e); }
    }
    showToast(`체크인 완료: ${nameStr} 님 (${fullRelation})`);
    closeCheckinModal();
  });
}

/* ==========================================================================
   [K-2. 하객 개인 청첩장 체크인 배너 시스템]
   URL에 ?guest=이름&relation=관계 파라미터가 있을 때만 배너를 표시하고,
   하객이 직접 "체크인" 버튼을 눌러야만 DB에 등록합니다.
   ========================================================================== */
async function handleUrlGuestCheckin() {
  const urlParams   = new URLSearchParams(window.location.search);
  const guestName   = urlParams.get("guest");
  const relationVal = urlParams.get("relation") || "하객";

  if (!guestName) return;

  const banner         = document.getElementById("guest-checkin-banner");
  const bannerName     = document.getElementById("banner-guest-name");
  const bannerRelation = document.getElementById("banner-guest-relation");
  const checkinBtn     = document.getElementById("banner-checkin-btn");
  const successMsg     = document.getElementById("banner-success-msg");
  const collapseBtn    = document.getElementById("banner-collapse-btn");

  if (!banner) return;

  if (bannerName)     bannerName.innerText     = guestName;
  if (bannerRelation) bannerRelation.innerText  = relationVal;

  banner.style.display = "block";
  document.body.classList.add("has-checkin-banner");

  const sessionKey = `visitor_checked_${guestName}`;
  if (sessionStorage.getItem(sessionKey)) {
    if (checkinBtn)   { checkinBtn.disabled = true; checkinBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> 체크인 완료'; }
    if (successMsg)   successMsg.classList.add("show");
    return;
  }

  if (checkinBtn) {
    checkinBtn.addEventListener("click", async () => {
      checkinBtn.disabled = true;
      checkinBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 등록 중...';

      if (isSupabaseActive) {
        try {
          const { error } = await supabaseClient
            .from("wedding_visitor_logs")
            .insert({ guest_name: guestName, relation: relationVal });

          if (error) throw error;

          sessionStorage.setItem(sessionKey, "true");
          checkinBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> 체크인 완료!';
          if (successMsg) successMsg.classList.add("show");
          showToast(`🌸 ${guestName} 님, 전광판에 성함이 표시됩니다! 🌸`);

        } catch (e) {
          console.error("체크인 등록 실패:", e);
          checkinBtn.disabled = false;
          checkinBtn.innerHTML = '<i class="fa-solid fa-door-open"></i> 다시 시도하기';
          showToast("⚠️ 체크인에 실패했습니다. 다시 눌러주세요.");
        }
      } else {
        sessionStorage.setItem(sessionKey, "true");
        checkinBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> 체크인 완료!';
        if (successMsg) successMsg.classList.add("show");
        showToast(`🌸 ${guestName} 님 환영합니다! 🌸`);
      }
    });
  }

  if (collapseBtn) {
    collapseBtn.addEventListener("click", () => {
      banner.style.animation = "none";
      banner.style.transform = "translateY(-100%)";
      banner.style.opacity   = "0";
      banner.style.transition = "all 0.4s ease";
      setTimeout(() => {
        banner.style.display = "none";
        document.body.classList.remove("has-checkin-banner");
      }, 400);
    });
  }
}

handleUrlGuestCheckin();

/* ==========================================================================
   [L. 관리자 QR 생성기 & 방문자 목록]
   ========================================================================== */
const adminGuestName       = document.getElementById("admin-guest-name-input");
const adminGuestRelation   = document.getElementById("admin-guest-relation-select");
const btnGenerateGuestQr   = document.getElementById("btn-generate-guest-qr");
const qrResultBox          = document.getElementById("qr-result-box");
const generatedQrContainer = document.getElementById("generated-qr-image-container");
const generatedLinkText    = document.getElementById("generated-link-text");
const btnCopyGeneratedLink = document.getElementById("btn-copy-generated-link");
const adminVisitorList     = document.getElementById("admin-visitor-list");
const btnClearVisitors     = document.getElementById("btn-clear-visitors");

// ★ QR입장 티켓 테이블 연계 생성 ★
async function generateGuestQrAction() {
  const name = adminGuestName ? adminGuestName.value.trim() : "";
  const relation = adminGuestRelation ? adminGuestRelation.value : "하객";
  if (!name) { alert("하객 이름을 적어주세요!"); return; }

  let finalUrl = "";

  if (isSupabaseActive) {
    try {
      // 1) wedding_tickets 테이블에 UUID 고유 티켓 데이터 발급
      const { data, error } = await supabaseClient
        .from("wedding_tickets")
        .insert({ guest_name: name, relation: relation })
        .select("id")
        .single();

      if (error) throw error;

      // 2) 발급된 UUID 기반 ticket.html 검증 링크 생성
      const baseUri = window.location.origin + window.location.pathname.replace("index.html", "");
      finalUrl = `${baseUri}ticket.html?tid=${data.id}`;

    } catch (e) {
      console.warn("Supabase 티켓 발급 실패, 이전 모바일 청첩장 링크로 대체합니다:", e);
      const baseUri = window.location.origin + window.location.pathname;
      finalUrl = `${baseUri}?guest=${encodeURIComponent(name)}&relation=${encodeURIComponent(relation)}`;
    }
  } else {
    // 오프라인 모드 Fallback
    const baseUri = window.location.origin + window.location.pathname;
    finalUrl = `${baseUri}?guest=${encodeURIComponent(name)}&relation=${encodeURIComponent(relation)}`;
  }

  // QR API 호출
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(finalUrl)}&color=000000&bgcolor=ffffff&qzone=1&margin=0&format=png`;
  
  if (generatedQrContainer) generatedQrContainer.innerHTML = `<img src="${qrApiUrl}" alt="하객 전용 QR" style="border:4px solid white;border-radius:8px;box-shadow:0 4px 10px rgba(0,0,0,0.3);">`;
  if (generatedLinkText) generatedLinkText.innerText = finalUrl;
  if (btnCopyGeneratedLink) btnCopyGeneratedLink.setAttribute("data-copy-target", finalUrl);
  if (qrResultBox) qrResultBox.style.display = "block";
  
  showToast(`${name} 님의 모바일 입장 티켓 QR이 발급되었습니다.`);
  if (adminGuestName) { adminGuestName.value = ""; adminGuestName.focus(); }
}

if (btnGenerateGuestQr) btnGenerateGuestQr.addEventListener("click", generateGuestQrAction);
if (adminGuestName) {
  adminGuestName.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); generateGuestQrAction(); }
  });
}

// Helper: 이미지 URL을 base64 문자열로 변환하는 비동기 함수
function fetchImageAsBase64(url) {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    } catch (e) {
      reject(e);
    }
  });
}

if (btnCopyGeneratedLink) {
  btnCopyGeneratedLink.addEventListener("click", async () => {
    const target = btnCopyGeneratedLink.getAttribute("data-copy-target");
    if (!target) return;

    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(target)}&color=000000&bgcolor=ffffff&qzone=1&margin=0&format=png`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        showToast("🔄 QR코드 파일을 메모리에 복사하고 있습니다...");
        
        // QR 이미지를 base64 데이터로 직접 획득 (CORS 완벽 우회 및 유실 원천 차단)
        const base64Image = await fetchImageAsBase64(qrApiUrl);

        // Rich Text (HTML) 형태로 복사하여 카카오톡에 이미지 파일 + 텍스트 링크가 한번에 삽입되도록 처리
        const htmlText = `<img src="${base64Image}" width="200" height="200" /><br><br><a href="${target}">🎫 입장 티켓 확인 및 모바일 청첩장 링크 클릭하기</a>`;
        
        const blobHtml = new Blob([htmlText], { type: 'text/html' });
        const blobText = new Blob([target], { type: 'text/plain' });

        const data = [new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText
        })];

        await navigator.clipboard.write(data);
        showToast("📸 QR 파일과 링크가 한 번에 복사되었습니다! 카톡에 붙여넣으세요.");
      } else {
        copyToClipboard(target);
        showToast("링크 주소가 복사되었습니다.");
      }
    } catch (err) {
      console.warn("Base64 복합 복사 실패, 일반 주소 복사로 전환:", err);
      copyToClipboard(target);
      showToast("링크 주소가 복사되었습니다.");
    }
  });
}

async function loadAdminVisitorList() {
  if (!isSupabaseActive || !adminVisitorList) return;
  try {
    const { data, error } = await supabaseClient
      .from("wedding_visitor_logs")
      .select("*")
      .order("visited_at", { ascending: false })
      .limit(15);
    if (error) throw error;
    if (!data || data.length === 0) {
      adminVisitorList.innerHTML = `<p class="field-hint" style="text-align:center;padding:20px 0;">도착한 하객이 아직 없습니다.</p>`;
      return;
    }
    adminVisitorList.innerHTML = "";
    data.forEach(v => {
      const t = new Date(v.visited_at);
      const timeStr = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
      const row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--settings-border);";
      row.innerHTML = `<span style="font-size:13px;font-weight:bold;color:#fff;">${v.guest_name} <span style="font-size:11px;font-weight:normal;color:var(--settings-gold);margin-left:5px;">(${v.relation})</span></span><span style="font-size:11px;color:#6A6A6A;">${timeStr}</span>`;
      adminVisitorList.appendChild(row);
    });
  } catch (e) { console.error("관리자 하객 조회 실패:", e); }
}

if (btnClearVisitors) {
  btnClearVisitors.addEventListener("click", async () => {
    if (!confirm("모든 하객 방문자 기록을 삭제하시겠습니까?")) return;
    if (isSupabaseActive) {
      try {
        await supabaseClient.from("wedding_visitor_logs").delete().neq("guest_name", "");
        showToast("하객 방문 기록이 모두 삭제되었습니다.");
        loadAdminVisitorList();
      } catch (e) { console.error("하객 리스트 삭제 에러:", e); }
    }
  });
}

/* ==========================================================================
   [M. Supabase Realtime 구독]
   ========================================================================== */
if (isSupabaseActive) {
  supabaseClient.channel("public:wedding_guestbook")
    .on("postgres_changes", { event: "*", schema: "public", table: "wedding_guestbook" }, () => loadGuestbook())
    .subscribe();

  supabaseClient.channel("public:wedding_config")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wedding_config" }, payload => {
      if (payload.new && payload.new.config_data) {
        const parsed = JSON.parse(decryptData(payload.new.config_data));
        applyConfigToPage({ ...DEFAULT_CONFIG, ...parsed });
        updateCountdown();
      }
    }).subscribe();

  supabaseClient.channel("public:wedding_visitor_logs")
    .on("postgres_changes", { event: "*", schema: "public", table: "wedding_visitor_logs" }, () => loadAdminVisitorList())
    .subscribe();
}

/* ==========================================================================
   [N. 스크롤 페이드인]
   ========================================================================== */
const fadeInObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
document.querySelectorAll(".fade-in").forEach(el => fadeInObserver.observe(el));

/* ==========================================================================
   [O. 관리자 설정 패널 & 수파베이스 비밀번호 인증]
   ========================================================================== */
const fabBtn              = document.getElementById("fab-settings-btn");
const adminPwModal        = document.getElementById("admin-password-modal");
const adminPwInput        = document.getElementById("admin-password-input");
const btnConfirmAdminPw   = document.getElementById("btn-confirm-admin-password");
const settingsPanel       = document.getElementById("settings-panel");
const btnCloseSettings    = document.getElementById("btn-close-settings");
const btnSaveSettings     = document.getElementById("btn-save-settings");
const btnResetSettings    = document.getElementById("btn-reset-settings");

const changePasswordToggle = document.getElementById("cfg-changePasswordToggle");
const adminPasswordInput   = document.getElementById("cfg-adminPassword");

if (changePasswordToggle && adminPasswordInput) {
  changePasswordToggle.addEventListener("change", () => {
    if (changePasswordToggle.checked) {
      adminPasswordInput.removeAttribute("disabled");
      adminPasswordInput.placeholder = "변경할 비밀번호 입력 (4자리)";
      adminPasswordInput.focus();
    } else {
      adminPasswordInput.setAttribute("disabled", "true");
      adminPasswordInput.placeholder = "위 체크박스를 선택하면 입력 가능";
      adminPasswordInput.value = "";
    }
  });
}

if (fabBtn) {
  fabBtn.addEventListener("click", () => {
    adminPwInput.value = "";
    adminPwModal.classList.add("show");
    setTimeout(() => adminPwInput.focus(), 300);
  });
}

function closeSettingsPanel() {
  if (settingsPanel) settingsPanel.classList.remove("show");
  if (fabBtn) fabBtn.classList.remove("active");
  if (changePasswordToggle && adminPasswordInput) {
    changePasswordToggle.checked = false;
    adminPasswordInput.setAttribute("disabled", "true");
    adminPasswordInput.placeholder = "위 체크박스를 선택하면 입력 가능";
    adminPasswordInput.value = "";
  }
}

if (btnCloseSettings) btnCloseSettings.addEventListener("click", closeSettingsPanel);
if (settingsPanel) settingsPanel.addEventListener("click", e => { if (e.target === settingsPanel) closeSettingsPanel(); });

function closeAdminPwModal() {
  if (adminPwModal) adminPwModal.classList.remove("show");
  if (adminPwInput) adminPwInput.value = "";
  if (fabBtn) fabBtn.classList.remove("active");
}

const btnCloseAdminPw = document.getElementById("btn-close-admin-modal");
if (btnCloseAdminPw) btnCloseAdminPw.addEventListener("click", closeAdminPwModal);
if (adminPwModal) adminPwModal.addEventListener("click", e => { if (e.target === adminPwModal) closeAdminPwModal(); });
if (adminPwInput) adminPwInput.addEventListener("keydown", e => { if (e.key === "Enter") btnConfirmAdminPw.click(); });

if (btnConfirmAdminPw) {
  btnConfirmAdminPw.addEventListener("click", async () => {
    const entered = adminPwInput.value.trim();
    let correct = DEFAULT_ADMIN_PASSWORD;

    if (isSupabaseActive) {
      try {
        const { data, error } = await supabaseClient
          .from("wedding_admin_auth")
          .select("password_hash")
          .eq("id", 1)
          .single();

        if (!error && data && data.password_hash) {
          const decoded = decryptData(data.password_hash);
          if (decoded && decoded.length > 0) {
            correct = decoded;
          }
        }
      } catch (e) {
        console.warn("Supabase 비밀번호 조회 실패, 기본값 사용:", e);
        const localBackup = localStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY);
        if (localBackup) {
          const decoded = decryptData(localBackup);
          if (decoded && decoded.length > 0) correct = decoded;
        }
      }
    } else {
      const localBackup = localStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY);
      if (localBackup) {
        const decoded = decryptData(localBackup);
        if (decoded && decoded.length > 0) correct = decoded;
      }
    }

    if (entered === correct) {
      if (adminPwModal) adminPwModal.classList.remove("show");
      if (adminPwInput) adminPwInput.value = "";
      if (fabBtn) fabBtn.classList.add("active");
      populateSettingsPanel(currentConfig);
      loadAdminVisitorList();
      if (settingsPanel) settingsPanel.classList.add("show");
    } else {
      if (adminPwInput) {
        adminPwInput.value = "";
        adminPwInput.style.borderColor = "#E63946";
        adminPwInput.placeholder = "❌ 비밀번호 오류";
        setTimeout(() => {
          adminPwInput.style.borderColor = "";
          adminPwInput.placeholder = "비밀번호 입력 (기본값: 1234)";
        }, 1500);
        adminPwInput.focus();
      }
    }
  });
}

function populateSettingsPanel(config) {
  document.querySelectorAll(".settings-field input[data-cfg-key]").forEach(input => {
    const key = input.getAttribute("data-cfg-key");
    if (key === "adminPassword") {
      input.value = "";
    } else if (config[key] !== undefined) {
      input.value = config[key];
    }
  });
}

if (btnSaveSettings) {
  btnSaveSettings.addEventListener("click", async () => {
    const updatedConfig = { ...currentConfig };
    let newAdminPw = "";

    document.querySelectorAll(".settings-field input[data-cfg-key]").forEach(input => {
      const key = input.getAttribute("data-cfg-key");
      const val = input.value.trim();
      if (key === "adminPassword") {
        if (changePasswordToggle && changePasswordToggle.checked && val.length > 0) {
          newAdminPw = val;
        }
      } else if (val.length > 0) {
        updatedConfig[key] = val;
      }
    });

    saveWeddingConfig(updatedConfig);

    if (newAdminPw.length > 0) {
      const hashed = encryptData(newAdminPw);
      localStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, hashed);
      if (isSupabaseActive) {
        try {
          await supabaseClient
            .from("wedding_admin_auth")
            .update({ password_hash: hashed, updated_at: new Date().toISOString() })
            .eq("id", 1);
          console.log("✅ 관리자 비밀번호 DB 갱신 완료");
        } catch (e) {
          console.error("Supabase 비밀번호 업데이트 실패:", e);
        }
      }
    }

    closeSettingsPanel();
    showToast("✅ 설정이 저장되었습니다!");
  });
}

if (btnResetSettings) {
  btnResetSettings.addEventListener("click", async () => {
    if (!confirm("정말로 모든 설정을 초기값으로 되돌리겠습니까? (비밀번호도 1234로 초기화됩니다.)")) return;
    if (isSupabaseActive) {
      const defaultHash = encryptData(DEFAULT_ADMIN_PASSWORD);
      supabaseClient.from("wedding_config").delete().eq("id", 1).catch(console.error);
      supabaseClient.from("wedding_visitor_logs").delete().neq("guest_name", "").catch(console.error);
      supabaseClient.from("wedding_admin_auth").update({ password_hash: defaultHash }).eq("id", 1).catch(console.error);
    }
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    localStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
    currentConfig = { ...DEFAULT_CONFIG };
    applyConfigToPage(currentConfig);
    updateCountdown();
    closeSettingsPanel();
    showToast("설정이 초기화되었습니다.");
  });
}
