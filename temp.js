function exportSceneToHTML() {
    var sceneName = getSceneName(AFRAME.scenes[0]);
    saveString(generateHtml(), sceneName + ".html", 'text/html');
}

function getSceneName(scene) {
    return scene.id || slugify(window.location.host + window.location.pathname);
}

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '-')      // Replace all non-word chars with -
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}


// TODO: remove all external scripts from header, remove canvas, remove divs, empty a-scene attributes

// Create the HTML page
function generateHtml() {
    // flushToDOM first because the elements are posibilly modified by user in Inspector.
    var sceneEl = AFRAME.scenes[0];
    sceneEl.flushToDOM(true);

    var parser = new window.DOMParser();
    var xmlDoc = parser.parseFromString(AFRAME.scenes[0].outerHTML, 'text/html');

    // Remove all the components that are being injected by aframe-inspector or aframe
    var elementsToRemove = xmlDoc.querySelectorAll([
        'script[src$="aframe-inspector.js"]',
        // Injected by the inspector
        // '[data-aframe-inspector]',
        // 'script[src$="aframe-inspector.js"]',
        // 'style[type="text/css"]',
        // 'link[href="http://fonts.googleapis.com/css?family=Roboto%7CRoboto+Mono"]',
        // // Injected by aframe
        // '[aframe-injected]',
        // 'style[data-href$="aframe.css"]',
        // Injected by stats
        // '.rs-base',
        'canvas',
        // 'style[data-href$="rStats.css"]',
        // Injected by h-frame??
    ].join(','));
    for (var i = 0; i < elementsToRemove.length; i++) {
        var el = elementsToRemove[i];
        el.parentNode.removeChild(el);
    }

    var root = xmlDoc.documentElement;
    var sceneTemp = xmlDoc.createElement('a-scene-temp');

    var scene = xmlDoc.getElementsByTagName('a-scene')[0];

    scene.parentNode.replaceChild(sceneTemp, scene);

    var output = xmlToString(xmlDoc)
        .replace('<a-scene-temp></a-scene-temp>', getClipboardRepresentation(sceneEl));


    return output;
}

// Create the String to save

function saveString(text, filename, mimeType) {
    var link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);
    function save(blob, filename) {
        link.href = URL.createObjectURL(blob);
        link.download = filename || 'ascene.html';
        link.click();
    }
    save(new Blob([text], { type: mimeType }), filename);
}

function xmlToString(xmlData) {
    var xmlString;
    // IE
    if (window.ActiveXObject) {
        xmlString = xmlData.xml;
    } else {
        // Mozilla, Firefox, Opera, etc.
        xmlString = (new window.XMLSerializer()).serializeToString(xmlData);
    }
    return xmlString;
}

// Returns the clipboard representation to be used to copy to the clipboard
function getClipboardRepresentation(entity) {
    var clone = prepareForSerialization(entity);
    return clone.outerHTML;
}

// Returns a copy of the DOM hierarchy prepared for serialization.
// The process optimises component representation to avoid values coming from
// primitive attributes, mixins and defaults.
function prepareForSerialization(entity) {
    var clone = entity.cloneNode(false);
    var children = entity.childNodes;
    for (var i = 0, l = children.length; i < l; i++) {
        var child = children[i];
        if (child.nodeType !== Node.ELEMENT_NODE ||
            !child.hasAttribute('aframe-injected') &&
            !child.hasAttribute('data-aframe-inspector') &&
            !child.hasAttribute('data-aframe-canvas')) {
            clone.appendChild(prepareForSerialization(children[i]));
        }
    }
    optimizeComponents(clone, entity);
    return clone;
}

// Removes from copy those components or components' properties that comes from
// primitive attributes, mixins, injected default components or schema defaults.
function optimizeComponents(copy, source) {
    var removeAttribute = HTMLElement.prototype.removeAttribute;
    var setAttribute = HTMLElement.prototype.setAttribute;
    var components = source.components || {};
    Object.keys(components).forEach(function (name) {
        var component = components[name];
        var result = getImplicitValue(component, source);
        var isInherited = result[1];
        var implicitValue = result[0];
        var currentValue = source.getAttribute(name);
        var optimalUpdate = getOptimalUpdate(component, implicitValue, currentValue);
        var doesNotNeedUpdate = optimalUpdate === null;
        if (isInherited && doesNotNeedUpdate) {
            removeAttribute.call(copy, name);
        } else {
            var schema = component.schema;
            var value = stringifyComponentValue(schema, optimalUpdate);
            setAttribute.call(copy, name, value);
        }
    });
}

