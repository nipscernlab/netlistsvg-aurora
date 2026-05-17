"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Port = void 0;
const Cell_1 = require("./Cell");
const _ = require("lodash");
class Port {
    constructor(key, value) {
        this.key = key;
        this.value = value;
    }
    get Key() {
        return this.key;
    }
    keyIn(pids) {
        return _.includes(pids, this.key);
    }
    maxVal() {
        return _.max(_.map(this.value, (v) => Number(v)));
    }
    valString() {
        return ',' + this.value.join() + ',';
    }
    findConstants(sigsByConstantName, maxNum, constantCollector) {
        let constNameCollector = '';
        let constNumCollector = [];
        const portSigs = this.value;
        portSigs.forEach((portSig, portSigIndex) => {
            // is constant?
            if (portSig === '0' || portSig === '1') {
                maxNum += 1;
                constNameCollector += portSig;
                // replace the constant with new signal num
                portSigs[portSigIndex] = maxNum;
                constNumCollector.push(maxNum);
                // string of constants ended before end of p.value
            }
            else if (constNumCollector.length > 0) {
                this.assignConstant(constNameCollector, constNumCollector, portSigIndex, sigsByConstantName, constantCollector);
                // reset name and num collectors
                constNameCollector = '';
                constNumCollector = [];
            }
        });
        if (constNumCollector.length > 0) {
            this.assignConstant(constNameCollector, constNumCollector, portSigs.length, sigsByConstantName, constantCollector);
        }
        return maxNum;
    }
    getGenericElkPort(index, templatePorts, dir) {
        const nkey = this.parentNode.Key;
        const type = this.parentNode.getTemplate()[1]['s:type'];
        if (index === 0) {
            const ret = {
                id: nkey + '.' + this.key,
                width: 1,
                height: 1,
                x: Number(templatePorts[0][1]['s:x']),
                y: Number(templatePorts[0][1]['s:y']),
            };
            if ((type === 'generic' || type === 'join') && dir === 'in') {
                ret.labels = [{
                        id: nkey + '.' + this.key + '.label',
                        text: this.key,
                        x: Number(templatePorts[0][2][1].x) - 10,
                        y: Number(templatePorts[0][2][1].y) - 6,
                        width: (6 * this.key.length),
                        height: 11,
                    }];
            }
            if ((type === 'generic' || type === 'split') && dir === 'out') {
                ret.labels = [{
                        id: nkey + '.' + this.key + '.label',
                        text: this.key,
                        x: Number(templatePorts[0][2][1].x) - 10,
                        y: Number(templatePorts[0][2][1].y) - 6,
                        width: (6 * this.key.length),
                        height: 11,
                    }];
            }
            return ret;
        }
        else {
            const gap = Number(templatePorts[1][1]['s:y']) - Number(templatePorts[0][1]['s:y']);
            const ret = {
                id: nkey + '.' + this.key,
                width: 1,
                height: 1,
                x: Number(templatePorts[0][1]['s:x']),
                y: (index) * gap + Number(templatePorts[0][1]['s:y']),
            };
            if (type === 'generic') {
                ret.labels = [{
                        id: nkey + '.' + this.key + '.label',
                        text: this.key,
                        x: Number(templatePorts[0][2][1].x) - 10,
                        y: Number(templatePorts[0][2][1].y) - 6,
                        width: (6 * this.key.length),
                        height: 11,
                    }];
            }
            return ret;
        }
    }
    assignConstant(nameCollector, constants, currIndex, signalsByConstantName, constantCollector) {
        // we've been appending to nameCollector, so reverse to get const name
        const constName = nameCollector.split('').reverse().join('');
        // if the constant has already been used
        if (signalsByConstantName.hasOwnProperty(constName)) {
            const constSigs = signalsByConstantName[constName];
            // go back and fix signal values
            const constLength = constSigs.length;
            constSigs.forEach((constSig, constIndex) => {
                // i is where in port_signals we need to update
                const i = currIndex - constLength + constIndex;
                this.value[i] = constSig;
            });
        }
        else {
            constantCollector.push(Cell_1.default.fromConstantInfo(constName, constants));
            signalsByConstantName[constName] = constants;
        }
    }
}
exports.Port = Port;
