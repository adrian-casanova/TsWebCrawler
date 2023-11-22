"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Utils {
    static sleep(timeout) {
        return new Promise((resolve) => {
            setTimeout(resolve, timeout);
        });
    }
}
exports.default = Utils;
