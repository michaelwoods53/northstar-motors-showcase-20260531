# Northstar Motors

Mobile-first static dealership website built for GitHub Pages. It includes:

- Inventory grid with sample data for new and used vehicles
- Search, filter, sort, save, and detail views
- Finance calculator, trade-in estimator, and test-drive request flow
- Procedural 3D vehicle tour modal built with Three.js
- GitHub Pages workflow for static deployment

## Local preview

Open `index.html` directly for a basic preview, or serve the folder locally:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## GitHub Pages

This project is static and deploys from the repository root via `.github/workflows/pages.yml`.

Important GitHub constraints as of 2026-05-31:

- Pages sites are public even when the source repository is private.
- Deploying Pages from a private repository is not available on a personal GitHub Free plan.

If the account has GitHub Pro or higher, create a private repo, push to `main`, and enable:

1. `Settings` -> `Pages`
2. `Source` -> `GitHub Actions`

The workflow will publish the site automatically on each push to `main`.
