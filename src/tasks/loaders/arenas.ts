// import { clickhouse } from '@/db'
import { parseStringPromise } from 'xml2js'
import { filenameAndExtension, I18n, type Snapshot as Snapshot } from '../../utils/utils'
import { Glob } from 'bun'
import { S3Client } from '@aws-sdk/client-s3'
import { ddsToImage } from '@/utils/ddsToImage'
import { uploader } from '@/utils/assetsUploader'
import { clickhouse } from '@/db'


type ArenasList = {
  map: {
    id: string,
    name: string,
    isDevelopment?: string,
    isHangar?: string,
  }[]
}

type BoundingBox = {
  bottomLeft: string
  upperRight: string
}

type Gameplay = {
  minimap: string,
  winnerIfTimeout: string,
  winnerIfExtermination: string,
  boundingBox: BoundingBox,
  teamSpawnPoints: {
    [key: string]: string | { // team_X
      position: string | string[]
    }
  },
  teamBasePositions: {
    [key: string]: string | { // team_X
      [key: string]: string // position_X
    }
  },
  controlPoint: string | string[],
  pointsOfInterestUDO: {
    point: {
      position: string,
      type: string
    }[]
  }

}

type Arena = {
  name: string,
  description: string,
  boundingBox: BoundingBox,
  roundLength: string,
  vehicleCamouflageKind: string,
  minimap: string,
  minimapLayers?: {
    layer: { layerId: string, path: string } | { layerId: string, path: string }[]
  }
  gameplayTypes: {
    [key: string]: Partial<Gameplay>
  }
}

function vec2(str: string) {
  const [x, y] = str.split(' ')
  return { x: parseFloat(x!), y: parseFloat(y!) }
}

function bboxParser(bbox: BoundingBox) {
  const bottomLeft = vec2(bbox.bottomLeft)
  const upperRight = vec2(bbox.upperRight)
  return { bottomLeft, upperRight }
}

function parseGameplayMeta(arena: Arena) {
  const gameplayMeta = Object.entries(arena.gameplayTypes).map(([gameplay, data]) => {
    const teamBasePositions = data.teamBasePositions
    const teamSpawnPoints = data.teamSpawnPoints
    const controlPoint = data.controlPoint
    const poiPoints = data.pointsOfInterestUDO?.point?.map(p => ({ position: vec2(p.position), type: p.type }))
    const bbox = data.boundingBox
    const winnerIfTimeout = data.winnerIfTimeout
    const winnerIfExtermination = data.winnerIfExtermination

    const base = teamBasePositions ? Object.entries(teamBasePositions)
      .filter(([team, positions]) => positions != '')
      .map(([team, positions]) => {
        const teamNumber = Number(team.match(/(\d+)/)![0])
        const pos = Object.entries(positions)
          .toSorted((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }))
          .map(t => t[1])
          .map(p => vec2(p))
        return { team: teamNumber, positions: pos }
      }) : undefined

    const spawn = teamSpawnPoints ? Object.entries(teamSpawnPoints)
      .filter(([team, positions]) => positions != '')
      .map(([team, positions]) => {
        const teamNumber = Number(team.match(/(\d+)/)![0])
        const positionList = typeof positions === 'string'
          ? [positions]
          : typeof positions.position === 'string'
            ? [positions.position]
            : positions.position

        return { team: teamNumber, pos: positionList.map(vec2) }
      }) : undefined

    let control = undefined as { x: number, y: number }[] | undefined
    if (controlPoint) {
      if (typeof controlPoint === 'string') control = [vec2(controlPoint)]
      else control = controlPoint.map(p => vec2(p))
    }

    return {
      gameplay,
      bbox: bbox ? bboxParser(bbox) : undefined,
      minimap: data.minimap,
      base,
      spawn,
      control,
      poi: poiPoints,
      winnerIfTimeout: winnerIfTimeout ? parseInt(winnerIfTimeout) : undefined,
      winnerIfExtermination: winnerIfExtermination ? parseInt(winnerIfExtermination) : undefined,
    }
  })

  return gameplayMeta
}

