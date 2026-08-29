import { Glob } from 'bun'
import { S3Client } from '@aws-sdk/client-s3'
import { uploader } from '@/utils/assetsUploader'
import { filenameAndExtension, I18n, type Snapshot as Snapshot } from '../../utils/utils'
import { parseStringPromise } from 'xml2js'

type Item = {
  icon: string,
}


type List = {
  [key: string]: Item
}

export async function load(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {

  const upload = uploader(snapshot, bucket)

  console.log('Uploading OptionalDevices and Equipments icons...')

  const equipmentsData = await Bun.file(`${root}/sources/base/res/scripts/item_defs/vehicles/common/equipments.xml`).text()
  const equipments = await parseStringPromise(equipmentsData, { explicitArray: false, explicitRoot: false }) as List

  const devicesData = await Bun.file(`${root}/sources/base/res/scripts/item_defs/vehicles/common/optional_devices.xml`).text()
  const devices = await parseStringPromise(devicesData, { explicitArray: false, explicitRoot: false }) as List

  const icons = new Set<string | undefined>([...Object.values(equipments).map(e => e.icon), ...Object.values(devices).map(d => d.icon)])
  icons.delete(undefined)

  const basePath = `${root}/sources/base/res/gui/maps`
  const small = [...new Glob(`${basePath}/icons/artefact/*.png`).scanSync()]
  const medium = [...new Glob(`${basePath}/shop/artefacts/180x135/*.png`).scanSync()]
  const large = [...new Glob(`${basePath}/shop/artefacts/360x270/*.png`).scanSync()]
  const extraLarge = [...new Glob(`${basePath}/shop/artefacts/600x450/*.png`).scanSync()]

  const fallbackMedium = [...new Glob(`${basePath}/icons/quests/bonuses/s180x135/*.png`).scanSync()]
  const fallbackLarge = [...new Glob(`${basePath}/icons/quests/bonuses/s360x270/*.png`).scanSync()]
  const fallbackExtraLarge = [...new Glob(`${basePath}/icons/quests/bonuses/s600x450/*.png`).scanSync()]


  const targetIcons = icons.values().map(icon => ({
    icon,
    small: small.find(filePath => filenameAndExtension(filePath).nameWithoutExt === icon),
    medium: medium.find(filePath => filenameAndExtension(filePath).nameWithoutExt === icon) || fallbackMedium.find(filePath => filenameAndExtension(filePath).nameWithoutExt === icon),
    large: large.find(filePath => filenameAndExtension(filePath).nameWithoutExt === icon) || fallbackLarge.find(filePath => filenameAndExtension(filePath).nameWithoutExt === icon),
    extraLarge: extraLarge.find(filePath => filenameAndExtension(filePath).nameWithoutExt === icon) || fallbackExtraLarge.find(filePath => filenameAndExtension(filePath).nameWithoutExt === icon)
  }))

  for (const icon of targetIcons) {
    const smallFile = icon.small ? Bun.file(icon.small) : null
    const mediumFile = icon.medium ? Bun.file(icon.medium) : null
    const largeFile = icon.large ? Bun.file(icon.large) : null
    const extraLargeFile = icon.extraLarge ? Bun.file(icon.extraLarge) : null

    if (!smallFile && !mediumFile && !largeFile && !extraLargeFile) continue

    const smallFileBytes = smallFile?.bytes() ??
      mediumFile?.image().resize(48, 48, { fit: 'inside' }).bytes() ??
      largeFile?.image().resize(48, 48, { fit: 'inside' }).bytes() ??
      extraLargeFile?.image().resize(48, 48, { fit: 'inside' }).bytes()

    const mediumFileBytes = mediumFile?.bytes() ??
      largeFile?.image().resize(180, 135).bytes() ??
      extraLargeFile?.image().resize(180, 135).bytes() ??
      smallFile?.image().resize(180, 135, { fit: 'inside' }).bytes()

    const largeFileBytes = largeFile?.bytes() ??
      mediumFile?.image().resize(360, 270).bytes() ??
      extraLargeFile?.image().resize(360, 270).bytes() ??
      smallFile?.image().resize(360, 270, { fit: 'inside' }).bytes()

    const extraLargeFileBytes = extraLargeFile?.bytes() ??
      largeFile?.image().resize(600, 450).bytes() ??
      mediumFile?.image().resize(600, 450).bytes() ??
      smallFile?.image().resize(600, 450, { fit: 'inside' }).bytes()

    const sizes = {
      small: smallFileBytes,
      medium: mediumFileBytes,
      large: largeFileBytes,
      extraLarge: extraLargeFileBytes
    }

    const uploading: Promise<void>[] = []
    for (const [size, fileBytes] of Object.entries(sizes)) {
      if (!fileBytes) continue

      const bytes = await fileBytes
      uploading.push(upload(`optionalDevices/${size}/${icon.icon}.png`, bytes))
      uploading.push(upload(`optionalDevices/${size}/${icon.icon}.webp`, await new Bun.Image(bytes).webp({ quality: 80 }).bytes()))
    }

    await Promise.all(uploading)
  }

  console.log('OptionalDevices and Equipments icons uploaded')
}
