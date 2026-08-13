// --- Mock Data Seed ---
const DEFAULT_TICKETS = [
    {
        id: "IT-001",
        title: "คอมพิวเตอร์เปิดไม่ติด",
        reporter: "นายกิตติศักดิ์ ใจดี",
        department: "การเงิน",
        equipment: "PC-FIN-012",
        details: "เครื่องคอมพิวเตอร์เปิดไม่ติด กดปุ่ม Power แล้วไม่มีสัญญาณไฟใดๆ ขึ้นที่ตัวเคส และพัดลมระบายความร้อนด้านหลังไม่หมุน",
        urgency: "สูง",
        status: "กำลังแก้ไข",
        createdAt: "2026-08-12T08:30:00+07:00",
        resolution: "",
        resolvedAt: ""
    },
    {
        id: "IT-002",
        title: "เชื่อมต่อ Wi-Fi ไม่ได้",
        reporter: "นางสาวสมหญิง รักเรียน",
        department: "ทรัพยากรบุคคล",
        equipment: "Notebook HR-04",
        details: "ไม่สามารถเชื่อมต่อสัญญาณ Wi-Fi ของสำนักงานได้ ขึ้นแถบเตือนสีเหลืองหรือแจ้งเตือน Connected, no internet ทั้งที่เครื่องอื่นเชื่อมต่อได้ปกติ",
        urgency: "กลาง",
        status: "รอดำเนินการ",
        createdAt: "2026-08-12T09:15:00+07:00",
        resolution: "",
        resolvedAt: ""
    },
    {
        id: "IT-003",
        title: "เครื่องพิมพ์ไม่ทำงาน",
        reporter: "นายประวิทย์ สุขุม",
        department: "การตลาด",
        equipment: "Printer MKT-02",
        details: "สั่งพิมพ์เอกสารจากโปรแกรม Word แล้วเครื่องพิมพ์ไม่มีการตอบสนองใดๆ ตรวจสอบที่ตัวเครื่องพิมพ์มีสัญญาณไฟสีแดงกระพริบเตือนบริเวณกระดาษติดด้านใน",
        urgency: "ต่ำ",
        status: "แก้ไขแล้ว",
        createdAt: "2026-08-11T14:20:00+07:00",
        resolution: "เปิดฝาหลังเครื่องพิมพ์และดึงเศษกระดาษที่ติดคาอยู่ออกเรียบร้อย ทำการทดสอบสั่งพิมพ์งาน 3 แผ่น ผ่านปกติ",
        resolvedAt: "2026-08-11T15:10:00+07:00"
    }
];

// --- App State ---
let tickets = [];
let currentUser = {
    role: "guest", // guest, user, staff
    name: ""
};
let activeFilter = "all";
let activeTicketId = null;
let dashboardChartInstance = null;

// --- Initialize App ---
document.addEventListener("DOMContentLoaded", async () => {
    await initData();
    checkSessionAndRoute();
    setupEventListeners();
    autoRenderPageData();
});

// --- API Database Logic ---
async function initData() {
    try {
        const response = await fetch('/api/tickets');
        if (response.ok) {
            tickets = await response.json();
        } else {
            console.error('Failed to fetch tickets from server');
        }
    } catch (err) {
        console.error('Error connecting to backend:', err);
    }
}

function saveTickets() {
    // No-op: data is saved on server-side now!
}

// --- Session & Routing Logic ---
function checkSessionAndRoute() {
    const session = localStorage.getItem("it_helpdesk_session");
    const currentPage = window.location.pathname.split("/").pop();
    
    // Default fallback to login if not specified
    const pageName = currentPage === "" ? "login.html" : currentPage;

    if (session) {
        currentUser = JSON.parse(session);
        
        // If logged in and trying to access login.html, redirect to landing pages
        if (pageName === "login.html") {
            if (currentUser.role === "staff") {
                window.location.href = "dashboard.html";
            } else {
                window.location.href = "report.html";
            }
            return;
        }

        // If User tries to access staff-only pages, redirect to report/tickets
        if (currentUser.role === "user" && (pageName === "dashboard.html" || pageName === "history.html")) {
            alert("คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะเจ้าหน้าที่ IT เท่านั้น)");
            window.location.href = "tickets.html";
            return;
        }

        // Render profile and navigation highlight
        applyUserRoleLayout(pageName);

    } else {
        currentUser = { role: "guest", name: "" };
        // If not logged in and not on login.html, redirect to login.html
        if (pageName !== "login.html") {
            window.location.href = "login.html";
        }
    }
}

