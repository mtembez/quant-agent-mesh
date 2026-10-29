"""Unit tests for Cross-Asset Pairs Arbitrage (User Story 8.3)."""

import pytest
import numpy as np

from analytics.pairs import StatisticalArbitrageEngine
from core.data_feed import generate_multi_asset_feed, extract_ohlcv_arrays
from core.swarm import QuantSwarmCoordinator


def test_cross_asset_xau_jpy_log_arbitrage():
    """Verify US-8.3: XAU/USD vs JPY/USD cross-asset pairs analysis using log-spread."""
    feed = generate_multi_asset_feed(symbols=["XAU/USD", "JPY/USD"], n_bars=300, seed=42)
    prices_xau = extract_ohlcv_arrays(feed["XAU/USD"])["close"]
    prices_jpy = extract_ohlcv_arrays(feed["JPY/USD"])["close"]

    engine = StatisticalArbitrageEngine()
    # Log prices must be supported to prevent beta divergence (~400,000 scale mismatch)
    res = engine.analyze_pair(
        symbol_a="XAU/USD",
        symbol_b="JPY/USD",
        prices_a=prices_xau,
        prices_b=prices_jpy,
        use_log_prices=True,
    )

    # Beta in log-space should be of order O(1) to O(10), not 400,000
    assert abs(res.hedge_ratio_beta) < 50.0, f"Hedge ratio beta blew up: {res.hedge_ratio_beta}"
    assert getattr(res, "is_log_spread", False) is True, "Result must flag is_log_spread as True"
    assert res.ou_half_life_days > 0.0
    assert len(res.signals) == len(prices_xau)
    assert set(res.signals).issubset({-1, 0, 1})


def test_cross_asset_btc_xau_digital_vs_physical_gold():
    """Verify US-8.3: BTC/USD vs XAU/USD digital vs physical gold relative valuation spread."""
    feed = generate_multi_asset_feed(symbols=["BTC/USD", "XAU/USD"], n_bars=300, seed=101)
    prices_btc = extract_ohlcv_arrays(feed["BTC/USD"])["close"]
    prices_xau = extract_ohlcv_arrays(feed["XAU/USD"])["close"]

    engine = StatisticalArbitrageEngine()
    res = engine.analyze_pair(
        symbol_a="BTC/USD",
        symbol_b="XAU/USD",
        prices_a=prices_btc,
        prices_b=prices_xau,
        use_log_prices=True,
    )

    assert abs(res.hedge_ratio_beta) < 10.0
    assert res.ou_half_life_days > 0.0
    assert len(res.z_score_series) == len(prices_btc)


def test_coordinator_cross_asset_pairs_arbitrage():
    """Verify US-8.3: QuantSwarmCoordinator provides unified cross-asset arbitrage workflow."""
    coordinator = QuantSwarmCoordinator()
    
    # Must support analyzing XAU/USD vs JPY/USD directly
    result = coordinator.analyze_cross_asset_arbitrage(pair_name="XAU-JPY", n_bars=250)
    
    assert "pairs_analysis" in result
    assert "backtest" in result
    assert result["pairs_analysis"]["symbol_a"] == "XAU/USD"
    assert result["pairs_analysis"]["symbol_b"] == "JPY/USD"
    assert result["backtest"]["total_trades"] >= 0
    assert "annualized_sharpe" in result["backtest"]
