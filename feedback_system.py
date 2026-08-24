"""
👍 FEEDBACK SYSTEM
Telegram emoji tepkileri ile bot'un uyarılarını değerlendir ve sistem öğren.

Kullanıcı şu emojileri kullanabilir:
✅ = Doğru ve faydalı uyarı
❌ = Yanlış alarm
🔥 = Çok önemli, işlem yapan
😴 = Sıkıcı, alakasız
⚡ = Harekete geçirecek kadar eyleme dönük
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List

logger = logging.getLogger(__name__)

class FeedbackSystem:
    """
    Kullanıcı geri bildirimi topla ve sistem performansını iyileştir.
    """
    
    def __init__(self, feedback_file="feedback.json"):
        """Geçmiş feedbackleri yükle."""
        try:
            with open(feedback_file, "r") as f:
                self.feedback_history = [json.loads(line) for line in f]
            logger.info(f"✅ {len(self.feedback_history)} feedback yüklendi")
        except FileNotFoundError:
            self.feedback_history = []
            logger.info("📝 Yeni feedback dosyası oluşturuldu")
        
        self.feedback_file = feedback_file
        
        # Emoji anlamlandırma
        self.emoji_meanings = {
            "✅": "accurate",
            "❌": "false_alarm",
            "🔥": "critical",
            "😴": "boring",
            "⚡": "actionable"
        }
    
    async def feedback_kaydet(
        self,
        message_id: str,
        emoji: str,
        baslik: str = "",
        kategori: str = ""
    ) -> Dict:
        """
        Kullanıcı feedback'ini kaydet.
        
        Args:
            message_id: Telegram mesaj ID'si
            emoji: Kullanıcı tarafından seçilen emoji
            baslik: Habar başlığı (context için)
            kategori: Haber kategorisi (context için)
        
        Returns:
            Kaydedilen feedback
        """
        feedback = {
            "message_id": message_id,
            "emoji": emoji,
            "emoji_meaning": self.emoji_meanings.get(emoji, "unknown"),
            "baslik": baslik,
            "kategori": kategori,
            "timestamp": datetime.now().isoformat()
        }
        
        self.feedback_history.append(feedback)
        
        # Dosyaya append et
        try:
            with open(self.feedback_file, "a") as f:
                f.write(json.dumps(feedback) + "\n")
            logger.info(f"✅ Feedback kaydedildi: {emoji}")
        except Exception as e:
            logger.error(f"❌ Feedback kaydetme hatası: {e}")
        
        return feedback
    
    def analiz_et(self, son_n_gün: int = 7) -> Dict:
        """
        Feedback'leri analiz et ve sistem performansını değerlendir.
        
        Args:
            son_n_gün: Kaç gün öncesinden itibaren analiz et
        
        Returns:
            Analiz sonuçları
        """
        cutoff_date = datetime.now() - timedelta(days=son_n_gün)
        
        recent_feedback = [
            f for f in self.feedback_history
            if datetime.fromisoformat(f["timestamp"]) > cutoff_date
        ]
        
        if not recent_feedback:
            return {
                "total_feedback": 0,
                "message": "❌ Yeterli feedback yok"
            }
        
        # Emoji sayıları
        emoji_counts = {}
        for feedback in recent_feedback:
            meaning = feedback["emoji_meaning"]
            emoji_counts[meaning] = emoji_counts.get(meaning, 0) + 1
        
        # Doğruluk hesapla (accurate + actionable) / total
        accurate = emoji_counts.get("accurate", 0)
        actionable = emoji_counts.get("actionable", 0)
        false_alarms = emoji_counts.get("false_alarm", 0)
        critical = emoji_counts.get("critical", 0)
        boring = emoji_counts.get("boring", 0)
        
        total = len(recent_feedback)
        accuracy_rate = (accurate + actionable) / total if total > 0 else 0
        false_alarm_rate = false_alarms / total if total > 0 else 0
        
        # Kategori bazında analiz
        kategori_stats = {}
        for feedback in recent_feedback:
            kategori = feedback.get("kategori", "unknown")
            
            if kategori not in kategori_stats:
                kategori_stats[kategori] = {
                    "total": 0,
                    "accurate": 0,
                    "false_alarm": 0
                }
            
            kategori_stats[kategori]["total"] += 1
            
            if feedback["emoji_meaning"] in ["accurate", "actionable"]:
                kategori_stats[kategori]["accurate"] += 1
            elif feedback["emoji_meaning"] == "false_alarm":
                kategori_stats[kategori]["false_alarm"] += 1
        
        # En iyi ve en kötü kategoriler
        kategori_accuracy = {}
        for k, v in kategori_stats.items():
            if v["total"] > 0:
                kategori_accuracy[k] = v["accurate"] / v["total"]
        
        best_kategori = max(kategori_accuracy.items(), key=lambda x: x[1], default=None)
        worst_kategori = min(kategori_accuracy.items(), key=lambda x: x[1], default=None)
        
        return {
            "period": f"Son {son_n_gün} gün",
            "total_feedback": total,
            "emoji_breakdown": emoji_counts,
            "accuracy_rate": round(accuracy_rate, 2),
            "false_alarm_rate": round(false_alarm_rate, 2),
            "critical_count": critical,
            "best_kategori": best_kategori[0] if best_kategori else "N/A",
            "worst_kategori": worst_kategori[0] if worst_kategori else "N/A",
            "recommendation": self._tavsiye_yap(accuracy_rate, false_alarm_rate),
            "kategori_details": kategori_stats
        }
    
    def _tavsiye_yap(self, accuracy: float, false_alarm: float) -> str:
        """Analiz sonuçlarına göre tavsiye yap."""
        if accuracy > 0.85 and false_alarm < 0.10:
            return "🟢 Sistem mükemmel çalışıyor! Hiçbir değişiklik gerekmiyor."
        elif accuracy > 0.75:
            return "🟡 İyi çalışıyor ama yanlış alarmlar azaltılmalı."
        elif false_alarm > 0.20:
            return "🔴 Çok fazla yanlış alarm! Keyword'ler gözden geçirilmeli."
        else:
            return "📊 Daha fazla feedback gerekiyor (en az 10 feedback)."
    
    def en_verimli_kategoriler(self) -> List[tuple]:
        """
        En doğru tahminlerin geldiği kategorileri sırala.
        
        Returns:
            [("crypto_specific", 0.92), ("oil_sensitive", 0.85), ...]
        """
        analiz = self.analiz_et(son_n_gün=30)
        kategori_details = analiz.get("kategori_details", {})
        
        accuracy_list = []
        for kategori, stats in kategori_details.items():
            if stats["total"] >= 3:  # En az 3 feedback
                accuracy = stats["accurate"] / stats["total"]
                accuracy_list.append((kategori, round(accuracy, 2)))
        
        return sorted(accuracy_list, key=lambda x: x[1], reverse=True)
    
    def __repr__(self) -> str:
        """Feedback sistem durumunun özet gösterimi."""
        analiz = self.analiz_et()
        
        return (
            f"📊 FEEDBACK SYSTEM STATUS\n"
            f"========================\n"
            f"Total Feedback: {analiz['total_feedback']}\n"
            f"Accuracy: {analiz['accuracy_rate']*100:.1f}%\n"
            f"False Alarms: {analiz['false_alarm_rate']*100:.1f}%\n"
            f"Tavsiye: {analiz['recommendation']}"
        )

# Global instance
feedback_system = FeedbackSystem("feedback.json")

async def baslatFeedbackSystem():
    """Feedback sistemini başlat (background monitoring için)."""
    logger.info("✅ Feedback System aktif")
    # Tekli başlatma, background monitoring değil
    # Feedback'ler her mesajdan sonra kaydedilir

# Kullanım örneği (telegram_subayi.py'da çağrılabilir):
async def mesaj_gonder_with_feedback(
    bot,
    chat_id: int,
    mesaj: str,
    baslik: str = "",
    kategori: str = ""
) -> int:
    """
    Mesaj gönder ve feedback emoji'lerini ekle.
    
    Returns:
        Mesaj ID'si (feedback kaydı için gerekli)
    """
    # Mesajı gönder
    sent_message = await bot.send_message(chat_id=chat_id, text=mesaj)
    
    # Feedback emojilerini ekle
    feedback_emojis = ["✅", "❌", "🔥", "😴", "⚡"]
    
    for emoji in feedback_emojis:
        try:
            await sent_message.set_reaction(emoji)
        except Exception as e:
            logger.debug(f"Emoji eklenirken hata: {e}")
    
    return sent_message.message_id

# Haftalık rapor
def haftalik_feedback_rapor() -> str:
    """Haftalık performans raporu oluştur."""
    analiz = feedback_system.analiz_et(son_n_gün=7)
    best_categories = feedback_system.en_verimli_kategoriler()
    
    rapor = f"""
📊 HAFTALIK FEEDBACK RAPORU
==========================

📈 İstatistikler:
- Toplam Feedback: {analiz['total_feedback']}
- Doğruluk Oranı: {analiz['accuracy_rate']*100:.1f}%
- Yanlış Alarm: {analiz['false_alarm_rate']*100:.1f}%
- Kritik Uyarılar: {analiz['critical_count']}

🏆 En Verimli Kategoriler:
"""
    
    for i, (kategori, accuracy) in enumerate(best_categories[:3], 1):
        rapor += f"{i}. {kategori}: {accuracy*100:.1f}%\n"
    
    rapor += f"""
💡 Tavsiye: {analiz['recommendation']}

📁 Detaylı analiz için /feedback_details komutunu kullan.
"""
    
    return rapor
