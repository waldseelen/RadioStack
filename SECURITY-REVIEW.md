# RadioStack — Güvenlik İncelemesi ve Yapılacaklar

> **Tarih:** 2026-07-05
> **Durum:** İnceleme tamamlandı, aksiyonlar **beklemede** (kullanıcı isteğiyle ertelendi).
> **Kapsam:** Deploy edilmiş RadioStack (`radio-stack` → radio-stack-waldseelens-projects.vercel.app), Firebase projesi `radiostack-dev-67a8`.
> **Repo:** github.com/waldseelen/RadioStack — **PUBLIC** (commit edilen her şey herkese açık).

Bu dosya, RadioStack güvenlik incelemesinin tüm bağlamını içerir. Konu ileride ele alınacağı
için hiçbir bilgi kaybolmasın diye tam olarak burada belgelenmiştir.

---

## 1. Özet ve Doğrulanmış Gerçekler

İnceleme sırasında canlı sistem üzerinde şu gerçekler **doğrulandı**:

| # | Gerçek | Nasıl doğrulandı |
|---|--------|------------------|
| A | **Email/password girişi proje düzeyinde KAPALI** | `identitytoolkit.../accounts:signInWithPassword` çağrısı `PASSWORD_LOGIN_DISABLED` döndü |
| B | **Vercel'de hiçbir Firebase Admin credential'ı YOK** | `vercel env ls` (radio-stack) yalnızca `DATABASE_URL` gösteriyor — `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` yok |
| C | **Admin kimliği = `email === 'admin@radiostack.com'`** | `src/stores/auth-store.ts:34` |
| D | **Uygulama client-side Firestore kullanıyor** | `src/lib/firebase-client.ts` (`getFirestore`), `auth-store.ts` (`onSnapshot`) |
| E | **`create_admin.js` + `init_auth.js` public git geçmişinde** | Tek commit: `0f03fef` |
| F | **Firebase web API key** `AIzaSyCpdDMnsHHl1tegwWRX9PsZnduYn5vyEXQ` | `src/lib/firebase-client.ts:7` (public — Firebase web için normal) |

**Sonuç:** Sızmış `adminpassword123` parolası **şu an sömürülemez** (email/password girişi kapalı).
Bu, ilk "CRITICAL" değerlendirmeyi ciddi şekilde düşürür. Ancak gerçek bir canlı açık
(Firestore yazım kuralı) mevcuttur.

---

## 2. Bulgular (severity kalibre edilmiş)

### 🟠 HIGH — Firestore yazımı her authenticated kullanıcıya açık
- **Dosya:** `firestore.rules:6`
- **Kural:** `allow write: if request.auth != null;`
- **Sorun:** RadioStack Google/GitHub ile girişe açık. **Herhangi bir giriş yapmış kullanıcı**
  (admin olmasa bile) `stations` koleksiyonuna doğrudan Firebase client SDK ile yazab/silebilir.
  API route'larındaki `email === 'admin@radiostack.com'` kontrolü, saldırgan API'yi baypas edip
  doğrudan Firestore'a yazdığında **hiçbir işe yaramaz**.
- **Gerçek etki:** İstasyon ekleme/silme/değiştirme — içerik tahrifatı, stream URL zehirleme.
- **Neden hâlâ açık:** Yazımlar client-side yapıldığı için tek koruma katmanı Firestore kuralları,
  ve o katman herkese açık.

### 🟡 MEDIUM (bağlam nedeniyle düşürüldü) — Public repoda hardcoded admin credential
- **Dosya:** `create_admin.js:5-7`
  ```js
  const adminEmail = "admin@radiostack.com";
  const adminPassword = "adminpassword123";
  ```
- **Neden CRITICAL değil:** Email/password girişi KAPALI (Gerçek A) → bu parolayla giriş yapılamaz.
- **Kalan risk (defense-in-depth):**
  1. Email/password girişi ileride **açılırsa** anında sömürülebilir hale gelir.
  2. Aynı parola başka yerde tekrar kullanıldıysa (parola tekrarı riski).
  3. `admin@radiostack.com` kimliği ve proje yapısı public olarak ifşa.

### 🟢 LOW / INFO
- `firestore.rules` yalnızca `stations` koleksiyonunu tanımlıyor; `users` koleksiyonu için client
  kuralı görünmüyor ama `auth-store.ts` `users/{uid}` dokümanını `onSnapshot` ile **okuyor**.
  → **Deploydaki kurallar bu yerel dosyadan farklı olabilir** (aksi halde onay akışı kırılırdı).
  Bu, deploy öncesi mutlaka doğrulanmalı (aşağıya bakın).
- `storage.rules`: admin yazımı `request.auth.token.email == 'admin@radiostack.com'` ile korunuyor
  — bu **güvenli** (token kriptografik doğrulanır, email sahtelenemez), sadece kırılgan/hardcoded.
- `init_auth.js`: hardcoded proje ID (`radiostack-dev-67a8`) — public config, düşük etki.

### ✅ Güvenli olan noktalar
- API route'larındaki email kontrolü aslında **güvenli** — `adminAuth.verifyIdToken()` token imzasını
  doğrular; email claim'i sahtelenemez. Kırılganlık güvenlik açığı değil, sadece hardcoded/tek-nokta.
- Web API key'in public olması **sorun değil** (Firebase web tasarımı böyle).

---

## 3. Yapılacaklar (öncelik sırasıyla)

### ADIM 1 — [HIGH] Firestore yazım kuralını admin'e kısıtla  ⚠️ ÖNCE DEPLOYDAKİ KURALLARI AL
Bu **tek gerçek canlı açık**. Ancak yerel `firestore.rules` eksik olabilir (bkz. LOW bulgusu),
bu yüzden **olduğu gibi deploy ETME** — yoksa `users` gibi koleksiyonların client erişimini kırarsın.

