// ====== script.js ======
// === Khởi tạo Firebase ===
const firebaseConfig = {
    apiKey: "AIzaSyB51EgnWddxGnnw-aRWP8TFuorRBIl7muw",
    authDomain: "sokhambenhhtb.firebaseapp.com",
    // App đang dùng Realtime Database. Nếu khi tạo database ông chọn vùng khác Singapore,
    // hãy thay đúng URL Realtime Database trong Firebase Console tại đây.
    databaseURL: "https://sokhambenhhtb-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "sokhambenhhtb",
    storageBucket: "sokhambenhhtb.firebasestorage.app",
    messagingSenderId: "765632519559",
    appId: "1:765632519559:web:1bb4be127e252b68488722",
    measurementId: "G-6S68J7YF45"
  };
  
  firebase.initializeApp(firebaseConfig);
  let users = [];
let previousLimitMap = {};

firebase.database().ref("clinics").on("value", snapshot => {
  const data = snapshot.val();
  if (!data) return;

  const newClinics = Object.keys(data).map(key => ({
    id: key,
    ...data[key]
  }));

  newClinics.forEach(clinic => {
    const name = clinic.name;
    const prevLimit = previousLimitMap[name];

    if (prevLimit !== undefined && prevLimit !== clinic.limit) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('vi-VN');
      const dateStr = now.toLocaleDateString('vi-VN');
      const message = `
        ⚠️ <b>${name}</b> vừa được admin cập nhật:<br>
        Giới hạn từ <b>${prevLimit}</b> → <b>${clinic.limit}</b><br>
        🕒 Lúc: ${timeStr} - ${dateStr}
      `;
      addPhatSoNotification(
        "Cập nhật phòng khám",
        `${name}: giới hạn ${prevLimit} → ${clinic.limit} lúc ${timeStr} - ${dateStr}`,
        "warning"
      );
      showPopupUpdate(message);
    }

    previousLimitMap[name] = clinic.limit;
  });

  clinics = newClinics;
  renderClinicSelect?.(); // gọi lại nếu có
});

firebase.database().ref("users").once("value")
  .then(snapshot => {
    const data = snapshot.val();
    if (data) {
      users = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
    }
  })
  .catch(error => {
    console.error("Error loading users from Firebase:", error);
  });
// Clinics mặc định
let clinics = [
    { name: "Phòng khám Đông Y 1", limit: 100, issued: 0 },
    { name: "Phòng khám Đông Y 2", limit: 100, issued: 0 },
    { name: "Phòng khám Nội 1", limit: 100, issued: 0 },
    { name: "Phòng khám Nội 2", limit: 100, issued: 0 },
    { name: "Phòng khám Nội 3", limit: 100, issued: 0 },
    { name: "Phòng khám Nội 4", limit: 100, issued: 0 },
    { name: "Phòng khám Nội 5", limit: 100, issued: 0 },
    { name: "Phòng khám Nội tổng hợp", limit: 100, issued: 0 },
    { name: "Phòng khám Nhi 1", limit: 100, issued: 0 },
    { name: "Phòng khám Nhi 2", limit: 100, issued: 0 },
    { name: "Phòng khám Tai Mũi Họng", limit: 100, issued: 0 },
    { name: "Phòng khám Mắt", limit: 100, issued: 0 },
    { name: "Phòng khám Sản khoa", limit: 100, issued: 0 },
    { name: "Phòng khám Ngoại tổng hợp", limit: 100, issued: 0 }
];

const PREFERRED_PHATSO_CLINIC_ORDER = [
    "Phòng khám Đông Y 1",
    "Phòng khám Đông Y 2",
    "Phòng khám Nội 1",
    "Phòng khám Nội 2",
    "Phòng khám Nội 3",
    "Phòng khám Nội 4",
    "Phòng khám Nội 5",
    "Phòng khám Nội tổng hợp",
    "Phòng khám Nhi 1",
    "Phòng khám Nhi 2",
    "Phòng khám Tai Mũi Họng",
    "Phòng khám Mắt",
    "Phòng khám Sản khoa",
    "Phòng khám Ngoại tổng hợp"
];

function getOrderedClinicsForPhatSo() {
    const orderMap = new Map(PREFERRED_PHATSO_CLINIC_ORDER.map((name, index) => [normalizeKey(name), index]));
    return [...clinics].sort((a, b) => {
        const orderA = orderMap.has(normalizeKey(a.name)) ? orderMap.get(normalizeKey(a.name)) : Number.MAX_SAFE_INTEGER;
        const orderB = orderMap.has(normalizeKey(b.name)) ? orderMap.get(normalizeKey(b.name)) : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.name || "").localeCompare(String(b.name || ""), "vi");
    });
}

function getClinicDisplayMeta(clinicName) {
    const key = normalizeAudioKey(clinicName);
    if (key.includes("nhi")) return { icon: "fa-child-reaching", className: "phatso-icon-child" };
    if (key.includes("tai-mui-hong")) return { icon: "fa-ear-listen", className: "phatso-icon-ear" };
    if (key.includes("mat")) return { icon: "fa-eye", className: "phatso-icon-eye" };
    if (key.includes("san")) return { icon: "fa-person-pregnant", className: "phatso-icon-maternity" };
    if (key.includes("ngoai")) return { icon: "fa-staff-snake", className: "phatso-icon-surgery" };
    return { icon: "fa-stethoscope", className: "phatso-icon-default" };
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

let selectedClinic = "";
let calledNumbers = {}; // Phatso cấp số
let calledHistory = {}; // Phongkham đã gọi
let audioQueue = [];         // Hàng đợi âm thanh
let isPlayingAudio = false;  // Trạng thái đang phát hay không

// Tốc độ phát âm thanh giữ nguyên 1.0 để giọng đọc tự nhiên.
// Khoảng chờ giữa các đoạn được xử lý bằng cách cắt bớt khoảng lặng ở đầu/cuối file MP3.
const CALL_AUDIO_SPEED = 1.0;

function normalizeKey(name) {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f\s]/g, "-");
}

