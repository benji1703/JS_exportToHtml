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

function generateHtml () {
    var sceneEl = AFRAME.scenes[0];
    var parser = new window.DOMParser();
    var xmlDoc = parser.parseFromString(document.documentElement.innerHTML, 'text/html');
    // Remove all the components that are being injected by aframe-inspector or aframe
    var elementsToRemove = xmlDoc.querySelectorAll([
      // Injected by the inspector
      '[data-aframe-inspector]',
      'script[src$="aframe-inspector.js"]',
      'style[type="text/css"]',
      'link[href="http://fonts.googleapis.com/css?family=Roboto%7CRoboto+Mono"]',
      // Injected by aframe
      '[aframe-injected]',
      'style[data-href$="aframe.css"]',
      // Injected by stats
      '.rs-base',
      '.a-canvas',
      'style[data-href$="rStats.css"]'
    ].join(','));
    for (var i = 0; i < elementsToRemove.length; i++) {
      var el = elementsToRemove[i];
      el.parentNode.removeChild(el);
    }
  
    var root = xmlDoc.documentElement;
    var scene = xmlDoc.getElementsByTagName('a-scene')[0];
  
    var output = xmlToString(xmlDoc)
    return output;
  }

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

function xmlToString (xmlData) {
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