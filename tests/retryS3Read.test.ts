import { expect, test } from 'bun:test'
import { retryS3Read } from '../src/utils/retryS3Read'

test('retries ConnectionRefused from historical image reads', async () => {
  let calls = 0
  const sleeps: number[] = []
  const result = await retryS3Read(async () => {
    if (++calls < 3) throw Object.assign(new Error('an unexpected error has occurred'), { code: 'ConnectionRefused' })
    return new Uint8Array([1, 2, 3])
  }, [1000, 3000], async delay => { sleeps.push(delay) })
  expect(result).toEqual(new Uint8Array([1, 2, 3]))
  expect(sleeps).toEqual([1000, 3000])
})

for (const code of ['ConnectionRefused', 'AccessDenied', 'NoSuchKey']) {
  test(`preserves ${code} failure after bounded attempts`, async () => {
    const error = Object.assign(new Error('S3 read failed'), { code })
    let calls = 0
    await expect(retryS3Read(async () => {
      calls++
      throw error
    }, [0, 0], async () => {})).rejects.toBe(error)
    expect(calls).toBe(code === 'ConnectionRefused' ? 3 : 1)
  })
}
