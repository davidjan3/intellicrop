import * as cv from "@techstark/opencv-js/";
import EdgeDetector from "./edgedetector";
import Util, { Corners, Pt } from "./util";

export interface CropperTheme {
  marginSize?: number;
  marginColor?: string;
  cornerRadius?: number;
  cornerColor?: string;
  lineThickness?: number;
  lineColor?: string;
  backgroundColor?: string;
}

export interface CropperOptions {
  useEdgeDetection?: boolean;
  theme?: CropperTheme;
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

  constructor(canvas: HTMLCanvasElement, img: HTMLImageElement, options?: CropperOptions) {
    const defaultOptions = {
      useEdgeDetection: true,
      theme: {
        marginSize: 5,
        marginColor: "grey",
        cornerRadius: 5,
        cornerColor: "blue",
        lineThickness: 2,
        lineColor: "blue",
        backgroundColor: "white",
      },
    };

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.img = img;
    this.imgMat = cv.imread(img);
    this.options = {
      useEdgeDetection: options.useEdgeDetection ?? defaultOptions.useEdgeDetection,
      theme: Object.assign(defaultOptions.theme, options?.theme),
    };
    this.imgW = this.imgMat.cols;
    this.imgH = this.imgMat.rows;

    canvas.width = this.imgW + this.options.theme.marginSize * 2;
    canvas.height = this.imgH + this.options.theme.marginSize * 2;

    if (options.useEdgeDetection) {
      const corners = EdgeDetector.detect(this.imgMat);
      if (corners) {
        this.corners = corners;
      }
    }
    if (!this.corners) {
      this.corners = { tl: [0, 0], tr: [this.imgW, 0], bl: [0, this.imgH], br: [this.imgW, this.imgH] };
    }

    this.registerListener();
    this.render();
  }

  private registerListener() {
    let draggingCorner: string | undefined;
    this.canvas.addEventListener("mousedown", (event) => {
      const imgPt: Pt = this.cl2imgPt([event.clientX, event.clientY]);
      const r = this.options.theme.cornerRadius;
      for (const key in this.corners) {
        const corner = this.corners[key];
        const x = imgPt[0];
        const y = imgPt[1];
        const x0 = corner[0] - r;
        const x1 = corner[0] + r;
        const y0 = corner[1] - r;
        const y1 = corner[1] + r;
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
          draggingCorner = key;
          break;
        }
      }
    });
    this.canvas.addEventListener("mousemove", (event) => {
      if (draggingCorner) {
        this.corners[draggingCorner] = this.cl2imgPt([event.clientX, event.clientY]);
        this.render();
      }
    });
    this.canvas.addEventListener("mouseup", (event) => {
      draggingCorner = undefined;
    });
  }

  private render() {
    this.ctx.fillStyle = this.options.theme.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.img, ...this.img2ctxPt([0, 0]), this.imgW, this.imgH);
    const cornerKeys = ["tl", "tr", "br", "bl"]; //Object.keys would give wrong order

    for (let i = 0; i < cornerKeys.length; i++) {
      const key = cornerKeys[i];
      const nextKey = cornerKeys[(i + 1) % cornerKeys.length];
      const corner = this.corners[key];
      const nextCorner = this.corners[nextKey];
      const cornerPt = this.img2ctxPt([corner[0], corner[1]]);
      const nextCornerPt = this.img2ctxPt([nextCorner[0], nextCorner[1]]);

      //Draw line to next corner
      this.ctx.beginPath();
      this.ctx.strokeStyle = this.options.theme.lineColor;
      this.ctx.lineWidth = this.options.theme.lineThickness;
      this.ctx.moveTo(...cornerPt);
      this.ctx.lineTo(...nextCornerPt);
      this.ctx.stroke();

      //Draw corner
      this.ctx.beginPath();
      this.ctx.fillStyle = this.options.theme.cornerColor;
      this.ctx.arc(...cornerPt, this.options.theme.cornerRadius, 0, 2 * Math.PI);
      this.ctx.fill();
    }
  }

  public getResult() {
    let dst = new cv.Mat();
    let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      ...this.corners.tl,
      ...this.corners.tr,
      ...this.corners.bl,
      ...this.corners.br,
    ]); //Make new size from srcTri?
    const w = (Util.ptDiff(this.corners.tl, this.corners.tr) + Util.ptDiff(this.corners.bl, this.corners.br)) / 2;
    const h = (Util.ptDiff(this.corners.tl, this.corners.bl) + Util.ptDiff(this.corners.tr, this.corners.br)) / 2;
    let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, w, 0, 0, h, w, h]);
    let M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(this.imgMat, dst, M, new cv.Size(w, h), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    cv.imshow(this.canvas, dst);
  }

  private img2ctxPt(imgPt: Pt): Pt {
    return [imgPt[0] + this.options.theme.marginSize, imgPt[1] + this.options.theme.marginSize];
  }

  private ctx2imgPt(ctxPt: Pt): Pt {
    return [ctxPt[0] - this.options.theme.marginSize, ctxPt[1] - this.options.theme.marginSize];
  }

  private cl2imgPt(clPt: Pt): Pt {
    const bounds = this.canvas.getBoundingClientRect();
    const sX = this.canvas.width / bounds.width;
    const sY = this.canvas.height / bounds.height;
    return this.ctx2imgPt([(clPt[0] - bounds.left) * sX, (clPt[1] - bounds.top) * sY]);
  }
}
