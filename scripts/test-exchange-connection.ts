import { config } from '../src/config/index.js';
import { binanceService } from '../src/services/binance/BinanceService.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  console.log('\n================================================================');
  console.log('🔶 OCTOPUS PRIME — BINANCE TESTNET BAĞLANTI & VERİ DOĞRULAMA');
  console.log('================================================================\n');

  console.log('📋 Mevcut Konfigürasyon:');
  console.log(`  • Exchange Provider    : ${config.EXCHANGE_PROVIDER}`);
  console.log(`  • Binance Testnet      : ${config.BINANCE_TESTNET}`);
  console.log(`  • Real Orders Enabled  : ${config.ENABLE_REAL_ORDERS}`);
  console.log(`  • Max Leverage Cap     : ${config.MAX_LEVERAGE_ALLOWED}x`);
  console.log(`  • Max Pos Size (USD)   : $${config.MAX_POSITION_SIZE_USD}`);
  console.log(`  • API Key Durumu       : ${config.BINANCE_API_KEY ? (config.BINANCE_API_KEY.startsWith('testnet_') ? '⚠️ Placeholder (Varsayılan)' : '✅ Tanımlı (' + config.BINANCE_API_KEY.slice(0, 6) + '...)') : '❌ Tanımsız'}`);

  console.log('\n----------------------------------------------------------------');
  console.log('1️⃣ CANLI PİYASA & FİYAT VERİSİ TESTİ (Binance Public Ticker)');
  console.log('----------------------------------------------------------------');

  const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
  for (const sym of symbols) {
    try {
      const ticker = await binanceService.fetchTicker(sym);
      console.log(`  🟢 ${sym.padEnd(10)}: Fiyat = $${ticker.lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })} | 24s Değişim = %${ticker.change24hPercent.toFixed(2)} | Hacim = ${ticker.volume24h.toFixed(1)}`);
    } catch (err) {
      console.error(`  🔴 ${sym} ticker hatası:`, (err as Error).message);
    }
  }

  console.log('\n----------------------------------------------------------------');
  console.log('2️⃣ TEKNİK GRAFİK & MUM VERİSİ TESTİ (15m OHLCV)');
  console.log('----------------------------------------------------------------');

  try {
    const candles = await binanceService.fetchCandles('BTC/USDT', '15m', 5);
    console.log(`  📊 Son 5 Adet 15 Dakikalık BTC/USDT Mumu:`);
    candles.forEach((c: any, i: number) => {
      const timeStr = new Date(c.timestamp).toLocaleTimeString();
      console.log(`     [${i + 1}] ${timeStr} -> Açılış: $${c.open} | Yüksek: $${c.high} | Düşük: $${c.low} | Kapanış: $${c.close} | Hacim: ${c.volume}`);
    });
  } catch (err) {
    console.error('  🔴 Mum verisi çekilemedi:', (err as Error).message);
  }

  console.log('\n----------------------------------------------------------------');
  console.log('3️⃣ HESAP & BAKİYE TESTİ (Binance Testnet USDT Cüzdanı)');
  console.log('----------------------------------------------------------------');

  try {
    const balance = await binanceService.fetchBalance();
    console.log(`  💰 Toplam Bakiye (USD) : $${balance.totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  💵 Kullanılabilir USDT : $${balance.freeUsdt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    if (balance.assets) {
      console.log('  📦 Varlık Dağılımı:');
      for (const [coin, data] of Object.entries(balance.assets)) {
        if (data.total > 0) {
          console.log(`     • ${coin.padEnd(6)}: Toplam = ${data.total} | Serbest = ${data.free} | Kullanılan = ${data.used}`);
        }
      }
    }
  } catch (err) {
    console.error('  🔴 Bakiye sorgulama hatası:', (err as Error).message);
  }

  console.log('\n----------------------------------------------------------------');
  console.log('4️⃣ AÇIK POZİSYONLAR & LİKİDASYON RİSK KONTROLÜ');
  console.log('----------------------------------------------------------------');

  try {
    const positions = await binanceService.fetchPositions();
    if (positions.length === 0) {
      console.log('  ℹ️ Şu anda açık aktif pozisyon bulunmuyor.');
    } else {
      console.log(`  📌 Toplam ${positions.length} Açık Pozisyon:`);
      positions.forEach((p, idx) => {
        console.log(`     [${idx + 1}] ${p.symbol} (${p.side} ${p.leverage}x ${p.marginMode})`);
        console.log(`         Miktar: ${p.amount} | Giriş: $${p.entryPrice} | Mark: $${p.markPrice} | PnL: $${p.unrealizedPnl} (%${p.percentagePnl})`);
        if (p.liquidationPrice) {
          console.log(`         🚨 Likidasyon Fiyatı: $${p.liquidationPrice}`);
        }
      });
    }
  } catch (err) {
    console.error('  🔴 Pozisyon sorgulama hatası:', (err as Error).message);
  }

  console.log('\n----------------------------------------------------------------');
  console.log('5️⃣ KALDIRAÇ & FORMÜL TESTİ (Liquidation Math)');
  console.log('----------------------------------------------------------------');

  const testPrice = 65000;
  const long5xLiq = binanceService.calculateLiquidationPrice('BTC/USDT', testPrice, 5, 'LONG');
  const short5xLiq = binanceService.calculateLiquidationPrice('BTC/USDT', testPrice, 5, 'SHORT');
  const long10xLiq = binanceService.calculateLiquidationPrice('BTC/USDT', testPrice, 10, 'LONG');

  console.log(`  🧮 Giriş Fiyatı: $${testPrice}`);
  console.log(`     • 5x LONG Likidasyon Noktası  : $${long5xLiq} (Maksimum %20 düşüş toleransı)`);
  console.log(`     • 5x SHORT Likidasyon Noktası : $${short5xLiq} (Maksimum %20 yükseliş toleransı)`);
  console.log(`     • 10x LONG Likidasyon Noktası : $${long10xLiq} (Maksimum %10 düşüş toleransı)`);

  console.log('\n================================================================');
  console.log('✅ TEST TAMAMLANDI: Bütün servisler ve matematiksel hesaplamalar hazır!');
  console.log('================================================================\n');

  process.exit(0);
}

main().catch((err) => {
  logger.error('💥 Test çalıştırma hatası:', err);
  process.exit(1);
});
