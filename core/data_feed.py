"""Market data feed generator and timeseries ingestion engine."""

import time
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from core.models import Candle

# Institutional multi-asset specifications registry
DEFAULT_ASSET_SPECS: Dict[str, Dict[str, Any]] = {
    "BTC/USD": {
        "asset_class": "crypto",
        "initial_price": 65000.0,
        "mu": 0.15,
        "sigma": 0.65,
        "pip_decimal": 2,
        "tick_size": 0.01,
        "lot_size": 1.0,
        "base_vol": 500.0,
    },
    "ETH/USD": {
        "asset_class": "crypto",
        "initial_price": 3200.0,
        "mu": 0.12,
        "sigma": 0.70,
        "pip_decimal": 2,
        "tick_size": 0.01,
        "lot_size": 1.0,
        "base_vol": 2500.0,
    },
    "XAU/USD": {
        "asset_class": "commodity",
        "initial_price": 2720.0,
        "mu": 0.08,
        "sigma": 0.16,
        "pip_decimal": 2,
        "tick_size": 0.01,
        "lot_size": 100.0,  # 100 troy oz contract
        "base_vol": 8000.0,
    },
    "JPY/USD": {
        "asset_class": "fx",
        "initial_price": 0.00654,  # USD/JPY ~ 152.9
        "mu": 0.01,
        "sigma": 0.10,
        "pip_decimal": 6,
        "tick_size": 0.000001,
        "lot_size": 100000.0,  # Standard FX 100k lot
        "base_vol": 250000.0,
    },
}


def generate_synthetic_gbm(
    initial_price: float = 100.0,
    n_bars: int = 500,
    mu: float = 0.08,
    sigma: float = 0.22,
    dt: float = 1.0 / 252.0,
    regime_shift_at: int = -1,
) -> List[Candle]:
    """Generate realistic OHLCV price series using Geometric Brownian Motion with regime shifts."""
    np.random.seed(42)  # Deterministic seed for reproducible tests
    prices = [initial_price]
    curr_mu = mu
    curr_sigma = sigma

    candles = []
    base_time = time.time() - (n_bars * 86400)

    for i in range(n_bars):
        if regime_shift_at > 0 and i >= regime_shift_at:
            # Shift into high-volatility downward shock regime
            curr_mu = -0.25
            curr_sigma = 0.45

        z = float(np.random.standard_normal())
        shock = (curr_mu - 0.5 * curr_sigma**2) * dt + curr_sigma * np.sqrt(dt) * z
        next_close = max(1.0, prices[-1] * np.exp(shock))
        prices.append(next_close)

        # Generate realistic OHLC values around close
        open_price = prices[-2]
        high_price = max(open_price, next_close) * (1.0 + abs(float(np.random.normal(0, 0.005))))
        low_price = min(open_price, next_close) * (1.0 - abs(float(np.random.normal(0, 0.005))))
        volume = float(np.random.lognormal(mean=10.0, sigma=0.5))

        candles.append(
            Candle(
                timestamp=base_time + (i * 86400),
                open=round(float(open_price), 2),
                high=round(float(high_price), 2),
                low=round(float(low_price), 2),
                close=round(float(next_close), 2),
                volume=round(volume, 1),
            )
        )

    return candles


def extract_ohlcv_arrays(candles: List[Candle]) -> Dict[str, np.ndarray]:
    """Extract zero-copy contiguous NumPy arrays from Candle list."""
    n = len(candles)
    close = np.empty(n, dtype=np.float64)
    high = np.empty(n, dtype=np.float64)
    low = np.empty(n, dtype=np.float64)
    open_arr = np.empty(n, dtype=np.float64)
    volume = np.empty(n, dtype=np.float64)
    timestamps = np.empty(n, dtype=np.float64)

    for i, c in enumerate(candles):
        close[i] = c.close
        high[i] = c.high
        low[i] = c.low
        open_arr[i] = c.open
        volume[i] = c.volume
        timestamps[i] = c.timestamp

    return {
        "close": close,
        "high": high,
        "low": low,
        "open": open_arr,
        "volume": volume,
        "timestamps": timestamps,
    }


def generate_multi_asset_feed(
    symbols: Optional[List[str]] = None,
    n_bars: int = 300,
    dt: float = 1.0 / 252.0,
    seed: int = 42,
) -> Dict[str, List[Candle]]:
    """Generate calendar-aligned multi-asset OHLCV timeseries with asset-specific volatilities."""
    if symbols is None:
        symbols = ["BTC/USD", "ETH/USD", "XAU/USD", "JPY/USD"]

    np.random.seed(seed)
    base_time = time.time() - (n_bars * 86400)
    result: Dict[str, List[Candle]] = {}

    for sym in symbols:
        spec = DEFAULT_ASSET_SPECS.get(
            sym,
            {
                "asset_class": "equity",
                "initial_price": 100.0,
                "mu": 0.08,
                "sigma": 0.20,
                "pip_decimal": 2,
                "base_vol": 1000.0,
            },
        )
        p0 = spec["initial_price"]
        mu = spec["mu"]
        sigma = spec["sigma"]
        dec = spec.get("pip_decimal", 2)
        base_v = spec.get("base_vol", 1000.0)

        prices = [p0]
        candles = []

        for i in range(n_bars):
            z = float(np.random.standard_normal())
            shock = (mu - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * z
            next_close = max(1e-6, prices[-1] * np.exp(shock))
            prices.append(next_close)

            open_p = prices[-2]
            spread_noise = max(10 ** (-dec), abs(float(np.random.normal(0, 0.003 * open_p))))
            high_p = max(open_p, next_close) + spread_noise
            low_p = max(1e-6, min(open_p, next_close) - spread_noise)
            vol = float(np.random.lognormal(mean=np.log(base_v), sigma=0.4))

            candles.append(
                Candle(
                    timestamp=base_time + (i * 86400),
                    open=round(float(open_p), dec),
                    high=round(float(high_p), dec),
                    low=round(float(low_p), dec),
                    close=round(float(next_close), dec),
                    volume=round(vol, 1),
                )
            )
        result[sym] = candles

    return result


def extract_multi_asset_price_matrix(
    multi_feed: Dict[str, List[Candle]],
) -> Tuple[List[str], np.ndarray, np.ndarray]:
    """Extract synchronized, C-contiguous price matrix (n_bars, n_assets) with zero NaNs."""
    symbols = list(multi_feed.keys())
    if not symbols:
        return [], np.empty(0, dtype=np.float64), np.empty((0, 0), dtype=np.float64)

    n_bars = len(multi_feed[symbols[0]])
    n_assets = len(symbols)

    timestamps = np.array([c.timestamp for c in multi_feed[symbols[0]]], dtype=np.float64)
    price_matrix = np.empty((n_bars, n_assets), dtype=np.float64, order="C")

    for j, sym in enumerate(symbols):
        candles = multi_feed[sym]
        for i in range(min(n_bars, len(candles))):
            price_matrix[i, j] = candles[i].close

    return symbols, timestamps, np.ascontiguousarray(price_matrix)

