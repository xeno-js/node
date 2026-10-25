import type http from 'node:http'

import type {
  IHttpDispatcher,
  NativeRouteDefinition,
  ResponseDto,
  RouteHandlerContext,
  XenoIncomingRequest,
  XenoRegistry,
  XenoRequest,
} from '@xeno-js/core'
import { Guards, STATUS_CODES } from '@xeno-js/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NodeHttpFactory } from '../node-http.factory'

type TestRegistry = XenoRegistry & { test: object }

const responseDto = (status: number, data: unknown): ResponseDto<unknown> => ({
  status,
  ok: status >= 200 && status < 300,
  headers: {},
  data: data as ResponseDto<unknown>['data'],
})

const createRoute = (
  handler: NativeRouteDefinition<TestRegistry>['handler'],
): NativeRouteDefinition<TestRegistry> => ({
  path: '/test',
  method: 'GET',
  handler,
})

const createMatcher = (route: NativeRouteDefinition<TestRegistry> | undefined) => {
  const match = vi.fn(() => route)
  return { matcher: { match }, match }
}

const createAdapter = () => {
  const adapt = vi.fn((incoming: XenoIncomingRequest) =>
    Object.assign(new Request(`http://localhost${incoming.url}`), {
      path: incoming.path,
      socket: incoming.socket,
    }),
  )
  return { adapter: { adapt }, adapt }
}

const startedServers: http.Server[] = []

const startServer = async (factory: NodeHttpFactory<TestRegistry>) => {
  const server = factory.create()
  startedServers.push(server)

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (!Guards.isDefined(address) || Guards.isString(address))
    throw new Error('Expected server to listen on a TCP port')

  return { server, url: `http://127.0.0.1:${address.port}` }
}

afterEach(async () => {
  await Promise.all(
    startedServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error !== undefined) reject(error)
            else resolve()
          })
        }),
    ),
  )
})

describe('NodeHttpFactory', () => {
  it('returns a 404 response when no route matches', async () => {
    const { matcher, match } = createMatcher(undefined)
    const dispatcher: IHttpDispatcher<TestRegistry> = {
      handle: async () => {
        throw new Error('Unexpected dispatcher call')
      },
    }
    const { adapter, adapt } = createAdapter()
    const factory = new NodeHttpFactory(matcher, dispatcher, adapter)
    const { url } = await startServer(factory)

    const response = await fetch(`${url}/missing`)

    expect(match).toHaveBeenCalledWith('/missing', 'GET')
    expect(response.status).toBe(STATUS_CODES.NOT_FOUND)
    await expect(response.json()).resolves.toEqual({
      error: 'Route GET /missing not found',
    })
    expect(adapt).not.toHaveBeenCalled()
  })

  it('adapts a matched request and returns the route response', async () => {
    const routeResponse = responseDto(201, { created: true })
    const handlerSpy = vi.fn<(ctx: RouteHandlerContext<TestRegistry>) => void>()
    const handler: NativeRouteDefinition<TestRegistry>['handler'] = async <TOutput>(
      ctx: RouteHandlerContext<TestRegistry>,
    ) => {
      handlerSpy(ctx)
      return routeResponse as ResponseDto<TOutput>
    }
    const route = createRoute(handler)
    const { matcher, match } = createMatcher(route)
    const dispatcher: IHttpDispatcher<TestRegistry> = {
      handle: async <TInput, TOutput>(
        _req: XenoRequest,
        _token: keyof TestRegistry,
        _input?: TInput,
      ) => responseDto(200, {}) as ResponseDto<TOutput>,
    }
    const { adapter, adapt } = createAdapter()
    const factory = new NodeHttpFactory(matcher, dispatcher, adapter)
    const { url } = await startServer(factory)

    const response = await fetch(`${url}/test?source=unit`)

    expect(match).toHaveBeenCalledWith('/test?source=unit', 'GET')
    expect(adapt).toHaveBeenCalledOnce()
    expect(handlerSpy).toHaveBeenCalledOnce()
    expect(response.status).toBe(201)
    expect(response.headers.get('content-type')).toBe('application/json')
    await expect(response.json()).resolves.toEqual({ created: true })
  })

  it('passes a parsed request body to the adapter', async () => {
    const route = createRoute(async <TOutput>() => responseDto(200, {}) as ResponseDto<TOutput>)
    const { matcher } = createMatcher(route)
    const dispatcher: IHttpDispatcher<TestRegistry> = {
      handle: async <TInput, TOutput>(
        _req: XenoRequest,
        _token: keyof TestRegistry,
        _input?: TInput,
      ) => responseDto(200, {}) as ResponseDto<TOutput>,
    }
    const { adapter, adapt } = createAdapter()
    const factory = new NodeHttpFactory(matcher, dispatcher, adapter)
    const { url } = await startServer(factory)

    const response = await fetch(`${url}/test`, {
      method: 'POST',
      body: 'request payload',
    })

    expect(response.status).toBe(200)
    expect(adapt).toHaveBeenCalledOnce()
    expect(adapt.mock.calls[0][0].body).toEqual(Buffer.from('request payload'))
  })

  it('returns a 500 response when the route handler throws', async () => {
    const route = createRoute(async () => {
      throw new Error('route failed')
    })
    const { matcher } = createMatcher(route)
    const dispatcher: IHttpDispatcher<TestRegistry> = {
      handle: async () => {
        throw new Error('Unexpected dispatcher call')
      },
    }
    const { adapter } = createAdapter()
    const factory = new NodeHttpFactory(matcher, dispatcher, adapter)
    const { url } = await startServer(factory)

    const response = await fetch(`${url}/test`)

    expect(response.status).toBe(STATUS_CODES.INTERNAL_SERVER_ERROR)
    await expect(response.json()).resolves.toEqual({ error: 'route failed' })
  })
})
