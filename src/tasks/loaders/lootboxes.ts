import { S3Client } from '@aws-sdk/client-s3'
import { ResizeFit, Transformer } from '@napi-rs/image'
import { Glob } from 'bun'
import { clickhouse } from '@/db'
import { uploader } from '@/utils/assetsUploader'
import { filenameAndExtension, I18n, type Snapshot } from '@/utils/utils'
import sharp from 'sharp'


export async function loadWot(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {
  const upload = uploader(snapshot, bucket)
  const uploading: Promise<void>[] = []

  const lootboxes = Array.from(i18n.translations.entries())
    .filter(([key]) => key.startsWith('lootbox_'))
    .map(([key, localization]) => ([key, localization] as const))
    .flatMap(([key, localization]) => {
      const tag = key.slice('lootbox_'.length)
      const entries = localization.translations.entries().map(([language, gettext]) => {
        const keys = [...gettext.getAll()
          .keys()
          .filter(key => key.startsWith('common/boxCategory/lowerCase/'))]

        return keys
      })

      return [...new Set([...entries].flat()).keys()].map(t => `#lootbox_${tag}:${t}`)
    })

  for (const localeKey of lootboxes) {
    const categoryKey = localeKey.split(':')[1]!.split('/').at(-1)

    let largestFile: Bun.BunFile | null = null
    for (const size of ['s600x450', 's400x300', 's360x270', 's296x222', 's180x135', 's160x120']) {
      const largeFile = Bun.file(`${root}/sources/base/res/gui/maps/icons/quests/bonuses/${size}/lootBox_${categoryKey}.png`)

      if (!await largeFile.exists()) continue
      largestFile = largeFile
      break
    }

    if (!largestFile) continue

    const largePngBytes = await largestFile.image().resize(600, 450).png().toBuffer()
    const largeWebpBuffer = await sharp(largePngBytes).webp({ quality: 75, alphaQuality: 20, smartSubsample: true }).toBuffer()

    const smallFile = await sharp(await largestFile.bytes())
      .resize({
        width: 160,
        height: 106,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer()

    const smallWebpBuffer = await sharp(smallFile).webp({ quality: 80 }).toBuffer()

    uploading.push(upload(`lootboxes/large/${categoryKey}.png`, largePngBytes))
    uploading.push(upload(`lootboxes/large/${categoryKey}.webp`, largeWebpBuffer))
    uploading.push(upload(`lootboxes/small/${categoryKey}.png`, smallFile))
    uploading.push(upload(`lootboxes/small/${categoryKey}.webp`, smallWebpBuffer))
  }

  return { uploading, lootboxes }
}


export async function loadMt(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {
  const upload = uploader(snapshot, bucket)
  const uploading: Promise<void>[] = []

  const lootboxes = Array.from(i18n.getAllTranslations('lootboxes').keys())
    .filter(key => key.startsWith('userName/'))
    .map(key => `#lootboxes:${key}`)


  const files = [...new Glob(`${root}/sources/base/res/gui_lootboxes/gui/maps/lootboxes/160x106/*.png`).scanSync()]

  for (const filePath of files) {
    const fileContent = await Bun.file(filePath).bytes()

    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath)

    const webpBuffer = await sharp(fileContent).webp({ quality: 80, alphaQuality: 50 }).toBuffer()
    uploading.push(upload(`lootboxes/small/${name}.png`, fileContent))
    uploading.push(upload(`lootboxes/small/${name}.webp`, webpBuffer))


    let hasLargeFile = false
    for (const size of ['s600x450', 's400x300', 's360x270', 's296x222', 's180x135', 's160x120']) {
      const largeFile = Bun.file(`${root}/sources/base/res/gui/maps/icons/quests/bonuses/${size}/${name}.png`)

      if (await largeFile.exists()) {
        const largePngBytes = await largeFile.image().resize(600, 450).png().bytes()
        const largeWebpBuffer = await sharp(largePngBytes).webp({ quality: 75, alphaQuality: 20, smartSubsample: true }).toBuffer()

        uploading.push(upload(`lootboxes/large/${name}.png`, largePngBytes))
        uploading.push(upload(`lootboxes/large/${name}.webp`, largeWebpBuffer))

        hasLargeFile = true
        break
      }
    }

    if (!hasLargeFile) {
      const upscaleBuffer = await sharp(fileContent)
        .resize({
          width: 600,
          height: 450,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .sharpen()
        .toBuffer()

      const upscaleWebpBuffer = await sharp(upscaleBuffer).webp({ quality: 75, alphaQuality: 20, smartSubsample: true }).toBuffer()

      uploading.push(upload(`lootboxes/large/${name}.png`, upscaleBuffer))
      uploading.push(upload(`lootboxes/large/${name}.webp`, upscaleWebpBuffer))
    }
  }

  return { uploading, lootboxes }
}

export async function load(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {

  console.log('Uploading lootboxes...')
  const { uploading, lootboxes } = snapshot.vendor === 'wot'
    ? await loadWot(root, snapshot, i18n, bucket)
    : await loadMt(root, snapshot, i18n, bucket)

  await Promise.all(uploading)
  console.log(`Lootboxes uploaded (${uploading.length / 2}x2 files)`)

  const lootboxesInserted = lootboxes.map(key => {
    const tag = key.split('/').at(-1)
    return {
      region: `${snapshot.realm}`,
      gameVersionFull: snapshot.full,
      gameVersion: snapshot.version,
      gameVersionHash: snapshot.hash,
      gameVersionComp: snapshot.comparable,
      datetime: Math.round(Date.now() / 1000),
      tag,
      name: tag,
      localization: i18n.getTranslation(key),
    }
  })

  console.log('Inserting lootboxes...')
  await clickhouse.insert({
    table: 'WOT.Lootboxes',
    values: lootboxesInserted,
    format: 'JSONEachRow'
  })
  console.log(`Inserted lootboxes (${lootboxesInserted.length} lines)`)
}
