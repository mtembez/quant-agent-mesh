"""Unit tests for Multivariate Covariance Matrix and 4-Asset Portfolio VaR (User Story 8.4)."""

import pytest
import numpy as np

from core.math import (
    compute_covariance_matrix,
    compute_portfolio_variance,
    compute_multivariate_parametric_var,
)
from risk.governor import RiskGovernorAgent
from core.data_feed import generate_multi_asset_feed, extract_ohlcv_arrays


def test_multivariate_covariance_and_portfolio_variance():
    """Verify US-8.4: Empirical covariance matrix Σ computation, symmetry, and diversification benefit."""
    np.random.seed(42)
    # Generate 4-asset returns with imperfect correlation
    n_bars = 200
    r_btc = np.random.normal(0.001, 0.03, n_bars)
    r_eth = 0.8 * r_btc + np.random.normal(0.0005, 0.015, n_bars)
    r_xau = np.random.normal(0.0002, 0.008, n_bars)  # Low correlation with crypto
    r_jpy = np.random.normal(0.0001, 0.005, n_bars)

    returns_matrix = np.column_stack([r_btc, r_eth, r_xau, r_jpy])
    cov_matrix = compute_covariance_matrix(returns_matrix)

    assert cov_matrix.shape == (4, 4)
    # Symmetry: Σ = Σ^T
    assert np.allclose(cov_matrix, cov_matrix.T, atol=1e-8)
    # Positive semi-definite (eigenvalues >= 0)
    eigenvalues = np.linalg.eigvalsh(cov_matrix)
    assert (eigenvalues >= -1e-9).all()

    # Portfolio weights: 35% BTC, 25% ETH, 25% Gold, 15% Yen
    weights = np.array([0.35, 0.25, 0.25, 0.15], dtype=np.float64)
    port_var = compute_portfolio_variance(weights, cov_matrix)
    port_vol = np.sqrt(port_var)
    assert port_vol > 0.0

    # Diversification benefit: Portfolio volatility must be less than weighted sum of individual volatilities
    individual_vols = np.sqrt(np.diag(cov_matrix))
    weighted_vol_sum = np.dot(weights, individual_vols)
    assert port_vol < weighted_vol_sum, "Diversification benefit failed (imperfect correlation)"


def test_multivariate_parametric_var():
    """Verify US-8.4: 4-Asset Parametric Value-at-Risk scaling across confidence intervals."""
    np.random.seed(42)
    n_bars = 300
    returns_matrix = np.random.normal(0.0, 0.02, size=(n_bars, 4))
    weights = np.array([0.25, 0.25, 0.25, 0.25], dtype=np.float64)
    portfolio_value = 100000.0

    var_95 = compute_multivariate_parametric_var(portfolio_value, weights, returns_matrix, confidence=0.95)
    var_99 = compute_multivariate_parametric_var(portfolio_value, weights, returns_matrix, confidence=0.99)

    assert var_95 > 0.0
    assert var_99 > var_95, "99% VaR must strictly exceed 95% VaR"
    # Approximate ratio of inverse normal CDF (2.3263 / 1.6449 ≈ 1.414)
    ratio = var_99 / var_95
    assert 1.35 < ratio < 1.48


