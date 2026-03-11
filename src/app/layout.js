import "./globals.css";

export const metadata = {
  title: "Kailash Shankar",
  description: "Personal website of Kailash Shankar",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}