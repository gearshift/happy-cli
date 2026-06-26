# Deprecated: Happy CLI moved into the Happy monorepo

This fork is no longer the source of truth.

Use the CLI package in the main fork instead:

- Repository: https://github.com/gearshift/happy
- Package path: `packages/happy-cli`
- Upstream monorepo: https://github.com/slopus/happy

## Install / upgrade Jon's self-hosted CLI

Linux/macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/gearshift/happy/main/scripts/install-happy-cli.sh | bash
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/gearshift/happy/main/scripts/install-happy-cli-windows.ps1 | iex
```

Defaults:

```bash
HAPPY_SERVER_URL=https://happy-api.tail146e68.ts.net
HAPPY_WEBAPP_URL=https://happy.tail146e68.ts.net
```

If you still have this standalone checkout locally, you can leave it alone or delete it after installing from the monorepo. Future changes should go to `gearshift/happy/packages/happy-cli`.
