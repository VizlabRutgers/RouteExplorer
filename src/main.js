import * as d3 from "d3";

import {
    RouteCategoryValueMap,
    categoryColor
} from "./consts.js"

import {
    setMajorRouteCategory,
    addCategoryCallback,
    lastData,
    setLastData,
    metrics,
    setMetrics,
    setPositions,
    setValidBounds,
    getTime,
    getTimeIndex,
    decrementTimeIndex,
    incrementTimeIndex,
    clearSrc,
    addTimeChangeCallback
} from "./state.js";

import {
    onLinksClick,
    onComponentsClick,
    updateNodeLink
} from "./nodelink.js";

import {
    onFilterClick,
    onActiveClick,
    updateMatrix
} from "./matrix.js";

import {
    onLineGraphClick,
    onCCBreaksClick,
    onRxsClick,
    drawLineGraph
} from "./linegraph.js";



function onHopsUpdate(event) {
    setValidBounds(
	d3.select("#minhops").node().value,
	d3.select("#maxhops").node().value
    );
}

function drawLegend() {
    let legend = d3.select("#legend");

    legend.selectAll("g").remove();

    RouteCategoryValueMap;
    categoryColor;

    legend.selectAll("g")
        .data(RouteCategoryValueMap)
        .join("g")
        .each(function(d, i) {
            d3.select(this)
                .append("rect")
                .attr("y", i * 18)
                .attr("height", 15)
                .attr("width", 20)
                .style("fill", categoryColor(d[0]));

            d3.select(this)
                .append("text")
                .attr("y", 13 + i * 18)
                .attr("x", 30)
		.attr("fill", "#cccccc")
		.style("font", "15px sans-serif")
                .text(d[1]);
        });
}


function initAll() {
    const tindex = getTimeIndex();
    const tag = d3.select("#tag").node().value;
    const c = d3.select("#category").node().value;

    console.log(`====== initAll: t=${tindex}`);

    console.log("fetchMetrics");

    d3.json(`metrics`).then(function(data) {
	setMetrics(data);

	d3.json(`positions/${tag}/${tindex}`).then(function(data) {
	    setLastData(data);

	    clearSrc();

	    drawLineGraph(tag);
	    // Initialize the links
	    //console.log(lastData);

	    setPositions(tindex, lastData);

	    updateMatrix(lastData);

	    setMajorRouteCategory(c);

	    updateNodeLink();

	    drawLegend();
	});
    });
}


function drawAll() {
    const tindex = getTimeIndex();
    const tag = d3.select("#tag").node().value;

    console.log(`====== drawAll: t=${tindex}`);

    d3.json(`positions/${tag}/${tindex}`).then(function(data) {
	setLastData(data);

	drawLineGraph(tag);
	// Initialize the links
	//console.log(lastData);

	setPositions(tindex, lastData);

	updateMatrix(lastData);

	updateNodeLink();
    });
}


function onCategoryChange() {
    let c = d3.select("#category").node().value;

    setMajorRouteCategory(c);
}


function onTimeChange(t) {
    drawAll();
}


function onKeyUp(event) {
    let change = false;
    let t = getTime();

    //console.log(event);
    console.log(`onKeyUp t=${t}`);

    if (event.key === "ArrowLeft") {
	[t,change] = decrementTimeIndex();
    } else if (event.key === "ArrowRight") {
	[t,change] = incrementTimeIndex();
    }

    if (change) {
       drawAll();
    }
}


function setCategory(categoryState) {
    console.log(`setCategory ${categoryState.majorCategory} ${categoryState.minValid} ${categoryState.maxValid}`);
    let c = d3.select("#category").node();
    c.value = categoryState.majorCategory;

    let minhops = d3.select("#minhops").node();
    minhops.min = 1;
    minhops.max = categoryState.maxValid;
    minhops.value = categoryState.minValid;

    let maxhops = d3.select("#maxhops").node();
    maxhops.min = categoryState.minValid;
    maxhops.max = 10;
    maxhops.value = categoryState.maxValid;
}


window.onLoad = initAll;
window.drawAll = drawAll;

addCategoryCallback(setCategory);
addTimeChangeCallback(onTimeChange);

d3.select("#timeRange").on("input", () => drawAll());
d3.select("#tag").on("change", () => drawAll());
d3.select("#category").on("change", () => onCategoryChange());
d3.select("#timepaths").on("click", (event) => onLineGraphClick(event));
d3.select("#ccbreakscheck").on("change", (event) => onCCBreaksClick(event));
//d3.select("#rxscheck").on("change", (event) => onRxsClick(event));
d3.select("#filtercheck").on("change", (event) => onFilterClick(event));
d3.select("#activecheck").on("change", (event) => onActiveClick(event));
d3.select("#linkscheck").on("change", (event) => onLinksClick(event));
d3.select("#componentscheck").on("change", (event) => onComponentsClick(event));
d3.select("#minhops").on("change", (event) => onHopsUpdate(event));
d3.select("#maxhops").on("change", (event) => onHopsUpdate(event));
d3.select("body").on("keyup", (event) => onKeyUp(event));
