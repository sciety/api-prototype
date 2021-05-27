import { date, publisher, title, toRule, url } from '@metascraper/helpers'
import { sequenceT } from 'fp-ts/Apply'
import * as E from 'fp-ts/Either'
import { constVoid, flow, identity, pipe } from 'fp-ts/function'
import * as IO from 'fp-ts/IO'
import * as O from 'fp-ts/Option'
import * as RA from 'fp-ts/ReadonlyArray'
import * as RNEA from 'fp-ts/ReadonlyNonEmptyArray'
import * as RR from 'fp-ts/ReadonlyRecord'
import * as T from 'fp-ts/Task'
import * as TE from 'fp-ts/TaskEither'
import metascraper from 'metascraper'
import path from 'path'
import puppeteer, { Browser } from 'puppeteer'
import slugify from 'slugify'
import { BiorxivArticleDetails, biorxivArticleDetails } from './biorxiv'
import { CrossrefWork, crossrefWork } from './crossref'
import * as D from './dataset'
import * as d from './decoder'
import { getFromUrl, getUrl } from './http'
import { cito, dcterms, fabio, foaf, frbr, mediatype, org, prism, pro, rdf, rdfs, tvc, xsd } from './namespace'
import { exit } from './process'
import * as RDF from './rdf'
import * as S from './string'
import * as TTL from './turtle'

