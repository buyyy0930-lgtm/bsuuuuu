# BSU Chat - Bakı Dövlət Universiteti Chat Sistemi

Real-time mesajlaşma platforması BSU tələbələri üçün.

## 🌐 Canlı Demo

**Sandbox URL:** https://3000-i7kh0g94gzf6iktgtlqbm-cc2fbc16.sandbox.novita.ai

## ✨ Xüsusiyyətlər

### 🔐 Authentication & Qeydiyyat
- ✅ Email doğrulama (@bsu.edu.az domain)
- ✅ Telefon nömrəsi (+994 prefix)
- ✅ 3 sualdan minimum 2 doğru cavab verməklə doğrulama
- ✅ JWT authentication

### 💬 Mesajlaşma
- ✅ 16 fakültə üçün ayrıca qrup chat otaqları
- ✅ Real-time mesajlaşma (Socket.IO)
- ✅ Mesajlarda istifadəçi məlumatları (ad, fakültə, dərəcə, kurs)
- ✅ Üç nöqtə menyu (şəxsi chat, əngəlləmə, şikayət)
- ✅ Söz filtri sistemi
- ✅ Avtomatik mesaj silinməsi

### 👤 Profil
- ✅ Profil şəkli yükləmə
- ✅ Məlumat redaktəsi
- ✅ İstifadəçi əngəlləmə
- ✅ Şikayət sistemi

### ⚙️ Admin Paneli
- ✅ Super admin: **618ursamajor618** / **618ursa618**
- ✅ İstifadəçi statistikası
- ✅ Aktiv/Deaktiv etmə
- ✅ Qaydalar idarəetməsi
- ✅ Günün mövzusu
- ✅ Söz filtri
- ✅ 16+ şikayəti olan hesablar
- ✅ Alt admin yaratma (super admin)

### 🎨 Dizayn
- ✅ Mobil optimizasiya (360-430px)
- ✅ Gradient fondlar
- ✅ Modern, minimalist interfeys
- ✅ Smooth animasiyalar

## 🚀 Quraşdırma

### Local Development

```bash
# Repository-ni klonlayın
git clone https://github.com/buyyy0930-lgtm/bsuuuuu.git
cd bsuuuuu

# Dependencies quraşdırın
npm install

# Serveri başladın
npm start
```

Server http://localhost:3000 ünvanında işə düşəcək.

## 🌍 Deployment

### Render.com

1. **GitHub hesabınızı Render-ə bağlayın**
2. **New Web Service** yaradın
3. **Repository seçin**: `buyyy0930-lgtm/bsuuuuu`
4. **Parametrlər**:
   - **Name**: bsu-chat
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. **Deploy**

**Qeyd**: Bu versiya in-memory database istifadə edir. MongoDB lazım deyil!

### Environment Variables

```env
PORT=3000
JWT_SECRET=bsu-chat-secret-key-2024
```

## 📱 İstifadə

### İstifadəçi Girişi
1. **Qeydiyyat**: Email (@bsu.edu.az), telefon, fakültə, dərəcə, kurs
2. **Doğrulama**: 3 sualdan 2-nə doğru cavab
3. **Chat**: Fakültə seçimi və mesajlaşma

### Admin Girişi
1. **Admin Paneli** tab-a keçin
2. **Giriş məlumatları**:
   - İstifadəçi adı: `618ursamajor618`
   - Şifrə: `618ursa618`

## 🏗️ Texnologiyalar

- **Backend**: Node.js, Express.js
- **Real-time**: Socket.IO
- **Database**: In-Memory (deployment-ready)
- **Authentication**: JWT, bcrypt
- **File Upload**: Multer
- **Frontend**: Vanilla JavaScript, CSS3, HTML5

## 📂 Struktur

```
bsuuuuu/
├── server.js           # Main server file
├── public/             # Frontend files
│   ├── index.html      # Main HTML
│   ├── styles.css      # Styles
│   ├── app.js          # Frontend JavaScript
│   └── default-avatar.svg
├── uploads/            # User profile pictures
├── .env                # Environment variables
├── package.json        # Dependencies
└── README.md           # Documentation
```

## 🔧 Xüsusiyyətlər

### Fakültələr
1. Mexanika-riyaziyyat fakültəsi
2. Tətbiqi riyaziyyat və kibernetika fakültəsi
3. Fizika fakültəsi
4. Kimya fakültəsi
5. Biologiya fakültəsi
6. Ekologiya və torpaqşünaslıq fakültəsi
7. Coğrafiya fakültəsi
8. Geologiya fakültəsi
9. Filologiya fakültəsi
10. Tarix fakültəsi
11. Beynəlxalq münasibətlər və iqtisadiyyat fakültəsi
12. Hüquq fakültəsi
13. Jurnalistika fakültəsi
14. İnformasiya və sənəd menecmenti fakültəsi
15. Şərqşünaslıq fakültəsi
16. Sosial elmlər və psixologiya fakültəsi

## 📊 API Endpoints

### Authentication
- `POST /api/register` - Qeydiyyat
- `POST /api/login` - Giriş
- `POST /api/admin/login` - Admin girişi
- `GET /api/verification-questions` - Doğrulama sualları
- `POST /api/verify-answers` - Cavabları yoxla

### User
- `GET /api/user/profile` - Profil məlumatları
- `PUT /api/user/profile` - Profil yenilə
- `POST /api/upload-profile-picture` - Şəkil yüklə
- `POST /api/user/block/:userId` - İstifadəçini əngəllə
- `POST /api/user/report/:userId` - Şikayət et

### Messages
- `GET /api/messages/group/:faculty` - Qrup mesajları
- `GET /api/messages/private/:userId` - Şəxsi mesajlar

### Admin
- `GET /api/admin/users` - Bütün istifadəçilər
- `PUT /api/admin/users/:userId/toggle-active` - Status dəyiş
- `GET /api/admin/reported-users` - Şikayət edilənlər
- `PUT /api/admin/settings` - Parametrlər yenilə
- `POST /api/admin/sub-admin` - Alt admin yarat
- `DELETE /api/admin/sub-admin/:adminId` - Alt admin sil

### Settings
- `GET /api/settings` - Parametrlər

## 🔒 Təhlükəsizlik

- ✅ JWT tokenləri
- ✅ Bcrypt şifrələmə
- ✅ Email domain yoxlanması
- ✅ File upload məhdudiyyətləri
- ✅ CORS konfiqurasiyası
- ✅ XSS protection

## 📝 Lisenziya

ISC

## 👥 Əlaqə

Suallar üçün repository-nin Issues bölməsindən istifadə edin.

---

**Hazırlanma tarixi**: Yanvar 2026  
**Status**: ✅ Production Ready
