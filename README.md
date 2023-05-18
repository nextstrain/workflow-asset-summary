# Summary of Nextstrain workflows and assets

> Work in progress!

See this data visualised at [nextstrain.github.io/workflow-asset-summary](https://nextstrain.github.io/workflow-asset-summary/)

**Aim**

This currently summarises the (some of the many) assets we produce, both for our own purposes and to inform others what we are doing.

It forms part of a bigger project related to the workflows themselves. Both of these ideas are very much proof-of-principle at the moment, and may take a different direction from that being explored in this repo.

### Install / Set-up

```sh
conda create -n nextstrain-workflow-asset-summary -y -c conda-forge bioconda nodejs=18 nextstrain-cli"

conda activate nextstrain-workflow-asset-summary

mkdir cache

npm ci # dependencies for examining s3 objects

cd viz && npm ci && cd - # dependencies for viz app
```

### Collect S3 assets

The YAML config defines defines which resources we want to collect and the patterns which define them. 
For instance a resource might be the Auspice datasets for "SARS-CoV-2 (GISAID, 21L, Asia, 6m)" with an associated pattern `s3://nextstrain-data/ncov_gisaid_21L_asia_6m_{YYYY-MM-DD}.json`.
See `./data/core.yaml` for numerous examples.
These resources are grouped into a few collections -- 'phylogenetics', 'forecasts', etc -- for visualisation purposes.

We make requests to S3 based on these patterns with the goal of listing all matching assets (S3 objects), producing a JSON output in `./cache/core.json` by default.

**Versioned assets**
While we use YYYY-MM-DD datestams in the filenames for many of our nCoV-related files, we don't do this anywhere else.
Listing all the versions of each file allows us to see the changes over time.
Currently the code will only examine versioned assets for a small set of files due to being overly cautious about costs involved; see `./stc/main.ts` for how to list versions for everything (takes ~15min and costs around $2).

We save the raw result of these API requests as temporary files in `./cache` so that it's easy to develop the code / modify the config without incurring the time (and $$$) penalty of S3 API requests.


```sh
## NOTE - AWS environment variables needed -- see below for more
npm run start
```

### Visualise

**If you want to use the local JSON assets file from ./cache**

```
cd viz
npm run dev:local
```

**If you want to use the pre-prepared JSON file from S3**

> Currently fetches `s3://nextstrain-staging/james/workflow-asset-summary.json` (see next section)

```
cd viz
npm run dev
```

### Upload assets JSON to S3

> You'll need AWS credentials to write to the bucket you're uploading to

```sh
jq -c . < cache/core.json > ./cache/workflow-asset-summary.json # minimise
nextstrain remote upload s3://nextstrain-staging/james/ cache/workflow-asset-summary.json
rm ./cache/workflow-asset-summary.json
```


### Deploy viz app to GitHub pages

This happens automatically via a GitHub action any time a push is made to the master branch which modifies files in `./viz*`


### Notes

**Object Versions**

Currently this will only fetch versioned assets for the 'ingest' category, _unless_ you edit the code. 
Each versioned listing of the nextstrain-data bucket costs ~$2, whereas a listing of just the (current) objects is around 25c.
Without listing versions a lot (most) of our pathogen builds are not surfaced, as the YYYY-MM-DD filename pattern is the exception not the rule.

**meta+tree auspice JSONs**

Are not yet handled that well. You can specify a pattern that matches `_tree.json` and we'll pick them up (if they exist).
Note that these were often deleted, but still available as versions.

**AWS credentials**

You'll need to provide AWS credentials.
The IAM user will need permissions for each bucket (which the config defines) of `ListBucket`, `ListBucketVersions`.


**Objects with identical contents on different dates**

For example, the object with ETag `ae14f0caaa6167a1dc821eaf7fbfb0da` has been uploaded (modified) on 14 different days. Interestingly, the current version of that object - `s3://nextstrain-data/ncov_asia_2020-04-08.json` ([nextstrain URL](https://nextstrain.org/ncov/asia/2020-04-08)) was updated on 2021-02-16, _almost a year_ after the filename would indicate, and has _different_ contents from these 14. Here are some of the 14 previous versions, all of which have identical contents:

|  date modified | filename  |
|---|---|
|  2020-04-09 |  s3://nextstrain-data/ncov_asia_2020-04-08.json?versionID=eHjv3RHIW55ufmn_DcSj8HvMZvqoHnXB |
| 2020-04-10 | s3://nextstrain-data/ncov_asia_2020-04-08.json?versionID=r_fNcFl9NqVooOoOKSZuROuyvhvIUKet |
|  2020-04-11 |  s3://nextstrain-data/ncov_asia_2020-04-08.json?versionID=JlmAr7pAGz67cuRsjh_M37jXDEDk4Fup |
| 2020-04-12 | s3://nextstrain-data/ncov_asia_2020-04-08.json?versionID=4EQ8LLWxWM0QqddASTZ4kbfmYuZg8F35 | 

Sample code to pull down the first & last versions:
```
aws s3api get-object --bucket nextstrain-data --key ncov_asia_2020-04-08.json --region us-east-1 --version-id YVPM1IR.bhVOYIekfBvLmOdAeMobqKzE latest.json.gz
aws s3api get-object --bucket nextstrain-data --key ncov_asia_2020-04-08.json --region us-east-1 --version-id un.UhACfFmfHbExWXLxIugm2sX54mKGO first.json.gz
```


### TODO

* Interactive tooltips (so you can click on links!)

* We have a _lot_ of resources which should be better grouped in the visualisation. E.g. avian flu has 32 current datasets (4 x Ha/Na combinations, 8 segments), seasonal flu many more than this, and nCoV even more!

* Examine GitHub repos (community), groups etc etc


### Bugs

* Using the (large) versioned API response for the nextstrain-data bucket resulted in incorrect parsing of the dates.
Serialising it to YAML and reading it solved this. Presumably this is related to the timestamps being cast to strings as part of going through YAML.
