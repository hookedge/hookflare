---
name: release
description: Publish a new version of hookflare CLI to npm via trusted publisher
disable-model-invocation: true
allowed-tools: Bash, Read, Edit, Grep, Glob
---

Release hookflare CLI version $ARGUMENTS.

Follow these steps exactly:

1. **Validate version argument**
   - $ARGUMENTS must be a valid semver (e.g., 0.1.0, 1.0.0)
   - If empty, read current version from packages/cli/package.json and suggest the next patch

2. **Run all checks**
   ```bash
   pnpm --filter @hookflare/shared build
   pnpm --filter @hookflare/worker typecheck
   pnpm --filter hookflare typecheck
   pnpm --filter @hookflare/worker test
   ```
   Stop if any check fails.

3. **Update version in two files**
   - `packages/cli/package.json` → `"version": "$ARGUMENTS"`
   - `packages/cli/src/index.ts` → `.version("$ARGUMENTS")`

4. **Build CLI and verify**
   ```bash
   pnpm --filter hookflare build
   node packages/cli/dist/index.js --version
   ```
   Verify output matches $ARGUMENTS.

5. **Commit and tag**
   ```bash
   git add packages/cli/package.json packages/cli/src/index.ts
   git commit -m "chore: release hookflare CLI v$ARGUMENTS"
   git tag v$ARGUMENTS
   ```

6. **Push to trigger trusted publisher**
   ```bash
   git push && git push --tags
   ```

7. **Monitor GitHub Actions**
   ```bash
   sleep 10
   gh run list --repo hookedge/hookflare --limit 1
   ```
   Report the workflow URL so the user can watch it.

8. **Verify publish** (after workflow completes)
   ```bash
   npm view hookflare version
   ```

Do NOT proceed to step 6 without explicit user confirmation.
