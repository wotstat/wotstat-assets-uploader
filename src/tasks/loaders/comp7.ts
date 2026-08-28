import { S3Client } from '@aws-sdk/client-s3'
import { Glob } from 'bun'
import { uploader } from '@/utils/assetsUploader'
import { filenameAndExtension, type I18n, type Snapshot } from '@/utils/utils'

function process(path: string, size: string, season: string, upload: ReturnType<typeof uploader>) {
  return [...new Glob(path).scanSync()].map(async filePath => {
    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath)

    const file = Bun.file(filePath)
    const webpBuffer = await file.image().webp({ quality: 85 }).toBuffer()
    const pngBuffer = await file.image().png().toBuffer()

    await upload(`comp7/ranks/${season}/${size}/${name}.png`, pngBuffer)
    await upload(`comp7/ranks/${season}/${size}/${name}.webp`, webpBuffer)
    await upload(`comp7/ranks/latest/${size}/${name}.png`, pngBuffer)
    await upload(`comp7/ranks/latest/${size}/${name}.webp`, webpBuffer)
  })
}

function processRoleSkills(path: string, season: string, upload: ReturnType<typeof uploader>) {
  return [...new Glob(path).scanSync()].map(async filePath => {
    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath)

    const file = Bun.file(filePath)
    const webpBuffer = await file.image().webp({ quality: 85 }).toBuffer()
    const pngBuffer = await file.image().png().toBuffer()

    await upload(`comp7/skills/${season}/${name}.png`, pngBuffer)
    await upload(`comp7/skills/${season}/${name}.webp`, webpBuffer)
    await upload(`comp7/skills/latest/${name}.png`, pngBuffer)
    await upload(`comp7/skills/latest/${name}.webp`, webpBuffer)
  })
}

async function processMt(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {
  const upload = uploader(snapshot, bucket)

  const common = await Bun.file(`${root}/sources/base/res/scripts/common/comp7_common.py`).text()
  const currentSeason = /COMP7_CURRENT_SEASON = (\d+)/.exec(common)?.[1]
  const maskotId = /COMP7_MASKOT_ID = b'(\d+)'/.exec(common)?.[1]
  const season = `comp7_${maskotId}_${currentSeason}`

  const uploadings = [
    process(`${root}/sources/base/res/comp7/gui/maps/icons/comp7/ranks/420/*.png`, 'large', season, upload),
    process(`${root}/sources/base/res/comp7/gui/maps/icons/comp7/ranks/150/*.png`, 'medium', season, upload),
    process(`${root}/sources/base/res/comp7/gui/maps/icons/comp7/ranks/84/*.png`, 'small', season, upload),
    processRoleSkills(`${root}/sources/base/res/gui/maps/icons/roleSkills/180x180/*.png`, season, upload)
  ].flat()

  return { uploadings }
}

async function processWot(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {
  const upload = uploader(snapshot, bucket)

  const common = await Bun.file(`${root}/sources/base/res/comp7/scripts/common/comp7_common_const.py`).text()
  const seasonsInYear = /SEASONS_IN_YEAR = (\d+)/.exec(common)?.[1]
  const maskotId = /COMP7_MASKOT_ID = b'(\d+)'/.exec(common)?.[1]

  const seasons = ['first', 'second', 'third', 'fourth', 'fifth'].slice(0, seasonsInYear ? parseInt(seasonsInYear) : 0)

  const uploadings = seasons.map((seasonName, index) => {
    const season = `comp7_${maskotId}_${index + 1}`
    return [
      process(`${root}/sources/base/res/comp7/gui/maps/icons/ranks/${seasonName}/420/*.png`, 'large', season, upload),
      process(`${root}/sources/base/res/comp7/gui/maps/icons/ranks/${seasonName}/150/*.png`, 'medium', season, upload),
      process(`${root}/sources/base/res/comp7/gui/maps/icons/ranks/${seasonName}/84/*.png`, 'small', season, upload),
      processRoleSkills(`${root}/sources/base/res/gui/maps/icons/roleSkills/180x180/*.png`, season, upload)
    ].flat()
  })

  return { uploadings }
}

export async function load(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {
  console.log(`Uploading comp7 ranks and role skills...`);

  const { uploadings } = snapshot.vendor === 'mt'
    ? await processMt(root, snapshot, i18n, bucket)
    : await processWot(root, snapshot, i18n, bucket)

  await Promise.all(uploadings)
  console.log(`Comp7 ranks and role skills uploaded (${uploadings.length / 2}x2 files)`);
}