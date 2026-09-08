# Large file upload and storage

How a folder of hand histories gets from the browser to Mongo, and why each
step is shaped the way it is. Companion to [IMPORT_STAGING_FIX.md](IMPORT_STAGING_FIX.md),
which covers the one deployment failure this path has actually hit in production.

## Two entry points, one pipeline

|  | inline | staged |
| --- | --- | --- |
| route | `POST /api/upload` — [sessionRoute.js](poker-backend/routes/sessionRoute.js) | `POST /api/imports` — [importRoute.js](poker-backend/routes/importRoute.js) |
| shape | one request, parsed inline, responds with results | many batches → job doc → background runner → polled |
| caps | 20 files x 10MB | 500 files / 100MB per job |

Both converge on `importOneFile` in
[handImportPipeline.js:157](poker-backend/services/handImportPipeline.js#L157),
so dedup, EV and quota accounting can't drift between a 1-file upload and a
500-file folder.

Both use multer `diskStorage`, never `memoryStorage` — the comment at
[sessionRoute.js:24-36](poker-backend/routes/sessionRoute.js#L24-L36) spells out
why: the old config could hold 20 x 10MB in RSS before any parsing began, on a
1-2 core box shared with mongod.

Every tunable below lives in [config/limits.js](poker-backend/config/limits.js)
rather than at its use site, because several are pinned to properties of the
deployment (nginx's body cap, the box's core count) rather than chosen freely.

## 1. Client side — screen, then batch

[api/imports.js](poker-frontend/src/api/imports.js) does three things before a
byte moves:

- `collectDroppedFiles` walks dropped directories via `webkitGetAsEntry`
  (bounded to depth 8 / 500 files). A dropped folder otherwise arrives as a
  single unusable directory entry, which is why folder drops used to fail.
- `screenFiles` rejects non-`.csv`/`.txt`, empty files, anything over 10MB, and
  anything past the 500-file / 100MB job budget — so a folder full of unrelated
  files is reported immediately instead of after 100MB of transfer.
- `planBatches` splits the survivors into requests of at most 25 files **and**
  at most 8MB.

The 8MB figure is the load-bearing one. The nginx in front of the API caps a
request body at exactly 32MB (verified: 32MB accepted, 33MB rejected), and its
413 is an **HTML** page, not JSON — so a request that trips it surfaces in the
browser as a JSON parse error ("Unexpected token '<'") rather than anything
actionable. Batching at 8MB keeps 4x headroom so the cliff is never approached,
and means the nginx cap never has to be raised — which would just widen the DoS
surface. `errorFrom` handles the HTML-error case defensively anyway.

[useHandImport.js](poker-frontend/src/hooks/useHandImport.js) sends batches
**sequentially** — the point of batching is to keep each request small and the
server unsurprised, not to saturate the link. The first batch creates the job;
each later one passes `?jobId=` to append to it. Then `POST /:id/start`, then
poll `GET /api/imports/:id` once a second until terminal.

The client limits are duplicated from the server's on purpose: checking here
means a user learns their folder is too big before uploading it, and the server
enforces the same numbers anyway, because a client-side check is a courtesy and
not a control.

## 2. Staging — write to disk before trusting anything

`prepareJob` runs *before* multer
([importController.js:12](poker-backend/controllers/importController.js#L12)):

1. Quota check against the declared `content-length` (first batch only).
2. Create the `ImportJob` doc in status `staging`.
3. `mkdir` the per-job staging directory. An unwritable directory is a deploy
   fault, not a bad upload, so it returns **503** ("imports are temporarily
   unavailable") rather than a 400 carrying a raw ENOENT — which reads as "your
   file was rejected" to both the user and whoever is debugging it.
4. Register a `res.on('finish')` cleanup. The job doc exists before multer has
   accepted a single byte, so any downstream rejection — a bad extension, a 26th
   file, an oversized file — would otherwise strand it in `staging`. That
   matters because the concurrent-job guard counts staging jobs: one malformed
   upload would lock the user out of importing anything, permanently.

Multer then writes each file under a **random name**
(`crypto.randomBytes(16)` plus the lowercased extension). The client controls
`originalname` and it is echoed back in the per-file results, so it must never
reach the filesystem — the original is kept only as metadata on the job doc.

`stageFiles` validates in two tiers
([importValidation.js](poker-backend/services/importValidation.js)):

- **`fileFilter`** — extension only. It runs while the request is still
  streaming, before the file is fully on disk, so it is all that *can* run there.
- **`sniffStagedFile`** — the real gate. Reads the leading 64KB, rejects a NUL
  byte as binary (no legitimate hand history has one; every common binary
  container hits one almost immediately), and runs `detectPokerFileFormat`, the
  same sniff the parser dispatcher uses. Anything that doesn't resolve to ACR,
  GGPoker or PokerNow is unlinked right there, while it is still one small file
  on disk rather than after a parser has tried to build hand objects from it.

Survivors get a SHA-256 and are appended to `job.files[]` as `pending`. The
response is **202** — nothing has been parsed yet. Staging and starting are
separate calls precisely so a half-uploaded folder is never processed.

## 3. Processing — a single-concurrency in-process queue

[importRunner.js](poker-backend/services/importRunner.js).

Concurrency is **1 by design**. The box has 1-2 cores shared with mongod, so
running two imports at once makes both finish later while the API stalls for
everyone else; the win comes from not blocking the event loop, not from
parallelism.

> The queue lives in one Node process. Under pm2 it must run in fork mode /
> a single instance — `cluster` with instances > 1 would give every worker its
> own copy of the queue, and they would race for the same jobs.

Per job: `assertDiskHeadroom` (refuse to start below 5GB free — mongod shares
this filesystem and a full disk corrupts it, so this is a floor for the whole
box, not a per-user rule) → one `PersonResolver` for the entire job, which
caches the user's Person set in memory and turns ~100k lookups into ~2.

Per file: skip anything not `pending` (this is what makes resume work), check
for cancellation, read, `importOneFile`, mark `done`/`skipped`/`failed`,
**unlink the staged copy in `finally`**, write progress. A duplicate file is
`skipped`, not `failed` — folder imports routinely overlap with what has already
been uploaded. Cancelling stops further work rather than rolling back; an
already-imported file stays imported.

The CPU cost is all-in EV: `computeAllInEV` returns immediately for the ~95% of
hands with no all-in, but a preflop all-in runs 5000 Monte Carlo trials, each
evaluating all C(7,5)=21 five-card subsets per player — on the order of 210k
evaluations for a single hand.
`computeEvWithYields` ([handImportPipeline.js:36](poker-backend/services/handImportPipeline.js#L36))
therefore yields after *every hand that actually computed equity*, not on a
fixed hand interval. Cost per hand is wildly bimodal, so a fixed interval let N
*expensive* hands run back to back — measured at over 5s p95 request latency on
an all-in-heavy corpus, versus ~105ms once the per-hand check existed.

After the last file, **one** coalesced `recomputeStatsForPersonIds` runs before
the job reports itself done, so "done" means the user's stats actually reflect
the import. That is only affordable because the recompute does a single bucketed
pass: per-person recomputes measured ~508s for the 400 opponents in a 20k-hand
import, versus ~4.8s batched. It runs under its own `finalizing` stage with
`personsDone`/`personsTotal`, because every file already shows
`filesDone === totalFiles` by then and the poll response would otherwise look
frozen on the last file's numbers — indistinguishable from a hang.

## 4. Storage — three layers of dedup

In `importOneFile`
([handImportPipeline.js:157](poker-backend/services/handImportPipeline.js#L157)):

1. **Whole file** — SHA-256 of the buffer against `Session.fileHash`.
2. **Per hand** — the flat `HandLedger` collection on a unique
   `{userId, handId}` index. Ordering is deliberate: the ledger is claimed
   *after* `session.save()`, with `ledgerWritten: false` marking the crash
   window and `backfillMissingLedger` repairing it at boot. An earlier version
   claimed the ids first (one round trip instead of two) and wrote the "I have
   this hand" marker before the hand was durable — a `kill -9` mid-import left
   ledger rows pointing at a session that was never saved, and because those
   rows say the hands exist, the hands could never be imported again. The catch
   block meant to release them cannot run on SIGKILL. PokerNow has no site hand
   id, so whole-file SHA-256 remains its only dedup.
3. **Size guard** — hands are embedded in the Session doc, so a session is one
   document against Mongo's hard 16MB ceiling. `BSON.calculateObjectSize` is
   checked against a 14MB floor before saving, so an oversized file gets an
   explanation naming the hand count and size instead of a raw driver error.

Quota counters (`storageBytes`, `totalHands`) are `$inc`'d with the BSON size.
Approximating stored bytes that way is deliberate: it is what the document
actually costs on disk, and it keeps every quota check a single document read
rather than an aggregation over sessions.

## 5. Quotas and rate limits

[importQuota.js](poker-backend/services/importQuota.js) bounds what repeated
calls can do, which is the part that actually costs disk and CPU. Signup is
public, so these assume an adversary rather than a slip: 10 jobs/day, 300MB/day,
1 concurrent job, 2GB stored, 1M hands, 5000 new Person docs per job.

A `staging` job counts against the concurrency limit only while it is plausibly
still being uploaded. Staging is client-driven, so a closed tab leaves one
behind, and counting those forever would lock the user out with no way to
recover — anything past an hour is swept to `cancelled` as abandoned. For the
same reason `GET /api/imports/active` deliberately does **not** report staging
jobs: those bytes only ever existed in the tab that is now gone, so the job will
never start, and reporting it would leave a progress card up forever.

[rateLimiter.js](poker-backend/middleware/rateLimiter.js) adds an app-wide
`globalLimiter` (IP-keyed, mounted ahead of `userAuth`, so it is a coarse
network-level backstop) plus `ingestLimiter` on the routes that start real work.
The global ceiling of 1000/5min is set by the client's own behaviour: the import
poll runs once a second for the whole duration of a job, so one browser sitting
still is already ~300 requests per 5 minutes.

## 6. Lifecycle and cleanup

Staging lives at `/var/lib/pokerflow/import-staging`, deliberately **not** under
`poker-backend/uploads` — [src/server.js](poker-backend/src/server.js) serves
that directory publicly with `express.static`, so staging there would publish
every uploaded hand history at a guessable URL.

- **Boot probe** — writes and deletes a probe file, logging
  `IMPORTS DISABLED: <path> is not writable by uid <N>` on failure
  ([src/server.js:84-90](poker-backend/src/server.js#L84-L90)). This is what
  makes the failure mode in [IMPORT_STAGING_FIX.md](IMPORT_STAGING_FIX.md)
  visible from logs alone; before it, quiet logs were not evidence.
- **`resumeInterruptedJobs`** — the host filesystem is persistent (bare Node on
  a Linux box, not an ephemeral container), so a job interrupted by a restart
  still has its staged files and resumes from the first `pending` file instead
  of being failed and re-uploaded. Files already `done` are skipped, so no hand
  is imported twice. If the staged files are genuinely gone, the job fails
  cleanly rather than promising a resume it can't deliver.
- **`sweepOrphanedStagingDirs`** — deletes any directory with no live job, plus
  anything older than 7 days regardless. Without it, every failed or cancelled
  job leaks its staged files onto the same disk mongod lives on.
- **Inline path** — `prepareCsvUpload` cleans up on `'close'` rather than
  `'finish'`, because `'close'` fires for an aborted connection too, which is
  exactly the case that would otherwise leak a directory of half-uploaded files.

## Deployment notes

- [poker-frontend/nginx.conf](poker-frontend/nginx.conf) is **not used in
  production** — it is only consumed by the Dockerfile. The live nginx, which
  enforces the 32MB body cap this whole batching scheme is built around, is
  hand-maintained on the server; the copy to install lives in
  [deploy/nginx/](deploy/nginx/). `docker-compose.yml` is stale for the same
  reason (local mongo container, `NODE_ENV=development`).
- The staging directory must be listed in the systemd unit's `ReadWritePaths=`.
  `ProtectSystem=strict` mounts everything else read-only inside the service's
  mount namespace regardless of Unix ownership, and the boot `mkdir` succeeds
  silently when the directory already exists. See
  [IMPORT_STAGING_FIX.md](IMPORT_STAGING_FIX.md) for the `nsenter` test that is
  the only check which actually proves the path is writable.
