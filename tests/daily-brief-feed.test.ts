import { describe, expect, it } from "vitest";
import {
  DAILY_BRIEF_SOURCE_EXCERPT_MAX_CHARS,
  parseFeed,
} from "@/lib/daily-brief/feed";

const source = {
  id: "source-1",
  name: "WTO News",
  feed_url: "https://www.wto.org/english/news_e/news_e.rss",
};

describe("Daily Brief RSS and Atom parsing", () => {
  it("parses RSS metadata, keeps the HTTPS original link, and prefers description over content:encoded", () => {
    const xml = `
      <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
        <channel>
          <item>
            <title><![CDATA[WTO members review carbon market policies]]></title>
            <link>https://www.wto.org/english/news_e/news26_e/carbon.htm?utm_source=rss#section</link>
            <description><![CDATA[<p>Members reviewed recent carbon market policies and their trade effects.</p>]]></description>
            <content:encoded><![CDATA[This full article body must never be used.]]></content:encoded>
            <pubDate>Mon, 24 Aug 2026 08:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    const items = parseFeed(xml, source);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceName: "WTO News",
      title: "WTO members review carbon market policies",
      canonicalUrl: "https://www.wto.org/english/news_e/news26_e/carbon.htm?utm_source=rss",
      summary: "Members reviewed recent carbon market policies and their trade effects.",
      publishedSourceAt: "2026-08-24T08:00:00.000Z",
    });
    expect(items[0].summary).not.toContain("full article body");
  });

  it("parses common Atom metadata and chooses the HTTPS alternate article link", () => {
    const xml = `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title type="html"><![CDATA[Trade policy update &amp; market access]]></title>
          <link rel="self" href="https://www.wto.org/feeds/entry-1" />
          <link rel="alternate" type="text/html" href="/english/news_e/news26_e/market_access.htm" />
          <summary type="html"><![CDATA[<p>A short official account of the latest market-access discussion.</p>]]></summary>
          <content type="html"><![CDATA[This complete Atom content must never be used.]]></content>
          <updated>2026-08-24T09:30:00Z</updated>
        </entry>
      </feed>
    `;

    const items = parseFeed(xml, source);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Trade policy update & market access",
      canonicalUrl: "https://www.wto.org/english/news_e/news26_e/market_access.htm",
      summary: "A short official account of the latest market-access discussion.",
      publishedSourceAt: "2026-08-24T09:30:00.000Z",
    });
    expect(items[0].summary).not.toContain("complete Atom content");
  });

  it("never falls back to content or content:encoded when description and summary are absent", () => {
    const xml = `
      <rss><channel><item>
        <title>RSS content-only item</title>
        <link>https://www.wto.org/english/news_e/content-only.htm</link>
        <content:encoded><![CDATA[Full RSS article body.]]></content:encoded>
        <pubDate>Mon, 24 Aug 2026 08:00:00 GMT</pubDate>
      </item></channel></rss>
      <feed><entry>
        <title>Atom content-only entry</title>
        <link rel="alternate" href="https://www.wto.org/english/news_e/atom-content-only.htm" />
        <content><![CDATA[Full Atom article body.]]></content>
        <updated>2026-08-24T09:00:00Z</updated>
      </entry></feed>
    `;

    expect(parseFeed(xml, source)).toEqual([]);
  });

  it("rejects entries without a valid source date or an HTTPS original link", () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Missing publication date</title>
          <link>https://www.wto.org/english/news_e/missing-date.htm</link>
          <description>A valid short source description.</description>
        </item>
        <item>
          <title>Insecure article link</title>
          <link>http://www.wto.org/english/news_e/insecure.htm</link>
          <description>Another valid short source description.</description>
          <pubDate>Mon, 24 Aug 2026 08:00:00 GMT</pubDate>
        </item>
      </channel></rss>
    `;

    expect(parseFeed(xml, source)).toEqual([]);
  });

  it("limits source excerpts to 360 characters", () => {
    const longDescription = "Trade policy facts and market context ".repeat(20);
    const xml = `
      <rss><channel><item>
        <title>Long but valid source description</title>
        <link>https://www.wto.org/english/news_e/long-description.htm</link>
        <description>${longDescription}</description>
        <pubDate>Mon, 24 Aug 2026 08:00:00 GMT</pubDate>
      </item></channel></rss>
    `;

    const [item] = parseFeed(xml, source);

    expect(item.summary.length).toBeLessThanOrEqual(DAILY_BRIEF_SOURCE_EXCERPT_MAX_CHARS);
    expect(item.summary.length).toBeLessThanOrEqual(360);
    expect(item.summary).toMatch(/…$/);
  });
});
