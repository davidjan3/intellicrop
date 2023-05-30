import * as cv from "@techstark/opencv-js/";
import EdgeDetector from "./edgedetector";

export type Pt = [number, number];

export interface Corners {
  tl: Pt;
  tr: Pt;
  bl: Pt;
  br: Pt;
}

export interface CropperTheme {
  marginSize: number;
  marginColor: string;
  cornerRadius: number;
  cornerColor: string;
  lineThickness: number;
  lineColor: string;
}

export interface CropperOptions {
  useEdgeDetection: boolean;
  theme: CropperTheme;
}

export default class Cropper {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img: HTMLImageElement;
  private readonly imgMat: cv.Mat;
  private readonly options: CropperOptions;
  private readonly imgW: number;
  private readonly imgH: number;
  private corners: Corners;

  constructor(
    canvas: HTMLCanvasElement,
    img: HTMLImageElement,
    options: CropperOptions = {
      useEdgeDetection: true,
      theme: {
        marginSize: 5,
        marginColor: "grey",
        cornerRadius: 5,
        cornerColor: "blue",
        lineThickness: 2,
        lineColor: "blue",
      },
    }
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.img = img;
    this.imgMat = cv.imread(img);
    this.options = options;
    this.imgW = this.imgMat.cols;
    this.imgH = this.imgMat.rows;

    canvas.width = this.imgW + this.options.theme.marginSize * 2;
    canvas.height = this.imgH + this.options.theme.marginSize * 2;
    this.ctx.drawImage(this.img, ...this.img2ctxPt([0, 0]));

    if (options.useEdgeDetection) {
      const corners = EdgeDetector.detect(this.imgMat);
      if (corners) {
        this.corners = corners;
      }
    }
    if (!this.corners) {
      this.corners = { tl: [0, 0], tr: [0, this.imgW], bl: [this.imgH, 0], br: [this.imgH, this.imgW] };
    }
  }

  /*public getResult() {
    let dst = new cv.Mat();
    let dsize = new cv.Size(imageHeight, imageWidth);
    let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, pointsArray);
    let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, imageHeight, 0, imageHeight, imageWidth, 0, imageWidth]);
    let M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    document.getElementById("imageInit").style.display = "none";
    cv.imshow("imageResult", dst);
  }*/

  private img2ctxPt(imgPt: Pt): Pt {
    return [imgPt[0] + this.options.theme.marginSize, imgPt[1] + this.options.theme.marginSize];
  }

  private ctx2imgPt(ctxPt: Pt): Pt {
    return [ctxPt[0] - this.options.theme.marginSize, ctxPt[1] - this.options.theme.marginSize];
  }
}
