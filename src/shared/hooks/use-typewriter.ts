import { useEffect, useState } from "react";

export function useTypewriter(targetText: string, speed = 30) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText("");
  }, [targetText]);

  useEffect(() => {
    if (targetText.length > displayedText.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(targetText.slice(0, displayedText.length + 1));
      }, speed);

      return () => clearTimeout(timeout);
    }
  }, [targetText, displayedText, speed]);
}
