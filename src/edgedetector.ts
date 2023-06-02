import * as cv from "@techstark/opencv-js/";
import { Corners, Pt } from "./cropper";

type Line = {
  rho: number;
  theta: number;
};

export default class EdgeDetector {
  private static readonly RHO_THRES = 0.5;
  private static readonly THETA_THRES = 0.33 * Math.PI;

  static detect(src: cv.Mat): Corners | undefined {
    let dst: cv.Mat = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC3);
    const linesArr = new cv.Mat();
    const bounds = this.areaToBounds(100000, src.cols / src.rows);

    cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
    cv.resize(dst, dst, new cv.Size(...bounds));
    cv.Canny(dst, dst, 160, 160, 3, true);
    cv.HoughLines(dst, linesArr, 1, Math.PI / 180, 80, 0, 0, 0, Math.PI);
    dst = src.clone();

    const lines: Line[] = [];
    // draw lines
    for (let i = 0; i < linesArr.rows; i++) {
      let rho = linesArr.data32F[i * 2];
      let theta = linesArr.data32F[i * 2 + 1];

      if (
        i === 0 ||
        !lines.some(
          (l) =>
            Math.abs(rho - l.rho) < this.RHO_THRES * linesArr.rows &&
            this.loopDiff(theta, l.theta, 0, Math.PI) < this.THETA_THRES
        )
      ) {
        lines.push({ rho, theta });
      }
    }

    const intersections = this.getIntersections(lines);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const rho = line.rho * (src.cols / bounds[0]);
      const theta = line.theta;
      let a = Math.cos(theta);
      let b = Math.sin(theta);
      let x0 = a * rho;
      let y0 = b * rho;
      let startPoint = { x: x0 - 10000 * b, y: y0 + 10000 * a };
      let endPoint = { x: x0 + 10000 * b, y: y0 - 10000 * a };
      cv.line(dst, startPoint, endPoint, [255 * (i / lines.length), 255 - 255 * (i / lines.length), 127, 255], 4);
    }

    for (let i = 0; i < intersections.length; i++) {
      const intersection = intersections[i];
      cv.circle(
        dst,
        new cv.Point(intersection[0] * (src.cols / bounds[0]), intersection[1] * (src.cols / bounds[0])),
        20,
        [255 * (i / intersections.length), 255 - 255 * (i / intersections.length), 127, 255],
        4
      );
    }
    cv.imshow("the-other-canvas", dst);

    return { tl: [0, 0], tr: [0, 0], bl: [0, 0], br: [0, 0] };
  }

  private static loopDiff(n0: number, n1: number, min: number, max: number): number {
    const range = max - min;
    const difference = Math.abs(n0 - n1);
    const loopedDifference = range - difference;
    return Math.min(difference, loopedDifference);
  }

  private static areaToBounds(area: number, aspectRatio: number): [number, number] {
    const n0 = Math.sqrt(area * aspectRatio);
    const n1 = area / n0;
    return [n0, n1];
  }

  private static getIntersections(lines: Line[]): Pt[] {
    const intersections: Pt[] = [];

    for (let i = 0; i < lines.length - 1; i++) {
      const l0 = lines[i];

      for (let j = i + 1; j < lines.length; j++) {
        const l1 = lines[j];

        const cosTheta0 = Math.cos(l0.theta);
        const sinTheta0 = Math.sin(l0.theta);
        const cosTheta1 = Math.cos(l1.theta);
        const sinTheta1 = Math.sin(l1.theta);

        const denominator = cosTheta0 * sinTheta1 - sinTheta0 * cosTheta1;

        if (denominator !== 0) {
          const x = (sinTheta1 * l0.rho - sinTheta0 * l1.rho) / denominator;
          const y = (cosTheta0 * l1.rho - cosTheta1 * l0.rho) / denominator;
          intersections.push([x, y]);
        }
      }
    }

    return intersections;
  }
}
