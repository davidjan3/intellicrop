import * as cv from "@techstark/opencv-js/";
import Util, { Corners, Line, Pt } from "../util";

type Scored = { score: number };
type Intersection = Scored & { pt: Pt; hLine: Line; vLine: Line };
type ScoredCorners = Scored & { corners: Corners };

export default class EdgeDetector {
  private static readonly RHO_THRES = 0.05;
  private static readonly THETA_THRES = 4 * (Math.PI / 180);
  private static readonly MAX_TILT = 35 * (Math.PI / 180);

  static detect(src: cv.Mat, debugCanvas?: HTMLCanvasElement): Corners | undefined {
    const srcW = src.cols;
    const srcH = src.rows;
    const boundaryCorners: Corners = { tl: [0, 0], tr: [srcW, 0], br: [srcW, srcH], bl: [0, srcH] };
    const dst: cv.Mat = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC3);
    const linesMat = new cv.Mat();
    const dstBounds = Util.areaToBounds(500000, src.cols / src.rows);
    const dstW = dstBounds[0];
    const dstH = dstBounds[1];

    cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
    cv.resize(dst, dst, new cv.Size(...dstBounds));
    //cv.GaussianBlur(dst, dst, new cv.Size(5, 5), 0);
    cv.adaptiveThreshold(dst, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 15, 0);
    cv.erode(dst, dst, cv.Mat.ones(5, 5, cv.CV_8U));
    cv.Canny(dst, dst, 0, 160, 3, true);
    const debugDst = dst.clone();
    //cv.dilate(dst, dst, cv.Mat.ones(5, 5, cv.CV_8U));
    cv.HoughLines(dst, linesMat, 1, Math.PI / 360, 50, 0, 0, 0, Math.PI);

    /*cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
    cv.resize(dst, dst, new cv.Size(...dstBounds));
    cv.Canny(dst, dst, 80, 160, 3, true);
    cv.GaussianBlur(dst, dst, new cv.Size(5, 5), 0);
    cv.adaptiveThreshold(dst, dst, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, 15, 0);
    cv.erode(dst, dst, cv.Mat.ones(5, 5, cv.CV_8U));
    cv.findContours(dst, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);*/

    const lines = this.parseLines(linesMat, dst.cols);

    const hLines = lines.filter((l) => Util.loopDiff(l.theta, Math.PI / 2, 0, Math.PI) < this.MAX_TILT).slice(0, 4);
    const vLines = lines.filter((l) => Util.loopDiff(l.theta, 0, 0, Math.PI) < this.MAX_TILT).slice(0, 4);

    let intersections = this.getScoredIntersections(hLines, vLines, dstW, dstH);
    intersections.forEach((i) => (i.pt = Util.src2dstPt(i.pt, dst, src)));

    if (debugCanvas) {
      //const debugDst = src.clone();
      cv.resize(debugDst, debugDst, new cv.Size(src.cols, src.rows));
      cv.cvtColor(debugDst, debugDst, cv.COLOR_GRAY2RGBA, 0);

      // draw lines
      /*for (const line of [...hLines, ...vLines]) {
        const rho = line.rho * (src.cols / dst.cols);
        const theta = line.theta;
        let a = Math.cos(theta);
        let b = Math.sin(theta);
        let x0 = a * rho;
        let y0 = b * rho;
        let startPoint = { x: x0 - 10000 * b, y: y0 + 10000 * a };
        let endPoint = { x: x0 + 10000 * b, y: y0 - 10000 * a };
        cv.line(debugDst, startPoint, endPoint, [255, 0, 127, 255], 4);
      }*/

      // draw intersections
      for (let i = 0; i < intersections.length; i++) {
        const intersection = intersections[i];
        cv.circle(
          debugDst,
          new cv.Point(...intersection.pt),
          20,
          [255 - Math.pow(intersection.score, 8) * 255, Math.pow(intersection.score, 8) * 255, 127, 255],
          4
        );
      }

      cv.imshow(debugCanvas, debugDst);
    }

