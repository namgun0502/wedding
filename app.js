/* ==========================================================================
   [app.js] 청첩장 전체 동작 스크립트
   - 실시간 편집기 (설정 패널) 기능 포함
   - 개인정보 암호화 저장 (RULE 7 준수)
   - Supabase 클라우드 데이터베이스 연동 기능 탑재
   - 실시간 하객 맞이 웰컴 보드 & QR 체크인 추적 기능 포함
   - (테이블 충돌 방지: wedding_guestbook, wedding_visitor_logs 사용)
   - (관리자 비밀번호 수파베이스 wedding_admin_auth 분리 연동)
   - (대량 QR 생성을 위한 키보드 편의성 및 포커스 복귀 추가)
   - (브라우저 자동완성 비밀번호 초기화 에러 원천 차단 스위치 탑재)
   ========================================================================== */

/* ==========================================================================
   [A. 기본 설정값 (Default Config)]
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

  // 대중교통 기본 설정값
  subwayInfo1:  "2호선 역삼역 1번 출구 도보 3분",
  subwayInfo2:  "2호선/신분당선 강남역 12번 출구 도보 8분",
  busStop:      "강남역·역삼역 정류장 하차",
  busLines:     "간선(파랑): 146, 341, 360, 740 / 지선(초록): 4434, 8441",
  carInfo:      "네비게이션 '그랜드 웨딩홀 강남점' 검색",
  parkingInfo:  "지하 1층~3층 무료 주차 (하객 2시간 무료)"
};

// 로컬 백업용 비밀번호 기본값 (Supabase 미동작 시 참조)
const ADMIN_PASSWORD_STORAGE_KEY = "wedding_admin_password_local";
const DEFAULT_ADMIN_PASSWORD = "1234";

/* ==========================================================================
   [B. 보안 암호화/복호화 (Security Encryption & Decryption)]
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
    console.log("Supabase 클라우드 데이터베이스에 연동되었습니다. 실시간 동기화 활성화.");
  } catch (e) {
    console.error("Supabase 초기화 에러:", e);
  }
}

/* ==========================================================================
   [D. 설정 로드/저장 (Config Load & Save)]
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
        const decrypted = decryptData(data.config_data);
        const parsed = JSON.parse(decrypted);
        currentConfig = { ...DEFAULT_CONFIG, ...parsed };
        applyConfigToPage(currentConfig);
        return;
      }
    } catch (e) {
      console.warn("Supabase 설정 로드 실패, LocalStorage로 구동:", e);
    }
  }

  const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (raw) {
    try {
      const decrypted = decryptData(raw);
      const parsed    = JSON.parse(decrypted);
      currentConfig = { ...DEFAULT_CONFIG, ...parsed };
    } catch (e) {
      console.error("로컬 설정 파싱 오류:", e);
    }
  }
  applyConfigToPage(currentConfig);
}

async function saveWeddingConfig(configObj) {
  const jsonStr = JSON.stringify(configObj);
  const encrypted = encryptData(jsonStr);
  localStorage.setItem(CONFIG_STORAGE_KEY, encrypted);

  if (isSupabaseActive) {
    try {
      const { error } = await supabaseClient
        .from("wedding_config")
        .upsert({ id: 1, config_data: encrypted, updated_at: new Date().toISOString() });

      if (error) throw error;
    } catch (e) {
      console.error("Supabase 설정 저장 실패:", e);
      showToast("⚠️ 설정이 로컬에만 보관되었습니다.");
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
    if (config[key] !== undefined) {
      el.innerText = config[key];
    }
  });

  document.querySelectorAll(".btn-copy[data-config]").forEach(btn => {
    const key = btn.getAttribute("data-config");
    if (config[key] !== undefined) {
      btn.setAttribute("data-account", config[key]);
    }
  });

  document.querySelectorAll("[data-config-href]").forEach(el => {
    const key    = el.getAttribute("data-config-href");
    const prefix = el.getAttribute("data-config-href-prefix") || "";
    if (config[key] !== undefined) {
      el.setAttribute("href", prefix + config[key]);
    }
  });

  currentConfig = config;
}

loadWeddingConfig();

/* ==========================================================================
   [F. D-Day 카운트다운 타이머]
   ========================================================================== */
