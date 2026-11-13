# Publishing on GitHub Pages: Andrew's steps

Account: `Afritech-Advisory` is Andrew's personal GitHub account (owner, full admin), not an
organisation. Repository: https://github.com/Afritech-Advisory/Afritech-Sports-Technology

Where he got stuck, and what fixed it:
- He could not find the repository. Give the full URL. In the GitHub iPhone app it is the top entry
  under Repositories ("Afritech-Sports-Technology").
- The iPhone app has no repository settings. Settings must be done in a browser (he uses Edge on a
  Windows laptop).
- He first opened account settings (`github.com/settings/pages`, "Verified domains"). The right page
  is the repository's own Settings tab: give the direct link
  `github.com/Afritech-Advisory/Afritech-Sports-Technology/settings/pages`.

Steps, as given:
1. Open github.com/Afritech-Advisory/Afritech-Sports-Technology/settings/pages
2. Build and deployment, Source: choose **GitHub Actions** (applies at once, no Save button).
3. Do not click the suggested workflows ("Static HTML", "Jekyll", Configure). The repo has its own.
4. Merge the pull request (Claude opens it when asked; Andrew clicks Merge pull request, Confirm).
5. Actions tab: "Publish pitch visualizer" runs about a minute; green tick means deployed.
6. If it shows a red cross (usually Pages was switched on after the merge): Actions, Publish pitch
   visualizer, Run workflow, Run workflow.
7. Open https://afritech-advisory.github.io/Afritech-Sports-Technology/

Done and confirmed working on 13 Nov 2026 (PR #2). Later changes to `standalone/` on `main`
republish by themselves.
