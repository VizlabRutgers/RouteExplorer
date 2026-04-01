import * as d3 from "d3";

import {
    ZERO_PADDING,
    NODE_LINK_BORDER,
    myDim,
    categoryColor,
    RouteCategory
} from './consts.js';

import {
    addStateCallback,
    addCategoryCallback,
    categoryMap,
    getState,
    getRouteCategoryState,
    setSrc,
    clearSrc,
    setDst,
    clearDst,
    SelectionState,
    lastData,
    getPositionsMap,
    getPositionsList,
    getPositionsByComponent
} from './state.js';


import concaveman from 'concaveman';


const PHY_EDGE_COLOR = "gray";
const NODE_DEFAULT_COLOR = "#cccccc";
const TEXT_COLOR = "#cccccc";
const NODE_RADIUS = 7;
const NODE_BORDER_WIDTH = 4;
const SRC_SELECT_COLOR = "white";
const DST_SELECT_COLOR = "black"
const SRC_BORDER_COLOR = "black";
const PATH_WIDTH = 2;
const PATH_OPACITY = 1.0;
const CONCAVITY=10;

export const ROTATE = true;
const ep_idx = ROTATE ? [1,0] : [0,1];
const pos_idx = ROTATE ? [2,1] : [1,2];

let div = d3.select("#nodelinkdiv");
let svg = div.select('svg');
let xscale = null;
let yscale = null;
let ccPolygons = new Map();
let routeSelected = null;

export const NODE_LINK_PADDING = {top:10, right:20, bottom:40, left:40};


function onNodeClick(e, d, obj) {
    // this function changes state based on current state and click
    const altclick = e.altKey;
    const state = getState();

    console.log(`onNodeClick ${altclick} e:${e} d:${d} obj:${obj}`);

    let node_num = d[0];

    // can't select destination before source
    if (altclick && state.source === null) {
	return;
    }

    if (altclick) {
	console.log(`onNode Click ${state.source} ${node_num} ${state.destination===node_num}`)
	if(state.sameSrcDst(state.source, node_num)) {
	    clearDst();
	} else {
	    setDst(node_num);
	}
    } else {
	if (node_num === state.source) {
	    clearSrc();
	} else {
	    setSrc(node_num);
	}
    }
}


function onCategoryChange(categoryState) {
    console.log(`nodelink onCategoryChange new:${categoryState.majorCategory}`)

    updateNodeLink();
}


function onStateChange(oldState, newState) {
    console.log(`nodelink onStateChange src:${oldState.source}->${newState.source} dst:${oldState.destination}->${newState.destination}`);

    if (newState.selectionState !== SelectionState.SRCDST) {
	routeSelected = null;
    }

    updateNodeLink();
}


function getSrcPaths(data, state) {
    console.log(`getSrcPaths: highlight ${state.source} to ${state.destination}`)

    let srcPaths = data["paths"][state.source];

    // no path data for this state.source
    if (!srcPaths) {
	console.log(`getSrcPaths: no paths found for src ${state.source}.`);
	srcPaths = Object();
    }

    // selected dst node is not among the paths
    if (state.destination !== null) {
	if (!srcPaths.hasOwnProperty(state.destination)) {
	    console.log(`getSrcPaths: no path from ${state.source} to ${state.destination}`);
	    srcPaths = Object();
	}
    }

    return srcPaths;
}


function drawPaths(pathSegments) {
    const posMap = getPositionsMap();

    pathSegments.forEach((paths,i) => {
	svg.select(`.edges${i}`).selectAll("line").remove();

	svg.select(`.edges${i}`).selectAll("line")
	    .data(paths)
	    .join("line")
	    .style("stroke", function(d) {
		let color = categoryColor(d[2]);
		return color;
	    })
	    .style("stroke-width", PATH_WIDTH)
	    .style("stroke-opacity", PATH_OPACITY)
	    .each(function(d,i) {
		const line = d3.select(this);
		const p1 = posMap.get(d[0]);
		const p2 = posMap.get(d[1]);

		line
		    .classed("edge", true)
		    .attr("x1", xscale(p1[ep_idx[0]]))
		    .attr("y1", yscale(p1[ep_idx[1]]))
		    .attr("x2", xscale(p2[ep_idx[0]]))
		.attr("y2", yscale(p2[ep_idx[1]]));
	    });
    });

}


