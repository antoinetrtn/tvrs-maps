import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";
import { countryDataMap } from "../src/data/gameData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, "../public/flags");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

const run = async () => {
  console.log("Downloading flags...");
  const countries = Object.entries(countryDataMap);
  let successCount = 0;
  let failCount = 0;

  // Batching to prevent socket exhaustion and rate limiting
  const batchSize = 10;
  for (let i = 0; i < countries.length; i += batchSize) {
    const batch = countries.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async ([name, data]) => {
        if (!data.iso2) {
          console.warn(`Country ${name} does not have iso2`);
          return;
        }
        const iso2 = data.iso2.toLowerCase();
        const url = `https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/${iso2}.svg`;
        const dest = path.join(outputDir, `${iso2}.svg`);

        if (fs.existsSync(dest)) {
          successCount++;
          return; // Skip if already downloaded
        }

        try {
          await downloadFile(url, dest);
          successCount++;
          console.log(`Downloaded flag for ${name} (${iso2.toUpperCase()})`);
        } catch (err) {
          failCount++;
          console.error(
            `Failed to download flag for ${name} (${iso2.toUpperCase()}):`,
            err.message
          );
        }
      })
    );
  }

  console.log(
    `Finished downloading flags: ${successCount} succeeded, ${failCount} failed.`
  );
};

run().catch(console.error);
