import { UAParser } from "ua-parser-js";

export const formatUserAgent = (uaString: null | string): string => {
  if (uaString == null || uaString === "internal") return "System";

  const parser = new UAParser(uaString);
  const { browser, device, os } = parser.getResult();

  const browserName = browser.name ?? "Unknown Browser";
  const osName = os.name ?? "Unknown OS";

  const deviceType = device.type === "mobile" ? ` (${device.model})` : "";

  return `${browserName} on ${osName}${deviceType}`;
};
