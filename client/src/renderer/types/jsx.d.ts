/**
 * @fileoverview React JSX global type declaration for CinePair.
 * React 19 exports JSX types from 'react/jsx-runtime'. This shim
 * re-exports the JSX namespace globally so `: JSX.Element` works
 * in all components without explicit imports.
 */

import type { JSX as ReactJSX } from 'react';

declare global {
  // Re-export React's JSX namespace globally
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Element extends ReactJSX.Element {}
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
  }
}

export {};
