#!/usr/bin/env python3
"""
Quant Sentinel: Full Autonomous Swarm Live Simulation
Simulates real-time multi-asset market data ingestion, autonomous alpha hypothesis generation,
cross-asset statistical arbitrage, asset-aware order execution, and Cholesky Monte Carlo risk governance.
"""

import os
import sys
import time

# Ensure repository root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np

from core.data_feed import (
    DEFAULT_ASSET_SPECS,
    generate_multi_asset_feed,
    extract_multi_asset_price_matrix,
    extract_ohlcv_arrays,
)
from core.models import OrderSide
from agents.regime_agent import RegimeDetectionAgent
from agents.alpha_agent import AlphaHypothesisAgent
from agents.backtest_agent import VectorizedBacktestAgent
from analytics.pairs import StatisticalArbitrageEngine
from execution.engine import PaperExecutionEngine
from risk.governor import RiskGovernorAgent


def print_banner():
    banner = r"""
========================================================================================
   ____  _   _    _    _   _ _____   ____  _______   _____ ___ _   _ _____ _     
  / __ \| | | |  / \  | \ | |_   _| / ___|| ____\ \ / /_ _| \ | | ____| |    
 | |  | | | | | / _ \ |  \| | | |   \___ \|  _|  \ V / | ||  \| |  _| | |    
 | |__| | |_| |/ ___ \| |\  | | |    ___) | |___  | |  | || |\  | |___| |___ 
  \___\_\\___//_/   \_\_| \_| |_|   |____/|_____| |_| |___|_| \_|_____|_____|
               AUTONOMOUS ALPHA SWARM & MULTI-ASSET RISK MESH
========================================================================================
"""
    print(banner)


