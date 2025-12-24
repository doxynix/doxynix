"use client";

import Image from "next/image";
import { signIn, signOut, useSession } from "next-auth/react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export function AuthCard() {
  const { data: session, status } = useSession();
  const avatar = session?.user?.image ?? "/avatar-placeholder.png";
  const role = session?.user?.role;

  if (status === "loading") {
    return (
      <Card className="w-100">
        <CardContent className="py-10 text-center">Загрузка...</CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-100">
      <CardHeader>
        <CardTitle className="text-center text-2xl">
          {session ? "Добро пожаловать!" : "Добро пожаловать в Doxynix!"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {session ? (
          <>
            {avatar != null && avatar !== "" && (
              <div className="border-border mx-auto h-20 w-20 overflow-hidden rounded-full border-2">
                <Image src={avatar} alt={session?.user?.name ?? "Avatar"} width={80} height={80} />
              </div>
            )}

            <div className="space-y-1 text-center">
              <p className="font-semibold">{session?.user?.name}</p>
              <p className="text-muted-foreground text-sm">{session?.user?.email}</p>
              {role != null && role !== "" && <Badge variant="secondary">{role}</Badge>}
            </div>

            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1">
                Мои репозитории
              </Button>
              <Button variant="destructive" onClick={() => signOut({ callbackUrl: "/" })}>
                Выйти
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid w-full grid-cols-1 gap-2">
              <Button onClick={() => signIn("github")}>GitHub</Button>
              <Button onClick={() => signIn("google")}>Google</Button>
              {/* <Button onClick={() => signIn("gitlab")}>GitLab</Button> */}
              <Button onClick={() => signIn("yandex")}>Yandex</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
