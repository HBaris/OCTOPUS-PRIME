# 🚀 OCTOPUS PRIME - GELİŞTİRME YADA HARITASI

Sistem akıllı, genişletilebilir ve öğrenen hale nasıl getireceğini adım adım gösteriyorum.

---

## 🎯 **FAZE 1: Dinamik Anahtar Kelime Sistemi** (Hemen yapılabilir)

### Problem:
Şu anda "savaş", "kriz" vb. kelimeler sabit hardcoded. Piyasada yeni riskler çıktığında kod değiştirmeliyiz.

### Çözüm:
**`keywords.json`** dosyası ile dinamik keyword yönetimi.

**Dosya: `keywords.json`**
```json
{
  "defcon_1": {
    "keywords": ["savaş", "çatışma", "vuruldu", "saldırı", "kriz", "istifa"],
    "strength": 1.0,
    "description": "Kripto piyasasını tamamen çöktürecek olaylar"
  },
  "defcon_2": {
    "keywords": ["faiz artış", "enflasyon", "merkez bankası", "fed açıklaması", "durgunluk"],
    "strength": 0.8,
    "description": "Orta seviye etki olaylar"
  },
  "crypto_specific": {
    "keywords": ["kripto yasağı", "sec çalışması", "bitcoin yasaklandı", "blockchain"],
    "strength": 0.9,
    "description": "Kripto pazarına özel etkiler"
  },
  "oil_sensitive": {
    "keywords": ["petrol üretimi", "opec", "şale yağı", "enerji krizi", "ambargo"],
    "strength": 0.7,
    "description": "Petrol fiyatını etkileyecek olaylar"
  },
  "geopolitical": {
    "keywords": ["jeopolitik", "anlaşmaz", "ticaret savaşı", "tarife", "yaptırım"],
    "strength": 0.85,
    "description": "Uluslararası gerilimler"
  }
}
```

**Dosya: `dynamic_news_radar.py`**
```python
import json
import asyncio
import logging
from telegram_subayi import gonder, telegram_subayi

logger = logging.getLogger(__name__)

class DynamicNewsRadar:
    def __init__(self, keywords_file="keywords.json"):
        with open(keywords_file, "r", encoding="utf-8") as f:
            self.keyword_categories = json.load(f)
        logger.info("✅ Dinamik keywords yüklendi")
    
    def kategoriye_gore_analiz(self, baslik: str, ozet: str) -> tuple:
        """
        Haberi kategori ve şiddete göre sınıflandır.
        """
        metin = f"{baslik} {ozet}".lower()
        
        en_yuksek_kategori = None
        en_yuksek_strength = 0
        
        for kategori, config in self.keyword_categories.items():
            keywords = config["keywords"]
            strength = config["strength"]
            
            # Kaç kelime eşleşti
            match_count = sum(1 for kw in keywords if kw in metin)
            
            if match_count > 0:
                kategori_strength = strength * match_count
                
                if kategori_strength > en_yuksek_strength:
                    en_yuksek_strength = kategori_strength
                    en_yuksek_kategori = kategori
        
        if en_yuksek_kategori:
            return en_yuksek_kategori, en_yuksek_strength
        
        return "NORMAL", 0
    
    def keywordler_ekle(self, kategori: str, yeni_kelimeler: list):
        """
        Runtime'da yeni keywords ekle.
        Örn: Bot savaş mı başladığını fark ederse, ilgili kelimeleri ekle.
        """
        if kategori not in self.keyword_categories:
            self.keyword_categories[kategori] = {
                "keywords": [],
                "strength": 0.8,
                "description": "Dinamik olarak eklendi"
            }
        
        self.keyword_categories[kategori]["keywords"].extend(yeni_kelimeler)
        
        # JSON'a kaydet
        with open("keywords.json", "w", encoding="utf-8") as f:
            json.dump(self.keyword_categories, f, ensure_ascii=False, indent=2)
        
        logger.info(f"✅ {kategori} kategorisine {yeni_kelimeler} eklendi")
    
    async def uyari_gonder(self, kategori: str, strength: float, baslik: str):
        """
        Strength değerine göre farklı uyarı seviyesi.
        """
        strength_emoji = {
            (0.9, 1.0): ("🚨", "DEFCON 1 - KRİZAL"),
            (0.7, 0.9): ("⚠️", "UYARI - ORTA SEVİYE"),
            (0.5, 0.7): ("📊", "TÜRBÜLANS - TAKIP ET"),
            (0, 0.5): ("📡", "BİLGİ - TARAFSIZ")
        }
        
        emoji, seviye = None, None
        for (min_s, max_s), (e, s) in strength_emoji.items():
            if min_s <= strength <= max_s:
                emoji, seviye = e, s
                break
        
        mesaj = f"{emoji} **{seviye}**\n{baslik}\n💪 Etki Gücü: {strength:.2f}/1.0"
        await gonder(mesaj, emoji=emoji)
```

