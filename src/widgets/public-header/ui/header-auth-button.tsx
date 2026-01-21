import Link from "next/link";
import { MoveLeft } from "lucide-react";

import { getServerAuthSession } from "@/shared/api/auth/auth-options";
import { Button } from "@/shared/ui/core/button";

export async function HeaderAuthButton() {
  const session = await getServerAuthSession();
  const href = session ? "/dashboard" : "/auth";
  const label = session ? "Dashboard" : "Get Started";

  return (
    <Button variant="outline" asChild>
      <Link href={href}>
        {label}
        <MoveLeft size={16} className="rotate-180" />
      </Link>
    </Button>
  );
}
