import {
  type CSSProperties,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import {
  BZVisualizer as Core,
  sameLattice,
  type BZVisualizerOptions,
  type CameraState,
  type CutPlane,
  type FermiSurfaceData,
  type Matrix,
  type SeekpathJSON,
} from "../src";

export interface BZVisualizerProps extends Omit<BZVisualizerOptions, "fermi"> {
  /** Zone, k-path and k-points (SeeK-path JSON or the same shape). */
  seekpath?: SeekpathJSON;
  /** Band grids for Fermi surfaces, e.g. from `parseBXSF`. */
  fermi?: FermiSurfaceData;
  /** Planes cutting the Fermi surfaces open (see `CutPlane`). */
  cutPlanes?: readonly CutPlane[];
  /** Called when the energy is changed from the built-in controls. */
  onEnergyChange?: (energy: number) => void;
  /** For the container, which needs a height. */
  className?: string;
  style?: CSSProperties;
}

/** The reciprocal lattice that defines the zone: the band data's, else the k-path's. */
function zoneKey(seekpath?: SeekpathJSON, fermi?: FermiSurfaceData) {
  if (fermi) return JSON.stringify(Array.from(fermi.reciprocalBasis.data));
  if (seekpath) return JSON.stringify([seekpath.b1, seekpath.b2, seekpath.b3]);
  return null;
}

/**
 * React wrapper for the bz-visualizer widget.
 *
 * - New `seekpath` or `fermi` data on the same lattice (e.g. a different
 *   k-point density, or other band grids) is swapped into the live widget.
 *   A new lattice, or a change to an option that shapes the widget
 *   (`controls`, `energyRange`, `fermiOptions`, …), rebuilds it; the camera
 *   is kept if the lattice is the same.
 * - `energy`, `cutPlanes`, `colors`, `widths` and the `show*`/`foldKPoints` flags are
 *   applied to the live widget, and the settings panel follows them.
 * - The ref gives the widget itself, for anything else (`setOpacity`,
 *   `viewer.getCameraState()`, …).
 *
 * Data is compared by identity, so keep it in state or `useMemo`; `colors`,
 * `cutPlanes` and the other options are compared by value.
 */
export const BZVisualizer = forwardRef<Core | null, BZVisualizerProps>(
  function BZVisualizer(props, ref) {
    const {
      seekpath,
      fermi,
      cutPlanes,
      onEnergyChange,
      className,
      style,
      ...options
    } = props;
    const {
      energy,
      showAxes,
      axisLength,
      showBVectors,
      showKPath,
      showKPoints,
      showPathpoints,
      foldKPoints,
      showLabels,
      colors,
      widths,
      ...shape
    } = options;
    const zone = zoneKey(seekpath, fermi);
    const shapeKey = JSON.stringify(shape);
    // The live options; a removed cutPlanes prop removes the cuts
    const liveKey = JSON.stringify({
      showAxes,
      axisLength,
      showBVectors,
      showKPath,
      showKPoints,
      showPathpoints,
      foldKPoints,
      showLabels,
      colors,
      widths,
      cutPlanes: cutPlanes ?? [],
    });

    const container = useRef<HTMLDivElement>(null);
    // `vis` re-renders on a rebuild; `live` is the widget effects act on
    // (the rebuild effect runs first, so it is never a disposed one)
    const [vis, setVis] = useState<Core | null>(null);
    const live = useRef<Core | null>(null);
    useImperativeHandle<Core | null, Core | null>(ref, () => vis, [vis]);

    // The latest props, for building the widget and for the callback
    const latest = useRef({ props, options });
    useEffect(() => {
      latest.current = { props, options };
    });

    // Build (or rebuild) the widget
    const camera = useRef<{ basis: Matrix; state: CameraState } | null>(null);
    const shown = useRef<Pick<BZVisualizerProps, "seekpath" | "fermi">>({});
    useEffect(() => {
      if (zone === null) return;
      const { props, options } = latest.current;
      const { seekpath, fermi, cutPlanes } = props;
      const instance = new Core(container.current!, seekpath, {
        ...options,
        fermi,
      });
      if (cutPlanes?.length) instance.setCutPlanes(cutPlanes);
      const saved = camera.current;
      if (saved && sameLattice(saved.basis, instance.reciprocalBasis))
        instance.viewer.setCameraState(saved.state);

      const onEnergy = (e: Event) =>
        latest.current.props.onEnergyChange?.(
          (e as CustomEvent<{ energy: number }>).detail.energy,
        );
      instance.element.addEventListener("energychange", onEnergy);
      live.current = instance;
      shown.current = { seekpath, fermi };
      setVis(instance);

      return () => {
        camera.current = {
          basis: instance.reciprocalBasis,
          state: instance.viewer.getCameraState(),
        };
        instance.element.removeEventListener("energychange", onEnergy);
        instance.dispose();
        live.current = null;
        setVis(null);
      };
    }, [zone, shapeKey]);

    // New data on the same lattice: swap it in
    useEffect(() => {
      const v = live.current;
      if (!v) return;
      if (shown.current.seekpath !== seekpath) v.setSeekpath(seekpath);
      if (shown.current.fermi !== fermi) {
        v.setFermi(fermi);
        // An energy prop is absolute; keep it rather than the offset
        const { energy } = latest.current.options;
        if (energy !== undefined) v.setEnergy(energy);
      }
      shown.current = { seekpath, fermi };
    }, [vis, seekpath, fermi]);

    // Live settings (also re-applied after a rebuild, which is harmless)
    useEffect(() => {
      if (energy !== undefined) live.current?.setEnergy(energy);
    }, [vis, energy]);
    useEffect(() => {
      live.current?.setOptions(JSON.parse(liveKey));
    }, [vis, liveKey]);

    return <div ref={container} className={className} style={style} />;
  },
);
