import { BZVisualizer } from "./orig/BZVisualizer";
export { BZVisualizer };

import "./style.css";

function generateRandomString(length) {
  let result = "";
  while (result.length < length) {
    result += Math.random().toString(36).substring(2);
  }
  return result.substring(0, length);
}

/**
 * Creates the Brillouin zone visualizer inside the specified container
 *
 * NOTE: the specified container should have a width and height defined!
 *
 * @param {*} container - the html container element (e.g. a div)
 * @param {*} seekpathData - data object generated by seekpath
 * @param {*} bzvParams - data object of parameters passed to BZVisualizer
 * @returns {*} The BZVisualizer object (used e.g. in the jupyter widget)
 */
export function createBZVisualizer(container, seekpathData, bzvParams) {
  // make a sub-container that has the correct styling
  let subContainer = document.createElement("div");
  subContainer.className = "bz-main-container";

  // the bz visualizer expects two divs which it will populate:
  // one for "canvas" and one for "info"
  let id = generateRandomString(6);
  let canvasElem = document.createElement("div");
  canvasElem.id = `canvas-${id}`;
  canvasElem.className = "bz-canvas3d";
  let infoElem = document.createElement("div");
  infoElem.id = `info-${id}`;

  subContainer.appendChild(canvasElem);
  subContainer.appendChild(infoElem);

  container.appendChild(subContainer);

  let mainBZVisualizer = new BZVisualizer(canvasElem, infoElem, bzvParams);

  window.addEventListener("resize", mainBZVisualizer.resizeRenderer);

  // Trigger the data loading and THREE.js rendering when the browser
  // requests a frame. This ensures that the containers are all placed
  // in DOM. Otherwise, if the main container is not in DOM, the rendering
  // doesn't work correctly (e.g. because the containers don't have a size yet)
  requestAnimationFrame(() => {
    mainBZVisualizer.loadBZ(seekpathData);
  });

  return mainBZVisualizer;
}
