# Sujata Institute — Deployment Guide

## Document root = `public` folder (recommended)

Upload the project and point your domain to the **`public`** folder.

```
public/
  index.html          ← website home
  assets/             ← CSS, JS, logo, images
  admin/
    login.html        ← admin login (double-click logo)
    dashboard.html
    ...
```

- Website: `https://yoursite.com/`
- Admin login: `https://yoursite.com/admin/login.html`
- **Double-click the navbar logo** → opens admin login

## Why you saw 404 before

Double-click used `../admin/login.html`, which is **outside** `public/`.
When the host only serves `public/`, that path returns **404 NOT_FOUND**.

Now admin lives at `public/admin/`, so login works under the same document root.

## Local test

```bash
cd public
python3 -m http.server 8080
```

Open http://localhost:8080 — single-click logo = Home, double-click logo = Login.
