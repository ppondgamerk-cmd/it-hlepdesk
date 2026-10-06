// --- App State ---
let tickets = [];
let currentUser = {
    role: "guest", // guest, user, staff
    name: ""
};
let activeFilter = "all";
let activeTicketId = null;
let dashboardChartInstance = null;

// Session identity always comes from the server.
const isStaff = () => ['staff', 'admin'].includes(currentUser.role);
async function api(url, options = {}) {
    const response = await fetch(url, { ...options, credentials: 'same-origin' });
    if (response.status === 401 && !url.endsWith('/login') && !url.endsWith('/me')) {
        location.replace('login.html');
        throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }
    return response;
}
async function initData() {
    const response = await api('/api/tickets');
    if (!response.ok) throw new Error((await response.json()).error || 'โหลดข้อมูลไม่สำเร็จ');
    tickets = await response.json();
}
async function checkSessionAndRoute() {
    localStorage.removeItem('it_helpdesk_session');
    const pageName = location.pathname.split('/').pop() || 'login.html';
    const response = await api('/api/auth/me');
    if (response.status === 401) {
        if (pageName !== 'login.html') location.replace('login.html');
        return pageName === 'login.html';
    }
    if (!response.ok) throw new Error('ตรวจสอบบัญชีไม่สำเร็จ กรุณาลองใหม่');
    currentUser = await response.json();
    if (pageName === 'login.html') {
        location.replace(isStaff() ? 'dashboard.html' : 'report.html');
        return false;
    }
    if ((['dashboard.html', 'history.html'].includes(pageName) && !isStaff()) || (pageName === 'users.html' && currentUser.role !== 'admin')) {
        location.replace('tickets.html');
        return false;
    }
    applyUserRoleLayout(pageName);
    return true;
}
async function logout() {
    try {
        const response = await api('/api/auth/logout', { method: 'POST' });
        if (!response.ok) throw new Error('ออกจากระบบไม่สำเร็จ');
        location.replace('login.html');
    } catch (error) { notify(error.message, 'error'); }
}
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    if (document.getElementById('auth-login-form')) loadDemoAccounts();
    try {
        if (!await checkSessionAndRoute()) return;
        if (currentUser.role === 'guest') return;
        if (document.getElementById('users-list')) await renderUsers();
        else { await initData(); autoRenderPageData(); }
        document.body.classList.add('ready');
        const message = sessionStorage.getItem('helpdesk_notice');
        if (message) { sessionStorage.removeItem('helpdesk_notice'); notify(message); }
    } catch (error) {
        document.body.classList.add('ready');
        notify(error.message, 'error');
        const main = document.querySelector('main');
        if (main && !document.getElementById('auth-login-form')) {
            const retry = document.createElement('button');
            retry.className = 'btn-secondary'; retry.textContent = 'ลองโหลดใหม่';
            retry.onclick = () => location.reload(); main.prepend(retry);
        }
    }
});

function applyUserRoleLayout(pageName) {
    const profileNameEl = document.getElementById("profile-name");
    const roleBadgeEl = document.getElementById("profile-role");

    if (profileNameEl) profileNameEl.textContent = currentUser.name;

    if (roleBadgeEl) {
        if (isStaff()) {
            roleBadgeEl.textContent = currentUser.role === "admin" ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่ IT";
            roleBadgeEl.className = "role-badge staff";
        } else {
            roleBadgeEl.textContent = "User / ผู้แจ้ง";
            roleBadgeEl.className = "role-badge user";
        }
    }

    // Toggle navigation links visibility depending on role
    const userNavItems = document.querySelectorAll(".user-only");
    const staffNavItems = document.querySelectorAll(".staff-only");

    if (isStaff()) {
        userNavItems.forEach(el => el.style.display = "none");
        staffNavItems.forEach(el => el.style.display = "flex");
    } else {
        userNavItems.forEach(el => el.style.display = "flex");
        staffNavItems.forEach(el => el.style.display = "none");
    }

    const nav = document.querySelector('.nav-links');
    if (nav && currentUser.role === 'admin') {
        const link = document.createElement('a');
        link.href = 'users.html'; link.className = 'nav-item'; link.textContent = 'จัดการผู้ใช้'; nav.appendChild(link);
    }
    const profile = document.querySelector('.user-profile');
    if (profile) {
        const button = document.createElement('button');
        button.className = 'logout-btn'; button.textContent = 'เปลี่ยนรหัสผ่าน'; button.onclick = openPasswordDialog;
        profile.appendChild(button);
    }
    if (profile && !profile.querySelector('.recovery-button')) {
        const button = document.createElement('button');
        button.className = 'logout-btn recovery-button'; button.textContent = 'รหัสกู้คืน';
        button.onclick = () => openAccountDialog('recovery'); profile.appendChild(button);
    }
    // Highlight active nav item
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
        const href = item.getAttribute("href");
        if (href && pageName.includes(href)) {
            item.classList.add("active");
        }
    });
}

