export type AppErrorCode =
  | "invalid-backup"
  | "unsupported-backup-version"
  | "decrypt-failed"
  | "storage-unavailable";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
