# Agile Methodology & Sprint Roadmap: Quant Agent Mesh

## 1. Agile Framework Guidelines
This project follows strict Agile Scrum mechanics with 2-week Sprint increments.
* **Sprint Planning**: Every user story must satisfy pre-defined Acceptance Criteria before coding begins.
* **Continuous Integration**: Every atomic commit must pass static syntax verification (`python -m py_compile`).
* **Definition of Done (DoD)**:
  - Unit & integration tests written and passing (`pytest`).
  - Total statement coverage $\ge 85\%$.
  - POSIX compliance and zero runtime warnings.
  - Full-stack frontend build passes cleanly with Vite.
  - Remote CI/CD on GitHub Actions runs green.

---

## 2. Sprint Roadmap & Work Breakdown Structure (WBS)

### Sprint 1: Core Mathematical Engines & Entity Models
- **US-1.1**: Define strict Pydantic v2 domain schemas (`core/models.py`: `Candle`, `Order`, `Position`, `BacktestResult`, `RiskMetrics`).
- **US-1.2**: Implement vectorized financial math library (`core/math.py`: Sharpe, Sortino, Max Drawdown, Calmar).
- **US-1.3**: Implement synthetic market timeseries generator (`core/data_feed.py`: Geometric Brownian Motion with regime shifts).
- **Deliverables**: Verified data models and math engine with 100% test coverage.

### Sprint 2: Autonomous Agent Swarm & Vectorized Backtester
- **US-2.1**: Implement `RegimeDetectionAgent` with rolling volatility and trend detection.
- **US-2.2**: Implement `AlphaHypothesisAgent` generating trend cross, mean-reversion, and RSI momentum strategies.
- **US-2.3**: Implement `VectorizedBacktestAgent` executing matrix backtests on vectorized price arrays.
- **Deliverables**: Autonomous multi-agent pipeline generating validated alpha hypotheses.

### Sprint 3: Monte Carlo Risk Governor & Paper Execution Hub
- **US-3.1**: Implement `RiskGovernorAgent` computing Parametric VaR, Historical VaR, and 1,000-path Monte Carlo stress tests.
- **US-3.2**: Implement `PaperExecutionAgent` simulating order matching, bid-ask spreads, and proportional slippage.
- **Deliverables**: Risk-controlled execution engine with dynamic drawdown limits.

### Sprint 4: Async Starlette ASGI API & Real-Time WebSockets
- **US-4.1**: Build Starlette ASGI application with REST endpoints (`/api/v1/backtest`, `/api/v1/strategies`, `/api/v1/orders`).
- **US-4.2**: Implement WebSocket streaming endpoint (`/ws/market-feed`) for real-time tick and order updates.
- **US-4.3**: Expose standard Prometheus exposition endpoint (`/metrics`).
- **Deliverables**: High-throughput async API with real-time WebSocket broadcasting.

### Sprint 5: Full-Stack React 18 / Vite Interactive Dashboard
- **US-5.1**: Build React 18 / Vite frontend with live PnL cards, strategy leaderboard, and Monte Carlo risk distribution.
- **US-5.2**: Build interactive backtesting console with parameter tuning sliders.
- **Deliverables**: Production-built single-page application in `frontend/dist/`.

### Sprint 6: Deterministic Verification, CI/CD Pipeline & GitHub Release
- **US-6.1**: Expand pytest test suite to cover all edge cases with $\ge 85\%$ coverage.
- **US-6.2**: Configure GitHub Actions workflow with modern Node 24 runtime and Python 3.13.
- **US-6.3**: Tag `v1.0.0` and publish official GitHub Release.

### Sprint 7: Statistical Arbitrage, Dynamic Kalman Filter & Ornstein-Uhlenbeck Pairs Engine
- **US-7.1**: Implement `DynamicKalmanFilter` in `analytics/pairs.py` to recursively estimate time-varying hedge ratio $\beta_t$ between pairs.
- **US-7.2**: Implement `OrnsteinUhlenbeckEstimator` in `analytics/pairs.py` calculating mean-reversion speed $\theta$, long-term equilibrium $\mu$, volatility $\sigma$, and exact half-life $t_{1/2}$.
- **US-7.3**: Expose `/api/v1/pairs/analyze` in Starlette ASGI backend and add `pairs` command in CLI.
- **US-7.4**: Build Statistical Arbitrage & Pairs Trading console tab in React 18 dashboard.
- **US-7.5**: Achieve 97% unit/integration test coverage with 23 passing tests and release `v1.1.0`.

