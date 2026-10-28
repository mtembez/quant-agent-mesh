"""Vectorized financial mathematics library for portfolio analytics and risk governance."""

import math
from typing import Tuple
import numpy as np


def compute_log_returns(prices: np.ndarray) -> np.ndarray:
    """Compute logarithmic returns from price series: r_t = ln(P_t / P_{t-1})."""
    if len(prices) < 2:
        return np.array([], dtype=np.float64)
    prices = np.asarray(prices, dtype=np.float64)
    # Avoid zero division
    valid_mask = prices[:-1] > 0
    returns = np.zeros(len(prices) - 1, dtype=np.float64)
    returns[valid_mask] = np.log(prices[1:][valid_mask] / prices[:-1][valid_mask])
    return returns


def compute_annualized_sharpe(returns: np.ndarray, risk_free_rate: float = 0.02, periods_per_year: int = 252) -> float:
    """Compute annualized Sharpe ratio using zero-loop vectorized statistics."""
    if len(returns) < 2:
        return 0.0
    rf_per_period = risk_free_rate / periods_per_year
    excess_returns = returns - rf_per_period
    std = float(np.std(excess_returns))
    if std == 0.0 or math.isnan(std):
        return 0.0
    mean_excess = float(np.mean(excess_returns))
    sharpe = (mean_excess / std) * math.sqrt(periods_per_year)
    return round(float(sharpe), 4)


def compute_sortino_ratio(returns: np.ndarray, target_return: float = 0.0, periods_per_year: int = 252) -> float:
    """Compute Sortino ratio penalizing only downside volatility below target."""
    if len(returns) < 2:
        return 0.0
    downside_diff = np.minimum(0.0, returns - target_return)
    downside_variance = np.mean(np.square(downside_diff))
    downside_std = math.sqrt(float(downside_variance))
    if downside_std == 0.0:
        return 0.0
    mean_return = float(np.mean(returns - target_return))
    sortino = (mean_return / downside_std) * math.sqrt(periods_per_year)
    return round(float(sortino), 4)


def compute_max_drawdown(equity_curve: np.ndarray) -> Tuple[float, int, int]:
    """Calculate maximum peak-to-trough decline, returning (max_dd_pct, peak_idx, trough_idx)."""
    if len(equity_curve) < 2:
        return 0.0, 0, 0
    curve = np.asarray(equity_curve, dtype=np.float64)
    running_max = np.maximum.accumulate(curve)
    drawdowns = (running_max - curve) / np.maximum(running_max, 1e-9)

    max_dd_idx = int(np.argmax(drawdowns))
    max_dd = float(drawdowns[max_dd_idx])

    if max_dd_idx == 0:
        return 0.0, 0, 0

    peak_idx = int(np.argmax(curve[:max_dd_idx + 1]))
    return round(float(max_dd * 100.0), 2), peak_idx, max_dd_idx


def compute_calmar_ratio(cagr_pct: float, max_drawdown_pct: float) -> float:
    """Compute Calmar Ratio = CAGR / Max Drawdown."""
    if max_drawdown_pct <= 0.0:
        return round(float(cagr_pct), 2) if cagr_pct > 0 else 0.0
    return round(float(cagr_pct / max_drawdown_pct), 2)


def compute_parametric_var(portfolio_value: float, returns: np.ndarray, confidence: float = 0.95, horizon_days: int = 1) -> float:
    """Parametric Value-at-Risk under normal distribution assumption."""
    if len(returns) < 2 or portfolio_value <= 0:
        return 0.0
    # Inverse normal CDF approximations: 95% -> 1.6449, 99% -> 2.3263
    z_score = 1.6449 if confidence <= 0.95 else 2.3263
    std = float(np.std(returns))
    var = portfolio_value * z_score * std * math.sqrt(horizon_days)
    return round(float(var), 2)


def compute_historical_var(portfolio_value: float, returns: np.ndarray, confidence: float = 0.95) -> float:
    """Historical Value-at-Risk taking the empirical percentile of historical losses."""
    if len(returns) < 2 or portfolio_value <= 0:
        return 0.0
    percentile_rank = (1.0 - confidence) * 100.0
    cutoff_return = float(np.percentile(returns, percentile_rank))
    var = -portfolio_value * cutoff_return if cutoff_return < 0 else 0.0
    return round(float(var), 2)


def compute_conditional_var(portfolio_value: float, returns: np.ndarray, confidence: float = 0.95) -> float:
    """Conditional Value-at-Risk (Expected Shortfall): average loss beyond the VaR threshold."""
    if len(returns) < 2 or portfolio_value <= 0:
        return 0.0
    percentile_rank = (1.0 - confidence) * 100.0
    cutoff_return = float(np.percentile(returns, percentile_rank))
    tail_losses = returns[returns <= cutoff_return]
    if len(tail_losses) == 0:
        return 0.0
    expected_tail_return = float(np.mean(tail_losses))
    cvar = -portfolio_value * expected_tail_return if expected_tail_return < 0 else 0.0
    return round(float(cvar), 2)
