import { useState, useEffect } from 'react';

export type Data = {
  [category: string] : {
    [name: string] : {
      description: string;
      assets: Asset[];
    }
  }
}
export type Asset = {
  date: string; /** YYYY-MM-DD */
  urls: {
    [source: string]: string;
  };
  currentVersion: boolean;
}

export const useDataFetch = () => {
  const [state, setState] = useState<(Data|undefined)>(undefined);
  useEffect(() => {
    async function fetchAndParse() {
      // See https://vitejs.dev/guide/env-and-mode.html
      const url = import.meta.env.VITE_LOCAL_FILE ?
        'http://localhost:8001/core.json' :
        'https://nextstrain-staging.s3.amazonaws.com/james/workflow-asset-summary.json';
      console.log(`Downloading & parsing assets from ${url}`)
      try {
        setState(
          await fetch(url)
            .then((res) => res.json())
        )
      } catch (err) {
        console.error(err);
        return;
      }
    }
    fetchAndParse();
  }, []);
  return state
}