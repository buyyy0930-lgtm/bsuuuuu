// Global variables
let socket;
let currentUser = null;
let currentAdmin = null;
let currentFaculty = null;
let selectedUser = null;
let registrationData = null;

const API_URL = window.location.origin;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Check for existing tokens
    const userToken = localStorage.getItem('userToken');
    const adminToken = localStorage.getItem('adminToken');
    
    if (adminToken) {
        verifyAdminToken(adminToken);
    } else if (userToken) {
        verifyUserToken(userToken);
    } else {
        showPage('landing-page');
    }
    
    // Setup event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${tab}-tab`).classList.add('active');
        });
    });
    
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Register form
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    
    // Admin login form
    document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);
    
    // Verification form
    document.getElementById('verification-form').addEventListener('submit', handleVerification);
    
    // Profile form
    document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);
    
    // Profile picture upload
    document.getElementById('profile-picture-input').addEventListener('change', handleProfilePictureUpload);
    
    // Message input enter key
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Create subadmin form
    const subadminForm = document.getElementById('create-subadmin-form');
    if (subadminForm) {
        subadminForm.addEventListener('submit', handleCreateSubAdmin);
    }
}

// Page navigation
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// Auth functions
async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    
    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('userToken', data.token);
            currentUser = data.user;
            initializeSocket();
            showFacultyPage();
        } else {
            alert(data.message || 'Giriş uğursuz oldu');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Server xətası');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const emailPrefix = formData.get('emailPrefix');
    const email = emailPrefix + '@bsu.edu.az';
    const phone = '+994' + formData.get('phone');
    
    registrationData = {
        email,
        phone,
        fullName: formData.get('fullName'),
        faculty: formData.get('faculty'),
        degree: formData.get('degree'),
        course: parseInt(formData.get('course')),
        password: formData.get('password')
    };
    
    // Load verification questions
    try {
        const response = await fetch(`${API_URL}/api/verification-questions`);
        const questions = await response.json();
        
        const questionsHtml = questions.map((q, i) => `
            <div class="question-block">
                <label>${q.question}</label>
                <select name="answer${i}" data-question="${q.question}" required>
                    <option value="">Cavab seçin</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="əsas">əsas</option>
                </select>
            </div>
        `).join('');
        
        document.getElementById('verification-questions').innerHTML = questionsHtml;
        showPage('verification-page');
    } catch (error) {
        console.error('Error loading questions:', error);
        alert('Server xətası');
    }
}

async function handleVerification(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const answers = [];
    let index = 0;
    while (formData.get(`answer${index}`) !== null) {
        const answerSelect = document.querySelector(`select[name="answer${index}"]`);
        answers.push({
            question: answerSelect.dataset.question,
            answer: formData.get(`answer${index}`)
        });
        index++;
    }
    
    try {
        const verifyResponse = await fetch(`${API_URL}/api/verify-answers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers })
        });
        
        const verifyData = await verifyResponse.json();
        
        if (!verifyData.success) {
            alert(`Doğrulama uğursuz oldu. ${verifyData.correctCount} doğru cavab. Minimum 2 doğru cavab lazımdır.`);
            showPage('landing-page');
            return;
        }
        
        // Proceed with registration
        const registerResponse = await fetch(`${API_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registrationData)
        });
        
        const registerData = await registerResponse.json();
        
        if (registerResponse.ok) {
            localStorage.setItem('userToken', registerData.token);
            currentUser = registerData.user;
            initializeSocket();
            showFacultyPage();
        } else {
            alert(registerData.message || 'Qeydiyyat uğursuz oldu');
            showPage('landing-page');
        }
    } catch (error) {
        console.error('Verification error:', error);
        alert('Server xətası');
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch(`${API_URL}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: formData.get('username'),
                password: formData.get('password')
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('adminToken', data.token);
            currentAdmin = data.admin;
            showAdminPanel();
        } else {
            alert(data.message || 'Admin girişi uğursuz oldu');
        }
    } catch (error) {
        console.error('Admin login error:', error);
        alert('Server xətası');
    }
}

async function verifyUserToken(token) {
    try {
        const response = await fetch(`${API_URL}/api/user/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            currentUser = await response.json();
            initializeSocket();
            showFacultyPage();
        } else {
            localStorage.removeItem('userToken');
            showPage('landing-page');
        }
    } catch (error) {
        console.error('Token verification error:', error);
        localStorage.removeItem('userToken');
        showPage('landing-page');
    }
}

