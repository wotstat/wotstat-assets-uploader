import { Glob } from 'bun'
import { S3Client } from '@aws-sdk/client-s3'
import { uploader } from '@/utils/assetsUploader'
import { filenameAndExtension, I18n, type Snapshot as Snapshot } from '../../utils/utils'
import { parseStringPromise } from 'xml2js'
import sharp from 'sharp'
import { clickhouse } from '@/db'

type Uploader = ReturnType<typeof uploader>

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

async function loadShopImages(root: string, upload: Uploader) {
  const uploading: Promise<void>[] = []
  const shop = [...new Glob(`${root}/sources/base/res/gui/maps/shop/vehicles/600x450/*.png`).scanSync()]

  for (const filePath of shop) {
    const fileContent = await Bun.file(filePath).bytes()

    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath)
    const targetName = name.toLowerCase()

    const webpBuffer = await sharp(fileContent).webp({ quality: 80, alphaQuality: 70 }).toBuffer()
    uploading.push(upload(`vehicles/shop/${targetName}.png`, fileContent))
    uploading.push(upload(`vehicles/shop/${targetName}.webp`, webpBuffer))
  }

  await Promise.all(uploading)
  console.log(`Vehicles shop images loaded (${uploading.length / 2} files)`)
}

async function loadSmall(root: string, upload: Uploader) {
  const uploading: Promise<void>[] = []
  const small = [...new Glob(`${root}/sources/base/res/gui/maps/icons/vehicle/small/*-*.png`).scanSync()]

  for (const filePath of small) {
    const file = Bun.file(filePath)

    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath)
    const targetName = name.split('-').slice(1).join('-').toLowerCase()

    const webpBytes = await file.image().webp({ quality: 80 }).bytes()
    uploading.push(upload(`vehicles/small/${targetName}.png`, await file.bytes()))
    uploading.push(upload(`vehicles/small/${targetName}.webp`, webpBytes))
  }

  const smallNoImage = Bun.file(`${root}/sources/base/res/gui/maps/icons/vehicle/small/noImage.png`)
  if (await smallNoImage.exists()) {
    const webpBytes = await smallNoImage.image().webp({ quality: 80 }).bytes()
    uploading.push(upload('vehicles/small/no-image.png', await smallNoImage.bytes()))
    uploading.push(upload('vehicles/small/no-image.webp', webpBytes))
  }

  await Promise.all(uploading)
  console.log(`Vehicles small images loaded (${uploading.length / 2} files)`)

}

async function loadMedium(root: string, upload: Uploader) {
  const uploading: Promise<void>[] = []
  const medium = [...new Glob(`${root}/sources/base/res/gui/maps/icons/vehicle/420x307/*.png`).scanSync()]

  for (const filePath of medium) {
    const file = Bun.file(filePath)

    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath)
    const targetName = name.toLowerCase()

    const webpBytes = await file.image().webp({ quality: 80 }).bytes()
    uploading.push(upload(`vehicles/medium/${targetName}.png`, await file.bytes()))
    uploading.push(upload(`vehicles/medium/${targetName}.webp`, webpBytes))
  }

  await Promise.all(uploading)
  console.log(`Vehicles medium images loaded (${uploading.length / 2} files)`)
}

async function loadPreview(root: string, upload: Uploader) {
  ``
  const uploading: Promise<void>[] = []
  const preview = [...new Glob(`${root}/sources/base/res/gui/maps/icons/vehicle/*-*.png`).scanSync()]

  for (const filePath of preview) {
    const file = Bun.file(filePath)

    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath)
    const targetName = name.split('-').slice(1).join('-').toLowerCase()

    const webpBytes = await file.image().webp({ quality: 80 }).bytes()
    uploading.push(upload(`vehicles/preview/${targetName}.png`, await file.bytes()))
    uploading.push(upload(`vehicles/preview/${targetName}.webp`, webpBytes))
  }

  const previewNoImage = Bun.file(`${root}/sources/base/res/gui/maps/icons/vehicle/noImage.png`)
  if (await previewNoImage.exists()) {
    const webpBytes = await previewNoImage.image().webp({ quality: 80 }).bytes()
    uploading.push(upload('vehicles/preview/no-image.png', await previewNoImage.bytes()))
    uploading.push(upload('vehicles/preview/no-image.webp', webpBytes))
  }

  await Promise.all(uploading)
  console.log(`Vehicles preview images loaded (${uploading.length / 2} files)`)
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

  const vehicles = await getVehicles(root, i18n)

  await loadShopImages(root, upload)
  await loadSmall(root, upload)
  await loadMedium(root, upload)
  await loadPreview(root, upload)

  const vehiclesInserted = vehicles.map(vehicle => {
    return {
      region: `tmp-${snapshot.realm}`,
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
