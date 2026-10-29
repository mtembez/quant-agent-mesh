"""Comprehensive edge-case and boundary condition unit tests.

Addresses unexecuted lines in core/math.py, agents/, execution/engine.py,
api/main.py, core/data_feed.py, and risk/governor.py.
"""

import pytest
import numpy as np
from starlette.testclient import TestClient

from api.main import app, coordinator
from core.math import (
    compute_annualized_sharpe,
    compute_sortino_ratio,
    compute_max_drawdown,
    compute_parametric_var,
    compute_historical_var,
    compute_conditional_var,
    compute_calmar_ratio,
    compute_log_returns,
)
from agents.alpha_agent import AlphaHypothesisAgent
from agents.regime_agent import RegimeDetectionAgent
from agents.backtest_agent import VectorizedBacktestAgent
from core.models import MarketRegime, OrderSide, OrderStatus, OrderType
from execution.engine import PaperExecutionEngine
from core.data_feed import (
    generate_synthetic_gbm,
    generate_multi_asset_feed,
    extract_multi_asset_price_matrix,
)
from risk.governor import RiskGovernorAgent


def test_math_degenerate_inputs_and_fallbacks():
    """Verify core/math.py handles empty arrays, zero variance, and non-positive portfolio values."""
    empty = np.array([], dtype=np.float64)
    single = np.array([100.0], dtype=np.float64)
    flat = np.array([100.0, 100.0, 100.0, 100.0], dtype=np.float64)
    flat_returns = compute_log_returns(flat)

    # 1. Sharpe Ratio
    assert compute_annualized_sharpe(empty) == 0.0
    assert compute_annualized_sharpe(single) == 0.0
    assert compute_annualized_sharpe(flat_returns) == 0.0

    # 2. Sortino Ratio
    assert compute_sortino_ratio(empty) == 0.0
    assert compute_sortino_ratio(single) == 0.0
    assert compute_sortino_ratio(flat_returns) == 0.0

    # 3. Max Drawdown
    assert compute_max_drawdown(empty) == (0.0, 0, 0)
    assert compute_max_drawdown(single) == (0.0, 0, 0)
    # Monotonically increasing (no drawdown)
    increasing = np.array([100.0, 105.0, 110.0, 120.0])
    assert compute_max_drawdown(increasing)[0] == 0.0

    # 4. Calmar Ratio
    assert compute_calmar_ratio(cagr_pct=15.0, max_drawdown_pct=0.0) == 15.0
    assert compute_calmar_ratio(cagr_pct=-5.0, max_drawdown_pct=0.0) == 0.0

    # 5. Value-at-Risk & Expected Shortfall with zero/negative portfolio values or empty returns
    for func in [compute_parametric_var, compute_historical_var, compute_conditional_var]:
        assert func(portfolio_value=0.0, returns=flat_returns) == 0.0
        assert func(portfolio_value=-1000.0, returns=flat_returns) == 0.0
        assert func(portfolio_value=100000.0, returns=empty) == 0.0
        assert func(portfolio_value=100000.0, returns=single) == 0.0

    # Conditional VaR with strictly positive returns (no tail losses below cutoff)
    strictly_positive = np.array([0.05, 0.08, 0.12, 0.15])
    assert compute_conditional_var(portfolio_value=100000.0, returns=strictly_positive) == 0.0
    # Conditional VaR with NaN returns (triggers line 102 empty tail losses)
    assert compute_conditional_var(portfolio_value=100000.0, returns=np.array([np.nan, np.nan])) == 0.0


def test_alpha_agent_short_windows_and_monotonic_growth():
    """Verify agents/alpha_agent.py short timeseries fallbacks and zero-loss RSI handling."""
    agent = AlphaHypothesisAgent()
    short_prices = np.array([100.0, 101.0, 102.0], dtype=np.float64)

    # 1. Bollinger Bands fallback (window=20)
    boll_signals = agent.generate_bollinger_signals(short_prices, window=20)
    assert len(boll_signals) == len(short_prices)
    assert (boll_signals == 0).all()

    # 2. EMA Cross fallback (slow_window=26)
    ema_signals = agent.generate_ema_cross_signals(short_prices, fast_window=5, slow_window=26)
    assert len(ema_signals) == len(short_prices)
    assert (ema_signals == 0).all()

    # 3. RSI fallback (period=14)
    rsi_signals = agent.generate_rsi_signals(short_prices, period=14)
    assert len(rsi_signals) == len(short_prices)
    assert (rsi_signals == 0).all()

    # 4. Strictly increasing prices: avg_loss == 0.0 -> RSI = 100.0 (line 82)
    increasing_prices = np.linspace(100.0, 200.0, 30)
    rsi_signals_inc = agent.generate_rsi_signals(increasing_prices, period=5)
    # When RSI is 100.0 (> 70.0 overbought), signals should flag -1 (short/exit)
    assert -1 in rsi_signals_inc


def test_regime_and_backtest_agent_edge_cases():
    """Verify regime and backtest agents handle insufficient history or dimension mismatches."""
    regime_agent = RegimeDetectionAgent()

    # 1. Regime with < 30 bars
    assert regime_agent.detect_regime(np.array([100.0, 101.0])) == MarketRegime.MEAN_REVERTING
    # 2. Regime with flat zero returns
    assert regime_agent.detect_regime(np.array([100.0] * 35)) == MarketRegime.MEAN_REVERTING
    # 3. Regime with non-positive zero prices (empty returns, triggers line 21)
    assert regime_agent.detect_regime(np.zeros(35)) == MarketRegime.MEAN_REVERTING

    # 3. Backtest Agent with mismatched signals or < 2 bars
    bt_agent = VectorizedBacktestAgent()
    res_short = bt_agent.run_backtest("Test", "BTC/USD", np.array([100.0]), np.array([1]))
    assert res_short.total_trades == 0
    assert res_short.total_return_pct == 0.0

    res_mismatch = bt_agent.run_backtest(
        "Test", "BTC/USD", np.array([100.0, 101.0, 102.0]), np.array([1, -1])
    )
    assert res_mismatch.total_trades == 0


