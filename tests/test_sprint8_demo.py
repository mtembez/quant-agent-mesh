"""Unit tests for Sprint 8 Ceremony 3 Interactive Demo & End-to-End Pipeline Verification."""

import os
import sys
import subprocess
import numpy as np
import pytest

from scripts.demo_sprint8 import main as demo_main
from core.data_feed import generate_multi_asset_feed, extract_multi_asset_price_matrix
from execution.engine import PaperExecutionEngine
from core.models import OrderSide
from analytics.pairs import StatisticalArbitrageEngine
from risk.governor import RiskGovernorAgent


def test_ceremony_3_demo_in_process_execution(capsys):
    """Verify Ceremony 3 demo runs directly in-process returning exit code 0."""
    result = demo_main()
    assert result == 0
    captured = capsys.readouterr()
    assert "SPRINT 8 REVIEW & INTERACTIVE DEMO: QUANT AGENT MESH" in captured.out
    assert "[DEMO 1 / US-8.1]" in captured.out
    assert "[DEMO 2 / US-8.2]" in captured.out
    assert "[DEMO 3 / US-8.3]" in captured.out
    assert "[DEMO 4 / US-8.4]" in captured.out
    assert "[DEMO 5 / US-8.5]" in captured.out
    assert "SPRINT 8 REVIEW COMPLETE: ALL ACCEPTANCE CRITERIA FULLY SATISFIED" in captured.out


def test_ceremony_3_demo_subprocess_execution():
    """Verify Ceremony 3 demo executes cleanly as an independent CLI subprocess."""
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    demo_script = os.path.join(repo_root, "scripts", "demo_sprint8.py")

    proc = subprocess.run(
        [sys.executable, demo_script],
        cwd=repo_root,
        capture_output=True,
        text=True,
        timeout=30,
    )

    assert proc.returncode == 0, f"Demo failed with stderr: {proc.stderr}"
    assert "SPRINT 8 REVIEW & INTERACTIVE DEMO" in proc.stdout
    assert "BTC/USD" in proc.stdout
    assert "ETH/USD" in proc.stdout
    assert "XAU/USD" in proc.stdout
    assert "JPY/USD" in proc.stdout
    assert "1-Day Parametric 95% VaR" in proc.stdout
    assert "Correlated Multivariate Monte Carlo Simulation (Cholesky)" in proc.stdout
    assert "SPRINT 8 REVIEW COMPLETE" in proc.stdout


def test_ceremony_3_mathematical_invariants():
    """Verify quantitative invariants across the full Ceremony 3 pipeline."""
    # 1. Feed generation & calendar alignment
    symbols = ["BTC/USD", "ETH/USD", "XAU/USD", "JPY/USD"]
    feed = generate_multi_asset_feed(symbols=symbols, n_bars=150, seed=123)
    sym_order, timestamps, price_matrix = extract_multi_asset_price_matrix(feed)
    assert price_matrix.shape == (150, 4)
    assert not np.isnan(price_matrix).any()

    # 2. Asset-aware execution & sub-pip precision
    engine = PaperExecutionEngine(initial_capital=200000.0, slippage_bps=5.0)
    o_jpy = engine.submit_order("JPY/USD", OrderSide.BUY, 2000000.0, market_price=price_matrix[-1, 3])
    assert o_jpy.status.value == "FILLED"
    assert round(o_jpy.filled_price, 2) != o_jpy.filled_price  # 6 decimal sub-pip precision
    assert o_jpy.filled_price > 0

    # 3. Normalized portfolio weights
    curr_prices = {sym: price_matrix[-1, i] for i, sym in enumerate(sym_order)}
    weights = engine.get_normalized_portfolio_weights(curr_prices)
    assert 0.0 < weights["JPY/USD"] < 1.0
    assert sum(weights.values()) <= 1.0

    # 4. Cross-asset pairs log-beta boundedness
    pairs_engine = StatisticalArbitrageEngine()
    res_xau_jpy = pairs_engine.analyze_pair(
        "XAU/USD", "JPY/USD", price_matrix[:, 2], price_matrix[:, 3], use_log_prices=True
    )
    assert abs(res_xau_jpy.hedge_ratio_beta) < 50.0
    assert res_xau_jpy.ou_half_life_days > 0

    # 5. Covariance matrix and Cholesky Monte Carlo simulation
    governor = RiskGovernorAgent(max_var_limit_pct=15.0, max_drawdown_limit_pct=30.0)
    prices_dict = {sym: price_matrix[:, i] for i, sym in enumerate(sym_order)}
    eval_res = governor.evaluate_multivariate_portfolio_risk(
        portfolio_value=engine.portfolio.equity,
        weights=weights,
        prices_dict=prices_dict,
        run_monte_carlo=True,
    )

    cov = np.array(eval_res.details["covariance_matrix"])
    eigenvalues = np.linalg.eigvalsh(cov)
    # Strictly positive definite
    assert (eigenvalues > 0).all()

    mc = eval_res.details["monte_carlo"]
    assert mc["simulated_var_99"] >= mc["simulated_var_95"]
    assert mc["worst_loss_pct"] >= 0.0
    assert isinstance(mc["circuit_breaker_tripped"], bool)
