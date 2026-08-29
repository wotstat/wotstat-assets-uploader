import { generateI18n, parseSnapshotVersion } from '../utils/utils'
import { S3Client } from '@aws-sdk/client-s3'

import { load as loadArenas } from './loaders/arenas'
import { load as loadLootboxes } from './loaders/lootboxes'
import { load as loadShells } from './loaders/shells'
import { load as loadComp7 } from './loaders/comp7'
import { load as loadSkills } from './loaders/skills'
import { load as loadArtefacts } from './loaders/artefacts'
import { load as loadCustomizations } from './loaders/customizations'
import { load as loadGameVersion } from './loaders/gameVersions'
import { load as loadEquipments } from './loaders/equipments'
import { load as loadOptionalDevices } from './loaders/optionalDevices'
import { load as loadVehicles } from './loaders/vehicles/index'
import { load as loadEquipmentsAndDevicesIcons } from './loaders/equipmentsAndDevicesIcons'


const s3Client = new S3Client()

export async function load(root: string) {
  const snapshot = await parseSnapshotVersion(root)
  const i18n = await generateI18n(root, snapshot)

  const loaders = [
    ['arenas', loadArenas],
    ['lootboxes', loadLootboxes],
    ['shells', loadShells],
    ['comp7', loadComp7],
    ['skills', loadSkills],
    ['artefacts', loadArtefacts],
    ['customizations', loadCustomizations],
    ['game-version', loadGameVersion],
    ['equipments', loadEquipments],
    ['optional-devices', loadOptionalDevices],
    ['equipment-and-device-icons', loadEquipmentsAndDevicesIcons],
    ['vehicles', loadVehicles],
  ] as const
  const failures: Error[] = []

  for (const [name, loader] of loaders) {
    try {
      await loader(root, snapshot, i18n, s3Client)
      console.log('--------------------------------------')
    } catch (error) {
      console.error(`${name} failed`, error)
      failures.push(error instanceof Error ? error : new Error(String(error)))
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, `${failures.length} uploader task(s) failed`)
  }
}
