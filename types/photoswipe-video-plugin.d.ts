// Minimal ambient declaration for photoswipe-video-plugin (ships no .d.ts).
// Only the constructor signature used by openMediaLightbox() is typed here.
declare module 'photoswipe-video-plugin' {
  import type PhotoSwipeLightbox from 'photoswipe/lightbox';

  interface VideoPluginOptions {
    videoAttributes?: Record<string, string>;
    autoplay?: boolean;
  }

  export default class PhotoSwipeVideoPlugin {
    constructor(lightbox: PhotoSwipeLightbox, options?: VideoPluginOptions);
  }
}
