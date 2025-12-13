# Wack-Man

This repository now includes an automated GitHub Pages workflow. Push any static assets into the `site/` directory and the action will publish them to GitHub Pages so you can share a live preview.

## How it works
- A GitHub Actions workflow at `.github/workflows/pages.yml` uploads everything under `site/` as a Pages artifact.
- The workflow runs on pushes to the `work` branch and can also be triggered manually from the Actions tab.
- The deployment job publishes the artifact to the `github-pages` environment and reports the resulting URL.

## Publishing URL
After the first successful workflow run, the site will be available at your repository's GitHub Pages URL, typically:

```
https://<your-username>.github.io/wack-man/
```

You can confirm the exact link in the deploy job summary inside the Actions tab once a run finishes.

## Customizing the site
1. Edit `site/index.html` (or add other assets under `site/`).
2. Commit and push to the `work` branch.
3. Wait for the **Deploy static content to Pages** workflow to complete, then use the published URL to view the page.
