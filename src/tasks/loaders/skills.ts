import { S3Client } from '@aws-sdk/client-s3'
import { Glob } from 'bun'
import { uploader } from '@/utils/assetsUploader'
import { filenameAndExtension, type I18n, type Snapshot } from '@/utils/utils'

export async function load(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {
  console.log('Uploading skills icons...')


  const upload = uploader(snapshot, bucket)

  const extraLarge = [...new Glob(`${root}/sources/base/res/gui/maps/icons/tankmen/skills/dialogs/*.png`).scanSync()]
  const big = [...new Glob(`${root}/sources/base/res/gui/maps/icons/tankmen/skills/big/*.png`).scanSync()]

  const intersectedNames = new Set(extraLarge.map(filePath => filenameAndExtension(filePath).nameWithoutExt))
    .intersection(new Set(big.map(filePath => filenameAndExtension(filePath).nameWithoutExt)))


  const uploadings: Promise<void>[] = []
  for (const filePath of extraLarge) {
    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath)
    if (!intersectedNames.has(name)) continue

    const file = Bun.file(filePath)
    const webpBytes = await file.image().webp({ quality: 80 }).bytes()
    uploadings.push(upload(`skills/large/${name}.png`, await file.bytes()))
    uploadings.push(upload(`skills/large/${name}.webp`, webpBytes))
  }

  for (const filePath of big) {
    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath)
    if (!intersectedNames.has(name)) continue

    const file = Bun.file(filePath)
    const webpBytes = await file.image().webp({ quality: 80 }).bytes()
    uploadings.push(upload(`skills/medium/${name}.png`, await file.bytes()))
    uploadings.push(upload(`skills/medium/${name}.webp`, webpBytes))
  }

  await Promise.all(uploadings)

  console.log(`Uploaded ${uploadings.length / 2}x2 skills icons.`)

}
