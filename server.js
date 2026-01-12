const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
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

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bsu-chat';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Models
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  fullName: { type: String, required: true },
  faculty: { type: String, required: true },
  degree: { type: String, required: true },
  course: { type: Number, required: true, min: 1, max: 6 },
  password: { type: String, required: true },
  profilePicture: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  facultyId: { type: String },
  content: { type: String, required: true },
  type: { type: String, enum: ['group', 'private'], required: true },
  createdAt: { type: Date, default: Date.now }
});

const reportSchema = new mongoose.Schema({
  reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isSuperAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const settingsSchema = new mongoose.Schema({
  rules: { type: String, default: 'Qaydalar buraya yazılacaq.' },
  dailyTopic: { type: String, default: '' },
  filterWords: [{ type: String }],
  groupMessageExpiry: { type: Number, default: 24 }, // hours
  privateMessageExpiry: { type: Number, default: 48 } // hours
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const Report = mongoose.model('Report', reportSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Settings = mongoose.model('Settings', settingsSchema);

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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

// Faculties list
const faculties = [
  "Mexanika-riyaziyyat fakültəsi",
  "Tətbiqi riyaziyyat və kibernetika fakültəsi",
  "Fizika fakültəsi",
  "Kimya fakültəsi",
  "Biologiya fakültəsi",
  "Ekologiya və torpaqşünaslıq fakültəsi",
  "Coğrafiya fakültəsi",
  "Geologiya fakültəsi",
  "Filologiya fakültəsi",
  "Tarix fakültəsi",
  "Beynəlxalq münasibətlər və iqtisadiyyat fakültəsi",
  "Hüquq fakültəsi",
  "Jurnalistika fakültəsi",
  "İnformasiya və sənəd menecmenti fakültəsi",
  "Şərqşünaslıq fakültəsi",
  "Sosial elmlər və psixologiya fakültəsi"
];

// Initialize super admin
async function initializeSuperAdmin() {
  try {
    const existingAdmin = await Admin.findOne({ username: '618ursamajor618' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('618ursa618', 10);
      await Admin.create({
        username: '618ursamajor618',
        password: hashedPassword,
        isSuperAdmin: true
      });
      console.log('Super admin created');
    }
  } catch (error) {
    console.error('Error creating super admin:', error);
  }
}

// Initialize settings
async function initializeSettings() {
  try {
    const existingSettings = await Settings.findOne();
    if (!existingSettings) {
      await Settings.create({});
      console.log('Settings initialized');
    }
  } catch (error) {
    console.error('Error initializing settings:', error);
  }
}

initializeSuperAdmin();
initializeSettings();

// Helper function to get Baku time
function getBakuTime() {
  const date = new Date();
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const bakuTime = new Date(utc + (3600000 * 4)); // UTC+4 for Baku
  return bakuTime;
}

// Helper function to filter profanity
async function filterProfanity(text) {
  const settings = await Settings.findOne();
  if (!settings || !settings.filterWords.length) return text;
  
  let filteredText = text;
  settings.filterWords.forEach(word => {
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
    
    // Validate email domain
    if (!email.endsWith('@bsu.edu.az')) {
      return res.status(400).json({ message: 'Yalnız @bsu.edu.az domeni ilə qeydiyyat mümkündür' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      if (!existingUser.isActive) {
        return res.status(403).json({ message: 'Bu hesab deaktiv edilib' });
      }
      return res.status(400).json({ message: 'Bu email və ya telefon nömrəsi artıq istifadə olunub' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await User.create({
      email,
      phone,
      fullName,
      faculty,
      degree,
      course,
      password: hashedPassword
    });
    
    // Generate token
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
    
    const user = await User.findOne({ email });
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
    
    const admin = await Admin.findOne({ username });
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
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(403).json({ message: 'İstifadəçi aktiv deyil' });
      }
      req.user = user;
    } else if (decoded.adminId) {
      const admin = await Admin.findById(decoded.adminId);
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
    
    const user = await User.findById(req.user._id);
    user.profilePicture = '/uploads/' + req.file.filename;
    await user.save();
    
    res.json({ profilePicture: user.profilePicture });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Get user profile
app.get('/api/user/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Update user profile
app.put('/api/user/profile', verifyToken, async (req, res) => {
  try {
    const { fullName, faculty, degree, course } = req.body;
    
    const user = await User.findById(req.user._id);
    if (fullName) user.fullName = fullName;
    if (faculty) user.faculty = faculty;
    if (degree) user.degree = degree;
    if (course) user.course = course;
    
    await user.save();
    
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
    const user = await User.findById(req.user._id);
    const targetUserId = req.params.userId;
    
    if (!user.blockedUsers.includes(targetUserId)) {
      user.blockedUsers.push(targetUserId);
      await user.save();
    }
    
    res.json({ message: 'İstifadəçi əngəlləndi' });
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Unblock user
app.post('/api/user/unblock/:userId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== req.params.userId);
    await user.save();
    
    res.json({ message: 'Əngəl qaldırıldı' });
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Report user
app.post('/api/user/report/:userId', verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;
    await Report.create({
      reportedUserId: req.params.userId,
      reporterId: req.user._id,
      reason
    });
    
    res.json({ message: 'Şikayət göndərildi' });
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Get group messages
app.get('/api/messages/group/:faculty', verifyToken, async (req, res) => {
  try {
    const messages = await Message.find({
      type: 'group',
      facultyId: req.params.faculty
    })
    .populate('senderId', 'fullName faculty degree course profilePicture')
    .sort({ createdAt: 1 })
    .limit(100);
    
    // Filter out messages from blocked users
    const filteredMessages = messages.filter(msg => 
      !req.user.blockedUsers.includes(msg.senderId._id.toString())
    );
    
    res.json(filteredMessages);
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Get private messages
app.get('/api/messages/private/:userId', verifyToken, async (req, res) => {
  try {
    const messages = await Message.find({
      type: 'private',
      $or: [
        { senderId: req.user._id, receiverId: req.params.userId },
        { senderId: req.params.userId, receiverId: req.user._id }
      ]
    })
    .populate('senderId', 'fullName faculty degree course profilePicture')
    .populate('receiverId', 'fullName faculty degree course profilePicture')
    .sort({ createdAt: 1 })
    .limit(100);
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Get settings
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await Settings.findOne();
    res.json(settings);
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
    
    const users = await User.find().select('-password').sort({ createdAt: -1 });
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
    
    const user = await User.findById(req.params.userId);
    user.isActive = !user.isActive;
    await user.save();
    
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
    
    const reports = await Report.aggregate([
      {
        $group: {
          _id: '$reportedUserId',
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gte: 16 } }
      }
    ]);
    
    const reportedUserIds = reports.map(r => r._id);
    const users = await User.find({ _id: { $in: reportedUserIds } }).select('-password');
    
    const usersWithReportCount = users.map(user => {
      const report = reports.find(r => r._id.toString() === user._id.toString());
      return {
        ...user.toObject(),
        reportCount: report.count
      };
    });
    
    res.json(usersWithReportCount);
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
    
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    
    if (rules !== undefined) settings.rules = rules;
    if (dailyTopic !== undefined) settings.dailyTopic = dailyTopic;
    if (filterWords !== undefined) settings.filterWords = filterWords;
    if (groupMessageExpiry !== undefined) settings.groupMessageExpiry = groupMessageExpiry;
    if (privateMessageExpiry !== undefined) settings.privateMessageExpiry = privateMessageExpiry;
    
    await settings.save();
    
    // Broadcast settings update to all connected clients
    io.emit('settings-updated', settings);
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Admin: Create sub-admin (only super admin)
app.post('/api/admin/sub-admin', verifyToken, async (req, res) => {
  try {
    if (!req.admin || !req.admin.isSuperAdmin) {
      return res.status(403).json({ message: 'Yetkisiz giriş' });
    }
    
    const { username, password } = req.body;
    
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Bu istifadəçi adı artıq mövcuddur' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await Admin.create({
      username,
      password: hashedPassword,
      isSuperAdmin: false
    });
    
    res.status(201).json({ message: 'Alt admin yaradıldı', admin: { id: admin._id, username: admin.username } });
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Admin: Delete sub-admin (only super admin)
app.delete('/api/admin/sub-admin/:adminId', verifyToken, async (req, res) => {
  try {
    if (!req.admin || !req.admin.isSuperAdmin) {
      return res.status(403).json({ message: 'Yetkisiz giriş' });
    }
    
    const admin = await Admin.findById(req.params.adminId);
    if (!admin) {
      return res.status(404).json({ message: 'Admin tapılmadı' });
    }
    
    if (admin.isSuperAdmin) {
      return res.status(400).json({ message: 'Super admin silinə bilməz' });
    }
    
    await Admin.findByIdAndDelete(req.params.adminId);
    res.json({ message: 'Alt admin silindi' });
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Admin: Get all admins (only super admin)
app.get('/api/admin/list', verifyToken, async (req, res) => {
  try {
    if (!req.admin || !req.admin.isSuperAdmin) {
      return res.status(403).json({ message: 'Yetkisiz giriş' });
    }
    
    const admins = await Admin.find().select('-password');
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: 'Server xətası' });
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join faculty room
  socket.on('join-faculty', (faculty) => {
    socket.join(faculty);
    console.log(`User ${socket.id} joined faculty: ${faculty}`);
  });
  
  // Send group message
  socket.on('send-group-message', async (data) => {
    try {
      const { token, faculty, content } = data;
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user || !user.isActive) {
        return;
      }
      
      // Filter profanity
      const filteredContent = await filterProfanity(content);
      
      const message = await Message.create({
        senderId: user._id,
        facultyId: faculty,
        content: filteredContent,
        type: 'group'
      });
      
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'fullName faculty degree course profilePicture');
      
      io.to(faculty).emit('new-group-message', populatedMessage);
    } catch (error) {
      console.error('Send group message error:', error);
    }
  });
  
  // Send private message
  socket.on('send-private-message', async (data) => {
    try {
      const { token, receiverId, content } = data;
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      const receiver = await User.findById(receiverId);
      
      if (!user || !user.isActive || !receiver) {
        return;
      }
      
      // Check if blocked
      if (receiver.blockedUsers.includes(user._id.toString())) {
        return;
      }
      
      // Filter profanity
      const filteredContent = await filterProfanity(content);
      
      const message = await Message.create({
        senderId: user._id,
        receiverId: receiverId,
        content: filteredContent,
        type: 'private'
      });
      
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'fullName faculty degree course profilePicture')
        .populate('receiverId', 'fullName faculty degree course profilePicture');
      
      // Send to both sender and receiver
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
    const settings = await Settings.findOne();
    if (!settings) return;
    
    const groupExpiryDate = new Date(Date.now() - settings.groupMessageExpiry * 60 * 60 * 1000);
    const privateExpiryDate = new Date(Date.now() - settings.privateMessageExpiry * 60 * 60 * 1000);
    
    await Message.deleteMany({
      type: 'group',
      createdAt: { $lt: groupExpiryDate }
    });
    
    await Message.deleteMany({
      type: 'private',
      createdAt: { $lt: privateExpiryDate }
    });
    
    console.log('Message cleanup completed');
  } catch (error) {
    console.error('Message cleanup error:', error);
  }
}, 60 * 60 * 1000); // Run every hour

// Serve static files
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