// Chuẩn hóa tên phòng khám để tìm đúng file âm thanh, kể cả khi tên phòng trên Firebase
// khác nhẹ với tên file, ví dụ: "Phòng khám sản" ↔ "phong-kham-san-khoa.mp3".
function normalizeAudioKey(name) {
    return String(name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

const clinicAudioFileMap = {
    "phong-kham-dong-y-1": ["phong-kham-dong-y-1.mp3", "phòng-khám-đông-y-1.mp3"],
    "phong-kham-dong-y-2": ["phong-kham-dong-y-2.mp3", "phòng-khám-đông-y-2.mp3"],

    // Bổ sung cả tên file không dấu và có dấu để tránh lỗi lệch đường dẫn khi chạy local/Vercel.
    // Riêng Nội 1 trước đó dễ bị im tên phòng vì chỉ thử một đường dẫn duy nhất.
    "phong-kham-noi-1": ["phong-kham-noi-1.mp3", "phòng-khám-nội-1.mp3"],
    "phong-kham-noi-2": ["phong-kham-noi-2.mp3", "phòng-khám-nội-2.mp3"],
    "phong-kham-noi-3": ["phong-kham-noi-3.mp3", "phòng-khám-nội-3.mp3"],
    "phong-kham-noi-4": ["phong-kham-noi-4.mp3", "phòng-khám-nội-4.mp3"],
    "phong-kham-noi-5": ["phong-kham-noi-5.mp3", "phòng-khám-nội-5.mp3"],
    "phong-kham-noi-tong-hop": ["phong-kham-noi-tong-hop.mp3", "phòng-khám-nội-tổng-hợp.mp3"],

    "phong-kham-nhi-1": ["phong-kham-nhi-1.mp3", "phòng-khám-nhi-1.mp3"],
    "phong-kham-nhi-2": ["phong-kham-nhi-2.mp3", "phòng-khám-nhi-2.mp3"],
    "phong-kham-mat": ["phong-kham-mat.mp3", "phòng-khám-mắt.mp3"],
    "phong-kham-tai-mui-hong": ["phong-kham-tai-mui-hong.mp3", "phòng-khám-tai-mũi-họng.mp3"],
    "phong-kham-rang-ham-mat": ["phong-kham-rang-ham-mat.mp3", "phòng-khám-răng-hàm-mặt.mp3"],
    "phong-kham-san": ["phong-kham-san-khoa.mp3", "phòng-khám-sản-khoa.mp3"],
    "phong-kham-san-khoa": ["phong-kham-san-khoa.mp3", "phòng-khám-sản-khoa.mp3"],
    "phong-kham-ngoai": ["phong-kham-ngoai-tong-hop.mp3", "phòng-khám-ngoại-tổng-hợp.mp3"],
    "phong-kham-ngoai-tong-hop": ["phong-kham-ngoai-tong-hop.mp3", "phòng-khám-ngoại-tổng-hợp.mp3"]
};

function getClinicAudioCandidates(clinicName) {
    const key = normalizeAudioKey(clinicName);
    const mappedFiles = clinicAudioFileMap[key];

    if (Array.isArray(mappedFiles) && mappedFiles.length > 0) {
        return mappedFiles.map(file => `audio/${file}`);
    }

    if (typeof mappedFiles === "string") {
        return [`audio/${mappedFiles}`];
    }

    // Dự phòng cho phòng khám mới: nên đặt file âm thanh theo tên không dấu, ví dụ: phong-kham-da-lieu.mp3.
    return [`audio/${key}.mp3`];
}

function getClinicAudioPath(clinicName) {
    return getClinicAudioCandidates(clinicName)[0];
}
const effectQueues = {};
const effectStatus = {}; // { key: true/false }
const lastDisplayedNumbers = {}; // { key: number }
function saveClinics() {
    firebase.database().ref("clinics").set(clinics);
    firebase.database().ref("lastClinicUpdate").set(Date.now()); // 💡 ghi thời gian cập nhật
}

function loadClinics(callback) {
    firebase.database().ref("clinics").once("value", snapshot => {
        const data = snapshot.val();
        if (Array.isArray(data)) {
            clinics = data; // ✅ CHỈ GÁN KHI CHẮC CHẮN data là MẢNG
        }
        if (typeof callback === "function") callback();
    });
}

function saveCalledNumbers() {
    firebase.database().ref("calledNumbers").set(calledNumbers);
}
function loadCalledNumbers(callback) {
    firebase.database().ref("calledNumbers").once("value", snapshot => {
        const data = snapshot.val();
        if (data) {
            calledNumbers = data;

            // ✅ Cập nhật lại clinic.issued từ dữ liệu Firebase
            clinics.forEach(clinic => {
                const key = normalizeKey(clinic.name);
                clinic.issued = (calledNumbers[key] || []).length;
            });
        }
        if (typeof callback === "function") callback();
    });
}
function loadCalledHistory(callback) {
    firebase.database().ref("calledHistory").once("value", snapshot => {
        const data = snapshot.val();
        if (data) {
            calledHistory = data;
        }
        clinics.forEach(c => {
            const key = normalizeKey(c.name); // ✅ CHUẨN HÓA ĐÚNG
            if (!Array.isArray(calledHistory[key])) calledHistory[key] = []; // 
        });
        if (typeof callback === "function") callback();
    });
}

function saveCalledHistory() {
    firebase.database().ref("calledHistory").set(calledHistory);
}


function login() {
  const id = document.getElementById("username").value.trim();
  const pw = document.getElementById("password").value.trim();
  const email = `${id}@sokhambenh.vercel.app`; // Tự động tạo email từ ID

  firebase.auth().signInWithEmailAndPassword(email, pw)
    .then((userCredential) => {
      const user = userCredential.user;
      loadUserRole(user.email); // Gọi hàm lấy role từ Realtime DB
    })
    .catch((error) => {
      alert("Sai ID hoặc mật khẩu!");
      console.error("Login failed:", error.message);
    });
}

function isLoginBoxVisible() {
  const loginBox = document.querySelector(".login-box");
  if (!loginBox) return false;
  return window.getComputedStyle(loginBox).display !== "none";
}

function setupLoginEnterKey() {
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const loginBox = document.querySelector(".login-box");
  if (!loginBox || !usernameInput || !passwordInput) return;

  [usernameInput, passwordInput].forEach(input => {
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        login();
      }
    });
  });

  loginBox.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && isLoginBoxVisible()) {
      const active = document.activeElement;
      if (active && (active.tagName === "BUTTON" || active.id === "username" || active.id === "password")) {
        event.preventDefault();
        login();
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", setupLoginEnterKey);

function loadUserRole(email) {
  const safeEmail = email.replace(/\./g, ','); // Firebase không cho key chứa dấu chấm
  firebase.database().ref("userRoles/" + safeEmail).once("value").then(snapshot => {
    const role = snapshot.val();
    if (!role) {
      alert("Tài khoản này chưa được cấp quyền!");
      return;
    }

    const user = { email, role };
    localStorage.setItem("currentUser", JSON.stringify(user));
    location.reload(); // Tải lại để hiện đúng giao diện theo vai trò
  });
}

function logout() {
    localStorage.removeItem("currentUser");
    location.reload();
}

function showDashboard(user) {
    const loginBox = document.querySelector(".login-box");
    if (loginBox) loginBox.style.display = "none";

    // ==== PHÂN QUYỀN CHO TÀI KHOẢN TIVI (DISPLAY) ====
if (user.role === "display") {
  document.querySelectorAll('link[href*="style.css"]').forEach(link => link.remove());
  document.body.innerHTML = `
    <div id="header" style="position: relative; min-height: 56px;">
      <!-- LOGO ĐĂNG XUẤT Ở GÓC TRÁI -->
      <div style="
          position: absolute;
          top: 35px; left: 150px;
          z-index: 2;
          display: flex;
          align-items: center;
          height: 80px;
      ">
<button id="logout-btn"
    title="Đăng xuất"
    onclick="logoutDisplay()"
    style="
      background: none;
      border: none;
      border-radius: 50%;
      padding: 0;
      width: 80px;
      height: 00px;
      cursor: pointer;
      box-shadow: 0 1px 4px #007bff28;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
  ">
  <img src="logott.png"
      alt="Logo Trung tâm"
      style="width: 100px; height: 100px; border-radius: 50%;">
</button>
      </div>
      <!-- VÙNG CHỮ CHẠY -->
      <div class="marquee-container">
        <span class="marquee">
          TRUNG TÂM Y TẾ KHU VỰC HÀM THUẬN BẮC | Chúc quý bệnh nhân sức khỏe & hài lòng với dịch vụ!
        </span>
      </div>
    </div>
    <div id="main-section" style="display:block;">
      <div id="board"></div>
    </div>
  `;

        // Hàm đăng xuất dành riêng cho màn hình TIVI (icon)
        window.logoutDisplay = function () {
            localStorage.removeItem("currentUser");
            location.reload();
        };

        // Load lại file CSS giao diện tivi (nếu có file riêng)
        const cssLink = document.createElement("link");
        cssLink.rel = "stylesheet";
        cssLink.href = "display.css"; // Đổi đúng tên file .css cho hiển thị tivi
        document.head.appendChild(cssLink);

        // Lắng nghe số gọi mới + nháy hiệu ứng + render
        listenAndHandleFlash();
        renderBoardQueueForAllClinics();
        setInterval(() => {
        location.reload();
        }, 900000);
        return; // Dừng lại luôn, không chạy các nhánh phía dưới nữa
    }
    if (user.role === "admin") {
        document.body.classList.add("admin-mode");
        document.getElementById("admin-container").style.display = "block";
        updateAdminTime();
        if (window.adminClockTimer) clearInterval(window.adminClockTimer);
        window.adminClockTimer = setInterval(updateAdminTime, 30000);
        renderAdmin();
        renderHighlightEditor();
    } else if (user.role === "phatso") {
        document.body.classList.add("phatso-mode");
        document.getElementById("phatso-container").style.display = "block";
        renderPhatSo();
    } else if (user.role === "phongkham") {
    const savedClinic = localStorage.getItem("selectedClinic");
    if (savedClinic) {
        selectedClinic = savedClinic;
        document.getElementById("clinic-name-display").innerText = selectedClinic;
        document.getElementById("clinic-name-display").style.display = "block";
        document.getElementById("clinic-select-container").style.display = "none";
        document.getElementById("phongkham-action").style.display = "block";
        document.getElementById("main-heading").style.display = "none";
        document.getElementById("top-right-buttons").style.display = "block";
        setTimeout(updateCalledList, 100);
        setTimeout(() => warmupAudioFilesForClinic(selectedClinic), 500);
    } else {
        showClinicSelect(); // ✅ Chỉ gọi khi chưa có selectedClinic
    }
    document.getElementById("phongkham-container").style.display = "block";
}
}
function renderBoardQueueForAllClinics() {
    // Đảm bảo mỗi lần gọi, lấy dữ liệu phòng khám cập nhật nhất
    allClinics = clinics.map(clinic => {
        const key = normalizeKey(clinic.name);
        let lastNumber = lastDisplayedNumbers[key] !== undefined ? lastDisplayedNumbers[key] : "...";
        let flashClass = effectStatus[key] ? "flash" : "";
        return { key, name: clinic.name, number: lastNumber, flashClass };
    });

    // Tách làm 2 bảng (2 cột)
    const n = Math.ceil(allClinics.length / 2);
    let left = allClinics.slice(0, n);
    let right = allClinics.slice(n);

    function makeTable(list) {
        let html = `
          <table class="display-table">
            <thead>
              <tr>
                <th style="width:70%;">TÊN PHÒNG KHÁM</th>
                <th style="width:30%;">SỐ ĐÃ GỌI</th>
              </tr>
            </thead>
            <tbody>
        `;
        list.forEach(item => {
            html += `
              <tr>
                <td class="name-cell">${item.name}</td>
                <td class="number-cell">
                  <span class="${item.flashClass}">${item.number}</span>
                </td>
              </tr>
            `;
        });
        html += `</tbody></table>`;
        return html;
    }

    document.getElementById('board').innerHTML = `
      <div class="split-tables">
        ${makeTable(left)}
        ${makeTable(right)}
      </div>
    `;
}
function listenAndHandleFlash() {
    firebase.database().ref("calledHistory").on("value", snapshot => {
        const data = snapshot.val() || {};

        clinics.forEach(clinic => {
            const key = normalizeKey(clinic.name);
            const arr = data[key];
            let lastNumber = Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : "...";

            if (!effectQueues[key]) effectQueues[key] = [];
            if (!lastDisplayedNumbers[key]) lastDisplayedNumbers[key] = "...";

            // Nếu có số mới, đưa vào queue nháy hiệu ứng
            if (
                lastNumber !== "..."
                && lastNumber !== lastDisplayedNumbers[key]
                && !effectQueues[key].includes(lastNumber)
            ) {
                effectQueues[key].push(lastNumber);
                if (!effectStatus[key]) {
                    playNextNumberForAllClinics(key);
                }
            }
        });
    });
}
// ===== Xử lý hiệu ứng nháy queue cho từng phòng khám =====
function playNextNumberForAllClinics(clinicKey) {
    if (!effectQueues[clinicKey] || effectQueues[clinicKey].length === 0) {
        effectStatus[clinicKey] = false;
        return;
    }
    effectStatus[clinicKey] = true;
    // Lấy số đầu queue để hiển thị
    lastDisplayedNumbers[clinicKey] = effectQueues[clinicKey][0];

    // Render lại bảng tổng hợp với hiệu ứng flash cho đúng số
    renderBoardQueueForAllClinics();

    // Sau khi nháy xong (vd: 3.5s), bỏ số khỏi queue, nháy tiếp số sau nếu có
    setTimeout(() => {
        effectStatus[clinicKey] = false;
        renderBoardQueueForAllClinics();

        effectQueues[clinicKey].shift();
        // Nếu còn số → tiếp tục nháy
        if (effectQueues[clinicKey].length > 0) {
            setTimeout(() => playNextNumberForAllClinics(clinicKey), 100);
        }
    }, 3500);
}
function updateAdminTime() {
    const timeEl = document.getElementById("admin-current-time");
    const dateEl = document.getElementById("admin-current-date");
    if (!timeEl || !dateEl) return;
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    dateEl.textContent = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

function updateAdminSummary() {
    const totalClinics = clinics.length;
    const totalIssued = clinics.reduce((sum, clinic) => sum + (Number(clinic.issued) || 0), 0);
    const totalLimit = clinics.reduce((sum, clinic) => sum + (Number(clinic.limit) || 0), 0);
    const totalRemaining = Math.max(0, totalLimit - totalIssued);

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = Number(value).toLocaleString("vi-VN");
    };

    setText("admin-total-clinics", totalClinics);
    setText("admin-total-issued", totalIssued);
    setText("admin-total-limit", totalLimit);
    setText("admin-total-remaining", totalRemaining);
}

function renderAdmin() {
    const grid = document.getElementById("admin-clinic-card-grid");
    const legacyTbody = document.querySelector("#admin-clinic-list tbody");

    if (!grid && !legacyTbody) return;
    if (grid) grid.innerHTML = "";
    if (legacyTbody) legacyTbody.innerHTML = "";

    clinics.forEach((clinic, idx) => {
        const issued = Number(clinic.issued) || 0;
        const limit = Number(clinic.limit) || 0;
        const remaining = Math.max(0, limit - issued);
        const orderText = String(idx + 1).padStart(2, "0");
        const meta = getClinicDisplayMeta(clinic.name);

        // Giao diện admin mới: mỗi phòng khám là một ô/card giống tài khoản phát số.
        if (grid) {
            const card = document.createElement("article");
            card.className = "admin-clinic-card";
            card.innerHTML = `
                <div class="admin-clinic-card-head">
                    <div class="admin-clinic-icon" aria-hidden="true"><i class="${meta.icon}"></i></div>
                    <div class="admin-clinic-title-wrap">
                        <div class="admin-clinic-order" aria-hidden="true">${orderText}</div>
                        <label class="sr-only" for="admin-clinic-name-${idx}">Tên phòng khám ${orderText}</label>
                        <input
                            type="text"
                            id="admin-clinic-name-${idx}"
                            class="admin-input-text clinic-name-input admin-card-name-input"
                            data-index="${idx}"
                            value="${escapeHTML(clinic.name)}"
                            aria-label="Tên phòng khám ${orderText}"
                        />
                    </div>
                    <button type="button" onclick="deleteClinic(${idx})" class="admin-delete-btn admin-card-delete-btn" title="Xóa phòng khám ${escapeHTML(clinic.name)}" aria-label="Xóa phòng khám ${escapeHTML(clinic.name)}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="admin-card-stats">
                    <div class="admin-card-stat admin-card-stat-limit">
                        <span>Giới hạn</span>
                        <input
                            type="number"
                            class="admin-input-number limit-input admin-card-limit-input"
                            data-index="${idx}"
                            value="${limit}"
                            min="1"
                            aria-label="Giới hạn lượt khám ${escapeHTML(clinic.name)}"
                        />
                    </div>
                    <div class="admin-card-stat admin-card-stat-issued">
                        <span>Đã cấp</span>
                        <strong>${issued}</strong>
                    </div>
                    <div class="admin-card-stat admin-card-stat-remaining">
                        <span>Còn lại</span>
                        <strong>${remaining}</strong>
                    </div>
                </div>
            `;
            grid.appendChild(card);
            return;
        }

        // Dự phòng cho cấu trúc bảng cũ nếu có.
        const row = document.createElement("tr");
        const inputName = document.createElement("input");
        inputName.type = "text";
        inputName.value = clinic.name;
        inputName.setAttribute("data-index", idx);
        inputName.className = "admin-input-text clinic-name-input";

        const inputLimit = document.createElement("input");
        inputLimit.type = "number";
        inputLimit.value = clinic.limit;
        inputLimit.min = 1;
        inputLimit.setAttribute("data-index", idx);
        inputLimit.className = "admin-input-number limit-input";

        row.innerHTML = `
            <td>
                <button type="button" onclick="deleteClinic(${idx})" class="admin-delete-btn" title="Xóa phòng khám">
                    <i class="fas fa-times"></i>
                </button>
            </td>
            <td></td>
            <td></td>
            <td>
                <div class="admin-issued-pill">
                    <strong>${issued}</strong>
                    <span>Còn ${remaining}</span>
                </div>
            </td>
        `;
        row.children[1].appendChild(inputName);
        row.children[2].appendChild(inputLimit);
        legacyTbody.appendChild(row);
    });
    updateAdminSummary();
    renderHighlightEditor();
}

function deleteClinic(index) {
    if (confirm("Bạn có chắc chắn muốn xóa phòng khám này không?")) {
        clinics.splice(index, 1);
        saveClinics();
        renderAdmin();
    }
}

function addClinic() {
    const name = document.getElementById("new-clinic-name").value.trim();
    const limit = parseInt(document.getElementById("new-clinic-limit").value);

    if (!name || isNaN(limit) || limit <= 0) {
        alert("Vui lòng nhập tên và giới hạn hợp lệ!");
        return;
    }

    // Kiểm tra trùng tên
    if (clinics.some(c => c.name === name)) {
        alert("Tên phòng khám đã tồn tại!");
        return;
    }

    clinics.push({ name, limit, issued: 0 });
    const key = normalizeKey(name);
    calledNumbers[key] = [];
    calledHistory[key] = [];

    saveClinics();
    saveCalledNumbers();
    saveCalledHistory();

    // Xoá nội dung input
    document.getElementById("new-clinic-name").value = "";
    document.getElementById("new-clinic-limit").value = "";
    
    renderAdmin();
}

function saveChanges() {
    const limitInputs = document.querySelectorAll(".limit-input");
    const nameInputs = document.querySelectorAll(".clinic-name-input");

    limitInputs.forEach((input, idx) => {
        const index = input.getAttribute("data-index");
        const newLimit = Number(input.value);
        const newName = nameInputs[idx].value.trim();
        const oldName = clinics[index].name;

        const oldKey = normalizeKey(oldName);
        const newKey = normalizeKey(newName);

        // Nếu đổi tên phòng khám
        if (newName !== oldName) {
            if (calledNumbers[oldKey]) {
                calledNumbers[newKey] = [...calledNumbers[oldKey]];
                delete calledNumbers[oldKey];
            }
            if (calledHistory[oldKey]) {
                calledHistory[newKey] = [...calledHistory[oldKey]];
                delete calledHistory[oldKey];
            }
        }

        const clinic = clinics[index];
        const clinicKey = normalizeKey(newName);

        // Đảm bảo key tồn tại
        if (!Array.isArray(calledNumbers[clinicKey])) {
            calledNumbers[clinicKey] = [];
        }

        // Cắt danh sách số nếu vượt quá giới hạn mới
        if (calledNumbers[clinicKey].length > newLimit) {
            calledNumbers[clinicKey] = calledNumbers[clinicKey].slice(0, newLimit);
        }

        // Cập nhật lại clinic
        clinic.name = newName;
        clinic.limit = newLimit;
        clinic.issued = Math.min(calledNumbers[clinicKey].length, newLimit); // ✅ QUAN TRỌNG
    });

    // ✅ Lưu dữ liệu đồng bộ
    saveClinics();
    saveCalledNumbers();
    saveCalledHistory();

    loadClinics(() => {
        alert("Đã lưu thay đổi!");
        renderAdmin();
    });
}
function resetIssued() {
    if (confirm("Bạn có chắc chắn muốn reset toàn bộ?")) {
        clinics.forEach(c => {
            c.limit = 100;
            c.issued = 0;

            const key = normalizeKey(c.name);
            calledNumbers[key] = [];
            calledHistory[key] = [];
        });

        // Lưu dữ liệu mới lên Firebase
        saveClinics();
        saveCalledNumbers();
        saveCalledHistory();

        // Ghi lại thời gian cập nhật
        firebase.database().ref("lastClinicUpdate").set(Date.now());

        // Xoá localStorage nếu có dữ liệu cũ
        localStorage.removeItem("selectedClinic");

        // Tải lại trang sau reset để đảm bảo đồng bộ
        alert("Đã reset thành công! Trang sẽ được làm mới.");
        location.reload(); // 👉 Thêm dòng này để làm mới toàn bộ giao diện
    }
}


const PHATSO_NOTIFICATION_STORAGE_KEY = "phatsoNotifications_v1";
let phatsoNotifications = [];

function loadPhatSoNotifications() {
    try {
        const raw = localStorage.getItem(PHATSO_NOTIFICATION_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        phatsoNotifications = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn("Không đọc được thông báo phát số:", error);
        phatsoNotifications = [];
    }
}

function savePhatSoNotifications() {
    try {
        localStorage.setItem(PHATSO_NOTIFICATION_STORAGE_KEY, JSON.stringify(phatsoNotifications.slice(0, 30)));
    } catch (error) {
        console.warn("Không lưu được thông báo phát số:", error);
    }
}

function addPhatSoNotification(title, message, type = "info") {
    loadPhatSoNotifications();
    phatsoNotifications.unshift({
        id: Date.now(),
        title,
        message,
        type,
        read: false,
        time: new Date().toLocaleString("vi-VN")
    });
    phatsoNotifications = phatsoNotifications.slice(0, 30);
    savePhatSoNotifications();
    updatePhatSoBellCount();
    refreshPhatSoNotificationPanel();
}

function getPhatSoUnreadCount() {
    return phatsoNotifications.filter(item => !item.read).length;
}

function getPhatSoNotificationPanelHTML() {
    if (!phatsoNotifications.length) {
        return `
            <div class="phatso-notification-empty">
                <i class="far fa-bell-slash"></i>
                <strong>Chưa có thông báo mới</strong>
                <span>Hệ thống sẽ báo khi dữ liệu phòng khám thay đổi.</span>
            </div>
        `;
    }

    return phatsoNotifications.slice(0, 10).map(item => `
        <div class="phatso-notification-item ${item.read ? "is-read" : "is-unread"} ${escapeHTML(item.type || "info")}">
            <div class="phatso-notification-dot"></div>
            <div>
                <strong>${escapeHTML(item.title)}</strong>
                <p>${escapeHTML(item.message)}</p>
                <span>${escapeHTML(item.time)}</span>
            </div>
        </div>
    `).join("");
}

function updatePhatSoBellCount() {
    const countEl = document.getElementById("phatso-notification-count");
    if (!countEl) return;
    const unread = getPhatSoUnreadCount();
    countEl.textContent = unread;
    countEl.classList.toggle("is-empty", unread === 0);
    countEl.setAttribute("aria-label", unread ? `${unread} thông báo chưa đọc` : "Không có thông báo mới");
}

function refreshPhatSoNotificationPanel() {
    const listEl = document.getElementById("phatso-notification-list");
    if (listEl) listEl.innerHTML = getPhatSoNotificationPanelHTML();
}

function togglePhatSoNotifications(event) {
    if (event) event.stopPropagation();
    const panel = document.getElementById("phatso-notification-panel");
    if (!panel) return;
    const willOpen = !panel.classList.contains("show");
    panel.classList.toggle("show", willOpen);

    if (willOpen) {
        loadPhatSoNotifications();
        refreshPhatSoNotificationPanel();
        phatsoNotifications = phatsoNotifications.map(item => ({ ...item, read: true }));
        savePhatSoNotifications();
        updatePhatSoBellCount();
    }
}
window.togglePhatSoNotifications = togglePhatSoNotifications;

document.addEventListener("click", event => {
    const wrap = event.target.closest?.(".phatso-notification-wrap");
    if (!wrap) {
        document.getElementById("phatso-notification-panel")?.classList.remove("show");
    }
});

async function renderPhatSo() {
    await new Promise(resolve => loadCalledNumbers(resolve)); // ✅ Đợi dữ liệu load xong
    loadPhatSoNotifications();

    const container = document.getElementById("phatso-container");
    if (!container) return;

    const orderedClinics = getOrderedClinicsForPhatSo();
    const totalIssued = orderedClinics.reduce((sum, clinic) => sum + (Number(clinic.issued) || 0), 0);
    const unreadCount = getPhatSoUnreadCount();
    const now = new Date();
    const timeText = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const dateText = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

    container.innerHTML = `
        <main class="phatso-main phatso-main-full">
            <header class="phatso-topbar no-print">
                <div class="phatso-screen-title" aria-label="Tên màn hình">
                    <i class="fas fa-ticket-alt"></i>
                    <div>
                        <strong>CẤP SỐ KHÁM BỆNH</strong>
                    </div>
                </div>
                <div class="phatso-topbar-right">
                    <div class="phatso-notification-wrap">
                        <button type="button" id="phatso-notification-btn" class="phatso-bell" title="Thông báo" aria-label="Mở thông báo" onclick="togglePhatSoNotifications(event)">
                            <i class="far fa-bell"></i>
                            <span id="phatso-notification-count" class="${unreadCount === 0 ? "is-empty" : ""}">${unreadCount}</span>
                        </button>
                        <div id="phatso-notification-panel" class="phatso-notification-panel" role="dialog" aria-label="Danh sách thông báo">
                            <div class="phatso-notification-head">
                                <strong>Thông báo hệ thống</strong>
                                <small>Theo dõi thay đổi dữ liệu phòng khám</small>
                            </div>
                            <div id="phatso-notification-list" class="phatso-notification-list">
                                ${getPhatSoNotificationPanelHTML()}
                            </div>
                        </div>
                    </div>
                    <div class="phatso-time"><strong>${timeText}</strong><span>${dateText}</span></div>
                    <button type="button" class="phatso-logout-btn" onclick="logout()"><i class="fas fa-right-from-bracket"></i> Đăng xuất</button>
                </div>
            </header>
            <section class="phatso-summary-card phatso-summary-minimal no-print" aria-label="Tổng quan cấp số">
                <div class="phatso-summary-info">
                    <div class="phatso-summary-row">
                        <span class="phatso-summary-label">Tổng lượt đã cấp</span>
                        <strong class="phatso-summary-number">${totalIssued}</strong>
                        <span class="phatso-summary-unit">lượt</span>
                    </div>
                </div>
            </section>
            <section id="phatso-card-grid" class="phatso-card-grid" aria-label="Danh sách phòng khám"></section>
            <div id="phatso-history-modal" class="phatso-history-modal no-print" aria-hidden="true">
                <div class="phatso-history-backdrop" onclick="closeIssuedHistory()"></div>
                <div class="phatso-history-dialog" role="dialog" aria-modal="true" aria-labelledby="phatso-history-title">
                    <div class="phatso-history-head">
                        <div>
                            <strong id="phatso-history-title">Lịch sử đã cấp số</strong>
                            <span id="phatso-history-subtitle">Chọn số để in lại vé</span>
                        </div>
                        <button type="button" class="phatso-history-close" onclick="closeIssuedHistory()" title="Đóng"><i class="fas fa-times"></i></button>
                    </div>
                    <div id="phatso-history-list" class="phatso-history-list"></div>
                </div>
            </div>
            <div class="phatso-footer-note no-print">Bản quyền © 2025 - Designed &amp; Coded by Đặng Ngọc Văn</div>
        </main>
    `;

    const grid = container.querySelector("#phatso-card-grid");
    orderedClinics.forEach((clinic, idx) => {
        const issued = Number(clinic.issued) || 0;
        const limit = Number(clinic.limit) || 0;
        const remaining = Math.max(0, limit - issued);
        const meta = getClinicDisplayMeta(clinic.name);
        const card = document.createElement("article");
        card.className = "phatso-clinic-card";
        card.innerHTML = `
            <div class="phatso-card-title-row">
                <div class="phatso-card-icon ${meta.className}"><i class="fas ${meta.icon}"></i></div>
                <h2>${String(idx + 1).padStart(2, "0")}. ${escapeHTML(clinic.name)}</h2>
                <button type="button" class="phatso-history-icon-btn" title="Lịch sử đã cấp số" aria-label="Lịch sử đã cấp số của ${escapeHTML(clinic.name)}">
                    <i class="fas fa-clock-rotate-left"></i>
                </button>
            </div>
            <div class="phatso-card-stats">
                <div class="phatso-mini-stat issued"><span>Đã cấp</span><strong>${issued}</strong></div>
                <div class="phatso-mini-stat remaining"><span>Còn lại</span><strong>${remaining}</strong></div>
            </div>
            <div class="phatso-card-actions">
                <button type="button" class="btn-normal phatso-issue-btn"><i class="fas fa-ticket-alt"></i> Cấp số</button>
                <button type="button" class="btn-priority phatso-priority-btn"><i class="far fa-star"></i> Ưu tiên</button>
            </div>
        `;
        card.querySelector(".phatso-issue-btn").addEventListener("click", () => issueNumber(clinic.name, false));
        card.querySelector(".phatso-priority-btn").addEventListener("click", () => issueNumber(clinic.name, true));
        card.querySelector(".phatso-history-icon-btn").addEventListener("click", () => openIssuedHistory(clinic.name));
        grid.appendChild(card);
    });
}

async function issueNumber(name, isPriority = false) {
  await new Promise(resolve => loadCalledNumbers(resolve)); // Lấy dữ liệu mới nhất từ Firebase

  const clinic = clinics.find(c => c.name === name);
  if (!clinic) {
    alert("Phòng khám không tồn tại!");
    return;
  }

  // ✅ ĐỒNG BỘ lại số đã cấp từ calledNumbers để tránh lệch local
  const key = normalizeKey(clinic.name);
  const issuedList = calledNumbers[key] || [];
  clinic.issued = issuedList.length;

  if (clinic.issued >= clinic.limit) {
    alert("Hết số! Phòng khám đã đạt giới hạn.");
    return;
  }

  // ✅ Tiếp tục cấp
  clinic.issued++;
  const number = clinic.issued;
  const displayNumber = isPriority
    ? `A${number.toString().padStart(2, "0")}`
    : number;

  if (!Array.isArray(calledNumbers[key])) {
  calledNumbers[key] = [];
}
calledNumbers[key].push(displayNumber);

  saveClinics();
  saveCalledNumbers();
  renderPhatSo();
  handlePrint(clinic.name, displayNumber, isPriority);
}
window.issueNumber = issueNumber;

function formatIssuedNumberForDisplay(number) {
  if (typeof number === "string") return number;
  return String(number);
}

function isPriorityIssuedNumber(number) {
  return typeof number === "string" && number.toUpperCase().startsWith("A");
}

async function openIssuedHistory(clinicName) {
  await new Promise(resolve => loadCalledNumbers(resolve));

  const modal = document.getElementById("phatso-history-modal");
  const title = document.getElementById("phatso-history-title");
  const subtitle = document.getElementById("phatso-history-subtitle");
  const list = document.getElementById("phatso-history-list");
  if (!modal || !title || !subtitle || !list) return;

  const key = normalizeKey(clinicName);
  const issuedList = Array.isArray(calledNumbers[key]) ? [...calledNumbers[key]] : [];
  const latestFirst = issuedList.slice().reverse();

  title.textContent = `Lịch sử đã cấp - ${clinicName}`;
  subtitle.textContent = issuedList.length
    ? `Đã cấp ${issuedList.length} số. Bấm biểu tượng máy in để in lại.`
    : "Phòng này chưa có số đã cấp.";
  list.innerHTML = "";

  if (!latestFirst.length) {
    const empty = document.createElement("div");
    empty.className = "phatso-history-empty";
    empty.innerHTML = `<i class="fas fa-circle-info"></i><span>Chưa có số nào để in lại.</span>`;
    list.appendChild(empty);
  } else {
    latestFirst.forEach((number, index) => {
      const displayNumber = formatIssuedNumberForDisplay(number);
      const priority = isPriorityIssuedNumber(number);
      const row = document.createElement("div");
      row.className = "phatso-history-row";
      row.innerHTML = `
        <div class="phatso-history-num">
          <strong>${escapeHTML(displayNumber)}</strong>
          <span>${priority ? "Ưu tiên" : "Thường"}</span>
        </div>
        <div class="phatso-history-meta">
          <span>Lần cấp thứ ${issuedList.length - index}</span>
          <small>${escapeHTML(clinicName)}</small>
        </div>
        <button type="button" class="phatso-history-print-btn" title="In lại số ${escapeHTML(displayNumber)}">
          <i class="fas fa-print"></i> In lại
        </button>
      `;
      row.querySelector(".phatso-history-print-btn").addEventListener("click", () => {
        reprintIssuedTicket(clinicName, number);
      });
      list.appendChild(row);
    });
  }

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeIssuedHistory() {
  const modal = document.getElementById("phatso-history-modal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

function reprintIssuedTicket(clinicName, number) {
  handlePrint(clinicName, number, isPriorityIssuedNumber(number));
}

window.openIssuedHistory = openIssuedHistory;
window.closeIssuedHistory = closeIssuedHistory;
window.reprintIssuedTicket = reprintIssuedTicket;
function buildTicketPrintHTML({ clinicName, ticketType, ticketNumber, timeText, highlightHTML }) {
  const safeClinicName = escapeHTML(clinicName || "");
  const safeTicketType = escapeHTML(ticketType || "SỐ THỨ TỰ");
  const safeTicketNumber = escapeHTML(String(ticketNumber || "00"));
  const safeTimeText = escapeHTML(timeText || "").replace(/\n/g, "<br>");
  const content = highlightHTML || "<i>Không có nội dung dịch vụ nổi bật.</i>";

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <base href="${document.baseURI}">
  <title>Phiếu số ${safeTicketNumber}</title>
  <style>
    @page { size: A5 landscape; margin: 6mm; }
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: Arial, Tahoma, sans-serif;
      overflow: hidden;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ticket {
      width: 190mm;
      height: 126mm;
      max-width: 100%;
      max-height: 100%;
      border: 1.8px dashed #000;
      border-radius: 6px;
      padding: 8mm 9mm;
      display: grid;
      grid-template-columns: 37mm 1fr;
      gap: 8mm;
      background: #fff;
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .left {
      border-right: 1px dashed #d7d7d7;
      padding-right: 7mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      overflow: hidden;
    }
    .logo {
      width: 18mm;
      height: 18mm;
      object-fit: contain;
      margin: 0 0 7mm 0;
      filter: grayscale(100%);
    }
    .clinic {
      width: 100%;
      margin: 0 0 7mm 0;
      font-size: 15pt;
      line-height: 1.12;
      font-weight: 900;
      text-transform: uppercase;
      word-break: break-word;
    }
    .type {
      width: 100%;
      margin: 0 0 2mm 0;
      font-size: 15pt;
      line-height: 1.08;
      font-weight: 900;
      text-transform: uppercase;
    }
    .number {
      width: 100%;
      margin: 0 0 4mm 0;
      font-size: 48pt;
      line-height: .96;
      font-weight: 900;
      letter-spacing: 0;
    }
    .time {
      margin: 0 0 2mm 0;
      font-size: 9.5pt;
      line-height: 1.2;
      font-weight: 500;
    }
    .wait {
      margin: 0;
      font-size: 8.5pt;
      line-height: 1.15;
      font-style: italic;
      font-weight: 500;
    }
    .right {
      min-width: 0;
      text-align: left;
      overflow: hidden;
    }
    .right h3 {
      margin: 0 0 6mm 0;
      font-size: 21pt;
      line-height: 1.02;
      font-weight: 900;
    }
    .highlight {
      max-height: 92mm;
      overflow: hidden;
      font-size: 10.5pt;
      line-height: 1.28;
    }
    .highlight p,
    .highlight div,
    .highlight li {
      margin-top: 0;
      margin-bottom: 3mm;
    }
    .highlight ul,
    .highlight ol {
      margin: 0 0 0 5mm;
      padding: 0;
    }
  </style>
</head>
<body>
  <section class="ticket">
    <div class="left">
      <img class="logo" src="logott.png" alt="Logo">
      <div class="clinic">${safeClinicName}</div>
      <div class="type">${safeTicketType}</div>
      <div class="number">${safeTicketNumber}</div>
      <div class="time">${safeTimeText}</div>
      <div class="wait">Xin vui lòng<br>chờ đến<br>lượt khám<br>bệnh!</div>
    </div>
    <div class="right">
      <h3>Dịch vụ nổi bật</h3>
      <div class="highlight">${content}</div>
    </div>
  </section>
</body>
</html>`;
}

function printTicketOnce(printHTML) {
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "In phiếu số khám bệnh");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  document.body.appendChild(frame);

  let hasPrinted = false;
  let hasCleaned = false;

  const cleanup = () => {
    if (hasCleaned) return;
    hasCleaned = true;
    setTimeout(() => frame.remove(), 500);
  };

  const runPrint = () => {
    if (hasPrinted) return;
    hasPrinted = true;
    try {
      frame.contentWindow.focus();
      frame.contentWindow.onafterprint = cleanup;
      frame.contentWindow.print();
      setTimeout(cleanup, 15000);
    } catch (error) {
      cleanup();
      alert("Không mở được hộp thoại in. Vui lòng kiểm tra trình duyệt/máy in.");
      console.error("Lỗi in phiếu:", error);
    }
  };

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(printHTML);
  doc.close();

  frame.onload = () => setTimeout(runPrint, 250);
  // Dự phòng nếu sự kiện load của iframe không bắn trong một số trình duyệt.
  setTimeout(runPrint, 800);
}

function handlePrint(clinicName, number, isPriority = false) {
  const now = new Date();
  const ticketType = isPriority ? "SỐ ƯU TIÊN" : "SỐ THỨ TỰ";
  const displayNumber = typeof number === "string"
    ? number
    : number.toString().padStart(2, "0");
  const timeText = `${now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}\n${now.toLocaleDateString("vi-VN")}`;

  const printWithHighlight = (highlightHTML) => {
    const html = buildTicketPrintHTML({
      clinicName,
      ticketType,
      ticketNumber: displayNumber,
      timeText,
      highlightHTML: highlightHTML || "<i>Không có nội dung dịch vụ nổi bật.</i>"
    });
    printTicketOnce(html);
  };

  // Tải nội dung dịch vụ nổi bật từ Firebase; nếu lỗi mạng/quyền đọc thì vẫn in phiếu bình thường.
  firebase.database().ref("highlightHTML").once("value")
    .then(snapshot => printWithHighlight(snapshot.val()))
    .catch(error => {
      console.warn("Không tải được highlightHTML, vẫn tiếp tục in vé:", error);
      printWithHighlight(null);
    });
}

async function callNextNumbers(count) {
    await new Promise(resolve => loadCalledNumbers(resolve));
    await new Promise(resolve => loadCalledHistory(resolve));
    const clinicName = selectedClinic;
    const key = normalizeKey(clinicName); // ✅ key cho dữ liệu
    const clinicAudioCandidates = getClinicAudioCandidates(clinicName); // ✅ các đường dẫn âm thanh phòng khám

    const clinic = clinics.find(c => c.name === clinicName);
    if (!clinic) {
        alert("Phòng khám không tồn tại!");
        return;
    }

    const queue = [...calledNumbers[key] || []];
    const history = new Set(calledHistory[key] || []);

    let toCall = queue.filter(n => !history.has(n));

    toCall.sort((a, b) => {
        const aIsPriority = typeof a === "string" && a.startsWith("A");
        const bIsPriority = typeof b === "string" && b.startsWith("A");

        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;

        const aNum = parseInt(typeof a === "string" ? a.replace("A", "") : a);
        const bNum = parseInt(typeof b === "string" ? b.replace("A", "") : b);
        return aNum - bNum;
    });

    if (toCall.length === 0) {
        alert("Không có số mới để gọi!");
        return;
    }

    document.getElementById("called-section").style.display = "none";

    for (let i = 0; i < count && i < toCall.length; i++) {
        const number = toCall[i];
        const isPriority = typeof number === "string" && number.startsWith("A");
        const numOnly = isPriority
            ? number.slice(1).toString().padStart(2, "0")
            : number.toString().padStart(2, "0");

        const numberAudioCandidates = getNumberAudioCandidates(numOnly);

        const files = isPriority
            ? ["audio/uu-tien.mp3", "audio/a.mp3", numberAudioCandidates, clinicAudioCandidates]
            : ["audio/moi-so.mp3", numberAudioCandidates, clinicAudioCandidates];

        enqueueAudioSequence(files);
        history.add(number);
    }

    calledHistory[key] = Array.from(history);
    saveCalledHistory();
    updateCalledList();
}

function confirmClinic() {
    selectedClinic = document.getElementById("clinic-select").value;

    const nameText = document.getElementById("clinic-name-text");
    const nameDisplay = document.getElementById("clinic-name-display");

    if (!selectedClinic) {
        alert("Vui lòng chọn phòng khám!");
        return;
    }

    if (nameText) nameText.innerText = selectedClinic;
    if (nameDisplay) nameDisplay.innerText = selectedClinic;
    if (nameDisplay) nameDisplay.style.display = "block";

    const selectContainer = document.getElementById("clinic-select-container");
    const actionContainer = document.getElementById("phongkham-action");
    const topButtons = document.getElementById("top-right-buttons");
    const heading = document.getElementById("main-heading");
    const statsBox = document.getElementById("phongkham-stats");

    if (selectContainer) selectContainer.style.display = "none";
    if (actionContainer) actionContainer.style.display = "block";
    if (topButtons) topButtons.style.display = "block";
    if (heading) heading.style.display = "none";
    if (statsBox) statsBox.style.display = "flex";

    localStorage.setItem("selectedClinic", selectedClinic);
    warmupAudioFilesForClinic(selectedClinic);
    loadClinics(() => {
        loadCalledNumbers(() => {
            loadCalledHistory(() => {
                updateCalledList(); // đảm bảo load lại đúng dữ liệu sau reset
                warmupAudioFilesForClinic(selectedClinic);
            });
        });
    });
}


function enqueueAudioSequence(files) {
    audioQueue.push(files);
    playAudioQueue();
}

// ===== TỐI ƯU ÂM THANH KHI CHẠY TRÊN WEB - BẢN LOW LATENCY =====
// Không tăng tốc giọng đọc. Mục tiêu là giảm độ trễ giữa các đoạn: “Mời số” + “số” + “phòng khám”.
// Điểm sửa chính:
// 1) Không preload hàng trăm file số cùng lúc trên Vercel, vì việc đó làm nghẽn request và tạo cảm giác chậm.
// 2) Khi gọi, tải song song đúng các file cần phát.
// 3) Dùng Web Audio cắt khoảng lặng đầu/cuối theo biên độ thực tế rồi phát nối sát nhau.
const AUDIO_WEB_ENGINE_ENABLED = window.location.protocol !== "file:" && !!(window.AudioContext || window.webkitAudioContext);
const AUDIO_SEQUENCE_START_DELAY = 0.025;   // chờ cực ngắn để tránh hụt âm đầu
const AUDIO_SILENCE_THRESHOLD = 0.004;      // ngưỡng nhận diện khoảng im lặng trong file
const AUDIO_TRIM_KEEP_START = 0.015;        // giữ lại một chút đầu file để không cắt mất phụ âm
const AUDIO_TRIM_KEEP_END = 0.025;          // giữ lại một chút cuối file cho tự nhiên
const AUDIO_JOIN_GAP_SECONDS = 0.00;        // 0 = nối sát; có thể đổi 0.03 nếu muốn nghỉ rõ hơn
const AUDIO_FALLBACK_GAP_MS = 0;            // fallback HTML Audio không thêm khoảng nghỉ nhân tạo
const audioBufferCache = new Map();
const audioBufferPromiseCache = new Map();
const audioTrimCache = new WeakMap();
let callAudioContext = null;
let audioWarmupStarted = false;

function getCallAudioContext() {
    if (!AUDIO_WEB_ENGINE_ENABLED) return null;
    if (!callAudioContext) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        callAudioContext = new Ctx();
    }
    return callAudioContext;
}

function flattenAudioItems(items) {
    const out = [];
    items.forEach(item => {
        if (Array.isArray(item)) {
            item.forEach(x => out.push(x));
        } else if (item) {
            out.push(item);
        }
    });
    return [...new Set(out)];
}

function getNumberAudioCandidates(number) {
    const raw = typeof number === "string" ? number.replace(/^A/i, "") : String(number);
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return [];

    const padded = String(n).padStart(2, "0");
    return [...new Set([
        `audio/so-${padded}.mp3`,
        `audio/so-${n}.mp3`
    ])];
}

async function loadAudioBuffer(file) {
    const ctx = getCallAudioContext();
    if (!ctx) throw new Error("Web Audio không khả dụng");

    if (audioBufferCache.has(file)) return audioBufferCache.get(file);
    if (audioBufferPromiseCache.has(file)) return audioBufferPromiseCache.get(file);

    const promise = fetch(file, { cache: "default" })
        .then(response => {
            if (!response.ok) throw new Error(`Không tải được ${file}`);
            return response.arrayBuffer();
        })
        .then(arrayBuffer => ctx.decodeAudioData(arrayBuffer))
        .then(buffer => {
            audioBufferCache.set(file, buffer);
            audioBufferPromiseCache.delete(file);
            return buffer;
        })
        .catch(error => {
            audioBufferPromiseCache.delete(file);
            throw error;
        });

    audioBufferPromiseCache.set(file, promise);
    return promise;
}

function getTrimPoints(buffer) {
    if (audioTrimCache.has(buffer)) return audioTrimCache.get(buffer);

    const sampleRate = buffer.sampleRate || 44100;
    const length = buffer.length || 0;
    let first = 0;
    let last = length - 1;

    const isAudibleAt = (index) => {
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const data = buffer.getChannelData(ch);
            if (Math.abs(data[index] || 0) >= AUDIO_SILENCE_THRESHOLD) return true;
        }
        return false;
    };

    while (first < length && !isAudibleAt(first)) first++;
    while (last > first && !isAudibleAt(last)) last--;

    if (first >= length || last <= first) {
        const fallback = { offset: 0, duration: Math.max(0.05, buffer.duration || 0.05) };
        audioTrimCache.set(buffer, fallback);
        return fallback;
    }

    first = Math.max(0, first - Math.floor(AUDIO_TRIM_KEEP_START * sampleRate));
    last = Math.min(length - 1, last + Math.floor(AUDIO_TRIM_KEEP_END * sampleRate));

    const offset = first / sampleRate;
    const duration = Math.max(0.08, (last - first + 1) / sampleRate);
    const result = { offset, duration };
    audioTrimCache.set(buffer, result);
    return result;
}

async function resolveAudioItem(item) {
    const candidates = Array.isArray(item) ? item : [item];
    for (const file of candidates) {
        try {
            const buffer = await loadAudioBuffer(file);
            return { file, buffer };
        } catch (error) {
            // Thử candidate kế tiếp, ví dụ file không dấu rồi tới file có dấu.
        }
    }
    console.warn("Không phát được file âm thanh:", candidates);
    return null;
}

async function playAudioSequenceWithWebAudio(files) {
    const ctx = getCallAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") await ctx.resume();

    // Tải song song các đoạn cần gọi. Trên Vercel, đây là phần giảm trễ rõ nhất.
    const resolvedItems = (await Promise.all(files.map(item => resolveAudioItem(item)))).filter(Boolean);

    if (resolvedItems.length === 0) return false;

    let cursor = ctx.currentTime + AUDIO_SEQUENCE_START_DELAY;
    const sources = [];

    resolvedItems.forEach(({ buffer }) => {
        const trim = getTrimPoints(buffer);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = CALL_AUDIO_SPEED; // giữ 1.0, không làm giọng đọc nhanh hơn
        source.connect(ctx.destination);
        source.start(cursor, trim.offset, trim.duration);
        sources.push(source);
        cursor += (trim.duration / CALL_AUDIO_SPEED) + AUDIO_JOIN_GAP_SECONDS;
    });

    await new Promise(resolve => {
        const waitMs = Math.max(100, (cursor - ctx.currentTime) * 1000 + 50);
        setTimeout(resolve, waitMs);
    });

    return true;
}

function getNextNumbersForPreload(clinicName, maxCount = 8) {
    const key = normalizeKey(clinicName || selectedClinic || "");
    if (!key) return [];

    const issuedList = calledNumbers[key] || [];
    const historySet = new Set(calledHistory[key] || []);
    const waiting = issuedList.filter(n => !historySet.has(n));

    waiting.sort((a, b) => {
        const aIsPriority = typeof a === "string" && a.startsWith("A");
        const bIsPriority = typeof b === "string" && b.startsWith("A");
        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;
        const aNum = parseInt(typeof a === "string" ? a.replace("A", "") : a, 10);
        const bNum = parseInt(typeof b === "string" ? b.replace("A", "") : b, 10);
        return aNum - bNum;
    });

    return waiting.slice(0, maxCount);
}

function warmupAudioFilesForClinic(clinicName) {
    if (!AUDIO_WEB_ENGINE_ENABLED) return;

    const files = flattenAudioItems([
        "audio/moi-so.mp3",
        "audio/uu-tien.mp3",
        "audio/a.mp3",
        clinicName ? getClinicAudioCandidates(clinicName) : [],
        ...getNextNumbersForPreload(clinicName, 8).map(n => getNumberAudioCandidates(n))
    ]);

    // Chỉ preload các file có khả năng dùng ngay, tránh bắn hàng trăm request MP3 lên Vercel.
    files.forEach(file => loadAudioBuffer(file).catch(() => {}));
}

function warmupAudioFilesOnce() {
    if (audioWarmupStarted) return;
    audioWarmupStarted = true;
    setTimeout(() => warmupAudioFilesForClinic(selectedClinic), 300);
}

async function playAudioQueue() {
    if (isPlayingAudio || audioQueue.length === 0) return;

    isPlayingAudio = true;
    const files = audioQueue.shift();

    let playedByWebAudio = false;
    try {
        playedByWebAudio = await playAudioSequenceWithWebAudio(files);
    } catch (error) {
        console.warn("Web Audio lỗi, chuyển sang phát HTML Audio:", error);
    }

    if (!playedByWebAudio) {
        for (let i = 0; i < files.length; i++) {
            await playAudioItem(files[i]);
        }
    }

    isPlayingAudio = false;
    document.getElementById("called-section").style.display = "block";
    playAudioQueue(); // Gọi tiếp chuỗi tiếp theo nếu còn
}

function playSingleAudioFile(file) {
    return new Promise(resolve => {
        const audio = new Audio(file);
        let done = false;

        // Giữ giọng đọc tốc độ bình thường; chỉ preload để chuyển đoạn mượt hơn.
        audio.preload = "auto";
        audio.defaultPlaybackRate = CALL_AUDIO_SPEED;
        audio.playbackRate = CALL_AUDIO_SPEED;
        audio.preservesPitch = true;
        audio.mozPreservesPitch = true;
        audio.webkitPreservesPitch = true;

        const finish = () => {
            if (done) return;
            done = true;
            resolve(true);
        };

        const fail = () => {
            if (done) return;
            done = true;
            resolve(false);
        };

        audio.onended = finish;
        audio.onerror = fail;

        audio.onloadedmetadata = () => {
            // Timeout dự phòng nếu browser không bắn sự kiện ended; không tạo khoảng nghỉ nhân tạo.
            const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 2;
            setTimeout(finish, Math.max(350, duration * 1000 + 60));
        };

        audio.load();
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(fail);
        }
    });
}

async function playAudioItem(item) {
    const candidates = Array.isArray(item) ? item : [item];

    for (const file of candidates) {
        const ok = await playSingleAudioFile(file);
        if (ok) return;
    }

    console.warn("Không phát được file âm thanh:", candidates);
}

function updateCalledList() {
    const select = document.getElementById("called-select");
    const section = document.getElementById("called-section");
    const statsBox = document.getElementById("phongkham-stats");

    const key = normalizeKey(selectedClinic);
    const issuedList = calledNumbers[key] || [];
    const historyList = calledHistory[key] || [];

    const totalIssued = issuedList.length;
    const remaining = Math.max(0, totalIssued - historyList.length);
    const lastCalled = historyList.length > 0 ? historyList[historyList.length - 1] : "-";

    statsBox.style.display = "flex";

    // Show dropdown nếu có số đã gọi
    if (historyList.length > 0) {
        section.style.display = "block";
        select.innerHTML = `<option value="">-- Chọn số đã gọi --</option>` +
            historyList.map(n => `<option value="${n}">Số ${n}</option>`).join("");
    } else {
        section.style.display = "none";
        select.innerHTML = `<option value="">-- Chọn số đã gọi --</option>`;
    }

    document.getElementById("total-issued").innerText = totalIssued;
    document.getElementById("remaining").innerText = remaining;
    document.getElementById("last-called").innerText = lastCalled;
    document.getElementById("called-select").onchange = function() {
    const value = this.value;
    if (value) recallNumber(value);
    this.selectedIndex = 0; // Quay lại trạng thái "-- Chọn số đã gọi --"
};
}
  

window.onload = function () {
    const user = JSON.parse(localStorage.getItem("currentUser"));
    warmupAudioFilesOnce();

    // Nếu chưa đăng nhập thì chỉ render select
    if (!user) {
        loadClinics(() => {
            renderClinicSelect();
        });
        return;
    }

    // Nếu là ADMIN – được phép cập nhật và lưu clinics
    if (user.role === "admin") {
        loadClinics(() => {
            // ⏱️ Ghi lại thời gian cập nhật ban đầu
    firebase.database().ref("lastClinicUpdate").once("value").then(snapshot => {
        localStorage.setItem("lastClinicUpdate", snapshot.val() || Date.now());
    });
            loadCalledNumbers(() => {
                loadCalledHistory(() => {
                    renderClinicSelect();
                    showDashboard(user);
                });
            });
        });
    } else {
        // Nếu là PHÁT SỐ hoặc PHÒNG KHÁM – chỉ đọc dữ liệu
        loadClinics(() => {
            firebase.database().ref("lastClinicUpdate").once("value").then(snapshot => {
        localStorage.setItem("lastClinicUpdate", snapshot.val() || Date.now());
    });
            loadCalledNumbers(() => {
                loadCalledHistory(() => {
                    renderClinicSelect();
                    showDashboard(user);
                });
            });
        });

        // 🔄 Tự động đồng bộ dữ liệu clinic mỗi 3 phút
        setInterval(() => {
            loadClinics(); // chỉ đọc lại clinic, không ảnh hưởng issued
        }, 180000); // 3 phút
    }

    // 🔁 Cập nhật số đã gọi riêng cho tài khoản phòng khám
    setInterval(() => {
        const user = JSON.parse(localStorage.getItem("currentUser"));
        if (user && user.role === "phongkham") {
            loadCalledNumbers(() => {
                loadCalledHistory(() => {
                    updateCalledList();
                });
            });
        }
    }, 300000); // mỗi 5 phút
    if (user.role === "phatso") {
    setInterval(() => {
        firebase.database().ref("lastClinicUpdate").once("value").then(snapshot => {
            const newTimestamp = snapshot.val();
            const oldTimestamp = localStorage.getItem("lastClinicUpdate") || 0;
            if (newTimestamp > oldTimestamp) {
                localStorage.setItem("lastClinicUpdate", newTimestamp);
                addPhatSoNotification("Dữ liệu vừa cập nhật", "Danh sách phòng khám hoặc giới hạn lượt khám đã được đồng bộ lại.", "sync");
                loadClinics(renderPhatSo); // 🔁 tự động reload bảng phát số
            }
        });
    }, 100000); // kiểm tra mỗi 100 giây
}
};
let popupTimeout;

function showPopupUpdate(message) {
  const popup = document.getElementById("popup-update");
  const msgDiv = document.getElementById("popup-message");

  msgDiv.innerHTML = message;
  popup.classList.add("show");

  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(() => {
    hidePopupUpdate();
  }, 10000);
}

function hidePopupUpdate() {
  const popup = document.getElementById("popup-update");
  popup.classList.remove("show");
  clearTimeout(popupTimeout);
  // 🌀 Reload lại trang sau khi popup bị tắt (dù tự động hay nhấn OK)
  location.reload();
}


function recallNumber(number) {
    const clinicAudioCandidates = getClinicAudioCandidates(selectedClinic);
    const isPriority = typeof number === "string" && number.startsWith("A");
    const numOnly = isPriority ? number.slice(1) : number;

    const numberAudioCandidates = getNumberAudioCandidates(numOnly);

    const files = isPriority
      ? ["audio/uu-tien.mp3", "audio/a.mp3", numberAudioCandidates, clinicAudioCandidates]
      : ["audio/moi-so.mp3", numberAudioCandidates, clinicAudioCandidates];

    enqueueAudioSequence(files);
}
window.issueNumber = issueNumber;
    function switchClinic() {
    // Ẩn giao diện gọi bệnh nhân
    document.getElementById("phongkham-action").style.display = "none";
  
    // Hiện lại khối chọn phòng
    document.getElementById("clinic-select-container").style.display = "block";
  
    // Ẩn nút Đổi phòng khám + Đăng xuất
    document.getElementById("top-right-buttons").style.display = "none";
  
    // Đổi lại tiêu đề và hiện lại
    document.getElementById("main-heading").innerText = "VUI LÒNG THIẾT LẬP PHÒNG KHÁM!";
    document.getElementById("main-heading").style.display = "block";
  
    // Ẩn tên phòng khám ở tiêu đề
    document.getElementById("clinic-name-display").style.display = "none";
  
    // Xoá lựa chọn phòng khám đã lưu
    localStorage.removeItem("selectedClinic");
    }
  function loadHighlight() {
    const saved = localStorage.getItem("highlightHTML");
    if (saved) {
        document.getElementById("highlight-service").innerHTML = saved;
    }
  }
  
   function showClinicSelect() {
    document.getElementById("clinic-select-container").style.display = "block";
    document.getElementById("phongkham-action").style.display = "none";
    document.getElementById("top-right-buttons").style.display = "none";
    document.getElementById("main-heading").innerText = "VUI LÒNG THIẾT LẬP PHÒNG KHÁM!";
    document.getElementById("main-heading").style.display = "block";
    document.getElementById("clinic-name-display").style.display = "none";
  }
  function renderClinicSelect() {
    const select = document.getElementById("clinic-select");
    select.innerHTML = '<option value="">-- Chọn phòng khám --</option>';
    clinics.forEach(clinic => {
      const option = document.createElement("option");
      option.value = clinic.name;
      option.textContent = clinic.name;
      select.appendChild(option);
    });
  }
  function saveHighlight() {
  const content = quill.root.innerHTML.trim();
  if (!content) {
    alert("Nội dung không được để trống!");
    return;
  }

  localStorage.setItem("highlightHTML", content);
  document.getElementById("highlight-service").innerHTML = content;

  // 💾 Lưu lên Firebase
  firebase.database().ref("highlightHTML").set(content);

  alert("Đã lưu nội dung dịch vụ nổi bật!");
}
window.issueNumber = issueNumber;
function autoSyncClinicsForNonAdmin() {
    setInterval(() => {
        const user = JSON.parse(localStorage.getItem("currentUser"));
        if (user && user.role !== "admin") {
            loadClinics();
        }
    }, 180000); // 3 phút
}