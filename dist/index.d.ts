/// <reference types="node" />
import * as http from "http";
declare namespace inject {
    type Dispatch = (req: http.IncomingMessage, res: http.ServerResponse) => void;
    interface Options {
        url: string;
        method?: string;
        IncomingMessage?: typeof http.IncomingMessage;
        ServerResponse?: typeof http.ServerResponse;
        headers?: http.IncomingHttpHeaders;
        remoteAddress?: string;
        body?: string | object;
    }
    type Callback = (err: Error | null, res: Response) => void;
    interface Response {
        raw: {
            req: http.IncomingMessage;
            res: http.ServerResponse;
        };
        headers: http.OutgoingHttpHeaders;
        statusCode: number;
        statusMessage: string;
        body: string;
    }
}
declare const inject: (dispatch: inject.Dispatch, options: string | inject.Options, callback?: inject.Callback | undefined) => Promise<inject.Response>;
export = inject;
//# sourceMappingURL=index.d.ts.map