#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function cleanTranscript(inputText) {
  // Regex pattern to match timecode format (HH:MM:SS.mmm or HH:MM:SS.mm)
  // This will match timecodes anywhere in the text
  const timecodePattern = /\d{2}:\d{2}:\d{2}\.\d{2,3}/g;

  // Remove all timecodes from the text
  let cleanedText = inputText.replace(timecodePattern, '');

  // Replace multiple whitespace characters (spaces, newlines, tabs) with single spaces
  cleanedText = cleanedText.replace(/\s+/g, ' ');

  // Trim leading and trailing whitespace
  cleanedText = cleanedText.trim();

  return cleanedText;
}

function processFile(filePath) {
  try {
    // Read the input file
    const inputText = fs.readFileSync(filePath, 'utf8');

    // Clean the transcript
    const cleanedText = cleanTranscript(inputText);

    // Generate output filename
    const dir = path.dirname(filePath);
    const name = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(dir, `${name}_cleaned.txt`);

    // Write the cleaned text to output file
    fs.writeFileSync(outputPath, cleanedText, 'utf8');

    console.log(`✓ Processed: ${filePath}`);
    console.log(`✓ Output saved to: ${outputPath}`);
    console.log(`✓ Original lines: ${inputText.split('\n').length}`);
    console.log(`✓ Cleaned text length: ${cleanedText.length} characters`);

    return cleanedText;
  } catch (error) {
    console.error(`✗ Error processing file ${filePath}:`, error.message);
    process.exit(1);
  }
}

function processStdin() {
  return new Promise((resolve, reject) => {
    let inputText = '';

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
      inputText += chunk;
    });

    process.stdin.on('end', () => {
      try {
        const cleanedText = cleanTranscript(inputText);
        console.log(cleanedText);
        resolve(cleanedText);
      } catch (error) {
        reject(error);
      }
    });

    process.stdin.on('error', (error) => {
      reject(error);
    });
  });
}

function showHelp() {
  console.log(`
Transcript Cleaner - Remove timecodes from transcript files

Usage:
  node transcript-cleaner.js <input-file>     # Process a file
  cat transcript.txt | node transcript-cleaner.js  # Process from stdin
  node transcript-cleaner.js --help          # Show this help

Examples:
  node transcript-cleaner.js transcript.txt
  echo "00:00:01.000\\nHello world\\n00:00:02.000\\nThis is a test" | node transcript-cleaner.js

The script will:
- Remove all timecode lines (format: HH:MM:SS.mmm)
- Join text lines into continuous readable text
- Save output to <filename>_cleaned.txt (when processing files)
- Output to stdout (when processing from stdin)
`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  if (args.length === 0) {
    // No arguments - check if we have stdin
    if (process.stdin.isTTY) {
      console.error('Error: No input provided. Use --help for usage information.');
      process.exit(1);
    } else {
      // Process from stdin
      await processStdin();
    }
  } else if (args.length === 1) {
    // Process file
    const filePath = args[0];

    if (!fs.existsSync(filePath)) {
      console.error(`Error: File '${filePath}' not found.`);
      process.exit(1);
    }

    processFile(filePath);
  } else {
    console.error('Error: Too many arguments. Use --help for usage information.');
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

// Run the script
main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
}); 