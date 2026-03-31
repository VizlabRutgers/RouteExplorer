import * as d3 from "d3";

import {
    LINE_GRAPH_MARGIN,
    LINE_GRAPH_PADDING,
    LINE_GRAPH_BORDER,
    RouteCategoryStringMap,
    myDim,
    categoryColor
} from './consts.js';

import {
    addStateCallback,
    cc_change_times,
    getState,
    getTime,
    metrics,
    metrics_by_node,
    rx_packets,
    rx_packets_bounds,
    updateTimeIndex
} from './state.js';

let div = d3.select("#timegraphsdiv");
let svg = div.select('svg');
let xscale = null;
let yscale = null;
let ixscale = null;
let rxscale = null;
let xdomain = null;
let ydomain = null;

const marginLeft = 90;
const marginRight = 0;
const marginTop = 10;
const marginBottom = 40;



function onStateChange(oldState, newState) {
    const p = d3.select("#tag").node().value;
    const c = d3.select("#category").node().value;

    drawLineGraph(p, c);
}


export function onLineGraphClick(event) {
    const raw_tval = ixscale(event.offsetX);
    const new_tindex = Math.round(raw_tval*10);
    updateTimeIndex(new_tindex);
}


export function onCCBreaksClick(event) {
    console.log("onCCBreaksClick");
    console.log(`checked: ${event.srcElement.checked}`);
    drawComponentBreaks();
}


export function onRxsClick(event) {
    console.log("onRxsClick");
    console.log(`checked: ${event.srcElement.checked}`);
    drawOverlayReceptions();
}


function drawRouteStack(filteredRecords) {
    // See https://deepwiki.com/d3/d3-shape/2.5-stack-generator
    const categories = RouteCategoryStringMap.keys();

    const stackGenerator = d3.stack().keys(categories);

    //console.log("filteredRecords");
    //console.log(filteredRecords);

    const stackedCounts = stackGenerator(filteredRecords);

    //console.log("stackedCounts:");
    //console.log(stackedCounts);

   const dim = myDim(div.node(), LINE_GRAPH_BORDER, LINE_GRAPH_PADDING);

    console.log(`timegraph: left:${dim.left} right:${dim.right} top:${dim.top} bottom:${dim.bottom}`);

    const mergedStacks = d3.merge(stackedCounts);
    console.log(mergedStacks[0]["data"].t);

    xdomain = [0, d3.max(mergedStacks, d => d["data"].t)];
    ydomain = [0, d3.max(mergedStacks, d => d[1])];

    console.log(`xdomain: ${xdomain}`);
    console.log(`ydomain: ${ydomain}`);

    svg.attr("width", dim.width)
	.attr("height", dim.height);

    xscale = d3.scaleLinear()
        .domain(xdomain)
	.range([marginLeft, dim.width-marginRight]);
    ixscale = d3.scaleLinear()
        .domain([marginLeft, dim.width-marginRight])
	.range(xdomain);

    // nice extends axis to "nice round values"
    yscale = d3.scaleLinear()
        .domain(ydomain)
	.range([dim.height-marginBottom, marginTop])
        .nice();

    const minrx = rx_packets_bounds.rx_min_bytes;
    const maxrx = rx_packets_bounds.rx_max_bytes;

    rxscale = d3.scaleLinear()
	.domain([minrx, maxrx])
	.range([dim.height-marginBottom, marginTop])
	.nice();

    const xAxis = d3.axisBottom(xscale);
    const yAxis = d3.axisLeft(yscale).ticks(5);
    const axes = svg.select("#timeaxes");

    axes.selectAll("g").remove();

    axes.append("g").call(xAxis)
	.attr("id", "xaxis")
	.attr("transform", `translate(${[0, dim.height-marginBottom]})`)
	.attr("font-size", 14);

    axes.append("g").call(yAxis)
	.attr("transform", `translate(${[marginLeft, 0]})`)
	.attr("font-size", 14);

    // Learn-D3/Chapter07/Stacks/10-area-sa.html
    const area = d3.area()
          .x((d) => xscale(d["data"].t))
          .y0((d) => yscale(d[0]))
          .y1((d) => yscale(d[1]))
          .curve(d3.curveMonotoneX);

    const timepaths = svg.select("#timepaths");
    timepaths.selectAll("path").remove();

    timepaths.selectAll("path")
	.data(stackedCounts)
        .join("path")
        .attr("d", area)
	.style("fill", function(d,i) {return categoryColor(i+1)});


}


