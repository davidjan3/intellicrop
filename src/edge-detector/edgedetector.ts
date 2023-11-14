import * as cv from "@techstark/opencv-js/";
import Util, { Corners, Line, Pt } from "../util";

type Scored = { score: number };
type Intersection = Scored & { pt: Pt; hLine: Line; vLine: Line };
type ScoredCorners = Scored & { corners: Corners };

export default class EdgeDetector {
  private static readonly RHO_THRES = 0.05;
  private static readonly THETA_THRES = 4 * (Math.PI / 180);
  private static readonly MAX_TILT = 35 * (Math.PI / 180);
  private static readonly PARSE_LINES_AMOUNT = 8;
  private static readonly MIN_AREA = 0.2;

  static detect(src: cv.Mat, debugCanvas?: HTMLCanvasElement): Corners | undefined {
    const srcW = src.cols;
    const srcH = src.rows;
    const boundaryCorners: Corners = { tl: [0, 0], tr: [srcW, 0], br: [srcW, srcH], bl: [0, srcH] };
    const dst: cv.Mat = cv.Mat.zeros(0, 0, cv.CV_8UC3);
    const dstBounds = Util.areaToBounds(100000, src.cols / src.rows);
    const dstW = dstBounds[0];
    const dstH = dstBounds[1];
    const dstDiag = Math.sqrt(dstW * dstW + dstH * dstH);
    let debugDst = undefined;
    const hLinesMat = new cv.Mat();
    const vLinesMat = new cv.Mat();

    cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
    cv.resize(dst, dst, new cv.Size(...dstBounds));
    cv.adaptiveThreshold(dst, dst, 255, cv.CALIB_CB_ADAPTIVE_THRESH, cv.THRESH_BINARY, 15, 0);
    cv.erode(dst, dst, cv.Mat.ones(5, 5, cv.CV_8U));
    cv.Canny(dst, dst, 0, 160, 3, true);
    cv.dilate(dst, dst, cv.Mat.ones(4, 4, cv.CV_8U));
    if (debugCanvas) debugDst = dst.clone();
    cv.HoughLines(dst, hLinesMat, 2, Math.PI / 180, 50, 0, 0, Math.PI / 2 - this.MAX_TILT, Math.PI / 2 + this.MAX_TILT);
    cv.HoughLines(dst, vLinesMat, 2, Math.PI / 180, 50, 0, 0, -this.MAX_TILT, this.MAX_TILT);
    const hLines = this.parseLines(hLinesMat, dstDiag);
    const vLines = this.parseLines(vLinesMat, dstDiag);

    let intersections = this.getScoredIntersections(hLines, vLines, dstW, dstH);
    intersections.forEach((i) => (i.pt = Util.src2dstPt(i.pt, dst, src)));

    if (debugDst) {
      cv.resize(debugDst, debugDst, new cv.Size(src.cols, src.rows));
      cv.cvtColor(debugDst, debugDst, cv.COLOR_GRAY2RGBA, 0);

      // draw lines
      for (const line of [...hLines, ...vLines]) {
        const rho = line.rho * (src.cols / dst.cols);
        const theta = line.theta;
        let a = Math.cos(theta);
        let b = Math.sin(theta);
        let x0 = a * rho;
        let y0 = b * rho;
        let startPoint = { x: x0 - 10000 * b, y: y0 + 10000 * a };
        let endPoint = { x: x0 + 10000 * b, y: y0 - 10000 * a };
        cv.line(debugDst, startPoint, endPoint, [255, 0, 127, 255], 4);
      }

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

    const imgArea = Util.area(boundaryCorners);
    if (intersections.length > 4) {
      const cornersArr = this.getScoredCorners(intersections, imgArea);

      if (cornersArr.length) {
        return Util.maxValue(cornersArr, (sc) => sc.score).corners;
      }
    }

    const outmostCorners = this.getOutmostCorners(intersections, boundaryCorners)?.corners;
    if (outmostCorners && Util.area(outmostCorners) / imgArea > this.MIN_AREA) {
      return outmostCorners;
    }

    return undefined;
  }

  private static parseLines(mat: cv.Mat, imgDiag: number) {
    let lines: Line[] = [];
    for (let i = 0; i < mat.rows && lines.length < this.PARSE_LINES_AMOUNT; i++) {
      let rho = mat.data32F[i * 2];
      let theta = mat.data32F[i * 2 + 1];

      // filter out duplicates
      if (
        !lines.some(
          (l) =>
            Math.abs(rho - l.rho) < this.RHO_THRES * imgDiag &&
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
              score: angleScore + houghScore,
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
        Util.maxIndex(intersections, (i) => -Util.ptDistance(i.pt, corners.corners[key])),
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
            if (areaScore > this.MIN_AREA) {
              cornersArr.push({
                corners: corners,
                score: tl.score + tr.score + br.score + bl.score + areaScore,
              });
            }
          }
        });
      });
    });

    return cornersArr;
  }
}