function login(role, name) {
    currentUser = { role, name };
    localStorage.setItem("it_helpdesk_session", JSON.stringify(currentUser));
    
    if (role === "staff") {
        window.location.href = "dashboard.html";
    } else {
        window.location.href = "report.html";
    }
}

function logout() {
    localStorage.removeItem("it_helpdesk_session");
    currentUser = { role: "guest", name: "" };
    window.location.href = "login.html";
}

function applyUserRoleLayout(pageName) {
    const profileNameEl = document.getElementById("profile-name");
    const roleBadgeEl = document.getElementById("profile-role");
    
    if (profileNameEl) profileNameEl.textContent = currentUser.name;
    
    if (roleBadgeEl) {
        if (currentUser.role === "staff") {
            roleBadgeEl.textContent = "IT Staff";
            roleBadgeEl.className = "role-badge staff";
        } else {
            roleBadgeEl.textContent = "User / ผู้แจ้ง";
            roleBadgeEl.className = "role-badge user";
        }
    }

    // Toggle navigation links visibility depending on role
    const userNavItems = document.querySelectorAll(".user-only");
    const staffNavItems = document.querySelectorAll(".staff-only");

    if (currentUser.role === "staff") {
        userNavItems.forEach(el => el.style.display = "none");
        staffNavItems.forEach(el => el.style.display = "flex");
    } else {
        userNavItems.forEach(el => el.style.display = "flex");
        staffNavItems.forEach(el => el.style.display = "none");
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
    if (document.getElementById("report-form") && currentUser.role === "user") {
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
            submitTicket();
        });
    }

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
            saveTicketUpdate();
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
        
        let urgencyBadge = getUrgencyBadge(ticket.urgency);
        let statusBadge = getStatusBadge(ticket.status);

        tr.innerHTML = `
            <td><strong style="color: #6366f1;">${ticket.id}</strong></td>
            <td>${escapeHTML(ticket.title)}</td>
            <td>${urgencyBadge}</td>
            <td>${statusBadge}</td>
            <td>${formatDate(ticket.createdAt)}</td>
        `;
        listContainer.appendChild(tr);
    });
}

// --- Ticket Management Logic ---
function generateTicketId() {
    const ids = tickets.map(t => {
        const parts = t.id.split("-");
        return parts.length > 1 ? parseInt(parts[1], 10) : 0;
    });
    
    const maxId = ids.length > 0 ? Math.max(...ids) : 0;
    const nextId = maxId + 1;
    
    return `IT-${String(nextId).padStart(3, "0")}`;
}

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
        if (file.size > 2 * 1024 * 1024) {
            alert("ขนาดรูปภาพแนบใหญ่เกิน 2MB กรุณาอัปโหลดรูปที่มีขนาดเล็กกว่านี้");
            return;
        }

        base64Image = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
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
        const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const newTicket = await response.json();
            alert(`บันทึกการแจ้งปัญหาสำเร็จ! รหัส Ticket ของคุณคือ ${newTicket.id}`);
            window.location.href = "tickets.html";
        } else {
            const errData = await response.json();
            alert(`เกิดข้อผิดพลาด: ${errData.error || 'ไม่สามารถส่งรายงานได้'}`);
        }
    } catch (err) {
        console.error('Connection error:', err);
        alert('ไม่สามารถติดต่อเซิร์ฟเวอร์หลังบ้านได้');
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
        filtered = filtered.filter(t => t.reporter === currentUser.name);
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
    } else {
        // By default, filter out resolved tickets to show only active tasks
        filtered = filtered.filter(t => t.status !== "แก้ไขแล้ว");
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
    if (currentUser.role === "staff" && ticket.status !== "แก้ไขแล้ว") {
        staffActionSec.style.display = "block";
        document.getElementById("update-status").value = ticket.status;
        document.getElementById("update-resolution").value = ticket.resolution;
    } else {
        staffActionSec.style.display = "none";
    }

    document.getElementById("ticket-modal").classList.add("active");
}