function updateCountdown() {
  const weddingDate = new Date(currentConfig.weddingDateTime);
  const now         = new Date();
  const diff        = weddingDate.getTime() - now.getTime();

  const daysEl    = document.getElementById("days");
  const hoursEl   = document.getElementById("hours");
  const minutesEl = document.getElementById("minutes");
  const secondsEl = document.getElementById("seconds");
  const summaryEl = document.getElementById("dday-summary");

  if (diff > 0) {
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    daysEl.innerText    = d < 10 ? "0" + d : d;
    hoursEl.innerText   = h < 10 ? "0" + h : h;
    minutesEl.innerText = m < 10 ? "0" + m : m;
    secondsEl.innerText = s < 10 ? "0" + s : s;

    summaryEl.innerText = `${currentConfig.groomFirstName} & ${currentConfig.brideFirstName}의 결혼식이 ${d}일 남았습니다.`;
  } else {
    daysEl.innerText = hoursEl.innerText = minutesEl.innerText = secondsEl.innerText = "00";
    summaryEl.innerText = "축하해 주셔서 감사합니다. 예쁘게 잘 살겠습니다! 💕";
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
  sliderWrapper.style.transform = `translateX(${-currentSlide * 33.3333}%)`;
  dots.forEach((dot, i) => {
    dot.classList.toggle("active", i === currentSlide);
  });
}

nextBtn.addEventListener("click", () => goToSlide((currentSlide + 1) % totalSlides));
prevBtn.addEventListener("click", () => goToSlide((currentSlide - 1 + totalSlides) % totalSlides));
dots.forEach(dot => {
  dot.addEventListener("click", e => goToSlide(parseInt(e.target.getAttribute("data-index"))));
});

/* ==========================================================================
   [H. 계좌 아코디언 메뉴]
   ========================================================================== */
document.querySelectorAll(".accordion-header").forEach(header => {
  header.addEventListener("click", () => {
    header.parentElement.classList.toggle("active");
  });
});

/* ==========================================================================
   [I. 계좌번호 복사 & 토스트 알림]
   ========================================================================== */
const toastEl = document.getElementById("toast-alert");

document.querySelectorAll(".btn-copy").forEach(btn => {
  btn.addEventListener("click", () => copyToClipboard(btn.getAttribute("data-account")));
});

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => showToast("계좌번호가 복사되었습니다."))
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
  try { document.execCommand("copy"); showToast("계좌번호가 복사되었습니다."); }
  catch { alert("계좌번호 직접 드래그 복사를 이용해 주세요."); }
  document.body.removeChild(ta);
}

function showToast(msg) {
  toastEl.innerText = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2500);
}

