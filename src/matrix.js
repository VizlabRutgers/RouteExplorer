import * as d3 from "d3";

import {
    ZERO_PADDING,
    MATRIX_BORDER,
    myDim,
    categoryColor,
    RouteCategoryValueMap
} from "./consts.js";

import {
    SelectionState,
    categoryMap,
    getRouteCategoryState,
    getState,
    setSrcDst,
    addCategoryCallback,
    addStateCallback,
    setRouteCategory,
    lastData
} from "./state.js";

const MATRIX_PADDING = {top:0, right:0, bottom:40, left:40};

const CELL_BORDER_COLOR = "black";
const CELL_BORDER_WIDTH = 3;

let currentCellId = null;
let div = d3.select("#matrixdiv");


function onCellClick(e, d, obj) {
    /**
       Toggle the cell and its reverse position in the matrix
       If this is a new cell being turned on, turn off the old ones.
       Highlight the corresponding nodes in the node-link graph and
       teh path between them.
    **/
    const src = d.src;
    const dst = d.dst;

    console.log(`onCellClick current=${currentCellId} src=${d.src} dst=${d.dst} cat={d.category}`);

    if (currentCellId === null) {
	// no cell currently selected
	setSrcDst(src, dst);

    } else {
	const state = getState()

	// toggle cell off if it's the current one
	if (state.sameSrcDst(src,dst)) {
	    setSrcDst(null, null);
	} else {
	    setSrcDst(src, dst)
	}
    }
}


function clearCell() {
    if (currentCellId === null) {
	return;
    }

    const currentCell = d3.select(`#${currentCellId}`);

    currentCell.attr("class", "")
	.style("stroke-width", 0);

    currentCellId = null;
}


function setCell(newCellId) {
    clearCell();

    if (newCellId === null) {
	return;
    }

    console.log(`setCell ${newCellId}`)

    const newCell = d3.select(`#${newCellId}`);

    newCell.attr("class", "cell")
	.style("stroke", CELL_BORDER_COLOR)
	.style("stroke-width", CELL_BORDER_WIDTH);

    currentCellId = newCellId;
}


function onStateChange(oldState, newState) {
    /**
       This function should set cell highlighting dependent on
       the value of src and dst. If src and dst are both numeric
       then highlights a single cell. If only one is selected then
       highlights a row (src) or column (dst). If neither are numeric
       it removes highlighting.

       For first go, just highlight a single cell when both values
       exist.
    **/
    console.log(`matrix onStateChange: ${currentCellId} ${newState.selectionState} ${newState.source} ${newState.destination}`)

    drawMatrix(lastData);

    if (newState.selectionState === SelectionState.SRCDST) {
	const newCellId = `c${newState.source}_${newState.destination}`;

	setCell(newCellId);
    } else {
	clearCell();
    }
}


function onCategoryChange(routeCategoryState) {
    const filter = d3.select("#filtercheck").node().checked;
    const active = d3.select("#activecheck").node().checked;

    if (filter || active) {
	drawMatrix(lastData, active);
    }
}


