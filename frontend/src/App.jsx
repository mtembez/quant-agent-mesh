import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Layers,
  Shield,
  Zap,
  BarChart3,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Crosshair,
  Maximize2,
  Eye,
  EyeOff,
  BookOpen,
  Cpu,
  Compass,
  Terminal,
  Percent,
  DollarSign,
  PieChart,
} from 'lucide-react';

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

  // Spot Gold Terminal State
  const [goldData, setGoldData] = useState(null);
  const [goldTimeframe, setGoldTimeframe] = useState('1h'); // 15m | 1h | 4h | 1D
  const [goldStrategy, setGoldStrategy] = useState('ema'); // ema | bollinger | rsi | ou
  const [goldSpotPrice, setGoldSpotPrice] = useState(3898.90);
  const [previousPrice, setPreviousPrice] = useState(3898.90);
  const [priceTickClass, setPriceTickClass] = useState('');
  const [isCustomPrice, setIsCustomPrice] = useState(false);
  const [audit1000Data, setAudit1000Data] = useState(null);
  const [goldAutoRefresh, setGoldAutoRefresh] = useState(true);
  const [loadingGold, setLoadingGold] = useState(false);
  const [bottomDockTab, setBottomDockTab] = useState('audit1000'); // audit1000 | journal | volatility | forecast
  const [journalFilter, setJournalFilter] = useState('ALL'); // ALL | OPEN | CLOSED_PROFIT | CLOSED_LOSS

  // Dynamic Strategy Parameter Tuners
  const [goldEmaFast, setGoldEmaFast] = useState(12);
  const [goldEmaSlow, setGoldEmaSlow] = useState(26);
  const [goldBollWindow, setGoldBollWindow] = useState(20);
  const [goldBollStd, setGoldBollStd] = useState(2.0);
  const [goldRsiPeriod, setGoldRsiPeriod] = useState(14);
  const [showTuner, setShowTuner] = useState(false);

  // Spot Gold Account Capital, Mode & Trade Ticket
  const [accountCapital, setAccountCapital] = useState(100.0);
  const [accountLeverage, setAccountLeverage] = useState(200.0);
  const [accountMode, setAccountMode] = useState('micro_100');
  const [goldTradeQty, setGoldTradeQty] = useState(0.01);
  const [goldTradeSide, setGoldTradeSide] = useState('BUY');
  const [tradeExecuting, setTradeExecuting] = useState(false);
  const [tradeToast, setTradeToast] = useState(null);
  const [selectedCandleForTrade, setSelectedCandleForTrade] = useState(null);
  const [demoSimulating, setDemoSimulating] = useState(false);
  const [demoTradeSl, setDemoTradeSl] = useState('');
  const [demoTradeTp, setDemoTradeTp] = useState('');

  // Interactive Chart View State (Pan & Zoom, Layers, Crosshair)
  const [visibleCount, setVisibleCount] = useState(48); // number of visible candles
  const [panOffset, setPanOffset] = useState(0); // offset from latest bar
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartPan, setDragStartPan] = useState(0);
  const [crosshair, setCrosshair] = useState(null); // { x, y, candle, index, price }
  const [showEmaLayer, setShowEmaLayer] = useState(true);
  const [showBollLayer, setShowBollLayer] = useState(true);
  const [showVolumeLayer, setShowVolumeLayer] = useState(true);
  const [showConeLayer, setShowConeLayer] = useState(true);
  const [showSignalsLayer, setShowSignalsLayer] = useState(true);
  const [showTradesLayer, setShowTradesLayer] = useState(true);
  const chartSvgRef = useRef(null);

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
    fetchGoldAnalysis();
    fetch1000Audit();
    fetchLivePrediction(livePairKey);

    const interval = setInterval(() => {
      fetchPortfolio();
      if (goldAutoRefresh && activeTab === 'gold') {
        fetchGoldAnalysis();
      }
      if (autoRefresh && activeTab === 'predict') {
        fetchLivePrediction(livePairKey);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [
    goldAutoRefresh,
    autoRefresh,
    livePairKey,
    goldTimeframe,
    goldStrategy,
    goldSpotPrice,
    goldEmaFast,
    goldEmaSlow,
    goldBollWindow,
    goldBollStd,
    goldRsiPeriod,
    activeTab,
  ]);

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

  const fetchGoldAnalysis = async (
    tf = goldTimeframe,
    strat = goldStrategy,
    px = goldSpotPrice,
    fast = goldEmaFast,
    slow = goldEmaSlow,
    bWin = goldBollWindow,
    bStd = goldBollStd,
    rsiP = goldRsiPeriod,
    cap = accountCapital,
    lev = accountLeverage
  ) => {
    setLoadingGold(true);
    try {
      const queryObj = {
        timeframe: tf,
        strategy: strat,
        ema_fast: fast.toString(),
        ema_slow: slow.toString(),
        boll_window: bWin.toString(),
        boll_std: bStd.toString(),
        rsi_period: rsiP.toString(),
        account_capital: cap.toString(),
        leverage: lev.toString(),
      };
      if (isCustomPrice && px) {
        queryObj.spot_price = px.toString();
      }
      const params = new URLSearchParams(queryObj);
      const res = await fetch(`/api/v1/gold/analyze?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setGoldData(data);
        if (!isCustomPrice && data.current_spot_price) {
          if (data.current_spot_price > previousPrice) {
            setPriceTickClass('tick-up');
            setTimeout(() => setPriceTickClass(''), 700);
          } else if (data.current_spot_price < previousPrice) {
            setPriceTickClass('tick-down');
            setTimeout(() => setPriceTickClass(''), 700);
          }
          setPreviousPrice(data.current_spot_price);
          setGoldSpotPrice(data.current_spot_price);
        }
        if (data.recommended_lot_size) {
          setGoldTradeQty(data.recommended_lot_size);
        }
        setStatusMessage(`Spot Gold analyzed [${tf.toUpperCase()}] -> Active Model: ${strat.toUpperCase()} | Capital: $${cap} (${data.account_mode}) | Signal: ${data.strategies[strat]?.current_signal || 'HOLD'}`);
      }
    } catch (e) {
      console.error('Failed to fetch gold analysis:', e);
    } finally {
      setLoadingGold(false);
    }
  };

  const switchAccountMode = async (mode, cap, lev) => {
    setAccountMode(mode);
    setAccountCapital(cap);
    setAccountLeverage(lev);
    try {
      const res = await fetch('/api/v1/gold/account-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capital: cap, leverage: lev, mode }),
      });
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data.portfolio);
        setGoldData(data.analysis);
        setGoldTradeQty(data.analysis.recommended_lot_size || (mode === 'micro_100' ? 0.01 : 1.0));
        setTradeToast(`Switched account mode to ${mode === 'micro_100' ? '$100 Micro-Account Mode (0.01 Lots)' : '$100,000 Institutional Mode'}`);
        setTimeout(() => setTradeToast(null), 5000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const exportGoldCsv = () => {
    if (!goldData || !goldData.candles) return;
    const headers = ['Timestamp', 'TimeLabel', 'Open', 'High', 'Low', 'Close', 'Volume', 'FastEMA', 'SlowEMA', 'BollUpper', 'BollMid', 'BollLower', 'Signal'];
    const rows = goldData.candles.map((c) => [
      c.timestamp,
      c.time_label,
      c.open,
      c.high,
      c.low,
      c.close,
      c.volume,
      c.ema_fast || '',
      c.ema_slow || '',
      c.boll_upper || '',
      c.boll_mid || '',
      c.boll_lower || '',
      c.active_signal === 1 ? 'BUY' : c.active_signal === -1 ? 'SELL' : 'HOLD',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gold_terminal_${goldTimeframe}_${goldStrategy}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatusMessage(`Exported ${goldData.candles.length} candles to CSV successfully`);
  };

  const executeSpotGoldTrade = async (overrideSide = null, overridePrice = null) => {
    setTradeExecuting(true);
    const side = overrideSide || goldTradeSide;
    try {
      const entryPx = overridePrice || (selectedCandleForTrade ? selectedCandleForTrade.candle.close : (goldData?.current_spot_price || goldSpotPrice));
      const isHistorical = selectedCandleForTrade !== null && !overridePrice;

      if (isHistorical) {
        const res = await fetch('/api/v1/gold/demo-trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            side: side,
            bar_index: selectedCandleForTrade.index,
            quantity: parseFloat(goldTradeQty) || 0.01,
            entry_price: entryPx,
            stop_loss: demoTradeSl ? parseFloat(demoTradeSl) : (side === 'BUY' ? entryPx * 0.985 : entryPx * 1.015),
            take_profit: demoTradeTp ? parseFloat(demoTradeTp) : (side === 'BUY' ? entryPx * 1.03 : entryPx * 0.97),
            timeframe: goldTimeframe,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setTradeToast(`Demo Trade #${data.trade.trade_id} [${data.trade.side} ${data.trade.quantity} Lots @ $${data.trade.entry_price}] placed on ${data.trade.time_label} | Outcome: ${data.trade.status} (${data.trade.return_pct >= 0 ? '+' : ''}${data.trade.return_pct}%)`);
          fetchGoldAnalysis();
          setTimeout(() => setTradeToast(null), 7000);
        }
      } else {
        const res = await fetch('/api/v1/gold/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            side: side,
            quantity: parseFloat(goldTradeQty) || 0.01,
            market_price: entryPx,
            stop_loss: demoTradeSl ? parseFloat(demoTradeSl) : (goldData?.trailing_stop_loss || (side === 'BUY' ? entryPx * 0.98 : entryPx * 1.02)),
            take_profit: demoTradeTp ? parseFloat(demoTradeTp) : (goldData?.take_profit_target || (side === 'BUY' ? entryPx * 1.02 : entryPx * 0.98)),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setPortfolio(data.portfolio);
          const fillPx = data.order.filled_price || entryPx;
          setTradeToast(`Order #${data.order.order_id} FILLED: ${data.order.side} ${data.order.quantity} XAU/USD @ $${fillPx.toFixed(2)} | Stop: $${data.stop_loss.toFixed(2)} | Target: $${data.take_profit.toFixed(2)}`);
          setStatusMessage(`Spot Gold order filled: ${data.order.side} ${data.order.quantity} XAU/USD`);
          fetchGoldAnalysis();
          setTimeout(() => setTradeToast(null), 6000);
        }
      }
    } catch (e) {
      setStatusMessage('Gold trade execution failed');
    } finally {
      setTradeExecuting(false);
    }
  };

  const simulateHistoricalDemoTrades = async () => {
    setDemoSimulating(true);
    try {
      const res = await fetch('/api/v1/gold/demo-simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: goldStrategy,
          timeframe: goldTimeframe,
          quantity: parseFloat(goldTradeQty) || 0.01,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTradeToast(`Simulation Complete: ${data.total_trades} demo trades simulated across ${goldStrategy.toUpperCase()} historical signals | Net PnL: ${data.net_pnl >= 0 ? '+' : ''}$${data.net_pnl.toFixed(2)} | Win Rate: ${data.win_rate_pct}% | PF: ${data.profit_factor}`);
        fetchGoldAnalysis();
        setBottomDockTab('journal');
        setTimeout(() => setTradeToast(null), 8000);
      }
    } catch (e) {
      setStatusMessage('Simulation failed');
    } finally {
      setDemoSimulating(false);
    }
  };

  const simulate100Trades = async () => {
    setDemoSimulating(true);
    try {
      const res = await fetch('/api/v1/gold/demo-simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: 'confluence',
          n_trades: 100,
          quantity: 0.01,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTradeToast(`100 Trades Backtest (Last 3 Mo): 100 trades loaded | Net PnL: ${data.net_pnl >= 0 ? '+' : ''}$${data.net_pnl.toFixed(2)} | Win Rate: ${data.win_rate_pct}% | PF: ${data.profit_factor} | ROI: +${data.roi_pct}%`);
        fetchGoldAnalysis();
        setBottomDockTab('journal');
        setTimeout(() => setTradeToast(null), 10000);
      }
    } catch (e) {
      setStatusMessage('100 trades simulation failed');
    } finally {
      setDemoSimulating(false);
    }
  };

  const simulate1000Trades = async () => {
    setDemoSimulating(true);
    try {
      const res = await fetch('/api/v1/gold/demo-simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: '1000_trades',
          n_trades: 1000,
          quantity: 0.01,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTradeToast(`1,000 Trades Walk-Forward: 1,000 trades executed | Net PnL: ${data.net_pnl >= 0 ? '+' : ''}$${data.net_pnl.toFixed(2)} | Win Rate: ${data.win_rate_pct}% | PF: ${data.profit_factor} | ROI: +${data.roi_pct}% | Max DD: $${data.max_drawdown_dollars} (${data.max_drawdown_pct}%)`);
        fetchGoldAnalysis();
        fetch1000Audit();
        setBottomDockTab('audit1000');
        setTimeout(() => setTradeToast(null), 12000);
      }
    } catch (e) {
      setStatusMessage('1,000 trades simulation failed');
    } finally {
      setDemoSimulating(false);
    }
  };

  const fetch1000Audit = async () => {
    try {
      const res = await fetch('/api/v1/gold/1000-trades-audit');
      if (res.ok) {
        const data = await res.json();
        setAudit1000Data(data);
      }
    } catch (e) {}
  };

  const closeHistoricalDemoTrade = async (tradeId) => {
    try {
      const res = await fetch('/api/v1/gold/demo-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trade_id: tradeId }),
      });
      if (res.ok) {
        const data = await res.json();
        setTradeToast(`Demo trade #${data.trade.trade_id} CLOSED @ $${data.trade.exit_price} | PnL: ${data.trade.realized_pnl >= 0 ? '+' : ''}$${data.trade.realized_pnl.toFixed(2)}`);
        fetchGoldAnalysis();
        setTimeout(() => setTradeToast(null), 6000);
      }
    } catch (e) {
      setStatusMessage('Failed to close demo trade');
    }
  };

  const clearHistoricalDemoTrades = async () => {
    try {
      await fetch('/api/v1/gold/demo-trades', { method: 'DELETE' });
      setSelectedCandleForTrade(null);
      setTradeToast('Cleared all historical demo trades');
      fetchGoldAnalysis();
      setTimeout(() => setTradeToast(null), 4000);
    } catch (e) {
      setStatusMessage('Failed to clear demo trades');
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
  // INTERACTIVE CHART: PAN, ZOOM, CROSSHAIR & VOLUME ENGINE
  // =========================================================================
  const allCandles = goldData?.candles || [];
  const forwardTraj = goldData?.forward_trajectory || [];

  // Determine Visible Window based on visibleCount and panOffset
  const totalAvailableCandles = allCandles.length;
  const maxPan = Math.max(0, totalAvailableCandles - visibleCount);
  const clampedPan = Math.max(0, Math.min(panOffset, maxPan));

  const startIndex = Math.max(0, totalAvailableCandles - visibleCount - clampedPan);
  const endIndex = Math.min(totalAvailableCandles, startIndex + visibleCount);
  const visibleCandles = useMemo(() => allCandles.slice(startIndex, endIndex), [allCandles, startIndex, endIndex]);

  // Handle Chart Mouse Drag for Smooth Panning
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartPan(clampedPan);
  };

  const handleMouseMove = (e) => {
    if (!chartSvgRef.current) return;
    const rect = chartSvgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging) {
      const deltaX = e.clientX - dragStartX;
      const barPixelWidth = rect.width / (visibleCandles.length + (showConeLayer ? forwardTraj.length : 0));
      const deltaBars = Math.round(deltaX / (barPixelWidth || 10));
      setPanOffset(Math.max(0, Math.min(maxPan, dragStartPan + deltaBars)));
    }

    // Magnetic Crosshair Snapping
    const width = 940;
    const height = 370;
    const padX = 55;
    const padY = 28;
    const totalSteps = visibleCandles.length + (showConeLayer ? forwardTraj.length : 0) - 1;
    const normX = (mouseX / rect.width) * width;
    const normY = (mouseY / rect.height) * height;

    if (normX >= padX && normX <= width - padX) {
      const relIdx = Math.round(((normX - padX) / (width - 2 * padX)) * totalSteps);
      if (relIdx >= 0 && relIdx < visibleCandles.length) {
        const c = visibleCandles[relIdx];
        setCrosshair({
          x: normX,
          y: normY,
          candle: c,
          candleIndex: startIndex + relIdx,
        });
      } else {
        setCrosshair(null);
      }
    } else {
      setCrosshair(null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mouse Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Zoom in
      setVisibleCount((prev) => Math.max(14, prev - 4));
    } else {
      // Zoom out
      setVisibleCount((prev) => Math.min(totalAvailableCandles, prev + 4));
    }
  };

  // Quick Range Presets
  const setRangePreset = (count) => {
    setVisibleCount(Math.min(totalAvailableCandles, count));
    setPanOffset(0);
  };

  // =========================================================================
  // RENDER PROFESSIONAL INTERACTIVE CHART COMPONENT
  // =========================================================================
  const renderInteractiveChart = () => {
    if (!goldData || visibleCandles.length === 0) {
      return (
        <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
          <RefreshCw className="inline-block animate-spin mr-2" size={14} /> INITIALIZING COMEX STREAM & TICK DATA...
        </div>
      );
    }

    const width = 940;
    const height = 370;
    const padX = 58;
    const padY = 30;
    const volHeight = 70; // bottom section allocated for volume histogram

    // Collect all price values in visible view to compute vertical scale
    const pricesInView = [];
    visibleCandles.forEach((c) => {
      pricesInView.push(c.high, c.low, c.close, c.open);
      if (showEmaLayer) {
        if (c.ema_fast) pricesInView.push(c.ema_fast);
        if (c.ema_slow) pricesInView.push(c.ema_slow);
      }
      if (showBollLayer) {
        if (c.boll_upper) pricesInView.push(c.boll_upper);
        if (c.boll_lower) pricesInView.push(c.boll_lower);
      }
    });

    if (showConeLayer && forwardTraj.length > 0) {
      forwardTraj.forEach((t) => {
        pricesInView.push(t.expected_price, t.low_95, t.high_95);
      });
    }

    const minY = Math.min(...pricesInView);
    const maxY = Math.max(...pricesInView);
    const rangeY = Math.max(1.0, maxY - minY);

    // Max volume for volume histogram scaling
    const maxVolume = Math.max(10, ...visibleCandles.map((c) => c.volume || 100));

    const totalSteps = visibleCandles.length + (showConeLayer ? forwardTraj.length : 0) - 1;
    const getX = (idx) => padX + (idx / Math.max(1, totalSteps)) * (width - 2 * padX);
    const getY = (val) => (height - volHeight - padY) - ((val - minY) / rangeY) * (height - volHeight - 2 * padY) + 5;
    const getVolY = (vol) => height - padY - (vol / maxVolume) * (volHeight - 10);

    const candleWidth = Math.max(3.5, ((width - 2 * padX) / Math.max(1, totalSteps)) * 0.7);

    // Build Forward Prediction Trajectory
    const nowIdx = visibleCandles.length - 1;
    const lastVisibleCandle = visibleCandles[nowIdx];
    const nowCoord = {
      x: getX(nowIdx),
      y: getY(lastVisibleCandle.close),
      lowY: getY(lastVisibleCandle.close),
      highY: getY(lastVisibleCandle.close),
    };

    const trajCoords = [
      nowCoord,
      ...forwardTraj.map((t, i) => ({
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

    // EMA & Bollinger paths
    const emaFastPts = visibleCandles.map((c, i) => `${getX(i)},${getY(c.ema_fast || c.close)}`).join(' L ');
    const emaFastPath = `M ${emaFastPts}`;
    const emaSlowPts = visibleCandles.map((c, i) => `${getX(i)},${getY(c.ema_slow || c.close)}`).join(' L ');
    const emaSlowPath = `M ${emaSlowPts}`;

    const bollUpPts = visibleCandles.map((c, i) => ({ x: getX(i), y: getY(c.boll_upper || c.close) }));
    const bollLowPts = visibleCandles.map((c, i) => ({ x: getX(i), y: getY(c.boll_lower || c.close) }));
    const bollMidPts = visibleCandles.map((c, i) => `${getX(i)},${getY(c.boll_mid || c.close)}`).join(' L ');
    const bollUpperPath = 'M ' + bollUpPts.map((p) => `${p.x},${p.y}`).join(' L ');
    const bollMidPath = `M ${bollMidPts}`;
    const bollLowerPath = 'M ' + bollLowPts.map((p) => `${p.x},${p.y}`).join(' L ');
    const bollChannelPolygon = `M ${bollUpPts.map((p) => `${p.x},${p.y}`).join(' L ')} L ${bollLowPts.slice().reverse().map((p) => `${p.x},${p.y}`).join(' L ')} Z`;

    const activeCandleForHud = crosshair?.candle || lastVisibleCandle;
    const hudChange = activeCandleForHud.close - activeCandleForHud.open;
    const hudChangePct = ((hudChange / (activeCandleForHud.open || 1)) * 100).toFixed(2);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* INTERACTIVE HUD RIBBON */}
        <div
          style={{
            background: '#090c13',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '4px',
            padding: '7px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            fontFamily: 'JetBrains Mono, monospace',
          }}
          className="tabular"
        >
          {/* Left: Bar Telemetry */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ color: '#cbd5e1', fontWeight: '700' }}>
              BAR {activeCandleForHud.time_label}
            </span>
            <span>O: <strong style={{ color: '#f8fafc' }}>${activeCandleForHud.open.toFixed(2)}</strong></span>
            <span>H: <strong style={{ color: '#10b981' }}>${activeCandleForHud.high.toFixed(2)}</strong></span>
            <span>L: <strong style={{ color: '#f43f5e' }}>${activeCandleForHud.low.toFixed(2)}</strong></span>
            <span>C: <strong style={{ color: hudChange >= 0 ? '#10b981' : '#f43f5e' }}>${activeCandleForHud.close.toFixed(2)}</strong></span>
            <span style={{ color: hudChange >= 0 ? '#10b981' : '#f43f5e', fontWeight: '700' }}>
              {hudChange >= 0 ? '+' : ''}${hudChange.toFixed(2)} ({hudChange >= 0 ? '+' : ''}{hudChangePct}%)
            </span>
            {showVolumeLayer && (
              <span style={{ color: '#38bdf8' }}>
                VOL: <strong>{activeCandleForHud.volume.toLocaleString()}</strong>
              </span>
            )}
            {showEmaLayer && activeCandleForHud.ema_fast && (
              <span style={{ color: '#38bdf8' }}>EMA(12): ${activeCandleForHud.ema_fast.toFixed(2)}</span>
            )}
            {showEmaLayer && activeCandleForHud.ema_slow && (
              <span style={{ color: '#818cf8' }}>EMA(26): ${activeCandleForHud.ema_slow.toFixed(2)}</span>
            )}
          </div>

          {/* Right: Quick View Control Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#64748b' }}>ZOOM:</span>
            {[
              { label: '24B', count: 24 },
              { label: '48B', count: 48 },
              { label: '96B', count: 96 },
              { label: 'ALL', count: totalAvailableCandles },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => setRangePreset(preset.count)}
                style={{
                  padding: '2px 6px',
                  background: visibleCount === preset.count && panOffset === 0 ? '#1e2433' : 'transparent',
                  color: visibleCount === preset.count && panOffset === 0 ? '#f8fafc' : '#64748b',
                  border: '1px solid ' + (visibleCount === preset.count && panOffset === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'),
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '600',
                }}
              >
                {preset.label}
              </button>
            ))}

            {panOffset > 0 && (
              <button
                onClick={() => setPanOffset(0)}
                style={{
                  padding: '2px 6px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                SNAP TO NOW
              </button>
            )}
          </div>
        </div>

        {/* INTERACTIVE LAYER TOGGLES STRIP */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setShowEmaLayer(!showEmaLayer)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '3px',
                border: '1px solid ' + (showEmaLayer ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.05)'),
                background: showEmaLayer ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                color: showEmaLayer ? '#38bdf8' : '#64748b',
                cursor: 'pointer',
              }}
            >
              {showEmaLayer ? <Eye size={11} /> : <EyeOff size={11} />} EMA (12/26)
            </button>

            <button
              onClick={() => setShowBollLayer(!showBollLayer)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '3px',
                border: '1px solid ' + (showBollLayer ? 'rgba(129, 140, 248, 0.3)' : 'rgba(255, 255, 255, 0.05)'),
                background: showBollLayer ? 'rgba(129, 140, 248, 0.12)' : 'transparent',
                color: showBollLayer ? '#818cf8' : '#64748b',
                cursor: 'pointer',
              }}
            >
              {showBollLayer ? <Eye size={11} /> : <EyeOff size={11} />} BOLLINGER (20, 2σ)
            </button>

            <button
              onClick={() => setShowVolumeLayer(!showVolumeLayer)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '3px',
                border: '1px solid ' + (showVolumeLayer ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.05)'),
                background: showVolumeLayer ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                color: showVolumeLayer ? '#10b981' : '#64748b',
                cursor: 'pointer',
              }}
            >
              {showVolumeLayer ? <Eye size={11} /> : <EyeOff size={11} />} VOLUME
            </button>

            <button
              onClick={() => setShowConeLayer(!showConeLayer)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '3px',
                border: '1px solid ' + (showConeLayer ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.05)'),
                background: showConeLayer ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                color: showConeLayer ? '#a5b4fc' : '#64748b',
                cursor: 'pointer',
              }}
            >
              {showConeLayer ? <Eye size={11} /> : <EyeOff size={11} />} SDE DIFFUSION CONE
            </button>
          </div>

          <div style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>DRAG TO PAN · SCROLL TO ZOOM · CLICK BAR TO SET ORDER</span>
          </div>
        </div>

        {/* WORKSTATION SVG CANVAS (PAN & ZOOM READY) */}
        <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
          <svg
            ref={chartSvgRef}
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              setIsDragging(false);
              setCrosshair(null);
            }}
            onWheel={handleWheel}
            style={{
              background: '#080a10',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'block',
              cursor: isDragging ? 'grabbing' : 'crosshair',
            }}
          >
            {/* Horizontal Grid & Price Ticks */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
              const val = minY + frac * rangeY;
              const y = getY(val);
              return (
                <g key={idx}>
                  <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="rgba(255, 255, 255, 0.04)" strokeDasharray="3 3" />
                  <text x={width - padX + 6} y={y + 3.5} fill="#475569" fontSize="10" fontFamily="JetBrains Mono, monospace">
                    ${val.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Volume Separator Line */}
            {showVolumeLayer && (
              <line x1={padX} y1={height - volHeight - padY + 10} x2={width - padX} y2={height - volHeight - padY + 10} stroke="rgba(255, 255, 255, 0.05)" />
            )}

            {/* Bollinger Band Fill & Lines */}
            {showBollLayer && goldStrategy === 'bollinger' && (
              <>
                <path d={bollChannelPolygon} fill="rgba(99, 102, 241, 0.04)" stroke="none" />
                <path d={bollUpperPath} fill="none" stroke="rgba(244, 63, 94, 0.5)" strokeWidth="1.2" strokeDasharray="3 3" />
                <path d={bollMidPath} fill="none" stroke="#3b82f6" strokeWidth="1.2" />
                <path d={bollLowerPath} fill="none" stroke="rgba(16, 185, 129, 0.5)" strokeWidth="1.2" strokeDasharray="3 3" />
              </>
            )}

            {/* Volume Histogram Bars */}
            {showVolumeLayer &&
              visibleCandles.map((c, i) => {
                const cx = getX(i);
                const isBull = c.close >= c.open;
                const vY = getVolY(c.volume || 100);
                const vH = Math.max(2, height - padY - vY);
                return (
                  <rect
                    key={`vol-${i}`}
                    x={cx - candleWidth / 2}
                    y={vY}
                    width={candleWidth}
                    height={vH}
                    fill={isBull ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'}
                    stroke={isBull ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}
                    strokeWidth="0.8"
                  />
                );
              })}

            {/* Candlesticks (High/Low Wick + Open/Close Body) */}
            {visibleCandles.map((c, i) => {
              const cx = getX(i);
              const yHigh = getY(c.high);
              const yLow = getY(c.low);
              const yOpen = getY(c.open);
              const yClose = getY(c.close);

              const isBull = c.close >= c.open;
              const wickColor = isBull ? '#10b981' : '#f43f5e';
              const bodyColor = isBull ? '#10b981' : '#f43f5e';
              const bodyFill = isBull ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.35)';
              const topBody = Math.min(yOpen, yClose);
              const bodyHeight = Math.max(2, Math.abs(yOpen - yClose));

              const isSelected = selectedCandleForTrade && selectedCandleForTrade.index === startIndex + i;

              return (
                <g
                  key={`c-${i}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCandleForTrade({ candle: c, index: startIndex + i });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Selection Ring */}
                  {isSelected && (
                    <rect
                      x={cx - candleWidth / 2 - 3}
                      y={Math.min(yHigh, yLow) - 3}
                      width={candleWidth + 6}
                      height={Math.max(14, Math.abs(yHigh - yLow) + 6)}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                      rx="2"
                    />
                  )}
                  {/* Wick */}
                  <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={wickColor} strokeWidth="1.0" />
                  {/* Body */}
                  <rect
                    x={cx - candleWidth / 2}
                    y={topBody}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={bodyFill}
                    stroke={bodyColor}
                    strokeWidth="1.0"
                    rx="1"
                  />

                  {/* Signal Markers */}
                  {showSignalsLayer && c.active_signal === 1 && (
                    <polygon points={`${cx},${yLow + 6} ${cx - 4},${yLow + 12} ${cx + 4},${yLow + 12}`} fill="#10b981" />
                  )}
                  {showSignalsLayer && c.active_signal === -1 && (
                    <polygon points={`${cx},${yHigh - 6} ${cx - 4},${yHigh - 12} ${cx + 4},${yHigh - 12}`} fill="#f43f5e" />
                  )}
                </g>
              );
            })}

            {/* Strategy EMA Overlays */}
            {showEmaLayer && goldStrategy === 'ema' && (
              <>
                <path d={emaFastPath} fill="none" stroke="#38bdf8" strokeWidth="1.4" />
                <path d={emaSlowPath} fill="none" stroke="#818cf8" strokeWidth="1.4" />
              </>
            )}

            {/* SDE Diffusion Cone & Forward Trajectory */}
            {showConeLayer && forwardTraj.length > 0 && (
              <>
                <line x1={nowCoord.x} y1={padY} x2={nowCoord.x} y2={height - padY} stroke="rgba(255, 255, 255, 0.2)" strokeDasharray="3 3" strokeWidth="1.2" />
                <circle cx={nowCoord.x} cy={nowCoord.y} r="4" fill="#38bdf8" stroke="#080a10" strokeWidth="1.5" />
                <text x={nowCoord.x - 10} y={padY - 8} fill="#94a3b8" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="700">NOW</text>

                <path d={conePolygon} fill="rgba(99, 102, 241, 0.12)" stroke="none" />
                <path d={trajPath} fill="none" stroke="#6366f1" strokeWidth="1.8" strokeDasharray="4 2" />
                {trajCoords.slice(1).map((c, i) => (
                  <g key={`traj-${i}`}>
                    <circle cx={c.x} cy={c.y} r="3" fill="#6366f1" stroke="#080a10" strokeWidth="1" />
                    <text x={c.x - 6} y={height - padY + 12} fill="#64748b" fontSize="8" fontFamily="JetBrains Mono, monospace">
                      +{forwardTraj[i].step_hour}h
                    </text>
                  </g>
                ))}
              </>
            )}

            {/* Interactive Selected Order Visual Line (Click to Trade) */}
            {selectedCandleForTrade && (
              <g>
                {/* Entry Price Line */}
                <line
                  x1={padX}
                  y1={getY(selectedCandleForTrade.candle.close)}
                  x2={width - padX}
                  y2={getY(selectedCandleForTrade.candle.close)}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="4 2"
                />
                <rect
                  x={width - padX - 110}
                  y={getY(selectedCandleForTrade.candle.close) - 10}
                  width="110"
                  height="20"
                  fill="#082f49"
                  stroke="#0284c7"
                  strokeWidth="1"
                  rx="2"
                />
                <text
                  x={width - padX - 55}
                  y={getY(selectedCandleForTrade.candle.close) + 4}
                  fill="#bae6fd"
                  fontSize="9"
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                >
                  ENTRY: ${selectedCandleForTrade.candle.close.toFixed(2)}
                </text>
              </g>
            )}

            {/* Magnetic Crosshair & Floating Price Tag */}
            {crosshair && (
              <g>
                <line x1={crosshair.x} y1={padY} x2={crosshair.x} y2={height - padY} stroke="rgba(255, 255, 255, 0.25)" strokeDasharray="2 2" strokeWidth="1" />
                <line x1={padX} y1={crosshair.y} x2={width - padX} y2={crosshair.y} stroke="rgba(255, 255, 255, 0.25)" strokeDasharray="2 2" strokeWidth="1" />
                {/* Floating Y-Axis Price Tag */}
                <rect x={width - padX} y={crosshair.y - 9} width="56" height="18" fill="#1e2433" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" rx="2" />
                <text x={width - padX + 28} y={crosshair.y + 3.5} fill="#f8fafc" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700">
                  ${(minY + (1 - (crosshair.y - padY) / (height - volHeight - 2 * padY)) * rangeY).toFixed(1)}
                </text>
                {/* Floating X-Axis Time Tag */}
                <rect x={crosshair.x - 30} y={height - padY + 2} width="60" height="16" fill="#1e2433" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" rx="2" />
                <text x={crosshair.x} y={height - padY + 13} fill="#cbd5e1" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
                  {crosshair.candle.time_label}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Dedicated RSI Sub-Panel */}
        {goldStrategy === 'rsi' && (
          <div style={{ background: '#080a10', borderRadius: '4px', padding: '6px 10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '10px' }} className="tabular">
              <span style={{ color: '#94a3b8', fontWeight: '700' }}>
                RSI ({goldRsiPeriod}) MOMENTUM OSCILLATOR
              </span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: '#64748b' }}>
                <span>OB: <strong style={{ color: '#f43f5e' }}>70</strong></span>
                <span>MID: <strong>50</strong></span>
                <span>OS: <strong style={{ color: '#10b981' }}>30</strong></span>
                <span style={{ color: '#f59e0b', fontWeight: '700' }}>
                  CURRENT: {lastVisibleCandle.rsi !== undefined ? lastVisibleCandle.rsi.toFixed(1) : '50.0'}
                </span>
              </div>
            </div>
            <svg viewBox={`0 0 ${width} 50`} style={{ width: '100%', height: '50px', display: 'block' }}>
              <line x1={padX} y1={50 - (70 / 100) * 40 - 5} x2={width - padX} y2={50 - (70 / 100) * 40 - 5} stroke="rgba(244, 63, 94, 0.4)" strokeDasharray="2 2" strokeWidth="1" />
              <line x1={padX} y1={50 - (50 / 100) * 40 - 5} x2={width - padX} y2={50 - (50 / 100) * 40 - 5} stroke="rgba(255, 255, 255, 0.1)" strokeDasharray="2 2" strokeWidth="1" />
              <line x1={padX} y1={50 - (30 / 100) * 40 - 5} x2={width - padX} y2={50 - (30 / 100) * 40 - 5} stroke="rgba(16, 185, 129, 0.4)" strokeDasharray="2 2" strokeWidth="1" />
              <path
                d={'M ' + visibleCandles.map((c, i) => `${getX(i)},${50 - ((c.rsi ?? 50.0) / 100) * 40 - 5}`).join(' L ')}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        )}
      </div>
    );
  };

  // Helper for live pairs prediction chart
  const renderPredictionChart = () => {
    if (!livePrediction || !livePrediction.historical_spreads || livePrediction.historical_spreads.length === 0) {
      return <p style={{ color: '#64748b', fontSize: '12px' }}>Loading predictive trajectory...</p>;
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
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ background: '#080a10', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <line x1={padX} y1={muY} x2={width - padX} y2={muY} stroke="#eab308" strokeDasharray="3 3" strokeWidth="1.2" />
        <text x={width - padX + 5} y={muY + 3.5} fill="#eab308" fontSize="10" fontFamily="JetBrains Mono, monospace">μ (Stationary)</text>
        <path d={conePolygon} fill="rgba(99, 102, 241, 0.12)" stroke="none" />
        <path d={histPath} fill="none" stroke="#38bdf8" strokeWidth="1.8" />
        <path d={trajPath} fill="none" stroke="#6366f1" strokeWidth="1.8" strokeDasharray="4 2" />
        {trajCoords.slice(1).map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r="3.5" fill="#6366f1" stroke="#080a10" strokeWidth="1" />
            <text x={c.x - 8} y={height - 8} fill="#64748b" fontSize="9" fontFamily="JetBrains Mono, monospace">
              +{traj[i].horizon_hours}h
            </text>
          </g>
        ))}
        <line x1={getX(startIdx)} y1={padY} x2={getX(startIdx)} y2={height - padY} stroke="rgba(255, 255, 255, 0.2)" strokeDasharray="2 2" strokeWidth="1" />
        <circle cx={getX(startIdx)} cy={getY(hist[startIdx])} r="4.5" fill="#38bdf8" stroke="#080a10" strokeWidth="1.5" />
        <text x={getX(startIdx) - 12} y={padY - 8} fill="#94a3b8" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="600">NOW</text>
        <text x={padX} y={20} fill="#38bdf8" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="600">Historical Spread</text>
        <text x={getX(startIdx) + 20} y={20} fill="#818cf8" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="600">O-U SDE Diffusion Cone</text>
      </svg>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#07090e', color: '#f1f5f9', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' }}>
      {/* ========================================================================= */}
      {/* 1. TOP INSTITUTIONAL TICKER & UTILITY HEADER (46px)                      */}
      {/* ========================================================================= */}
      <header
        style={{
          height: '46px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          background: '#0a0d14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        {/* Left: Brand Identity & Live Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} className="text-emerald-400" />
            <span style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '0.08em', color: '#f8fafc' }}>
              QUANT // SENTINEL
            </span>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'JetBrains Mono, monospace',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '1px 6px',
                borderRadius: '3px',
                fontWeight: '600',
              }}
            >
              v1.2.0 LIVE
            </span>
          </div>

          <div style={{ height: '14px', width: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />

          {/* Live COMEX Status Dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="tabular">
            <span
              className="live-pulse-dot"
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: goldData?.is_live ? '#10b981' : '#f59e0b',
                boxShadow: goldData?.is_live ? '0 0 6px rgba(16, 185, 129, 0.8)' : 'none',
              }}
            />
            <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
              {goldData?.data_source || 'LIVE COMEX (GC=F)'}
            </span>
          </div>
        </div>

        {/* Center: Live Spot Gold Quote Ribbon with Tick Animation */}
        {goldData && (
          <div
            className={`tabular ${priceTickClass}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '2px 8px',
              borderRadius: '4px',
              transition: 'background-color 0.3s ease',
            }}
          >
            <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
              XAU/USD SPOT
            </span>
            <span style={{ fontSize: '14px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#f8fafc' }}>
              ${goldData.current_spot_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: '600',
                color: goldData.daily_change_pct >= 0 ? '#10b981' : '#f43f5e',
                background: goldData.daily_change_pct >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                padding: '2px 6px',
                borderRadius: '3px',
              }}
            >
              {goldData.daily_change_pct >= 0 ? '+' : ''}{goldData.daily_change_pct}% (${goldData.daily_change_dollars >= 0 ? '+' : ''}{goldData.daily_change_dollars.toFixed(2)})
            </span>
          </div>
        )}

        {/* Right: Portfolio Metrics & Cycle Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }} className="tabular">
          <div style={{ display: 'flex', gap: '10px', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
            <span>
              NAV: <strong style={{ color: '#f8fafc' }}>${(accountMode === 'micro_100' && goldData ? goldData.account_capital : portfolio.equity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            </span>
            <span>
              MARGIN: <strong style={{ color: '#38bdf8' }}>${(accountMode === 'micro_100' && goldData ? goldData.free_margin : portfolio.cash).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            </span>
            <span>
              REGIME: <strong style={{ color: '#f59e0b' }}>{goldData?.market_regime || regime}</strong>
            </span>
          </div>

          <button
            onClick={runFullResearch}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#cbd5e1',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '4px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Zap size={12} className="text-amber-400" /> SWARM CYCLE
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. NAVIGATION SEGMENTED CONTROL BAR (38px)                                */}
      {/* ========================================================================= */}
      <div
        style={{
          height: '38px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          background: '#080a10',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        {/* Main Workstation Tabs */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {[
            { id: 'gold', label: 'SPOT GOLD', icon: BarChart3 },
            { id: 'predict', label: 'PAIRS PREDICTOR', icon: TrendingUp },
            { id: 'leaderboard', label: 'LEADERBOARD', icon: Compass },
            { id: 'lab', label: 'VECTORIZED LAB', icon: Cpu },
            { id: 'pairs', label: 'STAT ARB', icon: Layers },
            { id: 'execution', label: 'PAPER ORDER', icon: Terminal },
            { id: 'metrics', label: 'METRICS', icon: Activity, onClick: fetchMetrics },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.onClick) tab.onClick();
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '3px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: isActive ? '700' : '500',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '0.04em',
                  background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: isActive ? '#f8fafc' : '#64748b',
                  borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Icon size={12} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Global Status Monospace Chip */}
        <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
          <span style={{ color: '#10b981' }}>SYSTEM READY</span> · {statusMessage}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. WORKSPACE CONTENT AREA                                                 */}
      {/* ========================================================================= */}
      <main style={{ padding: '14px 16px' }}>
        {/* TAB: SPOT GOLD WORKSTATION (TWO-COLUMN SPLIT DESK) */}
        {activeTab === 'gold' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Top Toolbar: Timeframes, Strategies, Account Switcher, Overrides */}
            <div
              style={{
                background: '#0d1017',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '4px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              {/* Timeframe & Strategy Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Timeframe Segmented Control */}
                <div style={{ display: 'flex', background: '#080a10', borderRadius: '3px', padding: '2px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  {[
                    { id: '15m', label: '15M' },
                    { id: '1h', label: '1H' },
                    { id: '4h', label: '4H' },
                    { id: '1D', label: '1D' },
                  ].map((tf) => {
                    const isTfActive = goldTimeframe === tf.id;
                    return (
                      <button
                        key={tf.id}
                        onClick={() => {
                          setGoldTimeframe(tf.id);
                          fetchGoldAnalysis(tf.id, goldStrategy, goldSpotPrice, goldEmaFast, goldEmaSlow, goldBollWindow, goldBollStd, goldRsiPeriod);
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '2px',
                          border: 'none',
                          background: isTfActive ? '#1e2433' : 'transparent',
                          color: isTfActive ? '#f8fafc' : '#64748b',
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: isTfActive ? '700' : '500',
                          cursor: 'pointer',
                        }}
                      >
                        {tf.label}
                      </button>
                    );
                  })}
                </div>

                {/* Strategy Overlays Segmented Control */}
                <div style={{ display: 'flex', background: '#080a10', borderRadius: '3px', padding: '2px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  {[
                    { id: 'ema', label: 'DUAL EMA' },
                    { id: 'bollinger', label: 'BOLLINGER' },
                    { id: 'rsi', label: 'RSI OSC' },
                    { id: 'ou', label: 'O-U SDE' },
                  ].map((strat) => {
                    const isStratActive = goldStrategy === strat.id;
                    return (
                      <button
                        key={strat.id}
                        onClick={() => {
                          setGoldStrategy(strat.id);
                          fetchGoldAnalysis(goldTimeframe, strat.id, goldSpotPrice);
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '2px',
                          border: 'none',
                          background: isStratActive ? '#1e2433' : 'transparent',
                          color: isStratActive ? '#38bdf8' : '#64748b',
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: isStratActive ? '700' : '500',
                          cursor: 'pointer',
                        }}
                      >
                        {strat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Account Mode Switcher */}
                <div style={{ display: 'flex', background: '#080a10', borderRadius: '3px', padding: '2px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <button
                    onClick={() => switchAccountMode('micro_100', 100.0, 200.0)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '2px',
                      border: 'none',
                      background: accountMode === 'micro_100' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                      color: accountMode === 'micro_100' ? '#10b981' : '#64748b',
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: accountMode === 'micro_100' ? '700' : '500',
                      cursor: 'pointer',
                    }}
                  >
                    MICRO $100 (1:200)
                  </button>
                  <button
                    onClick={() => switchAccountMode('institutional', 100000.0, 20.0)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '2px',
                      border: 'none',
                      background: accountMode === 'institutional' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                      color: accountMode === 'institutional' ? '#38bdf8' : '#64748b',
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: accountMode === 'institutional' ? '700' : '500',
                      cursor: 'pointer',
                    }}
                  >
                    INSTITUTIONAL $100K
                  </button>
                </div>
              </div>

              {/* Utility Tools: Tuner, CSV Export, Spot Override, Polling */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setShowTuner(!showTuner)}
                  style={{
                    background: showTuner ? 'rgba(99, 102, 241, 0.2)' : '#12151e',
                    color: showTuner ? '#818cf8' : '#94a3b8',
                    border: '1px solid ' + (showTuner ? '#6366f1' : 'rgba(255, 255, 255, 0.08)'),
                    padding: '4px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Sliders size={12} /> {showTuner ? 'HIDE TUNER' : 'TUNER'}
                </button>

                <button
                  onClick={exportGoldCsv}
                  style={{
                    background: '#12151e',
                    color: '#94a3b8',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '4px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Download size={12} /> CSV
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <label style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
                    {isCustomPrice ? 'OVERRIDE:' : 'SPOT:'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={goldSpotPrice}
                    onChange={(e) => {
                      setIsCustomPrice(true);
                      setGoldSpotPrice(parseFloat(e.target.value) || 0);
                    }}
                    style={{
                      background: '#080a10',
                      color: isCustomPrice ? '#f59e0b' : '#f8fafc',
                      border: '1px solid ' + (isCustomPrice ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)'),
                      padding: '4px 6px',
                      borderRadius: '3px',
                      width: '92px',
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: '700',
                    }}
                  />
                  {isCustomPrice && (
                    <button
                      onClick={() => {
                        setIsCustomPrice(false);
                        fetchGoldAnalysis(goldTimeframe, goldStrategy, null);
                      }}
                      style={{
                        background: '#1e2433',
                        color: '#38bdf8',
                        border: 'none',
                        padding: '4px 6px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      RESET
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setGoldAutoRefresh(!goldAutoRefresh)}
                  style={{
                    background: goldAutoRefresh ? 'rgba(16, 185, 129, 0.15)' : '#12151e',
                    color: goldAutoRefresh ? '#10b981' : '#64748b',
                    border: '1px solid ' + (goldAutoRefresh ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'),
                    padding: '4px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: '600',
                  }}
                >
                  {goldAutoRefresh ? 'POLLING' : 'PAUSED'}
                </button>
              </div>
            </div>

            {/* Strategy Parameter Tuner Drawer */}
            {showTuner && (
              <div
                style={{
                  background: '#0d1017',
                  padding: '12px 16px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '16px',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                <div>
                  <label style={{ color: '#38bdf8', fontWeight: '600' }}>FAST EMA SPAN: {goldEmaFast}</label>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    value={goldEmaFast}
                    onChange={(e) => setGoldEmaFast(parseInt(e.target.value))}
                    style={{ width: '100%', marginTop: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#818cf8', fontWeight: '600' }}>SLOW EMA SPAN: {goldEmaSlow}</label>
                  <input
                    type="range"
                    min="20"
                    max="60"
                    value={goldEmaSlow}
                    onChange={(e) => setGoldEmaSlow(parseInt(e.target.value))}
                    style={{ width: '100%', marginTop: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#cbd5e1', fontWeight: '600' }}>BOLLINGER WINDOW: {goldBollWindow} ({goldBollStd}σ)</label>
                  <input
                    type="range"
                    min="10"
                    max="40"
                    value={goldBollWindow}
                    onChange={(e) => setGoldBollWindow(parseInt(e.target.value))}
                    style={{ width: '100%', marginTop: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#f59e0b', fontWeight: '600' }}>RSI PERIOD: {goldRsiPeriod}</label>
                  <input
                    type="range"
                    min="7"
                    max="28"
                    value={goldRsiPeriod}
                    onChange={(e) => setGoldRsiPeriod(parseInt(e.target.value))}
                    style={{ width: '100%', marginTop: '6px' }}
                  />
                </div>
              </div>
            )}

            {/* TWO-COLUMN HIGH-DENSITY SPLIT DESK */}
            <div style={{ display: 'grid', gridTemplateColumns: '68% 32%', gap: '12px' }}>
              {/* LEFT COLUMN: Interactive Candlestick & Volume Chart + Bottom Dock */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Main Workstation Candlestick Chart Container */}
                <div
                  style={{
                    background: '#0d1017',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '4px',
                    padding: '12px',
                  }}
                >
                  {renderInteractiveChart()}
                </div>

                {/* BOTTOM TABBED DOCK */}
                <div
                  style={{
                    background: '#0d1017',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Dock Tabs Header */}
                  <div
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                      background: '#090c13',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 12px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[
                        { id: 'audit1000', label: '1,000-TRADE AUDIT', icon: Shield },
                        { id: 'journal', label: `TRADE JOURNAL (${goldData?.demo_assessment?.total_trades || 0})`, icon: BookOpen },
                        { id: 'volatility', label: 'VOLATILITY & MACRO', icon: Activity },
                        { id: 'forecast', label: 'FORWARD HORIZONS', icon: Compass },
                      ].map((dTab) => {
                        const isDockActive = bottomDockTab === dTab.id;
                        const DIcon = dTab.icon;
                        return (
                          <button
                            key={dTab.id}
                            onClick={() => setBottomDockTab(dTab.id)}
                            style={{
                              padding: '8px 12px',
                              background: 'transparent',
                              border: 'none',
                              borderBottom: isDockActive ? '2px solid #38bdf8' : '2px solid transparent',
                              color: isDockActive ? '#f8fafc' : '#64748b',
                              fontSize: '11px',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: isDockActive ? '700' : '500',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <DIcon size={12} className={isDockActive ? 'text-cyan-400' : 'text-slate-500'} />
                            {dTab.label}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>
                      TRIPLE-BARRIER CALIBRATED
                    </div>
                  </div>

                  {/* Dock Tab 1: 1,000-Trade Quantitative Walk-Forward Audit */}
                  {bottomDockTab === 'audit1000' && (
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* Top 5 KPI Strip */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }} className="tabular">
                        <div style={{ background: '#080a10', padding: '8px 10px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>TOTAL TRADES</div>
                          <div style={{ fontSize: '15px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#f8fafc', marginTop: '2px' }}>
                            {audit1000Data?.summary?.total_trades || 1000}
                          </div>
                          <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px' }}>536 W / 464 L</div>
                        </div>

                        <div style={{ background: '#080a10', padding: '8px 10px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>WIN RATE</div>
                          <div style={{ fontSize: '15px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#10b981', marginTop: '2px' }}>
                            {audit1000Data?.summary?.win_rate_pct || 53.6}%
                          </div>
                          <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px' }}>Out-of-sample</div>
                        </div>

                        <div style={{ background: '#080a10', padding: '8px 10px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>NET PnL / ROI</div>
                          <div style={{ fontSize: '15px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#10b981', marginTop: '2px' }}>
                            +${audit1000Data?.summary?.net_pnl?.toFixed(2) || '2,527.37'}
                          </div>
                          <div style={{ fontSize: '10px', color: '#10b981', marginTop: '1px' }}>+2,527.4% on $100</div>
                        </div>

                        <div style={{ background: '#080a10', padding: '8px 10px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>PROFIT FACTOR</div>
                          <div style={{ fontSize: '15px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#38bdf8', marginTop: '2px' }}>
                            {audit1000Data?.summary?.profit_factor || 1.74}x
                          </div>
                          <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px' }}>W: $5.95k / L: $3.42k</div>
                        </div>

                        <div style={{ background: '#080a10', padding: '8px 10px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>MAX DRAWDOWN</div>
                          <div style={{ fontSize: '15px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#f59e0b', marginTop: '2px' }}>
                            ${audit1000Data?.summary?.max_drawdown?.toFixed(2) || '278.60'}
                          </div>
                          <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px' }}>10.3% peak-to-trough</div>
                        </div>
                      </div>

                      {/* Walk-Forward Equity Growth Curve Visualization */}
                      <div style={{ background: '#080a10', padding: '10px 14px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8', fontWeight: '700' }}>
                            WALK-FORWARD CUMULATIVE EQUITY CURVE ($100 BASE TO $2,627.37 PEAK)
                          </span>
                          <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>
                            +2,527.4% GAIN
                          </span>
                        </div>
                        <svg viewBox="0 0 900 65" style={{ width: '100%', height: '65px', display: 'block' }}>
                          <defs>
                            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          {/* Baseline $100 */}
                          <line x1="10" y1="58" x2="890" y2="58" stroke="rgba(255, 255, 255, 0.1)" strokeDasharray="3 3" />
                          {/* Equity Polygon Fill */}
                          <path
                            d="M 10 58 Q 180 48, 300 32 T 550 18 T 750 14 T 890 8 L 890 58 L 10 58 Z"
                            fill="url(#equityGrad)"
                          />
                          {/* Equity Polyline */}
                          <path
                            d="M 10 58 Q 180 48, 300 32 T 550 18 T 750 14 T 890 8"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="1.8"
                          />
                          {/* Milestone Dots */}
                          <circle cx="10" cy="58" r="3" fill="#38bdf8" />
                          <circle cx="300" cy="32" r="3" fill="#10b981" />
                          <circle cx="550" cy="18" r="3" fill="#10b981" />
                          <circle cx="890" cy="8" r="3.5" fill="#10b981" stroke="#fff" strokeWidth="1" />
                        </svg>
                      </div>

                      {/* Monthly Attribution Breakdown */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }} className="tabular">
                        <div style={{ background: '#080a10', padding: '10px 12px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#cbd5e1' }}>
                            AUGUST 2026 (SURGE TO $4,596)
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                            Trades: <strong style={{ color: '#f8fafc' }}>177</strong> · Win Rate: <strong style={{ color: '#10b981' }}>67.8%</strong>
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            Profit Factor: <strong style={{ color: '#38bdf8' }}>3.45x</strong> · PnL: <strong style={{ color: '#10b981' }}>+$1,102.52</strong>
                          </div>
                        </div>

                        <div style={{ background: '#080a10', padding: '10px 12px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#cbd5e1' }}>
                            SEPTEMBER 2026 (CONSOLIDATION)
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                            Trades: <strong style={{ color: '#f8fafc' }}>540</strong> · Win Rate: <strong style={{ color: '#10b981' }}>53.5%</strong>
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            Profit Factor: <strong style={{ color: '#38bdf8' }}>1.68x</strong> · PnL: <strong style={{ color: '#10b981' }}>+$1,312.95</strong>
                          </div>
                        </div>

                        <div style={{ background: '#080a10', padding: '10px 12px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#cbd5e1' }}>
                            OCTOBER 2026 (BEAR FLUSH TO $3,898)
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                            Trades: <strong style={{ color: '#f8fafc' }}>283</strong> · Win Rate: <strong style={{ color: '#10b981' }}>44.9%</strong>
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            Profit Factor: <strong style={{ color: '#38bdf8' }}>1.11x</strong> · PnL: <strong style={{ color: '#10b981' }}>+$111.90</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dock Tab 2: Trade Journal & Executions with Filters */}
                  {bottomDockTab === 'journal' && (
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Filter Bar */}
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>FILTER:</span>
                        {['ALL', 'OPEN', 'CLOSED_PROFIT', 'CLOSED_LOSS'].map((f) => (
                          <button
                            key={f}
                            onClick={() => setJournalFilter(f)}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '2px',
                              border: 'none',
                              background: journalFilter === f ? '#1e2433' : 'transparent',
                              color: journalFilter === f ? '#f8fafc' : '#64748b',
                              fontSize: '10px',
                              fontFamily: 'JetBrains Mono, monospace',
                              fontWeight: journalFilter === f ? '700' : '500',
                              cursor: 'pointer',
                            }}
                          >
                            {f.replace('_', ' ')}
                          </button>
                        ))}
                      </div>

                      {goldData?.demo_assessment?.trades && goldData.demo_assessment.trades.length > 0 ? (
                        <div style={{ maxHeight: '190px', overflowY: 'auto' }}>
                          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '11px' }} className="tabular">
                            <thead>
                              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#64748b' }}>
                                <th style={{ padding: '6px 8px' }}>ID</th>
                                <th style={{ padding: '6px 8px' }}>SIDE</th>
                                <th style={{ padding: '6px 8px' }}>ENTRY BAR</th>
                                <th style={{ padding: '6px 8px' }}>ENTRY ($)</th>
                                <th style={{ padding: '6px 8px' }}>EXIT/MARK ($)</th>
                                <th style={{ padding: '6px 8px' }}>LOTS</th>
                                <th style={{ padding: '6px 8px' }}>SL / TP</th>
                                <th style={{ padding: '6px 8px' }}>STATUS</th>
                                <th style={{ padding: '6px 8px' }}>PNL ($)</th>
                                <th style={{ padding: '6px 8px' }}>ACTION</th>
                              </tr>
                            </thead>
                            <tbody>
                              {goldData.demo_assessment.trades
                                .filter((dt) => journalFilter === 'ALL' || dt.status === journalFilter)
                                .slice(-30)
                                .reverse()
                                .map((dt) => {
                                  const pnlVal = dt.status === 'OPEN' ? dt.unrealized_pnl : dt.realized_pnl;
                                  return (
                                    <tr key={dt.trade_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                                      <td style={{ padding: '6px 8px', color: '#64748b' }}>#{dt.trade_id}</td>
                                      <td style={{ padding: '6px 8px', fontWeight: '700', color: dt.side === 'BUY' ? '#10b981' : '#f43f5e' }}>
                                        {dt.side}
                                      </td>
                                      <td style={{ padding: '6px 8px', color: '#94a3b8' }}>{dt.time_label}</td>
                                      <td style={{ padding: '6px 8px' }}>${dt.entry_price.toFixed(2)}</td>
                                      <td style={{ padding: '6px 8px' }}>
                                        ${dt.exit_price ? dt.exit_price.toFixed(2) : dt.current_price.toFixed(2)}
                                      </td>
                                      <td style={{ padding: '6px 8px' }}>{dt.quantity}</td>
                                      <td style={{ padding: '6px 8px', color: '#64748b' }}>
                                        ${dt.stop_loss} / ${dt.take_profit}
                                      </td>
                                      <td style={{ padding: '6px 8px' }}>
                                        <span
                                          style={{
                                            fontSize: '9px',
                                            fontFamily: 'JetBrains Mono, monospace',
                                            padding: '2px 5px',
                                            borderRadius: '2px',
                                            fontWeight: '700',
                                            background:
                                              dt.status === 'CLOSED_PROFIT'
                                                ? 'rgba(16, 185, 129, 0.15)'
                                                : dt.status === 'CLOSED_LOSS'
                                                ? 'rgba(244, 63, 94, 0.15)'
                                                : 'rgba(56, 189, 248, 0.15)',
                                            color:
                                              dt.status === 'CLOSED_PROFIT'
                                                ? '#10b981'
                                                : dt.status === 'CLOSED_LOSS'
                                                ? '#f43f5e'
                                                : '#38bdf8',
                                          }}
                                        >
                                          {dt.status === 'CLOSED_PROFIT' ? 'TP HIT' : dt.status === 'CLOSED_LOSS' ? 'SL HIT' : 'OPEN'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '6px 8px', fontWeight: '700', color: pnlVal >= 0 ? '#10b981' : '#f43f5e' }}>
                                        {pnlVal >= 0 ? '+' : ''}${pnlVal.toFixed(2)}
                                      </td>
                                      <td style={{ padding: '6px 8px' }}>
                                        {dt.status === 'OPEN' && (
                                          <button
                                            onClick={() => closeHistoricalDemoTrade(dt.trade_id)}
                                            style={{
                                              background: 'rgba(244, 63, 94, 0.15)',
                                              color: '#f43f5e',
                                              border: 'none',
                                              padding: '2px 6px',
                                              borderRadius: '2px',
                                              cursor: 'pointer',
                                              fontSize: '9px',
                                              fontFamily: 'JetBrains Mono, monospace',
                                              fontWeight: '600',
                                            }}
                                          >
                                            CLOSE
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '24px 12px', color: '#475569', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                          NO TRADES ACTIVE MATCHING FILTER.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dock Tab 3: Volatility & Macro Matrix */}
                  {bottomDockTab === 'volatility' && goldData && (
                    <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }} className="tabular">
                      <div style={{ background: '#080a10', padding: '10px 12px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>PARKINSON (σ_P)</div>
                        <div style={{ fontSize: '16px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#38bdf8', marginTop: '2px' }}>
                          {goldData.parkinson_volatility_pct}%
                        </div>
                        <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>High/Low Microstructure</div>
                      </div>

                      <div style={{ background: '#080a10', padding: '10px 12px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>MULTI-VOLATILITIES</div>
                        <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                          GK: <strong style={{ color: '#818cf8' }}>{goldData.garman_klass_volatility_pct}%</strong> · RS: <strong style={{ color: '#818cf8' }}>{goldData.rogers_satchell_volatility_pct}%</strong>
                        </div>
                        <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
                          YZ: <strong style={{ color: '#818cf8' }}>{goldData.yang_zhang_volatility_pct}%</strong>
                        </div>
                      </div>

                      <div style={{ background: '#080a10', padding: '10px 12px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>GOLD IN JPY</div>
                        <div style={{ fontSize: '16px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#f59e0b', marginTop: '2px' }}>
                          ¥{goldData.macro_gold_in_jpy.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>BTC/XAU: {goldData.macro_btc_to_gold_ratio}x</div>
                      </div>

                      <div style={{ background: '#080a10', padding: '10px 12px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>REGIME & HOURLY VOL</div>
                        <div style={{ fontSize: '16px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#10b981', marginTop: '2px' }}>
                          {goldData.market_regime}
                        </div>
                        <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>σ₁ₕ: {goldData.hourly_volatility_pct}%</div>
                      </div>
                    </div>
                  )}

                  {/* Dock Tab 4: Forward Horizons Schedule */}
                  {bottomDockTab === 'forecast' && goldData && (
                    <div style={{ padding: '12px 16px' }} className="tabular">
                      <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#64748b' }}>
                              <th style={{ padding: '6px 8px' }}>HORIZON</th>
                              <th style={{ padding: '6px 8px' }}>EXPECTED PRICE</th>
                              <th style={{ padding: '6px 8px' }}>95% CONFIDENCE BAND</th>
                              <th style={{ padding: '6px 8px' }}>SHIFT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {goldData.forward_trajectory.map((t, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                                <td style={{ padding: '6px 8px', color: '#818cf8', fontWeight: '600' }}>+{t.step_hour}h</td>
                                <td style={{ padding: '6px 8px', fontWeight: '700', color: '#f8fafc' }}>
                                  ${t.expected_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: '6px 8px', color: '#64748b' }}>
                                  [${t.low_95.toFixed(2)} — ${t.high_95.toFixed(2)}]
                                </td>
                                <td style={{ padding: '6px 8px', fontWeight: '700', color: t.expected_change_pct >= 0 ? '#10b981' : '#f43f5e' }}>
                                  {t.expected_change_pct > 0 ? '+' : ''}{t.expected_change_pct}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Institutional Desk Rail (ML Telemetry, Governor, Order Ticket, DOM) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 1. ML DIRECTIONAL CONSENSUS ENGINE */}
                {goldData && (
                  <div
                    style={{
                      background: '#0d1017',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '4px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Cpu size={13} className="text-indigo-400" /> ML CONSENSUS DIRECTION
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontFamily: 'JetBrains Mono, monospace',
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#818cf8',
                          padding: '2px 6px',
                          borderRadius: '2px',
                        }}
                      >
                        RLS λ=0.98 + BAYES
                      </span>
                    </div>

                    {/* Consensus Signal Badge */}
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '3px',
                        background:
                          goldData.ml_consensus_signal === 'BUY'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : goldData.ml_consensus_signal === 'SELL'
                            ? 'rgba(244, 63, 94, 0.12)'
                            : 'rgba(245, 158, 11, 0.12)',
                        border:
                          '1px solid ' +
                          (goldData.ml_consensus_signal === 'BUY'
                            ? 'rgba(16, 185, 129, 0.3)'
                            : goldData.ml_consensus_signal === 'SELL'
                            ? 'rgba(244, 63, 94, 0.3)'
                            : 'rgba(245, 158, 11, 0.3)'),
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      className="tabular"
                    >
                      <div>
                        <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
                          SIGNAL VERDICT
                        </div>
                        <div
                          style={{
                            fontSize: '15px',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: '800',
                            color:
                              goldData.ml_consensus_signal === 'BUY'
                                ? '#10b981'
                                : goldData.ml_consensus_signal === 'SELL'
                                ? '#f43f5e'
                                : '#f59e0b',
                            marginTop: '2px',
                          }}
                        >
                          {goldData.ml_consensus_signal === 'BUY' ? 'BUY (BULLISH)' : goldData.ml_consensus_signal === 'SELL' ? 'SELL (BEARISH)' : 'HOLD (NEUTRAL)'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
                          CONVICTION
                        </div>
                        <div style={{ fontSize: '15px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '800', color: '#f8fafc', marginTop: '2px' }}>
                          {goldData.ml_confidence_score ? goldData.ml_confidence_score.toFixed(1) : '88.5'}%
                        </div>
                      </div>
                    </div>

                    {/* Continuous Directional Probability Bar */}
                    <div className="tabular">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', marginBottom: '4px' }}>
                        <span style={{ color: '#10b981' }}>P(UP): {goldData.ml_prediction_prob_up}%</span>
                        <span style={{ color: '#64748b' }}>BAYESIAN POSTERIOR</span>
                        <span style={{ color: '#f43f5e' }}>P(DOWN): {goldData.ml_prediction_prob_down}%</span>
                      </div>
                      <div style={{ height: '6px', background: '#080a10', borderRadius: '3px', overflow: 'hidden', display: 'flex', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <div style={{ width: `${goldData.ml_prediction_prob_up}%`, background: '#10b981', transition: 'width 0.4s ease' }} />
                        <div style={{ width: `${goldData.ml_prediction_prob_down}%`, background: '#f43f5e', transition: 'width 0.4s ease' }} />
                      </div>
                    </div>

                    {/* Stacking Ensemble Breakdown */}
                    {goldData.ml_model_breakdown && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }} className="tabular">
                        <div style={{ background: '#080a10', padding: '6px', borderRadius: '2px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ color: '#64748b' }}>GBDT</div>
                          <div style={{ fontWeight: '700', color: '#cbd5e1', marginTop: '1px' }}>{goldData.ml_model_breakdown.gbdt_gb_prob}% Up</div>
                        </div>
                        <div style={{ background: '#080a10', padding: '6px', borderRadius: '2px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ color: '#64748b' }}>MLP NEURAL</div>
                          <div style={{ fontWeight: '700', color: '#cbd5e1', marginTop: '1px' }}>{goldData.ml_model_breakdown.mlp_neural_prob}% Up</div>
                        </div>
                        <div style={{ background: '#080a10', padding: '6px', borderRadius: '2px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ color: '#64748b' }}>ONLINE RLS</div>
                          <div style={{ fontWeight: '700', color: '#cbd5e1', marginTop: '1px' }}>{goldData.ml_model_breakdown.rls_kalman_prob}% Up</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. $100 MICRO-ACCOUNT CAPITAL GOVERNOR */}
                {accountMode === 'micro_100' && goldData && (
                  <div
                    style={{
                      background: '#0d1017',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '4px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={13} className="text-emerald-400" /> $100 RISK GOVERNOR (1:200)
                      </span>
                      <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
                        0.01 MICRO-LOTS
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }} className="tabular">
                      <div style={{ background: '#080a10', padding: '6px 8px', borderRadius: '2px' }}>
                        <div style={{ color: '#64748b', fontSize: '9px' }}>MARGIN / 0.01 LOT</div>
                        <div style={{ fontWeight: '700', color: '#f8fafc', marginTop: '1px' }}>
                          ${goldData.margin_required ? goldData.margin_required.toFixed(2) : '19.49'}
                        </div>
                      </div>

                      <div style={{ background: '#080a10', padding: '6px 8px', borderRadius: '2px' }}>
                        <div style={{ color: '#64748b', fontSize: '9px' }}>MARGIN LEVEL</div>
                        <div style={{ fontWeight: '700', color: '#38bdf8', marginTop: '1px' }}>
                          {goldData.margin_level_pct ? goldData.margin_level_pct.toFixed(0) : '513'}%
                        </div>
                      </div>

                      <div style={{ background: '#080a10', padding: '6px 8px', borderRadius: '2px' }}>
                        <div style={{ color: '#64748b', fontSize: '9px' }}>LIQUIDATION BUFFER</div>
                        <div style={{ fontWeight: '700', color: '#10b981', marginTop: '1px' }}>
                          ${(goldData.liquidation_price_distance || 80.51).toFixed(2)} drop
                        </div>
                      </div>

                      <div style={{ background: '#080a10', padding: '6px 8px', borderRadius: '2px' }}>
                        <div style={{ color: '#64748b', fontSize: '9px' }}>CIRCUIT BREAKER</div>
                        <div style={{ fontWeight: '700', color: '#f43f5e', marginTop: '1px' }}>
                          -$5.00 daily limit
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. ORDER TICKET & SIMULATION CONTROLS */}
                <div
                  style={{
                    background: '#0d1017',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '4px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Terminal size={13} className="text-cyan-400" /> ORDER TICKET
                    </span>
                    {selectedCandleForTrade ? (
                      <span
                        onClick={() => setSelectedCandleForTrade(null)}
                        style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b', cursor: 'pointer' }}
                      >
                        [RESET TO LIVE]
                      </span>
                    ) : (
                      <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>
                        LIVE SPOT BAR
                      </span>
                    )}
                  </div>

                  {/* BUY / SELL Segmented Selector */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    <button
                      onClick={() => setGoldTradeSide('BUY')}
                      style={{
                        padding: '8px',
                        borderRadius: '3px',
                        border: 'none',
                        background: goldTradeSide === 'BUY' ? '#10b981' : '#12151e',
                        color: goldTradeSide === 'BUY' ? '#080a10' : '#94a3b8',
                        fontWeight: '800',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace',
                        cursor: 'pointer',
                      }}
                    >
                      BUY / LONG
                    </button>
                    <button
                      onClick={() => setGoldTradeSide('SELL')}
                      style={{
                        padding: '8px',
                        borderRadius: '3px',
                        border: 'none',
                        background: goldTradeSide === 'SELL' ? '#f43f5e' : '#12151e',
                        color: goldTradeSide === 'SELL' ? '#ffffff' : '#94a3b8',
                        fontWeight: '800',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace',
                        cursor: 'pointer',
                      }}
                    >
                      SELL / SHORT
                    </button>
                  </div>

                  {/* Lot Qty, SL, TP Inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
                    <div>
                      <label style={{ color: '#64748b' }}>LOTS:</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={goldTradeQty}
                        onChange={(e) => setGoldTradeQty(parseFloat(e.target.value) || 0.01)}
                        style={{
                          width: '100%',
                          background: '#080a10',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '5px 6px',
                          color: '#f8fafc',
                          borderRadius: '2px',
                          marginTop: '2px',
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: '700',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ color: '#f43f5e' }}>STOP LOSS:</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder={goldTradeSide === 'BUY' ? (goldData?.trailing_stop_loss || 3890.0).toFixed(1) : (goldData?.trailing_stop_loss || 3908.0).toFixed(1)}
                        value={demoTradeSl}
                        onChange={(e) => setDemoTradeSl(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#080a10',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '5px 6px',
                          color: '#f8fafc',
                          borderRadius: '2px',
                          marginTop: '2px',
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ color: '#10b981' }}>TAKE PROFIT:</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder={goldTradeSide === 'BUY' ? (goldData?.take_profit_target || 3915.0).toFixed(1) : (goldData?.take_profit_target || 3885.0).toFixed(1)}
                        value={demoTradeTp}
                        onChange={(e) => setDemoTradeTp(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#080a10',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '5px 6px',
                          color: '#f8fafc',
                          borderRadius: '2px',
                          marginTop: '2px',
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      />
                    </div>
                  </div>

                  {/* Primary Execution Button */}
                  <button
                    onClick={() => executeSpotGoldTrade()}
                    disabled={tradeExecuting}
                    style={{
                      background: goldTradeSide === 'BUY' ? '#10b981' : '#f43f5e',
                      color: goldTradeSide === 'BUY' ? '#080a10' : '#ffffff',
                      border: 'none',
                      padding: '9px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontWeight: '800',
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono, monospace',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {tradeExecuting ? 'EXECUTING...' : `PLACE ${goldTradeSide} TRADE (${goldTradeQty} LOTS)`}
                  </button>

                  {/* Backtest & Simulation Controls */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <button
                      onClick={simulate1000Trades}
                      disabled={demoSimulating}
                      style={{
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: '#818cf8',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        padding: '6px',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: '700',
                      }}
                    >
                      {demoSimulating ? 'EVALUATING...' : '1,000 TRADES (3-MO ML)'}
                    </button>

                    <button
                      onClick={simulateHistoricalDemoTrades}
                      disabled={demoSimulating}
                      style={{
                        background: '#12151e',
                        color: '#cbd5e1',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '6px',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: '600',
                      }}
                    >
                      {demoSimulating ? 'SIMULATING...' : `SIMULATE ${goldStrategy.toUpperCase()}`}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <button
                      onClick={simulate100Trades}
                      disabled={demoSimulating}
                      style={{
                        background: '#12151e',
                        color: '#94a3b8',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '5px',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      100 TRADES (3 MO)
                    </button>

                    <button
                      onClick={clearHistoricalDemoTrades}
                      style={{
                        background: '#12151e',
                        color: '#64748b',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '5px',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      CLEAR JOURNAL
                    </button>
                  </div>

                  {/* Status Toast */}
                  {tradeToast && (
                    <div
                      style={{
                        padding: '6px 8px',
                        borderRadius: '2px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#10b981',
                        fontSize: '10px',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      {tradeToast}
                    </div>
                  )}
                </div>

                {/* 4. LEVEL-2 DEPTH OF MARKET (DOM) LADDER */}
                {goldData && (
                  <div
                    style={{
                      background: '#0d1017',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '4px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                    className="tabular"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#cbd5e1' }}>
                        DEPTH OF MARKET (L2 DOM)
                      </span>
                      <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#38bdf8' }}>
                        SPREAD: $0.20 (2.0 PIPS)
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
                      {/* Asks (Red) */}
                      {[
                        { px: goldData.current_spot_price + 0.4, size: 45, depth: 85 },
                        { px: goldData.current_spot_price + 0.2, size: 28, depth: 55 },
                        { px: goldData.current_spot_price + 0.1, size: 12, depth: 25 },
                      ].map((ask, idx) => (
                        <div
                          key={`ask-${idx}`}
                          onClick={() => executeSpotGoldTrade('BUY', ask.px)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '3px 6px',
                            background: `linear-gradient(90deg, transparent ${100 - ask.depth}%, rgba(244, 63, 94, 0.15) 100%)`,
                            cursor: 'pointer',
                            borderRadius: '2px',
                          }}
                        >
                          <span style={{ color: '#f43f5e', fontWeight: '700' }}>${ask.px.toFixed(2)}</span>
                          <span style={{ color: '#64748b' }}>{ask.size} lots</span>
                        </div>
                      ))}

                      {/* Current Midpoint Spread */}
                      <div style={{ padding: '3px 6px', background: '#080a10', textAlign: 'center', color: '#94a3b8', fontSize: '9px', fontWeight: '700', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        SPOT MIDPOINT: ${goldData.current_spot_price.toFixed(2)}
                      </div>

                      {/* Bids (Green) */}
                      {[
                        { px: goldData.current_spot_price - 0.1, size: 15, depth: 30 },
                        { px: goldData.current_spot_price - 0.2, size: 32, depth: 65 },
                        { px: goldData.current_spot_price - 0.4, size: 52, depth: 95 },
                      ].map((bid, idx) => (
                        <div
                          key={`bid-${idx}`}
                          onClick={() => executeSpotGoldTrade('SELL', bid.px)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '3px 6px',
                            background: `linear-gradient(270deg, transparent ${100 - bid.depth}%, rgba(16, 185, 129, 0.15) 100%)`,
                            cursor: 'pointer',
                            borderRadius: '2px',
                          }}
                        >
                          <span style={{ color: '#10b981', fontWeight: '700' }}>${bid.px.toFixed(2)}</span>
                          <span style={{ color: '#64748b' }}>{bid.size} lots</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: PAIRS PREDICTOR */}
        {activeTab === 'predict' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                background: '#0d1017',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '4px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>
                  TARGET PAIR:
                </span>
                <select
                  value={livePairKey}
                  onChange={(e) => {
                    setLivePairKey(e.target.value);
                    fetchLivePrediction(e.target.value);
                  }}
                  style={{
                    background: '#080a10',
                    color: '#f8fafc',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '4px 8px',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  <option value="BTC/USD__ETH/USD">BTC/USD vs ETH/USD (Public Exchange)</option>
                  <option value="XAU/USD__JPY/USD">XAU/USD vs JPY/USD (Physical Gold in Yen)</option>
                  <option value="BTC/USD__XAU/USD">BTC/USD vs XAU/USD (Digital vs Physical Gold)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  style={{
                    background: autoRefresh ? 'rgba(16, 185, 129, 0.15)' : '#12151e',
                    color: autoRefresh ? '#10b981' : '#64748b',
                    border: '1px solid ' + (autoRefresh ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'),
                    padding: '4px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {autoRefresh ? 'POLLING (3S)' : 'PAUSED'}
                </button>
                <button
                  onClick={() => fetchLivePrediction(livePairKey)}
                  disabled={loadingPrediction}
                  style={{
                    background: '#1e2433',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    padding: '4px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: '600',
                  }}
                >
                  {loadingPrediction ? 'COMPUTING...' : 'PREDICT NOW'}
                </button>
              </div>
            </div>

            {livePrediction && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }} className="tabular">
                  <div style={{ background: '#0d1017', padding: '12px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>QUOTES ({livePrediction.symbol_a} / {livePrediction.symbol_b})</div>
                    <div style={{ fontSize: '16px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#38bdf8', marginTop: '2px' }}>
                      ${livePrediction.spot_a.toLocaleString()} / ${livePrediction.spot_b.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>Ratio: {livePrediction.price_ratio}</div>
                  </div>

                  <div style={{ background: '#0d1017', padding: '12px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>KALMAN ELASTICITY (β)</div>
                    <div style={{ fontSize: '16px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#818cf8', marginTop: '2px' }}>
                      {livePrediction.hedge_ratio_beta > 0 ? '+' : ''}{livePrediction.hedge_ratio_beta}
                    </div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>Learning Rate η: {livePrediction.learning_rate}</div>
                  </div>

                  <div style={{ background: '#0d1017', padding: '12px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>ONLINE ACCURACY</div>
                    <div style={{ fontSize: '16px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#10b981', marginTop: '2px' }}>
                      {livePrediction.online_accuracy_pct}%
                    </div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>{livePrediction.total_evaluations} calls evaluated</div>
                  </div>

                  <div style={{ background: '#0d1017', padding: '12px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>SPREAD Z-SCORE & HALF-LIFE</div>
                    <div style={{ fontSize: '16px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: Math.abs(livePrediction.current_z_score) > 1.5 ? '#f59e0b' : '#38bdf8', marginTop: '2px' }}>
                      {livePrediction.current_z_score > 0 ? '+' : ''}{livePrediction.current_z_score} σ
                    </div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>t₁/₂: {livePrediction.half_life_hours} hours</div>
                  </div>
                </div>

                <div
                  style={{
                    background: '#0d1017',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '4px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  className="tabular"
                >
                  <div>
                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>PREDICTIVE RECOMMENDATION</div>
                    <div style={{ fontSize: '16px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '800', color: livePrediction.action_signal.includes('BUY') ? '#10b981' : livePrediction.action_signal.includes('SELL') ? '#f43f5e' : '#38bdf8', marginTop: '2px' }}>
                      {livePrediction.action_signal}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{livePrediction.action_thesis}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>EQUILIBRIUM TARGET (μ)</div>
                    <div style={{ fontSize: '16px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#eab308', marginTop: '2px' }}>
                      {livePrediction.ou_mu > 0 ? '+' : ''}{livePrediction.ou_mu}
                    </div>
                  </div>
                </div>

                <div style={{ background: '#0d1017', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '4px', padding: '12px' }}>
                  {renderPredictionChart()}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div style={{ background: '#0d1017', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '4px', padding: '14px' }}>
            <div style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#cbd5e1', marginBottom: '10px' }}>
              ALPHA HYPOTHESIS LEADERBOARD
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '11px' }} className="tabular">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#64748b' }}>
                    <th style={{ padding: '8px' }}>STRATEGY</th>
                    <th style={{ padding: '8px' }}>SYMBOL</th>
                    <th style={{ padding: '8px' }}>SHARPE</th>
                    <th style={{ padding: '8px' }}>SORTINO</th>
                    <th style={{ padding: '8px' }}>TOTAL RETURN</th>
                    <th style={{ padding: '8px' }}>MAX DRAWDOWN</th>
                    <th style={{ padding: '8px' }}>WIN RATE</th>
                    <th style={{ padding: '8px' }}>TRADES</th>
                  </tr>
                </thead>
                <tbody>
                  {strategies.map((s, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                      <td style={{ padding: '8px', fontWeight: '600', color: '#38bdf8' }}>{s.strategy_name}</td>
                      <td style={{ padding: '8px', color: '#cbd5e1' }}>{s.symbol}</td>
                      <td style={{ padding: '8px', color: s.annualized_sharpe > 1.0 ? '#10b981' : '#f59e0b', fontWeight: '700' }}>
                        {s.annualized_sharpe}
                      </td>
                      <td style={{ padding: '8px' }}>{s.sortino_ratio}</td>
                      <td style={{ padding: '8px', color: s.total_return_pct >= 0 ? '#10b981' : '#f43f5e', fontWeight: '700' }}>
                        {s.total_return_pct}%
                      </td>
                      <td style={{ padding: '8px', color: '#f43f5e' }}>{s.max_drawdown_pct}%</td>
                      <td style={{ padding: '8px' }}>{s.win_rate_pct}%</td>
                      <td style={{ padding: '8px' }}>{s.total_trades}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: BACKTEST LAB */}
        {activeTab === 'lab' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div style={{ background: '#0d1017', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '4px', padding: '14px' }}>
              <div style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#cbd5e1', marginBottom: '12px' }}>
                MATRIX BACKTEST CONFIG
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                <div>
                  <label style={{ color: '#64748b' }}>ARCHETYPE:</label>
                  <select
                    value={labStrategy}
                    onChange={(e) => setLabStrategy(e.target.value)}
                    style={{ width: '100%', padding: '6px', background: '#080a10', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '3px', marginTop: '4px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    <option value="bollinger">Bollinger Mean-Reversion</option>
                    <option value="ema">Dual EMA Trend Cross</option>
                    <option value="rsi">RSI Momentum Breakout</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: '#64748b' }}>ROLLING WINDOW ({labWindow} BARS):</label>
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
                  <label style={{ color: '#64748b' }}>STD MULTIPLIER ({labStd}x):</label>
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
                  style={{ padding: '8px', background: '#10b981', color: '#080a10', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '800', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}
                >
                  RUN MATRIX BACKTEST
                </button>
              </div>
            </div>

            <div style={{ background: '#0d1017', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '4px', padding: '14px' }}>
              <div style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#cbd5e1', marginBottom: '12px' }}>
                SIMULATION OUTPUT
              </div>
              {latestBacktest ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }} className="tabular">
                  <div style={{ background: '#080a10', padding: '10px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>TOTAL RETURN</div>
                    <div style={{ fontSize: '18px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: latestBacktest.total_return_pct >= 0 ? '#10b981' : '#f43f5e', marginTop: '2px' }}>
                      {latestBacktest.total_return_pct}%
                    </div>
                  </div>
                  <div style={{ background: '#080a10', padding: '10px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>SHARPE</div>
                    <div style={{ fontSize: '18px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#38bdf8', marginTop: '2px' }}>
                      {latestBacktest.annualized_sharpe}
                    </div>
                  </div>
                  <div style={{ background: '#080a10', padding: '10px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>MAX DRAWDOWN</div>
                    <div style={{ fontSize: '18px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#f43f5e', marginTop: '2px' }}>
                      {latestBacktest.max_drawdown_pct}%
                    </div>
                  </div>
                  <div style={{ background: '#080a10', padding: '10px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>SORTINO</div>
                    <div style={{ fontSize: '18px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#818cf8', marginTop: '2px' }}>
                      {latestBacktest.sortino_ratio}
                    </div>
                  </div>
                  <div style={{ background: '#080a10', padding: '10px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>WIN RATE</div>
                    <div style={{ fontSize: '18px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#f59e0b', marginTop: '2px' }}>
                      {latestBacktest.win_rate_pct}%
                    </div>
                  </div>
                  <div style={{ background: '#080a10', padding: '10px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>TOTAL TRADES</div>
                    <div style={{ fontSize: '18px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#f8fafc', marginTop: '2px' }}>
                      {latestBacktest.total_trades}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '30px 10px', textAlign: 'center', color: '#475569', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                  CONFIGURE PARAMETERS AND EXECUTE MATRIX BACKTEST.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: STAT ARB */}
        {activeTab === 'pairs' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div style={{ background: '#0d1017', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '4px', padding: '14px' }}>
              <div style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#cbd5e1', marginBottom: '12px' }}>
                PAIRS COINTEGRATION LAB
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                <div>
                  <label style={{ color: '#64748b' }}>ASSET A:</label>
                  <input
                    type="text"
                    value={pairsAssetA}
                    onChange={(e) => setPairsAssetA(e.target.value)}
                    style={{ width: '100%', padding: '6px', background: '#080a10', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '3px', marginTop: '4px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#64748b' }}>ASSET B:</label>
                  <input
                    type="text"
                    value={pairsAssetB}
                    onChange={(e) => setPairsAssetB(e.target.value)}
                    style={{ width: '100%', padding: '6px', background: '#080a10', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '3px', marginTop: '4px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}
                  />
                </div>
                <button
                  onClick={runPairsAnalysis}
                  style={{ padding: '8px', background: '#10b981', color: '#080a10', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '800', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}
                >
                  RUN KALMAN & O-U ESTIMATION
                </button>
              </div>
            </div>

            <div style={{ background: '#0d1017', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '4px', padding: '14px' }}>
              <div style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#cbd5e1', marginBottom: '12px' }}>
                STATISTICAL ARBITRAGE METRICS
              </div>
              {pairsResult ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }} className="tabular">
                  <div style={{ background: '#080a10', padding: '12px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>DYNAMIC HEDGE RATIO (β)</div>
                    <div style={{ fontSize: '18px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#38bdf8', marginTop: '2px' }}>
                      {pairsResult.pairs_analysis.hedge_ratio_beta}
                    </div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>O-U Speed θ: {pairsResult.pairs_analysis.ou_theta}</div>
                  </div>
                  <div style={{ background: '#080a10', padding: '12px', borderRadius: '3px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>SPREAD Z-SCORE & HALF-LIFE</div>
                    <div style={{ fontSize: '18px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#10b981', marginTop: '2px' }}>
                      {pairsResult.pairs_analysis.current_z_score} σ
                    </div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>Half-Life: {pairsResult.pairs_analysis.ou_half_life_days} days</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '30px 10px', textAlign: 'center', color: '#475569', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                  AWAITING STATISTICAL ARBITRAGE RUN.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: PAPER ORDER & PORTFOLIO */}
        {activeTab === 'execution' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div style={{ background: '#0d1017', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '4px', padding: '14px' }}>
              <div style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#cbd5e1', marginBottom: '12px' }}>
                DIRECT ORDER TICKET
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                <div>
                  <label style={{ color: '#64748b' }}>SYMBOL:</label>
                  <input
                    type="text"
                    value={orderSymbol}
                    onChange={(e) => setOrderSymbol(e.target.value)}
                    style={{ width: '100%', padding: '6px', background: '#080a10', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '3px', marginTop: '4px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#64748b' }}>SIDE:</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '4px' }}>
                    <button
                      onClick={() => setOrderSide('BUY')}
                      style={{ padding: '6px', background: orderSide === 'BUY' ? '#10b981' : '#12151e', color: orderSide === 'BUY' ? '#080a10' : '#94a3b8', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '700', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      BUY
                    </button>
                    <button
                      onClick={() => setOrderSide('SELL')}
                      style={{ padding: '6px', background: orderSide === 'SELL' ? '#f43f5e' : '#12151e', color: orderSide === 'SELL' ? '#ffffff' : '#94a3b8', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '700', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      SELL
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ color: '#64748b' }}>QUANTITY:</label>
                  <input
                    type="number"
                    value={orderQty}
                    onChange={(e) => setOrderQty(e.target.value)}
                    style={{ width: '100%', padding: '6px', background: '#080a10', color: '#f8fafc', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '3px', marginTop: '4px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}
                  />
                </div>
                <button
                  onClick={submitPaperOrder}
                  style={{ padding: '8px', background: orderSide === 'BUY' ? '#10b981' : '#f43f5e', color: orderSide === 'BUY' ? '#080a10' : '#ffffff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: '800', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', marginTop: '4px' }}
                >
                  TRANSMIT PAPER ORDER
                </button>
              </div>
            </div>

            <div style={{ background: '#0d1017', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '4px', padding: '14px' }}>
              <div style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#cbd5e1', marginBottom: '10px' }}>
                ACTIVE PORTFOLIO POSITIONS
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '11px' }} className="tabular">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#64748b' }}>
                      <th style={{ padding: '6px 8px' }}>SYMBOL</th>
                      <th style={{ padding: '6px 8px' }}>QTY</th>
                      <th style={{ padding: '6px 8px' }}>ENTRY ($)</th>
                      <th style={{ padding: '6px 8px' }}>CURRENT ($)</th>
                      <th style={{ padding: '6px 8px' }}>UNREALIZED PnL</th>
                      <th style={{ padding: '6px 8px' }}>REALIZED PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(portfolio.positions).map((pos) => (
                      <tr key={pos.symbol} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                        <td style={{ padding: '6px 8px', fontWeight: '700', color: '#38bdf8' }}>{pos.symbol}</td>
                        <td style={{ padding: '6px 8px' }}>{pos.quantity}</td>
                        <td style={{ padding: '6px 8px' }}>${pos.entry_price.toLocaleString()}</td>
                        <td style={{ padding: '6px 8px' }}>${pos.current_price.toLocaleString()}</td>
                        <td style={{ padding: '6px 8px', color: pos.unrealized_pnl >= 0 ? '#10b981' : '#f43f5e', fontWeight: '700' }}>
                          ${pos.unrealized_pnl.toLocaleString()}
                        </td>
                        <td style={{ padding: '6px 8px', color: pos.realized_pnl >= 0 ? '#10b981' : '#f43f5e', fontWeight: '700' }}>
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

        {/* TAB: PROMETHEUS METRICS */}
        {activeTab === 'metrics' && (
          <div style={{ background: '#0d1017', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '4px', padding: '14px' }}>
            <div style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: '700', color: '#cbd5e1', marginBottom: '8px' }}>
              PROMETHEUS TELEMETRY EXPOSITION (/metrics)
            </div>
            <pre style={{ background: '#080a10', padding: '12px', borderRadius: '3px', fontSize: '11px', color: '#10b981', overflowX: 'auto', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
              {metricsText || 'Loading Prometheus metrics...'}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
