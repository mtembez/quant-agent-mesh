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

        # Check Machine Learning Engine Telemetry
        assert res.ml_model_name == "Online Adaptive RLS + Bayesian Probability Engine"
        assert 0.0 <= res.ml_prediction_prob_up <= 100.0
        assert 0.0 <= res.ml_prediction_prob_down <= 100.0
        assert abs((res.ml_prediction_prob_up + res.ml_prediction_prob_down) - 100.0) < 0.2
        assert res.ml_consensus_signal in ["BUY", "SELL", "HOLD"]
        assert 0.0 <= res.ml_confidence_score <= 100.0
        assert len(res.ml_driving_features) > 0


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
    assert "ml_model_name" in d
    assert "ml_prediction_prob_up" in d
    assert "ml_consensus_signal" in d
    assert "ml_driving_features" in d

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


def test_spot_gold_demo_trader_and_endpoints():
    """Verify Spot Gold historical demo trade placement, lifecycle evaluation, and assessment endpoints."""
    client = TestClient(app)

    # 1. Reset trades
    res_del = client.delete("/api/v1/gold/demo-trades")
    assert res_del.status_code == 200
    d_init = res_del.json()
    assert d_init["total_trades"] == 0

    # 2. Place BUY demo trade on historical bar index 15
    res_buy = client.post(
        "/api/v1/gold/demo-trade",
        json={
            "side": "BUY",
            "bar_index": 15,
            "quantity": 2.0,
            "entry_price": 3840.0,
            "stop_loss": 3800.0,
            "take_profit": 3950.0,
        },
    )
    assert res_buy.status_code == 200
    d_buy = res_buy.json()
    assert d_buy["trade"]["side"] == "BUY"
    assert d_buy["trade"]["bar_index"] == 15
    assert d_buy["trade"]["quantity"] == 2.0
    assert d_buy["trade"]["status"] in ["OPEN", "CLOSED_PROFIT", "CLOSED_LOSS"]
    trade_id = d_buy["trade"]["trade_id"]

    # 3. Place SELL demo trade on bar index 30
    res_sell = client.post(
        "/api/v1/gold/demo-trade",
        json={
            "side": "SELL",
            "bar_index": 30,
            "quantity": 1.0,
            "entry_price": 3822.0,
            "stop_loss": 3870.0,
            "take_profit": 3750.0,
        },
    )
    assert res_sell.status_code == 200
    d_sell = res_sell.json()
    assert d_sell["trade"]["side"] == "SELL"

    # 4. Check assessment metrics
    res_assess = client.get("/api/v1/gold/demo-trades")
    assert res_assess.status_code == 200
    d_assess = res_assess.json()
    assert d_assess["total_trades"] == 2
    assert "win_rate_pct" in d_assess
    assert "net_pnl" in d_assess
    assert "profit_factor" in d_assess
    assert "current_equity" in d_assess

    # 5. Simulate strategy signals across all historical candles
    res_sim = client.post(
        "/api/v1/gold/demo-simulate",
        json={"strategy": "ema", "quantity": 1.5},
    )
    assert res_sim.status_code == 200
    d_sim = res_sim.json()
    assert d_sim["total_trades"] > 0
    assert len(d_sim["trades"]) > 0

    # 6. Test manual trade close if any trade is open
    open_trades = [t for t in d_sim["trades"] if t["status"] == "OPEN"]
    if open_trades:
        target_id = open_trades[0]["trade_id"]
        res_close = client.post("/api/v1/gold/demo-close", json={"trade_id": target_id})
        assert res_close.status_code == 200
        d_close = res_close.json()
        assert d_close["trade"]["status"] in ["CLOSED_PROFIT", "CLOSED_LOSS"]


def test_spot_gold_micro_account_100_management():
    """Verify $100 Micro-Account sizing, margin allocation, risk capping, and account mode switching."""
    analyzer = SpotGoldAnalyzer()
    res = analyzer.analyze(
        account_capital=100.0,
        leverage=200.0,
        custom_spot_price=3984.66,
    )
    assert res.account_capital == 100.0
    assert res.account_mode == "micro_100"
    assert res.leverage == 200.0
    assert res.recommended_lot_size == 0.01  # Must enforce 0.01 micro-lot sizing for small accounts
    assert res.max_risk_dollars == 2.00     # 2.0% risk cap ($2.00)
    assert res.margin_required <= 25.0      # Margin on 0.01 lot at 1:200 is ~$19.92
    assert res.free_margin >= 75.0          # Buffer remains > 75%
    assert res.margin_level_pct >= 400.0    # Margin level safely above 200%
    assert res.liquidation_price_distance >= 70.0  # Survives $70+ market swings

    # Test API account mode switch endpoint
    client = TestClient(app)
    res_mode = client.post("/api/v1/gold/account-mode", json={"capital": 100.0, "leverage": 200.0, "mode": "micro_100"})
    assert res_mode.status_code == 200
    d_mode = res_mode.json()
    assert d_mode["account_capital"] == 100.0
    assert d_mode["portfolio"]["cash"] == 100.0
    assert d_mode["portfolio"]["equity"] == 100.0


def test_spot_gold_100_historical_trades_and_audit():
    """Verify simulation of 100 historical trades on the last 3 months real XAU/USD data and audit endpoint."""
    client = TestClient(app)

    # Test audit endpoint
    res_audit = client.get("/api/v1/gold/100-trades-audit")
    assert res_audit.status_code == 200
    d_audit = res_audit.json()
    assert "summary" in d_audit
    assert "confluence_100_trades" in d_audit
    assert len(d_audit["confluence_100_trades"]) == 100

    # Test 100 trades simulation trigger
    res_sim = client.post("/api/v1/gold/demo-simulate", json={"strategy": "confluence", "n_trades": 100})
    assert res_sim.status_code == 200
    d_sim = res_sim.json()
    assert d_sim["total_trades"] == 100
    assert d_sim["closed_trades"] == 100
    assert d_sim["win_rate_pct"] == 40.0
    assert d_sim["net_pnl"] > 0
    assert d_sim["profit_factor"] >= 1.40
    assert d_sim["current_equity"] >= 500.0

