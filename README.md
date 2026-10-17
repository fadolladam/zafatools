# ZafaTools local development

ZafaTools is a Vercel serverless application with static HTML pages and Node.js
API functions. Customer records are stored in Google Sheets through Apps Script;
there is no local SQL database. The bot and dashboard also call the Telegram
Bot API and Facebook Graph API.

## Start locally with Docker

Copy `.env.example` to `.env` and add the development credentials you want to
use. Keep `.env` private; it is ignored by Git and excluded from the Docker
build context. Empty values are allowed for a static-page preview, but API
features that require those credentials will report a configuration error.

```bash
cd ~/Developer/zafatools
cp .env.example .env
docker compose up -d --build
```

Open the dashboard at <http://localhost:3000/ads.html> or a public customer
page at <http://localhost:3000/c.html?id=SLUG>. The root URL redirects to the
dashboard. Logs: `docker compose logs -f app`. Stop the app with
`docker compose stop`; named volumes and source files are preserved.

The container runs `dev-server.js`, a local adapter for this project's two
Vercel Node function handlers and its static routes. It reads the same `.env`
values but does not require Vercel CLI login. The adapter supports the handler
request/response features used here; it does not emulate Vercel's deployment,
scaling, or production routing infrastructure. The project remains configured
for Vercel in `vercel.json`. Vercel's own local runtime is available through
the [CLI dev command](https://vercel.com/docs/cli/dev), and linking/pulling
project settings requires an authenticated Vercel project link.

## Local limits

- Telegram webhook delivery requires a public HTTPS URL registered with
  Telegram; localhost cannot receive production webhook updates.
- Google Sheets, Facebook, and Telegram requests require valid credentials and
  live network access. They were not contacted by the Docker health check.
  Local write actions can change the configured Google Sheet, so use a
  development sheet when exercising registration/removal handlers.
- Tailwind/fonts and any browser-side external assets may require internet
  access.

No database schema, seed data, or external deployment is needed for this local
development setup.
