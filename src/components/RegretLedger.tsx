import React from 'react';
import { LaneExitRecord } from '../types/market';
import { AlertCircle, CheckCircle, TrendingUp, TrendingDown, History, Sparkles, ShieldAlert } from 'lucide-react';

interface RegretLedgerProps {
  exits: LaneExitRecord[];
  onClearHistory: () => void;
}

export const RegretLedger: React.FC<RegretLedgerProps> = ({ exits, onClearHistory }) => {
  const totalMissed = exits.reduce((acc, curr) => (curr.regretAmount > 0 ? acc + curr.regretAmount : acc), 0);
  const totalSaved = exits.reduce((acc, curr) => (curr.regretAmount < 0 ? acc + Math.abs(curr.regretAmount) : acc), 0);
  const clearedCount = exits.filter((e) => e.didClearUp).length;

  return (
    <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-neutral-200">The "Seller's Remorse" Regret Ledger</h3>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Tracking what happens to the lanes you abandoned when traffic was high.
          </p>
        </div>

        {exits.length > 0 && (
          <button
            onClick={onClearHistory}
            className="text-xs text-neutral-500 hover:text-neutral-300 font-mono underline transition-colors"
          >
            Clear Ledger
          </button>
        )}
      </div>

      {/* Regret vs Preserved Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800">
          <span className="text-[11px] text-neutral-400 block">Total Missed Earnings (FOMO)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold font-mono text-amber-400">
              ${totalMissed.toFixed(0)}
            </span>
            <span className="text-[10px] text-neutral-500">left on the road</span>
          </div>
          <span className="text-[10px] text-neutral-400 mt-1 block">
            {clearedCount} lane{clearedCount === 1 ? '' : 's'} cleared right after you left
          </span>
        </div>

        <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800">
          <span className="text-[11px] text-neutral-400 block">Losses Successfully Evaded</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold font-mono text-emerald-400">
              ${totalSaved.toFixed(0)}
            </span>
            <span className="text-[10px] text-neutral-500">saved</span>
          </div>
          <span className="text-[10px] text-neutral-400 mt-1 block">
            Exits that spared you from deeper crashes
          </span>
        </div>

        <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800">
          <span className="text-[11px] text-neutral-400 block">Metaphor Verdict</span>
          <div className="text-sm font-semibold text-neutral-200 mt-1 flex items-center gap-1.5">
            {totalMissed > totalSaved ? (
              <span className="text-rose-400 flex items-center gap-1">
                <ShieldAlert className="w-4 h-4" /> Impatient Lane Hopper
              </span>
            ) : totalSaved > totalMissed ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-4 h-4" /> Savvy Gridlock Evader
              </span>
            ) : (
              <span className="text-neutral-400">Neutral Driver</span>
            )}
          </div>
          <span className="text-[10px] text-neutral-400 mt-1 block">
            {totalMissed > totalSaved 
              ? 'You often bail right before the squeeze!' 
              : 'Your exits timed the bottlenecks well.'}
          </span>
        </div>
      </div>

      {/* Transaction Exits List */}
      {exits.length === 0 ? (
        <div className="text-center py-8 text-neutral-500 border border-dashed border-neutral-800 rounded-lg">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-neutral-600" />
          <p className="text-xs">No lane switches recorded yet.</p>
          <p className="text-[11px] text-neutral-400 mt-1">
            When traffic gets heavy, switch lanes to cash in your earnings and test if you regret leaving!
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
          {exits.map((exit) => {
            const isRegret = exit.regretAmount > 0;
            const isSaved = exit.regretAmount < 0;

            return (
              <div
                key={exit.id}
                className={`p-3 rounded-lg border text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${
                  exit.didClearUp
                    ? 'bg-amber-950/20 border-amber-800/50 shadow-sm'
                    : isRegret
                    ? 'bg-neutral-900/90 border-neutral-800'
                    : 'bg-emerald-950/15 border-emerald-800/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-neutral-200 text-sm">{exit.stockSymbol}</span>
                  <span className="text-neutral-400 text-[11px]">
                    Exited @ ${exit.exitPrice.toFixed(1)} · {(exit.congestionAtExit * 100).toFixed(0)}% Jam
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    (+${exit.bankedEarnings.toFixed(0)} banked)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-neutral-400 block">Price Now: ${exit.priceNow.toFixed(1)}</span>
                    <span className={`text-[11px] font-bold ${
                      exit.pctChangeSinceExit >= 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {exit.pctChangeSinceExit >= 0 ? '+' : ''}{exit.pctChangeSinceExit.toFixed(1)}% since exit
                    </span>
                  </div>

                  <div className="min-w-[140px] text-right">
                    {exit.didClearUp ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        <TrendingUp className="w-3 h-3" />
                        CLEARED! Missed ${exit.regretAmount.toFixed(0)}
                      </span>
                    ) : isRegret ? (
                      <span className="text-[11px] text-amber-300">
                        Missed +${exit.regretAmount.toFixed(0)}
                      </span>
                    ) : isSaved ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <CheckCircle className="w-3 h-3" />
                        Saved +${Math.abs(exit.regretAmount).toFixed(0)}
                      </span>
                    ) : (
                      <span className="text-neutral-400">Flat Movement</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
