import { S3Client } from '@aws-sdk/client-s3'
import { I18n, type Snapshot as Snapshot } from '../../utils/utils'
import { clickhouse } from '@/db'
import { parseKpi, parsePrice, parseVehicleFilter, processIcon, type KPI, type Price, type VehicleFilter } from '@/utils/utilsEquipments'
import { parseStringPromise } from 'xml2js'


type Device = {
  id: string
  userString?: string
  shortDescriptionSpecial?: string
  longDescriptionSpecial?: string
  icon: string
  groupName: string
  price: Price
  tags: string
  notInShop?: 'true' | 'false'
  incompatibleTags: {
    installed?: string
  }
  vehicleFilter: {
    include?: VehicleFilter
    exclude?: VehicleFilter
  }
  archetype: string
  tooltipSection: string
  kpi: KPI
}

type DevicesList = {
  [key: string]: Device
}

export async function load(root: string, snapshot: Snapshot, i18n: I18n, bucket: S3Client) {
  const data = await Bun.file(`${root}/sources/base/res/scripts/item_defs/vehicles/common/optional_devices.xml`).text()
  const parsed = await parseStringPromise(data, { explicitArray: false, explicitRoot: false }) as DevicesList

  const devices = Object.entries(parsed)
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

  const res = devices.map((d, i) => ({
    id: Number(d.id),
    tag: d.tag,

    name: d.userString,
    shortDescription: d.shortDescriptionSpecial,
    longDescription: d.longDescriptionSpecial,

    nameLocalization: !d.userString ? {} : i18n.getTranslation(d.userString),
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

  console.log('Inserting OptionalDevices...')
  await clickhouse.insert({
    table: 'WOT.OptionalDevices',
    values: insertValues,
    format: 'JSONEachRow'
  })
  console.log(`OptionalDevices inserted (${insertValues.length} lines)`)

}