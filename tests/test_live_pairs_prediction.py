"""Unit test suite for live pairs prediction and Ornstein-Uhlenbeck spread forecasting."""

import os
import sys
import subprocess
import pytest

from scripts.live_pairs_predictor import forecast_spread_trajectory, run_live_pairs_prediction


def test_forecast_spread_trajectory_mathematics():
    """Verify analytical Ornstein-Uhlenbeck spread trajectory projections."""
    current_spread = 0.05
    ou_theta = 2.0  # Daily reversion speed
    ou_mu = 0.0     # Mean reversion target
    ou_sigma = 0.01

    projections = forecast_spread_trajectory(
        current_spread=current_spread,
        ou_theta=ou_theta,
        ou_mu=ou_mu,
        ou_sigma=ou_sigma,
        horizons_hours=[1, 4, 12, 24],
    )

    assert len(projections) == 4
    # Expected spread should monotonically decay toward ou_mu (0.0)
    for i in range(len(projections) - 1):
        assert abs(projections[i + 1]["expected_spread"] - ou_mu) < abs(projections[i]["expected_spread"] - ou_mu)

    # Confidence interval width should expand over time horizon
    ci_0 = projections[0]["high_95"] - projections[0]["low_95"]
    ci_last = projections[-1]["high_95"] - projections[-1]["low_95"]
    assert ci_last > ci_0


def test_live_pairs_prediction_synthetic_mode():
    """Verify execution of pairs predictor in synthetic deterministic mode."""
    res = run_live_pairs_prediction(
        symbol_a="BTC/USD",
        symbol_b="ETH/USD",
        n_bars=100,
        use_synthetic=True,
    )
    assert res == 0


def test_live_pairs_cli_subprocess():
    """Verify CLI subprocess execution with --synthetic flag."""
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    script_path = os.path.join(repo_root, "scripts", "live_pairs_predictor.py")

    proc = subprocess.run(
        [sys.executable, script_path, "--asset-a", "BTC/USD", "--asset-b", "ETH/USD", "--synthetic"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        timeout=15,
    )

    assert proc.returncode == 0
    assert "LIVE PAIRS ARBITRAGE & RELATIVE PRICE PREDICTION ENGINE" in proc.stdout
    assert "PROJECTED RELATIVE PRICE TRAJECTORY" in proc.stdout
