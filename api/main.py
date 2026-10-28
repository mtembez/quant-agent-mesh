"""High-performance Starlette ASGI backend for Quant Agent Mesh."""

from typing import List
import numpy as np
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse
from starlette.routing import Route, WebSocketRoute
from starlette.websockets import WebSocket, WebSocketDisconnect

from core.data_feed import extract_ohlcv_arrays, generate_synthetic_gbm
from core.models import OrderSide, OrderType
from core.swarm import QuantSwarmCoordinator

coordinator = QuantSwarmCoordinator()
connected_websockets: List[WebSocket] = []


async def health_live(request: Request):
    return JSONResponse({"status": "UP"})


async def health_ready(request: Request):
    return JSONResponse({"status": "READY", "version": "1.0.0"})


async def get_metrics(request: Request):
    """Expose standard Prometheus metrics format."""
    equity = coordinator.execution_engine.portfolio.equity
    pnl = coordinator.execution_engine.portfolio.total_pnl
    positions_count = len(coordinator.execution_engine.portfolio.positions)
    top_sharpe = 0.0
    if coordinator.strategy_registry:
        top_sharpe = max(s.annualized_sharpe for s in coordinator.strategy_registry.values())
    var_95 = coordinator.latest_risk.parametric_var_95 if coordinator.latest_risk else 0.0

    lines = [
        "# HELP quant_portfolio_equity Current marked-to-market equity of quant portfolio",
        "# TYPE quant_portfolio_equity gauge",
        f"quant_portfolio_equity {equity}",
        "# HELP quant_portfolio_pnl Total realized and unrealized profit and loss",
        "# TYPE quant_portfolio_pnl gauge",
        f"quant_portfolio_pnl {pnl}",
        "# HELP quant_active_positions Number of open asset positions",
        "# TYPE quant_active_positions gauge",
        f"quant_active_positions {positions_count}",
        "# HELP quant_top_strategy_sharpe Annualized Sharpe ratio of top-performing alpha strategy",
        "# TYPE quant_top_strategy_sharpe gauge",
        f"quant_top_strategy_sharpe {top_sharpe}",
        "# HELP quant_var_95 Parametric 95 percent Value-at-Risk",
        "# TYPE quant_var_95 gauge",
        f"quant_var_95 {var_95}",
    ]
    return PlainTextResponse("\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")


async def list_strategies(request: Request):
    """List evaluated alpha strategies."""
    if not coordinator.strategy_registry:
        coordinator.run_full_research_cycle()
    results = [s.model_dump(mode="json") for s in coordinator.strategy_registry.values()]
    return JSONResponse(results)


async def trigger_research_cycle(request: Request):
    """Trigger complete autonomous quantitative research, backtesting, and risk audit."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    symbol = body.get("symbol", "ETH/USD")
    n_bars = int(body.get("n_bars", 350))
    report = coordinator.run_full_research_cycle(symbol=symbol, n_bars=n_bars)
    return JSONResponse(report)


async def execute_backtest_endpoint(request: Request):
    """Execute standalone strategy backtest."""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

    strat_name = body.get("strategy", "bollinger").lower()
    symbol = body.get("symbol", "BTC/USD")
    n_bars = int(body.get("n_bars", 300))

    candles = generate_synthetic_gbm(initial_price=100.0, n_bars=n_bars)
    prices = extract_ohlcv_arrays(candles)["close"]

    if "bollinger" in strat_name:
        window = int(body.get("window", 20))
        num_std = float(body.get("num_std", 2.0))
        signals = coordinator.alpha_agent.generate_bollinger_signals(prices, window, num_std)
        label = f"Bollinger ({window}, {num_std})"
    elif "ema" in strat_name:
        fast = int(body.get("fast", 12))
        slow = int(body.get("slow", 26))
        signals = coordinator.alpha_agent.generate_ema_cross_signals(prices, fast, slow)
        label = f"EMA Cross ({fast}/{slow})"
    else:
        period = int(body.get("period", 14))
        signals = coordinator.alpha_agent.generate_rsi_signals(prices, period=period)
        label = f"RSI Momentum ({period})"

    res = coordinator.backtest_agent.run_backtest(label, symbol, prices, signals)
    coordinator.strategy_registry[res.strategy_name] = res
    return JSONResponse(res.model_dump(mode="json"))


async def submit_order_endpoint(request: Request):
    """Submit simulated paper execution order."""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

    symbol = body.get("symbol", "BTC/USD")
    side_str = body.get("side", "BUY").upper()
    side = OrderSide.BUY if side_str == "BUY" else OrderSide.SELL
    qty = float(body.get("quantity", 1.0))
    price = float(body.get("market_price", 100.0))

    order = coordinator.execution_engine.submit_order(
        symbol=symbol,
        side=side,
        quantity=qty,
        market_price=price,
    )
    return JSONResponse(order.model_dump(mode="json"))


async def get_portfolio_endpoint(request: Request):
    """Retrieve marked-to-market portfolio balance and open positions."""
    return JSONResponse(coordinator.execution_engine.portfolio.model_dump(mode="json"))


async def websocket_market_feed(websocket: WebSocket):
    """Real-time WebSocket streaming tick data and order fills."""
    await websocket.accept()
    connected_websockets.append(websocket)
    try:
        await websocket.send_json({"type": "SNAPSHOT", "portfolio": coordinator.execution_engine.portfolio.model_dump(mode="json")})
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
            elif data == "poll":
                await websocket.send_json({"type": "UPDATE", "portfolio": coordinator.execution_engine.portfolio.model_dump(mode="json")})
    except WebSocketDisconnect:
        if websocket in connected_websockets:
            connected_websockets.remove(websocket)


routes = [
    Route("/health/live", health_live, methods=["GET"]),
    Route("/health/ready", health_ready, methods=["GET"]),
    Route("/metrics", get_metrics, methods=["GET"]),
    Route("/api/v1/strategies", list_strategies, methods=["GET"]),
    Route("/api/v1/research", trigger_research_cycle, methods=["POST"]),
    Route("/api/v1/backtest", execute_backtest_endpoint, methods=["POST"]),
    Route("/api/v1/orders", submit_order_endpoint, methods=["POST"]),
    Route("/api/v1/portfolio", get_portfolio_endpoint, methods=["GET"]),
    WebSocketRoute("/ws/market-feed", websocket_market_feed),
]

middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
]

app = Starlette(routes=routes, middleware=middleware)
