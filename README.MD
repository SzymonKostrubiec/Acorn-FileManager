# Acorn CLI

Composer-like package manager dla projektów Acorn i skryptów `.nut`.

To nie jest już bashowy wrapper. Repo zostało przepisane na przenośne CLI Node.js, które:

- działa na macOS, Linux i Windows
- instaluje się jak normalne narzędzie CLI przez `npm`
- trzyma zależności w `vendor/`
- generuje `acorn.lock`
- buduje `var/cache/autoload.nut`
- obsługuje źródła `git`, `path`, auto-discovery lokalnych workspace'ów i prywatne `registry`
- ma globalną konfigurację `~/.acorn/config.json`
- potrafi publikować pakiety do registry

## Instalacja

Masz teraz 3 realne ścieżki instalacji.

Lokalnie z repo:

```bash
npm install
node ./bin/acorn.js help
```

Globalnie:

```bash
npm install -g .
acorn help
```

Z npm po publikacji:

```bash
npm install -g @acorn/file-manager
acorn help
```

Na Windows `npm` wygeneruje shim polecenia automatycznie, więc `acorn` działa też z `cmd` i PowerShell.

Bez instalacji globalnej:

```bash
npx @acorn/file-manager help
```

Bez Node na maszynie użytkownika:

1. wejdź w GitHub Releases
2. pobierz binarkę `acorn-linux-x64`, `acorn-darwin-arm64`, `acorn-win32-x64.exe` albo odpowiednią dla platformy
3. wrzuć ją do `PATH`

To jest generowane automatycznie przez workflow release.

