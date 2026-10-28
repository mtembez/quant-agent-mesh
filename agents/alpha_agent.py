"""Alpha Hypothesis Swarm Agent formulating quantitative trading strategy signals."""

from typing import Any, Dict, List
import numpy as np


class AlphaHypothesisAgent:
    """Formulates and generates parameterized quantitative trading signals."""

    def generate_bollinger_signals(self, prices: np.ndarray, window: int = 20, num_std: float = 2.0) -> np.ndarray:
        """Mean reversion signals based on Bollinger Band breakouts."""
        n = len(prices)
        signals = np.zeros(n, dtype=np.int8)
        if n < window:
            return signals

        # Rolling SMA and Std
        weights = np.ones(window) / window
        sma = np.convolve(prices, weights, mode="valid")

        # Pad start to align with prices length
        pad_len = window - 1
        full_sma = np.empty(n, dtype=np.float64)
        full_sma[:pad_len] = prices[:pad_len]
        full_sma[pad_len:] = sma

        # Vectorized rolling standard deviation
        stds = np.zeros(n, dtype=np.float64)
        for i in range(pad_len, n):
            stds[i] = np.std(prices[i - pad_len : i + 1])

        upper_band = full_sma + (num_std * stds)
        lower_band = full_sma - (num_std * stds)

        # Long when below lower band (oversold), exit/short when above upper band
        long_condition = prices < lower_band
        short_condition = prices > upper_band

        signals[long_condition] = 1
        signals[short_condition] = -1
        return signals

    def generate_ema_cross_signals(self, prices: np.ndarray, fast_window: int = 12, slow_window: int = 26) -> np.ndarray:
        """Trend following signals based on Exponential Moving Average crossovers."""
        n = len(prices)
        signals = np.zeros(n, dtype=np.int8)
        if n < slow_window:
            return signals

        # Compute EMAs
        fast_ema = self._calc_ema(prices, fast_window)
        slow_ema = self._calc_ema(prices, slow_window)

        # 1 when fast > slow, -1 when fast < slow
        signals[fast_ema > slow_ema] = 1
        signals[fast_ema < slow_ema] = -1
        return signals

    def generate_rsi_signals(self, prices: np.ndarray, period: int = 14, overbought: float = 70.0, oversold: float = 30.0) -> np.ndarray:
        """Momentum signals based on Relative Strength Index (RSI)."""
        n = len(prices)
        signals = np.zeros(n, dtype=np.int8)
        if n <= period:
            return signals

        deltas = np.diff(prices)
        gains = np.maximum(0.0, deltas)
        losses = np.maximum(0.0, -deltas)

        avg_gain = np.mean(gains[:period])
        avg_loss = np.mean(losses[:period])

        rsi = np.zeros(n, dtype=np.float64)
        for i in range(period, n):
            delta = deltas[i - 1]
            gain = max(0.0, delta)
            loss = max(0.0, -delta)
            avg_gain = (avg_gain * (period - 1) + gain) / period
            avg_loss = (avg_loss * (period - 1) + loss) / period

            if avg_loss == 0.0:
                rsi[i] = 100.0
            else:
                rs = avg_gain / avg_loss
                rsi[i] = 100.0 - (100.0 / (1.0 + rs))

        # Long when oversold, short/exit when overbought
        signals[rsi < oversold] = 1
        signals[rsi > overbought] = -1
        return signals

    def _calc_ema(self, prices: np.ndarray, span: int) -> np.ndarray:
        """Calculate Exponential Moving Average."""
        alpha = 2.0 / (span + 1.0)
        ema = np.empty_like(prices, dtype=np.float64)
        ema[0] = prices[0]
        for i in range(1, len(prices)):
            ema[i] = alpha * prices[i] + (1.0 - alpha) * ema[i - 1]
        return ema
