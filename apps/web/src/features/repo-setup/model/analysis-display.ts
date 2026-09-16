export type AnalysisDisplayInput = {
  dbProgress: number | null | undefined;
  dbStatus: string | null;
  runStatus: string | null;
  triggerProgress: number;
};

export type AnalysisDisplayResult = {
  displayStatus: string;
  isFailed: boolean;
  isFinished: boolean;
  isPending: boolean;
  progress: number;
};

export function resolveAnalysisDisplay(input: AnalysisDisplayInput): AnalysisDisplayResult {
  const { dbProgress, dbStatus, runStatus, triggerProgress } = input;

  const progress =
    typeof dbProgress === "number" && dbProgress > triggerProgress ? dbProgress : triggerProgress;

  const isDbDone = dbStatus === "DONE";
  const isDbFailed = dbStatus === "FAILED";
  const isTriggerFinished = runStatus === "COMPLETED";
  const isTriggerFailed =
    runStatus === "FAILED" || runStatus === "CRASHED" || runStatus === "TIMED_OUT";

  const isFailed = isTriggerFailed || isDbFailed;
  const isFinished = !isFailed && (isTriggerFinished || isDbDone);
  const isPending = dbStatus === "PENDING";

  let displayStatus: string;
  if (isFailed) {
    displayStatus = "FAILED";
  } else if (isFinished) {
    displayStatus = "COMPLETED";
  } else {
    displayStatus = runStatus ?? dbStatus ?? "QUEUED";
  }

  return { displayStatus, isFailed, isFinished, isPending, progress };
}
