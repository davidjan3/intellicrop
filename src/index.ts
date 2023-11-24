import Cropper from "./cropper/cropper.js";

const fileUploadInput = document.getElementById("file-input") as HTMLInputElement;
const srcImage = document.getElementById("src-img") as HTMLImageElement;
const cropperCanvas = document.getElementById("cropper-canvas") as HTMLCanvasElement;
const debugCanvas = document.getElementById("debug-canvas") as HTMLCanvasElement;
const reloadButton = document.getElementById("reload-button") as HTMLButtonElement;
const applyButton = document.getElementById("apply-button") as HTMLButtonElement;
const rotRightButton = document.getElementById("rotate-right-button") as HTMLButtonElement;
const rotLeftButton = document.getElementById("rotate-left-button") as HTMLButtonElement;

fileUploadInput?.addEventListener(
  "change",
  function (e) {
    srcImage.src = URL.createObjectURL((e.target as HTMLInputElement).files[0]);
  },
  false
);

let cropper: Cropper;

srcImage.onload = async () => {
  cropper?.discard();
  await Cropper.initialization();
  cropper = new Cropper(cropperCanvas, srcImage, {
    useEdgeDetection: true,
    debugCanvas: debugCanvas,
    debugLogs: true,
  });
};

reloadButton.onclick = () => {
  if (cropper) {
    const corners = cropper.getCorners();
    const rotations = cropper.getRotations();
    cropper?.discard();
    cropper = new Cropper(cropperCanvas, srcImage, {
      corners: corners,
      rotations: rotations,
      debugCanvas: debugCanvas,
    });
  }
};

applyButton.onclick = () => {
  const resultImage = cropper.getResult();
  resultImage.onload = () => {
    debugCanvas.width = resultImage.width;
    debugCanvas.height = resultImage.height;
    debugCanvas.getContext("2d").drawImage(resultImage, 0, 0);
  };
};

rotRightButton.onclick = () => {
  cropper.rotateRight();
};

rotLeftButton.onclick = () => {
  cropper.rotateLeft();
};