const doiRegex = /^10\.[0-9]{4,}(?:\.[1-9][0-9]*)*\/[^%"#?\s]+$/

const doi = (value: unknown) => typeof value === 'string' && doiRegex.test(value) ? value : undefined

const doiToUrl = S.prependWith('https://doi.org/')

const scraper = TE.tryCatchK(metascraper([
  {
    author: [
      toRule(title)($ => $('meta[name="citation_author"]')
        .toArray()
        .map(element => element.attribs['content'].split(', ').reverse().join(' '))
        .join('\n')
      ),
      ...require('metascraper-author')().author,
    ],
    date: [
      toRule(date)($ => $('meta[name="citation_date"]').attr('content')),
      ...require('metascraper-date')().date,
      toRule(date)($ => $('meta[name="citation_publication_date"]').attr('content')),
    ],
    doi: [
      toRule(doi)($ => $('meta[name="citation_doi"]').attr('content')),
      toRule(doi)($ => $('meta[name="dc.identifier" i][scheme="doi"]').attr('content')),
    ],
    journal: [
      toRule(publisher)($ => $('meta[name="citation_journal_title"]').attr('content')),
    ],
    publisher: [
      toRule(publisher)($ => $('meta[name="citation_publisher"]').attr('content')),
      ...require('metascraper-publisher')().publisher,
    ],
    title: [
      toRule(title)($ => $('meta[name="citation_title"]').attr('content')),
      ...require('metascraper-title')().title,
    ],
    pdf: [
      toRule(url)($ => $('meta[name="citation_pdf_url"]').attr('content')),
    ]
  },
  require('metascraper-lang')(),
  require('metascraper-url')(),
]), E.toError)

const scrape = <V extends RR.ReadonlyRecord<string, unknown>>(decoder: d.Decoder<unknown, V>) => <T extends { url: string, text: string }>(args: T) => pipe(
  {
    ...args,
    html: args.text,
  },
  scraper,
  TE.chainEitherKW(flow(
    d.decodeWith(decoder),
    E.mapLeft(S.prependWith(`Failed to decode ${args.url}:\n`))
  )),
)

const scraped = d.struct({
  author: d.arrayFromString('\n'),
  date: d.dateFromIsoString,
  doi: d.nullable(d.string),
  lang: d.nullable(d.string),
  journal: d.nullable(d.string),
  pdf: d.nullable(d.urlFromString),
  publisher: d.string,
  title: d.string,
  url: d.urlFromString,
})

type Scraped = d.TypeOf<typeof scraped>

const crossrefToScraped = ({ message }: CrossrefWork): Scraped => ({
  author: pipe(message.author, RA.map(author => pipe([author.given, author.family], S.join(' ')))),
  date: message.indexed['date-time'],
  doi: message.DOI,
  lang: pipe(message.language, O.toNullable),
  journal: pipe(message['container-title'], RA.head, O.toNullable),
  pdf: null,
  publisher: message.publisher,
  title: message.title[0],
  url: message.URL,
})

const review = d.tuple(
  d.string,
  d.string,
  d.string,
)

type Review = d.TypeOf<typeof review>

const reviews = d.csv(d.array(review))

const partToHashedIri = flow(S.md5, IO.map(RDF.namedNode))

const doiVersionIri = <T extends { doi: string, version: string }>({
  doi,
  version
}: T) => pipe([doi, version], S.join('v'), RDF.namedNode)

const personIri = flow((name: string) => slugify(name, { lower: true, remove: /[.]/g }), RDF.namedNode)

const biorxivWork = (details: BiorxivArticleDetails) => (work: RDF.NamedNode) => D.fromArray([
  RDF.quad(work, rdf.type, fabio.ResearchPaper, work),
  RDF.quad(work, rdfs.label, pipe(details.collection, RNEA.last, version => version.title, RDF.literal), work),
])

const doiToArticleWork = (details: BiorxivArticleDetails) => flow(
  partToHashedIri,
  IO.map(biorxivWork(details))
)

const doiExpression = ({
  work,
  expression,
  version,
  revisionOf,
  successorOf,
  data
}: { work: RDF.NamedNode, expression: RDF.NamedNode, version?: string, revisionOf?: RDF.NamedNode, successorOf?: RDF.NamedNode, data: Scraped }) => pipe(
  IO.Do,
  IO.apS('webPage', pipe(expression.value, S.appendWith('#web'), partToHashedIri)),
  IO.apS('pdf', pipe(expression.value, S.appendWith('#pdf'), partToHashedIri)),
  IO.apS('publisher', pipe(data.publisher, partToHashedIri)),
  IO.apS('journal', pipe(data.journal ?? '', partToHashedIri)),
  IO.apS('authors', pipe(
    data.author,
    RA.map(flow(
      IO.of,
      IO.bindTo('fullName'),
      IO.bind('person', ({ fullName }) => pipe(fullName, personIri, IO.of)),
      IO.bind('role', ({ fullName }) => pipe([expression.value, 'role', fullName], S.join('#'), partToHashedIri)),
      IO.bind('name', ({ fullName }) => pipe([expression.value, 'name', fullName], S.join('#'), partToHashedIri)),
    )),
    IO.sequenceArray,
  )),
  IO.map(({ webPage, pdf, publisher, journal, authors }) => pipe(
    [
      RDF.quad(expression, rdf.type, fabio.Article, work),
      RDF.quad(expression, dcterms.title, RDF.literal(data.title), work),
      RDF.quad(expression, prism.publicationDate, RDF.date(data.date), work),
      RDF.quad(expression, frbr.realizationOf, work, work),
      RDF.quad(expression, dcterms.publisher, publisher, work),
      RDF.quad(expression, fabio.hasManifestation, webPage, work),
      ...pipe(
        authors,
        RA.reduce(RA.empty, (quads: ReadonlyArray<RDF.Quad>, { person, fullName, role, name }) => [
          ...quads,
          RDF.quad(expression, frbr.creator, person, work),
          RDF.quad(person, rdf.type, frbr.Person, person),
          RDF.quad(person, foaf['name'], RDF.literal(fullName), person),
          RDF.quad(person, tvc.hasValue, name, person),
          RDF.quad(name, rdf.type, tvc.ValueInTime, work),
          RDF.quad(name, rdfs.label, RDF.literal(`${fullName}'s name in ${data.title}`, 'en'), work),
          RDF.quad(name, rdf.property, foaf['name'], work),
          RDF.quad(name, tvc.withValue, RDF.literal(fullName), work),
          RDF.quad(name, tvc.withinContext, expression, work),
          RDF.quad(person, pro.holdsRoleInTime, role, person),
          RDF.quad(role, rdf.type, pro.RoleInTime, work),
          RDF.quad(role, rdfs.label, RDF.literal(`${fullName}'s role in ${data.title}`, 'en'), work),
          RDF.quad(role, pro.withRole, pro.author, work),
          RDF.quad(role, pro.relatesToDocument, expression, work),
        ])
      ),
      RDF.quad(webPage, rdf.type, fabio.WebPage, work),
      RDF.quad(webPage, fabio.hasURL, RDF.url(data.url), work),
      RDF.quad(webPage, frbr.producer, publisher, work),
      RDF.quad(publisher, rdf.type, org.Organization, RDF.namedNode('_publishers')),
      RDF.quad(publisher, rdfs.label, RDF.literal(data.publisher), RDF.namedNode('_publishers')),
    ],
    D.fromArray,
    data.doi ? D.insert(RDF.quad(expression, prism.doi, RDF.literal(data.doi), work)) : identity,
    version ? D.insert(RDF.quad(expression, prism.versionIdentifier, RDF.literal(version), work)) : identity,
    revisionOf ? D.insert(RDF.quad(expression, frbr.revisionOf, revisionOf, work)) : identity,
    successorOf ? D.insert(RDF.quad(expression, frbr.successorOf, successorOf, work)) : identity,
    data.journal ? D.union(D.fromArray([
      RDF.quad(expression, frbr.partOf, journal, work),
      RDF.quad(journal, rdf.type, fabio.Journal, RDF.namedNode('_journals')),
      RDF.quad(journal, dcterms.title, RDF.literal(data.journal), RDF.namedNode('_journals')),
    ])) : identity,
    data.pdf ? D.union(D.fromArray([
      RDF.quad(expression, fabio.hasManifestation, pdf, work),
      RDF.quad(pdf, rdf.type, fabio.DigitalManifestation, work),
      RDF.quad(pdf, dcterms.format, mediatype('application/pdf'), work),
      RDF.quad(pdf, fabio.hasURL, RDF.url(data.pdf), work),
      RDF.quad(pdf, frbr.producer, publisher, work),
    ])) : identity,
  )),
)

const fromDoi = (browser: Browser) => flow(
  doiToUrl,
  fromUrl(browser),
)

const fromUrl = (browser: Browser) => flow(
  getFromUrl(browser),
  TE.chain(scrape(scraped)),
)

const fromCrossrefApi = (browser: Browser) => (doi: string) => pipe(
  doi,
  S.prependWith('https://api.crossref.org/v1/works/'),
  getUrl(browser)(crossrefWork),
  TE.map(crossrefToScraped),
)

const doiToExpression = (browser: Browser) => ({
  url,
  doi,
  ...rest
}: { url: string, doi: string } & Omit<Parameters<typeof doiExpression>[0], 'data'>) => pipe(
  url,
  fromUrl(browser),
  TE.orElse(() => pipe(doi, fromCrossrefApi(browser))),
  TE.chainIOK(data => doiExpression({ data, ...rest })),
)

const doiToReviewExpression = ({ articleWork, data }: { articleWork: RDF.NamedNode, data: Scraped }) => pipe(
  IO.Do,
  IO.apS('work', pipe(data.url, String, S.appendWith('#review-work'), partToHashedIri)),
  IO.apS('expression', pipe(data.url, String, S.appendWith('#review-expression'), partToHashedIri)),
  IO.apS('publisher', pipe(data.publisher, partToHashedIri)),
  IO.apS('journal', pipe(data.journal ?? '', partToHashedIri)),
  IO.map(({ work, expression, publisher, journal }) => pipe(
    [
      RDF.quad(expression, rdf.type, fabio.ReviewArticle, work),
      RDF.quad(expression, frbr.realizationOf, work, work),
      RDF.quad(expression, dcterms.publisher, publisher, work),
      RDF.quad(work, rdf.type, fabio.Review, work),
      RDF.quad(work, cito.citesAsRecommendedReading, articleWork, work),
      RDF.quad(publisher, rdf.type, org.Organization, RDF.namedNode('_publishers')),
      RDF.quad(publisher, rdfs.label, RDF.literal(data.publisher), RDF.namedNode('_publishers')),
    ],
    D.fromArray,
    data.journal ? D.union(D.fromArray([
      RDF.quad(expression, frbr.partOf, journal, work),
      RDF.quad(journal, rdf.type, fabio.Journal, RDF.namedNode('_journals')),
      RDF.quad(journal, dcterms.title, RDF.literal(data.journal), RDF.namedNode('_journals')),
    ])) : identity,
  )),
)

const doiToReview = (browser: Browser) => (articleWork: RDF.NamedNode) => (doi: string) => pipe(
  doi,
  fromCrossrefApi(browser),
  TE.orElse(() => pipe(doi, fromDoi(browser))),
  TE.chainIOK(data => doiToReviewExpression({ data, articleWork }))
)

const doiToArticleExpressions = (browser: Browser, details: BiorxivArticleDetails) => (doi: string) => pipe(
  details,
  TE.right,
  TE.apSW('work', pipe(doi, partToHashedIri, TE.rightIO)),
  TE.chain(details => pipe(
    details.collection,
    RA.mapWithIndex((i, articleVersion) => O.some({
      url: `https://www.${articleVersion.server}.org/content/${articleVersion.doi}v${articleVersion.version}`,
      doi: articleVersion.doi,
      version: articleVersion.version,
      revisionOf: i > 0 ? pipe(details.collection[i - 1], doiVersionIri) : undefined,
      successorOf: undefined,
      expression: pipe(articleVersion, doiVersionIri),
      work: details.work,
    })),
    RA.append(pipe(
      details.collection,
      RA.last,
      O.chain(version => pipe(version.published, O.map(published => ({ ...version, published })))),
      O.map((articleVersion) => ({
        url: pipe(articleVersion.published, doiToUrl),
        doi: articleVersion.published,
        expression: RDF.namedNode(articleVersion.published),
        successorOf: pipe(articleVersion, doiVersionIri) as RDF.NamedNode | undefined,
        work: details.work,
      })),
    )),
    RA.compact,
    TE.traverseArray(doiToExpression(browser)),
    TE.map(D.concatAll),
    TE.chain(dataset => pipe(
      details.collection[0].published,
      O.fold(
        () => TE.right(dataset),
        flow(
          doiToReview(browser)(details.work),
          TE.map(D.union(dataset)),
        ),
      ),
    )),
  )),
)

const findFirstVersionAfterDate = (date: Date) => (details: BiorxivArticleDetails) => pipe(
  details.collection,
  RA.findLast(version => version.date <= date),
  O.getOrElse(() => details.collection[0])
)

const reviewExpression = ({
  articleWork,
  expression,
  data,
  details,
}: { articleWork: RDF.NamedNode, expression: RDF.NamedNode, data: Scraped, details: BiorxivArticleDetails }) => pipe(
  IO.Do,
  IO.apS('work', pipe(expression.value, S.appendWith('#work'), partToHashedIri)),
  IO.apS('publisher', pipe(data.publisher, partToHashedIri)),
  IO.apS('webPage', pipe(expression.value, S.appendWith('#web'), partToHashedIri)),
  IO.apS('pdf', pipe(expression.value, S.appendWith('#pdf'), partToHashedIri)),
  IO.apS('journal', pipe(data.journal ?? '', partToHashedIri)),
  IO.apS('articleExpression', pipe(details, findFirstVersionAfterDate(data.date), doiVersionIri, IO.of)),
  IO.apS('authors', pipe(
    data.author,
    RA.map(flow(
      IO.of,
      IO.bindTo('fullName'),
      IO.bind('person', ({ fullName }) => pipe(fullName, personIri, IO.of)),
      IO.bind('role', ({ fullName }) => pipe([expression.value, 'role', fullName], S.join('#'), partToHashedIri)),
      IO.bind('name', ({ fullName }) => pipe([expression.value, 'name', fullName], S.join('#'), partToHashedIri)),
    )),
    IO.sequenceArray,
  )),
  IO.map(({ work, publisher, webPage, pdf, journal, articleExpression, authors }) => pipe(
    [
      RDF.quad(expression, rdf.type, fabio.ReviewArticle, work),
      RDF.quad(expression, dcterms.title, RDF.literal(data.title, data.lang ?? undefined), work),
      RDF.quad(expression, frbr.realizationOf, work, work),
      RDF.quad(expression, fabio.hasManifestation, webPage, work),
      RDF.quad(expression, dcterms.publisher, publisher, work),
      RDF.quad(expression, prism.publicationDate, RDF.date(data.date), work),
      ...pipe(
        authors,
        RA.reduce(RA.empty, (quads: ReadonlyArray<RDF.Quad>, { person, fullName, role, name }) => [
          ...quads,
          RDF.quad(expression, frbr.creator, person, work),
          RDF.quad(person, rdf.type, frbr.Person, person),
          RDF.quad(person, foaf['name'], RDF.literal(fullName), person),
          RDF.quad(person, tvc.hasValue, name, person),
          RDF.quad(name, rdf.type, tvc.ValueInTime, work),
          RDF.quad(name, rdfs.label, RDF.literal(`${fullName}'s name in ${data.title}`, 'en'), work),
          RDF.quad(name, rdf.property, foaf['name'], work),
          RDF.quad(name, tvc.withValue, RDF.literal(fullName), work),
          RDF.quad(name, tvc.withinContext, expression, work),
          RDF.quad(person, pro.holdsRoleInTime, role, person),
          RDF.quad(role, rdf.type, pro.RoleInTime, work),
          RDF.quad(role, rdfs.label, RDF.literal(`${fullName}'s role in ${data.title}`, 'en'), work),
          RDF.quad(role, pro.withRole, pro.author, work),
          RDF.quad(role, pro.relatesToDocument, expression, work),
        ])
      ),
      RDF.quad(work, rdf.type, fabio.Review, work),
      RDF.quad(work, cito.citesAsRecommendedReading, articleWork, work),
      RDF.quad(work, cito.reviews, articleExpression, work),
      RDF.quad(webPage, rdf.type, fabio.WebPage, work),
      RDF.quad(webPage, fabio.hasURL, RDF.url(data.url), work),
      RDF.quad(webPage, frbr.producer, publisher, work),
      RDF.quad(publisher, rdf.type, org.Organization, RDF.namedNode('_publishers')),
      RDF.quad(publisher, rdfs.label, RDF.literal(data.publisher), RDF.namedNode('_publishers')),
    ],
    D.fromArray,
    data.doi ? D.insert(RDF.quad(expression, prism.doi, RDF.literal(data.doi), work)) : identity,
    data.pdf ? D.union(D.fromArray([
      RDF.quad(expression, fabio.hasManifestation, pdf, work),
      RDF.quad(pdf, rdf.type, fabio.DigitalManifestation, work),
      RDF.quad(pdf, dcterms.format, mediatype('application/pdf'), work),
      RDF.quad(pdf, fabio.hasURL, RDF.url(data.pdf), work),
      RDF.quad(pdf, frbr.producer, publisher, work),
    ])) : identity,
    data.journal ? D.union(D.fromArray([
      RDF.quad(expression, frbr.partOf, journal, work),
      RDF.quad(journal, rdf.type, fabio.Journal, RDF.namedNode('_journals')),
      RDF.quad(journal, dcterms.title, RDF.literal(data.journal), RDF.namedNode('_journals')),
    ])) : identity,
  ))
)

const reviewIdToDoi = (reviewId: string) => reviewId.replace('doi:', '')

const reviewIdToReview = (browser: Browser, details: BiorxivArticleDetails) => flow(
  ([articleDoi, reviewId]: [string, string]) => ({ articleDoi, reviewId }),
  TE.right,
  TE.apS('details', pipe(details, TE.right)),
  TE.bind('doi', ({ reviewId }) => pipe(reviewId, reviewIdToDoi, TE.right)),
  TE.bind('articleWork', ({ articleDoi }) => pipe(articleDoi, partToHashedIri, TE.rightIO)),
  TE.bindW('expression', ({ doi }) => pipe(doi, RDF.namedNode, TE.right)),
  TE.bind('data', ({ doi }) => pipe(doi, fromCrossrefApi(browser), TE.orElse(() => pipe(doi, fromDoi(browser))))),
  TE.chainIOK(reviewExpression),
)

const toRdf = (browser: Browser) => ([, articleDoi, reviewId]: Review) => pipe(
  articleDoi,
  getBiorxivDetails(browser),
  TE.chain(details => sequenceT(TE.ApplyPar)(
    pipe(articleDoi, doiToArticleWork(details), TE.fromIO),
    pipe(articleDoi, doiToArticleExpressions(browser, details)),
    pipe([articleDoi, reviewId], reviewIdToReview(browser, details))
  )),
  TE.map(D.concatAll),
)

const getBiorxivDetails = (browser: Browser) => (doi: string) => pipe(
  doi,
  S.prependWith('https://api.biorxiv.org/details/biorxiv/'),
  getUrl(browser)(biorxivArticleDetails),
  TE.alt(() => pipe(
    doi,
    S.prependWith('https://api.biorxiv.org/details/medrxiv/'),
    getUrl(browser)(biorxivArticleDetails),
  ))
)

const prefixes = {
  cito: cito(),
  dcterms: dcterms(),
  fabio: fabio(),
  foaf: foaf(),
  frbr: frbr(),
  org: org(),
  prism: prism(),
  pro: pro(),
  rdf: rdf(),
  rdfs: rdfs(),
  tvc: tvc(),
  xsd: xsd(),
}

const scietyDataPath = S.surroundWith('https://github.com/sciety/sciety/raw/main/data/reviews/', '.csv')

pipe(
  TE.tryCatch(() => puppeteer.launch({
    headless: true,
    userDataDir: path.join(__dirname, '../cache/puppeteer'),
  }), E.toError),
  TE.chainFirst(browser => pipe(
    [
      '10360d97-bf52-4aef-b2fa-2f60d319edd7', // PREreview
      '19b7464a-edbe-42e8-b7cc-04d1eb1f7332', // Peer Community in Evolutionary Biology
      '32025f28-0506-480e-84a0-b47ef1e92ec5', // Peer Community in Ecology
      '4eebcec9-a4bb-44e1-bde3-2ae11e65daaa', // Peer Community in Animal Science
      '5142a5bc-6b18-42b1-9a8d-7342d7d17e94', // Rapid Reviews COVID-19
      '74fd66e9-3b90-4b5a-a4ab-5be83db4c5de', // Peer Community In Zoology
      '7a9e97d1-c1fe-4ac2-9572-4ecfe28f9f84', // Peer Community in Paleontology
      'f97bd177-5cb6-4296-8573-078318755bf2', // preLights
    ],
    TE.traverseArray(flow(
      scietyDataPath,
      getUrl(browser)(reviews),
      TE.chainW(TE.traverseArray(toRdf(browser))),
      TE.map(D.concatAll),
    )),
    T.chainFirst(() => TE.tryCatch(() => browser.close(), constVoid)),
    TE.map(D.concatAll),
    TE.chainFirstW(pipe(prefixes, TTL.writeToFile(path.join(__dirname, '../../data/data.ttl')))),
  )),
  exit,
)()
