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
