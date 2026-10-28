"""Domain models and entity schemas for Quant Agent Mesh."""

from enum import Enum
import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    FILLED = "FILLED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class MarketRegime(str, Enum):
    BULL_TREND = "BULL_TREND"
    BEAR_TREND = "BEAR_TREND"
    MEAN_REVERTING = "MEAN_REVERTING"
    HIGH_VOLATILITY = "HIGH_VOLATILITY"


class Candle(BaseModel):
    timestamp: float
    open: float
    high: float
    low: float
    close: float
    volume: float = 1000.0


class Order(BaseModel):
    order_id: str
    symbol: str
    side: OrderSide
    order_type: OrderType = OrderType.MARKET
    quantity: float
    limit_price: Optional[float] = None
    status: OrderStatus = OrderStatus.PENDING
    filled_price: Optional[float] = None
    filled_at: Optional[float] = None
    slippage: float = 0.0
    created_at: float = Field(default_factory=time.time)


class Position(BaseModel):
    symbol: str
    quantity: float
    entry_price: float
    current_price: float
    unrealized_pnl: float = 0.0
    realized_pnl: float = 0.0


class BacktestResult(BaseModel):
    strategy_name: str
    symbol: str
    total_return_pct: float
    cagr_pct: float
    annualized_sharpe: float
    sortino_ratio: float
    max_drawdown_pct: float
    calmar_ratio: float
    win_rate_pct: float
    total_trades: int
    equity_curve: List[float] = Field(default_factory=list)


class RiskMetrics(BaseModel):
    portfolio_value: float
    parametric_var_95: float
    parametric_var_99: float
    historical_var_95: float
    conditional_var_95: float
    max_simulated_loss_pct: float
    is_risk_breached: bool = False
    details: Dict[str, Any] = Field(default_factory=dict)


class Portfolio(BaseModel):
    cash: float
    initial_capital: float
    positions: Dict[str, Position] = Field(default_factory=dict)
    equity: float
    total_pnl: float = 0.0
