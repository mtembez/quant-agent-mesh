"""Unit test suite for 1-Hour Quantitative Gold (XAU/USD) Prediction Engine."""

import os
import sys
import subprocess
import pytest

from scripts.predict_gold_1h import predict_gold_1hour


def test_gold_1hour_prediction_bounds():
    """Verify statistical and financial properties of 1-hour Gold prediction."""
    res = predict_gold_1hour(current_price=2720.0, annual_vol=0.16, n_simulations=5000, seed=42)

    assert res["current_price"] == 2720.0
    assert res["dollar_1sigma"] > 0
    assert res["dollar_2sigma"] > res["dollar_1sigma"]

    # Monotonicity of percentiles
    assert res["mc_p1"] < res["mc_p5"] < res["mc_p50"] < res["mc_p95"] < res["mc_p99"]

    # Current price should lie inside 95% confidence interval
    assert res["mc_p5"] <= res["current_price"] <= res["mc_p95"]

    # Intra-hour range check
    assert res["expected_low"] < res["current_price"] < res["expected_high"]
    assert res["expected_range"] > 0

    # Directional probabilities sum to 100%
    assert abs((res["prob_up"] + res["prob_down"]) - 100.0) < 1e-4


def test_gold_1hour_cli_subprocess():
    """Verify CLI execution of gold prediction script."""
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    script_path = os.path.join(repo_root, "scripts", "predict_gold_1h.py")

    proc = subprocess.run(
        [sys.executable, script_path, "--price", "2750.0", "--vol", "0.15"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        timeout=15,
    )

    assert proc.returncode == 0
    assert "QUANTITATIVE 1-HOUR GOLD (XAU/USD) PROBABILISTIC FORECAST REPORT" in proc.stdout
    assert "Current Spot Price (P₀)  : $2,750.00" in proc.stdout
    assert "PROBABILITY DENSITY FUNCTION" in proc.stdout
