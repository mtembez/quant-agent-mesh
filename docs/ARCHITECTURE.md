# System Architecture & Technical Design Document (TDD)

## 1. System Topology & Component Diagram

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

## 2. Core Mathematical Formulations

### 2.1 Sharpe Ratio (Annualized)
Calculated from periodic portfolio log returns $R_t$ with risk-free rate $R_f$:
$$\text{Sharpe} = \frac{\mathbb{E}[R_t - R_f]}{\sigma(R_t)} \times \sqrt{252}$$

### 2.2 Sortino Ratio (Downside Deviation)
Penalizes only harmful downside volatility below the target minimum acceptable return $\tau$:
$$\text{Sortino} = \frac{\mathbb{E}[R_t - R_f]}{\sqrt{\frac{1}{N}\sum_{t=1}^N \min(0, R_t - \tau)^2}} \times \sqrt{252}$$

### 2.3 Maximum Drawdown (MDD)
The peak-to-trough decline of the portfolio equity curve $P_t$:
$$\text{MDD} = \max_{t \in [0, T]} \left( \frac{\max_{s \in [0, t]} P_s - P_t}{\max_{s \in [0, t]} P_s} \right)$$

### 2.4 Parametric Value-at-Risk (VaR)
For portfolio value $V$ with return standard deviation $\sigma$ over horizon $t$ at confidence $\alpha$ (e.g. $95\%$ where $Z_{\alpha} = 1.645$):
$$\text{VaR}_{\alpha} = V \times Z_{\alpha} \times \sigma \sqrt{t}$$

### 2.5 Monte Carlo Asset Trajectories (Geometric Brownian Motion)
Simulates $M$ sample asset price paths under stochastic drift $\mu$ and volatility $\sigma$:
$$S_{t+\Delta t} = S_t \exp\left( \left(\mu - \frac{1}{2}\sigma^2\right)\Delta t + \sigma \sqrt{\Delta t} \, Z \right), \quad Z \sim \mathcal{N}(0, 1)$$

---

## 3. Autonomous Swarm Agent Roles

| Agent Class | Module Path | Core Responsibilities |
| :--- | :--- | :--- |
| `RegimeDetectionAgent` | `agents/regime_agent.py` | Calculates annualized volatility, detects trend vs sideways regimes |
| `AlphaHypothesisAgent` | `agents/alpha_agent.py` | Formulates candidate strategies, optimizes entry/exit parameters |
| `VectorizedBacktestAgent`| `agents/backtest_agent.py`| Executes zero-loop vectorized matrix backtesting and performance metrics |
| `RiskGovernorAgent` | `agents/risk_agent.py` | Computes VaR/CVaR, runs Monte Carlo stress tests, halts rogue strategies |
| `PaperExecutionAgent` | `agents/execution_agent.py`| Simulates limit/market orders, slippage, trade fills, and cash balances |

---

## 4. REST & WebSocket API Specification

* `GET /health/live`: Liveness probe.
* `GET /health/ready`: Readiness probe.
* `GET /metrics`: Prometheus exposition metrics.
* `GET /api/v1/strategies`: List all discovered alpha strategies and performance metrics.
* `POST /api/v1/backtest`: Execute on-demand vectorized backtest with user parameters.
* `POST /api/v1/risk/stress-test`: Run Monte Carlo portfolio simulation.
* `POST /api/v1/orders`: Submit paper execution order.
* `GET /api/v1/portfolio`: Retrieve live cash balance, equity, and open positions.
* `WS /ws/market-feed`: Streaming real-time tick prices, order fills, and agent thoughts.
