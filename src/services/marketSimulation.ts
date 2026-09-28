import { StockLane, LaneExitRecord, MarketScenario, MarketEvent } from '../types/market';

export const INITIAL_STOCKS: Omit<StockLane, 'currentPrice' | 'openPrice' | 'previousPrice' | 'priceChange' | 'pctChange' | 'congestion' | 'speedMph' | 'priceHistory' | 'recentDrop' | 'dropSeverity' | 'laneIndex' | 'vehicleCount'>[] = [
  {
    id: 'nvda',
    symbol: 'NVDA',
    name: 'NVIDIA Corp',
    sector: 'AI & Semiconductors',
    color: '#10B981', // Emerald
    volatility: 2.3,
    impliedVol: 54,
    trend: 'bullish',
  },
  {
    id: 'tsla',
    symbol: 'TSLA',
    name: 'Tesla Inc',
    sector: 'EV & Robotics',
    color: '#EAB308', // Amber
    volatility: 2.8,
    impliedVol: 68,
    trend: 'neutral',
  },
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin ETF',
    sector: 'Crypto Assets',
    color: '#8B5CF6', // Violet
    volatility: 3.2,
    impliedVol: 82,
    trend: 'bullish',
  },
  {
    id: 'aapl',
    symbol: 'AAPL',
    name: 'Apple Inc',
    sector: 'Consumer Hardware',
    color: '#06B6D4', // Cyan
    volatility: 1.1,
    impliedVol: 24,
    trend: 'bullish',
  },
  {
    id: 'spy',
    symbol: 'SPY',
    name: 'S&P 500 ETF',
    sector: 'Broad Market Index',
    color: '#3B82F6', // Blue
    volatility: 0.8,
    impliedVol: 16,
    trend: 'neutral',
  },
];

const STARTING_PRICES: Record<string, number> = {
  nvda: 128.5,
  tsla: 242.0,
  btc: 64200.0,
  aapl: 226.4,
  spy: 564.2,
};

export function createInitialLanes(): StockLane[] {
  return INITIAL_STOCKS.map((stock, idx) => {
    const base = STARTING_PRICES[stock.id] || 100;
    const history = Array.from({ length: 30 }, () => base);
    return {
      ...stock,
      currentPrice: base,
      openPrice: base,
      previousPrice: base,
      priceChange: 0,
      pctChange: 0,
      congestion: 0.15,
      speedMph: calculateSpeed(stock.volatility, 0.15, 0),
      priceHistory: history,
      recentDrop: false,
      dropSeverity: 0,
      laneIndex: idx,
      vehicleCount: 6 + Math.floor(Math.random() * 4),
    };
  });
}

/**
 * Speed strictly corresponds to volatility:
 * - High volatility base speed: 85 - 180 mph
 * - Low volatility base speed: 50 - 75 mph
 * - Traffic congestion heavily drags speed down (if congestion is 0.9, speed drops to 5-15 mph!)
 * - Negative price drops trigger braking penalties
 */
export function calculateSpeed(volatility: number, congestion: number, pctChange: number): number {
  // Speed base derived from volatility (higher volatility = extreme bursts of speed)
  const baseVelocity = 40 + volatility * 38; // Vol 0.8 -> 70.4mph; Vol 3.2 -> 161.6mph
  
  // Congestion factor: at 0 congestion, full speed; at 1.0 congestion, crawl at ~8% speed
  const flowFactor = Math.max(0.08, 1 - Math.pow(congestion, 1.4) * 0.92);

  // If price is currently dropping, brake penalty applied
  const dropPenalty = pctChange < 0 ? Math.max(0.4, 1 + pctChange * 0.08) : 1.0;

  return Math.max(8, Math.round(baseVelocity * flowFactor * dropPenalty));
}

/**
 * Step the market simulation by one tick (e.g. 200ms - 400ms)
 */
