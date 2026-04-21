import { trackOpsEventV2,type V2OpsEventPayload } from '../api';

export function sendV2OpsEvent(payload: V2OpsEventPayload): void {
  void trackOpsEventV2(payload).catch(() => {
    // Intentionally ignore telemetry send failures.
  });
}
