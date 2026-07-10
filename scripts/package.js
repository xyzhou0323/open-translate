/**
 * Package script for ND Translate extension
 * Creates distributable packages (ZIP and CRX)
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const formatArg = args.find(arg => arg.startsWith('--format='));
const format = formatArg ? formatArg.split('=')[1] : 'both';

console.log('ND Translate Extension Packager\n');

// Validate build first
console.log('Running build validation...');
try {
  execSync('node scripts/build.js', { stdio: 'inherit' });
} catch (error) {
  console.error('Build validation failed. Please fix errors before packaging.');
  process.exit(1);
}

// Read version from manifest
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const version = manifest.version;

console.log(`\nPackaging ND Translate v${version}...`);

// Create dist directory
const distDir = path.join(__dirname, '..', 'dist');
const packageDir = path.join(distDir, 'extension');

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(packageDir, { recursive: true });

// Copy files to package directory
console.log('\nCopying files...');

// Copy manifest
fs.copyFileSync('manifest.json', path.join(packageDir, 'manifest.json'));
console.log('✓ manifest.json');

// Copy source directories
const srcDirs = ['src', 'assets', '_locales', 'vendor'];
srcDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    copyDirectory(dir, path.join(packageDir, dir));
    console.log(`✓ ${dir}/`);
  }
});

// Vendor dependencies are already copied with srcDirs above
console.log('\nVendor dependencies copied with source directories');

// Generate PNG icons if needed
console.log('\nProcessing icons...');
try {
  generatePngIcons(packageDir);
} catch (error) {
  console.warn('Warning: Could not generate PNG icons. SVG icons will be used.');
  console.warn('For production, consider converting SVG to PNG manually.');
}

// Update manifest to use PNG icons if they exist
updateManifestIcons(packageDir);

// Clean up package directory
cleanPackageDirectory(packageDir);

// Create packages based on format
if (format === 'zip' || format === 'both') {
  createZipPackage(distDir, version);
}

if (format === 'crx' || format === 'both') {
  createCrxPackage(distDir, version);
}

console.log('\n' + '='.repeat(50));
console.log('PACKAGING COMPLETE');
console.log('='.repeat(50));
console.log(`Extension: ND Translate v${version}`);
console.log(`Output directory: ${distDir}`);

if (fs.existsSync(path.join(distDir, `nd-translate-v${version}.zip`))) {
  console.log(`✓ ZIP package: nd-translate-v${version}.zip`);
}

if (fs.existsSync(path.join(distDir, `nd-translate-v${version}.crx`))) {
  console.log(`✓ CRX package: nd-translate-v${version}.crx`);
}

console.log('\nInstallation instructions:');
console.log('1. For ZIP: Extract and load as unpacked extension in Chrome');
console.log('2. For CRX: Drag and drop into Chrome extensions page');

/**
 * Copy directory recursively
 */
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Generate PNG icons from SVG using available tools
 */
function generatePngIcons(packageDir) {
  const iconsDir = path.join(packageDir, 'assets', 'icons');
  const sizes = [16, 32, 48, 128];

  // Check if we have conversion tools available
  let hasInkscape = false;
  try {
    execSync('which inkscape', { stdio: 'ignore' });
    hasInkscape = true;
  } catch (error) {
    // Inkscape not available
  }

  if (!hasInkscape) {
    console.log('Inkscape not found. Keeping SVG icons.');
    return;
  }

  sizes.forEach(size => {
    const svgPath = path.join(iconsDir, `icon${size}.svg`);
    const pngPath = path.join(iconsDir, `icon${size}.png`);

    if (fs.existsSync(svgPath)) {
      try {
        execSync(`inkscape -w ${size} -h ${size} "${svgPath}" -o "${pngPath}"`, { stdio: 'ignore' });
        console.log(`✓ Generated icon${size}.png`);
      } catch (error) {
        console.warn(`Warning: Failed to generate icon${size}.png`);
      }
    }
  });
}

/**
 * Update manifest to use PNG icons if available
 */