/* ==========================================================================
   [J. 개인정보 보호 방명록 시스템 (Secure Guestbook)]
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
const btnCloseModal          = document.getElementById("btn-close-modal");
const btnConfirmDelete       = document.getElementById("btn-confirm-delete-message");
let messageIdToDelete        = null;

async function loadGuestbook() {
  if (isSupabaseActive) {
    try {
      const { data, error } = await supabaseClient
        .from("wedding_guestbook")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (!data || data.length === 0) {
        showEmptyNotice();
        return;
      }

      emptyNotice.style.display = "none";
      guestbookListContainer.innerHTML = "";

      data.forEach(msg => {
        const dateObj = new Date(msg.created_at);
        const dateString = `${dateObj.getFullYear()}. ${String(dateObj.getMonth()+1).padStart(2,'0')}. ${String(dateObj.getDate()).padStart(2,'0')}`;
        const decryptedMessage = decryptData(msg.message);

        const card = document.createElement("div");
        card.className = "guest-card";

        const headerEl = document.createElement("div");
        headerEl.className = "guest-card-header";
        headerEl.innerHTML = `<span class="guest-card-name">${msg.name}</span><span class="guest-card-date">${dateString}</span>`;

        const contentEl = document.createElement("div");
        contentEl.className = "guest-card-content";
        contentEl.innerText = decryptedMessage;

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

  emptyNotice.style.display = "none";
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

guestbookForm.addEventListener("submit", async e => {
  e.preventDefault();
  const name     = guestNameInput.value.trim();
  const password = guestPasswordInput.value.trim();
  const message  = guestMessageInput.value.trim();
  if (!name || !password || !message) return;

  const encryptedMessage = encryptData(message);
  const encryptedPassword = encryptData(password);

  if (isSupabaseActive) {
    try {
      const { error } = await supabaseClient
        .from("wedding_guestbook")
        .insert({ name, message: encryptedMessage, password_hash: encryptedPassword });

      if (error) throw error;
      
      guestNameInput.value = guestPasswordInput.value = guestMessageInput.value = "";
      loadGuestbook();
      showToast("축하 메시지가 등록되었습니다! 🌸");
      return;
    } catch (e) {
      console.error("Supabase 등록 에러:", e);
    }
  }

  const today = new Date();
  const dateString = `${today.getFullYear()}. ${String(today.getMonth()+1).padStart(2,'0')}. ${String(today.getDate()).padStart(2,'0')}`;
  let messages = [];
  const raw = localStorage.getItem(GUESTBOOK_KEY);
  if (raw) { try { messages = JSON.parse(decryptData(raw)); } catch { messages = []; } }

  messages.push({ id: Date.now(), name, password, message, date: dateString });
  localStorage.setItem(GUESTBOOK_KEY, encryptData(JSON.stringify(messages)));

  guestNameInput.value = guestPasswordInput.value = guestMessageInput.value = "";
  loadGuestbook();
  showToast("축하 메시지가 등록되었습니다! 🌸");
});

btnConfirmDelete.addEventListener("click", async () => {
  const entered = deletePasswordInput.value.trim();
  if (!entered) { alert("비밀번호를 입력해 주세요."); return; }

  if (isSupabaseActive && typeof messageIdToDelete === "string") {
    try {
      const { data, error } = await supabaseClient
        .from("wedding_guestbook")
        .select("password_hash")
        .eq("id", messageIdToDelete)
        .single();

      if (error) throw error;

      if (data && decryptData(data.password_hash) === entered) {
        const { error: delError } = await supabaseClient
          .from("wedding_guestbook")
          .delete()
          .eq("id", messageIdToDelete);

        if (delError) throw delError;

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

/* ==========================================================================
   [K. 실시간 하객 맞이 웰컴 보드 & QR 방문객 추적 로직 (Visitor Logs)]
   ========================================================================== */
const checkinModal        = document.getElementById("checkin-modal");
const btnOpenCheckin      = document.getElementById("btn-open-checkin");
const btnCloseCheckinModal = document.getElementById("btn-close-checkin-modal");
const btnSubmitCheckin    = document.getElementById("btn-submit-checkin");
const checkinNameInput    = document.getElementById("checkin-name");
const checkinSideSelect   = document.getElementById("checkin-side");
const checkinRelationInput = document.getElementById("checkin-relation");

if (btnOpenCheckin) {
  btnOpenCheckin.addEventListener("click", () => {
    checkinNameInput.value = "";
    checkinRelationInput.value = "";
    checkinModal.classList.add("show");
  });
}

function closeCheckinModal() {
  checkinModal.classList.remove("show");
}
if (btnCloseCheckinModal) {
  btnCloseCheckinModal.addEventListener("click", closeCheckinModal);
}
checkinModal.addEventListener("click", e => { if (e.target === checkinModal) closeCheckinModal(); });

if (btnSubmitCheckin) {
  btnSubmitCheckin.addEventListener("click", async () => {
    const nameStr = checkinNameInput.value.trim();
    const sideStr = checkinSideSelect.value === "groom" ? "신랑측" : "신부측";
    const relStr = checkinRelationInput.value.trim();

    if (!nameStr || !relStr) {
      alert("성함과 관계를 모두 적어주세요!");
      return;
    }

    const fullRelation = `${sideStr} ${relStr}`;

    if (isSupabaseActive) {
      try {
        const { error } = await supabaseClient
          .from("wedding_visitor_logs")
          .insert({ guest_name: nameStr, relation: fullRelation });

        if (error) throw error;
        
        showToast("🌸 예식장 전광판에 등록되었습니다! 🌸");
        closeCheckinModal();
        return;
      } catch (e) {
        console.error("하객 체크인 DB 저장 실패:", e);
      }
    }

    showToast(`체크인 완료: ${nameStr} 님 (${fullRelation})`);
    closeCheckinModal();
  });
}