    if (intersections.length > 4) {
      const imgArea = Util.area(boundaryCorners);
      const cornersArr = this.getScoredCorners(intersections, imgArea);

      if (cornersArr.length) {
        return Util.maxValue(cornersArr, (sc) => sc.score).corners;
      }
    }

    return this.getOutmostCorners(intersections, boundaryCorners)?.corners ?? undefined;
  }

  private static parseLines(mat: cv.Mat, imgW: number) {
    let lines: Line[] = [];
    for (let i = 0; i < mat.rows; i++) {
      let rho = mat.data32F[i * 2];
      let theta = mat.data32F[i * 2 + 1];

      // filter out duplicates
      if (
        !lines.some(
          (l) =>
            Math.abs(rho - l.rho) < this.RHO_THRES * imgW &&
            Util.loopDiff(theta, l.theta, 0, Math.PI) < this.THETA_THRES
        )
      ) {
        lines.push({ rho, theta });
      }
    }
    return lines;
  }

  private static getScoredIntersections(hLines: Line[], vLines: Line[], imgW: number, imgH: number): Intersection[] {
    const intersections: Intersection[] = [];

    for (let h = 0; h < hLines.length; h++) {
      const hLine = hLines[h];
      for (let v = 0; v < vLines.length; v++) {
        const vLine = vLines[v];
        const cosTheta0 = Math.cos(hLine.theta);
        const sinTheta0 = Math.sin(hLine.theta);
        const cosTheta1 = Math.cos(vLine.theta);
        const sinTheta1 = Math.sin(vLine.theta);

        const denominator = cosTheta0 * sinTheta1 - sinTheta0 * cosTheta1;

        if (denominator !== 0) {
          const x = (sinTheta1 * hLine.rho - sinTheta0 * vLine.rho) / denominator;
          const y = (cosTheta0 * vLine.rho - cosTheta1 * hLine.rho) / denominator;
          const angle = Util.loopDiff(vLine.theta, hLine.theta, 0, Math.PI);
          const angleScore = Math.max(1 - (2 * Util.loopDiff(angle, Math.PI / 2, 0, Math.PI)) / Math.PI, 0);
          const houghScore = 1 - (h / hLines.length + v / vLines.length) / 2;
          if (x > 0 && y > 0 && x < imgW && y < imgH) {
            intersections.push({
              pt: [x, y],
              score: angleScore + 0.5 * houghScore,
              hLine: hLine,
              vLine: vLine,
            });
          }
        }
      }
    }

    return intersections;
  }

  private static getOutmostCorners(intersections: Intersection[], boundaryCorners: Corners) {
    if (intersections.length < 4) return undefined;

    intersections = intersections.slice(); // copy to prevent mutating original
    const corners: ScoredCorners = {
      score: 0,
      corners: boundaryCorners,
    };

    for (const key in corners.corners) {
      const intersection = intersections.splice(
        Util.maxIndex(intersections, (i) => -Util.ptDiff(i.pt, corners.corners[key])),
        1
      )[0];
      corners.corners[key] = intersection.pt;
      corners.score += intersection.score;
    }

    return corners;
  }

  private static getScoredCorners(intersections: Intersection[], imgArea: number) {
    const cornersArr: ScoredCorners[] = [];

    intersections.forEach((tl) => {
      const trArr = intersections.filter((tr) => tl.hLine === tr.hLine && tl.pt[0] < tr.pt[0]);
      const blArr = intersections.filter((bl) => tl.vLine === bl.vLine && tl.pt[1] < bl.pt[1]);
      trArr.forEach((tr) => {
        blArr.forEach((bl) => {
          const br = intersections.find((br) => br.hLine === bl.hLine && br.vLine === tr.vLine);
          if (br) {
            const corners: Corners = {
              tl: tl.pt,
              tr: tr.pt,
              br: br.pt,
              bl: bl.pt,
            };
            const areaScore = Util.area(corners) / imgArea;
            cornersArr.push({
              corners: corners,
              score: areaScore < 0.2 ? 0 : tl.score + tr.score + br.score + bl.score + areaScore,
            });
          }
        });
      });
    });

    return cornersArr;
  }
}
