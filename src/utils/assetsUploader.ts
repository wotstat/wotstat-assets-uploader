import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { Snapshot } from './utils'

const defaultConfig = {
  Bucket: Bun.env.AWS_BUCKET,
  CacheControl: 'max-age=86400', // 1 day
  StorageClass: 'STANDARD_IA'
} as const

function contentTypeGenerate(path: string) {
  const ext = path.split('.').pop()?.toLowerCase()

  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'gif') return 'image/gif'
  return 'application/octet-stream'
}

export function uploader(snapshot: Snapshot, bucket: S3Client) {
  const version = snapshot.version
  const namespace = (() => {
    if (snapshot.target === 'wot-common-test') return 'wot-test'
    if (snapshot.target === 'mt-public-test') return 'mt-test'
    return snapshot.vendor
  })()

  return async (path: string, content: PutObjectCommand['input']['Body']) => {

    const contentType = contentTypeGenerate(path)

    await bucket.send(new PutObjectCommand({
      ...defaultConfig,
      ContentType: contentType,
      Key: `tmp/${namespace}/latest/${path}`,
      Body: content,
      CacheControl: 'max-age=3600' // 1 hour
    }))

    await bucket.send(new PutObjectCommand({
      ...defaultConfig,
      ContentType: contentType,
      Key: `tmp/${namespace}/${version}/${path}`,
      Body: content,
      CacheControl: 'max-age=31622400' // 1 year
    }))
  }
}