async function verifyAdminToken(token) {
    try {
        const response = await fetch(`${API_URL}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            // Token is valid, extract admin info
            const payload = JSON.parse(atob(token.split('.')[1]));
            currentAdmin = {
                id: payload.adminId,
                isSuperAdmin: payload.isSuperAdmin
            };
            showAdminPanel();
        } else {
            localStorage.removeItem('adminToken');
            showPage('landing-page');
        }
    } catch (error) {
        console.error('Admin token verification error:', error);
        localStorage.removeItem('adminToken');
        showPage('landing-page');
    }
}

function logout() {
    localStorage.removeItem('userToken');
    currentUser = null;
    if (socket) {
        socket.disconnect();
    }
    showPage('landing-page');
}

function logoutAdmin() {
    localStorage.removeItem('adminToken');
    currentAdmin = null;
    showPage('landing-page');
}

function resetForm() {
    showPage('landing-page');
}

// Socket.IO
function initializeSocket() {
    socket = io(API_URL);
    
    socket.on('connect', () => {
        console.log('Socket connected');
    });
    
    socket.on('new-group-message', (message) => {
        if (currentFaculty === message.facultyId) {
            appendMessage(message);
        }
    });
    
    socket.on('new-private-message', (message) => {
        appendMessage(message);
    });
    
    socket.on('settings-updated', (settings) => {
        updateDailyTopic(settings.dailyTopic);
    });
}

// Faculty page
async function showFacultyPage() {
    showPage('faculty-page');
    
    // Load settings
    try {
        const response = await fetch(`${API_URL}/api/settings`);
        const settings = await response.json();
        updateDailyTopic(settings.dailyTopic);
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    
    // Display faculties
    const faculties = [
        { name: "Mexanika-riyaziyyat fakültəsi", icon: "🔢", desc: "Məz. və rir." },
        { name: "Tətbiqi riyaziyyat və kibernetika fakültəsi", icon: "💻", desc: "Tətbiqi rir." },
        { name: "Fizika fakültəsi", icon: "⚛️", desc: "Fizika" },
        { name: "Kimya fakültəsi", icon: "🧪", desc: "Kimya" },
        { name: "Biologiya fakültəsi", icon: "🧬", desc: "Biologiya" },
        { name: "Ekologiya və torpaqşünaslıq fakültəsi", icon: "🌱", desc: "Ekologiya" },
        { name: "Coğrafiya fakültəsi", icon: "🌍", desc: "Coğrafiya" },
        { name: "Geologiya fakültəsi", icon: "⛰️", desc: "Geologiya" },
        { name: "Filologiya fakültəsi", icon: "📖", desc: "Filologiya" },
        { name: "Tarix fakültəsi", icon: "🏛️", desc: "Tarix" },
        { name: "Beynəlxalq münasibətlər və iqtisadiyyat fakültəsi", icon: "💼", desc: "BMİ" },
        { name: "Hüquq fakültəsi", icon: "⚖️", desc: "Hüquq" },
        { name: "Jurnalistika fakültəsi", icon: "📰", desc: "Jurnalistika" },
        { name: "İnformasiya və sənəd menecmenti fakültəsi", icon: "📊", desc: "İSM" },
        { name: "Şərqşünaslıq fakültəsi", icon: "🕌", desc: "Şərqşünaslıq" },
        { name: "Sosial elmlər və psixologiya fakültəsi", icon: "🧠", desc: "SEP" }
    ];
    
    const facultyGrid = document.getElementById('faculty-grid');
    facultyGrid.innerHTML = faculties.map(f => `
        <div class="faculty-card" onclick="joinFaculty('${f.name}')">
            <div class="icon">${f.icon}</div>
            <h3>${f.desc}</h3>
            <p>Chat otağı</p>
        </div>
    `).join('');
}

function updateDailyTopic(topic) {
    document.getElementById('daily-topic').textContent = topic || '';
    document.getElementById('chat-daily-topic').textContent = topic || '';
}

async function joinFaculty(faculty) {
    currentFaculty = faculty;
    document.getElementById('chat-title').textContent = faculty;
    showPage('chat-page');
    
    // Join socket room
    socket.emit('join-faculty', faculty);
    
    // Load messages
    try {
        const token = localStorage.getItem('userToken');
        const response = await fetch(`${API_URL}/api/messages/group/${encodeURIComponent(faculty)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const messages = await response.json();
        
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        messages.forEach(msg => appendMessage(msg));
        scrollToBottom();
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function backToFacultyList() {
    currentFaculty = null;
    showFacultyPage();
}

// Messaging
function appendMessage(message) {
    const container = document.getElementById('messages-container');
    const time = new Date(message.createdAt).toLocaleTimeString('az-AZ', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.innerHTML = `
        <img src="${message.senderId.profilePicture || '/default-avatar.png'}" alt="Avatar" class="message-avatar">
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender">${message.senderId.fullName}</span>
                <button class="message-menu" onclick="showUserMenu('${message.senderId._id}')">⋮</button>
            </div>
            <div class="message-info">${message.senderId.faculty} - ${message.senderId.degree} - ${message.senderId.course}-ci kurs</div>
            <div class="message-text">${message.content}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    scrollToBottom();
}

function scrollToBottom() {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (!content) return;
    
    const token = localStorage.getItem('userToken');
    socket.emit('send-group-message', {
        token,
        faculty: currentFaculty,
        content
    });
    
    input.value = '';
}

// User menu
function showUserMenu(userId) {
    selectedUser = userId;
    
    // Fetch user details
    fetch(`${API_URL}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` }
    }).then(res => res.json()).then(user => {
        // For now, show menu with basic info
        document.getElementById('menu-user-name').textContent = 'İstifadəçi';
        document.getElementById('menu-user-info').textContent = 'Məlumat yüklənir...';
        document.getElementById('user-menu-modal').classList.add('active');
    });
}

function closeUserMenu() {
    document.getElementById('user-menu-modal').classList.remove('active');
    selectedUser = null;
}

async function startPrivateChat() {
    closeUserMenu();
    alert('Şəxsi chat funksiyası tezliklə əlavə ediləcək');
}

async function blockUser() {
    if (!selectedUser) return;
    
    try {
        const token = localStorage.getItem('userToken');
        const response = await fetch(`${API_URL}/api/user/block/${selectedUser}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        alert(data.message);
        closeUserMenu();
    } catch (error) {
        console.error('Block error:', error);
        alert('Server xətası');
    }
}

async function reportUser() {
    if (!selectedUser) return;
    
    const reason = prompt('Şikayət səbəbini daxil edin:');
    if (!reason) return;
    
    try {
        const token = localStorage.getItem('userToken');
        const response = await fetch(`${API_URL}/api/user/report/${selectedUser}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        
        const data = await response.json();
        alert(data.message);
        closeUserMenu();
    } catch (error) {
        console.error('Report error:', error);
        alert('Server xətası');
    }
}

// Profile
function showProfile() {
    showPage('profile-page');
    
    // Load current user data
    document.getElementById('profile-fullname').value = currentUser.fullName;
    document.getElementById('profile-faculty').value = currentUser.faculty;
    document.getElementById('profile-degree').value = currentUser.degree;
    document.getElementById('profile-course').value = currentUser.course;
    
    if (currentUser.profilePicture) {
        document.getElementById('profile-picture').src = currentUser.profilePicture;
    }
}

function closeProfile() {
    showFacultyPage();
}

function uploadProfilePicture() {
    document.getElementById('profile-picture-input').click();
}

async function handleProfilePictureUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('profilePicture', file);
    
    try {
        const token = localStorage.getItem('userToken');
        const response = await fetch(`${API_URL}/api/upload-profile-picture`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser.profilePicture = data.profilePicture;
            document.getElementById('profile-picture').src = data.profilePicture;
            alert('Profil şəkli yeniləndi');
        } else {
            alert(data.message || 'Yükləmə uğursuz oldu');
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Server xətası');
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const token = localStorage.getItem('userToken');
        const response = await fetch(`${API_URL}/api/user/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fullName: formData.get('fullName'),
                faculty: formData.get('faculty'),
                degree: formData.get('degree'),
                course: parseInt(formData.get('course'))
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            alert('Profil yeniləndi');
            showFacultyPage();
        } else {
            alert(data.message || 'Yeniləmə uğursuz oldu');
        }
    } catch (error) {
        console.error('Profile update error:', error);
        alert('Server xətası');
    }
}

// Rules
async function showRules() {
    try {
        const response = await fetch(`${API_URL}/api/settings`);
        const settings = await response.json();
        
        document.getElementById('rules-content').innerHTML = `<p>${settings.rules.replace(/\n/g, '<br>')}</p>`;
        document.getElementById('rules-modal').classList.add('active');
    } catch (error) {
        console.error('Error loading rules:', error);
    }
}

function closeRules() {
    document.getElementById('rules-modal').classList.remove('active');
}

// Admin Panel
async function showAdminPanel() {
    showPage('admin-page');
    
    // Show subadmin menu only for super admin
    if (currentAdmin.isSuperAdmin) {
        document.getElementById('subadmin-menu').style.display = 'block';
    }
    
    // Load users
    loadAdminUsers();
    
    // Load settings
    loadAdminSettings();
}

function showAdminSection(section) {
    document.querySelectorAll('.admin-menu-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
    
    event.target.closest('.admin-menu-btn').classList.add('active');
    document.getElementById(`admin-${section}`).classList.add('active');
    
    if (section === 'statistics') {
        loadAdminUsers();
    } else if (section === 'reports') {
        loadReportedUsers();
    } else if (section === 'subadmins') {
        loadSubAdmins();
    }
}

async function loadAdminUsers() {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const users = await response.json();
        
        // Update statistics
        document.getElementById('total-users').textContent = users.length;
        document.getElementById('active-users').textContent = users.filter(u => u.isActive).length;
        
        // Display users
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = users.map(user => `
            <div class="user-row ${!user.isActive ? 'inactive' : ''}">
                <div class="user-row-info">
                    <strong>${user.fullName}</strong>
                    <span>${user.email} | ${user.phone}</span><br>
                    <span>${user.faculty} | ${user.degree} | ${user.course}-ci kurs</span>
                </div>
                <button class="toggle-btn ${user.isActive ? 'deactivate' : ''}" onclick="toggleUserStatus('${user._id}', ${user.isActive})">
                    ${user.isActive ? 'Deaktiv et' : 'Aktiv et'}
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function toggleUserStatus(userId, currentStatus) {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/api/admin/users/${userId}/toggle-active`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        alert(data.message);
        loadAdminUsers();
    } catch (error) {
        console.error('Error toggling user status:', error);
        alert('Server xətası');
    }
}

async function loadReportedUsers() {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/api/admin/reported-users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const users = await response.json();
        
        const reportedList = document.getElementById('reported-users-list');
        if (users.length === 0) {
            reportedList.innerHTML = '<p class="loading">Şikayət edilən hesab yoxdur</p>';
        } else {
            reportedList.innerHTML = users.map(user => `
                <div class="user-row">
                    <div class="user-row-info">
                        <strong>${user.fullName}</strong>
                        <span>${user.email} | Şikayət sayı: ${user.reportCount}</span><br>
                        <span>${user.faculty} | ${user.degree} | ${user.course}-ci kurs</span>
                    </div>
                    <button class="toggle-btn deactivate" onclick="toggleUserStatus('${user._id}', true)">
                        Deaktiv et
                    </button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading reported users:', error);
    }
}

async function loadAdminSettings() {
    try {
        const response = await fetch(`${API_URL}/api/settings`);
        const settings = await response.json();
        
        document.getElementById('rules-text').value = settings.rules;
        document.getElementById('daily-topic-input').value = settings.dailyTopic;
        document.getElementById('filter-words').value = settings.filterWords.join('\n');
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveRules() {
    const rules = document.getElementById('rules-text').value;
    
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/api/admin/settings`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ rules })
        });
        
        if (response.ok) {
            alert('Qaydalar yeniləndi');
        } else {
            alert('Yeniləmə uğursuz oldu');
        }
    } catch (error) {
        console.error('Error saving rules:', error);
        alert('Server xətası');
    }
}

async function saveDailyTopic() {
    const dailyTopic = document.getElementById('daily-topic-input').value;
    
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/api/admin/settings`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ dailyTopic })
        });
        
        if (response.ok) {
            alert('Günün mövzusu yeniləndi');
        } else {
            alert('Yeniləmə uğursuz oldu');
        }
    } catch (error) {
        console.error('Error saving daily topic:', error);
        alert('Server xətası');
    }
}

async function saveFilterWords() {
    const filterWordsText = document.getElementById('filter-words').value;
    const filterWords = filterWordsText.split('\n').filter(w => w.trim());
    
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/api/admin/settings`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filterWords })
        });
        
        if (response.ok) {
            alert('Filtr sözləri yeniləndi');
        } else {
            alert('Yeniləmə uğursuz oldu');
        }
    } catch (error) {
        console.error('Error saving filter words:', error);
        alert('Server xətası');
    }
}

