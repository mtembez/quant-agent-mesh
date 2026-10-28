import sys
import numpy as np
import pytest
from starlette.testclient import TestClient

from analytics.pairs import DynamicKalmanFilter, OrnsteinUhlenbeckEstimator, StatisticalArbitrageEngine
from api.main import app
import cli


@pytest.fixture
def client():
    return TestClient(app)


def test_dynamic_kalman_filter():
    kalman = DynamicKalmanFilter(delta=1e-4)
    # Generate cointegrated series with true beta = 2.0
    np.random.seed(42)
    p_b = 50.0 + np.cumsum(np.random.normal(0, 1.0, 100))
    p_a = 2.0 * p_b + np.random.normal(0, 0.5, 100)

    for i in range(len(p_b)):
        beta = kalman.update(p_a[i], p_b[i])

    # Assert Kalman filter converged to true ratio 2.0 within margin
    assert np.isclose(kalman.beta, 2.0, atol=0.1)


def test_ou_parameter_estimation():
    estimator = OrnsteinUhlenbeckEstimator()
    # Generate synthetic mean-reverting spread: S_t = 0.8 * S_{t-1} + noise
    np.random.seed(42)
    spread = np.zeros(150, dtype=np.float64)
    for i in range(1, 150):
        spread[i] = 0.8 * spread[i - 1] + np.random.normal(0, 1.0)

    theta, mu, sigma, half_life = estimator.estimate_parameters(spread)
    assert theta > 0.0
    assert half_life > 0.0
    assert half_life < 50.0

    # Edge case: Insufficient data
    assert estimator.estimate_parameters(np.array([1.0, 2.0])) == (0.0, 0.0, 0.0, 0.0)

    # Edge case: Explosive non-stationary series (b >= 1.0)
    explosive_spread = np.linspace(10.0, 1000.0, 50)
    e_theta, e_mu, e_sigma, e_hl = estimator.estimate_parameters(explosive_spread)
    assert e_hl == 999.0


def test_statistical_arbitrage_engine():
    engine = StatisticalArbitrageEngine()
    np.random.seed(42)
    prices_b = 100.0 + np.cumsum(np.random.normal(0, 1.0, 200))
    prices_a = 1.5 * prices_b + np.random.normal(0, 1.0, 200)

    result = engine.analyze_pair("ASSET_A", "ASSET_B", prices_a, prices_b)
    assert result.symbol_a == "ASSET_A"
    assert result.symbol_b == "ASSET_B"
    assert np.isclose(result.hedge_ratio_beta, 1.5, atol=0.15)
    assert len(result.spread_series) == 200
    assert len(result.z_score_series) == 200
    assert len(result.signals) == 200
    assert set(result.signals).issubset({-1, 0, 1})


def test_api_pairs_endpoint(client):
    res = client.post("/api/v1/pairs/analyze", json={"symbol_a": "BTC/USD", "symbol_b": "ETH/USD", "n_bars": 120})
    assert res.status_code == 200
    data = res.json()
    assert "pairs_analysis" in data
    assert "backtest" in data
    assert "hedge_ratio_beta" in data["pairs_analysis"]
    assert "annualized_sharpe" in data["backtest"]


def test_cli_pairs_command(monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["cli.py", "pairs", "--asset-a", "BTC/USD", "--asset-b", "ETH/USD", "--bars", "100"])
    cli.main()
    captured = capsys.readouterr()
    assert "ORNSTEIN-UHLENBECK PAIRS TRADING ANALYSIS" in captured.out
    assert "Kalman Hedge Ratio" in captured.out
    assert "Half-Life (Days)" in captured.out
