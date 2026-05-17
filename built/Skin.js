"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Skin = void 0;
const onml = require("onml");
const _ = require("lodash");
var Skin;
(function (Skin) {
    Skin.skin = null;
    function getPortsWithPrefix(template, prefix) {
        const ports = _.filter(template, (e) => {
            try {
                if (e instanceof Array && e[0] === 'g') {
                    return e[1]['s:pid'].startsWith(prefix);
                }
            }
            catch (exception) {
                // Do nothing if the SVG group doesn't have a pin id.
            }
        });
        return ports;
    }
    Skin.getPortsWithPrefix = getPortsWithPrefix;
    function filterPortPids(template, filter) {
        const ports = _.filter(template, (element) => {
            const tag = element[0];
            if (element instanceof Array && tag === 'g') {
                const attrs = element[1];
                return filter(attrs);
            }
            return false;
        });
        return ports.map((port) => {
            return port[1]['s:pid'];
        });
    }
    function getInputPids(template) {
        return filterPortPids(template, (attrs) => {
            if (attrs['s:position']) {
                return attrs['s:position'] === 'top';
            }
            return false;
        });
    }
    Skin.getInputPids = getInputPids;
    function getOutputPids(template) {
        return filterPortPids(template, (attrs) => {
            if (attrs['s:position']) {
                return attrs['s:position'] === 'bottom';
            }
            return false;
        });
    }
    Skin.getOutputPids = getOutputPids;
    function getLateralPortPids(template) {
        return filterPortPids(template, (attrs) => {
            if (attrs['s:dir']) {
                return attrs['s:dir'] === 'lateral';
            }
            if (attrs['s:position']) {
                return attrs['s:position'] === 'left' ||
                    attrs['s:position'] === 'right';
            }
            return false;
        });
    }
    Skin.getLateralPortPids = getLateralPortPids;
    function findSkinType(type) {
        let ret = null;
        onml.traverse(Skin.skin, {
            enter: (node, parent) => {
                if (node.name === 's:alias' && node.attr.val === type) {
                    ret = parent;
                }
            },
        });
        if (ret == null) {
            onml.traverse(Skin.skin, {
                enter: (node) => {
                    if (node.attr['s:type'] === 'generic') {
                        ret = node;
                    }
                },
            });
        }
        return ret.full;
    }
    Skin.findSkinType = findSkinType;
    function getLowPriorityAliases() {
        const ret = [];
        onml.t(Skin.skin, {
            enter: (node) => {
                if (node.name === 's:low_priority_alias') {
                    ret.push(node.attr.value);
                }
            },
        });
        return ret;
    }
    Skin.getLowPriorityAliases = getLowPriorityAliases;
    function getProperties() {
        let vals;
        onml.t(Skin.skin, {
            enter: (node) => {
                if (node.name === 's:properties') {
                    vals = _.mapValues(node.attr, (val) => {
                        if (!isNaN(Number(val))) {
                            return Number(val);
                        }
                        if (val === 'true') {
                            return true;
                        }
                        if (val === 'false') {
                            return false;
                        }
                        return val;
                    });
                }
                else if (node.name === 's:layoutEngine') {
                    vals.layoutEngine = node.attr;
                }
            },
        });
        if (!vals.layoutEngine) {
            vals.layoutEngine = {};
        }
        return vals;
    }
    Skin.getProperties = getProperties;
})(Skin = exports.Skin || (exports.Skin = {}));
exports.default = Skin;
