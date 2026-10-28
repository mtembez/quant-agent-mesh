#!/usr/bin/env python3
"""Quant Sentinel CLI: Command-line interface for autonomous alpha research and risk governance."""

import argparse
import sys
from core.swarm import QuantSwarmCoordinator


def cmd_research(args):
    """Execute full autonomous quantitative research cycle."""
    coord = QuantSwarmCoordinator()
    print(f"[CLI] Running autonomous quant research cycle on '{args.symbol}' ({args.bars} bars)...")
    res = coord.run_full_research_cycle(symbol=args.symbol, n_bars=args.bars)

    print("\n" + "=" * 70)
    print(" QUANT RESEARCH CYCLE REPORT")
    print("=" * 70)
    print(f"Symbol                : {res['symbol']}")
    print(f"Market Regime         : {res['market_regime']}")
    print(f"Computation Latency   : {res['computation_time_ms']} ms")

    top = res["top_strategy"]
    print("\n--- TOP ALPHA STRATEGY ---")
    print(f"Strategy Name         : {top['strategy_name']}")
    print(f"Annualized Sharpe     : {top['annualized_sharpe']}")
    print(f"Sortino Ratio         : {top['sortino_ratio']}")
    print(f"Total Return          : {top['total_return_pct']}%")
    print(f"Max Drawdown          : {top['max_drawdown_pct']}%")
    print(f"Win Rate              : {top['win_rate_pct']}% ({top['total_trades']} trades)")

    risk = res["risk_metrics"]
    print("\n--- TAIL RISK AUDIT ---")
    print(f"Parametric VaR (95%)  : ${risk['parametric_var_95']:,.2f}")
    print(f"Conditional VaR (95%) : ${risk['conditional_var_95']:,.2f}")
    print(f"Worst Simulated Loss  : {risk['max_simulated_loss_pct']}%")
    print(f"Risk Breach Status    : {'BREACHED' if risk['is_risk_breached'] else 'SAFE / NORMAL'}")

    port = res["portfolio"]
    print("\n--- PORTFOLIO STATE ---")
    print(f"Cash Balance          : ${port['cash']:,.2f}")
    print(f"Marked-to-Market Eq   : ${port['equity']:,.2f}")
    print(f"Total PnL             : ${port['total_pnl']:,.2f}")
    print("=" * 70 + "\n")


def cmd_pairs(args):
    """Run statistical arbitrage and Ornstein-Uhlenbeck pairs analysis."""
    coord = QuantSwarmCoordinator()
    print(f"[CLI] Running pairs analysis on {args.asset_a} vs {args.asset_b} ({args.bars} bars)...")
    res = coord.analyze_pairs_trading(symbol_a=args.asset_a, symbol_b=args.asset_b, n_bars=args.bars)
    pa = res["pairs_analysis"]
    bt = res["backtest"]

    print("\n" + "=" * 70)
    print(" ORNSTEIN-UHLENBECK PAIRS TRADING ANALYSIS")
    print("=" * 70)
    print(f"Pair                  : {pa['symbol_a']} / {pa['symbol_b']}")
    print(f"Kalman Hedge Ratio    : {pa['hedge_ratio_beta']}")
    print(f"O-U Mean-Reversion Spd: {pa['ou_theta']}")
    print(f"O-U Equilibrium Mean  : {pa['ou_mu']}")
    print(f"Half-Life (Days)      : {pa['ou_half_life_days']} days")
    print(f"Current Spread        : {pa['current_spread']}")
    print(f"Current Z-Score       : {pa['current_z_score']}")
    print("\n--- SPREAD STRATEGY BACKTEST ---")
    print(f"Total Return          : {bt['total_return_pct']}%")
    print(f"Annualized Sharpe     : {bt['annualized_sharpe']}")
    print(f"Max Drawdown          : {bt['max_drawdown_pct']}%")
    print(f"Total Trades          : {bt['total_trades']}")
    print("=" * 70 + "\n")


def cmd_metrics(args):
    """Expose Prometheus telemetry metrics."""
    coord = QuantSwarmCoordinator()
    coord.run_full_research_cycle()
    equity = coord.execution_engine.portfolio.equity
    top_sharpe = max(s.annualized_sharpe for s in coord.strategy_registry.values()) if coord.strategy_registry else 0.0

    print("# HELP quant_portfolio_equity Current marked-to-market equity of quant portfolio")
    print("# TYPE quant_portfolio_equity gauge")
    print(f"quant_portfolio_equity {equity}")
    print("# HELP quant_top_strategy_sharpe Annualized Sharpe ratio of top-performing alpha strategy")
    print("# TYPE quant_top_strategy_sharpe gauge")
    print(f"quant_top_strategy_sharpe {top_sharpe}")


def main():
    parser = argparse.ArgumentParser(description="Quant Sentinel CLI")
    subparsers = parser.add_subparsers(dest="command")

    # Research command
    p_res = subparsers.add_parser("research", help="Execute autonomous alpha research cycle")
    p_res.add_argument("--symbol", default="BTC/USD", help="Asset symbol")
    p_res.add_argument("--bars", type=int, default=350, help="Number of candles")

    # Metrics command
    subparsers.add_parser("metrics", help="Display Prometheus metrics")

    # Pairs command
    p_pairs = subparsers.add_parser("pairs", help="Run pairs trading statistical arbitrage analysis")
    p_pairs.add_argument("--asset-a", default="BTC/USD", help="First asset symbol")
    p_pairs.add_argument("--asset-b", default="ETH/USD", help="Second asset symbol")
    p_pairs.add_argument("--bars", type=int, default=300, help="Number of candles")

    args = parser.parse_args()

    if args.command == "research":
        cmd_research(args)
    elif args.command == "pairs":
        cmd_pairs(args)
    elif args.command == "metrics":
        cmd_metrics(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