def test_risk_governor_multivariate_audit_and_circuit_breaker():
    """Verify US-8.4: RiskGovernorAgent evaluates multi-asset portfolio risk and triggers circuit breakers."""
    governor = RiskGovernorAgent(max_var_limit_pct=10.0)

    # 1. Generate multi-asset price feed for all 4 assets
    feed = generate_multi_asset_feed(symbols=["BTC/USD", "ETH/USD", "XAU/USD", "JPY/USD"], n_bars=250, seed=42)
    prices_dict = {sym: extract_ohlcv_arrays(candles)["close"] for sym, candles in feed.items()}

    # Diversified weights: 30% BTC, 20% ETH, 30% Gold, 20% Yen
    weights_dict = {"BTC/USD": 0.30, "ETH/USD": 0.20, "XAU/USD": 0.30, "JPY/USD": 0.20}
    portfolio_value = 100000.0

    risk_metrics = governor.evaluate_multivariate_portfolio_risk(
        portfolio_value=portfolio_value,
        weights=weights_dict,
        prices_dict=prices_dict,
    )

    assert risk_metrics.portfolio_value == 100000.0
    assert risk_metrics.parametric_var_95 > 0.0
    assert risk_metrics.parametric_var_99 > risk_metrics.parametric_var_95
    assert "covariance_matrix" in risk_metrics.details
    assert "portfolio_daily_volatility" in risk_metrics.details
    assert risk_metrics.is_risk_breached is False

    # 2. Extreme volatility stress: trigger circuit breaker (> 10% VaR limit)
    # Simulate hyper-volatile crypto market
    stressed_prices = {
        "BTC/USD": prices_dict["BTC/USD"] * np.cumprod(1.0 + np.random.normal(0, 0.20, 250)),
        "ETH/USD": prices_dict["ETH/USD"] * np.cumprod(1.0 + np.random.normal(0, 0.25, 250)),
        "XAU/USD": prices_dict["XAU/USD"],
        "JPY/USD": prices_dict["JPY/USD"],
    }
    stressed_weights = {"BTC/USD": 0.80, "ETH/USD": 0.20, "XAU/USD": 0.0, "JPY/USD": 0.0}

    stressed_risk = governor.evaluate_multivariate_portfolio_risk(
        portfolio_value=portfolio_value,
        weights=stressed_weights,
        prices_dict=stressed_prices,
    )
    # The extreme crypto concentration and volatility should breach the 10% limit
    assert stressed_risk.is_risk_breached is True


def test_multivariate_risk_edge_cases_and_ridge_regularization():
    """Verify US-8.4: Degenerate matrix fallbacks, collinear ridge regularization, and empty weight handling."""
    # 1. Covariance matrix with < 2 bars
    cov_empty = compute_covariance_matrix(np.array([[0.01, 0.02]]))
    assert cov_empty.shape == (2, 2)

    # 2. Covariance of 1D array (scalar)
    cov_1d = compute_covariance_matrix(np.array([0.01, 0.02, 0.03]))
    assert cov_1d.shape == (1, 1)

    # 3. Collinear matrix triggering ridge regularization (line 120)
    collinear = np.column_stack([np.ones(50), np.ones(50)])  # Deterministic rank-deficient matrix
    cov_collinear = compute_covariance_matrix(collinear, ridge_epsilon=1e-4)
    assert cov_collinear.shape == (2, 2)
    # Eigenvalues must be >= ridge_epsilon
    eigs = np.linalg.eigvalsh(cov_collinear)
    assert (eigs >= 1e-4).all()

    # 4. Portfolio variance with empty or mismatched weights
    assert compute_portfolio_variance(np.array([]), cov_collinear) == 0.0
    assert compute_portfolio_variance(np.array([0.5, 0.5, 0.5]), cov_collinear) == 0.0

    # 5. Multivariate VaR with empty returns or zero value
    assert compute_multivariate_parametric_var(0.0, np.array([0.5, 0.5]), collinear) == 0.0
    assert compute_multivariate_parametric_var(100000.0, np.array([]), collinear) == 0.0

    # 6. Risk governor fallbacks: zero portfolio value, empty dicts, unknown symbols, short history
    gov = RiskGovernorAgent()
    assert gov.evaluate_multivariate_portfolio_risk(0.0, {"BTC/USD": 1.0}, {"BTC/USD": np.ones(10)}).parametric_var_95 == 0.0
    assert gov.evaluate_multivariate_portfolio_risk(100000.0, {"UNKNOWN": 1.0}, {"BTC/USD": np.ones(10)}).parametric_var_95 == 0.0
    assert gov.evaluate_multivariate_portfolio_risk(100000.0, {"BTC/USD": 1.0}, {"BTC/USD": np.ones(3)}).parametric_var_95 == 0.0
