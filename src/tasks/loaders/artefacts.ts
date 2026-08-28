import { S3Client } from '@aws-sdk/client-s3'
import { I18n, type Snapshot as Snapshot } from '../../utils/utils'
import { clickhouse } from '@/db'

export async function load(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {

  const artefacts = [
    ...i18n.getAllTranslations('artefacts').entries(),
    ...i18n.getAllTranslations('comp7.artefacts.extend').entries()
  ].filter(([key]) => key.endsWith('/name') || key.endsWith('/name/noTemplate'))

  const insertValues = artefacts.map(t => ({
    region: `tmp-${snapshot.realm}`,
    gameVersionFull: snapshot.full,
    gameVersion: snapshot.version,
    gameVersionHash: snapshot.hash,
    gameVersionComp: snapshot.comparable,
    datetime: Math.round(new Date().getTime() / 1000),

    tag: t[0].replace('/name/noTemplate', '').replace('/name', ''),
    name: t[0].replace('/name/noTemplate', '').replace('/name', ''),
    localization: t[1],
  }))


  console.log('Inserting artefacts...')
  await clickhouse.insert({
    table: 'WOT.Artefacts',
    values: insertValues,
    format: 'JSONEachRow'
  })
  console.log(`Artefacts inserted (${insertValues.length} lines)`)

}