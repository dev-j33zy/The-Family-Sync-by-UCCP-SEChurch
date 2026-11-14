// Standalone-script helper: registers Node module-resolution hooks so the
// Next.js-style imports inside lib/ (the '@/' path alias and the 'next/server'
// subpath) resolve when these modules are loaded by plain `node` scripts.
//
// Node >= 24/26 prefers module.registerHooks(); older runtimes fall back to
// module.register() with a data-URL loader module.

import * as nodeModule from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const rootUrl = new URL('../', import.meta.url).href

// '@/lib/models' -> lib/models/index.js (matching Next's extension-less imports)
export function resolveAliasPath(p) {
  if (/\.[a-z0-9]+$/i.test(p)) return p
  if (existsSync(fileURLToPath(new URL(p + '.js', rootUrl)))) return p + '.js'
  if (existsSync(fileURLToPath(new URL(p + '/index.js', rootUrl)))) return p + '/index.js'
  return p + '.js'
}

function resolveImport(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    return nextResolve(new URL(resolveAliasPath(specifier.slice(2)), rootUrl).href, context)
  }
  if (specifier === 'next/server' || specifier === 'next/headers') {
    const sub = specifier.slice('next/'.length)
    return nextResolve(new URL('node_modules/next/' + sub + '.js', rootUrl).href, context)
  }
  return nextResolve(specifier, context)
}

const LOADER_SRC = `
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
const rootUrl = ${JSON.stringify(rootUrl)}
function resolveAliasPath(p) {
  if (/\\.[a-z0-9]+$/i.test(p)) return p
  if (existsSync(new URL(p + '.js', rootUrl))) return p + '.js'
  if (existsSync(new URL(p + '/index.js', rootUrl))) return p + '/index.js'
  return p + '.js'
}
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    return nextResolve(new URL(resolveAliasPath(specifier.slice(2)), rootUrl).href, context)
  }
  if (specifier === 'next/server' || specifier === 'next/headers') {
    const sub = specifier.slice('next/'.length)
    return nextResolve(new URL('node_modules/next/' + sub + '.js', rootUrl).href, context)
  }
  return nextResolve(specifier, context)
}
`

export function registerPathHooks() {
  if (typeof nodeModule.registerHooks === 'function') {
    nodeModule.registerHooks({ resolve: resolveImport })
    return
  }
  if (typeof nodeModule.register === 'function') {
    nodeModule.register('data:text/javascript;base64,' + Buffer.from(LOADER_SRC).toString('base64'), import.meta.url)
    return
  }
  throw new Error('registerPathHooks: no supported module hook API in this Node version')
}
