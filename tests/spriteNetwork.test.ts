import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { generateSmallSprite } from '../src/tasks/loaders/vehicles/generateSmallSprite'

test('sprite generation retries failed S3 reads and preserves historical images', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sprite-network-'))
  await mkdir(join(root, 'sources/base/res/gui/maps/icons/vehicle/small'), { recursive: true })
  const png = await sharp({ create: { width: 124, height: 31, channels: 4, background: 'red' } }).png().toBuffer()
  let lists = 0
  let reads = 0
  const key = 'wot/latest/vehicles/small/historical.png'
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      const url = new URL(request.url)
      if (url.searchParams.has('list-type')) {
        lists++
        if (lists === 1) return new Response('<Error><Code>ServiceUnavailable</Code></Error>', { status: 503 })
        return new Response(`<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>${key}</Key></Contents></ListBucketResult>`, { headers: { 'Content-Type': 'application/xml' } })
      }
      reads++
      if (reads === 1) return new Response('<Error><Code>ServiceUnavailable</Code></Error>', { status: 503 })
      return new Response(png)
    }
  })
  const names = ['AWS_ENDPOINT_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_BUCKET', 'AWS_REGION'] as const
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]))
  Object.assign(process.env, {
    AWS_ENDPOINT_URL: server.url.href,
    AWS_ACCESS_KEY_ID: 'test', AWS_SECRET_ACCESS_KEY: 'test', AWS_BUCKET: 'test', AWS_REGION: 'test'
  })
  const uploads = new Map<string, unknown>()
  try {
    await generateSmallSprite(root, 'wot', async (path, content) => { uploads.set(path, content) }, [128])
    expect(lists).toBe(2)
    expect(reads).toBe(2)
    expect(uploads.get('vehicles/small/atlas/128/atlases.json')).toContain('historical')
    expect(uploads.has('vehicles/small/atlas/128/atlas_0.png')).toBe(true)
  } finally {
    server.stop(true)
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]
      else Object.assign(process.env, { [name]: previous[name] })
    }
    await rm(root, { recursive: true, force: true })
  }
}, 15000)
