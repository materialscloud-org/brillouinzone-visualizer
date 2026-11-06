import { useEffect, useRef } from "react";
import { BZVisualizer } from "bz-visualizer";
import "bz-visualizer/style.css";

/**
 * The bz-visualizer widget; rebuilt when its inputs change. Cut planes are
 * applied to the live widget instead.
 */
export default function BZView({ seekpath, fermi, cutPlanes, className = "" }) {
  const ref = useRef(null);
  const vis = useRef(null);

  useEffect(() => {
    vis.current = new BZVisualizer(
      ref.current,
      seekpath,
      fermi ? { fermi } : {},
    );
    return () => {
      vis.current.dispose();
      vis.current = null;
    };
  }, [seekpath, fermi]);

  // Also re-applied after a rebuild, which runs the effect above first
  useEffect(() => {
    vis.current?.setCutPlanes(cutPlanes ?? []);
  }, [cutPlanes, seekpath, fermi]);

  return <div ref={ref} className={className} />;
}