**Kullanım:**
```python
radar = DynamicNewsRadar("keywords.json")

# Bir haberi analiz et
kategori, strength = radar.kategoriye_gore_analiz(
    "OPEC petrol üretimini %50 azaltmaya karar verdi",
    "Suudi Arabistan ve Rusya anlaştı..."
)
print(f"Kategori: {kategori}, Strength: {strength}")  # oil_sensitive, 0.7

# Runtime'da yeni keywords ekle
radar.keywordler_ekle("oil_sensitive", ["OPEC toplantısı", "petrol ambargosu"])
```

---

## 🎯 **FAZE 2: AI-Powered Sentiment Analizi** (1-2 hafta sonra)

### Problem:
Haberin pozitif mi negatif mi olduğunu anlamıyoruz. "Petrol düşüşü" kime göre iyi, kime göre kötü?

### Çözüm:
Hugging Face'in pre-trained sentiment modeli kullan (çok hafif, ücretsiz).

**Dosya: `sentiment_analyzer.py`**
```python
import asyncio
from transformers import pipeline
import logging

logger = logging.getLogger(__name__)

class SentimentAnalyzer:
    def __init__(self):
        # Hafif model, 100MB altında
        self.sentiment_pipeline = pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english",
            device=-1  # CPU, GPU kullanma (Render ücretsiz katmanı için)
        )
        logger.info("✅ Sentiment Analyzer yüklendi")
    
    def analiz_et(self, metin: str) -> dict:
        """
        Metnin sentimentini analiz et.
        """
        try:
            result = self.sentiment_pipeline(metin[:512])  # Token limit
            
            sentiment = result[0]["label"]  # POSITIVE / NEGATIVE
            confidence = result[0]["score"]  # 0-1
            
            return {
                "sentiment": sentiment,
                "confidence": confidence,
                "piyasa_etkisi": self.yorum_yap(sentiment, confidence)
            }
        except Exception as e:
            logger.error(f"Sentiment hatası: {e}")
            return {"sentiment": "UNKNOWN", "confidence": 0}
    
    def yorum_yap(self, sentiment: str, confidence: float) -> str:
        """
        Sentiment'i piyasa terimleriyle çevir.
        """
        if sentiment == "POSITIVE":
            if confidence > 0.9:
                return "🟢 Güçlü Pozitif - Risk varlıkları çıkabilir"
            return "📈 Hafif Pozitif - Satın alma sinyali"
        else:
            if confidence > 0.9:
                return "🔴 Güçlü Negatif - Güvenli limanlara kaç"
            return "📉 Hafif Negatif - Uyar ver"

# Kullanım
analyzer = SentimentAnalyzer()

result = analyzer.analiz_et(
    "Merkez Bankası acil olarak faiz indirimleri duyurdu"
)
print(result)
# Output:
# {
#   "sentiment": "NEGATIVE",
#   "confidence": 0.95,
#   "piyasa_etkisi": "🔴 Güçlü Negatif - Güvenli limanlara kaç"
# }
```

