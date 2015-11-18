var downloadElement, feedbackElement;

var parser = new DOMParser();
var reader = new FileReader();

var charset;
var size;
var file;

var fontName;
var advx, advy;
var parsedGlyphs = [];

/* inputs */

var feedback=function(){};
var resetFeedback=function(){};

window.onload = function() {
    zip.useWebWorkers = false; // waterfox complained that webworkers were insecure

    charset = document.getElementById("charset").value;
    size = document.getElementById("scale").value;
    file = document.getElementById("input-file").files[0];

    downloadElement = document.getElementById("download");
    feedbackElement = document.getElementById("feedback");

    feedback = function(str){feedbackElement.innerHTML=str+"<br>"};
    resetFeedback = function(){feedbackElement.innerHTML=""};
};

function updateCharset(newValue) {
    charset = newValue;
    tryParsingFontFile();
}

function updateSize(newValue) {
    size = newValue;
    console.log("size: "+size);
    tryParsingFontFile();
}

function updateFile(newValue) {
    file = newValue;
    tryParsingFontFile();
}


/* parsing */

function makeSVG(name, unicode, d, transX, transY) {
    return {
        name: name,
        unicode: unicode,
        content: '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n'
                +'\t<path transform="scale('+size+', -'+size+') translate('+transX+','+transY+')"'
                +'d="'+d+'" />\n'
                +'</svg>'
    }
}

function tryParsingFontFile() {
    if(charset!==undefined && size!==undefined) {
        if(charset.length!==0) {
            if(size!=0) {
                resetFeedback();
                if(file!==undefined) {
                    parsedGlyphs = [{name:'space', unicode:' ', content:'<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"></svg>'}];

                    reader.onload = function() {
                        var svg = parser.parseFromString(reader.result, "image/svg+xml");

                        // make a TreeWalker for the <font> elements
                        var tree = svg.createTreeWalker(svg, NodeFilter.ELEMENT_NODE,
                            {
                                acceptNode: function(node) {
                                    if(node.nodeName == "font")
                                        return NodeFilter.FILTER_ACCEPT;
                                    else
                                        return NodeFilter.FILTER_SKIP;
                                }
                            },
                        false);

                        // for each <font>, go through each <glyph> element
                        var efont = tree.nextNode();
                        while(efont !== null) {
                            fontName = efont.id;
                            advx = efont.getAttribute("horiz-adv-x");

                            for(var node = efont.firstChild; node !== null; node = node.nextSibling) {
                                if(node.nodeName == "glyph") {
                                    if(charset.contains(node.getAttribute("unicode")))
                                        parsedGlyphs.push(makeSVG(node.getAttribute("glyph-name"), node.getAttribute("unicode"), node.getAttribute("d"), size*advx/2, -820));
                                }
                            }

                            efont = tree.nextNode();
                        }
                    };
                    reader.readAsBinaryString(file);
                }
            }
            else
                feedback("Size field cannot be zero.");
        }
        else
            feedback("Charset field cannot be empty.")
    }
};

/* saving */

function isReady() {
    if(parsedGlyphs.length == 0) {
        alert("You must complete the other fields first.");
        return false;
    }
    else
        return true;
}

function saveSprite2() {
    if(isReady()) {
        var zipArchive = new zip.fs.FS();
        var spriteJSON =
            '{\n'
            +'\t"objName": "'+fontName+'",\n'
      	    +'\t"variables": [{\n'
            +'\t\t"name": "advx",\n'
            +'\t\t"value": '+advx*size+',\n'
            +'\t\t"isPersistent": false\n'
            +'\t}],\n'
      	    +'\t"costumes": [\n';

        for(var i = 0; i < parsedGlyphs.length; i++) {
            zipArchive.root.addText(i + ".svg", parsedGlyphs[i].content);
            spriteJSON +=
                '\t\t{\n'
        		+'\t\t\t"costumeName": "'+parsedGlyphs[i].unicode+'",\n'
                +'\t\t\t"baseLayerID": '+i+',\n'
                +'\t\t\t"bitmapResolution": 1,\n'
        		+'\t\t\t"rotationCenterX": 0,\n'
        		+'\t\t\t"rotationCenterY": 0\n'
        		+'\t\t},\n';
        }
        spriteJSON +=
            '\t\t],\n'
            +'\t"currentCostumeIndex": 0,\n'
            +'\t"scratchX": 0,\n'
            +'\t"scratchY": 0,\n'
            +'\t"scale": 1,\n'
            +'\t"direction": 90,\n'
            +'\t"rotationStyle": "normal",\n'
            +'\t"isDraggable": false,\n'
            +'\t"indexInLibrary": 100000,\n'
            +'\t"visible": true,\n'
            +'\t"spriteInfo": {\n\t}\n'
            +'}\n';
        spriteJSON = spriteJSON.replace(/\\/, "\\\\");
        zipArchive.root.addText("sprite.json", spriteJSON.replace(/"""/, '"\\""'));

        zipArchive.exportData64URI(function(a) {
            downloadElement.href = a;
            downloadElement.download = fontName + ".sprite2";
            downloadElement.click();
        });
    }
}

function saveZip() {
    if(isReady()) {
        var zipArchive = new zip.fs.FS();
        var uppercaseArchive = zipArchive.root.addDirectory("uppercase");
        var lowercaseArchive = zipArchive.root.addDirectory("lowercase");
        for(var i = 0; i < parsedGlyphs.length; i++) {
            if(parsedGlyphs[i].name.length === 1) {
                if(parsedGlyphs[i].name[0].match(/[a-z]/))
                    lowercaseArchive.addText(parsedGlyphs[i].name + ".svg", parsedGlyphs[i].content);
                else /*if(parsedGlyphs[i].name[0].match(/[A-Z]/))*/
                    uppercaseArchive.addText(parsedGlyphs[i].name + ".svg", parsedGlyphs[i].content);
            }
            else
                zipArchive.root.addText(parsedGlyphs[i].name + ".svg", parsedGlyphs[i].content);
        }
        zipArchive.exportData64URI(function(a) {
            downloadElement.href = a;
            downloadElement.download = fontName + "-svgs.zip";
            downloadElement.click();
        });
    }
}
