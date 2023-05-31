import fs from 'fs'
import YAML from 'yaml';
import { S3ContentEntry, S3VersionEntry, readReallyLargeYamlFile } from "./sources/s3.ts";


main();

async function main() {
  const response:S3ApiResponses = YAML.parse(fs.readFileSync('./cache/nextstrain-data.yaml', 'utf8'));

  let tree:Node[] = [] // todo -- should be called subtrees

  response.forEach((page:any) => {
    (page['Contents'] || []).forEach((r:S3ContentEntry) => {
      if (
        r.Key.includes("_tip-frequencies.json") ||
        r.Key.includes("_root-sequence.json") ||
        r.Key.includes("_measurements.json") ||
        r.Key.includes("_titers.json") ||
        r.Key.startsWith("search_") || r.Key.startsWith("datasets_") || r.Key.startsWith("manifest_") ||
        r.Key.includes("_tree.json") || r.Key.includes("_meta.json") ||
        !r.Key.endsWith(".json") ||
        r.Key.includes("/") // TODO
      ) {
        return;
      }

      const fields: string[] = r.Key.replace(/\.json$/, '').split("_");

      if (fields.filter((k) => k.match(/\d{4}-\d{2}-\d{2}/)).length) return;

      let level = tree;
      let parent: (Node|undefined);
      fields.map((key, idx) => {
        const node = getNode(level, key, parent);
        if (idx===fields.length-1) {
          node.url = r.Key;
          node.lastModified = r.LastModified.split("T")[0] as string;
        }
        // new parent
        parent = node;
        level = node.children;
      })
    });
  });

  /* Ignore nCoV for now. It requires a more thoughtful collapsing approach -- which
  we should totally do -- but for now I want to focus on the core concepts, not the
  details. TODO XXX */
  tree = tree.filter((n:Node) => n.key!=="ncov")

  tree.forEach((node) => collapseSingletons(node))

  tree.forEach((node) => console.log(node.key, getCount(node)));

  tree.forEach((node) => walk(node, collapse));

  console.log("******")
  prettyPrint(tree)

  const cards = tree.map((n) => makeCards(undefined, n)) as Card[]

  addDatesOfVersionedAssets(cards);

  fs.writeFileSync('./cache/cards-core.json', JSON.stringify(cards, undefined, 2))
}


type S3ApiResponses = any;

type Node = {
  key: string;
  children: Node[];
  parent: (Node|undefined);
  collapsed?: boolean;
  lastModified?: string;
  url?:string;
}


export type Card = {
  name: string;
  datasetFilename: string|false;
  collapsed: boolean;
  nDatasets: number,
  nVersions: number;
  nDatasetViews: number;
  linkedNarratives: string[];
  pathogenPage?: string;
  lastUpdated: string;
  versions?: string[];
  children: Card[];
}

function makeCards(parentCard: (Card|undefined), node:Node):(Card|undefined) {

  let nDatasets = 0;
  let lastUpdated = "3000-01-01"
  walk(node, (n) => {
    if (n.children.length===0) nDatasets++;
    if (n.lastModified && n.lastModified < lastUpdated) lastUpdated = n.lastModified;
    return true;
  });

  const card: Card = {
    name: _name(node),
    collapsed: !!node.collapsed,
    datasetFilename: node.url || false,
    nVersions: 0, // updated below
    nDatasetViews: 42, // TODO XXX
    nDatasets,
    linkedNarratives: [], // TODO XXX
    lastUpdated,
    children: [],
  };
  if (node.children.length===0) card.collapsed = false;

  node.children.forEach((c) => makeCards(card, c));

  if (parentCard) {
    parentCard.children.push(card);
    return undefined;
  }
  return card;
}

function _name(node:Node) {
  let name = node.key;
  let n = node;
  while (n.parent) {
    n = n.parent;
    name = `${n.key}/${name}`
  }
  return name;
}

/**
 * TODO XXX
 */
function collapse(node:Node) {
  const count = getCount(node);
  if (count > 50) {
    return true; // keep walking
  }
  // YES -- COLLAPSE
  node.collapsed = true;
  return false; // stop the traversal 
}

function prettyPrint(level: (Node[]|Node), indent=0) {
  if (Array.isArray(level)) {
    level.forEach((n) => prettyPrint(n, indent+1));
  }
  const node = level as Node;
  if (node?.collapsed) {
    console.log("  ".repeat(indent)+node.key+` num datasets: ${getCount(node)-1}`);
  } else {
    console.log("  ".repeat(indent)+node.key);
    node.children?.forEach((n) => prettyPrint(n, indent+1));
  }
}

function getCount(node:Node) {
  let count = 1; // count the node itself!
  const fn = (n:Node) => {
    if (n.children.length===0) count++;
    return true;
  }
  walk(node, fn);
  return count;
}

function collapseSingletons(node:Node) {
  const fn = (n:Node) => {
    if (n.children.length===1 && !n.url) {
      const c = n.children[0] as Node;
      n.key = `${n.key}/${c.key}`
      n.children = c.children;
      if (c.url) n.url=c.url;
      if (c.lastModified) n.lastModified=c.lastModified;
    }
    return true;
  }
  walk(node, fn);
}

function walk(node:Node, callback:(node: Node)=>(boolean|undefined)) {
  const res = callback(node);
  if (node!==undefined && res!==false) {
    node.children.forEach((child) => walk(child, callback))
  }
}

function getNode(level: Node[], key:string, parent: (Node|undefined)): Node {
  for (const n of level) {
    if (n.key===key) return n;
  }
  const n = {
    key,
    parent,
    children: []
  }
  level.push(n);
  return n;
}

/**
 * A copy-paste simplification of `collectVersionedAssets`
 */
function addDatesOfVersionedAssets(cards:Card[]) {
  const fname = './cache/nextstrain-data.versions.yaml'
  const keyModificationDates:Record<string,string[]> = {}
  console.log(`Reading S3 (versioned) results from ${fname} (takes ~1min)`)
  const response = readReallyLargeYamlFile(fname)
  response.forEach((page:any) => {
    (page['Versions'] || []).forEach((r:S3VersionEntry) => {
      if (!keyModificationDates[r.Key]) keyModificationDates[r.Key]=[];
      keyModificationDates[r.Key]?.push(r.LastModified.split("T")[0]||'')
    });
  });
  function _assign(c:Card) {
    if (!c.datasetFilename) return;
    c.versions = keyModificationDates[c.datasetFilename] || [];
    c.versions.sort();
  }
  function _walk(card:Card, cb:any) {
    cb(card);
    card.children.forEach((c) => _walk(c, cb))
  }
  /* set the .versions */
  cards.forEach((c) => _walk(c, _assign))
  /* sum all descendent number of versions */
  function _sumVersions(card:Card) {
    let nVersions = 0;
    const _sum = (c:Card) => {nVersions += c.versions?.length || 0};
    _walk(card, _sum);
    card.nVersions = nVersions;
    card.children.forEach(_sumVersions)
  }
  cards.forEach(_sumVersions)
}
