# wotstat-assets-uploader

The uploader reads a sealed `GameSnapshot` from `DATA_DIR`, writes temporary data to ClickHouse,
and publishes temporary S3 objects.

## Local run

Copy `.example.env` to `.env`, fill the connection settings, and run:

```bash
bun install --frozen-lockfile
bun run start
```

`DATA_DIR` must point to the root of a sealed snapshot containing `snapshot.json`, `READY`, and
the `sources` tree.

## Reusable workflow

`.github/workflows/upload-snapshot.yml` is called by `game-unpack-pipeline`. Its interface accepts
the dedicated JIT runner label, sealed snapshot path, expected snapshot identity and descriptor
digest, target, and the name of the caller Environment that owns its settings. The workflow checks
the immutable handoff before running the uploader.

The caller Environment must define these secrets:

- `CLICKHOUSE_PASSWORD`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

It must also define these variables:

- `CLICKHOUSE_HOST`
- `CLICKHOUSE_USER`
- `AWS_REGION`
- `AWS_ENDPOINT_URL`
- `AWS_BUCKET`

`DATA_DIR` is supplied by the pipeline and must not be stored as a secret.
