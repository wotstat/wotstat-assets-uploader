import { S3Client } from '@aws-sdk/client-s3'
import { I18n, type Snapshot as Snapshot } from '../../utils/utils'
import { clickhouse } from '@/db'
import { parseStringPromise } from 'xml2js'

export async function load(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {

  const pathsFile = Bun.file(`${root}/sources/base/paths.xml`)

  if (!pathsFile.exists()) return

  const paths = await parseStringPromise(await pathsFile.text(), { explicitArray: false, trim: true })

  const modsPath = paths['root']['Paths']['Path'].find((t: any) => t['_'].match(/\.\/mods\/.*/))

  if (!modsPath) return console.warn('No mods path found')

  const modsPathValue = modsPath['_']
  const modsFolderName = modsPathValue.replace('./mods/', '')


  console.log('Inserting game version...')
  await clickhouse.insert({
    table: 'WOT.GameVersions',
    values: [
      {
        region: `${snapshot.realm}`,
        gameVersionFull: snapshot.full,
        gameVersion: snapshot.version,
        gameVersionHash: snapshot.hash,
        gameVersionComp: snapshot.comparable,
        datetime: Math.round(new Date().getTime() / 1000),

        modsFolderName: modsFolderName,
      }
    ],
    format: 'JSONEachRow'
  })
  console.log('Game version inserted')

}