function highlightPaths(data) {
    const state = getState();
    const routeCategoryState = getRouteCategoryState();

    let plainNodes = new Set(data["nodes"]);
    let sourceNodes = new Set();
    let destinationNodes = new Set();

    // segments for hopcounts 0 and valid 1 - 10 paths
    let pathSegments = [[],[],[],[],[],[],[],[],[],[],[]];

    // unhighlight old paths and highlight new paths. how to identify?
    // 1. lines with class=path are set from data. All lines that are not
    //    class=link are path lines so we can just do a select on the data
    // 2. all nodes thare are on a path should be set with an alternate
    //    class to src/dst/node (maybe?).

    // Need to flatten all of the path links into a set to form as the
    // data over which the d3 select will iterate.
    if (state.selectionState === SelectionState.INITIAL) {
	drawPaths(pathSegments);

	return [sourceNodes, destinationNodes, plainNodes];
    }

    plainNodes.delete(state.source);
    sourceNodes.add(state.source);

    routeSelected = null;

    const srcPaths = getSrcPaths(data, state);

    for (let [pathDst,hops] of Object.entries(srcPaths)) {
	pathDst = Number(pathDst);

	let category = categoryMap.get(state.source+'_'+pathDst);

	if (state.selectionState === SelectionState.SRC) {
	    if (!routeCategoryState.isSelected(category)) {
		continue;
	    }
	} else {
	    // here we'd want to change the category to reflect
	    // the existing one
	    if (pathDst !== state.destination) {
		continue;
	    }
	    routeSelected = [state.source].concat(hops);
	}

	let n1 = state.source;

	const hops_len = Math.min(hops.length, RouteCategory.VALID10);

	for (const n2 of hops) {
	    pathSegments[hops_len].push([n1,n2,category]);
	    n1 = n2;
	}

	plainNodes.delete(Number(pathDst));

	destinationNodes.add(pathDst);
    }

    drawPaths(pathSegments);

    //console.log(`plainNodes.size=${plainNodes.size}`);

    //console.log(`destinationNodes.size=${destinationNodes.size}`);

    return [sourceNodes, destinationNodes, plainNodes];
}


function drawComponents() {
    console.log("drawComponents");

    const ccMap = getPositionsByComponent();
    ccPolygons = []

    for (const [ccNum, positions] of ccMap) {
	const hull = concaveman(positions, CONCAVITY);
	//console.log(`hull: ${hull}`);
	let scaledHull = []
	for (const point of hull) {
	    scaledHull.push(`${xscale(point[ep_idx[0]])}, ${yscale(point[ep_idx[1]])}`)
	}
	//console.log(`scaledHull: ${scaledHull}`);
	ccPolygons.push(scaledHull);
    }

    svg.select(".components").selectAll("polygon")
	.data(ccPolygons)
	.join("polygon")
	.attr("points", function(d,i,map) {return d.join(" ")})
	.classed("cc", true)
}


function drawNodes(sourceNodes, destinationNodes, plainNodes) {
    console.log(`drawNodes`)

    svg.select(".nodes").selectAll("circle")
	.data(getPositionsList())
	.join("circle")
	.attr("id", function(d) {return `n${d[0]}`})
	.attr("cx", function(d) {return xscale(d[pos_idx[0]])})
	.attr("cy", function(d) {return yscale(d[pos_idx[1]])})
	.attr("r", NODE_RADIUS)
	.on('click', onNodeClick);

    for (const pn of plainNodes) {
	decorateNode(pn, "node");
    }

    for (const dn of destinationNodes) {
	decorateNode(dn, "dst");
    }

    for (const sn of sourceNodes) {
	decorateNode(sn, "src");
    }
}


export function onLinksClick(event) {
    console.log("onLinksClick");
    console.log(`checked: ${event.srcElement.checked}`);
    updateNodeLink();
}


export function onComponentsClick(event) {
    console.log("onComponentsClick");
    console.log(`checked: ${event.srcElement.checked}`);
    updateNodeLink();
}