// --- Auto Render Data based on loaded Page ---
function autoRenderPageData() {
    // If we have dashboard counters
    if (document.getElementById("dashboard-total")) {
        renderDashboard();
    }
    // If we have tickets table
    if (document.getElementById("tickets-tbody")) {
        renderTickets();
    }
    // If we have history log container
    if (document.getElementById("history-list-container")) {
        renderHistory();
    }
    // If we are on report.html and currentUser is user, auto-fill name
    if (document.getElementById("report-form")) {
        const reporterField = document.getElementById("reporter-name");
        if (reporterField) {
            reporterField.value = currentUser.name;
            reporterField.readOnly = true; // Block editing for logged in user name
            reporterField.style.opacity = "0.7";
        }
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Login form submission
    const loginForm = document.getElementById("auth-login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            handleFormLogin();
        });
    }

    // Report form submission
    const reportForm = document.getElementById("report-form");
    if (reportForm) {
        reportForm.addEventListener("submit", (e) => {
            e.preventDefault();
            runBusy(reportForm, submitTicket);
        });
    }

    document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (activeTicketId) closeModal(); document.getElementById('password-dialog')?.remove(); } });
    // Modal Close buttons
    document.querySelectorAll(".modal-close, .modal-cancel").forEach(btn => {
        btn.addEventListener("click", closeModal);
    });

    // Close modal on overlay click
    const modalOverlay = document.getElementById("ticket-modal");
    if (modalOverlay) {
        modalOverlay.addEventListener("click", (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }

    // Ticket Save Update form (IT staff)
    const updateForm = document.getElementById("ticket-update-form");
    if (updateForm) {
        updateForm.addEventListener("submit", (e) => {
            e.preventDefault();
            runBusy(updateForm, saveTicketUpdate);
        });
    }

    // Live search input
    const searchInput = document.getElementById("search-tickets");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            renderTickets();
        });
    }

    // Export CSV button
    const exportCsvBtn = document.getElementById("btn-export-csv");
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener("click", exportTicketsToCSV);
    }
}

// --- Dashboard Logic ---
function renderDashboard() {
    const totalCount = tickets.length;
    const pendingCount = tickets.filter(t => t.status === "รอดำเนินการ").length;
    const inProgressCount = tickets.filter(t => t.status === "กำลังแก้ไข").length;
    const resolvedCount = tickets.filter(t => t.status === "แก้ไขแล้ว").length;

    document.getElementById("dashboard-total").textContent = totalCount;
    document.getElementById("dashboard-pending").textContent = pendingCount;
    document.getElementById("dashboard-inprogress").textContent = inProgressCount;
    document.getElementById("dashboard-resolved").textContent = resolvedCount;

    renderLatestTickets();
    drawDashboardChart(pendingCount, inProgressCount, resolvedCount);
}

