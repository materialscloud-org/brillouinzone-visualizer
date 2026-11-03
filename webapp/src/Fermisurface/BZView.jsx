import { useEffect, useRef } from "react";
import { BZVisualizer } from "bz-visualizer";
import "bz-visualizer/style.css";

/** The bz-visualizer widget; rebuilt when its inputs change. */
export default function BZView({ seekpath, fermi, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const vis = new BZVisualizer(ref.current, seekpath, fermi ? { fermi } : {});
    return () => vis.dispose();
  }, [seekpath, fermi]);

  return <div ref={ref} className={className} />;
}