### Sprint 8: Multi-Asset Engine, Cross-Market Arbitrage & Cholesky Monte Carlo Risk Governor
- **Sprint Goal**: Ingest and synchronize multi-asset streams (Crypto, Gold, Yen), enforce asset-aware pip execution with sub-pip pricing, calibrate log-price cross-asset arbitrage, and govern joint portfolio tail-risk using Cholesky-correlated Monte Carlo simulations.
- **US-8.1 (3 SP)**: Multi-Asset Timeseries Generator & Calendar Alignment (`core/data_feed.py`). Ingest and simulate Crypto (`BTC/USD`, `ETH/USD`), Commodities (`XAU/USD`), and Macro FX (`JPY/USD`) with weekend gap forward-filling and synchronized timestamps.
- **US-8.2 (3 SP)**: Asset-Aware Execution Engine & Pip Precision (`execution/engine.py`). Enforce dynamic pip decimals ($0.01$ for XAU, $0.000001$ for JPY), contract multipliers, slippage modeling, and marked-to-market portfolio revaluation.
- **US-8.3 (2 SP)**: Cross-Asset Pairs Arbitrage (`analytics/pairs.py`, `core/swarm.py`). Formulate log-price space Kalman filtering ($s_t = \ln P_A - \beta \ln P_B$) to eliminate scale distortion for Physical Gold in Yen and Digital vs Physical Gold arbitrage.
- **US-8.4 (2 SP)**: Multi-Asset Covariance Matrix & Parametric VaR (`core/math.py`, `risk/governor.py`). Vectorized calculation of joint $4 \times 4$ covariance matrix $\Sigma$, portfolio variance $w^T \Sigma w$, and 95%/99% Parametric Value-at-Risk.
- **US-8.5 (3 SP)**: Multivariate Correlated Monte Carlo Simulation via Cholesky Decomposition (`risk/governor.py`). Generate $L L^T = \Sigma$ with diagonal ridge regularization ($\tilde{\Sigma} = \Sigma + 10^{-8} I$), project 1,000 correlated portfolio paths over 30 days, calculate empirical VaR/drawdown, and enforce automated circuit breaker ceilings.
- **Ceremony 3 Verification**: Implemented interactive demo script (`scripts/demo_sprint8.py`) and dedicated unit verification suite (`tests/test_sprint8_demo.py`).
- **Velocity Delivered**: 13 / 13 Story Points (100% velocity).
- **Definition of Done (DoD) Verification**:
  - [x] 52 unit & integration tests passing (`pytest tests/`) in 2.17s.
  - [x] 100% statement coverage across all core production modules (`agents/`, `analytics/`, `api/`, `core/`, `execution/`, `risk/`).
  - [x] Static syntax bytecode check passes with Exit Code 0 (`py_compile`).
  - [x] Frontend production build passes with Exit Code 0 (`vite build`).
  - [x] Ceremony 3 interactive demo and subprocess verification pass with Exit Code 0.

---

## 3. Ceremony 4: Sprint 8 Retrospective

### What Went Well
1. **Log-Price Space Stabilization**: Moving cross-asset pairs estimation from raw price space ($s = P_A - \beta P_B$) to log-price space ($s = \ln P_A - \beta \ln P_B$) compressed the scale disparity between Gold ($2,312) and Yen ($0.00613), stabilizing hedge ratio elasticity $\beta$ around $-1.52$ and preventing floating-point overflow.
2. **Sub-Pip Execution Accuracy**: Introducing `pip_decimal=6` for FX assets resolved the 2-decimal truncation artifact, eliminating artificial cash overcharges on institutional JPY notional sizes.
3. **Cholesky Correlation Preservation via Ridge Regularization**: Applying diagonal jitter ($\Sigma + 10^{-8} I$) guaranteed that sample covariance matrices from empirical market feeds remained strictly positive definite, eliminating LAPACK `LinAlgError` exceptions while preserving target asset correlations within 0.25% tolerance.
4. **Zero-Loop Tensor Broadcasting**: Correlating 1,000 Monte Carlo paths across 4 assets over 30 forward trading days via matrix multiplication ($Z L^T$) achieved sub-15ms computation time with zero Python loops.

