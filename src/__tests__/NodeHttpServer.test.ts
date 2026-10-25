import http from 'node:http'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { IHttpNodeFactory } from '../factories/node-http.factory'
import { NodeHttpServer } from '../node-server.http'

const startedServers: http.Server[] = []

const createServerFactory = () => {
  const create = vi.fn(() => {
    const server = http.createServer()
    startedServers.push(server)
    return server
  })

  return { factory: { create } satisfies IHttpNodeFactory, create }
}

afterEach(async () => {
  await Promise.all(
    startedServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          if (!server.listening) {
            resolve()
            return
          }

          server.close((error) => {
            if (error !== undefined) reject(error)
            else resolve()
          })
        }),
    ),
  )
})

describe('NodeHttpServer', () => {
  it('creates and starts the HTTP server with the requested listen options', async () => {
    const { factory, create } = createServerFactory()
    const server = new NodeHttpServer(factory)
    const onListening = vi.fn()

    await server.listen({
      port: 0,
      host: '127.0.0.1',
      onListening,
    })

    expect(create).toHaveBeenCalledOnce()
    expect(startedServers[0].listening).toBe(true)
    expect(onListening).toHaveBeenCalledWith({ port: 0, host: '127.0.0.1' })

    await server.dispose()

    expect(startedServers[0].listening).toBe(false)
  })

  it('uses default callback address values when options are omitted', async () => {
    const { factory } = createServerFactory()
    const server = new NodeHttpServer(factory)
    const onListening = vi.fn()

    await server.listen({ onListening })

    expect(onListening).toHaveBeenCalledWith({ port: 3000, host: 'localhost' })

    await server.dispose()
  })

  it('allows disposal before listening and repeated disposal', async () => {
    const { factory, create } = createServerFactory()
    const server = new NodeHttpServer(factory)

    await expect(server.dispose()).resolves.toBeUndefined()
    expect(create).not.toHaveBeenCalled()

    await server.listen({})
    await server.dispose()
    await expect(server.dispose()).resolves.toBeUndefined()
  })
})
