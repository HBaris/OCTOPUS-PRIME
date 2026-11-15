# 🐙 Octopus Prime

A crypto-market visualization and trading-agent platform. It combines three signal channels in real time: news, technical analysis and social signals. Results are shown in a live dashboard.

> Personal project. Not financial advice; use exchange test accounts.

## Highlights

- **Multi-exchange abstraction** over [CCXT](https://github.com/ccxt/ccxt) (Binance / OKX) behind one interface.
- **Event-driven core:** market, news and agent events flow over a WebSocket stream to the frontend.
- **Sentiment model:** ONNX sentiment model scoring news headlines inside the Node.js process.
- **Agents:** specialist agents (news, technicals, risk) feed a decision engine with dynamic take-profit, trailing stop and circuit breakers.
- **Visualization:** Phaser 3 / Vite frontend.
- **Telegram bot:** a 24/7 Python asyncio market bot.
- **Tests:** 49 passing tests (Jest).

## Stack

Node.js · TypeScript · Phaser 3 · Vite · CCXT · ONNX Runtime · WebSocket · Python (asyncio) · Jest

## Structure

```
src/        Node.js / TypeScript backend: agents, events, services, exchange adapters
frontend/   Vite + Phaser 3 dashboard
scripts/    helper scripts
*.py        news radar, correlation tracker, feedback system, Telegram bot
```

## Run

```bash
npm install
cp .env.example .env   # exchange / news API keys (never commit real keys)
npm run dev
```

Architecture notes (Turkish): `SON_MIMARI_VE_GELISTIRMELER.md`, `GELISTIRME_ROADMAP.md`.
