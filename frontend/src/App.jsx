import React, { useState, useEffect } from 'react';

export default function App() {
  const [portfolio, setPortfolio] = useState({
    cash: 100000.0,
    equity: 100000.0,
    total_pnl: 0.0,
    positions: {},
  });

  const [strategies, setStrategies] = useState([]);
  const [activeTab, setActiveTab] = useState('gold'); // gold | predict | leaderboard | lab | pairs | execution | metrics
  const [regime, setRegime] = useState('MEAN_REVERTING');
  const [metricsText, setMetricsText] = useState('');
  const [statusMessage, setStatusMessage] = useState('Spot Gold Live Alpha Terminal & ML Predictor Active');

  // Spot Gold Terminal State (Calibrated to TradingView OANDA Spot Gold ~$3,984.66)
  const [goldData, setGoldData] = useState(null);
  const [goldTimeframe, setGoldTimeframe] = useState('1h'); // 1h | 4h | 1D
  const [goldStrategy, setGoldStrategy] = useState('ema'); // ema | bollinger | rsi | ou
  const [goldSpotPrice, setGoldSpotPrice] = useState(3984.66);
  const [goldAutoRefresh, setGoldAutoRefresh] = useState(true);
  const [loadingGold, setLoadingGold] = useState(false);

  // Live Auto-Learning Predictor State
  const [livePrediction, setLivePrediction] = useState(null);
  const [livePairKey, setLivePairKey] = useState('BTC/USD__ETH/USD');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loadingPrediction, setLoadingPrediction] = useState(false);

  // Backtest Lab inputs
  const [labStrategy, setLabStrategy] = useState('bollinger');
  const [labWindow, setLabWindow] = useState(20);
  const [labStd, setLabStd] = useState(2.0);
  const [latestBacktest, setLatestBacktest] = useState(null);

  // Execution inputs
  const [orderSymbol, setOrderSymbol] = useState('XAU/USD');
  const [orderQty, setOrderQty] = useState(5.0);
  const [orderSide, setOrderSide] = useState('BUY');

  // Pairs Trading inputs
  const [pairsAssetA, setPairsAssetA] = useState('XAU/USD');
  const [pairsAssetB, setPairsAssetB] = useState('JPY/USD');
  const [pairsResult, setPairsResult] = useState(null);

  useEffect(() => {
    fetchPortfolio();
    fetchStrategies();
    fetchGoldAnalysis(goldTimeframe, goldStrategy, goldSpotPrice);
    fetchLivePrediction(livePairKey);

    const interval = setInterval(() => {
      fetchPortfolio();
      if (goldAutoRefresh && activeTab === 'gold') {
        fetchGoldAnalysis(goldTimeframe, goldStrategy, goldSpotPrice);
      }
      if (autoRefresh && activeTab === 'predict') {
        fetchLivePrediction(livePairKey);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [goldAutoRefresh, autoRefresh, livePairKey, goldTimeframe, goldStrategy, goldSpotPrice, activeTab]);

  const fetchPortfolio = async () => {
    try {
      const res = await fetch('/api/v1/portfolio');
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
      }
    } catch (e) {}
  };

  const fetchStrategies = async () => {
    try {
      const res = await fetch('/api/v1/strategies');
      if (res.ok) {
        const data = await res.json();
        setStrategies(data);
      }
    } catch (e) {}
  };

  const fetchGoldAnalysis = async (tf = goldTimeframe, strat = goldStrategy, px = goldSpotPrice) => {
    setLoadingGold(true);
    try {
      const res = await fetch(`/api/v1/gold/analyze?timeframe=${encodeURIComponent(tf)}&strategy=${encodeURIComponent(strat)}&spot_price=${encodeURIComponent(px)}`);
      if (res.ok) {
        const data = await res.json();
        setGoldData(data);
        setStatusMessage(`Spot Gold analyzed [${tf.toUpperCase()}] -> Active Model: ${strat.toUpperCase()} | Signal: ${data.strategies[strat]?.current_signal || 'HOLD'}`);
      }
    } catch (e) {
      console.error('Failed to fetch gold analysis:', e);
    } finally {
      setLoadingGold(false);
    }
  };

  const fetchLivePrediction = async (pairKey = livePairKey) => {
    setLoadingPrediction(true);
    const [symA, symB] = pairKey.split('__');
    try {
      const res = await fetch(`/api/v1/predict/live?symbol_a=${encodeURIComponent(symA)}&symbol_b=${encodeURIComponent(symB)}`);
      if (res.ok) {
        const data = await res.json();
        setLivePrediction(data);
      }
    } catch (e) {
      console.error('Failed to fetch prediction:', e);
    } finally {
      setLoadingPrediction(false);
    }
  };

  const runFullResearch = async () => {
    setStatusMessage('Executing Autonomous Alpha Hypothesis & Monte Carlo Swarm Cycle...');
    try {
      const res = await fetch('/api/v1/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: 'XAU/USD', n_bars: 350 }),
      });
      if (res.ok) {
        const data = await res.json();
        setRegime(data.market_regime);
        setPortfolio(data.portfolio);
        setStatusMessage(`Cycle Completed (${data.computation_time_ms}ms) -> Top Alpha: ${data.top_strategy.strategy_name} (Sharpe: ${data.top_strategy.annualized_sharpe})`);
        fetchStrategies();
      }
    } catch (e) {
      setStatusMessage('Research cycle request failed');
    }
  };

  const runLabBacktest = async () => {
    setStatusMessage(`Running Vectorized Matrix Backtest for ${labStrategy.toUpperCase()}...`);
    try {
      const res = await fetch('/api/v1/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: labStrategy,
          symbol: 'XAU/USD',
          window: parseInt(labWindow),
          num_std: parseFloat(labStd),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLatestBacktest(data);
        setStatusMessage(`Backtest finished: ${data.strategy_name} -> Return: ${data.total_return_pct}% | Sharpe: ${data.annualized_sharpe}`);
        fetchStrategies();
      }
    } catch (e) {
      setStatusMessage('Backtest request failed');
    }
  };

  const runPairsAnalysis = async () => {
    setStatusMessage(`Running Kalman Filter & Ornstein-Uhlenbeck Pairs Analysis for ${pairsAssetA} vs ${pairsAssetB}...`);
    try {
      const res = await fetch('/api/v1/pairs/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol_a: pairsAssetA,
          symbol_b: pairsAssetB,
          n_bars: 300,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPairsResult(data);
        setStatusMessage(`Pairs Analysis complete: β=${data.pairs_analysis.hedge_ratio_beta} | Half-life=${data.pairs_analysis.ou_half_life_days}d`);
      }
    } catch (e) {
      setStatusMessage('Pairs analysis request failed');
    }
  };

  const submitPaperOrder = async () => {
    setStatusMessage(`Submitting paper order for ${orderQty} ${orderSymbol}...`);
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: orderSymbol,
          side: orderSide,
          quantity: parseFloat(orderQty),
          market_price: goldSpotPrice,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatusMessage(`Order executed: ${data.side} ${data.quantity} ${data.symbol} @ $${data.filled_price} (Status: ${data.status})`);
        fetchPortfolio();
      }
    } catch (e) {
      setStatusMessage('Order submission failed');
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/metrics');
      if (res.ok) {
        const text = await res.text();
        setMetricsText(text);
      }
    } catch (e) {}
  };

  // =========================================================================
  // RENDER DEDICATED SPOT GOLD CHART WITH STRATEGY OVERLAYS & FORWARD ML CONE
  // =========================================================================
  const renderSpotGoldChart = () => {
    if (!goldData || !goldData.candles || goldData.candles.length === 0) {
      return <p style={{ color: '#94a3b8' }}>Loading live Spot Gold candles & strategy overlays...</p>;
    }

    const candles = goldData.candles;
    const traj = goldData.forward_trajectory || [];

    // Collect all price values to compute Y-scale
    const allPrices = [];
    candles.forEach((c) => {
      allPrices.push(c.high, c.low, c.close, c.open);
      if (goldStrategy === 'ema') {
        if (c.ema_fast) allPrices.push(c.ema_fast);
        if (c.ema_slow) allPrices.push(c.ema_slow);
      } else if (goldStrategy === 'bollinger') {
        if (c.boll_upper) allPrices.push(c.boll_upper);
        if (c.boll_lower) allPrices.push(c.boll_lower);
      } else if (goldStrategy === 'ou') {
        if (c.ou_equilibrium) allPrices.push(c.ou_equilibrium);
      }
    });

    traj.forEach((t) => {
      allPrices.push(t.expected_price, t.low_95, t.high_95);
    });

    const minY = Math.min(...allPrices);
    const maxY = Math.max(...allPrices);
    const rangeY = Math.max(1.0, maxY - minY);

    const width = 940;
    const height = 340;
    const padX = 55;
    const padY = 35;

    const totalSteps = candles.length + traj.length - 1;

    const getX = (idx) => padX + (idx / totalSteps) * (width - 2 * padX);
    const getY = (val) => height - padY - ((val - minY) / rangeY) * (height - 2 * padY);

    const candleWidth = Math.max(3, (width - 2 * padX) / totalSteps * 0.65);

    // Build Forward Prediction Trajectory Coordinates
    const nowIdx = candles.length - 1;
    const nowCoord = {
      x: getX(nowIdx),
      y: getY(candles[nowIdx].close),
      lowY: getY(candles[nowIdx].close),
      highY: getY(candles[nowIdx].close),
    };

    const trajCoords = [
      nowCoord,
      ...traj.map((t, i) => ({
        x: getX(nowIdx + 1 + i),
        y: getY(t.expected_price),
        lowY: getY(t.low_95),
        highY: getY(t.high_95),
      })),
    ];

    const trajPath = 'M ' + trajCoords.map((c) => `${c.x},${c.y}`).join(' L ');
    const coneTop = trajCoords.map((c) => `${c.x},${c.highY}`).join(' L ');
    const coneBottom = trajCoords.slice().reverse().map((c) => `${c.x},${c.lowY}`).join(' L ');
    const conePolygon = `M ${coneTop} L ${coneBottom} Z`;

    // Strategy Overlay Lines
    let emaFastPath = '';
    let emaSlowPath = '';
    let bollUpperPath = '';
    let bollMidPath = '';
    let bollLowerPath = '';
    let bollChannelPolygon = '';
    let ouEquilibriumY = null;

    if (goldStrategy === 'ema') {
      const fastPts = candles.map((c, i) => `${getX(i)},${getY(c.ema_fast || c.close)}`).join(' L ');
      emaFastPath = `M ${fastPts}`;
      const slowPts = candles.map((c, i) => `${getX(i)},${getY(c.ema_slow || c.close)}`).join(' L ');
      emaSlowPath = `M ${slowPts}`;
    } else if (goldStrategy === 'bollinger') {
      const upPts = candles.map((c, i) => ({ x: getX(i), y: getY(c.boll_upper || c.close) }));
      const lowPts = candles.map((c, i) => ({ x: getX(i), y: getY(c.boll_lower || c.close) }));
      const midPts = candles.map((c, i) => `${getX(i)},${getY(c.boll_mid || c.close)}`).join(' L ');
      bollUpperPath = 'M ' + upPts.map((p) => `${p.x},${p.y}`).join(' L ');
      bollMidPath = `M ${midPts}`;
      bollLowerPath = 'M ' + lowPts.map((p) => `${p.x},${p.y}`).join(' L ');

      const topSeg = upPts.map((p) => `${p.x},${p.y}`).join(' L ');
      const botSeg = lowPts.slice().reverse().map((p) => `${p.x},${p.y}`).join(' L ');
      bollChannelPolygon = `M ${topSeg} L ${botSeg} Z`;
    } else if (goldStrategy === 'ou' && candles[0].ou_equilibrium) {
      ouEquilibriumY = getY(candles[0].ou_equilibrium);
    }

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ background: '#0a0f1d', borderRadius: '8px', border: '1px solid #1e293b' }}>
        {/* Horizontal Price Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
          const val = minY + frac * rangeY;
          const y = getY(val);
          return (
            <g key={idx}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
              <text x={padX - 8} y={y + 4} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
                ${val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Strategy Layer: Bollinger Bands Channel Fill */}
        {goldStrategy === 'bollinger' && bollChannelPolygon && (
          <path d={bollChannelPolygon} fill="rgba(59, 130, 246, 0.08)" stroke="none" />
        )}

        {/* Strategy Layer: Bollinger Band Upper & Lower Lines */}
        {goldStrategy === 'bollinger' && (
          <>
            <path d={bollUpperPath} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 2" />
            <path d={bollMidPath} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
            <path d={bollLowerPath} fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 2" />
          </>
        )}

        {/* Strategy Layer: O-U Stationary Equilibrium Line */}
        {goldStrategy === 'ou' && ouEquilibriumY !== null && (
          <g>
            <line x1={padX} y1={ouEquilibriumY} x2={width - padX} y2={ouEquilibriumY} stroke="#eab308" strokeWidth="2" strokeDasharray="6 4" />
            <text x={width - padX + 5} y={ouEquilibriumY + 4} fill="#eab308" fontSize="11" fontFamily="monospace" fontWeight="bold">
              μ Equilibrium (${candles[0].ou_equilibrium})
            </text>
          </g>
        )}

        {/* Candlesticks (High/Low Wick + Open/Close Body) */}
        {candles.map((c, i) => {
          const cx = getX(i);
          const yHigh = getY(c.high);
          const yLow = getY(c.low);
          const yOpen = getY(c.open);
          const yClose = getY(c.close);

          const isBull = c.close >= c.open;
          const color = isBull ? '#10b981' : '#ef4444';
          const topBody = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(2, Math.abs(yOpen - yClose));

          return (
            <g key={i}>
              {/* Wick */}
              <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth="1.2" />
              {/* Body */}
              <rect
                x={cx - candleWidth / 2}
                y={topBody}
                width={candleWidth}
                height={bodyHeight}
                fill={isBull ? '#065f46' : '#7f1d1d'}
                stroke={color}
                strokeWidth="1.2"
                rx="1"
              />

              {/* Active Strategy Signal Marker */}
              {c.active_signal === 1 && (
                <polygon points={`${cx},${yLow + 12} ${cx - 5},${yLow + 20} ${cx + 5},${yLow + 20}`} fill="#10b981" />
              )}
              {c.active_signal === -1 && (
                <polygon points={`${cx},${yHigh - 12} ${cx - 5},${yHigh - 20} ${cx + 5},${yHigh - 20}`} fill="#ef4444" />
              )}
            </g>
          );
        })}

        {/* Strategy Layer: Dual EMA Fast & Slow Lines */}
        {goldStrategy === 'ema' && (
          <>
            <path d={emaFastPath} fill="none" stroke="#06b6d4" strokeWidth="2" />
            <path d={emaSlowPath} fill="none" stroke="#a855f7" strokeWidth="2" />
          </>
        )}

        {/* Transition Divider (NOW) */}
        <line x1={nowCoord.x} y1={padY} x2={nowCoord.x} y2={height - padY} stroke="#f97316" strokeDasharray="3 3" strokeWidth="1.8" />
        <circle cx={nowCoord.x} cy={nowCoord.y} r="6" fill="#f97316" stroke="#fff" strokeWidth="2" />
        <text x={nowCoord.x - 14} y={padY - 8} fill="#f97316" fontSize="11" fontWeight="bold">NOW</text>

        {/* Forward Machine Learning 95% Confidence Cone */}
        <path d={conePolygon} fill="rgba(236, 72, 153, 0.16)" stroke="none" />

        {/* Forward ML Trajectory Path */}
        <path d={trajPath} fill="none" stroke="#ec4899" strokeWidth="2.5" strokeDasharray="5 3" />

        {/* Forward Trajectory Milestone Dots */}
        {trajCoords.slice(1).map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r="4" fill="#ec4899" stroke="#fff" strokeWidth="1" />
            <text x={c.x - 8} y={height - 12} fill="#94a3b8" fontSize="10" fontFamily="monospace">
              +{traj[i].step_hour}h
            </text>
          </g>
        ))}

        {/* Top Legends */}
        <text x={padX} y={20} fill="#f8fafc" fontSize="12" fontWeight="bold">
          XAU/USD Live Spot Candles ({goldTimeframe.toUpperCase()})
        </text>

        {goldStrategy === 'ema' && (
          <g>
            <text x={padX + 260} y={20} fill="#06b6d4" fontSize="11" fontWeight="bold">● Fast EMA (12)</text>
            <text x={padX + 380} y={20} fill="#a855f7" fontSize="11" fontWeight="bold">● Slow EMA (26)</text>
          </g>
        )}

        {goldStrategy === 'bollinger' && (
          <g>
            <text x={padX + 260} y={20} fill="#ef4444" fontSize="11" fontWeight="bold">● Upper Band</text>
            <text x={padX + 370} y={20} fill="#3b82f6" fontSize="11" fontWeight="bold">● 20-SMA</text>
            <text x={padX + 450} y={20} fill="#10b981" fontSize="11" fontWeight="bold">● Lower Band</text>
          </g>
        )}

        <text x={nowCoord.x + 18} y={20} fill="#ec4899" fontSize="12" fontWeight="bold">
          ► ML Forward Horizon Forecast & 95% Confidence Cone
        </text>
      </svg>
    );
  };

  // Helper for live pairs prediction chart
  const renderPredictionChart = () => {
    if (!livePrediction || !livePrediction.historical_spreads || livePrediction.historical_spreads.length === 0) {
      return <p style={{ color: '#94a3b8' }}>Loading real-time predictive trajectory...</p>;
    }

    const hist = livePrediction.historical_spreads;
    const traj = livePrediction.trajectory;

    const allValues = [
      ...hist,
      ...traj.map((t) => t.expected_spread),
      ...traj.map((t) => t.low_95),
      ...traj.map((t) => t.high_95),
      livePrediction.ou_mu,
    ];

    const minY = Math.min(...allValues);
    const maxY = Math.max(...allValues);
    const rangeY = Math.max(1e-5, maxY - minY);

    const width = 760;
    const height = 240;
    const padX = 40;
    const padY = 30;

    const totalSteps = hist.length + traj.length - 1;

    const getX = (idx) => padX + (idx / totalSteps) * (width - 2 * padX);
    const getY = (val) => height - padY - ((val - minY) / rangeY) * (height - 2 * padY);

    const histPoints = hist.map((val, i) => `${getX(i)},${getY(val)}`).join(' L ');
    const histPath = `M ${histPoints}`;

    const startIdx = hist.length - 1;
    const trajCoords = [
      { x: getX(startIdx), y: getY(hist[startIdx]), lowY: getY(hist[startIdx]), highY: getY(hist[startIdx]) },
      ...traj.map((t, i) => ({
        x: getX(startIdx + 1 + i),
        y: getY(t.expected_spread),
        lowY: getY(t.low_95),
        highY: getY(t.high_95),
      })),
    ];

    const trajPath = 'M ' + trajCoords.map((c) => `${c.x},${c.y}`).join(' L ');
    const coneTop = trajCoords.map((c) => `${c.x},${c.highY}`).join(' L ');
    const coneBottom = trajCoords.slice().reverse().map((c) => `${c.x},${c.lowY}`).join(' L ');
    const conePolygon = `M ${coneTop} L ${coneBottom} Z`;

    const muY = getY(livePrediction.ou_mu);

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ background: '#0a0f1d', borderRadius: '8px', border: '1px solid #1e293b' }}>
        <line x1={padX} y1={muY} x2={width - padX} y2={muY} stroke="#eab308" strokeDasharray="4 4" strokeWidth="1.5" />
        <text x={width - padX + 5} y={muY + 4} fill="#eab308" fontSize="11" fontFamily="monospace">μ (Equilibrium)</text>
        <path d={conePolygon} fill="rgba(168, 85, 247, 0.15)" stroke="none" />
        <path d={histPath} fill="none" stroke="#38bdf8" strokeWidth="2.5" />
        <path d={trajPath} fill="none" stroke="#ec4899" strokeWidth="2.5" strokeDasharray="5 3" />
        {trajCoords.slice(1).map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r="4.5" fill="#ec4899" />
            <text x={c.x - 10} y={height - 10} fill="#94a3b8" fontSize="10" fontFamily="monospace">
              +{traj[i].horizon_hours}h
            </text>
          </g>
        ))}
        <line x1={getX(startIdx)} y1={padY} x2={getX(startIdx)} y2={height - padY} stroke="#f97316" strokeDasharray="2 2" strokeWidth="1.5" />
        <circle cx={getX(startIdx)} cy={getY(hist[startIdx])} r="6" fill="#f97316" stroke="#fff" strokeWidth="1.5" />
        <text x={getX(startIdx) - 15} y={padY - 8} fill="#f97316" fontSize="11" fontWeight="bold">NOW</text>
        <text x={padX} y={20} fill="#38bdf8" fontSize="12" fontWeight="bold">Historical Spread (Past 30 Bars)</text>
        <text x={getX(startIdx) + 20} y={20} fill="#ec4899" fontSize="12" fontWeight="bold">► Forecast Trajectory (Ornstein-Uhlenbeck + 95% Cone)</text>
      </svg>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f8fafc', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
            QUANT SENTINEL <span style={{ fontSize: '13px', background: '#065f46', color: '#d1fae5', padding: '3px 8px', borderRadius: '4px', marginLeft: '8px' }}>v1.2.0 LIVE</span>
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#94a3b8' }}>
            Spot Gold Quantitative Terminal: Live Strategy Appearance Overlays & Machine Learning Direction Forecaster
          </p>
        </div>
        <div style={{ display: 'flex', gap: '14px', fontSize: '13px' }}>
          <div style={{ background: '#111827', padding: '8px 12px', borderRadius: '6px' }}>
            Equity: <strong style={{ color: '#10b981' }}>${portfolio.equity.toLocaleString()}</strong>
          </div>
          <div style={{ background: '#111827', padding: '8px 12px', borderRadius: '6px' }}>
            Cash: <strong style={{ color: '#38bdf8' }}>${portfolio.cash.toLocaleString()}</strong>
          </div>
          <div style={{ background: '#111827', padding: '8px 12px', borderRadius: '6px' }}>
            Regime: <strong style={{ color: '#f59e0b' }}>{goldData?.market_regime || regime}</strong>
          </div>
        </div>
      </header>

      {/* Live Status Banner */}
      <div style={{ margin: '16px 0', padding: '10px 16px', background: '#0f172a', borderLeft: '4px solid #10b981', borderRadius: '4px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>● {statusMessage}</span>
        <button
          onClick={runFullResearch}
          style={{ background: '#059669', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
        >
          ⚡ Trigger Autonomous Swarm Research Cycle
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[
          { id: 'gold', label: '🥇 Spot Gold Terminal (Live Chart & ML)' },
          { id: 'predict', label: '🔮 Live Pairs Predictor' },
          { id: 'leaderboard', label: '🏆 Alpha Hypothesis Leaderboard' },
          { id: 'lab', label: '🔬 Vectorized Backtest Lab' },
          { id: 'pairs', label: '⚖️ Statistical Arbitrage (Pairs)' },
          { id: 'execution', label: '📈 Paper Order Hub' },
          { id: 'metrics', label: '📊 Prometheus Metrics', onClick: fetchMetrics },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.onClick) tab.onClick();
            }}
            style={{
              padding: '10px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              background: activeTab === tab.id ? '#059669' : '#111827',
              color: '#f8fafc',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB: SPOT GOLD TERMINAL (LIVE CANDLESTICKS, STRATEGY OVERLAYS & ML)       */}
      {/* ========================================================================= */}
      {activeTab === 'gold' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Gold Controls & Timeframe Bar (Matching OANDA / TradingView Tabs) */}
          <div style={{ background: '#111827', padding: '16px 20px', borderRadius: '8px', border: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            {/* Timeframe Switcher (1h, 4h, 1D) */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 'bold' }}>Timeframe:</span>
              {[
                { id: '1h', label: '1h (Hourly)' },
                { id: '4h', label: '4h (4-Hour)' },
                { id: '1D', label: '1D (Daily)' },
              ].map((tf) => (
                <button
                  key={tf.id}
                  onClick={() => {
                    setGoldTimeframe(tf.id);
                    fetchGoldAnalysis(tf.id, goldStrategy, goldSpotPrice);
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '5px',
                    border: '1px solid ' + (goldTimeframe === tf.id ? '#10b981' : '#374151'),
                    background: goldTimeframe === tf.id ? '#065f46' : '#1f2937',
                    color: goldTimeframe === tf.id ? '#a7f3d0' : '#d1d5db',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Custom Benchmark Spot Price Input */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 'bold' }}>Spot Reference ($):</label>
              <input
                type="number"
                step="0.01"
                value={goldSpotPrice}
                onChange={(e) => setGoldSpotPrice(parseFloat(e.target.value) || 3984.66)}
                style={{ background: '#1f2937', color: '#f8fafc', border: '1px solid #374151', padding: '6px 10px', borderRadius: '4px', width: '110px', fontWeight: 'bold' }}
              />
              <button
                onClick={() => fetchGoldAnalysis(goldTimeframe, goldStrategy, goldSpotPrice)}
                disabled={loadingGold}
                style={{ background: '#059669', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
              >
                {loadingGold ? 'Analyzing...' : '⚡ Refresh Analysis'}
              </button>
              <button
                onClick={() => setGoldAutoRefresh(!goldAutoRefresh)}
                style={{
                  background: goldAutoRefresh ? '#065f46' : '#374151',
                  color: goldAutoRefresh ? '#a7f3d0' : '#d1d5db',
                  border: '1px solid ' + (goldAutoRefresh ? '#10b981' : '#4b5563'),
                  padding: '6px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 'bold',
                }}
              >
                {goldAutoRefresh ? '● Live Polling' : '○ Paused'}
              </button>
            </div>
          </div>

          {goldData && (
            <>
              {/* Hero Spot Gold Price & Microstructure Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div style={{ background: '#111827', padding: '16px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>XAU/USD Spot Quote</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px', color: '#eab308' }}>
                    ${goldData.current_spot_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '4px', color: goldData.daily_change_pct >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                    {goldData.daily_change_pct >= 0 ? '+' : ''}{goldData.daily_change_pct}% (${goldData.daily_change_dollars >= 0 ? '+' : ''}{goldData.daily_change_dollars.toFixed(2)})
                  </div>
                </div>

                <div style={{ background: '#111827', padding: '16px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Parkinson & GK Volatility</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '4px', color: '#38bdf8' }}>
                    {goldData.parkinson_volatility_pct}% <span style={{ fontSize: '12px', color: '#94a3b8' }}>Parkinson</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#a855f7', marginTop: '4px' }}>
                    Garman-Klass: <strong>{goldData.garman_klass_volatility_pct}%</strong>
                  </div>
                </div>

                <div style={{ background: '#111827', padding: '16px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Cross-Asset Valuations</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px', color: '#f59e0b' }}>
                    ¥{goldData.macro_gold_in_jpy.toLocaleString()} <span style={{ fontSize: '11px', color: '#94a3b8' }}>Gold in Yen</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    BTC / Gold Ratio: <strong>{goldData.macro_btc_to_gold_ratio}x</strong>
                  </div>
                </div>

                <div style={{ background: '#111827', padding: '16px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Market Regime & Bias</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px', color: '#10b981' }}>
                    {goldData.market_regime}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Hourly Vol σ₁ₕ: <strong>{goldData.hourly_volatility_pct}%</strong>
                  </div>
                </div>
              </div>

              {/* Strategy Overlays Selector Pills directly above live chart */}
              <div style={{ background: '#111827', padding: '14px 20px', borderRadius: '8px', border: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 'bold' }}>
                  📊 Strategy Appearance on Chart (Switch to see indicators on candles):
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { id: 'ema', label: '⚡ Dual EMA Cross (12/26)' },
                    { id: 'bollinger', label: '🌊 Bollinger Bands (20, 2σ)' },
                    { id: 'rsi', label: '🎯 RSI Momentum (14)' },
                    { id: 'ou', label: '⚖️ O-U Equilibrium' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setGoldStrategy(s.id);
                        fetchGoldAnalysis(goldTimeframe, s.id, goldSpotPrice);
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: '1px solid ' + (goldStrategy === s.id ? '#059669' : '#374151'),
                        background: goldStrategy === s.id ? '#059669' : '#1f2937',
                        color: '#f8fafc',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Candlestick & Machine Learning Forecast Chart */}
              <div style={{ background: '#111827', padding: '20px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                {renderSpotGoldChart()}
              </div>

              {/* Active Strategy Analysis & Current Signal Banner */}
              {goldData.strategies[goldStrategy] && (
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: '8px',
                    background:
                      goldData.strategies[goldStrategy].current_signal === 'BUY'
                        ? 'linear-gradient(90deg, #064e3b 0%, #022c22 100%)'
                        : goldData.strategies[goldStrategy].current_signal === 'SELL'
                        ? 'linear-gradient(90deg, #7f1d1d 0%, #450a0a 100%)'
                        : 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)',
                    border:
                      '1px solid ' +
                      (goldData.strategies[goldStrategy].current_signal === 'BUY'
                        ? '#10b981'
                        : goldData.strategies[goldStrategy].current_signal === 'SELL'
                        ? '#ef4444'
                        : '#3b82f6'),
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {goldData.strategies[goldStrategy].strategy_name} — Active Strategy Signal
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: '#f8fafc', marginTop: '2px' }}>
                      {goldData.strategies[goldStrategy].current_signal} SIGNAL
                    </div>
                    <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>
                      {goldData.strategies[goldStrategy].thesis}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '20px', textAlign: 'right' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Sharpe Ratio</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#38bdf8' }}>
                        {goldData.strategies[goldStrategy].annualized_sharpe}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total Return</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: goldData.strategies[goldStrategy].total_return_pct >= 0 ? '#10b981' : '#ef4444' }}>
                        {goldData.strategies[goldStrategy].total_return_pct}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Win Rate</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>
                        {goldData.strategies[goldStrategy].win_rate_pct}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Trades</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f8fafc' }}>
                        {goldData.strategies[goldStrategy].total_trades}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Machine Learning Forward Direction Forecast Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                {/* 1-Hour Horizon Prediction Card */}
                <div style={{ background: '#111827', padding: '20px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#10b981' }}>🔮 1-Hour Forward Probabilistic Target</h3>
                    <span style={{ fontSize: '12px', background: '#064e3b', color: '#a7f3d0', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                      1-HOUR FORECAST
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '14px' }}>
                    <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Most Probable Median</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#38bdf8' }}>
                        ${goldData.forecast_1h.median_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '11px', color: goldData.forecast_1h.expected_change_pct >= 0 ? '#10b981' : '#ef4444', marginTop: '2px' }}>
                        {goldData.forecast_1h.expected_change_pct > 0 ? '+' : ''}{goldData.forecast_1h.expected_change_pct}% expected shift
                      </div>
                    </div>

                    <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Directional Probabilities</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px' }}>
                        <span style={{ color: '#10b981' }}>▲ {goldData.forecast_1h.prob_up}% Up</span>
                        <span style={{ color: '#94a3b8', margin: '0 6px' }}>|</span>
                        <span style={{ color: '#ef4444' }}>▼ {goldData.forecast_1h.prob_down}% Dn</span>
                      </div>
                    </div>

                    <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Expected Parkinson Range</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc', marginTop: '4px' }}>
                        ${goldData.forecast_1h.expected_low.toFixed(2)} — ${goldData.forecast_1h.expected_high.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Spread: ${goldData.forecast_1h.expected_range_dollars}</div>
                    </div>

                    <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>95% Confidence Band</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#a855f7', marginTop: '4px' }}>
                        ${goldData.forecast_1h.low_95.toFixed(2)} — ${goldData.forecast_1h.high_95.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>2.5% to 97.5% Percentile</div>
                    </div>
                  </div>
                </div>

                {/* 24-Hour Horizon Prediction Card */}
                <div style={{ background: '#111827', padding: '20px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#f59e0b' }}>🔮 24-Hour Forward Horizon Target</h3>
                    <span style={{ fontSize: '12px', background: '#78350f', color: '#fde68a', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                      24-HOUR FORECAST
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '14px' }}>
                    <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>24h Expected Median</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>
                        ${goldData.forecast_24h.median_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '11px', color: goldData.forecast_24h.expected_change_pct >= 0 ? '#10b981' : '#ef4444', marginTop: '2px' }}>
                        {goldData.forecast_24h.expected_change_pct > 0 ? '+' : ''}{goldData.forecast_24h.expected_change_pct}% expected shift
                      </div>
                    </div>

                    <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Directional Probabilities</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px' }}>
                        <span style={{ color: '#10b981' }}>▲ {goldData.forecast_24h.prob_up}% Up</span>
                        <span style={{ color: '#94a3b8', margin: '0 6px' }}>|</span>
                        <span style={{ color: '#ef4444' }}>▼ {goldData.forecast_24h.prob_down}% Dn</span>
                      </div>
                    </div>

                    <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Expected 24h High/Low</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc', marginTop: '4px' }}>
                        ${goldData.forecast_24h.expected_low.toFixed(2)} — ${goldData.forecast_24h.expected_high.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Intraday Range: ${goldData.forecast_24h.expected_range_dollars}</div>
                    </div>

                    <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>95% Confidence Band</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#a855f7', marginTop: '4px' }}>
                        ${goldData.forecast_24h.low_95.toFixed(2)} — ${goldData.forecast_24h.high_95.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>99% Tail: [${goldData.forecast_24h.low_99.toFixed(2)} — ${goldData.forecast_24h.high_99.toFixed(2)}]</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Forward Schedule Trajectory Table */}
              <div style={{ background: '#111827', padding: '20px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#10b981' }}>
                  📋 Machine Learning Forward Target Schedule (+1h to +12h Forward Projections)
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #374151', color: '#94a3b8' }}>
                        <th style={{ padding: '8px 10px' }}>Forecast Horizon</th>
                        <th style={{ padding: '8px 10px' }}>Expected Median Price</th>
                        <th style={{ padding: '8px 10px' }}>95% Confidence Interval [Low / High]</th>
                        <th style={{ padding: '8px 10px' }}>Expected Relative Shift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goldData.forward_trajectory.map((t, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #1f2937' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#ec4899' }}>+{t.step_hour}h Forward</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 'bold', color: '#f8fafc' }}>
                            ${t.expected_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#a855f7' }}>
                            [${t.low_95.toFixed(2)} , ${t.high_95.toFixed(2)}]
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 'bold', color: t.expected_change_pct >= 0 ? '#10b981' : '#ef4444' }}>
                            {t.expected_change_pct > 0 ? '+' : ''}{t.expected_change_pct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: LIVE AUTO-LEARNING PREDICTOR                                      */}
      {/* ========================================================================= */}
      {activeTab === 'predict' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#111827', padding: '16px 20px', borderRadius: '8px', border: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 'bold' }}>Target Trading Pair:</label>
              <select
                value={livePairKey}
                onChange={(e) => {
                  setLivePairKey(e.target.value);
                  fetchLivePrediction(e.target.value);
                }}
                style={{ background: '#1f2937', color: '#f8fafc', border: '1px solid #374151', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold' }}
              >
                <option value="BTC/USD__ETH/USD">BTC/USD vs ETH/USD (Live Public Exchange)</option>
                <option value="XAU/USD__JPY/USD">XAU/USD vs JPY/USD (Physical Gold in Yen)</option>
                <option value="BTC/USD__XAU/USD">BTC/USD vs XAU/USD (Digital vs Physical Gold)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Source: <strong style={{ color: '#38bdf8' }}>{livePrediction?.data_source || 'Exchange Stream'}</strong>
              </span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                style={{
                  background: autoRefresh ? '#065f46' : '#374151',
                  color: autoRefresh ? '#a7f3d0' : '#d1d5db',
                  border: '1px solid ' + (autoRefresh ? '#10b981' : '#4b5563'),
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                {autoRefresh ? '● Auto-Learning (Active 3s)' : '○ Auto-Refresh Paused'}
              </button>
              <button
                onClick={() => fetchLivePrediction(livePairKey)}
                disabled={loadingPrediction}
                style={{ background: '#059669', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
              >
                {loadingPrediction ? 'Learning...' : '⚡ Predict Now'}
              </button>
            </div>
          </div>

          {livePrediction && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div style={{ background: '#111827', padding: '16px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Live Quotes ({livePrediction.symbol_a} / {livePrediction.symbol_b})</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '6px', color: '#38bdf8' }}>
                    ${livePrediction.spot_a.toLocaleString()} / ${livePrediction.spot_b.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Ratio: <strong>{livePrediction.price_ratio}</strong>
                  </div>
                </div>

                <div style={{ background: '#111827', padding: '16px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Adaptive Kalman Elasticity (β)</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '6px', color: '#a855f7' }}>
                    {livePrediction.hedge_ratio_beta > 0 ? '+' : ''}{livePrediction.hedge_ratio_beta}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Robbins-Monro Rate η: <strong>{livePrediction.learning_rate}</strong>
                  </div>
                </div>

                <div style={{ background: '#111827', padding: '16px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Online Prediction Accuracy</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '6px', color: '#10b981' }}>
                    {livePrediction.online_accuracy_pct}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Evals: <strong>{livePrediction.total_evaluations} calls scored</strong>
                  </div>
                </div>

                <div style={{ background: '#111827', padding: '16px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Spread Z-Score & Half-Life</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '6px', color: Math.abs(livePrediction.current_z_score) > 1.5 ? '#f59e0b' : '#38bdf8' }}>
                    {livePrediction.current_z_score > 0 ? '+' : ''}{livePrediction.current_z_score} σ
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Half-Life t₁/₂: <strong>{livePrediction.half_life_hours} hours</strong>
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '8px',
                  background:
                    livePrediction.action_signal.includes('BUY')
                      ? 'linear-gradient(90deg, #064e3b 0%, #022c22 100%)'
                      : livePrediction.action_signal.includes('SELL')
                      ? 'linear-gradient(90deg, #7f1d1d 0%, #450a0a 100%)'
                      : 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)',
                  border:
                    '1px solid ' +
                    (livePrediction.action_signal.includes('BUY')
                      ? '#10b981'
                      : livePrediction.action_signal.includes('SELL')
                      ? '#ef4444'
                      : '#3b82f6'),
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Live Auto-Learning Predictive Recommendation
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: '#f8fafc', marginTop: '2px' }}>
                    {livePrediction.action_signal}
                  </div>
                  <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>{livePrediction.action_thesis}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Stationary Target (μ)</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', color: '#eab308' }}>
                    {livePrediction.ou_mu > 0 ? '+' : ''}{livePrediction.ou_mu}
                  </div>
                </div>
              </div>

              <div style={{ background: '#111827', padding: '20px', borderRadius: '8px', border: '1px solid #1f2937' }}>
                <h2 style={{ fontSize: '16px', color: '#10b981', marginTop: 0, marginBottom: '14px' }}>
                  📈 Real-Time Spread & Forward Projection Trajectory (Ornstein-Uhlenbeck SDE)
                </h2>
                {renderPredictionChart()}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Leaderboard */}
      {activeTab === 'leaderboard' && (
        <div style={{ background: '#111827', padding: '20px', borderRadius: '8px', border: '1px solid #1f2937' }}>
          <h2 style={{ fontSize: '17px', color: '#10b981', marginTop: 0 }}>🏆 Evaluated Alpha Strategies Leaderboard</h2>
          <div style={{ overflowX: 'auto', marginTop: '12px' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #374151', color: '#94a3b8' }}>
                  <th style={{ padding: '10px' }}>Strategy Name</th>
                  <th style={{ padding: '10px' }}>Symbol</th>
                  <th style={{ padding: '10px' }}>Annualized Sharpe</th>
                  <th style={{ padding: '10px' }}>Sortino Ratio</th>
                  <th style={{ padding: '10px' }}>Total Return</th>
                  <th style={{ padding: '10px' }}>Max Drawdown</th>
                  <th style={{ padding: '10px' }}>Win Rate</th>
                  <th style={{ padding: '10px' }}>Trades</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #1f2937' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#38bdf8' }}>{s.strategy_name}</td>
                    <td style={{ padding: '10px' }}>{s.symbol}</td>
                    <td style={{ padding: '10px', color: s.annualized_sharpe > 1.0 ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                      {s.annualized_sharpe}
                    </td>
                    <td style={{ padding: '10px' }}>{s.sortino_ratio}</td>
                    <td style={{ padding: '10px', color: s.total_return_pct >= 0 ? '#10b981' : '#ef4444' }}>
                      {s.total_return_pct}%
                    </td>
                    <td style={{ padding: '10px', color: '#ef4444' }}>{s.max_drawdown_pct}%</td>
                    <td style={{ padding: '10px' }}>{s.win_rate_pct}%</td>
                    <td style={{ padding: '10px' }}>{s.total_trades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Backtest Lab */}
      {activeTab === 'lab' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          <div style={{ background: '#111827', padding: '20px', borderRadius: '8px', border: '1px solid #1f2937' }}>
            <h2 style={{ fontSize: '17px', color: '#10b981', marginTop: 0 }}>🔬 Parameter Tuning</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Strategy Archetype:</label>
                <select
                  value={labStrategy}
                  onChange={(e) => setLabStrategy(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: '#1f2937', color: 'white', border: '1px solid #374151', borderRadius: '4px', marginTop: '4px' }}
                >
                  <option value="bollinger">Bollinger Mean-Reversion</option>
                  <option value="ema">Dual EMA Trend Cross</option>
                  <option value="rsi">RSI Momentum Breakout</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Rolling Window ({labWindow} bars):</label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={labWindow}
                  onChange={(e) => setLabWindow(e.target.value)}
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Standard Deviation Mult ({labStd}x):</label>
                <input
                  type="range"
                  min="1.0"
                  max="3.5"
                  step="0.1"
                  value={labStd}
                  onChange={(e) => setLabStd(e.target.value)}
                  style={{ width: '100%', marginTop: '4px' }}
                />
              </div>
              <button
                onClick={runLabBacktest}
                style={{ padding: '10px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Run Zero-Loop Matrix Backtest
              </button>
            </div>
          </div>

          <div style={{ background: '#111827', padding: '20px', borderRadius: '8px', border: '1px solid #1f2937' }}>
            <h2 style={{ fontSize: '17px', color: '#10b981', marginTop: 0 }}>📊 Backtest Simulation Results</h2>
            {latestBacktest ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
                <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Return</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: latestBacktest.total_return_pct >= 0 ? '#10b981' : '#ef4444' }}>
                    {latestBacktest.total_return_pct}%
                  </div>
                </div>
                <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Annualized Sharpe</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#38bdf8' }}>{latestBacktest.annualized_sharpe}</div>
                </div>
                <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Max Drawdown</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>{latestBacktest.max_drawdown_pct}%</div>
                </div>
                <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Sortino Ratio</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#a855f7' }}>{latestBacktest.sortino_ratio}</div>
                </div>
                <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Win Rate</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>{latestBacktest.win_rate_pct}%</div>
                </div>
                <div style={{ background: '#1f2937', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Trades</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{latestBacktest.total_trades}</div>
                </div>
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>Configure strategy parameters and click "Run Zero-Loop Matrix Backtest".</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Pairs Trading */}
      {activeTab === 'pairs' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          <div style={{ background: '#111827', padding: '20px', borderRadius: '8px', border: '1px solid #1f2937' }}>
            <h2 style={{ fontSize: '17px', color: '#10b981', marginTop: 0 }}>⚖️ Pairs Cointegration Lab</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Asset A:</label>
                <input
                  type="text"
                  value={pairsAssetA}
                  onChange={(e) => setPairsAssetA(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: '#1f2937', color: 'white', border: '1px solid #374151', borderRadius: '4px', marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Asset B:</label>
                <input
                  type="text"
                  value={pairsAssetB}
                  onChange={(e) => setPairsAssetB(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: '#1f2937', color: 'white', border: '1px solid #374151', borderRadius: '4px', marginTop: '4px' }}
                />
              </div>
              <button
                onClick={runPairsAnalysis}
                style={{ padding: '10px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Run Kalman & O-U Analysis
              </button>
            </div>
          </div>

          <div style={{ background: '#111827', padding: '20px', borderRadius: '8px', border: '1px solid #1f2937' }}>
            <h2 style={{ fontSize: '17px', color: '#10b981', marginTop: 0 }}>📊 Statistical Arbitrage Results</h2>
            {pairsResult ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginTop: '16px' }}>
                <div style={{ background: '#1f2937', padding: '14px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Dynamic Kalman Hedge Ratio (β)</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#38bdf8' }}>{pairsResult.pairs_analysis.hedge_ratio_beta}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>O-U Speed (θ): {pairsResult.pairs_analysis.ou_theta}</div>
                </div>
                <div style={{ background: '#1f2937', padding: '14px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Spread Z-Score & Half-Life</div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#10b981' }}>{pairsResult.pairs_analysis.current_z_score} σ</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Half-Life: {pairsResult.pairs_analysis.ou_half_life_days} days</div>
                </div>
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>Click "Run Kalman & O-U Analysis" to estimate dynamic hedge ratio and mean-reversion metrics.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Execution Hub */}
      {activeTab === 'execution' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
          <div style={{ background: '#111827', padding: '20px', borderRadius: '8px', border: '1px solid #1f2937' }}>
            <h2 style={{ fontSize: '17px', color: '#10b981', marginTop: 0 }}>📈 Paper Order Ticket</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Asset Symbol:</label>
                <input
                  type="text"
                  value={orderSymbol}
                  onChange={(e) => setOrderSymbol(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: '#1f2937', color: 'white', border: '1px solid #374151', borderRadius: '4px', marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Order Side:</label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button
                    onClick={() => setOrderSide('BUY')}
                    style={{ flex: 1, padding: '8px', background: orderSide === 'BUY' ? '#059669' : '#374151', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    BUY
                  </button>
                  <button
                    onClick={() => setOrderSide('SELL')}
                    style={{ flex: 1, padding: '8px', background: orderSide === 'SELL' ? '#dc2626' : '#374151', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    SELL
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Quantity:</label>
                <input
                  type="number"
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: '#1f2937', color: 'white', border: '1px solid #374151', borderRadius: '4px', marginTop: '4px' }}
                />
              </div>
              <button
                onClick={submitPaperOrder}
                style={{ padding: '10px', background: orderSide === 'BUY' ? '#059669' : '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Submit Paper Order
              </button>
            </div>
          </div>

          <div style={{ background: '#111827', padding: '20px', borderRadius: '8px', border: '1px solid #1f2937' }}>
            <h2 style={{ fontSize: '17px', color: '#10b981', marginTop: 0 }}>💼 Active Portfolio Positions</h2>
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #374151', color: '#94a3b8' }}>
                    <th style={{ padding: '8px' }}>Symbol</th>
                    <th style={{ padding: '8px' }}>Quantity</th>
                    <th style={{ padding: '8px' }}>Entry Price</th>
                    <th style={{ padding: '8px' }}>Current Price</th>
                    <th style={{ padding: '8px' }}>Unrealized PnL</th>
                    <th style={{ padding: '8px' }}>Realized PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(portfolio.positions).map((pos) => (
                    <tr key={pos.symbol} style={{ borderBottom: '1px solid #1f2937' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: '#38bdf8' }}>{pos.symbol}</td>
                      <td style={{ padding: '8px' }}>{pos.quantity}</td>
                      <td style={{ padding: '8px' }}>${pos.entry_price.toLocaleString()}</td>
                      <td style={{ padding: '8px' }}>${pos.current_price.toLocaleString()}</td>
                      <td style={{ padding: '8px', color: pos.unrealized_pnl >= 0 ? '#10b981' : '#ef4444' }}>
                        ${pos.unrealized_pnl.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px', color: pos.realized_pnl >= 0 ? '#10b981' : '#ef4444' }}>
                        ${pos.realized_pnl.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Metrics */}
      {activeTab === 'metrics' && (
        <div style={{ background: '#111827', padding: '20px', borderRadius: '8px', border: '1px solid #1f2937' }}>
          <h2 style={{ fontSize: '17px', color: '#10b981', marginTop: 0 }}>📊 Prometheus Exposition Telemetry (/metrics)</h2>
          <pre style={{ background: '#030712', padding: '16px', borderRadius: '6px', fontSize: '12px', color: '#34d399', overflowX: 'auto' }}>
            {metricsText || 'Loading Prometheus metrics...'}
          </pre>
        </div>
      )}
    </div>
  );
}
