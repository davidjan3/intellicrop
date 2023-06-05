import {
  cvtColor,
  Canny,
  HoughLines,
  Mat,
  CV_8UC3,
  COLOR_RGBA2GRAY,
  line,
  imshow,
} from "@techstark/opencv-js/";

export default class EdgeDetector {
  private static readonly RHO_THRES = 0.5;
  private static readonly THETA_THRES = 0.33 * Math.PI;

  static detect(src: Mat): Corners | undefined {
    let dst: Mat = Mat.zeros(src.rows, src.cols, CV_8UC3);
    const lines = new Mat();

    cvtColor(src, dst, COLOR_RGBA2GRAY, 0);
    Canny(dst, dst, 300, 300, 3, true);
    HoughLines(dst, lines, 1, Math.PI / 180, 80, 0, 0, 0, Math.PI);
    dst = src.clone();

    const filteredLines: [number, number][] = [];
    // draw lines
    for (let i = 0; i < lines.rows && filteredLines.length < 4; i++) {
      let rho = lines.data32F[i * 2];
      let theta = lines.data32F[i * 2 + 1];
      console.log(rho, theta);

      if (
        i === 0 ||
        !filteredLines.some(
          (l) =>
            Math.abs(rho - l[0]) < this.RHO_THRES * lines.rows &&
            this.loopDiff(theta, l[1], 0, Math.PI) < this.THETA_THRES
        )
      ) {
        filteredLines.push([rho, theta]);
      }
    }

    let c = 0;
    for (const filterLine of filteredLines) {
      const rho = filterLine[0];
      const theta = filterLine[1];
      let a = Math.cos(theta);
      let b = Math.sin(theta);
      let x0 = a * rho;
      let y0 = b * rho;
      let startPoint = { x: x0 - 10000 * b, y: y0 + 10000 * a };
      let endPoint = { x: x0 + 10000 * b, y: y0 - 10000 * a };
      line(
        dst,
        startPoint,
        endPoint,
        [
          255 * (c / filteredLines.length),
          255 - 255 * (c / filteredLines.length),
          127,
          255,
        ],
        4
      );
      c++;
    }
    imshow("the-other-canvas", dst);

    return { tl: [0, 0], tr: [0, 0], bl: [0, 0], br: [0, 0] };
  }

  private static loopDiff(
    n0: number,
    n1: number,
    min: number,
    max: number
  ): number {
    const range = max - min;
    const difference = Math.abs(n0 - n1);
    const loopedDifference = range - difference;
    return Math.min(difference, loopedDifference);
  }
}
