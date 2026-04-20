# Doppler — Product Vision
> AI-powered CS2 skin market intelligence. Doppler hunts deals, reads patches, and trades on your behalf — within limits you control.

---

## 1. Executive Summary

Doppler is a full-stack AI agent platform built for CS2 skin traders and investors. It continuously monitors the Steam Market and CSFloat marketplace, interprets game patches and meta shifts, analyzes portfolio health, and surfaces high-confidence trade opportunities — all in real time.

For power users, Doppler goes further: you can define your own agent workflows, set auto-execution limits, and let Doppler act on your behalf without manual intervention. Think of it as a Bloomberg Terminal for CS2 skins, with an AI trading desk built in.

The CS2 skin market is a $4+ billion economy that operates 24/7 across multiple platforms with significant pricing inefficiencies between them. No existing tool combines real-time arbitrage detection, patch-driven price forecasting, autonomous execution, and a user-defined agent builder in one platform. That is the gap Doppler fills.

---

## 2. The Problem

### 2.1 The Market Never Sleeps

CS2 skin prices move constantly. A Valve patch drops at 2am and a weapon's meta relevance shifts overnight — skins tied to that weapon can swing 30-40% within hours. CSFloat auctions expire at any hour. Flash deals on underpriced listings disappear in minutes. Manual monitoring at this cadence is humanly impossible.

### 2.2 Data is Fragmented

Prices differ significantly between Steam Market, CSFloat, Skinport, and Buff163. A skin listed at $180 on Steam might be available for $140 on CSFloat right now. Identifying this requires checking multiple platforms simultaneously, accounting for platform fees, and evaluating float values — a process that takes minutes per item manually.

### 2.3 Patch Intelligence is Underserved

When Valve releases a patch, experienced traders know to immediately evaluate which weapons got buffed or nerfed, which cases are affected, and how similar past patches moved prices. This analysis requires reading the patch notes, cross-referencing historical price data, and understanding the competitive meta. Currently, this is done manually by a small number of experienced traders who profit while everyone else reacts late.

### 2.4 Existing Tools are Passive

Tools like SteamLedger, Pricempire, and SteamAnalyst are dashboards — they show you data, but they don't act on it. They don't watch for deals while you sleep, they don't correlate patch notes with price history, and they certainly don't execute trades. Doppler is the first platform designed around agents that work continuously on your behalf.

---

## 3. The Solution

Doppler is organized around five core capabilities:

### 3.1 Real-Time Deal Detection
Autonomous agents poll CSFloat and Steam every few minutes, compare prices across platforms accounting for fees and float value, and surface deals that meet a quality threshold. Users receive instant alerts via browser push, mobile notification, or Discord webhook — before the deal disappears.

### 3.2 Patch Intelligence Engine
A dedicated agent monitors Valve's update feed. When a new patch is detected, it reads the patch notes, searches for community meta commentary, pulls up historical price data for affected weapon families, and generates a structured impact report: which skins are likely to rise, which to fall, and with what confidence. Reports are delivered to users with items in their inventory or watchlist that are affected.

### 3.3 Portfolio Intelligence
Doppler tracks your Steam inventory continuously and evaluates it like a portfolio. It identifies items you're holding at a loss with poor recovery prospects, surfaces items that are approaching peak price based on historical cycles, and proactively recommends rebalancing actions. Weekly portfolio briefings summarize your positions and suggest moves.

### 3.4 Autonomous Execution with Guardrails
For users who want full automation, Doppler can execute buy and sell actions on their behalf. This is governed by a configurable safety system: users set a maximum per-transaction limit, a daily spend cap, and a price floor below which they will never auto-sell. Any action above a user-defined "confirm threshold" surfaces for manual approval instead. Every autonomous action is logged with the agent's full reasoning chain.

### 3.5 Custom Agent Builder
Power users can compose their own agents from a library of tools — without writing code. They define the goal in plain language, select which tools the agent can use, set its schedule, and configure its auto-approve limits. Examples: "Find AK-47 Redline listings on CSFloat below $35 with float under 0.15 and alert me immediately" or "Every Sunday, analyze my inventory and suggest what to sell before next week's major tournament."

