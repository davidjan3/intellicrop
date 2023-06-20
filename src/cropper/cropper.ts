import * as cv from "@techstark/opencv-js/";
import EdgeDetector from "../edge-detector/edgedetector";
import Util, { Corners, Pt } from "../util";

export interface CropperTheme {
  /** Radius of draggable corner in rem */
  cornerRadius?: number;
  /** Color of draggable corner */
  cornerColor?: string;
  /** Line thickness between draggable corners in rem */
  lineThickness?: number;
  /** Line color between draggable cornersr */
  lineColor?: string;
  /** Color used for background and margin */
  backgroundColor?: string;
}

export interface CropperOptions {
  /** Use edge detection for placing draggable corners */
  useEdgeDetection?: boolean;
  /** Theme to be used for Cropper UI */
  theme?: CropperTheme;
  /** Canvas element to show edge detection results */
  debugCanvas?: HTMLCanvasElement;
  /** Initial placement draggable corners (ignored when using edge detection) */
  corners?: Corners;
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
  private remPx: number;
  private onResize = () => this.adjustDimensions();

  constructor(canvas: HTMLCanvasElement, img: HTMLImageElement, options?: CropperOptions) {
    const defaultOptions = {
      useEdgeDetection: true,
      theme: {
        cornerRadius: 0.5,
        cornerColor: "white",
        lineThickness: 0.2,
        lineColor: "white",
        backgroundColor: "black",
      },
    };

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.img = img;
    this.imgMat = cv.imread(img);
    this.options = {
      useEdgeDetection: options.useEdgeDetection ?? defaultOptions.useEdgeDetection,
      theme: Object.assign(defaultOptions.theme, options?.theme),
      debugCanvas: options.debugCanvas,
    };
    this.imgW = this.imgMat.cols;
    this.imgH = this.imgMat.rows;

    canvas.width = this.imgW;
    canvas.height = this.imgH;

    if (options.useEdgeDetection) {
      this.corners = EdgeDetector.detect(this.imgMat, this.options.debugCanvas);
    }
    if (!this.corners) {
      this.corners = this.options.corners ?? {
        tl: [0, 0],
        tr: [this.imgW, 0],
        br: [this.imgW, this.imgH],
        bl: [0, this.imgH],
      };
    }

    this.registerListeners();
    this.adjustDimensions();
  }

  private registerListeners() {
    let draggingCorner: string | undefined;

    const mouseMoveHandler = (event) => {
      event.preventDefault();
      if (draggingCorner) {
        this.corners[draggingCorner] = Util.ptClipBounds(this.cl2imgPt([event.clientX, event.clientY]), [
          this.imgW,
          this.imgH,
        ]);
        this.render();
      }
    };

    const mouseUpHandler = () => {
      draggingCorner = undefined;
      window.removeEventListener("mousemove", mouseMoveHandler);
      window.removeEventListener("mouseup", mouseUpHandler);
    };

    this.canvas.addEventListener("mousedown", (event) => {
      const imgPt: Pt = this.cl2imgPt([event.clientX, event.clientY]);
      const r = this.options.theme.cornerRadius * this.remPx;
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

      window.addEventListener("mousemove", mouseMoveHandler);
      window.addEventListener("mouseup", mouseUpHandler);
    });

    window.addEventListener("resize", this.onResize);
  }

  private adjustDimensions() {
    const bounds = this.canvas.getBoundingClientRect();
    const s = this.imgH / bounds.height;
    this.remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) * s;
    this.canvas.width = this.imgW + this.options.theme.cornerRadius * this.remPx * 2;
    this.canvas.height = this.imgH + this.options.theme.cornerRadius * this.remPx * 2;
    this.render();
  }

  private render() {
    this.ctx.fillStyle = this.options.theme.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.img, ...this.img2ctxPt([0, 0]), this.imgW, this.imgH);
    const cornerKeys = Object.keys(this.corners);

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
      this.ctx.lineWidth = this.options.theme.lineThickness * this.remPx;
      this.ctx.moveTo(...cornerPt);
      this.ctx.lineTo(...nextCornerPt);
      this.ctx.stroke();

      //Draw corner
      this.ctx.beginPath();
      this.ctx.fillStyle = this.options.theme.cornerColor;
      this.ctx.arc(...cornerPt, this.options.theme.cornerRadius * this.remPx, 0, 2 * Math.PI);
      this.ctx.fill();
    }
  }

  public getResult(type?: string, quality?: number) {
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

    // Convert to image
    const image = new Image();
    const dstCanvas = document.createElement("canvas");
    cv.imshow(dstCanvas, dst);
    image.src = dstCanvas.toDataURL(type, quality);
    return image;
  }

  public discard() {
    window.removeEventListener("resize", this.onResize);
  }

  public rotateLeft() {
    this.rotate("left");
  }

  public rotateRight() {
    this.rotate("right");
  }

  private rotate(dir: "left" | "right") {
    const left = dir === "left";
    const { tl, tr, br, bl } = this.corners;
    this.corners = {
      tl: left ? tr : bl,
      tr: left ? br : tl,
      br: left ? bl : tr,
      bl: left ? tl : br,
    };

    this.ctx.translate(((left ? -1 : 1) * this.canvas.width) / 2, ((left ? -1 : 1) * this.canvas.height) / 2);
    this.ctx.rotate(((left ? -1 : 1) * Math.PI) / 2);

    this.onResize();
  }

  private img2ctxPt(imgPt: Pt): Pt {
    return [
      imgPt[0] + this.options.theme.cornerRadius * this.remPx,
      imgPt[1] + this.options.theme.cornerRadius * this.remPx,
    ];
  }

  private ctx2imgPt(ctxPt: Pt): Pt {
    return [
      ctxPt[0] - this.options.theme.cornerRadius * this.remPx,
      ctxPt[1] - this.options.theme.cornerRadius * this.remPx,
    ];
  }

  private cl2imgPt(clPt: Pt): Pt {
    const bounds = this.canvas.getBoundingClientRect();
    const sX = this.canvas.width / bounds.width;
    const sY = this.canvas.height / bounds.height;
    return this.ctx2imgPt([(clPt[0] - bounds.left) * sX, (clPt[1] - bounds.top) * sY]);
  }
}
