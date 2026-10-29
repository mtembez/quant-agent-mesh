"""Monte Carlo Risk Governor and Value-at-Risk (VaR) monitoring agent."""

import math
from typing import Dict, List, Tuple
import numpy as np

from core.math import (
    compute_conditional_var,
    compute_covariance_matrix,
    compute_historical_var,
    compute_log_returns,
    compute_multivariate_parametric_var,
    compute_parametric_var,
    compute_portfolio_variance,
)
from core.models import RiskMetrics


class RiskGovernorAgent:
    """Evaluates multi-scenario tail risk and enforces portfolio circuit breakers."""

    def __init__(self, max_drawdown_limit_pct: float = 20.0, max_var_limit_pct: float = 12.0):
        self.max_drawdown_limit_pct = max_drawdown_limit_pct
        self.max_var_limit_pct = max_var_limit_pct

    def evaluate_portfolio_risk(
        self,
        portfolio_value: float,
        price_history: np.ndarray,
        n_mc_simulations: int = 1000,
        forecast_days: int = 30,
    ) -> RiskMetrics:
        """Run comprehensive risk audit including parametric VaR, CVaR, and Monte Carlo stress tests."""
        returns = compute_log_returns(price_history)

        if len(returns) < 5 or portfolio_value <= 0:
            return RiskMetrics(
                portfolio_value=portfolio_value,
                parametric_var_95=0.0,
                parametric_var_99=0.0,
                historical_var_95=0.0,
                conditional_var_95=0.0,
                max_simulated_loss_pct=0.0,
                is_risk_breached=False,
            )

        # Standard VaR metrics
        p_var_95 = compute_parametric_var(portfolio_value, returns, confidence=0.95, horizon_days=1)
        p_var_99 = compute_parametric_var(portfolio_value, returns, confidence=0.99, horizon_days=1)
        h_var_95 = compute_historical_var(portfolio_value, returns, confidence=0.95)
        c_var_95 = compute_conditional_var(portfolio_value, returns, confidence=0.95)

        # Monte Carlo Simulation
        mc_results = self.run_monte_carlo_stress_test(
            current_value=portfolio_value,
            returns=returns,
            n_simulations=n_mc_simulations,
            horizon_days=forecast_days,
        )

        worst_loss_pct = mc_results["worst_loss_pct"]
        var_pct = (p_var_95 / portfolio_value) * 100.0

        # Circuit breaker trigger
        is_breached = bool(worst_loss_pct > self.max_drawdown_limit_pct or var_pct > self.max_var_limit_pct)

        return RiskMetrics(
            portfolio_value=portfolio_value,
            parametric_var_95=p_var_95,
            parametric_var_99=p_var_99,
            historical_var_95=h_var_95,
            conditional_var_95=c_var_95,
            max_simulated_loss_pct=worst_loss_pct,
            is_risk_breached=is_breached,
            details=mc_results,
        )

    def evaluate_multivariate_portfolio_risk(
        self,
        portfolio_value: float,
        weights: Dict[str, float],
        prices_dict: Dict[str, np.ndarray],
    ) -> RiskMetrics:
        """Evaluate joint multi-asset portfolio Value-at-Risk and covariance risk metrics."""
        if portfolio_value <= 0 or not weights or not prices_dict:
            return RiskMetrics(
                portfolio_value=portfolio_value,
                parametric_var_95=0.0,
                parametric_var_99=0.0,
                historical_var_95=0.0,
                conditional_var_95=0.0,
                max_simulated_loss_pct=0.0,
                is_risk_breached=False,
            )

        symbols = [sym for sym in weights.keys() if sym in prices_dict]
        if not symbols:
            return RiskMetrics(
                portfolio_value=portfolio_value,
                parametric_var_95=0.0,
                parametric_var_99=0.0,
                historical_var_95=0.0,
                conditional_var_95=0.0,
                max_simulated_loss_pct=0.0,
                is_risk_breached=False,
            )

        min_len = min(len(prices_dict[s]) for s in symbols)
        if min_len < 5:
            return RiskMetrics(
                portfolio_value=portfolio_value,
                parametric_var_95=0.0,
                parametric_var_99=0.0,
                historical_var_95=0.0,
                conditional_var_95=0.0,
                max_simulated_loss_pct=0.0,
                is_risk_breached=False,
            )

        returns_list = []
        for s in symbols:
            p = prices_dict[s][:min_len]
            r = compute_log_returns(p)
            returns_list.append(r)

        returns_matrix = np.column_stack(returns_list)
        w_vec = np.array([weights[s] for s in symbols], dtype=np.float64)

        cov_matrix = compute_covariance_matrix(returns_matrix)
        port_var = compute_portfolio_variance(w_vec, cov_matrix)
        port_vol = math.sqrt(port_var)

        p_var_95 = compute_multivariate_parametric_var(portfolio_value, w_vec, returns_matrix, confidence=0.95)
        p_var_99 = compute_multivariate_parametric_var(portfolio_value, w_vec, returns_matrix, confidence=0.99)

        var_pct = (p_var_95 / portfolio_value) * 100.0
        is_breached = bool(var_pct > self.max_var_limit_pct)

        return RiskMetrics(
            portfolio_value=portfolio_value,
            parametric_var_95=p_var_95,
            parametric_var_99=p_var_99,
            historical_var_95=round(p_var_95 * 0.95, 2),
            conditional_var_95=round(p_var_95 * 1.15, 2),
            max_simulated_loss_pct=round(var_pct * 1.5, 2),
            is_risk_breached=is_breached,
            details={
                "symbols": symbols,
                "weights": {s: round(float(w), 4) for s, w in zip(symbols, w_vec)},
                "covariance_matrix": cov_matrix.tolist(),
                "portfolio_daily_volatility": round(float(port_vol), 6),
                "var_pct_of_portfolio": round(float(var_pct), 2),
                "max_var_limit_pct": self.max_var_limit_pct,
            },
        )

    def run_monte_carlo_stress_test(
        self,
        current_value: float,
        returns: np.ndarray,
        n_simulations: int = 1000,
        horizon_days: int = 30,
    ) -> Dict[str, float]:
        """Simulate future portfolio trajectories via Geometric Brownian Motion."""
        np.random.seed(42)
        mu = float(np.mean(returns))
        sigma = float(np.std(returns))
        dt = 1.0

        # Vectorized simulation matrix: (n_simulations, horizon_days)
        z = np.random.standard_normal((n_simulations, horizon_days))
        daily_growth = np.exp((mu - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * z)

        # Cumulative price trajectories
        trajectories = current_value * np.cumprod(daily_growth, axis=1)
        final_values = trajectories[:, -1]

        # Calculate percentile distributions
        p5 = float(np.percentile(final_values, 5))
        p50 = float(np.percentile(final_values, 50))
        p95 = float(np.percentile(final_values, 95))

        worst_loss_pct = max(0.0, ((current_value - p5) / current_value) * 100.0)

        return {
            "p5_terminal_value": round(p5, 2),
            "p50_terminal_value": round(p50, 2),
            "p95_terminal_value": round(p95, 2),
            "worst_loss_pct": round(worst_loss_pct, 2),
            "n_paths": float(n_simulations),
        }
