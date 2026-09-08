import { brand } from "@/ui/colors";

export function formatHealthStatus(status: string): string {
  return status === "ok" ? brand.success("● Online (OK)") : brand.warning(status);
}
