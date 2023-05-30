import * as cv from "@techstark/opencv-js/";
import { Corners } from "./cropper";

export default class EdgeDetector {
  static detect(src: cv.Mat): Corners | undefined {
    const dst = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC3);
    const lines = new cv.Mat();

    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
    cv.Canny(src, dst, 160, 160, 3, true); // You can try more different parameters
    cv.cvtColor(src, src, cv.COLOR_GRAY2RGBA, 0);
    cv.HoughLines(dst, lines, 1, Math.PI / 180, 80, 0, 0, 0, Math.PI);
    // draw lines
    for (let i = 0; i < lines.rows; ++i) {
      let rho = lines.data32F[i * 2];
      let theta = lines.data32F[i * 2 + 1];
      let a = Math.cos(theta);
      let b = Math.sin(theta);
      let x0 = a * rho;
      let y0 = b * rho;
      let startPoint = { x: x0 - 1000 * b, y: y0 + 1000 * a };
      let endPoint = { x: x0 + 1000 * b, y: y0 - 1000 * a };
      cv.line(src, startPoint, endPoint, [255, 0, 0, 255]);
    }
    cv.imshow("the-canvas", src); // display the output to canvas

    src.delete(); // remember to free the memory
    dst.delete();
    return { tl: [0, 0], tr: [0, 0], bl: [0, 0], br: [0, 0] };
  }
}
/*
(function () {
  var fileUploadEl = document.getElementById("file-upload"),
    srcImgEl = document.getElementById("src-image");

  fileUploadEl.addEventListener(
    "change",
    function (e) {
      srcImgEl.src = URL.createObjectURL(e.target.files[0]);
    },
    false
  );

  srcImgEl.onload = function () {
    var src = cv.imread(srcImgEl); // load the image from <img>
    let dst = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC3);
    let lines = new cv.Mat();

    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
    cv.Canny(src, dst, 160, 160, 3, true); // You can try more different parameters
    cv.cvtColor(src, src, cv.COLOR_GRAY2RGBA, 0);
    cv.HoughLines(dst, lines, 1, Math.PI / 180, 80, 0, 0, 0, Math.PI);
    // draw lines
    for (let i = 0; i < lines.rows; ++i) {
      let rho = lines.data32F[i * 2];
      let theta = lines.data32F[i * 2 + 1];
      let a = Math.cos(theta);
      let b = Math.sin(theta);
      let x0 = a * rho;
      let y0 = b * rho;
      let startPoint = { x: x0 - 1000 * b, y: y0 + 1000 * a };
      let endPoint = { x: x0 + 1000 * b, y: y0 - 1000 * a };
      cv.line(src, startPoint, endPoint, [255, 0, 0, 255]);
    }
    cv.imshow("the-canvas", src); // display the output to canvas

    src.delete(); // remember to free the memory
    dst.delete();
  };

  // opencv loaded?
  window.onOpenCvReady = function () {
    document.getElementById("loading-opencv-msg").remove();
  };
})();*/
