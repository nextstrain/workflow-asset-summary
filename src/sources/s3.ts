import { ListObjectVersionsCommand, S3Client, paginateListObjectsV2 } from "@aws-sdk/client-s3"
import fs from 'fs'
import YAML from 'yaml';

const s3config = {
  region: 'us-east-1',
  maxAttempts: 1,
}

export class S3Assets {
  buckets: { [bucketName: string]: string[]; }  = {}
  assets: Assets  = {}

  constructor (patterns: Set<string>) {
    const s3Patterns = [...patterns].filter((pattern) => pattern.startsWith("s3://"))

    s3Patterns.forEach((pattern) => {
      const s3uri = new URL(pattern);
      const bucket = s3uri.hostname;
      const keyPattern = s3uri.pathname
        .substring(1) // Ignore the first slash, it's not part of the key name
        .replace('%7B', '{').replace('%7D', '}'); // we will use these for pattern matching, not an actual URI
      if (!this.buckets[bucket]) this.buckets[bucket] = [];

      if (`s3://${bucket}/${keyPattern}` !== pattern) {
        throw new Error(`ERROR. Unexpected / unhandled characters in pattern ${pattern}`);
      }
      this.buckets[bucket]?.push(keyPattern)
      this.assets[pattern] = []
    })
    console.log(`Patterns define objects in ${Object.keys(this.buckets).length} buckets`)

    if (Object.keys(this.buckets).length > 1 || !this.buckets['nextstrain-data']) {
      throw new Error(`We only currently handle the nextstrain-data bucket; you have specified buckets ${Object.keys(this.buckets).join(', ')}`)
    }

  }

  async collectAssets(cacheDir:string) {
    for (const [bucketName, keyPatterns] of Object.entries(this.buckets)) {
      let response;
      const prefix = commonPrefix(keyPatterns);
      console.log(`Bucket ${bucketName} with ${keyPatterns.length} patterns`)

      if (cacheDir) {
        const fname=`${cacheDir.replace(/\/$/,'')}/${bucketName}.yaml`;
        if (fs.existsSync(fname)) {
          console.log(`Using S3 results from ${fname} rather than an API call`)
          response = YAML.parse(fs.readFileSync(fname, 'utf8'))
          console.log(`\tPrefix used for that API call was "${response[0].Prefix}"`)
          // TODO -- check prefix used to create file is the same
        } else {
          response = await listBucket(bucketName, prefix, fname);
        }
      } else {
        response = await listBucket(bucketName, prefix);
      }

      response.forEach((page:any) => {
        (page['Contents'] || []).forEach((r:S3ContentEntry) => {
          keyPatterns.forEach((keyPattern) => {
            if (match(keyPattern, r.Key)) {
              this.assets[`s3://${bucketName}/${keyPattern}`]?.push(asset(bucketName, r))
            }
          })
        });
      });
    }
  }

  async collectVersionedAssets(cacheDir:string) {
    // TODO XXX - this is mostly copy paste from `collectAssets`
    for (const [bucketName, keyPatterns] of Object.entries(this.buckets)) {
      let response;
      const prefix = commonPrefix(keyPatterns);
      console.log(`Bucket ${bucketName} with ${keyPatterns.length} patterns`)

      if (cacheDir) {
        const fname=`${cacheDir.replace(/\/$/,'')}/${bucketName}.versions.yaml`;
        if (fs.existsSync(fname)) {
          console.log(`Using S3 results from ${fname} rather than an API call`)
          response = readReallyLargeYamlFile(fname)
          console.log(`\tPrefix used for that API call was "${response[0].Prefix}"`)
          // debugger;
          // TODO -- check prefix used to create file is the same
        } else {
          response = await listBucketVersioned(bucketName, prefix, fname);
        }
      } else {
        response = await listBucketVersioned(bucketName, prefix);
      }

      response.forEach((page:any) => {
        (page['Versions'] || []).forEach((r:S3VersionEntry) => {
          keyPatterns.forEach((keyPattern) => {
            if (match(keyPattern, r.Key)) {
              this.assets[`s3://${bucketName}/${keyPattern}`]?.push(asset(bucketName, r))
            }
          })
        });
      });
    }
  }
}

