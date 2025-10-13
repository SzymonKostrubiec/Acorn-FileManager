<p align="center"><img src="acorn-file-manager/assets/Acorn.png" width="400"></a></p>

# Acorn CLI

Acorn CLI — command-line tool for managing projects using the Acorn Framework (Squirrel-based).

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)
![Docker](https://img.shields.io/badge/Docker-supported-orange.svg)


---

## Requirements

- Bash 4.0+
- Git
- Write permissions in project directory

**Additional dependencies (if building from source):**
- `build-essential`
- `cmake`
- `wget`
- `curl`
- `jq`

---

## Installation

### Native Installation

Run the install command to set up your project:

```bash
./acorn install
```

### Docker Installation

If you prefer to run Acorn CLI in a containerized environment, you can use Docker:

```bash
docker-compose up -d
```

The Docker setup includes all necessary dependencies and tools.

---

## What Installation Does

This command will:

- Create required directories:
  - `var/cache`
  - `var/storage`
  - `var/logs`
- Fetch and clone all repositories defined in `acorn.json`
- Generate `var/cache/autoload.nut` and `acorn.lock` files

---

## Project Structure

- `acorn.json` — main project configuration:
  - `config` — project directory paths and autoloader output file
  - `packages` — package definitions, repositories and autoload rules
- `vendor/` — cloned package repositories
- `var/cache/` — cache for `autoload.nut`
- `var/storage/` — temporary files
- `var/logs/` — log files

---

## Quick Start

### Native Setup

1) Create `acorn.json` in your project root directory.  
2) Run:

```bash
./acorn install
```

3) When packages change:

```bash
./acorn update
```

4) To rebuild autoloader:

```bash
./acorn dump-autoload
```

### Docker Setup

1) Create `acorn.json` in your project root directory.
2) Start the container:

```bash
docker-compose up -d
```

3) Run commands inside the container:

```bash
docker-compose exec acorn ./acorn install
docker-compose exec acorn ./acorn update
```

---

## Commands

### install

Installs the project and prepares the environment.

```bash
./acorn install
```

Actions:
- creates directories `var/cache`, `var/storage`, `var/logs`
- clones/fetches packages defined in `acorn.json`
- generates `var/cache/autoload.nut` and `acorn.lock`

---

### update

Updates all installed packages and refreshes autoloader.

```bash
./acorn update
```

Actions:
- fetches latest changes from repositories
- updates `var/cache/autoload.nut` and `acorn.lock`
- does not recreate directories

---

### dump-autoload

Regenerates the autoloader file based on package definitions.

```bash
./acorn dump-autoload
```

Actions:
- collects `.nut` files from all packages according to `autoload.files`
- generates `var/cache/autoload.nut`
- updates `acorn.lock`

---

### clear

Clears the cache directory.

```bash
./acorn clear
```

Actions:
- removes all files from `var/cache`

---

### doctor

Displays environment information.

```bash
./acorn doctor
```

Shows:
- Bash version
- project root directory
- cache directory path

---

### help

Shows help message and command list.

```bash
./acorn help
```

---

## Configuration — acorn.json

Complete example with basic configuration and a package from repository:

```json
{
  "name": "my-acorn-project",
  "config": {
    "autoload_output_file": "var/cache/autoload.nut",
    "cache_dir": "var/cache",
    "storage_dir": "var/storage",
    "logs_dir": "var/logs"
  },
  "packages": [
    {
      "name": "core",
      "version": "1.0.0",
      "autoload": {
        "files": ["src/core/*.nut"]
      }
    },
    {
      "name": "acorn",
      "version": "2.1.0",
      "autoload": {
        "files": ["vendor/acorn/app/*.nut"]
      },
      "repos": [
        {
          "url": "https://github.com/SzymonKostrubiec/Acorn.git",
          "branch": "main",
          "path": "vendor/acorn"
        }
      ]
    }
  ]
}
```

Tips:
- `autoload.files` supports globs (e.g., `src/**/*.nut`).
- Each package can have its own `repos` section (Git sources), including `branch` or tag.
- `path` indicates location in `vendor/` directory.

---

## Docker Environment

The Docker setup includes all necessary build tools and dependencies:

- Git for repository management
- Build essentials (`build-essential`, `cmake`)
- Network tools (`wget`, `curl`)
- JSON processor (`jq`)

This ensures a consistent environment across different systems and eliminates dependency issues.

---

## Best Practices

- Keep `acorn.json` in repository, and `var/*` directories in `.gitignore`.
- After adding new package or changing `autoload.files` patterns, run `./acorn dump-autoload`.
- `acorn.lock` stabilizes version resolution — commit it to reproduce environment.
- Use Docker for consistent builds across development teams.

Example `.gitignore`:

```gitignore
/vendor/
/var/cache/
/var/storage/
/var/logs/
acorn.lock
```

---

## Troubleshooting

- Missing `autoload.nut` file:
  - run `./acorn dump-autoload`
  - check `config.autoload_output_file` path in `acorn.json`
- Wrong paths to `.nut` files:
  - verify patterns in `autoload.files`
  - confirm packages were correctly cloned to `vendor/`
- Repository changes not visible:
  - run `./acorn update`
  - clear cache: `./acorn clear`, then `./acorn dump-autoload`
- Build issues on different systems:
  - use Docker environment: `docker-compose up -d`

---

## Technical Notes

- Project directory detection is based on presence of `acorn-cli/scripts`.
- `acorn.lock` is generated during `install` and `dump-autoload` to avoid unnecessary re-fetching of packages.
- Package repositories are cloned to `vendor/`.
- Autoloader collects files defined in each package's `autoload.files`.
- Docker environment includes all build dependencies for cross-platform compatibility.

---

## Example Workflows

### Native Environment

Update packages without touching directories:

```bash
./acorn update
```

Full autoloader rebuild after file changes:

```bash
./acorn dump-autoload
```

Clear cache after autoloader issues:

```bash
./acorn clear && ./acorn dump-autoload
```

### Docker Environment

Start development environment:

```bash
docker-compose up -d
```

Install packages in container:

```bash
docker-compose exec acorn ./acorn install
```

Update and rebuild:

```bash
docker-compose exec acorn ./acorn update
docker-compose exec acorn ./acorn dump-autoload
```

---

## License

MIT License — Szymon Kostrubiec (c) 2025

---