import 'server-only'
import { en, type Dictionary } from './dictionaries/en'

export async function getLocale(): Promise<'en'> {
  return 'en'
}

export async function getDictionary(): Promise<Dictionary> {
  return en
}
