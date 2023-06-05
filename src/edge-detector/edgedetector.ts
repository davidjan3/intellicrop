import * as cv from "@techstark/opencv-js/";
import Util, { Line } from "../util";

type ScoredLine = Line & { score: number };

export default class EdgeDetector {
  private static readonly RHO_THRES = 0.5;
  private static readonly THETA_THRES = 5 * (Math.PI / 180);
  private static readonly MAX_TILT = 45 * (Math.PI / 180);

  static detect(src: cv.Mat, debugCanvas?: HTMLCanvasElement): Corners | undefined {
    const srcW = src.cols;
    const srcH = src.rows;
    const corners: Corners = { tl: [0, 0], tr: [srcW, 0], bl: [0, srcH], br: [srcW, srcH] };
    const dst: cv.Mat = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC3);
    const linesMat = new cv.Mat();
    const bounds = Util.areaToBounds(100000, src.cols / src.rows);
    const dstW = bounds[0];
    const dstH = bounds[1];

    cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
    cv.resize(dst, dst, new cv.Size(...bounds));
    cv.Canny(dst, dst, 80, 160, 3, true);
    cv.HoughLines(dst, linesMat, 1, Math.PI / 180, 80, 0, 0, 0, Math.PI);

    const lines = this.parseScoredLines(linesMat);
    this.scoreParallelism(lines);
    this.scoreCenterDistance(lines, dstW, dstH);
    lines.sort((l0, l1) => l1.score - l0.score);
    console.log(lines);

    const hLines = lines.filter((l) => Util.loopDiff(l.theta, 0, 0, Math.PI) < this.MAX_TILT);
    //.slice(0, 2);
    const vLines = lines.filter((l) => Util.loopDiff(l.theta, Math.PI / 2, 0, Math.PI) < this.MAX_TILT);
    //.slice(0, 2);
    const intersections = Util.getIntersections(hLines, vLines, dstW, dstH).map((i) => Util.src2dstPt(i, dst, src));

    debugCanvas = document.getElementById("the-other-canvas") as HTMLCanvasElement;
    if (debugCanvas) {
      const debugDst = src.clone();

      //draw lines
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const rho = line.rho * (src.cols / dst.cols);
        const theta = line.theta;
        let a = Math.cos(theta);
        let b = Math.sin(theta);
        let x0 = a * rho;
        let y0 = b * rho;
        let startPoint = { x: x0 - 10000 * b, y: y0 + 10000 * a };
        let endPoint = { x: x0 + 10000 * b, y: y0 - 10000 * a };
        cv.line(
          debugDst,
          startPoint,
          endPoint,
          [255 * (i / lines.length), 255 - 255 * (i / lines.length), 127, 255],
          4
        );
      }

      //draw intersections
      for (let i = 0; i < intersections.length; i++) {
        const intersection = intersections[i];
        cv.circle(
          debugDst,
          new cv.Point(intersection[0], intersection[1]),
          20,
          [255 * (i / intersections.length), 255 - 255 * (i / intersections.length), 127, 255],
          4
        );
      }
      cv.imshow(debugCanvas, debugDst);
    }

    for (const key in corners) {
      corners[key] =
        intersections.splice(
          Util.maxIndex(intersections, (pt) => -Util.ptDiff(pt, corners[key])),
          1
        )[0] ?? corners[key];
    }
    return corners;
  }

  private static parseScoredLines(mat: cv.Mat) {
    let lines: ScoredLine[] = [];
    for (let i = 0; i < mat.rows; i++) {
      let rho = mat.data32F[i * 2];
      let theta = mat.data32F[i * 2 + 1];

      // filter out duplicates
      if (
        !lines.some(
          (l) =>
            Math.abs(rho - l.rho) < this.RHO_THRES * mat.rows &&
            Util.loopDiff(theta, l.theta, 0, Math.PI) < this.THETA_THRES
        )
      ) {
        lines.push({ rho, theta, score: 0 });
      }
    }
    return lines;
  }

  private static scoreParallelism(lines: ScoredLine[]) {
    //also value anti-parallelism => trapezoid, when looking at the paper from a slanted angle
    lines.forEach((l, i0) => {
      l.score += lines.reduce((p, c, i1) => {
        if (i0 === i1) return p;
        const parralelism = Math.pow(1 - Util.loopDiff(l.theta, c.theta, 0, Math.PI) / Math.PI, 2);
        return Math.max(p, parralelism);
      }, 0);
    });
  }

  private static scoreCenterDistance(lines: ScoredLine[], imgW: number, imgH: number) {
    lines.forEach((l) => {
      l.score += 0.5 * (Util.getShortestDistance(l, [imgW / 2, imgH / 2]) / (Math.max(imgW, imgH) / 2));
    });
  }
}
