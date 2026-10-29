"""Unit tests for Asset-Aware Execution Engine and Pip Precision (User Story 8.2)."""

import pytest
from core.models import OrderSide, OrderStatus, OrderType
from execution.engine import PaperExecutionEngine


def test_jpy_usd_pip_precision_and_fill():
    """Verify US-8.2: JPY/USD fills maintain 6-decimal sub-pip precision without float truncation."""
    engine = PaperExecutionEngine(initial_capital=100000.0, slippage_bps=5.0)

    # 1 standard lot = 100,000 JPY units
    market_price = 0.006500  # Equivalent to USD/JPY ~ 153.84
    order = engine.submit_order(
        symbol="JPY/USD",
        side=OrderSide.BUY,
        quantity=100000.0,
        order_type=OrderType.MARKET,
        market_price=market_price,
    )

    assert order.status == OrderStatus.FILLED
    # Filled price MUST maintain 6 decimal places (not rounded to 0.01 or 0.00)
    assert order.filled_price is not None
    assert round(order.filled_price, 2) != order.filled_price, "Price was erroneously truncated to 2 decimals"
    assert 0.006490 < order.filled_price < 0.006520

    # Total cost should be quantity * fill_price (~$650.33 USD)
    expected_cost = 100000.0 * order.filled_price
    assert abs((100000.0 - engine.portfolio.cash) - expected_cost) < 1e-4

    # Position in portfolio must preserve high-precision entry price
    pos = engine.portfolio.positions["JPY/USD"]
    assert pos.quantity == 100000.0
    assert pos.entry_price == order.filled_price

    # Mark to market: price rises by 15 pips (+0.000015) to 0.006515
    new_price = 0.006515
    engine.mark_to_market({"JPY/USD": new_price})
    pos = engine.portfolio.positions["JPY/USD"]
    expected_pnl = (new_price - pos.entry_price) * 100000.0
    assert abs(pos.unrealized_pnl - expected_pnl) < 1e-4
    assert engine.portfolio.equity == engine.portfolio.cash + (100000.0 * new_price)


def test_xau_usd_gold_execution_and_mtm():
    """Verify US-8.2: XAU/USD gold order fill with 2-decimal cent precision and PnL revaluation."""
    engine = PaperExecutionEngine(initial_capital=100000.0, slippage_bps=2.0)

    # Buy 10 troy ounces of Gold at $2,700.00
    market_price = 2700.00
    order = engine.submit_order(
        symbol="XAU/USD",
        side=OrderSide.BUY,
        quantity=10.0,
        market_price=market_price,
    )

    assert order.status == OrderStatus.FILLED
    assert 2700.00 <= order.filled_price <= 2701.00
    assert engine.portfolio.positions["XAU/USD"].quantity == 10.0

    # Gold drops by $20 to $2,680.00
    engine.mark_to_market({"XAU/USD": 2680.00})
    pos = engine.portfolio.positions["XAU/USD"]
    # Unrealized PnL should be around -10 * ($2700 - $2680) ~ -$200
    assert pos.unrealized_pnl < -190.0


def test_multi_asset_portfolio_revaluation_and_notional_weights():
    """Verify US-8.2: Revaluation across mixed-asset portfolio (Crypto, Gold, FX, Cash)."""
    engine = PaperExecutionEngine(initial_capital=100000.0, slippage_bps=0.0)

    # 1. Buy 0.5 BTC at $60,000 = $30,000
    engine.submit_order(symbol="BTC/USD", side=OrderSide.BUY, quantity=0.5, market_price=60000.0)
    # 2. Buy 10 oz Gold at $2,700 = $27,000
    engine.submit_order(symbol="XAU/USD", side=OrderSide.BUY, quantity=10.0, market_price=2700.0)
    # 3. Buy 2,000,000 JPY at 0.0065 = $13,000
    engine.submit_order(symbol="JPY/USD", side=OrderSide.BUY, quantity=2000000.0, market_price=0.0065)

    # Total deployed = $70,000; Remaining cash = $30,000
    assert abs(engine.portfolio.cash - 30000.0) < 1.0

    # Mark to market with current prices
    current_prices = {
        "BTC/USD": 62000.0,   # +$1,000 PnL (0.5 * 2000)
        "XAU/USD": 2750.0,    # +$500 PnL (10 * 50)
        "JPY/USD": 0.0066,    # +$200 PnL (2,000,000 * 0.0001)
    }
    engine.mark_to_market(current_prices)

    # Equity should be Cash ($30,000) + $31,000 + $27,500 + $13,200 = $101,700
    assert abs(engine.portfolio.equity - 101700.0) < 1.0
    assert abs(engine.portfolio.total_pnl - 1700.0) < 1.0

    # Get notional normalized USD weights
    weights = engine.get_normalized_portfolio_weights(current_prices)
    assert "BTC/USD" in weights and "XAU/USD" in weights and "JPY/USD" in weights
    assert sum(weights.values()) <= 1.0  # Sum of asset weights <= 1 (rest is cash)
    assert abs(weights["BTC/USD"] - (31000.0 / 101700.0)) < 1e-3
