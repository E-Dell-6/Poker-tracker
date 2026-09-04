# Import staging directory on the production server

**Status: resolved 2026-09-04.** Kept as a record of the root cause and the
verification method, because the failure mode is silent and will look "clean" in logs
if it ever recurs.

## Symptom

Uploading hands returned:
`ENOENT: no such file or directory, mkdir '/var/lib/pokerflow/import-staging/<jobId>'`

## Root cause

`poker-backend.service` runs with `ProtectSystem=strict`, which mounts the entire
filesystem **read-only inside the service's mount namespace** except paths listed in
`ReadWritePaths=`. That list contained only the `uploads/` directory, so the import
staging directory was unwritable no matter what its Unix ownership or mode said.

This was not a Unix-permissions problem, and two things made it look like one:

- Setting the parent directory to `711` made it look correct from a root shell.
- The boot-time `mkdir(recursive: true)` **succeeded silently** — the directory already
  existed, so `mkdir` was a no-op and never attempted a write. Absence of an error in
  the logs proved nothing.

Imports were broken from the first "clean" restart onward, with clean logs throughout.

## Fix applied

Added the staging directory to the unit's `ReadWritePaths=`:

```ini
ReadWritePaths=/var/lib/pokerflow/import-staging
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl restart poker-backend
```

No directory relocation and no `StateDirectory=` were needed — this unit uses a static
`pokerflow` user, not `DynamicUser=`, so the plain `ReadWritePaths=` addition is the
minimal correct fix.

## How to verify (the only check that actually proves it)

Write a real file from **inside the running process's own mount namespace**. Checking
ownership from a root shell, or checking that the logs are quiet, does not test what
`ProtectSystem=strict` enforces:

```bash
PID=$(sudo systemctl show -p MainPID --value poker-backend.service)
sudo nsenter -t "$PID" -m -- sh -c \
  'touch /var/lib/pokerflow/import-staging/.probe && echo WRITE_OK && rm /var/lib/pokerflow/import-staging/.probe'
```

`WRITE_OK` is the pass condition. `EROFS` / "Read-only file system" means the path is
still outside `ReadWritePaths=`.

## If this recurs on a fresh box

1. Check the sandboxing directives first — they explain more failures here than
   ownership does:
   ```bash
   sudo systemctl cat poker-backend.service   # ProtectSystem, ReadWritePaths, DynamicUser, StateDirectory
   ```
2. If `ProtectSystem=strict` or `ProtectSystem=full` is set, every writable path the app
   needs must be in `ReadWritePaths=`. Currently that means `uploads/` and
   `/var/lib/pokerflow/import-staging`.
3. If the unit ever gains `DynamicUser=yes`, switch to `StateDirectory=pokerflow/import-staging`
   instead — systemd then creates and owns the path inside the namespace, and
   `/var/lib/pokerflow` becomes a symlink into `/var/lib/private/`, so any hand-created
   directory at that path must be moved aside first.
4. Always finish with the `nsenter` write test above.

## Notes

- Import jobs left in Mongo pointing at an unreachable path fail cleanly on restart with
  "staged files are no longer available, please re-upload". Expected, not a new problem.
- `IMPORT_STAGING_DIR` overrides the default in `poker-backend/config/limits.js`.
- Once the pending backend change is deployed, boot writes and deletes a probe file in
  the staging dir and logs `IMPORTS DISABLED: <path> is not writable by uid <N>: <errno>`
  on failure. That check is what makes this failure mode visible from logs alone; before
  it, quiet logs were not evidence.