// Computes the value for a component coming from primitive attributes,
// mixins, primitive defaults, a-frame default components and schema defaults.
// In this specific order.
// In other words, it is the value of the component if the author would have not
// overridden it explicitly.
function getImplicitValue(component, source) {
    var isInherited = false;
    var value = (isSingleProperty(component.schema) ? _single : _multi)();
    return [value, isInherited];

    function _single() {
        var value = getMixedValue(component, null, source);
        if (value === undefined) {
            value = getInjectedValue(component, null, source);
        }
        if (value !== undefined) {
            isInherited = true;
        } else {
            value = getDefaultValue(component, null, source);
        }
        if (value !== undefined) {
            // XXX: This assumes parse is idempotent
            return component.schema.parse(value);
        }
        return value;
    }

    function _multi() {
        var value;

        Object.keys(component.schema).forEach(function (propertyName) {
            var propertyValue = getFromAttribute(component, propertyName, source);
            if (propertyValue === undefined) {
                propertyValue = getMixedValue(component, propertyName, source);
            }
            if (propertyValue === undefined) {
                propertyValue = getInjectedValue(component, propertyName, source);
            }
            if (propertyValue !== undefined) {
                isInherited = isInherited || true;
            } else {
                propertyValue = getDefaultValue(component, propertyName, source);
            }
            if (propertyValue !== undefined) {
                var parse = component.schema[propertyName].parse;
                value = value || {};
                // XXX: This assumes parse is idempotent
                value[propertyName] = parse(propertyValue);
            }
        });

        return value;
    }
}

// `true` if component is single property.
function isSingleProperty(schema) {
    return AFRAME.schema.isSingleProperty(schema);
}

// Gets the value for a component or component's property coming from mixins of
// an element.
// If the component or component's property is not provided by mixins, the
// functions will return `undefined`.
function getMixedValue(component, propertyName, source) {
    var value;
    var reversedMixins = source.mixinEls.reverse();
    for (var i = 0; value === undefined && i < reversedMixins.length; i++) {
        var mixin = reversedMixins[i];
        if (mixin.attributes.hasOwnProperty(component.name)) {
            if (!propertyName) {
                value = mixin.getAttribute(component.name);
            } else {
                value = mixin.getAttribute(component.name)[propertyName];
            }
        }
    }
    return value;
}

// Gets the value for a component or component's property coming from primitive
// defaults or a-frame defaults. In this specific order.
function getInjectedValue(component, propertyName, source) {
    var value;
    var primitiveDefaults = source.defaultComponentsFromPrimitive || {};
    var aFrameDefaults = source.defaultComponents || {};
    var defaultSources = [primitiveDefaults, aFrameDefaults];
    for (var i = 0; value === undefined && i < defaultSources.length; i++) {
        var defaults = defaultSources[i];
        if (defaults.hasOwnProperty(component.name)) {
            if (!propertyName) {
                value = defaults[component.name];
            } else {
                value = defaults[component.name][propertyName];
            }
        }
    }
    return value;
}

// Gets the value for a component or component's property coming from schema
// defaults.
function getDefaultValue(component, propertyName, source) {
    if (!propertyName) {
        return component.schema.default;
    }
    return component.schema[propertyName].default;
}

// Returns the minimum value for a component with an implicit value to equal a
// reference value. A `null` optimal value means that there is no need for an
// update since the implicit value and the reference are equal.
function getOptimalUpdate(component, implicit, reference) {
    if (equal(implicit, reference)) {
        return null;
    }
    if (isSingleProperty(component.schema)) {
        return reference;
    }
    var optimal = {};
    Object.keys(reference).forEach(function (key) {
        var needsUpdate = !equal(reference[key], implicit[key]);
        if (needsUpdate) {
            optimal[key] = reference[key];
        }
    });
    return optimal;
}

function equal(var1, var2) {
    var keys1;
    var keys2;
    var type1 = typeof var1;
    var type2 = typeof var2;
    if (type1 !== type2) { return false; }
    if (type1 !== 'object' || var1 === null || var2 === null) {
        return var1 === var2;
    }
    keys1 = Object.keys(var1);
    keys2 = Object.keys(var2);
    if (keys1.length !== keys2.length) { return false; }
    for (var i = 0; i < keys1.length; i++) {
        if (!equal(var1[keys1[i]], var2[keys2[i]])) { return false; }
    }
    return true;
}

// The string representation of data according to the
// passed component's schema.
function stringifyComponentValue(schema, data) {
    data = typeof data === 'undefined' ? {} : data;
    if (data === null) {
        return '';
    }
    return (isSingleProperty(schema) ? _single : _multi)();

    function _single() {
        return schema.stringify(data);
    }

    function _multi() {
        var propertyBag = {};
        Object.keys(data).forEach(function (name) {
            if (schema[name]) {
                propertyBag[name] = schema[name].stringify(data[name]);
            }
        });
        return AFRAME.utils.styleParser.stringify(propertyBag);
    }
}

// Gets the value for the component's property coming from a primitive
// attribute.
// Primitives have mappings from attributes to component's properties.
// The function looks for a present attribute in the source element which
// maps to the specified component's property.

function getFromAttribute(component, propertyName, source) {
    var value;
    var mappings = source.mappings || {};
    var route = component.name + '.' + propertyName;
    var primitiveAttribute = findAttribute(mappings, route);
    if (primitiveAttribute && source.hasAttribute(primitiveAttribute)) {
        value = source.getAttribute(primitiveAttribute);
    }
    return value;

    function findAttribute(mappings, route) {
        var attributes = Object.keys(mappings);
        for (var i = 0, l = attributes.length; i < l; i++) {
            var attribute = attributes[i];
            if (mappings[attribute] === route) {
                return attribute;
            }
        }
        return undefined;
    }
}
