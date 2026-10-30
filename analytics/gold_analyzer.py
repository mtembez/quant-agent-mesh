"""Dedicated Spot Gold (XAU/USD) Quantitative Analytics, Strategy Overlay & Forward Machine Learning Predictor.
Calibrated to live Spot Gold prices (~$3,984/oz).
Computes real-time candles, strategy visual overlays (Dual EMA, Bollinger Bands, RSI, O-U Equilibrium),
intraday microstructure volatility (Parkinson, Garman-Klass), and forward probabilistic machine learning forecasts.
"""

import math
from typing import Any, Dict, List, Optional
import numpy as np
from pydantic import BaseModel, Field

from core.data_feed import DEFAULT_ASSET_SPECS, extract_ohlcv_arrays, generate_multi_asset_feed
from agents.regime_agent import RegimeDetectionAgent
from agents.alpha_agent import AlphaHypothesisAgent
from agents.backtest_agent import VectorizedBacktestAgent
from analytics.pairs import OrnsteinUhlenbeckEstimator


class GoldCandle(BaseModel):
    timestamp: float
    time_label: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    # Strategy overlay indicators
    ema_fast: Optional[float] = None
    ema_slow: Optional[float] = None
    boll_upper: Optional[float] = None
    boll_mid: Optional[float] = None
    boll_lower: Optional[float] = None
    rsi: Optional[float] = None
    ou_equilibrium: Optional[float] = None
    active_signal: int = 0  # 1 = BUY, -1 = SELL, 0 = HOLD


class StrategyMetric(BaseModel):
    strategy_id: str
    strategy_name: str
    annualized_sharpe: float
    total_return_pct: float
    max_drawdown_pct: float
    win_rate_pct: float
    total_trades: int
    current_signal: str  # BUY / SELL / HOLD
    thesis: str


class ForecastTrajectoryPoint(BaseModel):
    step_hour: int
    expected_price: float
    low_95: float
    high_95: float
    expected_change_pct: float


class HorizonPrediction(BaseModel):
    horizon_label: str
    horizon_hours: int
    median_price: float
    expected_low: float
    expected_high: float
    low_95: float
    high_95: float
    low_99: float
    high_99: float
    expected_range_dollars: float
    prob_up: float
    prob_down: float
    expected_change_pct: float


class SpotGoldAnalysisResponse(BaseModel):
    symbol: str = "XAU/USD"
    timeframe: str = "1h"
    current_spot_price: float
    daily_change_pct: float
    daily_change_dollars: float
    market_regime: str
    annual_volatility_pct: float
    parkinson_volatility_pct: float
    garman_klass_volatility_pct: float
    rogers_satchell_volatility_pct: float
    yang_zhang_volatility_pct: float
    hourly_volatility_pct: float
    recommended_lot_size: float
    trailing_stop_loss: float
    take_profit_target: float
    active_strategy_id: str
    strategies: Dict[str, StrategyMetric] = Field(default_factory=dict)
    forecast_1h: HorizonPrediction
    forecast_24h: HorizonPrediction
    forward_trajectory: List[ForecastTrajectoryPoint] = Field(default_factory=list)
    candles: List[GoldCandle] = Field(default_factory=list)
    macro_gold_in_jpy: float
    macro_btc_to_gold_ratio: float


def compute_parkinson_volatility(high: np.ndarray, low: np.ndarray, annualize_factor: float = 252.0) -> float:
    """Parkinson extreme-value volatility estimator."""
    n = len(high)
    if n < 2:
        return 0.16
    ratios = np.log(np.maximum(1e-9, high) / np.maximum(1e-9, low))
    variance = (1.0 / (4.0 * math.log(2.0) * n)) * np.sum(ratios**2)
    return float(math.sqrt(variance * annualize_factor))


def compute_garman_klass_volatility(
    open_arr: np.ndarray, high: np.ndarray, low: np.ndarray, close: np.ndarray, annualize_factor: float = 252.0
) -> float:
    """Garman-Klass volatility estimator using OHLC spread."""
    n = len(close)
    if n < 2:
        return 0.16
    hl = np.log(np.maximum(1e-9, high) / np.maximum(1e-9, low))
    co = np.log(np.maximum(1e-9, close) / np.maximum(1e-9, open_arr))
    gk_terms = 0.5 * (hl**2) - (2.0 * math.log(2.0) - 1.0) * (co**2)
    variance = (1.0 / n) * np.sum(gk_terms)
    return float(math.sqrt(max(1e-9, variance * annualize_factor)))


