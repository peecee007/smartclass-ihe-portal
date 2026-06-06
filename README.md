# SmartClass Ihe Portal v4.0
## NYSC Smart Youth & Teacher Initiative (SYTI) — Awgu LGA, Enugu State

### Admin Login
`admin@smartclass.ng` / `admin123`

### New in v4.0
- 11-slide animated background (NYSC logos, Gabriel in uniform, Ihe aerial, waterfall, ceremony)
- 💚 Support & Donations page (public + logged in)
- Admin Donations panel with confirm/reject + CSV export
- Wall of Supporters visible to everyone

### Run with Docker

Build and start the React portal:

```powershell
docker compose up --build
```

Open:

```text
http://localhost:8080
```

Admin login:

```text
admin@smartclass.ng / admin123
```

Run it in the background:

```powershell
docker compose up --build -d
```

Stop it:

```powershell
docker compose down
```

### Host with Docker

On a VPS or cloud server with Docker installed:

```powershell
docker compose up --build -d
```

Then point your domain to the server IP and proxy traffic to port `8080`, or change the compose port mapping from `8080:80` to `80:80` if the server is only hosting this site.

### Host on Render

This is a Vite React static site, so the easiest Render option is **Static Site**.

1. Push this folder to GitHub or GitLab.
2. In Render, click **New +** then **Static Site**.
3. Connect the repository.
4. Use these settings:

```text
Build Command: npm ci && npm run build
Publish Directory: dist
```

5. Click **Create Static Site**. Render will build the app and give you a live URL.

You can also use the included `render.yaml` as a Render Blueprint. In Render, choose **New +** then **Blueprint**, connect the repository, and Render will read the build command and `dist` publish directory automatically.

Important: this portal stores users, classes, attendance, donations, and progress in browser `localStorage`. That is fine for demos and small offline-style use, but a real hosted school portal should add a backend database before relying on it for permanent records across devices.