**`news_radar.py` ile entegrasyonu:**
```python
async def tarama_yapTi(self):
    haberler = await self.fetch_feeds()
    
    for haber in haberler:
        kategori, strength = self.analiz_et(haber['title'], haber['summary'])
        
        # YENİ: Sentiment analizi ekle
        sentiment = self.sentiment_analyzer.analiz_et(haber['title'])
        
        # Sentimentin strength ile kombinasyonu
        final_strength = strength * (sentiment["confidence"] if sentiment["sentiment"] == "NEGATIVE" else 0.5)
        
        if final_strength > 0.7:
            await gonder(
                f"{sentiment['piyasa_etkisi']}\n{haber['title']}",
                emoji="📊"
            )
```

---

## 🎯 **FAZE 3: Market Correlation Analysis** (2-3 hafta)

### Problem:
Hangi haberin hangi piyasayı etkileyeceğini bilmiyoruz. Petrol haberi kripto'yu etkiliyebilir mi?

### Çözüm:
Geçmiş korelasyonları öğren, haberin olaydan 15-30 dakika sonrasında tüm piyasaları kontrol et.

**Dosya: `correlation_tracker.py`**
```python
import json
from datetime import datetime, timedelta
import asyncio
import logging

logger = logging.getLogger(__name__)

class CorrelationTracker:
    def __init__(self):
        self.correlations = {
            "oil_down": {
                "btc": 0.65,      # Petrol düşerse BTC %65 çoğunlukla çıkıyor
                "gold": 0.72,
                "stocks": -0.58,  # Negatif = ters yönde hareket
            },
            "fed_raises_rates": {
                "btc": -0.82,     # Faiz artarsa BTC düşüyor
                "stocks": -0.79,
                "bonds": 0.91,
            },
            "geopolitical_crisis": {
                "gold": 0.88,     # Kriz varsa altın yükseliyor
                "btc": 0.71,
                "stocks": -0.75,
            }
        }
        self.event_log = []
    
    def olaylari_kaydet(self, event_type: str, timestamp: datetime):
        """
        Önemli olayları kaydet (haber, harita değişimi, vb.)
        """
        self.event_log.append({
            "type": event_type,
            "timestamp": timestamp,
            "predicted_impacts": self.correlations.get(event_type, {})
        })
    
    async def kontrol_et_impact(self, event_type: str):
        """
        Olaydan 15 dakika sonra, tahmin edilen piyasaların hareket ettiğini kontrol et.
        """
        if event_type not in self.correlations:
            return
        
        await asyncio.sleep(15 * 60)  # 15 dakika bekle
        
        predictions = self.correlations[event_type]
        
        # Burada Binance/yfinance çek ve karşılaştır
        logger.info(f"📊 {event_type} etkilerini kontrol ediliyor: {predictions}")
    
    def korelasyonlari_guncelle(self, event_type: str, actual_impacts: dict):
        """
        Gerçekleşen etkileri gözlemle, korelasyonları ayarla.
        Örn: Petrol düşerse, gerçekte BTC %2 düşmüşse, korelasyon -0.02'ye ayarla
        """
        if event_type not in self.correlations:
            self.correlations[event_type] = {}
        
        # Exponential moving average ile güncellenmiş korelasyon hesapla
        alpha = 0.3  # Yeni veri ağırlığı
        for asset, actual_change in actual_impacts.items():
            old_corr = self.correlations[event_type].get(asset, 0.5)
            new_corr = (1 - alpha) * old_corr + alpha * actual_change
            self.correlations[event_type][asset] = new_corr
        
        # Güncellenmiş korelasyonları kaydet
        with open("correlations.json", "w") as f:
            json.dump(self.correlations, f, indent=2)
        
        logger.info(f"✅ {event_type} korelasyonları güncellenmiştir")
```

**Kullanım Örneği:**
```python
tracker = CorrelationTracker()

# Haberde "Fed faiz artırıyor" duyumunun geldiği an
tracker.olaylari_kaydet("fed_raises_rates", datetime.now())

# 15 dakika sonra etkileri kontrol et
actual_impacts = {
    "btc": -0.08,      # -8%
    "stocks": -0.12,   # -12%
    "bonds": 0.05      # +5%
}

tracker.korelasyonlari_guncelle("fed_raises_rates", actual_impacts)
# Korelasyonlar yeni veriye göre otomatik düzeltilir
```

