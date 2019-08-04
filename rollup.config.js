import path from "path";
import { readFile } from "fs";
import { promisify } from "util";
import glob from "tiny-glob";
import postcss from "rollup-plugin-postcss";
import postcssNesting from "postcss-nesting";
import postcssCustomProperties from "postcss-custom-properties";
import nodeResolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import replace from "rollup-plugin-re";
import OMT from "@surma/rollup-plugin-off-main-thread";

/* wild crazy mdx hacky shit */
import mdx from "@mdx-js/mdx";
import { transform } from "@swc/core";
import { createFilter } from "rollup-pluginutils";

const localPkg = require("./package.json");

const readFileAsync = promisify(readFile);

const env = {
  API_ENV: process.env.API_ENV,
  NODE_ENV: process.env.NODE_ENV || "production",
  NOMODULE: (process.env.NOMODULE || "false") === "true" // default to the es6, "type=module" version
};

const swcOptions = {
  sourceMaps: true,
  jsc: {
    target: "es2016",
    parser: {
      syntax: "typescript",
      tsx: true,
      decorators: false,
      dynamicImport: true
    }
  }
};

export default async () => ({
  input: ["src/index.tsx"].concat(await glob("src/router/posts/*.mdx")),
  output: {
    sourcemap: env.NODE_ENV !== "production" ? "inline" : true,
    exports: "named",
    dir: path.resolve(
      __dirname,
      `public/dist/${env.NOMODULE ? "no" : ""}module/`
    ),
    format: "amd"
  },
  treeshake: env.NODE_ENV === "production",
  experimentalOptimizeChunks: env.NODE_ENV === "production",
  watch: {
    clearScreen: false
  },
  plugins: [
    nodeResolve({
      extensions: ['.mjs', '.js', '.jsx', '.json', ".ts", ".tsx", ".mdx"]
    }),
    replace({
      replaces: {
        "process.env.NODE_ENV": JSON.stringify(env.NODE_ENV),
        "process.env.VERSION": JSON.stringify(localPkg.version),
        "process.env.NOMODULE": env.NOMODULE ? "true" : "false",
        "process.env.API_URL":
          env.API_ENV === "production" || env.NODE_ENV === "production"
            ? JSON.stringify("https://api.modwat.ch")
            : JSON.stringify("http://localhost:3001"),
        ...(env.NODE_ENV !== "production" ? {} : {
          "import \"preact/debug\";": "",
          "import devtools from \"unistore/devtools\";": "",
          "devtools(_store);": "_store;"
        }),
        ...(env.NOMODULE
          ? {}
          : {
              'import "unfetch/polyfill/index";': ""
            })
      },
      patterns: env.NODE_ENV !== "production" ? [{
        test: /import .+ from \"\@modwatch\/types\";/,
        replace: ""
      }, {
        test: /import .+ from \"\..+\/types\";/,
        replace: ""
      }] : []
    }),
    commonjs({
      sourceMap: env.NODE_ENV === "production"
    }),
    mdxPlugin({
      include: ["./src/*/*.mdx", "./src/**/*.mdx"],
      exclude: "node_modules/**"
    }),
    env.NODE_ENV !== "production" ?
      swcPlugin({
        include: ["./src/*/*.ts+(|x)", "./src/**/*.ts+(|x)"],
        exclude: "node_modules/**",
        ...swcOptions
      }) : require("rollup-plugin-typescript")({
          include: ["./src/*/*.ts+(|x)", "./src/**/*.ts+(|x)"],
          exclude: "node_modules/**",
          typescript: require("typescript"),
          tslib: require("tslib"),
          sourceMap: env.NODE_ENV === "production",
          isolatedModules: env.NODE_ENV === "production",
          target: env.NOMODULE ? "es5" : "es6"
        }),
    postcss({
      include: ["./src/*.css", "./src/**/*.css"],
      exclude: "node_modules/**",
      sourceMap: env.NODE_ENV === "production",
      modules: {
        scopeBehaviour: "global"
      },
      extract: true,
      plugins: [
        postcssNesting(),
        postcssCustomProperties({
          importFrom: "./src/properties.css",
          preserve: false
        })
      ].concat(env.NODE_ENV !== "production" ? [] : [require("cssnano")()])
    }),
    OMT({
      loader: (await readFileAsync(
        path.resolve(__dirname, "loadz0r", "loader.min.js"),
        "utf8"
      )).replace(/process\.env\.PUBLIC_PATH/g, JSON.stringify(`/dist/${env.NOMODULE ? "no" : ""}module`)),
      prependLoader: (chunk, workerFiles) =>
        (chunk.isEntry && chunk.fileName.includes("index.js")) || workerFiles.includes(chunk.facadeModuleId)
    })
  ].concat(
    env.NODE_ENV === "production"
      ? [
          require("rollup-plugin-terser").terser({
            ecma: env.NOMODULE ? 5 : 6,
            compress: true,
            mangle: true,
            toplevel: true,
            sourcemap: true
          }),
          require("rollup-plugin-visualizer")({
            filename: `./node_modules/.visualizer/index-${
              env.NOMODULE ? "no" : ""
            }module.html`,
            title: `Modwatch Dependency Graph (${
              env.NOMODULE ? "no" : ""
            }module)`
          })
        ]
      : []
  )
});

function swcPlugin(options) {
  if (!options) options = {};
  const filter = createFilter(options.include, options.exclude);

  return {
    name: "swc",
    transform: async (code, id) => {
      if (!filter(id)) return null;

      try {
        const transformed = await transform(code, swcOptions);
        return {
          code: transformed.code.replace(/React\.createElement/g, "h"),
          map: transformed.map.replace(/React\.createElement/g, "h")
        };
      } catch (e) {
        e.plugin = "swc";
        if (!e.loc) e.loc = {};
        e.loc.file = id;
        e.frame = e.snippet;
        throw e;
      }
    }
  };
}

function mdxPlugin(options) {
  if (!options) options = {};
  const filter = createFilter(options.include, options.exclude);

  return {
    name: "preact-mdx-swc",
    transform: async (code, id) => {
      if (!filter(id)) return null;

      const jsx = `import { h } from "preact";\n${(await mdx(code)).replace(
        "/* @jsx mdx */",
        ""
      )}`;

      const es5 = await transform(jsx, {
        sourceMaps: true,
        jsc: {
          target: "es2016",
          parser: {
            "syntax": "ecmascript",
            "jsx": true,
            "dynamicImport": false
          },
          transform: {
            "react": {
              "pragma": "h",
              "pragmaFrag": "h",
              "development": false,
              "useBuiltins": false
            }
          }
        }
      });

      try {
        return es5;
      } catch (e) {
        e.plugin = "preact-mdx-swc";
        if (!e.loc) e.loc = {};
        e.loc.file = id;
        e.frame = e.snippet;
        throw e;
      }
    }
  };
}
