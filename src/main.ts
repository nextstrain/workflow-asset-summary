import fs from 'fs'
import argparse from 'argparse';
import YAML from 'yaml';
import { S3Assets, Asset, Assets } from "./sources/s3.ts";

main();

function parseArgs() {
  const parser = new argparse.ArgumentParser({
    description: `
      Examine S3 buckets and collect objects matching the patterns described in the config input.
    `,
  });
  parser.add_argument("--config", {help: "", default: "./data/core.yaml"})
  parser.add_argument("--cache", {help: "cache directory to save s3 api responses. If a matching response file is present we will use it rather than make an API call", default: "./cache"})
  parser.add_argument("--output", {help: "file to write output to", default: "./cache/core.json"})
  parser.add_argument("--upload", {help: "upload file to s3? (not yet implemented)", default: false})
  return parser.parse_args();
}

async function main() {
  const args = parseArgs();
  const config:Config = YAML.parse(fs.readFileSync(args.config, 'utf8'));

  /** The 'normal' approach of listing objects on S3 matching patterns but not listing all versions.
   * This costs around 25c to list, so it's not a problem to delete the cache & re-fetch as required */
  const patterns = collectPatterns(config);
  const s3 = new S3Assets(patterns);
  await s3.collectAssets(args.cache)
  updateAssets(config, s3.assets)

  /** Proof-of-principle approach listing all versions of objects on S3 matching patterns.
   * Listing the entire bucket would cost ~$2 so try to use a cached file where possible!
   * Using just the 'ingest' collection means we can set a restrictive Prefix and thus
   * the request only costs a fraction of this */
  {
    const patterns = collectPatterns(config, new Set(['ingest']));
    // const patterns = collectPatterns(config); // this line will crawl the entire bucket (~350 API requests) unless you have a cached YAML output
    const s3 = new S3Assets(patterns);
    await s3.collectVersionedAssets(args.cache)
    updateAssets(config, s3.assets)
  }

  restrictAssetsForOutput(config)
  if (args.output) {
    console.log(`Writing JSON output to local file ${args.output}`)
    fs.writeFileSync(args.output, JSON.stringify(config, null, 2)); // TODO define args
  }
  if (args.upload) {
    throw new Error("TODO XXX")
  }
}


function collectPatterns(config:Config, categories: (Set<string>|undefined) = undefined): Set<string> {
  const p = [];
  for (const category of Object.keys(config)) {
    if (categories && !categories.has(category)) {
      continue
    }
    for (const name of Object.keys(config[category])) {
      p.push(...config[category][name].patterns)
    }
  }
  return new Set(p);
}

function updateAssets(config:Config, assets: Assets): void {
  let totalAssets = 0;
  for (const category of Object.keys(config)) {
    for (const name of Object.keys(config[category])) {
      const el = config[category][name]
      if (!Array.isArray(el.assets)) {
        el.assets = [] as Asset[];
      }
      for (const pattern of el.patterns) {
        el.assets.push(...(assets[pattern] || []))
      }
      totalAssets += el.assets.length;
    }
  }
  console.log(`Total (cumulative) assets matching patterns: ${totalAssets}`)
}

function restrictAssetsForOutput(config:Config): void {
  let totalAssets = 0;
  for (const category of Object.keys(config)) {
    const namesWithNoAssets: string[] = [];

    for (const name of Object.keys(config[category])) {
      const el = config[category][name]

      /* sort by modification date before doing any filtering. Note that
      modification date may not be the date indicated by the filename */
      el.assets.sort((a:Asset, b:Asset) => a.date<b.date ? -1 : 1)
      if (el.assets.length===0) {
        namesWithNoAssets.push(name)
      }

      /* filter out those with the same s3 URI (this may include a version prefix) */
      {
        const seen:Set<string> = new Set(['']);
        el.assets = el.assets.filter((a:Asset) => {
          if (seen.has(a.urls.s3||'')) return false;
          seen.add(a.urls.s3||'');
          return true;
        })
      }

      /* Filter out objects with the same ETag, taking the first (earliest modification date)
      occurrence. NOTE: I explored combining ETag + date as the uniq ID, but there were many
      strange oddities -- see README.md -- comment out this filtering to explore this.
      A better approach may be to treat 'current' vs 'versioned' objects differently */
      {
        const seen:Set<string> = new Set(['']);
        el.assets = el.assets.filter((a:Asset) => {
          if (seen.has(a.eTag||'')) return false;
          seen.add(a.eTag||'');
          return true;
        })
      }

      /* Delete data from Asset we don't want to export */
      delete config[category][name].patterns
      config[category][name].assets.forEach((a:Asset) => {
        delete a.eTag
      })

      totalAssets += el.assets.length;
    }
    namesWithNoAssets.forEach((name) => {
      console.log(`\tRemoving name ${name} as it had no matching assets`);
      delete config[category][name]
    })
  }
  console.log(`Total (filtered) assets matching patterns: ${totalAssets}`)
}

type Config = any; // TODO XXX