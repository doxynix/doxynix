📝 Trello + GitFlow Mini Cheat Sheet

# Правила ветвления
- Flow: feature/* -> develop -> main
- Перед созданием PR: `git rebase origin/develop` для feature, затем `git push --force-with-lease`.
- При мердже выбираем **Squash and merge** или **Rebase and merge**.
- Нельзя делать merge main -> develop без причины.
- Force-push разрешён только для личных feature-веток (`--force-with-lease`).

1️⃣ Branch Naming
<type>/<TASK_NUMBER>-short-description


Types:

feature/ — фича

fix/ — багфикс

chore/ — вспомогательное

hotfix/ — срочный fix

Example:

feature/12-add-github-oauth
fix/12-redirect-bug
chore/12-setup-prisma

2️⃣ Commit Messages (Conventional)
<type>(<scope>): short description


Types: feat, fix, chore, docs, refactor, test, style

Example:

feat(auth): add GitHub OAuth
fix(login): handle callback redirect
chore(prisma): update schema and generate client


Опционально в коммите можно добавить Trello ссылку:

Trello: https://trello.com/c/fGgQaTYp/12-example-task

3️⃣ Pull Request

Title:

feat: add GitHub OAuth (task #12)


Description template:

Ссылка на Trello: https://trello.com/c/<CARDID>

Что сделано:
- кратко перечислить изменения

Как протестировать локально:
- pnpm install
- pnpm dev

Миграции / env vars (если есть)


PR Checklist:

 pnpm lint ✅

 pnpm typecheck ✅

 pnpm build ✅

 Миграции описаны

 Ссылка на Trello указана

4️⃣ Git Commands Quick
# создать ветку
git checkout develop
git pull
git checkout -b feature/12-add-github-oauth

# коммит
git add .
git commit -m "feat(auth): add GitHub OAuth"

# пуш
git push -u origin feature/12-add-github-oauth

# merge в develop
git checkout develop
git pull
git merge --no-ff feature/12-add-github-oauth
git push origin develop

# релиз develop -> main
git checkout main
git pull
git merge --no-ff develop
git tag v0.1.0
git push origin main --tags

5️⃣ Workflow Quick

Trello → Doing

Создать ветку от develop → feature/12-short

Работа + коммит по Conventional

Пуш ветки → создать PR в develop

CI проходит → merge → Trello → Testing / Done

💡 Tips:

В ветке достаточно номера задачи (12) — коротко и удобно

Для автоматизации можно хранить Trello card ID в PR/коммите

main защищён, пуш только через PR

Pre-commit: lint + typecheck, pre-push: build + tests