Albo one-liner:

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/SzymonKostrubiec/Acorn-FileManager/main/scripts/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/SzymonKostrubiec/Acorn-FileManager/main/scripts/install.ps1 | iex
```

## Publikacja do npm

Repo ma już przygotowane:

- `files` w `package.json`, więc do npm nie poleci cały syf z repo
- `prepublishOnly`, więc przed publish leci smoke i `npm pack --dry-run`
- workflow [publish.yml](/Users/szymon/Acorn-FileManager/.github/workflows/publish.yml), który publikuje paczkę przez GitHub Actions
- workflow [release-binaries.yml](/Users/szymon/Acorn-FileManager/.github/workflows/release-binaries.yml), który buduje gotowe binarki

Manualnie:

```bash
npm login
npm publish --access public
```

Docelowo lepiej używać trusted publishing z GitHub Actions niż stałego tokena npm.

Pełny checklist masz w [docs/release-and-install.md](/Users/szymon/Acorn-FileManager/docs/release-and-install.md).

Paczka npm publikuje zbundlowany runtime `dist/acorn.cjs`, więc użytkownik z npm dostaje gotowe CLI, a nie całe drzewo źródeł.

## Build binarek

Lokalnie po `npm install`:

```bash
npm run build:bundle
npm run build:binary
```

To zbuduje:

- `dist/acorn.cjs`
- `dist/acorn-<platform>-<arch>`
- `dist/acorn-<platform>-<arch>.sha256`

## Globalna konfiguracja

To jest kluczowy element, którego brakowało w pierwszej wersji. Projekt może mieć tylko `require`, a źródła pakietów konfigurujesz globalnie:

```bash
acorn config init
acorn config show
```

Plik globalny:

```json
{
  "repositories": [
    {
      "type": "registry",
      "url": "https://packages.example.com",
      "tokenEnv": "ACORN_REGISTRY_TOKEN"
    }
  ],
  "workspaces": [
    {
      "path": "~/Projects",
      "depth": 3
    }
  ],
  "publish": {
    "registry": "https://packages.example.com",
    "tokenEnv": "ACORN_REGISTRY_TOKEN",
    "endpoint": "/publish"
  }
}
```

`workspaces` służy do automatycznego wykrywania lokalnych pakietów `acorn.json`, więc w projekcie możesz mieć samo `require`, a CLI samo znajdzie lokalne repo, jeśli jest obecne w twoim workspace.

Jeśli lokalny pakiet i zdalne registry mają tę samą nazwę, jawne `repositories` projektu wygrywają, a gdy ich brak, local workspace może podmienić zdalne źródło w development workflow.

## Format projektu

Plik projektu to `acorn.json`.

Przykład:

```json
{
  "name": "my-acorn-app",
  "type": "project",
  "config": {
    "vendor_dir": "vendor",
    "cache_dir": "var/cache",
    "storage_dir": "var/storage",
    "logs_dir": "var/logs",
    "lock_file": "acorn.lock",
    "autoload_output_file": "var/cache/autoload.nut"
  },
  "autoload": {
    "files": [
      "src/**/*.nut"
    ]
  },
  "require": {
    "acorn/framework": "dev-main"
  }
}
```

`repositories` w projekcie są nadal wspierane, ale są opcjonalne. Jeśli masz dobrze ustawione globalne `registry` i `workspaces`, projekt może zawierać praktycznie tylko `require`.

## Format pakietu

Każdy pakiet Acorn też ma własny `acorn.json`.

```json
{
  "name": "acorn/framework",
  "version": "2.1.0",
  "autoload": {
    "files": [
      "app/**/*.nut"
    ]
  },
  "require": {
    "acorn/support": "^1.4.0"
  }
}
```

## Komendy

```bash
acorn install
acorn update
acorn dump-autoload
acorn clear
acorn doctor
acorn publish
acorn config init
acorn config show
acorn help
```

## Jak to działa

`install`:

1. czyta `acorn.json`
2. jeśli jest `acorn.lock`, instaluje z locka
3. pobiera zależności do `vendor/`
4. skanuje `autoload.files` z projektu i pakietów
5. generuje `var/cache/autoload.nut`
6. zapisuje nowy `acorn.lock`

`update`:

1. odświeża repozytoria do najnowszych dozwolonych referencji
2. regeneruje autoload
3. przepisuje `acorn.lock`

`dump-autoload`:

1. nie pobiera nowych paczek
2. skanuje już zainstalowany kod
3. odświeża `autoload.nut`
4. synchronizuje `acorn.lock`

`publish`:

1. czyta bieżący `acorn.json`
2. bierze `origin` z Gita oraz aktualny `HEAD`
3. wysyła metadane pakietu do registry
4. od tego momentu inny projekt może mieć samo `require`

## Typy repozytoriów

### `git`

Najprostszy tryb dla prywatnego frameworka:

```json
{
  "type": "git",
  "package": "acorn/framework",
  "url": "ssh://git@git.example.com/acorn/framework.git",
  "branch": "main"
}
```

### `path`

Do lokalnego developmentu pakietu:

```json
{
  "type": "path",
  "package": "acorn/framework",
  "source": "../Acorn"
}
```

### `registry`

Jeśli chcesz prywatny serwer metadanych podobny do Packagista:

```json
{
  "type": "registry",
  "url": "https://packages.example.com",
  "tokenEnv": "ACORN_REGISTRY_TOKEN"
}
```

Kontrakt API i konfiguracja reverse proxy są opisane w [docs/server.md](/Users/szymon/Acorn-FileManager/docs/server.md).

## Workflow bez ręcznych repositories

1. Pakiet frameworka ma własne repo Git i `acorn.json`.
2. Publikujesz go przez `acorn publish`.
3. Registry zapisuje metadane `name/version/source/autoload/require`.
4. Projekt aplikacji wpisuje tylko:

```json
{
  "require": {
    "acorn/framework": "^2.1.0"
  }
}
```

5. `acorn install` respektuje jawne `repositories` z projektu, a jeśli ich brak dla danej paczki, sprawdza lokalne workspace i globalne registry.

## Migracja ze starego formatu

CLI nadal potrafi czytać stary układ:

```json
{
  "packages": [
    {
      "name": "acorn",
      "version": "dev-main",
      "autoload": {
        "repos": [
          {
            "url": "https://github.com/org/Acorn.git",
            "branch": "main",
            "path": "vendor/acorn"
          }
        ]
      }
    }
  ]
}
```

Ale docelowo trzymaj się układu `require` + `repositories`, bo to jest baza pod dalszy rozwój solvera zależności.
