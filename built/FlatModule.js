"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeDups = exports.addToDefaultDict = exports.arrayToBitstring = exports.FlatModule = void 0;
const Skin_1 = require("./Skin");
const Cell_1 = require("./Cell");
const _ = require("lodash");
class FlatModule {
    constructor(netlist) {
        this.moduleName = null;
        _.forEach(netlist.modules, (mod, name) => {
            if (mod.attributes && Number(mod.attributes.top) === 1) {
                this.moduleName = name;
            }
        });
        // Otherwise default the first one in the file...
        if (this.moduleName == null) {
            this.moduleName = Object.keys(netlist.modules)[0];
        }
        const top = netlist.modules[this.moduleName];
        const ports = _.map(top.ports, Cell_1.default.fromPort);
        const cells = _.map(top.cells, (c, key) => Cell_1.default.fromYosysCell(c, key));
        this.nodes = cells.concat(ports);
        // populated by createWires
        this.wires = [];
    }
    // converts input ports with constant assignments to constant nodes
    addConstants() {
        // find the maximum signal number
        let maxNum = this.nodes.reduce(((acc, v) => v.maxOutVal(acc)), -1);
        // add constants to nodes
        const signalsByConstantName = {};
        const cells = [];
        this.nodes.forEach((n) => {
            maxNum = n.findConstants(signalsByConstantName, maxNum, cells);
        });
        this.nodes = this.nodes.concat(cells);
    }
    // solves for minimal bus splits and joins and adds them to module
    addSplitsJoins() {
        const allInputs = _.flatMap(this.nodes, (n) => n.inputPortVals());
        const allOutputs = _.flatMap(this.nodes, (n) => n.outputPortVals());
        const allInputsCopy = allInputs.slice();
        const splits = {};
        const joins = {};
        allInputs.forEach((input) => {
            gather(allOutputs, allInputsCopy, input, 0, input.length, splits, joins);
        });
        this.nodes = this.nodes.concat(_.map(joins, (joinOutput, joinInputs) => {
            return Cell_1.default.fromJoinInfo(joinInputs, joinOutput);
        })).concat(_.map(splits, (splitOutputs, splitInput) => {
            return Cell_1.default.fromSplitInfo(splitInput, splitOutputs);
        }));
    }
    // search through all the ports to find all of the wires
    createWires() {
        const layoutProps = Skin_1.default.getProperties();
        const ridersByNet = {};
        const driversByNet = {};
        const lateralsByNet = {};
        this.nodes.forEach((n) => {
            n.collectPortsByDirection(ridersByNet, driversByNet, lateralsByNet, layoutProps.genericsLaterals);
        });
        // list of unique nets
        const nets = removeDups(_.keys(ridersByNet).concat(_.keys(driversByNet)).concat(_.keys(lateralsByNet)));
        const wires = nets.map((net) => {
            const drivers = driversByNet[net] || [];
            const riders = ridersByNet[net] || [];
            const laterals = lateralsByNet[net] || [];
            const wire = { netName: net, drivers, riders, laterals };
            drivers.concat(riders).concat(laterals).forEach((port) => {
                port.wire = wire;
            });
            return wire;
        });
        this.wires = wires;
    }
}
exports.FlatModule = FlatModule;
// returns a string that represents the values of the array of integers
// [1, 2, 3] -> ',1,2,3,'
function arrayToBitstring(bitArray) {
    let ret = '';
    bitArray.forEach((bit) => {
        const sbit = String(bit);
        if (ret === '') {
            ret = sbit;
        }
        else {
            ret += ',' + sbit;
        }
    });
    return ',' + ret + ',';
}
exports.arrayToBitstring = arrayToBitstring;
// returns whether needle is a substring of haystack
function arrayContains(needle, haystack) {
    return (haystack.indexOf(needle) > -1);
}
// returns the index of the string that contains a substring
// given arrhaystack, an array of strings
function indexOfContains(needle, arrhaystack) {
    return _.findIndex(arrhaystack, (haystack) => {
        return arrayContains(needle, haystack);
    });
}
function addToDefaultDict(dict, key, value) {
    if (dict[key] === undefined) {
        dict[key] = [value];
    }
    else {
        dict[key].push(value);
    }
}
exports.addToDefaultDict = addToDefaultDict;
// string (for labels), that represents an index
// or range of indices.
function getIndicesString(bitstring, query, start) {
    const splitStart = _.max([bitstring.indexOf(query), start]);
    const startIndex = bitstring.substring(0, splitStart).split(',').length - 1;
    const endIndex = startIndex + query.split(',').length - 3;
    if (startIndex === endIndex) {
        return String(startIndex);
    }
    else {
        return String(startIndex) + ':' + String(endIndex);
    }
}
// gather splits and joins
function gather(inputs, // all inputs
outputs, // all outputs
toSolve, // an input array we are trying to solve
start, // index of toSolve to start from
end, // index of toSolve to end at
splits, // container collecting the splits
joins) {
    // remove myself from outputs list if present
    const outputIndex = outputs.indexOf(toSolve);
    if (outputIndex !== -1) {
        outputs.splice(outputIndex, 1);
    }
    // This toSolve is compconste
    if (start >= toSolve.length || end - start < 2) {
        return;
    }
    const query = toSolve.slice(start, end);
    // are there are perfect matches?
    if (arrayContains(query, inputs)) {
        if (query !== toSolve) {
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        gather(inputs, outputs, toSolve, end - 1, toSolve.length, splits, joins);
        return;
    }
    const index = indexOfContains(query, inputs);
    // are there any partial matches?
    if (index !== -1) {
        if (query !== toSolve) {
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        // found a split
        addToDefaultDict(splits, inputs[index], getIndicesString(inputs[index], query, 0));
        // we can match to this now
        inputs.push(query);
        gather(inputs, outputs, toSolve, end - 1, toSolve.length, splits, joins);
        return;
    }
    // are there any output matches?
    if (indexOfContains(query, outputs) !== -1) {
        if (query !== toSolve) {
            // add to join
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        // gather without outputs
        gather(inputs, [], query, 0, query.length, splits, joins);
        inputs.push(query);
        return;
    }
    gather(inputs, outputs, toSolve, start, start + query.slice(0, -1).lastIndexOf(',') + 1, splits, joins);
}
function removeDups(inStrs) {
    const map = {};
    inStrs.forEach((str) => {
        map[str] = true;
    });
    return _.keys(map);
}
exports.removeDups = removeDups;
