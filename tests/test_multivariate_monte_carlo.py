"""Unit tests for Correlated Multi-Asset Monte Carlo Simulation via Cholesky (User Story 8.5)."""

import pytest
import numpy as np

from risk.governor import RiskGovernorAgent
from core.math import compute_covariance_matrix
from core.data_feed import generate_multi_asset_feed, extract_ohlcv_arrays


def test_multivariate_monte_carlo_cholesky_correlation_preservation():
    """Verify US-8.5: Cholesky decomposition L L^T = Σ preserves cross-asset correlation in Monte Carlo paths."""
    governor = RiskGovernorAgent()

    # Create a 2-asset covariance matrix with known high correlation (rho = 0.85)
    sigma_1 = 0.03  # 3% daily vol
    sigma_2 = 0.02  # 2% daily vol
    rho = 0.85
    cov_12 = rho * sigma_1 * sigma_2

    cov_matrix = np.array([
        [sigma_1**2, cov_12],
        [cov_12, sigma_2**2],
    ], dtype=np.float64)

    symbols = ["ASSET_A", "ASSET_B"]
    current_prices = {"ASSET_A": 100.0, "ASSET_B": 100.0}
    quantities = {"ASSET_A": 10.0, "ASSET_B": 10.0}
    current_cash = 5000.0

    mc_results = governor.run_multivariate_monte_carlo(
        current_cash=current_cash,
        quantities=quantities,
        current_prices=current_prices,
        cov_matrix=cov_matrix,
        symbols=symbols,
        n_simulations=2000,
        horizon_days=30,
        seed=42,
    )

    # Extract terminal prices across all 2000 simulations
    terminal_prices_a = mc_results["terminal_asset_prices"]["ASSET_A"]
    terminal_prices_b = mc_results["terminal_asset_prices"]["ASSET_B"]

    # Compute empirical correlation of simulated terminal log-returns
    log_ret_a = np.log(np.array(terminal_prices_a) / current_prices["ASSET_A"])
    log_ret_b = np.log(np.array(terminal_prices_b) / current_prices["ASSET_B"])
    emp_corr = float(np.corrcoef(log_ret_a, log_ret_b)[0, 1])

    # The simulated correlation must match theoretical rho (0.85) within small Monte Carlo sampling error
    assert 0.80 < emp_corr < 0.90, f"Empirical correlation {emp_corr:.4f} did not match target rho {rho}"


def test_multivariate_monte_carlo_portfolio_simulation():
    """Verify US-8.5: 1,000-path correlated simulation across mixed portfolio (BTC, ETH, Gold, Yen, Cash)."""
    governor = RiskGovernorAgent(max_drawdown_limit_pct=35.0, max_var_limit_pct=20.0)

    # 4-asset setup
    symbols = ["BTC/USD", "ETH/USD", "XAU/USD", "JPY/USD"]
    current_prices = {
        "BTC/USD": 65000.0,
        "ETH/USD": 3200.0,
        "XAU/USD": 2720.0,
        "JPY/USD": 0.00654,
    }
    quantities = {
        "BTC/USD": 0.5,       # $32,500
        "ETH/USD": 4.0,       # $12,800
        "XAU/USD": 8.0,       # $21,760
        "JPY/USD": 1500000.0, # $9,810
    }
    current_cash = 23130.0    # Total Equity = $100,000

    # Build realistic covariance matrix
    vols = np.array([0.04, 0.045, 0.012, 0.007])
    corr = np.array([
        [1.00, 0.75, 0.15, -0.05],
        [0.75, 1.00, 0.10, -0.03],
        [0.15, 0.10, 1.00,  0.25],
        [-0.05, -0.03, 0.25, 1.00],
    ])
    cov_matrix = np.outer(vols, vols) * corr

    mc_results = governor.run_multivariate_monte_carlo(
        current_cash=current_cash,
        quantities=quantities,
        current_prices=current_prices,
        cov_matrix=cov_matrix,
        symbols=symbols,
        n_simulations=1000,
        horizon_days=30,
        seed=101,
    )

    assert mc_results["n_simulations"] == 1000
    assert mc_results["horizon_days"] == 30
    assert mc_results["initial_portfolio_value"] == 100000.0
    assert mc_results["expected_terminal_equity"] > 0.0
    assert mc_results["median_terminal_equity"] > 0.0
    assert mc_results["simulated_var_99"] > mc_results["simulated_var_95"] > 0.0
    assert 0.0 < mc_results["worst_loss_pct"] < 100.0
    assert mc_results["circuit_breaker_tripped"] is False


