"""Unit tests for Dedicated Spot Gold (XAU/USD) Analyzer and API endpoint."""

import pytest
from starlette.testclient import TestClient

from analytics.gold_analyzer import SpotGoldAnalyzer, compute_parkinson_volatility, compute_garman_klass_volatility
from api.main import app
import numpy as np


def test_spot_gold_volatility_estimators():
    """Verify mathematical calculation of Parkinson and Garman-Klass volatility."""
    n = 50
    np.random.seed(42)
    close = 3980.0 + np.cumsum(np.random.randn(n) * 2.0)
    high = close + np.abs(np.random.randn(n) * 3.0) + 0.5
    low = close - np.abs(np.random.randn(n) * 3.0) - 0.5
    open_arr = close + np.random.randn(n) * 0.5

    v_park = compute_parkinson_volatility(high, low)
    assert v_park > 0.0

    v_gk = compute_garman_klass_volatility(open_arr, high, low, close)
    assert v_gk > 0.0


def test_spot_gold_analyzer_strategy_overlays():
    """Verify strategy overlays and forward forecasts across all strategies."""
    analyzer = SpotGoldAnalyzer()

    for strat in ["ema", "bollinger", "rsi", "ou"]:
        res = analyzer.analyze(
            timeframe="1h",
            active_strategy=strat,
            custom_spot_price=3984.66,
            n_bars=60,
        )

        assert res.symbol == "XAU/USD"
        assert res.current_spot_price == 3984.66
        assert len(res.candles) == 60
        assert res.active_strategy_id == strat

        # Check strategy metrics presence
        assert "ema" in res.strategies
        assert "bollinger" in res.strategies
        assert "rsi" in res.strategies
        assert "ou" in res.strategies

        # Check 1-Hour forecast
        fc1 = res.forecast_1h
        assert fc1.expected_low < fc1.median_price < fc1.expected_high
        assert fc1.low_95 <= fc1.median_price <= fc1.high_95
        assert abs((fc1.prob_up + fc1.prob_down) - 100.0) < 0.2

        # Check forward trajectory
        assert len(res.forward_trajectory) == 8


def test_api_gold_analyze_endpoint():
    """Verify Starlette ASGI /api/v1/gold/analyze endpoint via GET and POST."""
    client = TestClient(app)

    # Test GET with default params
    res_get = client.get("/api/v1/gold/analyze?timeframe=1h&strategy=ema&spot_price=3984.66")
    assert res_get.status_code == 200
    d = res_get.json()
    assert d["symbol"] == "XAU/USD"
    assert d["current_spot_price"] == 3984.66
    assert d["active_strategy_id"] == "ema"
    assert "forecast_1h" in d
    assert "candles" in d

    # Test POST with custom strategy
    res_post = client.post(
        "/api/v1/gold/analyze",
        json={"timeframe": "4h", "strategy": "bollinger", "spot_price": 3985.50},
    )
    assert res_post.status_code == 200
    d_post = res_post.json()
    assert d_post["timeframe"] == "4h"
    assert d_post["active_strategy_id"] == "bollinger"
    assert d_post["current_spot_price"] == 3985.50