def simulate_full_system():
    print_banner()

    symbols = ["BTC/USD", "ETH/USD", "XAU/USD", "JPY/USD"]
    print("[PHASE 1] INGESTING MULTI-ASSET MARKET DATA FEED (300 SYNCHRONIZED BARS)")
    print("-" * 88)
    t0 = time.perf_counter()
    feed = generate_multi_asset_feed(symbols=symbols, n_bars=300, seed=42)
    sym_order, timestamps, price_matrix = extract_multi_asset_price_matrix(feed)
    t_feed = (time.perf_counter() - t0) * 1000

    print(f"✓ Ingestion complete in {t_feed:.2f} ms")
    print(f"✓ Synchronized bars: {price_matrix.shape[0]} timestamps across {len(sym_order)} assets")
    print("┌──────────┬─────────────┬──────────────┬──────────────┬───────────────┬────────────────┐")
    print("│ Symbol   │ Asset Class │ Base Vol (σ) │ Pip Decimals │ Current Price │ 300-Bar Return │")
    print("├──────────┼─────────────┼──────────────┼──────────────┼───────────────┼────────────────┤")
    for i, sym in enumerate(sym_order):
        spec = DEFAULT_ASSET_SPECS[sym]
        p_first = price_matrix[0, i]
        p_last = price_matrix[-1, i]
        ret_pct = ((p_last - p_first) / p_first) * 100
        p_str = f"${p_last:,.2f}" if spec["pip_decimal"] <= 2 else f"${p_last:.6f}"
        print(f"│ {sym:<8} │ {spec['asset_class']:<11} │ {spec['sigma']*100:>10.1f}% │ {spec['pip_decimal']:>12} │ {p_str:>13} │ {ret_pct:>+13.2f}% │")
    print("└──────────┴─────────────┴──────────────┴──────────────┴───────────────┴────────────────┘")

    print("\n[PHASE 2] AUTONOMOUS REGIME CLASSIFICATION & ALPHA SWARM HYPOTHESES")
    print("-" * 88)
    regime_agent = RegimeDetectionAgent()
    alpha_agent = AlphaHypothesisAgent()
    backtest_agent = VectorizedBacktestAgent()

    all_signals = {}
    print("Evaluating autonomous alpha models across asset classes...")
    for sym in sym_order:
        candles = feed[sym]
        arrays = extract_ohlcv_arrays(candles)
        c_arr = arrays["close"]
        regime = regime_agent.detect_regime(c_arr)

        # Generate signals from all 3 alpha models
        sig_boll = alpha_agent.generate_bollinger_signals(c_arr)
        sig_ema = alpha_agent.generate_ema_cross_signals(c_arr)
        sig_rsi = alpha_agent.generate_rsi_signals(c_arr)

        bt_boll = backtest_agent.run_backtest("Bollinger Mean-Reversion", sym, c_arr, sig_boll)
        bt_ema = backtest_agent.run_backtest("Dual EMA Trend Cross", sym, c_arr, sig_ema)
        bt_rsi = backtest_agent.run_backtest("RSI Momentum Breakout", sym, c_arr, sig_rsi)

        strategies = [(bt_boll, sig_boll), (bt_ema, sig_ema), (bt_rsi, sig_rsi)]
        best_bt, best_sig = max(strategies, key=lambda pair: pair[0].annualized_sharpe)

        all_signals[sym] = best_sig[-1]
        action = "BUY" if best_sig[-1] > 0 else ("SELL" if best_sig[-1] < 0 else "HOLD")
        print(f"  • {sym:<8} -> Regime: {regime.value:<15} | Top Model: {best_bt.strategy_name:<25} | Sharpe: {best_bt.annualized_sharpe:+5.2f} | Action: {action}")

    print("\n[PHASE 3] CROSS-ASSET STATISTICAL ARBITRAGE (LOG-PRICE COINTEGRATION)")
    print("-" * 88)
    pairs_engine = StatisticalArbitrageEngine()

    pair_1 = ("XAU/USD", "JPY/USD", 2, 3, "Physical Gold priced in Yen")
    pair_2 = ("BTC/USD", "XAU/USD", 0, 2, "Digital Gold vs Physical Gold")

    for sym_a, sym_b, idx_a, idx_b, desc in [pair_1, pair_2]:
        p_a = price_matrix[:, idx_a]
        p_b = price_matrix[:, idx_b]
        res = pairs_engine.analyze_pair(sym_a, sym_b, p_a, p_b, use_log_prices=True)

        signal_str = "BUY SPREAD (Long A / Short B)" if res.current_z_score < -1.5 else (
            "SELL SPREAD (Short A / Long B)" if res.current_z_score > 1.5 else "NEUTRAL / COOLDOWN"
        )
        print(f"  Pair: {sym_a} vs {sym_b} ({desc})")
        print(f"    - Kalman Elasticity (β) : {res.hedge_ratio_beta:+.4f}")
        print(f"    - O-U Half-Life         : {res.ou_half_life_days:.1f} days (Mean-Revert Speed θ={res.ou_theta:.4f})")
        print(f"    - Current Spread Z-Score: {res.current_z_score:+.2f} -> Signal: {signal_str}")
        bt_res = backtest_agent.run_backtest(
            f"Pairs ({sym_a}/{sym_b})", f"{sym_a}-{sym_b}", p_a, np.array(res.signals, dtype=np.int8)
        )
        print(f"    - Backtest Sharpe       : {bt_res.annualized_sharpe:+.2f} | MDD: {bt_res.max_drawdown_pct:.2f}% | Trades: {bt_res.total_trades}")

    print("\n[PHASE 4] ASSET-AWARE ORDER ROUTING & PORTFOLIO REVALUATION")
    print("-" * 88)
    engine = PaperExecutionEngine(initial_capital=250000.0, slippage_bps=5.0)
    print(f"Starting Cash Balance: ${engine.portfolio.cash:,.2f}")

    # Allocate across all 4 assets
    target_orders = [
        ("BTC/USD", OrderSide.BUY, 0.25, price_matrix[-1, 0]),
        ("ETH/USD", OrderSide.BUY, 1.50, price_matrix[-1, 1]),
        ("XAU/USD", OrderSide.BUY, 15.00, price_matrix[-1, 2]),
        ("JPY/USD", OrderSide.BUY, 3000000.0, price_matrix[-1, 3]),
    ]

    print("Submitting market orders to matching engine with dynamic pip precision...")
    for sym, side, qty, px in target_orders:
        order = engine.submit_order(sym, side, qty, market_price=px)
        p_fill = f"${order.filled_price:,.2f}" if DEFAULT_ASSET_SPECS[sym]["pip_decimal"] <= 2 else f"${order.filled_price:.6f}"
        print(f"  ✓ {order.symbol:<8} {order.side.value} {order.quantity:>11.2f} @ fill={p_fill} | Status: {order.status.value}")

    curr_prices = {sym: price_matrix[-1, i] for i, sym in enumerate(sym_order)}
    engine.mark_to_market(curr_prices)
    weights = engine.get_normalized_portfolio_weights(curr_prices)

    print("\nMarked-to-Market Portfolio Summary:")
    print(f"  • Cash Balance       : ${engine.portfolio.cash:,.2f}")
    print(f"  • Total Portfolio Eq : ${engine.portfolio.equity:,.2f}")
    print(f"  • Net Unrealized PnL : ${engine.portfolio.total_pnl:,.2f}")
    print("  • Normalized Allocation:")
    for sym, w in weights.items():
        print(f"      - {sym:<8}: {w*100:>5.2f}% notional")

    print("\n[PHASE 5] JOINT 4-ASSET COVARIANCE & CHOLESKY MONTE CARLO RISK GOVERNOR")
    print("-" * 88)
    governor = RiskGovernorAgent(max_var_limit_pct=10.0, max_drawdown_limit_pct=30.0)
    prices_dict = {sym: price_matrix[:, i] for i, sym in enumerate(sym_order)}

    t_mc_start = time.perf_counter()
    risk_evaluation = governor.evaluate_multivariate_portfolio_risk(
        portfolio_value=engine.portfolio.equity,
        weights=weights,
        prices_dict=prices_dict,
        run_monte_carlo=True,
    )
    t_mc = (time.perf_counter() - t_mc_start) * 1000

    print(f"✓ Covariance & 1,000-Path Monte Carlo evaluated in {t_mc:.2f} ms")
    cov = np.array(risk_evaluation.details["covariance_matrix"])
    print("\nJoint Asset Covariance Matrix Σ (Daily variance in bps):")
    print(f"             {'BTC/USD':>12} {'ETH/USD':>12} {'XAU/USD':>12} {'JPY/USD':>12}")
    for i, s1 in enumerate(sym_order):
        row = f"  {s1:<8} : "
        for j in range(len(sym_order)):
            row += f"{cov[i, j]*1e4:>11.4f} "
        print(row)

    mc = risk_evaluation.details["monte_carlo"]
    print("\nTail-Risk & Monte Carlo Stress Trajectories (30 Trading Days Forward):")
    print(f"  • 1-Day Parametric 95% VaR : ${risk_evaluation.parametric_var_95:,.2f} ({risk_evaluation.details['var_pct_of_portfolio']}%)")
    print(f"  • 1-Day Parametric 99% VaR : ${risk_evaluation.parametric_var_99:,.2f}")
    print(f"  • 30-Day Simulated 95% VaR : ${mc['simulated_var_95']:,.2f} ({mc['simulated_var_95']/engine.portfolio.equity*100:.2f}%)")
    print(f"  • 30-Day Simulated 99% VaR : ${mc['simulated_var_99']:,.2f} ({mc['simulated_var_99']/engine.portfolio.equity*100:.2f}%)")
    print(f"  • Expected Terminal Equity : ${mc['expected_terminal_equity']:,.2f}")
    print(f"  • 5th Percentile Equity    : ${mc['percentile_5_terminal_equity']:,.2f}")
    print(f"  • Worst Projected Drawdown : {mc['worst_loss_pct']:.2f}% (Governor Limit: {governor.max_drawdown_limit_pct}%)")
    print(f"  • Circuit Breaker Status   : {'[TRIPPED - EXECUTION HALTED]' if mc['circuit_breaker_tripped'] else '[SAFE - NORMAL EXECUTION]'}")

    print("\n" + "=" * 88)
    print(" END-TO-END AUTONOMOUS QUANT SIMULATION COMPLETED WITH EXIT CODE 0")
    print("=" * 88)
    return 0


if __name__ == "__main__":
    sys.exit(simulate_full_system())
