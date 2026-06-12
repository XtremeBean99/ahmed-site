// Process images: rename to clean slugs, strip EXIF, resize
// Run: node scripts/process-images.mjs
import sharp from "sharp";
import { readdir, mkdir, copyFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { existsSync } from "node:fs";

import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = "C:\\Users\\ahmed\\OneDrive\\Documents\\Projects\\Images and videos";
const DEST_DIR = join(__dirname, "..", "public", "images");

// Mapping of original -> clean filenames
const FILE_MAP = {
  "first ever pc build.jpg": "first-ever-pc-build.jpg",
  "PCBuild1.png": "pc-build-1-2023.jpg",
  "xtreme bean logo.jpg": "xtreme-bean-logo.jpg",
  "parts laid out ready for pc buid.jpg": "parts-laid-out-for-build.jpg",
  "satisfied_customer_posting_with_pc.png": "satisfied-customer-with-pc.jpg",
  "mosnterpc_oldversion.jpg": "monster-pc-old.jpg",
  "mosnter+energy-pc.jpg": "monster-energy-pc.jpg",
  "monsterpc_Bheind pic.jpg": "monster-pc-behind.jpg",
  "stock_market_themed_pc.jpg": "stock-market-pc.jpg",
  "Helllo_kitty_PCBuild.jpg": "hello-kitty-pc.jpg",
  "hellokittypccloseup.JPG": "hello-kitty-pc-closeup.jpg",
  "8 xtreme bean branded phone cases.JPG": "xtreme-bean-phone-cases.jpg",
  "close_up_of_circuitboard and chip of disassembled rtx 2070 super that I was replacing thermalpaste on.jpg": "rtx-2070-thermal-paste-repair.jpg",
  "Iranian_Monster_brand_fruit_leather_bars.JPG": "iranian-monster-fruit-leather.jpg",
  "daydreamMachinepc build.jpg": "daydream-machine-pc.jpg",
  "phyisics project (dc motor) spinning.mp4": "physics-dc-motor.mp4",
  "still image of physcis project.JPG": "physics-dc-motor-still.jpg",
  "CPU in banana bread batter.JPG": "cpu-in-banana-bread-batter.jpg",
  "PCBuild2.jpg": "pc-build-2-2025.jpg",
  "watercooled pc filling up.MOV": "watercooled-pc-filling.mp4",
  "bookshelf full of up & go and cpu boxes.jpg": "bookshelf-cpu-boxes.jpg",
  "banana bread before going in the oven.JPG": "banana-bread.jpg",
  "blueberry muffin batter.JPG": "blueberry-muffin-batter.jpg",
  "cinamonn scrolsl ready to go in the oven.JPG": "cinnamon-scrolls.jpg",
  "gooey chocolate chip cookies.JPG": "chocolate-chip-cookies.jpg",
  "homemadepizza.JPG": "homemade-pizza.jpg",
  "homemade lasagna being layered.JPG": "homemade-lasagna.jpg",
  "homemade reasin toast with peanut butter.JPG": "homemade-raisin-toast.jpg",
  "eggs in flour ready to make pasta dough.JPG": "fresh-pasta-dough.jpg",
  "engine bay of my old 1999 yellow diahatsu sirion whihc i learnt manual on but have now sold.JPG": "daihatsu-sirion-engine-bay.jpg",
  "mitski poster in arabic.jpg": "mitski-poster-arabic.jpg",
  "funny random video.mp4": "funny-random-video.mp4",
};

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".avi"]);

async function processImage(srcPath, destPath) {
  try {
    await sharp(srcPath)
      .resize({ width: 1920, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .withMetadata({}) // strip all metadata by not preserving
      .toFile(destPath);
    const destStat = await stat(destPath);
    const srcStat = await stat(srcPath);
    console.log(
      `  ✓ ${srcStat.size.toLocaleString()} → ${destStat.size.toLocaleString()} bytes`
    );
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
  }
}

async function copyVideo(srcPath, destPath) {
  try {
    await copyFile(srcPath, destPath);
    const destStat = await stat(destPath);
    console.log(`  ✓ ${destStat.size.toLocaleString()} bytes (video, copied)`);
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
  }
}

async function main() {
  // Ensure destination exists
  if (!existsSync(DEST_DIR)) {
    await mkdir(DEST_DIR, { recursive: true });
  }

  console.log("Processing images and videos...\n");

  let processed = 0;
  let skipped = 0;

  for (const [original, clean] of Object.entries(FILE_MAP)) {
    const srcPath = join(SOURCE_DIR, original);
    const destPath = join(DEST_DIR, clean);
    const ext = extname(original).toLowerCase();

    if (!existsSync(srcPath)) {
      console.log(`  ⊘ ${original} — not found, skipping`);
      skipped++;
      continue;
    }

    process.stdout.write(`${clean}`);

    if (VIDEO_EXTENSIONS.has(ext)) {
      await copyVideo(srcPath, destPath);
    } else {
      await processImage(srcPath, destPath);
    }
    processed++;
  }

  console.log(
    `\n✅ Done — ${processed} processed, ${skipped} skipped (file not in source dir)`
  );
}

main().catch(console.error);