function updateManifestIcons(packageDir) {
  const manifestPath = path.join(packageDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  const iconsDir = path.join(packageDir, 'assets', 'icons');
  const sizes = [16, 32, 48, 128];
  
  let hasPngIcons = false;
  sizes.forEach(size => {
    if (fs.existsSync(path.join(iconsDir, `icon${size}.png`))) {
      hasPngIcons = true;
    }
  });

  if (hasPngIcons) {
    // Update icon references to PNG
    if (manifest.icons) {
      Object.keys(manifest.icons).forEach(size => {
        manifest.icons[size] = manifest.icons[size].replace('.svg', '.png');
      });
    }

    if (manifest.action && manifest.action.default_icon) {
      Object.keys(manifest.action.default_icon).forEach(size => {
        manifest.action.default_icon[size] = manifest.action.default_icon[size].replace('.svg', '.png');
      });
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('✓ Updated manifest to use PNG icons');
  }
}

/**
 * Clean up package directory
 */
function cleanPackageDirectory(packageDir) {
  // Remove development files
  const filesToRemove = [
    '**/*.md',
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/*.tmp'
  ];

  // Simple cleanup - remove common development files
  const removeFiles = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        removeFiles(fullPath);
      } else if (entry.name.endsWith('.md') || 
                 entry.name === '.DS_Store' || 
                 entry.name === 'Thumbs.db' ||
                 entry.name.endsWith('.tmp')) {
        fs.unlinkSync(fullPath);
      }
    }
  };

  removeFiles(packageDir);
}

/**
 * Create ZIP package
 */
function createZipPackage(distDir, version) {
  console.log('\nCreating ZIP package...');
  
  const zipName = `nd-translate-v${version}.zip`;
  const zipPath = path.join(distDir, zipName);
  const extensionDir = path.join(distDir, 'extension');
  
  try {
    // Use system zip command
    execSync(`cd "${extensionDir}" && zip -r "../${zipName}" .`, { stdio: 'ignore' });
    console.log(`✓ Created ${zipName}`);
  } catch (error) {
    // Windows environments commonly do not provide the `zip` command. Use a
    // minimal standards-compliant ZIP writer as a portable fallback.
    try {
      createZipFromDirectory(extensionDir, zipPath);
      console.log(`✓ Created ${zipName} (Node ZIP writer)`);
    } catch (fallbackError) {
      console.error('Failed to create ZIP package:', fallbackError.message);
    }
  }
}

/**
 * Create a standard ZIP archive without external dependencies.
 */
function createZipFromDirectory(sourceDir, zipPath) {
  const fileEntries = [];
  const centralEntries = [];
  let offset = 0;

  for (const filePath of listFiles(sourceDir)) {
    const name = toZipPath(path.relative(sourceDir, filePath));
    const source = fs.readFileSync(filePath);
    const compressed = zlib.deflateRawSync(source, { level: 9 });
    const crc = crc32(source);
    const nameBuffer = Buffer.from(name, 'utf8');
    const { dosTime, dosDate } = getDosDateTime(fs.statSync(filePath).mtime);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(source.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    fileEntries.push(localHeader, nameBuffer, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(source.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralEntries.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + compressed.length;
  }

  const centralOffset = offset;
  const centralSize = centralEntries.reduce((sum, buffer) => sum + buffer.length, 0);
  const entryCount = centralEntries.length / 2;

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entryCount, 8);
  endRecord.writeUInt16LE(entryCount, 10);
  endRecord.writeUInt32LE(centralSize, 12);
  endRecord.writeUInt32LE(centralOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  fs.writeFileSync(zipPath, Buffer.concat([...fileEntries, ...centralEntries, endRecord]));
}

function listFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function toZipPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function getDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function crc32(buffer) {
  if (!crc32.table) {
    crc32.table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crc32.table[i] = c >>> 0;
    }
  }

  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crc32.table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Create CRX package
 */
function createCrxPackage(distDir, version) {
  console.log('\nCreating CRX package...');
  
  const crxName = `nd-translate-v${version}.crx`;
  const keyPath = path.join(distDir, 'extension.pem');
  
  // Generate private key if it doesn't exist
  if (!fs.existsSync(keyPath)) {
    try {
      execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'ignore' });
      console.log('✓ Generated private key');
    } catch (error) {
      console.error('Failed to generate private key:', error.message);
      return;
    }
  }

  // Check if Chrome is available
  let chromeCmd = null;
  const chromeCmds = [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];

  for (const cmd of chromeCmds) {
    try {
      execSync(`which "${cmd}"`, { stdio: 'ignore' });
      chromeCmd = cmd;
      break;
    } catch (error) {
      // Command not found, try next
    }
  }

  if (!chromeCmd) {
    console.warn('Chrome not found. Cannot create CRX package.');
    console.warn('Please install Chrome or use the ZIP package.');
    return;
  }

  try {
    const extensionDir = path.join(distDir, 'extension');
    execSync(`"${chromeCmd}" --headless --disable-gpu --pack-extension="${extensionDir}" --pack-extension-key="${keyPath}"`, { stdio: 'ignore' });
    
    // Move the generated CRX
    const generatedCrx = `${extensionDir}.crx`;
    const finalCrx = path.join(distDir, crxName);
    
    if (fs.existsSync(generatedCrx)) {
      fs.renameSync(generatedCrx, finalCrx);
      console.log(`✓ Created ${crxName}`);
    } else {
      console.error('CRX file was not generated');
    }
  } catch (error) {
    console.error('Failed to create CRX package:', error.message);
  }
}

module.exports = {
  copyDirectory,
  generatePngIcons,
  updateManifestIcons,
  cleanPackageDirectory
};