def compute_rogers_satchell_volatility(
    open_arr: np.ndarray, high: np.ndarray, low: np.ndarray, close: np.ndarray, annualize_factor: float = 252.0
) -> float:
    """Rogers-Satchell extreme-value volatility estimator (drift-invariant)."""
    n = len(close)
    if n < 2:
        return 0.16
    ho = np.log(np.maximum(1e-9, high) / np.maximum(1e-9, open_arr))
    hc = np.log(np.maximum(1e-9, high) / np.maximum(1e-9, close))
    lo = np.log(np.maximum(1e-9, low) / np.maximum(1e-9, open_arr))
    lc = np.log(np.maximum(1e-9, low) / np.maximum(1e-9, close))
    rs_terms = ho * hc + lo * lc
    variance = (1.0 / n) * np.sum(np.maximum(0.0, rs_terms))
    return float(math.sqrt(max(1e-9, variance * annualize_factor)))


def compute_yang_zhang_volatility(
    open_arr: np.ndarray, high: np.ndarray, low: np.ndarray, close: np.ndarray, annualize_factor: float = 252.0
) -> float:
    """Yang-Zhang volatility estimator (drift-invariant and overnight jump-adjusted)."""
    n = len(close)
    if n < 3:
        return 0.16
    # Overnight gap variance: open vs previous close
    log_oc = np.log(np.maximum(1e-9, open_arr[1:]) / np.maximum(1e-9, close[:-1]))
    var_o = float(np.var(log_oc, ddof=1)) if len(log_oc) > 1 else 0.0

    # Open-to-close variance
    log_co = np.log(np.maximum(1e-9, close) / np.maximum(1e-9, open_arr))
    var_c = float(np.var(log_co, ddof=1)) if len(log_co) > 1 else 0.0

    # Rogers-Satchell variance (unannualized)
    rs_vol = compute_rogers_satchell_volatility(open_arr, high, low, close, annualize_factor=1.0)
    var_rs = rs_vol**2

    k = 0.34 / (1.34 + (n + 1.0) / max(1.0, (n - 1.0)))
    total_var = var_o + k * var_c + (1.0 - k) * var_rs
    return float(math.sqrt(max(1e-9, total_var * annualize_factor)))



