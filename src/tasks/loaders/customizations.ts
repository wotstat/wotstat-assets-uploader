import { S3Client } from '@aws-sdk/client-s3'
import { I18n, type Snapshot as Snapshot } from '../../utils/utils'
import { clickhouse } from '@/db'

export async function load(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {

  const customization = [
    ...i18n.getAllTranslations('vehicle_customization').entries(),
  ].filter(([tag, value]) =>
    !tag.endsWith('/long') &&
    !tag.endsWith('/description') &&
    !tag.endsWith('_description') &&
    !tag.endsWith('/longDescription') &&
    !tag.endsWith('_desc') &&
    !tag.includes('/body') &&
    !tag.includes('/hint') &&
    !tag.includes('/tooltip') &&
    !tag.includes('/header') &&
    !tag.includes('/title') &&
    !tag.includes('/progression_conditions/') &&
    !tag.includes('questProgress/') &&
    !tag.startsWith('customization/') && // UI надписи страницы кастомизации
    !tag.startsWith('propertySheet/') &&
    !tag.startsWith('styleInfo/') &&
    !tag.startsWith('bonusName/') &&
    !tag.startsWith('window/') &&
    !tag.startsWith('elementBonus/') &&
    tag != '')

  const insertValues = customization.map(t => ({
    region: `tmp-${snapshot.realm}`,
    gameVersionFull: snapshot.full,
    gameVersion: snapshot.version,
    gameVersionHash: snapshot.hash,
    gameVersionComp: snapshot.comparable,
    datetime: Math.round(new Date().getTime() / 1000),

    tag: t[0],
    name: t[0],
    localization: t[1],
  }))


  console.log('Inserting customizations...')
  await clickhouse.insert({
    table: 'WOT.Customizations',
    values: insertValues,
    format: 'JSONEachRow'
  })
  console.log(`Customizations inserted (${insertValues.length} lines)`)
}
