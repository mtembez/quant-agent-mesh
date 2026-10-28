"""Vectorized backtesting engine executing matrix simulations with zero lookahead bias."""

from typing import Dict, List
import numpy as np

from core.math import (
    compute_annualized_sharpe,
    compute_calmar_ratio,
    compute_log_returns,
    compute_max_drawdown,
    compute_sortino_ratio,
)
from core.models import BacktestResult


class VectorizedBacktestAgent:
    """High-throughput vectorized backtesting engine with realistic transaction costs."""

    def __init__(self, initial_capital: float = 100000.0, transaction_cost_bps: float = 5.0):
        self.initial_capital = initial_capital
        self.transaction_cost_pct = transaction_cost_bps / 10000.0

    def run_backtest(
        self,
        strategy_name: str,
        symbol: str,
        prices: np.ndarray,
        signals: np.ndarray,
    ) -> BacktestResult:
        """Run vectorized portfolio simulation over price and signal arrays."""
        n = len(prices)
        if n < 2 or len(signals) != n:
            return BacktestResult(
                strategy_name=strategy_name,
                symbol=symbol,
                total_return_pct=0.0,
                cagr_pct=0.0,
                annualized_sharpe=0.0,
                sortino_ratio=0.0,
                max_drawdown_pct=0.0,
                calmar_ratio=0.0,
                win_rate_pct=0.0,
                total_trades=0,
                equity_curve=[self.initial_capital],
            )

        # Shift signals by 1 bar to strictly eliminate lookahead bias (execute at next bar)
        positions = np.zeros(n, dtype=np.float64)
        positions[1:] = signals[:-1]

        # Calculate asset returns
        asset_returns = np.zeros(n, dtype=np.float64)
        asset_returns[1:] = (prices[1:] - prices[:-1]) / np.maximum(prices[:-1], 1e-9)

        # Detect trade transitions for transaction cost deduction
        position_changes = np.abs(np.diff(np.insert(positions, 0, 0.0)))
        trade_costs = position_changes * self.transaction_cost_pct

        # Strategy returns per period
        strategy_returns = (positions * asset_returns) - trade_costs

        # Compute equity curve
        equity_curve = self.initial_capital * np.cumprod(1.0 + strategy_returns)
        total_return_pct = round(float(((equity_curve[-1] - self.initial_capital) / self.initial_capital) * 100.0), 2)

        # Calculate CAGR (assuming 252 bars per year)
        years = max(1.0 / 252.0, n / 252.0)
        cagr = ((equity_curve[-1] / self.initial_capital) ** (1.0 / years) - 1.0) * 100.0
        cagr_pct = round(float(cagr), 2)

        # Metrics
        sharpe = compute_annualized_sharpe(strategy_returns)
        sortino = compute_sortino_ratio(strategy_returns)
        mdd_pct, _, _ = compute_max_drawdown(equity_curve)
        calmar = compute_calmar_ratio(cagr_pct, mdd_pct)

        # Trades & Win Rate
        trades = np.count_nonzero(position_changes)
        active_periods = strategy_returns[positions != 0]
        winning_periods = np.count_nonzero(active_periods > 0)
        win_rate = (winning_periods / max(1, len(active_periods))) * 100.0

        return BacktestResult(
            strategy_name=strategy_name,
            symbol=symbol,
            total_return_pct=total_return_pct,
            cagr_pct=cagr_pct,
            annualized_sharpe=sharpe,
            sortino_ratio=sortino,
            max_drawdown_pct=mdd_pct,
            calmar_ratio=calmar,
            win_rate_pct=round(float(win_rate), 2),
            total_trades=int(trades),
            equity_curve=[round(float(v), 2) for v in equity_curve.tolist()],
        )
