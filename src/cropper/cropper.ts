import * as cv from "@techstark/opencv-js/";
import EdgeDetector from "../edge-detector/edgedetector";
import Util, { Corners, EdgeCenters, Line, Pt, ViewCenter } from "../util";

export interface CropperTheme {
  /** Radius of corner grabbers in rem */
  cornerGrabberRadius?: number;
  /** Color of corner grabbers */
  cornerGrabberColor?: string;
  /** Line thickness of edges in rem */
  edgeThickness?: number;
  /** Color of edges */
  edgeColor?: string;
  /** Radius of edge grabbers in rem */
  edgeGrabberRadius?: number;
  /** Color of edge grabbers */
  edgeGrabberColor?: string;
  /** Radius of center grabber in rem */
  centerGrabberRadius?: number;
  /** Color of center grabber */
  centerGrabberColor?: string;
  /** Line thickness of crosslines in rem */
  crossLineThickness?: number;
  /** Color of crosslines */
  crossLineColor?: string;
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
  /** Current position of corner grabbers relative to unrotated source image */
  private corners: Corners | undefined;
  /** Current position of edge grabbers relative to unrotated source image */
  private edgeCenters: EdgeCenters | undefined;
  /** Current position of center grabber relative to unrotated source image */
  private viewCenter: ViewCenter | undefined;
  /** Amount of pixels per rem */
  private remPx: number;
  /** Amount of clockwise 90° rotations */
  private rotations = 0;

  private onPointerDown: (event: PointerEvent) => void;
  private onPointerMove: (event: PointerEvent) => void;
  private onPointerUp: (event: PointerEvent) => void;
  private onResize = () => this.adjustDimensions();

  constructor(canvas: HTMLCanvasElement, img: HTMLImageElement, options?: CropperOptions) {
    const defaultOptions: CropperOptions = {
      useEdgeDetection: true,
      theme: {
        cornerGrabberRadius: 0.5,
        cornerGrabberColor: "white",
        edgeThickness: 0.2,
        edgeColor: "white",
        edgeGrabberRadius: options?.theme?.cornerGrabberRadius ? options.theme.cornerGrabberRadius * 0.8 : 0.4,
        edgeGrabberColor: options?.theme?.cornerGrabberColor ?? "white",
        centerGrabberRadius: options?.theme?.cornerGrabberRadius ? options.theme.cornerGrabberRadius * 1.2 : 0.6,
        centerGrabberColor: options?.theme?.cornerGrabberColor ?? "rgba(255,255,255,0.5)",
        crossLineThickness: options?.theme?.edgeThickness ?? 0.2,
        crossLineColor: options?.theme?.edgeColor ?? "rgba(255,255,255,0.5)",
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
      this.rotations = Util.rotateVal(options.rotations, 0, 4);
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
      this.updateCenters();
      this.registerListeners();
      this.render();
    }, 1);
  }

