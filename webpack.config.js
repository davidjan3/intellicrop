const path = require("path");

module.exports = {
  context: path.resolve(__dirname, "src"),
  entry: "./cropper.ts",
  mode: "development",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  experiments: {
    outputModule: true,
  },
  output: {
    filename: "intellicrop.js",
    path: path.resolve(__dirname, "dist"),
    publicPath: "/dist/",
    library: {
      type: "module",
    },
  },
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      path: false,
      fs: false,
      crypto: false,
    },
  },
  devServer: {
    port: 5000,
    static: "./",
    hot: true,
  },
};
