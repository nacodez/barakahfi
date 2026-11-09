import { Injectable } from '@nestjs/common';
import type { ComplianceStatus } from '@barakahfi/shared';
import { Subject } from 'rxjs';

export interface ComplianceChangedAlert {
  type: 'COMPLIANCE_CHANGED';
  symbol: string;
  name: string;
  from: ComplianceStatus;
  to: ComplianceStatus;
  at: string;
}

export type AlertPayload = ComplianceChangedAlert;

export interface AlertEvent {
  userIds: string[];
  alert: AlertPayload;
}

/** In-process bus between whoever detects a change (screener) and whoever pushes it to browsers (gateway). */
@Injectable()
export class AlertsService {
  private readonly subject = new Subject<AlertEvent>();
  readonly events$ = this.subject.asObservable();

  publish(event: AlertEvent): void {
    this.subject.next(event);
  }
}
