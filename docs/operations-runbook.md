# Operations Runbook

## Deploy

1. `npm ci`
2. `pip install -r requirements.txt`
3. `npx prisma generate`
4. `npx prisma db push`
5. `npm run build`
6. `npm run start`

## Monitor

- API error rates for `/api/companies/*/blueprints/*`
- Dead-letter queue via `GET /api/admin/dead-letter-jobs`
- Job transitions via `GET /api/jobs/{jobId}/status`
- Export validity via `GET /api/jobs/{jobId}/exports`

Healthy system:
- Jobs reach `validated`/`approved`
- Export artifacts all `isValid=true`
- Dead-letter backlog near zero

## Recover

- Re-run from wall: `POST /api/jobs/{jobId}/rerun?from_wall={wallId}`
- Reprocess failed jobs from dead-letter after correcting root cause.
- Restore DB from backup and regenerate Prisma client.

## Rollback

1. Stop app process.
2. Restore previous app release.
3. Restore prior DB snapshot if schema mismatch is introduced.
4. Restart and verify key endpoints.

## On-call Decision Tree

- Symptom: upload succeeds, no model
  - Check Python dependencies and `generate_3d.py` errors.
- Symptom: model exists, no exports
  - Check `ExportArtifact` rows and file permissions.
- Symptom: corrections saved but no learning
  - Check `ReasoningCorrection`, `ElasticMemory`, and FAISS write path.