export function updateNodeLink() {
    const dim = myDim(div.node(), NODE_LINK_BORDER, ZERO_PADDING);

    svg.attr("width", dim.width)
	.attr("height", dim.height)

    if (xscale === null || yscale === null) {
	xscale = d3.scaleLinear()
	    .domain([0, lastData['max'][ep_idx[0]]])
	    .range([NODE_LINK_PADDING.left, dim.width-NODE_LINK_PADDING.right]);

	yscale = d3.scaleLinear()
	    .domain([0, lastData['max'][ep_idx[1]]])
	    .range([NODE_LINK_PADDING.top, dim.height-NODE_LINK_PADDING.bottom]);
    }

    const linksChecked = d3.select("#linkscheck").node().checked;
    const componentsChecked = d3.select("#componentscheck").node().checked;

    if (linksChecked) {
	drawPhyLinks();
    } else {
	svg.select(".phylinks").selectAll("line").remove()
    }

    if (componentsChecked) {
	drawComponents();
    } else {
	svg.select(".components").selectAll("polygon").remove()
    }

    const [sourceNodes, plainNodes, destinationNodes] = highlightPaths(lastData);

    drawNodes(sourceNodes, plainNodes, destinationNodes);

    let txtovl = d3.select("#nodelinkdiv").select(".textoverlay");

    txtovl.selectAll("text").remove();

    txtovl.append("text")
	.text("x")
	.attr("fill", TEXT_COLOR)
	.attr("class", "label")
	.attr("transform", `translate(${[dim.width/2.2, dim.height-10]})`)

    txtovl.append("text")
	.text("y")
	.attr("fill", TEXT_COLOR)
	.attr("class", "label")
	.attr("transform", `translate(${[20, dim.height/1.9]}) rotate(270)`)

    if (routeSelected !== null) {
	txtovl.append("text")
	    .text(`route: ${routeSelected.join('-')}`)
	    .attr("fill", TEXT_COLOR)
	    .attr("class", "label")
	    .attr("transform", `translate(${[0.01 * dim.width, dim.height-10]})`)
    }
}


function decorateNode(selected, nodeClass) {
    const selectedId = `#n${selected}`;

    const circle = d3.select(selectedId);

    circle.classed("src dst node", false);

    circle.classed(nodeClass, true);
    //circle.attr("class", nodeClass);

    /*
     Note - attempted to elimimate this code block by putting
     colors into style.css for the three node classes (for example)

       circles.src { fill: #ff9528 };

     but the colors would not change. Something to circle back to.
    */
    if (nodeClass === "src") {
	//console.log(`decorateNode ${selected} ${selectedId} ${nodeClass}`);
	circle
	    .attr("fill", SRC_SELECT_COLOR)
	    .attr("stroke", SRC_BORDER_COLOR)
	    .attr("stroke-width", NODE_BORDER_WIDTH);
    } else if (nodeClass === "dst") {
	//console.log(`decorateNode ${selected} ${selectedId} ${nodeClass}`);
	circle
	    .attr("fill", DST_SELECT_COLOR)
	    .attr("stroke", DST_SELECT_COLOR)
	    .attr("stroke-width", NODE_BORDER_WIDTH);
    } else {
	//console.log(`decorateNode ${selected} ${selectedId} ${nodeClass}`);
	circle
	    .attr("fill", NODE_DEFAULT_COLOR)
	    .attr("stroke", NODE_DEFAULT_COLOR)
	    .attr("stroke-width", NODE_BORDER_WIDTH);
    }
}

function drawPhyLinks() {
    let links = svg.select(".phylinks").selectAll("line");

    const posMap = getPositionsMap();

    if (links.empty()) {
	links.data(lastData["edges"])
	    .enter()
	    .append("line")
	    .style("stroke", PHY_EDGE_COLOR).each(function(e) {
		const line = d3.select(this);
		const p1 = posMap.get(e[0]);
		const p2 = posMap.get(e[1]);

		line
		    .classed("link", true)
		    .attr("x1", xscale(p1[ep_idx[0]]))
		    .attr("y1", yscale(p1[ep_idx[1]]))
		    .attr("x2", xscale(p2[ep_idx[0]]))
		    .attr("y2", yscale(p2[ep_idx[1]]));
	});
    } else {
	links.data(lastData['edges'])
	    .join("line")
	    .style("stroke", PHY_EDGE_COLOR)
	    .each(function(e) {
		const line = d3.select(this);
		const p1 = posMap.get(e[0]);
		const p2 = posMap.get(e[1]);

		line
		    .classed("link", true)
		    .attr("x1", xscale(p1[ep_idx[0]]))
		    .attr("y1", yscale(p1[ep_idx[1]]))
		    .attr("x2", xscale(p2[ep_idx[0]]))
		    .attr("y2", yscale(p2[ep_idx[1]]));
	    });
    }
}


addStateCallback(onStateChange);
addCategoryCallback(onCategoryChange);
