export interface StockLane {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  color: string;
  currentPrice: number;
  openPrice: number;
  previousPrice: number;
  priceChange: number;
  pctChange: number;
  volatility: number; // 0.1 to 3.5 (Beta / Vol factor)
  impliedVol: number; // e.g. 24% - 110%
  trend: 'bullish' | 'bearish' | 'neutral';
  congestion: number; // 0.0 to 1.0 (traffic jam density)
  speedMph: number; // speed derived from volatility and congestion
  priceHistory: number[];
  recentDrop: boolean;
  dropSeverity: number; // 0 to 1
  laneIndex: number;
  vehicleCount: number;
  lastClearTimestamp?: number;
}

export interface LaneExitRecord {
  id: string;
  stockId: string;
  stockSymbol: string;
  exitPrice: number;
  exitDistance: number;
  bankedEarnings: number;
  timestamp: number;
  congestionAtExit: number;
  speedAtExit: number;
  priceNow: number;
  pctChangeSinceExit: number;
  counterfactualEarnings: number;
  regretAmount: number; // positive = missed out on earnings; negative = saved money!
  didClearUp: boolean;
}

export type MarketScenario = 'standard' | 'bull_rush' | 'flash_crash' | 'earnings_chaos' | 'fed_meeting';

export interface MarketEvent {
  id: string;
  title: string;
  description: string;
  affectedStockId?: string;
  type: 'squeeze' | 'crash' | 'cleared' | 'surge' | 'fed';
  timestamp: number;
}

export interface CollisionEvent {
  id: string;
  time: number;
  carId: string;
  penaltyAmount: number;
  laneSymbol: string;
  message: string;
}

export type BrokerageProvider = 'alpaca' | 'interactive_brokers' | 'polygon' | 'webull' | 'simulator';

export interface BrokerageConfig {
  provider: BrokerageProvider;
  isConnected: boolean;
  isPaperTrading: boolean;
  apiKey: string;
  secretKey: string;
  endpointUrl: string;
  accountEquity: number;
  buyingPower: number;
  autoExecuteOrders: boolean; // whether lane switching places actual broker market orders
  orderSizeUsd: number; // nominal position size per lane
}

export interface BrokerOrder {
  id: string;
  timestamp: number;
  symbol: string;
  action: 'BUY' | 'SELL';
  shares: number;
  price: number;
  status: 'filled' | 'pending' | 'cancelled';
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS';
  totalValue: number;
  pnl?: number;
}