export async function load(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {
  const upload = uploader(snapshot, bucket)

  console.log('Uploading arenas...');

  const data = await Bun.file(`${root}/sources/base/res/scripts/arena_defs/_list_.xml`).text()
  const arenas = await parseStringPromise(data, { explicitArray: false, explicitRoot: false }) as ArenasList

  const result: {
    id: string,
    tag: string,
    name: string,
    localization: Record<string, string>
    season: string,
    gameplay: string,
    minimap: string,
    minimapLayers: string[],
    bbox: { bottomLeft: { x: number, y: number }, upperRight: { x: number, y: number } },
    winnerIfTimeout?: number,
    winnerIfExtermination?: number,
    base?: { team: number, positions: { x: number, y: number }[] }[],
    spawn?: { team: number, pos: { x: number, y: number }[] }[],
    control?: { x: number, y: number }[],
    poi?: { position: { x: number, y: number }, type: string }[]
  }[] = []

  for (const arena of arenas.map) {
    if (arena.isDevelopment || arena.isHangar) continue
    if (!await Bun.file(`${root}/sources/base/res/scripts/arena_defs/${arena.name}.xml`).exists()) continue

    const data = await Bun.file(`${root}/sources/base/res/scripts/arena_defs/${arena.name}.xml`).text()
    const meta = await parseStringPromise(data, { explicitArray: false, explicitRoot: false, trim: true }) as Arena

    const localization = i18n.getTranslation(meta.name)
    const tag = arena.name
    const season = meta.vehicleCamouflageKind
    const bbox = bboxParser(meta.boundingBox)
    const gameplayMeta = parseGameplayMeta(meta)

    const minimapLayers = (() => {
      if (!meta.minimapLayers) return []
      if (!Array.isArray(meta.minimapLayers.layer)) return [meta.minimapLayers.layer.path]
      return meta.minimapLayers.layer.map(l => l.path)
    })().map(t => t.replace('res/spaces/', ''))

    result.push(...gameplayMeta.map(g => ({
      id: arena.id,
      tag,
      name: tag,
      localization,
      season,
      ...g,
      bbox: g.bbox ?? bbox,
      minimap: g.minimap ?? meta.minimap,
      minimapLayers
    })))
  }

  const minimaps = new Set(result.map(t => t.minimap).filter(t => t != undefined))
    .union(new Set(result.flatMap(t => t.minimapLayers).filter(t => t != undefined)))
    .union(new Set(new Glob('spaces/**/mmap*.dds').scanSync(`${root}/sources/base/res`)))

  const promises: Promise<void>[] = []
  for (const minimap of minimaps) {
    const name = minimap.replace('spaces/', '').replace('.dds', '')
    const file = Bun.file(`${root}/sources/base/res/${minimap}`)
    if (!await file.exists()) continue
    const img = await ddsToImage(file)

    promises.push(upload(`arenas/minimap-medium/${name}.png`, await img.png().toBuffer()))
    promises.push(upload(`arenas/minimap-medium/${name}.webp`, await img.webp({ quality: 90 }).toBuffer()))
  }

  const subfolders = ['', 'comp7/']
  for (const subfolder of subfolders) {
    const minimapFiles = Array.from(new Glob('*.png').scanSync(`${root}/sources/base/res/gui/maps/icons/map/${subfolder}`))

    for (const filePath of minimapFiles) {
      const img = Bun.file(`${root}/sources/base/res/gui/maps/icons/map/${subfolder}${filePath}`).image()
      const { nameWithoutExt: name, ext } = filenameAndExtension(filePath)

      promises.push(upload(`arenas/minimap/${subfolder}${name}.png`, await img.png().toBuffer()))
      promises.push(upload(`arenas/minimap/${subfolder}${name}.webp`, await img.webp({ quality: 90 }).toBuffer()))
    }
  }

  const statsFiles = Array.from(new Glob('*.png').scanSync(`${root}/sources/base/res/gui/maps/icons/map/stats/`))
  for (const filePath of statsFiles) {
    const img = Bun.file(`${root}/sources/base/res/gui/maps/icons/map/stats/${filePath}`).image()
    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath)

    promises.push(upload(`arenas/stats/${name}.png`, await img.png().toBuffer()))
    promises.push(upload(`arenas/stats/${name}.webp`, await img.webp({ quality: 80 }).toBuffer()))
  }

  await Promise.all(promises)
  console.log(`Arenas uploaded (${promises.length / 2}x2 files)`);

  const v2t = (t: { x: number, y: number }) => ([t.x, t.y])

  const insertValues = result.map(t => ({
    region: `tmp-${snapshot.realm}`,
    gameVersionFull: snapshot.full,
    gameVersion: snapshot.version,
    gameVersionHash: snapshot.hash,
    tag: t.tag,
    gameplay: t.gameplay,
    datetime: Math.round(new Date().getTime() / 1000),
    gameVersionComp: snapshot.comparable,
    id: t.id,
    name: t.name,
    localization: t.localization,
    season: t.season,
    minimap: t.minimap,
    minimapLayers: t.minimapLayers,
    winnerIfTimeout: t.winnerIfTimeout,
    winnerIfExtermination: t.winnerIfExtermination,
    'bbox.bottomLeft': v2t(t.bbox.bottomLeft),
    'bbox.upperRight': v2t(t.bbox.upperRight),
    'base.team': t.base?.map(t => t.team) ?? [],
    'base.positions': t.base?.map(t => t.positions.map(v2t)) ?? [],
    'spawn.team': t.spawn?.map(t => t.team) ?? [],
    'spawn.positions': t.spawn?.map(t => t.pos.map(v2t)) ?? [],
    control: t.control?.map(v2t) ?? [],
    'poi.position': t.poi?.map(t => v2t(t.position)) ?? [],
    'poi.type': t.poi?.map(t => t.type) ?? [],
  }))

  console.log('Inserting arenas...')

  await clickhouse.insert({
    table: 'WOT.Arenas',
    values: insertValues,
    format: 'JSONEachRow'
  })

  console.log(`Inserted arenas (${insertValues.length} lines)`)
}
