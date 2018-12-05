"use strict";
// tslint:disable:ter-arrow-parens
const http = require("http");
const readable_stream_1 = require("readable-stream");
const Url = require("url");
const package_json_1 = require("../package.json");
function getNullSocket() {
    return new readable_stream_1.Writable({
        write(chunk, encoding, callback) {
            setImmediate(callback);
        },
    });
}
const inject = (dispatch, options, callback) => {
    // tslint:disable-next-line:no-parameter-reassignment
    if (typeof options === "string")
        options = { url: options };
    const opts = Object.assign({ IncomingMessage: http.IncomingMessage, ServerResponse: http.ServerResponse, headers: {}, method: "GET", remoteAddress: "127.0.0.1" }, options);
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
    req._inject = {
        body,
        isDone: false,
    };
    req.method = opts.method;
    const uri = Url.parse(opts.url);
    req.url = uri.path;
    req.headers = opts.headers;
    req.headers["user-agent"] = req.headers["user-agent"] || `foxify-inject/${package_json_1.version}`;
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
    };
    req._read = function _read() {
        setImmediate(() => {
            if (this._inject.body) {
                this.push(this._inject.body);
            }
            this.emit("close");
            this.push(null);
        });
    };
    const res = new opts.ServerResponse(req);
    res.assignSocket(socket);
    res._inject = {
        bodyChinks: [],
        headers: {},
    };
    res._headers = {};
    const resWrite = res.write;
    res.write = function write(data, encoding, cb) {
        resWrite.call(this, data, encoding, cb);
        this._inject.bodyChinks
            .push(Buffer.from(data, typeof encoding === "string" ? encoding : "utf8"));
        return true;
    };
    const resEnd = res.end;
    res.end = function end(chunk, encoding, cb) {
        if (chunk && typeof chunk !== "function")
            this.write(chunk, encoding);
        resEnd.call(this, chunk, encoding, cb);
        this.emit("finish");
    };
    if (callback) {
        res.once("error", callback);
        res.connection.once("error", callback);
        const cb = () => callback(null, {
            body: Buffer.concat(res._inject.bodyChinks).toString(),
            headers: res.getHeaders(),
            raw: {
                req,
                res,
            },
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
        });
        res.once("finish", cb);
        return dispatch(req, res);
    }
    return new Promise((resolve, reject) => {
        res.once("error", reject);
        res.connection.once("error", reject);
        const cb = () => resolve({
            body: Buffer.concat(res._inject.bodyChinks).toString(),
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
module.exports = inject;
//# sourceMappingURL=index.js.map