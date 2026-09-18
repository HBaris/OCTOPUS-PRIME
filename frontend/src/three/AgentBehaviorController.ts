import * as THREE from 'three';
import { Character3D } from './Character3D.ts';
import { OfficeEnvironment } from './OfficeEnvironment.ts';
import { wsService } from '../services/websocket.ts';
import {
  SignalGeneratedPayload,
  TradeProposalPayload,
  NewNewsPayload,
  SceneSeverityPayload,
} from '../types/events.ts';
import { formatSignalDialogue } from '../utils/signalDialogue.ts';

export class AgentBehaviorController {
  private characters: Map<string, Character3D> = new Map();
  private env: OfficeEnvironment;
  private breakIntervalTimer: any = null;
  private isProcessingEvent: boolean = false;

  constructor(env: OfficeEnvironment) {
    this.env = env;
    this.subscribeToGameEvents();
    this.startAutonomousBreakRoutine();
  }

  public registerCharacter(role: string, character: Character3D): void {
    this.characters.set(role, character);
  }

  public getCharacter(role: string): Character3D | undefined {
    return this.characters.get(role);
  }

  public getAllCharacters(): Character3D[] {
    return Array.from(this.characters.values());
  }

  /**
   * Autonomous AI Schedule: Pick idle working characters and send them on realistic breaks
   */
  private startAutonomousBreakRoutine(): void {
    // Schedule check every 12-20 seconds
    const scheduleNext = () => {
      const delay = 12000 + Math.random() * 8000;
      this.breakIntervalTimer = setTimeout(() => {
        this.runAutonomousCycle();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }

  private runAutonomousCycle(): void {
    // If high-priority trade event is active, don't initiate new breaks
    if (this.isProcessingEvent) return;

    // Filter agents currently sitting and working
    const workingAgents = Array.from(this.characters.values()).filter(
      (c) => c.currentState === 'WORKING'
    );

    if (workingAgents.length === 0) return;

    // Count currently on-break agents (max 3 on break at any time to keep office active)
    const onBreakCount = Array.from(this.characters.values()).filter(
      (c) => c.currentState !== 'WORKING'
    ).length;

    if (onBreakCount >= 3) return;

    // Pick 1 random working agent (give slight preference to non-Patron to keep Patron in control)
    const candidates = workingAgents.filter((c) => c.role !== 'Patron' || Math.random() > 0.7);
    if (candidates.length === 0) return;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const breakType = Math.random();

    if (breakType < 0.5) {
      // ☕ Coffee Break (50%)
      const target = this.env.coffeeMachinePos.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.4)
      );

      chosen.startCoffeeBreak(target, () => {
        // Stay drinking coffee for 10-16s, then return
        setTimeout(() => {
          if (chosen.currentState === 'DRINKING_COFFEE') {
            chosen.returnToDesk();
          }
        }, 10000 + Math.random() * 6000);
      });
    } else if (breakType < 0.8) {
      // 🚬 Smoke Break on Balcony (30%)
      const spotIdx = Math.floor(Math.random() * this.env.balconySpots.length);
      const target = this.env.balconySpots[spotIdx].clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.4)
      );

      chosen.startSmokeBreak(target, () => {
        // Smoke for 12-18s, then return
        setTimeout(() => {
          if (chosen.currentState === 'SMOKING') {
            chosen.returnToDesk();
          }
        }, 12000 + Math.random() * 6000);
      });
    } else {
      // 💧 Water Cooler / Lounge chat (20%)
      const target = this.env.waterCoolerPos.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4)
      );

      chosen.say('Bir bardak su alıp geliyorum...', 3000, '#38bdf8');
      chosen.walkTo(target, () => {
        chosen.currentState = 'DRINKING_WATER';
        chosen.renderSpeechBubble(chosen.config.avatarIcon, chosen.name, 'Su Molası 💧', '#38bdf8');
        setTimeout(() => {
          if (chosen.currentState === 'DRINKING_WATER') {
            chosen.returnToDesk();
          }
        }, 8000 + Math.random() * 4000);
      });
    }
  }

  /**
   * Listen to real-time events from Backend & Preempt breaks when trading actions happen
   */
  private subscribeToGameEvents(): void {
    // 1. SIGNAL_GENERATED (Sinyal Avcısı Ali & Coin Analistleri)
    wsService.on<SignalGeneratedPayload>('SIGNAL_GENERATED', (signal: SignalGeneratedPayload) => {
      this.handleTradingSignalEvent(signal);
    });

    // 2. TRADE_PROPOSAL (Patron & Binance İşlemci)
    wsService.on<TradeProposalPayload>('TRADE_PROPOSAL', (proposal: TradeProposalPayload) => {
      this.handleTradeProposalEvent(proposal);
    });

    // 3. NEW_NEWS (Haber Takip & Makro Ekonomist)
    wsService.on<NewNewsPayload>('NEW_NEWS', (news: NewNewsPayload) => {
      this.handleNewsEvent(news);
    });

    // 4. SCENE_SEVERITY_UPDATE (Risk Analisti & Whale Takipçisi)
    wsService.on<SceneSeverityPayload>('SCENE_SEVERITY_UPDATE', (sev: SceneSeverityPayload) => {
      this.handleSeverityUpdate(sev);
    });
  }

  private handleTradingSignalEvent(signal: SignalGeneratedPayload): void {
    this.isProcessingEvent = true;

    // Formatted speech line from Ali
    const dialogue = formatSignalDialogue(signal) || `⚡ ${signal.symbol} ${signal.action} Sinyali!`;

    // 1. Sinyal Avcısı Ali Preemption
    const ali = this.characters.get('Sinyal Avcısı');
    if (ali) {
      if (ali.currentState !== 'WORKING') {
        ali.triggerAlertPreemption(`Sinyal Yakalandı (${signal.symbol})`, () => {
          ali.say(dialogue, 5000, '#ec4899');
        });
      } else {
        ali.say(dialogue, 5000, '#ec4899');
      }
    }

    // 2. Relevant Coin Analyst (BTC, ETH, SOL)
    const coin = signal.symbol.split('/')[0];
    const coinAnalyst = this.characters.get(`${coin} Analisti`);
    if (coinAnalyst) {
      if (coinAnalyst.currentState !== 'WORKING') {
        coinAnalyst.triggerAlertPreemption(`${coin} Sinyali`, () => {
          coinAnalyst.say(`Grafik ve hacim onaylıyor: ${signal.action}!`, 4000, '#10b981');
        });
      } else {
        coinAnalyst.say(`Grafik ve hacim onaylıyor: ${signal.action}!`, 4000, '#10b981');
      }
    }

    setTimeout(() => {
      this.isProcessingEvent = false;
    }, 6000);
  }

  private handleTradeProposalEvent(proposal: TradeProposalPayload): void {
    this.isProcessingEvent = true;

    // 1. Patron Preemption & Approval
    const patron = this.characters.get('Patron');
    if (patron) {
      const pMsg = `🎩 ${proposal.symbol} için ${proposal.suggestedLeverage || 1}x ${proposal.side} ONAYLANDI!`;
      if (patron.currentState !== 'WORKING') {
        patron.triggerAlertPreemption('İşlem Onayı', () => {
          patron.say(pMsg, 5000, '#f59e0b');
        });
      } else {
        patron.say(pMsg, 5000, '#f59e0b');
      }
    }

    // 2. Binance Trader Preemption & Execution
    const trader = this.characters.get('Binance İşlemci');
    if (trader) {
      const tMsg = `🤖 Emir Testnet'e İletildi: ${proposal.side} $${proposal.estimatedPositionSizeUsd || 50}`;
      if (trader.currentState !== 'WORKING') {
        trader.triggerAlertPreemption('Emir İletimi', () => {
          trader.say(tMsg, 5000, '#10b981');
        });
      } else {
        trader.say(tMsg, 5000, '#10b981');
      }
    }

    setTimeout(() => {
      this.isProcessingEvent = false;
    }, 6000);
  }

  private handleNewsEvent(news: NewNewsPayload): void {
    const haber = this.characters.get('Haber Takip');
    if (haber) {
      const shortTitle = news.title.length > 30 ? news.title.slice(0, 30) + '...' : news.title;
      if (haber.currentState !== 'WORKING') {
        haber.triggerAlertPreemption('Sıcak Haber', () => {
          haber.say(`📰 "${shortTitle}" (Etki: ${news.impact?.impactScore || 1}/10)`, 4500, '#38bdf8');
        });
      } else {
        haber.say(`📰 "${shortTitle}" (Etki: ${news.impact?.impactScore || 1}/10)`, 4500, '#38bdf8');
      }
    }
  }

  private handleSeverityUpdate(sev: SceneSeverityPayload): void {
    if (sev.severityLabel === 'ÇOK AĞIR' || sev.severityLabel === 'KATASTROFİK') {
      const risk = this.characters.get('Risk Analisti');
      if (risk) {
        risk.triggerAlertPreemption(`Risk Uyarısı (${sev.severityLabel})`, () => {
          risk.say(`⚠️ Volatilite yüksek! Kaldıraçlar ve SL kontrol ediliyor.`, 5000, '#ef4444');
        });
      }
    }
  }

  public update(delta: number): void {
    // Update all 3D characters
    for (const char of this.characters.values()) {
      char.update(delta);
    }
  }

  public destroy(): void {
    if (this.breakIntervalTimer) {
      clearTimeout(this.breakIntervalTimer);
    }
  }
}
