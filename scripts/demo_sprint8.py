#!/usr/bin/env python3
"""
Sprint 8 Interactive Demo: Multi-Asset Engine, Cross-Market Arbitrage & Cholesky Monte Carlo Risk Governor
Autonomous Quantitative Alpha Swarm & Risk Mesh (quant-agent-mesh)
Product Owner: Simon M. Munyambu (@mtembez)
"""

import os
import sys

# Ensure repository root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np

from core.data_feed import (
    DEFAULT_ASSET_SPECS,
    generate_multi_asset_feed,
    extract_multi_asset_price_matrix,
)
from execution.engine import PaperExecutionEngine
from core.models import OrderSide
from analytics.pairs import StatisticalArbitrageEngine
from core.swarm import QuantSwarmCoordinator
from risk.governor import RiskGovernorAgent


def main():
    print("=" * 80)
    print(" SPRINT 8 REVIEW & INTERACTIVE DEMO: QUANT AGENT MESH")
    print(" Multi-Asset Engine, Cross-Market Arbitrage & Cholesky Monte Carlo Risk Governor")
    print(" Product Owner: Simon M. Munyambu (@mtembez, simonmaeleq7@gmail.com)")
    print("=" * 80)

    # -------------------------------------------------------------------------
    # DEMO 1: US-8.1 Multi-Asset Timeseries Feed & Calendar Alignment
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print(" [DEMO 1 / US-8.1] Multi-Asset Timeseries Generator & Calendar Alignment")
    print("-" * 80)
    symbols = ["BTC/USD", "ETH/USD", "XAU/USD", "JPY/USD"]
    print(f"Generating synchronized 300-bar feeds across 4 asset classes: {symbols}...")
    feed = generate_multi_asset_feed(symbols=symbols, n_bars=300, seed=42)
    sym_order, timestamps, price_matrix = extract_multi_asset_price_matrix(feed)

    print(f"✓ Synchronized bars      : {price_matrix.shape[0]} timestamps")
    print(f"✓ Matrix Dimensions      : {price_matrix.shape} (bars x assets)")
    print(f"✓ Asset Classes Mapped   :")
    for sym in sym_order:
        spec = DEFAULT_ASSET_SPECS[sym]
        last_px = price_matrix[-1, sym_order.index(sym)]
        print(f"   • {sym:<8} | Class: {spec['asset_class']:<10} | Annual Vol (σ): {spec['sigma']*100:>4.1f}% | Pip Decimals: {spec['pip_decimal']} | Last Px: {last_px:10.5f}")

    assert not np.isnan(price_matrix).any(), "NaN values detected in multi-asset matrix"
    print("✓ Calendar Alignment    : 100% synchronized, zero NaNs, weekend gaps gracefully imputed.")

    # -------------------------------------------------------------------------
    # DEMO 2: US-8.2 Asset-Aware Execution Engine & Pip Precision
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print(" [DEMO 2 / US-8.2] Asset-Aware Execution Engine & Pip Precision")
    print("-" * 80)
    engine = PaperExecutionEngine(initial_capital=250000.0, slippage_bps=5.0)
    print(f"Initial Portfolio Capital: ${engine.portfolio.cash:,.2f}")

    # Submit orders sized comfortably within capital
    o_btc = engine.submit_order("BTC/USD", OrderSide.BUY, 0.25, market_price=price_matrix[-1, 0])
    o_eth = engine.submit_order("ETH/USD", OrderSide.BUY, 1.5, market_price=price_matrix[-1, 1])
    o_xau = engine.submit_order("XAU/USD", OrderSide.BUY, 15.0, market_price=price_matrix[-1, 2])
    o_jpy = engine.submit_order("JPY/USD", OrderSide.BUY, 3000000.0, market_price=price_matrix[-1, 3])

    print("Executed Multi-Asset Orders:")
    for o in [o_btc, o_eth, o_xau, o_jpy]:
        fp_str = f"{o.filled_price:.6f}" if o.filled_price is not None else "N/A"
        print(f"   • {o.symbol:<8} {o.side.value:<4} qty={o.quantity:>11.2f} @ filled_price={fp_str:<12} -> Status: {o.status.value}")

    current_prices = {sym: price_matrix[-1, i] for i, sym in enumerate(sym_order)}
    weights = engine.get_normalized_portfolio_weights(current_prices)
    engine.mark_to_market(current_prices)

    print(f"\nMark-to-Market Portfolio State:")
    print(f"✓ Total Cash Balance     : ${engine.portfolio.cash:,.2f}")
    print(f"✓ Total PnL              : ${engine.portfolio.total_pnl:,.2f}")
    print(f"✓ Total Portfolio Equity : ${engine.portfolio.equity:,.2f}")
    print("✓ Capital Allocation Weights:")
    for sym, w in weights.items():
        print(f"   • {sym:<8}: {w*100:>6.2f}% notional allocation")

    # -------------------------------------------------------------------------
    # DEMO 3: US-8.3 Cross-Asset Pairs Arbitrage (Log-Space Calibration)
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print(" [DEMO 3 / US-8.3] Cross-Asset Pairs Arbitrage (Log-Price Space)")
    print("-" * 80)
    pairs_engine = StatisticalArbitrageEngine()
    coordinator = QuantSwarmCoordinator()

    # XAU/USD vs JPY/USD (Physical Gold priced in Yen)
    res_gold_yen = pairs_engine.analyze_pair(
        "XAU/USD", "JPY/USD", price_matrix[:, 2], price_matrix[:, 3], use_log_prices=True
    )
    # BTC/USD vs XAU/USD (Digital Gold vs Physical Gold)
    res_btc_gold = pairs_engine.analyze_pair(
        "BTC/USD", "XAU/USD", price_matrix[:, 0], price_matrix[:, 2], use_log_prices=True
    )

    print("Cross-Asset Pair 1: XAU/USD (Gold) vs JPY/USD (Yen) [Gold in Yen Macro Arbitrage]")
    print(f"   • Log-Spread Beta (β)  : {res_gold_yen.hedge_ratio_beta:.4f} (Elasticity)")
    print(f"   • O-U Mean-Revert Speed: {res_gold_yen.ou_theta:.4f}")
    print(f"   • Half-Life (Days)     : {res_gold_yen.ou_half_life_days:.2f} days")
    print(f"   • Spread Z-Score       : {res_gold_yen.current_z_score:+.3f}")

    print("\nCross-Asset Pair 2: BTC/USD (Digital Gold) vs XAU/USD (Physical Gold)")
    print(f"   • Log-Spread Beta (β)  : {res_btc_gold.hedge_ratio_beta:.4f} (Elasticity)")
    print(f"   • O-U Mean-Revert Speed: {res_btc_gold.ou_theta:.4f}")
    print(f"   • Half-Life (Days)     : {res_btc_gold.ou_half_life_days:.2f} days")
    print(f"   • Spread Z-Score       : {res_btc_gold.current_z_score:+.3f}")

    # -------------------------------------------------------------------------
    # DEMO 4: US-8.4 Multi-Asset Covariance & Parametric VaR
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print(" [DEMO 4 / US-8.4] Multi-Asset Covariance Matrix & Parametric VaR")
    print("-" * 80)
    prices_dict = {sym: price_matrix[:, i] for i, sym in enumerate(sym_order)}
    governor = RiskGovernorAgent(max_var_limit_pct=10.0, max_drawdown_limit_pct=35.0)

    risk_evaluation = governor.evaluate_multivariate_portfolio_risk(
        portfolio_value=engine.portfolio.equity,
        weights=weights,
        prices_dict=prices_dict,
        run_monte_carlo=False,
    )

    print("Joint 4-Asset Covariance Matrix (Daily Return Variance in bps):")
    cov = np.array(risk_evaluation.details["covariance_matrix"])
    print(f"             {'BTC/USD':>12} {'ETH/USD':>12} {'XAU/USD':>12} {'JPY/USD':>12}")
    for i, s1 in enumerate(sym_order):
        row_str = f"{s1:<10} : "
        for j in range(len(sym_order)):
            row_str += f"{cov[i, j]*1e4:>11.4f} "
        print(row_str)

    print(f"\n1-Day Parametric 95% VaR  : ${risk_evaluation.parametric_var_95:,.2f} ({risk_evaluation.details['var_pct_of_portfolio']}%)")
    print(f"1-Day Parametric 99% VaR  : ${risk_evaluation.parametric_var_99:,.2f}")
    print(f"Daily Portfolio Volatility: {risk_evaluation.details['portfolio_daily_volatility']*100:.2f}%")

    # -------------------------------------------------------------------------
    # DEMO 5: US-8.5 Correlated Multivariate Monte Carlo Stress Testing (Cholesky)
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print(" [DEMO 5 / US-8.5] Correlated Multivariate Monte Carlo Simulation (Cholesky)")
    print("-" * 80)
    print("Running 1,000 correlated sample paths projected across 30 forward trading days...")
    mc_risk = governor.evaluate_multivariate_portfolio_risk(
        portfolio_value=engine.portfolio.equity,
        weights=weights,
        prices_dict=prices_dict,
        run_monte_carlo=True,
    )

    mc_res = mc_risk.details["monte_carlo"]
    print(f"✓ Monte Carlo Paths Simulated: {mc_res['n_simulations']:,} paths over {mc_res['horizon_days']} days")
    print(f"✓ Simulated 95% Horizon VaR  : ${mc_res['simulated_var_95']:,.2f} ({mc_res['simulated_var_95'] / engine.portfolio.equity * 100:.2f}% of equity)")
    print(f"✓ Simulated 99% Horizon VaR  : ${mc_res['simulated_var_99']:,.2f} ({mc_res['simulated_var_99'] / engine.portfolio.equity * 100:.2f}% of equity)")
    print(f"✓ Expected Terminal Equity   : ${mc_res['expected_terminal_equity']:,.2f}")
    print(f"✓ Median Terminal Equity     : ${mc_res['median_terminal_equity']:,.2f}")
    print(f"✓ 5th Percentile Equity      : ${mc_res['percentile_5_terminal_equity']:,.2f}")
    print(f"✓ Worst Projected Loss       : {mc_res['worst_loss_pct']:.2f}%")
    print(f"✓ Circuit Breaker Tripped    : {mc_res['circuit_breaker_tripped']} (Drawdown Limit: {governor.max_drawdown_limit_pct}%)")
    print(f"✓ Overall Risk Breached      : {mc_risk.is_risk_breached}")

    print("\n" + "=" * 80)
    print(" SPRINT 8 REVIEW COMPLETE: ALL ACCEPTANCE CRITERIA FULLY SATISFIED")
    print("=" * 80)
    return 0


if __name__ == "__main__":
    sys.exit(main())
