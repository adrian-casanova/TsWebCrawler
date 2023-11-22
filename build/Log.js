"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = void 0;
const log4js_1 = __importDefault(require("log4js"));
const log = log4js_1.default.getLogger();
exports.log = log;
log.level = "debug";
