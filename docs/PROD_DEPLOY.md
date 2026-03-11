# Production Deploy

This is the current production deploy path for `vesipolku.jrwl.io` and `api.jrwl.io`.

## One-command deploy

Run from a clean `main` checkout:

```bash
pnpm deploy:prod
```

What the command does:

1. Verifies the current branch is `main`
2. Verifies the working tree is clean
3. Pushes `origin/main`
4. Unlocks `~/.ssh/id_ed25519` in an ephemeral `ssh-agent`
5. Runs `scripts/deploy-prod.sh`
6. Packages the workspace, uploads it to the VPS, installs dependencies, builds API + web, applies Prisma migrations, restarts the API, reloads nginx, and verifies public health checks

On Windows, `scripts/deploy-prod.ps1` prompts for the SSH key passphrase if `SSH_KEY_PASSPHRASE` is not already set. The passphrase is only kept in memory for that session.

## Required server setup

The deploy user must have:

- SSH key access to `deploy@89.167.92.75`
- write access to `/home/deploy/saas-monorepo`
- write access to `/var/www/vesipolku.jrwl.io`
- passwordless sudo for the service operations used by the deploy script

Verify command paths on the server first:

```bash
command -v systemctl
command -v nginx
```

Then create `/etc/sudoers.d/jrwl-deploy` with the exact paths from your host. Typical Ubuntu/Debian example:

```sudoers
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl stop jrwl-api
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart jrwl-api
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl reload nginx
deploy ALL=(root) NOPASSWD: /usr/sbin/nginx -t
```

Validate it on the VPS:

```bash
sudo visudo -cf /etc/sudoers.d/jrwl-deploy
```

Validate it from your workstation:

```bash
ssh deploy@89.167.92.75 'sudo -n $(command -v nginx) -t && echo SUDO_OK'
```

If that command does not print `SUDO_OK`, `pnpm deploy:prod` will refuse to continue.

## Windows prerequisites

- Git for Windows installed so `C:\Program Files\Git\bin\bash.exe` exists
- OpenSSH key at `%USERPROFILE%\.ssh\id_ed25519`, or set `DEPLOY_SSH_KEY_PATH`

## Deploy outputs

Expected checkpoints:

- SSH connection established
- remote passwordless sudo preflight passes
- `pnpm install --frozen-lockfile`
- `pnpm build:api`
- `pnpm --filter ./apps/web build`
- `pnpm --filter ./apps/api prisma:migrate:deploy`
- `nginx -t`
- `https://vesipolku.jrwl.io`
- `https://api.jrwl.io/health/live`

## Troubleshooting

`Permission denied (publickey)`

- The VPS did not accept your SSH key. Verify the correct key is authorized for `deploy`.

`Remote sudo preflight failed`

- The server does not yet have the required `NOPASSWD` sudoers entry for the deploy commands.

`Git Bash not found`

- Install Git for Windows, or update `scripts/deploy-prod.ps1` to point at your local `bash.exe`.
