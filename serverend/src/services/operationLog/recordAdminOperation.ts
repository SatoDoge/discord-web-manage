import { addOperationLog } from '#server/stores/OperationLogStore.js';
import type { AuthenticatedServiceContext } from '#server/types/authenticatedService.js';
import type { OperationLogCategory } from '#server/types/operationLog.js';

export type RecordAdminOperationInput = {
  actorUserId: string;
  action: string;
  category: OperationLogCategory;
  summary: string;
  success: boolean;
  targetType?: string | null;
  targetId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Fire-and-forget operation log for manual admin API actions. */
export function recordAdminOperation(input: RecordAdminOperationInput): void {
  void addOperationLog({
    actorUserId: input.actorUserId,
    actorType: 'admin',
    action: input.action,
    category: input.category,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    source: 'manual',
    success: input.success,
    errorMessage: input.errorMessage ?? null,
    summary: input.summary,
    metadata: input.metadata ?? null,
  }).catch((error) => {
    console.error('[operationLog]', error);
  });
}

export function recordAuthenticatedAdminOperation(
  context: AuthenticatedServiceContext,
  input: Omit<RecordAdminOperationInput, 'actorUserId'>,
): void {
  recordAdminOperation({
    ...input,
    actorUserId: context.actorUserId,
  });
}