function drawDashboardChart(pending, inProgress, resolved) {
    const ctx = document.getElementById('ticketsChart');
    if (!ctx || typeof Chart === 'undefined') return;

    if (dashboardChartInstance) {
        dashboardChartInstance.destroy();
    }

    dashboardChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['รอดำเนินการ', 'กำลังแก้ไข', 'แก้ไขแล้ว'],
            datasets: [{
                data: [pending, inProgress, resolved],
                backgroundColor: [
                    '#f59e0b', // Amber
                    '#3b82f6', // Blue
                    '#10b981'  // Emerald
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9ca3af',
                        boxWidth: 12,
                        font: {
                            family: 'Kanit',
                            size: 11
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

function renderLatestTickets() {
    const listContainer = document.getElementById("dashboard-latest-list");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    // Sort tickets descending by creation date, filter out resolved, take top 5
    const latestTickets = [...tickets]
        .filter(t => t.status !== "แก้ไขแล้ว")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

    if (latestTickets.length === 0) {
        listContainer.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-inbox"></i><p>ไม่มีรายการ Ticket ล่าสุด</p></td></tr>`;
        return;
    }

    latestTickets.forEach(ticket => {
        const tr = document.createElement("tr");
        tr.onclick = () => openTicketDetails(ticket.id);
        tr.tabIndex = 0;
        tr.setAttribute('aria-label', 'ดูรายละเอียด ' + ticket.id + ' ' + ticket.title);
        tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTicketDetails(ticket.id); } };

        let urgencyBadge = getUrgencyBadge(ticket.urgency);
        let statusBadge = getStatusBadge(ticket.status);

        tr.innerHTML = `
            <td><strong style="color: #6366f1;">${escapeHTML(ticket.id)}</strong></td>
            <td>${escapeHTML(ticket.title)}</td>
            <td>${urgencyBadge}</td>
            <td>${statusBadge}</td>
            <td>${formatDate(ticket.createdAt)}</td>
        `;
        listContainer.appendChild(tr);
    });
}

// --- Ticket Management Logic ---
async function submitTicket() {
    const titleInput = document.getElementById("issue-title");
    const reporterInput = document.getElementById("reporter-name");
    const deptInput = document.getElementById("reporter-dept");
    const equipInput = document.getElementById("equip-code");
    const urgencyInput = document.getElementById("issue-urgency");
    const detailsInput = document.getElementById("issue-details");
    const imageInput = document.getElementById("issue-image");

    let base64Image = "";
    if (imageInput && imageInput.files && imageInput.files[0]) {
        const file = imageInput.files[0];
        if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
            notify('กรุณาแนบภาพ PNG, JPEG, WebP หรือ GIF', 'error'); return;
        }
        if (file.size > 2 * 1024 * 1024) {
            notify("ขนาดรูปภาพแนบใหญ่เกิน 2MB กรุณาอัปโหลดรูปที่มีขนาดเล็กกว่านี้");
            return;
        }

        base64Image = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('อ่านไฟล์ภาพไม่สำเร็จ'));
            reader.readAsDataURL(file);
        });
    }

    const payload = {
        title: titleInput.value.trim(),
        reporter: reporterInput.value.trim(),
        department: deptInput.value.trim(),
        equipment: equipInput.value.trim(),
        details: detailsInput.value.trim(),
        urgency: urgencyInput.value,
        image: base64Image
    };

    try {
        const response = await api('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const newTicket = await response.json();
            sessionStorage.setItem('helpdesk_notice', `แจ้งปัญหาสำเร็จ รหัสคำขอ: ${newTicket.id}`);
            window.location.href = "tickets.html";
        } else {
            const errData = await response.json();
            notify(`เกิดข้อผิดพลาด: ${errData.error || 'ไม่สามารถส่งรายงานได้'}`);
        }
    } catch (err) {
        console.error('Connection error:', err);
        notify('ไม่สามารถติดต่อเซิร์ฟเวอร์หลังบ้านได้');
    }
}

function setFilter(filterValue) {
    activeFilter = filterValue;
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.classList.remove("active");
        if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(`'${filterValue}'`)) {
            btn.classList.add("active");
        }
    });
    renderTickets();
}

