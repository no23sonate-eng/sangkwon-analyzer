// fnnews 기사 스크린샷 + 강조 문장 "줄 단위" rect 추출
import {chromium} from 'playwright-core';
const PHRASE = '정부는 하남시와 미국 기업 스피어가 추진하는 K팝 공연장의 행정절차 소요시간을 기존 42개월 이상에서 21개월로 단축하기로 했다.';
const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page = await browser.newPage({viewport: {width: 1440, height: 2400}, deviceScaleFactor: 1.5});
try {
  await page.goto('file://' + process.cwd() + '/fn_article_page.html', {waitUntil: 'networkidle'});
  const rects = await page.evaluate((phrase) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.textContent.indexOf(phrase);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + phrase.length);
        return Array.from(r.getClientRects())
          .filter((b) => b.width > 8)
          .map((b) => ({x: b.x, y: b.y + window.scrollY, w: b.width, h: b.height}));
      }
    }
    return null;
  }, PHRASE);
  await page.screenshot({path: 'fn_article.png', fullPage: true});
  console.log(JSON.stringify(rects));
} finally { await browser.close(); }
