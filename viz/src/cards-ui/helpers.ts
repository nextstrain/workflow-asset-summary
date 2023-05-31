import { CardType } from "./card-component";
import { useEffect, useState } from 'react';

export type SortMethods = "alphabetical"|"lastUpdated"|"original"

export const useSortAndFilter = (method:SortMethods, selectedFilterOptions: Option[], cards: (CardType[]|undefined), setOrderedData:any) => {
  useEffect(() => {
    if (!cards) return;
    console.log(`Sorting by ${method} ` + (selectedFilterOptions.length ? `filtering to ${selectedFilterOptions.map((el) => el.value).join(", ")}` : '(no filtering)'))
    let data:CardType[] = JSON.parse(JSON.stringify(cards));
    let _sortFn:((c1:CardType, c2:CardType) => number) | undefined = undefined;
    if (method==="alphabetical") {
      _sortFn = (c1, c2) => {
        if (c1.name.toLowerCase() < c2.name.toLowerCase()) return -1
        return 1
      }
    } else if (method==="lastUpdated") {
      _sortFn = (c1, c2) => {
        if (c1.lastUpdated < c2.lastUpdated) return 1 // c1 older => goes later in array
        return -1
      }
    } else if (method==="original") {
      setOrderedData(data);
    }

    if (_sortFn) {
      const _sort = (n:CardType) => {
        n.children.sort(_sortFn)
        n.children.forEach(_sort) 
      }
    
      data.forEach(_sort)
      data.sort(_sortFn); // todo -- why is TS complaining?
    }

    /* ----------- FILTER --------------- */
    // note this sometimes has bugs, but it's good enough for the prototype
    if (selectedFilterOptions.length) {
      // filter out dataset cards which don't match the filters
      const _criteria = (c:CardType) => {
        if (!c.datasetFilename) return true;
        return selectedFilterOptions.map((o) => o.value).map((searchString) => {
          console.log("searchString", searchString, c.name)
          if (searchString.includes("/")) { // user-typed search
            return c.name.includes(searchString)
          } else {  
            return c.name.split('/').includes(searchString)
          }
        }).every((x) => x);
      }
      function _filterDatasetCards(card:CardType) {  
        card.children = card.children.filter(_criteria);
        card.children.forEach(_filterDatasetCards);
      }
      data.forEach(_filterDatasetCards)
      data = data.filter(_criteria);
      // propagate the dataset count up the tree
      function _propagate(card:CardType) {
        let nDatasets = 0;
        let nVersions = 0;
        function _count(card:CardType) {
          if (card.datasetFilename) {
            nDatasets++
            nVersions += card.versions?.length || 0;
          }
          card.children.forEach(_count)
        }
        _count(card);
        card.nDatasets = nDatasets;
        card.nVersions = nVersions;
        card.children.forEach(_propagate);
      }
      data.forEach(_propagate)
      // filter the children nodes based on dataset count & either remove or collapse
      data = data.filter((c) => c.nDatasets>0)
      function _collapse(card:CardType) {
        card.children = card.children.filter((c) => c.nDatasets>0)
        if (card.children.length===1) {
          const _name = card.name;
          card = card.children[0];
          card.name = `${_name}/${card.name}`;
        }
        card.children.forEach(_collapse);
      }
      data.forEach(_collapse)
    }

    setOrderedData(data);
  }, [cards, method, selectedFilterOptions, setOrderedData])

} 

export type Option = {value: string; label: string}

export function useFilterOptions(data:CardType[]) {
  const [state, setState] = useState<Option[]>([]);
  const counts:Record<string,number> = {};
  useEffect(() => {
    function _walk(card:CardType) {
      // only count if it's a dataset (not an intermediate card)
      if (card.datasetFilename) {
        card.name.split('/').forEach((word) => {
          if (counts[word]) counts[word]++
          else counts[word]=1
        })
      }
      card.children.forEach(_walk);
    }
    data.forEach(_walk)
    const nCounts = Object.entries(counts).length;
    const options = Object.entries(counts)
      .sort((a,b) => a[1]<b[1] ? 1 : -1)
      .filter(([_word, count]) => count!==nCounts) // filter out search options present in all datasets (not working, TODO XXX)
      .map(([word, count]) => {
        return {value: word, label: `${word} (${count})`}
      });
    setState(options);
  }, [data]);
  return state
}
