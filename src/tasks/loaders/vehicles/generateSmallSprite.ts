import { Glob, S3Client } from 'bun'
import { uploader } from '@/utils/assetsUploader'
import { filenameAndExtension, I18n, type Snapshot as Snapshot } from '../../../utils/utils'
import sharp, { type OverlayOptions } from 'sharp'
import { createSpriteAtlas } from '@/utils/spriteAtlas'


type Uploader = ReturnType<typeof uploader>

async function spriteFixer(tag: string, img: string | Buffer): Promise<string | Buffer> {

  switch (tag) {
    case 'pl17_ds_pzlnz_sh':
    case 's14_ikv_103_sh':
    case 'gb107_cavalier_sh':
    case 'f43_amc_35_sh':
    case 'ch24_type64_sh':
    case 'a72_t25_2_sh':
    case 'g24_vk3002db_sh':
    case 'r46_kv-13_sh':
      const result = sharp(img)
      const metadata = await result.metadata()

      result.extract({ left: 50, top: 0, width: metadata.width - 50, height: metadata.height })
      return result.toBuffer()

    default: break
  }

  return img
}

function imageName(path: string) {
  const { nameWithoutExt: name, ext } = filenameAndExtension(path)
  return name.split('-').slice(1).join('-').toLowerCase()
}

async function loadExistingKeys(bunClient: S3Client, game: 'mt' | 'wot') {

  let continuationToken: string | undefined = undefined
  let data: string[] = []

  do {
    const list = await bunClient.list({
      prefix: `${game}/latest/vehicles/small/`,
      continuationToken,
      maxKeys: 1000
    })

    continuationToken = list.nextContinuationToken
    data.push(...list.contents?.map(item => item.key) ?? [])

  } while (continuationToken)

  return data
}

export async function generateSmallSprite(root: string, game: 'mt' | 'wot', upload: Uploader, resolutions: number[]) {
  const bunClient = new S3Client({ endpoint: Bun.env.AWS_ENDPOINT_URL })
  const maxResolution = Math.max(...resolutions)

  const keys = (await loadExistingKeys(bunClient, game)).filter(key => key.endsWith('.png'))
  const small = [...new Glob(`${root}/sources/base/res/gui/maps/icons/vehicle/small/*-*.png`).scanSync()]

  const res = new Set(small.map(imageName)).add('no-image')
  const needToLoad = keys
    .filter(t => !res.has(filenameAndExtension(t).nameWithoutExt))
    .filter(t => !t.includes('/atlas/'))

  const loaded = new Map<string, Buffer | string>()
  for (const element of needToLoad) loaded.set(filenameAndExtension(element).nameWithoutExt, Buffer.from(await bunClient.file(element).bytes()))
  for (const element of small) loaded.set(imageName(element), element)

  const smallNoImage = Bun.file(`${root}/sources/base/res/gui/maps/icons/vehicle/small/noImage.png`)
  if (await smallNoImage.exists()) loaded.set('no-image', Buffer.from(await smallNoImage.bytes()))

  const atlases = await createSpriteAtlas({
    images: [...loaded.keys()],
    width: 124,
    height: 31,
    gap: 0,
    resolutions: resolutions,
  })

  for (const atlas of atlases) {
    const spriteSheet = sharp({
      create: {
        width: atlas.info.resolution.width,
        height: atlas.info.resolution.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })

    const prepare: OverlayOptions[] = []

    for (const item of atlas.data) {
      const targetWidth = item.width ?? atlas.info.defaultItemSize.width
      const targetHeight = item.height ?? atlas.info.defaultItemSize.height
      let img = loaded.get(item.image)!

      const metadata = await sharp(img).metadata()
      if (metadata.width !== targetWidth || metadata.height !== targetHeight) {
        img = await sharp(img).resize(targetWidth, targetHeight).toBuffer()
      }

      img = await spriteFixer(item.image, img)

      prepare.push({
        input: img,
        left: item.x,
        top: item.y,
      })
    }

    spriteSheet.composite(prepare)

    await upload(`vehicles/small/atlas/${maxResolution}/atlas_${atlas.info.index}.webp`, await spriteSheet.webp({ alphaQuality: 70, quality: 85 }).toBuffer())
    await upload(`vehicles/small/atlas/${maxResolution}/atlas_${atlas.info.index}.png`, await spriteSheet.png().toBuffer())
    await upload(`vehicles/small/atlas/${maxResolution}/atlas_${atlas.info.index}.json`, JSON.stringify(atlas))
  }

  await upload(`vehicles/small/atlas/${maxResolution}/atlases.json`, JSON.stringify(atlases))

}
