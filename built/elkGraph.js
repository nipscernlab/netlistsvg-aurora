"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildElkGraph = exports.ElkModel = void 0;
const _ = require("lodash");
var ElkModel;
(function (ElkModel) {
    ElkModel.wireNameLookup = {};
    ElkModel.dummyNum = 0;
    ElkModel.edgeIndex = 0;
})(ElkModel = exports.ElkModel || (exports.ElkModel = {}));
function buildElkGraph(module) {
    const children = module.nodes.map((n) => {
        return n.buildElkChild();
    });
    ElkModel.edgeIndex = 0;
    ElkModel.dummyNum = 0;
    const edges = _.flatMap(module.wires, (w) => {
        const numWires = w.netName.split(',').length - 2;
        // at least one driver and at least one rider and no laterals
        if (w.drivers.length > 0 && w.riders.length > 0 && w.laterals.length === 0) {
            const ret = [];
            route(w.drivers, w.riders, ret, numWires);
            return ret;
            // at least one driver or rider and at least one lateral
        }
        else if (w.drivers.concat(w.riders).length > 0 && w.laterals.length > 0) {
            const ret = [];
            route(w.drivers, w.laterals, ret, numWires);
            route(w.laterals, w.riders, ret, numWires);
            return ret;
            // at least two drivers and no riders
        }
        else if (w.riders.length === 0 && w.drivers.length > 1) {
            // create a dummy node and add it to children
            const dummyId = addDummy(children);
            ElkModel.dummyNum += 1;
            const dummyEdges = w.drivers.map((driver) => {
                const sourceParentKey = driver.parentNode.Key;
                const id = 'e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const d = {
                    id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + driver.key,
                    target: dummyId,
                    targetPort: dummyId + '.p',
                };
                ElkModel.wireNameLookup[id] = driver.wire.netName;
                return d;
            });
            return dummyEdges;
            // at least one rider and no drivers
        }
        else if (w.riders.length > 1 && w.drivers.length === 0) {
            // create a dummy node and add it to children
            const dummyId = addDummy(children);
            ElkModel.dummyNum += 1;
            const dummyEdges = w.riders.map((rider) => {
                const sourceParentKey = rider.parentNode.Key;
                const id = 'e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const edge = {
                    id,
                    source: dummyId,
                    sourcePort: dummyId + '.p',
                    target: sourceParentKey,
                    targetPort: sourceParentKey + '.' + rider.key,
                };
                ElkModel.wireNameLookup[id] = rider.wire.netName;
                return edge;
            });
            return dummyEdges;
        }
        else if (w.laterals.length > 1) {
            const source = w.laterals[0];
            const sourceParentKey = source.parentNode.Key;
            const lateralEdges = w.laterals.slice(1).map((lateral) => {
                const lateralParentKey = lateral.parentNode.Key;
                const id = 'e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const edge = {
                    id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + source.key,
                    target: lateralParentKey,
                    targetPort: lateralParentKey + '.' + lateral.key,
                };
                ElkModel.wireNameLookup[id] = lateral.wire.netName;
                return edge;
            });
            return lateralEdges;
        }
        // for only one driver or only one rider, don't create any edges
        return [];
    });
    return {
        id: module.moduleName,
        children,
        edges,
    };
}
exports.buildElkGraph = buildElkGraph;
function addDummy(children) {
    const dummyId = '$d_' + String(ElkModel.dummyNum);
    const child = {
        id: dummyId,
        width: 0,
        height: 0,
        ports: [{
                id: dummyId + '.p',
                width: 0,
                height: 0,
            }],
        layoutOptions: { 'org.eclipse.elk.portConstraints': 'FIXED_SIDE' },
    };
    children.push(child);
    return dummyId;
}
function route(sourcePorts, targetPorts, edges, numWires) {
    const newEdges = (_.flatMap(sourcePorts, (sourcePort) => {
        const sourceParentKey = sourcePort.parentNode.key;
        const sourceKey = sourceParentKey + '.' + sourcePort.key;
        let edgeLabel;
        if (numWires > 1) {
            edgeLabel = [{
                    id: '',
                    text: String(numWires),
                    width: 4,
                    height: 6,
                    x: 0,
                    y: 0,
                    layoutOptions: {
                        'org.eclipse.elk.edgeLabels.inline': true,
                    },
                }];
        }
        return targetPorts.map((targetPort) => {
            const targetParentKey = targetPort.parentNode.key;
            const targetKey = targetParentKey + '.' + targetPort.key;
            const id = 'e' + ElkModel.edgeIndex;
            const edge = {
                id,
                labels: edgeLabel,
                sources: [sourceKey],
                targets: [targetKey],
            };
            ElkModel.wireNameLookup[id] = targetPort.wire.netName;
            if (sourcePort.parentNode.type !== '$dff') {
                edge.layoutOptions = { 'org.eclipse.elk.layered.priority.direction': 10,
                    'org.eclipse.elk.edge.thickness': (numWires > 1 ? 2 : 1) };
            }
            else {
                edge.layoutOptions = { 'org.eclipse.elk.edge.thickness': (numWires > 1 ? 2 : 1) };
            }
            ElkModel.edgeIndex += 1;
            return edge;
        });
    }));
    edges.push.apply(edges, newEdges);
}
