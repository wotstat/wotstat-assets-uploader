import { Glob } from 'bun'
import { S3Client } from '@aws-sdk/client-s3'
import { uploader } from '@/utils/assetsUploader'
import { filenameAndExtension, I18n, type Snapshot as Snapshot } from '../../utils/utils'


export async function load(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {

  const upload = uploader(snapshot, bucket)

  const files = [...new Glob(`${root}/sources/base/res/gui/maps/shop/shells/360x270/*.png`).scanSync()]
  for (const filePath of files) {
    const file = Bun.file(filePath)

    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath)

    const webpBytes = await file.image().webp({ quality: 80 }).bytes()
    await upload(`shells/${name}.png`, await file.bytes())
    await upload(`shells/${name}.webp`, webpBytes)
  }
}
