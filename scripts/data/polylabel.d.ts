declare module "polylabel" {
  /** Pole of inaccessibility of a polygon given as rings of [x, y]; the result has `distance`. */
  export default function polylabel(
    polygon: number[][][],
    precision?: number,
    debug?: boolean,
  ): number[] & { distance: number };
}
