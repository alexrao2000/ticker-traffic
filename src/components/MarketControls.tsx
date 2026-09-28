import React from 'react';
import { MarketScenario } from '../types/market';
import { Play, Pause, Flame, CloudLightning, ShieldAlert, Sparkles, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { sound } from '../services/audio';

interface MarketControlsProps {
  scenario: MarketScenario;
  onSelectScenario: (scenario: MarketScenario) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onTriggerEvent: (type: 'crash' | 'squeeze') => void;
  onResetSimulation: () => void;
}

export const MarketControls: React.FC<MarketControlsProps> = ({
  scenario,
  onSelectScenario,
  isPaused,
  onTogglePause,
  isMuted,
  onToggleMute,
  onTriggerEvent,
  onResetSimulation,
}) => {
  const scenarios: Array<{ id: MarketScenario; label: string; desc: string }> = [
    { id: 'standard', label: 'Balanced Flow', desc: 'Natural market stochastic drift & volatility' },
    { id: 'bull_rush', label: 'Bull Rush Hour', desc: 'Rallying prices, high forward velocity' },
    { id: 'flash_crash', label: 'Flash Crash', desc: 'Red lanes, severe gridlock & panic stops' },
    { id: 'earnings_chaos', label: 'Earnings Chaos', desc: 'Wild volatility spikes & sudden squeezes' },
  ];

  return (
    <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
      {/* Scenario Filter Controls */}
      <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
        <span className="text-xs font-semibold text-neutral-400 mr-2">Market Climate:</span>
        {scenarios.map((sc) => {
          const isActive = scenario === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => onSelectScenario(sc.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-neutral-100 text-neutral-900 shadow-sm font-semibold'
                  : 'bg-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
              }`}
            >
              {sc.label}
            </button>
          );
        })}
      </div>

      {/* Manual Stress Testing Buttons */}
      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
        <button
          onClick={() => {
            sound.playBrakeScreech();
            onTriggerEvent('crash');
          }}
          className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-colors active:scale-95"
          title="Force an instant price dump and traffic jam in active lane"
        >
          <CloudLightning className="w-3.5 h-3.5 text-rose-400" />
          Dump Lane
        </button>

        <button
          onClick={() => {
            sound.playLaneClearedSqueeze();
            onTriggerEvent('squeeze');
          }}
          className="px-2.5 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-colors active:scale-95"
          title="Force a sudden bottleneck clearance and price squeeze"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Clear & Squeeze
        </button>

        <div className="h-4 w-px bg-neutral-800 mx-1" />

        <button
          onClick={onTogglePause}
          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors"
          title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
        >
          {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4" />}
        </button>

        <button
          onClick={onToggleMute}
          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-neutral-500" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
        </button>

        <button
          onClick={onResetSimulation}
          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors"
          title="Reset Highway Run"
        >
          <RefreshCw className="w-4 h-4 text-neutral-400 hover:rotate-180 transition-transform duration-500" />
        </button>
      </div>
    </div>
  );
};
