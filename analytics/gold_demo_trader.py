"""
Dedicated Demo Trade Execution Engine and Assessment Tracker for Spot Gold (XAU/USD).
Provides historical bar-level trade simulation, walk-forward lifecycle tracking (SL/TP triggers),
and institutional portfolio performance attribution.
"""

import time
import uuid
from typing import Any, Dict, List, Optional
import numpy as np
from pydantic import BaseModel, Field


class GoldDemoTrade(BaseModel):
    trade_id: str
    symbol: str = "XAU/USD"
    side: str  # "BUY" or "SELL"
    bar_index: int
    time_label: str
    entry_price: float
    quantity: float
    stop_loss: float
    take_profit: float
    current_price: float
    exit_price: Optional[float] = None
    exit_bar_index: Optional[int] = None
    exit_time_label: Optional[str] = None
    exit_reason: Optional[str] = None  # "TAKE_PROFIT", "STOP_LOSS", "MANUAL_CLOSE", "OPEN"
    status: str = "OPEN"  # "OPEN", "CLOSED_PROFIT", "CLOSED_LOSS"
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    return_pct: float = 0.0
    created_at: float = Field(default_factory=time.time)


class DemoTradeAssessment(BaseModel):
    total_trades: int = 0
    open_trades: int = 0
    closed_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate_pct: float = 0.0
    total_realized_pnl: float = 0.0
    total_unrealized_pnl: float = 0.0
    net_pnl: float = 0.0
    profit_factor: float = 0.0
    max_drawdown_dollars: float = 0.0
    max_drawdown_pct: float = 0.0
    average_trade_pnl: float = 0.0
    initial_demo_capital: float = 100.0
    current_equity: float = 100.0
    roi_pct: float = 0.0
    trades: List[GoldDemoTrade] = Field(default_factory=list)


