"""Unit tests for Online Adaptive Pairs Predictor and Starlette Live Prediction API."""

import numpy as np
import pytest
from starlette.testclient import TestClient

from analytics.auto_learner import OnlineAdaptivePairsPredictor
from api.main import app


def test_online_adaptive_predictor_mechanics():
    """Verify adaptive Kalman innovation updating and accuracy scoring."""
    predictor = OnlineAdaptivePairsPredictor(initial_beta=1.0, base_delta=1e-4)

    # Initial state
    assert predictor.beta == 1.0
    assert predictor.get_online_accuracy() == 75.0

    # Feed synthetic prices with regime shock
    for i in range(25):
        p_b = 100.0 + i * 0.5
        # Introduce a sudden shift in ratio to test adaptive learning rate expansion
        p_a = (1.5 * p_b) if i > 15 else (1.0 * p_b)
        new_beta = predictor.update_online(p_a, p_b)
        assert new_beta > 0

    # The adaptive delta (learning rate) should adjust
    assert predictor.current_delta > 0
    assert len(predictor.innovation_history) == 25


def test_online_adaptive_predictor_forecast():
    """Verify forward trajectory projections and confidence cones."""
    predictor = OnlineAdaptivePairsPredictor()
    n = 100
    p_b = np.linspace(100, 150, n)
    p_a = 1.2 * p_b + np.sin(np.linspace(0, 10, n))

    res = predictor.predict_pair("BTC/USD", "ETH/USD", p_a, p_b, data_source="Test Suite")

    assert res.symbol_a == "BTC/USD"
    assert res.symbol_b == "ETH/USD"
    assert res.hedge_ratio_beta > 0
    assert len(res.trajectory) == 7
    assert len(res.historical_spreads) == 30

    # Verify trajectory intervals
    for point in res.trajectory:
        assert point.low_95 <= point.expected_spread <= point.high_95
        assert point.horizon_hours > 0


def test_api_live_prediction_endpoint():
    """Verify Starlette ASGI live prediction endpoint via GET and POST."""
    client = TestClient(app)

    # Test GET
    res_get = client.get("/api/v1/predict/live?symbol_a=BTC/USD&symbol_b=ETH/USD&synthetic=true")
    assert res_get.status_code == 200
    data_get = res_get.json()
    assert "hedge_ratio_beta" in data_get
    assert "action_signal" in data_get
    assert len(data_get["trajectory"]) > 0

    # Test POST
    res_post = client.post(
        "/api/v1/predict/live",
        json={"symbol_a": "XAU/USD", "symbol_b": "JPY/USD", "synthetic": True},
    )
    assert res_post.status_code == 200
    data_post = res_post.json()
    assert data_post["symbol_a"] == "XAU/USD"
    assert data_post["symbol_b"] == "JPY/USD"


def test_api_serves_frontend_dist():
    """Verify that Starlette mounts and serves the React single-page app."""
    client = TestClient(app)
    res = client.get("/")
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert "QUANT SENTINEL" in res.text or "<div id=\"root\">" in res.text
