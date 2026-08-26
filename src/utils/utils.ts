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

  return {
    full: version,
    version: parts.join('.'),
    hash,
    comparable: comp,
    target: snapshot.source.target,
    realm: versionMeta['version.xml'].meta.realm,
    languages: snapshot.source.languages
  }
}

export function lcMessagesPath(snapshot: Snapshot, language: string) {
  if (snapshot.realm == 'PT_RU' || snapshot.realm == 'RU')
    return `sources/base/res/text/${language.toLocaleLowerCase()}/lc_messages`

  return `sources/locales/${language}/res/text/lc_messages`
}

export class I18n {
  constructor(private translations: Map<string, MultiLanguageGetText>) { }

  public getTranslation(msg: string) {
    if (!msg.startsWith('#')) throw new Error(`Invalid msgid: ${msg}`)
    const [file, ...rest] = msg.slice(1).split(':')
    const key = rest.join(':')

    const gettext = this.translations.get(file!)
    return Object.fromEntries(gettext!.getTranslationForAllLLanguages(key).entries())
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