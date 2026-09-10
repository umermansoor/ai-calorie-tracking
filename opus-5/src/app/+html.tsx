import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Web only: the HTML shell every page is rendered into.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="theme-color" content="#F6F6F8" />
        <meta
          name="description"
          content="Snap a photo of your meal for calories, macros and a blood sugar forecast. A Cal AI-style tracker built on the January AI API."
        />
        <title>Forkcast · AI calorie tracker</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
