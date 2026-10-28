"""Statistical Arbitrage engine: Ornstein-Uhlenbeck mean-reversion modeling and Kalman Filter dynamic hedge ratios."""

import math
from typing import Dict, List, Tuple
import numpy as np
from pydantic import BaseModel, Field


class PairsAnalysisResult(BaseModel):
    symbol_a: str
    symbol_b: str
    hedge_ratio_beta: float
    ou_theta: float
    ou_mu: float
    ou_half_life_days: float
    current_spread: float
    current_z_score: float
    spread_series: List[float] = Field(default_factory=list)
    z_score_series: List[float] = Field(default_factory=list)
    signals: List[int] = Field(default_factory=list)


class DynamicKalmanFilter:
    """Online 1D Kalman Filter tracking time-varying hedge ratio beta_t between cointegrated assets."""

    def __init__(self, delta: float = 1e-4, initial_r: float = 1e-3):
        self.delta = delta
        self.r = initial_r
        self.beta = 1.0  # Initial state estimate
        self.p = 1.0     # Initial error covariance

    def update(self, price_a: float, price_b: float) -> float:
        """Run predict and update steps for measurement P_A = beta * P_B + v."""
        # Predict step: State remains same, covariance grows by process noise
        p_pred = self.p + self.delta

        # Measurement residual: y = P_A - H * beta where H = P_B
        h = price_b
        y = price_a - (h * self.beta)

        # Innovation covariance: S = H * P * H^T + R
        s = (h * p_pred * h) + self.r

        # Kalman gain: K = P * H^T / S
        k = (p_pred * h) / max(1e-9, s)

        # Update state and covariance
        self.beta = float(self.beta + (k * y))
        self.p = float((1.0 - k * h) * p_pred)

        return round(float(self.beta), 4)


class OrnsteinUhlenbeckEstimator:
    """Estimates mean-reversion parameters: dS_t = theta * (mu - S_t) dt + sigma dW_t."""

    def estimate_parameters(self, spread: np.ndarray, dt: float = 1.0 / 252.0) -> Tuple[float, float, float, float]:
        """Estimate theta, mu, sigma, and half-life via linear regression on S_t = a + b * S_{t-1} + e."""
        if len(spread) < 10:
            return 0.0, 0.0, 0.0, 0.0

        s_t = spread[1:]
        s_prev = spread[:-1]

        # Linear regression: s_t = a + b * s_prev
        poly = np.polyfit(s_prev, s_t, 1)
        b = float(poly[0])
        a = float(poly[1])

        # Avoid log of non-positive or unit-root b (non-mean-reverting)
        if b <= 0.0 or b >= 0.999:
            # Fallback if non-stationary
            theta = 0.001
            mu = float(np.mean(spread))
            half_life = 999.0
            sigma = float(np.std(spread))
            return theta, mu, sigma, half_life

        theta = -math.log(b) / dt
        mu = a / (1.0 - b)
        residuals = s_t - (a + b * s_prev)
        res_std = float(np.std(residuals))
        sigma = res_std * math.sqrt(2.0 * theta / max(1e-9, 1.0 - b**2))
        half_life = math.log(2.0) / max(1e-9, theta)

        return round(theta, 4), round(mu, 4), round(sigma, 4), round(half_life * 252.0, 2)


class StatisticalArbitrageEngine:
    """End-to-end pairs trading and statistical arbitrage processor."""

    def __init__(self):
        self.ou_estimator = OrnsteinUhlenbeckEstimator()

    def analyze_pair(
        self,
        symbol_a: str,
        symbol_b: str,
        prices_a: np.ndarray,
        prices_b: np.ndarray,
        z_threshold_entry: float = 2.0,
        z_threshold_exit: float = 0.5,
    ) -> PairsAnalysisResult:
        """Calculate dynamic hedge ratio, O-U parameters, Z-score spread, and trading signals."""
        n = min(len(prices_a), len(prices_b))
        prices_a = prices_a[:n]
        prices_b = prices_b[:n]

        # Calculate time-varying Kalman hedge ratio
        kalman = DynamicKalmanFilter()
        betas = np.zeros(n, dtype=np.float64)
        for i in range(n):
            betas[i] = kalman.update(prices_a[i], prices_b[i])

        final_beta = float(betas[-1])
        # Compute spread: S_t = P_{A,t} - beta * P_{B,t}
        spread = prices_a - (final_beta * prices_b)

        # Estimate Ornstein-Uhlenbeck parameters
        theta, mu, sigma, half_life_days = self.ou_estimator.estimate_parameters(spread)

        # Vectorized rolling Z-score
        rolling_mean = np.mean(spread)
        rolling_std = max(1e-6, float(np.std(spread)))
        z_scores = (spread - rolling_mean) / rolling_std

        # Signal generation: 1 = Long Spread (Long A, Short B), -1 = Short Spread, 0 = Flat
        signals = np.zeros(n, dtype=np.int8)
        current_pos = 0

        for i in range(n):
            z = z_scores[i]
            if current_pos == 0:
                if z < -z_threshold_entry:
                    current_pos = 1  # Oversold spread -> Long
                elif z > z_threshold_entry:
                    current_pos = -1 # Overbought spread -> Short
            elif current_pos == 1 and z >= -z_threshold_exit:
                current_pos = 0     # Mean reverted -> Exit
            elif current_pos == -1 and z <= z_threshold_exit:
                current_pos = 0     # Mean reverted -> Exit
            signals[i] = current_pos

        return PairsAnalysisResult(
            symbol_a=symbol_a,
            symbol_b=symbol_b,
            hedge_ratio_beta=round(final_beta, 4),
            ou_theta=theta,
            ou_mu=mu,
            ou_half_life_days=half_life_days,
            current_spread=round(float(spread[-1]), 4),
            current_z_score=round(float(z_scores[-1]), 4),
            spread_series=[round(float(x), 4) for x in spread.tolist()],
            z_score_series=[round(float(z), 4) for z in z_scores.tolist()],
            signals=[int(s) for s in signals.tolist()],
        )