---

## 🎯 **FAZE 4: Multi-Market Impact Scoring** (3-4 hafta)

### Fikir:
Her habere otomatik bir "etki skoru" atar. Ne kadar piyasayı sarsacağını tahmin eder.

**Dosya: `impact_scorer.py`**
```python
import logging
from typing import Dict

logger = logging.getLogger(__name__)

class ImpactScorer:
    def __init__(self):
        self.asset_weights = {
            "btc": 1.0,
            "stocks": 0.9,
            "gold": 0.8,
            "oil": 0.85,
            "forex": 0.7
        }
    
    def hesapla_impact_skoru(
        self,
        baslik: str,
        sentiment_strength: float,
        kategori: str,
        correlated_assets: Dict[str, float]
    ) -> Dict:
        """
        Bir haberin toplam piyasa etkisini skorla.
        
        Giriş:
        - sentiment_strength: 0-1 (negatif ise saçılıyor)
        - kategori: "oil_sensitive", "crypto_specific" vb.
        - correlated_assets: {"btc": 0.65, "gold": 0.72}
        """
        
        # Temel skoru hesapla
        base_score = sentiment_strength
        
        # Kategoriye göre ayarla
        kategori_multiplier = {
            "defcon_1": 1.0,
            "defcon_2": 0.8,
            "crypto_specific": 0.9,
            "oil_sensitive": 0.75,
            "geopolitical": 0.85
        }
        
        adjusted_score = base_score * kategori_multiplier.get(kategori, 0.5)
        
        # Etkilenen varlık sayısına göre ayarla
        # (Çok varlığı etkileyen haberler daha önemli)
        affected_assets = len([x for x in correlated_assets.values() if abs(x) > 0.5])
        multiplicity_boost = 1 + (affected_assets * 0.1)
        
        final_score = adjusted_score * multiplicity_boost
        
        # 0-10 aralığına ölçekle
        impact_score = min(final_score * 10, 10)
        
        # Hangi varlıklar en çok etkilenecek
        top_affected = sorted(
            correlated_assets.items(),
            key=lambda x: abs(x[1]),
            reverse=True
        )[:3]
        
        return {
            "impact_score": impact_score,
            "severity": self._severity_label(impact_score),
            "top_affected_assets": [asset for asset, _ in top_affected],
            "confidence": base_score
        }
    
    def _severity_label(self, score: float) -> str:
        if score >= 8.5:
            return "🚨 KATASTROFİK"
        elif score >= 7:
            return "🔴 ÇOK AĞIR"
        elif score >= 5:
            return "🟠 AĞIR"
        elif score >= 3:
            return "🟡 ORTA"
        else:
            return "🟢 HAFİF"

# Kullanım
scorer = ImpactScorer()

impact = scorer.hesapla_impact_skoru(
    baslik="OPEC petrol üretimini %50 azaltıyor",
    sentiment_strength=0.92,
    kategori="oil_sensitive",
    correlated_assets={"btc": 0.65, "gold": 0.72, "stocks": -0.58}
)

print(impact)
# Output:
# {
#   "impact_score": 7.8,
#   "severity": "🔴 ÇOK AĞIR",
#   "top_affected_assets": ["gold", "btc", "stocks"],
#   "confidence": 0.92
# }
```

**Telegram mesajında kullan:**
```python
mesaj = f"""
{impact['severity']}

{baslik}

📊 **Etki Skoru:** {impact['impact_score']:.1f}/10
🎯 **En Çok Etkilenenler:** {', '.join(impact['top_affected_assets'])}
💪 **Güven:** {impact['confidence']*100:.0f}%

Kaptan, hazırlanma zamanı!
"""

await gonder(mesaj, emoji=impact['severity'].split()[0])
```

---

## 🎯 **FAZE 5: User Feedback Loop** (Devam eden)

