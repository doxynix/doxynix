"use client";

import { useEffect } from "react";

export function ConsoleEasterEgg() {
  useEffect(() => {
    const titleStyle = [
      "color: #fff",
      "background: #09090b",
      "font-size: 14px",
      "font-weight: bold",
      "padding: 5px 10px",
      "border-radius: 6px",
      "border: 1px solid #27272a",
    ].join(";");

    const textStyle = [
      "color: #a1a1aa",
      "font-size: 12px",
      "line-height: 1.5",
      "padding-top: 5px",
    ].join(";");

    console.info("%c👋 Welcome to Doxynix, colleague!", titleStyle);

    console.info(
      "%c We see you like to look under the hood. \nDoxynix was created by developers for developers.\n\nLike the project? Have any ideas? \nWrite to us! support@doxynix.space",
      textStyle
    );

    // console.log(`%c (ASCII ART HERE) `, "color: #3b82f6");
  }, []);

  return null;
}
