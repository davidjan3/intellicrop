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
  /** Log debug information in console */
  debugLogs?: boolean;
  /** Initial placement draggable corners (overrides useEdgeDetection) */
  corners?: Corners;
  /** Initial amount of clockwise 90° rotations */
  rotations?: number;
}

export default class Cropper {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img: HTMLImageElement;
  private readonly imgMat: cv.Mat;
  private readonly options: CropperOptions;
  /** Current width of image as displayed on canvas (accounting for rotation) */
  private imgW: number;
  /** Current height of image as displayed on canvas (accounting for rotation) */
  private imgH: number;
  /** Current position of draggable corners relative to unrotated source image */
  private corners: Corners | undefined;
  /** Amount of pixels per rem */
  private remPx: number;
  /** Amount of clockwise 90° rotations */
  private rotations = 0;
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
      useEdgeDetection: !options.corners && (options.useEdgeDetection ?? defaultOptions.useEdgeDetection),
      theme: Object.assign(defaultOptions.theme, options?.theme),
      debugCanvas: options.debugCanvas,
      debugLogs: options.debugLogs,
      corners: options.corners,
      rotations: options.rotations,
    };

    if (this.options.rotations) {
      this.rotations = (4 + options.rotations) % 4;
    }
    this.imgW = this.rotations % 2 == 0 ? this.imgMat.cols : this.imgMat.rows;
    this.imgH = this.rotations % 2 == 0 ? this.imgMat.rows : this.imgMat.cols;
    this.canvas.width = this.imgW;
    this.canvas.height = this.imgH;
    this.adjustDimensions();

    setTimeout(() => {
      if (this.options.useEdgeDetection) {
        if (this.options.debugLogs) console.time("edgedetection");
        this.corners = EdgeDetector.detect(this.imgMat, this.options.debugCanvas);
        if (this.options.debugLogs) console.timeEnd("edgedetection");
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
      this.render();
    }, 1);
  }

  private registerListeners() {
    let draggingCorner: string | undefined;

    const pointerMoveHandler = (event) => {
      event.preventDefault();
      if (draggingCorner) {
        const bounds: Pt = this.rotations % 2 == 0 ? [this.imgW, this.imgH] : [this.imgH, this.imgW];
        this.corners[draggingCorner] = Util.ptClipBounds(this.cl2imgPt([event.clientX, event.clientY]), bounds);
        this.render();
      }
    };

    const pointerUpHandler = () => {
      draggingCorner = undefined;
      window.removeEventListener("pointermove", pointerMoveHandler);
      window.removeEventListener("pointerup", pointerUpHandler);
    };

    this.canvas.addEventListener("pointerdown", (event) => {
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

      window.addEventListener("pointermove", pointerMoveHandler);
      window.addEventListener("pointerup", pointerUpHandler);
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

    if (this.rotations) {
      this.ctx.save();
      this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.rotate(this.rotations * (Math.PI / 2));
      if (this.rotations % 2 == 0) {
        this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
      } else {
        this.ctx.translate(-this.canvas.height / 2, -this.canvas.width / 2);
      }
    }
    this.ctx.drawImage(
      this.img,
      this.options.theme.cornerRadius * this.remPx,
      this.options.theme.cornerRadius * this.remPx,
      this.imgMat.cols,
      this.imgMat.rows
    );
    if (this.rotations) {
      this.ctx.restore();
    }

    if (this.corners) {
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
    } else {
      this.ctx.fillStyle = "rgba(0,0,0,0.5)";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /** Returns image cropped according to current position of draggable corners */
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

  /** Discards event listeners */
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

    this.rotations = (4 + this.rotations + (left ? -1 : 1)) % 4;

    this.imgW = this.rotations % 2 == 0 ? this.imgMat.cols : this.imgMat.rows;
    this.imgH = this.rotations % 2 == 0 ? this.imgMat.rows : this.imgMat.cols;

    this.canvas.width = this.imgW;
    this.canvas.height = this.imgH;

    this.adjustDimensions();
  }

  public getRotations() {
    return this.rotations;
  }

  public getCorners() {
    const { tl, tr, br, bl } = this.corners;
    return {
      tl: [tl[0], tl[1]],
      tr: [tr[0], tr[1]],
      br: [br[0], br[1]],
      bl: [bl[0], bl[1]],
    } as Corners;
  }

  /** Converts coordinates on unrotated source image to coordinates on ctx  */
  private img2ctxPt(imgPt: Pt): Pt {
    const cr = this.options.theme.cornerRadius;

    if (this.rotations === 0) {
      return [imgPt[0] + cr * this.remPx, imgPt[1] + cr * this.remPx];
    } else if (this.rotations === 1) {
      return [this.imgW - imgPt[1] + cr * this.remPx, imgPt[0] + cr * this.remPx];
    } else if (this.rotations === 2) {
      return [this.imgW - imgPt[0] + cr * this.remPx, this.imgH - imgPt[1] + cr * this.remPx];
    } else if (this.rotations === 3) {
      return [imgPt[1] + cr * this.remPx, this.imgH - imgPt[0] + cr * this.remPx];
    }
  }

  /** Converts coordinates on ctx to coordinates on unrotated source image */
  private ctx2imgPt(ctxPt: Pt): Pt {
    const cr = this.options.theme.cornerRadius;

    if (this.rotations === 0) {
      return [ctxPt[0] - cr * this.remPx, ctxPt[1] - cr * this.remPx];
    } else if (this.rotations === 1) {
      return [ctxPt[1] - cr * this.remPx, this.imgW - ctxPt[0] + cr * this.remPx];
    } else if (this.rotations === 2) {
      return [this.imgW - ctxPt[0] + cr * this.remPx, this.imgH - ctxPt[1] + cr * this.remPx];
    } else if (this.rotations === 3) {
      return [this.imgH - ctxPt[1] + cr * this.remPx, ctxPt[0] - cr * this.remPx];
    }
  }

  /** Converts cursor position on canvas to coordinates on unrotated source image */
  private cl2imgPt(clPt: Pt): Pt {
    const bounds = this.canvas.getBoundingClientRect();
    const sX = this.canvas.width / bounds.width;
    const sY = this.canvas.height / bounds.height;
    return this.ctx2imgPt([(clPt[0] - bounds.left) * sX, (clPt[1] - bounds.top) * sY]);
  }
}
