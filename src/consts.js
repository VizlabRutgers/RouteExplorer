import * as d3 from "d3";

const DEFAULT_MARGIN = 0;
const DEFAULT_PADDING = 0;
const DEFAULT_BORDER = 1;

const MARGIN = {top: DEFAULT_MARGIN, right: DEFAULT_MARGIN, bottom: DEFAULT_MARGIN, left: DEFAULT_MARGIN};
const PADDING = {top: DEFAULT_PADDING, right: DEFAULT_PADDING, bottom: DEFAULT_PADDING, left: DEFAULT_PADDING};
const BORDER = {top: DEFAULT_BORDER, right: DEFAULT_BORDER, bottom: DEFAULT_BORDER, left: DEFAULT_BORDER};

export const ZERO_PADDING = {top:0, right:0, bottom:0, left:0};

export const CONTROLS_MARGIN = MARGIN;
export const CONTROLS_PADDING = PADDING;
export const CONTROLS_BORDER = BORDER;

export const LINE_GRAPH_MARGIN = MARGIN;
export const LINE_GRAPH_PADDING = ZERO_PADDING;
export const LINE_GRAPH_BORDER = BORDER;

export const MATRIX_MARGIN = MARGIN;
export const MATRIX_PADDING = ZERO_PADDING;
export const MATRIX_BORDER = BORDER;

export const NODE_LINK_MARGIN = MARGIN;
export const NODE_LINK_PADDING = ZERO_PADDING;
export const NODE_LINK_BORDER = BORDER;

export const RouteCategory = Object.freeze({
    VALID1: 1,
    VALID2: 2,
    VALID3: 3,
    VALID4: 4,
    VALID5: 5,
    VALID6: 6,
    VALID7: 7,
    VALID8: 8,
    VALID9: 9,
    VALID10: 10,
    LOOP: 11,
    INCOMPLETE: 12,
    BROKEN: 13,
    NOROUTE: 14
});


export const RouteCategoryStringMap = new Map([
    ["valid1", RouteCategory.VALID1],
    ["valid2", RouteCategory.VALID2],
    ["valid3", RouteCategory.VALID3],
    ["valid4", RouteCategory.VALID4],
    ["valid5", RouteCategory.VALID5],
    ["valid6", RouteCategory.VALID6],
    ["valid7", RouteCategory.VALID7],
    ["valid8", RouteCategory.VALID8],
    ["valid9", RouteCategory.VALID9],
    ["valid10", RouteCategory.VALID10],
    ["loop", RouteCategory.LOOP],
    ["incomplete", RouteCategory.INCOMPLETE],
    ["broken", RouteCategory.BROKEN],
    ["noroute", RouteCategory.NOROUTE]
])


export const VALID_ROUTE_CATEGORIES = [
    "valid1", "valid2", "valid3", "valid4", "valid5", "valid6", "valid7", "valid8", "valid9", "valid10"
];


export const RouteCategoryValueMap = new Map([
    [RouteCategory.VALID1, "valid1"],
    [RouteCategory.VALID2, "valid2"],
    [RouteCategory.VALID3, "valid3"],
    [RouteCategory.VALID4, "valid4"],
    [RouteCategory.VALID5, "valid5"],
    [RouteCategory.VALID6, "valid6"],
    [RouteCategory.VALID7, "valid7"],
    [RouteCategory.VALID8, "valid8"],
    [RouteCategory.VALID9, "valid9"],
    [RouteCategory.VALID10, "valid10"],
    [RouteCategory.LOOP, "loop"],
    [RouteCategory.INCOMPLETE, "incomplete"],
    [RouteCategory.BROKEN, "broken"],
    [RouteCategory.NOROUTE, "noroute"]
])


export const categoryColor = d3.scaleOrdinal()
    .domain([
	RouteCategory.VALID1,
	RouteCategory.VALID2,
	RouteCategory.VALID3,
	RouteCategory.VALID4,
	RouteCategory.VALID5,
	RouteCategory.VALID6,
	RouteCategory.VALID7,
	RouteCategory.VALID8,
	RouteCategory.VALID9,
	RouteCategory.VALID10,
	RouteCategory.LOOP,
	RouteCategory.INCOMPLETE,
	RouteCategory.BROKEN,
	RouteCategory.NOROUTE
    ])
    .range([
        "#eba834",'#ffffcc','#ffeda0','#fed976','#feb24c','#fd8d3c','#fc4e2a','#e31a1c','#bd0026','#800026',
	"#000000",
	"#ffffff",
	"#3480eb",
	"#cccccc"
    ]);

export function myDim(node, border, padding) {
    let rect = node.getBoundingClientRect();

    const width = rect.width - border.left - border.right - padding.left - padding.right;
    const height = rect.height - border.top - border.bottom - padding.top - padding.bottom;
    const left = rect.left+border.left+padding.left;
    const top = rect.top + border.top + padding.top;

    const ret = {
	"rect": rect,
	"left": left,
	"right": left+width,
	"top": top,
	"bottom": top+height,
	"width": width,
	"height": height}

    //console.log(`myDim: left:${ret.left} width:${ret.width} right:${ret.right} top:${ret.top} height:${ret.height} bottom:${ret.bottom}`);

    return ret;
}
