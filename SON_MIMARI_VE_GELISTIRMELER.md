# 🐙 OCTOPUS PRIME - Sistem Mimarisi & Geliştirme Günlüğü

Bu doküman, **Octopus Prime** projesinde gerçekleştirilen büyük mimari dönüşümü, 3 kanallı karar motorunu, borsa soyutlama katmanını, 3D Three.js ofis ortamını, 12 uzman ajan ekosistemini ve yeni eklenen **Otonom Pasif Gelir & Altcoin Mikro-Scalping Motorunu** detaylandırmaktadır.

---

## 🌟 1. Genel Sistem Özeti ve Vizyon

Octopus Prime; kripto para piyasalarında **Haber (Hızlı RSS/CryptoPanic)**, **Teknik Analiz (RSI, EMA9/21, Hacim Patlaması)** ve **Sosyal İstihbarat (Telegram/Threads)** kanallarını gerçek zamanlı sentezleyerek çalışan, 12 uzman yapay zeka ajanından oluşan otonom bir işlem ve pasif gelir platformudur.

Sistem; kullanıcının manuel müdahalesine gerek kalmadan piyasayı sürekli tarar, yüksek olasılıklı mikro-fırsatlara girer, **30 centlik ($0.30+) küçük kârları toplayarak (micro-scalping)** kasaya kilitler ve sermayeyi dinamik kaldıraç & devre kesicilerle korur.

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 3-KANALLI VERİ AKIŞI                    │
                  └────┬───────────────────────┬──────────────────────┬─────┘
                       │ (Haber & Sentiment)   │ (Teknik Analiz)      │ (Sosyal İstihbarat)
                       ▼                       ▼                      ▼
               [NewsRadar & AI]       [MarketStream & TA]    [Telegram / Threads]
                       │                       │                      │
                       └───────────────────────┼──────────────────────┘
                                               ▼
                                   ┌───────────────────────┐
                                   │     DECISION ENGINE   │
                                   │ (3-Kanallı Sentez)    │
                                   └───────────┬───────────┘
                                               │
                                               ▼
                              ┌─────────────────────────────────┐
                              │     AUTONOMOUS AUTO-TRADER      │
                              │ (Kullanıcıya Sormadan İcra)     │
                              └────────────────┬────────────────┘
                                               │
                                 ┌─────────────┴─────────────┐
                                 ▼                           ▼
                     [IExchangeService]            [Micro-Profit Harvester]
                   (Binance / OKX Demo)             (+$0.30 Kârda Otomatik Çıkış)
