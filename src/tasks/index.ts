import { generateI18n, parseSnapshotVersion } from '../utils/utils'
import { S3Client } from '@aws-sdk/client-s3'

import { load as loadArenas } from './loaders/arenas'
import { load as loadLootboxes } from './loaders/lootboxes'
import { load as loadShells } from './loaders/shells'
import { load as loadComp7 } from './loaders/comp7'


const s3Client = new S3Client()

export async function load(root: string) {

  const snapshot = await parseSnapshotVersion(root)

  const i18n = await generateI18n(root, snapshot)

  // try { await loadArenas(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }
  // try { await loadLootboxes(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }
  // try { await loadShells(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }
  // try { await loadComp7(root, snapshot, i18n, s3Client) } catch (error) { console.error(error) }

}