  private registerListeners() {
    let dragged: keyof Corners | keyof EdgeCenters | keyof ViewCenter | undefined;
    let bounds: Pt | undefined;
    let edgeDragProps:
      | {
          dragLine: Line;
          edgeCenter: Pt;
          oppositeEdgeCenter: Pt;
          moveCorners: { key: keyof Corners; towardsKey: keyof Corners; deltaX: number; deltaY: number }[];
          scalarMin: number;
          scalarMax: number;
        }
      | undefined;
    let centerDragProps:
      | {
          cornerOffsets: Corners;
        }
      | undefined;

    this.onPointerDown = (event) => {
      dragged = this.getDragged([event.clientX, event.clientY]);
      bounds = this.rotations % 2 == 0 ? [this.imgW, this.imgH] : [this.imgH, this.imgW];
      if (dragged in this.edgeCenters) {
        const edgeCenter = this.edgeCenters[dragged];
        const oppositeEdgeCenter = this.edgeCenters[Util.rotateKey(this.edgeCenters, dragged, 2)];
        const dragLine = Util.lineThrough(edgeCenter, oppositeEdgeCenter);

        const cornerKeys = Object.keys(this.corners) as (keyof Corners)[];
        const edgeCenterKeys = Object.keys(this.edgeCenters) as (keyof EdgeCenters)[];
        const moveCorners = [];
        let scalarMin = -Infinity;
        let scalarMax = Infinity;

        for (let i = 0; i < 2; i++) {
          const edgeCenterKeyIndex = edgeCenterKeys.indexOf(dragged as keyof EdgeCenters);
          const moveCornerKey = cornerKeys[Util.rotateVal(edgeCenterKeyIndex, i, cornerKeys.length)];
          const towardsCornerKey = cornerKeys[Util.rotateVal(edgeCenterKeyIndex, -i - 1, cornerKeys.length)];
          const moveCornerPt = this.corners[moveCornerKey];
          const towardsCornerPt = this.corners[towardsCornerKey];
          const deltaX = moveCornerPt[0] - towardsCornerPt[0];
          const deltaY = moveCornerPt[1] - towardsCornerPt[1];

          let scalarLeft = -towardsCornerPt[0] / deltaX;
          let scalarRight = (bounds[0] - towardsCornerPt[0]) / deltaX;
          let scalarTop = -towardsCornerPt[1] / deltaY;
          let scalarBottom = (bounds[1] - towardsCornerPt[1]) / deltaY;

          scalarMin = Math.max(scalarMin, ...[scalarLeft, scalarRight, scalarTop, scalarBottom].filter((s) => s < 0));
          scalarMax = Math.min(scalarMax, ...[scalarLeft, scalarRight, scalarTop, scalarBottom].filter((s) => s > 1));

          moveCorners[i] = {
            key: moveCornerKey,
            towardsKey: towardsCornerKey,
            deltaX: deltaX,
            deltaY: deltaY,
          };
        }

        edgeDragProps = { dragLine, edgeCenter, oppositeEdgeCenter, moveCorners, scalarMin, scalarMax };
      } else if (dragged in this.viewCenter) {
        const cornerOffsets = Util.mapObj(this.corners, (c) => Util.ptDiff(this.viewCenter.c, c));

        centerDragProps = { cornerOffsets };
      }

      window.addEventListener("pointermove", this.onPointerMove);
      window.addEventListener("pointerup", this.onPointerUp);
    };

    this.onPointerMove = (event) => {
      event.preventDefault();
      if (dragged) {
        if (dragged in this.corners) {
          this.corners[dragged] = Util.ptClipBounds(this.cl2imgPt([event.clientX, event.clientY]), bounds);
        } else if (dragged in this.edgeCenters) {
          const { dragLine, edgeCenter, oppositeEdgeCenter, moveCorners, scalarMin, scalarMax } = edgeDragProps;

          const newPt = Util.closestPoint(dragLine, this.cl2imgPt([event.clientX, event.clientY]));
          const newLenRelative = Math.min(
            Math.max(Util.ptRelativeDistance(newPt, oppositeEdgeCenter, edgeCenter), scalarMin),
            scalarMax
          );

          for (let moveCorner of moveCorners) {
            const towardsCornerPt = this.corners[moveCorner.towardsKey];
            this.corners[moveCorner.key] = [
              towardsCornerPt[0] + moveCorner.deltaX * newLenRelative,
              towardsCornerPt[1] + moveCorner.deltaY * newLenRelative,
            ];
          }
        } else if (dragged in this.viewCenter) {
          const { cornerOffsets } = centerDragProps;

          const viewCenter = Util.ptClipBoundsRect(this.cl2imgPt([event.clientX, event.clientY]), {
            left: Math.max(-cornerOffsets.tl[0], -cornerOffsets.bl[0]),
            right: Math.min(bounds[0] - cornerOffsets.tr[0], bounds[0] - cornerOffsets.br[0]),
            top: Math.max(-cornerOffsets.tl[1], -cornerOffsets.tr[1]),
            bottom: Math.min(bounds[1] - cornerOffsets.bl[1], bounds[1] - cornerOffsets.br[1]),
          });
          this.corners = Util.mapObj(cornerOffsets, (c) => [c[0] + viewCenter[0], c[1] + viewCenter[1]]);
        }
        this.updateCenters();
        this.render();
      }
    };

    this.onPointerUp = () => {
      dragged = undefined;
      window.removeEventListener("pointermove", this.onPointerMove);
      window.removeEventListener("pointerup", this.onPointerUp);
    };

    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("resize", this.onResize);
  }

  private getDragged(clientPt: Pt): keyof Corners | keyof EdgeCenters | keyof ViewCenter | undefined {
    const cursorPt: Pt = this.cl2imgPt(clientPt);
    let radius: number;

    radius = this.options.theme.cornerGrabberRadius * this.remPx;
    for (const key in this.corners) {
      const corner = this.corners[key];
      if (Util.withinRadius(cursorPt, corner, radius)) {
        return key as keyof Corners;
      }
    }

    radius = this.options.theme.edgeGrabberRadius * this.remPx;
    for (const key in this.edgeCenters) {
      const corner = this.edgeCenters[key];
      if (Util.withinRadius(cursorPt, corner, radius)) {
        return key as keyof EdgeCenters;
      }
    }

    radius = this.options.theme.centerGrabberRadius * this.remPx;
    if (Util.withinRadius(cursorPt, this.viewCenter.c, radius)) {
      return "c";
    }

    return undefined;
  }

