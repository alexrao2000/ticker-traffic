import React from 'react';
import { StockLane } from '../types/market';
import { ArrowUpRight, ArrowDownRight, Gauge } from 'lucide-react';

interface LaneSelectorPanelProps {
  lanes: StockLane[];
  currentLaneIndex: number;
  onSelectLane: (index: number) => void;
}

export const LaneSelectorPanel: React.FC<LaneSelectorPanelProps> = ({
  lanes,
  currentLaneIndex,
  onSelectLane,
}) => {
  return (
    <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-200">Expressway Lane Directory</h3>
          <p className="text-xs text-neutral-400">Click any lane to switch, bank current gains, and enter that stock's traffic flow.</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Dropping/Jammed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Open Highway
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {lanes.map((lane, index) => {
          const isSelected = index === currentLaneIndex;
          const isRed = lane.recentDrop || lane.pctChange < 0;
          const isCongested = lane.congestion > 0.5;

          // Sparkline coordinates
          const minPrice = Math.min(...lane.priceHistory);
          const maxPrice = Math.max(...lane.priceHistory);
          const range = maxPrice - minPrice || 1;
          const points = lane.priceHistory
            .map((val, idx) => {
              const x = (idx / (lane.priceHistory.length - 1)) * 90;
              const y = 24 - ((val - minPrice) / range) * 20;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');

          return (
            <button
              key={lane.id}
              onClick={() => onSelectLane(index)}
              className={`h-[114px] text-left p-3 rounded-lg border flex flex-col justify-between transition-colors relative overflow-hidden ${
                isSelected
                  ? 'bg-neutral-800/90 border-sky-500 ring-1 ring-sky-500/50'
                  : isRed
                  ? 'bg-rose-950/20 border-rose-900/50 hover:bg-rose-900/30'
                  : 'bg-neutral-900/70 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/40'
              }`}
            >
              {/* Lane Indicator Top Strip */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  isSelected ? 'bg-sky-400' : isRed ? 'bg-rose-500' : 'bg-neutral-700'
                }`}
              />

              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-neutral-400">L{index + 1}</span>
                    <span className="text-sm font-bold font-mono text-neutral-100">{lane.symbol}</span>
                    {isSelected && (
                      <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 font-semibold">
                        YOU
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-400 block truncate max-w-[110px]">
                    {lane.name}
                  </span>
                </div>

                <div className="text-right">
                  <div className="text-xs font-mono tabular-nums font-bold text-neutral-200">
                    ${lane.currentPrice.toLocaleString(undefined, {
                      minimumFractionDigits: lane.id === 'btc' ? 0 : 2,
                      maximumFractionDigits: lane.id === 'btc' ? 1 : 2,
                    })}
                  </div>
                  <div
                    className={`text-[11px] font-mono tabular-nums font-semibold flex items-center justify-end ${
                      lane.pctChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {lane.pctChange >= 0 ? (
                      <ArrowUpRight className="w-3 h-3 shrink-0" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 shrink-0" />
                    )}
                    {lane.pctChange >= 0 ? '+' : ''}
                    {lane.pctChange.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Sparkline */}
              <div className="h-5 w-full">
                <svg viewBox="0 0 90 26" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke={isRed ? '#f43f5e' : '#10b981'}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                  />
                </svg>
              </div>

              {/* Telemetry Row */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-800">
                <span className="text-neutral-400 flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-neutral-500" />
                  <span className="font-mono tabular-nums">{lane.speedMph} mph</span>
                </span>

                <span
                  className={`font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded ${
                    isCongested
                      ? 'bg-rose-500/20 text-rose-300 font-bold'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {isCongested ? 'JAMMED' : `${(lane.congestion * 100).toFixed(0)}% jam`}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
