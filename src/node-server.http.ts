import type http from 'node:http'

import type {
    IHttpServer,
    NativeListenOptions,
    Optional,
} from '@xeno-js/core'
import { Guards } from '@xeno-js/core'

import type { IHttpNodeFactory } from './factories/node-http.factory'

export class NodeHttpServer implements IHttpServer {
    private _serverInstance: Optional<http.Server> = undefined
    
    constructor(
        private readonly _factoryServer: IHttpNodeFactory
    ) { }

    public async listen<T = void>(options: NativeListenOptions): Promise<T> {
        this._serverInstance = this._factoryServer.create()
        return new Promise<void>((resolve) => {
            this._serverInstance?.listen(options.port, options.host, () => {
                options.onListening?.({ port: options.port ?? 3000, host: options.host ?? 'localhost' })
                resolve()
            })
        }) as Promise<T>
    }

    public async dispose(): Promise<void> {
        if (Guards.isDefined(this._serverInstance)) {
            await new Promise<void>((resolve) => {
                this._serverInstance!.close(() => resolve())
            })
            this._serverInstance = undefined
        }
    }
}
