import { Injectable } from '@angular/core';

export interface TableExportedEvent {
  entitySlug: string;
  rowCount: number;
  filteredBy: string;
}

@Injectable({ providedIn: 'root' })
export class TableExportAnalytics {
  tableExported(event: TableExportedEvent): void {
    // No-op default. Override by providing a subclass at bootstrap
    // when a real analytics pipeline is available.
    void event;
  }
}
