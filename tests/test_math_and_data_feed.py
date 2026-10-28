import numpy as np
import pytest
from core.data_feed import extract_ohlcv_arrays, generate_synthetic_gbm
from core.math import (
    compute_annualized_sharpe,
    compute_calmar_ratio,
    compute_conditional_var,
    compute_historical_var,
    compute_log_returns,
    compute_max_drawdown,
    compute_parametric_var,
    compute_sortino_ratio,
)


def test_log_returns():
    prices = np.array([100.0, 105.0, 102.0, 110.0])
    returns = compute_log_returns(prices)
    assert len(returns) == 3
    assert np.isclose(returns[0], np.log(105.0 / 100.0), atol=1e-5)
    assert np.isclose(returns[1], np.log(102.0 / 105.0), atol=1e-5)

    # Empty or single price edge case
    assert len(compute_log_returns(np.array([100.0]))) == 0


def test_sharpe_and_sortino_ratios():
    # Constant positive returns -> high Sharpe & Sortino
    returns = np.array([0.01, 0.02, 0.015, 0.012, 0.018])
    sharpe = compute_annualized_sharpe(returns)
    assert sharpe > 0.0

    sortino = compute_sortino_ratio(returns)
    assert sortino >= 0.0

    # Zero variance edge case
    zero_var = np.array([0.01, 0.01, 0.01])
    assert compute_annualized_sharpe(zero_var) == 0.0


def test_max_drawdown_calculation():
    # Equity curve with known peak at 120 and trough at 90 -> 25% DD
    equity = np.array([100.0, 110.0, 120.0, 105.0, 90.0, 100.0, 115.0])
    dd_pct, peak_idx, trough_idx = compute_max_drawdown(equity)
    assert dd_pct == 25.0
    assert peak_idx == 2
    assert trough_idx == 4

    # Monotonically increasing curve
    mono = np.array([100.0, 105.0, 110.0, 115.0])
    assert compute_max_drawdown(mono)[0] == 0.0


def test_calmar_ratio():
    assert compute_calmar_ratio(15.0, 10.0) == 1.5
    assert compute_calmar_ratio(10.0, 0.0) == 10.0
    assert compute_calmar_ratio(-5.0, 0.0) == 0.0


def test_value_at_risk_metrics():
    np.random.seed(42)
    returns = np.random.normal(loc=0.001, scale=0.02, size=250)
    portfolio_value = 100000.0

    p_var = compute_parametric_var(portfolio_value, returns, confidence=0.95)
    assert p_var > 0.0
    assert p_var < portfolio_value

    h_var = compute_historical_var(portfolio_value, returns, confidence=0.95)
    assert h_var > 0.0

    c_var = compute_conditional_var(portfolio_value, returns, confidence=0.95)
    # Expected shortfall must be greater than or equal to historical VaR
    assert c_var >= h_var


def test_synthetic_data_feed_and_extraction():
    candles = generate_synthetic_gbm(initial_price=100.0, n_bars=100, mu=0.05, sigma=0.20)
    assert len(candles) == 100
    assert candles[0].close > 0.0

    ohlcv = extract_ohlcv_arrays(candles)
    assert len(ohlcv["close"]) == 100
    assert len(ohlcv["high"]) == 100
    assert np.all(ohlcv["high"] >= ohlcv["low"])
