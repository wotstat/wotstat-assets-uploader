import { verifySnapshotHandoff } from '../src/snapshotHandoff'

await verifySnapshotHandoff({
  snapshotPath: Bun.env.DATA_DIR ?? '',
  expectedSnapshotId: Bun.env.EXPECTED_SNAPSHOT_ID ?? '',
  expectedDescriptorSha256: Bun.env.EXPECTED_DESCRIPTOR_SHA256 ?? '',
  expectedTarget: Bun.env.EXPECTED_TARGET ?? '',
})

console.log('Sealed GameSnapshot handoff verified')