### What Could Be Improved
1. **Test Fixture Capital Sizing**: Initial execution engine test cases encountered order rejections because default test capital ($100,000) was saturated by multi-asset basket buys ($192,000 notional). Test fixtures should dynamically scale initial equity relative to the aggregate notional value of test orders.
2. **Asynchronous Calendar Feeds**: While forward-filling effectively synchronizes weekend gaps for traditional assets against 24/7 crypto, adding explicit market holiday schedules (e.g. CME and Tokyo holidays) will further improve macroeconomic fidelity.

### Action Items for Sprint 9
1. **Live CCXT Exchange Connector**: Add asynchronous streaming adapters for live Binance / Bybit and OANDA / Interactive Brokers feeds.
2. **Markowitz Efficient Frontier & Black-Litterman Allocation**: Implement quadratic programming optimizer for multi-asset risk-adjusted weight rebalancing based on alpha hypothesis confidence scores.
3. **Execution Market Impact**: Model square-root law market impact for large institutional orders in low-liquidity regimes.

---

### Sprint 9: Autonomous Spot Gold Quantitative Terminal, Drift-Invariant Volatility & Real-Time ML Engine
- **Sprint Goal**: Institutionalize the dedicated Spot Gold (`XAU/USD`) terminal into the production quant pipeline: integrate drift-invariant volatility estimators (Rogers-Satchell, Yang-Zhang), continuous online auto-learning for forward price trajectories, dynamic position-sizing execution for spot gold contracts, and interactive TradingView-grade overlay synchronization.
- **US-9.1 (3 SP)**: Drift-Invariant & Jump-Adjusted Volatility Suite (`analytics/gold_analyzer.py`). Implement Rogers-Satchell ($\sigma_{RS}^2$) and Yang-Zhang ($\sigma_{YZ}^2$) estimators to eliminate trend bias during directional gold rallies and handle overnight opening gaps.
- **US-9.2 (3 SP)**: Live Spot Gold Streaming Feed Adapter (`core/data_feed.py`, `api/main.py`). Establish async poll/stream client connecting to real-time OANDA / TradingView benchmark feeds with automatic fallback to synthetic jump-diffusion.
- **US-9.3 (3 SP)**: Online Machine Learning Auto-Learner for Spot Gold Direction (`analytics/auto_learner.py`). Integrate Recursive Least Squares (RLS) and Online Gradient Descent (OGD) to update feature weights in real time upon bar completion, predicting $+1\text{h}$ and $+24\text{h}$ expected price delta.
- **US-9.4 (2 SP)**: Spot Gold Automated Trade Execution & Dynamic Sizing (`execution/engine.py`, `risk/governor.py`). Calculate position sizing using the Fractional Kelly Criterion modulated by Parkinson/ATR tail bands; enforce dynamic trailing stop-loss on XAU contracts.
- **US-9.5 (2 SP)**: Interactive TradingView-Grade UI Enhancements (`frontend/src/App.jsx`). Multi-timeframe bar synchronization (`1h`, `4h`, `1D`), real-time strategy overlay parameter adjustment sliders (EMA spans, Bollinger standard deviations, RSI periods), and single-click CSV backtest export.
- **Velocity Target**: 13 Story Points.
- **Definition of Done (DoD)**:
  - Unit & integration tests for all 5 stories passing with 0 errors.
  - Test coverage $\ge 90\%$ on new modules.
  - Deterministic Vite frontend compilation (`npm run build`) with zero warnings.
  - Exit Code 0 on all static analyzers.

