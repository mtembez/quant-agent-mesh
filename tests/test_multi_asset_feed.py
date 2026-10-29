"""Unit tests for Multi-Asset Feed and Calendar Alignment (User Story 8.1)."""

import pytest
import numpy as np

from core.data_feed import (
    generate_multi_asset_feed,
    extract_multi_asset_price_matrix,
    DEFAULT_ASSET_SPECS,
)


def test_multi_asset_feed_generation():
    """Verify US-8.1: Multi-asset feed generates synchronized, NaN-free candle series."""
    symbols = ["BTC/USD", "ETH/USD", "XAU/USD", "JPY/USD"]
    n_bars = 250
    feed = generate_multi_asset_feed(symbols=symbols, n_bars=n_bars, seed=42)

    # 1. All requested symbols exist
    for sym in symbols:
        assert sym in feed, f"Symbol {sym} missing from multi-asset feed"
        assert len(feed[sym]) == n_bars, f"Candle length mismatch for {sym}"

    # 2. Price ranges and precision match PRD assumptions
    btc_candles = feed["BTC/USD"]
    eth_candles = feed["ETH/USD"]
    xau_candles = feed["XAU/USD"]
    jpy_candles = feed["JPY/USD"]

    # BTC should be in reasonable institutional crypto range
    assert 30000.0 < btc_candles[0].close < 100000.0
    # ETH in crypto range
    assert 1500.0 < eth_candles[0].close < 6000.0
    # XAU/USD should be around $2,500–$3,200/oz
    assert 2200.0 < xau_candles[0].close < 3500.0
    # JPY/USD should reflect realistic Yen pricing (e.g. 0.0055 to 0.0080, USD/JPY ~125-180)
    assert 0.0050 < jpy_candles[0].close < 0.0090

    # 3. Valid OHLC invariants: low <= open, close <= high
    for sym, candles in feed.items():
        for c in candles:
            assert c.low <= c.open <= c.high, f"{sym} invalid open: {c}"
            assert c.low <= c.close <= c.high, f"{sym} invalid close: {c}"
            assert c.volume >= 0.0, f"{sym} negative volume: {c}"


def test_multi_asset_matrix_extraction():
    """Verify zero-copy, C-contiguous price matrix extraction across assets with zero NaNs."""
    symbols = ["BTC/USD", "ETH/USD", "XAU/USD", "JPY/USD"]
    n_bars = 200
    feed = generate_multi_asset_feed(symbols=symbols, n_bars=n_bars, seed=123)

    extracted_syms, timestamps, price_matrix = extract_multi_asset_price_matrix(feed)

    assert extracted_syms == symbols
    assert len(timestamps) == n_bars
    assert price_matrix.shape == (n_bars, 4)
    assert price_matrix.flags["C_CONTIGUOUS"], "Matrix must be C-contiguous for memory cache locality"
    assert not np.isnan(price_matrix).any(), "Price matrix must contain zero NaNs"
    assert (price_matrix > 0.0).all(), "All asset prices must be strictly positive"


def test_default_asset_specs_registry():
    """Verify default asset specification registry exists with tick sizes and asset classes."""
    for sym in ["BTC/USD", "ETH/USD", "XAU/USD", "JPY/USD"]:
        assert sym in DEFAULT_ASSET_SPECS
        spec = DEFAULT_ASSET_SPECS[sym]
        assert "asset_class" in spec
        assert "tick_size" in spec
        assert "pip_decimal" in spec
        assert spec["tick_size"] > 0