export type Asset = {
  urls: Record<string, string>
  date: string, /** YYYY-MM-DD */
  // key?: string, /** used for sorting, identity etc */
  currentVersion: boolean,
  eTag?: string
}
export type Assets = { [pattern: string]: Asset[] };

type S3ContentEntry = {
  Key: string;
  LastModified: string; /** YYYY-MM-DDTHH:MM:SS:XX.000Z */ 
  ETag: string; 
  Size: number; /** bytes */
  StorageClass: string
}

type S3VersionEntry = {
  Key: string;
  VersionId: string;
  IsLatest: boolean;
  LastModified: string; /** YYYY-MM-DDTHH:MM:SS:XX.000Z */ 
  ETag: string; 
  Size: number; /** bytes */
  StorageClass: string
  Owner: {
    DisplayName: string;
    ID: string;
  }
}

async function listBucket(bucketName:string, prefix:string, fnameToSave:(string|false)=false) {
  // TODO -- look into `CommonPrefixes` - does this drastically reduce the number of needed API calls?
  console.log("AWS::S3 Listing objects in bucket,", bucketName, ", under prefix", prefix)
  const options = {
    /* https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/preview/client/s3/command/ListObjectsV2Command/ */
    Bucket: bucketName,
    Prefix: prefix
  }
  const response = []
  const client = new S3Client(s3config);
  let pageCount = 0;
  let objectCount = 0;
  for await (const page of paginateListObjectsV2({client, pageSize: 1000}, options)) {
    pageCount++;
    console.log('\t\tpage number: ', pageCount); // TODO XXX - temporary to see how many in real time
    objectCount += page.KeyCount as number;
    response.push(page)
  }
  console.log(`\t${objectCount} objects over ${pageCount} API calls. ${cost(pageCount)}`)
  if (fnameToSave) {
    console.log("Writing result to", fnameToSave)
    fs.writeFileSync(fnameToSave, YAML.stringify(response))
  }
  return response;
}

async function listBucketVersioned(bucketName:string, prefix:string, fnameToSave:(string|false)=false) {
  /* https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/preview/client/s3/command/ListObjectVersionsCommand/ */
  console.log("AWS::S3 Listing _versioned_ objects in bucket,", bucketName, ", under prefix", prefix)
  const options: any = {
    Bucket: bucketName,
    Prefix: prefix
  };
  const client = new S3Client(s3config);
  const response = []

  let pageCount = 0;
  let versionCount = 0;
  while (true) { // eslint-disable-line no-constant-condition
    const command = new ListObjectVersionsCommand(options);
    const page = await client.send(command);
    versionCount += (page.Versions || []).length;
    pageCount++;
    response.push(page);
    console.log(`\t\tpage number ${pageCount} (started from ${options.KeyMarker || 'the start'})`); // TODO XXX temporary
    if (page.IsTruncated!==true) break;
    if (!page.NextKeyMarker) {
      throw new Error("Error: response is truncated but NextKeyMarker undefined")
    }
    options.KeyMarker = page.NextKeyMarker;
  }
  console.log(`\t${versionCount} versions over ${pageCount} API calls. ${cost(pageCount)}`)

  if (fnameToSave) {
    console.log("Writing result to", fnameToSave)
    fs.writeFileSync(fnameToSave, YAML.stringify(response))
  }
  return response
}


/**
 * Setting a prefix will filter the results resulting in less pagination needed
 * (and a lower cost.)
 */
