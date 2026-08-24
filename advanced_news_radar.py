"""
🚀 ADVANCED NEWS RADAR
Dinamik keyword yönetimi, impact scoring ve genişletilebilir sistem.
"""

import asyncio
import logging
import json
import feedparser
from datetime import datetime
from typing import Tuple, Dict
from telegram_subayi import gonder, telegram_subayi

logger = logging.getLogger(__name__)

TRACKED_NEWS = set()
RSS_FEEDS = [
    "https://feeds.bloomberg.com/markets/news.rss",
    "https://feeds.cnbc.com/cnbcnewslist.rss",
    "https://feeds.reuters.com/reuters/businessNews",
]

class AdvancedNewsRadar:
    """Dinamik ve öğrenen haber radar sistemi."""
    
    def __init__(self, keywords_file="keywords.json"):
        """Keywords.json'dan dinamik kategoriyi yükle."""
        try:
            with open(keywords_file, "r", encoding="utf-8") as f:
                self.keyword_categories = json.load(f)
            logger.info(f"✅ {len(self.keyword_categories)} kategori yüklendi")
        except FileNotFoundError:
            logger.error(f"❌ {keywords_file} bulunamadı!")
            self.keyword_categories = {}
        
        self.check_interval = 3 * 60
        self.event_history = []
    
    async def fetch_feeds(self) -> list:
        """RSS akışlarını asenkron çek."""
        haberler = []
        for feed_url in RSS_FEEDS:
            try:
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, feedparser.parse, feed_url)
                
                if result.entries:
                    for entry in result.entries[:5]:
                        haberler.append({
                            "title": entry.get("title", ""),
                            "summary": entry.get("summary", ""),
                            "link": entry.get("link", ""),
                            "source": feed_url.split("/")[2],
                            "published": entry.get("published", "")
                        })
            except Exception as e:
                logger.warning(f"⚠️ Feed hatası ({feed_url}): {e}")
                continue
        
        return haberler
    
    def kategoriye_gore_analiz(self, baslik: str, ozet: str) -> Tuple[str, float]:
        """
        Haberi kategori ve şiddete göre sınıflandır.
        
        Returns:
            (kategori_adı, etki_gücü_0_1)
        """
        metin = f"{baslik} {ozet}".lower()
        
        en_yuksek_kategori = "NORMAL"
        en_yuksek_strength = 0
        
        for kategori, config in self.keyword_categories.items():
            keywords = config.get("keywords", [])
            strength = config.get("strength", 0.5)
            
            # Kaç kelime eşleşti
            match_count = sum(1 for kw in keywords if kw.lower() in metin)
            
            if match_count > 0:
                kategori_strength = strength * (1 + match_count * 0.1)
                
                if kategori_strength > en_yuksek_strength:
                    en_yuksek_strength = kategori_strength
                    en_yuksek_kategori = kategori
        
        # 0-1 aralığına sınırla
        final_strength = min(en_yuksek_strength, 1.0)
        
        return en_yuksek_kategori, final_strength
    
    def keywordler_ekle(self, kategori: str, yeni_kelimeler: list, strength: float = 0.8):
        """
        Runtime'da yeni keywords ekle.
        Örn: Yeni bir risk türü keşfedilirse, oto ekle.
        """
        if kategori not in self.keyword_categories:
            self.keyword_categories[kategori] = {
                "keywords": [],
                "strength": strength,
                "description": "Dinamik olarak eklendi"
            }
        
        self.keyword_categories[kategori]["keywords"].extend(yeni_kelimeler)
        
        # JSON'a kaydet
        try:
            with open("keywords.json", "w", encoding="utf-8") as f:
                json.dump(self.keyword_categories, f, ensure_ascii=False, indent=2)
            logger.info(f"✅ {kategori} kategorisine {yeni_kelimeler} eklendi")
        except Exception as e:
            logger.error(f"❌ Keyword kaydetme hatası: {e}")
    
    def impact_skoru_hesapla(self, kategori: str, strength: float, baslik: str) -> Dict:
        """
        Haberin toplam piyasa etkisini hesapla.
        
        Returns:
            {
                "impact_score": 0-10,
                "severity_emoji": "🚨" / "⚠️" / "📊",
                "severity_label": "KATASTROFİK" / "UYARI" / "NORMAL",
                "affected_markets": ["btc", "gold", "stocks"]
            }
        """
        # Temel etki skoru (0-10)
        base_score = strength * 10
        
        # Kategoriye göre ayarla
        kategori_multiplier = {
            "defcon_1": 1.0,
            "defcon_2": 0.8,
            "crypto_specific": 0.85,
            "oil_sensitive": 0.7,
            "geopolitical": 0.75,
            "gold_flight": 0.65
        }
        
        adjusted_score = base_score * kategori_multiplier.get(kategori, 0.5)
        impact_score = min(adjusted_score, 10.0)
        
        # Şiddet belirleme
        if impact_score >= 8.5:
            emoji, label = "🚨", "KATASTROFİK"
            affected = ["btc", "stocks", "gold", "oil"]
        elif impact_score >= 7:
            emoji, label = "🔴", "ÇOK AĞIR"
            affected = ["btc", "stocks", "gold"]
        elif impact_score >= 5:
            emoji, label = "🟠", "AĞIR"
            affected = ["btc", "stocks"]
        elif impact_score >= 3:
            emoji, label = "🟡", "ORTA"
            affected = ["btc"]
        else:
            emoji, label = "🟢", "HAFİF"
            affected = []
        
        return {
            "impact_score": round(impact_score, 1),
            "severity_emoji": emoji,
            "severity_label": label,
            "affected_markets": affected,
            "kategori": kategori
        }
    
    async def tarama_yapTi(self):
        """RSS akışlarını tarar ve analiz eder."""
        try:
            haberler = await self.fetch_feeds()
            
            for haber in haberler:
                haber_id = f"{haber['title']}_{haber['source']}"
                
                if haber_id in TRACKED_NEWS:
                    continue
                
                TRACKED_NEWS.add(haber_id)
                
                # Analiz et
                kategori, strength = self.kategoriye_gore_analiz(
                    haber['title'],
                    haber['summary']
                )
                
                # Impact skoru hesapla
                impact = self.impact_skoru_hesapla(kategori, strength, haber['title'])
                
                # Etki puanı yüksekse haber gönder
                if impact['impact_score'] >= 5:
                    mesaj = (
                        f"{impact['severity_emoji']} **{impact['severity_label']}**\n\n"
                        f"📰 {haber['title'][:100]}\n\n"
                        f"💥 Etki Skoru: {impact['impact_score']}/10\n"
                        f"🎯 Etkilenen Pazarlar: {', '.join(impact['affected_markets']).upper()}\n"
                        f"📁 Kategori: {kategori}\n\n"
                        f"🔗 {haber['link']}"
                    )
                    
                    # Şiddete göre farklı alarm tipi
                    if impact['impact_score'] >= 8.5:
                        await telegram_subayi.defcon_1_alarm(
                            baslik=haber['title'][:80],
                            aciklama=mesaj
                        )
                    else:
                        await gonder(mesaj, emoji=impact['severity_emoji'])
                    
                    # Event'i kaydet (learning için)
                    self.event_history.append({
                        "timestamp": datetime.now().isoformat(),
                        "title": haber['title'],
                        "kategori": kategori,
                        "impact_score": impact['impact_score'],
                        "affected_markets": impact['affected_markets']
                    })
        
        except Exception as e:
            logger.error(f"🔴 Tarama hatası: {e}")
    
    def istatistik_goster(self):
        """Dönem itibarıyla istatistikleri göster."""
        if not self.event_history:
            return None
        
        top_events = sorted(
            self.event_history,
            key=lambda x: x['impact_score'],
            reverse=True
        )[:5]
        
        avg_impact = sum(e['impact_score'] for e in self.event_history) / len(self.event_history)
        
        return {
            "toplam_olay": len(self.event_history),
            "ortalama_impact": round(avg_impact, 1),
            "en_etkileyici_5": top_events,
            "kategoriler": list(set(e['kategori'] for e in self.event_history))
        }
    
    async def baslatTi_loop(self):
        """Sonsuz tarama döngüsü."""
        logger.info("🚀 Advanced News Radar başladı")
        
        while True:
            try:
                await self.tarama_yapTi()
                
                # Her saat başında istatistik
                now = datetime.now()
                if now.minute == 0:
                    stats = self.istatistik_goster()
                    if stats:
                        rapor = (
                            f"📊 **SAATLIK İSTATİSTİK**\n\n"
                            f"📈 Toplam Olay: {stats['toplam_olay']}\n"
                            f"💯 Ort. Impact: {stats['ortalama_impact']}/10\n"
                            f"🎯 Kategoriler: {', '.join(stats['kategoriler'][:3])}"
                        )
                        await gonder(rapor, emoji="📊")
                
                await asyncio.sleep(self.check_interval)
            
            except Exception as e:
                logger.error(f"🔴 Loop hatası: {e}")
                await asyncio.sleep(self.check_interval)

# Global instance
advanced_news_radar = AdvancedNewsRadar("keywords.json")

async def baslatAdvancedNewsRadar():
    """Advanced News Radar'ı başlat."""
    await advanced_news_radar.baslatTi_loop()
