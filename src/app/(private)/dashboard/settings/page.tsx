"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { getInitials } from "@/shared/lib/getInititals";
import { UploadButton } from "@/shared/lib/uploadthing";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";

// потом конечно убрать "use client" и все что связано короче вниз по дереву опустить конечно но ето потом
// export const metadata: Metadata = {
//   title: "Настройки",
// };

export default function Settings() {
  const session = useSession();
  const updateAvatar = trpc.user.updateAvatar.useMutation({
    onSuccess: async () => {
      toast.success("Аватарка сохранена в базе данных!");
      await session.update();
    },
    onError: (err) => {
      toast.error(`Ошибка: ${err.message}`);
    },
  });

  const [url, setUrl] = useState(session.data?.user.image ?? "");
  const name = session.data?.user.name;
  const email = session.data?.user.email;

  return (
    <div className="">
      <div>Даров тут настройки и да ты можешь загрузить фото тут</div>

      <UploadButton
        endpoint="avatarUploader"
        onClientUploadComplete={(res) => {
          const file = res[0];
          setUrl(file.ufsUrl);

          updateAvatar.mutate({
            url: file.ufsUrl,
            key: file.key,
          });

          console.log("Загружено:", file.ufsUrl);
        }}
        onUploadError={(error: Error) => {
          if (error.message.includes("File size too large")) {
            toast.error("Файл слишком тяжелый! Лимит — 1 байт (ну ты даешь!)");
            return;
          }

          if (error.message.includes("Invalid config")) {
            toast.error("Файл слишком тяжелый! Лимит — 1 байт (ну ты даешь!)");
            return;
          }

          toast.error(`Ошибка загрузки: ${error.message}`);
        }}
      />
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={url} alt={name ?? "User"} className="object-cover" />
          <AvatarFallback className="text-xl">{getInitials(name, email)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-bold">{name}</p>
          <p className="text-muted-foreground text-sm">{email}</p>
        </div>
      </div>
    </div>
  );
}
