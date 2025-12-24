"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";

export function AuthCard() {
  const { data: session, status } = useSession();

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
      <CardContent className="flex flex-col gap-4 items-center">
        {session ? (
          <>
            {session.user?.image && (
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border mx-auto">
                <Image
                  src={session.user.image}
                  alt={session.user.name || "Avatar"}
                  width={80}
                  height={80}
                />
              </div>
            )}

            <div className="text-center space-y-1">
              <p className="font-semibold">{session.user?.name}</p>
              <p className="text-sm text-muted-foreground">{session.user?.email}</p>
              <Badge variant="secondary">{session.user?.role}</Badge>
            </div>

            <div className="flex gap-2 w-full">
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
            <div className="grid grid-cols-1 gap-2 w-full">
              <Button onClick={() => signIn("github")}>GitHub</Button>
              <Button onClick={() => signIn("google")}>Google</Button>
              <Button onClick={() => signIn("gitlab")}>GitLab</Button>
              <Button onClick={() => signIn("yandex")}>Yandex</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
