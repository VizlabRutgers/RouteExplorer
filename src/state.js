import {
    RouteCategory,
    RouteCategoryStringMap,
    RouteCategoryValueMap,
    VALID_ROUTE_CATEGORIES
} from "./consts.js";

export let categoryMap = new Map();
export let lastData = {};
export let metrics = [];
export let metrics_by_node = [];
export let rx_packets = [];
export let rx_packets_bounds = [];
export let cc_change_times = [];

export const SelectionState = Object.freeze({
    INITIAL: 0,
    SRC: 1,
    SRCDST: 2
});


class State {
    source = null;
    destination = null;
    selectionState = SelectionState.INITIAL;

    constructor(source, destination) {
	this.source = source;

	if (source === null) {
	    this.destination = null;
	    this.selectionState = SelectionState.INITIAL;
	} else if (destination === null) {
	    this.destination = null;
	    this.selectionState = SelectionState.SRC;
	} else if (typeof(destination) === "number") {
	    this.destination = destination
	    this.selectionState = SelectionState.SRCDST;
	} else {
	    console.log(`Unexpected destination ${destination}`);
	    this.destination === null;
	    this.selectionState = SelectionState.INITIAL;
	}
    };

    equal(source, destination, selectionState) {
	return [this.source === source, this.destination === destination, this.selectionState === selectionState].every((b)=>b);
    }

    sameDst(dst) {
	return this.equal(this.source, destination, this.selectionState);
    }

    sameSrcDst(source, destination) {
	return this.equal(source, destination, this.selectionState);
    }

    selectionState() {
	return this.selectionState;
    };
}


class RouteCategoryState {
    majorCategory = null;
    routeCategories = [];
    minValid = 1;
    maxValid = 10;

    constructor() {
	this.majorCategory = "valid";
	this.routeCategories = VALID_ROUTE_CATEGORIES;
    }

    setMajorCategory(majorCategoryStr) {
	if (majorCategoryStr === this.majorCategory) {
	    return false;
	}

	if (majorCategoryStr === "valid") {
	    this.majorCategory = "valid";

	    this.routeCategories = VALID_ROUTE_CATEGORIES
	} else {
	    this.majorCategory = majorCategoryStr;

	    this.routeCategories = [majorCategoryStr];
	}

	return true;
    }

    setRouteCategory(routeCategoryStr) {
	if (VALID_ROUTE_CATEGORIES.includes(routeCategoryStr)) {
	    if (this.routeCategories.length === 1 && this.routeCategories.includes(routeCategoryStr)) {
		return false;
	    }

	    this.majorCategory = "valid";
	    const routeHops = RouteCategoryStringMap.get(routeCategoryStr);
	    this.minValid = routeHops;
	    this.maxValid = routeHops;

	} else if (this.majorCategory === routeCategoryStr) {
	    // different maor category than valid
	    return false;

	} else {
	    this.majorCategory = routeCategoryStr; // the other categories have same name as major categories
	}

	this.routeCategories = [routeCategoryStr];

	return true;
    }

    setMinValidBound(minValidBound) {
	let newMinValid = Math.min(Math.max(minValidBound, 1), this.maxValid)

	if (newMinValid !== this.minValid) {
	    this.minValid = newMinValid;

	    return this.updateBounds();
	}

	return false;
    }

    setMaxValidBound(maxValidBound) {
	let newMaxValid = Math.max(Math.min(maxValidBound, 10), this.minValid)

	if (newMaxValid !== this.maxValid) {
	    this.maxValid = newMaxValid;
	    return this.updateBounds();
	}

	return false;
    }

    updateBounds() {
	if (!this.majorCategory === "valid") {
	    return false;
	}

	this.routeCategories = [];

	for (let i = this.minValid; i<=this.maxValid; i++) {
	    this.routeCategories.push(`valid${i}`);
	}

	return true;
    }

    log() {
	console.log(`RouteCategory: ${this.majorCategory} ${this.routeCategories.join()} ${this.minValid} ${this.maxValid}`)
    }

    isSelected(routeStateVal) {
	return this.isSelectedStr(RouteCategoryValueMap.get(routeStateVal));
    }

    isSelectedStr(routeStateStr) {
	return this.routeCategories.includes(routeStateStr);
    }

};


let ccMap = new Map();
let posMap = new Map();
let posList = [];
let state = new State(null, null, SelectionState.INITIAL);
let routeCategoryState = new RouteCategoryState();
let srcDstCallbacks = [];
let categoryCallbacks = [];
let timeChangeCallbacks = [];
let tindex=0;



