# OPD App Development Checkpoint

Last confirmed working session: 2026-11-17 (user-confirmed).

## Project
- Repository: https://github.com/vinodsharma4063-source/kartikey-physio-opd
- Working branch: `laptop-sync-2026-11-16`
- Main app file: `src/main.jsx`
- Stack: React + Vite + Supabase
- Clinic: Kartikey Physiotherapy & Rehabilitation Clinic
- Professional display: Dr. Vinod Sharma (Physiotherapist, BPT) | Reg. No. BPT/029
- Address: Near Railway Station, Opposite to Nainital Bank, Lalkuan, District Nainital (Uttarakhand) – 262402

## Last verified work
- Date-to-Date Bill date fields now show a single text entry field with a calendar picker.
- Manual date entry accepts dates such as `9-11-2026` and `16-11-2026`, with normalization to `09-11-2026` and `16-11-2026`.
- Latest date parser uses safe string concatenation (no escaped template literals).
- User reported that the date entry/bill flow is now working correctly.
- User previously ran `npm.cmd run build` successfully with no build error.

## Resume instructions for next session (PC)
1. Open the existing project folder on the PC.
2. In VS Code terminal, run `git status` first. Do not overwrite, discard, or clean any local/uncommitted files.
3. If there are local changes, inspect and preserve them before syncing.
4. Once the PC working tree is safe, run:
   ```bash
   git fetch origin
   git pull origin laptop-sync-2026-11-16
   ```
5. Run `npm.cmd run build` only after syncing if code has changed locally; then start with `npm.cmd run dev` to continue.
6. Continue from this checkpoint; do not rework the date parser unless a reproducible issue is reported.

## Safe collaboration rules
- GitHub branch `laptop-sync-2026-11-16` is the shared source of truth for application code.
- Do not edit the same project simultaneously on PC and laptop.
- Finish work on one device, test, commit and push; then pull on the other device.
- Preserve local backup/diff files. In particular, do not delete `laptop-diff.txt` or `src/main.jsx.laptop-before-sync-backup` without explicit review.
- Keep code backups and patient-data backups separate.

## Important data-safety note
GitHub stores application source code, not the clinic's live patient records in Supabase. Do not upload patient records, patient backup JSON, credentials, API keys, or Supabase service-role secrets to GitHub. Patient data needs a separate verified Supabase/OPD export backup. No patient-data backup or restore was performed as part of this checkpoint.

## Deployment note
Vercel deployment status was not verified in this checkpoint. Do not assume a production deployment happened solely because the GitHub branch was updated. Verify the Vercel project/deployment before relying on a live production version.