---

## 4. Target Users

### 4.1 Casual Trader
**Profile:** Plays CS2 regularly, has accumulated an inventory worth $100–$500, wants to make smarter decisions without spending hours researching.

**Core needs:**
- Know when something in their inventory spikes in value and should be sold
- Get alerts when a skin they want is listed cheaply
- Understand what a patch means for their items without reading forums

**How Doppler serves them:** Passive deal alerts, inventory value tracking, weekly plain-language briefings. Zero configuration required.

### 4.2 Active Investor
**Profile:** Actively buys and sells skins for profit. Tracks dozens of items. Understands float values, case cycles, and meta trends. Trades across Steam and CSFloat regularly.

**Core needs:**
- Real-time arbitrage alerts across platforms
- Patch impact analysis before the market fully reacts
- Case investment outlook — which cases to stockpile, which to avoid
- Portfolio ROI tracking with purchase price vs current value

**How Doppler serves them:** Full agent suite running continuously. Detailed patch reports with confidence scores. Case analyst agent. Advanced portfolio dashboard with P&L.

### 4.3 Power User / Trader
**Profile:** Treats CS2 skins as a serious investment vehicle. Manages a portfolio worth $5,000+. Wants algorithmic-level execution speed without writing bot code.

**Core needs:**
- Custom agent workflows tailored to their specific strategy
- Auto-execution within defined risk parameters
- Detailed agent reasoning logs (not just alerts — full transparency)
- High-frequency auction monitoring
- Discord / webhook integration into their existing trading setup

**How Doppler serves them:** Full custom agent builder, auto-approve execution, action audit trail, Discord webhooks, API access for their own integrations.

---

## 5. Core Features

### 5.1 Dashboard — Portfolio Overview
- Total inventory value across Steam and CSFloat
- 7-day, 30-day, and all-time P&L
- Best and worst performing items
- Active deal alerts and pending agent actions
- Live price ticker for watchlist items

### 5.2 Deal Feed
- Real-time stream of detected deals, newest first
- Each deal card shows: item name, float value, platform, listed price, Steam market price, discount percentage, and expiry (for auctions)
- One-click to view on CSFloat or buy directly (if auto-approve enabled)
- Filterable by discount floor, price range, item category, weapon type

### 5.3 Inventory Manager
- Full Steam inventory sync with current multi-platform valuations
- Sort and filter by value, P&L, wear condition, weapon type
- Individual item detail: price chart (30/90/180 days), float value, pattern, comparable CSFloat listings
- Mark items as "hold", "sell target", or "watching"

### 5.4 Patch Intelligence Center
- Chronological feed of all patch reports generated by Doppler
- Each report includes: patch summary, affected weapon families, predicted price direction per item, confidence score, historical comparison to similar patches
- Filter by items in your inventory or watchlist
- "Impact on me" section: how does this patch affect your specific holdings

### 5.5 Investment Hub
- Weekly AI-generated investment recommendations: cases, sticker capsules, individual skins
- Each recommendation includes: rationale, time horizon (short/medium/long), risk level, historical comparables
- Case investment tracker: buy price vs current value for cases you're holding
- "What would happen if I invested $X in Y?" scenario modeler

### 5.6 Watchlist & Alerts
- Add any CS2 item to your watchlist
- Set price target alerts (above or below a threshold)
- Set float target alerts (listing appears below a specific float)
- Alert history with delivery status (browser, mobile, Discord)
- Snooze or escalate alerts

### 5.7 Agent Studio (Power Users)
- Visual agent builder: name, goal prompt, tool selection, schedule, auto-approve config
- Template library: pre-built agents for common strategies (deal sniper, case investor, tournament sticker tracker)
- Run history: every agent run shows step-by-step tool calls, reasoning, and outcome
- Performance metrics: how many deals did this agent find? How many were profitable?

### 5.8 Action Center
- Pending actions queue: actions the agent wants to take but need approval
- Each pending action shows: item, action type, price, agent reasoning, expiry timer
- One-tap approve or reject
- Auto-approve settings: per-transaction limit, daily cap, per-item limits, always-confirm-above threshold
- Full executed action history with outcome tracking