class SpotGoldDemoTrader:
    """Manages demo trade entries, lifecycle resolution against historical candles, and performance metrics."""

    def __init__(self, initial_capital: float = 100.0, leverage: float = 200.0):
        self.initial_capital = initial_capital
        self.leverage = leverage
        self.trades: List[GoldDemoTrade] = []

    def set_account_params(self, capital: float, leverage: float = 200.0):
        """Update account capital baseline and leverage."""
        self.initial_capital = capital
        self.leverage = leverage

    def clear(self):
        """Reset all demo trades."""
        self.trades.clear()

    def place_trade(
        self,
        side: str,
        candles: List[Any],
        bar_index: Optional[int] = None,
        quantity: float = 1.0,
        custom_entry_price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
    ) -> GoldDemoTrade:
        """Place a demo trade at a specified historical candle or latest spot price and evaluate forward."""
        if not candles:
            raise ValueError("Candles array cannot be empty")

        n_bars = len(candles)
        if bar_index is None or bar_index < 0 or bar_index >= n_bars:
            bar_index = n_bars - 1

        candle = candles[bar_index]
        entry_px = custom_entry_price if custom_entry_price is not None else candle.close
        side_norm = side.upper()

        # Sensible dynamic defaults for SL/TP calibrated to account size
        if self.initial_capital <= 500.0:
            # $100 Micro Account: $2.00 stop distance ($2.00 max risk for 0.01 lot) and $5.00 target
            if stop_loss is None:
                stop_loss = round(entry_px - 2.0 if side_norm == "BUY" else entry_px + 2.0, 2)
            if take_profit is None:
                take_profit = round(entry_px + 5.0 if side_norm == "BUY" else entry_px - 5.0, 2)
        else:
            if stop_loss is None:
                stop_loss = round(entry_px * 0.985 if side_norm == "BUY" else entry_px * 1.015, 2)
            if take_profit is None:
                take_profit = round(entry_px * 1.03 if side_norm == "BUY" else entry_px * 0.97, 2)

        trade = GoldDemoTrade(
            trade_id=f"xau-{uuid.uuid4().hex[:6]}",
            symbol="XAU/USD",
            side=side_norm,
            bar_index=bar_index,
            time_label=candle.time_label,
            entry_price=round(float(entry_px), 2),
            quantity=round(float(quantity), 2),
            stop_loss=round(float(stop_loss), 2),
            take_profit=round(float(take_profit), 2),
            current_price=round(float(candles[-1].close), 2),
        )

        # Walk-forward simulation from bar_index + 1 to current bar
        self._evaluate_lifecycle(trade, candles)
        self.trades.append(trade)
        return trade

    def _evaluate_lifecycle(self, trade: GoldDemoTrade, candles: List[Any]):
        """Evaluate trade against subsequent candles to check for SL or TP hits."""
        if trade.status in ["CLOSED_PROFIT", "CLOSED_LOSS"] and trade.exit_reason in ["MANUAL_CLOSE", "TAKE_PROFIT", "STOP_LOSS", "TIME_EXPIRY"]:
            return

        n_bars = len(candles)
        start_idx = trade.bar_index + 1
        qty = trade.quantity
        entry_px = trade.entry_price

        trade.status = "OPEN"
        trade.exit_price = None
        trade.exit_bar_index = None
        trade.exit_time_label = None
        trade.exit_reason = None
        trade.realized_pnl = 0.0

        for k in range(start_idx, n_bars):
            c = candles[k]
            if trade.side == "BUY":
                # Check Stop Loss first (conservative risk check)
                if c.low <= trade.stop_loss:
                    trade.status = "CLOSED_LOSS"
                    trade.exit_price = trade.stop_loss
                    trade.exit_bar_index = k
                    trade.exit_time_label = c.time_label
                    trade.exit_reason = "STOP_LOSS"
                    trade.realized_pnl = round(float((trade.stop_loss - entry_px) * qty), 2)
                    trade.return_pct = round(float(((trade.stop_loss - entry_px) / entry_px) * 100.0), 2)
                    break
                elif c.high >= trade.take_profit:
                    trade.status = "CLOSED_PROFIT"
                    trade.exit_price = trade.take_profit
                    trade.exit_bar_index = k
                    trade.exit_time_label = c.time_label
                    trade.exit_reason = "TAKE_PROFIT"
                    trade.realized_pnl = round(float((trade.take_profit - entry_px) * qty), 2)
                    trade.return_pct = round(float(((trade.take_profit - entry_px) / entry_px) * 100.0), 2)
                    break
            elif trade.side == "SELL":
                # Check Stop Loss first (price rose above SL)
                if c.high >= trade.stop_loss:
                    trade.status = "CLOSED_LOSS"
                    trade.exit_price = trade.stop_loss
                    trade.exit_bar_index = k
                    trade.exit_time_label = c.time_label
                    trade.exit_reason = "STOP_LOSS"
                    trade.realized_pnl = round(float((entry_px - trade.stop_loss) * qty), 2)
                    trade.return_pct = round(float(((entry_px - trade.stop_loss) / entry_px) * 100.0), 2)
                    break
                elif c.low <= trade.take_profit:
                    trade.status = "CLOSED_PROFIT"
                    trade.exit_price = trade.take_profit
                    trade.exit_bar_index = k
                    trade.exit_time_label = c.time_label
                    trade.exit_reason = "TAKE_PROFIT"
                    trade.realized_pnl = round(float((entry_px - trade.take_profit) * qty), 2)
                    trade.return_pct = round(float(((entry_px - trade.take_profit) / entry_px) * 100.0), 2)
                    break

        # If trade remains open at current latest candle
        if trade.status == "OPEN":
            current_spot = candles[-1].close
            trade.current_price = round(float(current_spot), 2)
            if trade.side == "BUY":
                trade.unrealized_pnl = round(float((current_spot - entry_px) * qty), 2)
                trade.return_pct = round(float(((current_spot - entry_px) / entry_px) * 100.0), 2)
            else:
                trade.unrealized_pnl = round(float((entry_px - current_spot) * qty), 2)
                trade.return_pct = round(float(((entry_px - current_spot) / entry_px) * 100.0), 2)

    def close_trade(self, trade_id: str, candles: List[Any]) -> Optional[GoldDemoTrade]:
        """Manually close an open trade at current spot price."""
        if not candles:
            return None
        current_spot = candles[-1].close
        for t in self.trades:
            if t.trade_id == trade_id and t.status == "OPEN":
                t.status = "CLOSED_PROFIT" if t.unrealized_pnl >= 0 else "CLOSED_LOSS"
                t.exit_price = round(float(current_spot), 2)
                t.exit_bar_index = len(candles) - 1
                t.exit_time_label = candles[-1].time_label
                t.exit_reason = "MANUAL_CLOSE"
                t.realized_pnl = t.unrealized_pnl
                t.unrealized_pnl = 0.0
                return t
        return None

    def refresh_open_trades(self, candles: List[Any]):
        """Re-evaluate all registered trades against updated candle timeseries."""
        for t in self.trades:
            self._evaluate_lifecycle(t, candles)

    def simulate_strategy_signals(
        self,
        candles: List[Any],
        strategy_id: str = "ema",
        lot_size: float = 1.0,
    ) -> List[GoldDemoTrade]:
        """
        Auto-simulate placing demo trades at all active strategy signal transitions
        across the historical candle series. If strategy is 'confluence' or '100_trades',
        loads the 100 trades from the last 3 months real historical dataset.
        """
        if strategy_id in ["confluence", "confluence_100", "100_trades"]:
            return self.load_100_historical_trades(candles)

        self.clear()
        n_bars = len(candles)
        last_signal = 0

        for i in range(n_bars):
            sig = candles[i].active_signal
            # Detect transition to BUY or SELL
            if sig != 0 and sig != last_signal:
                side = "BUY" if sig == 1 else "SELL"
                px = candles[i].close
                # Set volatility-aligned SL (2%) and TP (4%)
                sl = px * 0.98 if side == "BUY" else px * 1.02
                tp = px * 1.04 if side == "BUY" else px * 0.96
                self.place_trade(
                    side=side,
                    candles=candles,
                    bar_index=i,
                    quantity=lot_size,
                    custom_entry_price=px,
                    stop_loss=sl,
                    take_profit=tp,
                )
                last_signal = sig

        return self.trades

    def load_100_historical_trades(self, candles: Optional[List[Any]] = None) -> List[GoldDemoTrade]:
        """
        Load and evaluate exactly 100 historical trades generated by the Multi-Signal
        Trend Confluence algorithm across the last 3 months of real Spot Gold (XAU/USD) data.
        """
        import os
        import json
        self.clear()
        json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "gold_100_trades.json")
        if not os.path.exists(json_path):
            return self.trades

        with open(json_path, "r") as f:
            data = json.load(f)

        raw_trades = data.get("confluence_100_trades", [])
        for idx, t in enumerate(raw_trades):
            side = t.get("side", "BUY")
            entry_px = float(t.get("entry_px", 4000.0))
            exit_px = float(t.get("exit_px", entry_px))
            pnl = float(t.get("pnl", 0.0))
            exit_reason = t.get("exit_reason", "TAKE_PROFIT" if pnl > 0 else "STOP_LOSS")
            status = "CLOSED_PROFIT" if pnl > 0 else "CLOSED_LOSS"
            ret_pct = round(((exit_px - entry_px) / entry_px * 100.0) if side == "BUY" else ((entry_px - exit_px) / entry_px * 100.0), 2)

            sl_est = round(entry_px - abs(pnl) if side == "BUY" else entry_px + abs(pnl), 2)
            tp_est = round(entry_px + abs(pnl) if side == "BUY" else entry_px - abs(pnl), 2)

            self.trades.append(GoldDemoTrade(
                trade_id=f"xau-100m-{idx+1:03d}",
                symbol="XAU/USD",
                side=side,
                bar_index=idx,
                time_label=t.get("dt", f"T-{100-idx}"),
                entry_price=entry_px,
                quantity=0.01,
                stop_loss=sl_est,
                take_profit=tp_est,
                current_price=exit_px,
                exit_price=exit_px,
                exit_bar_index=idx + t.get("duration_hours", 1),
                exit_time_label=t.get("dt", "Exit"),
                exit_reason=exit_reason,
                status=status,
                realized_pnl=pnl,
                unrealized_pnl=0.0,
                return_pct=ret_pct,
            ))
        return self.trades

    def get_assessment(self, candles: List[Any]) -> DemoTradeAssessment:
        """Compute full statistical and risk assessment of all placed demo trades."""
        self.refresh_open_trades(candles)

        total_trades = len(self.trades)
        if total_trades == 0:
            return DemoTradeAssessment(
                initial_demo_capital=self.initial_capital,
                current_equity=self.initial_capital,
            )

        open_trades = [t for t in self.trades if t.status == "OPEN"]
        closed_trades = [t for t in self.trades if t.status != "OPEN"]

        tot_realized = sum(t.realized_pnl for t in closed_trades)
        tot_unrealized = sum(t.unrealized_pnl for t in open_trades)
        net_pnl = tot_realized + tot_unrealized

        winning_trades = sum(1 for t in closed_trades if t.realized_pnl > 0)
        losing_trades = sum(1 for t in closed_trades if t.realized_pnl < 0)

        win_rate = (winning_trades / max(1, len(closed_trades))) * 100.0 if closed_trades else 0.0

        gross_profit = sum(t.realized_pnl for t in closed_trades if t.realized_pnl > 0)
        gross_loss = abs(sum(t.realized_pnl for t in closed_trades if t.realized_pnl < 0))
        profit_factor = round(gross_profit / max(1e-9, gross_loss), 2) if gross_loss > 0 else (99.9 if gross_profit > 0 else 0.0)

        # Equity curve & Max Drawdown computation
        equity = self.initial_capital
        peak_equity = equity
        max_dd_dollars = 0.0

        for t in closed_trades:
            equity += t.realized_pnl
            if equity > peak_equity:
                peak_equity = equity
            dd = peak_equity - equity
            if dd > max_dd_dollars:
                max_dd_dollars = dd

        max_dd_pct = (max_dd_dollars / max(1e-9, peak_equity)) * 100.0
        current_equity = self.initial_capital + net_pnl
        roi_pct = (net_pnl / self.initial_capital) * 100.0
        avg_trade_pnl = net_pnl / max(1, total_trades)

        return DemoTradeAssessment(
            total_trades=total_trades,
            open_trades=len(open_trades),
            closed_trades=len(closed_trades),
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate_pct=round(win_rate, 1),
            total_realized_pnl=round(tot_realized, 2),
            total_unrealized_pnl=round(tot_unrealized, 2),
            net_pnl=round(net_pnl, 2),
            profit_factor=profit_factor,
            max_drawdown_dollars=round(max_dd_dollars, 2),
            max_drawdown_pct=round(max_dd_pct, 2),
            average_trade_pnl=round(avg_trade_pnl, 2),
            initial_demo_capital=self.initial_capital,
            current_equity=round(current_equity, 2),
            roi_pct=round(roi_pct, 2),
            trades=list(self.trades),
        )