```

---

## 🏛️ 2. Temel Mimari Katmanlar

### 2.1. Borsa Soyutlama Katmanı (Exchange Abstraction Layer)
Farklı borsalarla (Binance Testnet/Sandbox, OKX Demo Trading V5 API) standart bir arayüz üzerinden çalışmayı sağlar:
- **`IExchangeService.ts` Interface**:
  - `fetchBalance()`: Toplam bakiye, boş teminat ve varlık dökümü.
  - `fetchPositions()`: Açık pozisyonlar, giriş fiyatı, güncel kâr/zarar, kaldıraç, likidasyon fiyatı.
  - `executeOrder()`: Market/Limit alım-satım emirleri, TP/SL entegrasyonu.
  - `setLeverage()`: Dinamik kaldıraç ve marjin modu (Isolated/Cross) yapılandırması.
  - `fetchCandles()` & `fetchTicker()`: Gerçek zamanlı mum ve tahta verileri.
- **`BinanceService.ts` & `OkxService.ts`**: Borsa bazlı CCXT ve REST/WebSocket implementasyonları.
- **`ExchangeFactory.ts`**: `.env` dosyasındaki `EXCHANGE_PROVIDER=binance|okx` seçimine göre ilgili servisi tek noktadan ayağa kaldırır.

---

### 2.2. Kaldıraç, Marjin ve Likidasyon Risk Altyapısı
- **Dinamik Kaldıraç Skalası**:
  - `0 - 65 Skor` : 1x (İşlem Açılmaz / Bekleme)
  - `65 - 75 Skor`: 2x Kaldıraç
  - `75 - 85 Skor`: 4x Kaldıraç
  - `85 - 95 Skor`: 7x Kaldıraç
  - `95 - 100 Skor`: 10x Kaldıraç (Maksimum güvenlik tavanı)
- **Likidasyon Hesaplama**: İzole teminat formülleriyle likidasyon fiyatı anlık hesaplanır. Fiyat likidasyona yaklaştığında (`distance <= %10`) sistem `LIQUIDATION_RISK_WARNING` alarmı verir.
- **Devre Kesici (Circuit Breaker & Cooldown)**:
  - Art arda 3 zararlı işlem gerçekleştiğinde işlem alımını 30 dakika durdurur (`TRADING_HALTED`).
  - Hatalı kuralları ve yanıltıcı haber kanallarını izole ederek öğrenme motoruna (`LearningEngine`) ceza uygular.

---

### 2.3. Otonom Pasif Gelir & Altcoin Mikro-Scalping Motoru (YENİ)
Kullanıcının *"işlemleri bana sormadan yap, altcoinlerden 30 cent kasıp çıksın"* talebi doğrultusunda geliştirilen otonom icra sistemi:
1. **`AutoTradeEngine.ts`**:
   - `TRADE_PROPOSAL` oluştuğunda insan onayı beklemeden emri borsaya iletir (`AUTO_TRADING_ENABLED = true`).
   - Pozisyon başına `$15.00` izole marjin bağlar. Eşzamanlı en fazla `4` farklı altcoin pozisyonu açarak riski dağıtır.
   - **Micro-Profit Harvester**: Her 2.5 saniyede bir açık pozisyonları denetler. Pozisyon kârı `+$0.30` USDT (30 Cent) seviyesine ulaştığı anda piyasa emriyle pozisyonu kapatır ve kârı kasaya ekler.
   - Zarar durdurma eşiğinde (`-$0.60`) sermayeyi korumak için koruyucu çıkış yapar.
2. **`AltcoinScannerService.ts`**:
   - 12 volatil altcoini (`DOGE`, `PEPE`, `AVAX`, `LINK`, `SUI`, `NEAR`, `ARB`, `OP`, `APT`, `XRP`, `SOL`, `BNB`) sürekli tarar.
   - RSI < 30 aşırı satım veya RSI > 70 aşırı alım + EMA kesişimlerinde anlık mikro-fırsat sinyalleri üretir.

---

### 2.4. 12 Uzman Ajan Ekosistemi
Coin analistleri kaldırılarak sistem 12 uzman role indirgenmiş ve tüm coinler ortak sinyal havuzuna yönlendirilmiştir:
1. **🎩 Patron (Baş Analist)**: Nihai strateji ve risk toleransını yönetir.
2. **📋 Sekreterya**: Sistem içi iletişim ve koordinasyonu sağlar.
3. **📰 Haber Takip**: RSS ve CryptoPanic akışını 7/24 tarar.
4. **🌐 Makro Ekonomist**: FED, SEC, faiz ve jeopolitik haberlerin piyasa şiddetini puanlar.
5. **⚖️ Düzenleyici İzleyici**: Regülasyon ve yasal gelişmeleri filtreler.
6. **🤖 Binance İşlemci**: Otonom emirleri icra eder ve kaldıraç ayarlarını yönetir.
7. **💧 Likidite Gözlemcisi**: Emir defteri derinliğini ve likidasyon mesafesini izler.
8. **🛡️ Risk Analisti**: Güven skorunu ve portföy risk katsayısını hesaplar.
9. **🐋 Whale Takipçisi**: Büyük cüzdan ve borsa transferlerini tespit eder.
10. **💰 Portföy Muhasebecisi**: Kasa bakiyesi, teminat ve gerçekleşen kâr/zararı tutar.
11. **⚡ Sinyal Avcısı**: 3 kanalın verisini sentezleyerek al/sat sinyallerini yakalar.
12. **📊 Teknik Analist**: RSI, EMA9/21 kesişimleri ve hacim patlamalarını inceler.

---

### 2.5. 3D Three.js Ofis Simülasyonu & Mola Rutinleri
- **Oturma & Koltuk Hizalaması**:
  - Her masanın arkasına 5 kollu metal yıldız ayaklı, hidrolik amortisörlü, deri minderli ergonomik ofis koltukları yerleştirildi.
  - Karakterler 2 kademeli bacak iskeleti (uyluk + diz) sayesinde koltuğa tam oturur, dizleri 90° bükülerek ayakları zemine basar ve elleri klavyede yazı yazar.
- **Otonom Davranışlar**:
  - Ajanlar belirli aralıklarla kahve makinesine, su sebiline veya sigara balkonuna molaya çıkar.
  - Yeni bir sinyal veya acil durum oluştuğunda (`triggerAlertPreemption`) mola yarıda kesilir ve ajan masasına koşar.

---

### 2.6. Canlı Cüzdan Barı & Ajan/İşlem Günlüğü (Activity Log Feed)
- **Üst Durum Barı**:
  - Canlı Bakiye (`$10,000.00`), Boş Teminat, Gerçekleşen/Açık PnL, Risk Durumu.
  - Borsa bağlantı nabzı (`🟢 ONLINE`) ve `🤖 OTO-TRADE: AKTİF ($0.30)` kontrolü.
- **Canlı Log Çekmecesi (`ActivityLogManager`)**:
  - `Tümü`, `İşlemler`, `Sinyaller`, `Yönetim & Patron`, `Haber & Makro`, `Risk & Limit`, `Sistem` sekmeleri.
  - Saniye saniye gerçekleşen tüm alım/satımlar, sinyaller ve 30 centlik kâr alma olayları filtrelenebilir, aranabilir ve JSON olarak dışa aktarılabilir.

---

## 🛠️ 3. Konfigürasyon Referansı (`.env`)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `EXCHANGE_PROVIDER` | `binance` | Kullanılacak borsa (`binance` veya `okx`) |
| `BINANCE_TESTNET` | `true` | Binance Testnet Sandbox modu |
| `AUTO_TRADING_ENABLED` | `true` | Kullanıcıya sormadan otonom işlem modu |
| `MICRO_SCALP_TARGET_USD` | `0.30` | İşlem başına kâr alma hedefi ($0.30 USDT) |
| `MICRO_SCALP_STOP_LOSS_USD` | `0.60` | İşlem başına stop-loss koruması |
| `MICRO_SCALP_MARGIN_USD` | `15.0` | Mikro işlem başına bağlanacak teminat |
| `MAX_CONCURRENT_POSITIONS` | `4` | Maksimum eşzamanlı açık altcoin pozisyonu |
| `MAX_LEVERAGE_ALLOWED` | `10` | İzin verilen maksimum kaldıraç |
| `ALTCOIN_SCAN_INTERVAL_SEC`| `8` | Altcoin tarama döngü sıklığı (saniye) |

---

## 🧪 4. Doğrulama ve Test Sonuçları
- **Backend Testleri (`npm test`)**: 15 Test Paketi, 63 Test — **%100 Başarılı (PASS)**.
- **Frontend Derleme (`npm --prefix frontend run build`)**: Vite TypeScript derlemesi **0 Hata** ile tamamlandı.
- **Canlı Portlar**:
  - REST API & WebSocket: `http://localhost:3000` & `ws://localhost:3000/ws`
  - 3D Frontend: `http://localhost:5173`
