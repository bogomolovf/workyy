/**
 * Generate Test CSV Files for Performance Testing
 *
 * Usage:
 *   npx ts-node scripts/generate-test-csv.ts [rows] [output]
 *
 * Examples:
 *   npx ts-node scripts/generate-test-csv.ts 10000 test-10k.csv
 *   npx ts-node scripts/generate-test-csv.ts 100000 test-100k.csv
 *   npx ts-node scripts/generate-test-csv.ts 1000000 test-1m.csv
 */

import * as fs from 'fs';
import * as path from 'path';

const REGIONS = ['North', 'South', 'East', 'West', 'Central'];
const CATEGORIES = ['Electronics', 'Clothing', 'Food', 'Books', 'Home', 'Sports', 'Auto', 'Health'];
const STATUSES = ['active', 'pending', 'completed', 'cancelled'];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(startYear: number = 2020, endYear: number = 2025): string {
  const year = randomInt(startYear, endYear);
  const month = randomInt(1, 12).toString().padStart(2, '0');
  const day = randomInt(1, 28).toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generateRow(id: number): string {
  const region = randomChoice(REGIONS);
  const category = randomChoice(CATEGORIES);
  const status = randomChoice(STATUSES);
  const revenue = randomFloat(10, 10000);
  const quantity = randomInt(1, 100);
  const discount = randomFloat(0, 0.5);
  const date = randomDate();
  const customerId = randomInt(1000, 99999);
  const rating = randomFloat(1, 5, 1);

  return `${id},${region},${category},${status},${revenue},${quantity},${discount},${date},${customerId},${rating}`;
}

function generateCSV(rowCount: number, outputPath: string): void {
  const header = 'id,region,category,status,revenue,quantity,discount,date,customer_id,rating';

  console.log(`Generating ${rowCount.toLocaleString()} rows...`);
  const startTime = Date.now();

  // Use streaming for large files
  const writeStream = fs.createWriteStream(outputPath, { encoding: 'utf8' });

  writeStream.write(header + '\n');

  // Write in batches for better performance
  const BATCH_SIZE = 10000;
  let batch: string[] = [];

  for (let i = 1; i <= rowCount; i++) {
    batch.push(generateRow(i));

    if (batch.length >= BATCH_SIZE || i === rowCount) {
      writeStream.write(batch.join('\n') + '\n');
      batch = [];

      // Progress update
      if (i % 100000 === 0 || i === rowCount) {
        const progress = ((i / rowCount) * 100).toFixed(1);
        process.stdout.write(`\rProgress: ${progress}% (${i.toLocaleString()} rows)`);
      }
    }
  }

  writeStream.end(() => {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    const fileSize = fs.statSync(outputPath).size;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

    console.log(`\n\nGenerated: ${outputPath}`);
    console.log(`Rows: ${rowCount.toLocaleString()}`);
    console.log(`Size: ${fileSizeMB} MB`);
    console.log(`Time: ${duration}s`);
  });
}

// Main
const args = process.argv.slice(2);
const rowCount = parseInt(args[0] || '10000', 10);
const outputFile =
  args[1] || `test-${rowCount >= 1000000 ? `${rowCount / 1000000}m` : `${rowCount / 1000}k`}.csv`;
const outputPath = path.join(process.cwd(), outputFile);

if (isNaN(rowCount) || rowCount < 1) {
  console.error('Invalid row count. Usage: npx ts-node generate-test-csv.ts [rows] [output]');
  process.exit(1);
}

generateCSV(rowCount, outputPath);
