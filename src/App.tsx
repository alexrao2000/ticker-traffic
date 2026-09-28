/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StockLane,
  LaneExitRecord,
  MarketScenario,
  CollisionEvent,
  BrokerageConfig,
  BrokerOrder,
} from './types/market';
import { createInitialLanes, stepMarketSimulation, evaluateExitRegrets } from './services/marketSimulation';
import { sound } from './services/audio';
import { TopBar } from './components/TopBar';
import { HighwayCanvas } from './components/HighwayCanvas';
import { CockpitTelemetry } from './components/CockpitTelemetry';
import { LaneSelectorPanel } from './components/LaneSelectorPanel';
import { RegretLedger } from './components/RegretLedger';
import { BrokerageTerminal } from './components/BrokerageTerminal';
import { MarketControls } from './components/MarketControls';
import { RulesModal } from './components/RulesModal';
import { Sparkles, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [lanes, setLanes] = useState<StockLane[]>(createInitialLanes);
  const [currentLaneIndex, setCurrentLaneIndex] = useState<number>(0);
  const [distanceAccrued, setDistanceAccrued] = useState<number>(0);
  const [unrealizedEarnings, setUnrealizedEarnings] = useState<number>(0);
  const [realizedBank, setRealizedBank] = useState<number>(0);
  const [totalSwitches, setTotalSwitches] = useState<number>(0);
  const [exitRecords, setExitRecords] = useState<LaneExitRecord[]>([]);
  const [scenario, setScenario] = useState<MarketScenario>('standard');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'highway' | 'brokerage' | 'ledger'>('highway');

  // Collision & Health Mechanics
  const [carHealth, setCarHealth] = useState<number>(100);
  const [totalCollisionLosses, setTotalCollisionLosses] = useState<number>(0);
  const [collisionLogs, setCollisionLogs] = useState<CollisionEvent[]>([]);

  // Brokerage Integration State
  const [brokerConfig, setBrokerConfig] = useState<BrokerageConfig>({
    provider: 'alpaca',
    isConnected: false,
    isPaperTrading: true,
    apiKey: 'PK_ALPACA_DEV_398102',
    secretKey: '••••••••••••••••••••••••',
    endpointUrl: 'https://paper-api.alpaca.markets',
    accountEquity: 100000,
    buyingPower: 200000,
    autoExecuteOrders: true,
    orderSizeUsd: 1500,
  });
  const [brokerOrders, setBrokerOrders] = useState<BrokerOrder[]>([]);

  // Floating Alert Notification (Positioned fixed to prevent layout shift)
  const [activeToast, setActiveToast] = useState<{
    id: string;
    title: string;
    desc: string;
    type: 'squeeze' | 'crash' | 'collision' | 'order';
  } | null>(null);

  const abandonedStocks = useRef<Set<string>>(new Set());

  // Ref sync
  const lanesRef = useRef(lanes);
  lanesRef.current = lanes;
  const currentLaneIndexRef = useRef(currentLaneIndex);
  currentLaneIndexRef.current = currentLaneIndex;
  const unrealizedRef = useRef(unrealizedEarnings);
  unrealizedRef.current = unrealizedEarnings;
  const distanceRef = useRef(distanceAccrued);
  distanceRef.current = distanceAccrued;
  const brokerConfigRef = useRef(brokerConfig);
  brokerConfigRef.current = brokerConfig;

  // Collision handler
  const handleCollision = useCallback((event: CollisionEvent) => {
    const loss = event.penaltyAmount;
    setTotalCollisionLosses((prev) => prev + loss);

    // Deduct loss from accrued and banked capital
    setUnrealizedEarnings((prev) => Math.max(0, prev - loss * 0.7));
    setRealizedBank((prev) => Math.max(0, prev - loss * 0.3));

    // Reduce vehicle integrity
    setCarHealth((prev) => Math.max(10, prev - 15));

    setCollisionLogs((prev) => [event, ...prev.slice(0, 15)]);

    setActiveToast({
      id: event.id,
      title: 'COLLISION PENALTY',
      desc: `Rear-ended vehicle in ${event.laneSymbol}! -$${loss} deducted from portfolio.`,
      type: 'collision',
    });
    setTimeout(() => setActiveToast(null), 3500);
  }, []);

  // Exit to 100% Cash Reserve (Right Shoulder - lane 5) without buying a new stock
  const handleExitToCash = useCallback(() => {
    if (currentLaneIndexRef.current === 5) return;
    const previousLane = currentLaneIndexRef.current < 5 ? lanesRef.current[currentLaneIndexRef.current] : null;
    const currentUnrealized = Math.max(0, unrealizedRef.current);

    // 1. Bank earnings
    if (previousLane) {
      setRealizedBank((prev) => prev + currentUnrealized);
      sound.playCashIn();
    }

    // 2. Automated broker sell order (NO buy order - 100% cash reserve)
    if (previousLane && brokerConfigRef.current.autoExecuteOrders) {
      const sellShares = Math.max(1, Math.floor(brokerConfigRef.current.orderSizeUsd / previousLane.currentPrice));
      const sellOrder: BrokerOrder = {
        id: `ord-sell-${Date.now()}`,
        timestamp: Date.now(),
        symbol: previousLane.symbol,
        action: 'SELL',
        shares: sellShares,
        price: previousLane.currentPrice,
        status: 'filled',
        orderType: 'MARKET',
        totalValue: sellShares * previousLane.currentPrice,
        pnl: currentUnrealized,
      };
      setBrokerOrders((prev) => [sellOrder, ...prev]);
      sound.playOrderExecuted();

      setActiveToast({
        id: `trade-${Date.now()}`,
        title: 'EXITED TO CASH',
        desc: `Sold ${sellShares} ${previousLane.symbol} (+$${currentUnrealized.toFixed(0)}) — Parked on shoulder in 100% Cash Reserve`,
        type: 'order',
      });
      setTimeout(() => setActiveToast(null), 3000);
    }

    // 3. Track exit record for regret calculation
    if (previousLane) {
      const newRecord: LaneExitRecord = {
        id: `exit-${Date.now()}`,
        stockId: previousLane.id,
        stockSymbol: previousLane.symbol,
        exitPrice: previousLane.currentPrice,
        exitDistance: distanceRef.current,
        bankedEarnings: currentUnrealized,
        timestamp: Date.now(),
        congestionAtExit: previousLane.congestion,
        speedAtExit: previousLane.speedMph,
        priceNow: previousLane.currentPrice,
        pctChangeSinceExit: 0,
        counterfactualEarnings: currentUnrealized,
        regretAmount: 0,
        didClearUp: false,
      };
      setExitRecords((prev) => [newRecord, ...prev]);
      abandonedStocks.current.add(previousLane.id);
      setTimeout(() => {
        abandonedStocks.current.delete(previousLane.id);
      }, 45000);
    }

    // 4. Switch lane to 5
    setCurrentLaneIndex(5);
    setDistanceAccrued(0);
    setUnrealizedEarnings(0);
    setTotalSwitches((prev) => prev + 1);
  }, []);

  // Lane switch & cash-in logic with automated broker execution
  const handleSelectLane = useCallback((targetIndex: number) => {
    if (targetIndex === 5) {
      handleExitToCash();
      return;
    }
    if (targetIndex === currentLaneIndexRef.current || targetIndex < 0 || targetIndex > 4) return;

    const previousLane = currentLaneIndexRef.current < 5 ? lanesRef.current[currentLaneIndexRef.current] : null;
    const newLane = lanesRef.current[targetIndex];
    const currentUnrealized = Math.max(0, unrealizedRef.current);

    // 1. Bank earnings if leaving an existing stock
    if (previousLane) {
      setRealizedBank((prev) => prev + currentUnrealized);
      sound.playCashIn();
    }

    // 2. Automated broker orders
    if (brokerConfigRef.current.autoExecuteOrders) {
      const ordersToLog: BrokerOrder[] = [];

      if (previousLane) {
        const sellShares = Math.max(1, Math.floor(brokerConfigRef.current.orderSizeUsd / previousLane.currentPrice));
        ordersToLog.push({
          id: `ord-sell-${Date.now()}`,
          timestamp: Date.now(),
          symbol: previousLane.symbol,
          action: 'SELL',
          shares: sellShares,
          price: previousLane.currentPrice,
          status: 'filled',
          orderType: 'MARKET',
          totalValue: sellShares * previousLane.currentPrice,
          pnl: currentUnrealized,
        });
      }

      if (newLane) {
        const buyShares = Math.max(1, Math.floor(brokerConfigRef.current.orderSizeUsd / newLane.currentPrice));
        ordersToLog.push({
          id: `ord-buy-${Date.now() + 50}`,
          timestamp: Date.now() + 50,
          symbol: newLane.symbol,
          action: 'BUY',
          shares: buyShares,
          price: newLane.currentPrice,
          status: 'filled',
          orderType: 'MARKET',
          totalValue: buyShares * newLane.currentPrice,
        });
      }

      if (ordersToLog.length > 0) {
        setBrokerOrders((prev) => [...ordersToLog, ...prev]);
        sound.playOrderExecuted();

        if (previousLane) {
          setActiveToast({
            id: `trade-${Date.now()}`,
            title: 'ORDER EXECUTED',
            desc: `Sold ${previousLane.symbol} (+$${currentUnrealized.toFixed(0)}) & Bought ${newLane.symbol}`,
            type: 'order',
          });
        } else {
          setActiveToast({
            id: `trade-${Date.now()}`,
            title: 'ENTERED POSITION',
            desc: `Merged into traffic: Bought ${newLane.symbol}`,
            type: 'order',
          });
        }
        setTimeout(() => setActiveToast(null), 3000);
      }
    }

    // 3. Track exit record for regret calculation (if leaving a stock)
    if (previousLane) {
      const newRecord: LaneExitRecord = {
        id: `exit-${Date.now()}`,
        stockId: previousLane.id,
        stockSymbol: previousLane.symbol,
        exitPrice: previousLane.currentPrice,
        exitDistance: distanceRef.current,
        bankedEarnings: currentUnrealized,
        timestamp: Date.now(),
        congestionAtExit: previousLane.congestion,
        speedAtExit: previousLane.speedMph,
        priceNow: previousLane.currentPrice,
        pctChangeSinceExit: 0,
        counterfactualEarnings: currentUnrealized,
        regretAmount: 0,
        didClearUp: false,
      };

      setExitRecords((prev) => [newRecord, ...prev]);

      // Abandoned stock tracker
      abandonedStocks.current.add(previousLane.id);
      setTimeout(() => {
        abandonedStocks.current.delete(previousLane.id);
      }, 45000);
    }

    // 4. Switch lane
    setCurrentLaneIndex(targetIndex);
    setDistanceAccrued(0);
    setUnrealizedEarnings(0);
    setTotalSwitches((prev) => prev + 1);

    // Minor integrity recovery on clean lane switch
    setCarHealth((prev) => Math.min(100, prev + 5));
  }, [handleExitToCash]);

  const handleCashInSwitch = useCallback(() => {
    let bestIndex = 0;
    let maxSpeed = -1;
    lanesRef.current.forEach((l, idx) => {
      if (idx !== currentLaneIndexRef.current && l.speedMph > maxSpeed) {
        maxSpeed = l.speedMph;
        bestIndex = idx;
      }
    });
    handleSelectLane(bestIndex);
  }, [handleSelectLane]);

  // Global keyboard shortcuts (Space for Quick Switch, 1-5 direct lane).
  // Note: Arrow keys / steering are exclusively handled by HighwayCanvas to prevent teleporting or racing.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // STRICT: Ignore OS key repeat events to prevent duplicate executions
      if (e.repeat) return;

      if (e.key >= '1' && e.key <= '5') {
        const target = parseInt(e.key, 10) - 1;
        handleSelectLane(target);
      } else if (e.key === ' ') {
        e.preventDefault();
        handleCashInSwitch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectLane, handleCashInSwitch]);

  // Main simulation tick loop
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const { updatedLanes, triggeredClears } = stepMarketSimulation(
        lanesRef.current,
        scenario,
        abandonedStocks.current,
        (event) => {
          setActiveToast({
            id: event.id,
            title: event.title,
            desc: event.description,
            type: event.type === 'crash' ? 'crash' : 'squeeze',
          });
          setTimeout(() => setActiveToast(null), 3500);
        }
      );

      if (triggeredClears.length > 0) {
        const clearedStock = updatedLanes.find((l) => l.id === triggeredClears[0]);
        if (clearedStock) {
          sound.playLaneClearedSqueeze();
        }
      }

      setLanes(updatedLanes);

      // Distance advancement
      const activeLane = updatedLanes[currentLaneIndexRef.current];
      if (activeLane) {
        const dtHours = 0.3 / 3600;
        const milesDelta = activeLane.speedMph * dtHours * 22;

        setDistanceAccrued((prev) => {
          const newDist = prev + milesDelta;
          const baseRate = 12 + activeLane.volatility * 10;
          const priceImpact = 1 + activeLane.pctChange / 100;
          setUnrealizedEarnings(Math.max(-50, newDist * baseRate * priceImpact));
          return newDist;
        });
      }

      setExitRecords((prev) => evaluateExitRegrets(prev, updatedLanes));
    }, 300);

    return () => clearInterval(interval);
  }, [isPaused, scenario]);

  // Manual Broker Order
  const handlePlaceManualOrder = (symbol: string, action: 'BUY' | 'SELL', shares: number) => {
    const lane = lanes.find((l) => l.symbol === symbol) || lanes[0];
    const order: BrokerOrder = {
      id: `man-${Date.now()}`,
      timestamp: Date.now(),
      symbol,
      action,
      shares,
      price: lane.currentPrice,
      status: 'filled',
      orderType: 'MARKET',
      totalValue: shares * lane.currentPrice,
    };
    setBrokerOrders((prev) => [order, ...prev]);
    sound.playOrderExecuted();

    setActiveToast({
      id: `manual-ord-${Date.now()}`,
      title: `${action} ORDER FILLED`,
      desc: `Filled ${shares} shares of ${symbol} @ $${lane.currentPrice.toFixed(2)}`,
      type: 'order',
    });
    setTimeout(() => setActiveToast(null), 3000);
  };

  const handleTriggerEvent = (type: 'crash' | 'squeeze') => {
    const targetIdx = currentLaneIndexRef.current;
    setLanes((prev) =>
      prev.map((lane, idx) => {
        if (idx !== targetIdx) return lane;
        if (type === 'crash') {
          return {
            ...lane,
            currentPrice: lane.currentPrice * 0.94,
            pctChange: lane.pctChange - 6,
            congestion: 0.92,
            recentDrop: true,
            dropSeverity: 0.9,
            speedMph: 14,
          };
        } else {
          return {
            ...lane,
            currentPrice: lane.currentPrice * 1.06,
            pctChange: lane.pctChange + 6,
            congestion: 0.08,
            recentDrop: false,
            dropSeverity: 0,
            speedMph: 165,
          };
        }
      })
    );
  };

  const handleResetSimulation = () => {
    setLanes(createInitialLanes());
    setDistanceAccrued(0);
    setUnrealizedEarnings(0);
    setRealizedBank(0);
    setTotalSwitches(0);
    setTotalCollisionLosses(0);
    setCarHealth(100);
    setExitRecords([]);
    setBrokerOrders([]);
    abandonedStocks.current.clear();
  };

  const activeLane = currentLaneIndex === 5 ? null : (lanes[currentLaneIndex] || lanes[0]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      <TopBar
        activeView={activeView}
        onChangeView={setActiveView}
        isMuted={isMuted}
        onToggleMute={() => {
          const next = !isMuted;
          setIsMuted(next);
          sound.setMuted(next);
        }}
        onOpenRules={() => setIsRulesOpen(true)}
        realizedBank={realizedBank}
        totalCollisionLosses={totalCollisionLosses}
        isBrokerConnected={brokerConfig.isConnected}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* View: Expressway Visualizer */}
        {activeView === 'highway' && (
          <div className="space-y-4">
            <HighwayCanvas
              lanes={lanes}
              currentLaneIndex={currentLaneIndex}
              onSelectLane={handleSelectLane}
              onExitToCash={handleExitToCash}
              isPaused={isPaused}
              distanceAccrued={distanceAccrued}
              unrealizedEarnings={unrealizedEarnings}
              onCollision={handleCollision}
              carHealth={carHealth}
            />

            <CockpitTelemetry
              activeLane={activeLane}
              distanceAccrued={distanceAccrued}
              unrealizedEarnings={unrealizedEarnings}
              realizedBank={realizedBank}
              totalSwitches={totalSwitches}
              totalCollisionLosses={totalCollisionLosses}
              carHealth={carHealth}
              onCashInSwitch={handleCashInSwitch}
              onExitToCash={handleExitToCash}
              isCashPosition={currentLaneIndex === 5}
            />

            <LaneSelectorPanel
              lanes={lanes}
              currentLaneIndex={currentLaneIndex}
              onSelectLane={handleSelectLane}
            />
          </div>
        )}

        {/* View: Brokerage Trading Terminal */}
        {activeView === 'brokerage' && (
          <div className="space-y-4">
            <BrokerageTerminal
              config={brokerConfig}
              onUpdateConfig={(up) => setBrokerConfig((prev) => ({ ...prev, ...up }))}
              orders={brokerOrders}
              activeLane={activeLane}
              onPlaceManualOrder={handlePlaceManualOrder}
            />

            <LaneSelectorPanel
              lanes={lanes}
              currentLaneIndex={currentLaneIndex}
              onSelectLane={handleSelectLane}
            />
          </div>
        )}

        {/* View: Regret Ledger */}
        {activeView === 'ledger' && (
          <div className="space-y-4">
            <RegretLedger
              exits={exitRecords}
              onClearHistory={() => setExitRecords([])}
            />

            {collisionLogs.length > 0 && (
              <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-neutral-300 mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  Recent Highway Collisions (Capital Penalties)
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono text-[11px] tabular-nums">
                  {collisionLogs.map((col) => (
                    <div
                      key={col.id}
                      className="p-2 rounded bg-rose-950/20 border border-rose-900/30 flex items-center justify-between"
                    >
                      <span className="text-rose-300">{col.message}</span>
                      <span className="text-neutral-500 text-[10px]">{new Date(col.time).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Market Controls */}
        <MarketControls
          scenario={scenario}
          onSelectScenario={setScenario}
          isPaused={isPaused}
          onTogglePause={() => setIsPaused(!isPaused)}
          isMuted={isMuted}
          onToggleMute={() => {
            const next = !isMuted;
            setIsMuted(next);
            sound.setMuted(next);
          }}
          onTriggerEvent={handleTriggerEvent}
          onResetSimulation={handleResetSimulation}
        />
      </main>

      <footer className="border-t border-neutral-900 bg-neutral-950 px-6 py-3.5 text-center text-xs text-neutral-500">
        <p>TickerTraffic · Speed = Volatility · Red Lanes = Drops · Avoid Traffic Collisions · Broker Integration Bridge</p>
      </footer>

      {/* FIXED POSITION TOAST: Never pushes page content or causes layout shifts */}
      {activeToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full p-3 rounded-lg border text-xs flex items-center justify-between shadow-2xl bg-neutral-900/95 backdrop-blur-md border-neutral-800 pointer-events-auto">
          <div className="flex items-center gap-2.5">
            {activeToast.type === 'collision' ? (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            ) : activeToast.type === 'order' ? (
              <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <div>
              <span className="font-bold font-mono uppercase tracking-wide mr-1.5 text-neutral-200">
                {activeToast.title}:
              </span>
              <span className="text-neutral-400">{activeToast.desc}</span>
            </div>
          </div>
          <button
            onClick={() => setActiveToast(null)}
            className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 shrink-0 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
    </div>
  );
}
