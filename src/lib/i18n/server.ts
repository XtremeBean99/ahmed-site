import 'server-only'
import { en, type Dictionary } from './dictionaries/en'

export async function getDictionary(): Promise<Dictionary> {
  return en
}