function drawMatrix(data) {
    let matrix = div.select("#matrix");
    let nodes = data["nodes"];
    let srcDstCatActive = data["src_dst_category_active"];
    let nodeOrder = data["node_order"];

    const margin = 0;
    const dim = myDim(div.node(), MATRIX_BORDER, ZERO_PADDING);

    console.log("dim");
    console.log(dim);

    let tleft = dim.left+margin;
    console.log(tleft);
    matrix.attr("width", dim.width)
	.attr("height", dim.height);

    // Build X scales and axis:
    let x = d3.scaleBand()
	.domain(nodes)
	.range([MATRIX_PADDING.left, dim.width-MATRIX_PADDING.right])
	.padding(0.1);

    // Build X scales and axis:
    let y = d3.scaleBand()
	.domain(nodes)
	.range([MATRIX_PADDING.top, dim.height-MATRIX_PADDING.bottom])
	.padding(0.1);

    let matrixcells = matrix.select("#matrixcells");

    const filter = d3.select("#filtercheck").node().checked;
    const active = d3.select("#activecheck").node().checked;
    const rstate = getRouteCategoryState();
    const state = getState();

    matrixcells.selectAll("rect")
	.data(srcDstCatActive, function(d) {return `c${d.src}_${d.dst}`})
	.join("rect")
    	.attr("id", function(d) { return `c${d.src}_${d.dst}` })
	.attr("y", function(d) { return y(nodeOrder[d.src]) })
	.attr("x", function(d) { return x(nodeOrder[d.dst]) })
	.attr("width", x.bandwidth() )
	.attr("height", y.bandwidth() )
	.style("fill", function(d) {
	    let color = categoryColor(d.category);

	    if (filter || active) {
		if (filter) {
		    if (state.source === null) {
			if (rstate.isSelected(d.category)) {
			    if (active && !d.active) {
				color = "#154472";
			    }
			} else {
			    color = "#154472";
			}
		    } else {
			if(d.src === state.source) {
			    if (active && !d.active) {
				color = "#154472";
			    }
			} else {
			    // off row
			    color = "#154472";
			}
		    }
		} else {
		    if (active && !d.active) {
			color = "#154472";
		    }
		}
	    }

	    return color;
	})
	.each(function(d) {
	    let key = d.src+"_"+d.dst;
	    categoryMap.set(key, d.category);
	})
	.on("click", onCellClick)

    setCell(currentCellId);
}


function updateCcMarkers(data) {
    let matrixccs = div.select("#matrixccs");
    let nodes = data["nodes"];
    const max_node = d3.max(nodes);
    const cc_counts = data.cc_counts;
    const padding = 0.00; // padding isn't handled generally yet, if you change this
                          // the width/height of the marker over their contained cells
                          // is off. need to come up with that equation correctly to make this adjustable.
    const borderwidth = 2.5;

    //console.log("updateCcMarkers cc_counts:");
    //console.log(cc_counts);

    const dim = myDim(div.node(), MATRIX_BORDER, ZERO_PADDING);

    // Build X scales and axis:
    let x = d3.scaleBand()
	.domain(nodes)
	.range([MATRIX_PADDING.left, dim.width-MATRIX_PADDING.right])
	.padding(padding);
    // Build X scales and axis:
    let y = d3.scaleBand()
	.domain(nodes)
	.range([MATRIX_PADDING.top, dim.height-MATRIX_PADDING.bottom])
	.padding(padding);

    matrixccs.selectAll("rect").remove();

    // no frame for a single components
    if (cc_counts.length <= 1) {
	//console.log(`updateCcMarkers remove rectangles only 1 cc`);
	return;
    }

    matrixccs.selectAll("rect")
	.data(cc_counts)
	.join("rect")
	.attr("x", function(d,i) { return x(d3.sum([0].concat(cc_counts.slice(0,i)))) })
	.attr("y", function(d,i) { return y(d3.sum([0].concat(cc_counts.slice(0,i)))) })
	.attr("width", function(d) {return (d===1) ? 0 : d * ((2*padding + x.bandwidth())+padding)})
	.attr("height", function(d) {return (d===1) ? 0 : d * ((2*padding + y.bandwidth())+padding)})
	.style("stroke", "black")
	.style("stroke-width", borderwidth)
	.style("fill-opacity", 0);
}


export function onFilterClick(event) {
    console.log("onFilterClick");
    console.log(`checked: ${event.srcElement.checked}`);
    updateMatrix(lastData);
}


export function onActiveClick(event) {
    console.log("onActiveClick");
    console.log(`checked: ${event.srcElement.checked}`);
    updateMatrix(lastData);
}


export function updateMatrix(data) {
    drawMatrix(data);
    updateCcMarkers(data);

    const dim = myDim(div.node(), MATRIX_BORDER, ZERO_PADDING);

    let txtovl = d3.select("#matrixdiv").select(".textoverlay");

    txtovl.selectAll("text").remove();

    txtovl.append("text")
	.text("destination node")
	.attr("fill", "#cccccc")
	.attr("class", "label")
	.attr("transform", `translate(${[dim.width/2.4, dim.height-20]})`)

    txtovl.append("text")
	.text("source node")
	.attr("fill", "#cccccc")
	.attr("class", "label")
	.attr("transform", `translate(${[30, dim.height/1.8]}) rotate(270)`)
}


addStateCallback(onStateChange);
addCategoryCallback(onCategoryChange);
