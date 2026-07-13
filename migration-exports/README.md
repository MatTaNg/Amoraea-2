# Migration export artifacts

Code snapshots kept **outside** `src/` so they are not part of the app build, TypeScript project, or IDE search scope.

| Folder | Purpose |
|--------|---------|
| `onboarding-port/` | Zip-ready duplicate of onboarding + assessment flows for porting to another Expo app (see `onboarding-port/README.md`) |

To refresh the onboarding bundle from live `src/datingProfile`, run:

```powershell
powershell -File migration-exports/onboarding-port/scripts/sync-bundle.ps1
```
