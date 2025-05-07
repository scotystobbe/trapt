const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const ALBUMS = [
  {
    title: "Alapalooza",
    url: "https://en.wikipedia.org/wiki/Alapalooza"
  },
  // Add more albums here...
];

async function scrapeAlbum({ title, url }) {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  // Get album year
  const year = $('th:contains("Released")').next().text().match(/\\d{4}/)?.[0];

  // Get cover image
  const cover = $('table.infobox img').attr('src');
  const coverUrl = cover ? (cover.startsWith('http') ? cover : `https:${cover}`) : '';

  // Get track listing
  let tracks = [];
  $('span#Track_listing, span#Track_listing_and_formats').parent().nextAll('ol,table').first().find('li').each((i, el) => {
    const text = $(el).text();
    // Try to parse: "1. Jurassic Park" or "1. 'Jurassic Park' (parody of ...)"
    const match = text.match(/[""?(.+?)[""]?(?: \\(parody of (.+?) by (.+?)\\))?/i);
    if (match) {
      tracks.push({
        title: match[1].trim(),
        // You can add more sophisticated parsing for type/originalArtist/originalSong here
      });
    } else {
      tracks.push({ title: text.trim() });
    }
  });

  // Fallback: try to parse from tables if <ol> not found
  if (tracks.length === 0) {
    $('table.tracklist tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length) {
        tracks.push({ title: $(tds[1]).text().trim() });
      }
    });
  }

  return {
    title,
    year: year ? parseInt(year) : undefined,
    cover: coverUrl,
    tracks
  };
}

async function main() {
  const albums = [];
  for (const album of ALBUMS) {
    console.log(`Scraping ${album.title}...`);
    const data = await scrapeAlbum(album);
    albums.push(data);
  }
  fs.writeFileSync('albums.json', JSON.stringify({ albums }, null, 2));
  console.log('Done! Data written to albums.json');
}

main();