  /** Discards event listeners */
  public discard() {
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
  }

  private adjustDimensions() {
    const bounds = this.canvas.getBoundingClientRect();
    const s = this.imgH / bounds.height;
    this.remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) * s;
    this.canvas.width = this.imgW + this.options.theme.cornerGrabberRadius * this.remPx * 2;
    this.canvas.height = this.imgH + this.options.theme.cornerGrabberRadius * this.remPx * 2;
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
      this.options.theme.cornerGrabberRadius * this.remPx,
      this.options.theme.cornerGrabberRadius * this.remPx,
      this.imgMat.cols,
      this.imgMat.rows
    );
    if (this.rotations) {
      this.ctx.restore();
    }

    if (this.corners) {
      const cornerKeys = Object.keys(this.corners);
      const edgeCenterKeys = Object.keys(this.edgeCenters);

      for (let i = 0; i < cornerKeys.length; i++) {
        const cornerKey = cornerKeys[i];
        const nextCornerKey = cornerKeys[(i + 1) % cornerKeys.length];
        const edgeCenterKey = edgeCenterKeys[i];
        const corner = this.corners[cornerKey];
        const nextCorner = this.corners[nextCornerKey];
        const edgeCenter = this.edgeCenters[edgeCenterKey];
        const cornerPt = this.img2ctxPt(corner);
        const nextCornerPt = this.img2ctxPt(nextCorner);
        const edgeCenterPt = this.img2ctxPt(edgeCenter);

        //Draw corner
        this.ctx.beginPath();
        this.ctx.fillStyle = this.options.theme.cornerGrabberColor;
        this.ctx.arc(...cornerPt, this.options.theme.cornerGrabberRadius * this.remPx, 0, 2 * Math.PI);
        this.ctx.fill();

        //Draw edge grabber
        if (this.options.theme.edgeGrabberRadius) {
          this.ctx.beginPath();
          this.ctx.fillStyle = this.options.theme.edgeGrabberColor;
          this.ctx.arc(...edgeCenterPt, this.options.theme.edgeGrabberRadius * this.remPx, 0, 2 * Math.PI);
          this.ctx.fill();
        }

        //Draw edge
        if (this.options.theme.edgeThickness) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = this.options.theme.edgeColor;
          this.ctx.lineWidth = this.options.theme.edgeThickness * this.remPx;
          this.ctx.moveTo(...cornerPt);
          this.ctx.lineTo(...nextCornerPt);
          this.ctx.stroke();
        }
      }

      //Draw crosslines
      for (const edgeCenterPair of [
        [this.edgeCenters.t, this.edgeCenters.b],
        [this.edgeCenters.l, this.edgeCenters.r],
      ]) {
        const edgeCenter0Pt = this.img2ctxPt(edgeCenterPair[0]);
        const edgeCenter1Pt = this.img2ctxPt(edgeCenterPair[1]);
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.options.theme.crossLineColor;
        this.ctx.lineWidth = this.options.theme.crossLineThickness * this.remPx;
        this.ctx.moveTo(...edgeCenter0Pt);
        this.ctx.lineTo(...edgeCenter1Pt);
        this.ctx.stroke();
      }

      //Draw center grabber
      if (this.options.theme.centerGrabberRadius) {
        const viewCenterPt = this.img2ctxPt(this.viewCenter.c);
        this.ctx.beginPath();
        this.ctx.fillStyle = this.options.theme.centerGrabberColor;
        this.ctx.arc(...viewCenterPt, this.options.theme.centerGrabberRadius * this.remPx, 0, 2 * Math.PI);
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
    const w =
      (Util.ptDistance(this.corners.tl, this.corners.tr) + Util.ptDistance(this.corners.bl, this.corners.br)) / 2;
    const h =
      (Util.ptDistance(this.corners.tl, this.corners.bl) + Util.ptDistance(this.corners.tr, this.corners.br)) / 2;
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

    this.rotations = Util.rotateVal(this.rotations, left ? -1 : 1, 4);

    this.imgW = this.rotations % 2 == 0 ? this.imgMat.cols : this.imgMat.rows;
    this.imgH = this.rotations % 2 == 0 ? this.imgMat.rows : this.imgMat.cols;

    this.canvas.width = this.imgW;
    this.canvas.height = this.imgH;

    this.updateCenters();
    this.adjustDimensions();
  }

  private updateCenters() {
    this.edgeCenters = this.corners ? Util.edgeCenters(this.corners) : undefined;
    this.viewCenter = this.corners ? { c: Util.cornerCenter(this.corners) } : undefined;
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
    const cr = this.options.theme.cornerGrabberRadius;

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
    const cr = this.options.theme.cornerGrabberRadius;

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
