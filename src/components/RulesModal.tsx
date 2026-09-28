import React from 'react';
import { X, Gauge, AlertTriangle, ArrowRightLeft, Sparkles, ShieldAlert, Terminal, Zap } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <span className="p-2 bg-sky-500/10 rounded-lg border border-sky-500/20 text-sky-400">
            <Gauge className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-neutral-100">Stock Expressway & Trading Execution Metaphor</h2>
            <p className="text-xs text-neutral-400">How volatility, traffic bottlenecks, and financial risk converge</p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs text-neutral-300 leading-relaxed max-h-[65vh] overflow-y-auto pr-1">
          {/* Rule 1: Speed = Volatility */}
          <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800 flex items-start gap-3">
            <div className="p-1.5 rounded bg-sky-500/10 text-sky-400 shrink-0 mt-0.5">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-neutral-200 mb-0.5">1. Speed Corresponds to Stock Volatility</h4>
              <p className="text-neutral-400">
                High-beta assets (NVDA, TSLA, BTC) accelerate to 120–180 mph when clear, accumulating distance earnings rapidly. Lower volatility anchors (SPY, AAPL) run at a steadier 50–70 mph commuter pace.
              </p>
            </div>
          </div>

          {/* Rule 2: Vehicle Collisions = Capital Loss */}
          <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40 flex items-start gap-3">
            <div className="p-1.5 rounded bg-rose-500/10 text-rose-400 shrink-0 mt-0.5">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-rose-300 mb-0.5">2. Collision Damage: You Lose Money Crashing</h4>
              <p className="text-neutral-300">
                Traffic ahead isn't just scenery. If an asset suffers a price drop and slams the brakes, failure to switch lanes results in a high-speed collision! Each rear-end crash inflicts substantial financial damage (loss of 25% distance gains or minimum $75 penalty), docking vehicle integrity.
              </p>
            </div>
          </div>

          {/* Rule 3: Red Lanes = Price Drops & Jammed Bottlenecks */}
          <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800 flex items-start gap-3">
            <div className="p-1.5 rounded bg-rose-500/10 text-rose-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-neutral-200 mb-0.5">3. Red Lanes Highlight Dropping Prices</h4>
              <p className="text-neutral-400">
                Lanes with negative returns glow in dark crimson. Traffic density climbs to 80–95%, dragging lane velocity down to 8–15 mph and blocking forward progress.
              </p>
            </div>
          </div>

          {/* Rule 4: Cashing In & The Regret Dilemma */}
          <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800 flex items-start gap-3">
            <div className="p-1.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-neutral-200 mb-0.5">4. Cashing In & The "Lane Cleared" Regret</h4>
              <p className="text-neutral-400">
                Switching lanes cashes in and banks your accrued distance earnings into your vault. However, abandoning a jammed lane frequently leads to the jam evaporating into a short squeeze—tracked in the Regret Ledger.
              </p>
            </div>
          </div>

          {/* Rule 6: Driving Controls & 3D Camera Perspective */}
          <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800 flex items-start gap-3">
            <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-neutral-200 mb-0.5">6. Driving Cockpit & Perspective Controls</h4>
              <p className="text-neutral-400">
                <strong>[V]</strong> Turn Camera Perspective: toggle between <strong>3D Forward Chase</strong> (240m horizon lookahead down the expressway), <strong>3D Elevated Tactical</strong>, and <strong>Top-Down Radar</strong>.<br />
                <strong>[A] / [D]</strong> or <strong>[←] / [→]</strong>: Smooth physical steering between lanes.<br />
                <strong>[W] / [S]</strong> or <strong>[↑] / [↓]</strong>: Full throttle or human brake authority down to 0 mph.<br />
                <strong>[C]</strong>: Steer onto right paved shoulder to sit in 100% Cash Reserve.<br />
                <strong>Click any lane or gantry</strong>: Steers directly into that lane.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-100 hover:bg-white text-neutral-900 font-semibold text-xs rounded-lg transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
