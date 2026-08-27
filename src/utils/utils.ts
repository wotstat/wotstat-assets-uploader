import { parseStringPromise } from 'xml2js'
import { GetText, MultiLanguageGetText } from './GetText'
import { Glob } from 'bun'

export type Snapshot = {
  full: string
  version: string
  hash: string
  comparable: number
  target: string
  realm: string
  languages: string[]
  vendor: 'mt' | 'wot'
}

export async function parseSnapshotVersion(root: string): Promise<Snapshot> {

  const snapshot = await Bun.file(`${root}/snapshot.json`).json()
  const versionText = await Bun.file(`${root}/sources/base/version.xml`).text()
  const versionMeta = await parseStringPromise(versionText, { explicitArray: false, trim: true })
  const version = versionMeta['version.xml'].version

  const main = version.split(' ')[0] as string
  const hash = version.split(' ')[1].replace('#', '')

  const parts = main.split('.').slice(1)
  const comp = Number.parseInt(parts.map(t => t.padStart(2, '0')).join('')) * 1e5 + Number.parseInt(hash)

  const realm = versionMeta['version.xml'].meta.realm
  const vendor = realm == 'PT_RU' || realm == 'RU' ? 'mt' : 'wot'

  return {
    full: version,
    version: parts.join('.'),
    hash,
    comparable: comp,
    target: snapshot.source.target,
    realm,
    languages: snapshot.source.languages,
    vendor
  }
}

export function lcMessagesPath(snapshot: Snapshot, language: string) {
  if (snapshot.vendor === 'mt') return `sources/base/res/text/${language.toLocaleLowerCase()}/lc_messages`
  return `sources/locales/${language}/res/text/lc_messages`
}

export class I18n {
  constructor(readonly translations: Map<string, MultiLanguageGetText>) { }

  public getTranslation(msg: string) {
    if (!msg.startsWith('#')) throw new Error(`Invalid msgid: ${msg}`)
    const [file, ...rest] = msg.slice(1).split(':')
    const key = rest.join(':')

    const gettext = this.translations.get(file!)
    return Object.fromEntries(gettext!.getTranslationForAllLLanguages(key).entries())
  }

  public getSingleLineTranslation(msg: string) {
    if (!msg.startsWith('#')) throw new Error(`Invalid msgid: ${msg}`)
    const [file, ...rest] = msg.slice(1).split(':')
    const key = rest.join(':')

    const gettext = this.translations.get(file!)
    return Object.fromEntries(gettext!.getSingleLineTranslationForAllLLanguages(key).entries())
  }

  public getAllTranslations(file: string) {
    const gettext = this.translations.get(file)
    if (!gettext) return new Map<string, Record<string, string>>()

    const keys = new Set(
      Array.from(gettext.getAll().values())
        .flatMap(language => Array.from(language.getAll().keys()))
    )

    return new Map(
      Array.from(keys).map(key => [
        key,
        Object.fromEntries(gettext.getTranslationForAllLLanguages(key).entries())
      ])
    )
  }
}

export async function generateI18n(root: string, snapshot: Snapshot) {

  const poGlob = new Glob('**/*.po')

  const translations = new Map<string, MultiLanguageGetText>() // file: MultiLanguageGetText

  for (const language of snapshot.languages) {
    const rootPath = `${root}/${lcMessagesPath(snapshot, language)}`
    const localizationFiles = poGlob.scanSync(rootPath)

    for (const file of localizationFiles) {
      const po = await Bun.file(rootPath + '/' + file).text()
      const filename = file.replace(/\.po$/, '')
      const gettext = new GetText(po)

      if (!translations.has(filename)) {
        translations.set(filename, new MultiLanguageGetText(new Map([[language, gettext]])))
      } else {
        translations.get(filename)?.extend(language, gettext)
      }
    }
  }

  return new I18n(translations)
}

export type XML<T> = {
  root: T
}


export function filename(path: string) {
  return path.split('/').at(-1) ?? ''
}

export function filenameAndExtension(path: string) {
  const name = filename(path)
  const ext = path.split('.').pop()?.toLowerCase()
  const nameWithoutExt = name.split('.').slice(0, 1).join('.')
  return { name, ext, nameWithoutExt }
}