async function handleUrlGuestCheckin() {
  const urlParams = new URLSearchParams(window.location.search);
  const guestName = urlParams.get("guest");
  const relationVal = urlParams.get("relation") || "하객";

  if (guestName && isSupabaseActive) {
    const sessionKey = `visitor_checked_${guestName}`;
    if (!sessionStorage.getItem(sessionKey)) {
      try {
        const { error } = await supabaseClient
          .from("wedding_visitor_logs")
          .insert({ guest_name: guestName, relation: relationVal });
        
        if (error) throw error;
        sessionStorage.setItem(sessionKey, "true");
        showToast(`🌸 ${guestName} 님, 청첩장 방문을 환영합니다! 🌸`);
      } catch (e) {
        console.error("자동 체크인 에러:", e);
      }
    }
  }
}

handleUrlGuestCheckin();

/* ==========================================================================
   [L. 관리자 설정 패널 내 실시간 방문객/QR 제어 로직]
   ========================================================================== */
const adminGuestName      = document.getElementById("admin-guest-name-input");
const adminGuestRelation  = document.getElementById("admin-guest-relation-select");
const btnGenerateGuestQr  = document.getElementById("btn-generate-guest-qr");
const qrResultBox         = document.getElementById("qr-result-box");
const generatedQrContainer = document.getElementById("generated-qr-image-container");
const generatedLinkText   = document.getElementById("generated-link-text");
const btnCopyGeneratedLink = document.getElementById("btn-copy-generated-link");
const adminVisitorList    = document.getElementById("admin-visitor-list");
const btnClearVisitors    = document.getElementById("btn-clear-visitors");