/************************************************************************
  Time State exports
*/
export function updateTimeIndex(new_tindex) {
    if (tindex !== new_tindex) {
	console.log(`updateTimeIndex: tindex:${tindex} new_tindex:${new_tindex}`);
	tindex = new_tindex;

	for (const c of timeChangeCallbacks) {
	    c(tindex);
	}
    }
}

export function getTime() {
    let t = tindex/10;
    return t.toFixed(1);
}

export function incrementTimeIndex() {
    tindex += 1;
    return [tindex, true];
}

export function decrementTimeIndex() {
    if (tindex>0) {
	tindex -= 1;
	return [tindex, true]
    }
    return [tindex,false];
}

export function getTimeIndex() {
    console.log(tindex);
    return tindex;
}

export function addTimeChangeCallback(callback) {
    console.log("addTimeChangeCallback");

    timeChangeCallbacks.push(callback);
}


/************************************************************************
  Selection state functions (Src,Dst,Category)
*/
export function getState() {
    return state;
}

export function setSrc(newSrc) {
    if (newSrc === state.destination) {
	setSrcDst(newSrc, null);
    } else {
	setSrcDst(newSrc, state.destination);
    }
}

export function clearSrc() {
    setSrcDst(null, null);
}

export function setDst(newDst) {
    // can't replace source with single destination.
    if (newDst === state.source) {
	return;
    }
    setSrcDst(state.source, newDst);
}

export function clearDst() {
    setSrcDst(state.source, null);
}

export function setSrcDst(newSrc, newDst) {
    // ignore no change
    if (state.sameSrcDst(newSrc, newDst)) {
	return;
    }

    console.log(`setSrcDst ${state.source}->${newSrc} ${state.destination}->${newDst}`)

    const oldState = state
    state = new State(newSrc, newDst, state.category)

    for (const c of srcDstCallbacks) {
	c(oldState, state);
    }
}


export function getRouteCategoryState() {
    return routeCategoryState;
}



export function setRouteCategory(routeCategoryStr) {
    if (!routeCategoryState.setRouteCategory(routeCategoryStr)) {
	return
    };

    for (const c of categoryCallbacks) {
	c(routeCategoryState);
    }
}


export function setMajorRouteCategory(majorCategoryStr) {
    if (!routeCategoryState.setMajorCategory(majorCategoryStr)) {
	return
    };

    routeCategoryState.log();

    for (const c of categoryCallbacks) {
	c(routeCategoryState);
    }
}


export function setValidBounds(minHops, maxHops) {
    console.log(`setValidBounds ${minHops} ${maxHops}`);
    let minChange = routeCategoryState.setMinValidBound(minHops);
    let maxChange = routeCategoryState.setMaxValidBound(maxHops);

    if (minChange || maxChange) {
	routeCategoryState.log();

	for (const c of categoryCallbacks) {
	    c(routeCategoryState);
	}
    }
}


export function addStateCallback(callback) {
    console.log("addStateCallback");

    srcDstCallbacks.push(callback);
}

export function addCategoryCallback(callback) {
    console.log("addCategoryCallback");

    categoryCallbacks.push(callback);
}


/************************************************************************
 Server data exports
*/
export function setLastData(data) {
    lastData = data;
    //console.log(lastData)
}


export function setMetrics(data) {
    metrics = data.metrics;
    //console.log("metrics");
    //console.log(metrics);

    metrics_by_node = data.metrics_by_node;
    //console.log("metrics_by_node");
    //console.log(metrics_by_node);

    rx_packets = data.rx_packets;
    rx_packets_bounds = data.rx_packets_bounds;
    //console.log("rx_packets");
    //console.log(rx_packets);

    cc_change_times = data.cc_change_times;
    //console.log("cc_change_times");
    //console.log(cc_change_times);
}

export function setPositions(t, data) {
    // positions are organized as a map where keys
    // are the  connected component number and values
    // are an array of the node with its x,y,x position
    posList = [];
    posMap = new Map();
    ccMap = new Map();

    //console.log(data["positions"]);

    for (const [ccNum, positions] of Object.entries(data["positions"])) {
	let cc2DPositions = [];

	for (const [node,x,y,z] of positions) {
	    cc2DPositions.push([x,y]);
	    posMap.set(node, [x,y,z]);
	    posList.push([node,x,y,z]);
	}

	ccMap.set(ccNum, cc2DPositions);
    }
}

export function getPositionsMap() {
    return posMap;
}

export function getPositionsList() {
    return posList;
}

export function getPositionsByComponent() {
    return ccMap;
}
