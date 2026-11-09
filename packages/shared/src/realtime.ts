import type { Money } from './api';
import type { ComplianceStatus } from './screening';

/** Socket.IO event names the server emits to a signed-in user. */
export const REALTIME_EVENTS = {
  prices: 'portfolio:prices',
  alerts: 'portfolio:alerts',
} as const;

export interface PriceTickDto {
  symbol: string;
  price: Money;
  previousClose: Money | null;
  currency: string;
  /** ISO time the price was fetched. */
  at: string;
}

export interface PricesEventDto {
  prices: PriceTickDto[];
}

export interface ComplianceAlertDto {
  type: 'COMPLIANCE_CHANGED';
  symbol: string;
  name: string;
  from: ComplianceStatus;
  to: ComplianceStatus;
  at: string;
}

export interface RealtimeTicketDto {
  ticket: string;
  expiresInSeconds: number;
}
