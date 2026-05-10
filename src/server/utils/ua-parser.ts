import { isNotNil } from "es-toolkit";
import UAParser from "ua-parser-js";

export const formatUserAgent = (uaString: null | string): string => {
  if (uaString == null || uaString === "internal") return "System";

  const parser = new UAParser(uaString);
  const { browser, cpu, device, os } = parser.getResult();

  const browserPart =
    browser.name != null ? `${browser.name} ${browser.major ?? ""}`.trim() : "Unknown Browser";

  const osPart = os.name != null ? `${os.name} ${os.version ?? ""}`.trim() : "Unknown OS";

  const deviceInfo = [device.vendor, device.model, cpu.architecture].filter(isNotNil);
  const hardware = deviceInfo.length > 0 ? ` [${deviceInfo.join(" ")}]` : "";

  return `${browserPart} on ${osPart}${hardware}`;
};
