import React, { useState, useEffect } from 'react';

export default function App() {
  const [portfolio, setPortfolio] = useState({
    cash: 100000.0,
    equity: 100000.0,
    total_pnl: 0.0,
    positions: {},
  });

  const [strategies, setStrategies] = useState([]);
  const [activeTab, setActiveTab] = useState('leaderboard'); // leaderboard | lab | risk | execution | metrics
  const [regime, setRegime] = useState('MEAN_REVERTING');
  const [metricsText, setMetricsText] = useState('');
  const [statusMessage, setStatusMessage] = useState('Ready for Autonomous Alpha Swarm Cycles');

  // Backtest Lab inputs
  const [labStrategy, setLabStrategy] = useState('bollinger');
  const [labWindow, setLabWindow] = useState(20);
  const [labStd, setLabStd] = useState(2.0);
  const [latestBacktest, setLatestBacktest] = useState(null);

  // Execution inputs
  const [orderSymbol, setOrderSymbol] = useState('BTC/USD');
  const [orderQty, setOrderQty] = useState(1.0);
  const [orderSide, setOrderSide] = useState('BUY');

  useEffect(() => {
    fetchPortfolio();
    fetchStrategies();
    const interval = setInterval(() => {
      fetchPortfolio();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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

  const runFullResearch = async () => {
    setStatusMessage('Executing Autonomous Alpha Hypothesis & Monte Carlo Swarm Cycle...');
    try {
      const res = await fetch('/api/v1/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: 'BTC/USD', n_bars: 350 }),
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
          symbol: 'ETH/USD',
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

  const submitPaperOrder = async () => {
    setStatusMessage(`Submitting Paper Order: ${orderSide} ${orderQty} ${orderSymbol}...`);
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: orderSymbol,
          side: orderSide,
          quantity: parseFloat(orderQty),
          market_price: 65000.0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatusMessage(`Order ${data.order_id} filled @ $${data.filled_price} (Status: ${data.status})`);
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

  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f8fafc', padding: '24px' }}>
      {/* Top Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
            QUANT SENTINEL <span style={{ fontSize: '13px', background: '#065f46', color: '#d1fae5', padding: '3px 8px', borderRadius: '4px', marginLeft: '8px' }}>v1.0.0</span>
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#94a3b8' }}>
            Autonomous Quantitative Alpha Swarm: Vectorized Backtesting, Monte Carlo Risk Governance & Paper Execution
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
            Total PnL: <strong style={{ color: portfolio.total_pnl >= 0 ? '#10b981' : '#ef4444' }}>${portfolio.total_pnl.toLocaleString()}</strong>
          </div>
          <div style={{ background: '#111827', padding: '8px 12px', borderRadius: '6px' }}>
            Market Regime: <strong style={{ color: '#f59e0b' }}>{regime}</strong>
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
          { id: 'leaderboard', label: '🏆 Alpha Hypothesis Leaderboard' },
          { id: 'lab', label: '🔬 Vectorized Backtest Lab' },
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

      {/* Tab 1: Leaderboard */}
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

      {/* Tab 2: Backtest Lab */}
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
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>Configure parameters and click "Run Zero-Loop Matrix Backtest" to view analytics.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Execution Hub */}
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

      {/* Tab 4: Metrics */}
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
