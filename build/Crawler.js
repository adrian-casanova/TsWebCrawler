"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlerFactory = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const node_child_process_1 = require("node:child_process");
const Log_1 = require("./Log");
const axios_1 = __importDefault(require("axios"));
const LinkQueue_1 = __importDefault(require("./LinkQueue"));
const fs = __importStar(require("fs"));
const Utils_1 = __importDefault(require("./Utils"));
const LINK_PROCESSING_WINDOW = 10;
const CRAWLER_PROCESSING_WINDOW = 10;
class Crawler {
    constructor(browser, page, entryPoint) {
        this.queue = new LinkQueue_1.default();
        this.cache = new Map();
        this.page = page;
        this.browser = browser;
        this.entryPoint = new URL(entryPoint);
    }
    checkIfLinkIsGood(url) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield axios_1.default.get(url);
                Log_1.log.info(url, "status: ", response.status);
                return { url, isGood: true, statusCode: response.status };
            }
            catch (e) {
                // @ts-ignore
                Log_1.log.error(url, "status: ", (_a = e === null || e === void 0 ? void 0 : e.response) === null || _a === void 0 ? void 0 : _a.status);
                // @ts-ignore
                return { url, isGood: false, statusCode: (_b = e === null || e === void 0 ? void 0 : e.response) === null || _b === void 0 ? void 0 : _b.status };
            }
        });
    }
    fetchLinks() {
        return __awaiter(this, void 0, void 0, function* () {
            Log_1.log.debug("Fetching Links");
            const anchorTags = yield this.page.$$("a");
            const links = [];
            for (const tag of anchorTags) {
                const href = yield tag.getProperty("href");
                const value = yield href.jsonValue();
                const url = new URL(value);
                if (url.hostname === this.entryPoint.hostname) {
                    links.push(value);
                }
            }
            return links;
        });
    }
    init(entryPoint) {
        return __awaiter(this, void 0, void 0, function* () {
            Log_1.log.debug("Page INIT");
            yield this.page.goto(entryPoint, {
                waitUntil: "networkidle2",
            });
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            Log_1.log.debug("CLOSING");
            this.browser.close();
        });
    }
    checkLinks(links) {
        return __awaiter(this, void 0, void 0, function* () {
            Log_1.log.debug("CHCKING: ", links.length, " LINKS");
            const fullResult = [];
            for (let i = 0; i < links.length; i += LINK_PROCESSING_WINDOW) {
                const promises = [];
                for (let j = 0; j < LINK_PROCESSING_WINDOW; j++) {
                    const link = links[i + j];
                    if (this.cache.has(link)) {
                        Log_1.log.warn("LINK ALREADY SEEN");
                        continue;
                    }
                    this.cache.set(link, true);
                    promises.push(this.checkIfLinkIsGood(link));
                }
                const result = yield Promise.all(promises);
                for (const output of result) {
                    fullResult.push({ link: output.url, status: output.statusCode });
                    if (output.isGood) {
                        this.queue.add(output.url);
                    }
                }
                yield Utils_1.default.sleep(2 * 1000);
            }
            return fullResult;
        });
    }
    spawnChildCrawler(link) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const crawlerCmd = (0, node_child_process_1.spawn)("node", [__dirname + "/childCrawler.js", link]);
                crawlerCmd.stdout.on("data", (data) => {
                    Log_1.log.debug("CRAWERL CMD: ", data.toString());
                });
                crawlerCmd.stderr.on("data", (err) => {
                    Log_1.log.error("CRAWERL ERR: ", err.toString());
                });
                crawlerCmd.on("close", (exitCode) => {
                    // log.debug("CRAWERL CLOSED: ", exitCode);
                    resolve(null);
                });
            });
        });
    }
    crawl(depth) {
        return __awaiter(this, void 0, void 0, function* () {
            Log_1.log.debug("CRAWLING");
            const links = yield this.fetchLinks();
            const result = yield this.checkLinks(links);
            fs.writeFileSync(__dirname +
                "/../result/" +
                encodeURIComponent(this.entryPoint.toString()) +
                ".json", JSON.stringify(result));
            if (depth === 1) {
                yield this.close();
                return;
            }
            while (this.queue.size() > 0) {
                const promises = [];
                const linksChecked = [];
                for (let i = 0; i < CRAWLER_PROCESSING_WINDOW; i++) {
                    const link = this.queue.get();
                    if (link) {
                        linksChecked.push(link);
                        promises.push(this.spawnChildCrawler(link));
                    }
                }
                yield Promise.all(promises);
                for (const linkChecked of linksChecked) {
                    try {
                        const file = fs.readFileSync(__dirname +
                            "/../result/" +
                            encodeURIComponent(linkChecked) +
                            ".json", "utf8");
                        let parsed = JSON.parse(file);
                        for (const entry of parsed) {
                            if (entry.status < 300 && entry.status >= 200) {
                                if (!this.cache.has(entry.link)) {
                                    this.cache.set(entry.link, true);
                                    this.queue.add(entry.link);
                                }
                            }
                        }
                    }
                    catch (e) { }
                }
            }
            this.close();
        });
    }
}
class CrawlerFactory {
    static createCrawler(entryPoint) {
        return __awaiter(this, void 0, void 0, function* () {
            const browser = yield puppeteer_1.default.launch({
                headless: "new",
            });
            const page = yield browser.newPage();
            return new Crawler(browser, page, entryPoint);
        });
    }
}
exports.CrawlerFactory = CrawlerFactory;
