import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { basename, isAbsolute } from 'node:path'

const SNAPSHOT_ID = /^sha256:[a-f0-9]{64}$/
const SHA256 = /^[a-f0-9]{64}$/

type SnapshotDescriptor = {
  contract?: unknown
  contract_version?: unknown
  snapshot_id?: unknown
  source?: {
    target?: unknown
  }
}

async function readonlyRegularFile(path: string): Promise<Buffer> {
  const metadata = await lstat(path)
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${basename(path)} is not a regular file`)
  }
  if ((metadata.mode & 0o222) !== 0) {
    throw new Error(`${basename(path)} is writable`)
  }
  return readFile(path)
}

export async function verifySnapshotHandoff(options: {
  snapshotPath: string
  expectedSnapshotId: string
  expectedDescriptorSha256: string
  expectedTarget: string
}): Promise<void> {
  const {
    snapshotPath,
    expectedSnapshotId,
    expectedDescriptorSha256,
    expectedTarget,
  } = options

  if (!isAbsolute(snapshotPath)) throw new Error('snapshot path must be absolute')
  if (!SNAPSHOT_ID.test(expectedSnapshotId)) throw new Error('expected snapshot id is invalid')
  if (!SHA256.test(expectedDescriptorSha256)) {
    throw new Error('expected descriptor SHA-256 is invalid')
  }
  if (!expectedTarget.trim()) throw new Error('expected target is empty')

  const rootMetadata = await lstat(snapshotPath)
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error('snapshot path is not a real directory')
  }
  if ((rootMetadata.mode & 0o222) !== 0) throw new Error('snapshot directory is writable')
  if (basename(snapshotPath) !== expectedSnapshotId) {
    throw new Error('snapshot directory name does not match expected snapshot id')
  }

  const descriptorBytes = await readonlyRegularFile(`${snapshotPath}/snapshot.json`)
  const descriptorSha256 = createHash('sha256').update(descriptorBytes).digest('hex')
  if (descriptorSha256 !== expectedDescriptorSha256) {
    throw new Error('snapshot descriptor digest does not match the builder output')
  }

  const readyBytes = await readonlyRegularFile(`${snapshotPath}/READY`)
  if (!readyBytes.equals(Buffer.from(`sha256:${descriptorSha256}\n`))) {
    throw new Error('READY does not match snapshot.json')
  }

  let descriptor: SnapshotDescriptor
  try {
    descriptor = JSON.parse(descriptorBytes.toString('utf8')) as SnapshotDescriptor
  } catch (error) {
    throw new Error('snapshot.json is invalid JSON', { cause: error })
  }
  if (descriptor.contract !== 'game-snapshot' || descriptor.contract_version !== '1.1.0') {
    throw new Error('snapshot contract is not supported')
  }
  if (descriptor.snapshot_id !== expectedSnapshotId) {
    throw new Error('snapshot descriptor identity does not match the builder output')
  }
  if (descriptor.source?.target !== expectedTarget) {
    throw new Error('snapshot target does not match the requested target')
  }
}
