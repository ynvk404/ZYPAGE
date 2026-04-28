const express = require("express");
const puppeteer = require("puppeteer");
const app = express();

app.use(express.static("public"));

function parseAmount(text) {
  const digits = (text || "").match(/\d/g);
  return digits ? parseInt(digits.join(""), 10) : 0;
}

async function autoScroll(page) {
  let lastHeight = 0;

  for (let i = 0; i < 50; i++) {
    const newHeight = await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      return document.body.scrollHeight;
    });

    await page.waitForTimeout(800);

    if (newHeight === lastHeight) break;
    lastHeight = newHeight;
  }
}

app.get("/crawl", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.json({ error: "missing url" });

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    await autoScroll(page);

    const data = await page.evaluate(() => {
      const items = document.querySelectorAll(".history_wall_item");

      const result = [];

      items.forEach(item => {
        const name = item.querySelector(".awi_name")?.innerText?.trim() || "Ẩn danh";
        const time = item.querySelector(".awi_time")?.innerText?.trim() || "";

        let amountText = "0đ";

        item.querySelectorAll(".awi_amount").forEach(el => {
          const t = el.innerText.trim();
          if (/\d/.test(t) && t.includes("đ")) amountText = t;
        });

        result.push({ name, time, amountText });
      });

      return result;
    });

    const parsed = data.map(d => ({
      ...d,
      amount: parseAmount(d.amountText)
    }));

    res.json(parsed);

  } catch (e) {
    res.json({ error: "crawl failed", detail: e.message });
  } finally {
    if (browser) await browser.close();
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running", port));
