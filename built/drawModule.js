"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeDummyEdges = void 0;
const elkGraph_1 = require("./elkGraph");
const Skin_1 = require("./Skin");
const _ = require("lodash");
const onml = require("onml");
var WireDirection;
(function (WireDirection) {
    WireDirection[WireDirection["Up"] = 0] = "Up";
    WireDirection[WireDirection["Down"] = 1] = "Down";
    WireDirection[WireDirection["Left"] = 2] = "Left";
    WireDirection[WireDirection["Right"] = 3] = "Right";
})(WireDirection || (WireDirection = {}));
function drawModule(g, module) {
    const nodes = module.nodes.map((n) => {
        const kchild = _.find(g.children, (c) => c.id === n.Key);
        return n.render(kchild);
    });
    removeDummyEdges(g);
    let lines = _.flatMap(g.edges, (e) => {
        const netId = elkGraph_1.ElkModel.wireNameLookup[e.id];
        const numWires = netId.split(',').length - 2;
        const lineStyle = 'stroke-width: ' + (numWires > 1 ? 2 : 1);
        const netName = 'net_' + netId.slice(1, netId.length - 1) + ' width_' + numWires;
        return _.flatMap(e.sections, (s) => {
            let startPoint = s.startPoint;
            s.bendPoints = s.bendPoints || [];
            let bends = s.bendPoints.map((b) => {
                const l = ['line', {
                        x1: startPoint.x,
                        x2: b.x,
                        y1: startPoint.y,
                        y2: b.y,
                        class: netName,
                        style: lineStyle,
                    }];
                startPoint = b;
                return l;
            });
            if (e.junctionPoints) {
                const circles = e.junctionPoints.map((j) => ['circle', {
                        cx: j.x,
                        cy: j.y,
                        r: (numWires > 1 ? 3 : 2),
                        style: 'fill:var(--vscode-foreground)',
                        class: netName,
                    }]);
                bends = bends.concat(circles);
            }
            const line = [['line', {
                        x1: startPoint.x,
                        x2: s.endPoint.x,
                        y1: startPoint.y,
                        y2: s.endPoint.y,
                        class: netName,
                        style: lineStyle,
                    }]];
            return bends.concat(line);
        });
    });
    let labels;
    for (const index in g.edges) {
        if (g.edges.hasOwnProperty(index)) {
            const e = g.edges[index];
            const netId = elkGraph_1.ElkModel.wireNameLookup[e.id];
            const numWires = netId.split(',').length - 2;
            const netName = 'net_' + netId.slice(1, netId.length - 1) +
                ' width_' + numWires +
                ' busLabel_' + numWires;
            if (e.labels !== undefined &&
                e.labels[0] !== undefined &&
                e.labels[0].text !== undefined) {
                const label = [
                    ['rect',
                        {
                            x: e.labels[0].x + 1,
                            y: e.labels[0].y - 1,
                            width: (e.labels[0].text.length + 2) * 6 - 2,
                            height: 9,
                            class: netName,
                            style: 'fill: var(--vscode-editor-background); stroke: none',
                        },
                    ], ['text',
                        {
                            x: e.labels[0].x,
                            y: e.labels[0].y + 7,
                            class: netName,
                        },
                        '/' + e.labels[0].text + '/',
                    ],
                ];
                if (labels !== undefined) {
                    labels = labels.concat(label);
                }
                else {
                    labels = label;
                }
            }
        }
    }
    if (labels !== undefined && labels.length > 0) {
        lines = lines.concat(labels);
    }
    const svgAttrs = Skin_1.default.skin[1];
    svgAttrs.width = g.width.toString();
    svgAttrs.height = g.height.toString();
    const styles = ['style', {}, ''];
    onml.t(Skin_1.default.skin, {
        enter: (node) => {
            if (node.name === 'style') {
                styles[2] += node.full[2];
            }
        },
    });
    const elements = [styles, ...nodes, ...lines];
    const ret = ['svg', svgAttrs, elements.map(e => onml.s(e)).join('')];
    return onml.s(ret);
}
exports.default = drawModule;
function which_dir(start, end) {
    if (end.x === start.x && end.y === start.y) {
        throw new Error('start and end are the same');
    }
    if (end.x !== start.x && end.y !== start.y) {
        throw new Error('start and end arent orthogonal');
    }
    if (end.x > start.x) {
        return WireDirection.Right;
    }
    if (end.x < start.x) {
        return WireDirection.Left;
    }
    if (end.y > start.y) {
        return WireDirection.Down;
    }
    if (end.y < start.y) {
        return WireDirection.Up;
    }
    throw new Error('unexpected direction');
}
function findBendNearDummy(net, dummyIsSource, dummyLoc) {
    const candidates = net.map((edge) => {
        const bends = edge.sections[0].bendPoints || [null];
        if (dummyIsSource) {
            return _.first(bends);
        }
        else {
            return _.last(bends);
        }
    }).filter((p) => p !== null);
    return _.minBy(candidates, (pt) => {
        return Math.abs(dummyLoc.x - pt.x) + Math.abs(dummyLoc.y - pt.y);
    });
}
function removeDummyEdges(g) {
    // go through each edge group for each dummy
    let dummyNum = 0;
    // loop until we can't find an edge group or we hit 10,000
    while (dummyNum < 10000) {
        const dummyId = '$d_' + String(dummyNum);
        // find all edges connected to this dummy
        const edgeGroup = _.filter(g.edges, (e) => {
            return e.source === dummyId || e.target === dummyId;
        });
        if (edgeGroup.length === 0) {
            break;
        }
        let dummyIsSource;
        let dummyLoc;
        const firstEdge = edgeGroup[0];
        if (firstEdge.source === dummyId) {
            dummyIsSource = true;
            dummyLoc = firstEdge.sections[0].startPoint;
        }
        else {
            dummyIsSource = false;
            dummyLoc = firstEdge.sections[0].endPoint;
        }
        const newEnd = findBendNearDummy(edgeGroup, dummyIsSource, dummyLoc);
        for (const edge of edgeGroup) {
            const e = edge;
            const section = e.sections[0];
            if (dummyIsSource) {
                section.startPoint = newEnd;
                if (section.bendPoints) {
                    section.bendPoints.shift();
                }
            }
            else {
                section.endPoint = newEnd;
                if (section.bendPoints) {
                    section.bendPoints.pop();
                }
            }
        }
        // delete junction point if necessary
        const directions = new Set(_.flatMap(edgeGroup, (edge) => {
            const section = edge.sections[0];
            if (dummyIsSource) {
                // get first bend or endPoint
                if (section.bendPoints && section.bendPoints.length > 0) {
                    return [section.bendPoints[0]];
                }
                return section.endPoint;
            }
            else {
                if (section.bendPoints && section.bendPoints.length > 0) {
                    return [_.last(section.bendPoints)];
                }
                return section.startPoint;
            }
        }).map((pt) => {
            if (pt.x > newEnd.x) {
                return WireDirection.Right;
            }
            if (pt.x < newEnd.x) {
                return WireDirection.Left;
            }
            if (pt.y > newEnd.y) {
                return WireDirection.Down;
            }
            return WireDirection.Up;
        }));
        if (directions.size < 3) {
            // remove junctions at newEnd
            edgeGroup.forEach((edge) => {
                if (edge.junctionPoints) {
                    edge.junctionPoints = edge.junctionPoints.filter((junct) => {
                        return !_.isEqual(junct, newEnd);
                    });
                }
            });
        }
        dummyNum += 1;
    }
}
exports.removeDummyEdges = removeDummyEdges;