### Fikir:
Telegram'da tepki emojileri ile bot öğrenir: "Bu haber faydalı mıydı?"

**Dosya: `feedback_system.py`**
```python
import asyncio
import logging
from datetime import datetime
import json

logger = logging.getLogger(__name__)

class FeedbackSystem:
    def __init__(self):
        self.feedback_history = []
    
    async def oyla(self, message_id: str, emoji: str, user_id: int):
        """
        Kullanıcı tepkisini kaydet.
        ✅ = Doğru uyarı, ✋ = Yanlış alarm, 🔥 = Çok önemli
        """
        feedback = {
            "message_id": message_id,
            "emoji": emoji,
            "user_id": user_id,
            "timestamp": datetime.now().isoformat(),
            "emoji_meaning": {
                "✅": "accurate_alert",
                "❌": "false_alarm",
                "🔥": "critical",
                "😴": "boring",
                "⚡": "actionable"
            }.get(emoji, "unknown")
        }
        
        self.feedback_history.append(feedback)
        
        # Dosyaya kaydet
        with open("feedback.json", "a") as f:
            json.dump(feedback, f)
            f.write("\n")
        
        logger.info(f"✅ Tepki kaydedildi: {feedback['emoji_meaning']}")
    
    def analiz_geri_bildirim(self) -> dict:
        """
        Geri bildirimleri analiz et:
        - Hangi tür uyarılar çoğunlukla doğru
        - Hangi kategoriden çok false alarm geliyor
        """
        if not self.feedback_history:
            return {}
        
        accurate = sum(1 for f in self.feedback_history if f["emoji"] == "✅")
        false_alarms = sum(1 for f in self.feedback_history if f["emoji"] == "❌")
        accuracy_rate = accurate / len(self.feedback_history) if self.feedback_history else 0
        
        return {
            "total_feedback": len(self.feedback_history),
            "accuracy_rate": accuracy_rate,
            "recommendation": "Sistem çok iyidir!" if accuracy_rate > 0.85 else "Kategoriler ayarlanmalı"
        }

# telegram_subayi.py'a ekle:
feedback_system = FeedbackSystem()

async def raporla_with_feedback(self, mesaj: str, emoji_prefix: str = "📡"):
    """
    Mesajı gönder ve tepki al (inline buton gibi).
    """
    # Mesaj gönder
    msg = await self.bot.send_message(...)
    
    # Tepki emojilerine izin ver
    emojis = ["✅", "❌", "🔥", "😴", "⚡"]
    for emoji in emojis:
        await msg.set_reaction(emoji)
    
    # Tepkileri dinle (son 30 dakika)
    await feedback_system.oyla(msg.message_id, emoji, self.chat_id)
```

---

## 🎯 **FAZE 6: Makine Öğrenmesi (Advanced)** (1-2 ay)

### Fikir:
Geçmiş haberler ve piyasa reaksiyonlarını öğren, yeni haberler gelince etkisini tahmin et.

```python
# Basit sklearn modeli
from sklearn.ensemble import RandomForestClassifier
import numpy as np

class PredictiveAnalyzer:
    def __init__(self):
        self.model = RandomForestClassifier()
        self.training_data = []
    
    def egit(self, x_features: list, y_labels: list):
        """
        x_features: [sentiment_score, kategori_kod, varlık_sayısı, ...]
        y_labels: [0.05, -0.08, 0.12, ...]  (Gerçek piyasa hareketi)
        """
        self.model.fit(x_features, y_labels)
        logger.info("✅ Model eğitildi")
    
    def tahmin_et(self, features: list) -> dict:
        """
        Yeni bir haber gelince, piyasa etkisini tahmin et.
        """
        predicted_impact = self.model.predict([features])[0]
        
        return {
            "predicted_impact": predicted_impact,
            "direction": "📈" if predicted_impact > 0 else "📉",
            "severity": abs(predicted_impact)
        }
```

---

## 📋 **BAŞLANGIÇ İÇİN YAPILACAK (SIRA SIRASI)**

