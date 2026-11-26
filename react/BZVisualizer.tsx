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
  LIVE_OPTIONS,
  type BZLiveOptions,
  type BZVisualizerOptions,
  type CameraState,
  type CutPlane,
  type FermiSurfaceData,
  type Matrix,
  type SeekpathJSON,
} from "../src";
import { sameLattice } from "../src/brillouinZone";

export interface BZVisualizerProps extends Omit<BZVisualizerOptions, "fermi"> {
  /** Zone, k-path and k-points (SeeK-path JSON or the same shape). */
  seekpath?: SeekpathJSON;
  /** Band grids for Fermi surfaces, e.g. from `parseBXSF`. */
  fermi?: FermiSurfaceData;
  /** Planes cutting the Fermi surfaces open (see `CutPlane`). */
  cutPlanes?: readonly CutPlane[];
  /** Called when the energy is changed from the built-in controls. */
  onEnergyChange?: (energy: number) => void;
  /**
   * Called after every change of the widget's state (the "statechange"
   * event), including ones made in the Settings panel: read what you need
   * from the widget (`isVisible`, `getColor`, `perspective`, …).
   */
  onStateChange?: (vis: Core) => void;
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

const isLive = (key: string): key is keyof BZLiveOptions =>
  (LIVE_OPTIONS as string[]).includes(key);

/**
 * React wrapper for the bz-visualizer widget. It keeps no state of its own:
 * the widget is the one source of truth, and props are pushed into it.
 *
 * - The options in `LIVE_OPTIONS` are applied to the live widget,
 *   each only when its own value changes; so a choice made in the Settings
 *   panel stays until you change that prop. Any other option (`controls`,
 *   `energyRange`, `fermiOptions`, …) rebuilds the widget from the current
 *   props, keeping the camera if the lattice is the same.
 * - New `seekpath` or `fermi` data on the same lattice (e.g. a different
 *   k-point density, or other band grids) is swapped into the live widget;
 *   a new lattice rebuilds it.
 * - `onStateChange` reports every change, panel ones included; the ref gives
 *   the widget itself, for anything else.
 *
 * Data is compared by identity, so keep it in state or `useMemo`; options
 * are compared by value.
 */
export const BZVisualizer = forwardRef<Core | null, BZVisualizerProps>(
  function BZVisualizer(props, ref) {
    const {
      seekpath,
      fermi,
      onEnergyChange,
      onStateChange,
      className,
      style,
      ...options
    } = props;

    // The options that are not live rebuild the widget when they change
    const shape = Object.entries(options).filter(([key]) => !isLive(key));
    const zone = zoneKey(seekpath, fermi);
    const shapeKey = JSON.stringify(shape);

    const container = useRef<HTMLDivElement>(null);
    // `vis` re-renders on a rebuild; `widget` is the one effects act on
    // (the rebuild effect runs first, so it is never a disposed one)
    const [vis, setVis] = useState<Core | null>(null);
    const widget = useRef<Core | null>(null);
    useImperativeHandle<Core | null, Core | null>(ref, () => vis, [vis]);

    // The latest props, for building the widget and for the callbacks
    const latest = useRef(props);
    useEffect(() => {
      latest.current = props;
    });

    // --- build (or rebuild) the widget ---------------------------------------
    const camera = useRef<{ basis: Matrix; state: CameraState } | null>(null);
    const shown = useRef<Pick<BZVisualizerProps, "seekpath" | "fermi">>({});
    useEffect(() => {
      if (zone === null) return;
      const { seekpath, fermi, cutPlanes, ...options } = latest.current;
      const instance = new Core(container.current!, seekpath, {
        ...options,
        fermi,
      });
      if (cutPlanes?.length) instance.setCutPlanes(cutPlanes);
      const saved = camera.current;
      if (saved && sameLattice(saved.basis, instance.reciprocalBasis))
        instance.viewer.setCameraState(saved.state);

      const onEnergy = (e: Event) =>
        latest.current.onEnergyChange?.(
          (e as CustomEvent<{ energy: number }>).detail.energy,
        );
      const onState = () => latest.current.onStateChange?.(instance);
      instance.element.addEventListener("energychange", onEnergy);
      instance.element.addEventListener("statechange", onState);
      widget.current = instance;
      shown.current = { seekpath, fermi };
      setVis(instance);

      return () => {
        camera.current = {
          basis: instance.reciprocalBasis,
          state: instance.viewer.getCameraState(),
        };
        instance.element.removeEventListener("energychange", onEnergy);
        instance.element.removeEventListener("statechange", onState);
        instance.dispose();
        widget.current = null;
        setVis(null);
      };
    }, [zone, shapeKey]);

    // --- new data on the same lattice: swap it in ----------------------------
    useEffect(() => {
      const v = widget.current;
      if (!v) return;
      if (shown.current.seekpath !== seekpath) v.setSeekpath(seekpath);
      if (shown.current.fermi !== fermi) {
        v.setFermi(fermi);
        // An energy prop is absolute; keep it rather than the offset
        const { energy } = latest.current;
        if (energy !== undefined) v.setEnergy(energy);
      }
      shown.current = { seekpath, fermi };
    }, [vis, seekpath, fermi]);

    // --- live options: one effect each, re-run when its value changes --------
    // Hooks in a loop are safe here: LIVE_OPTIONS is a fixed list, so they
    // are always called in the same order. A rebuild (`vis`) re-applies all.
    for (const key of LIVE_OPTIONS) {
      // A removed cutPlanes prop removes the cuts
      const value =
        key === "cutPlanes" ? (options.cutPlanes ?? []) : options[key];
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useEffect(() => {
        if (value !== undefined) widget.current?.setOptions({ [key]: value });
      }, [vis, JSON.stringify(value)]);
    }

    return <div ref={container} className={className} style={style} />;
  },
);
