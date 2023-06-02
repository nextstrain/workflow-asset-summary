import * as d3 from "d3";

const x = d3.scaleLinear()
  .domain([0, 104]) // 2 x 52 weeks
  .range([0, 100]); // viewBox

export const SparkLine = ({versions, onClick}: {versions: string[], onClick: (event:any)=>void}) => {
  if (!versions.length) return null;
  const v = [...versions];
  const yVals = (new Array(104)).fill(0);
  /* date logic somewhat ad-hoc. It's a prototype */
  let d = new Date()
  for (let i=103; i>=0; i--) {
    d.setDate(d.getDate()-7);
    const dIso = d.toISOString()
    while(v[v.length-1] > dIso) {
      yVals[i]++
      v.pop();
    }
  }
  const maxY = d3.max(yVals);
  const y = d3.scaleLinear()
    .domain([0, d3.max([maxY, 2])])
    .range([9.5, 0.5]) // essentially the viewBox

  const line = (d3.line()
    .x((_value, idx) => x(idx))
    // @ts-ignore - not sure why d3 is typed to say value is [number, number]
    .y((value) => y(value))
    .curve(d3.curveBasis)
  )(yVals)
  
  return (
    <div
      data-tooltip-id="iconTooltip"
      data-tooltip-content="Summary of updates over the past 2 years; click for more details."
      data-tooltip-place="top"
      style={{ marginLeft: 'auto',  marginRight: '0' }}
      onClick={onClick}
    >
      <svg width={300} height={30} viewBox="0 0 100 10">
        <defs>
          <linearGradient id='fadeGrad' x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#d0d1e6" />
            <stop offset="20%" stopColor="#a6bddb" />
            <stop offset="40%" stopColor="#74a9cf" />
            <stop offset="60%" stopColor="#3690c0" />
            <stop offset="80%" stopColor="#0570b0" />
            <stop offset="100%" stopColor="#045a8d" />
          </linearGradient>
        </defs>
        <path d={line||''} stroke={maxY===0? "#d0d1e6" : "url('#fadeGrad')"} strokeWidth={0.5} fill={'none'} opacity={0.6}/>
      </svg>
    </div>
  )
}
