"""Live real-time market data ingestion adapter for public crypto exchange feeds."""

import json
import time
import urllib.request
from typing import Dict, List, Optional, Tuple
import numpy as np

from core.models import Candle


def fetch_kraken_ohlcv(
    pair: str = "XXBTZUSD",
    interval_minutes: int = 60,
    timeout: int = 8,
) -> List[Candle]:
    """Fetch live historical OHLCV candles from Kraken public REST API without authentication."""
    # Kraken pair mapping
    pair_map = {
        "BTC/USD": "XXBTZUSD",
        "BTCUSD": "XXBTZUSD",
        "ETH/USD": "XETHZUSD",
        "ETHUSD": "XETHZUSD",
    }
    kraken_pair = pair_map.get(pair, pair)
    url = f"https://api.kraken.com/0/public/OHLC?pair={kraken_pair}&interval={interval_minutes}"

    req = urllib.request.Request(url, headers={"User-Agent": "QuantSentinel/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if payload.get("error"):
        raise RuntimeError(f"Kraken API error: {payload['error']}")

    result = payload.get("result", {})
    # Find matching data key
    data_key = None
    for k in result.keys():
        if k != "last":
            data_key = k
            break

    if not data_key or not result[data_key]:
        raise ValueError(f"No OHLCV candle data returned for pair {pair}")

    raw_candles = result[data_key]
    candles: List[Candle] = []

    for row in raw_candles:
        # Kraken format: [time, open, high, low, close, vwap, volume, count]
        candles.append(
            Candle(
                timestamp=float(row[0]),
                open=float(row[1]),
                high=float(row[2]),
                low=float(row[3]),
                close=float(row[4]),
                volume=float(row[6]),
            )
        )

    return candles


def get_live_pair_prices(
    symbol_a: str = "BTC/USD",
    symbol_b: str = "ETH/USD",
    interval_minutes: int = 60,
    n_bars: int = 300,
) -> Tuple[np.ndarray, np.ndarray, float, float]:
    """
    Fetch synchronized live closing price arrays and current spot quotes for a trading pair.
    Returns: (prices_a, prices_b, latest_spot_a, latest_spot_b)
    """
    candles_a = fetch_kraken_ohlcv(symbol_a, interval_minutes=interval_minutes)
    candles_b = fetch_kraken_ohlcv(symbol_b, interval_minutes=interval_minutes)

    # Align timestamps
    dict_b = {c.timestamp: c.close for c in candles_b}
    aligned_a = []
    aligned_b = []

    for c in candles_a:
        if c.timestamp in dict_b:
            aligned_a.append(c.close)
            aligned_b.append(dict_b[c.timestamp])

    if len(aligned_a) < 30:
        raise ValueError(f"Insufficient aligned bars ({len(aligned_a)}) between {symbol_a} and {symbol_b}")

    # Limit to requested n_bars
    p_a = np.array(aligned_a[-n_bars:], dtype=np.float64)
    p_b = np.array(aligned_b[-n_bars:], dtype=np.float64)

    return p_a, p_b, float(p_a[-1]), float(p_b[-1])
