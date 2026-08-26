import { Transformer } from '@napi-rs/image'

const DDS_MAGIC = new Uint8Array([0x44, 0x44, 0x53, 0x20])

function isDds(input: Uint8Array) {
  return input.length >= DDS_MAGIC.length
    && DDS_MAGIC.every((byte, index) => input[index] === byte)
}

/**
 * Creates a Bun.Image pipeline and adds DDS decoding for the DXT1, DXT3 and
 * DXT5 formats used by the game minimaps.
 *
 * DDS is decoded to a lossless PNG first because Bun.Image does not expose a
 * raw-pixel input or a custom decoder API. All subsequent operations run on a
 * regular Bun.Image instance.
 */
export async function ddsToImage(
  input: Blob,
  options?: Bun.Image.ConstructorOptions,
): Promise<Bun.Image> {
  const bytes = Buffer.from(await input.arrayBuffer())
  if (!isDds(bytes)) return new Bun.Image(bytes, options)

  const png = await new Transformer(bytes).png()
  return new Bun.Image(png, options)
}
