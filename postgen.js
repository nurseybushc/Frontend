const { watch, readFile, writeFile } = require("fs");
const { basename } = require("path");
const { promisify } = require("util");
const { red, orange, cyan, green } = require("colorette");
const glob = require("tiny-glob");
const mri = require("mri");
const JSON5 = require("json5");

const argv = mri(process.argv.slice(2), {
  boolean: ["watch"],
  string: [],
  alias: {
    watch: "w"
  },
  default: {}
});
const [readFileAsync, writeFileAsync] = [readFile, writeFile].map(promisify);

if (watch && !process.platform.indexOf(["win32", "darwin"])) {
  console.log(
    orange(
      `postgen.js -> Your OS (${process.platform}) does not support fs.watch`
    )
  );
  process.exit(1);
}

(async () => {
  if (argv.watch) {
    console.log(cyan("postgen.js -> watching..."));
    generatePostsFile({ watch: false });
    let debounceTimeout = undefined;
    watch(
      "src/router/posts",
      {
        recursive: true
      },
      (event, filename) => {
        if (filename !== "posts.ts") {
          debounceTimeout && clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(() => {
            generatePostsFile({ watch });
            debounceTimeout = undefined;
          }, 50);
        }
      }
    );
  } else {
    generatePostsFile({ watch });
  }
})();

const metadataRegex = /export\s+const\s+metadata\s*=\s*({(?:[\s\S])*})/m;

async function generatePostsFile({ watch }) {
  try {
    const filenames = (await glob(`src/router/posts/**/*.mdx`, {
      filesOnly: true,
      absolute: true
    })).sort((a, b) => (basename(a) < basename(b) ? -1 : 1));
    const contents = await Promise.all(
      filenames.map(async file => await readFileAsync(file, "utf8"))
    );
    const posts = contents.map((content, index) => ({
      ...JSON5.parse(content.match(metadataRegex)[1]),
      id: basename(filenames[index], ".mdx")
    }));

    await writeFileAsync(
      "src/store/posts.ts",
      `/* generated by /postgen.js */\nexport const metadata = ${JSON.stringify(
        posts,
        null,
        2
      )};\n`
    );
    console.log(
      green(
        `postgen.js -> Generated src/store/posts.ts (${filenames.length} post${
          posts.length > 1 ? "s" : ""
        })`
      )
    );
  } catch (e) {
    console.error(red(e));
    console.log(
      red(
        `postgen.js -> Failed to grab a list of posts in via src/router/posts/**/*.mdx and create a new all.tsx file importing metadata from each`
      )
    );
    !watch && process.exit(1);
  }
}
