# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.1.0](https://github.com/Kramarich0/diploma-proj/compare/v1.0.4-legacy-end...v1.1.0) (2026-01-07)


### Features

* **analytics:** добавлена аналитика от vercel ([#78](https://github.com/Kramarich0/diploma-proj/issues/78)) ([9c1fda6](https://github.com/Kramarich0/diploma-proj/commit/9c1fda6066d8a4441ba10e859846c21d995c8bb8))
* **api:** добавлен перехватчик неверных запросов к api ([d566e78](https://github.com/Kramarich0/diploma-proj/commit/d566e788dfe44c0245efde6a31f8394bc0f982da))
* **api:** добавлен trpc-to-openapi ([#102](https://github.com/Kramarich0/diploma-proj/issues/102)) ([7a1247d](https://github.com/Kramarich0/diploma-proj/commit/7a1247d257df21ed3a508b6ebb33d37aeafa3d32))
* **api:** добавлена проверка существования репозитория при переходе … ([#111](https://github.com/Kramarich0/diploma-proj/issues/111)) ([3d7e3e1](https://github.com/Kramarich0/diploma-proj/commit/3d7e3e1fd563f715650886d3184a45eb2eaef3c1))
* **auth:** добавлен вход через magic link и защита роутов ([#80](https://github.com/Kramarich0/diploma-proj/issues/80)) ([98a8fb1](https://github.com/Kramarich0/diploma-proj/commit/98a8fb18f17d493e647d64d4d9ded245e40aaa7e))
* **auth:** улучшения авторизации ([#99](https://github.com/Kramarich0/diploma-proj/issues/99)) ([16adb5e](https://github.com/Kramarich0/diploma-proj/commit/16adb5e35c0f4b6762212f705d9d381e2ce7cf49))
* **ci:** добавлен запрет на мердж из main в другие ветви ([#81](https://github.com/Kramarich0/diploma-proj/issues/81)) ([16acb04](https://github.com/Kramarich0/diploma-proj/commit/16acb04832afda3666d7154dad4568051a1dd454))
* **cli:** начало работы с cli для api ([#105](https://github.com/Kramarich0/diploma-proj/issues/105)) ([156eac3](https://github.com/Kramarich0/diploma-proj/commit/156eac30cde612214f9b29b90955de66ad8e688f))
* **db:** добавлена генерация фиктивных данных для таблиц ([ba7db88](https://github.com/Kramarich0/diploma-proj/commit/ba7db885075fb70f15107c61d544f69dfd5ec28e))
* **db:** добавлены генераторы схем бд для визуализации ([#79](https://github.com/Kramarich0/diploma-proj/issues/79)) ([b3d8c15](https://github.com/Kramarich0/diploma-proj/commit/b3d8c152365eb2cd44c7fb61b22d6a60d2813c8b))
* **db:** добавлены миграции ([#97](https://github.com/Kramarich0/diploma-proj/issues/97)) ([6e134e6](https://github.com/Kramarich0/diploma-proj/commit/6e134e62b9cf91f657ef1c928cbe6bb216453517))
* **mail:** изменен способ отправки почты теперь это resend ([#86](https://github.com/Kramarich0/diploma-proj/issues/86)) ([1b17bf8](https://github.com/Kramarich0/diploma-proj/commit/1b17bf81deb582c5d566005dfda7a6023c95b449))
* **meta:** добавлены метаданные ([#74](https://github.com/Kramarich0/diploma-proj/issues/74)) ([24b158c](https://github.com/Kramarich0/diploma-proj/commit/24b158c9c996fd158b1aab10ca0fa55710551f7b))
* **pages:** добавлены новые страницы ([#101](https://github.com/Kramarich0/diploma-proj/issues/101)) ([8d67ed6](https://github.com/Kramarich0/diploma-proj/commit/8d67ed60b8b8d0538b44e890e0cb421aba6256bd))
* **pages:** удалил loading.tsx там где это избыточно (буду заменены на скелетоны карточек) ([#104](https://github.com/Kramarich0/diploma-proj/issues/104)) ([439d2b9](https://github.com/Kramarich0/diploma-proj/commit/439d2b9eebf2bc9885bd72994e9fafb151cef586))
* **repo:** добавлена работа с репозиториями ([#103](https://github.com/Kramarich0/diploma-proj/issues/103)) ([a261c53](https://github.com/Kramarich0/diploma-proj/commit/a261c53134ed7a44812631a5d48563420ac0d2c2))
* **SEO:** сгенерированы robots.txt а также sitemap.xml ([#89](https://github.com/Kramarich0/diploma-proj/issues/89)) ([5eaa996](https://github.com/Kramarich0/diploma-proj/commit/5eaa996c8753a4a3e98ed2ccb6843d725285df81))
* **trpc:** коррективы trpc и next config ([#71](https://github.com/Kramarich0/diploma-proj/issues/71)) ([7d898cc](https://github.com/Kramarich0/diploma-proj/commit/7d898ccf0f1ab2a549261a98c773db14a8dbc478))
* **ui:** добавлены новые компоненты shadcn ([#98](https://github.com/Kramarich0/diploma-proj/issues/98)) ([22206db](https://github.com/Kramarich0/diploma-proj/commit/22206dbfe0f8c13bc6dd99da561392fa18681cf8))
* **user:** добавлена возможность загрузки аватара пользователя ([#126](https://github.com/Kramarich0/diploma-proj/issues/126)) ([cdf9091](https://github.com/Kramarich0/diploma-proj/commit/cdf9091e7681825fea4bb7068d45377900cd06e9))
* **widgets:** добавлены новые виджеты ([#100](https://github.com/Kramarich0/diploma-proj/issues/100)) ([0221441](https://github.com/Kramarich0/diploma-proj/commit/0221441aff4da82560059959a4f6398b7802bd6f))
* **workflow:** полностью обновлен workflow ([#134](https://github.com/Kramarich0/diploma-proj/issues/134)) ([ebb958a](https://github.com/Kramarich0/diploma-proj/commit/ebb958a85c82c3691f06598f43d4033cc800c568))


### Bug Fixes

* **ci:** удалены не нужные проверки ci ([#88](https://github.com/Kramarich0/diploma-proj/issues/88)) ([8ad0d7f](https://github.com/Kramarich0/diploma-proj/commit/8ad0d7f55ba531f40ebb6188a8a99a47be4aa9d4))
* **ci:** ci для labeler был обновлен ([#137](https://github.com/Kramarich0/diploma-proj/issues/137)) ([646c10e](https://github.com/Kramarich0/diploma-proj/commit/646c10ee91ec611397d5810d5cee8dbd77cc52f5))
* **cli:** на время cli будет удалена из проекта ([#109](https://github.com/Kramarich0/diploma-proj/issues/109)) ([3de1f57](https://github.com/Kramarich0/diploma-proj/commit/3de1f57e001a488763e4a029b423f71dc7c17f5d))
* **duplicates:** дублирования и линтинг: ([#72](https://github.com/Kramarich0/diploma-proj/issues/72)) ([7a25cdf](https://github.com/Kramarich0/diploma-proj/commit/7a25cdf69862ac1a2948aeb625c5478da80df531))
* **files:** исправлено имя файла, добавлено лого в письмо ([#87](https://github.com/Kramarich0/diploma-proj/issues/87)) ([bcee6c1](https://github.com/Kramarich0/diploma-proj/commit/bcee6c12b59173bcb0c7ed2d63719e8cf28538d3))
* **files:** исправлено расширение файла ([#90](https://github.com/Kramarich0/diploma-proj/issues/90)) ([63c5453](https://github.com/Kramarich0/diploma-proj/commit/63c5453dd4f9781a581a88fb7c811512bd3a30d8))
* **import:** удален дублирующий импорт ([#76](https://github.com/Kramarich0/diploma-proj/issues/76)) ([a6796f4](https://github.com/Kramarich0/diploma-proj/commit/a6796f43ed067dccff77fedb5837b060e7b8b7db))
* **mail:** был удален логотип на время из письма также изменение отправителя на поддомен ([#91](https://github.com/Kramarich0/diploma-proj/issues/91)) ([8890863](https://github.com/Kramarich0/diploma-proj/commit/88908638c9e9fb5791c4a31ad92c6658e494f742))
* **misc:** мелкие правки ([#73](https://github.com/Kramarich0/diploma-proj/issues/73)) ([578df73](https://github.com/Kramarich0/diploma-proj/commit/578df734fca38803ff310d56bf99b7893612b04c))
* **SEO:** добавлены фавиконки для поисковых роботов ([#96](https://github.com/Kramarich0/diploma-proj/issues/96)) ([bb2cd0f](https://github.com/Kramarich0/diploma-proj/commit/bb2cd0f69e34c48a8a25533da9dd513e183cab45))
* **SEO:** исправлен момент билда sitemap теперь до а не после билда ([#93](https://github.com/Kramarich0/diploma-proj/issues/93)) ([8f73dce](https://github.com/Kramarich0/diploma-proj/commit/8f73dce40d615f62f8bbfa385c73c1a278d55acf))
* **SEO:** убраны post/pre build ([#94](https://github.com/Kramarich0/diploma-proj/issues/94)) ([ff3b962](https://github.com/Kramarich0/diploma-proj/commit/ff3b962b91888107b622df22308c387756a062f1))
* **ui:** возвращены удаленные по ошибке анимации ([#84](https://github.com/Kramarich0/diploma-proj/issues/84)) ([6ed7caa](https://github.com/Kramarich0/diploma-proj/commit/6ed7caa456647840b3d8420174e0abc3a7f18c55))
* **ui:** убраны не нужные анимации ([#83](https://github.com/Kramarich0/diploma-proj/issues/83)) ([1972143](https://github.com/Kramarich0/diploma-proj/commit/1972143333ad870ee14bd74e998fa5a52cb8f618))
* **utils:** добавил недостающее определение также мелкая правка в лицензии ([#108](https://github.com/Kramarich0/diploma-proj/issues/108)) ([8809432](https://github.com/Kramarich0/diploma-proj/commit/8809432974a8f8c0ee182387b4dd613df2834f8c))