function closeModal() {
    document.getElementById("ticket-modal").classList.remove("active");
    activeTicketId = null;
}

async function saveTicketUpdate() {
    if (!activeTicketId) return;
    
    const statusVal = document.getElementById("update-status").value;
    const resVal = document.getElementById("update-resolution").value.trim();

    if (statusVal === "แก้ไขแล้ว" && !resVal) {
        alert("กรุณากรอกบันทึกวิธีแก้ไขปัญหาของเจ้าหน้าที่ก่อนเปลี่ยนสถานะเป็น 'แก้ไขแล้ว'");
        return;
    }

    try {
        const response = await fetch(`/api/tickets/${activeTicketId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-Session-Role': currentUser.role
            },
            body: JSON.stringify({ status: statusVal, resolution: resVal, staffName: currentUser.name })
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
            
            alert("บันทึกการแก้ไขและอัปเดตสถานะสำเร็จ!");
        } else {
            const errData = await response.json();
            alert(`เกิดข้อผิดพลาด: ${errData.error}`);
        }
    } catch (err) {
        console.error('Connection error:', err);
        alert('ไม่สามารถติดต่อเซิร์ฟเวอร์หลังบ้านเพื่ออัปเดตตั๋วได้');
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
                    <span class="history-card-id">${ticket.id}</span> - ${escapeHTML(ticket.title)}
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
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
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
    const usernameInput = document.getElementById("login-username");
    const passwordInput = document.getElementById("login-password");

    const payload = {
        username: usernameInput.value.trim(),
        password: passwordInput.value.trim()
    };

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const sessionData = await response.json();
            // Save session to localStorage
            localStorage.setItem("it_helpdesk_session", JSON.stringify(sessionData));
            
            // Redirect based on role
            if (sessionData.role === "staff") {
                window.location.href = "dashboard.html";
            } else {
                window.location.href = "report.html";
            }
        } else {
            const errData = await response.json();
            alert(errData.error || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
        }
    } catch (err) {
        console.error('Login connection error:', err);
        alert('ไม่สามารถติดต่อเซิร์ฟเวอร์หลังบ้านเพื่อตรวจสอบสิทธิ์ได้');
    }
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
    } else {
        // Under default 'All' tickets view, filter out resolved tickets
        filtered = filtered.filter(t => t.status !== "แก้ไขแล้ว");
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
        alert("ไม่มีข้อมูลตั๋วซ่อมที่จะส่งออกสำหรับตัวกรองนี้");
        return;
    }

    // Construct CSV table string
    const headers = ["รหัสตั๋ว", "หัวข้อปัญหา", "ผู้แจ้งซ่อม", "แผนก/ฝ่าย", "อุปกรณ์/รหัสเครื่อง", "รายละเอียดอาการ", "ระดับความเร่งด่วน", "สถานะการซ่อม", "วันที่เปิดตั๋ว", "วิธีดำเนินการแก้ไขของ IT", "วันที่ปิดตั๋ว"];
    const csvRows = [];
    csvRows.push(headers.join(","));

    filtered.forEach(t => {
        const row = [
            t.id,
            `"${(t.title || '').replace(/"/g, '""')}"`,
            `"${(t.reporter || '').replace(/"/g, '""')}"`,
            `"${(t.department || '').replace(/"/g, '""')}"`,
            `"${(t.equipment || '').replace(/"/g, '""')}"`,
            `"${(t.details || '').replace(/"/g, '""')}"`,
            t.urgency,
            t.status,
            formatDate(t.createdAt),
            `"${(t.resolution || '').replace(/"/g, '""')}"`,
            formatDate(t.resolvedAt)
        ];
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
}