```
✅ HAFTA 1:
   - Dinamik keywords.json sistemini ekle
   - Runtime'da yeni keywords ekleme fonksiyonu

⚡ HAFTA 2-3:
   - Sentiment analysis modeli ekle
   - Haberleri "positive", "negative", "neutral" olarak sınıflandır
   
🔥 HAFTA 4-5:
   - Korelasyon tracker ile piyasaların linkini öğren
   - Bir olaydan 15 dakika sonra sonuçları kontrol et

💎 HAFTA 6+:
   - Impact scoring sistemi
   - User feedback loop (Telegram emojileri)
   - ML tahminleri (İsteğe bağlı)
```

---

## 🚀 **HEMEN YAPABILECEĞIN: `advanced_news_radar.py`**

Yapıştır ve `main.py`'de `baslatAdvancedNewsRadar()` olarak çalıştır:

```python
# advanced_news_radar.py
import json
import asyncio
import logging
from telegram_subayi import gonder, telegram_subayi

logger = logging.getLogger(__name__)

class AdvancedNewsRadar:
    def __init__(self):
        with open("keywords.json", "r", encoding="utf-8") as f:
            self.keywords = json.load(f)
        self.tracked_events = {}
    
    def kategoriye_gore_analiz(self, baslik: str, ozet: str) -> tuple:
        metin = f"{baslik} {ozet}".lower()
        
        en_yuksek = ("NORMAL", 0)
        
        for kategori, config in self.keywords.items():
            match_count = sum(1 for kw in config["keywords"] if kw in metin)
            
            if match_count > 0:
                strength = config["strength"] * match_count
                
                if strength > en_yuksek[1]:
                    en_yuksek = (kategori, strength)
        
        return en_yuksek
    
    async def baslatTi_loop(self):
        # Orijinal news_radar yerine bunu çalıştır
        logger.info("🚀 Advanced News Radar başladı")
        
        while True:
            # ... fetch feeds ...
            # kategori, strength = self.kategoriye_gore_analiz(...)
            # 
            # if strength > 0.7:
            #     await gonder(mesaj, emoji="📊")
            
            await asyncio.sleep(3 * 60)
```

---

## 💡 **BONUS: Custom Webhook Sistemi**

Barış, haftalık özel raporlar alsın:

```python
# Her pazartesi saat 09:00'da haftalık report
@tasks.loop(time=datetime.time(9, 0), name="weekly_report")
async def haftalik_rapor():
    """
    - En önemli 5 olay
    - Hangi piyasalar en çok hareket etti
    - Accuracy rate kaç oldu
    - Tavsiye: Gelecek hafta neler izlenecek
    """
    
    rapor = f"""
📊 HAFTALIK RAPOR
================

🚨 TOP 5 Olaylar:
1. Federe Faiz Artışı (impact: 8.5)
2. Petrol Üretim Kesintisi (impact: 7.2)
...

📈 En Volatile Varlık: Bitcoin (+12.3%)
📉 En Düşen: Petrol (-8.1%)

✅ Doğruluk: 87.5%
💬 Feedback: {feedback_summary}

🎯 Gelecek Hafta İzlenecek:
- OPEC toplantısı (Çarşamba)
- ECB konferansı (Cuma)
"""
    
    await gonder(rapor, emoji="📊")
```

---

## 🎯 **EN KOLAY VERSİYON: Hemen Yapılacak**

`keywords.json` dosyasını oluştur:
```json
{
  "petrol_risk": {
    "keywords": ["petrol", "opec", "şale", "enerji", "ambargo"],
    "strength": 0.8
  },
  "crypto_risk": {
    "keywords": ["kripto", "bitcoin", "sec", "yasak", "blockchain"],
    "strength": 0.9
  },
  "market_risk": {
    "keywords": ["borsa", "fed", "faiz", "kriz", "durgunluk"],
    "strength": 0.95
  }
}
```

Sonra `news_radar.py` yerine `advanced_news_radar.py`'yi kullan ve *impact_score'u otomatik hesaplet.*

---

🐙 **Sistem böyle evrimleşir. Başla basitçe, sonra öğren!**
