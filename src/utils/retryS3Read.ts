const transientCodes = new Set([
  'ConnectionRefused', 'ConnectionReset', 'ConnectionClosed', 'ConnectionTimedOut',
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'EAI_AGAIN',
  'RequestTimeout', 'RequestTimeoutException', 'SlowDown', 'InternalError',
  'ServiceUnavailable', 'TimeoutError'
])

// Only wrap S3 reads. Exhaustion and permanent errors still fail the loader.
export async function retryS3Read<T>(
  operation: () => Promise<T>,
  delays: readonly number[] = [1000, 3000, 10000],
  sleep: (milliseconds: number) => Promise<unknown> = Bun.sleep
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code) : ''
      if (!transientCodes.has(code) || attempt >= delays.length) throw error
      console.warn(`S3 read retry ${attempt + 1}/${delays.length}: ${code}`)
      await sleep(delays[attempt]!)
    }
  }
}
