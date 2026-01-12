const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// In-Memory Database
const db = {
  users: [],
  messages: [],
  reports: [],
  admins: [],
  settings: {
    rules: 'Qaydalar buraya yazılacaq.',
    dailyTopic: '',
    filterWords: [],
    groupMessageExpiry: 24,
    privateMessageExpiry: 48
  }
};

// Helper functions for ID generation
function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'bsu-chat-secret-key-2024';

// Verification questions and answers
const verificationQuestions = [
  { question: "Mexanika-riyaziyyat fakültəsi hansı korpusda yerləşir?", answer: "3" },
  { question: "Tətbiqi riyaziyyat və kibernetika fakültəsi hansı korpusda yerləşir?", answer: "3" },
  { question: "Fizika fakültəsi hansı korpusda yerləşir?", answer: "əsas" },
  { question: "Kimya fakültəsi hansı korpusda yerləşir?", answer: "əsas" },
  { question: "Biologiya fakültəsi hansı korpusda yerləşir?", answer: "əsas" },
  { question: "Ekologiya və torpaqşünaslıq fakültəsi hansı korpusda yerləşir?", answer: "əsas" },
  { question: "Coğrafiya fakültəsi hansı korpusda yerləşir?", answer: "əsas" },
  { question: "Geologiya fakültəsi hansı korpusda yerləşir?", answer: "əsas" },
  { question: "Filologiya fakültəsi hansı korpusda yerləşir?", answer: "1" },
  { question: "Tarix fakültəsi hansı korpusda yerləşir?", answer: "3" },
  { question: "Beynəlxalq münasibətlər və iqtisadiyyat fakültəsi hansı korpusda yerləşir?", answer: "1" },
  { question: "Hüquq fakültəsi hansı korpusda yerləşir?", answer: "1" },
  { question: "Jurnalistika fakültəsi hansı korpusda yerləşir?", answer: "2" },
  { question: "İnformasiya və sənəd menecmenti fakültəsi hansı korpusda yerləşir?", answer: "2" },
  { question: "Şərqşünaslıq fakültəsi hansı korpusda yerləşir?", answer: "2" },
  { question: "Sosial elmlər və psixologiya fakültəsi hansı korpusda yerləşir?", answer: "2" }
];

// Initialize super admin
async function initializeSuperAdmin() {
  try {
    const existingAdmin = db.admins.find(a => a.username === '618ursamajor618');
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('618ursa618', 10);
      db.admins.push({
        _id: generateId(),
        username: '618ursamajor618',
        password: hashedPassword,
        isSuperAdmin: true,
        createdAt: new Date()
      });
      console.log('Super admin created');
    }
  } catch (error) {
    console.error('Error creating super admin:', error);
  }
}

initializeSuperAdmin();

// Helper function to get Baku time
function getBakuTime() {
  const date = new Date();
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const bakuTime = new Date(utc + (3600000 * 4));
  return bakuTime;
}

// Helper function to filter profanity
function filterProfanity(text) {
  if (!db.settings.filterWords.length) return text;
  
  let filteredText = text;
  db.settings.filterWords.forEach(word => {
    const regex = new RegExp(word, 'gi');
    filteredText = filteredText.replace(regex, '*'.repeat(word.length));
  });
  return filteredText;
}

// Routes

// Get verification questions
app.get('/api/verification-questions', (req, res) => {
  const shuffled = [...verificationQuestions].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3);
  res.json(selected.map((q, index) => ({
    id: index,
    question: q.question
  })));
});

