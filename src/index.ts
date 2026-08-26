import { load } from './tasks'

console.log(`Starting from ${Bun.env.DATA_DIR}...`)
await load(Bun.env.DATA_DIR)
console.log('Done!')
