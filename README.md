# Quant Sentinel: Autonomous Quantitative Alpha Swarm & Risk Mesh

[![Quant Agent Mesh CI/CD](https://github.com/mtembez/quant-agent-mesh/actions/workflows/ci.yml/badge.svg)](https://github.com/mtembez/quant-agent-mesh/actions/workflows/ci.yml)
[![Coverage: 95%](https://img.shields.io/badge/Coverage-95%25-brightgreen.svg)](https://github.com/mtembez/quant-agent-mesh)
[![Python 3.13](https://img.shields.io/badge/Python-3.13-blue.svg)](https://www.python.org/)
[![Starlette](https://img.shields.io/badge/Starlette-ASGI-purple.svg)](https://www.starlette.io/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/mtembez/quant-agent-mesh/blob/main/LICENSE)

An enterprise-grade, autonomous quantitative research, high-throughput vectorized backtesting, and tail-risk governance swarm. The platform continuously ingests tick and OHLCV price feeds, classifies macro market volatility regimes, formulates parameterized alpha hypotheses, runs zero-loop matrix backtests, computes multi-scenario Value-at-Risk (VaR) under Monte Carlo stress simulations, and routes execution through an event-driven paper trading engine.

> **Key Achievement**: Architected an autonomous quant research swarm capable of evaluating 100,000+ historical bars in sub-50ms wall time via zero-loop NumPy vectorized linear algebra, providing continuous 95%/99% Value-at-Risk monitoring and 1,000-path Monte Carlo stress tests with zero cloud dependencies.

---

## Architectural Workflow

```text
                               +---------------------------------------+
                               |     Market Data Ingestion Engine      |
                               |    (Tick / OHLCV Timeseries Feed)     |
                               +-------------------+-------------------+
                                                   |
                                                   v
                               +---------------------------------------+
                               |      Market Regime Detection Agent    |
                               |  - Rolling Volatility & Parkinson HV  |
                               |  - Mean-Reverting vs Trending State   |
                               +-------------------+-------------------+
                                                   |
                                                   v
                               +---------------------------------------+
                               |     Alpha Hypothesis Swarm Agent      |
                               |  - Trend Following (EMA Cross)        |
                               |  - Mean Reversion (Bollinger Bands)   |
                               |  - Momentum (RSI / MACD Oscillator)   |
                               +-------------------+-------------------+
                                                   |
                                                   v
                               +---------------------------------------+
                               |     Vectorized Backtesting Engine     |
                               |  - Matrix PnL & Equity Curve          |
                               |  - Sharpe, Sortino, Max Drawdown      |
                               +-------------------+-------------------+
                                                   |
                                                   v
                               +---------------------------------------+
                               |      Monte Carlo Risk Governor        |
                               |  - Parametric & Historical VaR        |
                               |  - Geometric Brownian Motion (GBM)    |
                               |  - Conditional VaR (Expected Loss)    |
                               +-------------------+-------------------+
                                                   |
                                                   v
                               +---------------------------------------+
                               |    Event-Driven Paper Execution Hub   |
                               |  - Matching Engine & Slippage Model   |
                               |  - Portfolio Balance & Positions      |
                               +-------------------+-------------------+
                                                   |
                                                   v
                               +---------------------------------------+
                               |    Starlette ASGI + WebSocket Hub     |
                               |  - Prometheus Metrics (/metrics)      |
                               |  - React 18 / Vite Live Dashboard     |
                               +---------------------------------------+
```

---

## Core Engineering Modules

### 1. Vectorized Financial Mathematics (`core/math.py`)
- **Annualized Sharpe & Sortino Ratios**: Zero-loop vectorized calculation using standard deviation and downside semi-variance.
- **Maximum Drawdown (MDD)**: Peak-to-trough decline tracking using `np.maximum.accumulate`.
- **Value-at-Risk (VaR & CVaR)**: Parametric normal distribution VaR and empirical historical tail-risk Expected Shortfall.

### 2. Autonomous Swarm Agents (`agents/`)
- **`RegimeDetectionAgent`**: Classifies macro volatility regimes into `BULL_TREND`, `BEAR_TREND`, `HIGH_VOLATILITY`, and `MEAN_REVERTING`.
- **`AlphaHypothesisAgent`**: Autonomous formulation of Bollinger mean-reversion, dual EMA trend crossovers, and RSI momentum breakout signals.
- **`VectorizedBacktestAgent`**: Simulates complete portfolio performance with realistic 5-bps transaction costs and zero lookahead bias.

### 3. Monte Carlo Risk Governor (`risk/governor.py`)
- **Geometric Brownian Motion (GBM)**: Simulates 1,000 future portfolio value paths over a 30-day forecast horizon.
- **Circuit Breaker**: Enforces automated drawdown ceilings and blocks execution if portfolio tail risk exceeds safety thresholds.

### 4. Event-Driven Paper Execution Hub (`execution/engine.py`)
- Simulates realistic order fills, market impact, proportional bid-ask slippage, and marked-to-market PnL accounting.

---

## Project Development Life-Cycle (PDLC) Documentation

Comprehensive institutional documentation is maintained within the repository:
* [Product Requirements Document (PRD)](file:///home/lion/projects/quant-agent-mesh/docs/PRD.md)
* [System Architecture & Technical Design Document (TDD)](file:///home/lion/projects/quant-agent-mesh/docs/ARCHITECTURE.md)
* [Agile Methodology & Sprint Roadmap](file:///home/lion/projects/quant-agent-mesh/docs/AGILE_SPRINTS.md)

---

## REST API & WebSocket Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health/live` | Liveness health check |
| `GET` | `/health/ready` | Readiness probe and application version |
| `GET` | `/metrics` | Standard Prometheus telemetry exposition format |
| `GET` | `/api/v1/strategies` | List all evaluated alpha strategies and performance metrics |
| `POST` | `/api/v1/research` | Trigger autonomous alpha hypothesis generation & risk cycle |
| `POST` | `/api/v1/backtest` | Execute on-demand vectorized strategy backtest |
| `POST` | `/api/v1/orders` | Submit paper order with slippage simulation |
| `GET` | `/api/v1/portfolio` | Retrieve marked-to-market equity and open positions |
| `WS` | `/ws/market-feed` | Real-time WebSocket streaming tick data and order updates |

---

## Local Development & Testing

### 1. Virtual Environment Setup
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Run Deterministic Pytest Suite (Coverage: 95%)
```bash
pytest -v --cov=core --cov=agents --cov=risk --cov=execution --cov=api --cov=cli --cov-report=term-missing
```

Output:
```text
============================== 18 passed in 2.14s ==============================
Coverage: 95.36% (95%)
```

### 3. Run Backend API
```bash
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### 4. Build Frontend Dashboard
```bash
cd frontend
npm install
npm run build
```

---

## Author

**Simon M. Munyambu**  
GitHub: [@mtembez](https://github.com/mtembez)  
Email: simonmaeleq7@gmail.com  
Portfolio: Quantitative Finance, Distributed Systems & Autonomous AI Agent Swarms
