import * as cv from "@techstark/opencv-js/";

export type Pt = [number, number];

export interface Corners {
  tl: Pt;
  tr: Pt;
  br: Pt;
  bl: Pt;
}

export interface EdgeCenters {
  t: Pt;
  r: Pt;
  b: Pt;
  l: Pt;
}

export interface ViewCenter {
  c: Pt;
}

export interface Line {
  rho: number;
  theta: number;
}

export default class Util {
  public static loopDiff(n0: number, n1: number, min: number, max: number): number {
    const range = max - min;
    const difference = Math.abs(n0 - n1);
    const loopedDifference = range - difference;
    return Math.min(difference, loopedDifference);
  }

  public static maxIndex<T>(arr: T[], score?: (v: T) => number): number | undefined {
    if (!arr.length) return undefined;
    let maxIndex = 0;
    let maxScore = score ? score(arr[0]) : arr[0];
    for (let i = 1; i < arr.length; i++) {
      const val = score ? score(arr[i]) : arr[i];
      if (val > maxScore) {
        maxIndex = i;
        maxScore = val;
      }
    }
    return maxIndex;
  }

  public static maxValue<T>(arr: T[], score?: (v: T) => number): T | undefined {
    if (!arr.length) return undefined;
    let maxValue = arr[0];
    let maxScore = score ? score(arr[0]) : arr[0];
    for (let i = 1; i < arr.length; i++) {
      const val = score ? score(arr[i]) : arr[i];
      if (val > maxScore) {
        maxValue = arr[i];
        maxScore = val;
      }
    }
    return maxValue;
  }

  public static areaToBounds(area: number, aspectRatio: number): [number, number] {
    const n0 = Math.sqrt(area * aspectRatio);
    const n1 = area / n0;
    return [n0, n1];
  }

  public static ptDiff(pt0: Pt, pt1: Pt): Pt {
    return [pt1[0] - pt0[0], pt1[1] - pt0[1]];
  }

  public static ptDistance(pt0: Pt, pt1: Pt) {
    return Math.sqrt(Math.pow(pt0[0] - pt1[0], 2) + Math.pow(pt0[1] - pt1[1], 2));
  }

  public static ptRelativeDistance(pt: Pt, ptRangeStart: Pt, ptRangeEnd): number {
    const range = this.ptDistance(ptRangeStart, ptRangeEnd);
    const distanceToStart = this.ptDistance(pt, ptRangeStart);
    const distanceToEnd = this.ptDistance(pt, ptRangeEnd);
    const relativeDistance = range === 0 ? 0 : distanceToStart / range;
    const negative = distanceToStart < distanceToEnd && distanceToEnd > range;
    return (negative ? -1 : 1) * relativeDistance;
  }

  public static src2dstPt(srcPt: Pt, src: cv.Mat, dst: cv.Mat): Pt {
    return [srcPt[0] * (dst.cols / src.cols), srcPt[1] * (dst.rows / src.rows)];
  }

  public static closestPoint(line: Line, pt: Pt): Pt {
    const { theta, rho } = line;
    const dx = -Math.sin(theta);
    const dy = Math.cos(theta);
    const ax = rho * dy;
    const ay = -rho * dx;
    const acx = pt[0] - ax;
    const acy = pt[1] - ay;
    const coeff = dx * acx + dy * acy;
    return [ax + dx * coeff, ay + dy * coeff];
  }

  public static lineThrough(pt0: Pt, pt1: Pt): Line {
    const deltaX = pt1[0] - pt0[0];
    const deltaY = pt1[1] - pt0[1];

    return {
      rho: -(deltaY * pt0[0] - deltaX * pt0[1]) / Math.sqrt(deltaX ** 2 + deltaY ** 2),
      theta: Math.atan2(deltaY, deltaX) + Math.PI / 2,
    };
  }

  public static shortestDistance(line: Line, point: Pt): number {
    return Math.abs(point[0] * Math.cos(line.theta) + point[1] * Math.sin(line.theta) - line.rho);
  }

  public static ptWithinBounds(pt: Pt, bounds: Pt): boolean {
    return pt[0] >= 0 && pt[0] < bounds[0] && pt[1] >= 0 && pt[1] < bounds[1];
  }

  public static ptClipBounds(pt: Pt, bounds: [number, number]): Pt {
    return [Math.min(Math.max(pt[0], 0), bounds[0] - 1), Math.min(Math.max(pt[1], 0), bounds[1] - 1)];
  }

  public static ptClipBoundsRect(pt: Pt, bounds: { left: number; right: number; top: number; bottom: number }): Pt {
    return [Math.min(Math.max(pt[0], bounds.left), bounds.right), Math.min(Math.max(pt[1], bounds.top), bounds.bottom)];
  }

  public static mean(arr: number[]) {
    return arr.reduce((a, b) => a + b) / arr.length;
  }

  public static stdDev(arr: number[], mean?: number) {
    mean ??= this.mean(arr);
    return Math.sqrt(arr.map((n) => Math.pow(n - mean, 2)).reduce((a, b) => a + b) / arr.length);
  }

  public static area(corners: Corners) {
    let area = 0;

    const cornerKeys = Object.keys(corners);

    for (let i = 0; i < cornerKeys.length; i++) {
      const key = cornerKeys[i];
      const nextKey = cornerKeys[(i + 1) % cornerKeys.length];
      const corner = corners[key];
      const nextCorner = corners[nextKey];
      area += corner[0] * nextCorner[1] - nextCorner[0] * corner[1];
    }

    return Math.abs(area) / 2;
  }

  public static lineCenter(pt0: Pt, pt1: Pt): Pt {
    return [pt0[0] + (pt1[0] - pt0[0]) / 2, pt0[1] + (pt1[1] - pt0[1]) / 2];
  }

  public static edgeCenters(corners: Corners): EdgeCenters {
    return {
      t: this.lineCenter(corners.tl, corners.tr),
      r: this.lineCenter(corners.tr, corners.br),
      b: this.lineCenter(corners.br, corners.bl),
      l: this.lineCenter(corners.bl, corners.tl),
    };
  }

  public static withinRadius(pt: Pt, targetPt: Pt, targetRadius: number) {
    const x = pt[0];
    const y = pt[1];
    const x0 = targetPt[0] - targetRadius;
    const x1 = targetPt[0] + targetRadius;
    const y0 = targetPt[1] - targetRadius;
    const y1 = targetPt[1] + targetRadius;
    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
  }

  public static cornerCenter(corners: Corners): Pt {
    const { tl, tr, br, bl } = corners;

    const centerX = (tl[0] + tr[0] + br[0] + bl[0]) / 4;
    const centerY = (tl[1] + tr[1] + br[1] + bl[1]) / 4;

    return [centerX, centerY];
  }

  public static rotateKey<T extends object>(o: T, key: string, rotation: number): keyof T {
    const keys = Object.keys(o) as (keyof T)[];
    const newKey = this.rotateVal(
      keys.findIndex((v) => key === v),
      rotation,
      keys.length
    );
    return keys[newKey];
  }

  public static rotateVal(val: number, rotation: number, cutoff: number): number {
    return (((val + rotation) % cutoff) + cutoff) % cutoff;
  }

  public static mapObj<T extends object>(o: T, f: (v: T[keyof T], k: keyof T) => T[keyof T]): T {
    return Object.keys(o).reduce((res, k) => {
      res[k] = f(o[k], k as keyof T);
      return res;
    }, {}) as T;
  }
}