def test_execution_engine_limit_orders_and_position_scaling():
    """Verify execution/engine.py limit order queues and position averaging-in (lines 60, 79-84)."""
    engine = PaperExecutionEngine(initial_capital=250000.0, slippage_bps=0.0)

    # 1. Limit BUY where market price > limit price (remains PENDING)
    ord_pending_buy = engine.submit_order(
        symbol="BTC/USD",
        side=OrderSide.BUY,
        quantity=0.1,
        order_type=OrderType.LIMIT,
        limit_price=50000.0,
        market_price=60000.0,
    )
    assert ord_pending_buy.status == OrderStatus.PENDING

    # 2. Limit SELL where market price < limit price (remains PENDING)
    # First buy 1 BTC at market
    engine.submit_order(symbol="BTC/USD", side=OrderSide.BUY, quantity=1.0, market_price=60000.0)
    ord_pending_sell = engine.submit_order(
        symbol="BTC/USD",
        side=OrderSide.SELL,
        quantity=0.5,
        order_type=OrderType.LIMIT,
        limit_price=70000.0,
        market_price=60000.0,
    )
    assert ord_pending_sell.status == OrderStatus.PENDING

    # 3. Position scaling (averaging-in): buy another 2 BTC at $66,000 (lines 79-84)
    # Existing: 1 BTC @ $60,000. New: 2 BTC @ $66,000.
    # Total Qty = 3 BTC. New Avg Entry = (60,000 + 132,000) / 3 = $64,000.
    ord_scale = engine.submit_order(
        symbol="BTC/USD",
        side=OrderSide.BUY,
        quantity=2.0,
        order_type=OrderType.MARKET,
        market_price=66000.0,
    )
    assert ord_scale.status == OrderStatus.FILLED
    pos = engine.portfolio.positions["BTC/USD"]
    assert pos.quantity == 3.0
    assert abs(pos.entry_price - 64000.0) < 1e-2


def test_data_feed_regime_shifts_and_empty_matrix():
    """Verify core/data_feed.py regime shift injection and empty matrix extraction."""
    # 1. Regime shift injection at bar 50 (lines 73-74)
    candles = generate_synthetic_gbm(n_bars=100, regime_shift_at=50)
    assert len(candles) == 100

    # 2. Multi-asset feed default parameter (symbols=None, line 137)
    multi_feed = generate_multi_asset_feed(symbols=None, n_bars=50)
    assert len(multi_feed) == 4

    # 3. Extract matrix from empty dictionary (line 197)
    syms, ts, matrix = extract_multi_asset_price_matrix({})
    assert syms == []
    assert len(ts) == 0
    assert matrix.shape == (0, 0)


def test_risk_governor_insufficient_history():
    """Verify risk/governor.py fallback on short history or non-positive value (line 34)."""
    gov = RiskGovernorAgent()
    # 1. Less than 5 bars
    risk_short = gov.evaluate_portfolio_risk(
        portfolio_value=100000.0, price_history=np.array([100.0, 101.0, 102.0])
    )
    assert risk_short.parametric_var_95 == 0.0
    assert risk_short.is_risk_breached is False

    # 2. Non-positive portfolio value
    risk_zero = gov.evaluate_portfolio_risk(
        portfolio_value=0.0, price_history=np.linspace(100.0, 120.0, 50)
    )
    assert risk_zero.portfolio_value == 0.0
    assert risk_zero.parametric_var_95 == 0.0


def test_api_robustness_and_malformed_json():
    """Verify api/main.py handles malformed bodies, empty registry queries, and Prometheus metrics."""
    client = TestClient(app)

    # 1. Reset coordinator strategy registry and query strategies (triggers line 62 auto research)
    coordinator.strategy_registry.clear()
    res_strats = client.get("/api/v1/strategies")
    assert res_strats.status_code == 200
    assert len(res_strats.json()) > 0

    # 2. Prometheus /metrics when top strategies exist (triggers line 36 max sharpe)
    res_metrics = client.get("/metrics")
    assert res_metrics.status_code == 200
    assert "quant_top_strategy_sharpe" in res_metrics.text

    # 3. POST /api/v1/research with non-JSON text/empty body (triggers lines 71-72)
    res_res = client.post("/api/v1/research", content="invalid json text")
    assert res_res.status_code == 200

    # 4. POST /api/v1/pairs/analyze with non-JSON text/empty body (triggers lines 139-140)
    res_pairs = client.post("/api/v1/pairs/analyze", content="invalid json text")
    assert res_pairs.status_code == 200
    assert "pairs_analysis" in res_pairs.json()


def test_cli_direct_invocation(monkeypatch, capsys):
    """Directly execute cli.main() to verify CLI argument dispatching and in-process execution."""
    import sys
    from cli import main

    monkeypatch.setattr(sys, "argv", ["cli.py", "metrics"])
    main()
    captured = capsys.readouterr()
    assert "quant_portfolio_equity" in captured.out
