"""Unit tests for Dedicated Spot Gold (XAU/USD) Analyzer and API endpoint."""

import pytest
from starlette.testclient import TestClient

from analytics.gold_analyzer import (
    SpotGoldAnalyzer,
    compute_parkinson_volatility,
    compute_garman_klass_volatility,
    compute_rogers_satchell_volatility,
    compute_yang_zhang_volatility,
)
from api.main import app
import numpy as np


def test_spot_gold_volatility_estimators():
    """Verify mathematical calculation of Parkinson, Garman-Klass, Rogers-Satchell, and Yang-Zhang volatility."""
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

    v_rs = compute_rogers_satchell_volatility(open_arr, high, low, close)
    assert v_rs > 0.0

    v_yz = compute_yang_zhang_volatility(open_arr, high, low, close)
    assert v_yz > 0.0


def test_spot_gold_analyzer_strategy_overlays():
    """Verify strategy overlays and forward forecasts across all strategies."""
    analyzer = SpotGoldAnalyzer()

    for strat in ["ema", "bollinger", "rsi", "ou"]:
        res = analyzer.analyze(
            timeframe="1h",
            active_strategy=strat,
            custom_spot_price=3984.66,
            n_bars=60,
            ema_fast=10,
            ema_slow=20,
        )

        assert res.symbol == "XAU/USD"
        assert res.current_spot_price == 3984.66
        assert len(res.candles) == 60
        assert res.active_strategy_id == strat
        assert res.rogers_satchell_volatility_pct > 0.0
        assert res.yang_zhang_volatility_pct > 0.0
        assert res.recommended_lot_size > 0.0
        assert res.trailing_stop_loss > 0.0
        assert res.take_profit_target > 0.0

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
    """Verify Starlette ASGI /api/v1/gold/analyze and /api/v1/gold/trade endpoints."""
    client = TestClient(app)

    # Test GET with default params
    res_get = client.get("/api/v1/gold/analyze?timeframe=1h&strategy=ema&spot_price=3984.66")
    assert res_get.status_code == 200
    d = res_get.json()
    assert d["symbol"] == "XAU/USD"
    assert d["current_spot_price"] == 3984.66
    assert d["active_strategy_id"] == "ema"
    assert "rogers_satchell_volatility_pct" in d
    assert "yang_zhang_volatility_pct" in d
    assert "recommended_lot_size" in d
    assert "forecast_1h" in d
    assert "candles" in d

    # Test POST with custom strategy and parameters
    res_post = client.post(
        "/api/v1/gold/analyze",
        json={"timeframe": "4h", "strategy": "bollinger", "spot_price": 3985.50, "boll_window": 25, "boll_std": 2.2},
    )
    assert res_post.status_code == 200
    d_post = res_post.json()
    assert d_post["timeframe"] == "4h"

    # Test POST trade execution
    res_trade = client.post(
        "/api/v1/gold/trade",
        json={"side": "BUY", "quantity": 1.0, "market_price": 3984.66, "stop_loss": 3960.0, "take_profit": 4020.0},
    )
    assert res_trade.status_code == 200
    d_trade = res_trade.json()
    assert d_trade["order"]["symbol"] == "XAU/USD"
    assert d_trade["order"]["side"] == "BUY"
    assert "portfolio" in d_trade

    assert d_post["timeframe"] == "4h"
    assert d_post["active_strategy_id"] == "bollinger"
    assert d_post["current_spot_price"] == 3985.50
