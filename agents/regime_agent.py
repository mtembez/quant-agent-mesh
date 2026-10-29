"""Market Regime Detection Agent analyzing volatility states and trend vectors."""

import numpy as np
from core.math import compute_log_returns
from core.models import MarketRegime


class RegimeDetectionAgent:
    """Classifies financial market into macro states (Bull, Bear, High Volatility, Mean Reverting)."""

    def __init__(self, high_vol_threshold: float = 0.32):
        self.high_vol_threshold = high_vol_threshold

    def detect_regime(self, close_prices: np.ndarray) -> MarketRegime:
        """Classify timeseries into discrete market regime state."""
        if len(close_prices) < 30:
            return MarketRegime.MEAN_REVERTING

        returns = compute_log_returns(close_prices)

        # Annualized volatility
        ann_vol = float(np.std(returns) * np.sqrt(252))

        if ann_vol >= self.high_vol_threshold:
            return MarketRegime.HIGH_VOLATILITY

        # Trend analysis using short vs long windows
        window_short = min(20, len(close_prices) // 2)
        window_long = min(60, len(close_prices))

        sma_short = float(np.mean(close_prices[-window_short:]))
        sma_long = float(np.mean(close_prices[-window_long:]))
        cumulative_return = (close_prices[-1] - close_prices[0]) / max(close_prices[0], 1e-9)

        if sma_short > sma_long and cumulative_return > 0.05:
            return MarketRegime.BULL_TREND
        elif sma_short < sma_long and cumulative_return < -0.05:
            return MarketRegime.BEAR_TREND
        else:
            return MarketRegime.MEAN_REVERTING
