import React from 'react';
import { HelpCircle, Volume2, VolumeX, Terminal } from 'lucide-react';

interface TopBarProps {
  activeView: 'highway' | 'brokerage' | 'ledger';
  onChangeView: (view: 'highway' | 'brokerage' | 'ledger') => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenRules: () => void;
  realizedBank: number;
  totalCollisionLosses: number;
  isBrokerConnected: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onChangeView,
  isMuted,
  onToggleMute,
  onOpenRules,
  realizedBank,
  totalCollisionLosses,
  isBrokerConnected,
}) => {
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 bg-neutral-950 sticky top-0 z-40 select-none">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <a href="/" className="text-sm font-bold tracking-tight text-neutral-100 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          TickerTraffic
        </a>
      </div>

      {/* Nav */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-400">
        <button
          onClick={() => onChangeView('highway')}
          className={`hover:text-neutral-100 transition-colors whitespace-nowrap ${
            activeView === 'highway' ? 'text-neutral-100 font-semibold' : ''
          }`}
        >
          Expressway Visualizer
        </button>
        <button
          onClick={() => onChangeView('brokerage')}
          className={`hover:text-neutral-100 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeView === 'brokerage' ? 'text-neutral-100 font-semibold' : ''
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-sky-400" />
          Trading Bridge {isBrokerConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        </button>
        <button
          onClick={() => onChangeView('ledger')}
          className={`hover:text-neutral-100 transition-colors whitespace-nowrap ${
            activeView === 'ledger' ? 'text-neutral-100 font-semibold' : ''
          }`}
        >
          Regret Ledger
        </button>
        <button
          onClick={onOpenRules}
          className="hover:text-neutral-100 transition-colors whitespace-nowrap flex items-center gap-1 text-neutral-400"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Metaphor Guide
        </button>
      </nav>

      {/* Financial Telemetry & Action Buttons - Fixed Widths, Zero Shift */}
      <div className="flex items-center gap-2.5">
        <div className="hidden sm:flex items-center gap-3 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono tabular-nums">
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">Vault:</span>
            <span className="font-bold text-emerald-400">${realizedBank.toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-1 text-neutral-400 pl-2 border-l border-neutral-800">
            <span className="text-[10px] text-neutral-500">Losses:</span>
            <span className={`font-semibold ${totalCollisionLosses > 0 ? 'text-rose-400' : 'text-neutral-500'}`}>
              -${totalCollisionLosses.toFixed(0)}
            </span>
          </div>
        </div>

        <button
          onClick={onToggleMute}
          className="p-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-300 transition-colors"
          title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-neutral-500" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
        </button>

        <button
          onClick={() => onChangeView('brokerage')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            isBrokerConnected
              ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-neutral-100 hover:bg-white text-neutral-900 font-semibold'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          {isBrokerConnected ? 'Broker Online' : 'Connect Broker'}
        </button>
      </div>
    </header>
  );
};
