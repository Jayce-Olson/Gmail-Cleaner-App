const { defineConfig } = require("@vue/cli-service");
//
module.exports = defineConfig({
  devServer: {
    webSocketServer: false,
  },
  transpileDependencies: true,
  configureWebpack: {
    resolve: {
      fallback: {
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        stream: require.resolve("stream-browserify"),
        url: require.resolve("url/"),
        querystring: require.resolve("querystring-es3"),
        os: require.resolve("os-browserify/browser"),
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      },
    },
  },
});
