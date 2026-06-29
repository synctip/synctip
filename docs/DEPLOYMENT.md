# Synctip - Deployment Strategy

This document describes the deployment environments used by Synctip and the promotion flow between them.

## Environment Overview

| Environment    | Frontend                    | API                             | Purpose                                |
| -------------- | --------------------------- | ------------------------------- | -------------------------------------- |
| **Production** | <https://synctip.com>       | <https://api.synctip.com>       | Live production serving real users     |
| **Beta**       | <https://beta.synctip.com>  | <https://api-beta.synctip.com>  | Next production — canary before prod   |
| **Stage**      | <https://stage.synctip.com> | <https://api-stage.synctip.com> | Pre-beta validation for risky features |
| **Develop**    | <https://dev.synctip.com>   | <https://api-dev.synctip.com>   | Local dev via Cloudflare Tunnel        |

DNS naming convention:

- Frontend: `<env>.synctip.com` (bare `synctip.com` for production)
- API: `api-<env>.synctip.com` (bare `api.synctip.com` for production)

## Environments

### Production

The live production environment serving real users at `synctip.com` / `api.synctip.com`.
Only changes that have been promoted through Beta should land here.
Outside of that flow, only critical hotfixes should be deployed directly to production.

### Beta

The **next production** environment. Once a feature has cleared Stage it is promoted to Beta, where it runs against production-like data and a small audience before being rolled out to Production.
Treat Beta as production: bad code that reaches Beta affects real (early-access) users.

### Stage

Pre-Beta validation. Stage is where experimental or risky features get exercised **before** deciding whether they belong in Beta.
A feature can live in Stage indefinitely (or be discarded) without ever reaching Beta or Production — use it to try ideas you are not yet committed to shipping.

No development happens directly in Stage; code only arrives here via promotion from Develop.

### Develop

Local development machine exposed to the public internet through a Cloudflare Tunnel.
The tunnel terminates at `dev.synctip.com` (Vite) and `api-dev.synctip.com` (Nest), giving you a real HTTPS URL for mobile testing, OAuth callbacks, and webhooks without redeploying.

## Deployment Pipeline

```text
Local Development (your machine)
        │  Cloudflare Tunnel
        ▼
dev.synctip.com  /  api-dev.synctip.com           ← Develop
        │  promote (deploy to Render)
        ▼
stage.synctip.com  /  api-stage.synctip.com       ← Stage
        │  promote (only features intended for prod)
        ▼
beta.synctip.com  /  api-beta.synctip.com         ← Beta
        │  promote (after Beta soak)
        ▼
synctip.com  /  api.synctip.com                   ← Production
```

## Environment Colors

| Environment | Color     |
| ----------- | --------- |
| Production  | `#1F7A63` |
| Beta        | `#2563EB` |
| Stage       | `#F59E0B` |
| Develop     | `#DC2626` |

The environment color should be applied consistently to:

- Favicon
- PWA Icon

This makes it immediately obvious which environment is currently open.
