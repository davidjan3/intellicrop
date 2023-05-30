import Cropper from "../dist/intellicrop.js";

const fileUploadEl = document.getElementById("file-upload");
const srcImgEl = document.getElementById("src-image");
const theCanvas = document.getElementById("the-canvas");
const theButton = document.getElementById("the-button");

fileUploadEl.addEventListener(
  "change",
  function (e) {
    srcImgEl.src = URL.createObjectURL(e.target.files[0]);
  },
  false
);

srcImgEl.onload = () => {
  const cropper = new Cropper(theCanvas, srcImgEl, {
    useEdgeDetection: false,
    theme: { cornerRadius: 20, marginSize: 20 },
  });
  theButton.onclick = () => {
    cropper.getResult();
  };
  console.log(cropper);
};
