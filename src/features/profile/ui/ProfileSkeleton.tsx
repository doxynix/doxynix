import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export function ProfileSkeleton() {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Фото профиля</CardTitle>
          <div className="text-muted-foreground text-sm">
            Это изображение будет отображаться в вашей учетной записи.
          </div>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8.5 w-40" />
            <Skeleton className="h-4 w-40" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Личная информация</CardTitle>
          {/* <div className="text-muted-foreground text-sm">Обновите свое имя или почту.</div> */}
          <div className="text-muted-foreground text-sm">Обновите свое имя.</div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <div className="text-muted-foreground text-sm">Отображаемое имя</div>
            <Skeleton className="h-9 w-full" />
          </div>
          {/* <div className="flex flex-col gap-0.5">
            <div className="text-muted-foreground text-sm">Email</div>
            <Skeleton className="h-9 w-full" />
          </div> */}
          <div className="flex justify-end">
            <Skeleton className="h-9 w-36" />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
