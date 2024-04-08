import "./style.css";

import { createBZVisualizer } from "./bzvisualizer/main.js";

import jsondata1 from "./example_data/mc3d-10.json";
import jsondata2 from "./example_data/mc3d-10016.json";

createBZVisualizer(document.getElementById("bzvis-1"), jsondata1);

createBZVisualizer(document.getElementById("bzvis-2"), jsondata2, {
  showAxes: false,
  showBVectors: false,
  showPathpoints: true,
  disableInteractOverlay: true,
});
