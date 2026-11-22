import type { ReactNode } from "react";

export const metadata = {
  title: "Cue",
  description: "Календар записів для салонів краси",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
