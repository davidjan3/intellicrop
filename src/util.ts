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

  public static maxIndex<T>(arr: T[], f?: (T) => number): number | undefined {
    if (!arr.length) return undefined;
    let maxIndex = 0;
    let maxVal = f ? f(arr[0]) : arr[0];
    for (let i = 1; i < arr.length; i++) {
      const val = f ? f(arr[i]) : arr[i];
      if (val > maxVal) {
        maxIndex = i;
        maxVal = val;
      }
    }
    return maxIndex;
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

  public static getIntersections(hLines: Line[], vLines: Line[], imgW: number, imgH: number): Pt[] {
    const intersections: Pt[] = [];

    for (const hLine of hLines) {
      for (const vLine of vLines) {
        const cosTheta0 = Math.cos(hLine.theta);
        const sinTheta0 = Math.sin(hLine.theta);
        const cosTheta1 = Math.cos(vLine.theta);
        const sinTheta1 = Math.sin(vLine.theta);

        const denominator = cosTheta0 * sinTheta1 - sinTheta0 * cosTheta1;

        if (denominator !== 0) {
          const x = (sinTheta1 * hLine.rho - sinTheta0 * vLine.rho) / denominator;
          const y = (cosTheta0 * vLine.rho - cosTheta1 * hLine.rho) / denominator;
          if (x > 0 && y > 0 && x < imgW && y < imgH) {
            intersections.push([x, y]);
          }
        }
      }
    }

    return intersections;
  }

  public static getShortestDistance(line: Line, point: Pt): number {
    return Math.abs(point[0] * Math.cos(line.theta) + point[1] * Math.sin(line.theta) - line.rho);
  }

  public static ptClipBounds(pt: Pt, bounds: Pt): Pt {
    return [Math.min(Math.max(pt[0], 0), bounds[0]), Math.min(Math.max(pt[1], 0), bounds[1])];
  }
}
