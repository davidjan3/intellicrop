import Cropper from "./cropper/cropper.js";

const fileUploadEl = document.getElementById("file-upload");
const srcImgEl = document.getElementById("src-image") as HTMLImageElement;
const theCanvas = document.getElementById("the-canvas") as HTMLCanvasElement;
const theOtherCanvas = document.getElementById("the-other-canvas") as HTMLCanvasElement;
const theButton = document.getElementById("the-button");

fileUploadEl?.addEventListener(
  "change",
  function (e) {
    srcImgEl.src = URL.createObjectURL((e.target as HTMLInputElement).files[0]);
  },
  false
);
let cropper;
srcImgEl.onload = () => {
  cropper?.discard();
  cropper = new Cropper(theCanvas, srcImgEl, {
    useEdgeDetection: true,
    debugCanvas: theOtherCanvas,
  });
  theButton.onclick = () => {
    cropper.getResult();
  };
};
