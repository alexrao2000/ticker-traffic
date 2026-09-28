import React from 'react';
import { Gauge, Milestone, DollarSign, AlertTriangle, ArrowRightLeft, ShieldCheck, ShieldAlert } from 'lucide-react';
import { StockLane } from '../types/market';

interface CockpitTelemetryProps {
  activeLane: StockLane | null; // null or laneIndex 5 = in 100% Cash
  distanceAccrued: number;
  unrealizedEarnings: number;
  realizedBank: number;
  totalSwitches: number;
  totalCollisionLosses: number;
  carHealth: number;
  onCashInSwitch: () => void;
  onExitToCash: () => void;
  isCashPosition: boolean;
}

export const CockpitTelemetry: React.FC<CockpitTelemetryProps> = ({
  activeLane,
  distanceAccrued,
  unrealizedEarnings,
  realizedBank,
  totalSwitches,
  totalCollisionLosses,
  carHealth,
  onCashInSwitch,
  onExitToCash,
  isCashPosition,
}) => {
  const isCongested = activeLane ? activeLane.congestion > 0.45 : false;
  const isDropping = activeLane ? activeLane.recentDrop || activeLane.pctChange < 0 : false;
  const netEarnings = realizedBank + (isCashPosition ? 0 : unrealizedEarnings) - totalCollisionLosses;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Volatility Speedometer */}
      <div
        className={`h-[118px] p-3.5 rounded-xl border flex flex-col justify-between transition-colors ${
          isCashPosition
            ? 'bg-emerald-950/15 border-emerald-800/40'
            : isDropping
            ? 'bg-rose-950/20 border-rose-800/40'
            : 'bg-neutral-900/60 border-neutral-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
            <Gauge className="w-3.5 h-3.5 text-sky-400" />
            Position & Volatility
          </span>
          <span
            className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
              isCashPosition
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {isCashPosition ? '100% CASH' : `Beta ${activeLane?.volatility.toFixed(1)}`}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-neutral-100">
              {isCashPosition ? '0' : activeLane?.speedMph}
            </span>
            <span className="text-xs font-mono text-neutral-500">MPH</span>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-mono tabular-nums text-neutral-400">
              {isCashPosition ? '0% Risk' : `${activeLane?.impliedVol}% IV`}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden border border-neutral-800">
            <div
              className={`h-full transition-all duration-300 ${
                isCashPosition
                  ? 'bg-emerald-400'
                  : isDropping
                  ? 'bg-rose-500'
                  : 'bg-sky-500'
              }`}
              style={{
                width: isCashPosition ? '100%' : `${Math.min(100, ((activeLane?.speedMph || 0) / 190) * 100)}%`,
              }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-400">
            <span className="truncate max-w-[120px]">
              {isCashPosition ? 'Parked on Shoulder' : `${activeLane?.symbol} · ${activeLane?.sector}`}
            </span>
            <span
              className={`font-mono tabular-nums font-semibold ${
                isCashPosition
                  ? 'text-emerald-400'
                  : activeLane && activeLane.pctChange >= 0
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              {isCashPosition ? 'SAFE RESERVE' : `${activeLane && activeLane.pctChange >= 0 ? '+' : ''}${activeLane?.pctChange.toFixed(2)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Congestion & Road Friction */}
      <div
        className={`h-[118px] p-3.5 rounded-xl border flex flex-col justify-between transition-colors ${
          isCashPosition
            ? 'bg-neutral-900/60 border-neutral-800'
            : isCongested
            ? 'bg-rose-950/20 border-rose-700/50'
            : 'bg-neutral-900/60 border-neutral-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
            <AlertTriangle
              className={`w-3.5 h-3.5 ${
                isCashPosition ? 'text-emerald-400' : isCongested ? 'text-rose-400' : 'text-neutral-500'
              }`}
            />
            Traffic Jam Risk
          </span>
          <span
            className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded font-medium ${
              isCashPosition
                ? 'bg-emerald-500/10 text-emerald-400'
                : activeLane && activeLane.congestion > 0.65
                ? 'bg-rose-500/20 text-rose-300'
                : activeLane && activeLane.congestion > 0.35
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {isCashPosition
              ? 'ZERO EXPOSURE'
              : activeLane && activeLane.congestion > 0.65
              ? 'JAMMED'
              : activeLane && activeLane.congestion > 0.35
              ? 'SLOW'
              : 'OPEN'}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-neutral-100">
              {isCashPosition ? '0' : ((activeLane?.congestion || 0) * 100).toFixed(0)}%
            </span>
            <span className="text-xs text-neutral-500">{isCashPosition ? 'Exposure' : 'Density'}</span>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-mono tabular-nums text-neutral-400">
              {isCashPosition ? 'No Traffic' : `${((activeLane?.congestion || 0) * 100).toFixed(0)}% Friction`}
            </span>
          </div>
        </div>

        <div>
          <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden border border-neutral-800">
            <div
              className={`h-full transition-all duration-300 ${
                isCashPosition ? 'bg-emerald-400' : isCongested ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{
                width: isCashPosition ? '0%' : `${Math.min(100, (activeLane?.congestion || 0) * 100)}%`,
              }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-400">
            <span>{isCashPosition ? 'Protected from market drops' : isCongested ? 'Traffic blocked forward' : 'Cruising without drag'}</span>
            <span className="font-mono tabular-nums text-neutral-500">
              {isCashPosition ? 'Cash' : `${activeLane?.vehicleCount} cars`}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Distance & Earnings Odometer */}
      <div className="h-[118px] p-3.5 rounded-xl border bg-neutral-900/60 border-neutral-800 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
            <Milestone className="w-3.5 h-3.5 text-emerald-400" />
            Unrealized Distance
          </span>
          <span className="text-[10px] font-mono tabular-nums text-neutral-400">
            {distanceAccrued.toFixed(1)} mi
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span
            className={`text-2xl font-bold font-mono tabular-nums ${
              isCashPosition ? 'text-neutral-400' : unrealizedEarnings >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isCashPosition ? '$0' : `${unrealizedEarnings >= 0 ? '+' : ''}$${unrealizedEarnings.toFixed(0)}`}
          </span>
          <span className="text-xs font-mono tabular-nums text-neutral-400">
            Vault: ${realizedBank.toFixed(0)}
          </span>
        </div>

        <div className="pt-1.5 border-t border-neutral-800 flex items-center justify-between text-xs font-mono tabular-nums">
          <span className="text-neutral-500">Portfolio Net:</span>
          <span className={`font-bold ${netEarnings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ${netEarnings.toFixed(0)}
          </span>
        </div>
      </div>

      {/* 4. Action: Sell to Cash or Switch Lane */}
      <div className="h-[118px] p-3 rounded-xl border bg-neutral-900/60 border-neutral-800 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-300 flex items-center gap-1">
            <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
            Portfolio Execution
          </span>
          <span className="text-[10px] font-mono tabular-nums text-neutral-400">
            Dmg: <span className={totalCollisionLosses > 0 ? 'text-rose-400' : 'text-neutral-500'}>-${totalCollisionLosses.toFixed(0)}</span>
          </span>
        </div>

        {isCashPosition ? (
          <div className="space-y-1">
            <p className="text-[10px] text-emerald-400 leading-tight">
              In 100% Cash. Click any stock lane below to enter a position.
            </p>
            <button
              onClick={onCashInSwitch}
              className="w-full py-1 px-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded transition-colors"
            >
              Enter Fastest Lane
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={onExitToCash}
              className="py-1 px-2 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 font-semibold text-[11px] rounded transition-colors flex items-center justify-center gap-1 active:scale-95"
              title="Sell 100% of stock to Cash without buying a new one"
            >
              <DollarSign className="w-3 h-3" />
              Sell to Cash
            </button>

            <button
              onClick={onCashInSwitch}
              className="py-1 px-2 bg-neutral-100 hover:bg-white text-neutral-950 font-bold text-[11px] rounded transition-colors flex items-center justify-center gap-1 active:scale-95"
              title="Bank earnings and rotate into adjacent open lane"
            >
              <ArrowRightLeft className="w-3 h-3" />
              Switch Lane
            </button>
          </div>
        )}

        <div className="text-[10px] text-neutral-500 truncate">
          {isCashPosition ? 'Zero market exposure · Safe on shoulder' : 'Hold [S] to brake freely · Signal before merge'}
        </div>
      </div>
    </div>
  );
};
