"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class LinkQueue {
    constructor() {
        this.data = [];
    }
    add(value) {
        this.data.push(value);
    }
    get() {
        return this.data.shift();
    }
    size() {
        return this.data.length;
    }
}
exports.default = LinkQueue;
