Simple JavaScript solution to edge detection assisted image cropping.

---

### Demo

A small usage demo can be found in `src/index.html` and `src/index.ts` on GitHub.

Execute `npm run dev` to host the demo at `http://localhost:1234`.

### Usage

Install intellicrop via `npm i intellicrop`.

To use intellicrop, you need a canvas and the source image you want to crop.

For touch controls to work flawlessly, make sure to add `touch-action: none;` to your canvas style.

Then simply wait for the source image to load, and attach a Cropper to your canvas:

```
import Cropper from "intellicrop";
const canvas = document.getElementById("your-canvas");
const img = document.getElementById("your-source-img");
let cropper;

img.onload = async () => {
    await Cropper.initialization(); //Wait for OpenCV to become available
    cropper = new Cropper(canvas, img);
}
```

By default the Cropper will automatically use edge detection to place its draggable corners in viable spots on the image.

Once the user is done cropping, just save the cropped and deskewed image and discard the Cropper, to get rid of left over event listeners:

```
const croppedImage = cropper.getResult();
cropper.discard();
```

If you want to disable edge detection or change some cosmetics of the Cropper UI, you can also pass options to the constructor:

```
cropper = new Cropper(canvas, img, {
    useEdgeDetection: true,
    theme: {
        edgeColor: "red",
        ...
    },
    ...
});
```
