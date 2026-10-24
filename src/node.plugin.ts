import type { HttpServerPlugin, IAppBuilder, IConfigurationService, IXenoApplication, XenoRegistry } from '@xeno-js/core'
import { definePlugin, HttpServerModule, TOKENS } from '@xeno-js/core'

import { NodeHttpFactory } from './factories/node-http.factory'
import { NodeHttpServer } from './node-server.http'

/**
 * @description Plugin per registrare il server HTTP nativo Node.js in Xeno.JS.
 * Gestisce automaticamente il fallback se non vengono definite rotte tramite addRoutes.
 */
export const withNodeHttpServer = <TRegistry extends XenoRegistry = XenoRegistry>(): HttpServerPlugin<TRegistry> => {
    return definePlugin('http-server', (builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>, _config: IConfigurationService) => {
        builder.addModule(
            'HttpServerModule',
            async () => new HttpServerModule<TRegistry>(),
            undefined,
            9
        )

        builder.addServices((container) => {
            container.addSingleton(TOKENS.HTTP_SERVER, (c) => {
                const routeMatcher = c.resolve(TOKENS.ROUTE_MATCHER)
                const dispatcher = c.resolve(TOKENS.HTTP_DISPATCHER)
                const adapter = c.resolve(TOKENS.HTTP_ADAPTER)
                const factory = new NodeHttpFactory(routeMatcher, dispatcher, adapter)

                return new NodeHttpServer(factory)
            })
        }, 10)
    })
}
