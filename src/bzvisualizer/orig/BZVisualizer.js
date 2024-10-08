/*

Brillouin zone WebGL Visualizer

Author: Giovanni Pizzi (2016-2017)

License: The MIT License (MIT)

Copyright (c), 2016-2017, ECOLE POLYTECHNIQUE FEDERALE DE LAUSANNE
(Theory and Simulation of Materials (THEOS) and National Centre for
Computational Design and Discovery of Novel Materials (NCCR MARVEL)),
Switzerland.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

2024-03-11 Kristjan Eimre:
    Modernized to fit common build tools & module design (e.g. no implicit
    global variable definitions; adapt to latest three.js; ...)
*/

import * as THREE from "three";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";

var prettifyLabel = function (label, forSVG) {
  forSVG = typeof forSVG !== "undefined" ? forSVG : false;

  // Gamma
  label = label.replace(/GAMMA/gi, "&Gamma;");
  // Delta
  label = label.replace(/DELTA/gi, "&Delta;");
  // Sigma
  label = label.replace(/SIGMA/gi, "&Sigma;");
  // Lambda
  label = label.replace(/LAMBDA/gi, "&Lambda;");
  label = label.replace(/\-/gi, "&mdash;");

  // Underscores
  if (forSVG) {
    label = label.replace(/_(.)/gi, function (match, p1, offset, string) {
      return '<tspan baseline-shift="sub">' + p1 + "</tspan>";
    });
  } else {
    label = label.replace(/_(.)/gi, function (match, p1, offset, string) {
      return "<sub>" + p1 + "</sub>";
    });
  }

  return label;
};

