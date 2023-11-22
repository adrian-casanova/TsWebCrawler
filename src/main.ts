import { CrawlerFactory } from "./Crawler";

async function main(entryPoint: string) {
  const crawler = await CrawlerFactory.createCrawler(entryPoint);
  await crawler.init(entryPoint);
  await crawler.crawl();
}

const entryPoint = process.argv[2];

if (!entryPoint) {
  console.error("No entry point passed");
  process.exit(1);
}

main(entryPoint);
