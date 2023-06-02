import { useRef, useState, useCallback} from 'react';
import { useDataFetch } from "./useDataFetch.ts"
import { useGraph } from "./graph.ts"
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';

function App() {
  const data = useDataFetch();
  const [category, setCategory] = useState<string>('phylogenetics')
  const d3Container = useRef(null);
  useGraph(d3Container, data, category);
  const changeCategory = useCallback((idx:number) => {
    const category = Object.keys(data||{})[idx];
    if (category) setCategory(category);
  }, [data])

  return (
    <div id="app">
      <a href="?page=cards">Cards UI prototype is here</a>
      <h2>Nextstrain resources over time</h2>
      <div className="abstract">
        Visualisation of nextstrain resources we have uploaded over the years.
        <p/>
        Circles indicate a current version of the file on S3 (i.e. what you see if you listed the objects in the bucket).
        Vertical stripes are S3 objects which are no longer current but an old version exists, as we store all past versions in S3.
        Hover to see more information.
        Zooming is not yet implemented, but different categories have different timespans.
        <p/>
        Note:
        The horizontal position refers to the object's modification date, not necessarily the date represented in the object's name or when the model was run.
        In the case where multiple objects were identical (same ETag), we are showing the earliest object (which means there may be a current (identical) version uploaded at a later date which we're not showing here).
        My memory is that there were objects prior to this time-span (e.g. zika builds predate 2018) - perhaps we had versioning turned off in the early days, or we used a different bucket?
        <p/>
        The rows chosen here are demonstrative, not comprehensive.
        <p/>
        P.S. Click a tab to select a different category to visualise.
      </div>
      <div style={{paddingTop: '30px'}}/>
      <Tabs defaultIndex={1} onSelect={changeCategory}>
        <TabList>
          {Object.keys(data||{}).map((category) => (
            <Tab key={category}>{category}</Tab>
          ))}
        </TabList>
        {/* we don't actually use <TabPanel>, this is just to appease the prop types */}
        {Object.keys(data||{}).map((category) => (<TabPanel key={category} />))}
      </Tabs>
      <div ref={d3Container}/>
    </div>
  )
}

export default App