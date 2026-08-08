import { useEffect, useState } from "react";

export function useTypewriter(targetText: string, speed = 30): string {
  const [displayedText, setDisplayedText] = useState("");
  const [prevTarget, setPrevTarget] = useState(targetText);

  if (targetText !== prevTarget) {
    setPrevTarget(targetText);
    setDisplayedText("");
  }

  useEffect(() => {
    if (!targetText.trim()) return;

    const interval = setInterval(() => {
      setDisplayedText((prev) => {
        if (prev.length >= targetText.length) {
          clearInterval(interval);
          return prev;
        }

        let nextIndex = prev.length;

        do {
          const char = targetText[nextIndex];
          if (char === "<") {
            const tagEnd = targetText.indexOf(">", nextIndex);
            if (tagEnd !== -1) {
              nextIndex = tagEnd + 1;
            } else {
              nextIndex++;
            }
          } else if (char === "&") {
            const entityEnd = targetText.indexOf(";", nextIndex);
            if (entityEnd !== -1 && entityEnd - nextIndex < 10) {
              nextIndex = entityEnd + 1;
            } else {
              nextIndex++;
            }
          } else {
            nextIndex++;
            break;
          }
        } while (nextIndex < targetText.length);

        return targetText.slice(0, nextIndex);
      });
    }, speed);

    return () => clearInterval(interval);
  }, [targetText, speed]);

  return displayedText;
}
