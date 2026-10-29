"""Event-driven paper execution engine with realistic order fills, slippage, and PnL accounting."""

import time
import uuid
from typing import Any, Dict, List, Optional
from core.data_feed import DEFAULT_ASSET_SPECS
from core.models import Order, OrderSide, OrderStatus, OrderType, Portfolio, Position


class PaperExecutionEngine:
    """Simulates realistic trade fills, bid-ask spreads, and portfolio accounting."""

    def __init__(
        self,
        initial_capital: float = 100000.0,
        slippage_bps: float = 5.0,
        asset_specs: Optional[Dict[str, Dict[str, Any]]] = None,
    ):
        self.initial_capital = initial_capital
        self.slippage_pct = slippage_bps / 10000.0
        self.asset_specs = asset_specs or DEFAULT_ASSET_SPECS
        self.portfolio = Portfolio(
            cash=initial_capital,
            initial_capital=initial_capital,
            positions={},
            equity=initial_capital,
            total_pnl=0.0,
        )
        self.orders: Dict[str, Order] = {}

    def submit_order(
        self,
        symbol: str,
        side: OrderSide,
        quantity: float,
        order_type: OrderType = OrderType.MARKET,
        limit_price: Optional[float] = None,
        market_price: float = 100.0,
    ) -> Order:
        """Submit and process a simulated paper order against the market price."""
        order_id = f"ord-{uuid.uuid4().hex[:8]}"
        order = Order(
            order_id=order_id,
            symbol=symbol,
            side=side,
            order_type=order_type,
            quantity=quantity,
            limit_price=limit_price,
            status=OrderStatus.PENDING,
        )
        self.orders[order_id] = order

        # Process fill
        return self._process_fill(order, market_price)

    def _process_fill(self, order: Order, market_price: float) -> Order:
        """Evaluate order fill criteria and update portfolio balance."""
        if order.order_type == OrderType.LIMIT and order.limit_price is not None:
            if order.side == OrderSide.BUY and market_price > order.limit_price:
                return order  # Remains PENDING
            elif order.side == OrderSide.SELL and market_price < order.limit_price:
                return order  # Remains PENDING

        # Apply slippage and asset-specific precision
        spec = self.asset_specs.get(order.symbol, {"pip_decimal": 2, "tick_size": 0.01})
        pip_dec = spec.get("pip_decimal", 2)

        slippage_mult = (1.0 + self.slippage_pct) if order.side == OrderSide.BUY else (1.0 - self.slippage_pct)
        fill_price = round(float(market_price * slippage_mult), pip_dec)
        total_cost = fill_price * order.quantity

        if order.side == OrderSide.BUY:
            if self.portfolio.cash < total_cost:
                order.status = OrderStatus.REJECTED
                return order

            self.portfolio.cash -= total_cost
            if order.symbol in self.portfolio.positions:
                pos = self.portfolio.positions[order.symbol]
                total_qty = pos.quantity + order.quantity
                new_entry = ((pos.quantity * pos.entry_price) + total_cost) / max(1e-9, total_qty)
                pos.quantity = total_qty
                pos.entry_price = round(new_entry, pip_dec)
                pos.current_price = fill_price
            else:
                self.portfolio.positions[order.symbol] = Position(
                    symbol=order.symbol,
                    quantity=order.quantity,
                    entry_price=fill_price,
                    current_price=fill_price,
                )
        elif order.side == OrderSide.SELL:
            current_pos = self.portfolio.positions.get(order.symbol)
            if not current_pos or current_pos.quantity < order.quantity:
                order.status = OrderStatus.REJECTED
                return order

            revenue = total_cost
            self.portfolio.cash += revenue
            realized_pnl = (fill_price - current_pos.entry_price) * order.quantity
            current_pos.realized_pnl += realized_pnl
            current_pos.quantity -= order.quantity

            if current_pos.quantity <= 0.0:
                del self.portfolio.positions[order.symbol]

        order.status = OrderStatus.FILLED
        order.filled_price = fill_price
        order.filled_at = time.time()
        order.slippage = round(float(abs(fill_price - market_price)), max(4, pip_dec))

        self.mark_to_market({order.symbol: fill_price})
        return order

    def mark_to_market(self, current_prices: Dict[str, float]):
        """Update unrealized PnL on open positions and total portfolio equity."""
        pos_equity = 0.0
        total_unrealized = 0.0
        total_realized = 0.0

        for sym, pos in self.portfolio.positions.items():
            if sym in current_prices:
                pos.current_price = current_prices[sym]
            pos.unrealized_pnl = float((pos.current_price - pos.entry_price) * pos.quantity)
            pos_equity += pos.current_price * pos.quantity
            total_unrealized += pos.unrealized_pnl
            total_realized += pos.realized_pnl

        self.portfolio.equity = float(self.portfolio.cash + pos_equity)
        self.portfolio.total_pnl = float(self.portfolio.equity - self.initial_capital)

    def get_normalized_portfolio_weights(self, current_prices: Dict[str, float]) -> Dict[str, float]:
        """Compute normalized notional USD weights for active portfolio positions."""
        self.mark_to_market(current_prices)
        total_equity = max(1e-9, self.portfolio.equity)
        weights: Dict[str, float] = {}

        for sym, pos in self.portfolio.positions.items():
            price = current_prices.get(sym, pos.current_price)
            notional_value = pos.quantity * price
            weights[sym] = float(notional_value / total_equity)

        return weights
