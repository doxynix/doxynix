#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import axios, { AxiosError } from "axios";
import chalk from "chalk";
import { Command } from "commander";

const program = new Command();

const CONFIG_PATH = path.join(os.homedir(), ".dxnxconfig");

const BASE_URL = "https://doxynix.space/api/v1";
// const BASE_URL = "http://localhost:3000/api/v1"; // dev-only

function saveToken(token: string) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ token }, null, 2), {
    mode: 0o600,
  });
}

function getToken(): string | null {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    return config.token;
  } catch {
    return null;
  }
}

const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token === null) {
    console.log(chalk.yellow("Вы не авторизованы. Используйте: dxnx login <key>"));
    process.exit(1);
  }

  if (token !== null) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function handleError(error: unknown) {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message ?? error.response?.data?.error ?? error.message;
    console.error(chalk.red(`❌ Ошибка: ${message}`));
    if (error.response?.status === 401) {
      console.log(chalk.yellow("Попробуйте войти снова: dxnx login <key>"));
    }
  } else {
    console.error(chalk.red("💥 Непредвиденная ошибка"), error);
  }
}

program.name("dxnx").description("CLI для управления Doxynix").version("1.0.0");

program
  .command("login")
  .description("Войти через API ключ")
  .argument("<key>", "Ваш персональный ключ (dxnx_...)")
  .action((key) => {
    if (!Boolean(key.startsWith("dxnx_"))) {
      return console.log(chalk.red("❌ Ключ должен начинаться с 'dxnx_'"));
    }
    saveToken(key);
    console.log(chalk.green("✅ Авторизация успешна! Ключ сохранен."));
  });

program
  .command("logout")
  .description("Выйти и удалить ключ")
  .action(() => {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
      console.log(chalk.blue("👋 Вы вышли из системы."));
    }
  });

const repos = program.command("repos").description("Управление репозиториями");

repos
  .command("list")
  .description("Показать ваши репозитории")
  .option("-s, --search <query>", "Поиск по названию")
  .option("-l, --limit <number>", "Количество записей", "10")
  .action(async (options) => {
    try {
      const { data } = await api.get("/repos", {
        params: {
          search: options.search,
          limit: options.limit,
        },
      });

      if (data.items.length === 0) {
        console.log(chalk.yellow("У вас пока нет добавленных репозиториев."));
        return;
      }

      console.log(chalk.cyan.bold(`\n Ваши репозитории (всего: ${data.meta.totalCount}):`));
      console.log(chalk.gray("".padEnd(60, "-")));

      data.items.forEach((repo: any) => {
        const statusColor = repo.status === "DONE" ? chalk.green : chalk.yellow;
        console.log(
          `${chalk.white(repo.owner + "/" + repo.name).padEnd(30)} ` +
            `[${statusColor(repo.status)}] ` +
            `${chalk.gray("id: " + repo.id)}`
        );
      });
      console.log(chalk.gray("".padEnd(60, "-")) + "\n");
    } catch (e) {
      handleError(e);
    }
  });

repos
  .command("add")
  .description("Добавить новый репозиторий по URL")
  .argument("<url>", "Ссылка на GitHub (owner/name или полная)")
  .action(async (url) => {
    try {
      console.log(chalk.blue("⏳ Добавление репозитория..."));
      const { data } = await api.post("/repos", { url });
      console.log(
        chalk.green(`✅ Репозиторий ${data.repo.owner}/${data.repo.name} успешно добавлен!`)
      );
    } catch (e) {
      handleError(e);
    }
  });

repos
  .command("remove")
  .description("Удалить репозиторий")
  .argument("<id>", "UUID репозитория")
  .action(async (id) => {
    try {
      await api.delete(`/repos/${id}`);
      console.log(chalk.green("✅ Репозиторий удален."));
    } catch (e) {
      handleError(e);
    }
  });

program
  .command("stats")
  .description("Показать статистику дашборда")
  .action(async () => {
    try {
      const { data } = await api.get("/analytics");
      console.log(chalk.magenta.bold("\n📊 Ваша статистика:"));
      console.log(` Репозиториев: ${chalk.white(data.repoCount)}`);
      console.log(` Документов:   ${chalk.white(data.docsCount)}`);
      console.log(` Анализов:     ${chalk.white(data.analysisCount)}`);
      console.log(` В работе:     ${chalk.yellow(data.pendingAnalyses)}`);
      console.log(` Ошибок:       ${chalk.red(data.failedAnalyses)}\n`);
    } catch (e) {
      handleError(e);
    }
  });

program.parse();
