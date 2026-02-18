# Image Copy & Converter Extension

Chrome uzantısı — clipboard'daki resim ve PDF dosyalarını file input alanlarına yükleyin, formatları dönüştürün, sayfadaki görselleri seçip kopyalayın ve ekrandan renk yakalayın.

---

## Özellikler

### Clipboard → File Input Yükleme (Ana Özellik)

- **Otomatik algılama**: Tıkladığınız file input alanı otomatik yakalanır
- **Birleşik seçim modalı**: "Dosya Seç" modalı açılır ve mevcut seçenekler sunulur:
  - 📄 **Seçili PDF** kartı (varsa) — PDF adı gösterilir
  - 🖼️ **Clipboard resmi** kartı (varsa) — küçük önizleme, boyut ve format bilgisi
  - 📁 **Bilgisayardan Seç** butonu (native dialog)
  - İptal
- **Akıllı davranış**: Ne PDF ne resim varsa direkt native file dialog açılır
- **Upload sonrası temizlik**: Dosya input'a enjekte edildikten sonra clipboard ve PDF seçimi otomatik sıfırlanır — aynı içerik bir daha önerilmez

### PDF Seçimi ve Yükleme

- **Sayfadaki PDF bağlantılarını seç**: PDF Picker modu ile sayfadaki herhangi bir PDF bağlantısına tıklanınca seçilir
- **Depolama ile kalıcılık**: Seçilen PDF `chrome.storage.local`'a kaydedilir, sayfa yenilense bile hatırlanır
- **CORS bypass**: PDF'ler arka planda servis çalışanı üzerinden fetch edilir, CORS hatası alınmaz
- **Akıllı dosya adı**: `download` attribute → URL path → bağlantı metni öncelik sırasıyla belirlenir; çift `.pdf` uzantısı ve gereksiz " PDF" eki otomatik temizlenir
- **Popup önizleme**: Popup açıldığında seçili PDF'in adı gösterilir ve doğrudan indirilebilir

### Format Dönüştürme

- **Kaynak formatlar**: PNG, JPEG, WebP, BMP, GIF, SVG
- **Hedef formatlar**: PNG, JPEG, WebP, BMP, GIF
- **Kalite kontrolü**: JPEG/WebP için %1–100 ayarı
- **SVG notu**: SVG → raster dönüşümü desteklenir; raster → SVG otomatik vektörize edilmez. SVG için açık bir kural yoksa SVG dosyası olduğu gibi yüklenir

### Resim Düzenleyici

- **Modal editör**: Clipboard resmini yüklemeden önce düzenleyiciyle açın
- **Popup'tan direkt düzenleme**: "Edit Image" butonuyla file input gerekmeden editör açılır
- **Araçlar**: Yeniden boyutlandırma (ön ayar + özel), kırpma, yakınlaştırma, geri alma (Ctrl+Z, 20 adım)
- **Ctrl+V ile yapıştırma**: Editör açıkken Ctrl+V ile clipboard'dan yeni resim yapıştırılabilir
- **Çıkış seçenekleri**: Kopyala 📋 / İndir ⬇️ / Düzenlenmiş resmi kullan ✓
- **Format + kalite**: PNG/JPEG/WebP ve kalite slider'ı her zaman aktif

### Popup Hızlı İndirme

- **Başlık indirme ikonu**: `⬇️` ikonu clipboard'da desteklenen içerik varsa aktif olur
- **Format rozeti**: `SVG`, `PNG`, `JPG` gibi algılanan formatı gösterir
- **PDF önceliği**: Seçili bir PDF varsa indirilecek içerik olarak PDF gösterilir
- **SVG önceliği**: Clipboard'da SVG varsa `.svg` olarak kaydedilir

### Görsel Resim Seçici (Image Picker)

- **Kısayol ile etkinleştirme**: Varsayılan `Ctrl+Alt+S` (özelleştirilebilir)
- **Görsel vurgu**: Fare hareket ettikçe resimler mavi kenarlıkla vurgulanır
- **Geniş algılama**: `<img>`, inline `<svg>` ve CSS `background-image` ile tanımlanan resimler algılanır
- **Tıkla-kopyala**: Vurgulanan resme tıklamak clipboard'a kopyalar
- **Çıkış**: Büyük X butonu veya `Escape`

### Resim Değiştirme Modu (Image Replace)

- **Kısayol ile etkinleştirme**: Özelleştirilebilir (ör. `Ctrl+Alt+R`)
- **Clipboard'daki resimle değiştir**: Herhangi bir sayfadaki resmin üstüne tıklayarak clipboard içeriğiyle değiştir
- **Yalnızca kaynak değişir**: `src`, `srcset` veya `background-image` dışında hiçbir HTML özelliği, class veya stil etkilenmez
- **Çoklu değiştirme**: Tek oturumda birçok resim değiştirilebilir
- **ESC ile çıkış**: `Escape` veya X butonu ile mod sonlandırılır

### Renk Seçici (Color Picker)

- **Kısayol ile etkinleştirme**: Özelleştirilebilir (ör. `Ctrl+Alt+C`)
- **EyeDropper API**: Modern tarayıcılarda sistem geneli renk seçimi (tarayıcı dışı ekran dahil)
- **Canvas tabanlı yedek**: EyeDropper desteklenmiyorsa veya PDF'lerde otomatik canvas yöntemi kullanılır
- **Gerçek zamanlı önizleme**: Fare hareket ettikçe HEX + RGB değerleri anlık güncellenir
- **Otomatik kopyalama**: Seçilen renk kodu clipboard'a otomatik kopyalanır
- **PDF uyumlu**: Tarayıcıda açık PDF belgelerinde çalışır
- **ESC ile çıkış**: `Escape` veya X butonu

