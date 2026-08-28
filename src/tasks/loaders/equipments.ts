import { S3Client } from '@aws-sdk/client-s3'
import { I18n, type Snapshot as Snapshot } from '../../utils/utils'
import { clickhouse } from '@/db'
import { parseKpi, parsePrice, parseVehicleFilter, processIcon, type KPI, type Price, type VehicleFilter } from '@/utils/utilsEquipments'
import { parseStringPromise } from 'xml2js'


type Equipment = {
  id: string
  userString?: string
  description?: string
  shortDescriptionSpecial?: string
  longDescriptionSpecial?: string
  icon: string
  price: Price
  notInShop?: 'true' | 'false'
  tags: string
  incompatibleTags?: {
    installed?: string
  }
  vehicleFilter: {
    include?: VehicleFilter
    exclude?: VehicleFilter
  }
  tooltipSection: string
  kpi: KPI
}

type EquipmentsList = {
  [key: string]: Equipment
}

export async function load(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {
  const data = await Bun.file(`${root}/sources/base/res/scripts/item_defs/vehicles/common/equipments.xml`).text()
  const parsed = await parseStringPromise(data, { explicitArray: false, explicitRoot: false }) as EquipmentsList

  const equipments = Object.entries(parsed)
    .filter(([key, value]) => key != '$')
    .map(([key, value]) => ({
      ...value,
      price: parsePrice(value.price),
      notInShop: value.notInShop === 'true',
      incompatibleTags: value.incompatibleTags?.installed?.split(' ') || [],
      vehicleFilter: {
        include: parseVehicleFilter(value.vehicleFilter?.include),
        exclude: parseVehicleFilter(value.vehicleFilter?.exclude)
      },
      kpi: parseKpi(value.kpi),
      tag: key
    }))

  const res = equipments.map((d, i) => ({
    id: Number(d.id),
    tag: d.tag,

    name: d.userString,
    description: d.description,
    shortDescription: d.shortDescriptionSpecial,
    longDescription: d.longDescriptionSpecial,

    nameLocalization: !d.userString ? {} : i18n.getTranslation(d.userString),
    descriptionLocalization: !d.description ? {} : i18n.getTranslation(d.description),
    shortDescriptionLocalization: !d.shortDescriptionSpecial ? {} : i18n.getTranslation(d.shortDescriptionSpecial),
    longDescriptionLocalization: !d.longDescriptionSpecial ? {} : i18n.getTranslation(d.longDescriptionSpecial),

    icon: processIcon(d.icon),
    priceAmount: d.price.price,
    priceCurrency: d.price.currency,
    tags: d.tags.split(' '),
    notInShop: d.notInShop,
    incompatibleTags: d.incompatibleTags,
    tooltipSection: d.tooltipSection,

    kpiSimple: d.kpi?.simple ?? [],
    kpiAggregate: d.kpi?.aggregate ?? [],

    vehicleIncludeMinLevel: d.vehicleFilter.include?.minLevel ?? null,
    vehicleIncludeMaxLevel: d.vehicleFilter.include?.maxLevel ?? null,
    vehicleIncludeTags: d.vehicleFilter.include?.tags ?? [],
    vehicleIncludeMandatoryTags: d.vehicleFilter.include?.mandatoryTags ?? [],
    vehicleIncludeNations: d.vehicleFilter.include?.nations ?? [],
    vehicleIncludeComponentFilters: d.vehicleFilter.include?.componentFilters ?? [],

    vehicleExcludeMinLevel: d.vehicleFilter.exclude?.minLevel ?? null,
    vehicleExcludeMaxLevel: d.vehicleFilter.exclude?.maxLevel ?? null,
    vehicleExcludeTags: d.vehicleFilter.exclude?.tags ?? [],
    vehicleExcludeMandatoryTags: d.vehicleFilter.exclude?.mandatoryTags ?? [],
    vehicleExcludeNations: d.vehicleFilter.exclude?.nations ?? [],
    vehicleExcludeComponentFilters: d.vehicleFilter.exclude?.componentFilters ?? []
  }))

  const insertValues = res.map(t => ({
    region: `tmp-${snapshot.realm}`,
    gameVersionFull: snapshot.full,
    gameVersion: snapshot.version,
    gameVersionHash: snapshot.hash,
    gameVersionComp: snapshot.comparable,
    datetime: Math.round(new Date().getTime() / 1000),
    ...t
  }))

  console.log('Inserting Equipments...')
  await clickhouse.insert({
    table: 'WOT.Equipments',
    values: insertValues,
    format: 'JSONEachRow'
  })
  console.log(`Equipments inserted (${insertValues.length} lines)`)
}