function drawOverlayReceptions() {
    //const checked = d3.select("#rxscheck").node().checked;
    const checked = false;

    const tag = d3.select("#tag").node().value;

    if (checked) {
	let filteredReceptions = rx_packets
	    .filter((d) => d.tag===tag)
	    .map((d) => [d.t, d.count]);

	let overlayPath = svg.select("#overlaypaths");

	overlayPath.selectAll("path").remove();

	if (filteredReceptions !== null) {
	    //console.log("rx_packets_bounds:");
	    //console.log(rx_packets_bounds);
	    //console.log(filteredReceptions);

	    const line = d3.line()
		  .x((d) => xscale(d[0]))
		  .y((d) => yscale(d[1]));

	    overlayPath
		.append("path")
		.attr("d", line(filteredReceptions))
		.style("stroke", "black")
		.style("fill", "none");
	}
    } else {
	let overlayPath = svg.select("#overlaypaths");

	overlayPath.selectAll("path").remove();
    }
}


function drawComponentBreaks() {
    const checked = d3.select("#ccbreakscheck").node().checked;

    if (checked) {
	svg.select("#ccbreaks").selectAll("line")
	    .data(cc_change_times)
	    .join("line")
	    .style("stroke", "#202020")
	    .style("stroke-width", 1)
	    .style("stroke-dasharray", "2,3")
	    .style("d", "M5 20 l215 0")
	    .attr("x1", function(d) {return xscale(d[0])})
	    .attr("y1", yscale(0))
	    .attr("x2", function(d) {return xscale(d[0])})
	    .attr("y2", yscale(ydomain[1]));
    } else {
	svg.select("#ccbreaks").selectAll("line").remove();
    }
}


function drawCursor() {
    const t = getTime();
    const cursortime = [t];

    svg.select("#cursor").selectAll("line")
	.data(cursortime)
	.join("line")
	.style("stroke", "black")
	.style("stroke-width", 2)
	.attr("x1", xscale(t))
	.attr("y1", yscale(0))
	.attr("x2", xscale(t))
	.attr("y2", yscale(ydomain[1]));

    const dim = myDim(div.node(), LINE_GRAPH_BORDER, LINE_GRAPH_PADDING);

    let txtovl = d3.select("#timegraphsdiv").select(".textoverlay");

    txtovl.selectAll("text").remove();

    txtovl.append("text")
	.attr("x", xscale(1.5))
	.attr("y", yscale(0.88 * ydomain[1]))
	.text(`t = ${t}`)

    txtovl.append("text")
	.text("time (seconds)")
	.attr("fill", "#cccccc")
	.attr("class", "label")
	.attr("transform", `translate(${[dim.width/2.1, dim.height-2]})`)

    txtovl.append("text")
	.text("number routes")
	.attr("fill", "#cccccc")
	.attr("class", "label")
	.attr("transform", `translate(${[30, dim.height/1.5]}) rotate(270)`)
}


export function drawLineGraph(tag) {

    // records by tag and route type
    //const filteredRecords = metrics.filter((d) => d.tag===tag && d.connected && !d.active);
    // records by tag only
    const srcNode = getState().source;

    let filteredRecords = null;

    if (srcNode === null) {
	filteredRecords = metrics.filter((d) => d.tag===tag);
    } else {
	filteredRecords = metrics_by_node.filter((d) => d.tag===tag && d.src_node === srcNode);
    }

    drawRouteStack(filteredRecords);

    drawOverlayReceptions();

    drawComponentBreaks();

    drawCursor();
}


addStateCallback(onStateChange);
