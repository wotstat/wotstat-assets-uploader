const requiredEnvironment = [
  'CLICKHOUSE_HOST',
  'CLICKHOUSE_USER',
  'CLICKHOUSE_PASSWORD',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'AWS_ENDPOINT_URL',
  'AWS_BUCKET',
  'DATA_DIR',
] as const

const missingEnvironment = requiredEnvironment.filter(name => !Bun.env[name]?.trim())
if (missingEnvironment.length > 0) {
  throw new Error(`Missing required environment: ${missingEnvironment.join(', ')}`)
}

const dataDirectory = Bun.env.DATA_DIR!
const { load } = await import('./tasks')

console.log(`Starting from ${dataDirectory}...`)
await load(dataDirectory)
console.log('Done!')
