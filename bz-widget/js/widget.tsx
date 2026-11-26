import { createRender, useModel, useModelState } from "@anywidget/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  parseBXSF,
  VIEWS,
  type BZVisualizer as Core,
  type BZVisualizerOptions,
  type CameraState,
  type SeekpathJSON,
} from "bz-visualizer";
import { BZVisualizer } from "bz-visualizer/react";
import "bz-visualizer/style.css";

/** The Python BZVisualizer's traits, rendered with the React component. */
function Widget() {
  const model = useModel();
  const [seekpath] = useModelState<SeekpathJSON | null>("seekpath");
  const [bxsf] = useModelState<DataView | null>("bxsf");
  const [energy, setEnergy] = useModelState<number | null>("energy");
  const [, setFermiEnergy] = useModelState<number | null>("fermi_energy");
  const [camera, setCamera] = useModelState<CameraState | null>("camera");
  const [options] = useModelState<BZVisualizerOptions>("options");
  const [height] = useModelState<string>("height");
  const [vis, setVis] = useState<Core | null>(null);

  // The .bxsf file arrives as bytes and is parsed here, once per file
  const fermi = useMemo(() => {
    if (!bxsf) return {};
    try {
      return { data: parseBXSF(new TextDecoder().decode(bxsf)) };
    } catch (e) {
      return { error: String(e) };
    }
  }, [bxsf]);

  // Tell Python the Fermi energy, and start `energy` there if it is unset
  useEffect(() => {
    const EF = fermi.data?.fermiEnergy ?? null;
    setFermiEnergy(EF);
    if (EF !== null && model.get("energy") == null) setEnergy(EF);
  }, [fermi.data]);

  // Camera: report it after the user moves it; apply `view` messages. A new
  // widget starts from Python's camera; after a rebuild, Python gets the new one.
  const visRef = useRef<Core | null>(null);
  const first = useRef(true);
  useEffect(() => {
    visRef.current = vis;
    if (!vis) return;
    const { viewer } = vis;
    const report = () => setCamera(viewer.getCameraState());
    const saved = model.get("camera");
    if (first.current && saved) viewer.setCameraState(saved);
    else report();
    first.current = false;

    // Clicks catch the built-in camera buttons, which bypass the controls
    const onClick = () => requestAnimationFrame(report);
    const onMessage = (msg: { type?: string; direction?: string }) => {
      if (msg.type !== "view") return;
      if (msg.direction === "reset") viewer.fit();
      else viewer.fit(viewer.content, VIEWS[msg.direction as "x" | "y" | "z"]);
      report();
    };
    viewer.controls.addEventListener("end", report);
    vis.element.addEventListener("click", onClick);
    model.on("msg:custom", onMessage);
    return () => {
      viewer.controls.removeEventListener("end", report);
      vis.element.removeEventListener("click", onClick);
      model.off("msg:custom", onMessage);
    };
  }, [vis]);

  // A camera set from Python (our own reports match and are skipped)
  const cameraKey = JSON.stringify(camera);
  useEffect(() => {
    const viewer = visRef.current?.viewer;
    if (camera && viewer && JSON.stringify(viewer.getCameraState()) !== cameraKey)
      viewer.setCameraState(camera);
  }, [cameraKey]);

  if (fermi.error) return <pre style={{ color: "crimson" }}>{fermi.error}</pre>;
  if (!seekpath && !fermi.data) return <div>No data.</div>;
  return (
    <BZVisualizer
      {...options}
      ref={setVis}
      seekpath={seekpath ?? undefined}
      fermi={fermi.data}
      energy={energy ?? undefined}
      onEnergyChange={setEnergy}
      style={{ height }}
    />
  );
}

export default { render: createRender(Widget) };