export var BZVisualizer = function (canvasElem, infoElem, params) {
  var canvasElem = canvasElem;
  var infoElem = infoElem;

  if (params == null) {
    params = {};
  }
  // Parse params. If undefined/null, use reasonable defaults.
  var showAxes = params.showAxes ?? true;
  var showBVectors = params.showBVectors ?? true;
  // If you want to show the points of the explicit path
  var showPathpoints = params.showPathpoints ?? false;

  // Disable the "double-click to toggle interaction" overlay
  var disableInteractOverlay = params.disableInteractOverlay ?? false;

  // NOTE: The SVGRenderer (below) is not supported at the moment.
  // When this module was converted to ESM, it didn't seem trivial to migrate
  // the legacy SVGRenderer (as it was included via the <script> tags.)

  // if true, use the SVG renderer rather than the WebGL one
  // Note that it supports less functionality, and it requires an additional
  // dependency (not in the main three.js code, but in examples/js/renderer
  // (both the svg renderer and the projector))
  // This is mainly useful if you want to get a vector image of the BZ
  // rather than a raster screenshot
  // I tried to convert everything I use to work also with SVG (in particular,
  // the text is the trickiest). However, it's much slower.
  // So leave by default to false unless you need to take a screenshot.
  // Known issue: in Firefox, with useSVGRenderer = True, scrolling does not work
  //var useSVGRenderer = params.useSVGRenderer ?? false;
  var useSVGRenderer = false;

  // strings to update
  var to_update = [];

  var bz_material = new THREE.MeshBasicMaterial({
    color: 0xd53e4f,
    opacity: 0.15,
    transparent: true,
    side: THREE.DoubleSide,
  });

  var edge_material = new THREE.LineBasicMaterial({
    color: 0x333333,
    opacity: 1,
    transparent: false,
    linewidth: 1,
  });

  var line_material = new THREE.LineBasicMaterial({
    color: 0x045add,
    opacity: 1,
    transparent: false,
  });

  var point_material = new THREE.MeshBasicMaterial({
    color: 0x3288bd,
    opacity: 1,
    transparent: false,
  });

  var pointpath_material = new THREE.MeshBasicMaterial({
    color: 0x883232,
    opacity: 1,
    transparent: false,
  });

  // need to be global in the current implementation
  var scene = null;
  var camera = null;
  var renderer = null;

  this.resizeRenderer = function () {
    if (canvasElem) {
      var devicePixelRatio = window.devicePixelRatio || 1;

      // current width (in CSS pixels)
      var canvas3d_width = canvasElem.offsetWidth;
      var canvas3d_height = canvasElem.offsetHeight;

      if (renderer) {
        camera.aspect = canvas3d_width / canvas3d_height;
        camera.updateProjectionMatrix();

        // propertly scale dom element *and* renderer to take into account
        // devicePixelRatio (that is e.g. 2 on Retina displays)
        renderer.setSize(
          canvas3d_width * devicePixelRatio,
          canvas3d_height * devicePixelRatio,
        );
        renderer.domElement.style.width = canvas3d_width + "px";
        renderer.domElement.style.height = canvas3d_height + "px";
        renderer.domElement.width = canvas3d_width * devicePixelRatio;
        renderer.domElement.height = canvas3d_height * devicePixelRatio;
        render();
      }
    }
  };

  var getText = function (label, color) {
    color = typeof color !== "undefined" ? color : "#000000";

    if (useSVGRenderer) {
      var textdiv = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      textdiv.setAttribute("y", -100);
      textdiv.setAttribute("x", -100);
      textdiv.setAttribute(
        "font-family",
        "'Helvetica Neue', Helvetica, Arial, sans-serif",
      );
      var devicePixelRatio = window.devicePixelRatio || 1;
      // 12px, but needs to be rescaled with the device pixel ratio
      textdiv.setAttribute("font-size", devicePixelRatio * 12 + "px");
      textdiv.setAttribute("fill", color);
      textdiv.innerHTML = label;
    } else {
      // Return a text div with the given label, and not unselectable
      var textdiv = document.createElement("div");
      textdiv.style.position = "absolute";
      textdiv.style.fontFamily =
        "'Helvetica Neue', Helvetica, Arial, sans-serif";
      //text2.style.zIndex = 1;    // if you still don't see the label, try uncommenting this
      textdiv.style.color = color;
      textdiv.style.width = 100;
      textdiv.style.height = 100;
      textdiv.style.fontSize = "12px";
      //text2.style.backgroundColor = "blue";
      textdiv.innerHTML = label;
      // out of view at the beginning
      textdiv.style.top = -100 + "px";
      textdiv.style.left = -100 + "px";
      textdiv.style.userSelect = "none";
      textdiv.style.userSelect = "none";
      textdiv.style.webkitUserSelect = "none";
      textdiv.style.MozUserSelect = "none";
      textdiv.setAttribute("unselectable", "on");
      textdiv.style.pointerEvents = "none";
    }
    return textdiv;
  };

  var getDoubleClickText = function (the_class) {
    // Return a text div with the given label, and not unselectable
    var textdiv = document.createElement("div");
    textdiv.classList.add(the_class);
    textdiv.style.position = "absolute";
    textdiv.style.fontFamily = "'Helvetica Neue', Helvetica, Arial, sans-serif";
    textdiv.style.zIndex = 1;
    textdiv.style.width = "100%";
    textdiv.style.height = "100%";
    textdiv.style.display = "table";
    textdiv.style.top = "0px";
    textdiv.style.left = "0px";
    textdiv.style.textAlign = "center";
    textdiv.style.verticalAlign = "middle";

    textdiv.style.userSelect = "none";
    textdiv.style.userSelect = "none";
    textdiv.style.webkitUserSelect = "none";
    textdiv.style.MozUserSelect = "none";
    textdiv.setAttribute("unselectable", "on");
    //textdiv.style.pointerEvents = "none";

    var textspan = document.createElement("span");
    // start visible, anyway
    textspan.innerHTML = "Double click to toggle interaction";
    textspan.style.color = "rgb(80, 80, 80)";
    textspan.style.fontSize = "24px";
    textspan.style.fontWeight = "bold";
    textspan.style.backgroundColor = "rgba(230,230,230,0.5)";
    textspan.style.display = "table-cell";
    textspan.style.verticalAlign = "middle";
    textspan.style.lineHeight = "normal";
    textspan.style.userSelect = "none";
    textspan.style.userSelect = "none";
    textspan.style.webkitUserSelect = "none";
    textspan.style.MozUserSelect = "none";
    textspan.setAttribute("unselectable", "on");
    //textspan.style.pointerEvents = "none";

    textspan.onmouseover = function () {
      this.style.backgroundColor = "rgba(230,230,230,0.5)";
      this.innerHTML = "Double click to toggle interaction";
    };
    textspan.onmouseleave = function () {
      // 0.0 for alpha doesn't work properly, apparently
      this.style.backgroundColor = "rgba(255,255,255,0.01)";
      this.innerHTML = "";
    };

    textdiv.appendChild(textspan);

    return textdiv;
  };

  this.loadBZ = function (jsondata) {
    if (jsondata == null) return;
    if (Object.keys(jsondata).length === 0) return;
    if (canvasElem == null) return;
    if (canvasElem.id == "") return;
    if (infoElem == null) return;

    // ----
    // Access jsondata. Objects get drawn depending on what is available

    // Reciprocial lattice: mandatory!
    let b1 = jsondata["b1"];
    let b2 = jsondata["b2"];
    let b3 = jsondata["b3"];

    // draws the BZ polyhedron
    let faces_data = jsondata["faces_data"];

    // draws special kpoint labels and the path
    let special_kpoints = jsondata["kpoints"];
    let kpoints_path = jsondata["path"];

    // draws explicit discrete points on the path
    let explicit_kpoints_abs = jsondata["explicit_kpoints_abs"];

    // ----

    var devicePixelRatio = window.devicePixelRatio || 1;

    infoElem.innerHTML = "";

    var canvas3d = canvasElem;

    // Remove the renderer (and anything else)
    while (canvas3d.firstChild) {
      canvas3d.removeChild(canvas3d.firstChild);
    }
    // I don't need to clear the text divs, I did it in the line above
    // I just need to empty the to_update list
    to_update = [];

    scene = new THREE.Scene();
    let canvas3d_width = canvas3d.offsetWidth;
    let canvas3d_height = canvas3d.offsetHeight;
    camera = new THREE.PerspectiveCamera(
      45,
      canvas3d_width / canvas3d_height,
      0.01,
      1000,
    );
    // If I don't move it, I cannot pan
    camera.position.z = 3;

    //var raycaster = new THREE.Raycaster();

    if (useSVGRenderer) {
      renderer = new THREE.SVGRenderer();
      renderer.setQuality("high");
    } else {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        preserveDrawingBuffer: true, // to allow taking screenshots
        //antialias: true // could be much slower!
      });
    }
    // white bg (not needed if I put alpha = true in WebGL)
    renderer.setClearColor(0xffffff, 0);

    // propertly scale dom element *and* renderer to take into account
    // devicePixelRatio (that is e.g. 2 on Retina displays)
    renderer.setSize(
      canvas3d_width * devicePixelRatio,
      canvas3d_height * devicePixelRatio,
    );
    renderer.domElement.style.width = canvas3d_width + "px";
    renderer.domElement.style.height = canvas3d_height + "px";
    renderer.domElement.width = canvas3d_width * devicePixelRatio;
    renderer.domElement.height = canvas3d_height * devicePixelRatio;

    canvas3d.appendChild(renderer.domElement);

    let controls = new OrbitControls(camera, renderer.domElement);
    controls.addEventListener("change", render); // add this only if there is no animation loop (requestAnimationFrame)
    // needed because we want to redraw only on change
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;

    let max_b_length = Math.sqrt(
      Math.max(
        Math.pow(b1[0], 2) + Math.pow(b1[1], 2) + Math.pow(b1[2], 2),
        Math.pow(b2[0], 2) + Math.pow(b2[1], 2) + Math.pow(b2[2], 2),
        Math.pow(b3[0], 2) + Math.pow(b3[1], 2) + Math.pow(b3[2], 2),
      ),
    );

    var axeslength = max_b_length * 1.5;
    camera.position.z = max_b_length * 3;

    if (showAxes) {
      // AXES
      //var dir = new THREE.Vector3( 1, 0, 0 );
      var axesLabels = [
        [
          new THREE.Vector3(1, 0, 0),
          '<span style="font-style: italic">x</span>',
        ],
        [
          new THREE.Vector3(0, 1, 0),
          '<span style="font-style: italic">y</span>',
        ],
        [
          new THREE.Vector3(0, 0, 1),
          '<span style="font-style: italic">z</span>',
        ],
      ];

      if (useSVGRenderer) {
        axesLabels = [
          [
            new THREE.Vector3(1, 0, 0),
            '<tspan style="font-style: italic">x</tspan>',
          ],
          [
            new THREE.Vector3(0, 1, 0),
            '<tspan style="font-style: italic">y</tspan>',
          ],
          [
            new THREE.Vector3(0, 0, 1),
            '<tspan style="font-style: italic">z</tspan>',
          ],
        ];
      }

      axesLabels.forEach(function (data) {
        var dir = data[0];
        var label = data[1];

        // Arrow
        var origin = new THREE.Vector3(0, 0, 0);
        var hex = 0x555555;
        var arrow = new THREE.ArrowHelper(
          dir,
          origin,
          axeslength,
          hex,
          axeslength / 10,
          axeslength / 20,
        );
        //arrowX.line.material.linewidth = 2;
        scene.add(arrow);

        // Label
        var the_color = "#555555";
        var textdiv = getText(label, the_color);
        var pos = dir.clone();
        pos.sub(origin);
        pos.multiplyScalar(axeslength);

        if (useSVGRenderer) {
          renderer.domElement.appendChild(textdiv);
          to_update.push([pos, label, the_color]);
        } else {
          canvas3d.appendChild(textdiv);
          to_update.push([pos, textdiv]);
        }
      });
    }

    // B vectors
    //var dir = new THREE.Vector3( 1, 0, 0 );
    var b_vectors = [
      [b1, '<span style="font-weight: bold">b</span><sub>1</sub>'],
      [b2, '<span style="font-weight: bold">b</span><sub>2</sub>'],
      [b3, '<span style="font-weight: bold">b</span><sub>3</sub>'],
    ];

    if (useSVGRenderer) {
      var b_vectors = [
        [
          b1,
          '<tspan style="font-weight: bold">b</tspan><tspan baseline-shift="sub">1</tspan>',
        ],
        [
          b2,
          '<tspan style="font-weight: bold">b</tspan><tspan baseline-shift="sub">2</tspan>',
        ],
        [
          b3,
          '<tspan style="font-weight: bold">b</tspan><tspan baseline-shift="sub">3</tspan>',
        ],
      ];
    }

    if (!showBVectors) {
      b_vectors = [];
    }

    b_vectors.forEach(function (data) {
      var b = data[0];
      var label = data[1];

      var b_length = Math.sqrt(
        Math.pow(b[0], 2) + Math.pow(b[1], 2) + Math.pow(b[2], 2),
      );

      var dir = new THREE.Vector3(
        b[0] / b_length,
        b[1] / b_length,
        b[2] / b_length,
      );

      // Arrow
      var origin = new THREE.Vector3(0, 0, 0);
      var hex = 0x000000;
      var arrow = new THREE.ArrowHelper(
        dir,
        origin,
        (length = b_length),
        (hex = hex),
        b_length / 10,
        b_length / 20,
      );
      //arrowX.line.material.linewidth = 2;
      scene.add(arrow);

      // Label
      var textdiv = getText((label = label));
      var pos = dir.clone();
      pos.sub(origin);
      pos.multiplyScalar(b_length);
      if (useSVGRenderer) {
        renderer.domElement.appendChild(textdiv);
        to_update.push([pos, label]);
      } else {
        canvas3d.appendChild(textdiv);
        to_update.push([pos, textdiv]);
      }
    });

    // Draw BZ faces, if present
    if (faces_data) {
      var brillouinzone = new THREE.BufferGeometry();

      var verticesArray = [];
      faces_data["triangles_vertices"].forEach(function (vertex) {
        verticesArray.push(vertex[0], vertex[1], vertex[2]);
      });
      brillouinzone.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(verticesArray, 3),
      );

      var indicesArray = [];
      faces_data["triangles"].forEach(function (triangle) {
        indicesArray.push(triangle[0], triangle[1], triangle[2]);
      });
      brillouinzone.setIndex(indicesArray);

      var bz_mesh = new THREE.Mesh(brillouinzone, bz_material);

      // Create BZ edges
      var edgesGeometry = new THREE.EdgesGeometry(bz_mesh.geometry);
      var edges = new THREE.LineSegments(edgesGeometry, edge_material);
      // Plot BZ and edges
      scene.add(bz_mesh);
      scene.add(edges);
    }

    // Draw special kpoints and labels, if present
    if (special_kpoints) {
      for (var label in special_kpoints) {
        let pos = special_kpoints[label];

        let radius = 0.02 * max_b_length;

        var sphere_geometry = new THREE.SphereGeometry(radius, 16, 16);
        var sphere = new THREE.Mesh(sphere_geometry, point_material);
        sphere.translateX(pos[0]);
        sphere.translateY(pos[1]);
        sphere.translateZ(pos[2]);
        scene.add(sphere);

        // Label
        // prettify label
        label = prettifyLabel(label, useSVGRenderer);
        var textdiv = getText(label);
        if (useSVGRenderer) {
          renderer.domElement.appendChild(textdiv);
          to_update.push([new THREE.Vector3(pos[0], pos[1], pos[2]), label]);
        } else {
          canvas3d.appendChild(textdiv);
          to_update.push([new THREE.Vector3(pos[0], pos[1], pos[2]), textdiv]);
        }
      }
    }

    // Draw kpoints path, if present
    if (kpoints_path && special_kpoints) {
      kpoints_path.forEach(function (linespec) {
        var label1 = linespec[0];
        var label2 = linespec[1];
        var p1 = special_kpoints[label1];
        var p2 = special_kpoints[label2];

        var vertices = [];
        vertices.push(new THREE.Vector3(p1[0], p1[1], p1[2]));
        vertices.push(new THREE.Vector3(p2[0], p2[1], p2[2]));

        var geometry = new THREE.BufferGeometry().setFromPoints(vertices);
        var line = new THREE.Line(geometry, line_material);
        line.material.linewidth = 4;
        scene.add(line);
      });
    }

    if (showPathpoints && explicit_kpoints_abs) {
      for (var idx in explicit_kpoints_abs) {
        var pos = explicit_kpoints_abs[idx];
        var radius = 0.01 * max_b_length;

        var sphere_geometry = new THREE.SphereGeometry(radius, 16, 16);
        var sphere = new THREE.Mesh(sphere_geometry, pointpath_material);
        sphere.translateX(pos[0]);
        sphere.translateY(pos[1]);
        sphere.translateZ(pos[2]);
        scene.add(sphere);
      }
    }

    render();

    var bz_switch_enable = function (event, force_status) {
      if (typeof force_status == "undefined") {
        var the_status = !controls.enabled;
      } else {
        var the_status = force_status;
      }

      controls.enabled = the_status;

      var elems = canvas3d.getElementsByClassName("BZDoubleClickText");
      for (var i = 0; i < elems.length; i++) {
        canvas3d.removeChild(elems[i]);
      }
      if (the_status) {
        //scene.background = new THREE.Color( 0xffffff );
        //render();
      } else {
        //scene.background = new THREE.Color( 0xeeeeee );
        //render();
        canvas3d.appendChild(getDoubleClickText("BZDoubleClickText"));
      }
    };

    if (!disableInteractOverlay) {
      // Default status: disabled
      bz_switch_enable(false);
      canvas3d.addEventListener("dblclick", bz_switch_enable);
    }

    var dbltapTimeout;
    var shortTap = false;

    // Manual detect of double tap
    canvas3d.addEventListener("touchend", function (event) {
      if (typeof dbltapTimeout !== "undefined") {
        // start disabling any timeout that would reset shortTap to false
        clearTimeout(dbltapTimeout);
      }
      if (shortTap) {
        // if here, there's been another tap a few ms before
        // reset the variable and do the custom action
        shortTap = false;
        event.preventDefault();
        bz_switch_enable();
      } else {
        if (event.targetTouches.length != 0) {
          // activate this only when there is only a finger
          // if more than one finger is detected, cancel detection
          // of double tap
          if (typeof dbltapTimeout !== "undefined") {
            // disable the timeout
            clearTimeout(dbltapTimeout);
            shortTap = false;
          }
          return;
        }
        // If we are here, no tap was recently detected
        // mark that a tap just happened, and start a timeout
        // to reset this
        shortTap = true;
        dbltapTimeout = setTimeout(function () {
          // after 500ms, reset shortTap to false
          shortTap = false;
        }, 500);
      }
    });
    canvas3d.addEventListener("touchcancel", function (event) {
      if (typeof dbltapTimeout !== "undefined") {
        // disable the timeout if the touch was canceled
        clearTimeout(dbltapTimeout);
        shortTap = false;
      }
    });
    canvas3d.addEventListener("touchmove", function (event) {
      if (typeof dbltapTimeout !== "undefined") {
        // disable the timeout if the finger is being moved
        clearTimeout(dbltapTimeout);
        shortTap = false;
      }
    });

    // This is useful to print out the SVG for reuse
    /*if (useSVGRenderer) {
        console.log('svg content:');
        console.log(renderer.domElement.outerHTML.replace('/<path/g','\n<path'));
    }*/
  };

  function toScreenPosition(vector3D, camera) {
    var vector2D = vector3D.clone().project(camera);

    var devicePixelRatio = window.devicePixelRatio || 1;
    if (useSVGRenderer) {
      var widthHalf = 0.5 * renderer.domElement.viewBox.baseVal.width;
      var heightHalf = 0.5 * renderer.domElement.viewBox.baseVal.height;
      var widthOffset = renderer.domElement.viewBox.baseVal.x;
      var heightOffset = renderer.domElement.viewBox.baseVal.y;
      vector2D.x = vector2D.x * widthHalf;
      vector2D.y = -(vector2D.y * heightHalf);
    } else {
      var widthHalf = (0.5 * renderer.domElement.width) / devicePixelRatio;
      var heightHalf = (0.5 * renderer.domElement.height) / devicePixelRatio;
      vector2D.x = vector2D.x * widthHalf + widthHalf;
      vector2D.y = -(vector2D.y * heightHalf) + heightHalf;
    }

    return {
      left: vector2D.x,
      top: vector2D.y,
    };
  }

  // render function
  function render() {
    //requestAnimationFrame( render );  // activate only if you want to loop and make an animation
    renderer.render(scene, camera);

    // IMPORTANT! In the case of the SVG renderer, I pass the string, rather
    // than the <div>, and I recreate a new <text> in here. I think this is needed
    // because <text> elements seem to be cleaned up (at least partially) in
    // the render function?

    if (useSVGRenderer) {
      to_update.forEach(function (data) {
        // For SVG we don't use divs for text, but rather
        // <text> elements inside the SVG
        pos = data[0];
        textcontent = data[1];
        if (data.length > 2) {
          the_color = data[2];
          t = getText(textcontent, the_color);
        } else {
          t = getText(textcontent);
        }
        pos2d = toScreenPosition(pos, camera);
        t.setAttribute("y", pos2d.top);
        t.setAttribute("x", pos2d.left);
        renderer.domElement.appendChild(t);
      });
    } else {
      to_update.forEach(function (data) {
        var pos = data[0];
        var text = data[1];
        var pos2d = toScreenPosition(pos, camera);
        text.style.top = pos2d.top + "px";
        text.style.left = pos2d.left + "px";
      });
    }
  }
};
