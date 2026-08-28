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

  // try { await loadArenas(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }
  // try { await loadLootboxes(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }
  // try { await loadShells(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }
  // try { await loadComp7(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }
  // try { await loadSkills(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }
  // try { await loadArtefacts(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }
  // try { await loadCustomizations(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }
  // try { await loadGameVersion(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }
  // try { await loadEquipments(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }
  // try { await loadOptionalDevices(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }
  try { await loadEquipmentsAndDevicesIcons(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }
  // try { await loadVehicles(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }

}
