import type http from 'node:http'
import type { IncomingMessage, OutgoingHttpHeaders } from 'node:http'

import { Guards, HttpHelper, StringHelper, type XenoIncomingRequest } from '@xeno-js/shared'

export class NodeRequestMapper {
    /**
     * @description Maps the body of a Node.js IncomingMessage to the body of a XenoIncomingRequest.
     * @param req - The Node.js IncomingMessage to map.
     * @returns The mapped body of the XenoIncomingRequest.
     */
    private static parseBody(req: IncomingMessage): Promise<Buffer | undefined> {
        return new Promise((resolve, reject) => {
            const method = req.method?.toUpperCase()

            if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
                return resolve(undefined)
            }

            const chunks: Buffer[] = []

            req.on('data', (chunk: Buffer) => {
                chunks.push(chunk)
            })

            req.on('end', () => {
                if (chunks.length === 0) return resolve(undefined)
                resolve(Buffer.concat(chunks))
            })

            req.on('error', (err) => {
                reject(err)
            })
        })
    }
    /**
     * @description Maps a Node.js IncomingMessage object to a XenoIncomingRequest object.
     *
     * @param {IncomingMessage} req - The Node.js IncomingMessage object to be mapped.
     * @returns {XenoIncomingRequest} - The mapped XenoIncomingRequest object.
     */
    public static mapRequest(req: IncomingMessage, rawBody?: unknown): XenoIncomingRequest {
        const normalizedHeaders = HttpHelper.normalizeHeaders(req.headers)

        const url = req.url ?? '/'
        const path = url.split('?')[0]

        return {
            url,
            path,
            method: req.method ?? 'GET',
            headers: new Headers(normalizedHeaders as HeadersInit),
            body: rawBody,
            query: undefined,
            signal: undefined,
            socket: {
                remoteAddress: req.socket?.remoteAddress,
                remotePort: req.socket?.remotePort,
            },
        }
    }

    /**
     * @description Maps a Node.js ServerResponse object to a XenoResponse object.
     *
     * @param {http.ServerResponse} res - The Node.js ServerResponse object to be mapped.
     * @param {number} status - The HTTP status code to be set in the response.
     * @param {unknown} body - The response body to be sent.
     * @param {OutgoingHttpHeaders} [headers] - Optional headers to be set in the response.
     * @returns {void} - This function does not return a value.
     */
    public static mapResponse(res: http.ServerResponse, status: number, body: unknown, headers?: OutgoingHttpHeaders): void {
        if (res.writableEnded) return

        const defaultHeaders = { 'Content-Type': 'application/json', ...headers }
        res.writeHead(status, defaultHeaders)

        const payload = Guards.isString(body) ? body : StringHelper.safeStringify(body)

        res.end(payload)
    }
}
