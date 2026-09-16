const ALERT_PRAGMA_REGEX = /^[ "'‘“]*\[!(note|warning|tip|important|caution)][ "'’”]*\s*/i;

export type AlertPragma = {
  matchedLength: number;
  type: "CAUTION" | "IMPORTANT" | "NOTE" | "TIP" | "WARNING";
};

export function matchAlertPragma(text: string): null | AlertPragma {
  const match = ALERT_PRAGMA_REGEX.exec(text);
  const rawType = match?.[1];

  if (match == null || rawType == null) {
    return null;
  }

  return { matchedLength: match[0].length, type: rawType.toUpperCase() as AlertPragma["type"] };
}
