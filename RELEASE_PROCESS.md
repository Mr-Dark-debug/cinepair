# CinePair release process

1. Keep the version aligned in `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`.
2. Run `npm test`, `npm run test:backend`, and `npm run build`. Review the Verify CinePair GitHub workflow, including its PostgreSQL test.
3. Merge the reviewed branch into `main`. Check the live Render backend and two-person browser flow. A local test does not establish production availability.
4. Tag the release commit `vX.Y.Z` and push the tag. `.github/workflows/release.yml` builds installers and opens a **draft** GitHub release. Check every job and artifact before publishing it.
5. Document known limits in the release notes. In particular, a suspended Render Free service, absent durable account database, or failed native build means the version is not ready to claim as fully operational.

Free Render instance hours and third-party DRM restrictions cannot be fixed by a health-check route. See [deployment](DEPLOYMENT_GUIDE.md).
