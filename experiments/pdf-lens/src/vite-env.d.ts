/// <reference types="vite/client" />

// Vite's `?worker` import suffix returns a Worker constructor.
declare module '*?worker' {
  const workerConstructor: {
    new (options?: { name?: string }): Worker;
  };
  export default workerConstructor;
}
