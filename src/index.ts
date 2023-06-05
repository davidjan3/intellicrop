import Cropper from "./cropper/cropper.js";

const fileUploadEl: any = document.getElementById("file-upload");
const srcImgEl: any = document.getElementById("src-image");
const theCanvas: any = document.getElementById("the-canvas");
const theOtherCanvas: any = document.getElementById("the-other-canvas");
const theButton: any = document.getElementById("the-button");

fileUploadEl?.addEventListener(
  "change",
  function (e) {
    srcImgEl.src = URL.createObjectURL(e.target.files[0]);
  },
  false
);

srcImgEl.onload = () => {
  const cropper = new Cropper(theCanvas, srcImgEl, {
    useEdgeDetection: true,
    theme: { cornerRadius: 20, marginSize: 20 },
    debugCanvas: theOtherCanvas,
  });
  theButton.onclick = () => {
    cropper.getResult();
  };
};
