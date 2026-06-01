# Northstar Motors

Mobile-first static dealership website built for GitHub Pages. It includes:

- Inventory grid with sample data for new and used vehicles
- Search, filter, sort, save, and detail views
- Finance calculator, trade-in estimator, and test-drive request flow
- Touch-first 360 interior tours powered by a real panorama viewer
- Generated exterior 3D sample delivered as a static glTF asset
- Offline PowerShell pipeline that converts multiple 2D source images into the sample 3D asset
- GitHub Pages workflow for static deployment

## Local preview

Serve the folder locally so the panorama viewer, model asset, and module scripts load correctly:

```powershell
.\serve-static.ps1 -Port 8010
```

Then visit `http://127.0.0.1:8010/`.

## 2D to 3D asset pipeline

The sample generated exterior model is created offline and checked into the repo so the deployed site stays fully static.

Source inputs:

- `tools/model-inputs/atlas-ev/raw/*.png`
- `tools/model-inputs/atlas-ev/manifest.json`

Build the sample asset:

```powershell
.\scripts\Build-Featured3DModel.ps1
```

This pipeline will:

1. Remove the chroma-key background from each 2D source image
2. Crop the vehicle tightly
3. Build a static multi-plane glTF showroom asset
4. Write the output to `assets/generated-models/atlas-showcase/`

## GitHub Pages

This project is static and deploys from the repository root via `.github/workflows/pages.yml`.

Important GitHub constraints as of 2026-05-31:

- Pages sites are public even when the source repository is private.
- Deploying Pages from a private repository is not available on a personal GitHub Free plan.

If the account has GitHub Pro or higher, create a private repo, push to `main`, and enable:

1. `Settings` -> `Pages`
2. `Source` -> `GitHub Actions`

The workflow will publish the site automatically on each push to `main`.
