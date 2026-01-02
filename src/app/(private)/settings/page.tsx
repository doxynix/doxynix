import type { Metadata } from "next";

import { getServerAuthSession } from "@/shared/api/auth/authOptions";

export const metadata: Metadata = {
  title: "Настройки",
};

export default async function Settings() {
  const session = await getServerAuthSession();
  return (
    <div>
      Даров тут настройки, {session?.user.name}, {session?.user.email}
    </div>
  );
}
