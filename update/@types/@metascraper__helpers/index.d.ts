declare module '@metascraper/helpers' {

  import { CheerioAPI } from 'cheerio'
  import { CheckOptions } from 'metascraper'

  type Mapper<O extends {} = {}> = (val: unknown, options: O) => string | undefined

  const date: Mapper

  const title: Mapper<{ removeSeparator?: boolean }>

  const toRule: <O extends {}>(mapper: Mapper<{ url: string } & O>, opts?: O) => <T extends string | undefined>(check: ($: CheerioAPI) => T) => (args: CheckOptions) => Promise<string>

}
