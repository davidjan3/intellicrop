import Cropper from "./cropper/cropper.js";

const fileUploadInput = document.getElementById("file-input");
const srcImage = document.getElementById("src-img") as HTMLImageElement;
const cropperCanvas = document.getElementById("cropper-canvas") as HTMLCanvasElement;
const debugCanvas = document.getElementById("debug-canvas") as HTMLCanvasElement;
const applyButton = document.getElementById("apply-button");

fileUploadInput?.addEventListener(
  "change",
  function (e) {
    srcImage.src = URL.createObjectURL((e.target as HTMLInputElement).files[0]);
  },
  false
);

let cropper: Cropper;

srcImage.onload = () => {
  cropper = new Cropper(cropperCanvas, srcImage, {
    useEdgeDetection: true,
    debugCanvas: debugCanvas,
  });
};

applyButton.onclick = () => {
  const resultImage = cropper.getResult();
  cropper.discard();
  resultImage.onload = () => {
    debugCanvas.width = resultImage.width;
    debugCanvas.height = resultImage.height;
    debugCanvas.getContext("2d").drawImage(resultImage, 0, 0);
  };
};
