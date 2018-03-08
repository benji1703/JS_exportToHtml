// TODO: remove all external scripts from header (done),
// remove canvas(done),
// remove divs(done), 
// empty a-scene attributes(done)

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

function generateHtml() {
  var sceneEl = AFRAME.scenes[0];
  var parser = new window.DOMParser();
  var xmlDoc = parser.parseFromString(document.documentElement.innerHTML, 'text/html');
  // Remove all the components that are ;being injected by aframe-inspector or aframe
  var elementsToRemove = xmlDoc.querySelectorAll([
    // Injected by the inspector
    'script[type$="text/javascript"]',                                         // Remove header
    'style[type="text/css"]',
    'div[class$="react-redux-modal"]',
    'span[class$="redux-toastr"]',
    'link[href="https://fonts.googleapis.com/css?family=Nunito+Sans:200,200i,300,300i,400,400i,600,600i,700,700i,800,800i,900,900i"]',  // Remove header
    // // Injected by aframe
    '[aframe-injected]',
    'a',
    'link',
    'span',
    'meta',
  ].join(','));
  for (var i = 0; i < elementsToRemove.length; i++) {
    var el = elementsToRemove[i];
    el.parentNode.removeChild(el);
  }

  // Empty a-scene attributes
  var ascene = xmlDoc.getElementsByTagName('a-scene')[0];
  var eascene = xmlDoc.createElement('a-scene');
  eascene.innerHTML = ascene.innerHTML;
  ascene.parentNode.appendChild(eascene);
  ascene.parentNode.removeChild(ascene);

  // Remove all divs
  y = xmlDoc.getElementsByTagName("div");
  for (i = 0; i < y.length; i++) {
  xmlDoc.documentElement.removeChild(y[i]);
  }
  
  // Inject only a-scene
  ascene.parentNode.appendChild(eascene);

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

function xmlToString(xmlData) {
  var xmlString;
  // IE
  if (window.ActiveXObject) {
    xmlString = xmlData.xml;
  } else {
    // Mozilla, Firefox, Opera, etc.
    xmlString = (new window.XMLSerializer()).serializeToString(xmlData);
  }
  xmlString.replace(/^\s*\n/gm, "\n");
  return xmlString;
}