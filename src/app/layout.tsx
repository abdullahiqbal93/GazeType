import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GazeType – Eye-Controlled Keyboard",
  description: "Type using your eyes with webcam-based gaze tracking. No special hardware needed.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