function generateGuestQrAction() {
  const name = adminGuestName.value.trim();
  const relation = adminGuestRelation.value;

  if (!name) {
    alert("하객 이름을 적어주세요!");
    return;
  }

  const baseUri = window.location.origin + window.location.pathname;
  const finalUrl = `${baseUri}?guest=${encodeURIComponent(name)}&relation=${encodeURIComponent(relation)}`;
  const qrApiUrl = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(finalUrl)}`;

  generatedQrContainer.innerHTML = `<img src="${qrApiUrl}" alt="하객 전용 QR" style="border: 4px solid white; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">`;
  generatedLinkText.innerText = finalUrl;
  btnCopyGeneratedLink.setAttribute("data-copy-target", finalUrl);
  
  qrResultBox.style.display = "block";
  showToast(`${name} 님의 QR 코드가 생성되었습니다.`);

  adminGuestName.value = "";
  adminGuestName.focus();
}

if (btnGenerateGuestQr) {
  btnGenerateGuestQr.addEventListener("click", generateGuestQrAction);
}

if (adminGuestName) {
  adminGuestName.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      generateGuestQrAction();
    }
  });
}

if (btnCopyGeneratedLink) {
  btnCopyGeneratedLink.addEventListener("click", () => {
    const target = btnCopyGeneratedLink.getAttribute("data-copy-target");
    if (target) {
      copyToClipboard(target);
      showToast("하객 전용 초대 링크가 복사되었습니다!");
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
      adminVisitorList.innerHTML = `<p class="field-hint" style="text-align: center; padding: 20px 0;">도착한 하객이 아직 없습니다.</p>`;
      return;
    }

    adminVisitorList.innerHTML = "";
    data.forEach(v => {
      const dateObj = new Date(v.visited_at);
      const timeStr = `${String(dateObj.getHours()).padStart(2,'0')}:${String(dateObj.getMinutes()).padStart(2,'0')}`;

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justify = "space-between";
      row.style.padding = "6px 0";
      row.style.borderBottom = "1px solid var(--settings-border)";
      row.innerHTML = `
        <span style="font-size: 13px; font-weight: bold; color: #fff;">${v.guest_name} <span style="font-size: 11px; font-weight: normal; color: var(--settings-gold); margin-left: 5px;">(${v.relation})</span></span>
        <span style="font-size: 11px; color: #6A6A6A;">${timeStr}</span>
      `;
      adminVisitorList.appendChild(row);
    });
  } catch (e) {
    console.error("관리자 하객 조회 실패:", e);
  }
}

if (btnClearVisitors) {
  btnClearVisitors.addEventListener("click", async () => {
    const confirmed = confirm("모든 하객 방문자 기록을 데이터베이스에서 완전히 삭제(초기화)하시겠습니까?");
    if (confirmed && isSupabaseActive) {
      try {
        const { error } = await supabaseClient
          .from("wedding_visitor_logs")
          .delete()
          .neq("guest_name", "");

        if (error) throw error;

        showToast("하객 방문 기록이 모두 삭제되었습니다.");
        loadAdminVisitorList();
      } catch (e) {
        console.error("하객 리스트 삭제 에러:", e);
      }
    }
  });
}

/* ==========================================================================
   [M. Supabase Realtime 기능 활성화 (실시간 데이터 구독)]
   ========================================================================== */
if (isSupabaseActive) {
  supabaseClient
    .channel("public:wedding_guestbook")
    .on("postgres_changes", { event: "*", schema: "public", table: "wedding_guestbook" }, payload => {
      loadGuestbook();
    })
    .subscribe();

  supabaseClient
    .channel("public:wedding_config")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wedding_config" }, payload => {
      if (payload.new && payload.new.config_data) {
        const decrypted = decryptData(payload.new.config_data);
        const parsed = JSON.parse(decrypted);
        applyConfigToPage({ ...DEFAULT_CONFIG, ...parsed });
        updateCountdown();
      }
    })
    .subscribe();

  supabaseClient
    .channel("public:wedding_visitor_logs")
    .on("postgres_changes", { event: "*", schema: "public", table: "wedding_visitor_logs" }, payload => {
      loadAdminVisitorList();
    })
    .subscribe();
}

/* ==========================================================================
   [N. 스크롤 페이드인 (Intersection Observer)]
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
   [O. 관리자 설정 편집기 및 수파베이스 비밀번호 인증 제어]
   ========================================================================== */
const fabBtn           = document.getElementById("fab-settings-btn");
const adminPwModal     = document.getElementById("admin-password-modal");
const adminPwInput     = document.getElementById("admin-password-input");
const btnCloseAdminPw  = document.getElementById("btn-close-admin-modal");
const btnConfirmAdminPw= document.getElementById("btn-confirm-admin-password");
const settingsPanel    = document.getElementById("settings-panel");
const btnCloseSettings = document.getElementById("btn-close-settings");
const btnSaveSettings  = document.getElementById("btn-save-settings");
const btnResetSettings = document.getElementById("btn-reset-settings");

// 토글 및 패스워드 입력 인풋 참조
const changePasswordToggle = document.getElementById("cfg-changePasswordToggle");
const adminPasswordInput   = document.getElementById("cfg-adminPassword");

// 토글 체크박스 체인지 리스너 (체크해야만 비밀번호 인풋 필드를 활성화시킴)
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

fabBtn.addEventListener("click", () => {
  adminPwInput.value = "";
  adminPwModal.classList.add("show");
  setTimeout(() => adminPwInput.focus(), 300);
});

function closeAdminPwModal() {
  adminPwModal.classList.remove("show");
  adminPwInput.value = "";
  fabBtn.classList.remove("active");
}
const closeBtn = document.getElementById("btn-close-admin-modal") || btnCloseAdminPw;
if (closeBtn) {
  closeBtn.addEventListener("click", closeAdminPwModal);
}
adminPwModal.addEventListener("click", e => { if (e.target === adminPwModal) closeAdminPwModal(); });

adminPwInput.addEventListener("keydown", e => { if (e.key === "Enter") btnConfirmAdminPw.click(); });

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

      if (error) throw error;

      if (data && data.password_hash) {
        correct = decryptData(data.password_hash);
      }
    } catch (e) {
      console.warn("Supabase 비밀번호 조회 실패, 로컬 임시 비밀번호를 사용합니다:", e);
      const localBackup = localStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY);
      if (localBackup) correct = decryptData(localBackup);
    }
  } else {
    const localBackup = localStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY);
    if (localBackup) correct = decryptData(localBackup);
  }

  if (entered === correct) {
    adminPwModal.classList.remove("show");
    adminPwInput.value = "";
    fabBtn.classList.add("active");

    populateSettingsPanel(currentConfig);
    loadAdminVisitorList();
    settingsPanel.classList.add("show");
  } else {
    adminPwInput.value = "";
    adminPwInput.style.borderColor = "#E63946";
    adminPwInput.placeholder = "❌ 비밀번호 오류";
    setTimeout(() => {
      adminPwInput.style.borderColor = "";
      adminPwInput.placeholder = "비밀번호 입력 (기본값: 1234)";
    }, 1500);
    adminPwInput.focus();
  }
});

function closeSettingsPanel() {
  settingsPanel.classList.remove("show");
  fabBtn.classList.remove("active");
  // 패널을 닫을 때 비밀번호 변경 토글 스위치들을 비활성화 상태로 원복합니다
  if (changePasswordToggle && adminPasswordInput) {
    changePasswordToggle.checked = false;
    adminPasswordInput.setAttribute("disabled", "true");
    adminPasswordInput.placeholder = "위 체크박스를 선택하면 입력 가능";
    adminPasswordInput.value = "";
  }
}
btnCloseSettings.addEventListener("click", closeSettingsPanel);
settingsPanel.addEventListener("click", e => { if (e.target === settingsPanel) closeSettingsPanel(); });

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

btnSaveSettings.addEventListener("click", async () => {
  const updatedConfig = { ...currentConfig };
  let newAdminPw = "";

  document.querySelectorAll(".settings-field input[data-cfg-key]").forEach(input => {
    const key = input.getAttribute("data-cfg-key");
    const val = input.value.trim();

    // ★ 자동완성 방어막: 체크박스가 체크되어 있을 때만 비밀번호 수정을 유효하게 처리합니다!
    if (key === "adminPassword") {
      if (changePasswordToggle && changePasswordToggle.checked && val.length > 0) {
        newAdminPw = val;
      }
    } else if (val.length > 0) {
      updatedConfig[key] = val;
    }
  });

  saveWeddingConfig(updatedConfig);

  // 비밀번호 변경 요청이 활성화되어 있을 때만 데이터베이스를 덮어씁니다.
  if (newAdminPw.length > 0) {
    const hashed = encryptData(newAdminPw);
    localStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, hashed);

    if (isSupabaseActive) {
      try {
        const { error } = await supabaseClient
          .from("wedding_admin_auth")
          .update({ password_hash: hashed, updated_at: new Date().toISOString() })
          .eq("id", 1);

        if (error) throw error;
        console.log("Supabase에 신규 관리자 비밀번호가 저장되었습니다.");
      } catch (e) {
        console.error("Supabase 관리자 비밀번호 업데이트 실패:", e);
      }
    }
  }

  closeSettingsPanel();
  showToast("✅ 설정이 클라우드에 보관되었습니다!");
});

btnResetSettings.addEventListener("click", () => {
  const confirmed = confirm("정말로 모든 설정을 초기값으로 되돌리겠습니까? (비밀번호도 1234로 초기화됩니다.)");
  if (confirmed) {
    if (isSupabaseActive) {
      supabaseClient.from("wedding_config").delete().eq("id", 1).then(() => {
        console.log("Supabase 설정 데이터 초기화.");
      });
      supabaseClient.from("wedding_visitor_logs").delete().neq("guest_name", "").then(() => {
        console.log("Supabase 하객 로그 초기화.");
      });
      const defaultHash = encryptData(DEFAULT_ADMIN_PASSWORD);
      supabaseClient.from("wedding_admin_auth").update({ password_hash: defaultHash }).eq("id", 1).then(() => {
        console.log("Supabase 관리자 비밀번호 초기화.");
      });
    }
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    localStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
    currentConfig = { ...DEFAULT_CONFIG };
    applyConfigToPage(currentConfig);
    updateCountdown();
    closeSettingsPanel();
    showToast("설정이 초기화되었습니다.");
  }
});
