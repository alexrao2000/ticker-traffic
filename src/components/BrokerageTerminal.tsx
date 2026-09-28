import React, { useState } from 'react';
import { BrokerageConfig, BrokerOrder, StockLane } from '../types/market';
import { Key, Shield, ArrowUpRight, ArrowDownRight, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink, Settings, Terminal, Zap } from 'lucide-react';
import { sound } from '../services/audio';

interface BrokerageTerminalProps {
  config: BrokerageConfig;
  onUpdateConfig: (config: Partial<BrokerageConfig>) => void;
  orders: BrokerOrder[];
  activeLane: StockLane | null;
  onPlaceManualOrder: (symbol: string, action: 'BUY' | 'SELL', shares: number) => void;
}

export const BrokerageTerminal: React.FC<BrokerageTerminalProps> = ({
  config,
  onUpdateConfig,
  orders,
  activeLane,
  onPlaceManualOrder,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState(config.apiKey || 'PK_DEMO_LIVE_7749210');
  const [secretKeyInput, setSecretKeyInput] = useState(config.secretKey || '••••••••••••••••••••••••');
  const [orderShares, setOrderShares] = useState<number>(10);
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'api_settings' | 'webhook'>('positions');

  const handleConnectToggle = () => {
    onUpdateConfig({
      isConnected: !config.isConnected,
      apiKey: apiKeyInput,
    });
    sound.playOrderExecuted();
  };

  return (
    <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl overflow-hidden font-mono text-xs">
      {/* Terminal Title Bar */}
      <div className="bg-neutral-900/90 px-4 py-3 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-neutral-200">Execution Bridge & Trading Terminal</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
            config.isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-neutral-800 text-neutral-400 border-neutral-700'
          }`}>
            {config.isConnected ? `CONNECTED: ${config.provider.toUpperCase()}` : 'SIMULATION MODE'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Paper vs Live Toggle */}
          <button
            onClick={() => onUpdateConfig({ isPaperTrading: !config.isPaperTrading })}
            className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
              config.isPaperTrading
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}
          >
            {config.isPaperTrading ? 'PAPER TRADING' : 'LIVE CAPITAL'}
          </button>

          {/* Auto Lane Execution toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer bg-neutral-800/80 px-2.5 py-1 rounded border border-neutral-700 hover:bg-neutral-800 transition-colors">
            <input
              type="checkbox"
              checked={config.autoExecuteOrders}
              onChange={(e) => onUpdateConfig({ autoExecuteOrders: e.target.checked })}
              className="rounded bg-neutral-950 border-neutral-600 text-sky-500 focus:ring-0"
            />
            <span className="text-[11px] text-neutral-300 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              Auto-Execute on Lane Switch
            </span>
          </label>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-4 px-4 pt-2 border-b border-neutral-800/80 bg-neutral-950/40 text-neutral-400">
        <button
          onClick={() => setActiveTab('positions')}
          className={`pb-2 transition-colors ${
            activeTab === 'positions' ? 'text-sky-400 border-b-2 border-sky-400 font-semibold' : 'hover:text-neutral-200'
          }`}
        >
          Active Portfolio (${config.accountEquity.toLocaleString()})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'orders' ? 'text-sky-400 border-b-2 border-sky-400 font-semibold' : 'hover:text-neutral-200'
          }`}
        >
          Order Audit Trail ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('api_settings')}
          className={`pb-2 transition-colors flex items-center gap-1 ${
            activeTab === 'api_settings' ? 'text-sky-400 border-b-2 border-sky-400 font-semibold' : 'hover:text-neutral-200'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Broker API Settings
        </button>
        <button
          onClick={() => setActiveTab('webhook')}
          className={`pb-2 transition-colors flex items-center gap-1 ${
            activeTab === 'webhook' ? 'text-sky-400 border-b-2 border-sky-400 font-semibold' : 'hover:text-neutral-200'
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Webhook & Webull / Alpaca Webhooks
        </button>
      </div>

      {/* Tab 1: Active Portfolio & Quick Order Desk */}
      {activeTab === 'positions' && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800 space-y-2">
            <span className="text-neutral-400 text-[11px] block">Brokerage Account Summary</span>
            <div className="flex justify-between items-baseline">
              <span className="text-neutral-400">Net Account Equity:</span>
              <span className="font-bold text-neutral-100 text-sm">${config.accountEquity.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-neutral-400">Buying Power:</span>
              <span className="font-bold text-emerald-400">${config.buyingPower.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-neutral-400">Active Lane Focus:</span>
              <span className="font-bold text-sky-400">
                {activeLane ? `${activeLane.symbol} ($${activeLane.currentPrice})` : '100% Cash Reserve'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800 space-y-2">
            <span className="text-neutral-400 text-[11px] block">Lane Execution Rule</span>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              When enabled, moving between lanes automatically sends a synchronized market order: selling out of the abandoned congested lane and buying into the new lane.
            </p>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400">Order Allocation:</span>
              <span className="text-neutral-200 font-semibold">${config.orderSizeUsd} / switch</span>
            </div>
          </div>

          {/* Quick Manual Trade Desk */}
          <div className="p-3 bg-neutral-950/60 rounded-lg border border-neutral-800 space-y-2.5">
            <span className="text-neutral-400 text-[11px] block">
              {activeLane ? `Direct Order Entry: ${activeLane.symbol}` : 'Direct Order Entry'}
            </span>
            {activeLane ? (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={orderShares}
                    onChange={(e) => setOrderShares(parseInt(e.target.value, 10) || 1)}
                    className="w-20 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-neutral-100 font-mono text-xs"
                    placeholder="Shares"
                  />
                  <span className="text-[11px] text-neutral-400">shares (~${(orderShares * activeLane.currentPrice).toFixed(0)})</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onPlaceManualOrder(activeLane.symbol, 'BUY', orderShares)}
                    className="flex-1 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    BUY {activeLane.symbol}
                  </button>
                  <button
                    onClick={() => onPlaceManualOrder(activeLane.symbol, 'SELL', orderShares)}
                    className="flex-1 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 rounded font-semibold transition-colors flex items-center justify-center gap-1"
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    SELL {activeLane.symbol}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-neutral-400 italic">
                Currently parked in 100% Cash Reserve. Select any stock lane below to enter a trade.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Orders Audit Trail */}
      {activeTab === 'orders' && (
        <div className="p-4">
          {orders.length === 0 ? (
            <div className="text-center py-6 text-neutral-500 border border-dashed border-neutral-800 rounded">
              No orders sent to brokerage yet. Switch lanes or submit an order to execute real-time fills.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {orders.map((ord) => (
                <div
                  key={ord.id}
                  className="flex items-center justify-between p-2 rounded bg-neutral-950/70 border border-neutral-800 text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                      ord.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {ord.action}
                    </span>
                    <span className="font-bold text-neutral-200">{ord.shares} {ord.symbol}</span>
                    <span className="text-neutral-500">@ ${ord.price.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-neutral-400">Total: ${ord.totalValue.toFixed(0)}</span>
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> {ord.status.toUpperCase()}
                    </span>
                    <span className="text-neutral-500 text-[10px]">
                      {new Date(ord.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: API Settings */}
      {activeTab === 'api_settings' && (
        <div className="p-4 space-y-4 max-w-2xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-neutral-300 font-semibold flex items-center gap-2">
                <Key className="w-4 h-4 text-sky-400" />
                Select Brokerage Integration
              </label>
              <select
                value={config.provider}
                onChange={(e) => onUpdateConfig({ provider: e.target.value as any })}
                className="bg-neutral-900 border border-neutral-700 text-neutral-200 px-3 py-1 rounded"
              >
                <option value="alpaca">Alpaca Trading API (REST & Streaming)</option>
                <option value="interactive_brokers">Interactive Brokers (TWS / Client Portal API)</option>
                <option value="polygon">Polygon.io (Market Data Feed)</option>
                <option value="webull">Webull OpenAPI</option>
                <option value="simulator">Sandbox Simulation Bridge</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-neutral-400 block text-[11px] mb-1">API Key ID</label>
                <input
                  type="text"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-1.5 text-neutral-200"
                  placeholder="PK_YOUR_API_KEY"
                />
              </div>

              <div>
                <label className="text-neutral-400 block text-[11px] mb-1">Secret Key</label>
                <input
                  type="password"
                  value={secretKeyInput}
                  onChange={(e) => setSecretKeyInput(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-1.5 text-neutral-200"
                  placeholder="••••••••••••••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-neutral-500">
                Credentials are kept in-browser for executing real-time paper & live orders.
              </span>
              <button
                onClick={handleConnectToggle}
                className={`px-4 py-1.5 rounded font-semibold text-xs transition-colors ${
                  config.isConnected
                    ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    : 'bg-sky-600 hover:bg-sky-500 text-white'
                }`}
              >
                {config.isConnected ? 'Disconnect Broker' : 'Connect & Authorize'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Webhook & Algorithmic Integration */}
      {activeTab === 'webhook' && (
        <div className="p-4 space-y-3">
          <p className="text-neutral-300 text-xs">
            Connect external trading tools (TradingView, MetaTrader, custom Python algos) directly to this visual highway via webhook:
          </p>
          <div className="bg-neutral-950 p-3 rounded border border-neutral-800 text-[11px] text-neutral-400 space-y-2">
            <div>
              <span className="text-neutral-500 block">Webhook Endpoint:</span>
              <code className="text-sky-400">POST https://api.tickertraffic.app/v1/lane-switch</code>
            </div>
            <div>
              <span className="text-neutral-500 block">JSON Payload Format:</span>
              <pre className="text-neutral-300 text-[10px] mt-1 bg-neutral-900/60 p-2 rounded">
{`{
  "event": "LANE_SWITCH",
  "symbol": "${activeLane ? activeLane.symbol : 'NVDA'}",
  "reason": "HIGH_CONGESTION_ESCAPE",
  "action": "ROTATE_CAPITAL",
  "bankedDistanceUsd": 450.00
}`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
