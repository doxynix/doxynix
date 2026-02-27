import type { User } from "next-auth";

import { cn, getInitials } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/core/avatar";

type Props = {
  avatarClassName?: string;
  avatarFallbackClassName?: string;
  avatarUrl?: string | null;
  user: User | null;
};

export function ProfileAvatar({
  avatarClassName,
  avatarFallbackClassName,
  avatarUrl,
  user,
}: Readonly<Props>) {
  return (
    <Avatar className={cn("select-none", avatarClassName)}>
      <AvatarImage
        alt={user?.name ?? "User"}
        src={avatarUrl ?? undefined}
        className="object-cover"
      />
      <AvatarFallback className={avatarFallbackClassName}>
        {getInitials(user?.name, user?.email)}
      </AvatarFallback>
    </Avatar>
  );
}
