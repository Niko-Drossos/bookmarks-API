import esbuild from "esbuild";

esbuild.build({
	entryPoints: ["main.ts"],
	bundle: true,
	external: ["obsidian"],
	format: "cjs",
	target: "es2018",
	outfile: "main.js",
	logLevel: "info",
	sourcemap: "inline",
}).catch(() => process.exit(1));
