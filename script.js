// ==========================================
// ⚠️ ใส่ URL ของ Google Apps Script ที่ Deploy แล้วตรงนี้
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqeK0tTnJ2SVIpri2lZDszFwZWQywvEu_9IvRN3h7-m029R3S2A7kaNBRWe9JDZMDiNw/exec';
// ==========================================

let currentPage = 0;
const pageSize = 10;
let allEntries = [];

document.addEventListener('DOMContentLoaded', () => {
    // UI References
    const addBtn = document.getElementById('addBtn');
    const viewBtn = document.getElementById('viewBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const clearBtn = document.getElementById('clearBtn'); // ✅ เพิ่มตัวแปร
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageInfo = document.getElementById('page-info');
    const addSection = document.getElementById('addSection');
    const viewSection = document.getElementById('viewSection');
    const addForm = document.getElementById('addForm');
    const dataTableBody = document.querySelector('#dataTable tbody');
    const totalSummary = document.getElementById('total-summary');
    const searchInput = document.getElementById('searchName');
    const searchDateInput = document.getElementById('searchDate');
    const dailyTotalSummary = document.getElementById('daily-total-summary');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    // Modal References
    const editModal = document.getElementById('editModal');
    const editForm = document.getElementById('editForm');
    const closeModalBtn = editModal.querySelector('.close');
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmYesBtn = document.getElementById('confirmYes');
    const confirmNoBtn = document.getElementById('confirmNo');

    // --- Core API ---
    async function callAPI(action, data = null) {
        loadingOverlay.classList.remove('hidden');
        try {
            let response;
            if (action === 'read') {
                response = await fetch(`${APPS_SCRIPT_URL}?action=read`);
            } else {
                response = await fetch(APPS_SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action, data })
                });
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            showAlert('การเชื่อมต่อขัดข้อง: ' + error.message, 'error');
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    function showAlert(message, type = 'success') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `toast-notification ${type}`;
        notification.textContent = message;
        container.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 500);
        }, 4000);
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        let cleanDate = dateString;
        if (typeof dateString === 'string' && dateString.includes('T')) {
            cleanDate = dateString.split('T')[0];
        }
        const parts = cleanDate.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return cleanDate;
    }

    function showSection(section) {
        addSection.style.display = 'none';
        viewSection.style.display = 'none';
        section.style.display = 'block';
    }

    // --- Event Listeners ---
    addBtn.addEventListener('click', () => showSection(addSection));
    viewBtn.addEventListener('click', () => { showSection(viewSection); fetchEntries(); });
    refreshBtn.addEventListener('click', fetchEntries);
    
    // ✅ ปุ่มล้างข้อมูลทั้งหมด
    clearBtn.addEventListener('click', () => {
        pendingAction = { type: 'clear' }; // ตั้งค่า Action
        confirmationModal.style.display = 'flex';
        confirmMessage.textContent = 'คุณแน่ใจหรือไม่ว่าต้องการ "ล้างข้อมูลทั้งหมด"? (กู้คืนไม่ได้)';
    });

    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('name').value,
            date: document.getElementById('date').value,
            amount: document.getElementById('amount').value,
            slip: document.getElementById('slip').value,
            responsiblePerson: document.getElementById('responsiblePerson').value
        };
        const result = await callAPI('add', data);
        if (result && result.status === 'success') {
            showAlert(result.message, 'success');
            addForm.reset();
        } else {
            showAlert(result.message, 'error');
        }
    });

    async function fetchEntries() {
        const result = await callAPI('read');
        if (Array.isArray(result)) {
            allEntries = result; // ไม่ reverse (เรียง 1->มาก)
            currentPage = 0;
            renderTable(allEntries);
        }
    }

    function renderTable(entries) {
        const isSearch = searchInput.value.trim() !== '';
        dataTableBody.innerHTML = '';
        
        let entriesToRender;
        const totalPages = Math.ceil(entries.length / pageSize) || 1;
        
        if (!isSearch) {
            const startIndex = currentPage * pageSize;
            const endIndex = startIndex + pageSize;
            entriesToRender = entries.slice(startIndex, endIndex);
            
            prevBtn.disabled = currentPage === 0;
            nextBtn.disabled = (currentPage + 1) >= totalPages;
            pageInfo.textContent = `หน้า ${currentPage + 1} จาก ${totalPages}`;
            document.querySelector('.pagination-controls').style.display = 'flex';
        } else {
            entriesToRender = entries;
            document.querySelector('.pagination-controls').style.display = 'none';
        }

        if (isSearch) {
            const personalTotals = {};
            entries.forEach(entry => {
                const name = entry['ชื่อ-นามสกุล'];
                if (!personalTotals[name]) { personalTotals[name] = 0; }
                personalTotals[name] += parseFloat(entry['ยอด']) || 0;
            });
            const summaryLines = [];
            for (const name in personalTotals) {
                summaryLines.push(`ยอดรวมรายบุคคล <strong>${name}</strong> : <span style="color:var(--primary);">${personalTotals[name].toLocaleString()}</span> บาท`);
            }
            if (summaryLines.length === 0) totalSummary.innerHTML = 'ไม่พบข้อมูล';
            else totalSummary.innerHTML = summaryLines.join('<br>');
            dailyTotalSummary.innerHTML = '';
        } else {
            const grandTotal = allEntries.reduce((sum, entry) => sum + (parseFloat(entry['ยอด']) || 0), 0);
            totalSummary.innerHTML = `ยอดรวมทั้งหมด : <strong>${grandTotal.toLocaleString()}</strong> บาท`;
        }

        if (entriesToRender.length === 0) {
            dataTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">ไม่พบข้อมูล</td></tr>';
        } else {
            entriesToRender.forEach(entry => {
                const row = document.createElement('tr');
                const displayDate = formatDate(entry['วัน/เดือน/ปี']);
                row.innerHTML = `
                    <td>${entry['ID']}</td>
                    <td>${entry['ชื่อ-นามสกุล']}</td>
                    <td>${displayDate}</td>
                    <td>${parseFloat(entry['ยอด'] || 0).toLocaleString()}</td>
                    <td><a href="${entry['สลิป']}" target="_blank">ลิงก์สลิป</a></td>
                    <td>${entry['ผู้รับผิดชอบ']}</td>
                    <td class="action-buttons">
                        <button class="edit-btn" onclick='prepareEdit(${JSON.stringify(entry)})'>แก้ไข</button>
                        <button class="delete-btn" onclick="prepareDelete('${entry['ID']}')">ลบ</button>
                    </td>
                `;
                dataTableBody.appendChild(row);
            });
        }
    }

    searchInput.addEventListener('input', (e) => {
        searchDateInput.value = ''; 
        const searchTerm = e.target.value.toLowerCase();
        const filteredEntries = allEntries.filter(entry => 
            entry['ชื่อ-นามสกุล'] && entry['ชื่อ-นามสกุล'].toString().toLowerCase().includes(searchTerm)
        );
        currentPage = 0;
        renderTable(filteredEntries);
    });

    searchDateInput.addEventListener('change', (e) => {
        const selectedDate = e.target.value;
        searchInput.value = '';
        if (!selectedDate) { 
            dailyTotalSummary.innerHTML = ''; 
            renderTable(allEntries);
            return; 
        }
        const entriesForDate = allEntries.filter(entry => {
            let entryDate = entry['วัน/เดือน/ปี'];
            if (entryDate && entryDate.includes('T')) entryDate = entryDate.split('T')[0];
            return entryDate === selectedDate;
        });
        currentPage = 0;
        renderTable(entriesForDate);
        const dailyTotal = entriesForDate.reduce((sum, entry) => sum + (parseFloat(entry['ยอด']) || 0), 0);
        dailyTotalSummary.innerHTML = `ยอดรวมสำหรับวันที่ ${formatDate(selectedDate)} : <strong>${dailyTotal.toLocaleString()}</strong> บาท`;
    });

    prevBtn.addEventListener('click', () => { if (currentPage > 0) { currentPage--; renderTable(allEntries); } });
    nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(allEntries.length / pageSize);
        if (currentPage < totalPages - 1) { currentPage++; renderTable(allEntries); }
    });

    // --- Delete / Clear Logic (ปรับปรุงใหม่) ---
    let pendingAction = null; // เก็บสถานะว่ากำลังจะทำอะไร (ลบเดี่ยว หรือ ล้างหมด)

    window.prepareDelete = (id) => {
        pendingAction = { type: 'delete', id: id }; // เตรียมลบรายตัว
        confirmationModal.style.display = 'flex';
        confirmMessage.textContent = 'คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?';
    }

    confirmYesBtn.onclick = async () => {
        confirmationModal.style.display = 'none';
        
        if (pendingAction) {
            let result;
            
            // กรณีลบรายตัว
            if (pendingAction.type === 'delete') {
                result = await callAPI('delete', { id: pendingAction.id });
            } 
            // กรณีล้างข้อมูลทั้งหมด
            else if (pendingAction.type === 'clear') {
                result = await callAPI('clear');
            }

            if (result && result.status === 'success') {
                showAlert(result.message, 'success');
                fetchEntries();
            } else {
                showAlert(result.message, 'error');
            }
            pendingAction = null; // รีเซ็ตสถานะ
        }
    };
    confirmNoBtn.onclick = () => {
        confirmationModal.style.display = 'none';
        pendingAction = null;
    };

    // --- Edit Logic ---
    window.prepareEdit = (entry) => {
        document.getElementById('edit-id').value = entry['ID'];
        document.getElementById('edit-name').value = entry['ชื่อ-นามสกุล'];
        let rawDate = entry['วัน/เดือน/ปี'];
        if(rawDate && rawDate.includes('T')) rawDate = rawDate.split('T')[0];
        document.getElementById('edit-date').value = rawDate;
        document.getElementById('edit-amount').value = entry['ยอด'];
        document.getElementById('edit-slip').value = entry['สลิป'];
        document.getElementById('edit-responsiblePerson').value = entry['ผู้รับผิดชอบ'];
        editModal.style.display = 'flex';
    }

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            id: document.getElementById('edit-id').value,
            name: document.getElementById('edit-name').value,
            date: document.getElementById('edit-date').value,
            amount: document.getElementById('edit-amount').value,
            slip: document.getElementById('edit-slip').value,
            responsiblePerson: document.getElementById('edit-responsiblePerson').value
        };
        const result = await callAPI('edit', data);
        if (result && result.status === 'success') {
            showAlert(result.message, 'success');
            editModal.style.display = 'none';
            fetchEntries();
        } else {
            showAlert(result.message, 'error');
        }
    });

    closeModalBtn.onclick = () => editModal.style.display = 'none';
    window.onclick = (e) => { if (e.target === editModal) editModal.style.display = 'none'; };

    showSection(addSection);
});