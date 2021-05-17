declare module 'http-equiv-refresh' {

  const httpEquivRefresh: (content: string) => { timeout: number, url: string | null } | { timeout: null, url: null }

  export = httpEquivRefresh

}
