import { Glob } from 'bun'
import { S3Client } from '@aws-sdk/client-s3'
import { uploader } from '@/utils/assetsUploader'
import { filenameAndExtension, I18n, type Snapshot as Snapshot } from '../../../utils/utils'
import { parseStringPromise } from 'xml2js'
import sharp from 'sharp'
import { clickhouse } from '@/db'
import { loadMedium, loadPreview, loadShopImages, loadSmall } from './images'
import { generateSmallSprite } from './generateSmallSprite'

type Vehicle = {
  id: string,
  userString: string,
  shortUserString?: string,
  description?: string,
  price: string,
  tags: string,
  level: string
}

type VehicleList = {
  [key: string]: Vehicle
}

const typeSet = new Set(['lightTank', 'mediumTank', 'heavyTank', 'AT-SPG', 'SPG'] as const)
const roleSet = new Set(['role_HT_support', 'role_LT_wheeled', 'role_MT_support', 'role_ATSPG_universal', 'role_LT_universal', 'role_HT_break', 'role_HT_universal', 'role_SPG', 'role_SPG_flame', 'role_ATSPG_assault', 'role_ATSPG_sniper', 'role_SPG_assault', 'role_MT_assault', 'role_HT_assault', 'role_MT_sniper', 'role_MT_universal', 'role_ATSPG_support'] as const)

function getTypeFromTags(tags: string[]) {
  for (const tag of tags) if (typeSet.has(tag as any)) return tag
  return 'unknown'
}

function getRoleFromTags(tags: string[]) {
  for (const tag of tags) if (roleSet.has(tag as any)) return tag
  for (const tag of tags) if (tag.startsWith('role_')) return tag
  return null
}

async function getVehicles(root: string, i18n: I18n,) {
  const glob = new Glob(`${root}/sources/base/res/scripts/item_defs/vehicles/*/list.xml`)

  const vehicles: {
    tag: string,
    nation: string,
    type: string,
    role: string,
    level: number,
    name: string,
    shortName: string,
    nameLocalization: Record<string, string>,
    shortNameLocalization: Record<string, string>
  }[] = []

  for (const file of glob.scanSync()) {
    const nation = file.split('/').at(-2)!

    const data = await Bun.file(file).text()
    const parsed = await parseStringPromise(data, { explicitArray: false, explicitRoot: false }) as VehicleList

    const tanks = Object.entries(parsed)
      .filter(([key, value]) => 'id' in value)
      .map(([key, vehicle]) => {

        const tags = vehicle.tags.split(' ')
        const locales = i18n.getTranslation(vehicle.userString)
        const localesShort = i18n.getTranslation(vehicle.shortUserString || vehicle.userString)

        return {
          tag: `${nation}:${key}`,
          nation,
          type: getTypeFromTags(tags),
          role: getRoleFromTags(tags) ?? '',
          level: Number.parseInt(vehicle.level),
          name: `${nation}:${key}`,
          shortName: `${nation}:${key}`,
          nameLocalization: locales,
          shortNameLocalization: localesShort,
        }
      })

    vehicles.push(...tanks)
  }

  return vehicles
}

export async function load(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {
  const upload = uploader(snapshot, bucket)

  await loadShopImages(root, upload)
  await loadSmall(root, upload)
  await loadMedium(root, upload)
  await loadPreview(root, upload)

  await Promise.all([
    generateSmallSprite(root, snapshot.vendor, upload, [256, 512, 1024, 2048, 4096]),
    generateSmallSprite(root, snapshot.vendor, upload, [256, 512, 1024, 2048]),
    generateSmallSprite(root, snapshot.vendor, upload, [256, 512, 1024])
  ])

  const vehicles = await getVehicles(root, i18n)
  const vehiclesInserted = vehicles.map(vehicle => {
    return {
      region: `${snapshot.realm}`,
      gameVersionFull: snapshot.full,
      gameVersion: snapshot.version,
      gameVersionHash: snapshot.hash,
      gameVersionComp: snapshot.comparable,
      datetime: Math.round(Date.now() / 1000),
      ...vehicle
    }
  })

  console.log('Inserting Vehicles...')
  await clickhouse.insert({
    table: 'WOT.Vehicles',
    values: vehiclesInserted,
    format: 'JSONEachRow'
  })
  console.log(`Vehicles inserted (${vehiclesInserted.length} vehicles)`)
}
