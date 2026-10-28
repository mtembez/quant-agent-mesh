import numpy as np
import pytest
from agents.alpha_agent import AlphaHypothesisAgent
from agents.backtest_agent import VectorizedBacktestAgent
from agents.regime_agent import RegimeDetectionAgent
from core.models import MarketRegime, OrderSide, OrderStatus, OrderType
from core.swarm import QuantSwarmCoordinator
from execution.engine import PaperExecutionEngine
from risk.governor import RiskGovernorAgent


def test_regime_detection_agent():
    agent = RegimeDetectionAgent(high_vol_threshold=0.30)

    # Bull trend: monotonic upward prices
    bull_prices = np.linspace(100.0, 160.0, 100)
    assert agent.detect_regime(bull_prices) == MarketRegime.BULL_TREND

    # Bear trend: monotonic downward prices
    bear_prices = np.linspace(160.0, 90.0, 100)
    assert agent.detect_regime(bear_prices) == MarketRegime.BEAR_TREND

    # High volatility regime
    np.random.seed(42)
    volatile_returns = np.random.normal(0, 0.05, 100)  # ~80% annualized volatility
    volatile_prices = 100.0 * np.exp(np.cumsum(volatile_returns))
    assert agent.detect_regime(volatile_prices) == MarketRegime.HIGH_VOLATILITY


def test_alpha_hypothesis_agent_signals():
    alpha = AlphaHypothesisAgent()
    np.random.seed(42)
    prices = 100.0 + np.cumsum(np.random.normal(0, 1.0, 150))

    b_signals = alpha.generate_bollinger_signals(prices, window=20, num_std=1.5)
    assert len(b_signals) == len(prices)
    assert set(np.unique(b_signals)).issubset({-1, 0, 1})

    ema_signals = alpha.generate_ema_cross_signals(prices, fast_window=10, slow_window=30)
    assert len(ema_signals) == len(prices)

    rsi_signals = alpha.generate_rsi_signals(prices, period=14)
    assert len(rsi_signals) == len(prices)


def test_vectorized_backtest_agent():
    backtester = VectorizedBacktestAgent(initial_capital=100000.0, transaction_cost_bps=5.0)
    prices = np.array([100.0, 105.0, 110.0, 108.0, 115.0, 120.0])
    # Buy at bar 0 and hold
    signals = np.array([1, 1, 1, 1, 1, 1], dtype=np.int8)

    res = backtester.run_backtest("Test BuyHold", "BTC/USD", prices, signals)
    assert res.total_return_pct > 0.0
    assert len(res.equity_curve) == len(prices)
    assert res.total_trades >= 1


def test_risk_governor_agent():
    governor = RiskGovernorAgent(max_drawdown_limit_pct=25.0)
    prices = np.linspace(100.0, 120.0, 100)

    risk = governor.evaluate_portfolio_risk(100000.0, prices, n_mc_simulations=100, forecast_days=10)
    assert risk.portfolio_value == 100000.0
    assert risk.parametric_var_95 >= 0.0
    assert "p5_terminal_value" in risk.details


def test_paper_execution_engine():
    engine = PaperExecutionEngine(initial_capital=100000.0, slippage_bps=5.0)

    # Market Buy order
    order_buy = engine.submit_order(symbol="ETH/USD", side=OrderSide.BUY, quantity=10.0, market_price=2000.0)
    assert order_buy.status == OrderStatus.FILLED
    assert order_buy.filled_price > 2000.0  # Buy slippage applied
    assert "ETH/USD" in engine.portfolio.positions
    assert engine.portfolio.cash < 100000.0

    # Limit Sell order - price not reached
    order_limit = engine.submit_order(
        symbol="ETH/USD",
        side=OrderSide.SELL,
        quantity=5.0,
        order_type=OrderType.LIMIT,
        limit_price=2500.0,
        market_price=2100.0,
    )
    assert order_limit.status == OrderStatus.PENDING

    # Market Sell order
    order_sell = engine.submit_order(symbol="ETH/USD", side=OrderSide.SELL, quantity=10.0, market_price=2200.0)
    assert order_sell.status == OrderStatus.FILLED
    assert "ETH/USD" not in engine.portfolio.positions

    # Insufficient cash rejection
    order_too_big = engine.submit_order(symbol="ETH/USD", side=OrderSide.BUY, quantity=10000.0, market_price=2000.0)
    assert order_too_big.status == OrderStatus.REJECTED

    # Selling asset not owned rejection
    order_sell_unowned = engine.submit_order(symbol="DOGE/USD", side=OrderSide.SELL, quantity=10.0, market_price=1.0)
    assert order_sell_unowned.status == OrderStatus.REJECTED


def test_quant_swarm_coordinator_cycle():
    coord = QuantSwarmCoordinator(initial_capital=100000.0)
    report = coord.run_full_research_cycle(symbol="SOL/USD", n_bars=120)

    assert report["symbol"] == "SOL/USD"
    assert report["strategies_evaluated"] == 3
    assert "strategy_name" in report["top_strategy"]
    assert report["computation_time_ms"] > 0.0
    assert "parametric_var_95" in report["risk_metrics"]
