"""
📊 CORRELATION TRACKER
Hangi haberin hangi piyasayı etkileyeceğini otomatik olarak öğren.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List
import yfinance as yf
from telegram_subayi import gonder

logger = logging.getLogger(__name__)

class CorrelationTracker:
    """
    Olaylar ve piyasa reaksiyonları arasında ilişki öğren.
    
    Örneğin:
    - "OPEC petrol üretimi azaltıyor" → 15 dakika sonra BTC +2%, Gold +1.5%
    - "Fed faiz artırıyor" → 15 dakika sonra BTC -3%, Stocks -2%
    """
    
    def __init__(self, correlations_file="correlations.json"):
        """Öğrenilmiş korelasyonları yükle."""
        try:
            with open(correlations_file, "r") as f:
                self.correlations = json.load(f)
            logger.info("✅ Korelasyonlar yüklendi")
        except FileNotFoundError:
            # Başlangıç değerleri
            self.correlations = {
                "oil_down": {"btc": 0.65, "gold": 0.72, "stocks": -0.58},
                "fed_raises_rates": {"btc": -0.82, "stocks": -0.79, "bonds": 0.91},
                "geopolitical_crisis": {"gold": 0.88, "btc": 0.71, "stocks": -0.75},
                "crypto_crash": {"btc": -1.0, "stocks": 0.35, "gold": 0.45},
                "inflation_spike": {"gold": 0.85, "btc": 0.65, "stocks": -0.70}
            }
            logger.info("📝 Başlangıç korelasyonları oluşturuldu")
        
        self.event_log = []
        self.correlations_file = correlations_file
    
    def olay_kaydet(self, event_type: str, timestamp: datetime = None):
        """
        Önemli bir olay kaydet. Bu olaydan 15 dakika sonra piyasaları kontrol edeceğiz.
        
        Args:
            event_type: "oil_down", "fed_raises_rates", vb.
            timestamp: Olay zamanı (default: şimdi)
        """
        if timestamp is None:
            timestamp = datetime.now()
        
        self.event_log.append({
            "type": event_type,
            "timestamp": timestamp,
            "check_time": timestamp + timedelta(minutes=15),
            "observed_impacts": None
        })
        
        logger.info(f"📍 Olay kaydedildi: {event_type}")
        return len(self.event_log) - 1
    
    async def piyasa_verilerini_al(self, symbol: str, period: str = "1d") -> Dict:
        """
        Bir piyasanın son verilerini çek.
        """
        try:
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(
                None,
                lambda: yf.download(symbol, period=period, progress=False)
            )
            
            if data.empty or len(data) < 2:
                return None
            
            # Son iki günün değişimi
            son_kapat = float(data.iloc[-1]["Close"])
            onceki_kapat = float(data.iloc[-2]["Close"])
            
            degisim = (son_kapat - onceki_kapat) / onceki_kapat
            
            return {
                "symbol": symbol,
                "last_price": son_kapat,
                "change_percent": degisim,
                "volume": float(data.iloc[-1]["Volume"])
            }
        
        except Exception as e:
            logger.warning(f"⚠️ Veri çekme hatası ({symbol}): {e}")
            return None
    
    async def olay_etkilerini_kontrol_et(self, event_index: int) -> Dict:
        """
        Kaydedilmiş bir olaydan 15 dakika sonra, piyasaların nasıl tepki verdiğini kontrol et.
        
        Args:
            event_index: event_log içindeki index
        
        Returns:
            {
                "event_type": "oil_down",
                "observed_impacts": {"btc": 0.02, "gold": 0.015, "stocks": -0.01},
                "accuracy": 0.85  (Tahmin doğru muydu)
            }
        """
        if event_index >= len(self.event_log):
            return None
        
        event = self.event_log[event_index]
        
        # Kontrol zamanına mı geldi?
        if datetime.now() < event["check_time"]:
            # Henüz 15 dakika geçmedi
            return None
        
        event_type = event["type"]
        
        # Piyasaları kontrol et
        observed_impacts = {}
        
        market_symbols = {
            "btc": "BTC-USD",
            "gold": "GC=F",
            "stocks": "^GSPC",
            "oil": "USOIL=F",
            "bonds": "^TNX"
        }
        
        logger.info(f"🔍 {event_type} etkilerini kontrol ediliyor...")
        
        for market_name, symbol in market_symbols.items():
            data = await self.piyasa_verilerini_al(symbol, period="1d")
            
            if data:
                observed_impacts[market_name] = data["change_percent"]
        
        # Gözlemlenen etkileri kaydet
        event["observed_impacts"] = observed_impacts
        
        return {
            "event_type": event_type,
            "observed_impacts": observed_impacts,
            "predicted_impacts": self.correlations.get(event_type, {})
        }
    
    def korelasyonlari_guncelle(self, event_type: str, observed_impacts: Dict):
        """
        Gerçekleşen etkileri gözlemle, korelasyonları güncelle.
        
        Exponential moving average (EMA) ile eski ve yeni verileri dengele.
        """
        if event_type not in self.correlations:
            self.correlations[event_type] = {}
        
        alpha = 0.3  # Yeni veri ağırlığı (0.3 = 30% yeni, 70% eski)
        
        for market, actual_impact in observed_impacts.items():
            old_corr = self.correlations[event_type].get(market, 0.5)
            
            # EMA formülü
            new_corr = (1 - alpha) * old_corr + alpha * actual_impact
            
            self.correlations[event_type][market] = round(new_corr, 2)
            
            # Değişim büyükse log et
            if abs(new_corr - old_corr) > 0.1:
                logger.info(
                    f"📈 {event_type} → {market}: "
                    f"{old_corr:.2f} → {new_corr:.2f}"
                )
        
        # Güncellenmiş korelasyonları kaydet
        self._kaydet()
    
    def tahmin_et(self, event_type: str, confidence: float = 0.0) -> Dict:
        """
        Bir olayın piyasalara etkisini tahmin et.
        
        Args:
            event_type: "oil_down", "fed_raises_rates", vb.
            confidence: Olayın gerçekleşme olasılığı (0-1)
        
        Returns:
            {
                "event_type": "oil_down",
                "predicted_impacts": {"btc": 0.65, "gold": 0.72},
                "confidence": 0.85
            }
        """
        predicted = self.correlations.get(event_type, {})
        
        return {
            "event_type": event_type,
            "predicted_impacts": predicted,
            "confidence": confidence,
            "top_3_markets": sorted(
                predicted.items(),
                key=lambda x: abs(x[1]),
                reverse=True
            )[:3]
        }
    
    def _kaydet(self):
        """Korelasyonları dosyaya kaydet."""
        try:
            with open(self.correlations_file, "w") as f:
                json.dump(self.correlations, f, indent=2)
            logger.info("✅ Korelasyonlar kaydedildi")
        except Exception as e:
            logger.error(f"❌ Kaydetme hatası: {e}")
    
    async def baslatTi_monitor_loop(self):
        """
        Arka planda çalışan kontrol döngüsü.
        Her olay için 15 dakika sonra etkileri kontrol et.
        """
        logger.info("🔄 Korelasyon Monitor başladı")
        
        while True:
            try:
                # Kontrol zamanına gelen olayları işle
                for i, event in enumerate(self.event_log):
                    if (event["observed_impacts"] is None and 
                        datetime.now() >= event["check_time"]):
                        
                        # Etkileri kontrol et
                        result = await self.olay_etkilerini_kontrol_et(i)
                        
                        if result:
                            # Korelasyonları güncelle
                            self.korelasyonlari_guncelle(
                                result["event_type"],
                                result["observed_impacts"]
                            )
                            
                            # Rapor gönder
                            rapor = (
                                f"📊 **{result['event_type'].upper()} - ETKİ RAPORU**\n\n"
                                f"Gözlemlenen Etkiler:\n"
                            )
                            
                            for market, impact in result["observed_impacts"].items():
                                emoji = "📈" if impact > 0 else "📉"
                                rapor += f"{emoji} {market.upper()}: {impact*100:+.1f}%\n"
                            
                            await gonder(rapor, emoji="📊")
                
                await asyncio.sleep(60)  # Her dakika kontrol et
            
            except Exception as e:
                logger.error(f"🔴 Monitor loop hatası: {e}")
                await asyncio.sleep(60)

# Global instance
correlation_tracker = CorrelationTracker("correlations.json")

async def baslatCorrelationTracker():
    """Monitor loop'u başlat."""
    await correlation_tracker.baslatTi_monitor_loop()

# Kullanım örneği (news_radar.py'dan çağrılabilir):
async def olay_tespit_et(kategori: str, baslik: str) -> Dict:
    """
    Bir haber kategorisini olay olarak kaydet ve tahmin et.
    """
    event_mapping = {
        "oil_sensitive": "oil_down",
        "defcon_1": "geopolitical_crisis",
        "defcon_2": "fed_raises_rates",
        "crypto_specific": "crypto_crash"
    }
    
    event_type = event_mapping.get(kategori, "unknown_event")
    
    # Olayı kaydet
    event_index = correlation_tracker.olay_kaydet(event_type)
    
    # Tahmini al
    prediction = correlation_tracker.tahmin_et(event_type, confidence=0.85)
    
    return {
        "event_index": event_index,
        "prediction": prediction
    }
