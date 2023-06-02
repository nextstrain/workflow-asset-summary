import { useState, useRef, useMemo } from 'react';
import { MdCached, MdOutlineShare, MdOutlineVisibility, MdOutlineContentCopy, MdCoronavirus } from "react-icons/md";
import { NextstrainLogo, BlabLogo } from './logo.tsx';
import { SparkLine } from "./sparkLine.tsx";
import { useGraph } from "../graph.ts";

export const Card = ({data, outer=false}:{data: CardType, outer?:boolean}) => {

  const [details, setDetails] = useState<string>('')

  return (
    <div key={data.name} style={{
      border: outer ? "2px solid #ece2f0" : '',
      borderTop: outer ? "2px solid #ece2f0" : "1px solid #ece2f0",
      marginLeft: outer ? '' : "20px",
      // minWidth: '100%',
      // maxWidth: '100%',
      minHeight: '40px',
      padding: '5px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      gap: '0px',
      color: '#4F4B50',
      transition: 'all 0.5s ease-in-out', // TODO -- doesn't work. Height is dynamic.
    }}>

      <div style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: '10px',
        alignItems: 'center',
        color: '#4F4B50',
      }}>
        {outer && Logo(data.name)}
        <Name name={data.name} isDataset={data.datasetFilename}/>
        <SparkLine versions={data.versions || []} onClick={()=>{setDetails(details==='versions'?'':'versions')}}/>
      </div>

      <IconRow data={data} details={details} setDetails={setDetails}/>

      <Details data={data} view={details}/>

      {(data.children.length!==0) && /* !data.collapsed && */
        data.children.map((card) => <Card data={card}/>)
      }
    </div>
  )
}


function IconRow({data, details, setDetails}:{data: CardType, details:string, setDetails:any}) {

  const setDetailsWrapper = (value:string) => {
    if (value===details) setDetails('')
    else setDetails(value)
  }
  return (
    <>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-start',
        color: "#A49DA7",
        fontSize: "0.8rem",
        gap: '15px',
      }}>
        <LinkedPathogenPageIcon name={data.name}/>
        { data.nDatasets > 1 && (
          <IconContainer
            description="Number of datasets in the collection - the idea is to be able to collapse / expand collections (not yet attempted)"
            Icon={MdOutlineShare}
            text={data.nDatasets}
            handleClick={() => {}}
            // selected={!data.collapsed}
          />
        )}
        <IconContainer
          description="Total number of past versions. Click to display"
          Icon={MdCached}
          text={data.nVersions}
          handleClick={() => setDetailsWrapper('versions')}
        />
        <IconContainer
          description="Number of linked narratives"
          Icon={MdOutlineContentCopy}
          text={data.linkedNarratives.length}
          handleClick={() => setDetailsWrapper('narratives')}
        />
        <IconContainer
          description="We could keep track of the total view count? Would require server logging. May be undesirable."
          Icon={MdOutlineVisibility}
          text={data.nDatasetViews+"k"}
          handleClick={() => setDetailsWrapper('views')}
        />
        <div>
          {`Last updated: ${data.lastUpdated}`} {/* TODO -- want to say "Last week" or similar */}
        </div>
      </div>
    </>
  )
}

function IconContainer(
  {description, Icon, text, handleClick, selected=false}: {description:string, Icon:any, text:string|number, handleClick: (event:any)=>void, selected?:boolean}
) {
  const iconProps:Record<string,string> = {size: "1.2em"};
  if (selected) iconProps.color = '#4F4B50';
  return (
    <div
      style={{display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer'}}
      data-tooltip-id="iconTooltip"
      data-tooltip-content={description}
      data-tooltip-place="top"
      onClick={handleClick}
    >
      <Icon {...iconProps}/>
      {text}
    </div>
  )
}

function LinkedPathogenPageIcon({name}:{name:string}) {
  const pages: Record<string, string> = {
    flu: "/influenza",
    ncov: "/sars-cov-2",
  }
  const p1 = name.split('/')[0]
  if (!pages[p1]) return null;

  return (
    <a
      style={{display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', color: 'inherit'}}
      data-tooltip-id="iconTooltip" data-tooltip-place="top"
      data-tooltip-content="Click to view associated pathogen page"
      href={`https://nextstrain.org${pages[p1]}`}  target="_blank" rel="noreferrer"
    >
      <MdCoronavirus size={"1.2em"}/>
      {pages[p1]}
    </a>
  )
}

function Details({data, view}: {data:CardType, view:string}) {

  if (view==='') return null;

  let content;
  if (view==='narratives') {
    content = 'Narratives which reference this dataset (functionality not yet implemented) would be listed here'
  } else if (view==='versions') {
    if (data.versions?.length) {
      return <Versions card={data}/>
    } else {
      content = 'Currently this viz only implemented for datasets, not intermediates -- try clicking using a card with blue text (which is a dataset card).'
    }
  } else if (view==='datasets') {
    content = 'This should open/close (collapse?) the cards'
  } else if (view==='views') {
    content = ''
  } 

  return (
    <div style={{
      borderTop: "1px solid #ece2f0",
      marginTop: '5px', /* above border */
    }}>
      {content}
    </div>
  )
}

function Versions({card}:{card:CardType}) {
  const d3Container = useRef(null);
  const versionData = useMemo(() => ({
    category: {
      versions: {
        description: "TKTK",
        assets: card?.versions?.map((date)=>({date, urls: {}, currentVersion:false})) || []
      }
    }
  }), [card])
  const styles = useMemo(() => ({
    width: 800,
    rowHeight: 40,
    top: 0,
    bottom: 80,
    left: 50,
    right: 50
  }), [])
  console.log("<Versions/>")
  useGraph(d3Container, versionData, "category", styles);

  return (<div ref={d3Container} style={{
    borderTop: "1px solid #ece2f0",
    marginTop: '5px', /* above border */
  }}/>)
}

function Name({name, isDataset}:{name:string, isDataset:boolean}) {
  if (!isDataset) return (
    <div
      data-tooltip-id="iconTooltip" data-tooltip-place="top"
      data-tooltip-content={"Not an actual dataset - sort of an internal node in the naming hierarchy"}
    >
      {name}
    </div>
  );
  return (
    <a href={`https://nextstrain.org/${name}`} target="_blank" rel="noreferrer"
      style={{color: '#3690c0'}}
      data-tooltip-id="iconTooltip" data-tooltip-place="top"
      data-tooltip-content={"Click to view the (current) dataset"}
    >
      {name}
    </a>
  )
}

function Logo(name:string) {
  if (name.startsWith('groups/blab/')) return <BlabLogo/>
  return <NextstrainLogo/>
}

export type CardType = {
  name: string;
  datasetFilename: boolean;
  collapsed: boolean;
  nDatasets: number,
  nVersions: number;
  nDatasetViews: number;
  linkedNarratives: string[];
  pathogenPage?: string;
  lastUpdated: string;
  versions?: string[];
  children: CardType[];
}

