# Sujata Institute — Deployment Guide

## Fixed issues
1. **CSS / logo / images not loading on server**  
   Public site assets now live inside `public/assets/` and all HTML uses relative paths:
   - `assets/css/style.css`
   - `assets/img/logo.png`
   - `assets/js/...`

2. **Responsive on all devices**  
   Extra CSS rules for mobile, tablet and desktop (navbar, hero, stats, footer, logos).

## Recommended upload structure

Upload the entire `sujata-institute` folder to your host.

### Option A — Document root = `public` (recommended for website)
Point your domain (e.g. `www.sujatainstitute.com`) to the **`public`** folder.

- Website: `https://yoursite.com/` → `public/index.html`
- Logo, CSS, JS will load from `public/assets/...`
- Admin panel: host separately or use a subdomain pointing to parent + `/admin/`

### Option B — Document root = project root
Point domain to `sujata-institute/`.

- Website: `https://yoursite.com/public/`
- Admin: `https://yoursite.com/admin/`
- Shared assets: `https://yoursite.com/assets/` (used by admin)

## Local test
Open `public/index.html` in a browser (or use a local server):

```bash
cd public
python3 -m http.server 8080
# then open http://localhost:8080
```

## Notes
- Keep folder names exact: `assets`, `css`, `img`, `js` (case-sensitive on Linux servers).
- Do not move `logo.png` out of `public/assets/img/`.
- CDN links (Bootstrap, Font Awesome, Google Fonts) need internet on the server/client.