async function handleCreateSubAdmin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/api/admin/sub-admin`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: formData.get('username'),
                password: formData.get('password')
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(data.message);
            e.target.reset();
            loadSubAdmins();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error creating sub admin:', error);
        alert('Server xətası');
    }
}

async function loadSubAdmins() {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/api/admin/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const admins = await response.json();
        const subAdmins = admins.filter(a => !a.isSuperAdmin);
        
        const subAdminsList = document.getElementById('subadmins-list');
        if (subAdmins.length === 0) {
            subAdminsList.innerHTML = '<p class="loading">Alt admin yoxdur</p>';
        } else {
            subAdminsList.innerHTML = subAdmins.map(admin => `
                <div class="subadmin-item">
                    <div>
                        <strong>${admin.username}</strong><br>
                        <span style="font-size: 12px; color: #666;">Yaradılma: ${new Date(admin.createdAt).toLocaleDateString('az-AZ')}</span>
                    </div>
                    <button class="delete-btn" onclick="deleteSubAdmin('${admin._id}')">Sil</button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading sub admins:', error);
    }
}

async function deleteSubAdmin(adminId) {
    if (!confirm('Alt admini silmək istədiyinizə əminsiniz?')) return;
    
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/api/admin/sub-admin/${adminId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        alert(data.message);
        loadSubAdmins();
    } catch (error) {
        console.error('Error deleting sub admin:', error);
        alert('Server xətası');
    }
}