---

## Kurulum

### Manuel Kurulum (Geliştirici Modu)

1. **Depoyu indirin veya klonlayın**
   ```bash
   git clone https://github.com/yourusername/ImageCopyExtension.git
   ```

2. **Chrome Uzantılar sayfasını açın**  
   Adres çubuğuna `chrome://extensions/` yazın

3. **Geliştirici modunu etkinleştirin**  
   Sağ üstteki "Developer mode" anahtarını açın

4. **Uzantıyı yükleyin**  
   "Load unpacked" butonuna tıklayın → indirilen klasörü seçin

5. **Hazır!** Araç çubuğunda uzantı ikonu görünür

---

## Kullanım Kılavuzu

### Clipboard Resmi veya PDF'i File Input'a Yüklemek

1. Bir resmi kopyalayın (Ctrl+C, Win+Shift+S, sağ tık → Kopyala) **ve/veya** sayfada PDF Picker ile PDF seçin
2. Uzantıyı etkinleştirin (popup → Enable)
3. Herhangi bir web sitesindeki file input'a tıklayın
4. **"Dosya Seç"** modalı açılır:
   - **PDF kartı** → "PDF Kullan" butonu ile PDF'i yükle
   - **Resim kartı** → "Resim Kullan" ile doğrudan yükle ya da "✏️ Düzenle" ile editörde aç
   - **"📁 Bilgisayardan Seç"** → normal file dialog
5. Seçim yapıldıktan sonra clipboard ve PDF seçim hafızası otomatik temizlenir

### PDF Seçmek

1. Uzantıyı etkinleştirin
2. PDF bağlantısı olan bir sayfaya gidin
3. Herhangi bir PDF bağlantısına tıklayın — PDF seçilir ve popup'ta adı gösterilir
4. Bir file input'a tıklandığında modal'da PDF kartı otomatik görüntülenir

### Görüntü Editörünü Açmak (Popup'tan)

1. Bir resmi kopyalayın — popup'ta önizleme görünür
2. "Edit Image" butonuna tıklayın
3. Kırpın, boyutlandırın, format/kalite ayarlayın
4. 📋 Kopyala / ⬇️ İndir / ✓ Kullan ile çıkın

### Kısayolları Özelleştirmek

1. Popup'u açın
2. İlgili kısayol giriş alanına tıklayın:
   - **Image Picker** — sayfadaki resimleri kopyalamak için
   - **Image Replace** — sayfadaki resimleri değiştirmek için
   - **Color Picker** — ekrandan renk yakalamak için
3. Yeni tuş kombinasyonunu basın — otomatik kaydedilir

---

## Dönüştürme Kuralları

### Kural Ekleme

1. Popup'u açın
2. Kaynak format → Hedef format seçin
3. Kalite ayarlayın (JPEG/WebP için, önerilen: %90)
4. "Add Rule" butonuna tıklayın

### Örnek Kurallar

| Kaynak | Hedef | Kalite | Amaç |
|--------|-------|--------|------|
| PNG | JPEG | %90 | Dosya boyutunu küçült |
| JPEG | WebP | %85 | Modern web optimizasyonu |
| PNG | WebP | %95 | Yüksek kalite + küçük boyut |
| WebP | PNG | — | Uyumluluk için |
| BMP | PNG | — | Standart formata geçiş |

---

## İzinler

| İzin | Amaç |
|------|------|
| `activeTab` | Aktif sekme ile etkileşim |
| `scripting` | Sayfalara script enjeksiyonu |
| `clipboardRead` | Clipboard'dan resim okuma |
| `storage` | Ayarlar ve PDF seçimini kaydetme |
| `host_permissions (<all_urls>)` | Tüm web sitelerinde çalışma |

---

## Dosya Yapısı

```
ImageCopyExtension/
├── manifest.json       # Uzantı yapılandırması
├── popup.html          # Kullanıcı arayüzü
├── popup.js            # Popup mantığı
├── styles.css          # Popup stil dosyası
├── content.js          # Sayfa etkileşim scripti
├── background.js       # Arka plan servis çalışanı (CORS proxy)
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## Sorun Giderme

### Resim Yüklenmiyor
- Popup'ta resim önizlemesi görünüyor mu kontrol edin
- Sayfayı yenileyip uzantıyı tekrar etkinleştirin

### PDF Yüklenmiyor
- PDF Picker ile geçerli bir PDF bağlantısı seçilmiş olmalı
- `file://` protokolüyle açılan PDF'ler desteklenmez
- CORS kısıtlaması olan PDF'ler için uzantı arka planda yeniden dener

### Editör Açılmıyor
- Sayfayı yenileyip tekrar deneyin; uzantı gerekirse otomatik yeni sekme açar

### Format Dönüşümü Çalışmıyor
- WebP eski tarayıcılarda desteklenmeyebilir

### File Input Algılanmıyor
- Bazı siteler standart HTML input yerine özel upload widget kullanır

---

## Gizlilik

- Tüm işlemler **yalnızca cihazınızda** gerçekleşir
- Hiçbir veri harici sunuculara gönderilmez
- Clipboard erişimi yalnızca resim okumak için kullanılır
- Ayarlar ve PDF seçim bilgisi tarayıcının yerel depolama alanında tutulur

---

**Tarayıcı Uyumluluğu**: Chrome 88+ · Edge 88+ · Opera 74+ · Brave 1.20+

**Not**: Chrome Web Store'da yayınlanmamıştır; geliştirici modunda yüklenmelidir.