export function stepMarketSimulation(
  lanes: StockLane[],
  scenario: MarketScenario,
  abandonedStockIds: Set<string>,
  onEvent?: (event: MarketEvent) => void
): { updatedLanes: StockLane[]; triggeredClears: string[] } {
  const triggeredClears: string[] = [];

  const updatedLanes = lanes.map((lane) => {
    let { currentPrice, congestion, volatility, impliedVol, pctChange, dropSeverity, lastClearTimestamp } = lane;
    const openPrice = lane.openPrice;

    // Base drift & shock probabilities based on scenario
    let driftBias = 0.0002;
    let shockMultiplier = 1.0;

    if (scenario === 'bull_rush') {
      driftBias = 0.0012;
      shockMultiplier = 0.8;
    } else if (scenario === 'flash_crash') {
      driftBias = -0.0018;
      shockMultiplier = 2.2;
    } else if (scenario === 'earnings_chaos') {
      shockMultiplier = 2.5;
    } else if (scenario === 'fed_meeting') {
      driftBias = (Math.random() - 0.5) * 0.003;
      shockMultiplier = 1.8;
    }

    // Is this lane recently abandoned by the player while congested?
    // THE METAPHOR: "A lane may clear up after you leave so you lose out on earnings"
    const wasAbandoned = abandonedStockIds.has(lane.id);
    const timeSinceLastClear = Date.now() - (lastClearTimestamp || 0);

    // If abandoned and congested, there is a high probability of a "Short Squeeze / Traffic Jam Evaporation"!
    if (wasAbandoned && congestion > 0.45 && Math.random() < 0.22 && timeSinceLastClear > 8000) {
      // CLEAR UP! Jam evaporates, price jumps violently!
      congestion = 0.05;
      const surgePct = 0.025 + Math.random() * 0.045; // +2.5% to +7% rally
      currentPrice = currentPrice * (1 + surgePct);
      lastClearTimestamp = Date.now();
      triggeredClears.push(lane.id);

      if (onEvent) {
        onEvent({
          id: `clear-${Date.now()}-${lane.id}`,
          title: `LANE CLEARED: ${lane.symbol} Rocketed!`,
          description: `Gridlock bottleneck vanished right after you left! Price surged +${(surgePct * 100).toFixed(1)}%!`,
          affectedStockId: lane.id,
          type: 'squeeze',
          timestamp: Date.now(),
        });
      }
    } else {
      // Normal price action driven by Geometric Brownian Motion + Volatility
      const dt = 0.05;
      const z = (Math.random() + Math.random() + Math.random() - 1.5) * 1.63; // normal approx
      const volScaled = (volatility * 0.012) * shockMultiplier;
      const priceDelta = currentPrice * (driftBias * dt + volScaled * Math.sqrt(dt) * z);

      // Random bottleneck surge or clearing wave
      const isRandomJamTrigger = Math.random() < 0.07;
      const isRandomClearTrigger = Math.random() < 0.09;

      if (isRandomJamTrigger) {
        congestion = Math.min(0.95, congestion + 0.25 + Math.random() * 0.3);
      } else if (isRandomClearTrigger) {
        congestion = Math.max(0.08, congestion - 0.3 - Math.random() * 0.2);
      } else {
        // Natural regression towards mean congestion
        congestion = congestion * 0.94 + 0.15 * 0.06;
      }

      currentPrice = Math.max(currentPrice * 0.5, currentPrice + priceDelta);
    }

    const priceChange = currentPrice - openPrice;
    pctChange = (priceChange / openPrice) * 100;

    // Red lane highlight: Dropping market price
    // If price drops below open or had a sharp intraday drop, lane turns red
    const isDropping = pctChange < -0.1 || (currentPrice < lane.previousPrice && pctChange < 0);
    if (isDropping) {
      // Congestion automatically rises with panic selling
      congestion = Math.min(0.96, congestion + 0.06);
      dropSeverity = Math.min(1.0, Math.abs(pctChange) / 3.0);
    } else {
      dropSeverity = Math.max(0, dropSeverity - 0.05);
    }

    // Dynamic speed strictly tied to volatility & congestion
    const speedMph = calculateSpeed(volatility, congestion, pctChange);

    // Update historical price array (fixed length 30)
    const newHistory = [...lane.priceHistory.slice(1), currentPrice];

    return {
      ...lane,
      previousPrice: lane.currentPrice,
      currentPrice: Number(currentPrice.toFixed(lane.id === 'btc' ? 1 : 2)),
      priceChange: Number(priceChange.toFixed(lane.id === 'btc' ? 1 : 2)),
      pctChange: Number(pctChange.toFixed(2)),
      congestion: Number(congestion.toFixed(2)),
      speedMph,
      priceHistory: newHistory,
      recentDrop: isDropping,
      dropSeverity: Number(dropSeverity.toFixed(2)),
      lastClearTimestamp,
    };
  });

  return { updatedLanes, triggeredClears };
}

/**
 * Calculate the Regret / Opportunity Cost for exited positions
 */
export function evaluateExitRegrets(
  exits: LaneExitRecord[],
  lanes: StockLane[]
): LaneExitRecord[] {
  const laneMap = new Map(lanes.map((l) => [l.id, l]));

  return exits.map((exit) => {
    const currentLane = laneMap.get(exit.stockId);
    if (!currentLane) return exit;

    const priceNow = currentLane.currentPrice;
    const pctSince = ((priceNow - exit.exitPrice) / exit.exitPrice) * 100;

    // Counterfactual calculation:
    // If user had stayed in this lane instead of exiting:
    // Base capital accrued plus/minus post-exit price movement
    const theoreticalGainIfStayed = exit.bankedEarnings * (1 + pctSince / 100);
    const regret = theoreticalGainIfStayed - exit.bankedEarnings;

    const didClearUp = exit.congestionAtExit > 0.4 && currentLane.congestion < 0.25 && pctSince > 1.2;

    return {
      ...exit,
      priceNow,
      pctChangeSinceExit: Number(pctSince.toFixed(2)),
      counterfactualEarnings: Number(theoreticalGainIfStayed.toFixed(2)),
      regretAmount: Number(regret.toFixed(2)),
      didClearUp,
    };
  });
}
