"""Market data feed generator and timeseries ingestion engine."""

import time
from typing import Dict, List, Tuple
import numpy as np
from core.models import Candle


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