// Verify answers
app.post('/api/verify-answers', (req, res) => {
  const { answers } = req.body;
  let correctCount = 0;
  
  answers.forEach(answer => {
    const question = verificationQuestions.find(q => q.question === answer.question);
    if (question && question.answer.toLowerCase() === answer.answer.toLowerCase()) {
      correctCount++;
    }
  });
  
  res.json({ success: correctCount >= 2, correctCount });
});

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { email, phone, fullName, faculty, degree, course, password } = req.body;
    
    if (!email.endsWith('@bsu.edu.az')) {
      return res.status(400).json({ message: 'Yalnız @bsu.edu.az domeni ilə qeydiyyat mümkündür' });
    }
    
    const existingUser = db.users.find(u => u.email === email || u.phone === phone);
    if (existingUser) {
      if (!existingUser.isActive) {
        return res.status(403).json({ message: 'Bu hesab deaktiv edilib' });
      }
      return res.status(400).json({ message: 'Bu email və ya telefon nömrəsi artıq istifadə olunub' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = {
      _id: generateId(),
      email,
      phone,
      fullName,
      faculty,
      degree,
      course,
      password: hashedPassword,
      profilePicture: '',
      isActive: true,
      blockedUsers: [],
      createdAt: new Date()
    };
    
    db.users.push(user);
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.status(201).json({
      message: 'Qeydiyyat uğurlu',
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        faculty: user.faculty,
        degree: user.degree,
        course: user.course,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = db.users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ message: 'İstifadəçi tapılmadı' });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ message: 'Hesabınız deaktiv edilib' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Şifrə yanlışdır' });
    }
    
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        faculty: user.faculty,
        degree: user.degree,
        course: user.course,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const admin = db.admins.find(a => a.username === username);
    if (!admin) {
      return res.status(400).json({ message: 'Admin tapılmadı' });
    }
    
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Şifrə yanlışdır' });
    }
    
    const token = jwt.sign({ adminId: admin._id, isSuperAdmin: admin.isSuperAdmin }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        isSuperAdmin: admin.isSuperAdmin
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Middleware to verify token
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token yoxdur' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.userId) {
      const user = db.users.find(u => u._id === decoded.userId);
      if (!user || !user.isActive) {
        return res.status(403).json({ message: 'İstifadəçi aktiv deyil' });
      }
      req.user = user;
    } else if (decoded.adminId) {
      const admin = db.admins.find(a => a._id === decoded.adminId);
      if (!admin) {
        return res.status(403).json({ message: 'Admin tapılmadı' });
      }
      req.admin = admin;
    }
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token yanlışdır' });
  }
};

// Upload profile picture
app.post('/api/upload-profile-picture', verifyToken, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Şəkil seçilməyib' });
    }
    
    const user = db.users.find(u => u._id === req.user._id);
    user.profilePicture = '/uploads/' + req.file.filename;
    
    res.json({ profilePicture: user.profilePicture });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Get user profile
