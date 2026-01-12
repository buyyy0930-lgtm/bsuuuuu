# BSU Chat

Bakı Dövlət Universiteti tələbələri üçün real-time chat sistemi.

## Xüsusiyyətlər

- ✅ Email doğrulama (@bsu.edu.az)
- ✅ Telefon nömrəsi ilə qeydiyyat
- ✅ 3 sualdan minimum 2-nə doğru cavab verməklə doğrulama
- ✅ 16 fakültə üçün ayrıca chat otaqları
- ✅ Real-time mesajlaşma (Socket.IO)
- ✅ Profil şəkli yükləmə
- ✅ İstifadəçiləri əngəlləmə
- ✅ Şikayət sistemi
- ✅ Admin paneli
- ✅ Qaydalar sistemi
- ✅ Günün mövzusu
- ✅ Söz filtri
- ✅ Mesajların avtomatik silinməsi
- ✅ Alt admin yaratma (super admin)

## Texnologiyalar

- **Backend**: Node.js, Express, Socket.IO
- **Database**: MongoDB
- **Authentication**: JWT, bcrypt
- **Frontend**: Vanilla JavaScript, CSS3
- **File Upload**: Multer

## Quraşdırma

1. Repository-ni klonlayın
2. Dependencies quraşdırın: `npm install`
3. MongoDB başladın
4. `.env` faylını konfiqurasiya edin
5. Serveri başladın: `npm start`

## Environment Variables

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/bsu-chat
JWT_SECRET=your-secret-key
```

## Admin Girişi

- **İstifadəçi adı**: 618ursamajor618
- **Şifrə**: 618ursa618

## Deployment

Render.com üçün hazırdır. `start` script və PORT environment variable konfiqurasiya edilib.

## Lisenziya

ISC