function renderTickets() {
    const tbody = document.getElementById("tickets-tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    const queryEl = document.getElementById("search-tickets");
    const query = queryEl ? queryEl.value.toLowerCase().trim() : "";

    let filtered = tickets;

    // Role restrictions: standard users only see tickets they reported
    if (currentUser.role === "user") {
        filtered = filtered.filter(t => t.reporterUsername === currentUser.username);
    }

    // Status filter
    if (activeFilter !== "all") {
        if (activeFilter === "pending") {
            filtered = filtered.filter(t => t.status === "รอดำเนินการ");
        } else if (activeFilter === "inprogress") {
            filtered = filtered.filter(t => t.status === "กำลังแก้ไข");
        } else if (activeFilter === "resolved") {
            filtered = filtered.filter(t => t.status === "แก้ไขแล้ว");
        }
    }

    // Search query filter
    if (query) {
        filtered = filtered.filter(t =>
            t.id.toLowerCase().includes(query) ||
            t.title.toLowerCase().includes(query) ||
            t.details.toLowerCase().includes(query) ||
            t.reporter.toLowerCase().includes(query) ||
            t.equipment.toLowerCase().includes(query)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-search"></i><p>ไม่พบรายการที่ต้องการค้นหา</p></td></tr>`;
        return;
    }

    // Sort: Pending/Inprogress first, then urgency (High -> Low)
    const sorted = [...filtered].sort((a, b) => {
        if (a.status === "แก้ไขแล้ว" && b.status !== "แก้ไขแล้ว") return 1;
        if (a.status !== "แก้ไขแล้ว" && b.status === "แก้ไขแล้ว") return -1;

        const urgencyWeight = { "สูง": 3, "กลาง": 2, "ต่ำ": 1 };
        const weightA = urgencyWeight[a.urgency] || 0;
        const weightB = urgencyWeight[b.urgency] || 0;

        if (weightB !== weightA) {
            return weightB - weightA;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    sorted.forEach(ticket => {
        const tr = document.createElement("tr");
        tr.onclick = () => openTicketDetails(ticket.id);
        tr.tabIndex = 0;
        tr.setAttribute('aria-label', 'ดูรายละเอียด ' + ticket.id + ' ' + ticket.title);
        tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTicketDetails(ticket.id); } };

        let urgencyBadge = getUrgencyBadge(ticket.urgency);
        let statusBadge = getStatusBadge(ticket.status);

        tr.innerHTML = `
            <td><strong style="color: #6366f1;">${ticket.id}</strong></td>
            <td>${escapeHTML(ticket.title)}</td>
            <td>${escapeHTML(ticket.reporter)} <br><small style="color: var(--text-muted); font-size: 0.75rem;">${escapeHTML(ticket.department)}</small></td>
            <td>${urgencyBadge}</td>
            <td>${statusBadge}</td>
            <td>${formatDate(ticket.createdAt)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Ticket Details Modal ---
function openTicketDetails(ticketId) {
    activeTicketId = ticketId;
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    // Populate Details
    document.getElementById("modal-ticket-id").textContent = ticket.id;
    document.getElementById("modal-title").textContent = ticket.title;
    document.getElementById("modal-reporter").textContent = ticket.reporter;
    document.getElementById("modal-dept").textContent = ticket.department;
    document.getElementById("modal-equip").textContent = ticket.equipment || "-";
    document.getElementById("modal-urgency").innerHTML = getUrgencyBadge(ticket.urgency);
    document.getElementById("modal-status").innerHTML = getStatusBadge(ticket.status);
    document.getElementById("modal-date").textContent = formatDate(ticket.createdAt);
    document.getElementById("modal-details").textContent = ticket.details;

    // Show/Hide Image attachments
    const imgSec = document.getElementById("modal-image-section");
    const imgEl = document.getElementById("modal-image");
    if (imgSec && imgEl) {
        if (ticket.image) {
            imgSec.style.display = "block";
            imgEl.src = ticket.image;
        } else {
            imgSec.style.display = "none";
            imgEl.src = "";
        }
    }

    // Render Timeline Logs
    const timelineListEl = document.getElementById("modal-timeline-list");
    if (timelineListEl) {
        timelineListEl.innerHTML = "";
        const logs = ticket.logs || [];
        if (logs.length === 0) {
            timelineListEl.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted); padding-left:5px;">ไม่มีข้อมูลความเคลื่อนไหว</p>`;
        } else {
            logs.forEach(log => {
                const item = document.createElement("div");
                let statusClass = "pending";
                if (log.status === "กำลังแก้ไข") statusClass = "inprogress";
                if (log.status === "แก้ไขแล้ว") statusClass = "resolved";

                item.className = `timeline-item ${statusClass}`;
                item.innerHTML = `
                    <div class="timeline-dot"></div>
                    <div class="timeline-meta">${formatDate(log.time)} - <strong>${escapeHTML(log.user)}</strong></div>
                    <div class="timeline-content">${escapeHTML(log.text)}</div>
                `;
                timelineListEl.appendChild(item);
            });
        }
    }

    const resSec = document.getElementById("modal-resolved-section");
    if (ticket.status === "แก้ไขแล้ว") {
        resSec.style.display = "block";
        document.getElementById("modal-resolution-text").textContent = ticket.resolution || "ไม่มีบันทึกวิธีแก้ปัญหา";
        document.getElementById("modal-resolved-date").textContent = "เสร็จเมื่อ: " + formatDate(ticket.resolvedAt);
    } else {
        resSec.style.display = "none";
    }

    const staffActionSec = document.getElementById("staff-update-section");
    if (isStaff()) {
        staffActionSec.style.display = "block";
        document.getElementById("update-status").value = ticket.status;
        document.getElementById("update-resolution").value = ticket.resolution;
    } else {
        staffActionSec.style.display = "none";
    }

    const modal = document.getElementById('ticket-modal');
    modal.inert = false;
    modal.classList.add('active');
    modal.querySelector('.modal-close').focus();
}

function closeModal() {
    const modal = document.getElementById('ticket-modal');
    modal.classList.remove('active');
    modal.inert = true;
    activeTicketId = null;
}

async function saveTicketUpdate() {
    if (!activeTicketId) return;

    const statusVal = document.getElementById("update-status").value;
    const resVal = document.getElementById("update-resolution").value.trim();

    if (statusVal === "แก้ไขแล้ว" && !resVal) {
        notify("กรุณากรอกบันทึกวิธีแก้ไขปัญหาของเจ้าหน้าที่ก่อนเปลี่ยนสถานะเป็น 'แก้ไขแล้ว'");
        return;
    }

    try {
        const response = await api(`/api/tickets/${activeTicketId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: statusVal, resolution: resVal })
        });

        if (response.ok) {
            // Refresh local database copy
            await initData();
            closeModal();

            // Refresh screens
            if (document.getElementById("dashboard-total")) {
                renderDashboard();
            } else if (document.getElementById("tickets-tbody")) {
                renderTickets();
            }

            notify("บันทึกการแก้ไขและอัปเดตสถานะสำเร็จ!");
        } else {
            const errData = await response.json();
            notify(`เกิดข้อผิดพลาด: ${errData.error}`);
        }
    } catch (err) {
        console.error('Connection error:', err);
        notify('ไม่สามารถติดต่อเซิร์ฟเวอร์หลังบ้านเพื่ออัปเดตตั๋วได้');
    }
}

// --- History & Resolution Logs ---
function renderHistory() {
    const container = document.getElementById("history-list-container");
    if (!container) return;

    container.innerHTML = "";

    const resolvedTickets = tickets.filter(t => t.status === "แก้ไขแล้ว");

    if (resolvedTickets.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-history"></i><p>ไม่มีประวัติการแก้ไขปัญหาที่เสร็จสิ้น</p></div>`;
        return;
    }

    resolvedTickets.sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt));

    resolvedTickets.forEach(ticket => {
        const card = document.createElement("div");
        card.className = "history-card";

        card.innerHTML = `
            <div class="history-card-header">
                <span class="history-card-title">
                    <span class="history-card-id">${escapeHTML(ticket.id)}</span> - ${escapeHTML(ticket.title)}
                </span>
                <span class="badge-status resolved">แก้ไขแล้ว</span>
            </div>
            <div class="history-card-body">
                <div style="margin-bottom: 8px;"><strong>ผู้แจ้ง:</strong> ${escapeHTML(ticket.reporter)} (${escapeHTML(ticket.department)}) | <strong>อุปกรณ์:</strong> ${escapeHTML(ticket.equipment || "-")}</div>
                <div style="margin-bottom: 12px; font-style: italic;"><strong>อาการแจ้งซ่อมอาการ:</strong> ${escapeHTML(ticket.details)}</div>

                <div class="resolution-box">
                    <h5><i class="fas fa-check-circle"></i> วิธีการแก้ไขปัญหาของเจ้าหน้าที่:</h5>
                    <p>${escapeHTML(ticket.resolution)}</p>
                    <div class="resolution-meta">
                        แก้ไขเรียบร้อยเมื่อ: ${formatDate(ticket.resolvedAt)}
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- Helper Functions ---
function getUrgencyBadge(urgency) {
    if (urgency === "สูง") {
        return `<span class="badge-urgency high"><i class="fas fa-arrow-up"></i> สูง (SLA: 2 ชม.)</span>`;
    } else if (urgency === "กลาง") {
        return `<span class="badge-urgency medium"><i class="fas fa-minus"></i> กลาง (SLA: 8 ชม.)</span>`;
    } else {
        return `<span class="badge-urgency low"><i class="fas fa-arrow-down"></i> ต่ำ (SLA: 24 ชม.)</span>`;
    }
}

function getStatusBadge(status) {
    if (status === "รอดำเนินการ") {
        return `<span class="badge-status pending">รอดำเนินการ</span>`;
    } else if (status === "กำลังแก้ไข") {
        return `<span class="badge-status inprogress">กำลังแก้ไข</span>`;
    } else {
        return `<span class="badge-status resolved">แก้ไขแล้ว</span>`;
    }
}

function formatDate(isoString) {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return date.toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// --- Handle Login Form Submission ---
async function handleFormLogin() {
    const form = document.getElementById('auth-login-form');
    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    const errorBox = document.getElementById('login-error');
    errorBox.textContent = '';
    try {
        const response = await api('/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: document.getElementById('login-username').value.trim(), password: document.getElementById('login-password').value })
        });
        const user = await response.json();
        if (!response.ok) throw new Error(user.error || 'เข้าสู่ระบบไม่สำเร็จ');
        location.replace(['staff', 'admin'].includes(user.role) ? 'dashboard.html' : 'report.html');
    } catch (error) { errorBox.textContent = error.message; }
    finally { button.disabled = false; }
}

// --- Export Tickets to Excel (CSV) ---
function exportTicketsToCSV() {
    // Compile search and filter state
    const searchQuery = (document.getElementById("search-tickets")?.value || "").toLowerCase().trim();
    let filtered = [...tickets];

    // 1. Status Filter
    if (activeFilter === "pending") {
        filtered = filtered.filter(t => t.status === "รอดำเนินการ");
    } else if (activeFilter === "inprogress") {
        filtered = filtered.filter(t => t.status === "กำลังแก้ไข");
    } else if (activeFilter === "resolved") {
        filtered = filtered.filter(t => t.status === "แก้ไขแล้ว");
    }

    // 2. Text Search Filter
    if (searchQuery) {
        filtered = filtered.filter(t =>
            t.id.toLowerCase().includes(searchQuery) ||
            t.title.toLowerCase().includes(searchQuery) ||
            t.reporter.toLowerCase().includes(searchQuery) ||
            t.department.toLowerCase().includes(searchQuery) ||
            (t.equipment && t.equipment.toLowerCase().includes(searchQuery)) ||
            t.details.toLowerCase().includes(searchQuery)
        );
    }

    if (filtered.length === 0) {
        notify("ไม่มีข้อมูลตั๋วซ่อมที่จะส่งออกสำหรับตัวกรองนี้");
        return;
    }

    // Construct CSV table string
    const headers = ["รหัสตั๋ว", "หัวข้อปัญหา", "ผู้แจ้งซ่อม", "แผนก/ฝ่าย", "อุปกรณ์/รหัสเครื่อง", "รายละเอียดอาการ", "ระดับความเร่งด่วน", "สถานะการซ่อม", "วันที่เปิดตั๋ว", "วิธีดำเนินการแก้ไขของ IT", "วันที่ปิดตั๋ว"];
    const csvRows = [];
    csvRows.push(headers.join(","));

    filtered.forEach(t => {
        const row = [t.id, t.title, t.reporter, t.department, t.equipment, t.details, t.urgency, t.status, formatDate(t.createdAt), t.resolution, formatDate(t.resolvedAt)].map(value => {
            let cell = String(value || '');
            if (/^[=+@\-\t\r]/.test(cell)) cell = "'" + cell;
            return '"' + cell.replace(/"/g, '""') + '"';
        });
        csvRows.push(row.join(","));
    });

    // Write UTF-8 BOM so Excel opens Thai characters natively without encoding crash
    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `IT_Helpdesk_Report_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function notify(message, type = 'info') {
    let region = document.getElementById('notifications');
    if (!region) {
        region = document.createElement('div'); region.id = 'notifications';
        region.setAttribute('aria-live', 'polite'); document.body.appendChild(region);
    }
    const item = document.createElement('div'); item.className = `toast ${type}`;
    const text = document.createElement('span'); text.textContent = message;
    const close = document.createElement('button'); close.textContent = '×'; close.setAttribute('aria-label', 'ปิดข้อความ'); close.onclick = () => item.remove();
    item.append(text, close); region.appendChild(item);
    setTimeout(() => item.remove(), 8000);
}
async function runBusy(form, action) {
    const button = form.querySelector('button[type="submit"]');
    if (button?.disabled) return;
    if (button) button.disabled = true;
    try { await action(); } catch (error) { notify(error.message, 'error'); }
    finally { if (button) button.disabled = false; }
}
function togglePassword(button) {
    const input = document.getElementById('login-password');
    const show = input.type === 'password'; input.type = show ? 'text' : 'password';
    button.textContent = show ? 'ซ่อน' : 'แสดง'; button.setAttribute('aria-pressed', String(show));
    button.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
}
async function loadDemoAccounts() {
    try {
        const response = await api('/api/auth/demo-accounts');
        if (!response.ok) return;
        const accounts = await response.json();
        if (!accounts.length) return;
        const list = document.getElementById('demo-account-list');
        for (const account of accounts) {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'demo-account';
            button.innerHTML = `<span class="demo-role">${escapeHTML(account.label)}</span><span class="demo-description">${escapeHTML(account.description)}</span><span class="demo-credentials"><code>${escapeHTML(account.username)}</code><span>/</span><code>${escapeHTML(account.password)}</code></span>`;
            button.onclick = () => {
                document.getElementById('login-username').value = account.username;
                document.getElementById('login-password').value = account.password;
                document.getElementById('login-error').textContent = '';
                list.querySelectorAll('button').forEach(item => item.classList.toggle('selected', item === button));
                document.querySelector('#auth-login-form button[type="submit"]').focus();
            };
            list.appendChild(button);
        }
        document.getElementById('demo-accounts').hidden = false;
    } catch { /* Login remains available if demo accounts cannot be loaded. */ }
}
function openAccountDialog(mode) {
    if (document.getElementById('account-dialog')) return;
    const titles = { register: 'สมัครสมาชิก', reset: 'ตั้งรหัสผ่านใหม่', recovery: 'รับรหัสกู้คืนส่วนตัว' };
    const descriptions = {
        register: 'สร้างบัญชีผู้แจ้งซ่อมของคุณ และตั้งรหัสผ่านอย่างน้อย 10 ตัวอักษร',
        reset: 'ใช้ชื่อผู้ใช้และรหัสกู้คืนที่เก็บไว้ หากไม่มีรหัสกู้คืน กรุณาติดต่อผู้ดูแลระบบ',
        recovery: 'ยืนยันรหัสผ่านปัจจุบันเพื่อสร้างรหัสกู้คืนใหม่ รหัสกู้คืนเดิมจะใช้ไม่ได้'
    };
    const field = (id, label, type, autocomplete, extra = '') => `<div class="form-group"><label for="${id}">${label}</label><input id="${id}" class="form-control" type="${type}" autocomplete="${autocomplete}" ${extra} required></div>`;
    let fields = mode === 'recovery' ? field('account-current-password', 'รหัสผ่านปัจจุบัน', 'password', 'current-password', 'maxlength="256"') : field('account-username', 'ชื่อผู้ใช้', 'text', 'username', 'pattern="[a-zA-Z0-9_.-]{3,40}" minlength="3" maxlength="40"');
    if (mode === 'register') fields += field('account-name', 'ชื่อที่แสดง', 'text', 'name', 'maxlength="100"');
    if (mode === 'reset') fields += field('account-recovery', 'รหัสกู้คืนส่วนตัว', 'text', 'off', 'maxlength="150" spellcheck="false"');
    if (mode !== 'recovery') fields += field('account-password', 'รหัสผ่านใหม่', 'password', 'new-password', 'minlength="10" maxlength="128"') + field('account-confirm', 'ยืนยันรหัสผ่านใหม่', 'password', 'new-password', 'minlength="10" maxlength="128"');
    const overlay = document.createElement('div'); overlay.id = 'account-dialog'; overlay.className = 'modal-overlay active';
    overlay.innerHTML = `<div class="modal-content account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title"><div class="modal-header"><h2 id="account-title">${titles[mode]}</h2><button type="button" class="modal-close" aria-label="ปิด">×</button></div><form class="modal-body"><p class="muted">${descriptions[mode]}</p>${fields}<p class="form-error" role="alert"></p><button type="submit" class="btn-submit">${mode === 'register' ? 'สร้างบัญชี' : mode === 'reset' ? 'เปลี่ยนรหัสผ่าน' : 'สร้างรหัสกู้คืน'}</button></form></div>`;
    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').onclick = close;
    overlay.onclick = e => { if (e.target === overlay) close(); };
    overlay.querySelector('form').onsubmit = async e => {
        e.preventDefault();
        const form = e.target, error = form.querySelector('.form-error'), submit = form.querySelector('[type="submit"]');
        error.textContent = '';
        const value = id => overlay.querySelector('#' + id)?.value;
        if (mode !== 'recovery' && value('account-password') !== value('account-confirm')) { error.textContent = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'; return; }
        const username = value('account-username')?.trim();
        const body = mode === 'register' ? { username, name: value('account-name'), password: value('account-password') } : mode === 'reset' ? { username, recoveryCode: value('account-recovery'), newPassword: value('account-password') } : { currentPassword: value('account-current-password') };
        const endpoint = { register: 'register', reset: 'reset-password', recovery: 'recovery-code' }[mode];
        submit.disabled = true;
        try {
            const response = await api('/api/auth/' + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await response.json();
            if (!response.ok) { error.textContent = data.error || 'ไม่สามารถทำรายการได้'; return; }
            if (username && document.getElementById('login-username')) document.getElementById('login-username').value = username;
            const code = data.recoveryCode;
            overlay.querySelector('.modal-close').remove(); overlay.onclick = null;
            form.innerHTML = `<p>${mode === 'register' ? 'สร้างบัญชีสำเร็จ' : mode === 'reset' ? 'เปลี่ยนรหัสผ่านสำเร็จ' : 'สร้างรหัสกู้คืนสำเร็จ'}</p><p class="muted">เก็บรหัสนี้ไว้ในที่ปลอดภัย ระบบจะแสดงครั้งนี้เท่านั้น ใช้เพื่อตั้งรหัสผ่านใหม่เมื่อคุณลืมรหัสผ่าน${mode === 'reset' ? ' รหัสกู้คืนเดิมถูกยกเลิกแล้ว' : ''}</p><code class="recovery-code">${escapeHTML(code)}</code><button type="button" class="btn-secondary" id="download-recovery">ดาวน์โหลดรหัสกู้คืน</button><p><label><input type="checkbox" id="saved-recovery"> ฉันเก็บรหัสกู้คืนไว้แล้ว</label></p><button type="button" class="btn-submit" id="finish-recovery" disabled>${mode === 'recovery' ? 'เสร็จสิ้น' : 'กลับไปเข้าสู่ระบบ'}</button>`;
            form.querySelector('#download-recovery').onclick = () => {
                const url = URL.createObjectURL(new Blob([`IT Helpdesk\nUsername: ${username || currentUser.username}\nRecovery code: ${code}\nKeep this code private.\n`], { type: 'text/plain;charset=utf-8' }));
                const link = document.createElement('a'); link.href = url; link.download = 'helpdesk-recovery-code.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
            };
            form.querySelector('#saved-recovery').onchange = e => { form.querySelector('#finish-recovery').disabled = !e.target.checked; };
            form.querySelector('#finish-recovery').onclick = () => { if (mode === 'reset') location.replace('login.html'); else close(); };
        } catch (err) { error.textContent = err.message || 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่'; }
        finally { submit.disabled = false; }
    };
    document.body.appendChild(overlay); overlay.querySelector('input').focus();
    overlay.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return;
        const controls = [...overlay.querySelectorAll('button,input')].filter(el => !el.disabled);
        if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0].focus(); }
    });
}
function openPasswordDialog() {
    if (document.getElementById('password-dialog')) return;
    const overlay = document.createElement('div'); overlay.id = 'password-dialog'; overlay.className = 'modal-overlay active';
    overlay.innerHTML = `<div class="modal-content password-modal" role="dialog" aria-modal="true" aria-labelledby="password-title"><div class="modal-header"><h2 id="password-title">เปลี่ยนรหัสผ่าน</h2><button type="button" aria-label="ปิด" class="modal-close">×</button></div><form class="modal-body" id="password-form"><p class="muted">เมื่อเปลี่ยนรหัสผ่านสำเร็จ ทุกอุปกรณ์จะต้องเข้าสู่ระบบใหม่</p><div class="form-group"><label for="current-password">รหัสผ่านปัจจุบัน</label><input type="password" id="current-password" class="form-control" autocomplete="current-password" maxlength="256" required></div><div class="form-group"><label for="new-own-password">รหัสผ่านใหม่</label><input type="password" id="new-own-password" class="form-control" autocomplete="new-password" minlength="10" maxlength="128" required></div><div class="form-group"><label for="confirm-password">ยืนยันรหัสผ่านใหม่</label><input type="password" id="confirm-password" class="form-control" autocomplete="new-password" minlength="10" maxlength="128" required></div><p id="password-error" class="form-error" role="alert"></p><button type="submit" class="btn-submit">บันทึกรหัสผ่าน</button></form></div>`;
    const close = () => { overlay.remove(); document.querySelector('.user-profile button:last-child')?.focus(); };
    overlay.querySelector('.modal-close').onclick = close;
    overlay.onclick = e => { if (e.target === overlay) close(); };
    overlay.querySelector('form').onsubmit = e => {
        e.preventDefault(); runBusy(e.target, async () => {
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-own-password').value;
            const errorBox = document.getElementById('password-error');
            if (newPassword !== document.getElementById('confirm-password').value) { errorBox.textContent = 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน'; return; }
            const response = await api('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
            const data = await response.json();
            if (!response.ok) { errorBox.textContent = data.error; return; }
            location.replace('login.html');
        });
    };
    document.body.appendChild(overlay); overlay.querySelector('input').focus();
    overlay.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return;
        const controls = overlay.querySelectorAll('button,input');
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
}
async function createUser() {
    const payload = { name: document.getElementById('new-name').value.trim(), username: document.getElementById('new-username').value.trim(), password: document.getElementById('new-password').value, role: document.getElementById('new-role').value };
    const response = await api('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    document.getElementById('create-user-form').reset(); await renderUsers(); notify('สร้างบัญชีเรียบร้อยแล้ว');
}
async function renderUsers() {
    const response = await api('/api/users');
    const users = await response.json();
    if (!response.ok) throw new Error(users.error);
    const list = document.getElementById('users-list'); list.replaceChildren();
    document.getElementById('user-count').textContent = `${users.length} คน`;
    const roles = { user: 'ผู้แจ้งซ่อม', staff: 'เจ้าหน้าที่ IT', admin: 'ผู้ดูแลระบบ' };
    for (const user of users) {
        const form = document.createElement('form'); form.className = 'member-card';
        const own = user.username === currentUser.username;
        form.innerHTML = `<div class="member-heading"><span class="member-avatar">${escapeHTML(user.name.slice(0, 1))}</span><div><strong>${escapeHTML(user.name)}</strong><p class="muted">@${escapeHTML(user.username)}${own ? ' · คุณ' : ''}</p></div><span class="member-status ${user.active ? '' : 'inactive'}">${user.active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}</span></div><div class="member-controls"><label>บทบาท<select class="form-control" name="role" ${own ? 'disabled' : ''}>${Object.entries(roles).map(([value, label]) => `<option value="${value}" ${user.role === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>สถานะ<select class="form-control" name="active" ${own ? 'disabled' : ''}><option value="true" ${user.active ? 'selected' : ''}>เปิดใช้งาน</option><option value="false" ${!user.active ? 'selected' : ''}>ปิดใช้งาน</option></select></label><label>รีเซ็ตรหัสผ่าน<input type="password" class="form-control" name="password" autocomplete="new-password" minlength="10" maxlength="128" placeholder="เว้นว่างเพื่อใช้รหัสเดิม"></label><button type="submit" class="btn-secondary">บันทึก</button></div>`;
        form.onsubmit = e => {
            e.preventDefault(); runBusy(form, async () => {
                const payload = { role: form.elements.role.value, active: form.elements.active.value === 'true' };
                if (form.elements.password.value) payload.password = form.elements.password.value;
                const result = await api(`/api/users/${encodeURIComponent(user.username)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const data = await result.json(); if (!result.ok) throw new Error(data.error);
                if (own) { location.replace('login.html'); return; }
                await renderUsers(); notify('บันทึกบัญชีเรียบร้อยแล้ว');
            });
        };
        list.appendChild(form);
    }
}
