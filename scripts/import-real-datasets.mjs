import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const outDir = path.resolve(process.env.DATASET_OUT_DIR || 'datasets/raw');
const MAX_ROWS = Number(process.env.DATASET_MAX_ROWS || 3000);
const PAGE_SIZE = Math.min(Number(process.env.DATASET_PAGE_SIZE || 200), 500);
const TIMEOUT_MS = Number(process.env.DATASET_TIMEOUT_MS || 25000);
const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || '';
const LOCAL_DATASET_DIR = process.env.LOCAL_DATASET_DIR ? path.resolve(process.env.LOCAL_DATASET_DIR) : '';
const REQUIRE_DATASETS = /^(1|true|yes)$/i.test(process.env.REQUIRE_DATASETS || '');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED_DATASET_DIR = path.resolve(__dirname, '..', 'datasets', 'bootstrap');

const DATASETS = [
  {
    name: 'hc3',
    hfDataset: 'Hello-SimpleAI/HC3',
    preferredConfigs: ['en', 'all'],
    fallbackUrls: [
      'https://huggingface.co/datasets/Hello-SimpleAI/HC3/resolve/main/all.jsonl'
    ]
  },
  {
    name: 'ghostbuster',
    hfDataset: 'rungalileo/ghostbuster',
    preferredConfigs: ['default'],
    fallbackUrls: [
      'https://huggingface.co/datasets/rungalileo/ghostbuster/resolve/main/train.jsonl'
    ]
  }
];

const headers = {
  'User-Agent': 'HumanizerDatasetImporter/1.2 (+Railway)',
  ...(HF_TOKEN ? { Authorization: `Bearer ${HF_TOKEN}` } : {})
};

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.json();
}

async function fetchText(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}

function toJsonl(rows) {
  return rows.map(r => JSON.stringify(r)).join('\n') + '\n';
}

async function resolveSplitInfo(dataset, preferredConfigs = []) {
  const url = `https://datasets-server.huggingface.co/splits?dataset=${encodeURIComponent(dataset)}`;
  const data = await fetchJson(url);
  const splits = data?.splits || [];
  if (!splits.length) throw new Error('no splits returned');
  const preferred = splits.find(s => preferredConfigs.includes(s.config)) || splits[0];
  return { config: preferred.config, split: preferred.split };
}

async function fetchRowsFromHf(dataset, preferredConfigs) {
  const { config, split } = await resolveSplitInfo(dataset, preferredConfigs);
  const rows = [];
  let offset = 0;

  while (offset < MAX_ROWS) {
    const length = Math.min(PAGE_SIZE, MAX_ROWS - offset);
    const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&offset=${offset}&length=${length}`;
    const page = await fetchJson(url);
    const chunk = Array.isArray(page?.rows) ? page.rows : [];
    if (!chunk.length) break;

    for (const item of chunk) rows.push(item.row ?? item);
    if (chunk.length < length) break;
    offset += chunk.length;
  }

  if (!rows.length) throw new Error('no rows downloaded from datasets-server');
  return rows;
}

async function fetchViaFallbackUrls(urls) {
  const errors = [];
  for (const url of urls) {
    try {
      const text = await fetchText(url);
      if (text.trim().length < 20) throw new Error('empty payload');
      return text;
    } catch (err) {
      errors.push(`${url} -> ${err.message}`);
    }
  }
  throw new Error(errors.join(' | '));
}

async function tryLocalDataset(name) {
  if (!LOCAL_DATASET_DIR) return null;
  const candidates = [
    path.join(LOCAL_DATASET_DIR, `${name}.jsonl`),
    path.join(LOCAL_DATASET_DIR, `${name}.json`)
  ];

  for (const file of candidates) {
    try {
      const text = await fs.readFile(file, 'utf8');
      if (text.trim().length < 20) continue;
      return {
        ok: true,
        mode: 'local-file',
        content: text.endsWith('\n') ? text : `${text}\n`,
        count: text.split('\n').filter(Boolean).length,
        source: file
      };
    } catch {
      // keep trying
    }
  }
  return null;
}


async function tryBundledDataset(name) {
  const candidates = [
    path.join(BUNDLED_DATASET_DIR, `${name}.jsonl`),
    path.join(BUNDLED_DATASET_DIR, `${name}.json`)
  ];

  for (const file of candidates) {
    try {
      const text = await fs.readFile(file, 'utf8');
      if (text.trim().length < 20) continue;
      return {
        ok: true,
        mode: 'bundled-bootstrap',
        content: text.endsWith('\n') ? text : `${text}\n`,
        count: text.split('\n').filter(Boolean).length,
        source: file
      };
    } catch {
      // keep trying
    }
  }
  return null;
}

async function importDataset(ds) {
  const local = await tryLocalDataset(ds.name);
  if (local) return local;

  try {
    const rows = await fetchRowsFromHf(ds.hfDataset, ds.preferredConfigs);
    return { ok: true, mode: 'datasets-server', content: toJsonl(rows), count: rows.length };
  } catch (primaryErr) {
    try {
      const text = await fetchViaFallbackUrls(ds.fallbackUrls || []);
      return {
        ok: true,
        mode: 'fallback-url',
        content: text,
        count: text.split('\n').filter(Boolean).length
      };
    } catch (fallbackErr) {
      const bundled = await tryBundledDataset(ds.name);
      if (bundled) return bundled;
      return {
        ok: false,
        error: `primary=${primaryErr.message}; fallback=${fallbackErr.message}; bundled=not found`
      };
    }
  }
}

await fs.mkdir(outDir, { recursive: true });

let success = 0;
for (const ds of DATASETS) {
  const result = await importDataset(ds);
  if (!result.ok) {
    console.warn(`failed ${ds.name}: ${result.error}`);
    continue;
  }

  const file = path.join(outDir, `${ds.name}.jsonl`);
  await fs.writeFile(file, result.content, 'utf8');
  success += 1;
  const sourceMsg = result.source ? ` from ${result.source}` : '';
  console.log(`saved ${file} (${result.count} rows via ${result.mode}${sourceMsg})`);
}

if (success === 0) {
  const msg = 'No datasets downloaded. Try HF_TOKEN, LOCAL_DATASET_DIR, or provide bundled bootstrap files.';
  if (REQUIRE_DATASETS) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
} else {
  console.log('Done. Next step: label samples with GPTZero externally, then curate human/mixed/ai/paraphrased splits.');
}
