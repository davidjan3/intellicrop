import * as cv from "@techstark/opencv-js/";

export type Pt = [number, number];

export interface Corners {
  tl: Pt;
  tr: Pt;
  br: Pt;
  bl: Pt;
}

export type Line = {
  rho: number;
  theta: number;
};

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

  public static ptDiff(pt0: Pt, pt1: Pt) {
    return Math.sqrt(Math.pow(pt0[0] - pt1[0], 2) + Math.pow(pt0[1] - pt1[1], 2));
  }

  public static src2dstPt(srcPt: Pt, src: cv.Mat, dst: cv.Mat): Pt {
    return [srcPt[0] * (dst.cols / src.cols), srcPt[1] * (dst.rows / src.rows)];
  }

  public static shortestDistance(line: Line, point: Pt): number {
    return Math.abs(point[0] * Math.cos(line.theta) + point[1] * Math.sin(line.theta) - line.rho);
  }

  public static ptClipBounds(pt: Pt, bounds: Pt): Pt {
    return [Math.min(Math.max(pt[0], 0), bounds[0]), Math.min(Math.max(pt[1], 0), bounds[1])];
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
}
