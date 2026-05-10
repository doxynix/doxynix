import { useEffect, useState } from "react";

export function useTypewriter(targetText: string, speed = 30): string {
  const [displayedText, setDisplayedText] = useState("");
  const [prevTarget, setPrevTarget] = useState(targetText);

  if (targetText !== prevTarget) {
    setPrevTarget(targetText);
    setDisplayedText("");
  }

  useEffect(() => {
    if (displayedText.length >= targetText.length) {
      return;
    }

    const timeout = setTimeout(() => {
      setDisplayedText(targetText.slice(0, displayedText.length + 1));
    }, speed);

    return () => clearTimeout(timeout);
  }, [targetText, speed, displayedText.length]);

  return displayedText;
}