1. Firebase Console → Firestore Database → **Rules** sekmesinden **deploydaki güncel kuralları kopyala.**
2. O kurallarda **yalnızca** `stations` yazım satırını değiştir:
   ```
   // ÖNCE:  allow write: if request.auth != null;
   // SONRA:
   function isAdmin() {
     return request.auth != null
       && request.auth.token.email == 'admin@radiostack.com';
   }
   // stations match'i içinde:
   allow write: if isAdmin();
   ```
   (Bu, `storage.rules` ve `auth-store.ts:34` ile tutarlı; gerçek admini kilitlemez.)
3. Diğer koleksiyonların (`users` vb.) mevcut kurallarını **AYNEN koru.**
4. Deploy: `npx firebase deploy --only firestore:rules` (firebase CLI `bugraakin01@gmail.com` ile login).
5. **Doğrulama:** Firebase Rules Playground'da `admin olmayan` bir auth kullanıcısıyla
   `stations/x` yazımı → **deny**; `admin@radiostack.com` ile → **allow**.

### ADIM 2 — [MEDIUM] Email/password girişini kapalı tut + hardcoded parolayı geçersiz kıl
- Firebase Console → Authentication → Sign-in method → **Email/Password KAPALI kalsın.**
- Eğer bir gün açılacaksa, ÖNCE `admin@radiostack.com` parolasını güçlü bir değerle değiştir.
- **Not:** CLI ile parola değiştirmek şu an **mümkün değil** — Admin SDK credential'ı hiçbir yerde
  saklı değil (Gerçek B). Parola değişimi için ya (a) Firebase Console → Authentication → Users →
  admin@radiostack.com → Reset password, ya da (b) bir service account key üretip Admin SDK script'i
  çalıştırmak gerekir.

### ADIM 3 — [MEDIUM/hijyen] Public repodan credential'ları temizle
`create_admin.js` ve `init_auth.js` public git geçmişinde (tek commit `0f03fef`). İki seçenek:

- **Seçenek A — Sadece HEAD'den kaldır (basit, güvenli, önerilen):** Dosyaları sil + commit + push.
  Geçmişteki kopya kalır ama parola zaten inert (email/pw kapalı). Non-disruptive.
  ```bash
  git rm create_admin.js init_auth.js
  git commit -m "chore(security): remove committed admin bootstrap scripts"
  git push
  ```
- **Seçenek B — Geçmişten tamamen sil (tam temizlik, yıkıcı):** `git filter-repo` gerekir
  (kurulu değil; `pip install git-filter-repo`). Public geçmişi yeniden yazar + **force-push**.
  Klonlayanları etkiler. Parola inert olduğundan **şart değil**.
  ```bash
  pip install git-filter-repo
  git filter-repo --path create_admin.js --path init_auth.js --invert-paths --force
  git remote add origin https://github.com/waldseelen/RadioStack.git
  git push origin --force --all
  ```
- Hangi seçenek olursa olsun, `create_admin.js`'i tekrar gerekirse **hardcoded parola olmadan**
  (env var'dan okuyan) yeniden yaz.

### ADIM 4 — [İyileştirme, opsiyonel] Email → custom claim
Admin kimliğini `email` yerine bir `admin` custom claim'ine taşımak daha sağlam olur, ama:
- `setCustomUserClaims` **Admin SDK credential'ı gerektirir** (şu an yok, Gerçek B).
- İlk admin claim'ini set etmek için service account gerekir (bootstrap sorunu).
- Email-in-verified-token zaten güvenli olduğundan bu **acil değil**, düşük öncelikli hardening.

---

## 4. Bu Oturumda Ne Yapıldı / Yapılmadı

**Yapıldı:**
- Tam güvenlik reconu (3 paralel agent + doğrulamalar).
- Canlı doğrulamalar: email/pw kapalı, admin cred yok, admin=email, client-side Firestore.
- Yanlış dizinde (`C:\Users\HP`) yanlışlıkla oluşan `.vercel` / `.env.local` / `.env.rs.prod`
  başıboş dosyaları temizlendi.
- Bu rapor yazıldı.

**Yapılmadı (bilinçli):**
- `firestore.rules` düzeltmesi **deploy edilmedi** — deploydaki güncel kurallar alınmadan riskli
  (yerel dosya eksik olabilir). Yerelde denenen yarım düzeltme **geri alındı** (repo orijinal halinde).
- Parola değiştirilmedi — CLI ile mümkün değil (cred yok) ve inert (email/pw kapalı) olduğundan acil değil.
- Geçmiş temizliği / force-push yapılmadı — kullanıcı kararına bırakıldı (ADIM 3).

---

## 5. Faydalı Komut/Referanslar
- Firebase projesi: `radiostack-dev-67a8` (firebase CLI `bugraakin01@gmail.com` ile login).
- Vercel projesi: `waldseelens-projects/radio-stack`.
- Deploydaki env: yalnızca `DATABASE_URL` (Preview/Dev/Prod).
- Hesap durumu testi (parola basmadan):
  ```bash
  curl -s -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyCpdDMnsHHl1tegwWRX9PsZnduYn5vyEXQ" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@radiostack.com","password":"...","returnSecureToken":true}'
  # PASSWORD_LOGIN_DISABLED => email/pw kapalı (mevcut durum)
  ```

---
*Bu rapor DEV portföyü geneli güvenlik incelemesinin bir parçasıdır. Ana plan:
`C:\Users\HP\.claude\plans\dev-ka-s-r-hali-haz-rda-clever-whisper.md`*
