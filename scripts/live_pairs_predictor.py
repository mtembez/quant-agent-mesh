#!/usr/bin/env python3
"""
Live Real-Time Pairs Prediction & Statistical Arbitrage Engine
Ingests live market data from crypto exchanges, updates dynamic Kalman hedge ratios,
fits continuous Ornstein-Uhlenbeck mean-reversion SDEs, and forecasts future relative price trajectories.
"""

import os
import sys
import argparse
import math
import numpy as np

# Ensure repository root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.live_feed import get_live_pair_prices
from analytics.pairs import StatisticalArbitrageEngine
from core.data_feed import generate_multi_asset_feed, extract_multi_asset_price_matrix


def forecast_spread_trajectory(
    current_spread: float,
    ou_theta: float,
    ou_mu: float,
    ou_sigma: float,
    horizons_hours: list = [1, 2, 4, 8, 12, 24, 48],
):
    """
    Project future spread trajectory using exact Ornstein-Uhlenbeck conditional expectation:
    E[S_{t+h} | S_t] = mu + (S_t - mu) * exp(-theta * h)
    Var(S_{t+h} | S_t) = (sigma^2 / (2 * theta)) * (1 - exp(-2 * theta * h))
    """
    projections = []
    # Annualized theta converted to hourly: theta_hourly = theta / (252 * 24)
    # But if dt was in days, theta_hourly = theta_daily / 24
    theta_per_hour = ou_theta / 24.0
    sigma_per_hour = ou_sigma / math.sqrt(24.0)

    for h in horizons_hours:
        decay = math.exp(-theta_per_hour * h)
        expected_s = ou_mu + (current_spread - ou_mu) * decay
        if theta_per_hour > 1e-9:
            variance = (sigma_per_hour**2 / (2.0 * theta_per_hour)) * (1.0 - math.exp(-2.0 * theta_per_hour * h))
        else:
            variance = (sigma_per_hour**2) * h
        std_err = math.sqrt(max(1e-9, variance))

        expected_reversion_pct = ((expected_s - current_spread) / max(1e-9, abs(current_spread))) * 100.0

        projections.append(
            {
                "horizon_hours": h,
                "expected_spread": expected_s,
                "low_95": expected_s - 1.96 * std_err,
                "high_95": expected_s + 1.96 * std_err,
                "expected_reversion_pct": expected_reversion_pct,
            }
        )

    return projections


