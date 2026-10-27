// The part of libheif-js's WebAssembly bundle that lib/photos/heic.ts uses (libheif-js 1.23.5 ships types only for
// libheif's raw functions, not for this entry point or its HeifDecoder wrapper).

declare module "libheif-js/wasm-bundle" {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    /** Fills `pixels` with the decoded picture, then calls back with it, or with nothing when decoding failed. */
    display(pixels: ImageData, done: (shown: ImageData | null) => void): void;
  }
  const libheif: {
    HeifDecoder: new () => { decode(bytes: Uint8Array): HeifImage[] };
  };
  export default libheif;
}