function commonPrefix(patterns:string[]):string {
  /* https://stackoverflow.com/a/1917041 */
  const strings = patterns.sort()
  const el1 = strings[0], el2 = strings[strings.length-1], L=el1?.length||0;
  let i=0;
  while(i<L && el1?.charAt(i)===el2?.charAt(i)) {
    i++;
  }
  const prefix = el1?.substring(0, i) || '';
  console.log(`\tLongest common prefix of supplied patterns: "${prefix}"`)
  return prefix;
}

function match(pattern:string, key:string):boolean {
  /* pattern has the bucket name & protocol removed already */

  if (pattern.match(/.*{.+}.*/)) {
    // TODO - this regex makes a number of assumptions, but it's good enough for a proof of principle
    const groups = pattern.match(/(.*){(.+)}(.*)/);
    if (groups?.length!==4 || groups[2]!=="YYYY-MM-DD") {
      console.log(`ERROR: can't form regex for pattern ${pattern}`);
      return false;
    }
    // TODO - pattern groups need to be escaped -- use lodash's escapeRegExp for example
    // TODO - precompute these regexs for each pattern
    const r = new RegExp('^' + groups[1] + '\\\d{4}-\\\d{2}-\\\d{2}' + groups[3] + '$'); // eslint-disable-line no-useless-escape
    return key.match(r) !== null;
  }
  return pattern===key;
}


function asset(bucketName:string, response:S3ContentEntry|S3VersionEntry): Asset {
  let s3 = `s3://${bucketName}/${response.Key}`;
  /* "in" operator needed for TS type narrowing - can't just use `response?.versionID` unfortunately */
  // TODO -- why does TS let me write a check for a property not in either type? e.g. `"XXX" in response` is not a TS error
  const isOldVersion = ("VersionId" in response && "IsLatest" in response && !response?.IsLatest);
  if (isOldVersion) {
    s3 +=`?versionID=${response.VersionId}`; // TODO I don't think this will work without an authz header. Maybe? Should try.
  }
  const a:Asset = {
    eTag: response.ETag.replace(/"/g, ''),
    currentVersion: ("VersionId" in response) ? !isOldVersion : true,
    date: String(response.LastModified).split('T')[0] || '',
    urls: {s3} as Record<string, string>
  }
  if (bucketName === "nextstrain-data" && !isOldVersion) {
    if (response.Key.endsWith('.json') && !response.Key.includes('/')) {
      /* TODO -- this assumes we are looking at auspice JSONs, but that won't always be the case */
      a.urls.nextstrain = `https://nextstrain.org/${response.Key.replace(/\.json$/, '').replace(/_/g, '/')}`;
    }
    a.urls.https = `https://data.nextstrain.org/${response.Key}`;
  }
  return a;
}

/** Currently the pricing is $0.005 per 1000 API requests
 * (https://aws.amazon.com/s3/pricing/) and each API request can return 1000 objects.
 * The nextstrain-data bucket currently has ~53k objects (not including versions),
 * which equates to ~25c per listing of the entire bucket.
 * The number of versioned objects _seems_ to be around 400k (using
 * https://s3.console.aws.amazon.com/s3/buckets/nextstrain-data?region=us-east-1&tab=metrics)
 * which would be around $2 to list (400 API calls)
 */ 
function cost(apiCount:number) {
  return `Estimated cost c. $${(apiCount*0.005).toPrecision(1)}`
}


function readReallyLargeYamlFile(fname:string) {
  /**
   * The YAML file listing all versioned assets on nextstrain-data is ~130Mb.
   * Typical parsing approaches don't work. For instance:
   *    response = YAML.parse(fs.readFileSync(fname, 'utf8'))
   *    FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory.
   * We make some assumptions about the YAML format here, but as we control
   * the writing of those YAML files this seems ok for now.
   */
  const contents = fs.readFileSync(fname, 'utf8');
  const pages = contents.split('\n-');
  return pages.map((str, idx) => YAML.parse(idx===0 ? str : '-'+str)[0])
}
