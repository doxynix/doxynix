# Changelog

## [4.0.1](https://github.com/doxynix/doxynix/compare/doxynix-v4.0.0...doxynix-v4.0.1) (2026-08-26)


### Bug Fixes

* **deps:** update tanstack-router monorepo ([#2047](https://github.com/doxynix/doxynix/issues/2047)) ([a01effb](https://github.com/doxynix/doxynix/commit/a01effb70485a7abc49dc9eab26e8911e19b1a67))

## [4.0.0](https://github.com/doxynix/doxynix/compare/doxynix-v3.1.0...doxynix-v4.0.0) (2026-08-25)


### ⚠ BREAKING CHANGES

* birth of the monorepo (DXNX-198) ([#1524](https://github.com/doxynix/doxynix/issues/1524))
* глобальный переезд архитектуры бекенда а также серьезные усиления анализа  ([#1417](https://github.com/doxynix/doxynix/issues/1417))

### Features

* **app:** внедрение системы строгого аудита и исправление нарушений в UI  ([#930](https://github.com/doxynix/doxynix/issues/930)) ([0a53714](https://github.com/doxynix/doxynix/commit/0a537140e9d1225c8dd34211cef891b9173b732c))
* **app:** добавлены unauthorized и forbidden сценарии  ([#858](https://github.com/doxynix/doxynix/issues/858)) ([4cc6946](https://github.com/doxynix/doxynix/commit/4cc6946659c4046d12e39f86440cac2fb8a869f9))
* **features:** добавлена новая фича "карта репозитория"  ([#1032](https://github.com/doxynix/doxynix/issues/1032)) ([fb651ec](https://github.com/doxynix/doxynix/commit/fb651ec825180b0a145c58f9183fe5a0fae38593))
* **features:** добавлена страница /thanks  ([#828](https://github.com/doxynix/doxynix/issues/828)) ([943d6fd](https://github.com/doxynix/doxynix/commit/943d6fd0a1151ce2a1083e7c706124b5c956bc74))
* **features:** реализована основная часть фичи пул реквестов ([#1175](https://github.com/doxynix/doxynix/issues/1175)) ([8301aae](https://github.com/doxynix/doxynix/commit/8301aae07d7e412c0b7803f746cae58c9cf215e3))
* **features:** улучшение и углубление логики деталей PR  ([#1267](https://github.com/doxynix/doxynix/issues/1267)) ([c799ead](https://github.com/doxynix/doxynix/commit/c799eadafd030e3b394e553e7ebc3975ee582fd1))
* **features:** улучшения аналитики дашборда, оптимизация запросов к бд ([#1393](https://github.com/doxynix/doxynix/issues/1393)) ([0d1ad08](https://github.com/doxynix/doxynix/commit/0d1ad083967e177b25944bd97e6b877d6d978375))
* migrate to better-auth ([#1486](https://github.com/doxynix/doxynix/issues/1486)) ([39005a7](https://github.com/doxynix/doxynix/commit/39005a79191d36d10f026a3e0715e8f4f80a4bf7))
* **security:** значительные улучшения безопасности и конфиденциальности ([#1324](https://github.com/doxynix/doxynix/issues/1324)) ([1bfd55e](https://github.com/doxynix/doxynix/commit/1bfd55e89c49f4f982e0c302f8874c11c6acf88c))
* **server:** масштабная ревизия конвейера статического анализа и AI-пайплайна ([#911](https://github.com/doxynix/doxynix/issues/911)) ([0dbb7f5](https://github.com/doxynix/doxynix/commit/0dbb7f5356c4069863186ed5024e92f11e23ada3))
* **ui:** ui приведен в соответствие новому движку ([#965](https://github.com/doxynix/doxynix/issues/965)) ([150bf8c](https://github.com/doxynix/doxynix/commit/150bf8c7aa975f52b0990f04f421880d1c280850))
* **ui:** полный пересмотр ui для страницы деталей репозитория (wip) ([#913](https://github.com/doxynix/doxynix/issues/913)) ([580d6a2](https://github.com/doxynix/doxynix/commit/580d6a247d7c28160817c2dab0600b2cf297aa09))
* **web:** migrate to vercel blob and extract core services (DXNX-205) ([#1951](https://github.com/doxynix/doxynix/issues/1951)) ([3d09f3e](https://github.com/doxynix/doxynix/commit/3d09f3e01a91c0e2a1f325027b3bd9df318bd9dd))
* внедрение агента dxnx (wip) ([#1462](https://github.com/doxynix/doxynix/issues/1462)) ([5d51771](https://github.com/doxynix/doxynix/commit/5d517717272937610eedad5dff4fda1c11dda7d0))
* глобальный переезд архитектуры бекенда а также серьезные усиления анализа  ([#1417](https://github.com/doxynix/doxynix/issues/1417)) ([4a3c186](https://github.com/doxynix/doxynix/commit/4a3c1868621b9e01646a16a27b0a5dcddbd4d929))
* добавлена страница audit log ([#1357](https://github.com/doxynix/doxynix/issues/1357)) ([a2c4e21](https://github.com/doxynix/doxynix/commit/a2c4e218bcf2b1c10f67744138042b3cec32cd9c))
* проведено усиление пайплайна агента ([#1472](https://github.com/doxynix/doxynix/issues/1472)) ([b36a0f4](https://github.com/doxynix/doxynix/commit/b36a0f402717c475cdc246697e08902124c4716d))
* проведены улучшения движка а также улучшения ui  ([#1451](https://github.com/doxynix/doxynix/issues/1451)) ([a86a300](https://github.com/doxynix/doxynix/commit/a86a300b45e8a1672d0f6a2dc80765f45caa264d))
* реализована страница connections и сопутствующая логика ([#1306](https://github.com/doxynix/doxynix/issues/1306)) ([cbf0c4c](https://github.com/doxynix/doxynix/commit/cbf0c4c2220cb79ca515842f4d1f83f07155d3d7))


### Bug Fixes

* add safeguard in update hook ([#1508](https://github.com/doxynix/doxynix/issues/1508)) ([2ef89a6](https://github.com/doxynix/doxynix/commit/2ef89a666bf9e5ffe376759c6d897daeb111d779))
* **app:** исправление ошибки билда путем удаления генерации gen:credits ([#838](https://github.com/doxynix/doxynix/issues/838)) ([9de2228](https://github.com/doxynix/doxynix/commit/9de2228323d6b3f2fe18a998417c147ce6caf8e5))
* **auth:** фикс рефреша токенов гита  ([#1281](https://github.com/doxynix/doxynix/issues/1281)) ([9aae141](https://github.com/doxynix/doxynix/commit/9aae1413b64145a0bd171fbbf92217980afac7f5))
* delete this damn migration ([#1510](https://github.com/doxynix/doxynix/issues/1510)) ([fe935fc](https://github.com/doxynix/doxynix/commit/fe935fc7e2718a6644a3b436d05549b2bc94480d))
* **deps:** update all non-major dependencies  ([#1164](https://github.com/doxynix/doxynix/issues/1164)) ([6b11487](https://github.com/doxynix/doxynix/commit/6b114872d9305e716d12a85d2f2a38dc80e0913d))
* **deps:** update all non-major dependencies ([#1008](https://github.com/doxynix/doxynix/issues/1008)) ([06d70e2](https://github.com/doxynix/doxynix/commit/06d70e23b1bb07389ba1ae4650b1c976710ed622))
* **deps:** update all non-major dependencies ([#1012](https://github.com/doxynix/doxynix/issues/1012)) ([f9f3d82](https://github.com/doxynix/doxynix/commit/f9f3d82fe82980b875871d9cb1f1bc943360eb8d))
* **deps:** update all non-major dependencies ([#1022](https://github.com/doxynix/doxynix/issues/1022)) ([91d778c](https://github.com/doxynix/doxynix/commit/91d778c39aa72641a67d0a95dcd8bf238a36d7dc))
* **deps:** update all non-major dependencies ([#1031](https://github.com/doxynix/doxynix/issues/1031)) ([04943c2](https://github.com/doxynix/doxynix/commit/04943c2fde96a2419c6366a540276df5c266e124))
* **deps:** update all non-major dependencies ([#1043](https://github.com/doxynix/doxynix/issues/1043)) ([681522d](https://github.com/doxynix/doxynix/commit/681522db603629e416bb12cbf8abf591701ce40e))
* **deps:** update all non-major dependencies ([#1049](https://github.com/doxynix/doxynix/issues/1049)) ([4e1fba4](https://github.com/doxynix/doxynix/commit/4e1fba4b0644a71d94e5c1f1ce71ae7b2f0200b0))
* **deps:** update all non-major dependencies ([#1053](https://github.com/doxynix/doxynix/issues/1053)) ([b3f0f0f](https://github.com/doxynix/doxynix/commit/b3f0f0fde103902189f97b9a6b8c741c4d1de367))
* **deps:** update all non-major dependencies ([#1058](https://github.com/doxynix/doxynix/issues/1058)) ([11ca5b7](https://github.com/doxynix/doxynix/commit/11ca5b79bedd8dbfbd95acbcab232c6cb564799d))
* **deps:** update all non-major dependencies ([#1063](https://github.com/doxynix/doxynix/issues/1063)) ([3dd5142](https://github.com/doxynix/doxynix/commit/3dd514259ff9ef50a75064916b6a96a1094f7d3e))
* **deps:** update all non-major dependencies ([#1071](https://github.com/doxynix/doxynix/issues/1071)) ([6e24d4e](https://github.com/doxynix/doxynix/commit/6e24d4eb3cab15d53e2817eeca3fc8f6adcb36bf))
* **deps:** update all non-major dependencies ([#1077](https://github.com/doxynix/doxynix/issues/1077)) ([596afe0](https://github.com/doxynix/doxynix/commit/596afe0a98b727aa3c9ed9c52aaab3316282ab7a))
* **deps:** update all non-major dependencies ([#1083](https://github.com/doxynix/doxynix/issues/1083)) ([9b1707f](https://github.com/doxynix/doxynix/commit/9b1707f2397d103ecab686df6bac70c086067af8))
* **deps:** update all non-major dependencies ([#1087](https://github.com/doxynix/doxynix/issues/1087)) ([817bf91](https://github.com/doxynix/doxynix/commit/817bf9171ea1693e7f318ca2cf4632dca6765281))
* **deps:** update all non-major dependencies ([#1095](https://github.com/doxynix/doxynix/issues/1095)) ([2c17408](https://github.com/doxynix/doxynix/commit/2c1740828838f1f522467f97a24f54068a9fcf04))
* **deps:** update all non-major dependencies ([#1099](https://github.com/doxynix/doxynix/issues/1099)) ([4b72069](https://github.com/doxynix/doxynix/commit/4b72069aec3e283d1957dad18d24ca340ed1fe7c))
* **deps:** update all non-major dependencies ([#1106](https://github.com/doxynix/doxynix/issues/1106)) ([7019c63](https://github.com/doxynix/doxynix/commit/7019c63136817ce37d3e985a1739411ef6bae74a))
* **deps:** update all non-major dependencies ([#1112](https://github.com/doxynix/doxynix/issues/1112)) ([9b5fa7e](https://github.com/doxynix/doxynix/commit/9b5fa7e5b6fec0d7ac968bc0662e9c90d76afa60))
* **deps:** update all non-major dependencies ([#1116](https://github.com/doxynix/doxynix/issues/1116)) ([c6a94e8](https://github.com/doxynix/doxynix/commit/c6a94e8a5eff91c7810717fd02a8f19d257cec20))
* **deps:** update all non-major dependencies ([#1128](https://github.com/doxynix/doxynix/issues/1128)) ([7963ff1](https://github.com/doxynix/doxynix/commit/7963ff139aa4d129ed81c3d6af808637610b9533))
* **deps:** update all non-major dependencies ([#1132](https://github.com/doxynix/doxynix/issues/1132)) ([13f333e](https://github.com/doxynix/doxynix/commit/13f333e521e1efacb931bd59655324fb66433482))
* **deps:** update all non-major dependencies ([#1138](https://github.com/doxynix/doxynix/issues/1138)) ([5eb02ce](https://github.com/doxynix/doxynix/commit/5eb02cecbc40ad69f156321c6327607103a3df4c))
* **deps:** update all non-major dependencies ([#1142](https://github.com/doxynix/doxynix/issues/1142)) ([58e76af](https://github.com/doxynix/doxynix/commit/58e76af03f9eb30fb3d0d8be86dfa1b6fa7fda0c))
* **deps:** update all non-major dependencies ([#1146](https://github.com/doxynix/doxynix/issues/1146)) ([5fdb11b](https://github.com/doxynix/doxynix/commit/5fdb11bf8f7653341fd28ba719c7d736b352a1fb))
* **deps:** update all non-major dependencies ([#1156](https://github.com/doxynix/doxynix/issues/1156)) ([aeb0ec0](https://github.com/doxynix/doxynix/commit/aeb0ec09dd69c30704227ab793bacbdb8651952a))
* **deps:** update all non-major dependencies ([#1160](https://github.com/doxynix/doxynix/issues/1160)) ([db96fbf](https://github.com/doxynix/doxynix/commit/db96fbf95fde6430697ef0479e271eab5a7f9268))
* **deps:** update all non-major dependencies ([#1180](https://github.com/doxynix/doxynix/issues/1180)) ([6265694](https://github.com/doxynix/doxynix/commit/62656947ca8c63ba2c62b42f5048b60359023680))
* **deps:** update all non-major dependencies ([#1185](https://github.com/doxynix/doxynix/issues/1185)) ([c20719e](https://github.com/doxynix/doxynix/commit/c20719efa9b4098c1d88fc30ead1cb1283516e59))
* **deps:** update all non-major dependencies ([#1190](https://github.com/doxynix/doxynix/issues/1190)) ([62ba276](https://github.com/doxynix/doxynix/commit/62ba2766d438e5fd64cfa7b00947a0bdf6375202))
* **deps:** update all non-major dependencies ([#1199](https://github.com/doxynix/doxynix/issues/1199)) ([1d4275b](https://github.com/doxynix/doxynix/commit/1d4275b4f93b34363d066f7471b6505ebd453dd5))
* **deps:** update all non-major dependencies ([#1203](https://github.com/doxynix/doxynix/issues/1203)) ([eb0b480](https://github.com/doxynix/doxynix/commit/eb0b48071cc5b23e82921d5346e4af656d514667))
* **deps:** update all non-major dependencies ([#1207](https://github.com/doxynix/doxynix/issues/1207)) ([af7e82b](https://github.com/doxynix/doxynix/commit/af7e82be0fdec8dc57e9cdbfb1b6be229c63e83f))
* **deps:** update all non-major dependencies ([#1211](https://github.com/doxynix/doxynix/issues/1211)) ([6856ed6](https://github.com/doxynix/doxynix/commit/6856ed60126c5ca0f3ec4ca5e8faeddd378bf5ce))
* **deps:** update all non-major dependencies ([#1228](https://github.com/doxynix/doxynix/issues/1228)) ([1def787](https://github.com/doxynix/doxynix/commit/1def787ce6a45c67485f4e5009b2efcb07db88c8))
* **deps:** update all non-major dependencies ([#1232](https://github.com/doxynix/doxynix/issues/1232)) ([b178daa](https://github.com/doxynix/doxynix/commit/b178daa660caf383ea11bd059e65e0cacafd1a81))
* **deps:** update all non-major dependencies ([#1237](https://github.com/doxynix/doxynix/issues/1237)) ([c72c2cb](https://github.com/doxynix/doxynix/commit/c72c2cb99f8e739b29f7c3ea28e5babb8bb12b59))
* **deps:** update all non-major dependencies ([#1245](https://github.com/doxynix/doxynix/issues/1245)) ([0a69a5b](https://github.com/doxynix/doxynix/commit/0a69a5b15df91a570af28851c7fff09f1b75bdc9))
* **deps:** update all non-major dependencies ([#1252](https://github.com/doxynix/doxynix/issues/1252)) ([a183d78](https://github.com/doxynix/doxynix/commit/a183d7886cf3b05277074504c459b1fd2aa481d8))
* **deps:** update all non-major dependencies ([#1254](https://github.com/doxynix/doxynix/issues/1254)) ([59352e9](https://github.com/doxynix/doxynix/commit/59352e932e7be2666609285bf9ef572913142ead))
* **deps:** update all non-major dependencies ([#1259](https://github.com/doxynix/doxynix/issues/1259)) ([6a614a0](https://github.com/doxynix/doxynix/commit/6a614a06e58f4efd8ffaecc3655d6ffc49a7c071))
* **deps:** update all non-major dependencies ([#1263](https://github.com/doxynix/doxynix/issues/1263)) ([8b01e70](https://github.com/doxynix/doxynix/commit/8b01e70dc63fe459e7379744d09cfa2ac37314a6))
* **deps:** update all non-major dependencies ([#1297](https://github.com/doxynix/doxynix/issues/1297)) ([0dd38b8](https://github.com/doxynix/doxynix/commit/0dd38b8b6659195fe6e6131af2ffdf34a6b07251))
* **deps:** update all non-major dependencies ([#1301](https://github.com/doxynix/doxynix/issues/1301)) ([29e2d3b](https://github.com/doxynix/doxynix/commit/29e2d3b473ad0a3923a5468411ab8eed17a81b51))
* **deps:** update all non-major dependencies ([#1305](https://github.com/doxynix/doxynix/issues/1305)) ([5de74ab](https://github.com/doxynix/doxynix/commit/5de74ab61865c0e68fccd87d361cf252cfef77bd))
* **deps:** update all non-major dependencies ([#1312](https://github.com/doxynix/doxynix/issues/1312)) ([96af0e0](https://github.com/doxynix/doxynix/commit/96af0e0fa571318ead28313ae7ccac771d33a37e))
* **deps:** update all non-major dependencies ([#1316](https://github.com/doxynix/doxynix/issues/1316)) ([78923b8](https://github.com/doxynix/doxynix/commit/78923b83b10b1e60964ab83acd3738bfb9405df8))
* **deps:** update all non-major dependencies ([#1320](https://github.com/doxynix/doxynix/issues/1320)) ([88f9860](https://github.com/doxynix/doxynix/commit/88f9860ff4c6f4f1fe53498add131a3646072991))
* **deps:** update all non-major dependencies ([#1325](https://github.com/doxynix/doxynix/issues/1325)) ([6dd0d07](https://github.com/doxynix/doxynix/commit/6dd0d075295011e55089331e835ea673bc81099f))
* **deps:** update all non-major dependencies ([#1329](https://github.com/doxynix/doxynix/issues/1329)) ([3ae4ed8](https://github.com/doxynix/doxynix/commit/3ae4ed80a1a03b1dd9c977decbeadf21337ede6e))
* **deps:** update all non-major dependencies ([#1333](https://github.com/doxynix/doxynix/issues/1333)) ([9b1c5fb](https://github.com/doxynix/doxynix/commit/9b1c5fb7dfd7ead21318a813fb999fa937225297))
* **deps:** update all non-major dependencies ([#1347](https://github.com/doxynix/doxynix/issues/1347)) ([d2b6415](https://github.com/doxynix/doxynix/commit/d2b64158f05255b3680989302539d20029e71121))
* **deps:** update all non-major dependencies ([#1358](https://github.com/doxynix/doxynix/issues/1358)) ([b271f8e](https://github.com/doxynix/doxynix/commit/b271f8eff46f0cffb66e0fef443419f8bb325021))
* **deps:** update all non-major dependencies ([#1365](https://github.com/doxynix/doxynix/issues/1365)) ([202a45a](https://github.com/doxynix/doxynix/commit/202a45a456e737c47d7f9f58958652b191947d39))
* **deps:** update all non-major dependencies ([#1373](https://github.com/doxynix/doxynix/issues/1373)) ([2b68d7b](https://github.com/doxynix/doxynix/commit/2b68d7bae7cef9ae89700dea97fdd59b527e1508))
* **deps:** update all non-major dependencies ([#1377](https://github.com/doxynix/doxynix/issues/1377)) ([8b0c2a1](https://github.com/doxynix/doxynix/commit/8b0c2a16e63a68e5b56e75bfcb36277608758077))
* **deps:** update all non-major dependencies ([#1381](https://github.com/doxynix/doxynix/issues/1381)) ([6bd85f8](https://github.com/doxynix/doxynix/commit/6bd85f8e88a0731ae8a123c53845170c1674f239))
* **deps:** update all non-major dependencies ([#1385](https://github.com/doxynix/doxynix/issues/1385)) ([41b68b4](https://github.com/doxynix/doxynix/commit/41b68b4776f2cd529789450a8c7a863d2ea8f47e))
* **deps:** update all non-major dependencies ([#1399](https://github.com/doxynix/doxynix/issues/1399)) ([ee09286](https://github.com/doxynix/doxynix/commit/ee09286653719450c5aa6f46e8db52e06e31583a))
* **deps:** update all non-major dependencies ([#1424](https://github.com/doxynix/doxynix/issues/1424)) ([5494627](https://github.com/doxynix/doxynix/commit/54946272be376951097aa72c1c6ac06aa3dbffad))
* **deps:** update all non-major dependencies ([#1457](https://github.com/doxynix/doxynix/issues/1457)) ([7276ad5](https://github.com/doxynix/doxynix/commit/7276ad5f186a4a1cf2cf1939bbbfb930d99aa0cf))
* **deps:** update all non-major dependencies ([#1468](https://github.com/doxynix/doxynix/issues/1468)) ([4ad175f](https://github.com/doxynix/doxynix/commit/4ad175f502868049e0ac6683e1a6e3a6bc995cbf))
* **deps:** update all non-major dependencies ([#1481](https://github.com/doxynix/doxynix/issues/1481)) ([96c53ec](https://github.com/doxynix/doxynix/commit/96c53eca3e6a8e1a9089d8ecbec06bb137b23217))
* **deps:** update all non-major dependencies ([#787](https://github.com/doxynix/doxynix/issues/787)) ([93da35c](https://github.com/doxynix/doxynix/commit/93da35cd891447429977f5508e24e3e661f7c9a2))
* **deps:** update all non-major dependencies ([#800](https://github.com/doxynix/doxynix/issues/800)) ([95f41de](https://github.com/doxynix/doxynix/commit/95f41de100d49444a163d9e3eb3d46ce88eb00e4))
* **deps:** update all non-major dependencies ([#810](https://github.com/doxynix/doxynix/issues/810)) ([665cbca](https://github.com/doxynix/doxynix/commit/665cbca2040baab719b2d7859b8c1d2deb377bf7))
* **deps:** update all non-major dependencies ([#876](https://github.com/doxynix/doxynix/issues/876)) ([4bb2b90](https://github.com/doxynix/doxynix/commit/4bb2b9027906fe43c43429439ebf342002734b7b))
* **deps:** update all non-major dependencies ([#880](https://github.com/doxynix/doxynix/issues/880)) ([3492618](https://github.com/doxynix/doxynix/commit/3492618841f41ee33e41c53120c39d495385a108))
* **deps:** update all non-major dependencies ([#885](https://github.com/doxynix/doxynix/issues/885)) ([b2700af](https://github.com/doxynix/doxynix/commit/b2700af4b09a98fc47ee939f3a1851069ac811db))
* **deps:** update all non-major dependencies ([#898](https://github.com/doxynix/doxynix/issues/898)) ([f652454](https://github.com/doxynix/doxynix/commit/f6524545c0be1e4ea200b5364f942e5d1ef2515f))
* **deps:** update all non-major dependencies ([#946](https://github.com/doxynix/doxynix/issues/946)) ([c73ea91](https://github.com/doxynix/doxynix/commit/c73ea91d8d4e4095947813cd2b1e4b6193ba15df))
* **deps:** update all non-major dependencies ([#952](https://github.com/doxynix/doxynix/issues/952)) ([3491099](https://github.com/doxynix/doxynix/commit/34910993209ea47d67ec7716de2018712cc18579))
* **deps:** update all non-major dependencies ([#959](https://github.com/doxynix/doxynix/issues/959)) ([e79d2e4](https://github.com/doxynix/doxynix/commit/e79d2e49d56db14639373948cf1a065bd80a3481))
* **deps:** update all non-major dependencies ([#970](https://github.com/doxynix/doxynix/issues/970)) ([77481e3](https://github.com/doxynix/doxynix/commit/77481e3c530635cd220f1ad65b784f8382a7d6b4))
* **deps:** update all non-major dependencies to v11.16.0 ([#829](https://github.com/doxynix/doxynix/issues/829)) ([e94e491](https://github.com/doxynix/doxynix/commit/e94e4917a3951a40d321f6802262bbfc54033dff))
* **deps:** update all non-major dependencies to v11.6.0 ([#1004](https://github.com/doxynix/doxynix/issues/1004)) ([b0272f3](https://github.com/doxynix/doxynix/commit/b0272f316a9425b459d00612c78f9d9e32fb66a8))
* **deps:** update all non-major dependencies to v12.3.0 ([#1277](https://github.com/doxynix/doxynix/issues/1277)) ([60faedc](https://github.com/doxynix/doxynix/commit/60faedcb89fbe9d99c1f5e93a84e3a90b334f035))
* **deps:** update all non-major dependencies to v12.3.1 ([#1285](https://github.com/doxynix/doxynix/issues/1285)) ([10af3cf](https://github.com/doxynix/doxynix/commit/10af3cf3a260c6d18b4fb5775cd6deb07d328a23))
* **deps:** update all non-major dependencies to v4.25.9 ([#779](https://github.com/doxynix/doxynix/issues/779)) ([97361fa](https://github.com/doxynix/doxynix/commit/97361fae514019b92212f635d9ddb8d821cfa0af))
* **deps:** update all non-major dependencies to v5.100.4 ([#1271](https://github.com/doxynix/doxynix/issues/1271)) ([df98d39](https://github.com/doxynix/doxynix/commit/df98d3976c8359f2b65f12002125341d84b11a79))
* **deps:** update all non-major dependencies to v5.100.9 ([#1406](https://github.com/doxynix/doxynix/issues/1406)) ([6842969](https://github.com/doxynix/doxynix/commit/6842969ea4d3b1cc1bcf8e0648903c4ae0a60d34))
* **deps:** update all non-major dependencies to v5.98.0 ([#1091](https://github.com/doxynix/doxynix/issues/1091)) ([a906c58](https://github.com/doxynix/doxynix/commit/a906c589ef980cc1ddd69128b3a13efe1c39c99b))
* **deps:** update better-auth monorepo to v1.6.27 ([#1907](https://github.com/doxynix/doxynix/issues/1907)) ([11b94a0](https://github.com/doxynix/doxynix/commit/11b94a0e0e815141399799c5cf08c8170205480a))
* **deps:** update better-auth monorepo to v1.6.28 ([#1943](https://github.com/doxynix/doxynix/issues/1943)) ([3b1208d](https://github.com/doxynix/doxynix/commit/3b1208d1ce4ee23dec97294d0218e80906705a1e))
* **deps:** update better-auth monorepo to v1.6.29 ([#1953](https://github.com/doxynix/doxynix/issues/1953)) ([aef2e32](https://github.com/doxynix/doxynix/commit/aef2e32232d513db81efc228dd4f712194f961e2))
* **deps:** update better-auth monorepo to v1.6.30 ([#1980](https://github.com/doxynix/doxynix/issues/1980)) ([6c632f5](https://github.com/doxynix/doxynix/commit/6c632f589ca70d30f24b622cae7631c57f99ca70))
* **deps:** update codemirror ([#1969](https://github.com/doxynix/doxynix/issues/1969)) ([e352dbe](https://github.com/doxynix/doxynix/commit/e352dbe96793139e7f7c62e77bed34393b60e401))
* **deps:** update dependency [@trigger](https://github.com/trigger).dev/react-hooks to v4.5.11 ([#1936](https://github.com/doxynix/doxynix/issues/1936)) ([adb2898](https://github.com/doxynix/doxynix/commit/adb2898c04126565976d7e15a3bef2ea292d4ab0))
* **deps:** update dependency [@trigger](https://github.com/trigger).dev/react-hooks to v4.5.12 ([#2021](https://github.com/doxynix/doxynix/issues/2021)) ([a55fd2a](https://github.com/doxynix/doxynix/commit/a55fd2abcb32f3c74ba6539bfb21461d56601101))
* **deps:** update dependency [@trigger](https://github.com/trigger).dev/sdk to v4.5.11 ([#1937](https://github.com/doxynix/doxynix/issues/1937)) ([67a59c6](https://github.com/doxynix/doxynix/commit/67a59c6f072609b29c7b5c4eb6cdc1068913827e))
* **deps:** update dependency [@trigger](https://github.com/trigger).dev/sdk to v4.5.12 ([#2022](https://github.com/doxynix/doxynix/issues/2022)) ([d99f09f](https://github.com/doxynix/doxynix/commit/d99f09f9346adcc98bfeab39baf53334df4c588a))
* **deps:** update dependency @ai-sdk/google to v3.0.105 ([#1891](https://github.com/doxynix/doxynix/issues/1891)) ([234b880](https://github.com/doxynix/doxynix/commit/234b880ab570488014ac5451564ac663c4f2c8ff))
* **deps:** update dependency @ai-sdk/google to v3.0.106 ([#1899](https://github.com/doxynix/doxynix/issues/1899)) ([7ede586](https://github.com/doxynix/doxynix/commit/7ede5866c33f3f77a73239a6083601d8ff26d9cb))
* **deps:** update dependency @ai-sdk/google to v3.0.107 ([#1908](https://github.com/doxynix/doxynix/issues/1908)) ([336fd0e](https://github.com/doxynix/doxynix/commit/336fd0e9c03a3276286be4a0c2e15480a428a2bd))
* **deps:** update dependency @ai-sdk/google to v3.0.108 ([#1924](https://github.com/doxynix/doxynix/issues/1924)) ([e84298a](https://github.com/doxynix/doxynix/commit/e84298a8bddfe6a41b4380f90a62fd57c6cdcdd5))
* **deps:** update dependency @ai-sdk/google to v3.0.109 ([#1946](https://github.com/doxynix/doxynix/issues/1946)) ([f00caeb](https://github.com/doxynix/doxynix/commit/f00caebdd6abfafa8ef275a1a352bc6ed77cf149))
* **deps:** update dependency @ai-sdk/google to v3.0.110 ([#1954](https://github.com/doxynix/doxynix/issues/1954)) ([06ffb1c](https://github.com/doxynix/doxynix/commit/06ffb1cc02732c8305b6afcbd5540679273a8491))
* **deps:** update dependency @ai-sdk/google to v3.0.111 ([#2024](https://github.com/doxynix/doxynix/issues/2024)) ([b7857b9](https://github.com/doxynix/doxynix/commit/b7857b9e34f7d73019b5acf8bac11f31dbc5aed2))
* **deps:** update dependency @ai-sdk/groq to v3.0.57 ([#1892](https://github.com/doxynix/doxynix/issues/1892)) ([0465a15](https://github.com/doxynix/doxynix/commit/0465a15ca7c9ebb47413e9f5b742a35ebe9fb384))
* **deps:** update dependency @ai-sdk/groq to v3.0.59 ([#1900](https://github.com/doxynix/doxynix/issues/1900)) ([d3931e3](https://github.com/doxynix/doxynix/commit/d3931e3ad541fe7c678411912c2f2250f9e07709))
* **deps:** update dependency @ai-sdk/groq to v3.0.60 ([#1955](https://github.com/doxynix/doxynix/issues/1955)) ([c9be280](https://github.com/doxynix/doxynix/commit/c9be280fe25a988a4da86a66b758e9352de5bc2a))
* **deps:** update dependency @ai-sdk/openai to v3.0.93 ([#1893](https://github.com/doxynix/doxynix/issues/1893)) ([2a4c3aa](https://github.com/doxynix/doxynix/commit/2a4c3aa5cc81b510ff23047b940f44e12294a322))
* **deps:** update dependency @ai-sdk/openai to v3.0.94 ([#1909](https://github.com/doxynix/doxynix/issues/1909)) ([4e6d30f](https://github.com/doxynix/doxynix/commit/4e6d30f65b81072d24d0b1e24d5b6b27cf53385b))
* **deps:** update dependency @ai-sdk/openai to v3.0.96 ([#1925](https://github.com/doxynix/doxynix/issues/1925)) ([aeb1b3e](https://github.com/doxynix/doxynix/commit/aeb1b3e4ce836868d3c0a730d1fc8ea5e39a7e29))
* **deps:** update dependency @ai-sdk/openai to v3.0.97 ([#1956](https://github.com/doxynix/doxynix/issues/1956)) ([6ab89af](https://github.com/doxynix/doxynix/commit/6ab89afc388c664a8725b04c4ccffea1dc46237e))
* **deps:** update dependency @ai-sdk/openai to v3.0.98 ([#2009](https://github.com/doxynix/doxynix/issues/2009)) ([7a4228d](https://github.com/doxynix/doxynix/commit/7a4228d2c63bc3a5e7029dffe78fe5a19cdb6373))
* **deps:** update dependency @ai-sdk/openai to v3.0.99 ([#2025](https://github.com/doxynix/doxynix/issues/2025)) ([b57a01a](https://github.com/doxynix/doxynix/commit/b57a01ac95bd93d3f01f42279f141e86a7b59022))
* **deps:** update dependency @ai-sdk/react to v3.0.249 ([#1894](https://github.com/doxynix/doxynix/issues/1894)) ([62d9592](https://github.com/doxynix/doxynix/commit/62d95925501b532572dd09d72792309cc9f570e5))
* **deps:** update dependency @ai-sdk/react to v3.0.252 ([#1901](https://github.com/doxynix/doxynix/issues/1901)) ([ce5947a](https://github.com/doxynix/doxynix/commit/ce5947aefeaca3e996482ddda5cdb54aa29b1c0a))
* **deps:** update dependency @ai-sdk/react to v3.0.256 ([#1926](https://github.com/doxynix/doxynix/issues/1926)) ([e2f5f0d](https://github.com/doxynix/doxynix/commit/e2f5f0d1330ad165c9c52ab9b0c7d35d52d84f61))
* **deps:** update dependency @ai-sdk/react to v3.0.259 ([#1947](https://github.com/doxynix/doxynix/issues/1947)) ([20208e1](https://github.com/doxynix/doxynix/commit/20208e14a1ad72f90434b5d80e4cb0f7907cd03b))
* **deps:** update dependency @ai-sdk/react to v3.0.260 ([#1987](https://github.com/doxynix/doxynix/issues/1987)) ([ea045ce](https://github.com/doxynix/doxynix/commit/ea045cefa05e99e08504f6eecb97cf1db7c75f31))
* **deps:** update dependency @ai-sdk/react to v3.0.261 ([#1995](https://github.com/doxynix/doxynix/issues/1995)) ([e5ec049](https://github.com/doxynix/doxynix/commit/e5ec0498b7ec8f0b48c691fc3350a5b30eaf7af7))
* **deps:** update dependency @ai-sdk/react to v3.0.262 ([#2010](https://github.com/doxynix/doxynix/issues/2010)) ([1b68371](https://github.com/doxynix/doxynix/commit/1b68371836a925c080e908f0c6abaeeb52d9903d))
* **deps:** update dependency @ai-sdk/react to v3.0.264 ([#2026](https://github.com/doxynix/doxynix/issues/2026)) ([9576431](https://github.com/doxynix/doxynix/commit/9576431ff7b197a783cb818f144ca0819429c01f))
* **deps:** update dependency @ai-sdk/react to v3.0.267 ([#2034](https://github.com/doxynix/doxynix/issues/2034)) ([f899139](https://github.com/doxynix/doxynix/commit/f899139c669374f499507929e6b2786e85d1f58e))
* **deps:** update dependency @hookform/resolvers to v5.8.0 ([#1945](https://github.com/doxynix/doxynix/issues/1945)) ([03af800](https://github.com/doxynix/doxynix/commit/03af800ee643dd11896b63864cef19623c3742d1))
* **deps:** update dependency @hookform/resolvers to v5.9.0 ([#1964](https://github.com/doxynix/doxynix/issues/1964)) ([24dc4c2](https://github.com/doxynix/doxynix/commit/24dc4c2fec94c1d68b3ef7e9869104cacdf77519))
* **deps:** update dependency @hookform/resolvers to v5.9.1 ([#1974](https://github.com/doxynix/doxynix/issues/1974)) ([9e1cb9d](https://github.com/doxynix/doxynix/commit/9e1cb9d108b31cb23984fa565b267a15d234c872))
* **deps:** update dependency @jscpd/tokenizer to v4.2.6 ([#1940](https://github.com/doxynix/doxynix/issues/1940)) ([92e9e82](https://github.com/doxynix/doxynix/commit/92e9e82ea72c277d20dab1474d12087aec6ddf10))
* **deps:** update dependency @marsidev/react-turnstile to v1.5.0 ([#821](https://github.com/doxynix/doxynix/issues/821)) ([c8f3d39](https://github.com/doxynix/doxynix/commit/c8f3d39c6ece5abcd56af3c7eb35de512c7060bf))
* **deps:** update dependency @marsidev/react-turnstile to v1.6.0 ([#1904](https://github.com/doxynix/doxynix/issues/1904)) ([43e1a93](https://github.com/doxynix/doxynix/commit/43e1a93e69bc65136ff141c0cd007fe312dfaa55))
* **deps:** update dependency @scalar/api-reference-react to v0.9.16 ([#846](https://github.com/doxynix/doxynix/issues/846)) ([a7a67ec](https://github.com/doxynix/doxynix/commit/a7a67eca3bd232a4231fbfd45bea68223615b874))
* **deps:** update dependency @scalar/api-reference-react to v0.9.17 ([#859](https://github.com/doxynix/doxynix/issues/859)) ([0ed6352](https://github.com/doxynix/doxynix/commit/0ed63522d08f94a9e43bb7c1021412df01ace128))
* **deps:** update dependency @scalar/api-reference-react to v0.9.20 ([#981](https://github.com/doxynix/doxynix/issues/981)) ([52aecde](https://github.com/doxynix/doxynix/commit/52aecde08d98adc4c734c3c123f2cf3a3e121376))
* **deps:** update dependency @scalar/api-reference-react to v0.9.63 ([#1944](https://github.com/doxynix/doxynix/issues/1944)) ([cc52b7b](https://github.com/doxynix/doxynix/commit/cc52b7b7483f56b9f95619b9667781cc74af790c))
* **deps:** update dependency @sentry/nextjs to v10.51.0 ([#1341](https://github.com/doxynix/doxynix/issues/1341)) ([a94f323](https://github.com/doxynix/doxynix/commit/a94f3230760aa58c8066b0632c32d0d44daeeeef))
* **deps:** update dependency @sentry/nextjs to v10.70.0 ([#1888](https://github.com/doxynix/doxynix/issues/1888)) ([07a812a](https://github.com/doxynix/doxynix/commit/07a812a3bf0009ad1d4d07fab2e5d1b2636085bb))
* **deps:** update dependency @types/picomatch to v4.0.3 ([#958](https://github.com/doxynix/doxynix/issues/958)) ([7a52ce3](https://github.com/doxynix/doxynix/commit/7a52ce3e14471d6e454f50d043c255ef524815d0))
* **deps:** update dependency @xyflow/react to v12.11.3 ([#1914](https://github.com/doxynix/doxynix/issues/1914)) ([ac39b73](https://github.com/doxynix/doxynix/commit/ac39b73da26a3557307a2005f11c14f6f54e271a))
* **deps:** update dependency ably to v2.27.0 ([#1905](https://github.com/doxynix/doxynix/issues/1905)) ([3edfb35](https://github.com/doxynix/doxynix/commit/3edfb3575018744d550c41a839511dfdd7eeaa77))
* **deps:** update dependency ai to v6.0.140 ([#795](https://github.com/doxynix/doxynix/issues/795)) ([fdfc57d](https://github.com/doxynix/doxynix/commit/fdfc57d40ac6c2b85d49d20dd71bce8be2737f88))
* **deps:** update dependency ai to v6.0.142 ([#894](https://github.com/doxynix/doxynix/issues/894)) ([8503e43](https://github.com/doxynix/doxynix/commit/8503e431b6d952f6c3725a107b7bc8031e8cfc56))
* **deps:** update dependency ai to v6.0.146 ([#974](https://github.com/doxynix/doxynix/issues/974)) ([f0689ea](https://github.com/doxynix/doxynix/commit/f0689eaea6f27dde0b41b31cfd04c4aa5d834777))
* **deps:** update dependency ai to v6.0.248 ([#1895](https://github.com/doxynix/doxynix/issues/1895)) ([c69eb27](https://github.com/doxynix/doxynix/commit/c69eb27953594dc492f1101d1aeaded07911951a))
* **deps:** update dependency ai to v6.0.250 ([#1910](https://github.com/doxynix/doxynix/issues/1910)) ([dbe3850](https://github.com/doxynix/doxynix/commit/dbe38509838ef2f1c5a127aa9ef3cf96f00f65e5))
* **deps:** update dependency ai to v6.0.253 ([#1927](https://github.com/doxynix/doxynix/issues/1927)) ([b4b2ab0](https://github.com/doxynix/doxynix/commit/b4b2ab0ed06ae76c34bb5d390846eaf3da507fff))
* **deps:** update dependency ai to v6.0.255 ([#1948](https://github.com/doxynix/doxynix/issues/1948)) ([0d56fc9](https://github.com/doxynix/doxynix/commit/0d56fc9bb63a06c823ad0d23ad9cb873a602b713))
* **deps:** update dependency ai to v6.0.256 ([#1957](https://github.com/doxynix/doxynix/issues/1957)) ([193cdbd](https://github.com/doxynix/doxynix/commit/193cdbd28444a2b34ac3bc81395a4631a445ca1d))
* **deps:** update dependency ai to v6.0.257 ([#1988](https://github.com/doxynix/doxynix/issues/1988)) ([e86328e](https://github.com/doxynix/doxynix/commit/e86328ed01da5185eb667f306085c3504c4ced65))
* **deps:** update dependency ai to v6.0.258 ([#1996](https://github.com/doxynix/doxynix/issues/1996)) ([6ad4846](https://github.com/doxynix/doxynix/commit/6ad48461e2d3363e8a9cc18ea7621e2005e0376b))
* **deps:** update dependency ai to v6.0.259 ([#2011](https://github.com/doxynix/doxynix/issues/2011)) ([9706533](https://github.com/doxynix/doxynix/commit/97065336a3c37878f9b88adb39550d02edd9e6fd))
* **deps:** update dependency ai to v6.0.261 ([#2027](https://github.com/doxynix/doxynix/issues/2027)) ([15e0765](https://github.com/doxynix/doxynix/commit/15e0765502349e4b40ed6a4e134e85c2ab4fc055))
* **deps:** update dependency ai to v6.0.264 ([#2035](https://github.com/doxynix/doxynix/issues/2035)) ([3bc62e9](https://github.com/doxynix/doxynix/commit/3bc62e92940bb1b38b8e3fc062a74294c6763b07))
* **deps:** update dependency es-toolkit to v1.51.0 ([#1972](https://github.com/doxynix/doxynix/issues/1972)) ([55d61dc](https://github.com/doxynix/doxynix/commit/55d61dc8d558bd0fa066a2bb61a30e710230a993))
* **deps:** update dependency fast-xml-parser to v5.11.0 ([#1968](https://github.com/doxynix/doxynix/issues/1968)) ([41ed567](https://github.com/doxynix/doxynix/commit/41ed567e9fdd93f484f17ee0681947fda64f78db))
* **deps:** update dependency hono to v4.13.2 ([#1938](https://github.com/doxynix/doxynix/issues/1938)) ([da5cf45](https://github.com/doxynix/doxynix/commit/da5cf45cbffad4f96a5a045f9f9720e1bb3225b0))
* **deps:** update dependency hono to v4.13.3 ([#1992](https://github.com/doxynix/doxynix/issues/1992)) ([c89c510](https://github.com/doxynix/doxynix/commit/c89c5101c24505197ace81f656c84b929a9d46a1))
* **deps:** update dependency html-react-parser to v6.1.7 ([#1941](https://github.com/doxynix/doxynix/issues/1941)) ([452eaee](https://github.com/doxynix/doxynix/commit/452eaee2f319565f441648d1bcad1ebbdfeb78e5))
* **deps:** update dependency input-otp to v1.5.0 ([#1998](https://github.com/doxynix/doxynix/issues/1998)) ([320da0b](https://github.com/doxynix/doxynix/commit/320da0b2629825734c81fbd16315b5154abd8972))
* **deps:** update dependency ipaddr.js to v2.4.0 ([#1410](https://github.com/doxynix/doxynix/issues/1410)) ([cb338bb](https://github.com/doxynix/doxynix/commit/cb338bb1009eb74c4e4479cdb0bb3bd2243bb48b))
* **deps:** update dependency js-cookie to v3.0.7 [security] ([#1446](https://github.com/doxynix/doxynix/issues/1446)) ([911041e](https://github.com/doxynix/doxynix/commit/911041e2c7f29e3bdee72beeb9233b72235915c0))
* **deps:** update dependency langsmith to v0.5.22 ([#1222](https://github.com/doxynix/doxynix/issues/1222)) ([5df46c7](https://github.com/doxynix/doxynix/commit/5df46c761a946619ac8d0df181e35cd4fef2ad51))
* **deps:** update dependency langsmith to v0.5.23 ([#1241](https://github.com/doxynix/doxynix/issues/1241)) ([8f54eb1](https://github.com/doxynix/doxynix/commit/8f54eb1c452931ed8bfcbfd2c195e88ff1d9eaa7))
* **deps:** update dependency langsmith to v0.6.0 ([#1369](https://github.com/doxynix/doxynix/issues/1369)) ([7032f97](https://github.com/doxynix/doxynix/commit/7032f97e1f3354b2ce16988fbacc83c55d83794e))
* **deps:** update dependency langsmith to v0.8.10 ([#1917](https://github.com/doxynix/doxynix/issues/1917)) ([bf69b56](https://github.com/doxynix/doxynix/commit/bf69b56ce08532d1f02e89478fbe25512e4bbc5a))
* **deps:** update dependency langsmith to v0.8.11 ([#1958](https://github.com/doxynix/doxynix/issues/1958)) ([3a156ae](https://github.com/doxynix/doxynix/commit/3a156aeccec011c4a9cf056359bf30eee8c4fe3d))
* **deps:** update dependency langsmith to v0.9.0 ([#2018](https://github.com/doxynix/doxynix/issues/2018)) ([f592dbb](https://github.com/doxynix/doxynix/commit/f592dbba93c0e0d58cba514fda5b5e6510cac611))
* **deps:** update dependency lucide-react to v1.32.0 ([#2001](https://github.com/doxynix/doxynix/issues/2001)) ([68cc8a1](https://github.com/doxynix/doxynix/commit/68cc8a138d6ef8ea4a5094f938b6e72d5fcbbb2f))
* **deps:** update dependency lucide-react to v1.33.0 ([#2006](https://github.com/doxynix/doxynix/issues/2006)) ([97f950c](https://github.com/doxynix/doxynix/commit/97f950c985ab13f54890d1c591e6972d9b5c7b38))
* **deps:** update dependency marked to v18.0.10 ([#1984](https://github.com/doxynix/doxynix/issues/1984)) ([4bee701](https://github.com/doxynix/doxynix/commit/4bee701993ab824b6c0a72d02f7e5e0eb8c9fbf2))
* **deps:** update dependency mermaid to v11.17.0 ([#2004](https://github.com/doxynix/doxynix/issues/2004)) ([7cd1fe7](https://github.com/doxynix/doxynix/commit/7cd1fe7449fd8262afe8a28540841ab32a148233))
* **deps:** update dependency next-intl to v4.13.6 ([#1882](https://github.com/doxynix/doxynix/issues/1882)) ([3c90e5f](https://github.com/doxynix/doxynix/commit/3c90e5f09d679d7c124ea8d0931e820f30b13ee9))
* **deps:** update dependency next-intl to v4.13.7 ([#1975](https://github.com/doxynix/doxynix/issues/1975)) ([8f146f1](https://github.com/doxynix/doxynix/commit/8f146f1a8f167e891ad832ede809a8d8f39880c0))
* **deps:** update dependency next-intl to v4.9.1 [security] ([#1021](https://github.com/doxynix/doxynix/issues/1021)) ([ed076d8](https://github.com/doxynix/doxynix/commit/ed076d8142460fc6c2fd220b01d7814ca3f8ba25))
* **deps:** update dependency nuqs to v2.10.0 ([#2036](https://github.com/doxynix/doxynix/issues/2036)) ([964e2b5](https://github.com/doxynix/doxynix/commit/964e2b5948919de597d1be9b08b0a72202060b31))
* **deps:** update dependency nuqs to v2.9.6 ([#1976](https://github.com/doxynix/doxynix/issues/1976)) ([be5b0db](https://github.com/doxynix/doxynix/commit/be5b0dbb9548f0f664bf33e27f743dead3a06c54))
* **deps:** update dependency posthog-js to v1.368.2 ([#1120](https://github.com/doxynix/doxynix/issues/1120)) ([5500e93](https://github.com/doxynix/doxynix/commit/5500e93d4b1246fadf5c1bb8493c29216f17ae51))
* **deps:** update dependency posthog-js to v1.369.4 ([#1194](https://github.com/doxynix/doxynix/issues/1194)) ([b3e88f3](https://github.com/doxynix/doxynix/commit/b3e88f371d8ff03d0895281c30de3da69e093d51))
* **deps:** update dependency posthog-js to v1.370.1 ([#1218](https://github.com/doxynix/doxynix/issues/1218)) ([67f7cd3](https://github.com/doxynix/doxynix/commit/67f7cd3543b6bda454093fce918e52e02ef8a352))
* **deps:** update dependency posthog-js to v1.415.1 ([#1889](https://github.com/doxynix/doxynix/issues/1889)) ([5acf5c2](https://github.com/doxynix/doxynix/commit/5acf5c29bc9f635b2d2adbe8e29ce9258d5b0805))
* **deps:** update dependency posthog-js to v1.415.4 ([#1903](https://github.com/doxynix/doxynix/issues/1903)) ([fe3624e](https://github.com/doxynix/doxynix/commit/fe3624edbd4d6f9f9a52122e162653dbbbf7b349))
* **deps:** update dependency posthog-js to v1.415.6 ([#1911](https://github.com/doxynix/doxynix/issues/1911)) ([25737d1](https://github.com/doxynix/doxynix/commit/25737d1c35be268a30be0286d4f9ec0fa1b722a2))
* **deps:** update dependency posthog-js to v1.415.7 ([#1915](https://github.com/doxynix/doxynix/issues/1915)) ([171204f](https://github.com/doxynix/doxynix/commit/171204fbda759fb86344f8565868798b137049d0))
* **deps:** update dependency posthog-js to v1.416.0 ([#1919](https://github.com/doxynix/doxynix/issues/1919)) ([e2a2c38](https://github.com/doxynix/doxynix/commit/e2a2c388b431b027785e25143af2ba4ca1ace807))
* **deps:** update dependency posthog-js to v1.416.1 ([#1939](https://github.com/doxynix/doxynix/issues/1939)) ([e332a6f](https://github.com/doxynix/doxynix/commit/e332a6f72469ca9f77761dcc0ac0d4a43b453205))
* **deps:** update dependency posthog-js to v1.417.0 ([#1949](https://github.com/doxynix/doxynix/issues/1949)) ([a1e3a28](https://github.com/doxynix/doxynix/commit/a1e3a28e40dd8d84c0f03c50b4aaeb623070b146))
* **deps:** update dependency posthog-js to v1.417.1 ([#1961](https://github.com/doxynix/doxynix/issues/1961)) ([6561928](https://github.com/doxynix/doxynix/commit/6561928506720f95266c95d880d08cd48a4d4f13))
* **deps:** update dependency posthog-js to v1.417.2 ([#1978](https://github.com/doxynix/doxynix/issues/1978)) ([974f5cf](https://github.com/doxynix/doxynix/commit/974f5cf0261b26af3cf143d7682f6416fb92cf5c))
* **deps:** update dependency posthog-js to v1.417.4 ([#1981](https://github.com/doxynix/doxynix/issues/1981)) ([ba7c1ac](https://github.com/doxynix/doxynix/commit/ba7c1ac827152e3282b2bf7bbdf393a9d827676a))
* **deps:** update dependency posthog-js to v1.418.1 ([#2002](https://github.com/doxynix/doxynix/issues/2002)) ([742d82a](https://github.com/doxynix/doxynix/commit/742d82a72ebbb2b24b9451ad758f35be87ce8a93))
* **deps:** update dependency posthog-js to v1.418.10 ([#2030](https://github.com/doxynix/doxynix/issues/2030)) ([d779bef](https://github.com/doxynix/doxynix/commit/d779bef64e9a16149dc5bb8b22b7c697a4acd9f0))
* **deps:** update dependency posthog-js to v1.418.5 ([#2013](https://github.com/doxynix/doxynix/issues/2013)) ([f71ab3d](https://github.com/doxynix/doxynix/commit/f71ab3d70db97715221489b7a9ab58c2e520ae4e))
* **deps:** update dependency posthog-js to v1.418.7 ([#2028](https://github.com/doxynix/doxynix/issues/2028)) ([3a75c95](https://github.com/doxynix/doxynix/commit/3a75c951410b7532f92d4ddd21798b0c7ede9b09))
* **deps:** update dependency posthog-node to v5.48.2 ([#1920](https://github.com/doxynix/doxynix/issues/1920)) ([c154c4f](https://github.com/doxynix/doxynix/commit/c154c4f2bfa33ffbc1a919bc8e1c966b75a2f3dc))
* **deps:** update dependency posthog-node to v5.49.1 ([#1950](https://github.com/doxynix/doxynix/issues/1950)) ([dc10323](https://github.com/doxynix/doxynix/commit/dc10323d9203d9ca5606c7c27dc05e2310c19e1d))
* **deps:** update dependency posthog-node to v5.50.0 ([#2037](https://github.com/doxynix/doxynix/issues/2037)) ([d74fd09](https://github.com/doxynix/doxynix/commit/d74fd093e89143b1deb9e6b5f20b0a6a3fddb5d1))
* **deps:** update dependency react-hook-form to v7.86.0 ([#2039](https://github.com/doxynix/doxynix/issues/2039)) ([445f390](https://github.com/doxynix/doxynix/commit/445f390018d2a34bfbe4014820dc42bbd5ff322b))
* **deps:** update dependency react-resizable-panels to v4.12.3 ([#1970](https://github.com/doxynix/doxynix/issues/1970)) ([473cb3d](https://github.com/doxynix/doxynix/commit/473cb3dd4bc004a138912dc0299f5320c820b51e))
* **deps:** update dependency react-resizable-panels to v4.8.0 ([#842](https://github.com/doxynix/doxynix/issues/842)) ([246b7ef](https://github.com/doxynix/doxynix/commit/246b7efb3c10ad2b3482dc7240347bf1cc04ab29))
* **deps:** update dependency resend to v6.19.0 ([#1918](https://github.com/doxynix/doxynix/issues/1918)) ([461d1b2](https://github.com/doxynix/doxynix/commit/461d1b24ba65e8ac937c2eaedd9b237c9123a5e6))
* **deps:** update dependency resend to v6.20.0 ([#1965](https://github.com/doxynix/doxynix/issues/1965)) ([4d04ecf](https://github.com/doxynix/doxynix/commit/4d04ecf494f78b92d02dd10def51e89521c1bb4d))
* **deps:** update dependency resend to v6.22.0 ([#2040](https://github.com/doxynix/doxynix/issues/2040)) ([624696e](https://github.com/doxynix/doxynix/commit/624696e07f274eb65a63e024d096f241a0154ea1))
* **deps:** update dependency simple-git to v3.35.1 ([#997](https://github.com/doxynix/doxynix/issues/997)) ([9a1a107](https://github.com/doxynix/doxynix/commit/9a1a107214868837a706401c3b4c01a94f2c6f54))
* **deps:** update dependency use-debounce to v10.1.1 ([#866](https://github.com/doxynix/doxynix/issues/866)) ([a339940](https://github.com/doxynix/doxynix/commit/a3399409b737e948c1570bf0350c3751fcfea3a3))
* **deps:** update dependency yaml to v2.8.4 ([#1389](https://github.com/doxynix/doxynix/issues/1389)) ([234e5c3](https://github.com/doxynix/doxynix/commit/234e5c335558857d3a43eec1ae1875cdf88a38ca))
* **deps:** update dependency zod to v4.4.1 ([#1351](https://github.com/doxynix/doxynix/issues/1351)) ([8a5718f](https://github.com/doxynix/doxynix/commit/8a5718f30e7b7f9d1f9000d28cc02979bfff1754))
* **deps:** update dependency zustand to v5.0.15 ([#1930](https://github.com/doxynix/doxynix/issues/1930)) ([d86be4f](https://github.com/doxynix/doxynix/commit/d86be4f1d0c1a99e56747dbd19a2ab13420027fa))
* **deps:** update nextjs monorepo to v16.3.1 ([#1966](https://github.com/doxynix/doxynix/issues/1966)) ([b53adb5](https://github.com/doxynix/doxynix/commit/b53adb51a0f38272a487c82a5ad27e39fb880b40))
* **deps:** update nextjs monorepo to v16.3.2 ([#2031](https://github.com/doxynix/doxynix/issues/2031)) ([11bf2b4](https://github.com/doxynix/doxynix/commit/11bf2b4ebc942bba63b792c3655fb303bd4f934f))
* **deps:** update octokit monorepo ([#1890](https://github.com/doxynix/doxynix/issues/1890)) ([378c660](https://github.com/doxynix/doxynix/commit/378c660eb09d95458290486ce4b0a4bdee4836d0))
* **deps:** update octokit monorepo (major) ([#1923](https://github.com/doxynix/doxynix/issues/1923)) ([dfe7405](https://github.com/doxynix/doxynix/commit/dfe7405265067eb6a72c081fc9693f03351ebac4))
* **deps:** update radix-ui-primitives monorepo ([#1883](https://github.com/doxynix/doxynix/issues/1883)) ([efc309a](https://github.com/doxynix/doxynix/commit/efc309a8ca502fe1e935feb4f85e82028cd96746))
* **deps:** update react monorepo ([#1884](https://github.com/doxynix/doxynix/issues/1884)) ([6b603f3](https://github.com/doxynix/doxynix/commit/6b603f3a6f854ccff7cf2eb9061e535635a2cba8))
* **deps:** update scalar monorepo ([#1886](https://github.com/doxynix/doxynix/issues/1886)) ([b8eb980](https://github.com/doxynix/doxynix/commit/b8eb98061c821e5949b50fd6568b73751c217397))
* **deps:** update scalar monorepo ([#1934](https://github.com/doxynix/doxynix/issues/1934)) ([dd4bd10](https://github.com/doxynix/doxynix/commit/dd4bd103ce6e9318e249f6d0813f2c82496efe4f))
* **deps:** update scalar monorepo ([#2032](https://github.com/doxynix/doxynix/issues/2032)) ([56eef68](https://github.com/doxynix/doxynix/commit/56eef680e2aa89569d58b3b453477dfec0f5ec30))
* **deps:** update secretlint monorepo to v12 (major) ([#1165](https://github.com/doxynix/doxynix/issues/1165)) ([3f852c7](https://github.com/doxynix/doxynix/commit/3f852c7efbebf355bb9bb3f1e68ba79dabae6490))
* **deps:** update shiki monorepo to v4.4.3 ([#1921](https://github.com/doxynix/doxynix/issues/1921)) ([7b094c2](https://github.com/doxynix/doxynix/commit/7b094c2b2b52d7affc631bcb84b810e3d7c6b48d))
* **deps:** update tanstack-router monorepo ([#1887](https://github.com/doxynix/doxynix/issues/1887)) ([82ed845](https://github.com/doxynix/doxynix/commit/82ed84560555eb3312c2cbf3406d22aa0eddd131))
* **deps:** update tanstack-router monorepo ([#1916](https://github.com/doxynix/doxynix/issues/1916)) ([ed5e07d](https://github.com/doxynix/doxynix/commit/ed5e07d885bac82016b6fb182e99d9bc63527315))
* **deps:** update tanstack-router monorepo ([#1962](https://github.com/doxynix/doxynix/issues/1962)) ([2b899c4](https://github.com/doxynix/doxynix/commit/2b899c436c46342ff91ac7de4ddb06b4d288bde5))
* **deps:** update tanstack-router monorepo ([#1997](https://github.com/doxynix/doxynix/issues/1997)) ([3eebb07](https://github.com/doxynix/doxynix/commit/3eebb077e2172617cb8c9187f369cd904c9e04bd))
* **deps:** update tanstack-router monorepo ([#2005](https://github.com/doxynix/doxynix/issues/2005)) ([950cdca](https://github.com/doxynix/doxynix/commit/950cdca215b78ccda140a62659f92853086a1567))
* downgrade uuid to v11 for CommonJS support ([#1491](https://github.com/doxynix/doxynix/issues/1491)) ([3c3c373](https://github.com/doxynix/doxynix/commit/3c3c373e77bdb05a05e88d5f56c3ca28bdd53bd8))
* **security:** исправление уязвимостей в пакетах lodash, lodash-es, defu (wip) ([#914](https://github.com/doxynix/doxynix/issues/914)) ([4d3ecc2](https://github.com/doxynix/doxynix/commit/4d3ecc2747a1eae3d4394e1336e2146993117a0d))
* **security:** исправление уязвимости в пакете unhead ([#1039](https://github.com/doxynix/doxynix/issues/1039)) ([0c1f045](https://github.com/doxynix/doxynix/commit/0c1f0454ce43012fd73b46d66dc0921092491ce1))
* **security:** устранение уязвимостей в пакетах next, mermaid, postcss ([#1420](https://github.com/doxynix/doxynix/issues/1420)) ([79aa50d](https://github.com/doxynix/doxynix/commit/79aa50d1c7b2e166862617884a95ef7b4d4fcf12))
* **security:** устранение уязвимости в пакете basic-ftp ([#1122](https://github.com/doxynix/doxynix/issues/1122)) ([5d30853](https://github.com/doxynix/doxynix/commit/5d30853b1e678cf301481de939133a817ce527e1))
* **web:** stabilize Next.js build and runtime configuration (DXNX-208) ([#2044](https://github.com/doxynix/doxynix/issues/2044)) ([391e81f](https://github.com/doxynix/doxynix/commit/391e81fb5d5e50a302ba6da751e79be6c1762356))
* исправление ошибки билда на vercel  ([#1289](https://github.com/doxynix/doxynix/issues/1289)) ([98fba2a](https://github.com/doxynix/doxynix/commit/98fba2a6563827ace19c652c6202bfe91db1b81f))
* фикс деплоя на trigger.dev ([#1293](https://github.com/doxynix/doxynix/issues/1293)) ([926e846](https://github.com/doxynix/doxynix/commit/926e846e4b727630a88fab7035e576bbd78144ea))
* фикс деплоя на trigger.dev ([#1453](https://github.com/doxynix/doxynix/issues/1453)) ([39ac2d3](https://github.com/doxynix/doxynix/commit/39ac2d3b7f874ee787b7816cf2c76362c1eac7f3))


### Performance Improvements

* **app:** оптимизация размера бандла  ([#1070](https://github.com/doxynix/doxynix/issues/1070)) ([3d09ec0](https://github.com/doxynix/doxynix/commit/3d09ec05fcc89d466a90ac3b0fdcb54a32b0409c))
* **app:** оптимизирован proxy.ts, убраны не нужные операции ([#850](https://github.com/doxynix/doxynix/issues/850)) ([48a91a2](https://github.com/doxynix/doxynix/commit/48a91a23a390009eedfdfe0f72ebf52e1d6837f5))


### Code Refactoring

* birth of the monorepo (DXNX-198) ([#1524](https://github.com/doxynix/doxynix/issues/1524)) ([b95df97](https://github.com/doxynix/doxynix/commit/b95df975c5860360e50fe1950deb822a9af507c3))

## [3.1.0](https://github.com/doxynix/doxynix/compare/v3.0.19...v3.1.0) (2026-08-24)


### Features

* **web:** migrate to vercel blob and extract core services (DXNX-205) ([#1951](https://github.com/doxynix/doxynix/issues/1951)) ([3d09f3e](https://github.com/doxynix/doxynix/commit/3d09f3e01a91c0e2a1f325027b3bd9df318bd9dd))


### Bug Fixes

* **deps:** update dependency [@trigger](https://github.com/trigger).dev/react-hooks to v4.5.12 ([#2021](https://github.com/doxynix/doxynix/issues/2021)) ([a55fd2a](https://github.com/doxynix/doxynix/commit/a55fd2abcb32f3c74ba6539bfb21461d56601101))
* **deps:** update dependency [@trigger](https://github.com/trigger).dev/sdk to v4.5.12 ([#2022](https://github.com/doxynix/doxynix/issues/2022)) ([d99f09f](https://github.com/doxynix/doxynix/commit/d99f09f9346adcc98bfeab39baf53334df4c588a))
* **deps:** update dependency @ai-sdk/google to v3.0.111 ([#2024](https://github.com/doxynix/doxynix/issues/2024)) ([b7857b9](https://github.com/doxynix/doxynix/commit/b7857b9e34f7d73019b5acf8bac11f31dbc5aed2))
* **deps:** update dependency @ai-sdk/react to v3.0.264 ([#2026](https://github.com/doxynix/doxynix/issues/2026)) ([9576431](https://github.com/doxynix/doxynix/commit/9576431ff7b197a783cb818f144ca0819429c01f))

## [3.0.19](https://github.com/doxynix/doxynix/compare/v3.0.18...v3.0.19) (2026-08-23)


### Bug Fixes

* **deps:** update dependency langsmith to v0.9.0 ([#2018](https://github.com/doxynix/doxynix/issues/2018)) ([f592dbb](https://github.com/doxynix/doxynix/commit/f592dbba93c0e0d58cba514fda5b5e6510cac611))

## [3.0.18](https://github.com/doxynix/doxynix/compare/v3.0.17...v3.0.18) (2026-08-23)


### Bug Fixes

* **deps:** update dependency @ai-sdk/react to v3.0.262 ([#2010](https://github.com/doxynix/doxynix/issues/2010)) ([1b68371](https://github.com/doxynix/doxynix/commit/1b68371836a925c080e908f0c6abaeeb52d9903d))
* **deps:** update dependency posthog-js to v1.418.5 ([#2013](https://github.com/doxynix/doxynix/issues/2013)) ([f71ab3d](https://github.com/doxynix/doxynix/commit/f71ab3d70db97715221489b7a9ab58c2e520ae4e))

## [3.0.17](https://github.com/doxynix/doxynix/compare/v3.0.16...v3.0.17) (2026-08-22)


### Bug Fixes

* **deps:** update dependency @ai-sdk/openai to v3.0.98 ([#2009](https://github.com/doxynix/doxynix/issues/2009)) ([7a4228d](https://github.com/doxynix/doxynix/commit/7a4228d2c63bc3a5e7029dffe78fe5a19cdb6373))
* **deps:** update dependency ai to v6.0.259 ([#2011](https://github.com/doxynix/doxynix/issues/2011)) ([9706533](https://github.com/doxynix/doxynix/commit/97065336a3c37878f9b88adb39550d02edd9e6fd))

## [3.0.16](https://github.com/doxynix/doxynix/compare/v3.0.15...v3.0.16) (2026-08-22)


### Bug Fixes

* **deps:** update dependency lucide-react to v1.33.0 ([#2006](https://github.com/doxynix/doxynix/issues/2006)) ([97f950c](https://github.com/doxynix/doxynix/commit/97f950c985ab13f54890d1c591e6972d9b5c7b38))
* **deps:** update tanstack-router monorepo ([#2005](https://github.com/doxynix/doxynix/issues/2005)) ([950cdca](https://github.com/doxynix/doxynix/commit/950cdca215b78ccda140a62659f92853086a1567))

## [3.0.15](https://github.com/doxynix/doxynix/compare/v3.0.14...v3.0.15) (2026-08-22)


### Bug Fixes

* **deps:** update dependency ai to v6.0.258 ([#1996](https://github.com/doxynix/doxynix/issues/1996)) ([6ad4846](https://github.com/doxynix/doxynix/commit/6ad48461e2d3363e8a9cc18ea7621e2005e0376b))
* **deps:** update dependency lucide-react to v1.32.0 ([#2001](https://github.com/doxynix/doxynix/issues/2001)) ([68cc8a1](https://github.com/doxynix/doxynix/commit/68cc8a138d6ef8ea4a5094f938b6e72d5fcbbb2f))
* **deps:** update dependency mermaid to v11.17.0 ([#2004](https://github.com/doxynix/doxynix/issues/2004)) ([7cd1fe7](https://github.com/doxynix/doxynix/commit/7cd1fe7449fd8262afe8a28540841ab32a148233))
* **deps:** update dependency posthog-js to v1.418.1 ([#2002](https://github.com/doxynix/doxynix/issues/2002)) ([742d82a](https://github.com/doxynix/doxynix/commit/742d82a72ebbb2b24b9451ad758f35be87ce8a93))

## [3.0.14](https://github.com/doxynix/doxynix/compare/v3.0.13...v3.0.14) (2026-08-21)


### Bug Fixes

* **deps:** update dependency @ai-sdk/react to v3.0.261 ([#1995](https://github.com/doxynix/doxynix/issues/1995)) ([e5ec049](https://github.com/doxynix/doxynix/commit/e5ec0498b7ec8f0b48c691fc3350a5b30eaf7af7))
* **deps:** update dependency input-otp to v1.5.0 ([#1998](https://github.com/doxynix/doxynix/issues/1998)) ([320da0b](https://github.com/doxynix/doxynix/commit/320da0b2629825734c81fbd16315b5154abd8972))
* **deps:** update tanstack-router monorepo ([#1997](https://github.com/doxynix/doxynix/issues/1997)) ([3eebb07](https://github.com/doxynix/doxynix/commit/3eebb077e2172617cb8c9187f369cd904c9e04bd))

## [3.0.13](https://github.com/doxynix/doxynix/compare/v3.0.12...v3.0.13) (2026-08-21)


### Bug Fixes

* **deps:** update dependency ai to v6.0.257 ([#1988](https://github.com/doxynix/doxynix/issues/1988)) ([e86328e](https://github.com/doxynix/doxynix/commit/e86328ed01da5185eb667f306085c3504c4ced65))

## [3.0.12](https://github.com/doxynix/doxynix/compare/v3.0.11...v3.0.12) (2026-08-21)


### Bug Fixes

* **deps:** update dependency hono to v4.13.3 ([#1992](https://github.com/doxynix/doxynix/issues/1992)) ([c89c510](https://github.com/doxynix/doxynix/commit/c89c5101c24505197ace81f656c84b929a9d46a1))

## [3.0.11](https://github.com/doxynix/doxynix/compare/v3.0.10...v3.0.11) (2026-08-21)


### Bug Fixes

* **deps:** update dependency @ai-sdk/react to v3.0.260 ([#1987](https://github.com/doxynix/doxynix/issues/1987)) ([ea045ce](https://github.com/doxynix/doxynix/commit/ea045cefa05e99e08504f6eecb97cf1db7c75f31))

## [3.0.10](https://github.com/doxynix/doxynix/compare/v3.0.9...v3.0.10) (2026-08-21)


### Bug Fixes

* **deps:** update dependency marked to v18.0.10 ([#1984](https://github.com/doxynix/doxynix/issues/1984)) ([4bee701](https://github.com/doxynix/doxynix/commit/4bee701993ab824b6c0a72d02f7e5e0eb8c9fbf2))

## [3.0.9](https://github.com/doxynix/doxynix/compare/v3.0.8...v3.0.9) (2026-08-20)


### Bug Fixes

* **deps:** update better-auth monorepo to v1.6.30 ([#1980](https://github.com/doxynix/doxynix/issues/1980)) ([6c632f5](https://github.com/doxynix/doxynix/commit/6c632f589ca70d30f24b622cae7631c57f99ca70))
* **deps:** update dependency posthog-js to v1.417.4 ([#1981](https://github.com/doxynix/doxynix/issues/1981)) ([ba7c1ac](https://github.com/doxynix/doxynix/commit/ba7c1ac827152e3282b2bf7bbdf393a9d827676a))

## [3.0.8](https://github.com/doxynix/doxynix/compare/v3.0.7...v3.0.8) (2026-08-20)


### Bug Fixes

* **deps:** update codemirror ([#1969](https://github.com/doxynix/doxynix/issues/1969)) ([e352dbe](https://github.com/doxynix/doxynix/commit/e352dbe96793139e7f7c62e77bed34393b60e401))
* **deps:** update dependency posthog-js to v1.417.2 ([#1978](https://github.com/doxynix/doxynix/issues/1978)) ([974f5cf](https://github.com/doxynix/doxynix/commit/974f5cf0261b26af3cf143d7682f6416fb92cf5c))
* **deps:** update react monorepo ([#1884](https://github.com/doxynix/doxynix/issues/1884)) ([6b603f3](https://github.com/doxynix/doxynix/commit/6b603f3a6f854ccff7cf2eb9061e535635a2cba8))

## [3.0.7](https://github.com/doxynix/doxynix/compare/v3.0.6...v3.0.7) (2026-08-20)


### Bug Fixes

* **deps:** update dependency @hookform/resolvers to v5.9.1 ([#1974](https://github.com/doxynix/doxynix/issues/1974)) ([9e1cb9d](https://github.com/doxynix/doxynix/commit/9e1cb9d108b31cb23984fa565b267a15d234c872))
* **deps:** update dependency next-intl to v4.13.7 ([#1975](https://github.com/doxynix/doxynix/issues/1975)) ([8f146f1](https://github.com/doxynix/doxynix/commit/8f146f1a8f167e891ad832ede809a8d8f39880c0))
* **deps:** update dependency nuqs to v2.9.6 ([#1976](https://github.com/doxynix/doxynix/issues/1976)) ([be5b0db](https://github.com/doxynix/doxynix/commit/be5b0dbb9548f0f664bf33e27f743dead3a06c54))

## [3.0.6](https://github.com/doxynix/doxynix/compare/v3.0.5...v3.0.6) (2026-08-20)


### Bug Fixes

* **deps:** update dependency es-toolkit to v1.51.0 ([#1972](https://github.com/doxynix/doxynix/issues/1972)) ([55d61dc](https://github.com/doxynix/doxynix/commit/55d61dc8d558bd0fa066a2bb61a30e710230a993))

## [3.0.5](https://github.com/doxynix/doxynix/compare/v3.0.4...v3.0.5) (2026-08-19)


### Bug Fixes

* **deps:** update dependency react-resizable-panels to v4.12.3 ([#1970](https://github.com/doxynix/doxynix/issues/1970)) ([473cb3d](https://github.com/doxynix/doxynix/commit/473cb3dd4bc004a138912dc0299f5320c820b51e))

## [3.0.4](https://github.com/doxynix/doxynix/compare/v3.0.3...v3.0.4) (2026-08-19)


### Bug Fixes

* **deps:** update dependency @ai-sdk/openai to v3.0.97 ([#1956](https://github.com/doxynix/doxynix/issues/1956)) ([6ab89af](https://github.com/doxynix/doxynix/commit/6ab89afc388c664a8725b04c4ccffea1dc46237e))
* **deps:** update dependency @ai-sdk/react to v3.0.259 ([#1947](https://github.com/doxynix/doxynix/issues/1947)) ([20208e1](https://github.com/doxynix/doxynix/commit/20208e14a1ad72f90434b5d80e4cb0f7907cd03b))
* **deps:** update dependency @hookform/resolvers to v5.9.0 ([#1964](https://github.com/doxynix/doxynix/issues/1964)) ([24dc4c2](https://github.com/doxynix/doxynix/commit/24dc4c2fec94c1d68b3ef7e9869104cacdf77519))
* **deps:** update dependency ai to v6.0.256 ([#1957](https://github.com/doxynix/doxynix/issues/1957)) ([193cdbd](https://github.com/doxynix/doxynix/commit/193cdbd28444a2b34ac3bc81395a4631a445ca1d))
* **deps:** update dependency fast-xml-parser to v5.11.0 ([#1968](https://github.com/doxynix/doxynix/issues/1968)) ([41ed567](https://github.com/doxynix/doxynix/commit/41ed567e9fdd93f484f17ee0681947fda64f78db))
* **deps:** update dependency posthog-js to v1.417.1 ([#1961](https://github.com/doxynix/doxynix/issues/1961)) ([6561928](https://github.com/doxynix/doxynix/commit/6561928506720f95266c95d880d08cd48a4d4f13))
* **deps:** update dependency resend to v6.20.0 ([#1965](https://github.com/doxynix/doxynix/issues/1965)) ([4d04ecf](https://github.com/doxynix/doxynix/commit/4d04ecf494f78b92d02dd10def51e89521c1bb4d))
* **deps:** update nextjs monorepo to v16.3.1 ([#1966](https://github.com/doxynix/doxynix/issues/1966)) ([b53adb5](https://github.com/doxynix/doxynix/commit/b53adb51a0f38272a487c82a5ad27e39fb880b40))
* **deps:** update tanstack-router monorepo ([#1962](https://github.com/doxynix/doxynix/issues/1962)) ([2b899c4](https://github.com/doxynix/doxynix/commit/2b899c436c46342ff91ac7de4ddb06b4d288bde5))

## [3.0.3](https://github.com/doxynix/doxynix/compare/v3.0.2...v3.0.3) (2026-08-18)


### Bug Fixes

* **deps:** update dependency @ai-sdk/groq to v3.0.60 ([#1955](https://github.com/doxynix/doxynix/issues/1955)) ([c9be280](https://github.com/doxynix/doxynix/commit/c9be280fe25a988a4da86a66b758e9352de5bc2a))
* **deps:** update dependency langsmith to v0.8.11 ([#1958](https://github.com/doxynix/doxynix/issues/1958)) ([3a156ae](https://github.com/doxynix/doxynix/commit/3a156aeccec011c4a9cf056359bf30eee8c4fe3d))

## [3.0.2](https://github.com/doxynix/doxynix/compare/v3.0.1...v3.0.2) (2026-08-17)


### Bug Fixes

* **deps:** update better-auth monorepo to v1.6.27 ([#1907](https://github.com/doxynix/doxynix/issues/1907)) ([11b94a0](https://github.com/doxynix/doxynix/commit/11b94a0e0e815141399799c5cf08c8170205480a))
* **deps:** update better-auth monorepo to v1.6.28 ([#1943](https://github.com/doxynix/doxynix/issues/1943)) ([3b1208d](https://github.com/doxynix/doxynix/commit/3b1208d1ce4ee23dec97294d0218e80906705a1e))
* **deps:** update better-auth monorepo to v1.6.29 ([#1953](https://github.com/doxynix/doxynix/issues/1953)) ([aef2e32](https://github.com/doxynix/doxynix/commit/aef2e32232d513db81efc228dd4f712194f961e2))
* **deps:** update dependency [@trigger](https://github.com/trigger).dev/react-hooks to v4.5.11 ([#1936](https://github.com/doxynix/doxynix/issues/1936)) ([adb2898](https://github.com/doxynix/doxynix/commit/adb2898c04126565976d7e15a3bef2ea292d4ab0))
* **deps:** update dependency [@trigger](https://github.com/trigger).dev/sdk to v4.5.11 ([#1937](https://github.com/doxynix/doxynix/issues/1937)) ([67a59c6](https://github.com/doxynix/doxynix/commit/67a59c6f072609b29c7b5c4eb6cdc1068913827e))
* **deps:** update dependency @ai-sdk/google to v3.0.106 ([#1899](https://github.com/doxynix/doxynix/issues/1899)) ([7ede586](https://github.com/doxynix/doxynix/commit/7ede5866c33f3f77a73239a6083601d8ff26d9cb))
* **deps:** update dependency @ai-sdk/google to v3.0.107 ([#1908](https://github.com/doxynix/doxynix/issues/1908)) ([336fd0e](https://github.com/doxynix/doxynix/commit/336fd0e9c03a3276286be4a0c2e15480a428a2bd))
* **deps:** update dependency @ai-sdk/google to v3.0.108 ([#1924](https://github.com/doxynix/doxynix/issues/1924)) ([e84298a](https://github.com/doxynix/doxynix/commit/e84298a8bddfe6a41b4380f90a62fd57c6cdcdd5))
* **deps:** update dependency @ai-sdk/google to v3.0.109 ([#1946](https://github.com/doxynix/doxynix/issues/1946)) ([f00caeb](https://github.com/doxynix/doxynix/commit/f00caebdd6abfafa8ef275a1a352bc6ed77cf149))
* **deps:** update dependency @ai-sdk/google to v3.0.110 ([#1954](https://github.com/doxynix/doxynix/issues/1954)) ([06ffb1c](https://github.com/doxynix/doxynix/commit/06ffb1cc02732c8305b6afcbd5540679273a8491))
* **deps:** update dependency @ai-sdk/groq to v3.0.59 ([#1900](https://github.com/doxynix/doxynix/issues/1900)) ([d3931e3](https://github.com/doxynix/doxynix/commit/d3931e3ad541fe7c678411912c2f2250f9e07709))
* **deps:** update dependency @ai-sdk/openai to v3.0.93 ([#1893](https://github.com/doxynix/doxynix/issues/1893)) ([2a4c3aa](https://github.com/doxynix/doxynix/commit/2a4c3aa5cc81b510ff23047b940f44e12294a322))
* **deps:** update dependency @ai-sdk/openai to v3.0.94 ([#1909](https://github.com/doxynix/doxynix/issues/1909)) ([4e6d30f](https://github.com/doxynix/doxynix/commit/4e6d30f65b81072d24d0b1e24d5b6b27cf53385b))
* **deps:** update dependency @ai-sdk/openai to v3.0.96 ([#1925](https://github.com/doxynix/doxynix/issues/1925)) ([aeb1b3e](https://github.com/doxynix/doxynix/commit/aeb1b3e4ce836868d3c0a730d1fc8ea5e39a7e29))
* **deps:** update dependency @ai-sdk/react to v3.0.252 ([#1901](https://github.com/doxynix/doxynix/issues/1901)) ([ce5947a](https://github.com/doxynix/doxynix/commit/ce5947aefeaca3e996482ddda5cdb54aa29b1c0a))
* **deps:** update dependency @ai-sdk/react to v3.0.256 ([#1926](https://github.com/doxynix/doxynix/issues/1926)) ([e2f5f0d](https://github.com/doxynix/doxynix/commit/e2f5f0d1330ad165c9c52ab9b0c7d35d52d84f61))
* **deps:** update dependency @hookform/resolvers to v5.8.0 ([#1945](https://github.com/doxynix/doxynix/issues/1945)) ([03af800](https://github.com/doxynix/doxynix/commit/03af800ee643dd11896b63864cef19623c3742d1))
* **deps:** update dependency @jscpd/tokenizer to v4.2.6 ([#1940](https://github.com/doxynix/doxynix/issues/1940)) ([92e9e82](https://github.com/doxynix/doxynix/commit/92e9e82ea72c277d20dab1474d12087aec6ddf10))
* **deps:** update dependency @marsidev/react-turnstile to v1.6.0 ([#1904](https://github.com/doxynix/doxynix/issues/1904)) ([43e1a93](https://github.com/doxynix/doxynix/commit/43e1a93e69bc65136ff141c0cd007fe312dfaa55))
* **deps:** update dependency @scalar/api-reference-react to v0.9.63 ([#1944](https://github.com/doxynix/doxynix/issues/1944)) ([cc52b7b](https://github.com/doxynix/doxynix/commit/cc52b7b7483f56b9f95619b9667781cc74af790c))
* **deps:** update dependency @xyflow/react to v12.11.3 ([#1914](https://github.com/doxynix/doxynix/issues/1914)) ([ac39b73](https://github.com/doxynix/doxynix/commit/ac39b73da26a3557307a2005f11c14f6f54e271a))
* **deps:** update dependency ably to v2.27.0 ([#1905](https://github.com/doxynix/doxynix/issues/1905)) ([3edfb35](https://github.com/doxynix/doxynix/commit/3edfb3575018744d550c41a839511dfdd7eeaa77))
* **deps:** update dependency ai to v6.0.248 ([#1895](https://github.com/doxynix/doxynix/issues/1895)) ([c69eb27](https://github.com/doxynix/doxynix/commit/c69eb27953594dc492f1101d1aeaded07911951a))
* **deps:** update dependency ai to v6.0.250 ([#1910](https://github.com/doxynix/doxynix/issues/1910)) ([dbe3850](https://github.com/doxynix/doxynix/commit/dbe38509838ef2f1c5a127aa9ef3cf96f00f65e5))
* **deps:** update dependency ai to v6.0.253 ([#1927](https://github.com/doxynix/doxynix/issues/1927)) ([b4b2ab0](https://github.com/doxynix/doxynix/commit/b4b2ab0ed06ae76c34bb5d390846eaf3da507fff))
* **deps:** update dependency ai to v6.0.255 ([#1948](https://github.com/doxynix/doxynix/issues/1948)) ([0d56fc9](https://github.com/doxynix/doxynix/commit/0d56fc9bb63a06c823ad0d23ad9cb873a602b713))
* **deps:** update dependency hono to v4.13.2 ([#1938](https://github.com/doxynix/doxynix/issues/1938)) ([da5cf45](https://github.com/doxynix/doxynix/commit/da5cf45cbffad4f96a5a045f9f9720e1bb3225b0))
* **deps:** update dependency html-react-parser to v6.1.7 ([#1941](https://github.com/doxynix/doxynix/issues/1941)) ([452eaee](https://github.com/doxynix/doxynix/commit/452eaee2f319565f441648d1bcad1ebbdfeb78e5))
* **deps:** update dependency langsmith to v0.8.10 ([#1917](https://github.com/doxynix/doxynix/issues/1917)) ([bf69b56](https://github.com/doxynix/doxynix/commit/bf69b56ce08532d1f02e89478fbe25512e4bbc5a))
* **deps:** update dependency posthog-js to v1.415.4 ([#1903](https://github.com/doxynix/doxynix/issues/1903)) ([fe3624e](https://github.com/doxynix/doxynix/commit/fe3624edbd4d6f9f9a52122e162653dbbbf7b349))
* **deps:** update dependency posthog-js to v1.415.6 ([#1911](https://github.com/doxynix/doxynix/issues/1911)) ([25737d1](https://github.com/doxynix/doxynix/commit/25737d1c35be268a30be0286d4f9ec0fa1b722a2))
* **deps:** update dependency posthog-js to v1.415.7 ([#1915](https://github.com/doxynix/doxynix/issues/1915)) ([171204f](https://github.com/doxynix/doxynix/commit/171204fbda759fb86344f8565868798b137049d0))
* **deps:** update dependency posthog-js to v1.416.0 ([#1919](https://github.com/doxynix/doxynix/issues/1919)) ([e2a2c38](https://github.com/doxynix/doxynix/commit/e2a2c388b431b027785e25143af2ba4ca1ace807))
* **deps:** update dependency posthog-js to v1.416.1 ([#1939](https://github.com/doxynix/doxynix/issues/1939)) ([e332a6f](https://github.com/doxynix/doxynix/commit/e332a6f72469ca9f77761dcc0ac0d4a43b453205))
* **deps:** update dependency posthog-js to v1.417.0 ([#1949](https://github.com/doxynix/doxynix/issues/1949)) ([a1e3a28](https://github.com/doxynix/doxynix/commit/a1e3a28e40dd8d84c0f03c50b4aaeb623070b146))
* **deps:** update dependency posthog-node to v5.48.2 ([#1920](https://github.com/doxynix/doxynix/issues/1920)) ([c154c4f](https://github.com/doxynix/doxynix/commit/c154c4f2bfa33ffbc1a919bc8e1c966b75a2f3dc))
* **deps:** update dependency posthog-node to v5.49.1 ([#1950](https://github.com/doxynix/doxynix/issues/1950)) ([dc10323](https://github.com/doxynix/doxynix/commit/dc10323d9203d9ca5606c7c27dc05e2310c19e1d))
* **deps:** update dependency resend to v6.19.0 ([#1918](https://github.com/doxynix/doxynix/issues/1918)) ([461d1b2](https://github.com/doxynix/doxynix/commit/461d1b24ba65e8ac937c2eaedd9b237c9123a5e6))
* **deps:** update dependency zustand to v5.0.15 ([#1930](https://github.com/doxynix/doxynix/issues/1930)) ([d86be4f](https://github.com/doxynix/doxynix/commit/d86be4f1d0c1a99e56747dbd19a2ab13420027fa))
* **deps:** update octokit monorepo (major) ([#1923](https://github.com/doxynix/doxynix/issues/1923)) ([dfe7405](https://github.com/doxynix/doxynix/commit/dfe7405265067eb6a72c081fc9693f03351ebac4))
* **deps:** update scalar monorepo ([#1934](https://github.com/doxynix/doxynix/issues/1934)) ([dd4bd10](https://github.com/doxynix/doxynix/commit/dd4bd103ce6e9318e249f6d0813f2c82496efe4f))
* **deps:** update shiki monorepo to v4.4.3 ([#1921](https://github.com/doxynix/doxynix/issues/1921)) ([7b094c2](https://github.com/doxynix/doxynix/commit/7b094c2b2b52d7affc631bcb84b810e3d7c6b48d))
* **deps:** update tanstack-router monorepo ([#1916](https://github.com/doxynix/doxynix/issues/1916)) ([ed5e07d](https://github.com/doxynix/doxynix/commit/ed5e07d885bac82016b6fb182e99d9bc63527315))

## [3.0.1](https://github.com/doxynix/doxynix/compare/v3.0.0...v3.0.1) (2026-08-14)


### Bug Fixes

* **deps:** update dependency @ai-sdk/google to v3.0.105 ([#1891](https://github.com/doxynix/doxynix/issues/1891)) ([234b880](https://github.com/doxynix/doxynix/commit/234b880ab570488014ac5451564ac663c4f2c8ff))
* **deps:** update dependency @ai-sdk/groq to v3.0.57 ([#1892](https://github.com/doxynix/doxynix/issues/1892)) ([0465a15](https://github.com/doxynix/doxynix/commit/0465a15ca7c9ebb47413e9f5b742a35ebe9fb384))
* **deps:** update dependency @ai-sdk/react to v3.0.249 ([#1894](https://github.com/doxynix/doxynix/issues/1894)) ([62d9592](https://github.com/doxynix/doxynix/commit/62d95925501b532572dd09d72792309cc9f570e5))
* **deps:** update dependency @sentry/nextjs to v10.70.0 ([#1888](https://github.com/doxynix/doxynix/issues/1888)) ([07a812a](https://github.com/doxynix/doxynix/commit/07a812a3bf0009ad1d4d07fab2e5d1b2636085bb))
* **deps:** update dependency next-intl to v4.13.6 ([#1882](https://github.com/doxynix/doxynix/issues/1882)) ([3c90e5f](https://github.com/doxynix/doxynix/commit/3c90e5f09d679d7c124ea8d0931e820f30b13ee9))
* **deps:** update dependency posthog-js to v1.415.1 ([#1889](https://github.com/doxynix/doxynix/issues/1889)) ([5acf5c2](https://github.com/doxynix/doxynix/commit/5acf5c29bc9f635b2d2adbe8e29ce9258d5b0805))
* **deps:** update octokit monorepo ([#1890](https://github.com/doxynix/doxynix/issues/1890)) ([378c660](https://github.com/doxynix/doxynix/commit/378c660eb09d95458290486ce4b0a4bdee4836d0))
* **deps:** update radix-ui-primitives monorepo ([#1883](https://github.com/doxynix/doxynix/issues/1883)) ([efc309a](https://github.com/doxynix/doxynix/commit/efc309a8ca502fe1e935feb4f85e82028cd96746))
* **deps:** update scalar monorepo ([#1886](https://github.com/doxynix/doxynix/issues/1886)) ([b8eb980](https://github.com/doxynix/doxynix/commit/b8eb98061c821e5949b50fd6568b73751c217397))
* **deps:** update tanstack-router monorepo ([#1887](https://github.com/doxynix/doxynix/issues/1887)) ([82ed845](https://github.com/doxynix/doxynix/commit/82ed84560555eb3312c2cbf3406d22aa0eddd131))

## [3.0.0](https://github.com/doxynix/doxynix/compare/v2.3.0...v3.0.0) (2026-08-11)


### ⚠ BREAKING CHANGES

* birth of the monorepo (DXNX-198) ([#1524](https://github.com/doxynix/doxynix/issues/1524))

### Features

* migrate to better-auth ([#1486](https://github.com/doxynix/doxynix/issues/1486)) ([39005a7](https://github.com/doxynix/doxynix/commit/39005a79191d36d10f026a3e0715e8f4f80a4bf7))


### Bug Fixes

* add safeguard in update hook ([#1508](https://github.com/doxynix/doxynix/issues/1508)) ([2ef89a6](https://github.com/doxynix/doxynix/commit/2ef89a666bf9e5ffe376759c6d897daeb111d779))
* delete this damn migration ([#1510](https://github.com/doxynix/doxynix/issues/1510)) ([fe935fc](https://github.com/doxynix/doxynix/commit/fe935fc7e2718a6644a3b436d05549b2bc94480d))
* **deps:** update all non-major dependencies ([#1481](https://github.com/doxynix/doxynix/issues/1481)) ([96c53ec](https://github.com/doxynix/doxynix/commit/96c53eca3e6a8e1a9089d8ecbec06bb137b23217))
* downgrade uuid to v11 for CommonJS support ([#1491](https://github.com/doxynix/doxynix/issues/1491)) ([3c3c373](https://github.com/doxynix/doxynix/commit/3c3c373e77bdb05a05e88d5f56c3ca28bdd53bd8))


### Code Refactoring

* birth of the monorepo (DXNX-198) ([#1524](https://github.com/doxynix/doxynix/issues/1524)) ([b95df97](https://github.com/doxynix/doxynix/commit/b95df975c5860360e50fe1950deb822a9af507c3))
