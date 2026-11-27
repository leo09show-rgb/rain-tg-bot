# Render ile yayına alma (en kolay)
1. Bu klasörü GitHub'a yükle (yeni repo).
2. render.com -> New -> Web Service -> repoyu seç.
3. Build: `npm install` | Start: `npm start`
4. Environment: TG_TOKEN, TG_CHAT_ID, RAIN_SECRET ekle.
5. Deploy bitince adres: https://xxx.onrender.com/rain-webhook
6. Panelde Webhook adresi = bu adres, İmza anahtarı = RAIN_SECRET ile aynı -> Kaydet -> Test gönder.

Not: Render ücretsiz planda 15 dk boşta kalınca uyur, ilk istek 5 sn'yi aşabilir.
Webhook tekrar denediği için çoğu zaman sorun olmaz; garanti için ücretli plan veya Railway/VPS kullan.
