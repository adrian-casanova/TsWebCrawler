import puppeteer, { Browser, Page } from "puppeteer";
import { spawn } from "node:child_process";
import { log } from "./Log";
import axios from "axios";
import LinkQueue from "./LinkQueue";
import * as fs from "fs";
import Utils from "./Utils";

const LINK_PROCESSING_WINDOW = 10;

const CRAWLER_PROCESSING_WINDOW = 10;

interface FullResult {
  link: string;
  status: number;
}

class Crawler {
  page: Page;
  browser: Browser;

  queue: LinkQueue<string> = new LinkQueue();

  cache: Map<string, boolean> = new Map();

  entryPoint: URL;

  constructor(browser: Browser, page: Page, entryPoint: string) {
    this.page = page;
    this.browser = browser;
    this.entryPoint = new URL(entryPoint);
  }

  async checkIfLinkIsGood(url: string) {
    try {
      const response = await axios.get(url);
      log.info(url, "status: ", response.status);
      return { url, isGood: true, statusCode: response.status };
    } catch (e) {
      // @ts-ignore
      log.error(url, "status: ", e?.response?.status);
      // @ts-ignore
      return { url, isGood: false, statusCode: e?.response?.status };
    }
  }

  async fetchLinks(): Promise<string[]> {
    log.debug("Fetching Links");
    const anchorTags = await this.page.$$("a");

    const links: string[] = [];

    for (const tag of anchorTags) {
      const href = await tag.getProperty("href");
      const value = await href.jsonValue();

      const url = new URL(value);

      if (url.hostname === this.entryPoint.hostname) {
        links.push(value);
      }
    }

    return links;
  }

  async init(entryPoint: string) {
    log.debug("Page INIT");
    await this.page.goto(entryPoint, {
      waitUntil: "networkidle2",
    });
  }

  async close() {
    log.debug("CLOSING");
    this.browser.close();
  }

  async checkLinks(links: string[]) {
    log.debug("CHCKING: ", links.length, " LINKS");
    const fullResult: FullResult[] = [];
    for (let i = 0; i < links.length; i += LINK_PROCESSING_WINDOW) {
      const promises = [];
      for (let j = 0; j < LINK_PROCESSING_WINDOW; j++) {
        const link = links[i + j];
        if (this.cache.has(link)) {
          log.warn("LINK ALREADY SEEN");
          continue;
        }
        this.cache.set(link, true);
        promises.push(this.checkIfLinkIsGood(link));
      }

      const result = await Promise.all(promises);

      for (const output of result) {
        fullResult.push({ link: output.url, status: output.statusCode });
        if (output.isGood) {
          this.queue.add(output.url);
        }
      }
      await Utils.sleep(2 * 1000);
    }

    return fullResult;
  }

  async spawnChildCrawler(link: string) {
    return new Promise((resolve, reject) => {
      const crawlerCmd = spawn("node", [__dirname + "/childCrawler.js", link]);

      crawlerCmd.stdout.on("data", (data) => {
        log.debug("CRAWERL CMD: ", data.toString());
      });

      crawlerCmd.stderr.on("data", (err) => {
        log.error("CRAWERL ERR: ", err.toString());
      });

      crawlerCmd.on("close", (exitCode) => {
        // log.debug("CRAWERL CLOSED: ", exitCode);
        resolve(null);
      });
    });
  }

  async crawl(depth?: number) {
    log.debug("CRAWLING");
    const links = await this.fetchLinks();
    const result = await this.checkLinks(links);

    fs.writeFileSync(
      __dirname +
        "/../result/" +
        encodeURIComponent(this.entryPoint.toString()) +
        ".json",
      JSON.stringify(result)
    );
    if (depth === 1) {
      await this.close();
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

      await Promise.all(promises);

      for (const linkChecked of linksChecked) {
        try {
          const file = fs.readFileSync(
            __dirname +
              "/../result/" +
              encodeURIComponent(linkChecked) +
              ".json",
            "utf8"
          );

          let parsed: FullResult[] = JSON.parse(file);

          for (const entry of parsed) {
            if (entry.status < 300 && entry.status >= 200) {
              if (!this.cache.has(entry.link)) {
                this.cache.set(entry.link, true);
                this.queue.add(entry.link);
              }
            }
          }
        } catch (e) {}
      }
    }

    this.close();
  }
}

export class CrawlerFactory {
  static async createCrawler(entryPoint: string) {
    const browser = await puppeteer.launch({
      headless: "new",
    });
    const page = await browser.newPage();
    return new Crawler(browser, page, entryPoint);
  }
}
