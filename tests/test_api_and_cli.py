import sys
import pytest
from starlette.testclient import TestClient

import cli
from api.main import app, coordinator


@pytest.fixture
def client():
    return TestClient(app)


def test_api_health_and_metrics(client):
    res_live = client.get("/health/live")
    assert res_live.status_code == 200
    assert res_live.json()["status"] == "UP"

    res_ready = client.get("/health/ready")
    assert res_ready.status_code == 200
    assert res_ready.json()["status"] == "READY"

    res_metrics = client.get("/metrics")
    assert res_metrics.status_code == 200
    assert "quant_portfolio_equity" in res_metrics.text
    assert "quant_top_strategy_sharpe" in res_metrics.text


def test_api_strategies_and_research(client):
    # Trigger research cycle
    res_research = client.post("/api/v1/research", json={"symbol": "AVAX/USD", "n_bars": 100})
    assert res_research.status_code == 200
    data = res_research.json()
    assert data["symbol"] == "AVAX/USD"
    assert "top_strategy" in data

    # List strategies
    res_strats = client.get("/api/v1/strategies")
    assert res_strats.status_code == 200
    assert len(res_strats.json()) >= 3


def test_api_backtest_endpoint(client):
    payload = {"strategy": "bollinger", "symbol": "BTC/USD", "window": 15, "num_std": 2.0}
    res = client.post("/api/v1/backtest", json=payload)
    assert res.status_code == 200
    assert "annualized_sharpe" in res.json()

    # EMA strategy backtest
    payload_ema = {"strategy": "ema", "symbol": "ETH/USD", "fast": 10, "slow": 20}
    res_ema = client.post("/api/v1/backtest", json=payload_ema)
    assert res_ema.status_code == 200
    assert "annualized_sharpe" in res_ema.json()

    # RSI strategy backtest
    payload_rsi = {"strategy": "rsi", "symbol": "SOL/USD", "period": 14}
    res_rsi = client.post("/api/v1/backtest", json=payload_rsi)
    assert res_rsi.status_code == 200
    assert "annualized_sharpe" in res_rsi.json()

    # Bad json
    res_bad = client.post("/api/v1/backtest", content="not json", headers={"Content-Type": "application/json"})
    assert res_bad.status_code == 400

    # Bad json to orders
    res_bad_ord = client.post("/api/v1/orders", content="not json", headers={"Content-Type": "application/json"})
    assert res_bad_ord.status_code == 400


def test_api_orders_and_portfolio(client):
    order_payload = {"symbol": "BTC/USD", "side": "BUY", "quantity": 1.0, "market_price": 50000.0}
    res_ord = client.post("/api/v1/orders", json=order_payload)
    assert res_ord.status_code == 200
    assert res_ord.json()["status"] == "FILLED"

    res_port = client.get("/api/v1/portfolio")
    assert res_port.status_code == 200
    assert "positions" in res_port.json()


def test_api_websocket_market_feed(client):
    with client.websocket_connect("/ws/market-feed") as ws:
        snapshot = ws.receive_json()
        assert snapshot["type"] == "SNAPSHOT"
        ws.send_text("ping")
        assert ws.receive_text() == "pong"
        ws.send_text("poll")
        update = ws.receive_json()
        assert update["type"] == "UPDATE"


def test_cli_execution(monkeypatch, capsys):
    # Test research command
    monkeypatch.setattr(sys, "argv", ["cli.py", "research", "--symbol", "ETH/USD", "--bars", "100"])
    cli.main()
    captured = capsys.readouterr()
    assert "QUANT RESEARCH CYCLE REPORT" in captured.out
    assert "ETH/USD" in captured.out

    # Test metrics command
    monkeypatch.setattr(sys, "argv", ["cli.py", "metrics"])
    cli.main()
    captured_m = capsys.readouterr()
    assert "quant_portfolio_equity" in captured_m.out

    # Test help
    monkeypatch.setattr(sys, "argv", ["cli.py"])
    cli.main()
    captured_h = capsys.readouterr()
    assert "usage:" in captured_h.out or "Quant Sentinel CLI" in captured_h.out
