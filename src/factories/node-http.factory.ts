/* eslint-disable @typescript-eslint/no-empty-object-type */
import http from 'node:http'

import type {
    IFactory,
    IHttpAdapter,
    IHttpDispatcher,
    IRouteMatcher,
    XenoRegistry,
} from '@xeno-js/core'
import { Guards, STATUS_CODES } from '@xeno-js/core'

import { NodeRequestMapper } from '../mappers/node-request.mappers'

export interface IHttpNodeFactory extends IFactory<void, http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>> { }

export class NodeHttpFactory<TRegistry extends XenoRegistry = XenoRegistry> implements IHttpNodeFactory {

    constructor(
        private readonly _routeMatcher: IRouteMatcher,
        private readonly _dispatcher: IHttpDispatcher<TRegistry>,
        private readonly _adapter: IHttpAdapter
    ) { }

    create(): http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> {
        return http.createServer((req, res) => {
            void (async () => {
                try {
                    const matchedRoute = this._routeMatcher.match(req.url ?? '/', req.method ?? 'GET')

                    if (!Guards.isDefined(matchedRoute))
                        return NodeRequestMapper.mapResponse(res, STATUS_CODES.NOT_FOUND, { error: `Route ${req.method} ${req.url} not found` })

                    const incomingRequest = NodeRequestMapper.mapRequest(req)

                    const extendedRequest = this._adapter.adapt(incomingRequest)

                    const routeResult = await matchedRoute.handler({
                        req: extendedRequest,
                        handle: (token, input) => this._dispatcher.handle(extendedRequest, token, input),
                    })

                    if (Guards.isDefined(routeResult)) {
                        NodeRequestMapper.mapResponse(res, routeResult.status, routeResult.data, routeResult.headers)
                    }

                } catch (error) {
                    NodeRequestMapper.mapResponse(res, STATUS_CODES.INTERNAL_SERVER_ERROR, { error: (error as Error).message })
                }
            })()
        })
    }
}