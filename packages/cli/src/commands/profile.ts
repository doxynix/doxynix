import { intro, outro, text, confirm, spinner } from "@clack/prompts";
import { yocto } from "../utils/colors";
import { trpc } from "../client";

export async function handleProfileCommand(action?: string) {
    intro(yocto.magenta("👤 Управление профилем Doxynix"));

    try {
        if (!action) {
            const s = spinner();
            s.start("Загрузка профиля...");
            const res = await trpc.user.me.query();
            s.stop("Профиль загружен");

            console.log(`\n  Имя:  ${yocto.white(res.user.name || "Не указано")}`);
            console.log(`  Email: ${yocto.white(res.user.email || "Не указан")}`);
            console.log(`  Роль:  ${yocto.yellow(res.user.role)}`);
            console.log(`  UUID:  ${yocto.gray(res.user.id)}\n`);

            outro("Используйте 'dxnx profile --help' для просмотра всех опций.");
            return;
        }

        if (action === "update") {
            const current = await trpc.user.me.query();

            const newName = await text({
                message: "Введите новое имя профиля:",
                placeholder: current.user.name || "John Doe",
                validate(value) {
                    if (value.trim().length === 0) return "Имя не может быть пустым";
                    if (value.length > 50) return "Имя не может превышать 50 символов";
                },
            });

            if (typeof newName === "symbol") return;

            const s = spinner();
            s.start("Обновление профиля...");
            await trpc.user.updateUser.mutate({ name: newName });
            s.stop("Профиль успешно обновлен!");

            outro(yocto.green(`✅ Ваше имя изменено на: ${newName}`));
        }

        // 3. Команда: dxnx profile delete (Критическая)
        if (action === "delete") {
            const isConfirmed = await confirm({
                message: yocto.red("⚠️ Вы уверены, что хотите НАВСЕГДА удалить свой аккаунт Doxynix и все репозитории?"),
                active: "Да, удалить всё",
                inactive: "Отмена",
            });

            if (!isConfirmed || typeof isConfirmed === "symbol") {
                outro("Удаление отменено.");
                return;
            }

            const s = spinner();
            s.start("Удаление всех данных аккаунта...");
            const res = await trpc.user.deleteAccount.mutate();
            s.stop("Аккаунт успешно удален.");

            outro(yocto.red(`👋 ${res.message}`));
            // Тут мы автоматически очистим локальный токен, сделав logout
        }

    } catch (error: any) {
        outro(yocto.red(`❌ Ошибка выполнения: ${error.message}`));
    }
}