### 5.9 Settings & Integrations
- Linked accounts: Steam, CSFloat
- Notification channels: browser push, mobile (FCM), Discord webhook, email
- Auto-approve safety configuration
- API key management (for power user API access)
- Data export: full trade history, portfolio snapshots as CSV

---

## 6. Agent Roster

| Agent | What it Does | Default Schedule |
|---|---|---|
| **Deal Hunter** | Scans CSFloat listings vs Steam prices, surfaces underpriced items | Every 5 minutes |
| **Auction Sniper** | Monitors expiring CSFloat auctions for deals with less than 30 min remaining | Every 2 minutes |
| **Patch Analyst** | Detects new Valve patches, generates price impact reports | On new patch detection |
| **Portfolio Advisor** | Reviews inventory health, suggests holds and sells | Daily |
| **Case Analyst** | Evaluates case investment outlook using supply, demand, and patch context | Weekly |
| **Tournament Tracker** | Monitors upcoming CS2 majors, identifies sticker capsules likely to appreciate | Event-driven |
| **Custom Agents** | User-defined goal, tools, schedule, and limits | User-configured |

---

## 7. Monetization

### 7.1 Tier Structure

| Tier | Price | Limits |
|---|---|---|
| **Free** | $0/month | Deal alerts (1hr delay), portfolio tracking, basic price charts, 1 watchlist item |
| **Trader** | $9/month | Real-time alerts, full watchlist (25 items), patch reports, all core agents |
| **Investor** | $24/month | Everything in Trader + Investment Hub, Case Analyst, custom agents (3), action center |
| **Pro** | $59/month | Everything + unlimited custom agents, auto-execution, API access, Discord webhooks, priority agent runs |

### 7.2 Revenue Philosophy
The free tier is genuinely useful — it builds trust and grows the user base organically through the CS2 trading community. The upgrade incentive is real-time speed and automation, not artificial feature paywalls.

---

## 8. Competitive Landscape

| Product | Price Tracking | AI Analysis | Deal Alerts | Patch Intel | Auto-Execute | Custom Agents |
|---|---|---|---|---|---|---|
| SteamLedger | ✅ | ❌ | ✅ (basic) | ❌ | ❌ | ❌ |
| Pricempire | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| CSProfit.gg | ✅ | ✅ (chat) | ❌ | ❌ | ❌ | ❌ |
| SteamAnalyst | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Doppler** | ✅ | ✅ | ✅ (real-time) | ✅ | ✅ | ✅ |

Doppler's moat is the combination of real-time agentic execution, patch intelligence, and the custom agent builder. No existing product offers more than two of these five capabilities.

---

## 9. Design Principles

**Agent-first, not dashboard-first.** The product is built around things happening for the user, not things the user has to go check.

**Transparency over magic.** Every agent recommendation and autonomous action shows its reasoning. Users should always be able to answer "why did Doppler do that?"

**Speed is a feature.** A deal alert that arrives 20 minutes late is useless. The entire infrastructure is designed around minimizing latency from listing appearance to user notification.

**Conservative by default.** Auto-execution is opt-in, limits are set conservatively out of the box, and the system prefers surfacing a deal for manual action over executing autonomously when confidence is borderline.

**CS2-native language.** The product speaks the language of the community — float values, patterns, wear conditions, case cycles, majors. It never condescends or over-explains concepts that experienced traders already know.

---

## 10. Future Roadmap

**Near-term (post-launch)**
- Buff163 and Skinport integration (expand arbitrage surface)
- Trade-up contract analyzer agent
- Community deal sharing — upvote/downvote surfaced deals
- Mobile app (iOS + Android via Expo)

**Medium-term**
- Multi-game expansion: Dota 2 items, TF2 unusuals (same Steam infrastructure)
- Social layer: follow other traders, see anonymized portfolio performance leaderboards
- Backtesting: "would this agent strategy have been profitable over the last 6 months?"

**Long-term**
- Doppler API: let developers build on top of the agent and pricing infrastructure
- Institutional tier: multi-account management for serious trading operations
- On-chain asset bridge: tokenize skin positions for DeFi-style portfolio strategies
