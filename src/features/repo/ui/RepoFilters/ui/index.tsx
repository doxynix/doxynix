"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Status, Visibility } from "@prisma/client";
import { X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

export function RepoFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateQuery = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(name);
    } else {
      params.set(name, value);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleReset = () => {
    router.push(pathname);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Select
          value={searchParams.get("status") ?? "all"}
          onValueChange={(v) => updateQuery("status", v)}
        >
          <SelectTrigger className="w-35">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value={Status.DONE}>Готово</SelectItem>
            <SelectItem value={Status.PENDING}>В работе</SelectItem>
            <SelectItem value={Status.FAILED}>Ошибка</SelectItem>
            <SelectItem value={Status.NEW}>Новый</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("visibility") ?? "all"}
          onValueChange={(v) => updateQuery("visibility", v)}
        >
          <SelectTrigger className="w-32.5">
            <SelectValue placeholder="Доступ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Весь доступ</SelectItem>
            <SelectItem value={Visibility.PUBLIC}>Публичный</SelectItem>
            <SelectItem value={Visibility.PRIVATE}>Приватный</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("sortBy") ?? "updatedAt"}
          onValueChange={(v) => updateQuery("sortBy", v)}
        >
          <SelectTrigger className="w-37.5">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updatedAt">Обновлен</SelectItem>
            <SelectItem value="createdAt">Добавлен</SelectItem>
            <SelectItem value="name">По имени</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={handleReset} className="px-2">
          Сбросить
          <X className="h-4 w-4" />
        </Button>
      </div>
      {/* <p className="text-muted-foreground text-sm">Всего репозиториев: {meta.totalPages}</p> */}
    </div>
  );
}
