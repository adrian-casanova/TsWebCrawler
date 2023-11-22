import { CrawlerFactory } from "./Crawler";

async function main(entryPoint: string) {
  const crawler = await CrawlerFactory.createCrawler(entryPoint);
  await crawler.init(entryPoint);
  await crawler.crawl(1);
}

const entryPoint = process.argv[2];
main(entryPoint);
