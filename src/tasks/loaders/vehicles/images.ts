import { Glob } from 'bun'
import { uploader } from '@/utils/assetsUploader'
import { filenameAndExtension, I18n, type Snapshot as Snapshot } from '../../../utils/utils'
import sharp from 'sharp'

type Uploader = ReturnType<typeof uploader>

export async function loadShopImages(root: string, upload: Uploader) {
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

export async function loadSmall(root: string, upload: Uploader) {
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

export async function loadMedium(root: string, upload: Uploader) {
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

export async function loadPreview(root: string, upload: Uploader) {
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
