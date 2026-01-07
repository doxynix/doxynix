"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

import { StatusSchema, VisibilitySchema } from "@/generated/zod";

export function RepoFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentParams = new URLSearchParams(searchParams.toString());

  if (currentParams.get("page") === "1") {
    currentParams.delete("page");
  }

  const hasFilters = currentParams.toString().length > 0;

  const updateQuery = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || (name === "sortBy" && value === "updatedAt")) {
      params.delete(name);
    } else {
      params.set(name, value);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}` as Route);
  };

  const handleReset = () => {
    if (!hasFilters && searchParams.get("page") !== "1") return;

    router.push(pathname as Route);
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
            <SelectItem value={StatusSchema.enum.DONE}>Готово</SelectItem>
            <SelectItem value={StatusSchema.enum.PENDING}>В работе</SelectItem>
            <SelectItem value={StatusSchema.enum.FAILED}>Ошибка</SelectItem>
            <SelectItem value={StatusSchema.enum.NEW}>Новый</SelectItem>
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
            <SelectItem value={VisibilitySchema.enum.PUBLIC}>Публичный</SelectItem>
            <SelectItem value={VisibilitySchema.enum.PRIVATE}>Приватный</SelectItem>
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

        <Button disabled={!hasFilters} variant="outline" onClick={handleReset} className="px-2">
          Сбросить
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