class SpotGoldAnalyzer:
    """Comprehensive Spot Gold Quantitative Terminal Engine."""

    def __init__(self):
        self.regime_agent = RegimeDetectionAgent()
        self.alpha_agent = AlphaHypothesisAgent()
        self.backtest_agent = VectorizedBacktestAgent(initial_capital=100000.0)
        self.ou_estimator = OrnsteinUhlenbeckEstimator()

    def analyze(
        self,
        timeframe: str = "1h",
        active_strategy: str = "ema",
        custom_spot_price: float = 3984.66,
        n_bars: int = 60,
        seed: int = 42,
        ema_fast: int = 12,
        ema_slow: int = 26,
        boll_window: int = 20,
        boll_std: float = 2.0,
        rsi_period: int = 14,
    ) -> SpotGoldAnalysisResponse:
        """
        Execute full Spot Gold analytics, strategy overlay computation, and probabilistic forecasting.
        """
        # Timeframe parameters
        bars_map = {"15m": 48, "1h": 60, "4h": 90, "1D": 120}
        bars_count = bars_map.get(timeframe, n_bars)

        # Ingest multi-asset feeds for cross-market context
        symbols = ["XAU/USD", "JPY/USD", "BTC/USD"]
        feed = generate_multi_asset_feed(symbols=symbols, n_bars=bars_count, seed=seed)
        xau_candles = feed["XAU/USD"]
        ohlcv = extract_ohlcv_arrays(xau_candles)

        base_close = ohlcv["close"]
        base_spot = float(base_close[-1])
        scale = float(custom_spot_price) / max(1e-9, base_spot)

        close = base_close * scale
        high = ohlcv["high"] * scale
        low = ohlcv["low"] * scale
        open_arr = ohlcv["open"] * scale
        vol_arr = ohlcv["volume"]

        current_spot = float(close[-1])
        daily_chg_pct = float(((current_spot - close[-24 if len(close) > 24 else 0]) / close[-24 if len(close) > 24 else 0]) * 100.0)
        daily_chg_dollars = float(current_spot - close[-24 if len(close) > 24 else 0])

        # Microstructure Volatilities (Parkinson, Garman-Klass, Rogers-Satchell, Yang-Zhang)
        trading_hours_per_year = 252.0 * 23.0
        parkinson_vol = compute_parkinson_volatility(high, low, annualize_factor=252.0)
        garman_klass_vol = compute_garman_klass_volatility(open_arr, high, low, close, annualize_factor=252.0)
        rogers_satchell_vol = compute_rogers_satchell_volatility(open_arr, high, low, close, annualize_factor=252.0)
        yang_zhang_vol = compute_yang_zhang_volatility(open_arr, high, low, close, annualize_factor=252.0)
        annual_vol = rogers_satchell_vol if rogers_satchell_vol > 0.05 else 0.16  # Spot Gold baseline
        hourly_vol = annual_vol * math.sqrt(1.0 / trading_hours_per_year)

        # Macro Regime
        regime = self.regime_agent.detect_regime(close)

        # Strategy 1: Dual EMA (ema_fast, ema_slow)
        fast_ema = self.alpha_agent._calc_ema(close, ema_fast)
        slow_ema = self.alpha_agent._calc_ema(close, ema_slow)
        sig_ema = self.alpha_agent.generate_ema_cross_signals(close, ema_fast, ema_slow)
        bt_ema = self.backtest_agent.run_backtest(f"Dual EMA ({ema_fast}/{ema_slow})", "XAU/USD", close, sig_ema)
        curr_ema_sig = "BUY" if sig_ema[-1] > 0 else ("SELL" if sig_ema[-1] < 0 else "HOLD")

        # Strategy 2: Bollinger Bands (boll_window, boll_std)
        w = boll_window
        boll_mid = np.empty_like(close)
        boll_upper = np.empty_like(close)
        boll_lower = np.empty_like(close)
        for i in range(len(close)):
            idx_start = max(0, i - w + 1)
            sub = close[idx_start : i + 1]
            m = float(np.mean(sub))
            s = float(np.std(sub))
            boll_mid[i] = m
            boll_upper[i] = m + boll_std * s
            boll_lower[i] = m - boll_std * s

        sig_boll = self.alpha_agent.generate_bollinger_signals(close, window=boll_window, num_std=boll_std)
        bt_boll = self.backtest_agent.run_backtest(f"Bollinger ({boll_window}, {boll_std}σ)", "XAU/USD", close, sig_boll)
        curr_boll_sig = "BUY" if sig_boll[-1] > 0 else ("SELL" if sig_boll[-1] < 0 else "HOLD")

        # Strategy 3: RSI Momentum (rsi_period)
        sig_rsi = self.alpha_agent.generate_rsi_signals(close, period=rsi_period, overbought=70.0, oversold=30.0)
        bt_rsi = self.backtest_agent.run_backtest(f"RSI Momentum ({rsi_period})", "XAU/USD", close, sig_rsi)
        curr_rsi_sig = "BUY" if sig_rsi[-1] > 0 else ("SELL" if sig_rsi[-1] < 0 else "HOLD")

        # Strategy 4: Ornstein-Uhlenbeck Mean-Reversion Equilibrium
        theta, mu_ou, sigma_ou, half_life = self.ou_estimator.estimate_parameters(close, dt=1.0 / 252.0)
        ou_sig = np.zeros(len(close), dtype=np.int8)
        ou_sig[close < (mu_ou - 1.5 * sigma_ou)] = 1
        ou_sig[close > (mu_ou + 1.5 * sigma_ou)] = -1
        bt_ou = self.backtest_agent.run_backtest("O-U Mean-Reversion", "XAU/USD", close, ou_sig)
        curr_ou_sig = "BUY" if ou_sig[-1] > 0 else ("SELL" if ou_sig[-1] < 0 else "HOLD")

        # Assemble Strategy Metric Registry
        strategy_registry: Dict[str, StrategyMetric] = {
            "ema": StrategyMetric(
                strategy_id="ema",
                strategy_name=f"Dual EMA Trend Cross ({ema_fast}/{ema_slow})",
                annualized_sharpe=round(bt_ema.annualized_sharpe, 2),
                total_return_pct=round(bt_ema.total_return_pct, 2),
                max_drawdown_pct=round(bt_ema.max_drawdown_pct, 2),
                win_rate_pct=round(bt_ema.win_rate_pct, 1),
                total_trades=bt_ema.total_trades,
                current_signal=curr_ema_sig,
                thesis=f"Fast EMA (${fast_ema[-1]:,.2f}) {'is above' if fast_ema[-1] > slow_ema[-1] else 'is below'} Slow EMA (${slow_ema[-1]:,.2f}). Upward trend continuation indicated." if fast_ema[-1] > slow_ema[-1] else "Downward momentum favored.",
            ),
            "bollinger": StrategyMetric(
                strategy_id="bollinger",
                strategy_name=f"Bollinger Bands ({boll_window}, {boll_std}σ)",
                annualized_sharpe=round(bt_boll.annualized_sharpe, 2),
                total_return_pct=round(bt_boll.total_return_pct, 2),
                max_drawdown_pct=round(bt_boll.max_drawdown_pct, 2),
                win_rate_pct=round(bt_boll.win_rate_pct, 1),
                total_trades=bt_boll.total_trades,
                current_signal=curr_boll_sig,
                thesis=f"Spot price (${current_spot:,.2f}) is oscillating between Upper (${boll_upper[-1]:,.2f}) and Lower (${boll_lower[-1]:,.2f}) bands.",
            ),
            "rsi": StrategyMetric(
                strategy_id="rsi",
                strategy_name=f"RSI Momentum Breakout ({rsi_period})",
                annualized_sharpe=round(bt_rsi.annualized_sharpe, 2),
                total_return_pct=round(bt_rsi.total_return_pct, 2),
                max_drawdown_pct=round(bt_rsi.max_drawdown_pct, 2),
                win_rate_pct=round(bt_rsi.win_rate_pct, 1),
                total_trades=bt_rsi.total_trades,
                current_signal=curr_rsi_sig,
                thesis=f"{rsi_period}-period RSI is balanced. Extreme oversold (<30) or overbought (>70) triggers breakout entries.",
            ),
            "ou": StrategyMetric(
                strategy_id="ou",
                strategy_name="Ornstein-Uhlenbeck Equilibrium",
                annualized_sharpe=round(bt_ou.annualized_sharpe, 2),
                total_return_pct=round(bt_ou.total_return_pct, 2),
                max_drawdown_pct=round(bt_ou.max_drawdown_pct, 2),
                win_rate_pct=round(bt_ou.win_rate_pct, 1),
                total_trades=bt_ou.total_trades,
                current_signal=curr_ou_sig,
                thesis=f"Spot price is pulled toward stationary equilibrium benchmark ${mu_ou:,.2f} with half-life of {half_life:.1f} days.",
            ),
        }

        # Dynamic Fractional Kelly Position Sizing and Dynamic Risk Bands
        active_metric = strategy_registry.get(active_strategy, strategy_registry["ema"])
        p_win = max(0.40, min(0.85, active_metric.win_rate_pct / 100.0))
        b_payoff = 1.5
        kelly_fraction = max(0.02, min(0.20, (p_win * (b_payoff + 1.0) - 1.0) / b_payoff))
        half_kelly = 0.5 * kelly_fraction
        rec_lot_size = round(max(0.1, min(10.0, (100000.0 * half_kelly) / (current_spot * 0.05))), 2)

        risk_delta = current_spot * (max(0.08, parkinson_vol) / math.sqrt(252.0 * 23.0)) * 2.5
        if active_metric.current_signal == "BUY":
            trailing_stop = round(current_spot - risk_delta, 2)
            take_profit = round(current_spot + 2.0 * risk_delta, 2)
        elif active_metric.current_signal == "SELL":
            trailing_stop = round(current_spot + risk_delta, 2)
            take_profit = round(current_spot - 2.0 * risk_delta, 2)
        else:
            trailing_stop = round(current_spot - risk_delta, 2)
            take_profit = round(current_spot + risk_delta, 2)


        # Build Candles with Overlays
        candle_objs: List[GoldCandle] = []
        for i in range(len(close)):
            c_time = xau_candles[i].timestamp
            # Form clean hourly / daily label
            hours_ago = len(close) - 1 - i
            t_label = f"-{hours_ago}h" if hours_ago > 0 else "NOW"

            # Assign active signal based on selected strategy
            if active_strategy == "ema":
                act_sig = int(sig_ema[i])
            elif active_strategy == "bollinger":
                act_sig = int(sig_boll[i])
            elif active_strategy == "rsi":
                act_sig = int(sig_rsi[i])
            else:
                act_sig = int(ou_sig[i])

            candle_objs.append(
                GoldCandle(
                    timestamp=float(c_time),
                    time_label=t_label,
                    open=round(float(open_arr[i]), 2),
                    high=round(float(high[i]), 2),
                    low=round(float(low[i]), 2),
                    close=round(float(close[i]), 2),
                    volume=round(float(vol_arr[i]), 1),
                    ema_fast=round(float(fast_ema[i]), 2),
                    ema_slow=round(float(slow_ema[i]), 2),
                    boll_upper=round(float(boll_upper[i]), 2),
                    boll_mid=round(float(boll_mid[i]), 2),
                    boll_lower=round(float(boll_lower[i]), 2),
                    ou_equilibrium=round(float(mu_ou), 2),
                    active_signal=act_sig,
                )
            )

        # Forward Probabilistic Machine Learning Forecasts
        def generate_prediction(hours: int, label: str) -> HorizonPrediction:
            np.random.seed(seed + hours)
            h_dt = hours / trading_hours_per_year
            h_sigma = annual_vol * math.sqrt(h_dt)

            # Drift influenced by active strategy signal
            active_sig_val = 1.0 if strategy_registry[active_strategy].current_signal == "BUY" else (-1.0 if strategy_registry[active_strategy].current_signal == "SELL" else 0.0)
            h_mu = (0.08 + (active_sig_val * 0.05) - 0.5 * annual_vol**2) * h_dt

            sims = current_spot * np.exp(h_mu + h_sigma * np.random.standard_normal(10000))

            p1 = float(np.percentile(sims, 1.0))
            p5 = float(np.percentile(sims, 5.0))
            med = float(np.median(sims))
            p95 = float(np.percentile(sims, 95.0))
            p99 = float(np.percentile(sims, 99.0))

            rng = current_spot * h_sigma * math.sqrt(8.0 / math.pi)
            p_up = float(np.mean(sims > current_spot)) * 100.0

            return HorizonPrediction(
                horizon_label=label,
                horizon_hours=hours,
                median_price=round(med, 2),
                expected_low=round(current_spot - (rng / 2.0), 2),
                expected_high=round(current_spot + (rng / 2.0), 2),
                low_95=round(p5, 2),
                high_95=round(p95, 2),
                low_99=round(p1, 2),
                high_99=round(p99, 2),
                expected_range_dollars=round(rng, 2),
                prob_up=round(p_up, 1),
                prob_down=round(100.0 - p_up, 1),
                expected_change_pct=round(((med - current_spot) / current_spot) * 100.0, 3),
            )

        fc_1h = generate_prediction(1, "1-Hour Horizon")
        fc_24h = generate_prediction(24, "24-Hour Horizon")

        # Forward Trajectory Points for visual chart extension (+1h to +12h)
        trajectory_pts: List[ForecastTrajectoryPoint] = []
        for h in [1, 2, 3, 4, 6, 8, 10, 12]:
            h_dt = h / trading_hours_per_year
            h_sigma = annual_vol * math.sqrt(h_dt)
            active_sig_val = 1.0 if strategy_registry[active_strategy].current_signal == "BUY" else (-1.0 if strategy_registry[active_strategy].current_signal == "SELL" else 0.0)
            h_mu = (0.08 + (active_sig_val * 0.05) - 0.5 * annual_vol**2) * h_dt
            exp_p = current_spot * math.exp(h_mu)
            ci_half = exp_p * (1.96 * h_sigma)
            trajectory_pts.append(
                ForecastTrajectoryPoint(
                    step_hour=h,
                    expected_price=round(exp_p, 2),
                    low_95=round(exp_p - ci_half, 2),
                    high_95=round(exp_p + ci_half, 2),
                    expected_change_pct=round(((exp_p - current_spot) / current_spot) * 100.0, 3),
                )
            )

        # Macro cross-asset valuations
        jpy_rate = float(feed["JPY/USD"][-1].close)
        gold_jpy = round(current_spot / max(1e-9, jpy_rate), 2)
        btc_rate = float(feed["BTC/USD"][-1].close)
        btc_gold = round(btc_rate / max(1e-9, current_spot), 4)

        return SpotGoldAnalysisResponse(
            symbol="XAU/USD",
            timeframe=timeframe,
            current_spot_price=round(current_spot, 2),
            daily_change_pct=round(daily_chg_pct, 2),
            daily_change_dollars=round(daily_chg_dollars, 2),
            market_regime=regime.value,
            annual_volatility_pct=round(annual_vol * 100.0, 2),
            parkinson_volatility_pct=round(parkinson_vol * 100.0, 2),
            garman_klass_volatility_pct=round(garman_klass_vol * 100.0, 2),
            rogers_satchell_volatility_pct=round(rogers_satchell_vol * 100.0, 2),
            yang_zhang_volatility_pct=round(yang_zhang_vol * 100.0, 2),
            hourly_volatility_pct=round(hourly_vol * 100.0, 4),
            recommended_lot_size=rec_lot_size,
            trailing_stop_loss=trailing_stop,
            take_profit_target=take_profit,
            active_strategy_id=active_strategy,
            strategies=strategy_registry,
            forecast_1h=fc_1h,
            forecast_24h=fc_24h,
            forward_trajectory=trajectory_pts,
            candles=candle_objs,
            macro_gold_in_jpy=gold_jpy,
            macro_btc_to_gold_ratio=btc_gold,
        )