def test_multivariate_monte_carlo_circuit_breaker_trip():
    """Verify US-8.5: Extreme correlated downward shocks trip the portfolio circuit breaker."""
    governor = RiskGovernorAgent(max_drawdown_limit_pct=15.0, max_var_limit_pct=10.0)

    symbols = ["BTC/USD"]
    current_prices = {"BTC/USD": 60000.0}
    quantities = {"BTC/USD": 1.5}
    current_cash = 10000.0  # $100,000 equity

    # Hyper-volatility covariance: 15% daily volatility
    cov_matrix = np.array([[0.15**2]])

    mc_results = governor.run_multivariate_monte_carlo(
        current_cash=current_cash,
        quantities=quantities,
        current_prices=current_prices,
        cov_matrix=cov_matrix,
        symbols=symbols,
        n_simulations=1000,
        horizon_days=30,
        seed=999,
    )

    # 15% daily vol over 30 days will produce worst loss > 15% limit
    assert mc_results["worst_loss_pct"] > 15.0
    assert mc_results["circuit_breaker_tripped"] is True


def test_governor_multivariate_risk_includes_mc_integration():
    """Verify US-8.5: evaluate_multivariate_portfolio_risk natively integrates correlated Monte Carlo results."""
    governor = RiskGovernorAgent(max_var_limit_pct=15.0)

    feed = generate_multi_asset_feed(symbols=["BTC/USD", "XAU/USD"], n_bars=200, seed=42)
    prices_dict = {sym: extract_ohlcv_arrays(candles)["close"] for sym, candles in feed.items()}
    weights = {"BTC/USD": 0.60, "XAU/USD": 0.40}

    risk_metrics = governor.evaluate_multivariate_portfolio_risk(
        portfolio_value=100000.0,
        weights=weights,
        prices_dict=prices_dict,
        run_monte_carlo=True,
    )

    assert "monte_carlo" in risk_metrics.details
    mc = risk_metrics.details["monte_carlo"]
    assert "worst_loss_pct" in mc
    assert "simulated_var_95" in mc
    assert "simulated_var_99" in mc
    assert mc["horizon_days"] == 30


def test_multivariate_monte_carlo_edge_cases():
    """Verify US-8.5: Empty symbol list, mismatched covariance dimension, and ridge trigger."""
    gov = RiskGovernorAgent()
    # 1. Empty symbols (line 195)
    assert gov.run_multivariate_monte_carlo(1000.0, {}, {}, np.eye(2), []) == {}

    # 2. Covariance shape mismatch (line 199)
    res_mismatch = gov.run_multivariate_monte_carlo(
        current_cash=10000.0,
        quantities={"A": 1.0},
        current_prices={"A": 100.0},
        cov_matrix=np.eye(4),  # Mismatch: 1 symbol vs 4x4 cov
        symbols=["A"],
        n_simulations=50,
        horizon_days=5,
    )
    assert res_mismatch["n_simulations"] == 50

    # 3. Covariance with zero eigenvalue triggering ridge regularization (line 204)
    singular_cov = np.zeros((2, 2))  # Zero matrix
    res_singular = gov.run_multivariate_monte_carlo(
        current_cash=10000.0,
        quantities={"A": 1.0, "B": 1.0},
        current_prices={"A": 100.0, "B": 100.0},
        cov_matrix=singular_cov,
        symbols=["A", "B"],
        n_simulations=50,
        horizon_days=5,
    )
    assert res_singular["expected_terminal_equity"] > 0.0
