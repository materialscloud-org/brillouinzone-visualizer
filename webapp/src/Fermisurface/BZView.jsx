import { BZVisualizer } from "bz-visualizer/react";
import "bz-visualizer/style.css";

/** The bz-visualizer widget, through its React wrapper. */
export default function BZView({ seekpath, fermi, cutPlanes, className = "" }) {
  return (
    <BZVisualizer
      seekpath={seekpath}
      fermi={fermi}
      cutPlanes={cutPlanes}
      className={className}
    />
  );
}
