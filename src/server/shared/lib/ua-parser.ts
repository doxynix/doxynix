import { UAParser } from "ua-parser-js";

export const formatUserAgent = (uaString: null | string): string => {
  if (uaString == null || uaString === "internal") return "System";

  const parser = new UAParser(uaString);
  const { browser, cpu, device, os } = parser.getResult();

  const browserPart =
    browser.name != null ? `${browser.name} ${browser.major ?? ""}`.trim() : "Unknown Browser";

  const osPart = os.name != null ? `${os.name} ${os.version ?? ""}`.trim() : "Unknown OS";

  const deviceInfo = [];
  if (device.vendor != null) deviceInfo.push(device.vendor);
  if (device.model != null) deviceInfo.push(device.model);
  if (cpu.architecture != null) deviceInfo.push(cpu.architecture);

  const hardware = deviceInfo.length > 0 ? ` [${deviceInfo.join(" ")}]` : "";

  return `${browserPart} on ${osPart}${hardware}`;
};
