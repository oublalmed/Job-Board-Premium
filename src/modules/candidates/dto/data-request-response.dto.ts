import { DataRequest } from '../entities/data-request.entity.js';

// EF-ADM-03 — the wire shape of a data request. Deliberately excludes the
// joined `user` relation so no unrelated PII leaks into the queue payload.
export interface DataRequestResponse {
  id: string;
  userId: string;
  type: DataRequest['type'];
  status: DataRequest['status'];
  message: string | null;
  resolutionNote: string | null;
  handledByUserId: string | null;
  dueAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toDataRequestResponse(r: DataRequest): DataRequestResponse {
  return {
    id: r.id,
    userId: r.userId,
    type: r.type,
    status: r.status,
    message: r.message,
    resolutionNote: r.resolutionNote,
    handledByUserId: r.handledByUserId,
    dueAt: r.dueAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
