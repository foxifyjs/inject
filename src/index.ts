// tslint:disable:ter-arrow-parens
import * as http from "http";
import { Writable } from "readable-stream";
import * as Url from "url";
import { version } from "../package.json";

function getNullSocket() {
  return new Writable({
    write(chunk: any, encoding: any, callback: any) {
      setImmediate(callback);
    },
  });
}

namespace inject {
  export type Dispatch = (req: http.IncomingMessage, res: http.ServerResponse) => void;

  export interface Options {
    url: string;
    method?: string;
    IncomingMessage?: typeof http.IncomingMessage;
    ServerResponse?: typeof http.ServerResponse;
    headers?: http.IncomingHttpHeaders;
    remoteAddress?: string;
    body?: string | object;
  }

  export type Callback = (err: Error | null, res: Response) => void;

  export interface Response {
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

const inject = (
  dispatch: inject.Dispatch,
  options: inject.Options | string,
  callback?: inject.Callback,
): Promise<inject.Response> => {
  // tslint:disable-next-line:no-parameter-reassignment
  if (typeof options === "string") options = { url: options };

  const opts = {
    IncomingMessage: http.IncomingMessage,
    ServerResponse: http.ServerResponse,
    headers: {} as http.IncomingHttpHeaders,
    method: "GET",
    remoteAddress: "127.0.0.1",
    ...options,
  };

  opts.method = opts.method.toUpperCase();

  let body = opts.body || null;
  if (body) {
    if (typeof body !== "string") {
      body = JSON.stringify(body);

      opts.headers["content-type"] = opts.headers["content-type"] || "application/json";
    }

    opts.headers["content-length"] = Buffer.byteLength(body).toString();
  }

  const socket = getNullSocket();

  const req = new opts.IncomingMessage(socket);

  (req as any)._inject = {
    body,
    isDone: false,
  };

  req.method = opts.method;

  const uri = Url.parse(opts.url);
  req.url = uri.path;

  req.headers = opts.headers;

  req.headers["user-agent"] = req.headers["user-agent"] || `foxify-inject/${version}`;

  const hostHeaderFromUri = () => {
    if (uri.port) {
      return uri.host;
    }

    if (uri.protocol) {
      return uri.hostname + (uri.protocol === "https:" ? ":443" : ":80");
    }

    return null;
  };
  req.headers.host = req.headers.host || hostHeaderFromUri() || "localhost:80";

  req.connection = {
    remoteAddress: opts.remoteAddress,
  } as any;

  req._read = function _read() {
    setImmediate(() => {
      if ((this as any)._inject.body) {
        this.push((this as any)._inject.body);
      }

      this.emit("close");

      this.push(null);
    });
  };

  const res = new opts.ServerResponse(req);

  res.assignSocket(socket);

  (res as any)._inject = {
    bodyChinks: [],
    headers: {},
  };

  (res as any)._headers = {};

  const resWrite = res.write;
  res.write = function write(
    data: any,
    encoding?: string | ((error: Error | null | undefined) => void),
    cb?: (error: Error | null | undefined) => void,
  ) {
    resWrite.call(this, data, encoding as any, cb);
    (this as any)._inject.bodyChinks
      .push(Buffer.from(data, typeof encoding === "string" ? encoding : "utf8"));
    return true;
  };

  const resEnd = res.end;
  res.end = function end(
    chunk?: string | (() => void),
    encoding?: string | (() => void),
    cb?: () => void,
  ) {
    if (chunk && typeof chunk !== "function") this.write(chunk, encoding as any);

    resEnd.call(this, chunk, encoding as any, cb);

    this.emit("finish");
  };

  if (callback) {
    res.once("error", callback);
    res.connection.once("error", callback);

    const cb = () => callback(null, {
      body: Buffer.concat((res as any)._inject.bodyChinks).toString(),
      headers: res.getHeaders(),
      raw: {
        req,
        res,
      },
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
    });

    res.once("finish", cb);

    return dispatch(req, res) as any;
  }

  return new Promise((resolve, reject) => {
    res.once("error", reject);
    res.connection.once("error", reject);

    const cb = () => resolve({
      body: Buffer.concat((res as any)._inject.bodyChinks).toString(),
      headers: res.getHeaders(),
      raw: {
        req,
        res,
      },
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
    });

    res.once("finish", cb);

    dispatch(req, res);
  });
};

export = inject;
