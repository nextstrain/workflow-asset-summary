import { useState, useEffect, useCallback} from 'react';
import { Card, CardType } from "./card-component.tsx";
import { Tooltip } from 'react-tooltip'
import { useSortAndFilter, SortMethods, useFilterOptions, Option } from './helpers.ts';
import CreatableSelect from 'react-select/creatable';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';

const FILES: Record<string, [string,string]> = {
  'nextstrain-data ("core")': ['http://localhost:8001/cards-core.json',    'https://nextstrain-staging.s3.amazonaws.com/james/cards-core.min.json'],
  'groups/blab':              ['http://localhost:8001/cards-blab.json',    'https://nextstrain-staging.s3.amazonaws.com/james/cards-blab.min.json'],
  'nextstrain-staging':       ['http://localhost:8001/cards-staging.json', 'https://nextstrain-staging.s3.amazonaws.com/james/cards-staging.min.json'],
}


function App() {
  const [dataSource, setDataSource] = useState<string>('nextstrain-data ("core")')
  const data = useDataFetch(dataSource);
  const [selectedFilterOptions, setSelectedFilterOptions] = useState([]);
  const [sortMethod, changeSortMethod] = useState<SortMethods>("lastUpdated");
  const [orderedData, setOrderedData] = useState<CardType[]|undefined>(undefined);
  useSortAndFilter(sortMethod, selectedFilterOptions, data, setOrderedData)
  const filterOptions = useFilterOptions(orderedData||[]); // reflects the subset of cards in `orderedData`
  const changeDataSource = useCallback((idx:number) => {
    const name = Object.keys(FILES||{})[idx];
    if (name) setDataSource(name);
  }, [data])

  return (
    <div id="app">

      <div className="abstract" style={{lineHeight: 1.3, maxWidth: '80%', paddingBottom: '30px'}}>
        Prototype of using cards to represent datasets for a certain collection,
        The data behind this is derived from a full listing of all objects (including versions) in the respective bucket (or bucket + prefix);
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
        The exact way a card would indicate that it's a collection and not a dataset needs work (and the parent card could be a dataset itself as well!).

        <h4>Regularity of updates</h4>
        We're not currently communicating the frequency and regularity of updates to the datasets in nextstrain.
        The Spark line and expandable timeline of all updates (click on the spark line to see), as well as the sorting, are an attempt to convey this.

        <h4>Versatility</h4>
        I'm imaging cards could appear on many pages: collection pages (e.g. /pathogens, /all, /staging, /groups/X, /community/A/B),
        pathogen pages (/influenza, /sars-cov-2, and hopefully more in the future). And perhaps even further - docs pages, blog posts, the main splash page. But perhaps not!
        The cards don't have to represent (Auspice) datasets -- they are designed to be able to represent all of our resources (model JSONs, metadata/sequences, etc).

        <p/>
        There's a few things (at least) still missing from the current UI:
        <ul>
          <li>The collapsing (mentioned above), which should be dynamic</li>
          <li>/ncov/... datasets are filtered out at the moment, as without some collapsing approach they are too much</li>
          <li>UI to indicate relationship between cards (e.g. light grey tree on LHS of cards or similar)</li>
          <li>We'd want to acknowledge the dataset source - I've used icons here, but we'd want a bit more than this. We could get the source by parsing the filename, I think.</li>
          <li>If (in the future) we parse the file contents, then there is plenty more information we could surface here (and use for searching etc).</li>

        </ul>

        <h4>
          Currently available data sources:
        </h4>
        <ul>
          <li>nextstrain-data ("core") - this UI would be part of the /pathogens page. Data was generated in mid May 2023.</li>
          <li>groups/blab - this UI could be part of the /groups/blab page. Bucket is versioned, but there are not frequent updates. Data generated June 1st.</li>
          <li>nextstrain-staging - cards to be shown at /staging. This bucket is not versioned, but if we monitored the changes in bucket contents we could still get a history. Data generated June 1st.</li>
        </ul>

      </div>

      <Tabs defaultIndex={0} onSelect={changeDataSource}>
        <TabList>
          {Object.keys(FILES||{}).map((name) => (
            <Tab key={name}>{name}</Tab>
          ))}
        </TabList>
        {/* we don't actually use <TabPanel>, this is just to appease the prop types */}
        {Object.keys(FILES||{}).map((category) => (<TabPanel key={category} />))}
      </Tabs>


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


function useDataFetch(dataSource:string) {
  const [state, setState] = useState<(CardType[]|undefined)>(undefined);
  useEffect(() => {
    async function fetchAndParse() {
      // See https://vitejs.dev/guide/env-and-mode.html
      const url = import.meta.env.VITE_LOCAL_FILE ? FILES[dataSource][0] : FILES[dataSource][1];
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
  }, [dataSource]);
  return state
}


function SortOptions({sortMethod, changeSortMethod}:{sortMethod:SortMethods, changeSortMethod:React.Dispatch<React.SetStateAction<SortMethods>>}) {
  function onChangeValue(event:any) {
    changeSortMethod(event.target.value);
  }
  return (
    <div style={{paddingTop: '30px'}}>
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