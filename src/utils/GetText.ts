
function decodePoString(value: string) {
  let decoded = ''

  for (let i = 0; i < value.length; i++) {
    const character = value[i]!

    if (character !== '\\' || i === value.length - 1) {
      decoded += character
      continue
    }

    const escapedCharacter = value[i + 1]!
    if (escapedCharacter === '\\' || escapedCharacter === '"') {
      decoded += escapedCharacter
      i++
      continue
    }

    decoded += character
  }

  return decoded
}

function parsePo(po: string) {
  const translations = po.split('msgid')

  const parsed = translations
    .filter(t => t.includes('msgstr'))
    .map(t => {
      const splitted = t.split('msgstr')
      const msgid = decodePoString(splitted[0]!.trim().slice(1, -1))

      const lines = splitted[1]!
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => decodePoString(l.slice(1, -1)))
        .filter(l => l.length > 0)

      const msgstr = lines.join('\n')

      return {
        msgid,
        msgstr: msgstr == '?empty?' ? '' : msgstr
      }
    })

  return new Map(parsed.map(t => [t.msgid, t.msgstr]))
}

export class GetText {

  private transitions: Map<string, string>

  constructor(po: string) {
    this.transitions = parsePo(po)
  }

  public getTranslation(msg: string, fallback?: string) {
    return this.transitions.get(msg) ?? fallback ?? msg
  }

  public getSingleLineTranslation(msg: string, fallback?: string) {
    return (this.transitions.get(msg) ?? fallback ?? msg)
      .replaceAll('\n', ' ')
      .replaceAll('\\n', ' ')
      .replaceAll(/\s+/g, ' ')
  }

  public getAll() {
    return this.transitions
  }

  public extend(po: string) {
    const parsed = parsePo(po)
    for (const [msgid, msgstr] of parsed.entries()) {
      this.transitions.set(msgid, msgstr)
    }

    return this
  }

  public extendByGetText(transitions: Map<string, string>) {
    for (const [msgid, msgstr] of transitions.entries()) {
      this.transitions.set(msgid, msgstr)
    }

    return this
  }
}

export class MultiLanguageGetText {

  constructor(readonly translations: Map<string, GetText>) { }

  public extend(language: string, getText: GetText) {
    if (!this.translations.has(language)) {
      this.translations.set(language, getText)
    } else {
      this.translations.get(language)?.extendByGetText(getText.getAll())
    }
  }

  public getTranslation(msg: string, language: string, fallback?: string) {
    const getText = this.translations.get(language)
    if (!getText) return fallback ?? msg
    return getText.getTranslation(msg, fallback)
  }

  public getSingleLineTranslation(msg: string, language: string, fallback?: string) {
    const getText = this.translations.get(language)
    if (!getText) return (fallback ?? msg).replaceAll('\n', ' ').replaceAll('\\n', ' ').replaceAll(/\s+/g, ' ')
    return getText.getSingleLineTranslation(msg, fallback)
  }

  public getAll() {
    return this.translations
  }

  public getTranslationForAllLLanguages(msg: string, fallback?: string) {
    const translations = new Map<string, string>()
    for (const [language, getText] of this.translations.entries()) {
      translations.set(language, getText.getTranslation(msg, fallback))
    }
    return translations
  }

  public getSingleLineTranslationForAllLLanguages(msg: string, fallback?: string) {
    const translations = new Map<string, string>()
    for (const [language, getText] of this.translations.entries()) {
      translations.set(language, getText.getSingleLineTranslation(msg, fallback))
    }
    return translations
  }
}