app.get('/api/user/profile', verifyToken, async (req, res) => {
  try {
    const user = db.users.find(u => u._id === req.user._id);
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Get user by ID
app.get('/api/user/:userId', verifyToken, async (req, res) => {
  try {
    const user = db.users.find(u => u._id === req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'İstifadəçi tapılmadı' });
    }
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Update user profile
app.put('/api/user/profile', verifyToken, async (req, res) => {
  try {
    const { fullName, faculty, degree, course } = req.body;
    
    const user = db.users.find(u => u._id === req.user._id);
    if (fullName) user.fullName = fullName;
    if (faculty) user.faculty = faculty;
    if (degree) user.degree = degree;
    if (course) user.course = course;
    
    res.json({
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        faculty: user.faculty,
        degree: user.degree,
        course: user.course,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Block user
app.post('/api/user/block/:userId', verifyToken, async (req, res) => {
  try {
    const user = db.users.find(u => u._id === req.user._id);
    const targetUserId = req.params.userId;
    
    if (!user.blockedUsers.includes(targetUserId)) {
      user.blockedUsers.push(targetUserId);
    }
    
    res.json({ message: 'İstifadəçi əngəlləndi' });
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Unblock user
app.post('/api/user/unblock/:userId', verifyToken, async (req, res) => {
  try {
    const user = db.users.find(u => u._id === req.user._id);
    user.blockedUsers = user.blockedUsers.filter(id => id !== req.params.userId);
    
    res.json({ message: 'Əngəl qaldırıldı' });
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Report user
app.post('/api/user/report/:userId', verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;
    db.reports.push({
      _id: generateId(),
      reportedUserId: req.params.userId,
      reporterId: req.user._id,
      reason,
      createdAt: new Date()
    });
    
    res.json({ message: 'Şikayət göndərildi' });
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Get group messages
app.get('/api/messages/group/:faculty', verifyToken, async (req, res) => {
  try {
    const messages = db.messages
      .filter(m => m.type === 'group' && m.facultyId === req.params.faculty)
      .map(m => {
        const sender = db.users.find(u => u._id === m.senderId);
        return {
          ...m,
          senderId: {
            _id: sender._id,
            fullName: sender.fullName,
            faculty: sender.faculty,
            degree: sender.degree,
            course: sender.course,
            profilePicture: sender.profilePicture
          }
        };
      })
      .filter(m => !req.user.blockedUsers.includes(m.senderId._id))
      .slice(-100);
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Get private messages
app.get('/api/messages/private/:userId', verifyToken, async (req, res) => {
  try {
    const messages = db.messages
      .filter(m => 
        m.type === 'private' && 
        ((m.senderId === req.user._id && m.receiverId === req.params.userId) ||
         (m.senderId === req.params.userId && m.receiverId === req.user._id))
      )
      .map(m => {
        const sender = db.users.find(u => u._id === m.senderId);
        const receiver = db.users.find(u => u._id === m.receiverId);
        return {
          ...m,
          senderId: {
            _id: sender._id,
            fullName: sender.fullName,
            faculty: sender.faculty,
            degree: sender.degree,
            course: sender.course,
            profilePicture: sender.profilePicture
          },
          receiverId: {
            _id: receiver._id,
            fullName: receiver.fullName,
            faculty: receiver.faculty,
            degree: receiver.degree,
            course: receiver.course,
            profilePicture: receiver.profilePicture
          }
        };
      })
      .slice(-100);
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Get settings
app.get('/api/settings', async (req, res) => {
  try {
    res.json(db.settings);
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Admin: Get all users
app.get('/api/admin/users', verifyToken, async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Yetkisiz giriş' });
    }
    
    const users = db.users.map(u => {
      const { password, ...userWithoutPassword } = u;
      return userWithoutPassword;
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Admin: Toggle user active status
app.put('/api/admin/users/:userId/toggle-active', verifyToken, async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Yetkisiz giriş' });
    }
    
    const user = db.users.find(u => u._id === req.params.userId);
    user.isActive = !user.isActive;
    
    res.json({ message: 'Status dəyişdirildi', isActive: user.isActive });
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Admin: Get reported users
app.get('/api/admin/reported-users', verifyToken, async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Yetkisiz giriş' });
    }
    
    const reportCounts = {};
    db.reports.forEach(r => {
      reportCounts[r.reportedUserId] = (reportCounts[r.reportedUserId] || 0) + 1;
    });
    
    const reportedUsers = Object.entries(reportCounts)
      .filter(([userId, count]) => count >= 16)
      .map(([userId, count]) => {
        const user = db.users.find(u => u._id === userId);
        const { password, ...userWithoutPassword } = user;
        return {
          ...userWithoutPassword,
          reportCount: count
        };
      });
    
    res.json(reportedUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Admin: Update settings
app.put('/api/admin/settings', verifyToken, async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Yetkisiz giriş' });
    }
    
    const { rules, dailyTopic, filterWords, groupMessageExpiry, privateMessageExpiry } = req.body;
    
    if (rules !== undefined) db.settings.rules = rules;
    if (dailyTopic !== undefined) db.settings.dailyTopic = dailyTopic;
    if (filterWords !== undefined) db.settings.filterWords = filterWords;
    if (groupMessageExpiry !== undefined) db.settings.groupMessageExpiry = groupMessageExpiry;
    if (privateMessageExpiry !== undefined) db.settings.privateMessageExpiry = privateMessageExpiry;
    
    io.emit('settings-updated', db.settings);
    
    res.json(db.settings);
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Admin: Create sub-admin
app.post('/api/admin/sub-admin', verifyToken, async (req, res) => {
  try {
    if (!req.admin || !req.admin.isSuperAdmin) {
      return res.status(403).json({ message: 'Yetkisiz giriş' });
    }
    
    const { username, password } = req.body;
    
    const existingAdmin = db.admins.find(a => a.username === username);
    if (existingAdmin) {
      return res.status(400).json({ message: 'Bu istifadəçi adı artıq mövcuddur' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = {
      _id: generateId(),
      username,
      password: hashedPassword,
      isSuperAdmin: false,
      createdAt: new Date()
    };
    
    db.admins.push(admin);
    
    res.status(201).json({ message: 'Alt admin yaradıldı', admin: { id: admin._id, username: admin.username } });
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Admin: Delete sub-admin
app.delete('/api/admin/sub-admin/:adminId', verifyToken, async (req, res) => {
  try {
    if (!req.admin || !req.admin.isSuperAdmin) {
      return res.status(403).json({ message: 'Yetkisiz giriş' });
    }
    
    const admin = db.admins.find(a => a._id === req.params.adminId);
    if (!admin) {
      return res.status(404).json({ message: 'Admin tapılmadı' });
    }
    
    if (admin.isSuperAdmin) {
      return res.status(400).json({ message: 'Super admin silinə bilməz' });
    }
    
    db.admins = db.admins.filter(a => a._id !== req.params.adminId);
    res.json({ message: 'Alt admin silindi' });
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Admin: Get all admins
app.get('/api/admin/list', verifyToken, async (req, res) => {
  try {
    if (!req.admin || !req.admin.isSuperAdmin) {
      return res.status(403).json({ message: 'Yetkisiz giriş' });
    }
    
    const admins = db.admins.map(a => {
      const { password, ...adminWithoutPassword } = a;
      return adminWithoutPassword;
    });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-faculty', (faculty) => {
    socket.join(faculty);
    console.log(`User ${socket.id} joined faculty: ${faculty}`);
  });
  
  socket.on('send-group-message', async (data) => {
    try {
      const { token, faculty, content } = data;
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.users.find(u => u._id === decoded.userId);
      
      if (!user || !user.isActive) {
        return;
      }
      
      const filteredContent = filterProfanity(content);
      
      const message = {
        _id: generateId(),
        senderId: user._id,
        facultyId: faculty,
        content: filteredContent,
        type: 'group',
        createdAt: new Date()
      };
      
      db.messages.push(message);
      
      const populatedMessage = {
        ...message,
        senderId: {
          _id: user._id,
          fullName: user.fullName,
          faculty: user.faculty,
          degree: user.degree,
          course: user.course,
          profilePicture: user.profilePicture
        }
      };
      
      io.to(faculty).emit('new-group-message', populatedMessage);
    } catch (error) {
      console.error('Send group message error:', error);
    }
  });
  
  socket.on('send-private-message', async (data) => {
    try {
      const { token, receiverId, content } = data;
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.users.find(u => u._id === decoded.userId);
      const receiver = db.users.find(u => u._id === receiverId);
      
      if (!user || !user.isActive || !receiver) {
        return;
      }
      
      if (receiver.blockedUsers.includes(user._id)) {
        return;
      }
      
      const filteredContent = filterProfanity(content);
      
      const message = {
        _id: generateId(),
        senderId: user._id,
        receiverId: receiverId,
        content: filteredContent,
        type: 'private',
        createdAt: new Date()
      };
      
      db.messages.push(message);
      
      const populatedMessage = {
        ...message,
        senderId: {
          _id: user._id,
          fullName: user.fullName,
          faculty: user.faculty,
          degree: user.degree,
          course: user.course,
          profilePicture: user.profilePicture
        },
        receiverId: {
          _id: receiver._id,
          fullName: receiver.fullName,
          faculty: receiver.faculty,
          degree: receiver.degree,
          course: receiver.course,
          profilePicture: receiver.profilePicture
        }
      };
      
      socket.emit('new-private-message', populatedMessage);
      socket.to(receiverId).emit('new-private-message', populatedMessage);
    } catch (error) {
      console.error('Send private message error:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Message cleanup job
setInterval(async () => {
  try {
    const groupExpiryDate = new Date(Date.now() - db.settings.groupMessageExpiry * 60 * 60 * 1000);
    const privateExpiryDate = new Date(Date.now() - db.settings.privateMessageExpiry * 60 * 60 * 1000);
    
    db.messages = db.messages.filter(m => {
      if (m.type === 'group' && m.createdAt < groupExpiryDate) {
        return false;
      }
      if (m.type === 'private' && m.createdAt < privateExpiryDate) {
        return false;
      }
      return true;
    });
    
    console.log('Message cleanup completed');
  } catch (error) {
    console.error('Message cleanup error:', error);
  }
}, 60 * 60 * 1000);

// Serve index.html for all unmatched routes (SPA fallback)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
