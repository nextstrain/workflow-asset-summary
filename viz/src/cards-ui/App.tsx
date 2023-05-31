import { useState, useEffect } from 'react';
import { Card, CardType } from "./card-component.tsx";
import { Tooltip } from 'react-tooltip'
import { useSortAndFilter, SortMethods, useFilterOptions, Option } from './helpers.ts';
import CreatableSelect from 'react-select/creatable';

function App() {
  const data = useDataFetch();
  const [selectedFilterOptions, setSelectedFilterOptions] = useState([]);
  const [sortMethod, changeSortMethod] = useState<SortMethods>("lastUpdated");
  const [orderedData, setOrderedData] = useState<CardType[]|undefined>(undefined);
  useSortAndFilter(sortMethod, selectedFilterOptions, data, setOrderedData)
  const filterOptions = useFilterOptions(orderedData||[]); // reflects the subset of cards in `orderedData`


  return (
    <div id="app">

      <div className="abstract" style={{lineHeight: 1.3, maxWidth: '80%', paddingBottom: '30px'}}>
        Prototype of using cards to represent datasets for a certain collection (currently "core" datasets, so this UI would be part of the /pathogens page).
        The data behind this is derived from a full listing of all objects (including versions) in s3://nextstrain-data done in ~mid May 2023;
        for production this would require
        {` `}<a href="https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html">monitoring S3 events</a>{` `}
        to stay up-to-date (or something similar).
        There is a lot of prior thinking around this in the group, but the most relevant is{` `}
        <a href="https://github.com/nextstrain/nextstrain.org/issues/62">this GitHub issue</a>.
        My design approach was focused on:

        <h4>Dataset discoverability</h4>
        This is primarily achieved through sorting by most-recently updated datasets, as well as using filtering with most-common-words appearing first in the dropdown.
        The big missing piece in the current UI is that certain datasets should be collapsed into their parent (non-dataset) cards.
        For instance, I think we'd want to collapse all "flu/avaian/h5n1/segment" into "flu/avian/h5n1", and potentially go even higher (e.g. collapse to "flu/avian").
        The exact way a card would indicate that it's a collection and not a dataset needs work (and it could be a dataset itself as well!).

        <h4>Regularity of updates</h4>
        A big thing we're not currently communicating through nextstrain is both the frequency and regularity of updates.
        Spark line and expandable timeline of all updates, as well as the sorting, are trying to convey this.

        <h4>Versatility</h4>
        I'm imaging cards could appear on many pages: collection pages (e.g. /pathogens, /all, /staging, /groups/X, /community/A/B),
        pathogen pages (/influenza, /sars-cov-2). And perhaps even further - docs pages, blog posts, the main splash page. But perhaps not!
        The cards don't have to represent (Auspice) datasets -- they are intended to represent all of our resources (model JSONs, metadata/sequences, etc).

        There's a few big things still missing from the current UI:
        <ul>
          <li>The collapsing (mentioned above), which should be dynamic</li>
          <li>nCoV datasets are filtered out at the moment, as without some collapsing approach they are too much</li>
          <li>UI to indicate relationship between cards (e.g. skeletal tree on LHS of cards or similar)</li>
        </ul>

      </div>


      <SortOptions sortMethod={sortMethod} changeSortMethod={changeSortMethod}/>
      <Filter options={filterOptions} setSelectedFilterOptions={setSelectedFilterOptions}/>

      <div style={{
        paddingTop: '50px',
        minWidth: '80%',
        maxWidth: '80%',
      }}>
        {orderedData?.map((c) => {
          return (<Card data={c} key={c.name} outer/>)
        })}
      </div>
      <Tooltip id="iconTooltip" />
    </div>
  )
}

export default App



function useDataFetch() {
  const [state, setState] = useState<(CardType[]|undefined)>(undefined);
  useEffect(() => {
    async function fetchAndParse() {
      // See https://vitejs.dev/guide/env-and-mode.html
      const url = import.meta.env.VITE_LOCAL_FILE ?
        'http://localhost:8001/cards-core.json' :
        'https://nextstrain-staging.s3.amazonaws.com/james/cards-core.min.json';
      console.log(`Downloading & parsing assets from ${url}`)
      try {
        setState(
          await fetch(url)
            .then((res) => res.json())
            // .then((j) => [j[1]]) // j[0] is WNV/NA (singleton), j[1] is dengue
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


function SortOptions({sortMethod, changeSortMethod}:{sortMethod:SortMethods, changeSortMethod:React.Dispatch<React.SetStateAction<SortMethods>>}) {
  function onChangeValue(event:any) {
    changeSortMethod(event.target.value);
  }
  return (
    <div>
      Sort cards by: 
      <input type="radio" onChange={onChangeValue} value="alphabetical" checked={"alphabetical"===sortMethod} /> alphabetical
      <input type="radio" onChange={onChangeValue} value="lastUpdated" checked={"lastUpdated"===sortMethod} /> lastUpdated
      <input type="radio" onChange={onChangeValue} value="original" checked={"original"===sortMethod} /> original
    </div>
  )
}

function Filter({options, setSelectedFilterOptions}:{options:Option[], setSelectedFilterOptions:any}) {
  return (
    <div style={{maxWidth: '60%'}}>
      <CreatableSelect
        placeholder={"Filter by words in dataset names, or type in your own substring"}
        isMulti options={options}
        onChange={setSelectedFilterOptions}
      />
    </div>
  )

}