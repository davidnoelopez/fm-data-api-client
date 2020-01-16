import fetch, {Headers, RequestInit} from 'node-fetch';
import Layout from './Layout';

export class FileMakerError extends Error
{
    public readonly code : string;

    public constructor(code : string, message : string)
    {
        super(message);
        this.code = code;
    }
}

export default class Client
{
    private token : string | null = null;
    private lastCall = 0;

    public constructor(
        private uri : string,
        private database : string,
        private username : string,
        private password : string
    )
    {
    }

    public layout(layout : string) : Layout
    {
        return new Layout(layout, this);
    }

    public async request(path : string, request? : RequestInit) : Promise<any>
    {
        request = Client.injectHeaders(
            new Headers({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await this.getToken()}`,
            }),
            request
        );

        const response = await fetch(`${this.uri}/fmi/data/v1/databases/${this.database}/${path}`, request);

        if (!response.ok) {
            const data = await response.json();
            throw new FileMakerError(data.messages[0].code, data.messages[0].message);
        }

        return (await response.json()).response;
    }

    private async getToken() : Promise<string>
    {
        if (this.token !== null && Date.now() - this.lastCall < 14 * 60 * 1000) {
            return this.token;
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
        };

        const response = await fetch(`${this.uri}/fmi/data/v1/databases/${this.database}/sessions`, {
            method: 'POST',
            body: '{}',
            headers,
        });

        if (!response.ok) {
            const data = await response.json();
            throw new FileMakerError(data.messages[0].code, data.messages[0].message);
        }

        this.token = response.headers.get('X-FM-Data-Access-Token');

        if (!this.token) {
            throw new Error('Could not get token');
        }

        this.lastCall = Date.now();
        return this.token;
    }

    private static injectHeaders(headers : Headers, request? : RequestInit) : RequestInit
    {
        if (!request) {
            request = {};
        }

        if (!request.headers) {
            request.headers = {};
        }

        if (request.headers instanceof Headers) {
            for (const header of headers) {
                request.headers.append(header[0], header[1]);
            }
        } else if (Array.isArray(request.headers)) {
            for (const header of headers) {
                request.headers.push(header);
            }
        } else {
            for (const header of headers) {
                request.headers[header[0]] = header[1];
            }
        }

        return request;
    }
}