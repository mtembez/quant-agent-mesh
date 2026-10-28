"""Central Quant Swarm Coordinator orchestrating autonomous alpha research and execution."""

import time
from typing import Any, Dict, List, Optional
import numpy as np

from agents.alpha_agent import AlphaHypothesisAgent
from agents.backtest_agent import VectorizedBacktestAgent
from agents.regime_agent import RegimeDetectionAgent
from analytics.pairs import StatisticalArbitrageEngine
from core.data_feed import extract_ohlcv_arrays, generate_synthetic_gbm
from core.models import BacktestResult, MarketRegime, OrderSide, RiskMetrics
from execution.engine import PaperExecutionEngine
from risk.governor import RiskGovernorAgent


class QuantSwarmCoordinator:
    """Orchestrates market regime detection, alpha hypothesis testing, risk audits, and trade execution."""

    def __init__(self, initial_capital: float = 100000.0):
        self.regime_agent = RegimeDetectionAgent()
        self.alpha_agent = AlphaHypothesisAgent()
        self.backtest_agent = VectorizedBacktestAgent(initial_capital=initial_capital)
        self.risk_governor = RiskGovernorAgent()
        self.execution_engine = PaperExecutionEngine(initial_capital=initial_capital)
        self.pairs_engine = StatisticalArbitrageEngine()

        self.strategy_registry: Dict[str, BacktestResult] = {}
        self.latest_regime: MarketRegime = MarketRegime.MEAN_REVERTING
        self.latest_risk: Optional[RiskMetrics] = None

    def analyze_pairs_trading(self, symbol_a: str = "BTC/USD", symbol_b: str = "ETH/USD", n_bars: int = 300) -> Dict[str, Any]:
        """Perform dynamic Kalman hedge ratio and Ornstein-Uhlenbeck pairs analysis."""
        candles_a = generate_synthetic_gbm(initial_price=100.0, n_bars=n_bars, mu=0.05, sigma=0.20)
        prices_a = extract_ohlcv_arrays(candles_a)["close"]

        # Synthetic cointegrated pair: P_B = 0.5 * P_A + stationary noise
        np.random.seed(42)
        noise = np.random.normal(0, 1.5, n_bars)
        prices_b = (0.5 * prices_a) + noise

        pair_result = self.pairs_engine.analyze_pair(symbol_a, symbol_b, prices_a, prices_b)
        # Vectorized backtest on spread signals
        backtest_res = self.backtest_agent.run_backtest(
            strategy_name=f"Pairs O-U ({symbol_a}/{symbol_b})",
            symbol=f"{symbol_a}-{symbol_b}",
            prices=prices_a,
            signals=np.array(pair_result.signals, dtype=np.int8),
        )

        return {
            "pairs_analysis": pair_result.model_dump(mode="json"),
            "backtest": backtest_res.model_dump(mode="json"),
        }

    def run_full_research_cycle(self, symbol: str = "BTC/USD", n_bars: int = 350) -> Dict[str, Any]:
        """Execute complete autonomous quantitative research, backtesting, and risk governance workflow."""
        start_time = time.time()
        # 1. Ingest timeseries
        candles = generate_synthetic_gbm(initial_price=100.0, n_bars=n_bars, mu=0.06, sigma=0.25)
        ohlcv = extract_ohlcv_arrays(candles)
        close_prices = ohlcv["close"]

        # 2. Detect Market Regime
        self.latest_regime = self.regime_agent.detect_regime(close_prices)

        # 3. Formulate Alpha Hypotheses
        bollinger_sig = self.alpha_agent.generate_bollinger_signals(close_prices, window=20, num_std=2.0)
        ema_sig = self.alpha_agent.generate_ema_cross_signals(close_prices, fast_window=12, slow_window=26)
        rsi_sig = self.alpha_agent.generate_rsi_signals(close_prices, period=14, overbought=70.0, oversold=30.0)

        # 4. Vectorized Backtesting
        res_bollinger = self.backtest_agent.run_backtest("Bollinger Mean-Reversion", symbol, close_prices, bollinger_sig)
        res_ema = self.backtest_agent.run_backtest("Dual EMA Trend Cross", symbol, close_prices, ema_sig)
        res_rsi = self.backtest_agent.run_backtest("RSI Momentum Breakout", symbol, close_prices, rsi_sig)

        strategies = [res_bollinger, res_ema, res_rsi]
        for s in strategies:
            self.strategy_registry[s.strategy_name] = s

        # 5. Rank by Sharpe Ratio
        top_strategy = max(strategies, key=lambda s: s.annualized_sharpe)

        # 6. Monte Carlo Tail Risk Audit
        self.latest_risk = self.risk_governor.evaluate_portfolio_risk(
            portfolio_value=self.execution_engine.portfolio.equity,
            price_history=close_prices,
            n_mc_simulations=500,
            forecast_days=30,
        )

        # 7. Paper Execution (if not risk breached)
        order_placed = None
        if not self.latest_risk.is_risk_breached and top_strategy.annualized_sharpe > 0.0:
            current_p = close_prices[-1]
            order_placed = self.execution_engine.submit_order(
                symbol=symbol,
                side=OrderSide.BUY,
                quantity=10.0,
                market_price=current_p,
            )

        duration_ms = round((time.time() - start_time) * 1000.0, 2)

        return {
            "symbol": symbol,
            "market_regime": self.latest_regime.value,
            "strategies_evaluated": len(strategies),
            "top_strategy": top_strategy.model_dump(mode="json"),
            "risk_metrics": self.latest_risk.model_dump(mode="json"),
            "portfolio": self.execution_engine.portfolio.model_dump(mode="json"),
            "executed_order": order_placed.model_dump(mode="json") if order_placed else None,
            "computation_time_ms": duration_ms,
        }
