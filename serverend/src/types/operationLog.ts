export type LogType = "delete" | "update" | "create";
export type OperationLog = {
    userId: string;
    timestamp: string;
    type: LogType;
    message: string;
}