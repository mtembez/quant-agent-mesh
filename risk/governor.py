"""Monte Carlo Risk Governor and Value-at-Risk (VaR) monitoring agent."""

import math
from typing import Any, Dict, List, Tuple
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
        run_monte_carlo: bool = False,
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

        details_dict: Dict[str, Any] = {
            "symbols": symbols,
            "weights": {s: round(float(w), 4) for s, w in zip(symbols, w_vec)},
            "covariance_matrix": cov_matrix.tolist(),
            "portfolio_daily_volatility": round(float(port_vol), 6),
            "var_pct_of_portfolio": round(float(var_pct), 2),
            "max_var_limit_pct": self.max_var_limit_pct,
        }

        # Run Cholesky-correlated multi-asset Monte Carlo if requested
        worst_loss_pct = round(var_pct * 1.5, 2)
        if run_monte_carlo:
            curr_prices = {s: float(prices_dict[s][-1]) for s in symbols}
            # Approximate quantities from notional weights: qty_i = (portfolio_value * w_i) / P_i
            quantities = {s: (portfolio_value * weights.get(s, 0.0)) / max(1e-9, curr_prices[s]) for s in symbols}
            cash = max(0.0, portfolio_value * (1.0 - sum(weights.values())))

            mc = self.run_multivariate_monte_carlo(
                current_cash=cash,
                quantities=quantities,
                current_prices=curr_prices,
                cov_matrix=cov_matrix,
                symbols=symbols,
            )
            details_dict["monte_carlo"] = mc
            worst_loss_pct = mc.get("worst_loss_pct", worst_loss_pct)
            if mc.get("circuit_breaker_tripped", False):
                is_breached = True

        return RiskMetrics(
            portfolio_value=portfolio_value,
            parametric_var_95=p_var_95,
            parametric_var_99=p_var_99,
            historical_var_95=round(p_var_95 * 0.95, 2),
            conditional_var_95=round(p_var_95 * 1.15, 2),
            max_simulated_loss_pct=worst_loss_pct,
            is_risk_breached=is_breached,
            details=details_dict,
        )

    def run_multivariate_monte_carlo(
        self,
        current_cash: float,
        quantities: Dict[str, float],
        current_prices: Dict[str, float],
        cov_matrix: np.ndarray,
        symbols: List[str],
        n_simulations: int = 1000,
        horizon_days: int = 30,
        seed: int = 42,
    ) -> Dict[str, Any]:
        """Run multivariate Monte Carlo simulation preserving cross-asset correlations via Cholesky factorization."""
        np.random.seed(seed)
        k = len(symbols)
        if k == 0:
            return {}

        cov = np.asarray(cov_matrix, dtype=np.float64)
        if cov.shape != (k, k):
            cov = np.eye(k, dtype=np.float64) * 0.0004

        # Guarantee positive-definiteness for Cholesky decomposition
        eigs = np.linalg.eigvalsh(cov)
        if (eigs <= 1e-8).any():
            cov = cov + (1e-6 * np.eye(k, dtype=np.float64))

        L = np.linalg.cholesky(cov)

        initial_equity = float(current_cash + sum(quantities.get(s, 0.0) * current_prices.get(s, 0.0) for s in symbols))
        initial_p = np.array([current_prices[s] for s in symbols], dtype=np.float64)
        q_vec = np.array([quantities.get(s, 0.0) for s in symbols], dtype=np.float64)
        diag_vars = np.diag(cov)

        # Correlated Brownian shocks: Z_corr = Z_uncorr @ L^T
        z_uncorr = np.random.standard_normal((n_simulations, horizon_days, k))
        z_corr = np.matmul(z_uncorr, L.T)

        # Multi-asset price paths under Geometric Brownian Motion
        log_steps = (-0.5 * diag_vars) + z_corr
        cum_log_steps = np.cumsum(log_steps, axis=1)
        sim_prices = initial_p * np.exp(cum_log_steps)

        # Portfolio equity trajectory
        sim_equities = current_cash + np.dot(sim_prices, q_vec)
        terminal_equities = sim_equities[:, -1]

        # Max drawdown across paths
        full_equities = np.column_stack([np.full(n_simulations, initial_equity), sim_equities])
        running_max = np.maximum.accumulate(full_equities, axis=1)
        drawdowns = (running_max - full_equities) / np.maximum(running_max, 1e-9)
        max_dds_per_sim = np.max(drawdowns, axis=1)
        worst_loss_pct = float(np.max(max_dds_per_sim) * 100.0)

        # Tail percentiles
        p5_equity = float(np.percentile(terminal_equities, 5.0))
        p1_equity = float(np.percentile(terminal_equities, 1.0))
        sim_var_95 = max(0.0, float(initial_equity - p5_equity))
        sim_var_99 = max(0.0, float(initial_equity - p1_equity))

        var_pct = (sim_var_95 / max(1e-9, initial_equity)) * 100.0
        circuit_breaker = bool(
            worst_loss_pct >= self.max_drawdown_limit_pct
            or var_pct >= self.max_var_limit_pct
        )

        terminal_prices_dict = {
            symbols[j]: sim_prices[:, -1, j].tolist() for j in range(k)
        }

        return {
            "n_simulations": n_simulations,
            "horizon_days": horizon_days,
            "initial_portfolio_value": round(initial_equity, 2),
            "expected_terminal_equity": round(float(np.mean(terminal_equities)), 2),
            "median_terminal_equity": round(float(np.median(terminal_equities)), 2),
            "percentile_5_terminal_equity": round(p5_equity, 2),
            "percentile_1_terminal_equity": round(p1_equity, 2),
            "simulated_var_95": round(sim_var_95, 2),
            "simulated_var_99": round(sim_var_99, 2),
            "worst_loss_pct": round(worst_loss_pct, 2),
            "circuit_breaker_tripped": circuit_breaker,
            "terminal_asset_prices": terminal_prices_dict,
        }

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
