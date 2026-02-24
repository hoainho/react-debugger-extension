import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import path from 'node:path';
import decompress from 'decompress';

const GITHUB_REPO = 'hoainho/react-debugger-extension';
const RELEASE_TAG = 'latest';

async function getLatestReleaseUrl() {
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/${RELEASE_TAG}`;
  
  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'react-debugger-cli',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return getFallbackUrl();
    }
    throw new Error(`Failed to fetch release info: ${response.statusText}`);
  }

  const release = await response.json();
  const asset = release.assets?.find(a => a.name === 'react-debugger.zip');
  
  if (asset) {
    return asset.browser_download_url;
  }

  return getFallbackUrl();
}

function getFallbackUrl() {
  return `https://github.com/${GITHUB_REPO}/releases/latest/download/react-debugger.zip`;
}

async function downloadFromUrl(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'react-debugger-cli',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function downloadAndExtract(dest) {
  await fs.mkdir(dest, { recursive: true });

  const existingFiles = await fs.readdir(dest);
  for (const file of existingFiles) {
    await fs.rm(path.join(dest, file), { recursive: true, force: true });
  }

  let downloadUrl;
  try {
    downloadUrl = await getLatestReleaseUrl();
  } catch {
    downloadUrl = getFallbackUrl();
  }

  const buffer = await downloadFromUrl(downloadUrl);

  await decompress(buffer, dest, {
    strip: 0,
  });

  const files = await fs.readdir(dest);
  if (!files.includes('manifest.json')) {
    const subDirs = [];
    for (const f of files) {
      const stat = await fs.stat(path.join(dest, f));
      if (stat.isDirectory()) subDirs.push(f);
    }
    
    if (subDirs.length === 1) {
      const subDir = path.join(dest, subDirs[0]);
      const subFiles = await fs.readdir(subDir);
      
      for (const file of subFiles) {
        await fs.rename(path.join(subDir, file), path.join(dest, file));
      }
      await fs.rmdir(subDir);
    }
  }
}
