import type { AdminUser } from "@/entities/user/model/user.types";

export function nextRole(role: AdminUser["role"]): AdminUser["role"] {
  return role === "ADMIN" ? "USER" : "ADMIN";
}
