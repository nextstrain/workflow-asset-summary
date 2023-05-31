import {useEffect} from 'react';
import {Data, Asset} from "./useDataFetch.ts";
import { Tooltip } from "./tooltip";
import { colours } from "./colours.ts";

import * as d3 from "d3";

const _styles = {
  width: 1200,
  rowHeight: 40,
  top: 50,
  bottom: 150,
  left: 200,
  right: 50
}

export const useGraph = (d3Container: {current: any}, dataAll: (Data|undefined), category:string, styles:Record<string,number> = _styles) => {
  useEffect(() => {
    if (!d3Container.current || dataAll?.[category]===undefined) {
      return;
    }
    const data = dataAll[category];
    const names = Object.keys(data);
    console.log("drawing graph");
    const dom = d3.select(d3Container.current);
    dom.selectAll("*").remove();
    const tooltip = new Tooltip(dom);

    const h = styles.rowHeight * names.length + styles.top + styles.bottom;

    const x = d3.scaleTime()
      .domain([
        new Date(d3.min(names.map((n) => data[n].assets[0].date)) || ''),
        new Date(d3.max(names.map((n) => data[n].assets[data[n].assets.length-1].date)) || '')
      ])
      .range([styles.left, styles.width-styles.right])
      .nice() // this does the text formatting for us

    // x.domain([ new Date('2021-08-01'), new Date('2021-09-01')])

    const y = d3.scalePoint()
      .domain(names)
      .range([styles.top, h-styles.bottom]); // y=0 is @ top. Range is [bottom_y, top_y] which maps 0 to the bottom and 1 to the top (of the graph)


    const svg = dom.append("svg")
      .attr("width", styles.width)
      .attr("height", h)
      .attr("viewBox", `0 0 ${styles.width} ${h}`);

    svg.append("g")
      .attr("transform", `translate(0,${h - styles.bottom + 20})`)
      .call(d3.axisBottom(x).tickSize(5))
      .call((g) => g.select(".domain").remove())
      .selectAll("text")
        .attr("dy", "0.6em")
        .attr("transform", "rotate(45)")
        .style("text-anchor", "start")
        .style("font-size", "12px")
        .style("fill", "#aaa");

    svg.append("g")
      .attr("class", "yAxis")
      .attr("transform", `translate(${styles.left},0)`)
        .call(d3.axisLeft(y).tickSize(2).tickPadding(4))
        .call((g) => g.select(".domain").remove())
        .selectAll("text")
          .text((d:any) => d)
          .style("font-size", "12px")
          .style("fill", "#aaa")
          .on("mouseover", (_event, d) => tooltip.display(
            function (name:string) {
              return `<div>
                  <p>${name}</p>
                  <p><b>Description:</b>${data[name].description || ''}</p>
              </div>`
            }, d)
          )
          .on("mousemove", (event) => tooltip.move(event))
          .on("mouseout", () => tooltip.hide())
    
    const c = colours(names.length);

    names.forEach((name, i) => {

      svg.append('g')
        .attr('id', name)
        .selectAll("lines")
        .data(data[name].assets.filter((a) => !a.currentVersion))
        .enter()
        .append('path')
          .attr('d', (d) => {
            const xPx = x(new Date(d.date));
            const yPx = y(name) || 0;
            const delta = styles.rowHeight/6;
            return `M${xPx},${yPx-delta}L${xPx},${yPx+delta}`;
          })
          .style("stroke", c[i])
          .style("stroke-width", 2)
          .style("opacity", 0.2)
          .on("mouseover", (_event, d) => tooltip.display(tooltipHTML, name, d))
          .on("mousemove", (event) => tooltip.move(event))
          .on("mouseout", () => tooltip.hide())

      svg.append('g')
        .attr('id', name)
        .selectAll("circles")
        .data(data[name].assets.filter((a) => a.currentVersion))
        .enter()
        .append('circle')
          .attr('r', 4)
          .attr('cx', (d) => x(new Date(d.date)))
          .attr('cy', y(name) || 0) // TODO -- remove the '|| 0' - the axis was created using `names`, so they are guaranteed to exist, but TS is complaining
          .style("fill", c[i])
          .style("opacity", 0.7)
          .on("mouseover", (_event, d) => tooltip.display(tooltipHTML, name, d))
          .on("mousemove", (event) => tooltip.move(event))
          .on("mouseout", () => tooltip.hide())
    });

  }, [d3Container, dataAll, category])
}

export function tooltipHTML(name:string, d:Asset) {
  const sources = Object.entries(d.urls).map(([src, url]) => 
    `<p><b>${src}:</b> ${url}</p>`
  )
  return `
    <div>
      <p><b>${name}</b></p>
      <p><b>Last Modified:</b> ${d.date}</p>
      ${sources.join("\n")}
    </div>
  `
}