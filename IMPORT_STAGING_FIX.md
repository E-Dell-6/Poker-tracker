# Fix: import staging directory on the production server

Symptom: uploading hands returns
`ENOENT: no such file or directory, mkdir '/var/lib/pokerflow/import-staging/<jobId>'`

Cause: the app's per-job `mkdir` uses `recursive: true`, so it cannot return ENOENT
unless `/var/lib/pokerflow/import-staging` is missing **as the running service sees
it**. A hand-created directory doesn't survive systemd sandboxing (`DynamicUser=`,
`StateDirectory=`, `ProtectSystem=strict`, `TemporaryFileSystem=`), which gives the
service its own view of `/var/lib`. The fix is to let systemd create the directory
inside the service's namespace, with the correct owner, on every start.

Everything below runs on the Linux box, as root / with sudo.

---

## 1. Inspect the unit

```bash
sudo systemctl cat poker-backend.service
```

Note two things:

- Is there a `User=` line? (expected: `pokerflow`)
- Are there any of `DynamicUser=`, `StateDirectory=`, `ProtectSystem=`,
  `TemporaryFileSystem=`, `ReadWritePaths=`?

**If there is no `User=` AND none of those sandboxing directives**, stop — a namespace
mismatch was impossible, so the service is not running on the box where the directory
was created. Verify where `api.pokerflow.live` actually resolves before continuing:

```bash
dig +short api.pokerflow.live
ip -4 addr show | grep inet
```

## 2. Move the hand-made directory aside

It holds only transient staged uploads. If the unit uses `DynamicUser=yes`, a
pre-existing root-owned `/var/lib/pokerflow` actively conflicts with what systemd
expects at that path.

```bash
sudo ls -la /var/lib/pokerflow /var/lib/pokerflow/import-staging   # confirm it's empty/junk
sudo mv /var/lib/pokerflow /var/lib/pokerflow.bak                  # rename, don't delete
```

## 3. Add the StateDirectory lines to the unit

```bash
sudo systemctl edit --full poker-backend.service
```

In the `[Service]` section, add:

```ini
StateDirectory=pokerflow/import-staging
StateDirectoryMode=0700
Environment=IMPORT_STAGING_DIR=/var/lib/pokerflow/import-staging
```

`StateDirectory=` accepts a nested path and creates the whole chain before `ExecStart`,
owned by the unit's `User=`, and stays writable even under `ProtectSystem=strict`.
That is the property the manual `mkdir` did not have.

## 4. Reload and restart

```bash
sudo systemctl daemon-reload
sudo systemctl restart poker-backend
sudo systemctl status poker-backend --no-pager
```

## 5. Verify before touching the UI

```bash
sudo journalctl -u poker-backend -b | grep -iE "IMPORTS DISABLED|Could not create import staging|staging"
```

- **No output** → the boot probe wrote and deleted a file in the staging dir. Imports
  will work. Go test an upload.
- **`IMPORTS DISABLED: ... EACCES`** → the directory exists but `User=` doesn't match its
  owner. Check the uid printed in that same line against:
  ```bash
  sudo systemctl show -p User -p Group -p UID poker-backend.service
  sudo ls -ld /var/lib/pokerflow /var/lib/pokerflow/import-staging
  ```
- **`IMPORTS DISABLED: ... ENOENT`** → still a namespace problem. Compare what the
  service sees against what the host sees:
  ```bash
  PID=$(sudo systemctl show -p MainPID --value poker-backend.service)
  sudo nsenter -t "$PID" -m -- ls -la /var/lib/pokerflow/
  namei -l /var/lib/pokerflow/import-staging     # reveals dangling symlinks
  ```

## 6. Confirm end to end

Log in on the site and import a folder of real hand histories. Then:

```bash
sudo ls -la /var/lib/pokerflow/import-staging    # job dirs appear during an import, and are cleaned up after
```

## 7. Clean up once it works

```bash
sudo rm -rf /var/lib/pokerflow.bak
```

---

## Notes

- Import jobs stuck in Mongo pointing at the old path fail cleanly on restart with
  "staged files are no longer available, please re-upload". Expected, not a new problem.
- `IMPORT_STAGING_DIR` overrides the default in `poker-backend/config/limits.js`; the
  value above matches that default, so it is explicit rather than load-bearing.
- Step 5's `IMPORTS DISABLED` line only exists once the current backend code is deployed
  (it auto-deploys via the push webhook). On older code the equivalent line reads
  `Could not create import staging dir`.
