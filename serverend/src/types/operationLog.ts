export type OperationLogActorType = 'admin' | 'bot';

export type OperationLogCategory =
  | 'settings'
  | 'message'
  | 'member_join'
  | 'admin_user';

export type OperationLogSource = 'manual' | 'automatic';

/** Who performed the operation (passed from routes or Discord handlers). */
export type ActorContext = {
  userId: string;
  actorType: OperationLogActorType;
  source: OperationLogSource;
};

export type OperationLog = {
  logId: string;
  occurredAt: string;

  actorUserId: string;
  actorType: OperationLogActorType;

  action: string;
  category: OperationLogCategory;

  targetType: string | null;
  targetId: string | null;

  source: OperationLogSource;
  success: boolean;
  errorMessage: string | null;

  summary: string;
  metadata: Record<string, unknown> | null;
};

export type CreateOperationLogInput = Omit<OperationLog, 'logId' | 'occurredAt'>;

export type OperationLogList = OperationLog[];