def run_live_pairs_prediction(
    symbol_a: str = "BTC/USD",
    symbol_b: str = "ETH/USD",
    n_bars: int = 200,
    interval_minutes: int = 60,
    use_synthetic: bool = False,
):
    """Run real-time statistical arbitrage and relative price prediction."""
    print("=" * 88)
    print(" LIVE PAIRS ARBITRAGE & RELATIVE PRICE PREDICTION ENGINE")
    print(f" Target Pair: {symbol_a} vs {symbol_b} | Bar Interval: {interval_minutes}m")
    print("=" * 88)

    # 1. Ingest Market Data (Live or Synthetic Fallback)
    p_a = None
    p_b = None
    data_source = "Kraken Public Exchange (LIVE STREAM)"

    if not use_synthetic:
        try:
            print(f"\n[1] CONNECTING TO LIVE EXCHANGE FEED ({symbol_a} & {symbol_b})...")
            p_a, p_b, spot_a, spot_b = get_live_pair_prices(
                symbol_a, symbol_b, interval_minutes=interval_minutes, n_bars=n_bars
            )
            print(f"✓ Connected to Kraken live public ticker successfully!")
            print(f"✓ Synchronized {len(p_a)} real-time {interval_minutes}-minute candles.")
        except Exception as e:
            print(f"! Live network feed exception: {e}")
            print("! Falling back to calibrated multi-asset engine...")
            p_a = None

    if p_a is None:
        data_source = "Multi-Asset Engine (CALIBRATED BENCHMARK)"
        symbols = [symbol_a, symbol_b]
        feed = generate_multi_asset_feed(symbols=symbols, n_bars=n_bars, seed=42)
        sym_order, ts, matrix = extract_multi_asset_price_matrix(feed)
        idx_a = sym_order.index(symbol_a)
        idx_b = sym_order.index(symbol_b)
        p_a = matrix[:, idx_a]
        p_b = matrix[:, idx_b]
        spot_a = float(p_a[-1])
        spot_b = float(p_b[-1])

    print(f"\n[2] CURRENT REAL-TIME SPOT QUOTES ({data_source})")
    print(f"  • {symbol_a:<10} Spot Price : ${spot_a:,.2f}")
    print(f"  • {symbol_b:<10} Spot Price : ${spot_b:,.2f}")
    raw_ratio = spot_a / max(1e-9, spot_b)
    print(f"  • Price Ratio ({symbol_a}/{symbol_b}) : {raw_ratio:.4f}")

    # 2. Run Kalman Filter & Ornstein-Uhlenbeck Analysis (in log-price space)
    pairs_engine = StatisticalArbitrageEngine()
    analysis = pairs_engine.analyze_pair(symbol_a, symbol_b, p_a, p_b, use_log_prices=True)

    beta = analysis.hedge_ratio_beta
    theta = analysis.ou_theta
    mu = analysis.ou_mu
    half_life_days = analysis.ou_half_life_days
    half_life_hours = half_life_days * 24.0
    current_spread = analysis.current_spread
    current_z = analysis.current_z_score

    print(f"\n[3] COINTEGRATION & DYNAMIC KALMAN HEDGE RATIO")
    print(f"  • Kalman Dynamic Elasticity (β) : {beta:+.4f} (1 unit of {symbol_a} ≡ {beta:.4f} units of {symbol_b})")
    print(f"  • O-U Mean-Reversion Speed (θ)  : {theta:.4f} / day ({theta/24.0:.5f} / hour)")
    print(f"  • Stationary Equilibrium (μ)    : {mu:.6f}")
    print(f"  • Expected Half-Life (t₁/₂)     : {half_life_hours:.1f} hours ({half_life_days:.2f} trading days)")
    print(f"  • Current Spread Value (sₜ)     : {current_spread:+.6f}")
    print(f"  • Current Spread Z-Score        : {current_z:+.2f} standard deviations")

    # 3. Formulate Actionable Prediction & Directional Forecast
    if current_z <= -2.0:
        signal = "STRONG BUY SPREAD (LONG A / SHORT B)"
        prediction = f"{symbol_a} is STATISTICALLY UNDERVALUED relative to {symbol_b}. Strong expectation of outperformance."
    elif current_z <= -1.0:
        signal = "BUY SPREAD (ACCUMULATE LONG A / SHORT B)"
        prediction = f"{symbol_a} is moderately undervalued relative to {symbol_b}. Upward mean-reversion favored."
    elif current_z >= 2.0:
        signal = "STRONG SELL SPREAD (SHORT A / LONG B)"
        prediction = f"{symbol_a} is STATISTICALLY OVERVALUED relative to {symbol_b}. Strong expectation of underperformance."
    elif current_z >= 1.0:
        signal = "SELL SPREAD (ACCUMULATE SHORT A / LONG B)"
        prediction = f"{symbol_a} is moderately overvalued relative to {symbol_b}. Downward mean-reversion favored."
    else:
        signal = "NEUTRAL / HOLD (SPREAD IN EQUILIBRIUM BAND)"
        prediction = f"Spread is within normal noise boundaries (|Z| < 1.0). No statistical mispricing detected."

    print(f"\n[4] PREDICTIVE SIGNAL & TRADING ACTION")
    print(f"  • Action Recommendation : [{signal}]")
    print(f"  • Quantitative Thesis   : {prediction}")

    # 4. Project Forward Spread Trajectory
    # Extract empirical spread volatility from spread series
    spread_series = np.array(analysis.spread_series)
    spread_sigma = float(np.std(np.diff(spread_series))) if len(spread_series) > 1 else 0.01

    projections = forecast_spread_trajectory(
        current_spread=current_spread,
        ou_theta=theta,
        ou_mu=mu,
        ou_sigma=spread_sigma,
        horizons_hours=[1, 4, 12, 24, 48],
    )

    print(f"\n[5] PROJECTED RELATIVE PRICE TRAJECTORY (FUTURE SPREAD EXPECTATION)")
    print("┌──────────────┬──────────────────┬───────────────────────────────┬──────────────────────┐")
    print("│ Time Horizon │ Projected Spread │ 95% Confidence Band [Low/High]│ Expected Shift from P0│")
    print("├──────────────┼──────────────────┼───────────────────────────────┼──────────────────────┤")
    for p in projections:
        h_str = f"+{p['horizon_hours']} Hours"
        print(
            f"│ {h_str:<12} │ {p['expected_spread']:>+16.6f} │ [{p['low_95']:>+11.6f} , {p['high_95']:>+11.6f}] │ {p['expected_reversion_pct']:>+19.2f}% │"
        )
    print("└──────────────┴──────────────────┴───────────────────────────────┴──────────────────────┘")

    print("\n" + "=" * 88)
    print(" PREDICTION COMPLETE: MONITORING REAL-TIME ORNSTEIN-UHLENBECK TRAJECTORY")
    print("=" * 88)
    return 0


def main():
    parser = argparse.ArgumentParser(description="Live Real-Time Pairs Arbitrage & Prediction")
    parser.add_argument("--asset-a", type=str, default="BTC/USD", help="First asset symbol (default: BTC/USD)")
    parser.add_argument("--asset-b", type=str, default="ETH/USD", help="Second asset symbol (default: ETH/USD)")
    parser.add_argument("--bars", type=int, default=200, help="Number of historical bars (default: 200)")
    parser.add_argument("--synthetic", action="store_true", help="Force synthetic data instead of live feed")
    args = parser.parse_args()

    return run_live_pairs_prediction(
        symbol_a=args.asset_a,
        symbol_b=args.asset_b,
        n_bars=args.bars,
        use_synthetic=args.synthetic,
    )


if __name__ == "__main__":
    sys.exit(main())
